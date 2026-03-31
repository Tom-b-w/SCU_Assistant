import redis.asyncio as redis

from shared.config import settings

# Use fakeredis if REDIS_URL is "memory://" or redis is unavailable
def _create_redis_client():
    if settings.redis_url == "memory://":
        try:
            import fakeredis.aioredis as fakeredis_async
            return fakeredis_async.FakeRedis(decode_responses=True)
        except ImportError:
            pass
    return redis.from_url(settings.redis_url, decode_responses=True)

redis_client = _create_redis_client()


async def get_redis() -> redis.Redis:
    return redis_client
