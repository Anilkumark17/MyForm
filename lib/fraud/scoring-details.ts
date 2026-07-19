import {
  INSTANT_FLAG_MS,
  MIN_BASELINE_SAMPLES,
  TRUST_SCORE_THRESHOLD,
  Z_OUTLIER_THRESHOLD,
} from "@/lib/fraud/constants"

export type ScoringMethod = "instant_rule" | "z_score" | "rule_fallback"

export type ScoringDetails = {
  method: ScoringMethod
  flaggedImmediately: boolean
  baselineUsed: boolean
  instantReason?: "honeypot" | "too_fast"
  zScores: Record<string, number>
  signalValues?: Record<string, number>
  trustScore: number
  flagStatus: "clean" | "flagged"
  thresholds: {
    trustScore: number
    zOutlier: number
    instantFlagMs: number
    minBaselineSamples: number
  }
  summary: string
}

export function buildInstantScoringDetails(input: {
  honeypotFieldFilled: boolean
  totalCompletionTimeMs: number
}): ScoringDetails {
  const instantReason: "honeypot" | "too_fast" = input.honeypotFieldFilled
    ? "honeypot"
    : "too_fast"

  return {
    method: "instant_rule",
    flaggedImmediately: true,
    baselineUsed: false,
    instantReason,
    zScores: {},
    trustScore: 0,
    flagStatus: "flagged",
    thresholds: {
      trustScore: TRUST_SCORE_THRESHOLD,
      zOutlier: Z_OUTLIER_THRESHOLD,
      instantFlagMs: INSTANT_FLAG_MS,
      minBaselineSamples: MIN_BASELINE_SAMPLES,
    },
    summary:
      instantReason === "honeypot"
        ? "Flagged instantly: honeypot field was filled (likely a bot)."
        : `Flagged instantly: completed in ${input.totalCompletionTimeMs}ms (under ${INSTANT_FLAG_MS}ms).`,
  }
}

export function buildZScoreScoringDetails(input: {
  baselineUsed: boolean
  zScores: Record<string, number>
  signalValues: Record<string, number>
  trustScore: number
  flagStatus: "clean" | "flagged"
  anyOutlier: boolean
}): ScoringDetails {
  const method: ScoringMethod = input.baselineUsed ? "z_score" : "rule_fallback"
  let summary = ""

  if (!input.baselineUsed) {
    summary = `Z-score baseline not ready yet (< ${MIN_BASELINE_SAMPLES} clean samples). Used rule-fallback trust score ${input.trustScore}.`
  } else if (input.anyOutlier) {
    summary = `Flagged by z-score: at least one signal had |z| > ${Z_OUTLIER_THRESHOLD}.`
  } else if (input.flagStatus === "flagged") {
    summary = `Flagged by z-score: trust score ${input.trustScore} is below ${TRUST_SCORE_THRESHOLD}.`
  } else {
    summary = `Clean by z-score: trust score ${input.trustScore} with no |z| > ${Z_OUTLIER_THRESHOLD}.`
  }

  return {
    method,
    flaggedImmediately: false,
    baselineUsed: input.baselineUsed,
    zScores: input.zScores,
    signalValues: input.signalValues,
    trustScore: input.trustScore,
    flagStatus: input.flagStatus,
    thresholds: {
      trustScore: TRUST_SCORE_THRESHOLD,
      zOutlier: Z_OUTLIER_THRESHOLD,
      instantFlagMs: INSTANT_FLAG_MS,
      minBaselineSamples: MIN_BASELINE_SAMPLES,
    },
    summary,
  }
}
