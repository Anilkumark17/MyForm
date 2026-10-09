import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_CLOSED_MESSAGE,
  DEFAULT_FORM_SETTINGS,
  applyShuffle,
  closedReason,
  normalizeFormSettings,
} from "../../forms/settings"
import type { SurveyQuestion } from "../questions"

function q(id: string, config: SurveyQuestion["config"] = {}): SurveyQuestion {
  return {
    id,
    prompt: id,
    type: "single_select",
    options: ["a", "b", "c", "d"].map((label) => ({ id: `${id}-${label}`, label })),
    config,
  }
}

const ids = (list: SurveyQuestion[]) => list.map((item) => item.id)

describe("normalizeFormSettings", () => {
  it("fills defaults for missing or junk input", () => {
    assert.deepEqual(normalizeFormSettings(null), DEFAULT_FORM_SETTINGS)
    assert.equal(normalizeFormSettings({ responseLimit: -3 }).responseLimit, null)
    assert.equal(normalizeFormSettings({ responseLimit: "25" }).responseLimit, 25)
    assert.equal(normalizeFormSettings({ showProgress: false }).showProgress, false)
  })
})

describe("closedReason", () => {
  it("is null while open", () => {
    assert.equal(closedReason(DEFAULT_FORM_SETTINGS, 100), null)
  })

  it("closes when not accepting, with custom or default message", () => {
    const off = { ...DEFAULT_FORM_SETTINGS, acceptingResponses: false }
    assert.equal(closedReason(off, 0), DEFAULT_CLOSED_MESSAGE)
    assert.equal(closedReason({ ...off, closedMessage: "Bye" }, 0), "Bye")
  })

  it("closes once the response limit is reached", () => {
    const limited = { ...DEFAULT_FORM_SETTINGS, responseLimit: 3 }
    assert.equal(closedReason(limited, 2), null)
    assert.equal(closedReason(limited, 3), DEFAULT_CLOSED_MESSAGE)
  })
})

describe("applyShuffle", () => {
  const list = ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => q(id))
  const on = { ...DEFAULT_FORM_SETTINGS, shuffleQuestions: true }

  it("keeps order when shuffle is off", () => {
    assert.deepEqual(ids(applyShuffle(list, DEFAULT_FORM_SETTINGS, 7)), ids(list))
  })

  it("is deterministic per seed and keeps every question", () => {
    const first = applyShuffle(list, on, 42)
    assert.deepEqual(ids(first), ids(applyShuffle(list, on, 42)))
    assert.deepEqual([...ids(first)].sort(), ids(list))
  })

  it("keeps each section's first question in place", () => {
    const sectioned = [
      q("a", {}),
      q("b"),
      q("c"),
      q("d", { sectionStart: { title: "S2" } }),
      q("e"),
      q("f"),
    ]
    const out = applyShuffle(sectioned, on, 9)
    assert.equal(out[0].id, "a")
    assert.equal(out[3].id, "d")
    assert.deepEqual(ids(out.slice(0, 3)).sort(), ["a", "b", "c"])
  })

  it("does not shuffle forms with answer flows", () => {
    const flows = [
      q("a"),
      q("b", { branchOf: [{ questionId: "a", optionId: "a-a" }] }),
      q("c"),
    ]
    assert.deepEqual(ids(applyShuffle(flows, on, 5)), ["a", "b", "c"])
  })

  it("shuffles options only when enabled on the question", () => {
    const out = applyShuffle([q("x", { shuffleOptions: true }), q("y")], DEFAULT_FORM_SETTINGS, 3)
    assert.deepEqual(out[1].options.map((o) => o.label), ["a", "b", "c", "d"])
    assert.deepEqual(
      [...out[0].options.map((o) => o.label)].sort(),
      ["a", "b", "c", "d"]
    )
  })
})
