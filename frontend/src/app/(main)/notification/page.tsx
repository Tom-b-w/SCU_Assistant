"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  ExternalLink,
  Calendar,
  RefreshCw,
  Inbox,
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

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(source, 50, 0);
      setNotifications(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10">
            <Bell className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">校园通知</h1>
            <p className="text-xs text-muted-foreground">
              来自各部门的最新通知公告
            </p>
          </div>
        </div>
        <button
          onClick={fetchNotifications}
          className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>

      {/* Source Filter */}
      <div className="flex gap-1 rounded-xl bg-muted/30 p-1">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setSource(f.key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              source === f.key
                ? "bg-white text-foreground shadow-sm dark:bg-gray-800"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <Inbox className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">暂无通知</p>
        </div>
      ) : (
        <div className="stagger-children space-y-2">
          {notifications.map((n) => {
            const badge = SOURCE_BADGE[n.source] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
            return (
              <div
                key={n.id}
                className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition-all hover:shadow-md dark:bg-gray-900 dark:ring-white/[0.06]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{n.title}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge}`}>
                        {n.source}
                      </span>
                    </div>
                    {n.summary && (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {n.summary}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      {n.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(n.published_at).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  {n.url && (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
