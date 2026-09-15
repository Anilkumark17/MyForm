import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { MEAN_UPDATE_EVERY, MIN_SAMPLES } from "../constants"
import {
  buildBaseline,
  buildEvalCorpus,
  evaluateFraudDetectionAccuracy,
  runBinaryEval,
} from "../eval-harness"
import { scoreSubmission } from "../score-submission"
import { appendSample, emptyWelfordState } from "../welford"

function isPredictedFake(status: string): boolean {
  return status === "flagged" || status === "rejected"
}

describe("fraud detection accuracy evaluation", () => {
  it("reports confusion matrix and accuracy on labeled post-baseline corpus", () => {
    const metrics = evaluateFraudDetectionAccuracy()

    console.log("\n=== Fraud detection eval (post-baseline) ===")
    console.log(`Cases: ${metrics.total}`)
    console.log(
      `TP=${metrics.tp} TN=${metrics.tn} FP=${metrics.fp} FN=${metrics.fn}`
    )
    console.log(`Accuracy:  ${(metrics.accuracy * 100).toFixed(1)}%`)
    console.log(`Precision: ${(metrics.precision * 100).toFixed(1)}%`)
    console.log(`Recall:    ${(metrics.recall * 100).toFixed(1)}%`)
    console.log(`F1:        ${(metrics.f1 * 100).toFixed(1)}%`)

    assert.equal(metrics.total, buildEvalCorpus().length)
    assert.ok(metrics.accuracy >= 0.9, `accuracy ${metrics.accuracy} below 90%`)
    assert.ok(metrics.recall >= 0.9, `recall ${metrics.recall} below 90%`)
    assert.ok(
      metrics.precision >= 0.9,
      `precision ${metrics.precision} below 90%`
    )
  })

  it("never labels z-score fakes during the first 15 clean baseline samples", () => {
    let state = emptyWelfordState()
    let labeledFake = 0
    for (let i = 0; i < MIN_SAMPLES; i++) {
      const result = scoreSubmission({
        completionTimeSeconds: 3,
        answerPattern: ["a", "b"],
        numQuestions: 3,
        wordCount: 40,
        priorStats: state,
      })
      if (isPredictedFake(result.status)) labeledFake += 1
      assert.equal(result.status, "insufficient_data")
      state = result.nextStats
    }
    assert.equal(labeledFake, 0)
    assert.equal(state.sampleCount, MIN_SAMPLES)
  })

  it("catches hard bots at 100% (honeypot + instant) before and after baseline", () => {
    const empty = emptyWelfordState()
    const ready = buildBaseline(60)

    for (const prior of [empty, ready]) {
      const honeypot = scoreSubmission({
        completionTimeSeconds: 45,
        answerPattern: ["a"],
        numQuestions: 3,
        honeypotFilled: true,
        priorStats: prior,
      })
      assert.equal(honeypot.status, "rejected")

      const instant = scoreSubmission({
        completionTimeSeconds: 0.5,
        answerPattern: ["a"],
        numQuestions: 3,
        priorStats: prior,
      })
      assert.equal(instant.status, "rejected")
    }
  })

  it("mean refresh cadence stays on MEAN_UPDATE_EVERY boundary", () => {
    let state = emptyWelfordState()
    for (let i = 0; i < MEAN_UPDATE_EVERY; i++) {
      state = appendSample(state, 40, 200, {
        updateMeanEvery: MEAN_UPDATE_EVERY,
      })
    }
    assert.equal(state.pendingSinceMeanUpdate, 0)
    assert.equal(state.sampleCount, MEAN_UPDATE_EVERY)

    state = appendSample(state, 10, 200, {
      updateMeanEvery: MEAN_UPDATE_EVERY,
    })
    assert.equal(state.pendingSinceMeanUpdate, 1)
    assert.equal(state.runningMean, 40)
  })

  it("runBinaryEval agrees with evaluateFraudDetectionAccuracy", () => {
    const a = evaluateFraudDetectionAccuracy()
    const b = runBinaryEval(buildBaseline(60), buildEvalCorpus())
    assert.deepEqual(a, b)
  })
})
