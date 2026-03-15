import pytest
from unittest.mock import AsyncMock

from gateway.auth.service import AuthService


@pytest.fixture
def auth_service():
    db = AsyncMock()
    redis = AsyncMock()
    return AuthService(db=db, redis_client=redis)


@pytest.mark.asyncio
async def test_create_access_token(auth_service):
    token = auth_service.create_access_token(user_id=1, student_id="2022141461001")
    assert isinstance(token, str)
    assert len(token) > 0


@pytest.mark.asyncio
async def test_create_refresh_token(auth_service):
    token = await auth_service.create_refresh_token(user_id=1)
    assert isinstance(token, str)
    assert len(token) > 0


@pytest.mark.asyncio
async def test_verify_access_token(auth_service):
    token = auth_service.create_access_token(user_id=1, student_id="2022141461001")
    payload = auth_service.verify_access_token(token)
    assert payload["sub"] == "1"
    assert payload["student_id"] == "2022141461001"


@pytest.mark.asyncio
async def test_verify_invalid_token(auth_service):
    payload = auth_service.verify_access_token("invalid-token")
    assert payload is None
