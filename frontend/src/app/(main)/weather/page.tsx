"use client";

import { useState, useEffect } from "react";
import {
  CloudSun,
  Thermometer,
  Droplets,
  Wind,
  Shirt,
  RefreshCw,
  Eye,
} from "lucide-react";
import { getWeather, type Weather } from "@/lib/weather";
import { WeatherSkeleton } from "@/components/ui/skeleton-cards";

export default function WeatherPage() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchWeather() {
    setLoading(true);
    setError("");
    try {
      const data = await getWeather("成都");
      setWeather(data);
    } catch {
      setError("获取天气信息失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeather();
  }, []);

  if (loading) {
    return <WeatherSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl bg-red-500/10 p-6 text-center text-sm text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
          {error}
          <button
            onClick={fetchWeather}
            className="mt-2 flex items-center gap-1 mx-auto text-xs underline hover:no-underline"
          >
            <RefreshCw className="h-3 w-3" /> 重试
          </button>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10">
            <CloudSun className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">天气穿衣</h1>
            <p className="text-xs text-muted-foreground">{weather.city} 实时天气</p>
          </div>
        </div>
        <button
          onClick={fetchWeather}
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
    </div>
  );
}
