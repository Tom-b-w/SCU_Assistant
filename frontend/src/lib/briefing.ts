import { api } from "./api";

export interface BriefingData {
  date: string;
  weekday: string;
  briefing: string;
  data: {
    weather: Record<string, unknown>;
    schedule_count: number;
    deadline_count: number;
    exam_count: number;
  };
}

export async function getBriefing(): Promise<BriefingData> {
  const { data } = await api.get<BriefingData>("/api/briefing");
  return data;
}
