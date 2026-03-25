"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore, type ChatMessage as StoredMessage } from "@/stores/chat-store";
import {
  Send,
  Sparkles,
  User,
  CalendarDays,
  UtensilsCrossed,
  BookOpen,
  Bus,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { sendChatMessage, type ChatMessage } from "@/lib/chat";

const SUGGESTIONS = [
  { icon: CalendarDays, text: "今天有什么课？", color: "text-blue-500 bg-blue-500/10" },
  { icon: UtensilsCrossed, text: "江安哪个食堂现在开着？", color: "text-rose-500 bg-rose-500/10" },
  { icon: BookOpen, text: "我的绩点是多少？", color: "text-orange-500 bg-orange-500/10" },
  { icon: Bus, text: "最近一班去望江的校车几点？", color: "text-cyan-500 bg-cyan-500/10" },
];

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const { messages: storedMessages, addMessage, clearMessages } = useChatStore();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySent = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [storedMessages]);

  // 从搜索栏跳转过来时自动发送问题
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialQuerySent.current) {
      initialQuerySent.current = true;
      sendMessage(q);
    }
  }, [searchParams]);

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || isTyping) return;

    const userMsg: StoredMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput("");
    setIsTyping(true);

    try {
      const allMessages = [...storedMessages, userMsg];
      const history: ChatMessage[] = allMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const response = await sendChatMessage(history);
      const aiMsg: StoredMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.reply,
        timestamp: new Date().toISOString(),
      };
      addMessage(aiMsg);
    } catch {
      const errorMsg: StoredMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "抱歉，发送消息时出现错误，请稍后重试。",
        timestamp: new Date().toISOString(),
      };
      addMessage(errorMsg);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {storedMessages.length === 0 ? (
          /* Empty State */
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-cyan-500/20 blur-xl animate-pulse-glow" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 shadow-xl shadow-purple-500/25">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="mt-6 text-2xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent dark:from-purple-400 dark:via-blue-400 dark:to-cyan-400">嗨，{user?.name || "同学"}！</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              我是你的智能校园助手小川，试试问我这些问题：
            </p>
            <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    className="group flex items-center gap-3 rounded-xl bg-white p-3.5 text-left text-sm shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-gray-900 dark:ring-white/[0.06]"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.color} transition-transform duration-200 group-hover:scale-110`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium">{s.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="space-y-5 py-4">
            {storedMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 animate-slide-up ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[#C41230] to-[#E8173A] text-white shadow-[#C41230]/20"
                      : "bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 text-white shadow-purple-500/20"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-sm shadow-primary/10"
                      : "bg-white ring-1 ring-black/[0.04] text-foreground shadow-sm dark:bg-gray-900 dark:ring-white/[0.06]"
                  }`}
                >
                  {msg.content.split("\n").map((line, i) => (
                    <p key={i} className={i > 0 ? "mt-2" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl bg-muted/50 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">思考中...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border/30 bg-white/80 px-2 py-3 backdrop-blur-sm dark:bg-gray-950/80">
        {storedMessages.length > 0 && (
          <div className="mb-2 flex justify-center">
            <button
              onClick={clearMessages}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              新对话
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl bg-white/80 p-2 shadow-lg shadow-black/[0.03] ring-1 ring-black/[0.06] backdrop-blur-sm transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:shadow-xl focus-within:shadow-primary/[0.03] dark:bg-gray-900/80 dark:ring-white/[0.08]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题...（Shift+Enter 换行）"
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
            style={{ maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
          小川 AI · 四川大学智能校园助手
        </p>
      </div>
    </div>
  );
}
