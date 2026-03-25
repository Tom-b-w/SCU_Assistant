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

interface QAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ doc_name?: string; filename?: string; score?: number }>;
}

export default function RagPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);

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
            上传课件文档，AI 帮你解答问题
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
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                  {uploadResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Chat Area */}
        <div className="flex flex-1 flex-col rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          {!selectedKb ? (
            <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground p-8">
              <Database className="h-12 w-12 opacity-20" />
              <p className="mt-4 text-sm">请先选择或创建知识库</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
                <FileText className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium">{selectedKb.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({selectedKb.document_count} 篇文档)
                </span>
              </div>

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
          )}
        </div>
      </div>
    </div>
  );
}
