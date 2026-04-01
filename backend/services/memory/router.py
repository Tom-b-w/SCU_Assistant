"""用户记忆管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from shared.database import get_db
from shared.models import UserMemory

router = APIRouter(prefix="/api/memories", tags=["memory"])

CATEGORY_LABELS = {
    "taste": "口味偏好",
    "campus": "校区习惯",
    "major": "专业信息",
    "study_habit": "学习习惯",
    "schedule_pref": "时间偏好",
}


@router.get("")
async def list_memories(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户所有记忆，按分类分组"""
    result = await db.execute(
        select(UserMemory)
        .where(UserMemory.user_id == user.id)
        .order_by(UserMemory.category, UserMemory.updated_at.desc())
    )
    memories = result.scalars().all()

    grouped: dict[str, list[dict]] = {}
    for m in memories:
        cat = m.category
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({
            "id": m.id,
            "key": m.key,
            "value": m.value,
            "confidence": m.confidence,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        })

    categories = []
    for cat_key, cat_label in CATEGORY_LABELS.items():
        items = grouped.pop(cat_key, [])
        if items:
            categories.append({
                "category": cat_key,
                "label": cat_label,
                "items": items,
            })

    # Include any unknown categories
    for cat_key, items in grouped.items():
        categories.append({
            "category": cat_key,
            "label": cat_key,
            "items": items,
        })

    return {"categories": categories}


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除指定记忆"""
    result = await db.execute(
        select(UserMemory).where(
            UserMemory.id == memory_id,
            UserMemory.user_id == user.id,
        )
    )
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="记忆不存在")

    await db.execute(
        delete(UserMemory).where(UserMemory.id == memory_id)
    )
    await db.commit()
    return {"message": "已删除"}
