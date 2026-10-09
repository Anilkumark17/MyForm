import type { SurveyQuestion } from "@/lib/survey/questions"
import { getSections, hasSections } from "@/lib/survey/conditional"

export type FormSettings = {
  /** Randomise question order (the first question of each section stays put) */
  shuffleQuestions: boolean
  showProgress: boolean
  /** Shown after submit; empty uses the default thank-you text */
  confirmationMessage: string
  acceptingResponses: boolean
  /** Shown when the form is closed or full */
  closedMessage: string
  /** Close the form after this many responses; null = unlimited */
  responseLimit: number | null
  /** Best effort: remember on this browser that the form was answered */
  limitOneResponse: boolean
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  shuffleQuestions: false,
  showProgress: true,
  confirmationMessage: "",
  acceptingResponses: true,
  closedMessage: "",
  responseLimit: null,
  limitOneResponse: false,
}

export const DEFAULT_CLOSED_MESSAGE =
  "This form is no longer accepting responses."

export function normalizeFormSettings(raw: unknown): FormSettings {
  const item =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const limit = Number(item.responseLimit)
  return {
    shuffleQuestions: item.shuffleQuestions === true,
    showProgress: item.showProgress !== false,
    confirmationMessage: String(item.confirmationMessage ?? "").slice(0, 1000),
    acceptingResponses: item.acceptingResponses !== false,
    closedMessage: String(item.closedMessage ?? "").slice(0, 500),
    responseLimit:
      Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null,
    limitOneResponse: item.limitOneResponse === true,
  }
}

/** Why the form cannot take another response, or null when it is open. */
export function closedReason(
  settings: FormSettings,
  responseCount: number
): string | null {
  if (!settings.acceptingResponses) {
    return settings.closedMessage.trim() || DEFAULT_CLOSED_MESSAGE
  }
  if (settings.responseLimit != null && responseCount >= settings.responseLimit) {
    return settings.closedMessage.trim() || DEFAULT_CLOSED_MESSAGE
  }
  return null
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed)
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Apply per-respondent randomisation. Section ids and routing stay valid
 * because the first question of every section never moves.
 */
export function applyShuffle(
  questions: SurveyQuestion[],
  settings: FormSettings,
  seed: number
): SurveyQuestion[] {
  let ordered = questions

  if (settings.shuffleQuestions) {
    if (hasSections(questions)) {
      ordered = getSections(questions).flatMap((section) => {
        const [first, ...rest] = section.questions
        return [first, ...seededShuffle(rest, seed + rest.length)]
      })
    } else if (!questions.some((q) => (q.config.branchOf?.length ?? 0) > 0)) {
      ordered = seededShuffle(questions, seed)
    }
  }

  return ordered.map((question, index) =>
    question.config.shuffleOptions && question.options.length > 1
      ? {
          ...question,
          options: seededShuffle(question.options, seed + index + 1),
        }
      : question
  )
}
