from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ToolCallInfo(BaseModel):
    name: str
    arguments: dict
    result: str | None = None


class ChatResponse(BaseModel):
    reply: str
    usage: dict | None = None
    tool_calls: list[ToolCallInfo] = []
