import { SIGNAL_TOTAL_TIME } from "@/lib/fraud/constants"
import { textEntropy } from "@/lib/fraud/stats"

export type SubmissionSignals = {
  totalCompletionTimeMs: number
  perFieldTimeMs: Record<string, number>
  perFieldTextLength: Record<string, number>
  perFieldEntropyScore: Record<string, number>
}

export type SignalMap = Record<string, number>

export function buildSignalMap(signals: SubmissionSignals): SignalMap {
  const map: SignalMap = {
    [SIGNAL_TOTAL_TIME]: signals.totalCompletionTimeMs,
  }

  for (const [fieldId, value] of Object.entries(signals.perFieldTimeMs)) {
    map[`field_time:${fieldId}`] = value
  }
  for (const [fieldId, value] of Object.entries(signals.perFieldTextLength)) {
    map[`field_length:${fieldId}`] = value
  }
  for (const [fieldId, value] of Object.entries(
    signals.perFieldEntropyScore
  )) {
    map[`field_entropy:${fieldId}`] = value
  }

  return map
}

export function deriveFieldMetrics(answers: Record<string, unknown>): {
  perFieldTextLength: Record<string, number>
  perFieldEntropyScore: Record<string, number>
} {
  const perFieldTextLength: Record<string, number> = {}
  const perFieldEntropyScore: Record<string, number> = {}

  for (const [fieldId, raw] of Object.entries(answers)) {
    const text =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map(String).join(" ")
          : raw == null
            ? ""
            : String(raw)
    perFieldTextLength[fieldId] = text.length
    perFieldEntropyScore[fieldId] = textEntropy(text)
  }

  return { perFieldTextLength, perFieldEntropyScore }
}
