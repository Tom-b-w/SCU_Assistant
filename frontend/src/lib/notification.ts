import { api } from "./api";

export interface NotificationItem {
  id: number;
  title: string;
  source: string;
  url: string | null;
  summary: string | null;
  published_at: string | null;
}

export async function getNotifications(
  source?: string,
  limit = 20,
  offset = 0,
): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>("/api/notifications", {
    params: { source, limit, offset },
  });
  return data;
}
