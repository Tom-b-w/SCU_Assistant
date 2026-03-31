/**
 * 骨架屏组件集合 — 用于各页面的加载状态
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Dashboard 快速统计卡片骨架 ─── */
export function QuickStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
        >
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-1.5 h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

/* ─── Dashboard 今日课程骨架 ─── */
export function TodayCourseSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
        >
          <Skeleton className="h-10 w-1.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-1">
            <Skeleton className="ml-auto h-3.5 w-12" />
            <Skeleton className="ml-auto h-2.5 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Dashboard 学分进度骨架 ─── */
export function CreditProgressSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3.5 w-full rounded-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="mb-1.5 flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ─── Dashboard 成绩列表骨架 ─── */
export function ScoresTableSkeleton() {
  return (
    <div className="space-y-0.5">
      <div className="rounded-lg bg-muted/60 px-3 py-2.5 dark:bg-muted/30">
        <Skeleton className="h-3.5 w-full" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2.5">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-28 flex-shrink-0" />
          <Skeleton className="h-3 w-16" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-5 w-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ─── 天气页面骨架 ─── */
export function WeatherSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="mt-2 h-5 w-14" />
            <Skeleton className="mt-1 h-3 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

/* ─── 每日简报骨架 ─── */
export function BriefingSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="mt-2 h-7 w-10" />
            <Skeleton className="mt-1 h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 通用全页加载骨架 ─── */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  );
}
