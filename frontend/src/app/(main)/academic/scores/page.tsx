"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getScores,
  getPlanCompletion,
  type Score,
  type PlanCompletion,
} from "@/lib/academic";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  Target,
  ArrowUpDown,
  ChevronDown,
  GraduationCap,
  TrendingUp,
  Award,
  Hash,
} from "lucide-react";

type SortKey = "score" | "gpa" | "credit";
type SortDirection = "asc" | "desc";

function deriveGrade(score: string): string {
  const n = parseFloat(score);
  if (isNaN(n)) return score; // non-numeric scores like "优秀", "通过"
  if (n >= 95) return "A+";
  if (n >= 90) return "A";
  if (n >= 85) return "A-";
  if (n >= 80) return "B+";
  if (n >= 75) return "B";
  if (n >= 70) return "B-";
  if (n >= 65) return "C+";
  if (n >= 60) return "C";
  if (n >= 55) return "D";
  return "F";
}

function scoreColor(score: string): string {
  const n = parseFloat(score);
  if (isNaN(n)) return "text-foreground";
  if (n >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (n >= 60) return "text-foreground";
  return "text-red-500 dark:text-red-400";
}

function scoreDotColor(score: string): string {
  const n = parseFloat(score);
  if (isNaN(n)) return "bg-emerald-500";
  if (n >= 90) return "bg-emerald-500";
  if (n >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function scoreBgColor(score: string): string {
  const n = parseFloat(score);
  if (isNaN(n)) return "bg-emerald-500/10";
  if (n >= 90) return "bg-emerald-500/10";
  if (n >= 60) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

export default function ScoresPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [planCompletion, setPlanCompletion] = useState<PlanCompletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [semesterDropdownOpen, setSemesterDropdownOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [scoresData, planData] = await Promise.all([
          getScores(),
          getPlanCompletion(),
        ]);
        setScores(scoresData.scores);
        setPlanCompletion(planData);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: { code?: string } } } };
        if (axiosErr?.response?.data?.error?.code === "SESSION_EXPIRED") {
          return;
        }
        setError("获取成绩数据失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Extract unique semesters
  const semesters = useMemo(() => {
    const set = new Set(scores.map((s) => s.semester));
    return Array.from(set).sort().reverse();
  }, [scores]);

  // Filter by semester
  const filteredScores = useMemo(() => {
    return selectedSemester === "all"
      ? scores
      : scores.filter((s) => s.semester === selectedSemester);
  }, [scores, selectedSemester]);

  // Compute summary stats based on filtered scores (dynamic per semester)
  const filteredCredits = useMemo(
    () => filteredScores.reduce((sum, s) => sum + s.credit, 0),
    [filteredScores]
  );

  const filteredWeightedAvg = useMemo(() => {
    if (filteredCredits === 0) return "--";
    const weightedSum = filteredScores.reduce((sum, s) => {
      const n = parseFloat(s.score);
      return sum + (isNaN(n) ? 0 : n * s.credit);
    }, 0);
    return (weightedSum / filteredCredits).toFixed(1);
  }, [filteredScores, filteredCredits]);

  const filteredAvgGpa = useMemo(() => {
    if (filteredCredits === 0) return "--";
    const gpaSum = filteredScores.reduce((sum, s) => sum + s.gpa * s.credit, 0);
    return (gpaSum / filteredCredits).toFixed(2);
  }, [filteredScores, filteredCredits]);

  // Filter and sort for display
  const displayScores = useMemo(() => {
    const sorted = [...filteredScores];

    if (sortKey) {
      sorted.sort((a, b) => {
        let valA: number, valB: number;
        if (sortKey === "score") {
          valA = parseFloat(a.score) || 0;
          valB = parseFloat(b.score) || 0;
        } else if (sortKey === "gpa") {
          valA = a.gpa;
          valB = b.gpa;
        } else {
          valA = a.credit;
          valB = b.credit;
        }
        return sortDir === "desc" ? valB - valA : valA - valB;
      });
    }

    return sorted;
  }, [filteredScores, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Credit progress — only show percentage if we have real required credits
  const hasRequiredCredits = planCompletion && planCompletion.total_required_credits > 0;
  const creditProgress = hasRequiredCredits
    ? Math.min(100, Math.round((planCompletion.earned_credits / planCompletion.total_required_credits) * 100))
    : 0;

  const BAR_COLORS = [
    "from-blue-400 to-blue-500",
    "from-purple-400 to-purple-500",
    "from-orange-400 to-orange-500",
    "from-pink-400 to-pink-500",
    "from-cyan-400 to-cyan-500",
    "from-emerald-400 to-emerald-500",
  ];

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">正在从教务系统获取成绩...</span>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C41230]/10">
            <BookOpen className="h-5 w-5 text-[#C41230]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">成绩查询</h1>
            <p className="text-xs text-muted-foreground">
              查看全部课程成绩与学分完成进度
            </p>
          </div>
        </div>
        {scores.length > 0 && (
          <span className="rounded-full bg-[#C41230]/10 px-3 py-1 text-xs font-medium text-[#C41230]">
            共 {scores.length} 门课
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary Stats — dynamic per selected semester */}
      {scores.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            {
              label: selectedSemester === "all" ? "总学分" : "学期学分",
              value: filteredCredits.toString(),
              icon: Award,
              color: "from-orange-500 to-red-500",
            },
            {
              label: "加权均分",
              value: filteredWeightedAvg,
              icon: TrendingUp,
              color: "from-emerald-500 to-green-600",
            },
            {
              label: "平均绩点",
              value: filteredAvgGpa,
              icon: GraduationCap,
              color: "from-cyan-500 to-blue-500",
            },
            {
              label: selectedSemester === "all" ? "课程总数" : "学期课程数",
              value: filteredScores.length.toString(),
              icon: Hash,
              color: "from-purple-500 to-indigo-500",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-md dark:bg-gray-900 dark:ring-white/[0.06]"
              >
                <div
                  className={`inline-flex rounded-lg bg-gradient-to-br ${stat.color} p-2.5 text-white shadow-sm`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Credit Statistics with per-category required/earned progress */}
      {planCompletion && planCompletion.categories.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="font-semibold">学分完成进度</h3>
            </div>
            {hasRequiredCredits && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                总进度 {creditProgress}%
              </span>
            )}
          </div>
          <div className="mt-4 space-y-4">
            {/* Total progress */}
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted-foreground">已修总学分</span>
                <span className="font-medium">
                  {planCompletion.earned_credits}
                  {hasRequiredCredits ? ` / ${planCompletion.total_required_credits}` : " 学分"}
                </span>
              </div>
              {hasRequiredCredits && (
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500"
                    style={{ width: `${creditProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Per-category: show earned/required progress */}
            <div className="grid gap-3 md:grid-cols-2">
              {planCompletion.categories.map((cat, i) => {
                const catHasRequired = cat.required_credits > 0;
                const catProgress = catHasRequired
                  ? Math.min(100, Math.round((cat.earned_credits / cat.required_credits) * 100))
                  : 0;
                const isComplete = catHasRequired && cat.earned_credits >= cat.required_credits;
                return (
                  <div
                    key={i}
                    className="rounded-lg bg-muted/20 p-3 transition-colors dark:bg-muted/10"
                  >
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-muted-foreground">
                        {cat.earned_credits}
                        {catHasRequired ? ` / ${cat.required_credits} 学分` : " 学分"}
                        {isComplete && (
                          <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">已达标</span>
                        )}
                      </span>
                    </div>
                    {catHasRequired ? (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${
                            isComplete
                              ? "from-emerald-400 to-emerald-500"
                              : BAR_COLORS[i % BAR_COLORS.length]
                          } transition-all duration-500`}
                          style={{ width: `${catProgress}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-500`}
                          style={{ width: `${planCompletion.earned_credits > 0 ? Math.round((cat.earned_credits / planCompletion.earned_credits) * 100) : 0}%` }}
                        />
                      </div>
                    )}
                    {catHasRequired && (
                      <p className="mt-1 text-right text-[10px] text-muted-foreground">
                        {catProgress}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Scores Table */}
      {scores.length === 0 && !error ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">暂无成绩数据</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            成绩将在教务系统发布后同步
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          {/* Toolbar: semester filter + sort buttons */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-3">
            {/* Semester filter */}
            <div className="relative">
              <button
                onClick={() => setSemesterDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60"
              >
                {selectedSemester === "all" ? "全部学期" : selectedSemester}
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${semesterDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {semesterDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSemesterDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border/50 bg-white py-1 shadow-lg dark:bg-gray-900">
                    <button
                      onClick={() => {
                        setSelectedSemester("all");
                        setSemesterDropdownOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                        selectedSemester === "all"
                          ? "bg-[#C41230]/5 font-semibold text-[#C41230]"
                          : ""
                      }`}
                    >
                      全部学期
                      {selectedSemester === "all" && (
                        <span className="ml-2 text-[10px] opacity-60">({scores.length} 门)</span>
                      )}
                    </button>
                    {semesters.map((sem) => {
                      const semCount = scores.filter((s) => s.semester === sem).length;
                      return (
                        <button
                          key={sem}
                          onClick={() => {
                            setSelectedSemester(sem);
                            setSemesterDropdownOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 ${
                            selectedSemester === sem
                              ? "bg-[#C41230]/5 font-semibold text-[#C41230]"
                              : ""
                          }`}
                        >
                          {sem}
                          <span className="ml-2 text-[10px] opacity-60">({semCount} 门)</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="mx-1 h-4 w-px bg-border/40" />

            {/* Sort buttons */}
            <span className="text-xs text-muted-foreground">排序:</span>
            {(
              [
                { key: "score" as SortKey, label: "成绩" },
                { key: "gpa" as SortKey, label: "绩点" },
                { key: "credit" as SortKey, label: "学分" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => handleSort(item.key)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  sortKey === item.key
                    ? "bg-[#C41230]/10 text-[#C41230]"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {item.label}
                <ArrowUpDown className="h-3 w-3" />
                {sortKey === item.key && (
                  <span className="text-[10px]">
                    {sortDir === "desc" ? "↓" : "↑"}
                  </span>
                )}
              </button>
            ))}

            <span className="ml-auto text-xs text-muted-foreground">
              显示 {displayScores.length} 门
            </span>
          </div>

          {/* Table header — desktop only */}
          <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b border-border/20">
            <span className="col-span-3">课程名称</span>
            <span className="col-span-2">学期</span>
            <span className="col-span-1 text-center">类型</span>
            <span className="col-span-1 text-center">学分</span>
            <span className="col-span-1 text-center">绩点</span>
            <span className="col-span-2 text-center">成绩</span>
            <span className="col-span-2 text-right">等级</span>
          </div>

          {/* Table body */}
          <div className="divide-y divide-border/10">
            {displayScores.map((item, i) => {
              const grade = deriveGrade(item.score);
              return (
                <div
                  key={i}
                  className="group px-4 py-2.5 transition-colors hover:bg-muted/30"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid md:grid-cols-12 gap-2 items-center">
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${scoreDotColor(item.score)}`}
                      />
                      <span className="text-sm font-medium truncate">
                        {item.course_name}
                      </span>
                    </div>
                    <span className="col-span-2 text-xs text-muted-foreground truncate">
                      {item.semester}
                    </span>
                    <span className="col-span-1 text-center text-xs text-muted-foreground">
                      {item.course_type}
                    </span>
                    <span className="col-span-1 text-center text-xs">
                      {item.credit}
                    </span>
                    <span className="col-span-1 text-center text-xs">
                      {item.gpa}
                    </span>
                    <span
                      className={`col-span-2 text-center text-sm font-semibold ${scoreColor(item.score)}`}
                    >
                      {item.score}
                    </span>
                    <span
                      className={`col-span-2 text-right text-xs font-medium ${scoreColor(item.score)}`}
                    >
                      {grade}
                    </span>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`h-2 w-2 shrink-0 rounded-full mt-1.5 ${scoreDotColor(item.score)}`}
                        />
                        <div className="min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {item.course_name}
                          </span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span>{item.semester}</span>
                            <span className="rounded bg-muted/50 px-1.5 py-0.5">{item.course_type}</span>
                            <span>{item.credit} 学分</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={`text-lg font-bold leading-tight ${scoreColor(item.score)}`}
                        >
                          {item.score}
                        </span>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                          <span className="text-muted-foreground">
                            绩点 {item.gpa}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${scoreBgColor(item.score)} ${scoreColor(item.score)}`}
                          >
                            {grade}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {displayScores.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              该学期暂无成绩
            </div>
          )}
        </div>
      )}
    </div>
  );
}
