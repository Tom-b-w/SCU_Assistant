from pydantic import BaseModel
from datetime import datetime


class KBCreate(BaseModel):
    name: str
    description: str = ""


class KBResponse(BaseModel):
    id: int
    name: str
    description: str
    document_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: int
    filename: str
    chunk_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RAGQuery(BaseModel):
    question: str
    top_k: int = 5


class RAGAnswer(BaseModel):
    answer: str
    sources: list[dict]
    usage: dict | None = None
