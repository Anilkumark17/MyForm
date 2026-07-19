import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeAbsoluteTimeFloor } from "../absolute-floor"
import { answerPatternEntropy } from "../answer-entropy"
import { compositeFraudScore } from "../composite"
import {
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

describe("scoreSubmission", () => {
  it("does not flag when n < MIN_SAMPLES", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MIN_SAMPLES - 1; i++) {
      state = appendSample(state, 30 + (i % 5), 200)
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
      state = appendSample(state, 40 + (i % 3), 200)
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

  it("does not flag a legitimate fast reader above the absolute floor", () => {
    let state = emptyWelfordState()
    // Mean ~60s with some spread
    for (let i = 0; i < MIN_SAMPLES + 10; i++) {
      state = appendSample(state, 55 + (i % 10), 200)
    }
    const floor = computeAbsoluteTimeFloor({
      numQuestions: 3,
      wordCount: 50,
    })
    // Fast relative to peers but still above absolute floor
    const time = Math.max(floor + 1, 20)
    const result = scoreSubmission({
      completionTimeSeconds: time,
      answerPattern: ["x", "y", "z"],
      numQuestions: 3,
      wordCount: 50,
      priorStats: state,
    })
    // Even if z is low, absolute floor guard should keep normal
    if (result.zScore != null && result.zScore < Z_THRESHOLD_LOW) {
      assert.equal(result.status, "normal")
    } else {
      assert.equal(result.status, "normal")
    }
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
