"""每日晨报服务 — 聚合多数据源，调用 LLM 生成个性化早间简报"""

import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.academic.service import get_upcoming_exams
from services.deadline.service import get_deadlines
from services.weather.service import get_weather
from shared.config import settings
from shared.llm_client import LLMClient
from shared.models import AcademicCache

logger = logging.getLogger(__name__)

WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]


def _get_llm_client() -> LLMClient:
    return LLMClient(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        auth_token=settings.llm_auth_token,
    )


async def _get_today_courses(session: AsyncSession, user_id: int) -> list[dict]:
    """从 AcademicCache 中读取今日课程"""
    try:
        result = await session.execute(
            select(AcademicCache).where(
                AcademicCache.user_id == user_id,
                AcademicCache.data_type == "schedule",
            )
        )
        cache = result.scalar_one_or_none()
        if not cache or not cache.data:
            return []

        today_weekday = datetime.now().isoweekday()  # 1=Mon, 7=Sun
        courses = cache.data if isinstance(cache.data, list) else []
        today_courses = [
            c for c in courses
            if c.get("weekday") == today_weekday
        ]
        return today_courses
    except Exception as e:
        logger.warning("读取今日课程失败: %s", e)
        return []


async def generate_briefing(session: AsyncSession, user_id: int) -> dict:
    """聚合数据并生成每日晨报"""
    today = date.today()
    weekday = WEEKDAY_NAMES[today.isoweekday() - 1]

    # ------ 并行收集数据（逐个 await，容错处理） ------

    # 1. 今日课程
    today_courses = await _get_today_courses(session, user_id)

    # 2. 即将到来的考试
    exams = []
    try:
        exams = await get_upcoming_exams(session, user_id)
    except Exception as e:
        logger.warning("获取考试信息失败: %s", e)

    # 3. 未完成的截止日期
    deadlines = []
    try:
        deadlines = await get_deadlines(session, user_id, completed=False)
    except Exception as e:
        logger.warning("获取截止日期失败: %s", e)

    # 4. 天气
    weather = None
    try:
        weather = await get_weather("成都")
    except Exception as e:
        logger.warning("获取天气失败: %s", e)

    # ------ 构建数据摘要 ------
    summary_parts: list[str] = []
    summary_parts.append(f"日期：{today.isoformat()} {weekday}")

    if weather:
        summary_parts.append(
            f"天气：{weather.get('condition', '未知')}，"
            f"温度 {weather.get('temperature', '?')}°C，"
            f"体感 {weather.get('feels_like', '?')}°C，"
            f"湿度 {weather.get('humidity', '?')}%"
        )

    if today_courses:
        summary_parts.append(f"今日课程（{len(today_courses)} 门）：")
        for c in today_courses:
            name = c.get("course_name", c.get("name", "未知课程"))
            time_str = c.get("time", c.get("section", ""))
            location = c.get("location", c.get("classroom", ""))
            summary_parts.append(f"  - {name}  {time_str}  {location}")
    else:
        summary_parts.append("今日没有课程。")

    if exams:
        summary_parts.append(f"即将到来的考试（{len(exams)} 门）：")
        for e in exams[:5]:
            exam_name = e.course_name if hasattr(e, "course_name") else e.get("course_name", "")
            days_left = e.days_remaining if hasattr(e, "days_remaining") else e.get("days_remaining", "?")
            summary_parts.append(f"  - {exam_name}（还剩 {days_left} 天）")
    else:
        summary_parts.append("近期没有考试。")

    if deadlines:
        # 仅展示最近的截止日期
        upcoming_deadlines = deadlines[:5]
        summary_parts.append(f"未完成作业/截止（{len(deadlines)} 项）：")
        for d in upcoming_deadlines:
            title = d.title if hasattr(d, "title") else d.get("title", "")
            due = d.due_date if hasattr(d, "due_date") else d.get("due_date", "")
            priority = d.priority if hasattr(d, "priority") else d.get("priority", "")
            summary_parts.append(f"  - {title}  截止：{due}  优先级：{priority}")
    else:
        summary_parts.append("没有待完成的截止事项。")

    data_summary = "\n".join(summary_parts)

    # ------ 调用 LLM 生成简报 ------
    briefing_text = ""
    try:
        prompt = (
            f"以下是一位四川大学学生今天的日程和信息摘要，"
            f"请生成一段温暖、实用的早间简报（200字以内），"
            f"包含天气提醒、课程安排、考试/作业提醒等。"
            f"语气亲切，像朋友一样提醒。\n\n{data_summary}"
        )

        client = _get_llm_client()
        try:
            result = await client.chat(
                messages=[{"role": "user", "content": prompt}],
                system="你是四川大学智能助手的晨报播报员，用简洁亲切的中文为学生播报每日信息。",
                max_tokens=512,
                temperature=0.7,
            )
            briefing_text = result.get("text", "")
        finally:
            await client.close()
    except Exception as e:
        logger.error("LLM 生成晨报失败: %s", e, exc_info=True)
        # 降级：直接使用数据摘要
        briefing_text = data_summary

    return {
        "date": today.isoformat(),
        "weekday": weekday,
        "briefing": briefing_text,
        "data": {
            "schedule_count": len(today_courses),
            "exam_count": len(exams),
            "deadline_count": len(deadlines),
            "weather": weather or {},
        },
    }
