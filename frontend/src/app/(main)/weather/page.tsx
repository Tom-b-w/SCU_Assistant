"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CloudSun,
  Thermometer,
  Droplets,
  Wind,
  Shirt,
  RefreshCw,
  Eye,
  Sunrise,
  Sunset,
  Sun,
  Gauge,
  Umbrella,
  Moon,
} from "lucide-react";
import { getWeather, type Weather } from "@/lib/weather";
import { getForecast, type ForecastResponse } from "@/lib/weatherforecast";
import { WeatherSkeleton } from "@/components/ui/skeleton-cards";

const WEEK_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDate(dateStr: string): { weekday: string; date: string } {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  let weekday: string;
  if (isToday) weekday = "今天";
  else if (isTomorrow) weekday = "明天";
  else weekday = WEEK_NAMES[d.getDay()];

  const month = d.getMonth() + 1;
  const day = d.getDate();
  return { weekday, date: `${month}/${day}` };
}

function parseTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

function getWeatherIcon(iconCode: string): string {
  const code = Number(iconCode);
  if (code === 100 || code === 900) return "☀️";
  if (code === 101 || code === 102) return "☁️";
  if (code === 103 || code === 104) return "⛅";
  if (code >= 300 && code < 400) return "🌦️";
  if (code >= 400 && code < 500) return "🌧️";
  if (code >= 500 && code < 600) return "🌨️";
  return "🌤️";
}

export default function WeatherPage() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [weatherData, forecastData] = await Promise.all([
        getWeather("成都"),
        getForecast("成都"),
      ]);
      setWeather(weatherData);
      setForecast(forecastData);
    } catch {
      setError("获取天气信息失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return <WeatherSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl bg-red-500/10 p-6 text-center text-sm text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
          {error}
          <button
            onClick={fetchAll}
            className="mt-2 flex items-center gap-1 mx-auto text-xs underline hover:no-underline"
          >
            <RefreshCw className="h-3 w-3" /> 重试
          </button>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const today = forecast?.daily[selectedDay];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10">
            <CloudSun className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">天气穿衣</h1>
            <p className="text-xs text-muted-foreground">{weather.city} · 实时天气与预报</p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {/* Main Weather Card */}
      <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 p-6 text-white shadow-lg shadow-sky-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">{weather.condition}</p>
            <p className="mt-1 text-6xl font-bold tracking-tight">
              {weather.temperature}<span className="text-3xl font-normal">&#176;C</span>
            </p>
            <p className="mt-1 text-sm opacity-80">
              体感 {weather.feels_like}&#176;C
            </p>
          </div>
          <div className="text-7xl opacity-80">
            {weather.icon || "🌤"}
          </div>
        </div>
      </div>

      {/* Detail Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "温度",
            value: `${weather.temperature}°C`,
            sub: `体感 ${weather.feels_like}°C`,
            icon: Thermometer,
            color: "text-red-500",
            bg: "bg-red-500/10",
          },
          {
            label: "湿度",
            value: `${weather.humidity}%`,
            sub: weather.humidity > 70 ? "偏潮湿" : "适宜",
            icon: Droplets,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "风向",
            value: weather.wind_direction,
            sub: `${weather.wind_scale} 级`,
            icon: Wind,
            color: "text-cyan-500",
            bg: "bg-cyan-500/10",
          },
          {
            label: "天况",
            value: weather.condition,
            sub: weather.city,
            icon: Eye,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
            >
              <div className={`inline-flex rounded-lg ${item.bg} p-2`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className="mt-2 text-lg font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Clothing Advice Card */}
      {weather.clothing_advice && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Shirt className="h-4 w-4 text-violet-500" />
            </div>
            <h3 className="font-semibold">穿衣建议</h3>
          </div>
          <div className="mt-3 space-y-2">
            {weather.clothing_advice.split("\n").map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ======= Forecast Section ======= */}
      {forecast && (
        <>
          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs font-semibold text-muted-foreground dark:bg-gray-950">
                未来天气预报
              </span>
            </div>
          </div>

          {/* Today's Highlight Card */}
          {today && (
            <div className="rounded-xl bg-gradient-to-br from-orange-500 via-sky-500 to-blue-600 p-6 text-white shadow-lg shadow-sky-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">
                    {`${formatDate(today.date).weekday} · ${formatDate(today.date).date}`}
                  </p>
                  <p className="mt-2 text-xs opacity-75">{today.condition_day}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-5xl font-bold">{today.temp_max}</span>
                    <span className="text-2xl font-light">/ {today.temp_min}°C</span>
                  </div>
                </div>
                <div className="text-7xl opacity-80">{getWeatherIcon(today.icon_day)}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/20 pt-4">
                <div className="text-center">
                  <Sunrise className="mx-auto h-4 w-4 opacity-75" />
                  <p className="mt-1 text-xs opacity-75">日出</p>
                  <p className="text-sm font-medium">{today.sunrise}</p>
                </div>
                <div className="text-center">
                  <Sunset className="mx-auto h-4 w-4 opacity-75" />
                  <p className="mt-1 text-xs opacity-75">日落</p>
                  <p className="text-sm font-medium">{today.sunset}</p>
                </div>
                <div className="text-center">
                  <Sun className="mx-auto h-4 w-4 opacity-75" />
                  <p className="mt-1 text-xs opacity-75">紫外线</p>
                  <p className="text-sm font-medium">{today.uv_index}</p>
                </div>
              </div>
            </div>
          )}

          {/* 7-Day Forecast */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <div className="border-b border-border/40 px-4 py-3">
              <h3 className="text-sm font-semibold">未来 7 天预报</h3>
            </div>
            <div className="divide-y divide-border/20">
              {forecast.daily.map((day, idx) => {
                const { weekday, date } = formatDate(day.date);
                const isSelected = selectedDay === idx;
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(idx)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${
                      isSelected ? "bg-sky-500/5 ring-1 ring-sky-500/20" : ""
                    }`}
                  >
                    <div className="w-12 shrink-0">
                      <p className={`text-sm font-medium ${isSelected ? "text-sky-600 dark:text-sky-400" : ""}`}>
                        {weekday}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{date}</p>
                    </div>
                    <span className="text-xl">{getWeatherIcon(day.icon_day)}</span>
                    <span className="min-w-[3rem] text-xs text-muted-foreground">{day.condition_day}</span>
                    <div className="flex flex-1 items-center gap-2">
                      <span className="w-8 text-right text-sm font-medium text-blue-500">{day.temp_min}°</span>
                      <div className="relative h-1.5 flex-1 rounded-full bg-gradient-to-r from-blue-400 to-red-400">
                        <div
                          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow"
                          style={{ left: `${((day.temp_min - 5) / 40) * 100}%` }}
                        />
                        <div
                          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
                          style={{ left: `${((day.temp_max - 5) / 40) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-medium text-red-500">{day.temp_max}°</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hourly Forecast */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            <div className="border-b border-border/40 px-4 py-3">
              <h3 className="text-sm font-semibold">逐小时预报</h3>
            </div>
            <div className="overflow-x-auto">
              <div className="flex gap-0 p-4">
                {forecast.hourly.map((hour, idx) => (
                  <div
                    key={idx}
                    className="flex min-w-[4rem] flex-col items-center gap-1.5 text-center"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {idx === 0 ? "现在" : parseTime(hour.time)}
                    </span>
                    <span className="text-lg">{getWeatherIcon(hour.icon)}</span>
                    <span className="text-sm font-medium">{hour.temp}°</span>
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Droplets className="h-2.5 w-2.5" />
                      {hour.humidity}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Cards */}
          {today && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "白天天气", value: today.condition_day, icon: Sun, color: "text-orange-500", bg: "bg-orange-500/10" },
                { label: "夜间天气", value: today.condition_night, icon: Moon, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                { label: "降雨量", value: `${today.precip} mm`, icon: Umbrella, color: "text-cyan-500", bg: "bg-cyan-500/10" },
                { label: "紫外线", value: today.uv_index, icon: Gauge, color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]"
                  >
                    <div className={`inline-flex rounded-lg ${item.bg} p-2`}>
                      <Icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <p className="mt-2 text-lg font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}