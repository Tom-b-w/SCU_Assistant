"use client";

import React, { useState, useEffect } from "react";
import { getSchedule, type Course } from "@/lib/academic";
import { Loader2, CalendarDays, MapPin, AlertCircle, User } from "lucide-react";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SECTION_TIMES: Record<number, [string, string]> = {
  1: ["08:00", "08:45"], 2: ["08:55", "09:40"], 3: ["10:00", "10:45"],
  4: ["10:55", "11:40"], 5: ["14:00", "14:45"], 6: ["14:55", "15:40"],
  7: ["15:50", "16:35"], 8: ["16:55", "17:40"], 9: ["17:50", "18:35"],
  10: ["19:30", "20:15"], 11: ["20:25", "21:10"], 12: ["21:20", "22:05"],
};
const PERIOD_LABELS = [
  { label: "上午", sections: [1, 2, 3, 4] },
  { label: "下午", sections: [5, 6, 7, 8, 9] },
  { label: "晚上", sections: [10, 11, 12] },
];
const COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", accent: "bg-blue-500" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", accent: "bg-emerald-500" },
  { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", accent: "bg-purple-500" },
  { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", accent: "bg-orange-500" },
  { bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300", accent: "bg-pink-500" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300", accent: "bg-cyan-500" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", accent: "bg-amber-500" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", accent: "bg-indigo-500" },
];

export default function SchedulePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const todayWeekday = new Date().getDay() || 7;

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    setError("");
    try {
      const data = await getSchedule();
      setCourses(data.courses);
      setFetchedAt((data as unknown as Record<string, unknown>).fetched_at as string || null);
    } catch {
      setError("获取课表失败，可能需要重新登录");
    } finally {
      setLoading(false);
    }
  }

  const scheduledCourses = courses.filter((c) => c.is_scheduled);
  const unscheduledCourses = courses.filter((c) => !c.is_scheduled);

  // Stable color assignment by course name
  const courseColorMap = new Map<string, typeof COLORS[0]>();
  let colorIdx = 0;
  courses.forEach((c) => {
    if (!courseColorMap.has(c.course_name)) {
      courseColorMap.set(c.course_name, COLORS[colorIdx % COLORS.length]);
      colorIdx++;
    }
  });

  function getCourseAt(weekday: number, section: number) {
    return scheduledCourses.find(
      (c) => c.weekday === weekday && c.start_section <= section && c.end_section >= section
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">正在获取课表...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <CalendarDays className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">课程表</h1>
            <p className="text-xs text-muted-foreground">
              2025-2026 学年第二学期
              {fetchedAt && (
                <span className="ml-2 text-muted-foreground/50">
                  · 更新于 {new Date(fetchedAt).toLocaleDateString("zh-CN")}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {courses.length > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
              共 {courses.length} 门课
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      {courses.length === 0 && !error ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">本学期暂无选课记录</p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Timetable Grid */}
          <div className="flex-1 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr>
                  <th className="w-[52px] border-b border-r border-border/30 bg-muted/30 p-2 text-[10px] font-medium text-muted-foreground">
                    节次
                  </th>
                  {WEEKDAYS.slice(0, 7).map((day, i) => (
                    <th
                      key={day}
                      className={`border-b border-border/30 p-2 text-xs font-medium ${
                        i + 1 === todayWeekday
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      <div>{day}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIOD_LABELS.map((period, pi) => (
                  <React.Fragment key={pi}>
                    {/* Period separator */}
                    {pi > 0 && (
                      <tr key={`sep-${pi}`}>
                        <td colSpan={8} className="h-0.5 bg-muted/40" />
                      </tr>
                    )}
                    {period.sections.map((section) => (
                      <tr key={section} className="h-[52px]">
                        <td className="border-r border-border/20 bg-muted/10 p-0.5 text-center align-middle">
                          <div className="text-[11px] font-medium text-muted-foreground">{section}</div>
                          <div className="text-[9px] leading-tight text-muted-foreground/50">
                            {SECTION_TIMES[section]?.[0]}
                          </div>
                        </td>
                        {WEEKDAYS.slice(0, 7).map((_, wi) => {
                          const weekday = wi + 1;
                          const course = getCourseAt(weekday, section);
                          const isToday = weekday === todayWeekday;

                          if (course && course.start_section === section) {
                            const span = course.end_section - course.start_section + 1;
                            const color = courseColorMap.get(course.course_name) || COLORS[0];
                            return (
                              <td
                                key={weekday}
                                rowSpan={span}
                                className={`p-0.5 ${isToday ? "bg-primary/[0.02]" : ""}`}
                              >
                                <div
                                  className={`flex h-full flex-col rounded-lg border p-1.5 ${color.bg} ${color.border} ${color.text} cursor-default transition-all hover:shadow-md`}
                                >
                                  <p className="text-[11px] font-semibold leading-tight line-clamp-2">
                                    {course.course_name}
                                  </p>
                                  {course.location && (
                                    <div className="mt-auto flex items-center gap-0.5 pt-0.5">
                                      <MapPin className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                      <span className="truncate text-[9px] opacity-70">{course.location}</span>
                                    </div>
                                  )}
                                  {course.teacher && (
                                    <div className="flex items-center gap-0.5">
                                      <User className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                      <span className="truncate text-[9px] opacity-70">{course.teacher}</span>
                                    </div>
                                  )}
                                  {course.weeks && (
                                    <p className="text-[9px] opacity-40">{course.weeks}</p>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          if (course && course.start_section < section) {
                            return null;
                          }

                          return (
                            <td
                              key={weekday}
                              className={`border-border/5 p-0.5 ${isToday ? "bg-primary/[0.02]" : ""}`}
                            >
                              <div className="h-full" />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right sidebar: unscheduled courses */}
          {unscheduledCourses.length > 0 && (
            <div className="hidden w-56 shrink-0 space-y-2 lg:block">
              <div className="flex items-center gap-1.5 px-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">待排课 ({unscheduledCourses.length})</span>
              </div>
              {unscheduledCourses.map((c, i) => {
                const color = courseColorMap.get(c.course_name) || COLORS[0];
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-2.5 ${color.bg} ${color.border} ${color.text}`}
                  >
                    <p className="text-xs font-semibold leading-tight">{c.course_name}</p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {c.teacher}{c.course_type ? ` · ${c.course_type}` : ""}
                    </p>
                    <p className="mt-0.5 text-[9px] opacity-40">时间地点待定</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mobile: unscheduled courses */}
      {unscheduledCourses.length > 0 && (
        <div className="space-y-2 lg:hidden">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">待排课 ({unscheduledCourses.length})</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {unscheduledCourses.map((c, i) => {
              const color = courseColorMap.get(c.course_name) || COLORS[0];
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${color.bg} ${color.border} ${color.text}`}
                >
                  <p className="text-sm font-medium">{c.course_name}</p>
                  <p className="mt-1 text-xs opacity-70">
                    {c.teacher}{c.course_type ? ` · ${c.course_type}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10px] opacity-40">时间地点待定</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile: scheduled course list */}
      {scheduledCourses.length > 0 && (
        <div className="space-y-2 md:hidden">
          <h3 className="text-xs font-semibold text-muted-foreground">课程列表</h3>
          {scheduledCourses
            .sort((a, b) => a.weekday - b.weekday || a.start_section - b.start_section)
            .map((c, i) => {
              const color = courseColorMap.get(c.course_name) || COLORS[0];
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900"
                >
                  <div className={`h-10 w-1 rounded-full ${color.accent}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.course_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {WEEKDAYS[c.weekday - 1]} 第{c.start_section}-{c.end_section}节 · {c.location || "待定"} · {c.teacher}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
