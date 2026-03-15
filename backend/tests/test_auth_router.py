import os

import pytest
from httpx import AsyncClient, ASGITransport

# 测试环境始终使用 mock 模式
os.environ["JWC_USE_MOCK"] = "true"

from gateway.main import create_app  # noqa: E402


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_captcha_endpoint(client):
    response = await client.get("/api/auth/captcha")
    assert response.status_code == 200
    data = response.json()
    assert "session_key" in data
    assert "captcha_image" in data
    assert len(data["captcha_image"]) > 0


@pytest.mark.asyncio
async def test_login_missing_body(client):
    response = await client.post("/api/auth/login", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_me_without_token(client):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
