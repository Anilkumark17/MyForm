import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  answersForVisiblePath,
  cleanupConditionalLogic,
  createDefaultShowIf,
  getVisibleQuestions,
  isFollowUpForOption,
  isQuestionVisible,
  normalizeShowIf,
  toggleFollowUpForOption,
} from "../conditional"
import type { SurveyQuestion } from "../questions"

function choice(
  id: string,
  prompt: string,
  options: Array<{ id: string; label: string; value?: string }>,
  showIf?: SurveyQuestion["config"]["showIf"]
): SurveyQuestion {
  return {
    id,
    prompt,
    type: "single_select",
    options: options.map((option) => ({
      id: option.id,
      label: option.label,
      value: option.value,
    })),
    config: showIf ? { showIf } : {},
  }
}

function text(
  id: string,
  prompt: string,
  showIf?: SurveyQuestion["config"]["showIf"]
): SurveyQuestion {
  return {
    id,
    prompt,
    type: "long_text",
    options: [],
    config: showIf ? { showIf } : {},
  }
}

const userType = choice("q1", "What type of user are you?", [
  { id: "opt-a", label: "Customer", value: "customer" },
  { id: "opt-b", label: "Business", value: "business" },
])

const setA1 = text("q2", "Which tools do you use?", {
  logic: "and",
  conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
})

const setA2 = text("q3", "How often do you buy?", {
  logic: "and",
  conditions: [{ questionId: "q1", operator: "is", values: ["opt-a"] }],
})

const setB1 = text("q4", "How many employees?", {
  logic: "and",
  conditions: [{ questionId: "q1", operator: "is", values: ["opt-b"] }],
})

const nested = text("q5", "Which plan are those employees on?", {
  logic: "and",
  conditions: [{ questionId: "q4", operator: "is", values: ["any"] }],
})

const always = text("q6", "Anything else?")

describe("normalizeShowIf", () => {
  it("accepts legacy { questionId, equals }", () => {
    const rule = normalizeShowIf({ questionId: "q1", equals: "opt-a" })
    assert.deepEqual(rule, {
      logic: "and",
      conditions: [
        { questionId: "q1", operator: "is", values: ["opt-a"] },
      ],
    })
  })

  it("returns undefined for empty rules", () => {
    assert.equal(normalizeShowIf({}), undefined)
    assert.equal(normalizeShowIf(null), undefined)
  })
})

describe("conditional visibility", () => {
  const questions = [userType, setA1, setA2, setB1, nested, always]

  it("shows only the matching question set", () => {
    const customer = getVisibleQuestions(questions, { q1: "opt-a" }).map(
      (question) => question.id
    )
    assert.deepEqual(customer, ["q1", "q2", "q3", "q6"])

    const business = getVisibleQuestions(questions, { q1: "Customer" }).map(
      (question) => question.id
    )
    assert.deepEqual(business, ["q1", "q2", "q3", "q6"])

    const viaValue = getVisibleQuestions(questions, { q1: "customer" }).map(
      (question) => question.id
    )
    assert.deepEqual(viaValue, ["q1", "q2", "q3", "q6"])
  })

  it("switches sets when the branch answer changes", () => {
    const ids = getVisibleQuestions(questions, { q1: "opt-b" }).map(
      (question) => question.id
    )
    assert.deepEqual(ids, ["q1", "q4", "q6"])
  })

  it("hides nested follow-ups when an ancestor is not visible", () => {
    const withPlan = {
      q1: "opt-a",
      q4: "any",
    }
    assert.equal(isQuestionVisible(nested, withPlan, questions), false)

    const businessPath = {
      q1: "opt-b",
      q4: "any",
    }
    assert.equal(isQuestionVisible(nested, businessPath, questions), true)
  })

  it("hides dependents until the source is answered", () => {
    const ids = getVisibleQuestions(questions, {}).map((question) => question.id)
    assert.deepEqual(ids, ["q1"])
  })

  it("never enters the other option's branch", () => {
    const ids = getVisibleQuestions([userType, setA1, setB1], {
      q1: "opt-a",
    }).map((question) => question.id)
    assert.deepEqual(ids, ["q1", "q2"])
  })

  it("ends the path when the selected option has no follow-up connection", () => {
    const ids = getVisibleQuestions([userType, setA1], { q1: "opt-b" }).map(
      (question) => question.id
    )
    assert.deepEqual(ids, ["q1"])
  })

  it("skips unrelated questions sitting inside a branch block", () => {
    const mid = text("q-mid", "Unrelated filler")
    const ids = getVisibleQuestions(
      [userType, setA1, mid, setB1, always],
      { q1: "opt-a" }
    ).map((question) => question.id)
    assert.deepEqual(ids, ["q1", "q2", "q6"])
  })

  it("drops a follow-up from the path when its connection is removed", () => {
    let list = [userType, text("q2", "Student follow-up"), text("q4", "Pro follow-up")]
    list = toggleFollowUpForOption(list, "q1", "opt-a", "q2", true)
    list = toggleFollowUpForOption(list, "q1", "opt-b", "q4", true)
    assert.deepEqual(
      getVisibleQuestions(list, { q1: "opt-a" }).map((question) => question.id),
      ["q1", "q2"]
    )

    list = toggleFollowUpForOption(list, "q1", "opt-a", "q2", false)
    const ids = getVisibleQuestions(list, { q1: "opt-a" }).map(
      (question) => question.id
    )
    assert.equal(ids.includes("q2"), false)
    assert.equal(ids.includes("q4"), false)
  })

  it("supports AND / OR across conditions", () => {
    const both = text("qx", "Both", {
      logic: "and",
      conditions: [
        { questionId: "q1", operator: "is", values: ["opt-a"] },
        { questionId: "q2", operator: "is", values: ["excel"] },
      ],
    })
    const either = text("qy", "Either", {
      logic: "or",
      conditions: [
        { questionId: "q1", operator: "is", values: ["opt-a"] },
        { questionId: "q1", operator: "is", values: ["opt-b"] },
      ],
    })
    const list = [userType, setA1, both, either]
    assert.equal(
      isQuestionVisible(both, { q1: "opt-a", q2: "excel" }, list),
      true
    )
    assert.equal(
      isQuestionVisible(both, { q1: "opt-a", q2: "sheets" }, list),
      false
    )
    assert.equal(isQuestionVisible(either, { q1: "opt-b" }, list), true)
  })

  it("supports is_not", () => {
    const other = text("qz", "Not customer", {
      logic: "and",
      conditions: [
        { questionId: "q1", operator: "is_not", values: ["opt-a"] },
      ],
    })
    const list = [userType, other]
    assert.equal(isQuestionVisible(other, { q1: "opt-a" }, list), false)
    assert.equal(isQuestionVisible(other, { q1: "opt-b" }, list), true)
  })

  it("does not recurse forever on cycles", () => {
    const a = text("a", "A", {
      logic: "and",
      conditions: [{ questionId: "b", operator: "is", values: ["x"] }],
    })
    const b = text("b", "B", {
      logic: "and",
      conditions: [{ questionId: "a", operator: "is", values: ["y"] }],
    })
    assert.equal(isQuestionVisible(a, { a: "y", b: "x" }, [a, b]), false)
  })

  it("matches multi-select answers", () => {
    const multi: SurveyQuestion = {
      id: "qm",
      prompt: "Pick tools",
      type: "multi_select",
      options: [
        { id: "excel", label: "Excel" },
        { id: "sheets", label: "Sheets" },
      ],
      config: {},
    }
    const follow = text("qf", "Tell us about Excel", {
      logic: "and",
      conditions: [
        { questionId: "qm", operator: "is", values: ["excel"] },
      ],
    })
    const list = [multi, follow]
    assert.equal(
      isQuestionVisible(follow, { qm: ["Excel", "Sheets"] }, list),
      true
    )
    assert.equal(
      isQuestionVisible(follow, { qm: ["Sheets"] }, list),
      false
    )
  })
})

describe("answersForVisiblePath", () => {
  it("drops answers from skipped branches and keeps attribution keys", () => {
    const questions = [userType, setA1, setB1, always]
    const pruned = answersForVisiblePath(questions, {
      q1: "opt-a",
      q2: "Notion",
      q4: "500",
      q6: "Thanks",
      utm_source: "twitter",
    })
    assert.deepEqual(pruned, {
      q1: "opt-a",
      q2: "Notion",
      q6: "Thanks",
      utm_source: "twitter",
    })
  })
})

describe("toggleFollowUpForOption", () => {
  it("attaches and removes show-if from later questions", () => {
    const extra = text("q2", "Follow up")
    let next = toggleFollowUpForOption(
      [userType, extra],
      "q1",
      "opt-a",
      "q2",
      true
    )
    assert.equal(isFollowUpForOption(next[1], "q1", "opt-a"), true)
    next = toggleFollowUpForOption(next, "q1", "opt-a", "q2", false)
    assert.equal(isFollowUpForOption(next[1], "q1", "opt-a"), false)
    assert.equal(next[1].config.showIf, undefined)
  })
})

describe("createDefaultShowIf", () => {
  it("creates a rule from the latest choice question", () => {
    const rule = createDefaultShowIf([userType, always])
    assert.deepEqual(rule, {
      logic: "and",
      conditions: [
        { questionId: "q1", operator: "is", values: ["opt-a"] },
      ],
    })
  })

  it("still opens a rule when previous questions have no options", () => {
    const rule = createDefaultShowIf([always])
    assert.deepEqual(rule, {
      logic: "and",
      conditions: [{ questionId: "q6", operator: "is", values: [] }],
    })
  })
})

describe("cleanupConditionalLogic", () => {
  it("removes rules that point at deleted questions or options", () => {
    const orphan = text("q2", "Gone parent", {
      logic: "and",
      conditions: [{ questionId: "missing", operator: "is", values: ["x"] }],
    })
    const staleOption = text("q3", "Gone option", {
      logic: "and",
      conditions: [
        { questionId: "q1", operator: "is", values: ["opt-gone"] },
      ],
    })
    const cleaned = cleanupConditionalLogic([userType, orphan, staleOption])
    assert.equal(cleaned[1].config.showIf, undefined)
    assert.equal(cleaned[2].config.showIf, undefined)
  })
})
