import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  appendToLastMessage: (text: string) => void;
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
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "scu-chat",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
