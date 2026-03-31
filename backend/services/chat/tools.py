"""
AI 对话 Function Calling 工具定义与执行

定义可供 LLM 调用的工具列表，以及各工具的本地执行逻辑。
工具执行需要访问 Redis（获取教务系统 session）和数据库（查询 DDL）。
"""

import json
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Anthropic Messages API tools 定义
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS_ANTHROPIC = [
    {
        "name": "get_today_schedule",
        "description": "查询用户今天的课表，返回今天有哪些课程、上课时间和地点",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_grades_summary",
        "description": "查询用户的所有课程成绩和绩点汇总信息",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_deadlines",
        "description": "查询用户的待办 DDL（截止日期）列表，包括作业、考试等",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "search_knowledge_base",
        "description": "在用户的课件知识库中搜索问题的答案。当用户提到课件、PPT、教材、复习资料时使用此工具。",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "要搜索的问题"},
            },
            "required": ["question"],
        },
    },
    {
        "name": "generate_quiz",
        "description": "根据用户的课件知识库生成练习题。当用户说'出几道题'、'模拟考试'时使用。",
        "input_schema": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "出题主题，可选"},
                "count": {"type": "integer", "description": "题目数量，默认5"},
            },
            "required": [],
        },
    },
    {
        "name": "query_exams",
        "description": "查询用户即将到来的考试安排，包括考试时间、地点、科目等信息",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "generate_review_plan",
        "description": "为用户指定的考试生成 AI 复习计划。当用户说'帮我制定复习计划'、'怎么复习'时使用。需要提供考试 ID。",
        "input_schema": {
            "type": "object",
            "properties": {
                "exam_id": {"type": "integer", "description": "考试记录 ID"},
            },
            "required": ["exam_id"],
        },
    },
    {
        "name": "query_weather",
        "description": "查询指定城市的实时天气和穿衣建议，默认查询成都",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名称，默认成都"},
            },
            "required": [],
        },
    },
]

# 星期几的中文映射
_WEEKDAY_NAMES = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "日"}


async def execute_tool(
    tool_name: str,
    tool_args: dict,
    *,
    student_id: str,
    user_id: int,
    redis_client,
    db: AsyncSession,
) -> str:
    """执行指定的工具函数，返回 JSON 字符串结果。

    所有工具执行失败时返回友好错误信息而非抛出异常。
    """
    try:
        if tool_name == "get_today_schedule":
            return await _exec_get_today_schedule(student_id, redis_client, db)
        elif tool_name == "get_grades_summary":
            return await _exec_get_grades_summary(student_id, redis_client, db)
        elif tool_name == "get_deadlines":
            return await _exec_get_deadlines(user_id, db)
        elif tool_name == "search_knowledge_base":
            return await _exec_search_kb(user_id, tool_args, db)
        elif tool_name == "generate_quiz":
            return await _exec_generate_quiz(user_id, tool_args, db)
        elif tool_name == "query_exams":
            return await _exec_query_exams(user_id, db)
        elif tool_name == "generate_review_plan":
            return await _exec_generate_review_plan(user_id, tool_args, db)
        elif tool_name == "query_weather":
            return await _exec_query_weather(tool_args)
        else:
            return json.dumps({"error": f"未知工具: {tool_name}"}, ensure_ascii=False)
    except Exception as e:
        logger.error("工具 %s 执行异常: %s", tool_name, e, exc_info=True)
        return json.dumps(
            {"error": f"查询失败，请稍后再试（{tool_name}）"},
            ensure_ascii=False,
        )


async def _exec_get_today_schedule(student_id: str, redis_client, db: AsyncSession | None = None) -> str:
    """查询今天的课表（优先从数据库缓存读取，支持无 Redis session 场景）"""
    from sqlalchemy import select as sa_select
    from shared.models import AcademicCache, User

    # 优先从 AcademicCache（数据库）读取
    if db:
        try:
            # 查找 user_id
            user_result = await db.execute(
                sa_select(User).where(User.student_id == student_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                cache_result = await db.execute(
                    sa_select(AcademicCache).where(
                        AcademicCache.user_id == user.id,
                        AcademicCache.data_type == "schedule",
                    )
                )
                cache = cache_result.scalar_one_or_none()
                if cache and cache.data:
                    schedule = cache.data if isinstance(cache.data, list) else []
                    return _format_today_schedule(schedule)
        except Exception as e:
            logger.warning("从缓存读取课表失败: %s", e)

    # 回退：通过 JWC client 实时获取（需要 Redis session）
    from services.academic.jwc_client import get_jwc_client
    auth_key = f"jwc_auth:{student_id}"
    session_value = await redis_client.get(auth_key)
    if not session_value:
        return json.dumps(
            {"error": "暂无课表缓存，请重新登录以同步课表数据"},
            ensure_ascii=False,
        )
    jwc = get_jwc_client(redis_client)
    schedule = await jwc.get_schedule(session_key=auth_key, semester="")
    return _format_today_schedule(schedule)


def _format_today_schedule(schedule: list) -> str:
    """格式化今日课表为 JSON 字符串"""
    today_weekday = datetime.now().isoweekday()
    today_courses = [c for c in schedule if c.get("weekday") == today_weekday]

    if not today_courses:
        weekday_name = _WEEKDAY_NAMES.get(today_weekday, str(today_weekday))
        return json.dumps(
            {"message": f"今天（星期{weekday_name}）没有课程，好好休息吧！"},
            ensure_ascii=False,
        )

    today_courses.sort(key=lambda c: c.get("start_section", 0))
    result = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "weekday": f"星期{_WEEKDAY_NAMES.get(today_weekday, str(today_weekday))}",
        "courses": [
            {
                "course_name": c["course_name"],
                "teacher": c.get("teacher", ""),
                "location": c.get("location", ""),
                "time": f"第{c['start_section']}-{c['end_section']}节",
                "weeks": c.get("weeks", ""),
            }
            for c in today_courses
        ],
    }
    return json.dumps(result, ensure_ascii=False)


async def _exec_get_grades_summary(student_id: str, redis_client, db: AsyncSession | None = None) -> str:
    """查询成绩与绩点汇总（优先从数据库缓存读取）"""
    from sqlalchemy import select as sa_select
    from shared.models import AcademicCache, User

    scores = None

    # 优先从 AcademicCache（数据库）读取
    if db:
        try:
            user_result = await db.execute(
                sa_select(User).where(User.student_id == student_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                cache_result = await db.execute(
                    sa_select(AcademicCache).where(
                        AcademicCache.user_id == user.id,
                        AcademicCache.data_type == "scores",
                    )
                )
                cache = cache_result.scalar_one_or_none()
                if cache and cache.data:
                    scores = cache.data if isinstance(cache.data, list) else None
        except Exception as e:
            logger.warning("从缓存读取成绩失败: %s", e)

    if scores is None:
        # 回退：通过 JWC client 实时获取
        from services.academic.jwc_client import get_jwc_client
        auth_key = f"jwc_auth:{student_id}"
        session_value = await redis_client.get(auth_key)
        if not session_value:
            return json.dumps(
                {"error": "暂无成绩缓存，请重新登录以同步成绩数据"},
                ensure_ascii=False,
            )
        jwc = get_jwc_client(redis_client)
        scores = await jwc.get_scores(session_key=auth_key)

    if not scores:
        return json.dumps({"message": "暂无成绩数据"}, ensure_ascii=False)

    # 计算汇总信息
    total_credits = sum(s.get("credit", 0) for s in scores)
    weighted_gpa_sum = sum(
        s.get("gpa", 0) * s.get("credit", 0) for s in scores
    )
    avg_gpa = round(weighted_gpa_sum / total_credits, 2) if total_credits > 0 else 0

    # 按学期分组
    semesters: dict[str, list] = {}
    for s in scores:
        sem = s.get("semester", "未知学期")
        semesters.setdefault(sem, []).append(s)

    result = {
        "total_courses": len(scores),
        "total_credits": total_credits,
        "weighted_avg_gpa": avg_gpa,
        "semesters": [
            {
                "semester": sem,
                "courses": [
                    {
                        "course_name": c["course_name"],
                        "credit": c["credit"],
                        "score": c["score"],
                        "gpa": c["gpa"],
                        "course_type": c.get("course_type", ""),
                    }
                    for c in courses
                ],
            }
            for sem, courses in semesters.items()
        ],
    }
    return json.dumps(result, ensure_ascii=False)


async def _exec_get_deadlines(user_id: int, db: AsyncSession) -> str:
    """查询待办 DDL 列表"""
    from services.deadline.service import get_deadlines

    deadlines = await get_deadlines(db=db, user_id=user_id, completed=False)

    if not deadlines:
        return json.dumps({"message": "当前没有待办的 DDL，太棒了！"}, ensure_ascii=False)

    result = {
        "total": len(deadlines),
        "deadlines": [
            {
                "title": d.title,
                "course": d.course or "",
                "due_date": d.due_date.strftime("%Y-%m-%d %H:%M") if d.due_date else "",
                "priority": d.priority or "medium",
            }
            for d in deadlines
        ],
    }
    return json.dumps(result, ensure_ascii=False)


async def _exec_search_kb(user_id: int, tool_args: dict, db: AsyncSession) -> str:
    """在用户知识库中搜索"""
    from shared.models import KnowledgeBase
    from services.rag.service import rag_query

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.user_id == user_id).limit(1)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        return json.dumps({"error": "你还没有创建知识库，请先上传课件"}, ensure_ascii=False)
    answer = await rag_query(db, kb.id, user_id, tool_args.get("question", ""))
    return json.dumps(answer, ensure_ascii=False)


async def _exec_generate_quiz(user_id: int, tool_args: dict, db: AsyncSession) -> str:
    """根据知识库生成练习题"""
    from shared.models import KnowledgeBase
    from services.quiz.service import generate_quiz

    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.user_id == user_id).limit(1)
    )
    kb = result.scalar_one_or_none()
    if not kb:
        return json.dumps({"error": "你还没有创建知识库，请先上传课件"}, ensure_ascii=False)
    quiz = await generate_quiz(
        db, kb.id, user_id,
        tool_args.get("topic", ""),
        tool_args.get("count", 5), "medium", "mixed",
    )
    return json.dumps(quiz, ensure_ascii=False)


async def _exec_query_exams(user_id: int, db: AsyncSession) -> str:
    """查询即将到来的考试"""
    from services.academic.service import get_upcoming_exams

    exams = await get_upcoming_exams(db, user_id)
    if not exams:
        return json.dumps({"message": "当前没有即将到来的考试"}, ensure_ascii=False)

    result = {
        "total": len(exams),
        "exams": [
            {
                "id": e.id,
                "course_name": e.course_name,
                "exam_date": e.exam_date.strftime("%Y-%m-%d %H:%M")
                if hasattr(e.exam_date, "strftime")
                else str(e.exam_date),
                "exam_time": e.exam_time or "",
                "location": e.location or "",
                "exam_type": e.exam_type,
                "days_remaining": e.days_remaining,
            }
            for e in exams
        ],
    }
    return json.dumps(result, ensure_ascii=False)


async def _exec_generate_review_plan(
    user_id: int, tool_args: dict, db: AsyncSession
) -> str:
    """为指定考试生成 AI 复习计划"""
    from services.academic.service import generate_review_plan

    exam_id = tool_args.get("exam_id")
    if not exam_id:
        return json.dumps({"error": "请指定考试 ID"}, ensure_ascii=False)

    result = await generate_review_plan(db, user_id, exam_id)
    return json.dumps(result, ensure_ascii=False)


async def _exec_query_weather(tool_args: dict) -> str:
    """查询天气"""
    from services.weather.service import get_weather
    city = tool_args.get("city", "成都")
    result = await get_weather(city)
    return json.dumps(result, ensure_ascii=False)
