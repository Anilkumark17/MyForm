import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  commitOptionLabel,
  draftOptionId,
  forPublicForm,
  isPublicSurveyQuestion,
  labeledAnswerOptions,
  normalizeSurveyQuestion,
  optionRowsForEditor,
  parseSurveyQuestions,
} from "../questions"

describe("normalizeSurveyQuestion drafts", () => {
  it("keeps an untitled question that already has an id", () => {
    const question = normalizeSurveyQuestion({
      id: "q-draft",
      prompt: "  ",
      type: "long_text",
    })
    assert.ok(question)
    assert.equal(question.id, "q-draft")
    assert.equal(question.prompt, "")
  })

  it("drops blank objects with no id", () => {
    assert.equal(normalizeSurveyQuestion({ prompt: "" }), null)
  })
})

describe("isPublicSurveyQuestion", () => {
  it("hides untitled drafts from the public form", () => {
    const questions = parseSurveyQuestions(
      JSON.stringify([
        { id: "q1", prompt: "Visible", type: "long_text" },
        { id: "q2", prompt: "", type: "long_text" },
      ])
    )
    assert.equal(questions.length, 2)
    assert.deepEqual(
      questions.filter(isPublicSurveyQuestion).map((question) => question.id),
      ["q1"]
    )
  })
})

describe("optionRowsForEditor", () => {
  it("keeps a blank row ready after the last filled option", () => {
    const options = [
      { id: "a", label: "Yes" },
      { id: "b", label: "No" },
    ]
    const rows = optionRowsForEditor(options, "q1")
    assert.equal(rows.length, 3)
    assert.equal(rows[2]?.id, draftOptionId("q1"))
    assert.equal(rows[2]?.label, "")
  })

  it("turns the draft row into a real option when typed", () => {
    const options = [{ id: "a", label: "Yes" }]
    const next = commitOptionLabel(options, draftOptionId("q1"), "Maybe")
    assert.deepEqual(
      labeledAnswerOptions(next).map((option) => option.label),
      ["Yes", "Maybe"]
    )
    assert.equal(
      optionRowsForEditor(next, "q1").some(
        (option) => option.id === draftOptionId("q1")
      ),
      true
    )
  })
})

describe("forPublicForm", () => {
  it("strips blank answer options", () => {
    const questions = forPublicForm(
      parseSurveyQuestions(
        JSON.stringify([
          {
            id: "q1",
            prompt: "Pick one",
            type: "single_select",
            options: [
              { id: "a", label: "Yes" },
              { id: "b", label: "" },
            ],
          },
        ])
      )
    )
    assert.deepEqual(
      questions[0]?.options.map((option) => option.label),
      ["Yes"]
    )
  })
})
