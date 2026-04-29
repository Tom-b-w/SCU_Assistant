"use client";

import { useState, useEffect } from "react";
import {
  Newspaper,
  CalendarDays,
  BookOpen,
  Timer,
  CloudSun,
  Sparkles,
} from "lucide-react";
import { getBriefing, type BriefingData } from "@/lib/briefing";
import { getWeather, type Weather } from "@/lib/weather";
import { BriefingSkeleton } from "@/components/ui/skeleton-cards";

export default function DashboardPage() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getBriefing()
      .then((data) => {
        if (!cancelled) {
          setBriefing(data);
        }
      })
      .catch(() => {
        // silently fail
      });

    getWeather("成都")
      .then((data) => {
        if (!cancelled) {
          setWeather(data);
        }
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <BriefingSkeleton />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
          <Newspaper className="h-5 w-5 text-teal-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">每日简报</h1>
          <p className="text-xs text-muted-foreground">
            {briefing ? `${briefing.date} ${briefing.weekday}` : "今日概况"}
          </p>
        </div>
      </div>

      {/* Morning Briefing Card */}
      {briefing && (
        <div className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 text-white shadow-lg shadow-teal-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5" />
            <h2 className="font-semibold">AI 每日简报</h2>
          </div>
          <div className="text-sm leading-relaxed opacity-95">
            {briefing.briefing.split("\n").map((line, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Quick Info Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="inline-flex rounded-lg bg-emerald-500/10 p-2">
            <CalendarDays className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{briefing?.data.schedule_count ?? "--"}</p>
          <p className="text-xs text-muted-foreground">今日课程</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="inline-flex rounded-lg bg-orange-500/10 p-2">
            <BookOpen className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{briefing?.data.deadline_count ?? "--"}</p>
          <p className="text-xs text-muted-foreground">待办 DDL</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="inline-flex rounded-lg bg-red-500/10 p-2">
            <Timer className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{briefing?.data.exam_count ?? "--"}</p>
          <p className="text-xs text-muted-foreground">近期考试</p>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="inline-flex rounded-lg bg-sky-500/10 p-2">
            <CloudSun className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {weather ? `${weather.temperature}°` : "--"}
          </p>
          <p className="text-xs text-muted-foreground">
            {weather ? weather.condition : "天气"}
          </p>
        </div>
      </div>

      {/* Weather Summary */}
      {weather && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
              <CloudSun className="h-4 w-4 text-sky-500" />
            </div>
            <h3 className="font-semibold">天气概况</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">温度</p>
              <p className="font-medium">{weather.temperature}°C / 体感 {weather.feels_like}°C</p>
            </div>
            <div>
              <p className="text-muted-foreground">天况</p>
              <p className="font-medium">{weather.condition}</p>
            </div>
            <div>
              <p className="text-muted-foreground">湿度</p>
              <p className="font-medium">{weather.humidity}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">风</p>
              <p className="font-medium">{weather.wind_direction} {weather.wind_scale}级</p>
            </div>
          </div>
          {weather.clothing_advice && (
            <p className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {weather.clothing_advice}
            </p>
          )}
        </div>
      )}

      {/* Empty state if nothing loaded */}
      {!briefing && !weather && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <Newspaper className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">暂无简报数据</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            请稍后刷新重试
          </p>
        </div>
      )}
    </div>
  );
}
