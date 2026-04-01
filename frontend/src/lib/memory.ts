import { api } from "./api"

export interface MemoryItem {
  id: number
  key: string
  value: string
  confidence: number
  updated_at: string | null
}

export interface MemoryCategory {
  category: string
  label: string
  items: MemoryItem[]
}

export interface MemoriesResponse {
  categories: MemoryCategory[]
}

export async function getMemories(): Promise<MemoriesResponse> {
  const { data } = await api.get("/api/memories")
  return data
}

export async function deleteMemory(id: number): Promise<void> {
  await api.delete(`/api/memories/${id}`)
}
