"""AI 复习计划生成"""
import json
import logging
from datetime import date

from shared.llm_client import LLMClient
from shared.config import settings

logger = logging.getLogger(__name__)

PLAN_SYSTEM_PROMPT = (
    "你是一位经验丰富的学习规划师。根据学生的考试安排和可用时间，生成科学合理的逐日复习计划。\n\n"
    "规划原则：\n"
    "1. 越临近考试的科目，安排越密集的复习\n"
    "2. 难度高的科目分配更多时间\n"
    "3. 每天安排不同科目交替学习，避免疲劳\n"
    "4. 考前一天以复盘和轻量练习为主\n"
    "5. 合理安排休息时间\n\n"
    "返回 JSON 格式：\n"
    '{"plan": [{"date": "2026-04-01", "tasks": [{"subject": "高等数学", '
    '"task": "复习第3章极限与连续", "hours": 2.0, "priority": "high"}]}], '
    '"summary": "整体规划说明..."}'
)


async def generate_study_plan(exams: list[dict], daily_hours: float,
                              start_date: date | None = None) -> dict:
    """生成逐日复习计划"""
    if not start_date:
        start_date = date.today()

    exams_text = "\n".join(
        f"- {e['subject']}：考试日期 {e['exam_date']}，难度 {e.get('difficulty', 'medium')}"
        f"{'，备注: ' + e['notes'] if e.get('notes') else ''}"
        for e in exams
    )

    prompt = (
        f"今天是 {start_date}，以下是我的考试安排：\n{exams_text}\n\n"
        f"我每天可以学习 {daily_hours} 小时。\n"
        f"请为我生成从今天到最后一门考试前的逐日复习计划。\n"
        f"请直接返回 JSON，不要加 markdown 代码块标记。"
    )

    client = LLMClient(
        api_key=settings.llm_api_key, base_url=settings.llm_base_url,
        model=settings.llm_model, auth_token=settings.llm_auth_token,
    )
    try:
        result = await client.chat(
            [{"role": "user", "content": prompt}],
            system=PLAN_SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.5,
        )
        text = result["text"].strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
        data = json.loads(text)
        return {
            "plan": data.get("plan", []),
            "summary": data.get("summary", ""),
            "usage": result["usage"],
        }
    except json.JSONDecodeError:
        logger.error("复习计划 JSON 解析失败: %s", result["text"][:200])
        return {"plan": [], "summary": "生成失败，请重试", "usage": result.get("usage")}
    finally:
        await client.close()
