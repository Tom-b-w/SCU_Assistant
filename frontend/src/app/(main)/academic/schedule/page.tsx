"use client";

import React, { useEffect, useState } from "react";
import { getSchedule, type Course } from "@/lib/academic";
import {
  getCourseTimeRange,
  getSectionTime,
  normalizeCampusName,
  normalizeScheduleCourse,
  type SupportedCampus,
} from "@/lib/schedule";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, CalendarDays, MapPin, AlertCircle, User } from "lucide-react";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const TOTAL_SECTIONS = 12;
const COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300" },
];

type CourseColor = (typeof COLORS)[number];
type ScheduledCourse = Course & {
  weekday: number;
  start_section: number;
  end_section: number;
  campus?: string | null;
};

type TimetableGridProps = {
  campus: SupportedCampus;
  courses: ScheduledCourse[];
  courseColorMap: Map<string, CourseColor>;
  todayWeekday: number;
  mobile?: boolean;
};

export default function SchedulePage() {
  const userCampus = useAuthStore((state) => state.user?.campus);
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

  const scheduledCourses = mergeContinuousCourses(
    courses
      .filter((course) => course.is_scheduled)
      .map((course) => normalizeScheduleCourse(course))
      .filter(isDefined)
  );
  const displayCampus = resolveDisplayCampus(userCampus, scheduledCourses);
  const unscheduledCourses = courses.filter((course) => !course.is_scheduled);
  const courseCount = new Set(courses.map((course) => course.course_name)).size;

  const courseColorMap = new Map<string, CourseColor>();
  let colorIndex = 0;
  courses.forEach((course) => {
    if (!courseColorMap.has(course.course_name)) {
      courseColorMap.set(course.course_name, COLORS[colorIndex % COLORS.length]);
      colorIndex += 1;
    }
  });

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
        {courses.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
            共 {courseCount} 门课
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
          <p className="mt-4 text-muted-foreground">本学期暂无选课记录</p>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
            <div className="hidden md:block">
              <TimetableGrid
                campus={displayCampus}
                courses={scheduledCourses}
                courseColorMap={courseColorMap}
                todayWeekday={todayWeekday}
              />
            </div>
            <div className="md:hidden">
              <TimetableGrid
                campus={displayCampus}
                courses={scheduledCourses}
                courseColorMap={courseColorMap}
                todayWeekday={todayWeekday}
                mobile
              />
            </div>
          </div>

          {unscheduledCourses.length > 0 && (
            <div className="hidden w-56 shrink-0 space-y-2 lg:block">
              <div className="flex items-center gap-1.5 px-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">待排课 ({unscheduledCourses.length})</span>
              </div>
              {unscheduledCourses.map((course, index) => {
                const color = courseColorMap.get(course.course_name) || COLORS[0];
                return (
                  <div
                    key={`${course.course_name}-${index}`}
                    className={`rounded-lg border p-2.5 ${color.bg} ${color.border} ${color.text}`}
                  >
                    <p className="text-xs font-semibold leading-tight">{course.course_name}</p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {course.teacher}
                      {course.course_type ? ` · ${course.course_type}` : ""}
                    </p>
                    <p className="mt-0.5 text-[9px] opacity-40">时间地点待定</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {unscheduledCourses.length > 0 && (
        <div className="space-y-2 lg:hidden">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">待排课 ({unscheduledCourses.length})</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {unscheduledCourses.map((course, index) => {
              const color = courseColorMap.get(course.course_name) || COLORS[0];
              return (
                <div
                  key={`${course.course_name}-${index}`}
                  className={`rounded-lg border p-3 ${color.bg} ${color.border} ${color.text}`}
                >
                  <p className="text-sm font-medium">{course.course_name}</p>
                  <p className="mt-1 text-xs opacity-70">
                    {course.teacher}
                    {course.course_type ? ` · ${course.course_type}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10px] opacity-40">时间地点待定</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TimetableGrid({ campus, courses, courseColorMap, todayWeekday, mobile = false }: TimetableGridProps) {
  const labelWidth = mobile ? 46 : 92;
  const headerHeight = mobile ? 34 : 50;
  const sectionHeight = mobile ? 64 : 58;

  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06] ${mobile ? "overflow-hidden" : "overflow-x-auto"}`}>
      <div className={mobile ? "p-1.5" : "min-w-[920px] p-3"}>
        <div
          className="grid overflow-hidden rounded-xl border border-border/30 bg-background"
          style={{
            gridTemplateColumns: `${labelWidth}px repeat(7, minmax(0, 1fr))`,
            gridTemplateRows: `${headerHeight}px repeat(${TOTAL_SECTIONS}, ${sectionHeight}px)`,
          }}
        >
          <div className="border-b border-r border-border/30 bg-muted/[0.35] px-1 text-center text-[10px] font-medium text-muted-foreground" style={{ gridColumn: 1, gridRow: 1 }}>
            <div className="flex h-full items-center justify-center">
              <span className="sr-only">时间</span>
            </div>
          </div>

          {WEEKDAYS.map((day, index) => {
            const weekday = index + 1;
            const isToday = weekday === todayWeekday;
            return (
              <div
                key={day}
                className={`border-b border-l border-border/30 px-1 text-center font-medium ${
                  mobile ? "text-[10px]" : "text-xs"
                } ${
                  isToday ? "bg-primary/[0.06] text-primary" : "bg-muted/20 text-muted-foreground"
                }`}
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                <div className="flex h-full items-center justify-center">{day}</div>
              </div>
            );
          })}

          {Array.from({ length: TOTAL_SECTIONS }, (_, index) => {
            const section = index + 1;
            return (
              <React.Fragment key={section}>
                <div
                  className={`border-r border-t border-border/20 bg-muted/[0.12] text-center ${mobile ? "px-0.5 py-1" : "px-1 py-1"} ${getSectionDividerClass(section)}`}
                  style={{ gridColumn: 1, gridRow: section + 1 }}
                >
                  {renderSectionTime(section, campus, mobile)}
                </div>
                {WEEKDAYS.map((_, weekdayIndex) => {
                  const weekday = weekdayIndex + 1;
                  const isToday = weekday === todayWeekday;
                  return (
                    <div
                      key={`${weekday}-${section}`}
                      className={`border-l border-t border-border/20 ${getSectionDividerClass(section)} ${
                        isToday ? "bg-primary/[0.03]" : "bg-background"
                      }`}
                      style={{ gridColumn: weekday + 1, gridRow: section + 1 }}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}

          {courses.map((course, index) => {
            const color = courseColorMap.get(course.course_name) || COLORS[0];
            const span = getCourseSpan(course);
            return (
              <div
                key={`${course.course_name}-${course.weekday}-${course.start_section}-${course.location}-${index}`}
                className={mobile ? "relative z-10 p-0.5" : "relative z-10 p-1"}
                style={{
                  gridColumn: course.weekday + 1,
                  gridRow: `${course.start_section + 1} / span ${span}`,
                }}
              >
                <div
                  className={`flex h-full min-h-0 flex-col overflow-hidden border shadow-sm ${color.bg} ${color.border} ${color.text} ${mobile ? "rounded-lg px-1 py-1" : "rounded-xl px-2 py-1.5"}`}
                >
                  <p className={`break-words font-semibold leading-[1.15] ${mobile ? "text-[10px] line-clamp-3" : "text-xs line-clamp-2"}`}>
                    {course.course_name}
                  </p>
                  <p className={`${mobile ? "mt-0.5 text-[8px]" : "mt-0.5 text-[9px]"} opacity-70`}>
                    {getCourseTimeRange(course)}
                  </p>
                  {course.location && (
                    mobile ? (
                      <p className="mt-0.5 line-clamp-2 text-[8px] opacity-65">{course.location}</p>
                    ) : (
                      <div className="mt-1 flex items-start gap-1">
                        <MapPin className="mt-[1px] h-3 w-3 shrink-0 opacity-60" />
                        <span className="line-clamp-2 text-[9px] opacity-70">{course.location}</span>
                      </div>
                    )
                  )}
                  {course.teacher && !mobile && (
                    <div className="mt-auto flex items-center gap-1 pt-1">
                      <User className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate text-[9px] opacity-70">{course.teacher}</span>
                    </div>
                  )}
                  {!mobile && course.weeks && (
                    <p className="mt-0.5 truncate text-[9px] opacity-45">{course.weeks}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderSectionTime(section: number, campus: SupportedCampus, compact: boolean) {
  const time = getSectionTime(section, campus) ?? getSectionTime(section, "江安");

  if (!time) {
    return null;
  }

  if (compact) {
    return (
      <>
        <div className="text-[7px] leading-tight text-muted-foreground/65">{time[0]}</div>
        <div className="text-[7px] leading-tight text-muted-foreground/50">{time[1]}</div>
      </>
    );
  }

  return (
    <div className="text-[9px] leading-tight text-muted-foreground/65">
      {time[0]}-{time[1]}
    </div>
  );
}

function resolveDisplayCampus(userCampus: string | null | undefined, courses: ScheduledCourse[]): SupportedCampus {
  const normalizedUserCampus = normalizeCampusName(userCampus);
  if (normalizedUserCampus) {
    return normalizedUserCampus;
  }

  const campusWeights = new Map<SupportedCampus, number>();

  for (const course of courses) {
    const campus = normalizeCampusName(course.campus);
    if (!campus) {
      continue;
    }

    const weight = getCourseSpan(course);
    campusWeights.set(campus, (campusWeights.get(campus) ?? 0) + weight);
  }

  let displayCampus: SupportedCampus = "江安";
  let maxWeight = 0;

  for (const [campus, weight] of campusWeights) {
    if (weight > maxWeight) {
      displayCampus = campus;
      maxWeight = weight;
    }
  }

  return displayCampus;
}

function getSectionDividerClass(section: number) {
  return section === 5 || section === 10 ? "border-t-2 border-t-border/[0.35]" : "";
}

function getCourseSpan(course: Pick<ScheduledCourse, "start_section" | "end_section">) {
  return course.end_section - course.start_section + 1;
}

function mergeContinuousCourses(courses: ScheduledCourse[]) {
  const sortedCourses = [...courses].sort((left, right) => {
    return (
      left.weekday - right.weekday ||
      left.start_section - right.start_section ||
      left.end_section - right.end_section ||
      left.course_name.localeCompare(right.course_name, "zh-CN")
    );
  });

  const mergedCourses: ScheduledCourse[] = [];

  for (const course of sortedCourses) {
    const previousCourse = mergedCourses[mergedCourses.length - 1];

    if (previousCourse && canMergeCourses(previousCourse, course)) {
      previousCourse.end_section = Math.max(previousCourse.end_section, course.end_section);
      previousCourse.teacher = previousCourse.teacher || course.teacher;
      previousCourse.location = previousCourse.location || course.location;
      previousCourse.weeks = previousCourse.weeks || course.weeks;
      previousCourse.course_type = previousCourse.course_type || course.course_type;
      previousCourse.campus = previousCourse.campus || course.campus;
      previousCourse.building = previousCourse.building || course.building;
      continue;
    }

    mergedCourses.push({ ...course });
  }

  return mergedCourses;
}

function canMergeCourses(left: ScheduledCourse, right: ScheduledCourse) {
  return (
    left.weekday === right.weekday &&
    left.end_section + 1 >= right.start_section &&
    normalizeKey(left.course_name) === normalizeKey(right.course_name) &&
    isCompatibleCourseField(left.teacher, right.teacher) &&
    isCompatibleCourseField(left.weeks, right.weeks) &&
    isCompatibleCourseField(left.course_type, right.course_type) &&
    isCompatibleCourseField(left.campus, right.campus)
  );
}

function normalizeKey(value?: string | null) {
  return value?.replace(/\s+/g, "").trim() ?? "";
}

function isCompatibleCourseField(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeKey(left);
  const normalizedRight = normalizeKey(right);

  if (!normalizedLeft || !normalizedRight) {
    return true;
  }

  return normalizedLeft === normalizedRight;
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
