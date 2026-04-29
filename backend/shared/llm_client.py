"""统一 LLM 客户端 -- 支持 Anthropic 和 OpenAI 兼容格式"""
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


class LLMClient:
    """LLM API 异步客户端，支持 Anthropic 和 OpenAI 兼容格式"""

    def __init__(self, api_key: str, base_url: str, model: str,
                 auth_token: str = "", timeout: float = 180.0):
        self.model = model
        self._api_key = api_key
        self._auth_token = auth_token
        self._base_url = base_url.rstrip("/")
        self._is_openai_compatible = self._detect_openai_compatible(base_url)

        headers = {"content-type": "application/json"}
        if self._is_openai_compatible:
            token = auth_token or api_key
            if token:
                headers["Authorization"] = f"Bearer {token}"
        else:
            headers["anthropic-version"] = "2023-06-01"
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"
            if api_key:
                headers["x-api-key"] = api_key

        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            headers=headers,
            timeout=timeout,
        )

    def _detect_openai_compatible(self, base_url: str) -> bool:
        """检测是否为 OpenAI 兼容 API"""
        openai_indicators = [
            "dashscope.aliyuncs.com",
            "api.openai.com",
            "api.deepseek.com",
            "openai",
        ]
        return any(indicator in base_url.lower() for indicator in openai_indicators)

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        tools: list[dict] | None = None,
        tool_choice: dict | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        """调用 LLM API，返回标准化结果。"""
        if self._is_openai_compatible:
            return await self._chat_openai(messages, system, tools, max_tokens, temperature)
        else:
            return await self._chat_anthropic(messages, system, tools, tool_choice, max_tokens, temperature)

    async def _chat_anthropic(
        self,
        messages: list[dict],
        system: str,
        tools: list[dict] | None,
        tool_choice: dict | None,
        max_tokens: int,
        temperature: float,
    ) -> dict[str, Any]:
        """Anthropic Messages API 格式"""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system:
            payload["system"] = system
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = tool_choice or {"type": "auto"}

        logger.debug("Anthropic request: model=%s, tools=%s", self.model, bool(tools))
        resp = await self._http.post("/v1/messages", json=payload)
        resp.raise_for_status()
        data = resp.json()

        result: dict[str, Any] = {
            "text": "",
            "tool_calls": [],
            "stop_reason": data.get("stop_reason", "end_turn"),
            "usage": data.get("usage", {}),
            "raw": data,
        }
        for block in data.get("content", []):
            if block["type"] == "text":
                result["text"] += block["text"]
            elif block["type"] == "tool_use":
                result["tool_calls"].append({
                    "id": block["id"],
                    "name": block["name"],
                    "input": block.get("input", {}),
                })
        return result

    async def _chat_openai(
        self,
        messages: list[dict],
        system: str,
        tools: list[dict] | None,
        max_tokens: int,
        temperature: float,
    ) -> dict[str, Any]:
        """OpenAI 兼容 API 格式"""
        full_messages = []
        if system:
            full_messages.append({"role": "system", "content": system})
        full_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": full_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        logger.debug("OpenAI request: model=%s", self.model)
        resp = await self._http.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()

        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})

        result: dict[str, Any] = {
            "text": message.get("content", ""),
            "tool_calls": [],
            "stop_reason": choice.get("finish_reason", "stop"),
            "usage": data.get("usage", {}),
            "raw": data,
        }
        return result

    async def chat_stream(
        self,
        messages: list[dict],
        system: str = "",
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ):
        """流式调用 LLM API，yield 文本增量。"""
        if self._is_openai_compatible:
            async for chunk in self._chat_stream_openai(messages, system, max_tokens, temperature):
                yield chunk
        else:
            async for chunk in self._chat_stream_anthropic(messages, system, max_tokens, temperature):
                yield chunk

    async def _chat_stream_anthropic(
        self,
        messages: list[dict],
        system: str,
        max_tokens: int,
        temperature: float,
    ):
        """Anthropic 流式格式"""
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        if system:
            payload["system"] = system

        async with self._http.stream("POST", "/v1/messages", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    import json as _json
                    event = _json.loads(data_str)
                    event_type = event.get("type", "")
                    if event_type == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield delta["text"]
                    elif event_type == "message_stop":
                        break
                except Exception:
                    continue

    async def _chat_stream_openai(
        self,
        messages: list[dict],
        system: str,
        max_tokens: int,
        temperature: float,
    ):
        """OpenAI 兼容流式格式"""
        full_messages = []
        if system:
            full_messages.append({"role": "system", "content": system})
        full_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": full_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with self._http.stream("POST", "/v1/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    import json as _json
                    event = _json.loads(data_str)
                    choices = event.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                except Exception:
                    continue

    async def embedding(
        self,
        texts: list[str],
        model: str | None = None,
    ) -> list[list[float]]:
        """调用 Embedding API。"""
        payload = {
            "model": model or "text-embedding-3-small",
            "input": texts,
        }
        resp = await self._http.post("/v1/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]

    async def close(self):
        await self._http.aclose()
