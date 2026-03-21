from fastapi import APIRouter, Depends

from gateway.auth.dependencies import get_current_user
from services.studyplan import service, schemas

router = APIRouter(prefix="/api/studyplan", tags=["StudyPlan"])


@router.post("/generate", response_model=schemas.StudyPlanResponse)
async def generate_plan(
    body: schemas.StudyPlanRequest,
    user=Depends(get_current_user),
):
    exams = [e.model_dump() for e in body.exams]
    result = await service.generate_study_plan(exams, body.daily_hours, body.start_date)
    return result
