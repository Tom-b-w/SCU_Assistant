import { api } from "./api"

export interface QuizQuestion {
  question: string
  question_type: "choice" | "short_answer" | "essay"
  options: string[] | null
  answer: string
  explanation: string
  source: string
}

export interface QuizResult {
  questions: QuizQuestion[]
  topic: string
  usage: { input_tokens: number; output_tokens: number } | null
}

export async function generateQuiz(
  kbId: number,
  topic: string,
  count: number,
  difficulty: "easy" | "medium" | "hard",
  questionType: "choice" | "short_answer" | "essay" | "mixed"
): Promise<QuizResult> {
  const { data } = await api.post("/api/quiz/generate", {
    kb_id: kbId,
    topic,
    count,
    difficulty,
    question_type: questionType,
  })
  return data
}
