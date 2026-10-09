import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildFlowGraph,
  connectOptionToTargets,
  disconnectOptionFromTargets,
  layoutFlow,
  parseBranchEdgeId,
  validateFlow,
  wouldCreateCycle,
} from "../flow-graph"
import type { SurveyQuestion } from "../questions"

function choice(
  id: string,
  options: Array<{ id: string; label: string }>
): SurveyQuestion {
  return {
    id,
    prompt: id,
    type: "single_select",
    options: options.map((option) => ({ id: option.id, label: option.label })),
    config: {},
  }
}

function text(id: string): SurveyQuestion {
  return { id, prompt: id, type: "long_text", options: [], config: {} }
}

const q1 = choice("q1", [
  { id: "opt-a", label: "Student" },
  { id: "opt-b", label: "Professional" },
])

describe("buildFlowGraph", () => {
  it("draws an option edge to each question in that answer's flow", () => {
    let questions = [q1, text("q2"), text("q3"), text("q4")]
    questions = connectOptionToTargets(questions, "q1", "opt-a", ["q2", "q3"])
    questions = connectOptionToTargets(questions, "q1", "opt-b", ["q4"])
    const branch = buildFlowGraph(questions).edges.filter(
      (edge) => edge.kind === "branch"
    )
    assert.deepEqual(
      branch.map((edge) => [edge.optionId, edge.target]),
      [
        ["opt-a", "q2"],
        ["opt-a", "q3"],
        ["opt-b", "q4"],
      ]
    )
  })

  it("chains questions inside a flow and skips them at top level", () => {
    const questions = connectOptionToTargets(
      [q1, text("q2"), text("q3"), text("q4")],
      "q1",
      "opt-a",
      ["q2", "q3"]
    )
    const sequence = buildFlowGraph(questions)
      .edges.filter((edge) => edge.kind === "sequence")
      .map((edge) => `${edge.source}->${edge.target}`)
    assert.deepEqual(sequence, ["q1->q4", "q2->q3"])
  })
})

describe("connect / disconnect", () => {
  it("disconnects only that answer's flow", () => {
    let questions = [q1, text("q2"), text("q3")]
    questions = connectOptionToTargets(questions, "q1", "opt-a", ["q2"])
    questions = connectOptionToTargets(questions, "q1", "opt-b", ["q3"])
    const cleared = disconnectOptionFromTargets(questions, "q1", "opt-a")
    assert.equal(cleared[1].config.branchOf, undefined)
    assert.equal(cleared[2].config.branchOf?.length, 1)
  })
})

describe("wouldCreateCycle", () => {
  it("rejects flows containing the source or an earlier question", () => {
    const questions = [q1, text("q2")]
    assert.equal(wouldCreateCycle(questions, "q2", ["q1"]), true)
    assert.equal(wouldCreateCycle(questions, "q1", ["q1"]), true)
    assert.equal(wouldCreateCycle(questions, "q1", ["q2"]), false)
  })
})

describe("layoutFlow", () => {
  it("assigns coordinates to every question", () => {
    const laid = layoutFlow([q1, text("q2")])
    assert.equal(typeof laid[0].config.flowX, "number")
    assert.equal(typeof laid[1].config.flowY, "number")
  })
})

describe("parseBranchEdgeId", () => {
  it("parses option-to-question ids", () => {
    assert.deepEqual(parseBranchEdgeId("opt:q1:opt-a:q:q2"), {
      sourceId: "q1",
      optionId: "opt-a",
      targetQuestionId: "q2",
    })
  })
})

describe("validateFlow", () => {
  it("reports no issues for a plain form", () => {
    assert.deepEqual(validateFlow([text("a"), text("b")]), [])
  })

  it("notes answers that have no flow", () => {
    const questions = connectOptionToTargets(
      [q1, text("q2")],
      "q1",
      "opt-a",
      ["q2"]
    )
    assert.equal(validateFlow(questions)[0]?.severity, "info")
  })
})
