import { api } from "./api";

export interface Exam {
  id: number;
  course_name: string;
  exam_date: string;
  exam_time: string | null;
  location: string | null;
  exam_type: string;
  notes: string | null;
  days_remaining: number;
}

export interface ExamCreate {
  course_name: string;
  exam_date: string;
  exam_time?: string;
  location?: string;
  exam_type?: string;
  notes?: string;
}

export interface ReviewPlan {
  exam: string;
  days_remaining: number;
  plan: string;
}

export async function getExams(): Promise<Exam[]> {
  const { data } = await api.get<Exam[]>("/api/academic/exams");
  return data;
}

export async function createExam(exam: ExamCreate): Promise<Exam> {
  const { data } = await api.post<Exam>("/api/academic/exams", exam);
  return data;
}

export async function deleteExam(id: number): Promise<void> {
  await api.delete(`/api/academic/exams/${id}`);
}

export async function getReviewPlan(examId: number): Promise<ReviewPlan> {
  const { data } = await api.post<ReviewPlan>(`/api/academic/exams/${examId}/review-plan`);
  return data;
}
