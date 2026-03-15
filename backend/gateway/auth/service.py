import uuid
from datetime import datetime, timedelta, timezone

import jwt
import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.models import User


class AuthService:
    def __init__(self, db: AsyncSession, redis_client: redis.Redis):
        self.db = db
        self.redis = redis_client

    def create_access_token(self, user_id: int, student_id: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )
        payload = {
            "sub": str(user_id),
            "student_id": student_id,
            "exp": expire,
            "jti": str(uuid.uuid4()),
        }
        return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")

    async def create_refresh_token(self, user_id: int) -> str:
        token = str(uuid.uuid4())
        key = f"refresh_token:{token}"
        ttl = settings.jwt_refresh_token_expire_days * 86400
        await self.redis.set(key, str(user_id), ex=ttl)
        return token

    def verify_access_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
            return payload
        except jwt.PyJWTError:
            return None

    async def verify_refresh_token(self, token: str) -> int | None:
        key = f"refresh_token:{token}"
        user_id = await self.redis.get(key)
        return int(user_id) if user_id else None

    async def revoke_refresh_token(self, token: str) -> None:
        key = f"refresh_token:{token}"
        await self.redis.delete(key)

    async def get_user_by_student_id(self, student_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.student_id == student_id))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create_or_update_user(
        self, student_id: str, name: str, campus: str | None = None,
        major: str | None = None, grade: int | None = None,
    ) -> User:
        user = await self.get_user_by_student_id(student_id)
        if user:
            user.name = name
            if campus:
                user.campus = campus
            if major:
                user.major = major
            if grade:
                user.grade = grade
        else:
            user = User(
                student_id=student_id, name=name,
                campus=campus, major=major, grade=grade,
            )
            self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
