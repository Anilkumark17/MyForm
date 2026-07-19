import type { Submission } from "@/lib/db/schema"
import { QUESTION_TYPE_MAP, type QuestionTypeId } from "@/lib/survey/question-types"
import type { SurveyQuestion } from "@/lib/survey/questions"

export type AnswerBucket = {
  label: string
  count: number
  percent: number
}

export type QuestionAggregate = {
  question: SurveyQuestion
  responseCount: number
  emptyCount: number
  kind: "choice" | "numeric" | "text" | "boolean" | "other"
  buckets: AnswerBucket[]
  numeric?: {
    min: number
    max: number
    avg: number
    median: number
  }
  textSamples: Array<{
    value: string
    count: number
    submissionIds: string[]
  }>
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "boolean") return false
  return String(value).trim().length === 0
}

export function formatAnswerValue(value: unknown): string {
  if (value == null) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) {
    return value.length ? value.map(String).join(", ") : "—"
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (typeof obj.selectedId === "string") return obj.selectedId
    if (Array.isArray(obj.order)) return obj.order.map(String).join(" → ")
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  const text = String(value).trim()
  return text.length ? text : "—"
}

function flattenAnswerTokens(value: unknown): string[] {
  if (isEmpty(value)) return []
  if (typeof value === "boolean") return [value ? "Yes" : "No"]
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  return [String(value).trim()].filter(Boolean)
}

function detectKind(type: QuestionTypeId): QuestionAggregate["kind"] {
  const choiceTypes = new Set([
    "single_select",
    "multi_select",
    "dropdown",
    "multi_select_dropdown",
    "yes_no",
    "image_choice",
    "ranked_choice",
    "likert",
    "emoji_scale",
    "ranking",
    "constant_sum",
    "consent_checkbox",
    "opt_in_toggle",
  ])
  const numericTypes = new Set([
    "number",
    "slider",
    "stepper",
    "currency",
    "percentage",
    "nps",
    "star_rating",
    "semantic_differential",
  ])
  const textTypes = new Set([
    "short_text",
    "long_text",
    "rich_text",
    "email",
    "phone",
    "name",
    "address",
    "date",
    "date_range",
    "time",
    "datetime",
  ])

  if (type === "consent_checkbox") return "boolean"
  if (choiceTypes.has(type)) return "choice"
  if (numericTypes.has(type)) return "numeric"
  if (textTypes.has(type)) return "text"
  return "other"
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function toBuckets(
  counts: Map<string, number>,
  total: number
): AnswerBucket[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({
      label,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
}

export function buildQuestionAggregates(
  questions: SurveyQuestion[],
  submissions: Submission[]
): QuestionAggregate[] {
  return questions.map((question) => {
    const kind = detectKind(question.type)
    const values = submissions.map((row) => row.answers?.[question.id])
    const nonEmpty = values.filter((value) => !isEmpty(value))
    const responseCount = nonEmpty.length
    const emptyCount = values.length - responseCount

    const counts = new Map<string, number>()
    const textMap = new Map<string, { count: number; submissionIds: string[] }>()
    const numbers: number[] = []

    submissions.forEach((row) => {
      const value = row.answers?.[question.id]
      if (isEmpty(value)) return

      if (kind === "numeric") {
        const num = Number(Array.isArray(value) ? value[0] : value)
        if (Number.isFinite(num)) numbers.push(num)
      }

      const tokens = flattenAnswerTokens(value)
      for (const token of tokens) {
        counts.set(token, (counts.get(token) ?? 0) + 1)
        const existing = textMap.get(token) ?? { count: 0, submissionIds: [] }
        existing.count += 1
        existing.submissionIds.push(row.id)
        textMap.set(token, existing)
      }
    })

    // For choice questions with defined options, include zero-count options.
    if (kind === "choice" && question.options.length > 0) {
      for (const option of question.options) {
        const label = option.value ?? option.label
        if (!counts.has(label) && !counts.has(option.label)) {
          counts.set(option.label, 0)
        }
      }
    }

    const buckets = toBuckets(counts, responseCount).filter((bucket) =>
      kind === "choice" ? true : bucket.count > 0
    )

    const textSamples = [...textMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, kind === "text" ? 40 : 12)
      .map(([value, meta]) => ({
        value,
        count: meta.count,
        submissionIds: meta.submissionIds,
      }))

    return {
      question,
      responseCount,
      emptyCount,
      kind,
      buckets,
      numeric:
        numbers.length > 0
          ? {
              min: Math.min(...numbers),
              max: Math.max(...numbers),
              avg:
                numbers.reduce((sum, n) => sum + n, 0) / numbers.length,
              median: median(numbers),
            }
          : undefined,
      textSamples,
    }
  })
}

export function questionTypeLabel(type: QuestionTypeId) {
  return QUESTION_TYPE_MAP[type]?.label ?? type
}
