"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "next-themes";
import { logout } from "@/lib/auth";
import {
  Settings,
  User,
  GraduationCap,
  LogOut,
  Moon,
  Bell,
  Shield,
  ChevronRight,
  Info,
  BookOpen,
  RefreshCw,
  Link2,
  Link2Off,
  Loader2,
  CheckCircle2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createQRCode,
  checkQRStatus,
  bindChaoxing,
  getBindStatus,
  unbindChaoxing,
  syncDeadlines,
  type BindStatus,
  type SyncResult,
} from "@/lib/chaoxing";

// ─── Chaoxing QR Modal ──────────────────────────────────────────────────────

function ChaoxingQRModal({
  onClose,
  onBound,
}: {
  onClose: () => void;
  onBound: () => void;
}) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("加载二维码...");
  const [phase, setPhase] = useState<"loading" | "waiting" | "scanned" | "done" | "error">("loading");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startQR();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startQR() {
    setPhase("loading");
    setStatusMsg("获取二维码...");
    try {
      const data = await createQRCode();
      setQrImage(data.qr_image_url);
      setSessionId(data.session_id);
      setPhase("waiting");
      setStatusMsg("请用学习通 App 扫码");

      pollRef.current = setInterval(async () => {
        try {
          const status = await checkQRStatus(data.session_id);
          if (status.status === 1) {
            setPhase("scanned");
            setStatusMsg("已扫码，请在手机上确认登录");
          } else if (status.status === 2) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("done");
            setStatusMsg("登录成功，正在绑定...");
            await bindChaoxing(data.session_id);
            setStatusMsg("绑定成功！");
            setTimeout(onBound, 800);
          } else if (status.status === 3) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("error");
            setStatusMsg("二维码已过期，请重试");
          }
        } catch {
          // ignore transient poll errors
        }
      }, 2000);
    } catch {
      setPhase("error");
      setStatusMsg("获取二维码失败，请检查网络");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
            <BookOpen className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">绑定学习通账号</h3>
            <p className="text-[11px] text-muted-foreground">扫码后可同步作业 DDL</p>
          </div>
        </div>

        {/* QR code area */}
        <div className="flex flex-col items-center">
          {phase === "loading" && (
            <div className="flex h-48 w-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {phase === "error" && (
            <div className="flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">{statusMsg}</p>
              <Button size="sm" variant="outline" onClick={startQR}>
                重新获取
              </Button>
            </div>
          )}
          {(phase === "waiting" || phase === "scanned") && qrImage && (
            <div className={`relative rounded-xl border-2 p-2 transition-all ${phase === "scanned" ? "border-orange-400" : "border-border/50"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImage} alt="学习通登录二维码" className="h-48 w-48 rounded-lg" />
              {phase === "scanned" && (
                <div className="absolute inset-2 flex items-center justify-center rounded-lg bg-orange-500/20 backdrop-blur-[2px]">
                  <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-orange-600 shadow-sm dark:bg-gray-900">
                    请在手机确认登录
                  </div>
                </div>
              )}
            </div>
          )}
          {phase === "done" && (
            <div className="flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">绑定成功！</p>
            </div>
          )}
          <p className={`mt-3 text-xs ${phase === "done" ? "text-emerald-600" : "text-muted-foreground"}`}>
            {statusMsg}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout: clearAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();

  // Chaoxing state
  const [bindStatus, setBindStatus] = useState<BindStatus | null>(null);
  const [bindLoading, setBindLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [unbinding, setUnbinding] = useState(false);

  useEffect(() => {
    loadBindStatus();
  }, []);

  async function loadBindStatus() {
    setBindLoading(true);
    try {
      const status = await getBindStatus();
      setBindStatus(status);
    } catch {
      // ignore
    } finally {
      setBindLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncDeadlines();
      setSyncResult(result);
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }

  async function handleUnbind() {
    setUnbinding(true);
    try {
      await unbindChaoxing();
      setBindStatus({ is_bound: false, cx_name: null, last_sync_at: null });
      setSyncResult(null);
    } catch {
      // ignore
    } finally {
      setUnbinding(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearAuth();
      router.push("/login");
    }
  }

  const settingGroups = [
    {
      title: "偏好设置",
      items: [
        {
          icon: Moon,
          label: "深色模式",
          description: "切换暗色/亮色主题",
          action: "toggle",
          disabled: false,
          active: theme === "dark",
          onToggle: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        {
          icon: Bell,
          label: "通知提醒",
          description: "DDL 到期提醒、课前提醒",
          action: "toggle",
          disabled: true,
        },
      ],
    },
    {
      title: "隐私与安全",
      items: [
        {
          icon: Shield,
          label: "AI 记忆管理",
          description: "查看和管理 AI 记住的偏好信息",
          action: "link",
          disabled: true,
        },
      ],
    },
    {
      title: "关于",
      items: [
        {
          icon: Info,
          label: "关于 SCU Assistant",
          description: "v0.1.0 · 四川大学计算机学院",
          action: "info",
          disabled: false,
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-500/10">
          <Settings className="h-5 w-5 text-gray-500" />
        </div>
        <h1 className="text-xl font-bold">设置</h1>
      </div>

      {/* User Profile Card */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C41230] to-[#E8173A] text-white shadow-lg shadow-[#C41230]/20">
            <User className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{user?.name || "未登录"}</h2>
            <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                {user?.student_id || "—"}
              </p>
              {(user?.major || user?.campus || user?.grade) && (
                <p className="text-xs">
                  {[user?.major, user?.grade ? `${user.grade}级` : null, user?.campus ? `${user.campus}校区` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chaoxing Integration */}
      <div>
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          第三方账号
        </h3>
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
          <div className="flex items-start gap-3 px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
              <BookOpen className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">学习通（超星）</p>
                {bindLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : bindStatus?.is_bound ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    已绑定
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    未绑定
                  </span>
                )}
              </div>
              {bindStatus?.is_bound ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bindStatus.cx_name && <span className="font-medium">{bindStatus.cx_name}</span>}
                  {bindStatus.last_sync_at && (
                    <span className="opacity-60">
                      {bindStatus.cx_name ? " · " : ""}最近同步：
                      {new Date(bindStatus.last_sync_at).toLocaleString("zh-CN", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  )}
                  {!bindStatus.last_sync_at && !bindStatus.cx_name && "绑定成功，可同步作业 DDL"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  绑定后可自动同步作业截止日期到 DDL 追踪
                </p>
              )}

              {/* Sync result */}
              {syncResult && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <Zap className="h-3 w-3" />
                  同步完成：发现 {syncResult.total_works} 个作业，新增 {syncResult.new_deadlines} 个 DDL，
                  跳过 {syncResult.skipped} 个
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col gap-1.5">
              {!bindLoading && bindStatus?.is_bound ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs rounded-lg"
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {syncing ? "同步中" : "同步 DDL"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg"
                    onClick={handleUnbind}
                    disabled={unbinding}
                  >
                    {unbinding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2Off className="h-3 w-3" />}
                    解绑
                  </Button>
                </>
              ) : (
                !bindLoading && (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                    onClick={() => setShowQRModal(true)}
                  >
                    <Link2 className="h-3 w-3" />
                    扫码绑定
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Setting Groups */}
      {settingGroups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {group.title}
          </h3>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.06]">
            {group.items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  onClick={item.onToggle}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border/30" : ""
                  } ${item.disabled ? "opacity-50" : "cursor-pointer hover:bg-muted/30"} transition-colors`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  {item.action === "toggle" && (
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${
                        item.active ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform ${
                          item.active ? "translate-x-4" : ""
                        }`}
                      />
                    </div>
                  )}
                  {item.action === "link" && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                  {item.disabled && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      开发中
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </Button>

      <p className="text-center text-xs text-muted-foreground/40">
        SCU Assistant v0.1.0 · Powered by AI · 四川大学计算机学院
      </p>

      {/* QR Modal */}
      {showQRModal && (
        <ChaoxingQRModal
          onClose={() => setShowQRModal(false)}
          onBound={() => {
            setShowQRModal(false);
            loadBindStatus();
          }}
        />
      )}
    </div>
  );
}
