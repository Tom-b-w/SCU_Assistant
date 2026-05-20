"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { login, getCaptcha } from "@/lib/auth";
import {
  guestCreateQRCode,
  guestCheckQRStatus,
  guestQRLogin,
  type QRCodeData,
} from "@/lib/chaoxing";
import {
  GraduationCap,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  KeyRound,
  QrCode,
} from "lucide-react";

type LoginTab = "password" | "qrcode";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [activeTab, setActiveTab] = useState<LoginTab>("password");

  // ---- Password login state ----
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // ---- QR login state ----
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [qrStatus, setQrStatus] = useState<number>(0);
  const [qrMessage, setQrMessage] = useState("正在加载二维码...");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Captcha ----
  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptcha("");
    try {
      const data = await getCaptcha();
      setSessionKey(data.session_key);
      setCaptchaImage(data.captcha_image);
    } catch {
      setError("获取验证码失败，请检查网络连接");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason === "session_expired") {
      setError("教务系统会话已过期，请重新登录以同步真实教务数据");
    } else if (reason === "auth_expired") {
      setError("登录状态已过期，请重新登录");
    }
  }, []);

  // ---- Password login handler ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({
        student_id: studentId,
        password,
        captcha,
        session_key: sessionKey,
      });
      setUser(data.user, data.access_token);
      router.push("/");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg =
        axiosErr.response?.data?.error?.message ||
        "登录失败，请检查学号、密码和验证码";
      setError(msg);
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  // ---- QR login logic ----
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startQRLogin = useCallback(async () => {
    stopPolling();
    setQrLoading(true);
    setQrStatus(0);
    setQrError("");
    setQrMessage("正在加载二维码...");
    setQrData(null);

    try {
      const data = await guestCreateQRCode();
      setQrData(data);
      setQrMessage("请使用学习通 App 扫描二维码");

      pollRef.current = setInterval(async () => {
        try {
          const result = await guestCheckQRStatus(data.session_id);
          setQrStatus(result.status);
          setQrMessage(result.message);

          if (result.status === 2) {
            stopPolling();
            // QR confirmed - authenticate via guest login endpoint
            try {
              const loginResult = await guestQRLogin(data.session_id);
              setUser(loginResult.user, loginResult.access_token);
              router.push("/");
            } catch {
              setQrError("登录失败，请重试");
              setQrMessage("登录失败");
            }
          } else if (result.status === 3) {
            stopPolling();
          }
        } catch {
          // polling error - silent
        }
      }, 2000);
    } catch {
      setQrMessage("获取二维码失败");
      setQrError("获取二维码失败，请检查网络连接");
    } finally {
      setQrLoading(false);
    }
  }, [stopPolling, setUser, router]);

  // Start QR login when switching to QR tab
  useEffect(() => {
    if (activeTab === "qrcode") {
      startQRLogin();
    }
    return () => stopPolling();
  }, [activeTab, startQRLogin, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const qrStatusColor =
    qrStatus === 1
      ? "text-blue-300"
      : qrStatus === 2
        ? "text-green-300"
        : qrStatus === 3
          ? "text-red-300"
          : "text-white/72";

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center animate-scale-in">
      {/* Logo & Branding */}
      <div className="mb-8 flex flex-col items-center text-white">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/14 shadow-2xl backdrop-blur-sm ring-1 ring-white/24">
          <GraduationCap className="h-10 w-10 text-[#D4A843]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">SCU Assistant</h1>
        <p className="mt-1 text-sm text-white/72">四川大学智能校园助手</p>
      </div>

      {/* Login Card - Glassmorphism */}
      <div className="w-full rounded-2xl border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.10))] p-8 shadow-[0_28px_70px_rgba(74,8,20,0.34)] backdrop-blur-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-white">欢迎回来</h2>
          <p className="mt-1 text-sm text-white/72">
            {activeTab === "password"
              ? "使用教务系统账号登录"
              : "使用学习通扫码登录"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 flex rounded-xl bg-white/[0.08] p-1 ring-1 ring-white/14">
          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              activeTab === "password"
                ? "bg-white/[0.16] text-white shadow-sm ring-1 ring-white/14"
                : "text-white/55 hover:text-white/75"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            密码登录
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qrcode")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              activeTab === "qrcode"
                ? "bg-white/[0.16] text-white shadow-sm ring-1 ring-white/14"
                : "text-white/55 hover:text-white/75"
            }`}
          >
            <QrCode className="h-4 w-4" />
            扫码登录
          </button>
        </div>

        {/* Password Login Tab */}
        {activeTab === "password" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="studentId"
                className="text-sm font-medium text-white/80"
              >
                学号
              </label>
              <Input
                id="studentId"
                placeholder="请输入学号"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                className="h-11 border-white/14 bg-white/[0.08] text-white placeholder:text-white/45 focus-visible:border-[#D4A843]/50 focus-visible:ring-[#D4A843]/30"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-white/80"
              >
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="教务系统密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-white/14 bg-white/[0.08] pr-10 text-white placeholder:text-white/45 focus-visible:border-[#D4A843]/50 focus-visible:ring-[#D4A843]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 transition-colors hover:text-white/85"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Captcha */}
            <div className="space-y-2">
              <label
                htmlFor="captcha"
                className="text-sm font-medium text-white/80"
              >
                验证码
              </label>
              <div className="flex gap-3">
                <Input
                  id="captcha"
                  placeholder="请输入验证码"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  required
                  className="h-11 flex-1 border-white/14 bg-white/[0.08] text-white placeholder:text-white/45 focus-visible:border-[#D4A843]/50 focus-visible:ring-[#D4A843]/30"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="relative flex h-11 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/14 bg-white/[0.08] transition-all hover:bg-white/[0.15]"
                  disabled={captchaLoading}
                >
                  {captchaLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-white/60" />
                  ) : captchaImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/${captchaImage.startsWith("iVBOR") ? "png" : "jpeg"};base64,${captchaImage}`}
                      alt="验证码"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-white/55">点击获取</span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-white/58">
                看不清？点击验证码图片刷新
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-11 w-full bg-gradient-to-r from-[#C41230] to-[#E8173A] font-medium text-white shadow-lg shadow-[#C41230]/25 transition-all hover:shadow-xl hover:shadow-[#C41230]/30 hover:brightness-110 disabled:opacity-50"
              disabled={loading || !captchaImage}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                "登 录"
              )}
            </Button>
          </form>
        )}

        {/* QR Code Login Tab */}
        {activeTab === "qrcode" && (
          <div className="flex flex-col items-center gap-5">
            {/* QR Code Display */}
            <div className="relative flex h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-white/[0.06]">
              {qrData ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrData.qr_image_url}
                    alt="学习通登录二维码"
                    className="h-full w-full rounded-xl object-contain"
                  />
                  {/* Scanned overlay */}
                  {qrStatus === 1 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 ring-1 ring-blue-400/30">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-300" />
                        </div>
                        <span className="text-sm font-medium text-blue-200">
                          请在手机上确认
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Success overlay */}
                  {qrStatus === 2 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 ring-1 ring-green-400/30">
                          <Sparkles className="h-6 w-6 text-green-300" />
                        </div>
                        <span className="text-sm font-medium text-green-200">
                          登录成功
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Expired overlay */}
                  {qrStatus === 3 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-sm text-white/75">
                          二维码已过期
                        </span>
                        <button
                          onClick={startQRLogin}
                          disabled={qrLoading}
                          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition-all hover:bg-white/20 disabled:opacity-50"
                        >
                          {qrLoading ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            "点击刷新"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : qrLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/45" />
              ) : (
                <button
                  onClick={startQRLogin}
                  className="text-sm text-white/58 transition-colors hover:text-white/78"
                >
                  点击加载二维码
                </button>
              )}
            </div>

            {/* Status Text */}
            <p className={`text-sm font-medium ${qrStatusColor}`}>
              {qrMessage}
            </p>

            {/* Error */}
            {qrError && (
              <div className="w-full rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300 ring-1 ring-red-500/20">
                {qrError}
              </div>
            )}

            {/* Instructions */}
            <div className="w-full space-y-2 rounded-xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/12">
              <p className="text-xs font-medium text-white/72">使用步骤</p>
              <div className="space-y-1.5 text-xs text-white/60">
                <p>1. 打开学习通 App</p>
                <p>2. 点击右上角扫一扫</p>
                <p>3. 扫描上方二维码并在手机上确认</p>
              </div>
            </div>
          </div>
        )}

        {/* Feature hints */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-white/[0.08] px-3 py-2 text-xs text-white/60 ring-1 ring-white/10">
          <Sparkles className="h-3 w-3" />
          <span>AI 驱动 · 课表查询 · DDL管理 · 食堂导航</span>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs tracking-[0.01em] text-white/52">
        Powered by AI · 四川大学计算机学院
      </p>
    </div>
  );
}
