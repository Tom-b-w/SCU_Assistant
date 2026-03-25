"""
教务数据缓存服务 — 登录时抓取，API 从此表读取，每周刷新一次。
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from services.academic.jwc_client import get_jwc_client
from shared.cache import redis_client
from shared.database import async_session
from shared.models import AcademicCache

logger = logging.getLogger(__name__)

CACHE_MAX_AGE = timedelta(days=7)  # 7天刷新一次


async def get_cached(
    db: AsyncSession, user_id: int, data_type: str
) -> dict | None:
    """从数据库读取缓存数据，返回 None 表示无缓存。"""
    row = await db.execute(
        select(AcademicCache).where(
            AcademicCache.user_id == user_id,
            AcademicCache.data_type == data_type,
        )
    )
    cache = row.scalar_one_or_none()
    if cache is None:
        return None
    return {
        "data": cache.data,
        "fetched_at": cache.fetched_at.isoformat(),
        "is_stale": _is_stale(cache.fetched_at),
    }


def _is_stale(fetched_at: datetime) -> bool:
    now = datetime.now(timezone.utc)
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    return (now - fetched_at) > CACHE_MAX_AGE


async def upsert_cache(
    db: AsyncSession, user_id: int, data_type: str, data: dict
) -> None:
    """UPSERT：有则更新，无则插入。"""
    now = datetime.now(timezone.utc)
    stmt = pg_insert(AcademicCache).values(
        user_id=user_id,
        data_type=data_type,
        data=data,
        fetched_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_academic_cache_user_type",
        set_={
            "data": stmt.excluded.data,
            "fetched_at": stmt.excluded.fetched_at,
            "updated_at": now,
        },
    )
    await db.execute(stmt)
    await db.commit()


async def fetch_and_cache_all(user_id: int, student_id: str) -> None:
    """
    并发抓取课表、成绩、培养方案，存入数据库。
    用于登录后的后台任务和手动刷新。
    """
    session_key = f"jwc_auth:{student_id}"
    session_value = await redis_client.get(session_key)
    if not session_value:
        logger.warning("fetch_and_cache_all: 教务 session 不存在，跳过 (student=%s)", student_id)
        return

    logger.info("fetch_and_cache_all: 开始抓取 user=%s student=%s session=%s...",
                user_id, student_id, (session_value.decode() if isinstance(session_value, bytes) else session_value)[:20])
    jwc = get_jwc_client(redis_client=redis_client)
    logger.info("fetch_and_cache_all: 使用客户端 %s", type(jwc).__name__)

    async def _fetch(coro, data_type: str):
        try:
            result = await coro
            # 跳过空数据，避免覆盖已有缓存
            is_empty = False
            if isinstance(result, list) and len(result) == 0:
                is_empty = True
            elif isinstance(result, dict):
                # plan_completion 空数据: categories=[], earned_credits=0
                if not result.get("categories") and result.get("earned_credits", 0) == 0:
                    is_empty = True
            elif not result:
                is_empty = True

            if is_empty:
                logger.warning("抓取结果为空，跳过缓存写入: user=%s type=%s result=%s",
                               user_id, data_type, str(result)[:200])
                return

            async with async_session() as db:
                await upsert_cache(db, user_id, data_type, result)
            logger.info("缓存成功: user=%s type=%s, 数据量=%s", user_id, data_type,
                        len(result) if isinstance(result, list) else "dict")
        except Exception:
            logger.exception("缓存失败: user=%s type=%s", user_id, data_type)

    await asyncio.gather(
        _fetch(jwc.get_schedule(session_key, "2025-2026-2"), "schedule"),
        _fetch(jwc.get_scores(session_key), "scores"),
        _fetch(jwc.get_plan_completion(session_key), "plan_completion"),
        return_exceptions=True,
    )
