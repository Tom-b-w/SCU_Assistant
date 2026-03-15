import { api } from "./api";
import type { LoginRequest, TokenResponse, User } from "@/types/api";

export interface CaptchaResponse {
  session_key: string;
  captcha_image: string; // base64
}

export async function getCaptcha(): Promise<CaptchaResponse> {
  const response = await api.get<CaptchaResponse>("/api/auth/captcha");
  return response.data;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/api/auth/login", data);
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function getMe(): Promise<User> {
  const response = await api.get<User>("/api/auth/me");
  return response.data;
}
