import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  answersForVisiblePath,
  cleanupConditionalLogic,
  clearTargetsTo,
  SUBMIT_TARGET,
  flowMemberIds,
  getSectionPath,
  getSections,
  hasSections,
  getVisibleQuestions,
  isQuestionVisible,
  migrateLegacyShowIf,
  toggleFlowMember,
} from "../conditional"
import type { SurveyQuestion } from "../questions"

function choice(
  id: string,
  options: string[],
  config: SurveyQuestion["config"] = {}
): SurveyQuestion {
  return {
    id,
    prompt: id,
    type: "single_select",
    options: options.map((label) => ({ id: `${id}-${label}`, label })),
    config,
  }
}

function text(id: string, config: SurveyQuestion["config"] = {}): SurveyQuestion {
  return { id, prompt: id, type: "long_text", options: [], config }
}

const inFlow = (questionId: string, optionId: string) => ({
  branchOf: [{ questionId, optionId }],
})

const ids = (questions: SurveyQuestion[]) => questions.map((q) => q.id)

// q1: A -> q2,q3   B -> q4   then everyone -> q5
const form = [
  choice("q1", ["A", "B"]),
  text("q2", inFlow("q1", "q1-A")),
  text("q3", inFlow("q1", "q1-A")),
  text("q4", inFlow("q1", "q1-B")),
  text("q5"),
]

describe("per-answer flows", () => {
  it("runs in order when no flows exist", () => {
    assert.deepEqual(
      ids(getVisibleQuestions([text("a"), text("b"), text("c")], {})),
      ["a", "b", "c"]
    )
  })

  it("answer A runs only A's flow, then shared questions", () => {
    assert.deepEqual(ids(getVisibleQuestions(form, { q1: "q1-A" })), [
      "q1",
      "q2",
      "q3",
      "q5",
    ])
  })

  it("answer B runs only B's flow, then shared questions", () => {
    assert.deepEqual(ids(getVisibleQuestions(form, { q1: "q1-B" })), [
      "q1",
      "q4",
      "q5",
    ])
  })

  it("matches by option label too", () => {
    assert.deepEqual(ids(getVisibleQuestions(form, { q1: "B" })), [
      "q1",
      "q4",
      "q5",
    ])
  })

  it("shows no flow until the question is answered", () => {
    assert.deepEqual(ids(getVisibleQuestions(form, {})), ["q1", "q5"])
  })

  it("an answer with no flow goes to the shared questions", () => {
    const partial = [
      choice("q1", ["A", "B"]),
      text("q2", inFlow("q1", "q1-A")),
      text("q3"),
    ]
    assert.deepEqual(ids(getVisibleQuestions(partial, { q1: "q1-B" })), [
      "q1",
      "q3",
    ])
  })

  it("supports nested flows", () => {
    const nested = [
      choice("q1", ["A", "B"]),
      choice("q2", ["X", "Y"], inFlow("q1", "q1-A")),
      text("q3", inFlow("q2", "q2-X")),
      text("q4", inFlow("q2", "q2-Y")),
      text("q5"),
    ]
    assert.deepEqual(
      ids(getVisibleQuestions(nested, { q1: "q1-A", q2: "q2-Y" })),
      ["q1", "q2", "q4", "q5"]
    )
    assert.deepEqual(ids(getVisibleQuestions(nested, { q1: "q1-B" })), [
      "q1",
      "q5",
    ])
  })

  it("isQuestionVisible follows the answered path", () => {
    assert.equal(isQuestionVisible(form[3], { q1: "q1-A" }, form), false)
    assert.equal(isQuestionVisible(form[3], { q1: "q1-B" }, form), true)
  })

  it("drops answers from skipped flows and keeps attribution keys", () => {
    const kept = answersForVisiblePath(form, {
      q1: "q1-A",
      q2: "x",
      q4: "stale",
      utm_source: "ads",
    })
    assert.deepEqual(kept, { q1: "q1-A", q2: "x", utm_source: "ads" })
  })

  it("multi-select cannot open flows", () => {
    const multi: SurveyQuestion = {
      ...choice("q1", ["A"]),
      type: "multi_select",
    }
    assert.deepEqual(
      ids(
        getVisibleQuestions(
          [multi, text("q2", inFlow("q1", "q1-A"))],
          { q1: ["q1-A"] }
        )
      ),
      ["q1"]
    )
  })
})

describe("flow edits", () => {
  const base = [choice("q1", ["A", "B"]), text("q2"), text("q3")]

  it("adds and removes a question from an answer's flow", () => {
    const added = toggleFlowMember(base, "q1", "q1-A", "q3", true)
    assert.deepEqual(flowMemberIds(added, "q1", "q1-A"), ["q3"])
    const removed = toggleFlowMember(added, "q1", "q1-A", "q3", false)
    assert.equal(removed[2].config.branchOf, undefined)
  })

  it("clearTargetsTo removes a question from every flow", () => {
    let next = toggleFlowMember(base, "q1", "q1-A", "q2", true)
    next = toggleFlowMember(next, "q1", "q1-B", "q2", true)
    assert.equal(clearTargetsTo(next, "q2")[1].config.branchOf, undefined)
  })

  it("cleanup removes flows for deleted options and earlier sources", () => {
    const messy = [
      text("q0", inFlow("q1", "q1-A")),
      choice("q1", ["A"]),
      text("q2", inFlow("q1", "q1-gone")),
      text("q3", inFlow("q1", "q1-A")),
    ]
    const clean = cleanupConditionalLogic(messy)
    assert.equal(clean[0].config.branchOf, undefined)
    assert.equal(clean[2].config.branchOf, undefined)
    assert.equal(clean[3].config.branchOf?.length, 1)
  })
})

describe("migrateLegacyShowIf", () => {
  const rule = (questionId: string, value: string) => ({
    logic: "and" as const,
    conditions: [{ questionId, operator: "is" as const, values: [value] }],
  })

  it("turns show-if rules into answer flows", () => {
    const legacy = [
      choice("q1", ["A", "B"]),
      text("q2", { showIf: rule("q1", "q1-A") }),
      text("q3", { showIf: rule("q1", "q1-A") }),
      text("q4", { showIf: rule("q1", "q1-B") }),
      text("q5"),
    ]
    const migrated = migrateLegacyShowIf(legacy)
    assert.equal(migrated[1].config.showIf, undefined)
    assert.deepEqual(ids(getVisibleQuestions(migrated, { q1: "q1-A" })), [
      "q1",
      "q2",
      "q3",
      "q5",
    ])
    assert.deepEqual(ids(getVisibleQuestions(migrated, { q1: "q1-B" })), [
      "q1",
      "q4",
      "q5",
    ])
  })
})

describe("sections", () => {
  // S1: q1 (A -> S3, B -> submit), q2 | S2: q3 | S3: q4
  const sectioned = [
    choice("q1", ["A", "B", "C"], {
      goTo: { "q1-A": "q4", "q1-B": SUBMIT_TARGET },
    }),
    text("q2"),
    text("q3", { sectionStart: { title: "Middle" } }),
    text("q4", { sectionStart: { title: "End", after: SUBMIT_TARGET } }),
    text("q5"),
  ]

  it("splits into sections at section starts", () => {
    assert.equal(hasSections(sectioned), true)
    assert.deepEqual(
      getSections(sectioned).map((s) => ids(s.questions)),
      [["q1", "q2"], ["q3"], ["q4", "q5"]]
    )
  })

  it("answer jumps to a later section", () => {
    assert.deepEqual(
      getSectionPath(sectioned, { q1: "q1-A" }).map((s) => s.id),
      ["q1", "q4"]
    )
  })

  it("answer can submit the form early", () => {
    assert.deepEqual(
      getSectionPath(sectioned, { q1: "q1-B" }).map((s) => s.id),
      ["q1"]
    )
  })

  it("unrouted answer goes through every section in order", () => {
    assert.deepEqual(
      getSectionPath(sectioned, { q1: "q1-C" }).map((s) => s.id),
      ["q1", "q3", "q4"]
    )
  })

  it("section after-setting applies when no answer rule matches", () => {
    const form = [
      text("a", { sectionStart: { title: "", after: "c" } }),
      text("b", { sectionStart: { title: "" } }),
      text("c", { sectionStart: { title: "" } }),
    ]
    assert.deepEqual(getSectionPath(form, {}).map((s) => s.id), ["a", "c"])
  })

  it("visible questions are the questions of visited sections", () => {
    assert.deepEqual(ids(getVisibleQuestions(sectioned, { q1: "q1-A" })), [
      "q1",
      "q2",
      "q4",
      "q5",
    ])
  })

  it("cleanup drops routing to missing or earlier sections", () => {
    const messy = [
      choice("q1", ["A"], { goTo: { "q1-A": "gone" } }),
      text("q2", { sectionStart: { title: "", after: "q1" } }),
    ]
    const clean = cleanupConditionalLogic(messy)
    assert.equal(clean[0].config.goTo, undefined)
    assert.equal(clean[1].config.sectionStart?.after, undefined)
  })
})
