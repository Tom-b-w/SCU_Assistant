"use client";

import {
  CalendarDays,
  BookOpen,
  UtensilsCrossed,
  Bus,
  Clock,
  Sparkles,
  TrendingUp,
  CloudSun,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";

const todaySchedule = [
  { time: "08:00", name: "高等数学 (A)", room: "一教 B305", color: "bg-blue-500" },
  { time: "10:10", name: "数据结构", room: "二教 C201", color: "bg-emerald-500" },
  { time: "14:00", name: "计算机网络", room: "三教 A108", color: "bg-purple-500" },
];

const deadlines = [
  { name: "操作系统实验报告", due: "明天 23:59", urgent: true },
  { name: "英语作文 Unit 5", due: "3天后", urgent: false },
  { name: "离散数学作业 #8", due: "5天后", urgent: false },
];

const quickStats = [
  { label: "今日课程", value: "3节", icon: CalendarDays, color: "from-blue-500 to-blue-600", href: "/academic/schedule" },
  { label: "待办DDL", value: "3项", icon: BookOpen, color: "from-orange-500 to-red-500", href: "/academic/deadline" },
  { label: "食堂营业", value: "4/6", icon: UtensilsCrossed, color: "from-rose-500 to-pink-500", href: "/food/canteen" },
  { label: "下班校车", value: "17:30", icon: Bus, color: "from-cyan-500 to-blue-500", href: "/campus/bus" },
];

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#C41230] to-[#E8173A] p-6 text-white shadow-lg shadow-[#C41230]/20 md:p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/70">
            <CloudSun className="h-4 w-4" />
            <span className="text-sm">成都 · 22°C · 多云</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">
            {greeting}，{user?.name || "同学"} 👋
          </h2>
          <p className="mt-1 text-sm text-white/70">
            今天是星期一，你有 3 节课。第一节课 08:00 在一教 B305。
          </p>
          <Link
            href="/chat"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white/25"
          >
            <Sparkles className="h-4 w-4" />
            问 AI：今天我需要注意什么？
          </Link>
        </div>
        {/* Decorative */}
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

      {/* Two column layout */}
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
              查看全部
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {todaySchedule.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                <div className={`h-10 w-1 rounded-full ${item.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.room}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {item.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deadlines */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                <BookOpen className="h-4 w-4 text-orange-500" />
              </div>
              <h3 className="font-semibold">DDL 追踪</h3>
            </div>
            <Link href="/academic/deadline" className="text-xs text-primary hover:underline">
              查看全部
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {deadlines.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${item.urgent ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                  <p className="text-sm font-medium">{item.name}</p>
                </div>
                <span className={`text-xs font-medium ${item.urgent ? "text-red-500" : "text-muted-foreground"}`}>
                  {item.due}
                </span>
              </div>
            ))}
          </div>
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
            "根据你的课表，建议 12:00 去江安二食堂（人流较少），下午带伞（有小雨）"
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
