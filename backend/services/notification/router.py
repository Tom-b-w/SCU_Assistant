from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from services.notification.schemas import NotificationResponse
from services.notification import service
from services.notification.crawler import refresh_notifications

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    source: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    return await service.get_notifications(db, source, limit, offset)


@router.post("/refresh")
async def refresh(db: AsyncSession = Depends(get_db)):
    """手动刷新通知：从教务处、学工部抓取最新通知。"""
    new_count = await refresh_notifications(db)
    return {"new_count": new_count, "message": f"新增 {new_count} 条通知"}
