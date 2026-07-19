import {
  ABSOLUTE_TIME_FLOOR_HARD_MIN_SECONDS,
  MIN_SECONDS_PER_QUESTION,
  WORDS_PER_MINUTE,
} from "@/lib/fraud/constants"

export type AbsoluteFloorInput = {
  numQuestions: number
  /** Estimated words across prompts/options; omit if unknown */
  wordCount?: number | null
  hardMinSeconds?: number
  minSecondsPerQuestion?: number
  wordsPerMinute?: number
}

/**
 * Absolute completion-time floor (seconds).
 * Fraud is usually "too fast" — z-score alone is not enough for short forms.
 */
export function computeAbsoluteTimeFloor(input: AbsoluteFloorInput): number {
  const hardMin =
    input.hardMinSeconds ?? ABSOLUTE_TIME_FLOOR_HARD_MIN_SECONDS
  const perQ = input.minSecondsPerQuestion ?? MIN_SECONDS_PER_QUESTION
  const wpm = input.wordsPerMinute ?? WORDS_PER_MINUTE

  const questionFloor = Math.max(0, input.numQuestions) * perQ
  const words = Math.max(0, Number(input.wordCount) || 0)
  const readingFloor = words > 0 ? (words / wpm) * 60 : 0

  return Math.max(hardMin, questionFloor + readingFloor)
}

/** Rough word count from survey question prompts (and captions). */
export function estimateSurveyWordCount(
  questions: Array<{ prompt?: string; options?: Array<{ label?: string; caption?: string }> }>
): number {
  let words = 0
  for (const q of questions) {
    words += countWords(q.prompt ?? "")
    for (const opt of q.options ?? []) {
      words += countWords(opt.caption ?? opt.label ?? "")
    }
  }
  return words
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}
