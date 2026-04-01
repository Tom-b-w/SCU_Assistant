"""学习通 API 路由"""
import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_auth_service, get_current_user
from gateway.auth.schemas import TokenResponse, UserResponse
from gateway.auth.service import AuthService
from shared.cache import get_redis
from shared.config import settings
from shared.database import get_db
from services.chaoxing.service import ChaoxingService, QR_SESSION_PREFIX
from services.chaoxing.schemas import (
    ChaoxingBindStatus,
    QRCodeResponse,
    QRStatusResponse,
    SyncResult,
)

router = APIRouter(prefix="/api/chaoxing", tags=["chaoxing"])

_service: ChaoxingService | None = None


def get_service() -> ChaoxingService:
    global _service
    if _service is None:
        _service = ChaoxingService()
    return _service


# ---- 免登录扫码端点（登录页使用） ----


@router.post("/qr/guest-create", response_model=QRCodeResponse)
async def guest_create_qr_code(
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """创建学习通扫码登录二维码（无需认证，用于登录页）"""
    result = await svc.start_qr_login(redis)
    return QRCodeResponse(**result)


@router.get("/qr/guest-status/{session_id}", response_model=QRStatusResponse)
async def guest_check_qr_status(
    session_id: str,
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """轮询二维码扫描状态（无需认证，用于登录页）"""
    result = await svc.check_qr_status(redis, session_id)
    return QRStatusResponse(**result)


@router.post("/qr/guest-login/{session_id}", response_model=TokenResponse)
async def guest_qr_login(
    session_id: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    扫码确认后，通过学习通账号登录系统（无需认证）。
    如果该学习通 uid 对应的用户已存在则直接登录，否则创建新用户。
    同时自动绑定学习通账号。
    """
    raw = await redis.get(f"{QR_SESSION_PREFIX}{session_id}:cookies")
    if not raw:
        raise HTTPException(status_code=400, detail="登录信息已过期，请重新扫码")

    login_data = json.loads(raw)
    cx_uid = login_data.get("uid", "")
    cx_name = login_data.get("uname", "")

    if not cx_uid:
        raise HTTPException(status_code=400, detail="未获取到学习通用户信息")

    # 用学习通 uid 作为 student_id 查找或创建用户
    # 先检查是否有已绑定该 cx_uid 的用户
    from sqlalchemy import select
    from shared.models import ChaoxingSession

    stmt = select(ChaoxingSession).where(ChaoxingSession.cx_uid == cx_uid)
    result = await db.execute(stmt)
    cx_session = result.scalar_one_or_none()

    if cx_session:
        # 已绑定的用户，直接登录
        user = await auth_service.get_user_by_id(cx_session.user_id)
        if not user:
            raise HTTPException(status_code=400, detail="关联用户不存在")
    else:
        # 没有绑定记录，创建新用户并绑定
        user = await auth_service.create_or_update_user(
            student_id=f"cx_{cx_uid}",
            name=cx_name or f"学习通用户",
        )
        # 自动绑定学习通
        svc = ChaoxingService()
        await svc.bind_account(db, redis, user.id, session_id)

    access_token = auth_service.create_access_token(
        user_id=user.id, student_id=user.student_id
    )
    refresh_token = await auth_service.create_refresh_token(user_id=user.id)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )

    # 清理 redis 中的登录数据（如果还存在）
    await redis.delete(f"{QR_SESSION_PREFIX}{session_id}:cookies")

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


# ---- 需要认证的端点 ----


@router.post("/qr/create", response_model=QRCodeResponse)
async def create_qr_code(
    user=Depends(get_current_user),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """创建学习通扫码登录二维码，返回 base64 图片"""
    result = await svc.start_qr_login(redis)
    return QRCodeResponse(**result)


@router.get("/qr/status/{session_id}", response_model=QRStatusResponse)
async def check_qr_status(
    session_id: str,
    user=Depends(get_current_user),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """轮询二维码扫描状态"""
    result = await svc.check_qr_status(redis, session_id)
    return QRStatusResponse(**result)


@router.post("/bind/{session_id}")
async def bind_chaoxing_account(
    session_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """将扫码登录的学习通账号绑定到当前用户"""
    try:
        result = await svc.bind_account(db, redis, user.id, session_id)
        return {"message": "绑定成功", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status", response_model=ChaoxingBindStatus)
async def get_bind_status(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    svc: ChaoxingService = Depends(get_service),
):
    """获取学习通绑定状态"""
    return await svc.get_bind_status(db, user.id)


@router.delete("/unbind")
async def unbind_chaoxing(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    svc: ChaoxingService = Depends(get_service),
):
    """解绑学习通账号"""
    await svc.unbind_account(db, user.id)
    return {"message": "已解绑"}


@router.post("/sync", response_model=SyncResult)
async def sync_deadlines(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    svc: ChaoxingService = Depends(get_service),
):
    """从学习通同步作业 DDL"""
    try:
        return await svc.sync_deadlines(db, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
