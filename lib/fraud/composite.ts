/**
 * Extensible composite fraud magnitude from multiple z-scores.
 * composite = sqrt(sum(weight_i * z_i^2))
 */
export function compositeFraudScore(
  signals: Record<string, number>,
  weights?: Record<string, number>
): number {
  let sum = 0
  let used = 0
  for (const [name, z] of Object.entries(signals)) {
    if (!Number.isFinite(z)) continue
    const w = weights?.[name] ?? 1
    sum += w * z * z
    used += 1
  }
  if (used === 0) return 0
  return Math.sqrt(sum)
}
