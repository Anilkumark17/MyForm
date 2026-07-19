import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeAbsoluteTimeFloor } from "../absolute-floor"
import { answerPatternEntropy } from "../answer-entropy"
import { compositeFraudScore } from "../composite"
import {
  MEAN_UPDATE_EVERY,
  MIN_SAMPLES,
  STD_FLOOR_SECONDS,
  Z_THRESHOLD_LOW,
} from "../constants"
import { scoreSubmission } from "../score-submission"
import {
  appendSample,
  emptyWelfordState,
  sampleStd,
  welfordFromValues,
} from "../welford"

/** Force mean refresh every sample (unit tests that need a live baseline). */
function appendEvery(state: ReturnType<typeof emptyWelfordState>, x: number) {
  return appendSample(state, x, 200, { updateMeanEvery: 1 })
}

function batchSampleVariance(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / n
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
}

describe("Welford online algorithm", () => {
  it("matches batch sample variance on the same dataset", () => {
    const data = [12, 15, 14, 40, 18, 16, 13, 17, 19, 15, 14, 16, 200, 15, 14, 18]
    const state = welfordFromValues(data)
    const expectedVar = batchSampleVariance(data)
    const gotVar = state.runningM2 / (state.sampleCount - 1)
    assert.ok(Math.abs(gotVar - expectedVar) < 1e-9)
    assert.equal(state.sampleCount, data.length)
  })

  it("std floor prevents divide-by-zero sensitivity", () => {
    const state = welfordFromValues([10, 10, 10, 10, 10])
    const std = sampleStd(state, STD_FLOOR_SECONDS)
    assert.equal(std, STD_FLOOR_SECONDS)
  })
})

describe("Welford mean batching", () => {
  it("freezes mean between MEAN_UPDATE_EVERY samples", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MEAN_UPDATE_EVERY; i++) {
      state = appendSample(state, 40, 200, {
        updateMeanEvery: MEAN_UPDATE_EVERY,
      })
    }
    assert.equal(state.sampleCount, MEAN_UPDATE_EVERY)
    assert.equal(state.runningMean, 40)
    assert.equal(state.pendingSinceMeanUpdate, 0)

    const meanAfterFirstBatch = state.runningMean
    for (let i = 0; i < MEAN_UPDATE_EVERY - 1; i++) {
      state = appendSample(state, 10, 200, {
        updateMeanEvery: MEAN_UPDATE_EVERY,
      })
      assert.equal(state.runningMean, meanAfterFirstBatch)
      assert.equal(state.sampleCount, MEAN_UPDATE_EVERY)
      assert.equal(state.pendingSinceMeanUpdate, i + 1)
    }

    // 30th sample triggers rebuild including the fast times
    state = appendSample(state, 10, 200, {
      updateMeanEvery: MEAN_UPDATE_EVERY,
    })
    assert.equal(state.sampleCount, MEAN_UPDATE_EVERY * 2)
    assert.equal(state.pendingSinceMeanUpdate, 0)
    assert.ok(state.runningMean < meanAfterFirstBatch)
  })
})

describe("scoreSubmission", () => {
  it("does not flag when n < MIN_SAMPLES", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MIN_SAMPLES - 1; i++) {
      state = appendEvery(state, 30 + (i % 5))
    }
    const result = scoreSubmission({
      completionTimeSeconds: 2,
      answerPattern: ["a", "b", "c"],
      numQuestions: 5,
      wordCount: 100,
      priorStats: state,
    })
    assert.equal(result.status, "insufficient_data")
    assert.equal(result.zScore, null)
    assert.equal(result.shouldUpdateStats, true)
  })

  it("flags a genuinely fast fraudulent submission", () => {
    // Build a healthy baseline ~40s completions
    let state = emptyWelfordState()
    for (let i = 0; i < MIN_SAMPLES + 5; i++) {
      state = appendEvery(state, 40 + (i % 3))
    }
    const floor = computeAbsoluteTimeFloor({
      numQuestions: 5,
      wordCount: 200,
    })
    const result = scoreSubmission({
      completionTimeSeconds: Math.min(3, floor - 1),
      answerPattern: ["a", "b", "c", "d", "e"],
      numQuestions: 5,
      wordCount: 200,
      priorStats: state,
    })
    assert.ok(
      result.status === "flagged" || result.status === "rejected",
      `expected flagged/rejected, got ${result.status} z=${result.zScore}`
    )
    assert.ok(result.zScore != null && result.zScore < Z_THRESHOLD_LOW)
    assert.equal(result.shouldUpdateStats, false)
  })

  it("flags by z-score even when above the absolute floor", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MIN_SAMPLES + 10; i++) {
      state = appendEvery(state, 55 + (i % 10))
    }
    const floor = computeAbsoluteTimeFloor({
      numQuestions: 3,
      wordCount: 50,
    })
    // Far below peer mean → low z, but still above absolute floor
    const time = Math.max(floor + 1, 20)
    const result = scoreSubmission({
      completionTimeSeconds: time,
      answerPattern: ["x", "y", "z"],
      numQuestions: 3,
      wordCount: 50,
      priorStats: state,
    })
    assert.ok(result.zScore != null && result.zScore < Z_THRESHOLD_LOW)
    assert.ok(
      result.status === "flagged" || result.status === "rejected",
      `expected z-score flag, got ${result.status}`
    )
    assert.equal(result.shouldUpdateStats, false)
  })

  it("keeps at-or-above-mean completions as normal", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MIN_SAMPLES + 10; i++) {
      state = appendEvery(state, 55 + (i % 10))
    }
    // Slightly slower than peer mean → non-negative z → valid
    const result = scoreSubmission({
      completionTimeSeconds: 70,
      answerPattern: ["x", "y", "z"],
      numQuestions: 3,
      wordCount: 50,
      priorStats: state,
    })
    assert.ok(result.zScore == null || result.zScore >= Z_THRESHOLD_LOW)
    assert.equal(result.status, "normal")
    assert.equal(result.shouldUpdateStats, true)
  })

  it("does not label fakes during the first 15 with batched mean updates", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MIN_SAMPLES; i++) {
      const result = scoreSubmission({
        completionTimeSeconds: 5,
        answerPattern: ["a", "b"],
        numQuestions: 3,
        wordCount: 40,
        priorStats: state,
      })
      assert.equal(
        result.status,
        "insufficient_data",
        `sample ${i + 1} should stay in baseline`
      )
      assert.equal(result.zScore, null)
      state = result.nextStats
    }
    // 16th: baseline ready → negative z vs ~5s mean with a fast submit flags
    const after = scoreSubmission({
      completionTimeSeconds: 2,
      answerPattern: ["a", "b"],
      numQuestions: 3,
      wordCount: 40,
      priorStats: state,
    })
    assert.ok(after.zScore != null && after.zScore < 0)
    assert.ok(after.status === "flagged" || after.status === "rejected")
  })

  it("rejects honeypot instantly", () => {
    const result = scoreSubmission({
      completionTimeSeconds: 45,
      answerPattern: ["a"],
      numQuestions: 3,
      honeypotFilled: true,
      priorStats: emptyWelfordState(),
    })
    assert.equal(result.status, "rejected")
    assert.equal(result.shouldUpdateStats, false)
  })
})

describe("helpers", () => {
  it("computes absolute floor with hard minimum", () => {
    const floor = computeAbsoluteTimeFloor({
      numQuestions: 0,
      wordCount: 0,
    })
    assert.ok(floor >= 10)
  })

  it("detects low entropy straight-lining", () => {
    const entropy = answerPatternEntropy(["yes", "yes", "yes", "yes"])
    assert.ok(entropy < 0.15)
  })

  it("computes composite score from signal dict", () => {
    const score = compositeFraudScore({ completion_time: -3, other: 0 })
    assert.ok(Math.abs(score - 3) < 1e-9)
  })
})
