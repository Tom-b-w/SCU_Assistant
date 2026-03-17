"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  BookOpen,
  Clock,
  Sparkles,
  TrendingUp,
  CloudSun,
  GraduationCap,
  ArrowRight,
  Loader2,
  AlertCircle,
  Target,
  Award,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import {
  getSchedule,
  getScores,
  getPlanCompletion,
  type Course,
  type Score,
  type PlanCompletion,
} from "@/lib/academic";

const WEEKDAY_NAMES = ["", "一", "二", "三", "四", "五", "六", "日"];
const SECTION_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
];

function sectionToTime(section: number): string {
  const map: Record<number, string> = {
    1: "08:00", 2: "08:55", 3: "10:10", 4: "11:05",
    5: "14:00", 6: "14:55", 7: "16:10", 8: "17:05",
    9: "19:00", 10: "19:55", 11: "20:50",
  };
  return map[section] || `第${section}节`;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  const todayWeekday = new Date().getDay() || 7;

  const [courses, setCourses] = useState<Course[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [planCompletion, setPlanCompletion] = useState<PlanCompletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [scheduleData, scoresData, planData] = await Promise.all([
          getSchedule(),
          getScores(),
          getPlanCompletion(),
        ]);
        setCourses(scheduleData.courses);
        setScores(scoresData.scores);
        setPlanCompletion(planData);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: { code?: string } } } };
        if (axiosErr?.response?.data?.error?.code === "SESSION_EXPIRED") {
          // 拦截器会自动跳转登录页，这里不需要额外处理
          return;
        }
        setError("获取教务数据失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isAuthenticated]);

  const todayCourses = courses.filter((c) => c.weekday === todayWeekday);
  const totalCredits = scores.reduce((sum, s) => sum + s.credit, 0);
  const weightedSum = scores.reduce((sum, s) => {
    const n = parseFloat(s.score);
    return sum + (isNaN(n) ? 0 : n * s.credit);
  }, 0);
  const avgScore = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(1) : "--";
  const avgGpa = scores.length > 0
    ? (scores.reduce((sum, s) => sum + s.gpa * s.credit, 0) / totalCredits).toFixed(2)
    : "--";

  const hasRequiredCredits = planCompletion && planCompletion.total_required_credits > 0;
  const creditProgress = hasRequiredCredits
    ? Math.min(100, Math.round((planCompletion.earned_credits / planCompletion.total_required_credits) * 100))
    : 0;

  const earnedCreditsDisplay = loading
    ? "..."
    : planCompletion
      ? hasRequiredCredits
        ? `${planCompletion.earned_credits}/${planCompletion.total_required_credits}`
        : `${planCompletion.earned_credits}`
      : `${totalCredits}`;

  const quickStats = [
    { label: "今日课程", value: loading ? "..." : `${todayCourses.length}节`, icon: CalendarDays, color: "from-blue-500 to-blue-600", href: "/academic/schedule" },
    { label: "已修学分", value: earnedCreditsDisplay, icon: Award, color: "from-orange-500 to-red-500", href: "/academic/scores" },
    { label: "加权均分", value: loading ? "..." : avgScore, icon: TrendingUp, color: "from-emerald-500 to-green-600", href: "/academic/scores" },
    { label: "平均绩点", value: loading ? "..." : avgGpa, icon: GraduationCap, color: "from-cyan-500 to-blue-500", href: "/academic/scores" },
  ];

  const firstCourseInfo = todayCourses.length > 0
    ? `第一节课 ${sectionToTime(todayCourses[0].start_section)} 在 ${todayCourses[0].location}。`
    : "今天没有课，好好休息！";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#C41230] to-[#E8173A] p-6 text-white shadow-lg shadow-[#C41230]/20 md:p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/70">
            <CloudSun className="h-4 w-4" />
            <span className="text-sm">成都 · 多云</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">
            {greeting}，{user?.name || "同学"}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            今天是星期{WEEKDAY_NAMES[todayWeekday]}，你有 {todayCourses.length} 节课。{firstCourseInfo}
          </p>
          <Link
            href="/chat"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/25"
          >
            <Sparkles className="h-4 w-4" />
            问 AI：今天我需要注意什么？
          </Link>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-5 right-20 h-24 w-24 rounded-full bg-[#D4A843]/20 blur-xl" />
        <GraduationCap className="absolute right-6 top-6 h-20 w-20 text-white/10 md:h-28 md:w-28" />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 dark:ring-white/[0.06]"
            >
              <div className={`inline-flex rounded-lg bg-gradient-to-br ${stat.color} p-2.5 text-white shadow-sm`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
            </Link>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Today's Schedule */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <CalendarDays className="h-4 w-4 text-blue-500" />
              </div>
              <h3 className="font-semibold">今日课程</h3>
            </div>
            <Link href="/academic/schedule" className="text-xs text-primary hover:underline">
              完整课表
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在从教务系统获取...
              </div>
            ) : todayCourses.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                今天没有课程
              </div>
            ) : (
              todayCourses
                .sort((a, b) => a.start_section - b.start_section)
                .map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                    <div className={`h-10 w-1 rounded-full ${SECTION_COLORS[i % SECTION_COLORS.length]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.course_name}</p>
                      <p className="text-xs text-muted-foreground">{item.location} · {item.teacher}</p>
                    </div>
                    <div className="flex flex-col items-end text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {sectionToTime(item.start_section)}
                      </div>
                      <span>第{item.start_section}-{item.end_section}节</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Credit Progress (已修学分统计) */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
              <h3 className="font-semibold">已修学分统计</h3>
            </div>
            {hasRequiredCredits && (
              <span className="text-xs text-muted-foreground">{creditProgress}%</span>
            )}
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在从教务系统获取...
              </div>
            ) : planCompletion ? (
              <div className="space-y-4">
                {/* 总学分 */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">已修总学分</span>
                    <span className="font-medium">
                      {planCompletion.earned_credits}
                      {hasRequiredCredits ? ` / ${planCompletion.total_required_credits}` : " 学分"}
                    </span>
                  </div>
                  {hasRequiredCredits && (
                    <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500"
                        style={{ width: `${creditProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 分类统计 */}
                {planCompletion.categories.map((cat, i) => {
                  const barColors = [
                    "from-blue-400 to-blue-500",
                    "from-purple-400 to-purple-500",
                    "from-orange-400 to-orange-500",
                    "from-pink-400 to-pink-500",
                    "from-cyan-400 to-cyan-500",
                  ];
                  // 无要求学分时，用占总学分的比例来展示柱状条
                  const barWidth = planCompletion.earned_credits > 0
                    ? Math.round((cat.earned_credits / planCompletion.earned_credits) * 100)
                    : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{cat.name}</span>
                        <span className="font-medium">{cat.earned_credits} 学分</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${barColors[i % barColors.length]} transition-all duration-500`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无方案完成数据
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Scores */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
              <BookOpen className="h-4 w-4 text-orange-500" />
            </div>
            <h3 className="font-semibold">成绩列表</h3>
            {!loading && scores.length > 0 && (
              <span className="text-xs text-muted-foreground">共 {scores.length} 门</span>
            )}
          </div>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在从教务系统获取...
            </div>
          ) : scores.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              暂无成绩数据
            </div>
          ) : (
            <div className="space-y-2">
              {/* 表头 */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-4">课程名称</span>
                <span className="col-span-2">学期</span>
                <span className="col-span-2 text-center">类型</span>
                <span className="col-span-1 text-center">学分</span>
                <span className="col-span-1 text-center">绩点</span>
                <span className="col-span-2 text-right">成绩</span>
              </div>
              {scores.map((item, i) => {
                const scoreNum = parseFloat(item.score);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50">
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${scoreNum >= 60 || isNaN(scoreNum) ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="text-sm font-medium truncate">{item.course_name}</span>
                    </div>
                    <span className="col-span-2 text-xs text-muted-foreground truncate">{item.semester}</span>
                    <span className="col-span-2 text-center text-xs text-muted-foreground">{item.course_type}</span>
                    <span className="col-span-1 text-center text-xs">{item.credit}</span>
                    <span className="col-span-1 text-center text-xs">{item.gpa}</span>
                    <span className={`col-span-2 text-right text-sm font-semibold ${
                      scoreNum >= 90 ? "text-emerald-600 dark:text-emerald-400" :
                      scoreNum >= 60 || isNaN(scoreNum) ? "text-foreground" :
                      "text-red-500"
                    }`}>
                      {item.score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Suggestion Banner */}
      <Link
        href="/chat"
        className="group flex items-center gap-4 rounded-xl bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-cyan-500/5 p-5 ring-1 ring-purple-500/10 transition-all hover:from-purple-500/10 hover:via-blue-500/10 hover:to-cyan-500/10 hover:shadow-sm"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-md shadow-purple-500/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">AI 智能助手</p>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">
            "根据你的课表和成绩分析，提供个性化学业建议"
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm text-primary">
          <TrendingUp className="h-4 w-4" />
          <span className="hidden sm:inline">开始对话</span>
        </div>
      </Link>
    </div>
  );
}
