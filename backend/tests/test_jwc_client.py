import pytest
from services.academic.jwc_client import MockJwcClient


@pytest.fixture
def jwc_client():
    return MockJwcClient()


@pytest.mark.asyncio
async def test_start_session(jwc_client):
    session_key, captcha_bytes = await jwc_client.start_session()
    assert session_key.startswith("mock_session:")
    assert isinstance(captcha_bytes, bytes)
    assert len(captcha_bytes) > 0


@pytest.mark.asyncio
async def test_login_success(jwc_client):
    session_key, _ = await jwc_client.start_session()
    result = await jwc_client.login(session_key, "2022141461001", "password", "abcd")
    assert result is not None
    assert result["student_id"] == "2022141461001"
    assert "name" in result


@pytest.mark.asyncio
async def test_login_fail_short_id(jwc_client):
    session_key, _ = await jwc_client.start_session()
    result = await jwc_client.login(session_key, "123", "password", "abcd")
    assert result is None


@pytest.mark.asyncio
async def test_get_schedule(jwc_client):
    courses = await jwc_client.get_schedule("mock_session:xxx", "2025-2026-2")
    assert isinstance(courses, list)
    assert len(courses) > 0
    assert "course_name" in courses[0]
    assert "teacher" in courses[0]
    assert "weekday" in courses[0]


@pytest.mark.asyncio
async def test_get_scores(jwc_client):
    scores = await jwc_client.get_scores("mock_session:xxx")
    assert isinstance(scores, list)
    assert len(scores) > 0
    assert "course_name" in scores[0]
    assert "score" in scores[0]
    assert "credit" in scores[0]
