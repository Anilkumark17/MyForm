import { eq } from "drizzle-orm"

import {
  estimateSurveyWordCount,
} from "@/lib/fraud/absolute-floor"
import { INSTANT_FLAG_MS, MIN_SAMPLES } from "@/lib/fraud/constants"
import {
  scoreSubmission,
  welfordStateFromProject,
} from "@/lib/fraud/score-submission"
import { deriveFieldMetrics } from "@/lib/fraud/signals"
import { parseSurveyQuestions } from "@/lib/survey/questions"
import { db } from "@/lib/db"
import {
  projects,
  submissions,
  type FlagStatus,
  type FraudStatus,
  type Submission,
} from "@/lib/db/schema"

export type IncomingSubmission = {
  formId: string
  answers: Record<string, unknown>
  totalCompletionTimeMs: number
  perFieldTimeMs: Record<string, number>
  honeypotFieldFilled: boolean
  source?: string | null
}

export type ProcessSubmissionResult = {
  submission: Submission
  flaggedImmediately: boolean
  baselineUsed: boolean
  zScores: Record<string, number>
  scoringDetails: Record<string, unknown>
  fraudStatus: FraudStatus
  zScore: number | null
  reasons: string[]
}

function resolveSource(
  answers: Record<string, unknown>,
  explicit?: string | null
): string | null {
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 255)
  for (const key of ["utm_source", "source", "campaign", "utm_campaign"]) {
    const value = answers[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 255)
    }
  }
  return null
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

function toFlagStatus(status: FraudStatus): FlagStatus {
  return status === "flagged" || status === "rejected" ? "flagged" : "clean"
}

function buildScoringDetails(input: {
  score: ReturnType<typeof scoreSubmission>
  totalCompletionTimeMs: number
  completionTimeSeconds: number
}): Record<string, unknown> {
  const { score } = input
  const method =
    score.status === "rejected" &&
    (score.reasons.some((r) => r.toLowerCase().includes("honeypot")) ||
      input.totalCompletionTimeMs < INSTANT_FLAG_MS)
      ? "instant_rule"
      : score.status === "insufficient_data"
        ? "insufficient_data"
        : "welford_z_score"

  return {
    method,
    fraudStatus: score.status,
    zScore: score.zScore,
    zScores: score.signalZScores,
    reasons: score.reasons,
    absoluteTimeFloorSeconds: score.absoluteTimeFloor,
    answerEntropy: score.answerEntropy,
    straightLining: score.straightLining,
    compositeScore: score.compositeScore,
    trustScore: score.trustScore,
    flagStatus: toFlagStatus(score.status),
    completionTimeSeconds: input.completionTimeSeconds,
    thresholds: {
      minSamples: MIN_SAMPLES,
      zFlag: -2.5,
      zReject: -3.0,
      instantFlagMs: INSTANT_FLAG_MS,
    },
    summary: score.reasons.join(" "),
  }
}

/**
 * Real-time fraud check on submit.
 * Timing is captured silently on the client; respondents never see scores.
 * Per-survey window times append on clean submits; mean/std refresh every 15.
 */
export async function processSubmission(
  input: IncomingSubmission
): Promise<ProcessSubmissionResult> {
  const [form] = await db
    .select({
      id: projects.id,
      questions: projects.questions,
      fraudRunningMean: projects.fraudRunningMean,
      fraudRunningM2: projects.fraudRunningM2,
      fraudSampleCount: projects.fraudSampleCount,
      fraudPendingSinceMean: projects.fraudPendingSinceMean,
      fraudWindowTimes: projects.fraudWindowTimes,
    })
    .from(projects)
    .where(eq(projects.id, input.formId))
    .limit(1)

  if (!form) {
    throw new Error("Form not found.")
  }

  const answers = input.answers ?? {}
  const perFieldTimeMs = asNumberMap(input.perFieldTimeMs)
  const { perFieldTextLength, perFieldEntropyScore } =
    deriveFieldMetrics(answers)
  const totalCompletionTimeMs = Math.max(
    0,
    Math.round(Number(input.totalCompletionTimeMs) || 0)
  )
  const completionTimeSeconds = totalCompletionTimeMs / 1000
  const honeypotFieldFilled = Boolean(input.honeypotFieldFilled)
  const source = resolveSource(answers, input.source)

  const questions = parseSurveyQuestions(form.questions)
  const answerPattern = Object.values(answers)
  const priorStats = welfordStateFromProject(form)

  const score = scoreSubmission({
    completionTimeSeconds,
    answerPattern,
    numQuestions: questions.length,
    wordCount: estimateSurveyWordCount(questions),
    honeypotFilled: honeypotFieldFilled,
    priorStats,
  })

  const flagStatus = toFlagStatus(score.status)
  const scoringDetails = buildScoringDetails({
    score,
    totalCompletionTimeMs,
    completionTimeSeconds,
  })

  const [submission] = await db
    .insert(submissions)
    .values({
      formId: input.formId,
      answers,
      source,
      totalCompletionTimeMs,
      perFieldTimeMs,
      perFieldTextLength,
      perFieldEntropyScore,
      honeypotFieldFilled,
      zScore: score.zScore,
      fraudStatus: score.status,
      trustScore: score.trustScore,
      flagStatus,
      scoringDetails,
    })
    .returning()

  // Update per-survey running stats after insert (silent to respondent)
  if (score.shouldUpdateStats) {
    await db
      .update(projects)
      .set({
        fraudRunningMean: score.nextStats.runningMean,
        fraudRunningM2: score.nextStats.runningM2,
        fraudSampleCount: score.nextStats.sampleCount,
        fraudPendingSinceMean: score.nextStats.pendingSinceMeanUpdate,
        fraudWindowTimes: score.nextStats.windowTimes,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, input.formId))
  }

  return {
    submission,
    flaggedImmediately:
      score.status === "rejected" &&
      (honeypotFieldFilled || totalCompletionTimeMs < INSTANT_FLAG_MS),
    baselineUsed: priorStats.sampleCount >= MIN_SAMPLES,
    zScores: score.signalZScores,
    scoringDetails,
    fraudStatus: score.status,
    zScore: score.zScore,
    reasons: score.reasons,
  }
}
