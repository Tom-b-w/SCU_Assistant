import { api } from "./api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallInfo {
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

export interface ChatResponse {
  reply: string;
  usage: { input_tokens: number; output_tokens: number } | null;
  tool_calls: ToolCallInfo[];
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await api.post<ChatResponse>("/api/chat/completions", { messages });
  return response.data;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOOL_NAME_MAP: Record<string, string> = {
  get_today_schedule: "查询课表",
  get_grades_summary: "查询成绩",
  get_deadlines: "查询待办",
  search_knowledge_base: "搜索知识库",
  generate_quiz: "生成练习题",
  query_exams: "查询考试",
  generate_review_plan: "生成复习计划",
  query_weather: "查询天气",
};

export function getToolDisplayName(name: string): string {
  return TOOL_NAME_MAP[name] || name;
}

export async function sendChatMessageStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  onToolCall?: (name: string, args: Record<string, unknown>) => void,
  onToolResult?: (name: string) => void,
): Promise<void> {
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
        } else if (event.type === "tool_call") {
          onToolCall?.(event.name, event.arguments || {});
        } else if (event.type === "tool_result") {
          onToolResult?.(event.name);
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  onDone();
}
