"""考试管理服务 — CRUD + LLM 复习计划生成"""

import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.llm_client import LLMClient
from shared.models import Exam
from services.academic.schemas import ExamCreate, ExamResponse

logger = logging.getLogger(__name__)


def _get_llm_client() -> LLMClient:
    return LLMClient(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        auth_token=settings.llm_auth_token,
    )


async def create_exam(session: AsyncSession, user_id: int, data: ExamCreate) -> Exam:
    exam = Exam(user_id=user_id, **data.model_dump())
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    return exam


async def get_upcoming_exams(session: AsyncSession, user_id: int) -> list[ExamResponse]:
    now = datetime.now()
    query = (
        select(Exam)
        .where(Exam.user_id == user_id, Exam.exam_date >= now)
        .order_by(Exam.exam_date.asc())
    )
    result = await session.execute(query)
    exams = result.scalars().all()
    today = date.today()
    return [
        ExamResponse(
            id=e.id,
            course_name=e.course_name,
            exam_date=e.exam_date,
            exam_time=e.exam_time,
            location=e.location,
            exam_type=e.exam_type,
            notes=e.notes,
            days_remaining=(e.exam_date.date() - today).days
            if hasattr(e.exam_date, "date")
            else (e.exam_date - today).days,
        )
        for e in exams
    ]


async def delete_exam(session: AsyncSession, user_id: int, exam_id: int) -> bool:
    query = select(Exam).where(Exam.id == exam_id, Exam.user_id == user_id)
    result = await session.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        return False
    await session.delete(exam)
    await session.commit()
    return True


async def generate_review_plan(
    session: AsyncSession, user_id: int, exam_id: int
) -> dict:
    """调用 LLM 为指定考试生成复习计划"""
    query = select(Exam).where(Exam.id == exam_id, Exam.user_id == user_id)
    result = await session.execute(query)
    exam = result.scalar_one_or_none()
    if not exam:
        return {"error": "考试记录未找到"}

    today = date.today()
    days_left = (
        (exam.exam_date.date() - today).days
        if hasattr(exam.exam_date, "date")
        else 0
    )
    if days_left < 0:
        return {"error": "考试已结束"}

    prompt = f"""请为以下考试生成一份详细的复习计划：
- 课程：{exam.course_name}
- 考试类型：{exam.exam_type}
- 距离考试还有 {days_left} 天
- 备注：{exam.notes or "无"}

请按天数分配复习任务，包含：
1. 每日复习重点
2. 推荐复习方法
3. 时间分配建议
输出格式为 Markdown。"""

    client = _get_llm_client()
    try:
        result = await client.chat(
            messages=[{"role": "user", "content": prompt}],
            system="你是四川大学的 AI 学习助手，擅长制定复习计划。",
            max_tokens=2048,
        )
        return {
            "exam": exam.course_name,
            "days_remaining": days_left,
            "plan": result["text"],
        }
    except Exception as e:
        logger.error("生成复习计划失败: %s", e, exc_info=True)
        return {"error": "生成复习计划失败，请稍后再试"}
    finally:
        await client.close()
