"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Brain,
  Utensils,
  MapPin,
  BookOpen,
  Clock,
  GraduationCap,
  Trash2,
  Loader2,
  Inbox,
} from "lucide-react";
import { getMemories, deleteMemory, type MemoryCategory } from "@/lib/memory";

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Brain; color: string; bgColor: string }
> = {
  taste: {
    icon: Utensils,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  campus: {
    icon: MapPin,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  major: {
    icon: GraduationCap,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  study_habit: {
    icon: BookOpen,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  schedule_pref: {
    icon: Clock,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
  },
};

function getConfig(category: string) {
  return (
    CATEGORY_CONFIG[category] ?? {
      icon: Brain,
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
    }
  );
}

export default function MemoryPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<MemoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  async function loadMemories() {
    setLoading(true);
    try {
      const data = await getMemories();
      setCategories(data.categories);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteMemory(id);
      setCategories((prev) =>
        prev
          .map((cat) => ({
            ...cat,
            items: cat.items.filter((item) => item.id !== id),
          }))
          .filter((cat) => cat.items.length > 0)
      );
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  const totalCount = categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
          <Brain className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">AI 记忆管理</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "加载中..." : `共 ${totalCount} 条记忆`}
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            加载记忆数据...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            还没有记忆数据
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            和 AI 聊天时提到的偏好会自动记录在这里
          </p>
        </div>
      )}

      {/* Categories */}
      {!loading &&
        categories.map((cat) => {
          const config = getConfig(cat.category);
          const Icon = config.icon;

          return (
            <div key={cat.category}>
              {/* Category header */}
              <div className="mb-2 flex items-center gap-2 px-1">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md ${config.bgColor}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                </div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {cat.label}
                </h3>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {cat.items.length}
                </span>
              </div>

              {/* Items */}
              <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
                {cat.items.map((item, i) => (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${
                      i > 0 ? "border-t border-border/30" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.key}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.value}
                      </p>
                    </div>
                    {item.updated_at && (
                      <span className="hidden shrink-0 text-[10px] text-muted-foreground/40 sm:block">
                        {new Date(item.updated_at).toLocaleDateString("zh-CN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950 disabled:opacity-50"
                      title="删除此记忆"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      {/* Info footer */}
      {!loading && categories.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/40">
          这些信息由 AI 从对话中自动提取，用于提供个性化回答
        </p>
      )}
    </div>
  );
}
