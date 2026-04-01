"use client";

import { useState, useMemo } from "react";
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

// 数据来源：四川大学后勤保障部、学生分享、知乎等综合信息
const CANTEENS: Canteen[] = [
  // ===== 江安校区 =====
  {
    id: 1,
    name: "西园一餐",
    campus: "江安",
    building: "西园生活区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["川菜", "家常菜"] },
      { name: "面食窗口", floor: 1, categories: ["面条", "抄手", "饺子"] },
      { name: "麻辣烫", floor: 1, categories: ["麻辣烫", "冒菜"] },
      { name: "特色炒菜", floor: 2, categories: ["小炒", "盖饭"] },
    ],
  },
  {
    id: 2,
    name: "西园二餐",
    campus: "江安",
    building: "西园生活区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "钵钵鸡", floor: 1, categories: ["钵钵鸡", "凉菜"] },
      { name: "炒菜·炒饭炒面", floor: 1, categories: ["炒菜", "炒饭", "炒面"] },
      { name: "菜品自选区", floor: 2, categories: ["自选", "荤素搭配"] },
      { name: "特色瓦罐菜", floor: 2, categories: ["瓦罐", "煲汤"] },
      { name: "抄手面饺子", floor: 2, categories: ["抄手", "面条", "饺子"] },
      { name: "甜水面", floor: 2, categories: ["甜水面", "特色小吃"] },
    ],
  },
  {
    id: 3,
    name: "西园小吃城",
    campus: "江安",
    building: "西园生活区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "23:00" },
    },
    windows: [
      { name: "各类小吃", floor: 1, categories: ["烧烤", "串串", "炸鸡"] },
      { name: "饮品甜点", floor: 1, categories: ["奶茶", "果汁", "甜品"] },
    ],
  },
  {
    id: 4,
    name: "西园牛肉馆",
    campus: "江安",
    building: "西园生活区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "牛肉面", floor: 1, categories: ["牛肉面", "牛杂面"] },
      { name: "牛肉系列", floor: 1, categories: ["红烧牛肉", "牛肉粉"] },
    ],
  },
  {
    id: 5,
    name: "西园清真食堂",
    campus: "江安",
    building: "西园生活区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "清真餐食", floor: 1, categories: ["清真", "牛肉面", "拉面"] },
    ],
  },
  {
    id: 6,
    name: "馨苑美食广场",
    campus: "江安",
    building: "西园生活区",
    meals: {
      lunch: { open: "11:00", close: "13:30" },
      dinner: { open: "16:00", close: "23:00" },
    },
    windows: [
      { name: "风味小吃", floor: 1, categories: ["小吃", "烧烤", "夜宵"] },
      { name: "特色档口", floor: 1, categories: ["冒菜", "串串", "炸物"] },
    ],
  },
  {
    id: 7,
    name: "东园食堂（江缘餐厅）",
    campus: "江安",
    building: "东园·教学区/研究生区附近",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "21:00" },
    },
    windows: [
      { name: "大众餐饮", floor: 1, categories: ["家常菜", "快餐"] },
      { name: "特色菜品", floor: 1, categories: ["川菜", "特价菜"] },
      { name: "风味小吃", floor: 2, categories: ["小吃", "面食", "粉"] },
    ],
  },
  // ===== 望江校区 =====
  {
    id: 8,
    name: "北园餐厅",
    campus: "望江",
    building: "西区·北园宿舍区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["川菜", "家常菜"] },
      { name: "特色菜品", floor: 2, categories: ["小炒", "盖饭"] },
    ],
  },
  {
    id: 9,
    name: "南园食堂",
    campus: "望江",
    building: "西区·南园宿舍区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["家常菜", "快餐"] },
      { name: "小吃窗口", floor: 1, categories: ["小吃", "面食"] },
    ],
  },
  {
    id: 10,
    name: "活动中心食堂",
    campus: "望江",
    building: "西区·学生活动中心",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "荤素热菜", floor: 1, categories: ["热菜", "卤菜", "烧菜"] },
      { name: "面食早点", floor: 1, categories: ["面条", "花卷", "油条"] },
    ],
  },
  {
    id: 11,
    name: "活动中心小吃城",
    campus: "望江",
    building: "西区·学生活动中心旁",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "21:00" },
    },
    windows: [
      { name: "牛肉面", floor: 1, categories: ["牛肉面", "豇豆面", "鸡杂面"] },
      { name: "早点", floor: 1, categories: ["花卷", "油饼", "油条"] },
      { name: "风味小吃", floor: 1, categories: ["小吃", "快餐"] },
    ],
  },
  {
    id: 12,
    name: "东一食堂",
    campus: "望江",
    building: "东区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["川菜", "家常菜"] },
      { name: "特色窗口", floor: 1, categories: ["盖饭", "套餐"] },
    ],
  },
  {
    id: 13,
    name: "桃园餐厅",
    campus: "望江",
    building: "东区·桃园",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "自选菜品", floor: 1, categories: ["自选", "凉菜", "卤菜"] },
      { name: "炒菜汤菜", floor: 1, categories: ["炒菜", "汤菜"] },
    ],
  },
  {
    id: 14,
    name: "桃园面馆",
    campus: "望江",
    building: "东区·桃园餐厅旁",
    meals: {
      lunch: { open: "08:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:30" },
    },
    windows: [
      { name: "各类面食", floor: 1, categories: ["面条", "米线", "抄手"] },
    ],
  },
  {
    id: 15,
    name: "东园餐厅",
    campus: "望江",
    building: "东区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "辣子鸡·特色菜", floor: 1, categories: ["辣子鸡", "山药鸡"] },
      { name: "汤品", floor: 1, categories: ["番茄汤", "海带猪蹄汤"] },
    ],
  },
  // ===== 华西校区 =====
  {
    id: 16,
    name: "华西食堂",
    campus: "华西",
    building: "华西校区",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "19:00" },
    },
    windows: [
      { name: "基本大伙", floor: 1, categories: ["川菜", "快餐"] },
      { name: "小自助", floor: 2, categories: ["自助", "自选"] },
      { name: "小炒·铁板烧", floor: 2, categories: ["小炒", "铁板烧"] },
      { name: "冒菜·面食", floor: 2, categories: ["冒菜", "面条", "米线"] },
    ],
  },
  {
    id: 17,
    name: "华西东苑小吃城",
    campus: "华西",
    building: "华西校区·东苑",
    meals: {
      breakfast: { open: "07:00", close: "09:00" },
      lunch: { open: "11:00", close: "13:00" },
      dinner: { open: "17:00", close: "21:00" },
    },
    windows: [
      { name: "风味小吃", floor: 1, categories: ["小吃", "烧烤", "炸物"] },
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
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const campuses = ["全部", "江安", "望江", "华西"];

  // Recompute visible categories based on selected campus so the category
  // filter only shows categories that exist in the current campus selection.
  const visibleCategories = useMemo(() => {
    const source =
      selectedCampus === "全部"
        ? CANTEENS
        : CANTEENS.filter((c) => c.campus === selectedCampus);
    const catSet = new Set<string>();
    for (const canteen of source) {
      for (const w of canteen.windows) {
        for (const cat of w.categories) {
          catSet.add(cat);
        }
      }
    }
    return Array.from(catSet);
  }, [selectedCampus]);

  const filtered = CANTEENS.filter((c) => {
    if (selectedCampus !== "全部" && c.campus !== selectedCampus) return false;
    if (selectedCategory !== "全部") {
      const hasCategory = c.windows.some((w) =>
        w.categories.includes(selectedCategory)
      );
      if (!hasCategory) return false;
    }
    return true;
  });

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
            onClick={() => {
              setSelectedCampus(campus);
              setSelectedCategory("全部");
            }}
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

      {/* Category Filter */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted/30 p-2">
        {["全部", ...visibleCategories].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
              selectedCategory === cat
                ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
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
        数据综合自后勤保障部及学生分享，窗口档口可能随学期调整，营业时间因节假日可能变化
      </p>
    </div>
  );
}
