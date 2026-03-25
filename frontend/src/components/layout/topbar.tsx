"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { logout } from "@/lib/auth";
import {
  LogOut,
  Search,
  User,
  Bell,
  Sun,
  Moon,
  CalendarDays,
  TrendingUp,
  BookOpen,
  UtensilsCrossed,
  Bus,
  MessageSquare,
  Settings,
  Calendar,
  Check,
  AlertTriangle,
  Info,
  AlertCircle,
  BellOff,
  Timer,
  FileQuestion,
  CloudSun,
  Newspaper,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  useNotificationStore,
  type Notification,
} from "@/stores/notification-store";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}天前`;
}

const notifTypeConfig: Record<
  Notification["type"],
  { icon: typeof Info; color: string; bg: string }
> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  urgent: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

const SEARCH_ROUTES = [
  { keywords: ["课表", "课程", "上课", "schedule"], href: "/academic/schedule", label: "课程表", icon: CalendarDays },
  { keywords: ["成绩", "绩点", "学分", "gpa", "score"], href: "/academic/scores", label: "成绩查询", icon: TrendingUp },
  { keywords: ["ddl", "截止", "作业", "deadline", "待办"], href: "/academic/deadline", label: "DDL 追踪", icon: BookOpen },
  { keywords: ["食堂", "吃饭", "canteen", "餐厅"], href: "/food/canteen", label: "食堂导航", icon: UtensilsCrossed },
  { keywords: ["校车", "班车", "bus"], href: "/campus/bus", label: "校车时刻", icon: Bus },
  { keywords: ["校历", "放假", "calendar"], href: "/campus/calendar", label: "校历", icon: Calendar },
  { keywords: ["考试", "倒计时", "期末", "期中", "exam"], href: "/academic/exam", label: "考试倒计时", icon: Timer },
  { keywords: ["课件", "问答", "rag", "知识库", "文档"], href: "/academic/rag", label: "课件问答", icon: FileQuestion },
  { keywords: ["天气", "穿衣", "温度", "weather"], href: "/weather", label: "天气穿衣", icon: CloudSun },
  { keywords: ["通知", "公告", "notification"], href: "/notification", label: "校园通知", icon: Bell },
  { keywords: ["简报", "日报", "briefing"], href: "/dashboard", label: "每日简报", icon: Newspaper },
  { keywords: ["设置", "setting", "主题", "退出"], href: "/settings", label: "设置", icon: Settings },
];

export function Topbar() {
  const router = useRouter();
  const { user, logout: clearAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { notifications, markRead, markAllRead, unreadCount } = useNotificationStore();
  const unread = unreadCount();
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = query.trim()
    ? SEARCH_ROUTES.filter((r) =>
        r.keywords.some((k) => query.toLowerCase().includes(k)) ||
        r.label.includes(query)
      )
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSearch(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || !query.trim()) return;
    setShowSuggestions(false);
    if (suggestions.length > 0) {
      router.push(suggestions[0].href);
    } else {
      router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
    }
    setQuery("");
  }

  function handleLogout() {
    logout().finally(() => {
      clearAuth();
      router.push("/login");
    });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/40 bg-white/80 px-6 backdrop-blur-xl dark:bg-gray-950/80">
      {/* Search */}
      <div className="flex flex-1 items-center gap-4">
        <div ref={searchRef} className="relative w-full max-w-lg">
          <div className={`relative rounded-xl transition-all duration-300 ${searchFocused ? "ring-2 ring-primary/20 shadow-sm shadow-primary/5" : ""}`}>
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? "text-primary/70" : "text-muted-foreground/50"}`} />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => { setShowSuggestions(true); setSearchFocused(true); }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleSearch}
              placeholder="搜索功能或问 AI..."
              className="h-10 rounded-xl border-border/40 bg-muted/30 pl-10 pr-16 text-sm transition-all duration-200 focus-visible:bg-white focus-visible:shadow-none focus-visible:ring-0 dark:focus-visible:bg-gray-900"
            />
            {/* Keyboard shortcut hint */}
            {!searchFocused && !query && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground/60">
                  Ctrl K
                </kbd>
              </div>
            )}
          </div>
          {showSuggestions && query.trim() && (
            <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl bg-white/95 shadow-lg shadow-black/[0.08] ring-1 ring-black/[0.06] backdrop-blur-xl dark:bg-gray-900/95 dark:ring-white/[0.06]">
              {suggestions.length > 0 ? (
                suggestions.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.href}
                      onClick={() => { router.push(s.href); setQuery(""); setShowSuggestions(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{s.label}</span>
                    </button>
                  );
                })
              ) : (
                <button
                  onClick={() => { router.push(`/chat?q=${encodeURIComponent(query.trim())}`); setQuery(""); setShowSuggestions(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  <span>问 AI：{query}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-sm focus:outline-none">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C41230] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-950">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">通知</h3>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C41230] px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Check className="h-3 w-3" />
                  全部已读
                </button>
              )}
            </div>
            {/* List */}
            {notifications.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 5).map((n) => {
                  const cfg = notifTypeConfig[n.type];
                  const NIcon = cfg.icon;
                  return (
                    <DropdownMenuItem
                      key={n.id}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3 focus:bg-muted/50"
                      onClick={() => markRead(n.id)}
                    >
                      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                        <NIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-semibold">{n.title}</p>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#C41230]" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">{formatTimeAgo(n.created_at)}</p>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BellOff className="h-8 w-8 opacity-30" />
                <p className="mt-2 text-xs">暂无通知</p>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-sm overflow-hidden"
        >
          <Sun className="h-[18px] w-[18px] scale-100 rotate-0 transition-all duration-500 ease-in-out dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[18px] w-[18px] scale-0 rotate-90 transition-all duration-500 ease-in-out dark:scale-100 dark:rotate-0" />
        </button>

        {/* User menu */}
        <div className="ml-2 border-l border-border/40 pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-muted hover:shadow-sm focus:outline-none">
              <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-[#C41230] to-[#E8173A] text-xs font-semibold text-white">
                  {user?.name?.charAt(0) || <User className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left lg:block">
                <p className="text-sm font-medium leading-none">{user?.name || "未登录"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{user?.student_id || ""}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                <span className="font-medium">{user?.name || "Guest"}</span>
                <span className="text-xs text-muted-foreground">{user?.student_id}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
