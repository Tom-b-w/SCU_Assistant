import { api } from "./api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await api.post<ChatResponse>("/api/chat/completions", { messages });
  return response.data;
}
