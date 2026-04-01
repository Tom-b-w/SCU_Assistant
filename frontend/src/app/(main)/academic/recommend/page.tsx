"use client";

import { useState } from "react";
import {
  GraduationCap,
  Sparkles,
  Loader2,
  Target,
  BookOpen,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RecommendResult {
  recommendation: string;
  plan_summary: {
    total_required: number;
    earned: number;
    completed_courses: number;
  };
}

export default function CourseRecommendPage() {
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateRecommendation() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<RecommendResult>("/api/academic/course-recommend");
      setResult(data);
    } catch {
      setError("生成选课推荐失败，请确保已同步教务数据后重试");
    } finally {
      setLoading(false);
    }
  }

  const remaining = result
    ? result.plan_summary.total_required - result.plan_summary.earned
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI 选课推荐</h1>
            <p className="text-xs text-muted-foreground">
              基于培养方案智能分析选课建议
            </p>
          </div>
        </div>
      </div>

      {/* Action Card */}
      {!result && !loading && (
        <div className="rounded-xl bg-gradient-to-br from-indigo-500/[0.06] via-purple-500/[0.04] to-indigo-500/[0.06] p-6 ring-1 ring-indigo-500/15">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">智能选课分析</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              AI 将根据你的培养方案完成进度和已修课程，分析学分缺口，推荐下学期最优选课方案。
            </p>
            <button
              onClick={generateRecommendation}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-all hover:shadow-lg hover:brightness-110 active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              开始分析
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="mt-4 text-sm text-muted-foreground">
            正在分析培养方案和已修课程...
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            AI 正在生成个性化选课建议，请稍候
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "已修学分",
                value: result.plan_summary.earned.toString(),
                icon: BookOpen,
                color: "from-emerald-500 to-green-600",
              },
              {
                label: "剩余学分",
                value: remaining.toString(),
                icon: Target,
                color: "from-orange-500 to-red-500",
              },
              {
                label: "已修课程",
                value: `${result.plan_summary.completed_courses}门`,
                icon: TrendingUp,
                color: "from-blue-500 to-indigo-500",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
                >
                  <div
                    className={`inline-flex rounded-lg bg-gradient-to-br ${stat.color} p-2 text-white shadow-sm`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Recommendation Content */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </div>
              <h3 className="font-semibold">AI 选课建议</h3>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-2 prose-code:text-[#C41230]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.recommendation}
              </ReactMarkdown>
            </div>
          </div>

          {/* Regenerate Button */}
          <div className="flex justify-center">
            <button
              onClick={generateRecommendation}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              重新生成
            </button>
          </div>
        </>
      )}
    </div>
  );
}
