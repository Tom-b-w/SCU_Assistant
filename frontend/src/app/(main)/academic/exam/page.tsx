"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Timer,
  Plus,
  Calendar,
  MapPin,
  Clock,
  Trash2,
  X,
  Loader2,
  Sparkles,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getExams,
  createExam,
  deleteExam,
  getReviewPlan,
  type Exam,
  type ExamCreate,
  type ReviewPlanOptions,
} from "@/lib/exam";
import { getKnowledgeBases, type KnowledgeBase } from "@/lib/rag";

const EXAM_TYPE_BADGE: Record<string, string> = {
  期末考试: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  期中考试: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  随堂测试: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  补考: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

function getDaysColor(days: number): string {
  if (days <= 3) return "text-red-600 dark:text-red-400";
  if (days <= 7) return "text-orange-600 dark:text-orange-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function getDaysBg(days: number): string {
  if (days <= 3) return "bg-red-500/10";
  if (days <= 7) return "bg-orange-500/10";
  return "bg-emerald-500/10";
}

export default function ExamPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [newCourseName, setNewCourseName] = useState("");
  const [newExamDate, setNewExamDate] = useState("");
  const [newExamTime, setNewExamTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newExamType, setNewExamType] = useState("期末考试");
  const [newNotes, setNewNotes] = useState("");

  // Review plan
  const [reviewPlanLoading, setReviewPlanLoading] = useState<number | null>(null);
  const [reviewPlans, setReviewPlans] = useState<Record<number, string>>({});
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [reviewPlanKbId, setReviewPlanKbId] = useState<number | "">("");
  const [reviewDailyHours, setReviewDailyHours] = useState(3);
  const [reviewIntensity, setReviewIntensity] = useState<"light" | "standard" | "sprint">("standard");

  const fetchExams = useCallback(async () => {
    try {
      const data = await getExams();
      setExams(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  useEffect(() => {
    getKnowledgeBases()
      .then(setKnowledgeBases)
      .catch(() => setKnowledgeBases([]));
  }, []);

  async function addExam() {
    if (!newCourseName || !newExamDate) return;
    setSubmitting(true);
    try {
      const payload: ExamCreate = {
        course_name: newCourseName,
        exam_date: newExamDate,
        exam_time: newExamTime || undefined,
        location: newLocation || undefined,
        exam_type: newExamType,
        notes: newNotes || undefined,
      };
      const created = await createExam(payload);
      setExams([...exams, created]);
      setNewCourseName("");
      setNewExamDate("");
      setNewExamTime("");
      setNewLocation("");
      setNewExamType("期末考试");
      setNewNotes("");
      setShowAdd(false);
    } catch {
      // TODO: toast error
    } finally {
      setSubmitting(false);
    }
  }

  async function removeExam(id: number) {
    try {
      await deleteExam(id);
      setExams(exams.filter((e) => e.id !== id));
    } catch {
      // TODO: toast error
    }
  }

  async function generateReviewPlan(examId: number) {
    setReviewPlanLoading(examId);
    try {
      const options: ReviewPlanOptions = {
        daily_hours: reviewDailyHours,
        intensity: reviewIntensity,
      };
      if (reviewPlanKbId) {
        options.kb_id = reviewPlanKbId;
      }

      const result = await getReviewPlan(examId, options);
      const sourceText = result.sources?.length
        ? `\n\n**参考资料**\n${result.sources
            .map((source) => `- ${source.filename || "未知文件"}`)
            .join("\n")}`
        : "";
      if (sourceText) {
        setReviewPlans((prev) => ({ ...prev, [examId]: `${result.plan}${sourceText}` }));
      } else {
        setReviewPlans((prev) => ({ ...prev, [examId]: result.plan }));
      }
    } catch {
      setReviewPlans((prev) => ({ ...prev, [examId]: "生成复习计划失败，请稍后重试。" }));
    } finally {
      setReviewPlanLoading(null);
    }
  }

  const upcomingCount = exams.filter((e) => e.days_remaining >= 0).length;
  const urgentCount = exams.filter((e) => e.days_remaining >= 0 && e.days_remaining <= 3).length;

  const sorted = [...exams]
    .filter((e) => e.days_remaining >= 0)
    .sort((a, b) => a.days_remaining - b.days_remaining);

  const pastExams = exams.filter((e) => e.days_remaining < 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
            <Timer className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">考试倒计时</h1>
            <p className="text-xs text-muted-foreground">
              {upcomingCount} 场考试{urgentCount > 0 && `，${urgentCount} 场即将开始`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? "取消" : "添加考试"}
        </Button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="space-y-3">
            <Input
              placeholder="课程名称（如：高等数学）"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              className="h-10"
            />
            <div className="flex gap-2">
              <Input
                type="date"
                value={newExamDate}
                onChange={(e) => setNewExamDate(e.target.value)}
                className="h-10 flex-1"
              />
              <Input
                type="time"
                placeholder="考试时间"
                value={newExamTime}
                onChange={(e) => setNewExamTime(e.target.value)}
                className="h-10 w-36"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="考试地点（选填）"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="h-10 flex-1"
              />
              <Input
                placeholder="备注（选填）"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="h-10 flex-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {["期末考试", "期中考试", "随堂测试", "补考"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewExamType(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      newExamType === t
                        ? (EXAM_TYPE_BADGE[t] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300") + " ring-1 ring-current/20"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={addExam} disabled={!newCourseName || !newExamDate || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认添加"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Plan Settings */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold">复习计划设置</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1fr]">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">关联知识库</span>
            <select
              value={reviewPlanKbId}
              onChange={(e) => setReviewPlanKbId(e.target.value ? Number(e.target.value) : "")}
              className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm"
            >
              <option value="">不关联知识库</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}（{kb.document_count} 个文件）
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">每日小时</span>
            <Input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={reviewDailyHours}
              onChange={(e) => setReviewDailyHours(Number(e.target.value) || 3)}
              className="h-10"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">复习强度</span>
            <select
              value={reviewIntensity}
              onChange={(e) => setReviewIntensity(e.target.value as "light" | "standard" | "sprint")}
              className="h-10 w-full rounded-lg border border-border/50 bg-background px-3 text-sm"
            >
              <option value="light">轻量</option>
              <option value="standard">标准</option>
              <option value="sprint">冲刺</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          选择知识库后，复习计划只会基于该知识库中已上传的课件和资料生成。
        </p>
      </div>

      {/* Exam List */}
      <div className="space-y-3">
        {sorted.length === 0 && pastExams.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <BookOpen className="mx-auto h-12 w-12 text-emerald-500/30" />
            <p className="mt-4 text-muted-foreground">暂无考试安排</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              点击&ldquo;添加考试&rdquo;开始记录
            </p>
          </div>
        ) : (
          <>
            {sorted.map((exam) => {
              const days = exam.days_remaining;
              const typeBadge = EXAM_TYPE_BADGE[exam.exam_type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
              return (
                <div
                  key={exam.id}
                  className="group rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] transition-all dark:bg-gray-900 dark:ring-white/[0.06]"
                >
                  <div className="flex items-start gap-4 p-4">
                    {/* Days remaining */}
                    <div className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl ${getDaysBg(days)}`}>
                      <span className={`text-2xl font-bold ${getDaysColor(days)}`}>
                        {days}
                      </span>
                      <span className={`text-[10px] font-medium ${getDaysColor(days)}`}>
                        {days === 0 ? "今天" : "天"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{exam.course_name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge}`}>
                          {exam.exam_type}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(exam.exam_date).toLocaleDateString("zh-CN", {
                            month: "long",
                            day: "numeric",
                            weekday: "short",
                          })}
                        </span>
                        {exam.exam_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.exam_time}
                          </span>
                        )}
                        {exam.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {exam.location}
                          </span>
                        )}
                      </div>
                      {exam.notes && (
                        <p className="mt-1 text-xs text-muted-foreground/70">{exam.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {days <= 3 && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <button
                        onClick={() => removeExam(exam.id)}
                        className="hidden rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-500 group-hover:block"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Review Plan Section */}
                  <div className="border-t border-border/30 px-4 py-2.5">
                    {reviewPlans[exam.id] ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                          <Sparkles className="h-3 w-3" />
                          AI 复习计划
                        </div>
                        <div className="rounded-lg bg-purple-500/5 p-3 text-xs leading-relaxed text-foreground/80">
                          <div className="prose prose-xs dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {reviewPlans[exam.id]}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateReviewPlan(exam.id)}
                        disabled={reviewPlanLoading === exam.id}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-500/10 disabled:opacity-50 dark:text-purple-400"
                      >
                        {reviewPlanLoading === exam.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        生成 AI 复习计划
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Past exams */}
            {pastExams.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 px-1 text-xs font-medium text-muted-foreground/60">
                  已结束的考试
                </p>
                {pastExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="group flex items-center gap-3 rounded-xl bg-white p-3 opacity-50 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-through">{exam.course_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(exam.exam_date).toLocaleDateString("zh-CN")} - {exam.exam_type}
                      </p>
                    </div>
                    <button
                      onClick={() => removeExam(exam.id)}
                      className="hidden rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-500 group-hover:block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
