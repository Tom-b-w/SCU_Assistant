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

from sqlalchemy.ext.asyncio import AsyncSession

from shared.llm_client import LLMClient
from services.chat.tools import TOOL_DEFINITIONS_ANTHROPIC, execute_tool

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 3


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
                if iteration == 0 and text_content:
                    async for chunk in llm_client.chat_stream(
                        current_messages,
                        system=system,
                    ):
                        yield {"type": "text", "content": chunk}
                elif text_content:
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

        yield {"type": "text", "content": "抱歉，处理过程中工具调用次数过多，请简化您的问题后重试。"}
        yield {"type": "done"}
