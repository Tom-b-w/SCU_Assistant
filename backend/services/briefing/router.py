from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from services.briefing.service import generate_briefing
from shared.database import get_db

router = APIRouter(prefix="/api/briefing", tags=["briefing"])


@router.get("")
async def get_briefing(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await generate_briefing(db, user.id)


@router.get("/today")
async def get_today_briefing(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await generate_briefing(db, user.id)
