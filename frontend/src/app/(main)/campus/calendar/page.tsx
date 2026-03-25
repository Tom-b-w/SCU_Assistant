"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  Clock,
  TreePalm,
  FileText,
  GraduationCap,
  ChevronRight,
} from "lucide-react";

type EventType = "holiday" | "exam" | "school";

interface CalendarEvent {
  id: number;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD (inclusive)
  type: EventType;
  description?: string;
}

// 数据来源：四川大学教务处 2025-2026 学年校历
// https://jwc.scu.edu.cn/info/1101/10035.htm
const SEMESTER_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    title: "在校生报到",
    startDate: "2026-03-05",
    endDate: "2026-03-06",
    type: "school",
    description: "2025-2026学年春季学期在校生报到",
  },
  {
    id: 2,
    title: "补缓考",
    startDate: "2026-03-06",
    endDate: "2026-03-08",
    type: "exam",
    description: "上学期本科生补缓考时间",
  },
  {
    id: 3,
    title: "第一周正式行课",
    startDate: "2026-03-08",
    type: "school",
    description: "春季学期教学第1周开始",
  },
  {
    id: 4,
    title: "清明节",
    startDate: "2026-04-05",
    type: "holiday",
    description: "清明节放假，停课不补",
  },
  {
    id: 5,
    title: "劳动节放假",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    type: "holiday",
    description: "劳动节法定假期",
  },
  {
    id: 6,
    title: "端午节",
    startDate: "2026-06-19",
    type: "holiday",
    description: "端午节放假，停课不补",
  },
  {
    id: 7,
    title: "毕业典礼暨学位授予仪式",
    startDate: "2026-06-26",
    type: "school",
    description: "2026届学生毕业典礼暨学位授予仪式",
  },
  {
    id: 8,
    title: "教学周结束",
    startDate: "2026-07-04",
    type: "school",
    description: "第17教学周结束",
  },
  {
    id: 9,
    title: "实践与国际课程周",
    startDate: "2026-07-05",
    endDate: "2026-07-18",
    type: "school",
    description: "第18-19周，学院组织参与劳动教育、实践环节、短期课程、国内外短期访学交流等",
  },
  {
    id: 10,
    title: "暑假开始",
    startDate: "2026-07-19",
    type: "holiday",
    description: "2025-2026学年暑假正式开始",
  },
];

const EVENT_CONFIG: Record<
  EventType,
  {
    color: string;
    bg: string;
    darkBg: string;
    ring: string;
    icon: typeof TreePalm;
    label: string;
    dot: string;
  }
> = {
  holiday: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    darkBg: "dark:bg-emerald-500/15",
    ring: "ring-emerald-500/20",
    icon: TreePalm,
    label: "假期",
    dot: "bg-emerald-500",
  },
  exam: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    darkBg: "dark:bg-red-500/15",
    ring: "ring-red-500/20",
    icon: FileText,
    label: "考试",
    dot: "bg-red-500",
  },
  school: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    darkBg: "dark:bg-blue-500/15",
    ring: "ring-blue-500/20",
    icon: GraduationCap,
    label: "学校事务",
    dot: "bg-blue-500",
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateRange(start: string, end?: string): string {
  if (!end) return formatDate(start);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getEventStatus(
  event: CalendarEvent
): "past" | "ongoing" | "upcoming" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(event.startDate + "T00:00:00");
  const end = event.endDate
    ? new Date(event.endDate + "T00:00:00")
    : start;

  if (now > end) return "past";
  if (now >= start && now <= end) return "ongoing";
  return "upcoming";
}

export default function CalendarPage() {
  const { nextEvent, currentWeek } = useMemo(() => {
    const now = new Date();
    // 计算当前教学周（从2026-03-08第一周行课算起）
    const semesterStart = new Date("2026-03-08T00:00:00");
    const diffMs = now.getTime() - semesterStart.getTime();
    const week = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));

    const next = SEMESTER_EVENTS.find(
      (e) => getEventStatus(e) === "upcoming"
    );
    return { nextEvent: next, currentWeek: week > 0 ? week : 1 };
  }, []);

  const daysToNext = nextEvent ? getDaysUntil(nextEvent.startDate) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
            <CalendarDays className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">校历</h1>
            <p className="text-xs text-muted-foreground">
              2025-2026 学年第二学期 · 第{currentWeek}周
            </p>
          </div>
        </div>
      </div>

      {/* Next Event Card */}
      {nextEvent && daysToNext !== null && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 p-4 text-white shadow-lg shadow-indigo-500/20">
          <div className="relative z-10">
            <p className="text-xs font-medium text-white/70">距离下一个事件</p>
            <p className="mt-1 text-2xl font-bold">
              {daysToNext} <span className="text-base font-normal">天</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                {EVENT_CONFIG[nextEvent.type].label}
              </span>
              <span className="text-sm font-medium">{nextEvent.title}</span>
            </div>
            <p className="mt-1 text-xs text-white/60">
              {formatDateRange(nextEvent.startDate, nextEvent.endDate)}
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -right-2 h-16 w-16 rounded-full bg-white/5" />
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4">
        {(Object.entries(EVENT_CONFIG) as [EventType, (typeof EVENT_CONFIG)[EventType]][]).map(
          ([key, config]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${config.dot}`} />
              {config.label}
            </div>
          )
        )}
      </div>

      {/* Timeline */}
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" />

        {SEMESTER_EVENTS.map((event) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;
          const status = getEventStatus(event);
          const days = getDaysUntil(event.startDate);

          return (
            <div
              key={event.id}
              className={`relative flex gap-4 py-2 ${
                status === "past" ? "opacity-50" : ""
              }`}
            >
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg} ${config.darkBg} ring-1 ${config.ring} transition-all ${
                    status === "ongoing"
                      ? "scale-110 ring-2 shadow-sm"
                      : ""
                  }`}
                >
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
              </div>

              {/* Content */}
              <div
                className={`flex flex-1 items-center justify-between rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-black/[0.04] transition-all dark:bg-gray-900 dark:ring-white/[0.06] ${
                  status === "ongoing"
                    ? `ring-2 ${config.ring}`
                    : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{event.title}</h3>
                    {status === "ongoing" && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-amber-500" />
                        进行中
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateRange(event.startDate, event.endDate)}
                  </p>
                  {event.description && (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* Days indicator */}
                <div className="ml-3 flex-shrink-0 text-right">
                  {status === "upcoming" && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">{days}天后</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  )}
                  {status === "past" && (
                    <span className="text-xs text-muted-foreground">已过</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 rounded-xl bg-indigo-500/5 p-3 text-xs text-muted-foreground ring-1 ring-indigo-500/10">
        <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <p>
          数据来源：四川大学教务处 2025-2026 学年校历。实际安排以学校正式通知为准。
        </p>
      </div>
    </div>
  );
}
