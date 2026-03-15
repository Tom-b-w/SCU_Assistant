"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  X,
} from "lucide-react";

interface Deadline {
  id: string;
  title: string;
  course_name: string;
  due_date: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
}

const PRIORITY_CONFIG = {
  high: { label: "紧急", color: "bg-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  medium: { label: "一般", color: "bg-orange-500", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  low: { label: "普通", color: "bg-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

function daysUntil(dateStr: string) {
  const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}

export default function DeadlinePage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([
    // Demo data - will be replaced with API data later
    { id: "1", title: "操作系统实验报告", course_name: "操作系统", due_date: "2026-03-20T23:59:00", priority: "high", status: "pending" },
    { id: "2", title: "数据库课程设计文档", course_name: "数据库原理", due_date: "2026-03-25T23:59:00", priority: "medium", status: "pending" },
    { id: "3", title: "英语阅读周报", course_name: "大学英语", due_date: "2026-03-18T23:59:00", priority: "low", status: "pending" },
    { id: "4", title: "线性代数第三章作业", course_name: "线性代数", due_date: "2026-03-12T23:59:00", priority: "medium", status: "completed" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const filtered = deadlines
    .filter((d) => filter === "all" || d.status === filter)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      const pa = { high: 0, medium: 1, low: 2 };
      return pa[a.priority] - pa[b.priority] || new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  function addDeadline() {
    if (!newTitle || !newDate) return;
    const dl: Deadline = {
      id: Date.now().toString(),
      title: newTitle,
      course_name: newCourse,
      due_date: newDate,
      priority: newPriority,
      status: "pending",
    };
    setDeadlines([...deadlines, dl]);
    setNewTitle("");
    setNewCourse("");
    setNewDate("");
    setNewPriority("medium");
    setShowAdd(false);
  }

  function toggleStatus(id: string) {
    setDeadlines(deadlines.map((d) =>
      d.id === id ? { ...d, status: d.status === "pending" ? "completed" : "pending" } : d
    ));
  }

  function removeDeadline(id: string) {
    setDeadlines(deadlines.filter((d) => d.id !== id));
  }

  const pendingCount = deadlines.filter((d) => d.status === "pending").length;
  const urgentCount = deadlines.filter((d) => d.status === "pending" && daysUntil(d.due_date) <= 3).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
            <BookOpen className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">DDL 追踪</h1>
            <p className="text-xs text-muted-foreground">
              {pendingCount} 项待办{urgentCount > 0 && `，${urgentCount} 项紧急`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? "取消" : "添加"}
        </Button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="space-y-3">
            <Input
              placeholder="DDL 标题（如：操作系统实验报告）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-10"
            />
            <div className="flex gap-2">
              <Input
                placeholder="课程名称（选填）"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                className="h-10 flex-1"
              />
              <Input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-10 w-52"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewPriority(p)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      newPriority === p
                        ? PRIORITY_CONFIG[p].badge + " ring-1 ring-current/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={addDeadline} disabled={!newTitle || !newDate}>
                确认添加
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
        {([
          ["all", "全部"],
          ["pending", "待办"],
          ["completed", "已完成"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              filter === key
                ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {key === "pending" && pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-orange-500/10 px-1.5 text-[10px] text-orange-600">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Deadline List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500/30" />
            <p className="mt-4 text-muted-foreground">
              {filter === "completed" ? "暂无已完成的 DDL" : "太棒了，没有待办事项！"}
            </p>
          </div>
        ) : (
          filtered.map((dl) => {
            const days = daysUntil(dl.due_date);
            const isOverdue = dl.status === "pending" && days < 0;
            const isUrgent = dl.status === "pending" && days >= 0 && days <= 3;
            return (
              <div
                key={dl.id}
                className={`group flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition-all dark:bg-gray-900 dark:ring-white/[0.06] ${
                  dl.status === "completed" ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => toggleStatus(dl.id)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    dl.status === "completed"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-muted-foreground/30 hover:border-emerald-500"
                  }`}
                >
                  {dl.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>

                <div className={`h-8 w-1 rounded-full ${PRIORITY_CONFIG[dl.priority].color}`} />

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${dl.status === "completed" ? "line-through" : ""}`}>
                    {dl.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {dl.course_name && <span>{dl.course_name}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(dl.due_date).toLocaleDateString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {dl.status === "pending" && (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isOverdue
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : isUrgent
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isOverdue ? (
                        <><AlertTriangle className="h-3 w-3" />已逾期</>
                      ) : isUrgent ? (
                        <><Clock className="h-3 w-3" />剩{days}天</>
                      ) : (
                        <><Clock className="h-3 w-3" />剩{days}天</>
                      )}
                    </span>
                  )}
                  <button
                    onClick={() => removeDeadline(dl.id)}
                    className="hidden rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-500 group-hover:flex"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground/50">
        DDL 数据目前存储在本地，后续将支持云端同步与自动抓取
      </p>
    </div>
  );
}
