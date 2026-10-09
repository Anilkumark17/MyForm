import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { SurveyQuestion } from "../questions"
import {
  normalizeValidation,
  validateAnswer,
  validationConfigIssue,
  type ValidationConfig,
} from "../validation"

function q(
  type: SurveyQuestion["type"],
  validation?: ValidationConfig
): SurveyQuestion {
  return { id: "q", prompt: "q", type, options: [], config: { validation } }
}

describe("validateAnswer", () => {
  it("passes empty answers (required handles those)", () => {
    assert.equal(validateAnswer(q("number", { rule: "gte", value: "5" }), ""), null)
  })

  it("checks number rules", () => {
    const gte = q("number", { rule: "gte", value: "5" })
    assert.equal(validateAnswer(gte, "5"), null)
    assert.match(validateAnswer(gte, "4") ?? "", /at least 5/)
    const between = q("number", { rule: "between", value: "1", value2: "10" })
    assert.equal(validateAnswer(between, "7"), null)
    assert.match(validateAnswer(between, "11") ?? "", /between 1 and 10/)
    const outside = q("number", { rule: "not_between", value: "1", value2: "10" })
    assert.notEqual(validateAnswer(outside, "5"), null)
    assert.equal(validateAnswer(outside, "11"), null)
  })

  it("rejects non-numbers for number rules", () => {
    assert.notEqual(validateAnswer(q("number", { rule: "lte", value: "9" }), "abc"), null)
  })

  it("checks text rules", () => {
    assert.notEqual(validateAnswer(q("short_text", { rule: "min_length", value: "3" }), "ab"), null)
    assert.equal(validateAnswer(q("short_text", { rule: "max_length", value: "3" }), "abc"), null)
    assert.notEqual(validateAnswer(q("short_text", { rule: "contains", value: "x" }), "abc"), null)
    assert.notEqual(validateAnswer(q("short_text", { rule: "not_contains", value: "a" }), "abc"), null)
    assert.equal(validateAnswer(q("short_text", { rule: "url" }), "https://a.co/x"), null)
    assert.notEqual(validateAnswer(q("short_text", { rule: "url" }), "a.co"), null)
    assert.equal(validateAnswer(q("short_text", { rule: "email" }), "a@b.co"), null)
    assert.notEqual(validateAnswer(q("short_text", { rule: "email" }), "a@b"), null)
  })

  it("checks regex and ignores a broken pattern", () => {
    const rx = q("short_text", { rule: "regex", value: "^[A-Z]{3}$" })
    assert.equal(validateAnswer(rx, "ABC"), null)
    assert.notEqual(validateAnswer(rx, "abc"), null)
    assert.equal(validateAnswer(q("short_text", { rule: "regex", value: "(" }), "x"), null)
  })

  it("uses the custom message", () => {
    const rule = q("number", { rule: "gte", value: "18", message: "Adults only" })
    assert.equal(validateAnswer(rule, "10"), "Adults only")
  })

  it("always checks the email type", () => {
    assert.notEqual(validateAnswer(q("email"), "nope"), null)
    assert.equal(validateAnswer(q("email"), "me@x.io"), null)
  })
})

describe("normalizeValidation / config issues", () => {
  it("drops unknown rules", () => {
    assert.equal(normalizeValidation({ rule: "nope" }), undefined)
    assert.deepEqual(normalizeValidation({ rule: "gte", value: " 3 " }), {
      rule: "gte",
      value: "3",
      value2: undefined,
      message: undefined,
    })
  })

  it("reports missing values, bad numbers and bad regex", () => {
    const issue = (type: SurveyQuestion["type"], v: ValidationConfig) =>
      validationConfigIssue({ type, config: { validation: v } })
    assert.equal(issue("number", { rule: "gte" }), "Enter a value.")
    assert.equal(issue("number", { rule: "gte", value: "x" }), "Enter a number.")
    assert.equal(issue("number", { rule: "between", value: "1" }), "Enter both values.")
    assert.equal(issue("short_text", { rule: "regex", value: "(" }), "That pattern is not valid.")
    assert.equal(issue("short_text", { rule: "email" }), null)
  })
})
