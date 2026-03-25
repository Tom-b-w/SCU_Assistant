from datetime import datetime

from pydantic import BaseModel


class ExamCreate(BaseModel):
    course_name: str
    exam_date: datetime
    exam_time: str | None = None
    location: str | None = None
    exam_type: str = "期末考试"
    notes: str | None = None


class ExamResponse(BaseModel):
    id: int
    course_name: str
    exam_date: datetime
    exam_time: str | None
    location: str | None
    exam_type: str
    notes: str | None
    days_remaining: int

    model_config = {"from_attributes": True}
