"""用户记忆系统 -- 从对话中提取和检索用户偏好"""
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from shared.models import UserMemory
from shared.llm_client import LLMClient
from shared.config import settings

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """分析下面的对话，提取用户透露的个人偏好或信息。
仅提取明确提到的信息，不要推测。如果没有新信息，返回空列表。

返回 JSON 数组格式：
[{{"category": "分类", "key": "关键词", "value": "值"}}]

分类包括: taste(口味偏好), campus(校区), major(专业), study_habit(学习习惯), schedule_pref(时间偏好)

对话内容：
{conversation}

请直接返回 JSON 数组，不要加其他内容。"""


async def extract_memories(conversation: str) -> list[dict]:
    """从对话中提取用户偏好"""
    if not settings.llm_api_key and not settings.llm_auth_token:
        return []
    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        result = await client.chat(
            [{"role": "user", "content": EXTRACT_PROMPT.format(conversation=conversation)}],
            max_tokens=512, temperature=0.3,
        )
        text = result["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        return json.loads(text) if text.startswith("[") else []
    except Exception as e:
        logger.debug("记忆提取失败: %s", e)
        return []
    finally:
        await client.close()


async def save_memories(db: AsyncSession, user_id: int, memories: list[dict]):
    """保存提取的记忆到数据库（upsert）"""
    for mem in memories:
        stmt = insert(UserMemory).values(
            user_id=user_id,
            category=mem["category"],
            key=mem["key"],
            value=mem["value"],
        ).on_conflict_do_update(
            constraint="uq_user_memory",
            set_={"value": mem["value"]},
        )
        await db.execute(stmt)
    await db.commit()


async def get_user_context(db: AsyncSession, user_id: int) -> str:
    """获取用户记忆作为上下文注入"""
    result = await db.execute(
        select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.updated_at.desc()).limit(20)
    )
    memories = result.scalars().all()
    if not memories:
        return ""
    lines = [f"- {m.category}/{m.key}: {m.value}" for m in memories]
    return "已知用户信息：\n" + "\n".join(lines)
