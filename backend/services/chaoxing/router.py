"""学习通 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from shared.cache import get_redis
from shared.database import get_db
from services.chaoxing.service import ChaoxingService
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


@router.post("/qr/create", response_model=QRCodeResponse)
async def create_qr_code(
    user=Depends(get_current_user),
    redis=Depends(get_redis),
    svc: ChaoxingService = Depends(get_service),
):
    """创建学习通扫码登录二维码"""
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
