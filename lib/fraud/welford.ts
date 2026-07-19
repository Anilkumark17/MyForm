/**
 * Per-survey Welford online stats for completion-time fraud detection.
 *
 * Rolling window tradeoff:
 * True sliding-window Welford (add + remove in O(1)) needs careful M2 correction
 * and is easy to get wrong. We keep the last ROLLING_WINDOW samples and rebuild
 * mean/M2 from that window in O(N) with N≤200. That is correct, simple, and
 * cheap enough to run synchronously on every submission.
 */

export type WelfordState = {
  runningMean: number
  /** Welford M2 accumulator; sample variance = M2 / (n - 1) when n > 1 */
  runningM2: number
  sampleCount: number
  /** Last N completion times in seconds (newest last) */
  windowTimes: number[]
}

export function emptyWelfordState(): WelfordState {
  return {
    runningMean: 0,
    runningM2: 0,
    sampleCount: 0,
    windowTimes: [],
  }
}

/** Rebuild Welford state from a fixed window of observations. */
export function welfordFromValues(values: number[]): WelfordState {
  let mean = 0
  let m2 = 0
  let n = 0
  for (const x of values) {
    if (!Number.isFinite(x)) continue
    n += 1
    const delta = x - mean
    mean += delta / n
    const delta2 = x - mean
    m2 += delta * delta2
  }
  return {
    runningMean: mean,
    runningM2: m2,
    sampleCount: n,
    windowTimes: values.filter((v) => Number.isFinite(v)),
  }
}

/**
 * Append one sample, cap to `windowSize`, rebuild stats from the window.
 * Returns the updated state (does not mutate input).
 */
export function appendSample(
  state: WelfordState,
  x: number,
  windowSize: number
): WelfordState {
  if (!Number.isFinite(x)) return state
  const windowTimes = [...state.windowTimes, x]
  while (windowTimes.length > windowSize) {
    windowTimes.shift()
  }
  const rebuilt = welfordFromValues(windowTimes)
  return { ...rebuilt, windowTimes }
}

/** Sample standard deviation with optional floor to avoid over-sensitivity. */
export function sampleStd(
  state: WelfordState,
  stdFloor: number
): number {
  if (state.sampleCount < 2) return stdFloor
  const variance = state.runningM2 / (state.sampleCount - 1)
  const std = Math.sqrt(Math.max(0, variance))
  return Math.max(std, stdFloor)
}

export function computeZScore(
  x: number,
  state: WelfordState,
  stdFloor: number
): number | null {
  if (state.sampleCount < 2) return null
  const std = sampleStd(state, stdFloor)
  if (!Number.isFinite(std) || std <= 0) return null
  return (x - state.runningMean) / std
}
