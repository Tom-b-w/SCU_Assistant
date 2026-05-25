"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  ExternalLink,
  Calendar,
  RefreshCw,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { getNotifications, type NotificationItem } from "@/lib/notification";
import { Skeleton } from "@/components/ui/skeleton";

const SOURCE_FILTERS = [
  { key: undefined as string | undefined, label: "全部" },
  { key: "教务处", label: "教务处" },
  { key: "学工部", label: "学工部" },
  { key: "研究生院", label: "研究生院" },
];

const SOURCE_BADGE: Record<string, string> = {
  教务处: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  学工部: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  研究生院: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getNotifications(source, 50, 0);
      setNotifications(data);
    } catch {
      setError("获取通知失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      {/* 顶部标题区域 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Bell className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 dark:text-white">校园通知中心</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                实时查看学校最新公告
              </p>
            </div>
          </div>
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="rounded-lg px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-4 gap-2">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setSource(f.key)}
              className={`rounded-lg py-2 text-xs font-medium transition-all ${
                source === f.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-xs text-red-600 dark:text-red-300 flex-1">{error}</p>
          <button onClick={fetchNotifications} className="text-xs bg-white px-2 py-1 rounded-md border">
            重试
          </button>
        </div>
      )}

      {/* 列表区域 */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-10 text-center border border-gray-100 dark:border-gray-800">
            <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">暂无通知</p>
          </div>
        ) : (
          notifications.map((n) => {
            const badge = SOURCE_BADGE[n.source] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
            return (
              <div
                key={n.id}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {n.title}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${badge}`}>
                        {n.source}
                      </span>
                    </div>

                    {n.summary && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2.5">
                        {n.summary}
                      </p>
                    )}

                    <div className="flex items-center text-[11px] text-gray-400 dark:text-gray-500">
                      <Calendar className="h-3 w-3 mr-1" />
                      {n.published_at ? new Date(n.published_at).toLocaleDateString("zh-CN") : "-"}
                    </div>
                  </div>

                  {n.url && (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ExternalLink className="h-4 w-4 text-gray-500" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}