/**
 * Per-survey Welford online stats for completion-time fraud detection.
 *
 * Rolling window tradeoff:
 * True sliding-window Welford (add + remove in O(1)) needs careful M2 correction
 * and is easy to get wrong. We keep the last ROLLING_WINDOW samples and rebuild
 * mean/M2 from that window in O(N) with N≤200.
 *
 * Mean refresh cadence:
 * Completion times append on every clean response, but running mean / M2 / sampleCount
 * only rebuild every `updateMeanEvery` samples so the baseline does not drift
 * after each submission.
 */

export type WelfordState = {
  runningMean: number
  /** Welford M2 accumulator; sample variance = M2 / (n - 1) when n > 1 */
  runningM2: number
  sampleCount: number
  /** Last N completion times in seconds (newest last) */
  windowTimes: number[]
  /** Clean samples appended since the last mean rebuild */
  pendingSinceMeanUpdate: number
}

export function emptyWelfordState(): WelfordState {
  return {
    runningMean: 0,
    runningM2: 0,
    sampleCount: 0,
    windowTimes: [],
    pendingSinceMeanUpdate: 0,
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
    pendingSinceMeanUpdate: 0,
  }
}

export type AppendSampleOptions = {
  /**
   * Rebuild mean/M2/sampleCount only every N clean appends.
   * Default 1 = update every sample. Production uses MEAN_UPDATE_EVERY (15).
   */
  updateMeanEvery?: number
}

/**
 * Append one sample, cap to `windowSize`.
 * Mean/M2/sampleCount rebuild only on the update cadence (see options).
 */
export function appendSample(
  state: WelfordState,
  x: number,
  windowSize: number,
  options?: AppendSampleOptions
): WelfordState {
  if (!Number.isFinite(x)) return state
  const windowTimes = [...state.windowTimes, x]
  while (windowTimes.length > windowSize) {
    windowTimes.shift()
  }

  const every = Math.max(1, Math.floor(options?.updateMeanEvery ?? 1))
  const pendingSinceMeanUpdate = (state.pendingSinceMeanUpdate ?? 0) + 1
  const shouldRebuildMean = pendingSinceMeanUpdate >= every

  if (!shouldRebuildMean) {
    return {
      runningMean: state.runningMean,
      runningM2: state.runningM2,
      sampleCount: state.sampleCount,
      windowTimes,
      pendingSinceMeanUpdate,
    }
  }

  const rebuilt = welfordFromValues(windowTimes)
  return {
    ...rebuilt,
    windowTimes,
    pendingSinceMeanUpdate: 0,
  }
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
