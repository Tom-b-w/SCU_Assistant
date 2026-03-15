"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { login } from "@/lib/auth";
import { GraduationCap, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ student_id: studentId, password });
      setUser(data.user, data.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "登录失败，请检查学号和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center">
      {/* Logo & Branding */}
      <div className="mb-8 flex flex-col items-center text-white">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 shadow-2xl backdrop-blur-sm ring-1 ring-white/20">
          <GraduationCap className="h-10 w-10 text-[#D4A843]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">SCU Assistant</h1>
        <p className="mt-1 text-sm text-white/60">四川大学智能校园助手</p>
      </div>

      {/* Login Card - Glassmorphism */}
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-white">欢迎回来</h2>
          <p className="mt-1 text-sm text-white/50">使用教务系统账号登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="studentId" className="text-sm font-medium text-white/80">
              学号
            </label>
            <Input
              id="studentId"
              placeholder="请输入学号"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:border-[#D4A843]/50 focus-visible:ring-[#D4A843]/30"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-white/80">
              密码
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="教务系统密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-white/10 bg-white/[0.06] pr-10 text-white placeholder:text-white/30 focus-visible:border-[#D4A843]/50 focus-visible:ring-[#D4A843]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="h-11 w-full bg-gradient-to-r from-[#C41230] to-[#E8173A] font-medium text-white shadow-lg shadow-[#C41230]/25 transition-all hover:shadow-xl hover:shadow-[#C41230]/30 hover:brightness-110 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "登 录"
            )}
          </Button>
        </form>

        {/* Feature hints */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30">
          <Sparkles className="h-3 w-3" />
          <span>AI 驱动 · 课表查询 · DDL管理 · 食堂导航</span>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-white/25">
        Powered by AI · 四川大学计算机学院
      </p>
    </div>
  );
}
