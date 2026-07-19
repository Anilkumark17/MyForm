import type {
  AnswerOption,
  QuestionConfig,
  SurveyQuestion,
} from "@/lib/survey/questions"

export const COMPARISON_SELECTION_MODES = [
  "single_select",
  "rank",
  "allocate",
  "rate_each",
] as const

export type ComparisonSelectionMode =
  (typeof COMPARISON_SELECTION_MODES)[number]

export const COMPARISON_REVEAL_MODES = ["side_by_side", "sequential"] as const

export type ComparisonRevealMode = (typeof COMPARISON_REVEAL_MODES)[number]

export const COMPARISON_OPTION_CONTENT_TYPES = [
  "image",
  "text",
  "image_text",
] as const

export type ComparisonOptionContentType =
  (typeof COMPARISON_OPTION_CONTENT_TYPES)[number]

export type ComparisonAnswer =
  | {
      mode: "single_select"
      selectedId: string
      sequentialReactions?: Record<string, string>
    }
  | {
      mode: "rank"
      order: string[]
      sequentialReactions?: Record<string, string>
    }
  | {
      mode: "allocate"
      points: Record<string, number>
      sequentialReactions?: Record<string, string>
    }
  | {
      mode: "rate_each"
      ratings: Record<string, number>
      sequentialReactions?: Record<string, string>
    }

export type ShowIfRule = {
  questionId: string
  /** Option id (or branch key) that must match for this question to show */
  equals: string
}

export function isComparisonQuestion(
  question: SurveyQuestion
): question is SurveyQuestion & { type: "comparison_choice" } {
  return question.type === "comparison_choice"
}

export function getSelectionMode(
  config: QuestionConfig
): ComparisonSelectionMode {
  const mode = config.selectionMode
  return COMPARISON_SELECTION_MODES.includes(mode as ComparisonSelectionMode)
    ? (mode as ComparisonSelectionMode)
    : "single_select"
}

export function getRevealMode(config: QuestionConfig): ComparisonRevealMode {
  const mode = config.revealMode
  return COMPARISON_REVEAL_MODES.includes(mode as ComparisonRevealMode)
    ? (mode as ComparisonRevealMode)
    : "side_by_side"
}

export function getOptionContentType(
  _option: AnswerOption
): ComparisonOptionContentType {
  return "image_text"
}

export function optionDisplayCaption(option: AnswerOption): string {
  return (option.caption ?? option.label).trim()
}

/** Value used for branching / adaptive follow-ups */
export function getComparisonBranchValue(answer: unknown): string | null {
  const parsed = parseComparisonAnswer(answer)
  if (!parsed) return null

  switch (parsed.mode) {
    case "single_select":
      return parsed.selectedId || null
    case "rank":
      return parsed.order[0] ?? null
    case "allocate": {
      let bestId: string | null = null
      let best = -Infinity
      for (const [id, points] of Object.entries(parsed.points)) {
        if (points > best) {
          best = points
          bestId = id
        }
      }
      return bestId
    }
    case "rate_each": {
      let bestId: string | null = null
      let best = -Infinity
      for (const [id, rating] of Object.entries(parsed.ratings)) {
        if (rating > best) {
          best = rating
          bestId = id
        }
      }
      return bestId
    }
  }
}

export function parseComparisonAnswer(value: unknown): ComparisonAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    // Legacy: plain option id string
    if (typeof value === "string" && value.trim()) {
      return { mode: "single_select", selectedId: value.trim() }
    }
    return null
  }

  const raw = value as Record<string, unknown>
  const mode = raw.mode

  if (mode === "single_select" && typeof raw.selectedId === "string") {
    return {
      mode: "single_select",
      selectedId: raw.selectedId,
      sequentialReactions: asStringMap(raw.sequentialReactions),
    }
  }

  if (mode === "rank" && Array.isArray(raw.order)) {
    return {
      mode: "rank",
      order: raw.order.map(String).filter(Boolean),
      sequentialReactions: asStringMap(raw.sequentialReactions),
    }
  }

  if (mode === "allocate" && raw.points && typeof raw.points === "object") {
    return {
      mode: "allocate",
      points: asNumberMap(raw.points),
      sequentialReactions: asStringMap(raw.sequentialReactions),
    }
  }

  if (mode === "rate_each" && raw.ratings && typeof raw.ratings === "object") {
    return {
      mode: "rate_each",
      ratings: asNumberMap(raw.ratings),
      sequentialReactions: asStringMap(raw.sequentialReactions),
    }
  }

  // Plain selected id object without mode
  if (typeof raw.selectedId === "string") {
    return {
      mode: "single_select",
      selectedId: raw.selectedId,
      sequentialReactions: asStringMap(raw.sequentialReactions),
    }
  }

  return null
}

export function isComparisonAnswerComplete(
  question: SurveyQuestion,
  answer: unknown
): boolean {
  const parsed = parseComparisonAnswer(answer)
  if (!parsed) return false
  const mode = getSelectionMode(question.config)
  const optionIds = new Set(question.options.map((o) => o.id))

  switch (mode) {
    case "single_select":
      return (
        parsed.mode === "single_select" && optionIds.has(parsed.selectedId)
      )
    case "rank":
      return (
        parsed.mode === "rank" &&
        parsed.order.length === question.options.length &&
        parsed.order.every((id) => optionIds.has(id))
      )
    case "allocate": {
      if (parsed.mode !== "allocate") return false
      const total = Object.values(parsed.points).reduce((s, n) => s + n, 0)
      return (
        Math.round(total) === 100 &&
        question.options.every((o) => typeof parsed.points[o.id] === "number")
      )
    }
    case "rate_each": {
      if (parsed.mode !== "rate_each") return false
      const min = question.config.rateMin ?? question.config.min ?? 1
      const max = question.config.rateMax ?? question.config.max ?? 5
      return question.options.every((o) => {
        const rating = parsed.ratings[o.id]
        return (
          typeof rating === "number" &&
          Number.isFinite(rating) &&
          rating >= min &&
          rating <= max
        )
      })
    }
  }
}

export function formatComparisonAnswer(
  question: SurveyQuestion,
  answer: unknown
): string {
  const parsed = parseComparisonAnswer(answer)
  if (!parsed) return "—"

  const labelFor = (id: string) =>
    question.options.find((o) => o.id === id)?.label ?? id

  switch (parsed.mode) {
    case "single_select":
      return labelFor(parsed.selectedId)
    case "rank":
      return parsed.order.map((id, i) => `${i + 1}. ${labelFor(id)}`).join(" → ")
    case "allocate":
      return Object.entries(parsed.points)
        .map(([id, pts]) => `${labelFor(id)}: ${pts}`)
        .join(", ")
    case "rate_each":
      return Object.entries(parsed.ratings)
        .map(([id, rating]) => `${labelFor(id)}: ${rating}`)
        .join(", ")
  }
}

/** Whether a question should be visible given current answers */
export function isQuestionVisible(
  question: SurveyQuestion,
  answers: Record<string, unknown>,
  allQuestions: SurveyQuestion[]
): boolean {
  const rule = question.config.showIf
  if (!rule?.questionId || !rule.equals) return true

  const source = allQuestions.find((q) => q.id === rule.questionId)
  if (!source) return true

  const raw = answers[rule.questionId]
  if (isComparisonQuestion(source)) {
    const branch = getComparisonBranchValue(raw)
    return branch === rule.equals
  }

  if (typeof raw === "string") return raw === rule.equals
  if (Array.isArray(raw)) return raw.map(String).includes(rule.equals)
  if (raw && typeof raw === "object" && "selectedId" in raw) {
    return String((raw as { selectedId: unknown }).selectedId) === rule.equals
  }
  return String(raw) === rule.equals
}

export function usesBeforeAfterSlider(question: SurveyQuestion): boolean {
  if (!isComparisonQuestion(question)) return false
  if (getSelectionMode(question.config) !== "single_select") return false
  if (question.options.length !== 2) return false
  if (question.config.beforeAfterSlider) return true
  return question.options.every(
    (o) => o.beforeAfterPair || (o.imageUrl && o.beforeImageUrl)
  )
}

function asStringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined
  const result: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" && raw.trim()) result[key] = raw.trim()
  }
  return Object.keys(result).length ? result : undefined
}

function asNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {}
  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    const num = Number(raw)
    if (Number.isFinite(num)) result[key] = num
  }
  return result
}
