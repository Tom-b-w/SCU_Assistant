"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { logout } from "@/lib/auth";
import {
  Settings,
  User,
  GraduationCap,
  LogOut,
  Moon,
  Bell,
  Shield,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout: clearAuth } = useAuthStore();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearAuth();
      router.push("/login");
    }
  }

  const settingGroups = [
    {
      title: "偏好设置",
      items: [
        {
          icon: Moon,
          label: "深色模式",
          description: "切换暗色/亮色主题",
          action: "toggle",
          disabled: true,
        },
        {
          icon: Bell,
          label: "通知提醒",
          description: "DDL 到期提醒、课前提醒",
          action: "toggle",
          disabled: true,
        },
      ],
    },
    {
      title: "隐私与安全",
      items: [
        {
          icon: Shield,
          label: "AI 记忆管理",
          description: "查看和管理 AI 记住的偏好信息",
          action: "link",
          disabled: true,
        },
      ],
    },
    {
      title: "关于",
      items: [
        {
          icon: Info,
          label: "关于 SCU Assistant",
          description: "v0.1.0 · 四川大学计算机学院",
          action: "info",
          disabled: false,
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-500/10">
          <Settings className="h-5 w-5 text-gray-500" />
        </div>
        <h1 className="text-xl font-bold">设置</h1>
      </div>

      {/* User Profile Card */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C41230] to-[#E8173A] text-white shadow-lg shadow-[#C41230]/20">
            <User className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{user?.name || "未登录"}</h2>
            <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                {user?.student_id || "—"}
              </p>
              {user?.major && (
                <p className="text-xs">{user.major}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Setting Groups */}
      {settingGroups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {group.title}
          </h3>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            {group.items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border/30" : ""
                  } ${item.disabled ? "opacity-50" : "cursor-pointer hover:bg-muted/30"} transition-colors`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {item.action === "toggle" && (
                    <div className="h-5 w-9 rounded-full bg-muted">
                      <div className="h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/10" />
                    </div>
                  )}
                  {item.action === "link" && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                  {item.disabled && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      开发中
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </Button>

      <p className="text-center text-xs text-muted-foreground/40">
        SCU Assistant v0.1.0 · Powered by AI · 四川大学计算机学院
      </p>
    </div>
  );
}
