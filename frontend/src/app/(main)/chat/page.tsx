"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore, type ChatMessage as StoredMessage } from "@/stores/chat-store";
import {
  sendChatMessageStream,
  getToolDisplayName,
  type ChatMessage,
} from "@/lib/chat";
import {
  Send,
  Sparkles,
  User,
  CalendarDays,
  UtensilsCrossed,
  BookOpen,
  Bus,
  RotateCcw,
  Loader2,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const { messages: storedMessages, addMessage, appendToLastMessage, addToolCall, updateToolCallStatus, clearMessages } = useChatStore();
  
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQuerySent = useRef(false);

  // 滚动逻辑
  useEffect(() => {
    if (messagesAreaRef.current) {
      messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
    }
  }, [storedMessages, isTyping]);

  // 输入框自适应高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

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

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: StoredMessage = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      toolCalls: [],
    };
    addMessage(aiMsg);

    const history: ChatMessage[] = [...storedMessages, userMsg].map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      await sendChatMessageStream(
        history,
        (chunk) => appendToLastMessage(chunk),
        () => setIsTyping(false),
        (err) => {
          appendToLastMessage(err || "抱歉，出错了。");
          setIsTyping(false);
        },
        (name) => addToolCall(aiMsgId, { name, displayName: getToolDisplayName(name), status: "calling" }),
        (name) => updateToolCallStatus(aiMsgId, name, "completed"),
      );
    } catch (e) {
      setIsTyping(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col bg-white dark:bg-zinc-950">
      {/* 消息区域 - 使用更干净的背景 */}
      <div ref={messagesAreaRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
        {storedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900">
              <Sparkles className="h-8 w-8 text-zinc-400" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              嗨，{user?.name || "同学"}
            </h2>
            <p className="mt-2 text-zinc-500">有什么我可以帮你的吗？</p>
            
            <div className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-0 py-4">
            {storedMessages.map((msg) => {
              if (msg.role === "assistant" && !msg.content && (!msg.toolCalls?.length)) return null;

              return (
                <div
                  key={msg.id}
                  className={`group w-full px-4 py-8 transition-colors ${
                    msg.role === "user" 
                      ? "bg-zinc-50/50 dark:bg-zinc-900/30" 
                      : "bg-transparent"
                  }`}
                >
                  <div className="mx-auto flex max-w-2xl gap-4">
                    {/* 固定宽度的头像区域，防止位置抖动 */}
                    <div className="flex shrink-0 items-start pt-1">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                        msg.role === "user" 
                          ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" 
                          : "bg-red-600 text-white shadow-sm"
                      }`}>
                        {msg.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* 内容区域 - 完全与背景融合 */}
                    <div className="flex-1 space-y-2 overflow-hidden">
                      <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {msg.role === "user" ? "你" : "小川 AI"}
                      </div>

                      {/* 工具调用显示 */}
                      {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-2 py-1">
                          {msg.toolCalls.map((tc, idx) => (
                            <div key={idx} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-800">
                              {tc.status === "calling" ? (
                                <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                              ) : (
                                <Check className="h-3 w-3 text-green-500" />
                              )}
                              {tc.displayName}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 文本内容 */}
                      <div className={`prose prose-zinc dark:prose-invert max-w-none break-words leading-7 ${
                        msg.role === "user" ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-800 dark:text-zinc-200"
                      }`}>
                        {msg.role === "assistant" ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                        {/* 正在生成时的光标 */}
                        {isTyping && msg.id === storedMessages[storedMessages.length - 1].id && !msg.content && (
                          <span className="inline-block h-5 w-1 animate-pulse bg-red-600 align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 思考中状态 - 仅在完全没有消息内容时显示 */}
            {isTyping && !storedMessages[storedMessages.length-1]?.content && !storedMessages[storedMessages.length-1]?.toolCalls?.length && (
              <div className="w-full px-4 py-8">
                <div className="mx-auto flex max-w-2xl gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-600 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-300" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入框区域 - 悬浮效果 */}
      <div className="border-t border-zinc-100 bg-white p-4 pb-8 dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto max-w-3xl">
          {/* 控制条 */}
          <div className="mb-2 flex h-6 items-center justify-between px-2">
            {storedMessages.length > 0 ? (
              <button
                onClick={clearMessages}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600"
              >
                <RotateCcw className="h-3 w-3" />
                开启新对话
              </button>
            ) : <div />}
          </div>

          <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:border-zinc-300 focus-within:ring-4 focus-within:ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus-within:ring-zinc-900/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="问问小川..."
              rows={1}
              className="flex-1 max-h-40 min-h-[44px] resize-none bg-transparent px-3 py-3 text-[15px] outline-none placeholder:text-zinc-400"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className="mb-1 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white transition-all hover:bg-red-700 disabled:opacity-20 disabled:grayscale"
            >
              {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-zinc-400">
            小川 AI 由四川大学提供支持，回答可能存在偏差
          </p>
        </div>
      </div>
    </div>
  );
}