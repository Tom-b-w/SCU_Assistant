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
} from "lucide-react";

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard, color: "text-blue-500" },
  { href: "/chat", label: "AI 问答", icon: MessageSquare, color: "text-purple-500" },
  { href: "/academic/schedule", label: "课程表", icon: CalendarDays, color: "text-emerald-500" },
  { href: "/academic/scores", label: "成绩查询", icon: TrendingUp, color: "text-amber-500" },
  { href: "/academic/deadline", label: "DDL 追踪", icon: BookOpen, color: "text-orange-500" },
  { href: "/food/canteen", label: "食堂导航", icon: UtensilsCrossed, color: "text-rose-500" },
  { href: "/campus/bus", label: "校车时刻", icon: Bus, color: "text-cyan-500" },
  { href: "/settings", label: "设置", icon: Settings, color: "text-gray-500" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-[260px] md:flex-col border-r border-border/50 bg-gradient-to-b from-white to-gray-50/80 dark:from-gray-950 dark:to-gray-900/80">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#C41230] to-[#E8173A] shadow-md shadow-[#C41230]/20">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">SCU Assistant</h1>
          <p className="text-[10px] text-muted-foreground leading-none">智能校园助手</p>
        </div>
      </div>

      {/* AI Quick Entry */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 px-3 py-2.5 text-sm font-medium text-purple-700 ring-1 ring-purple-500/10 transition-all hover:from-purple-500/15 hover:to-blue-500/15 hover:shadow-sm dark:text-purple-300"
        >
          <Sparkles className="h-4 w-4" />
          <span>问 AI 任何问题...</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          功能导航
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10 dark:bg-primary/15"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/25"
                  : "bg-muted/50 text-muted-foreground group-hover:bg-muted"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom decoration */}
      <div className="border-t border-border/50 px-4 py-3">
        <div className="rounded-xl bg-gradient-to-r from-[#C41230]/5 to-[#D4A843]/5 px-3 py-2.5 ring-1 ring-[#C41230]/5">
          <p className="text-[11px] font-medium text-[#C41230] dark:text-[#E8173A]">四川大学</p>
          <p className="text-[10px] text-muted-foreground">Sichuan University · Since 1896</p>
        </div>
      </div>
    </aside>
  );
}
