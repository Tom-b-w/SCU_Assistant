from fastapi import APIRouter, Depends

from gateway.auth.dependencies import get_current_user
from services.academic.jwc_client import get_jwc_client
from shared.cache import redis_client
from shared.exceptions import SessionExpiredError

router = APIRouter(prefix="/api/academic", tags=["academic"])


async def _check_jwc_session(student_id: str) -> None:
    """检查教务系统会话是否存在，不存在则抛出 SessionExpiredError"""
    session_key = f"jwc_auth:{student_id}"
    session_value = await redis_client.get(session_key)
    if not session_value:
        raise SessionExpiredError()


@router.get("/schedule")
async def get_schedule(
    semester: str = "2025-2026-2",
    user=Depends(get_current_user),
):
    """获取当前用户的本学期课表"""
    await _check_jwc_session(user.student_id)
    jwc = get_jwc_client(redis_client=redis_client)
    session_key = f"jwc_auth:{user.student_id}"
    courses = await jwc.get_schedule(session_key, semester)
    return {"courses": courses, "semester": semester}


@router.get("/scores")
async def get_scores(user=Depends(get_current_user)):
    """获取当前用户的全部已过成绩"""
    await _check_jwc_session(user.student_id)
    jwc = get_jwc_client(redis_client=redis_client)
    session_key = f"jwc_auth:{user.student_id}"
    scores = await jwc.get_scores(session_key)
    return {"scores": scores}


@router.get("/plan-completion")
async def get_plan_completion(user=Depends(get_current_user)):
    """获取方案完成情况（学分统计）"""
    await _check_jwc_session(user.student_id)
    jwc = get_jwc_client(redis_client=redis_client)
    session_key = f"jwc_auth:{user.student_id}"
    data = await jwc.get_plan_completion(session_key)
    return data
