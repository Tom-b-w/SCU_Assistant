"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { icon: CalendarDays, text: "今天有什么课？", color: "text-blue-500 bg-blue-500/10" },
  { icon: UtensilsCrossed, text: "江安哪个食堂现在开着？", color: "text-rose-500 bg-rose-500/10" },
  { icon: BookOpen, text: "我的绩点是多少？", color: "text-orange-500 bg-orange-500/10" },
  { icon: Bus, text: "最近一班去望江的校车几点？", color: "text-cyan-500 bg-cyan-500/10" },
];

// Placeholder AI responses for demo
function generateResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("课") || lower.includes("课表")) {
    return "根据你的课表数据，我来帮你查一下...\n\n目前 AI 对话功能正在开发中，完整的自然语言查询将在后续版本中支持。你可以先通过左侧「课程表」页面查看完整课表。";
  }
  if (lower.includes("食堂") || lower.includes("吃")) {
    return "关于食堂的问题，我来帮你看看...\n\n目前 AI 对话功能正在开发中。你可以先通过左侧「食堂导航」页面查看各食堂的营业状态和窗口信息。";
  }
  if (lower.includes("绩点") || lower.includes("成绩") || lower.includes("学分")) {
    return "关于你的成绩和绩点信息...\n\n目前 AI 对话功能正在开发中。你可以在首页仪表盘查看成绩汇总和学分进度。";
  }
  if (lower.includes("校车") || lower.includes("班车")) {
    return "关于校车时刻的问题...\n\n目前 AI 对话功能正在开发中。你可以先通过左侧「校车时刻」页面查看各线路的发车时间。";
  }
  return "你好！我是 SCU Assistant 的 AI 助手。\n\n目前自然语言对话功能正在接入 LLM 中，完整的意图理解和多源数据查询将在后续版本上线。现在你可以通过左侧导航栏使用各项功能：\n\n- 📅 课程表：查看本学期课表\n- 📝 DDL 追踪：管理作业截止日期\n- 🍽️ 食堂导航：查看食堂信息\n- 🚌 校车时刻：查看班车时间";
}

export default function ChatPage() {
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: generateResponse(content),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
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
        {messages.length === 0 ? (
          /* Empty State */
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-4 text-xl font-bold">嗨，{user?.name || "同学"}！</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              我是你的智能校园助手，试试问我这些问题：
            </p>
            <div className="mt-6 grid w-full max-w-md gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    className="flex items-center gap-2.5 rounded-xl bg-white p-3 text-left text-sm shadow-sm ring-1 ring-black/[0.04] transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 dark:ring-white/[0.06]"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs">{s.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="space-y-4 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-[#C41230] to-[#E8173A] text-white"
                      : "bg-gradient-to-br from-purple-500 to-blue-500 text-white"
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
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground"
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
        {messages.length > 0 && (
          <div className="mb-2 flex justify-center">
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              新对话
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl bg-muted/30 p-2 ring-1 ring-border/50 focus-within:ring-primary/30">
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
          AI 功能开发中 · 当前为演示模式 · 后续将接入 LLM 实现智能对话
        </p>
      </div>
    </div>
  );
}
