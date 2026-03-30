"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createQRCode, checkQRStatus, bindChaoxing, type QRCodeData } from "@/lib/chaoxing"

interface QRLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function QRLoginModal({ open, onClose, onSuccess }: QRLoginModalProps) {
  const [qrData, setQrData] = useState<QRCodeData | null>(null)
  const [status, setStatus] = useState<number>(0)
  const [message, setMessage] = useState("正在加载二维码...")
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startLogin = useCallback(async () => {
    stopPolling()
    setLoading(true)
    setStatus(0)
    setMessage("正在加载二维码...")
    try {
      const data = await createQRCode()
      setQrData(data)
      setMessage("请使用学习通 App 扫描二维码")

      pollRef.current = setInterval(async () => {
        try {
          const result = await checkQRStatus(data.session_id)
          setStatus(result.status)
          setMessage(result.message)

          if (result.status === 2) {
            stopPolling()
            await bindChaoxing(data.session_id)
            onSuccess()
          } else if (result.status === 3) {
            stopPolling()
          }
        } catch {
          // 轮询出错静默处理
        }
      }, 2000)
    } catch {
      setMessage("获取二维码失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [stopPolling, onSuccess])

  useEffect(() => {
    if (open) {
      startLogin()
    }
    return () => stopPolling()
  }, [open, startLogin, stopPolling])

  if (!open) return null

  const statusColor =
    status === 1 ? "text-blue-500"
    : status === 2 ? "text-green-500"
    : status === 3 ? "text-red-500"
    : "text-gray-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-[380px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">绑定学习通</h3>
          <button
            onClick={() => { stopPolling(); onClose() }}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-[200px] h-[200px] bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            {qrData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrData.qr_image_url}
                alt="学习通登录二维码"
                className="w-full h-full rounded-xl object-contain"
              />
            ) : (
              <div className="animate-pulse text-gray-400 text-sm">加载中...</div>
            )}
          </div>

          <p className={`text-sm font-medium ${statusColor}`}>
            {status === 1 && "📱 "}
            {status === 2 && "✅ "}
            {message}
          </p>

          {status === 3 && (
            <button
              onClick={startLogin}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "加载中..." : "刷新二维码"}
            </button>
          )}

          <div className="text-xs text-gray-400 text-center space-y-1">
            <p>1. 打开学习通 App</p>
            <p>2. 点击右上角扫一扫</p>
            <p>3. 扫描上方二维码并确认</p>
          </div>
        </div>
      </div>
    </div>
  )
}
