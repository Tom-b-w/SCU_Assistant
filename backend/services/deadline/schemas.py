from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Priority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class DeadlineCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    course: str | None = Field(None, max_length=100)
    due_date: datetime
    priority: Priority = Priority.medium


class DeadlineUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    course: str | None = Field(None, max_length=100)
    due_date: datetime | None = None
    priority: Priority | None = None
    completed: bool | None = None


class DeadlineResponse(BaseModel):
    id: int
    user_id: int
    title: str
    course: str | None
    due_date: datetime
    priority: str
    completed: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
