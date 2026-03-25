from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.deadline.schemas import DeadlineCreate, DeadlineUpdate
from shared.exceptions import NotFoundError
from shared.models import Deadline


async def create_deadline(
    db: AsyncSession, user_id: int, data: DeadlineCreate
) -> Deadline:
    deadline = Deadline(
        user_id=user_id,
        title=data.title,
        course=data.course,
        due_date=data.due_date,
        priority=data.priority.value,
    )
    db.add(deadline)
    await db.commit()
    await db.refresh(deadline)
    return deadline


async def get_deadlines(
    db: AsyncSession, user_id: int, completed: bool | None = None
) -> list[Deadline]:
    stmt = select(Deadline).where(Deadline.user_id == user_id)
    if completed is not None:
        stmt = stmt.where(Deadline.completed == completed)
    stmt = stmt.order_by(Deadline.due_date.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_deadline(
    db: AsyncSession, user_id: int, deadline_id: int
) -> Deadline:
    stmt = select(Deadline).where(
        Deadline.id == deadline_id, Deadline.user_id == user_id
    )
    result = await db.execute(stmt)
    deadline = result.scalar_one_or_none()
    if deadline is None:
        raise NotFoundError("截止日期不存在")
    return deadline


async def update_deadline(
    db: AsyncSession, user_id: int, deadline_id: int, data: DeadlineUpdate
) -> Deadline:
    deadline = await get_deadline(db, user_id, deadline_id)
    update_data = data.model_dump(exclude_unset=True)
    if "priority" in update_data and update_data["priority"] is not None:
        update_data["priority"] = update_data["priority"].value
    for field, value in update_data.items():
        setattr(deadline, field, value)
    await db.commit()
    await db.refresh(deadline)
    return deadline


async def delete_deadline(
    db: AsyncSession, user_id: int, deadline_id: int
) -> None:
    deadline = await get_deadline(db, user_id, deadline_id)
    await db.delete(deadline)
    await db.commit()
