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

  // Compute summary stats
  const totalCredits = useMemo(
    () => scores.reduce((sum, s) => sum + s.credit, 0),
    [scores]
  );

  const weightedAvg = useMemo(() => {
    if (totalCredits === 0) return "--";
    const weightedSum = scores.reduce((sum, s) => {
      const n = parseFloat(s.score);
      return sum + (isNaN(n) ? 0 : n * s.credit);
    }, 0);
    return (weightedSum / totalCredits).toFixed(1);
  }, [scores, totalCredits]);

  const avgGpa = useMemo(() => {
    if (totalCredits === 0) return "--";
    const gpaSum = scores.reduce((sum, s) => sum + s.gpa * s.credit, 0);
    return (gpaSum / totalCredits).toFixed(2);
  }, [scores, totalCredits]);

  // Extract unique semesters
  const semesters = useMemo(() => {
    const set = new Set(scores.map((s) => s.semester));
    return Array.from(set).sort().reverse();
  }, [scores]);

  // Filter and sort
  const displayScores = useMemo(() => {
    let filtered =
      selectedSemester === "all"
        ? [...scores]
        : scores.filter((s) => s.semester === selectedSemester);

    if (sortKey) {
      filtered.sort((a, b) => {
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

    return filtered;
  }, [scores, selectedSemester, sortKey, sortDir]);

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

      {/* Summary Stats */}
      {scores.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[
            {
              label: "总学分",
              value: totalCredits.toString(),
              icon: Award,
              color: "from-orange-500 to-red-500",
            },
            {
              label: "加权均分",
              value: weightedAvg,
              icon: TrendingUp,
              color: "from-emerald-500 to-green-600",
            },
            {
              label: "平均绩点",
              value: avgGpa,
              icon: GraduationCap,
              color: "from-cyan-500 to-blue-500",
            },
            {
              label: "课程总数",
              value: scores.length.toString(),
              icon: Hash,
              color: "from-purple-500 to-indigo-500",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
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

      {/* Credit Statistics */}
      {planCompletion && planCompletion.categories.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="font-semibold">已修学分统计</h3>
            </div>
            {hasRequiredCredits && (
              <span className="text-xs text-muted-foreground">
                {creditProgress}%
              </span>
            )}
          </div>
          <div className="mt-4 space-y-4">
            {/* Total */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
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

            {/* Per-category */}
            <div className="grid gap-3 md:grid-cols-2">
              {planCompletion.categories.map((cat, i) => {
                const barWidth = planCompletion.earned_credits > 0
                  ? Math.round((cat.earned_credits / planCompletion.earned_credits) * 100)
                  : 0;
                return (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">{cat.name}</span>
                      <span className="font-medium">{cat.earned_credits} 学分</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
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
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
              {semesterDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSemesterDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-border/50 bg-white py-1 shadow-lg dark:bg-gray-900">
                    <button
                      onClick={() => {
                        setSelectedSemester("all");
                        setSemesterDropdownOpen(false);
                      }}
                      className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 ${
                        selectedSemester === "all"
                          ? "font-semibold text-[#C41230]"
                          : ""
                      }`}
                    >
                      全部学期
                    </button>
                    {semesters.map((sem) => (
                      <button
                        key={sem}
                        onClick={() => {
                          setSelectedSemester(sem);
                          setSemesterDropdownOpen(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 ${
                          selectedSemester === sem
                            ? "font-semibold text-[#C41230]"
                            : ""
                        }`}
                      >
                        {sem}
                      </button>
                    ))}
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

          {/* Table header */}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`h-2 w-2 shrink-0 rounded-full ${scoreDotColor(item.score)}`}
                        />
                        <span className="text-sm font-medium truncate">
                          {item.course_name}
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold ${scoreColor(item.score)}`}
                      >
                        {item.score}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 pl-4 text-xs text-muted-foreground">
                      <span>{item.semester}</span>
                      <span>{item.course_type}</span>
                      <span>{item.credit} 学分</span>
                      <span>绩点 {item.gpa}</span>
                      <span className={scoreColor(item.score)}>{grade}</span>
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
