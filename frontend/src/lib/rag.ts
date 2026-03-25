import { api } from "./api";

export interface RagQueryResult {
  answer: string;
  sources: Array<{ doc_name?: string; filename?: string; score?: number }>;
  usage?: Record<string, unknown> | null;
}

export async function queryRag(kbId: number, question: string, topK = 5): Promise<RagQueryResult> {
  const { data } = await api.post<RagQueryResult>(`/api/rag/kb/${kbId}/query`, { question, top_k: topK });
  return data;
}

export async function uploadDocument(kbId: number, file: File): Promise<{ id: number; filename: string; chunk_count: number; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/api/rag/kb/${kbId}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  const { data } = await api.get<KnowledgeBase[]>("/api/rag/kb");
  return data;
}

export async function createKnowledgeBase(name: string, description = ""): Promise<KnowledgeBase> {
  const { data } = await api.post<KnowledgeBase>("/api/rag/kb", { name, description });
  return data;
}

export async function deleteKnowledgeBase(kbId: number): Promise<void> {
  await api.delete(`/api/rag/kb/${kbId}`);
}
