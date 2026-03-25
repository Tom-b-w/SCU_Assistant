from fastapi import APIRouter, Depends, Query

from gateway.auth.dependencies import get_current_user
from services.deadline import service
from services.deadline.schemas import DeadlineCreate, DeadlineResponse, DeadlineUpdate
from shared.database import get_db

router = APIRouter(prefix="/api/deadlines", tags=["deadlines"])


@router.post("/", response_model=DeadlineResponse, status_code=201)
async def create_deadline(
    body: DeadlineCreate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """创建一个新的截止日期"""
    deadline = await service.create_deadline(db, user.id, body)
    return DeadlineResponse.model_validate(deadline)


@router.get("/", response_model=list[DeadlineResponse])
async def list_deadlines(
    completed: bool | None = Query(None, description="按完成状态筛选"),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """获取当前用户的截止日期列表"""
    deadlines = await service.get_deadlines(db, user.id, completed)
    return [DeadlineResponse.model_validate(d) for d in deadlines]


@router.get("/{deadline_id}", response_model=DeadlineResponse)
async def get_deadline(
    deadline_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """获取单个截止日期详情"""
    deadline = await service.get_deadline(db, user.id, deadline_id)
    return DeadlineResponse.model_validate(deadline)


@router.patch("/{deadline_id}", response_model=DeadlineResponse)
async def update_deadline(
    deadline_id: int,
    body: DeadlineUpdate,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """更新截止日期"""
    deadline = await service.update_deadline(db, user.id, deadline_id, body)
    return DeadlineResponse.model_validate(deadline)


@router.delete("/{deadline_id}", status_code=204)
async def delete_deadline(
    deadline_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """删除截止日期"""
    await service.delete_deadline(db, user.id, deadline_id)
