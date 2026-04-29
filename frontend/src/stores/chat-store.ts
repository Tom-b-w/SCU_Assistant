import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ToolCallStatus {
  name: string;
  displayName: string;
  status: "calling" | "completed" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCallStatus[];
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  appendToLastMessage: (text: string) => void;
  updateToolCallStatus: (msgId: string, toolName: string, status: ToolCallStatus["status"]) => void;
  addToolCall: (msgId: string, toolCall: ToolCallStatus) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      appendToLastMessage: (text) =>
        set((s) => {
          const msgs = [...s.messages];
          if (msgs.length > 0) {
            const last = { ...msgs[msgs.length - 1] };
            last.content += text;
            msgs[msgs.length - 1] = last;
          }
          return { messages: msgs };
        }),
      addToolCall: (msgId, toolCall) =>
        set((s) => {
          const msgs = s.messages.map((m) => {
            if (m.id === msgId) {
              const existing = m.toolCalls || [];
              return { ...m, toolCalls: [...existing, toolCall] };
            }
            return m;
          });
          return { messages: msgs };
        }),
      updateToolCallStatus: (msgId, toolName, status) =>
        set((s) => {
          const msgs = s.messages.map((m) => {
            if (m.id === msgId && m.toolCalls) {
              const updated = m.toolCalls.map((tc) =>
                tc.name === toolName ? { ...tc, status } : tc,
              );
              return { ...m, toolCalls: updated };
            }
            return m;
          });
          return { messages: msgs };
        }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "scu-chat",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
