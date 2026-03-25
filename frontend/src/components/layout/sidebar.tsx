"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  Bus,
  UtensilsCrossed,
  MessageSquare,
  Settings,
  LayoutDashboard,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Calendar,
  Timer,
  FileQuestion,
  CloudSun,
  Bell,
  Newspaper,
} from "lucide-react";

const navGroups = [
  {
    label: "核心",
    items: [
      { href: "/", label: "仪表盘", icon: LayoutDashboard, color: "text-blue-500", bg: "bg-blue-500/10", activeBg: "bg-blue-500" },
      { href: "/chat", label: "AI 问答", icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-500/10", activeBg: "bg-purple-500" },
    ],
  },
  {
    label: "学业",
    items: [
      { href: "/academic/schedule", label: "课程表", icon: CalendarDays, color: "text-emerald-500", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500" },
      { href: "/academic/scores", label: "成绩查询", icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10", activeBg: "bg-amber-500" },
      { href: "/academic/deadline", label: "DDL 追踪", icon: BookOpen, color: "text-orange-500", bg: "bg-orange-500/10", activeBg: "bg-orange-500" },
      { href: "/academic/exam", label: "考试倒计时", icon: Timer, color: "text-red-500", bg: "bg-red-500/10", activeBg: "bg-red-500" },
      { href: "/academic/rag", label: "课件问答", icon: FileQuestion, color: "text-violet-500", bg: "bg-violet-500/10", activeBg: "bg-violet-500" },
    ],
  },
  {
    label: "校园",
    items: [
      { href: "/food/canteen", label: "食堂导航", icon: UtensilsCrossed, color: "text-rose-500", bg: "bg-rose-500/10", activeBg: "bg-rose-500" },
      { href: "/campus/bus", label: "校车时刻", icon: Bus, color: "text-cyan-500", bg: "bg-cyan-500/10", activeBg: "bg-cyan-500" },
      { href: "/campus/calendar", label: "校历", icon: Calendar, color: "text-indigo-500", bg: "bg-indigo-500/10", activeBg: "bg-indigo-500" },
      { href: "/weather", label: "天气穿衣", icon: CloudSun, color: "text-sky-500", bg: "bg-sky-500/10", activeBg: "bg-sky-500" },
      { href: "/notification", label: "校园通知", icon: Bell, color: "text-pink-500", bg: "bg-pink-500/10", activeBg: "bg-pink-500" },
      { href: "/dashboard", label: "每日简报", icon: Newspaper, color: "text-teal-500", bg: "bg-teal-500/10", activeBg: "bg-teal-500" },
    ],
  },
  {
    label: "工具",
    items: [
      { href: "/settings", label: "设置", icon: Settings, color: "text-gray-500", bg: "bg-gray-500/10", activeBg: "bg-gray-500" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-[260px] md:flex-col border-r border-border/40 bg-gradient-to-b from-white via-white to-gray-50/50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900/50">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/40 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#C41230] to-[#E8173A] shadow-md shadow-[#C41230]/20">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">SCU Assistant</h1>
          <p className="text-[10px] text-muted-foreground leading-none">智能校园助手</p>
        </div>
      </div>

      {/* AI Quick Entry - animated gradient border */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/chat"
          className="group/ai relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-purple-700 transition-all hover:shadow-md dark:text-purple-300"
        >
          {/* Animated gradient border background */}
          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 bg-[length:200%_100%] opacity-[0.12] transition-opacity group-hover/ai:opacity-[0.2] animate-[shimmer_3s_ease-in-out_infinite]" />
          <span className="absolute inset-[1px] rounded-[11px] bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-violet-500/5 dark:from-purple-500/10 dark:via-blue-500/10 dark:to-violet-500/10" />
          {/* Ring border effect */}
          <span className="absolute inset-0 rounded-xl ring-1 ring-purple-500/20 transition-all group-hover/ai:ring-purple-500/30" />
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-sm shadow-purple-500/20">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="relative">问 AI 任何问题...</span>
          <span className="relative ml-auto rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400 dark:text-purple-300">
            AI
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 scrollbar-thin">
        {navGroups.map((group, groupIndex) => (
          <div key={group.label}>
            {/* Section label */}
            <p className={cn(
              "px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50",
              groupIndex === 0 ? "mb-1.5 mt-2" : "mb-1.5 mt-3"
            )}>
              {group.label}
            </p>

            {/* Section items */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-gray-100 to-gray-50 text-foreground shadow-sm ring-1 ring-black/[0.04] dark:from-gray-800/80 dark:to-gray-800/40 dark:ring-white/[0.06]"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                      isActive
                        ? `${item.activeBg} text-white shadow-sm`
                        : `${item.bg} ${item.color} group-hover:shadow-sm`
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      "transition-colors duration-200",
                      isActive && "font-semibold"
                    )}>
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Divider between groups (not after last) */}
            {groupIndex < navGroups.length - 1 && (
              <div className="mx-3 mt-2.5 border-t border-border/30 dark:border-border/20" />
            )}
          </div>
        ))}
      </nav>

      {/* Bottom card */}
      <div className="border-t border-border/40 px-3 py-3">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#C41230]/[0.06] via-[#D4A843]/[0.04] to-[#C41230]/[0.06] px-3.5 py-3 ring-1 ring-[#C41230]/[0.08] dark:from-[#C41230]/[0.1] dark:via-[#D4A843]/[0.06] dark:to-[#C41230]/[0.1] dark:ring-[#C41230]/[0.12]">
          {/* Subtle decorative element */}
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-[#D4A843]/[0.08] blur-xl" />
          <div className="absolute -left-2 -bottom-2 h-12 w-12 rounded-full bg-[#C41230]/[0.06] blur-lg" />
          <div className="relative flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#C41230]/10 to-[#D4A843]/10">
              <GraduationCap className="h-4 w-4 text-[#C41230] dark:text-[#E8173A]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#C41230] dark:text-[#E8173A]">四川大学</p>
              <p className="text-[10px] text-muted-foreground">Since 1896 · 海纳百川</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
