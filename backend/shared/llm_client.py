"""统一 LLM 客户端 -- 替代 PowerShell+curl 调用"""
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


class LLMClient:
    """Anthropic Messages API 异步客户端"""

    def __init__(self, api_key: str, base_url: str, model: str,
                 auth_token: str = "", timeout: float = 180.0):
        self.model = model
        self._api_key = api_key
        self._auth_token = auth_token
        headers = {"content-type": "application/json", "anthropic-version": "2023-06-01"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        if api_key:
            headers["x-api-key"] = api_key
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        tools: list[dict] | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        """调用 Anthropic Messages API，返回标准化结果。"""
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

        resp = await self._http.post("/v1/messages", json=payload)
        resp.raise_for_status()
        data = resp.json()

        # 标准化返回
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

    async def embedding(
        self,
        texts: list[str],
        model: str | None = None,
    ) -> list[list[float]]:
        """调用 OpenAI 兼容的 Embedding API。"""
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
