import { api } from "./api";

export interface Deadline {
  id: number;
  title: string;
  course: string | null;
  due_date: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeadlineCreate {
  title: string;
  course?: string;
  due_date: string;
  priority?: "low" | "medium" | "high";
}

export interface DeadlineUpdate {
  title?: string;
  course?: string;
  due_date?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
}

export async function getDeadlines(completed?: boolean): Promise<Deadline[]> {
  const params: Record<string, string> = {};
  if (completed !== undefined) params.completed = String(completed);
  const response = await api.get<Deadline[]>("/api/deadlines", { params });
  return response.data;
}

export async function createDeadline(data: DeadlineCreate): Promise<Deadline> {
  const response = await api.post<Deadline>("/api/deadlines", data);
  return response.data;
}

export async function updateDeadline(id: number, data: DeadlineUpdate): Promise<Deadline> {
  const response = await api.patch<Deadline>(`/api/deadlines/${id}`, data);
  return response.data;
}

export async function deleteDeadline(id: number): Promise<void> {
  await api.delete(`/api/deadlines/${id}`);
}
