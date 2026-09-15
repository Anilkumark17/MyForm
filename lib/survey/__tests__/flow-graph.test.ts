import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildFlowGraph,
  connectOptionToTargets,
  createQuestionGroup,
  disconnectOptionFromTargets,
  layoutFlow,
  parseBranchEdgeId,
  validateFlow,
  wouldCreateCycle,
} from "../flow-graph"
import type { SurveyQuestion } from "../questions"

function choice(
  id: string,
  prompt: string,
  options: Array<{ id: string; label: string }>,
  extra: Partial<SurveyQuestion["config"]> = {}
): SurveyQuestion {
  return {
    id,
    prompt,
    type: "single_select",
    options: options.map((option) => ({ id: option.id, label: option.label })),
    config: extra,
  }
}

function text(
  id: string,
  prompt: string,
  extra: Partial<SurveyQuestion["config"]> = {}
): SurveyQuestion {
  return {
    id,
    prompt,
    type: "long_text",
    options: [],
    config: extra,
  }
}

const q1 = choice("q1", "What type of user are you?", [
  { id: "opt-a", label: "Student" },
  { id: "opt-b", label: "Professional" },
])

describe("buildFlowGraph", () => {
  it("draws option edges onto the matching follow-ups", () => {
    const student = text("q2", "What are you studying?", {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
      },
    })
    const pro = text("q5", "What is your job role?", {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-b"] }],
      },
    })
    const { edges } = buildFlowGraph([q1, student, pro])
    const labels = edges
      .filter((edge) => edge.kind === "branch")
      .map((edge) => `${edge.label}->${edge.target}`)
      .sort()
    assert.deepEqual(labels, ["Professional->q5", "Student->q2"])
  })

  it("connects questions with no conditions to the previous question", () => {
    const { edges } = buildFlowGraph([
      text("q1", "First"),
      text("q2", "Second"),
      text("q3", "Third"),
    ])
    const sequence = edges
      .filter((edge) => edge.kind === "sequence")
      .map((edge) => `${edge.source}->${edge.target}`)
    assert.deepEqual(sequence, ["q1->q2", "q2->q3"])
  })

  it("does not add a default sequence into a conditioned follow-up", () => {
    const followUp = text("q2", "Only if student", {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
      },
    })
    const { edges } = buildFlowGraph([q1, followUp])
    assert.equal(
      edges.some((edge) => edge.kind === "sequence" && edge.target === "q2"),
      false
    )
  })

  it("does not auto-sequence a branch question onto an unrelated neighbor", () => {
    const student = text("q2", "What are you studying?", {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
      },
    })
    const other = text("q3", "Unrelated")
    const { edges } = buildFlowGraph([q1, student, other])
    const sequence = edges
      .filter((edge) => edge.kind === "sequence")
      .map((edge) => `${edge.source}->${edge.target}`)
    assert.equal(sequence.includes("q1->q2"), false)
    assert.equal(sequence.includes("q2->q3"), false)
  })

  it("sequences consecutive questions on the same option path", () => {
    const first = text("q2", "Campus", {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
      },
    })
    const second = text("q3", "Year", {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
      },
    })
    const { edges } = buildFlowGraph([q1, first, second])
    assert.equal(
      edges.some(
        (edge) =>
          edge.kind === "sequence" &&
          edge.source === "q2" &&
          edge.target === "q3"
      ),
      true
    )
  })

  it("collapses a full-set branch onto the group node", () => {
    const grouped = createQuestionGroup(
      [
        q1,
        text("q2", "Studying"),
        text("q3", "Year"),
      ],
      ["q2", "q3"],
      "Student set"
    )
    const connected = connectOptionToTargets(grouped, "q1", "opt-a", ["q2", "q3"])
    const { edges } = buildFlowGraph(connected)
    const branch = edges.find((edge) => edge.kind === "branch")
    assert.equal(branch?.targetGroupId != null, true)
    assert.match(branch?.target ?? "", /^group:/)
  })
})

describe("connectOptionToTargets", () => {
  it("stores show-if on each target", () => {
    const next = connectOptionToTargets(
      [q1, text("q2", "A"), text("q3", "B")],
      "q1",
      "opt-a",
      ["q2", "q3"]
    )
    assert.equal(next[1].config.showIf?.conditions[0]?.values[0], "opt-a")
    assert.equal(next[2].config.showIf?.conditions[0]?.values[0], "opt-a")
  })
})

describe("disconnectOptionFromTargets", () => {
  it("removes only that option relationship", () => {
    const connected = connectOptionToTargets(
      [q1, text("q2", "Student"), text("q3", "Pro")],
      "q1",
      "opt-a",
      ["q2"]
    )
    const withBoth = connectOptionToTargets(connected, "q1", "opt-b", ["q3"])
    const next = disconnectOptionFromTargets(withBoth, "q1", "opt-a", ["q2"])
    assert.equal(next[1].config.showIf, undefined)
    assert.equal(next[2].config.showIf?.conditions[0]?.values[0], "opt-b")
    assert.equal(
      buildFlowGraph(next).edges.some(
        (edge) => edge.kind === "branch" && edge.target === "q2"
      ),
      false
    )
  })
})

describe("wouldCreateCycle", () => {
  it("detects a loop back to the source", () => {
    const q2 = choice("q2", "Year?", [{ id: "opt-x", label: "First" }], {
      showIf: {
        logic: "and",
        conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
      },
    })
    assert.equal(wouldCreateCycle([q1, q2], "q2", ["q1"]), true)
    assert.equal(wouldCreateCycle([q1, q2], "q1", ["q2"]), false)
  })
})

describe("layoutFlow", () => {
  it("assigns coordinates to every question", () => {
    const laid = layoutFlow([q1, text("q2", "Next")])
    assert.equal(typeof laid[0].config.flowX, "number")
    assert.equal(typeof laid[1].config.flowY, "number")
  })
})

describe("parseBranchEdgeId", () => {
  it("parses option-to-question and option-to-group ids", () => {
    assert.deepEqual(parseBranchEdgeId("opt:q1:opt-a:q:q2"), {
      sourceId: "q1",
      optionId: "opt-a",
      targetQuestionId: "q2",
    })
    assert.deepEqual(parseBranchEdgeId("opt:q1:opt-a:g:grp"), {
      sourceId: "q1",
      optionId: "opt-a",
      targetGroupId: "grp",
    })
  })
})

describe("validateFlow", () => {
  it("warns when only some answers are connected", () => {
    const next = connectOptionToTargets(
      [q1, text("q2", "Student only")],
      "q1",
      "opt-a",
      ["q2"]
    )
    const warnings = validateFlow(next).filter((issue) => issue.severity === "warning")
    assert.equal(warnings.length > 0, true)
  })
})
