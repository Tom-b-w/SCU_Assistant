"use client";

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
import { LogOut, Search, User, Bell, Sun } from "lucide-react";

export function Topbar() {
  const router = useRouter();
  const { user, logout: clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border/50 bg-white/80 px-6 backdrop-blur-sm dark:bg-gray-950/80">
      {/* Search */}
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="搜索或问 AI 任何问题... (例如: '明天有什么课？')"
            className="h-10 rounded-xl border-border/50 bg-muted/30 pl-10 text-sm transition-all focus-visible:bg-white focus-visible:shadow-sm dark:focus-visible:bg-gray-900"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#C41230] ring-2 ring-white dark:ring-gray-950" />
        </button>

        {/* Theme toggle placeholder */}
        <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Sun className="h-[18px] w-[18px]" />
        </button>

        {/* User menu */}
        <div className="ml-2 border-l border-border/50 pl-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted focus:outline-none">
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
