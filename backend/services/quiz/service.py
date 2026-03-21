"""智能出题 -- 基于 RAG 检索 + LLM 生成"""
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from shared.llm_client import LLMClient
from shared.config import settings
from services.rag import embedding, retriever

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = (
    "你是一位专业的大学考试出题老师。根据提供的学习资料生成高质量的考试题目。\n\n"
    "要求：\n"
    "1. 题目必须基于提供的参考资料内容\n"
    "2. 严格按照指定的题目类型和难度出题\n"
    "3. 每道题必须包含标准答案和详细解析\n"
    "4. 返回 JSON 格式，结构如下：\n\n"
    '{"questions": [{"question": "题目内容", "question_type": "choice|short_answer|essay", '
    '"options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "标准答案", '
    '"explanation": "解析说明", "source": "来源内容摘要"}]}\n\n'
    "注意：选择题必须有 4 个选项（A/B/C/D），简答题和论述题不需要 options 字段。"
)


async def generate_quiz(db: AsyncSession, kb_id: int, user_id: int,
                        topic: str, count: int, difficulty: str,
                        question_type: str) -> dict:
    """从知识库生成测试题"""
    query = topic if topic else "核心知识点 重要概念 关键内容"
    query_emb = (await embedding.get_embeddings([query]))[0]
    results = await retriever.search(kb_id, query_emb, top_k=10)

    if not results:
        return {"questions": [], "topic": topic, "usage": None}

    context = "\n\n---\n\n".join(
        f"[{r['metadata'].get('filename', '')}]\n{r['text']}" for r in results
    )

    prompt = (
        f"参考资料：\n{context}\n\n"
        f"请根据以上资料出 {count} 道{difficulty}难度的题目。"
        f"题目类型：{question_type}。"
        f"{'主题范围：' + topic if topic else '覆盖资料的核心知识点。'}\n"
        f"请直接返回 JSON，不要加 markdown 代码块标记。"
    )

    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        result = await client.chat(
            [{"role": "user", "content": prompt}],
            system=QUIZ_SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.7,
        )
        text = result["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        data = json.loads(text)
        return {
            "questions": data.get("questions", []),
            "topic": topic or "综合",
            "usage": result["usage"],
        }
    except json.JSONDecodeError:
        logger.error("出题 JSON 解析失败: %s", result["text"][:200])
        return {"questions": [], "topic": topic, "usage": result.get("usage")}
    finally:
        await client.close()
