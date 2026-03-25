"use client";

import { Bus, ArrowRight, Clock, MapPin, Info, Phone } from "lucide-react";

interface BusRoute {
  id: number;
  route: string;
  from: string;
  to: string;
  schedules: { time: string; note?: string }[];
  weekendSchedules?: { time: string; note?: string }[];
  duration: string;
}

// 数据来源：四川大学教务处 https://jwc.scu.edu.cn/xcskb.htm
// 周末/节假日班次官网注明"按固定班次发班，具体见周末及节假日发班时刻表"，
// 官网未公开具体周末时刻，故暂不展示周末班次，避免误导。
const BUS_ROUTES: BusRoute[] = [
  {
    id: 1,
    route: "华西 → 江安",
    from: "华西校区",
    to: "江安校区",
    duration: "约50分钟",
    schedules: [
      { time: "07:10" }, { time: "08:00" }, { time: "09:00" },
      { time: "10:10" }, { time: "11:10" }, { time: "12:10" },
      { time: "13:55" }, { time: "14:45" }, { time: "15:35" },
      { time: "16:40" }, { time: "17:30" }, { time: "17:50" },
      { time: "18:10" }, { time: "18:25" }, { time: "19:35" },
      { time: "20:10" }, { time: "21:20" },
      { time: "22:15", note: "末班" },
    ],
  },
  {
    id: 2,
    route: "江安 → 华西",
    from: "江安校区",
    to: "华西校区",
    duration: "约50分钟",
    schedules: [
      { time: "07:00", note: "滚动发班至7:30" },
      { time: "08:05", note: "行政班" },
      { time: "09:10" }, { time: "09:30" }, { time: "10:05" },
      { time: "12:00" }, { time: "12:50" }, { time: "13:00" },
      { time: "14:55" }, { time: "15:45" }, { time: "16:25" },
      { time: "16:55" }, { time: "17:40" }, { time: "18:25" },
      { time: "18:50" }, { time: "19:50" }, { time: "21:10" },
      { time: "22:30", note: "末班" },
    ],
  },
  {
    id: 3,
    route: "望江 → 江安",
    from: "望江校区",
    to: "江安校区",
    duration: "约40分钟",
    schedules: [
      { time: "07:15" }, { time: "08:20" },
      { time: "12:10" }, { time: "13:00" },
      { time: "15:00" }, { time: "15:40" },
      { time: "16:50" }, { time: "17:30" },
      { time: "18:50" }, { time: "19:30" },
      { time: "20:10" },
      { time: "22:05", note: "末班" },
    ],
  },
  {
    id: 4,
    route: "江安 → 望江",
    from: "江安校区",
    to: "望江校区",
    duration: "约40分钟",
    schedules: [
      { time: "12:10" }, { time: "13:00" },
      { time: "14:45" }, { time: "15:35" },
      { time: "16:40" }, { time: "17:50" },
      { time: "18:10" }, { time: "19:35" },
      { time: "20:10" },
      { time: "21:20" },
      { time: "22:15", note: "末班" },
    ],
  },
];

function getNextBus(schedules: { time: string }[]): { time: string; minutesLeft: number } | null {
  const now = new Date();
  const hhmm = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  for (const s of schedules) {
    if (s.time > hhmm) {
      const [h, m] = s.time.split(":").map(Number);
      const diff = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
      return { time: s.time, minutesLeft: diff };
    }
  }
  return null;
}

export default function BusPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
            <Bus className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">校车时刻</h1>
            <p className="text-xs text-muted-foreground">校区间班车时刻表（工作日）</p>
          </div>
        </div>
      </div>

      {/* Route Cards */}
      <div className="space-y-3">
        {BUS_ROUTES.map((route) => {
          const schedules = route.schedules;
          const next = getNextBus(schedules);

          return (
            <div
              key={route.id}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
            >
              {/* Route Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="rounded-lg bg-cyan-500/10 px-2 py-1 text-cyan-600 dark:text-cyan-400">
                      {route.from.replace("校区", "").replace("西门", "").replace("北门", "")}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400">
                      {route.to.replace("校区", "").replace("西门", "").replace("北门", "")}
                    </span>
                  </div>
                </div>
                {next && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Clock className="h-3 w-3" />
                    {next.minutesLeft}分钟后
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {route.from} → {route.to}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {route.duration}
                </span>
              </div>

              {/* Schedule Grid */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {schedules.map((s, i) => {
                  const isNext = next?.time === s.time;
                  return (
                    <span
                      key={i}
                      className={`rounded-lg px-2.5 py-1 text-xs font-mono transition-all ${
                        isNext
                          ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {s.time}
                      {s.note && (
                        <span className="ml-1 text-[10px] opacity-70">{s.note}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-xl bg-cyan-500/5 p-3 text-xs text-muted-foreground ring-1 ring-cyan-500/10">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
          <div className="space-y-1">
            <p>
              以上为工作日固定班车发车时间，其余时间由调度根据实际情况临时安排。
              周末及节假日按固定班次发班，请以现场通知为准。
            </p>
            <p>
              数据来源：
              <a
                href="https://jwc.scu.edu.cn/xcskb.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 underline underline-offset-2 dark:text-cyan-400"
              >
                四川大学教务处
              </a>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p>
            车队总调度 85412179 · 望江点 85471138 · 华西点 85415183 · 江安点 18980697556 · 后勤监督 85405680
          </p>
        </div>
      </div>
    </div>
  );
}
