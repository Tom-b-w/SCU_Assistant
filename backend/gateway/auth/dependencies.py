from fastapi import Depends, Request

from gateway.auth.service import AuthService
from shared.cache import redis_client
from shared.database import get_db
from shared.exceptions import UnauthorizedError


async def get_auth_service(db=Depends(get_db)):
    return AuthService(db=db, redis_client=redis_client)


async def get_current_user(request: Request, auth_service: AuthService = Depends(get_auth_service)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authorization header")

    token = auth_header.split(" ")[1]
    payload = auth_service.verify_access_token(token)
    if payload is None:
        raise UnauthorizedError("Invalid or expired token")

    user = await auth_service.get_user_by_student_id(payload["student_id"])
    if user is None:
        raise UnauthorizedError("User not found")

    return user
