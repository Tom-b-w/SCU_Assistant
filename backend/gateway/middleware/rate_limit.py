import redis.asyncio as redis


async def check_rate_limit(
    redis_client: redis.Redis,
    key: str,
    limit: int,
    window: int = 60,
) -> bool:
    """Fixed-window counter rate limiter. Returns True if request is allowed."""
    current = await redis_client.get(key)

    if current is None:
        await redis_client.set(key, 1, ex=window)
        return True

    if int(current) >= limit:
        return False

    await redis_client.incr(key)
    return True
