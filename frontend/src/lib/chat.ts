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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * SSE 流式对话 — 逐 token 回调
 */
export async function sendChatMessageStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  // 获取 token
  const { useAuthStore } = await import("@/stores/auth-store");
  const token = useAuthStore.getState().accessToken;

  const resp = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    onError("请求失败，请稍后重试");
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    onError("浏览器不支持流式传输");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;

      try {
        const event = JSON.parse(dataStr);
        if (event.type === "text") {
          onChunk(event.content);
        } else if (event.type === "done") {
          onDone();
          return;
        } else if (event.type === "error") {
          onError(event.content || "AI 服务异常");
          return;
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  onDone();
}
