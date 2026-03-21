from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from gateway.auth.dependencies import get_current_user
from services.quiz import service, schemas

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


@router.post("/generate", response_model=schemas.QuizResponse)
async def generate_quiz(
    body: schemas.QuizRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await service.generate_quiz(
            db, body.kb_id, user.id,
            body.topic, body.count, body.difficulty, body.question_type,
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
