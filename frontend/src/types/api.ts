export interface User {
  id: number;
  student_id: string;
  name: string;
  campus: string | null;
  major: string | null;
  grade: number | null;
}

export interface LoginRequest {
  student_id: string;
  password: string;
  captcha: string;
  session_key: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
  };
}
