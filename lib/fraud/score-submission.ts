import {
  answerPatternEntropy,
  isStraightLining,
} from "@/lib/fraud/answer-entropy"
import { computeAbsoluteTimeFloor } from "@/lib/fraud/absolute-floor"
import { compositeFraudScore } from "@/lib/fraud/composite"
import {
  ABSOLUTE_TIME_FLOOR_HARD_MIN_SECONDS,
  INSTANT_FLAG_MS,
  MEAN_UPDATE_EVERY,
  MIN_SAMPLES,
  ROLLING_WINDOW,
  STD_FLOOR_SECONDS,
  STRAIGHT_LINE_ENTROPY_FLOOR,
  Z_THRESHOLD_LOW,
  Z_THRESHOLD_REJECT,
  type FraudStatus,
} from "@/lib/fraud/constants"
import {
  appendSample,
  computeZScore,
  emptyWelfordState,
  sampleStd,
  type WelfordState,
} from "@/lib/fraud/welford"

export type ScoreSubmissionInput = {
  completionTimeSeconds: number
  answerPattern: unknown[]
  numQuestions: number
  wordCount?: number | null
  honeypotFilled?: boolean
  /** Prior survey Welford state (before this sample is appended). */
  priorStats: WelfordState
}

export type ScoreSubmissionResult = {
  status: FraudStatus
  zScore: number | null
  reasons: string[]
  trustScore: number
  absoluteTimeFloor: number
  answerEntropy: number
  straightLining: boolean
  compositeScore: number
  signalZScores: Record<string, number>
  /** Whether this sample should update running survey stats */
  shouldUpdateStats: boolean
  /** Next stats if shouldUpdateStats */
  nextStats: WelfordState
}

/**
 * Synchronous fraud scorer for one submission.
 * Call with survey's prior Welford state; update DB with nextStats when shouldUpdateStats.
 */
export function scoreSubmission(
  input: ScoreSubmissionInput
): ScoreSubmissionResult {
  const reasons: string[] = []
  const completionTimeSeconds = Math.max(
    0,
    Number(input.completionTimeSeconds) || 0
  )
  const absoluteTimeFloor = computeAbsoluteTimeFloor({
    numQuestions: input.numQuestions,
    wordCount: input.wordCount,
    hardMinSeconds: ABSOLUTE_TIME_FLOOR_HARD_MIN_SECONDS,
  })

  const prior = input.priorStats ?? emptyWelfordState()
  const nextStats = appendSample(
    prior,
    completionTimeSeconds,
    ROLLING_WINDOW,
    { updateMeanEvery: MEAN_UPDATE_EVERY }
  )

  // Instant honeypot / absurdly fast — reject without needing baseline
  if (input.honeypotFilled) {
    reasons.push("Honeypot field filled (likely bot).")
    return finalize({
      status: "rejected",
      zScore: null,
      reasons,
      trustScore: 0,
      absoluteTimeFloor,
      answerEntropy: answerPatternEntropy(input.answerPattern),
      straightLining: isStraightLining(
        input.answerPattern,
        STRAIGHT_LINE_ENTROPY_FLOOR
      ),
      signalZScores: {},
      shouldUpdateStats: false,
      nextStats: prior,
      completionTimeSeconds,
    })
  }

  if (completionTimeSeconds * 1000 < INSTANT_FLAG_MS) {
    reasons.push(
      `Completed in ${(completionTimeSeconds * 1000).toFixed(0)}ms (under ${INSTANT_FLAG_MS}ms).`
    )
    return finalize({
      status: "rejected",
      zScore: null,
      reasons,
      trustScore: 0,
      absoluteTimeFloor,
      answerEntropy: answerPatternEntropy(input.answerPattern),
      straightLining: isStraightLining(
        input.answerPattern,
        STRAIGHT_LINE_ENTROPY_FLOOR
      ),
      signalZScores: {},
      shouldUpdateStats: false,
      nextStats: prior,
      completionTimeSeconds,
    })
  }

  const answerEntropy = answerPatternEntropy(input.answerPattern)
  const straightLining = isStraightLining(
    input.answerPattern,
    STRAIGHT_LINE_ENTROPY_FLOOR
  )

  // Score against PRIOR frozen mean so the current sample does not contaminate itself.
  // Mean only refreshes every MEAN_UPDATE_EVERY clean responses.
  const baselineProgress = prior.windowTimes.length
  if (prior.sampleCount < MIN_SAMPLES) {
    reasons.push(
      `Building baseline (${baselineProgress}/${MIN_SAMPLES} samples) — mean updates every ${MEAN_UPDATE_EVERY} responses.`
    )
    return finalize({
      status: "insufficient_data",
      zScore: null,
      reasons,
      trustScore: 55,
      absoluteTimeFloor,
      answerEntropy,
      straightLining,
      signalZScores: {},
      shouldUpdateStats: true,
      nextStats,
      completionTimeSeconds,
    })
  }

  const zScore = computeZScore(
    completionTimeSeconds,
    prior,
    STD_FLOOR_SECONDS
  )
  const signalZScores: Record<string, number> = {}
  if (zScore != null) {
    signalZScores.completion_time = zScore
  }

  const belowAbsoluteFloor = completionTimeSeconds < absoluteTimeFloor
  const belowFlagZ = zScore != null && zScore < Z_THRESHOLD_LOW
  const belowRejectZ = zScore != null && zScore < Z_THRESHOLD_REJECT

  let status: FraudStatus = "normal"

  // Lower-tail fraud: BOTH z low AND under absolute floor
  if (belowRejectZ && belowAbsoluteFloor) {
    status = "rejected"
    reasons.push(
      `Rejected: z=${zScore!.toFixed(2)} < ${Z_THRESHOLD_REJECT} and time ${completionTimeSeconds.toFixed(1)}s < floor ${absoluteTimeFloor.toFixed(1)}s.`
    )
  } else if (belowFlagZ && belowAbsoluteFloor) {
    status = "flagged"
    reasons.push(
      `Flagged: z=${zScore!.toFixed(2)} < ${Z_THRESHOLD_LOW} and time ${completionTimeSeconds.toFixed(1)}s < floor ${absoluteTimeFloor.toFixed(1)}s.`
    )
  } else if (zScore != null && belowFlagZ && !belowAbsoluteFloor) {
    reasons.push(
      `Fast relative to peers (z=${zScore.toFixed(2)}) but above absolute floor ${absoluteTimeFloor.toFixed(1)}s — treated as normal.`
    )
  }

  // Secondary: straight-lining boosts confidence when already time-flagged
  if (straightLining && (status === "flagged" || status === "rejected")) {
    reasons.push(
      `Straight-lining detected (answer entropy ${answerEntropy.toFixed(2)}).`
    )
    if (status === "flagged") {
      status = "rejected"
      reasons.push("Upgraded to rejected due to time + straight-lining.")
    }
  } else if (straightLining) {
    reasons.push(
      `Low answer entropy (${answerEntropy.toFixed(2)}) noted; not enough alone to flag.`
    )
  }

  const compositeScore = compositeFraudScore(signalZScores)
  const trustScore = trustFromSignals(status, zScore, compositeScore)
  const shouldUpdateStats = status === "normal"

  return finalize({
    status,
    zScore,
    reasons:
      reasons.length > 0
        ? reasons
        : [
            `Normal: z=${zScore?.toFixed(2) ?? "n/a"}, time ${completionTimeSeconds.toFixed(1)}s, floor ${absoluteTimeFloor.toFixed(1)}s.`,
          ],
    trustScore,
    absoluteTimeFloor,
    answerEntropy,
    straightLining,
    signalZScores,
    shouldUpdateStats,
    nextStats: shouldUpdateStats ? nextStats : prior,
    completionTimeSeconds,
    compositeScore,
  })
}

function trustFromSignals(
  status: FraudStatus,
  zScore: number | null,
  composite: number
): number {
  if (status === "rejected") return 0
  if (status === "flagged") return 25
  if (status === "insufficient_data") return 55
  if (zScore == null) return 70
  // Lower (more negative) z → lower trust; clamp
  const fromZ = Math.max(0, Math.min(100, Math.round(100 + zScore * 15)))
  const fromComposite = Math.max(
    0,
    Math.min(100, Math.round(100 - composite * 15))
  )
  return Math.round((fromZ + fromComposite) / 2)
}

function finalize(
  result: Omit<ScoreSubmissionResult, "compositeScore"> & {
    completionTimeSeconds?: number
    compositeScore?: number
  }
): ScoreSubmissionResult {
  const compositeScore =
    result.compositeScore ?? compositeFraudScore(result.signalZScores)
  return {
    status: result.status,
    zScore: result.zScore,
    reasons: result.reasons,
    trustScore: result.trustScore,
    absoluteTimeFloor: result.absoluteTimeFloor,
    answerEntropy: result.answerEntropy,
    straightLining: result.straightLining,
    compositeScore,
    signalZScores: result.signalZScores,
    shouldUpdateStats: result.shouldUpdateStats,
    nextStats: result.nextStats,
  }
}

export function welfordStateFromProject(row: {
  fraudRunningMean?: number | null
  fraudRunningM2?: number | null
  fraudSampleCount?: number | null
  fraudPendingSinceMean?: number | null
  fraudWindowTimes?: number[] | null
}): WelfordState {
  return {
    runningMean: Number(row.fraudRunningMean) || 0,
    runningM2: Number(row.fraudRunningM2) || 0,
    sampleCount: Number(row.fraudSampleCount) || 0,
    pendingSinceMeanUpdate: Number(row.fraudPendingSinceMean) || 0,
    windowTimes: Array.isArray(row.fraudWindowTimes)
      ? row.fraudWindowTimes.filter((n) => Number.isFinite(n))
      : [],
  }
}

export function describeSurveyStats(state: WelfordState) {
  return {
    mean: state.runningMean,
    stddev: sampleStd(state, STD_FLOOR_SECONDS),
    sampleCount: state.sampleCount,
    windowSize: state.windowTimes.length,
    ready: state.sampleCount >= MIN_SAMPLES,
  }
}
