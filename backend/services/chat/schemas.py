from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]  # 对话历史


class ChatResponse(BaseModel):
    reply: str
    usage: dict | None = None  # token usage
