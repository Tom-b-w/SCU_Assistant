"""考试管理服务 — CRUD + LLM 复习计划生成 + 选课推荐"""

import json as _json
import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.llm_client import LLMClient
from shared.models import Exam, AcademicCache
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
        text = result["text"].strip()
        # Strip markdown code fences if LLM wraps output
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()
        return {
            "exam": exam.course_name,
            "days_remaining": days_left,
            "plan": text,
        }
    except Exception as e:
        logger.error("生成复习计划失败: %s", e, exc_info=True)
        return {"error": "生成复习计划失败，请稍后再试"}
    finally:
        await client.close()


async def generate_course_recommendation(session: AsyncSession, user_id: int) -> dict:
    """基于培养方案和已修课程，AI 智能选课推荐"""
    # 获取培养方案
    plan_result = await session.execute(
        select(AcademicCache).where(
            AcademicCache.user_id == user_id,
            AcademicCache.data_type == "plan_completion",
        )
    )
    plan_cache = plan_result.scalar_one_or_none()

    # 获取已修课程
    scores_result = await session.execute(
        select(AcademicCache).where(
            AcademicCache.user_id == user_id,
            AcademicCache.data_type == "scores",
        )
    )
    scores_cache = scores_result.scalar_one_or_none()

    if not plan_cache or not scores_cache:
        return {"error": "尚未同步教务数据，请先登录后等待数据同步"}

    plan_data = plan_cache.data if isinstance(plan_cache.data, dict) else {}
    scores_data = scores_cache.data if isinstance(scores_cache.data, list) else []

    # 构建已修课程列表
    completed_courses = [
        f"{s.get('course_name', '')}({s.get('course_type', '')}, {s.get('credit', 0)}学分, 成绩{s.get('score', '')})"
        for s in scores_data
    ]

    # 构建培养方案摘要
    categories = plan_data.get("categories", [])
    plan_summary = []
    for cat in categories:
        name = cat.get("name", "")
        earned = cat.get("earned_credits", 0)
        required = cat.get("required_credits", 0)
        remaining = max(0, required - earned)
        plan_summary.append(f"  - {name}: 已修{earned}/{required}学分，还需{remaining}学分")

    prompt = f"""请根据以下培养方案完成情况和已修课程，为四川大学计算机学院本科生提供下学期选课建议：

【培养方案进度】
总学分要求: {plan_data.get('total_required_credits', '未知')}
已修学分: {plan_data.get('earned_credits', '未知')}
各类别:
{chr(10).join(plan_summary)}

【已修课程（共{len(completed_courses)}门）】
{chr(10).join(completed_courses[:30])}

请给出：
1. 各类别的选课优先级分析（哪些类别最紧缺需要优先选修）
2. 推荐的具体课程方向（5-8门课），说明选课理由
3. 学期选课学分建议（总学分、各类型分配）
4. 注意事项和选课策略建议

输出格式为 Markdown。"""

    client = _get_llm_client()
    try:
        result = await client.chat(
            messages=[{"role": "user", "content": prompt}],
            system="你是四川大学教务系统的 AI 选课顾问，熟悉计算机学院培养方案和课程设置。请根据学生的培养方案完成进度和已修课程情况，给出专业、实用的选课建议。",
            max_tokens=2048,
        )
        text = result["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3].strip()
        return {
            "recommendation": text,
            "plan_summary": {
                "total_required": plan_data.get("total_required_credits", 0),
                "earned": plan_data.get("earned_credits", 0),
                "completed_courses": len(scores_data),
            },
        }
    except Exception as e:
        logger.error("生成选课推荐失败: %s", e, exc_info=True)
        return {"error": "生成选课推荐失败，请稍后再试"}
    finally:
        await client.close()
