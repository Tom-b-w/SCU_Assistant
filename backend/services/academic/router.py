from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.dependencies import get_current_user
from services.academic.cache_service import fetch_and_cache_all, get_cached
from services.academic.jwc_client import get_jwc_client
from services.academic.schemas import ExamCreate, ExamResponse
from services.academic import service as exam_service
from shared.cache import redis_client
from shared.database import get_db
from shared.exceptions import SessionExpiredError

router = APIRouter(prefix="/api/academic", tags=["academic"])


@router.get("/schedule")
async def get_schedule(
    semester: str = "2025-2026-2",
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """获取课表 — 优先从缓存读取"""
    cached = await get_cached(db, user.id, "schedule")
    if cached is not None:
        return {
            "courses": cached["data"],
            "semester": semester,
            "fetched_at": cached["fetched_at"],
            "is_stale": cached["is_stale"],
        }
    # 无缓存：尝试实时获取
    session_key = f"jwc_auth:{user.student_id}"
    session_value = await redis_client.get(session_key)
    if not session_value:
        raise SessionExpiredError()
    jwc = get_jwc_client(redis_client=redis_client)
    courses = await jwc.get_schedule(session_key, semester)
    return {"courses": courses, "semester": semester}


@router.get("/scores")
async def get_scores(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """获取成绩 — 优先从缓存读取"""
    cached = await get_cached(db, user.id, "scores")
    if cached is not None:
        return {
            "scores": cached["data"],
            "fetched_at": cached["fetched_at"],
            "is_stale": cached["is_stale"],
        }
    session_key = f"jwc_auth:{user.student_id}"
    session_value = await redis_client.get(session_key)
    if not session_value:
        raise SessionExpiredError()
    jwc = get_jwc_client(redis_client=redis_client)
    scores = await jwc.get_scores(session_key)
    return {"scores": scores}


@router.get("/plan-completion")
async def get_plan_completion(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """获取培养方案完成情况 — 优先从缓存读取"""
    cached = await get_cached(db, user.id, "plan_completion")
    if cached is not None:
        return {
            **cached["data"],
            "fetched_at": cached["fetched_at"],
            "is_stale": cached["is_stale"],
        }
    session_key = f"jwc_auth:{user.student_id}"
    session_value = await redis_client.get(session_key)
    if not session_value:
        raise SessionExpiredError()
    jwc = get_jwc_client(redis_client=redis_client)
    data = await jwc.get_plan_completion(session_key)
    return data


@router.post("/refresh")
async def refresh_cache(
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    """手动触发数据刷新（需要教务系统 session 有效）"""
    session_key = f"jwc_auth:{user.student_id}"
    session_value = await redis_client.get(session_key)
    if not session_value:
        raise SessionExpiredError()
    background_tasks.add_task(fetch_and_cache_all, user.id, user.student_id)
    return {"message": "刷新已触发，数据将在后台更新"}


# ---------------------------------------------------------------------------
# 考试管理
# ---------------------------------------------------------------------------


@router.post("/exams", response_model=ExamResponse)
async def create_exam(
    body: ExamCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建考试记录"""
    exam = await exam_service.create_exam(db, user.id, body)
    # 构造响应（需要计算 days_remaining）
    from datetime import date

    days_remaining = (
        (exam.exam_date.date() - date.today()).days
        if hasattr(exam.exam_date, "date")
        else 0
    )
    return ExamResponse(
        id=exam.id,
        course_name=exam.course_name,
        exam_date=exam.exam_date,
        exam_time=exam.exam_time,
        location=exam.location,
        exam_type=exam.exam_type,
        notes=exam.notes,
        days_remaining=days_remaining,
    )


@router.get("/exams", response_model=list[ExamResponse])
async def list_exams(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取即将到来的考试列表"""
    return await exam_service.get_upcoming_exams(db, user.id)


@router.delete("/exams/{exam_id}")
async def delete_exam(
    exam_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除考试记录"""
    success = await exam_service.delete_exam(db, user.id, exam_id)
    if not success:
        raise HTTPException(status_code=404, detail="考试记录未找到")
    return {"message": "考试记录已删除"}


@router.post("/exams/{exam_id}/review-plan")
async def generate_review_plan(
    exam_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """为指定考试生成 AI 复习计划"""
    result = await exam_service.generate_review_plan(db, user.id, exam_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
