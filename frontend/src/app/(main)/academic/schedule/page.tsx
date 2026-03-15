"use client";

import { useState, useEffect } from "react";
import { getSchedule, type Course } from "@/lib/academic";
import { Loader2, CalendarDays, MapPin, Clock } from "lucide-react";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const SECTIONS = Array.from({ length: 11 }, (_, i) => i + 1);
const SECTION_TIMES: Record<number, [string, string]> = {
  1: ["08:00", "08:45"], 2: ["08:55", "09:40"], 3: ["10:10", "10:55"],
  4: ["11:05", "11:50"], 5: ["14:00", "14:45"], 6: ["14:55", "15:40"],
  7: ["16:10", "16:55"], 8: ["17:05", "17:50"], 9: ["19:00", "19:45"],
  10: ["19:55", "20:40"], 11: ["20:50", "21:35"],
};
const COLORS = [
  "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-200",
  "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-200",
  "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-200",
  "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:border-orange-700 dark:text-orange-200",
  "bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/40 dark:border-pink-700 dark:text-pink-200",
  "bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900/40 dark:border-cyan-700 dark:text-cyan-200",
  "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200",
  "bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-200",
];

export default function SchedulePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const todayWeekday = new Date().getDay() || 7;

  useEffect(() => {
    async function load() {
      try {
        const data = await getSchedule();
        setCourses(data.courses);
      } catch {
        setError("获取课表失败，可能需要重新登录");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Assign a stable color per course name
  const courseColorMap = new Map<string, string>();
  let colorIdx = 0;
  courses.forEach((c) => {
    if (!courseColorMap.has(c.course_name)) {
      courseColorMap.set(c.course_name, COLORS[colorIdx % COLORS.length]);
      colorIdx++;
    }
  });

  // Build grid: [weekday 1-7][section 1-11]
  function getCourseAt(weekday: number, section: number) {
    return courses.find(
      (c) => c.weekday === weekday && c.start_section <= section && c.end_section >= section
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">正在从教务系统获取课表...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <CalendarDays className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">课程表</h1>
            <p className="text-xs text-muted-foreground">2025-2026 学年第二学期</p>
          </div>
        </div>
        {courses.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
            共 {courses.length} 门课
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 ring-1 ring-red-500/20">
          {error}
        </div>
      )}

      {courses.length === 0 && !error ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">本学期暂无已排课程</p>
          <p className="mt-1 text-xs text-muted-foreground/60">如果刚选课，数据可能需要教务系统同步</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className="w-16 border-b border-r border-border/30 bg-muted/30 p-2 text-xs font-medium text-muted-foreground">
                  节次
                </th>
                {WEEKDAYS.map((day, i) => (
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
              {SECTIONS.map((section) => {
                // Check if this is the start of an afternoon/evening block
                const isBreak = section === 5 || section === 9;
                return (
                  <>
                    {isBreak && (
                      <tr key={`break-${section}`}>
                        <td
                          colSpan={8}
                          className="h-1 bg-muted/50"
                        />
                      </tr>
                    )}
                    <tr key={section}>
                      <td className="border-r border-border/30 bg-muted/20 p-1 text-center">
                        <div className="text-xs font-medium text-muted-foreground">{section}</div>
                        <div className="text-[10px] text-muted-foreground/60">
                          {SECTION_TIMES[section]?.[0]}
                        </div>
                      </td>
                      {WEEKDAYS.map((_, wi) => {
                        const weekday = wi + 1;
                        const course = getCourseAt(weekday, section);
                        const isToday = weekday === todayWeekday;

                        // Only render at start_section, span downward
                        if (course && course.start_section === section) {
                          const span = course.end_section - course.start_section + 1;
                          const color = courseColorMap.get(course.course_name) || COLORS[0];
                          return (
                            <td
                              key={weekday}
                              rowSpan={span}
                              className={`p-1 ${isToday ? "bg-primary/[0.02]" : ""}`}
                            >
                              <div
                                className={`h-full rounded-lg border p-1.5 text-xs ${color} cursor-default transition-transform hover:scale-[1.02]`}
                              >
                                <p className="font-medium leading-tight line-clamp-2">
                                  {course.course_name}
                                </p>
                                <div className="mt-1 flex items-center gap-1 opacity-70">
                                  <MapPin className="h-2.5 w-2.5" />
                                  <span className="truncate text-[10px]">{course.location || "未知"}</span>
                                </div>
                                <p className="mt-0.5 truncate text-[10px] opacity-70">
                                  {course.teacher}
                                </p>
                                {course.weeks && (
                                  <p className="mt-0.5 text-[10px] opacity-50">{course.weeks}</p>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // If covered by a rowSpan, skip
                        if (course && course.start_section < section) {
                          return null;
                        }

                        return (
                          <td
                            key={weekday}
                            className={`border-border/10 p-1 ${isToday ? "bg-primary/[0.02]" : ""}`}
                          >
                            <div className="h-10" />
                          </td>
                        );
                      })}
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Course List (mobile-friendly) */}
      {courses.length > 0 && (
        <div className="space-y-2 md:hidden">
          <h3 className="text-sm font-semibold text-muted-foreground">课程列表</h3>
          {courses
            .sort((a, b) => a.weekday - b.weekday || a.start_section - b.start_section)
            .map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900"
              >
                <div className={`h-10 w-1 rounded-full ${COLORS[i % COLORS.length].split(" ")[0]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.course_name}</p>
                  <p className="text-xs text-muted-foreground">
                    周{WEEKDAYS[c.weekday - 1]?.replace("周", "")} 第{c.start_section}-{c.end_section}节 · {c.location} · {c.teacher}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
