from pydantic import BaseModel
from datetime import date


class ExamInfo(BaseModel):
    subject: str
    exam_date: date
    difficulty: str = "medium"
    notes: str = ""


class StudyPlanRequest(BaseModel):
    exams: list[ExamInfo]
    daily_hours: float = 4.0
    start_date: date | None = None


class DayPlan(BaseModel):
    date: str
    tasks: list[dict]


class StudyPlanResponse(BaseModel):
    plan: list[DayPlan]
    summary: str
    usage: dict | None = None
