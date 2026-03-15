from pydantic import BaseModel


class CaptchaResponse(BaseModel):
    session_key: str
    captcha_image: str  # base64 encoded


class LoginRequest(BaseModel):
    student_id: str
    password: str
    captcha: str = ""
    session_key: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    student_id: str
    name: str
    campus: str | None
    major: str | None
    grade: int | None

    model_config = {"from_attributes": True}
