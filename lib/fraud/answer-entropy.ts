/**
 * Shannon entropy of a multi-choice answer pattern (bits).
 * Near-zero entropy ⇒ straight-lining (same choice repeated).
 */
export function answerPatternEntropy(answers: unknown[]): number {
  const tokens = answers
    .map((value) => normalizeAnswerToken(value))
    .filter((token): token is string => Boolean(token))

  if (tokens.length === 0) return 0

  const freq = new Map<string, number>()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1)
  }

  let entropy = 0
  const n = tokens.length
  for (const count of freq.values()) {
    const p = count / n
    entropy -= p * Math.log2(p)
  }
  return entropy
}

export function isStraightLining(
  answers: unknown[],
  entropyFloor = 0.15
): boolean {
  if (answers.length < 3) return false
  return answerPatternEntropy(answers) <= entropyFloor
}

function normalizeAnswerToken(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const t = value.trim()
    return t.length ? t : null
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(String).join("|") || null
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (typeof obj.selectedId === "string") return obj.selectedId
    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }
  return null
}
