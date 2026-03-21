import asyncio
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from shared.config import settings
from shared.llm_client import LLMClient
from services.chat.schemas import ChatMessage
from services.chat.tools import TOOL_DEFINITIONS_ANTHROPIC, execute_tool

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "你是四川大学智能助手'小川'，专为川大学生打造。"
    "你可以帮助学生查询课表、成绩、DDL等校园信息，"
    "也可以回答学习和生活方面的问题。"
    "请用友好亲切的语气回答，适当使用emoji让对话更生动。"
    "如果涉及你不确定的校园信息，请诚实告知并建议学生通过官方渠道确认。"
    "当用户询问课表、成绩、DDL相关问题时，请调用对应的工具来获取真实数据。"
)

_NOT_CONFIGURED_REPLY = (
    "抱歉，AI 对话功能尚未配置，请联系管理员设置 LLM API Key 后再试～"
)


def _is_configured() -> bool:
    return bool(settings.llm_auth_token or settings.llm_api_key)


def _get_llm_client() -> LLMClient:
    return LLMClient(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        model=settings.llm_model,
        auth_token=settings.llm_auth_token,
    )


async def chat_completion(
    messages: list[ChatMessage],
    user_info: dict | None = None,
    *,
    db: AsyncSession | None = None,
    redis_client=None,
) -> dict:
    """调用 Anthropic Messages API 完成对话，支持 Tool Use。"""
    if not _is_configured():
        return {"reply": _NOT_CONFIGURED_REPLY, "usage": None}

    # 构建 system prompt
    system_text = SYSTEM_PROMPT
    if user_info:
        system_text += f"\n当前用户学号: {user_info.get('student_id', '未知')}"

        # 注入用户记忆上下文
        user_id = user_info.get("user_id", 0)
        if db and user_id:
            try:
                from services.memory.service import get_user_context
                user_context = await get_user_context(db, user_id)
                if user_context:
                    system_text += f"\n\n{user_context}"
            except Exception:
                pass

    anthropic_messages = []
    for msg in messages:
        anthropic_messages.append({"role": msg.role, "content": msg.content})

    # 判断是否启用工具
    enable_tools = (
        user_info is not None
        and db is not None
        and redis_client is not None
        and user_info.get("student_id")
    )

    client = _get_llm_client()
    try:
        # 第一轮请求
        tools = TOOL_DEFINITIONS_ANTHROPIC if enable_tools else None
        result = await client.chat(anthropic_messages, system=system_text, tools=tools)

        usage = result["usage"]
        stop_reason = result["stop_reason"]

        if not result["tool_calls"] or not enable_tools or stop_reason != "tool_use":
            reply = result["text"]
            # 异步提取用户记忆（不阻塞响应）
            if db and user_info and user_info.get("user_id"):
                _schedule_memory_extraction(messages, db, user_info["user_id"])
            return {"reply": reply, "usage": usage}

        # ------ 执行工具调用 ------
        tool_calls = result["tool_calls"]
        logger.info(
            "LLM 请求调用 %d 个工具: %s",
            len(tool_calls),
            [tc["name"] for tc in tool_calls],
        )

        anthropic_messages.append({"role": "assistant", "content": result["raw"]["content"]})

        tool_results = []
        for tc in tool_calls:
            tool_result = await execute_tool(
                tool_name=tc["name"],
                tool_args=tc.get("input", {}),
                student_id=user_info["student_id"],
                user_id=user_info.get("user_id", 0),
                redis_client=redis_client,
                db=db,
            )
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tc["id"],
                "content": tool_result,
            })

        anthropic_messages.append({"role": "user", "content": tool_results})

        # 第二轮请求（不带 tools 防循环）
        result2 = await client.chat(anthropic_messages, system=system_text)

        final_text = result2["text"]
        final_usage = result2["usage"]

        if usage and final_usage:
            merged_usage = {
                k: usage.get(k, 0) + final_usage.get(k, 0)
                for k in set(list(usage.keys()) + list(final_usage.keys()))
            }
        else:
            merged_usage = final_usage or usage

        # 异步提取用户记忆
        if db and user_info and user_info.get("user_id"):
            _schedule_memory_extraction(messages, db, user_info["user_id"])

        return {"reply": final_text, "usage": merged_usage}

    except Exception as e:
        logger.error("LLM API error: %s", e, exc_info=True)
        return {
            "reply": "抱歉，AI 服务出现异常，请稍后再试～",
            "usage": None,
        }
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
