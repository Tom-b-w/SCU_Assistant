from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import Notification


async def get_notifications(
    session: AsyncSession,
    source: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Notification]:
    query = select(Notification).order_by(Notification.published_at.desc())
    if source:
        query = query.where(Notification.source == source)
    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())
