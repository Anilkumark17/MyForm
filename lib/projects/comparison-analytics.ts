import type { Submission } from "@/lib/db/schema"
import {
  formatComparisonAnswer,
  getSelectionMode,
  isComparisonQuestion,
  parseComparisonAnswer,
} from "@/lib/survey/comparison"
import type { SurveyQuestion } from "@/lib/survey/questions"

export type ComparisonOptionStat = {
  optionId: string
  label: string
  caption?: string
  imageUrl?: string
  /** Win count (single_select / rank #1) or sum for allocate/rate */
  value: number
  /** Percentage of wins or normalized share */
  percent: number
  average?: number
}

export type ComparisonSegmentBreakdown = {
  segment: string
  stats: ComparisonOptionStat[]
  responseCount: number
}

export type ComparisonAggregate = {
  question: SurveyQuestion
  selectionMode: ReturnType<typeof getSelectionMode>
  metricLabel: string
  totalResponses: number
  includedResponses: number
  flaggedExcluded: number
  winnerOptionId: string | null
  stats: ComparisonOptionStat[]
  segments: ComparisonSegmentBreakdown[]
  /** Cached-style payload for persistence if needed */
  cachePayload: {
    questionId: string
    selectionMode: string
    computedAt: string
    includeFlagged: boolean
    stats: ComparisonOptionStat[]
  }
}

function extractSource(submission: Submission): string | null {
  const direct = (submission as Submission & { source?: string | null }).source
  if (typeof direct === "string" && direct.trim()) return direct.trim()

  const answers = submission.answers ?? {}
  for (const key of ["utm_source", "source", "campaign", "utm_campaign"]) {
    const value = answers[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }

  for (const value of Object.values(answers)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>
      for (const key of ["utm_source", "source", "campaign"]) {
        if (typeof obj[key] === "string" && String(obj[key]).trim()) {
          return String(obj[key]).trim()
        }
      }
    }
  }

  return null
}

function emptyStats(question: SurveyQuestion): ComparisonOptionStat[] {
  return question.options.map((option) => ({
    optionId: option.id,
    label: option.label,
    caption: option.caption,
    imageUrl: option.imageUrl ?? option.beforeImageUrl,
    value: 0,
    percent: 0,
    average: 0,
  }))
}

function finalizeStats(
  question: SurveyQuestion,
  totals: Map<string, { value: number; sum: number; count: number }>,
  responseCount: number,
  mode: ReturnType<typeof getSelectionMode>
): ComparisonOptionStat[] {
  return question.options.map((option) => {
    const row = totals.get(option.id) ?? { value: 0, sum: 0, count: 0 }
    const average =
      mode === "allocate" || mode === "rate_each"
        ? row.count > 0
          ? row.sum / row.count
          : 0
        : undefined

    const displayValue =
      mode === "allocate" || mode === "rate_each"
        ? average ?? 0
        : row.value

    const percentBase =
      mode === "allocate" || mode === "rate_each"
        ? question.options.reduce((max, o) => {
            const t = totals.get(o.id)
            const avg = t && t.count > 0 ? t.sum / t.count : 0
            return Math.max(max, avg)
          }, 0) || 1
        : responseCount || 1

    const percent =
      mode === "allocate" || mode === "rate_each"
        ? Math.round((displayValue / percentBase) * 100)
        : responseCount > 0
          ? Math.round((row.value / responseCount) * 100)
          : 0

    return {
      optionId: option.id,
      label: option.label,
      caption: option.caption,
      imageUrl: option.imageUrl ?? option.beforeImageUrl,
      value: mode === "allocate" || mode === "rate_each" ? displayValue : row.value,
      percent,
      average,
    }
  })
}

function accumulate(
  question: SurveyQuestion,
  submissions: Submission[]
): {
  totals: Map<string, { value: number; sum: number; count: number }>
  responseCount: number
} {
  const mode = getSelectionMode(question.config)
  const totals = new Map<string, { value: number; sum: number; count: number }>()
  for (const option of question.options) {
    totals.set(option.id, { value: 0, sum: 0, count: 0 })
  }

  let responseCount = 0

  for (const submission of submissions) {
    const parsed = parseComparisonAnswer(submission.answers?.[question.id])
    if (!parsed) continue
    responseCount += 1

    if (mode === "single_select" && parsed.mode === "single_select") {
      const row = totals.get(parsed.selectedId)
      if (row) row.value += 1
    } else if (mode === "rank" && parsed.mode === "rank") {
      const top = parsed.order[0]
      const row = totals.get(top)
      if (row) row.value += 1
    } else if (mode === "allocate" && parsed.mode === "allocate") {
      for (const option of question.options) {
        const pts = parsed.points[option.id]
        if (typeof pts !== "number") continue
        const row = totals.get(option.id)
        if (!row) continue
        row.sum += pts
        row.count += 1
        row.value += pts
      }
    } else if (mode === "rate_each" && parsed.mode === "rate_each") {
      for (const option of question.options) {
        const rating = parsed.ratings[option.id]
        if (typeof rating !== "number") continue
        const row = totals.get(option.id)
        if (!row) continue
        row.sum += rating
        row.count += 1
        row.value += rating
      }
    }
  }

  return { totals, responseCount }
}

export function buildComparisonAggregate(
  question: SurveyQuestion,
  submissions: Submission[],
  options?: { includeFlagged?: boolean }
): ComparisonAggregate | null {
  if (!isComparisonQuestion(question)) return null

  const includeFlagged = Boolean(options?.includeFlagged)
  const totalResponses = submissions.filter(
    (row) => parseComparisonAnswer(row.answers?.[question.id]) != null
  ).length

  const flaggedExcluded = includeFlagged
    ? 0
    : submissions.filter(
        (row) =>
          row.flagStatus === "flagged" &&
          parseComparisonAnswer(row.answers?.[question.id]) != null
      ).length

  const pool = includeFlagged
    ? submissions
    : submissions.filter((row) => row.flagStatus !== "flagged")

  const mode = getSelectionMode(question.config)
  const { totals, responseCount } = accumulate(question, pool)
  const stats =
    responseCount === 0
      ? emptyStats(question)
      : finalizeStats(question, totals, responseCount, mode)

  const sorted = [...stats].sort((a, b) => b.value - a.value)
  const winnerOptionId = sorted[0] && sorted[0].value > 0 ? sorted[0].optionId : null

  const metricLabel =
    mode === "single_select" || mode === "rank"
      ? "Win rate"
      : mode === "allocate"
        ? "Avg points"
        : "Avg rating"

  const bySegment = new Map<string, Submission[]>()
  for (const row of pool) {
    if (!parseComparisonAnswer(row.answers?.[question.id])) continue
    const segment = extractSource(row)
    if (!segment) continue
    const list = bySegment.get(segment) ?? []
    list.push(row)
    bySegment.set(segment, list)
  }

  const segments: ComparisonSegmentBreakdown[] = [...bySegment.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([segment, rows]) => {
      const { totals: segTotals, responseCount: segCount } = accumulate(
        question,
        rows
      )
      return {
        segment,
        responseCount: segCount,
        stats: finalizeStats(question, segTotals, segCount, mode),
      }
    })

  return {
    question,
    selectionMode: mode,
    metricLabel,
    totalResponses,
    includedResponses: responseCount,
    flaggedExcluded,
    winnerOptionId,
    stats,
    segments,
    cachePayload: {
      questionId: question.id,
      selectionMode: mode,
      computedAt: new Date().toISOString(),
      includeFlagged,
      stats,
    },
  }
}

export function formatComparisonForList(
  question: SurveyQuestion,
  answer: unknown
): string {
  return formatComparisonAnswer(question, answer)
}
