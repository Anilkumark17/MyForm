import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { applyQuestionOp } from "../apply"
import { transformAgainstServerOps, transformQuestionOp } from "../transform"
import type { QuestionOp } from "../types"
import type { SurveyQuestion } from "@/lib/survey/questions"

function q(id: string, prompt: string): SurveyQuestion {
  return {
    id,
    type: "long_text",
    prompt,
    options: [],
    config: {},
  }
}

describe("question OT", () => {
  it("transforms concurrent inserts at the same index", () => {
    const client: QuestionOp = {
      type: "insert",
      index: 1,
      question: q("c", "client"),
    }
    const server: QuestionOp = {
      type: "insert",
      index: 1,
      question: q("s", "server"),
    }
    const transformed = transformQuestionOp(client, server, false)
    assert.equal(transformed.type, "insert")
    if (transformed.type === "insert") {
      assert.equal(transformed.index, 2)
    }
  })

  it("converges when both sides apply transformed ops", () => {
    let doc = [q("a", "A"), q("b", "B")]
    const clientOp: QuestionOp = {
      type: "update",
      questionId: "a",
      patch: { prompt: "A-client" },
    }
    const serverOp: QuestionOp = {
      type: "insert",
      index: 0,
      question: q("x", "X"),
    }

    // Server applies serverOp first
    const serverDoc = applyQuestionOp(doc, serverOp)
    const clientPrime = transformAgainstServerOps(clientOp, [serverOp])
    const converged = applyQuestionOp(serverDoc, clientPrime)

    // Client applies clientOp then transforms serverOp against it
    const clientDoc = applyQuestionOp(doc, clientOp)
    const serverPrime = transformQuestionOp(serverOp, clientOp, true)
    const convergedClient = applyQuestionOp(clientDoc, serverPrime)

    assert.deepEqual(
      converged.map((row) => row.id),
      convergedClient.map((row) => row.id)
    )
    assert.equal(
      converged.find((row) => row.id === "a")?.prompt,
      "A-client"
    )
  })
})
