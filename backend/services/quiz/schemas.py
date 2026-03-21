from pydantic import BaseModel


class QuizRequest(BaseModel):
    kb_id: int
    topic: str = ""
    count: int = 5
    difficulty: str = "medium"
    question_type: str = "mixed"


class QuizQuestion(BaseModel):
    question: str
    question_type: str
    options: list[str] | None = None
    answer: str
    explanation: str
    source: str = ""


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]
    topic: str
    usage: dict | None = None
