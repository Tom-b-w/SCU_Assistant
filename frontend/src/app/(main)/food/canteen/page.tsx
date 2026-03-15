"use client";

import { useState } from "react";
import {
  UtensilsCrossed,
  MapPin,
  Clock,
  Coffee,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Window {
  name: string;
  floor: number;
  categories: string[];
  description?: string;
}

interface Canteen {
  id: number;
  name: string;
  campus: string;
  building: string;
  meals: {
    breakfast?: { open: string; close: string };
    lunch?: { open: string; close: string };
    dinner?: { open: string; close: string };
  };
  windows: Window[];
}

// Static data for SCU canteens
const CANTEENS: Canteen[] = [
  {
    id: 1,
    name: "江安第一食堂",
    campus: "江安",
    building: "学生活动中心旁",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:30" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["川菜", "家常菜"] },
      { name: "麻辣烫", floor: 1, categories: ["麻辣烫", "冒菜"] },
      { name: "面食窗口", floor: 1, categories: ["面条", "抄手", "饺子"] },
      { name: "清真窗口", floor: 2, categories: ["牛肉面", "拉面", "清真"] },
      { name: "砂锅窗口", floor: 2, categories: ["砂锅", "煲仔饭"] },
    ],
  },
  {
    id: 2,
    name: "江安第二食堂",
    campus: "江安",
    building: "第二教学楼旁",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:30" },
    },
    windows: [
      { name: "小炒窗口", floor: 1, categories: ["小炒", "川菜"] },
      { name: "粥粉面", floor: 1, categories: ["粥", "米线", "面"] },
      { name: "西餐简餐", floor: 2, categories: ["汉堡", "意面", "沙拉"] },
      { name: "铁板烧", floor: 2, categories: ["铁板饭", "铁板面"] },
    ],
  },
  {
    id: 3,
    name: "江安第三食堂（风华餐厅）",
    campus: "江安",
    building: "风华苑",
    meals: {
      lunch: { open: "11:00", close: "13:30" },
      dinner: { open: "17:00", close: "20:00" },
    },
    windows: [
      { name: "石锅拌饭", floor: 1, categories: ["韩餐", "石锅", "拌饭"] },
      { name: "烤肉饭", floor: 1, categories: ["烤肉", "日式"] },
      { name: "冒菜", floor: 1, categories: ["冒菜", "串串"] },
      { name: "鸡公煲", floor: 2, categories: ["鸡公煲", "焖锅"] },
      { name: "自选餐", floor: 2, categories: ["自选", "称重"] },
    ],
  },
  {
    id: 4,
    name: "望江基教食堂",
    campus: "望江",
    building: "基础教学楼B座旁",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "大伙窗口", floor: 1, categories: ["川菜", "家常"] },
      { name: "特色面食", floor: 1, categories: ["面条", "水饺"] },
      { name: "麻辣香锅", floor: 2, categories: ["香锅", "麻辣"] },
    ],
  },
  {
    id: 5,
    name: "望江南园食堂",
    campus: "望江",
    building: "南园宿舍区",
    meals: {
      breakfast: { open: "06:30", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:30" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["家常菜", "快餐"] },
      { name: "小吃街", floor: 1, categories: ["煎饼", "鸡蛋灌饼", "手抓饼"] },
      { name: "瓦罐汤", floor: 2, categories: ["汤", "煲汤"] },
    ],
  },
  {
    id: 6,
    name: "华西食堂",
    campus: "华西",
    building: "华西校区内",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "大伙窗口", floor: 1, categories: ["川菜", "快餐"] },
      { name: "面食窗口", floor: 1, categories: ["面条", "米线"] },
    ],
  },
];

function isOpen(meals: Canteen["meals"]): { open: boolean; currentMeal: string; nextMeal?: string } {
  const now = new Date();
  const hhmm = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  for (const [meal, time] of Object.entries(meals)) {
    if (time && hhmm >= time.open && hhmm <= time.close) {
      const labels: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
      return { open: true, currentMeal: labels[meal] || meal };
    }
  }

  // Find next meal
  const mealOrder = ["breakfast", "lunch", "dinner"];
  const labels: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
  for (const meal of mealOrder) {
    const time = meals[meal as keyof typeof meals];
    if (time && hhmm < time.open) {
      return { open: false, currentMeal: "", nextMeal: `${labels[meal]} ${time.open}` };
    }
  }
  return { open: false, currentMeal: "", nextMeal: "明日早餐" };
}

const MEAL_ICONS = { breakfast: Coffee, lunch: Sun, dinner: Moon };

export default function CanteenPage() {
  const [selectedCampus, setSelectedCampus] = useState<string>("全部");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const campuses = ["全部", "江安", "望江", "华西"];

  const filtered = selectedCampus === "全部"
    ? CANTEENS
    : CANTEENS.filter((c) => c.campus === selectedCampus);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
          <UtensilsCrossed className="h-5 w-5 text-rose-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">食堂导航</h1>
          <p className="text-xs text-muted-foreground">四川大学各校区食堂信息</p>
        </div>
      </div>

      {/* Campus Filter */}
      <div className="flex gap-1.5 rounded-xl bg-muted/30 p-1">
        {campuses.map((campus) => (
          <button
            key={campus}
            onClick={() => setSelectedCampus(campus)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              selectedCampus === campus
                ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {campus}
          </button>
        ))}
      </div>

      {/* Canteen Cards */}
      <div className="space-y-3">
        {filtered.map((canteen) => {
          const status = isOpen(canteen.meals);
          const expanded = expandedId === canteen.id;
          return (
            <div
              key={canteen.id}
              className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
            >
              {/* Main Info */}
              <button
                onClick={() => setExpandedId(expanded ? null : canteen.id)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    status.open
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{canteen.name}</h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        status.open
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {status.open ? `营业中 · ${status.currentMeal}` : `休息中`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {canteen.campus} · {canteen.building}
                    </span>
                    {!status.open && status.nextMeal && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        下一餐: {status.nextMeal}
                      </span>
                    )}
                  </div>
                </div>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {/* Expanded Details */}
              {expanded && (
                <div className="border-t border-border/30 px-4 pb-4">
                  {/* Meal Times */}
                  <div className="flex gap-3 py-3">
                    {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
                      const time = canteen.meals[meal];
                      const Icon = MEAL_ICONS[meal];
                      const labels = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
                      return (
                        <div
                          key={meal}
                          className={`flex flex-1 items-center gap-2 rounded-lg p-2 ${
                            time ? "bg-muted/30" : "bg-muted/10 opacity-40"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-[11px] font-medium">{labels[meal]}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {time ? `${time.open}-${time.close}` : "不供应"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Windows */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">窗口导览</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {canteen.windows.map((w, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-muted/20 p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{w.name}</span>
                            <span className="text-[10px] text-muted-foreground">{w.floor}F</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {w.categories.map((cat) => (
                              <span
                                key={cat}
                                className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/50 dark:bg-gray-800"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground/50">
        食堂数据为静态信息，营业时间可能因节假日调整
      </p>
    </div>
  );
}
