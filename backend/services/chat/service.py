import asyncio
import json
import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.llm_client import LLMClient
from services.chat.schemas import ChatMessage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "你是四川大学智能助手'小川'，专为川大学生打造。"
    "你可以帮助学生查询课表、成绩、DDL等校园信息，也可以回答学习和生活方面的问题。"
    "请用友好亲切的语气回答，适当使用emoji让对话更生动。"
    "如果系统已注入了用户的真实数据（课表、成绩等），请直接根据这些数据回答，不要说'我无法查询'。"
)

_NOT_CONFIGURED_REPLY = (
    "抱歉，AI 对话功能尚未配置，请联系管理员设置 LLM API Key 后再试～"
)

_WEEKDAY_NAMES = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "日"}

SECTION_TIMES = {
    1: "08:00", 2: "08:55", 3: "10:10", 4: "11:05",
    5: "14:00", 6: "14:55", 7: "16:10", 8: "17:05",
    9: "19:00", 10: "19:55", 11: "20:50",
}


def _is_configured() -> bool:
    return bool(settings.llm_auth_token or settings.llm_api_key)


def _get_llm_client() -> LLMClient:
    return LLMClient(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        auth_token=settings.llm_auth_token,
    )


async def _build_user_context(student_id: str, user_id: int, db: AsyncSession, redis_client) -> str:
    """预取用户真实数据，注入到 system prompt 中"""
    from sqlalchemy import select as sa_select
    from shared.models import AcademicCache, Deadline, Exam

    context_parts = []

    # 1. 今日课表
    try:
        cache_result = await db.execute(
            sa_select(AcademicCache).where(
                AcademicCache.user_id == user_id,
                AcademicCache.data_type == "schedule",
            )
        )
        cache = cache_result.scalar_one_or_none()
        if cache and cache.data:
            today_wd = datetime.now().isoweekday()
            courses = [c for c in (cache.data if isinstance(cache.data, list) else [])
                       if c.get("weekday") == today_wd]
            courses.sort(key=lambda c: c.get("start_section", 0))
            if courses:
                lines = [f"  - {c['course_name']} 第{c['start_section']}-{c['end_section']}节 "
                         f"({SECTION_TIMES.get(c['start_section'], '?')}) {c.get('location','')} [{c.get('teacher','')}]"
                         for c in courses]
                context_parts.append(f"【今日课表（星期{_WEEKDAY_NAMES[today_wd]}）】\n" + "\n".join(lines))
            else:
                context_parts.append(f"【今日课表】今天（星期{_WEEKDAY_NAMES[today_wd]}）没有课程")
    except Exception as e:
        logger.debug("读取课表失败: %s", e)

    # 2. 成绩汇总
    try:
        cache_result = await db.execute(
            sa_select(AcademicCache).where(
                AcademicCache.user_id == user_id,
                AcademicCache.data_type == "scores",
            )
        )
        cache = cache_result.scalar_one_or_none()
        if cache and cache.data:
            scores = cache.data if isinstance(cache.data, list) else []
            total_credits = sum(s.get("credit", 0) for s in scores)
            gpa_sum = sum(s.get("gpa", 0) * s.get("credit", 0) for s in scores)
            avg_gpa = round(gpa_sum / total_credits, 2) if total_credits > 0 else 0
            # 最近5条成绩
            recent = sorted(scores, key=lambda s: s.get("semester", ""), reverse=True)[:5]
            recent_str = ", ".join(f"{s['course_name']}({s['score']}分)" for s in recent)
            context_parts.append(
                f"【成绩概况】共{len(scores)}门课程，总学分{total_credits}，加权绩点{avg_gpa}\n"
                f"  最近成绩: {recent_str}"
            )
    except Exception as e:
        logger.debug("读取成绩失败: %s", e)

    # 3. 待办 DDL
    try:
        now = datetime.now()
        dl_result = await db.execute(
            sa_select(Deadline).where(
                Deadline.user_id == user_id,
                Deadline.completed == False,
            )
        )
        deadlines = dl_result.scalars().all()
        if deadlines:
            dl_lines = [f"  - {dl.title}（{dl.due_date.strftime('%m/%d %H:%M')}）" for dl in deadlines[:5]]
            context_parts.append(f"【待办DDL】共{len(deadlines)}项\n" + "\n".join(dl_lines))
        else:
            context_parts.append("【待办DDL】当前没有待办事项")
    except Exception as e:
        logger.debug("读取DDL失败: %s", e)

    # 4. 近期考试
    try:
        exam_result = await db.execute(
            sa_select(Exam).where(
                Exam.user_id == user_id,
                Exam.exam_date >= datetime.now(),
            )
        )
        exams = exam_result.scalars().all()
        if exams:
            exam_lines = [f"  - {ex.course_name} {ex.exam_date.strftime('%m/%d')} {ex.exam_time or ''} {ex.location or ''}"
                          for ex in exams[:3]]
            context_parts.append(f"【近期考试】\n" + "\n".join(exam_lines))
    except Exception as e:
        logger.debug("读取考试失败: %s", e)

    if not context_parts:
        return ""
    return "\n\n".join(context_parts)


async def chat_completion(
    messages: list[ChatMessage],
    user_info: dict | None = None,
    *,
    db: AsyncSession | None = None,
    redis_client=None,
) -> dict:
    """调用 LLM 完成对话，预注入用户数据到 system prompt（RAG方式，不依赖 tool_use）。"""
    if not _is_configured():
        return {"reply": _NOT_CONFIGURED_REPLY, "usage": None}

    # 构建 system prompt
    system_text = SYSTEM_PROMPT

    if user_info and db:
        student_id = user_info.get("student_id", "")
        user_id = user_info.get("user_id", 0)

        # 注入用户真实数据
        try:
            user_data = await _build_user_context(student_id, user_id, db, redis_client)
            if user_data:
                system_text += f"\n\n=== 用户实时数据 ===\n{user_data}\n以上数据是真实的，请直接根据以上内容回答用户问题。"
        except Exception as e:
            logger.warning("注入用户数据失败: %s", e)

        # 注入用户记忆
        if user_id:
            try:
                from services.memory.service import get_user_context
                user_context = await get_user_context(db, user_id)
                if user_context:
                    system_text += f"\n\n{user_context}"
            except Exception:
                pass

    anthropic_messages = [{"role": msg.role, "content": msg.content} for msg in messages]

    client = _get_llm_client()
    try:
        result = await client.chat(anthropic_messages, system=system_text)
        usage = result["usage"]
        reply = result["text"]

        logger.info("LLM response: input=%s output=%s, len=%d",
                    usage.get("input_tokens"), usage.get("output_tokens"), len(reply))

        # 异步提取用户记忆（不阻塞响应）
        if db and user_info and user_info.get("user_id"):
            _schedule_memory_extraction(messages, db, user_info["user_id"])

        return {"reply": reply, "usage": usage}

    except Exception as e:
        logger.error("LLM API error: %s", e, exc_info=True)
        return {
            "reply": "抱歉，AI 服务出现异常，请稍后再试～",
            "usage": None,
        }
    finally:
        await client.close()


async def chat_completion_stream(
    messages: list[ChatMessage],
    user_info: dict | None = None,
    *,
    db: AsyncSession | None = None,
    redis_client=None,
):
    """流式调用 LLM，yield SSE 格式数据。"""
    if not _is_configured():
        yield f"data: {json.dumps({'type': 'text', 'content': _NOT_CONFIGURED_REPLY})}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"
        return

    system_text = SYSTEM_PROMPT

    if user_info and db:
        student_id = user_info.get("student_id", "")
        user_id = user_info.get("user_id", 0)
        try:
            user_data = await _build_user_context(student_id, user_id, db, redis_client)
            if user_data:
                system_text += f"\n\n=== 用户实时数据 ===\n{user_data}\n以上数据是真实的，请直接根据以上内容回答用户问题。"
        except Exception as e:
            logger.warning("注入用户数据失败: %s", e)

        if user_id:
            try:
                from services.memory.service import get_user_context
                user_context = await get_user_context(db, user_id)
                if user_context:
                    system_text += f"\n\n{user_context}"
            except Exception:
                pass

    anthropic_messages = [{"role": msg.role, "content": msg.content} for msg in messages]
    client = _get_llm_client()
    full_reply = ""
    try:
        async for chunk in client.chat_stream(anthropic_messages, system=system_text):
            full_reply += chunk
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

        # 异步提取用户记忆
        if db and user_info and user_info.get("user_id"):
            _schedule_memory_extraction(messages, db, user_info["user_id"])

    except Exception as e:
        logger.error("LLM stream error: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'content': '抱歉，AI 服务出现异常，请稍后再试～'})}\n\n"
    finally:
        await client.close()


def _schedule_memory_extraction(messages: list[ChatMessage], db: AsyncSession, user_id: int):
    """后台异步提取用户记忆（不阻塞响应）"""
    async def _bg_extract():
        try:
            from services.memory.service import extract_memories, save_memories
            conversation_text = "\n".join(
                f"{m.role}: {m.content}" for m in messages[-4:]
            )
            memories = await extract_memories(conversation_text)
            if memories:
                await save_memories(db, user_id, memories)
        except Exception:
            pass

    try:
        asyncio.create_task(_bg_extract())
    except RuntimeError:
        pass
