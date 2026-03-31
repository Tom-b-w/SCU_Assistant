"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileQuestion,
  Send,
  Upload,
  Plus,
  Loader2,
  Sparkles,
  User,
  FileText,
  Database,
  Trash2,
  X,
  CheckCircle2,
  PenLine,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  uploadDocument,
  queryRag,
  type KnowledgeBase,
  type RagQueryResult,
} from "@/lib/rag";
import { generateQuiz, type QuizQuestion } from "@/lib/quiz";

interface QAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ doc_name?: string; filename?: string; score?: number }>;
}

// ─── Quiz Panel ──────────────────────────────────────────────────────────────

function QuizPanel({ kb }: { kb: KnowledgeBase }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [qType, setQType] = useState<"choice" | "short_answer" | "mixed">("mixed");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (kb.document_count === 0) {
      setError("请先上传文档到知识库");
      return;
    }
    setLoading(true);
    setError(null);
    setQuestions([]);
    setExpanded(null);
    setRevealed(new Set());
    try {
      const result = await generateQuiz(kb.id, topic, count, difficulty, qType);
      if (result.questions.length === 0) {
        setError("未能生成题目，请尝试增加文档内容或调整主题");
      } else {
        setQuestions(result.questions);
        setExpanded(0);
      }
    } catch {
      setError("生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Controls */}
      <div className="border-b border-border/30 px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="出题主题（选填，如：链表、递归）"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-8 rounded-lg border border-border/50 bg-background px-2 text-xs"
          >
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>{n} 道题</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  difficulty === d
                    ? d === "easy"
                      ? "bg-emerald-500 text-white"
                      : d === "medium"
                      ? "bg-amber-500 text-white"
                      : "bg-red-500 text-white"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {d === "easy" ? "简单" : d === "medium" ? "中等" : "困难"}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["choice", "short_answer", "mixed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setQType(t)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  qType === t
                    ? "bg-violet-500 text-white"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {t === "choice" ? "选择题" : t === "short_answer" ? "简答题" : "混合"}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="ml-auto h-7 gap-1.5 text-xs bg-violet-500 text-white hover:bg-violet-600"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {loading ? "生成中..." : "生成题目"}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto p-4">
        {questions.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <PenLine className="h-10 w-10 opacity-20" />
            <p className="mt-3 text-sm">点击"生成题目"开始出题</p>
            <p className="mt-1 text-xs opacity-60">AI 将根据知识库内容出题</p>
          </div>
        ) : loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground">AI 正在生成题目...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div
                key={i}
                className="rounded-xl ring-1 ring-border/50 bg-white dark:bg-gray-900 overflow-hidden transition-all"
              >
                {/* Question header */}
                <button
                  className="flex w-full items-start gap-3 p-4 text-left"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[11px] font-bold text-violet-600 dark:text-violet-400">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        q.question_type === "choice"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      }`}>
                        {q.question_type === "choice" ? "选择题" : "简答题"}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{q.question}</p>
                    {q.question_type === "choice" && q.options && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, j) => (
                          <p key={j} className="text-xs text-muted-foreground">{opt}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  {expanded === i ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  )}
                </button>

                {/* Answer & explanation */}
                {expanded === i && (
                  <div className="border-t border-border/30 px-4 py-3 space-y-2">
                    {!revealed.has(i) ? (
                      <button
                        onClick={() => setRevealed((prev) => new Set([...prev, i]))}
                        className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        查看答案
                      </button>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-0.5">答案</p>
                            <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">{q.answer}</p>
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">解析</p>
                          <p className="text-xs leading-relaxed">{q.explanation}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RagPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"qa" | "quiz">("qa");

  // KB creation
  const [showCreateKb, setShowCreateKb] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  const [creatingKb, setCreatingKb] = useState(false);

  // File upload
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [querying, setQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchKbs = useCallback(async () => {
    try {
      const data = await getKnowledgeBases();
      setKnowledgeBases(data);
      if (data.length > 0 && !selectedKb) {
        setSelectedKb(data[0]);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKbs();
  }, [fetchKbs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleCreateKb() {
    if (!newKbName.trim()) return;
    setCreatingKb(true);
    try {
      const kb = await createKnowledgeBase(newKbName.trim(), newKbDesc.trim());
      setKnowledgeBases((prev) => [...prev, kb]);
      setSelectedKb(kb);
      setNewKbName("");
      setNewKbDesc("");
      setShowCreateKb(false);
    } catch {
      // TODO: toast
    } finally {
      setCreatingKb(false);
    }
  }

  async function handleDeleteKb(kbId: number) {
    try {
      await deleteKnowledgeBase(kbId);
      setKnowledgeBases((prev) => prev.filter((k) => k.id !== kbId));
      if (selectedKb?.id === kbId) {
        setSelectedKb(knowledgeBases.find((k) => k.id !== kbId) || null);
      }
    } catch {
      // TODO: toast
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedKb) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadDocument(selectedKb.id, file);
      setUploadResult(`"${result.filename}" 上传成功，已切分为 ${result.chunk_count} 个片段`);
      // refresh KB list to update doc count
      fetchKbs();
    } catch {
      setUploadResult("上传失败，请检查文件格式后重试");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleQuery() {
    if (!question.trim() || !selectedKb || querying) return;
    const q = question.trim();
    setQuestion("");

    const userMsg: QAMessage = {
      id: Date.now().toString(),
      role: "user",
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuerying(true);

    try {
      const result: RagQueryResult = await queryRag(selectedKb.id, q);
      const aiMsg: QAMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.answer,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: QAMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "查询失败，请确认知识库中已有文档后重试。",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setQuerying(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
          <FileQuestion className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">课件问答</h1>
          <p className="text-xs text-muted-foreground">
            上传课件文档，AI 帮你解答问题或智能出题
          </p>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left Panel: Knowledge Bases */}
        <div className="w-64 shrink-0 space-y-3">
          {/* KB Selector */}
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground">知识库</h3>
              <button
                onClick={() => setShowCreateKb(!showCreateKb)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showCreateKb ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>

            {showCreateKb && (
              <div className="mb-2 space-y-2 rounded-lg bg-muted/30 p-2">
                <Input
                  placeholder="知识库名称"
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="描述（选填）"
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={handleCreateKb}
                  disabled={!newKbName.trim() || creatingKb}
                >
                  {creatingKb ? <Loader2 className="h-3 w-3 animate-spin" /> : "创建"}
                </Button>
              </div>
            )}

            {knowledgeBases.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 text-center py-4">
                暂无知识库，请先创建
              </p>
            ) : (
              <div className="space-y-1">
                {knowledgeBases.map((kb) => (
                  <div
                    key={kb.id}
                    className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-all ${
                      selectedKb?.id === kb.id
                        ? "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                    onClick={() => {
                      setSelectedKb(kb);
                      setMessages([]);
                    }}
                  >
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{kb.name}</p>
                      <p className="text-[10px] opacity-60">{kb.document_count} 篇文档</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteKb(kb.id); }}
                      className="hidden rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-500 group-hover:block"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Area */}
          {selectedKb && (
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">上传文档</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx,.ppt,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-violet-500/50 hover:text-violet-600 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "上传中..." : "选择文件"}
              </button>
              <p className="mt-1.5 text-[10px] text-muted-foreground/60 text-center">
                支持 PDF, PPT, TXT, MD
              </p>
              {uploadResult && (
                <div className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] ${
                  uploadResult.includes("失败")
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                }`}>
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                  {uploadResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex flex-1 flex-col rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          {!selectedKb ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground p-8">
              <Database className="h-12 w-12 opacity-20" />
              <p className="mt-4 text-sm">请先选择或创建知识库</p>
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-1 border-b border-border/30 px-3 pt-2">
                <button
                  onClick={() => setActiveTab("qa")}
                  className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-all ${
                    activeTab === "qa"
                      ? "border-b-2 border-violet-500 text-violet-600 dark:text-violet-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileQuestion className="h-3.5 w-3.5" />
                  课件问答
                </button>
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-all ${
                    activeTab === "quiz"
                      ? "border-b-2 border-violet-500 text-violet-600 dark:text-violet-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  智能出题
                </button>
                <div className="ml-2 flex-1">
                  <span className="text-xs text-muted-foreground">
                    {selectedKb.name}
                    <span className="opacity-50"> · {selectedKb.document_count} 篇文档</span>
                  </span>
                </div>
              </div>

              {/* Tab content */}
              {activeTab === "qa" ? (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/20">
                          <FileQuestion className="h-7 w-7 text-white" />
                        </div>
                        <p className="mt-4 text-sm font-medium">向课件提问</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          上传文档后，输入问题即可获得 AI 解答
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                          >
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                msg.role === "user"
                                  ? "bg-gradient-to-br from-[#C41230] to-[#E8173A] text-white"
                                  : "bg-gradient-to-br from-violet-500 to-purple-500 text-white"
                              }`}
                            >
                              {msg.role === "user" ? (
                                <User className="h-3.5 w-3.5" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                              <div
                                className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                  msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-foreground"
                                }`}
                              >
                                {msg.content.split("\n").map((line, i) => (
                                  <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                                    {line}
                                  </p>
                                ))}
                              </div>
                              {/* Sources */}
                              {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {msg.sources.map((src, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-600 dark:text-violet-400"
                                    >
                                      <FileText className="h-2.5 w-2.5" />
                                      {src.doc_name || src.filename || `来源 ${i + 1}`}
                                      {src.score != null && (
                                        <span className="opacity-60">
                                          ({(src.score * 100).toFixed(0)}%)
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {querying && (
                          <div className="flex gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                              <Sparkles className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex items-center gap-1.5 rounded-2xl bg-muted/50 px-4 py-2.5">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">检索中...</span>
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="shrink-0 border-t border-border/30 p-3">
                    <div className="flex items-center gap-2 rounded-xl bg-muted/30 p-2 ring-1 ring-border/50 focus-within:ring-violet-500/30">
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入你的问题..."
                        className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                      <button
                        onClick={handleQuery}
                        disabled={!question.trim() || querying}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <QuizPanel kb={selectedKb} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
