import { api } from "./api";

export interface Course {
  course_name: string;
  teacher: string;
  weekday: number;
  start_section: number;
  end_section: number;
  location: string;
  weeks: string;
  course_type: string;
  campus?: string;
  building?: string;
  is_scheduled: boolean;
}

export interface Score {
  course_name: string;
  score: string;
  credit: number;
  gpa: number;
  semester: string;
  course_type: string;
  grade: string;
}

export interface CreditCategory {
  name: string;
  required_credits: number;
  earned_credits: number;
}

export interface PlanCompletion {
  total_required_credits: number;
  earned_credits: number;
  categories: CreditCategory[];
}

export interface ScheduleResponse {
  courses: Course[];
  semester: string;
}

export interface ScoresResponse {
  scores: Score[];
}

export async function getSchedule(semester?: string): Promise<ScheduleResponse> {
  const params = semester ? { semester } : {};
  const response = await api.get<ScheduleResponse>("/api/academic/schedule", { params });
  return response.data;
}

export async function getScores(): Promise<ScoresResponse> {
  const response = await api.get<ScoresResponse>("/api/academic/scores");
  return response.data;
}

export async function getPlanCompletion(): Promise<PlanCompletion> {
  const response = await api.get<PlanCompletion>("/api/academic/plan-completion");
  return response.data;
}
