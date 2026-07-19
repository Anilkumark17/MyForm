import type { SurveyQuestion } from "@/lib/survey/questions"

export type ProjectFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type GenerateQuestionsState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  questions?: SurveyQuestion[]
  needsContext?: boolean
}

export type SaveQuestionsState = {
  error?: string
  ok?: boolean
}
