import pytest
from unittest.mock import AsyncMock

from gateway.middleware.rate_limit import check_rate_limit


@pytest.mark.asyncio
async def test_rate_limit_allows_under_limit():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "5"
    mock_redis.ttl.return_value = 30

    result = await check_rate_limit(mock_redis, key="user:1", limit=60, window=60)
    assert result is True


@pytest.mark.asyncio
async def test_rate_limit_blocks_over_limit():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "61"
    mock_redis.ttl.return_value = 30

    result = await check_rate_limit(mock_redis, key="user:1", limit=60, window=60)
    assert result is False


@pytest.mark.asyncio
async def test_rate_limit_creates_key_if_not_exists():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    result = await check_rate_limit(mock_redis, key="user:1", limit=60, window=60)
    assert result is True
    mock_redis.set.assert_called_once()
