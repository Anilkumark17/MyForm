/** Minimum clean samples before z-score flagging is active. */
export const MIN_SAMPLES = 15

/**
 * Recompute survey mean / std only every N clean responses.
 * Window times still append every clean submission; the frozen mean is used for z-scores in between.
 */
export const MEAN_UPDATE_EVERY = 15

/** Std floor (seconds) — avoids divide-by-zero / over-sensitivity. */
export const STD_FLOOR_SECONDS = 2

/**
 * Cap running stats to the last N completion times.
 * See welford.ts for why we rebuild from the window instead of pure online remove.
 */
export const ROLLING_WINDOW = 200

/** Lower-tail z threshold for "flagged" (manual review). */
export const Z_THRESHOLD_LOW = -2.5

/** Stricter lower-tail z threshold for auto "rejected". */
export const Z_THRESHOLD_REJECT = -3.0

/** Hard minimum absolute floor when word count is unavailable. */
export const ABSOLUTE_TIME_FLOOR_HARD_MIN_SECONDS = 10

/** Assumed reading speed for absolute floor. */
export const WORDS_PER_MINUTE = 200

/** Minimum seconds expected per question (absolute floor). */
export const MIN_SECONDS_PER_QUESTION = 3

/** Instant bot / honeypot floor (ms) — still applied before z-score. */
export const INSTANT_FLAG_MS = 1500

/** Entropy near this ⇒ straight-lining on multi-choice. */
export const STRAIGHT_LINE_ENTROPY_FLOOR = 0.15

/** Legacy aliases used by dashboard / older scoring details. */
export const MIN_BASELINE_SAMPLES = MIN_SAMPLES
export const Z_OUTLIER_THRESHOLD = Math.abs(Z_THRESHOLD_LOW)
export const TRUST_SCORE_THRESHOLD = 40
export const BASELINE_STALE_MS = 6 * 60 * 60 * 1000
export const BASELINE_WINDOW = ROLLING_WINDOW
export const SIGNAL_TOTAL_TIME = "total_completion_time_seconds"

export type FraudStatus =
  | "insufficient_data"
  | "normal"
  | "flagged"
  | "rejected"
