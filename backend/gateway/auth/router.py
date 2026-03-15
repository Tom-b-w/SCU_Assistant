import base64

from fastapi import APIRouter, Depends, Request, Response

from gateway.auth.dependencies import get_auth_service, get_current_user
from gateway.auth.schemas import CaptchaResponse, LoginRequest, TokenResponse, UserResponse
from gateway.auth.service import AuthService
from services.academic.jwc_client import get_jwc_client
from shared.cache import redis_client
from shared.config import settings
from shared.exceptions import UnauthorizedError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/captcha", response_model=CaptchaResponse)
async def get_captcha():
    """获取教务系统验证码图片（base64编码）"""
    jwc = get_jwc_client(redis_client=redis_client)
    session_key, captcha_bytes = await jwc.start_session()
    captcha_b64 = base64.b64encode(captcha_bytes).decode()
    return CaptchaResponse(session_key=session_key, captcha_image=captcha_b64)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    jwc = get_jwc_client(redis_client=redis_client)
    student_info = await jwc.login(
        session_key=body.session_key,
        student_id=body.student_id,
        password=body.password,
        captcha=body.captcha,
    )
    if student_info is None:
        raise UnauthorizedError("学号、密码或验证码错误")

    user = await auth_service.create_or_update_user(
        student_id=student_info["student_id"],
        name=student_info.get("name", f"学生{body.student_id}"),
        campus=student_info.get("campus"),
        major=student_info.get("major"),
        grade=student_info.get("grade"),
    )

    access_token = auth_service.create_access_token(
        user_id=user.id, student_id=user.student_id
    )
    refresh_token = await auth_service.create_refresh_token(user_id=user.id)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=dict)
async def refresh_token(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    token = request.cookies.get("refresh_token")
    if not token:
        raise UnauthorizedError("No refresh token")

    user_id = await auth_service.verify_refresh_token(token)
    if user_id is None:
        raise UnauthorizedError("Invalid or expired refresh token")

    await auth_service.revoke_refresh_token(token)

    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise UnauthorizedError("User not found")

    access_token = auth_service.create_access_token(
        user_id=user.id, student_id=user.student_id
    )
    new_refresh = await auth_service.create_refresh_token(user_id=user.id)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )

    return {"access_token": access_token}


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
):
    token = request.cookies.get("refresh_token")
    if token:
        await auth_service.revoke_refresh_token(token)
    response.delete_cookie("refresh_token")


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return UserResponse.model_validate(user)
