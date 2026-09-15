import { INSTANT_FLAG_MS, MIN_SAMPLES } from "./constants"
import { scoreSubmission } from "./score-submission"
import {
  appendSample,
  emptyWelfordState,
  type WelfordState,
} from "./welford"

export type BinaryLabel = "legit" | "fake"

export type EvalCase = {
  name: string
  label: BinaryLabel
  completionTimeSeconds: number
  honeypotFilled?: boolean
  answerPattern?: unknown[]
}

export type FraudMetrics = {
  tp: number
  tn: number
  fp: number
  fn: number
  accuracy: number
  precision: number
  recall: number
  f1: number
  total: number
  failures: string[]
}

function appendEvery(state: WelfordState, x: number) {
  return appendSample(state, x, 200, { updateMeanEvery: 1 })
}

/** Healthy peer baseline ~60s ± small noise. */
export function buildBaseline(mean = 60, n = MIN_SAMPLES + 5): WelfordState {
  let state = emptyWelfordState()
  for (let i = 0; i < n; i++) {
    const noise = (i % 7) - 3
    state = appendEvery(state, mean + noise)
  }
  return state
}

function isPredictedFake(status: string): boolean {
  return status === "flagged" || status === "rejected"
}

function scoreCase(baseline: WelfordState, c: EvalCase) {
  return scoreSubmission({
    completionTimeSeconds: c.completionTimeSeconds,
    answerPattern: c.answerPattern ?? ["a", "b", "c", "d"],
    numQuestions: 4,
    wordCount: 80,
    honeypotFilled: Boolean(c.honeypotFilled),
    priorStats: baseline,
  })
}

export function runBinaryEval(
  baseline: WelfordState,
  cases: EvalCase[]
): FraudMetrics {
  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0
  const failures: string[] = []

  for (const c of cases) {
    const result = scoreCase(baseline, c)
    const predictedFake = isPredictedFake(result.status)

    if (c.label === "fake" && predictedFake) tp += 1
    else if (c.label === "legit" && !predictedFake) tn += 1
    else if (c.label === "legit" && predictedFake) {
      fp += 1
      failures.push(
        `FP ${c.name}: status=${result.status} z=${result.zScore?.toFixed(2)}`
      )
    } else {
      fn += 1
      failures.push(
        `FN ${c.name}: status=${result.status} z=${result.zScore?.toFixed(2)}`
      )
    }
  }

  const total = tp + tn + fp + fn
  const accuracy = total === 0 ? 0 : (tp + tn) / total
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall)

  return { tp, tn, fp, fn, accuracy, precision, recall, f1, total, failures }
}

/** Post-baseline labeled corpus covering major fraud / legit modes. */
export function buildEvalCorpus(): EvalCase[] {
  const legit: EvalCase[] = [
    { name: "legit-at-mean", label: "legit", completionTimeSeconds: 60 },
    { name: "legit-slightly-slow", label: "legit", completionTimeSeconds: 65 },
    { name: "legit-slow-reader", label: "legit", completionTimeSeconds: 90 },
    { name: "legit-careful", label: "legit", completionTimeSeconds: 120 },
    { name: "legit-mean-plus-1", label: "legit", completionTimeSeconds: 61 },
    { name: "legit-mean-plus-5", label: "legit", completionTimeSeconds: 65 },
    { name: "legit-mean-plus-10", label: "legit", completionTimeSeconds: 70 },
    { name: "legit-mean-plus-20", label: "legit", completionTimeSeconds: 80 },
    { name: "legit-long-form", label: "legit", completionTimeSeconds: 150 },
    { name: "legit-thoughtful", label: "legit", completionTimeSeconds: 100 },
  ]

  const fake: EvalCase[] = [
    { name: "fake-half-mean", label: "fake", completionTimeSeconds: 30 },
    { name: "fake-quarter-mean", label: "fake", completionTimeSeconds: 15 },
    { name: "fake-very-fast", label: "fake", completionTimeSeconds: 8 },
    { name: "fake-just-below-mean", label: "fake", completionTimeSeconds: 55 },
    { name: "fake-speed-run", label: "fake", completionTimeSeconds: 20 },
    { name: "fake-rapid", label: "fake", completionTimeSeconds: 25 },
    { name: "fake-sprint", label: "fake", completionTimeSeconds: 12 },
    { name: "fake-bot-ish", label: "fake", completionTimeSeconds: 5 },
    {
      name: "fake-honeypot",
      label: "fake",
      completionTimeSeconds: 60,
      honeypotFilled: true,
    },
    {
      name: "fake-instant-bot",
      label: "fake",
      completionTimeSeconds: INSTANT_FLAG_MS / 1000 / 2,
    },
    {
      name: "fake-straight-line-fast",
      label: "fake",
      completionTimeSeconds: 18,
      answerPattern: ["yes", "yes", "yes", "yes"],
    },
    { name: "fake-mean-minus-1", label: "fake", completionTimeSeconds: 59 },
  ]

  return [...legit, ...fake]
}

export function evaluateFraudDetectionAccuracy(): FraudMetrics {
  return runBinaryEval(buildBaseline(60), buildEvalCorpus())
}
