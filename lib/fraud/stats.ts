/** Shannon entropy of a string (bits). */
export function textEntropy(value: string): number {
  if (!value) return 0
  const freq = new Map<string, number>()
  for (const char of value) {
    freq.set(char, (freq.get(char) ?? 0) + 1)
  }
  let entropy = 0
  const len = value.length
  for (const count of freq.values()) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Population standard deviation; returns 0 when undefined. */
export function stddev(values: number[], avg = mean(values)): number {
  if (values.length < 2) return 0
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export function zScore(value: number, avg: number, deviation: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(avg)) return null
  if (!Number.isFinite(deviation) || deviation <= 0) return null
  return (value - avg) / deviation
}

export function trustScoreFromZScores(zScores: number[]): number {
  if (zScores.length === 0) return 50
  const avgAbs =
    zScores.reduce((sum, z) => sum + Math.abs(z), 0) / zScores.length
  return Math.max(0, Math.min(100, Math.round(100 - Math.min(100, avgAbs * 20))))
}
