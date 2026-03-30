import { api } from "./api"

export interface QRCodeData {
  session_id: string
  qr_image_url: string
}

export interface QRStatus {
  status: number // 0=未扫描, 1=已扫描待确认, 2=登录成功, 3=过期
  message: string
}

export interface BindStatus {
  is_bound: boolean
  cx_name: string | null
  last_sync_at: string | null
}

export interface SyncResult {
  total_works: number
  new_deadlines: number
  skipped: number
  courses: string[]
}

export async function createQRCode(): Promise<QRCodeData> {
  const { data } = await api.post("/api/chaoxing/qr/create")
  return data
}

export async function checkQRStatus(sessionId: string): Promise<QRStatus> {
  const { data } = await api.get(`/api/chaoxing/qr/status/${sessionId}`)
  return data
}

export async function bindChaoxing(sessionId: string): Promise<void> {
  await api.post(`/api/chaoxing/bind/${sessionId}`)
}

export async function getBindStatus(): Promise<BindStatus> {
  const { data } = await api.get("/api/chaoxing/status")
  return data
}

export async function unbindChaoxing(): Promise<void> {
  await api.delete("/api/chaoxing/unbind")
}

export async function syncDeadlines(): Promise<SyncResult> {
  const { data } = await api.post("/api/chaoxing/sync")
  return data
}
