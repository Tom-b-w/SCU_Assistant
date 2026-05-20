"""
LLM 意图路由器 (Intent Router)

基于 Anthropic Function Calling 实现意图识别与参数提取。
核心思路：将所有可用功能定义为 Tool，让 LLM 自行判断用户意图并选择合适的工具。

流程:
  1. 用户消息 + 工具列表 → LLM
  2. LLM 判断:
     - 直接回复文本 → 返回
     - 调用工具 → 执行工具 → 结果回传 LLM → 生成最终回复
  3. 支持多轮工具调用（最多 MAX_ITERATIONS 轮）
"""

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from services.chat.tools import TOOL_DEFINITIONS_ANTHROPIC, execute_tool
from shared.llm_client import LLMClient

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 3

WEATHER_KEYWORDS = (
    "天气",
    "气温",
    "温度",
    "下雨",
    "降雨",
    "会不会雨",
    "穿什么",
    "穿衣",
    "冷不冷",
    "热不热",
)

RAG_KEYWORDS = (
    "知识库",
    "rag",
    "课件",
    "ppt",
    "pdf",
    "文档",
    "资料",
    "讲义",
    "教材",
    "复习资料",
)

KNOWN_WEATHER_CITIES = ("成都", "北京", "上海", "广州", "深圳", "重庆")
CAMPUS_WEATHER_HINTS = ("望江", "江安", "华西", "川大", "四川大学")


@dataclass
class ToolCallRecord:
    name: str
    arguments: dict
    result: str


@dataclass
class RouteResult:
    text: str = ""
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    usage: dict | None = None
    iterations: int = 0


class IntentRouter:
    """
    基于 LLM Function Calling 的意图路由器

    用法:
        router = IntentRouter(student_id, user_id, db, redis_client)
        result = await router.route(messages, system_prompt, llm_client)
    """

    def __init__(
        self,
        student_id: str,
        user_id: int,
        db: AsyncSession,
        redis_client,
    ):
        self.student_id = student_id
        self.user_id = user_id
        self.db = db
        self.redis_client = redis_client

    def get_tool_definitions(self) -> list[dict]:
        return TOOL_DEFINITIONS_ANTHROPIC

    def _latest_user_text(self, messages: list[dict]) -> str:
        for message in reversed(messages):
            if message.get("role") != "user":
                continue
            content = message.get("content", "")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts: list[str] = []
                for block in content:
                    if isinstance(block, dict):
                        text = block.get("text") or block.get("content")
                        if isinstance(text, str):
                            parts.append(text)
                return "\n".join(parts)
        return ""

    def _match_direct_tool(self, messages: list[dict]) -> tuple[str, dict[str, Any]] | None:
        text = self._latest_user_text(messages).strip()
        if not text:
            return None

        text_lower = text.lower()
        if any(keyword in text for keyword in WEATHER_KEYWORDS):
            city = "成都"
            for known_city in KNOWN_WEATHER_CITIES:
                if known_city in text:
                    city = known_city
                    break
            if any(hint in text for hint in CAMPUS_WEATHER_HINTS):
                city = "成都"
            return "query_weather", {"city": city}

        if any(keyword in text_lower for keyword in RAG_KEYWORDS):
            return "search_knowledge_base", {"question": text}

        return None

    def _format_direct_tool_result(self, tool_name: str, tool_result: str) -> str:
        try:
            data = json.loads(tool_result)
        except json.JSONDecodeError:
            return tool_result

        if isinstance(data, dict) and data.get("error"):
            return str(data["error"])

        if tool_name == "query_weather" and isinstance(data, dict):
            city = data.get("city", "成都")
            condition = data.get("condition", "未知")
            temp = data.get("temperature", "未知")
            feels_like = data.get("feels_like")
            humidity = data.get("humidity")
            wind_direction = data.get("wind_direction", "")
            wind_scale = data.get("wind_scale", "")
            advice = data.get("clothing_advice", "")

            lines = [f"{city}当前天气：{condition}，气温 {temp}℃。"]
            if feels_like is not None:
                lines.append(f"体感温度 {feels_like}℃。")
            if humidity is not None:
                lines.append(f"湿度 {humidity}%。")
            if wind_direction or wind_scale:
                lines.append(f"风况：{wind_direction}{wind_scale}级。")
            if advice:
                lines.append(f"\n穿衣建议：\n{advice}")
            return "\n".join(lines)

        if tool_name == "search_knowledge_base" and isinstance(data, dict):
            if data.get("answer"):
                answer = str(data["answer"])
                sources = data.get("sources") or []
                filenames = []
                for source in sources:
                    filename = source.get("filename") if isinstance(source, dict) else None
                    if filename and filename not in filenames:
                        filenames.append(filename)
                if filenames:
                    answer += "\n\n参考来源：" + "、".join(filenames)
                return answer
            if data.get("message"):
                return str(data["message"])

        return json.dumps(data, ensure_ascii=False, indent=2)

    async def _execute_direct_tool(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
    ) -> tuple[str, str]:
        tool_result = await execute_tool(
            tool_name,
            tool_args,
            student_id=self.student_id,
            user_id=self.user_id,
            redis_client=self.redis_client,
            db=self.db,
        )
        return tool_result, self._format_direct_tool_result(tool_name, tool_result)

    async def route(
        self,
        messages: list[dict],
        system: str,
        llm_client: LLMClient,
    ) -> RouteResult:
        """
        执行意图路由循环（非流式）。

        1. 将 messages + tools 发送给 LLM
        2. 如果 LLM 返回 tool_use，执行工具并将结果追加到消息
        3. 重复直到 LLM 不再调用工具或达到最大迭代次数
        """
        result = RouteResult()
        current_messages = list(messages)

        direct_tool = self._match_direct_tool(current_messages)
        if direct_tool:
            tool_name, tool_args = direct_tool
            tool_result, answer = await self._execute_direct_tool(tool_name, tool_args)
            result.iterations = 1
            result.text = answer
            result.tool_calls.append(ToolCallRecord(
                name=tool_name,
                arguments=tool_args,
                result=tool_result,
            ))
            return result

        for iteration in range(MAX_ITERATIONS):
            result.iterations = iteration + 1

            has_tools = iteration == 0
            resp = await llm_client.chat(
                current_messages,
                system=system,
                tools=self.get_tool_definitions() if has_tools else None,
                tool_choice={"type": "auto"} if has_tools else None,
            )

            result.usage = resp.get("usage", result.usage)

            tool_calls = resp.get("tool_calls", [])
            text_content = resp.get("text", "")

            if not tool_calls:
                result.text = text_content
                break

            assistant_content = []
            if text_content:
                assistant_content.append({"type": "text", "text": text_content})
            for tc in tool_calls:
                assistant_content.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["input"],
                })
            current_messages.append({"role": "assistant", "content": assistant_content})

            for tc in tool_calls:
                tool_name = tc["name"]
                tool_args = tc["input"]
                tool_id = tc["id"]

                logger.info(
                    "IntentRouter: 调用工具 %s(%s) [iter=%d]",
                    tool_name,
                    json.dumps(tool_args, ensure_ascii=False)[:100],
                    iteration + 1,
                )

                tool_result = await execute_tool(
                    tool_name,
                    tool_args,
                    student_id=self.student_id,
                    user_id=self.user_id,
                    redis_client=self.redis_client,
                    db=self.db,
                )

                result.tool_calls.append(ToolCallRecord(
                    name=tool_name,
                    arguments=tool_args,
                    result=tool_result,
                ))

                current_messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": tool_result,
                    }],
                })

        else:
            result.text = text_content or "抱歉，处理过程中工具调用次数过多，请简化您的问题后重试。"

        return result

    async def route_stream(
        self,
        messages: list[dict],
        system: str,
        llm_client: LLMClient,
    ):
        """
        流式意图路由: 先非流式判断是否需要工具调用，再流式返回最终回复。

        Yields:
            dict: SSE 事件数据
                {"type": "tool_call", "name": "...", "arguments": {...}} - 工具调用通知
                {"type": "tool_result", "name": "..."} - 工具执行结果
                {"type": "text", "content": "..."} - 最终文本回复（增量）
                {"type": "done"} - 完成
        """
        current_messages = list(messages)
        all_tool_calls: list[ToolCallRecord] = []

        direct_tool = self._match_direct_tool(current_messages)
        if direct_tool:
            tool_name, tool_args = direct_tool
            yield {"type": "tool_call", "name": tool_name, "arguments": tool_args}
            tool_result, answer = await self._execute_direct_tool(tool_name, tool_args)
            all_tool_calls.append(ToolCallRecord(
                name=tool_name,
                arguments=tool_args,
                result=tool_result,
            ))
            yield {"type": "tool_result", "name": tool_name}
            yield {"type": "text", "content": answer}
            yield {"type": "done"}
            return

        for iteration in range(MAX_ITERATIONS):
            has_tools = iteration == 0
            resp = await llm_client.chat(
                current_messages,
                system=system,
                tools=self.get_tool_definitions() if has_tools else None,
                tool_choice={"type": "auto"} if has_tools else None,
            )

            tool_calls = resp.get("tool_calls", [])
            text_content = resp.get("text", "")

            if not tool_calls:
                if text_content:
                    yield {"type": "text", "content": text_content}

                yield {"type": "done"}
                return

            assistant_content = []
            if text_content:
                assistant_content.append({"type": "text", "text": text_content})
            for tc in tool_calls:
                assistant_content.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["input"],
                })
            current_messages.append({"role": "assistant", "content": assistant_content})

            for tc in tool_calls:
                tool_name = tc["name"]
                tool_args = tc["input"]
                tool_id = tc["id"]

                yield {"type": "tool_call", "name": tool_name, "arguments": tool_args}

                logger.info(
                    "IntentRouter(stream): 调用工具 %s(%s) [iter=%d]",
                    tool_name,
                    json.dumps(tool_args, ensure_ascii=False)[:100],
                    iteration + 1,
                )

                tool_result = await execute_tool(
                    tool_name,
                    tool_args,
                    student_id=self.student_id,
                    user_id=self.user_id,
                    redis_client=self.redis_client,
                    db=self.db,
                )

                all_tool_calls.append(ToolCallRecord(
                    name=tool_name,
                    arguments=tool_args,
                    result=tool_result,
                ))

                yield {"type": "tool_result", "name": tool_name}

                current_messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": tool_result,
                    }],
                })

        yield {
            "type": "text",
            "content": "抱歉，处理过程中工具调用次数过多，请简化您的问题后重试。",
        }
        yield {"type": "done"}
