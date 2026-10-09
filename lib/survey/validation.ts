import type { SurveyQuestion } from "@/lib/survey/questions"

export const NUMBER_RULES = [
  { id: "gte", label: "Greater than or equal to", needsValue: 1 },
  { id: "lte", label: "Less than or equal to", needsValue: 1 },
  { id: "between", label: "Between", needsValue: 2 },
  { id: "not_between", label: "Not between", needsValue: 2 },
] as const

export const TEXT_RULES = [
  { id: "min_length", label: "Minimum character count", needsValue: 1 },
  { id: "max_length", label: "Maximum character count", needsValue: 1 },
  { id: "contains", label: "Contains", needsValue: 1 },
  { id: "not_contains", label: "Does not contain", needsValue: 1 },
  { id: "email", label: "Is a valid email", needsValue: 0 },
  { id: "url", label: "Is a valid URL", needsValue: 0 },
  { id: "regex", label: "Matches pattern (regex)", needsValue: 1 },
] as const

export type ValidationRuleId =
  | (typeof NUMBER_RULES)[number]["id"]
  | (typeof TEXT_RULES)[number]["id"]

export type ValidationConfig = {
  rule: ValidationRuleId
  value?: string
  value2?: string
  /** Custom error text shown to the respondent */
  message?: string
}

const NUMBER_TYPES = new Set([
  "number",
  "currency",
  "percentage",
  "slider",
  "stepper",
])
const TEXT_TYPES = new Set(["short_text", "long_text", "rich_text", "email"])

export function validationKind(
  question: Pick<SurveyQuestion, "type">
): "number" | "text" | null {
  if (NUMBER_TYPES.has(question.type)) return "number"
  if (TEXT_TYPES.has(question.type)) return "text"
  return null
}

export function rulesFor(question: Pick<SurveyQuestion, "type">) {
  const kind = validationKind(question)
  return kind === "number" ? NUMBER_RULES : kind === "text" ? TEXT_RULES : []
}

export function normalizeValidation(raw: unknown): ValidationConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const item = raw as Record<string, unknown>
  const rule = String(item.rule ?? "")
  const known = [...NUMBER_RULES, ...TEXT_RULES].some((r) => r.id === rule)
  if (!known) return undefined
  const text = (value: unknown) => {
    const out = String(value ?? "").trim()
    return out ? out.slice(0, 500) : undefined
  }
  return {
    rule: rule as ValidationRuleId,
    value: text(item.value),
    value2: text(item.value2),
    message: text(item.message),
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isUrl(text: string) {
  try {
    const url = new URL(text)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

/**
 * Error message for an answer that breaks the question's rule, or null.
 * Empty answers pass: "required" decides whether they are allowed.
 */
export function validateAnswer(
  question: SurveyQuestion,
  value: unknown
): string | null {
  const validation = question.config.validation
  const isEmailType = question.type === "email"
  if (!validation && !isEmailType) return null

  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim()
  if (value == null || text === "") return null

  const fail = (fallback: string) => validation?.message?.trim() || fallback

  if (isEmailType && !EMAIL_PATTERN.test(text)) {
    return fail("Enter a valid email address.")
  }
  if (!validation) return null

  const a = Number(validation.value)
  const b = Number(validation.value2)
  const number = Number(text)

  switch (validation.rule) {
    case "gte":
      if (!Number.isFinite(number) || number < a) return fail(`Must be at least ${validation.value}.`)
      return null
    case "lte":
      if (!Number.isFinite(number) || number > a) return fail(`Must be at most ${validation.value}.`)
      return null
    case "between": {
      const [low, high] = a <= b ? [a, b] : [b, a]
      if (!Number.isFinite(number) || number < low || number > high) {
        return fail(`Must be between ${low} and ${high}.`)
      }
      return null
    }
    case "not_between": {
      const [low, high] = a <= b ? [a, b] : [b, a]
      if (!Number.isFinite(number) || (number >= low && number <= high)) {
        return fail(`Must not be between ${low} and ${high}.`)
      }
      return null
    }
    case "min_length":
      return text.length < a ? fail(`Use at least ${validation.value} characters.`) : null
    case "max_length":
      return text.length > a ? fail(`Use at most ${validation.value} characters.`) : null
    case "contains":
      return validation.value && !text.includes(validation.value)
        ? fail(`Must contain “${validation.value}”.`)
        : null
    case "not_contains":
      return validation.value && text.includes(validation.value)
        ? fail(`Must not contain “${validation.value}”.`)
        : null
    case "email":
      return EMAIL_PATTERN.test(text) ? null : fail("Enter a valid email address.")
    case "url":
      return isUrl(text) ? null : fail("Enter a valid URL, starting with http:// or https://.")
    case "regex": {
      const pattern = validation.value ? safeRegex(validation.value) : null
      if (!pattern) return null
      return pattern.test(text) ? null : fail("Doesn’t match the required format.")
    }
    default:
      return null
  }
}

/** Config problems to show the form owner (bad numbers, broken regex). */
export function validationConfigIssue(
  question: Pick<SurveyQuestion, "type" | "config">
): string | null {
  const validation = question.config.validation
  if (!validation) return null
  const meta = rulesFor(question).find((rule) => rule.id === validation.rule)
  if (!meta) return "This rule does not apply to the chosen answer type."
  if (validation.rule === "regex") {
    if (!validation.value) return "Enter a pattern."
    if (!safeRegex(validation.value)) return "That pattern is not valid."
    return null
  }
  const numeric = validationKind(question) === "number" || validation.rule.endsWith("_length")
  if (meta.needsValue >= 1 && !validation.value) return "Enter a value."
  if (numeric && meta.needsValue >= 1 && !Number.isFinite(Number(validation.value))) {
    return "Enter a number."
  }
  if (meta.needsValue === 2) {
    if (!validation.value2) return "Enter both values."
    if (!Number.isFinite(Number(validation.value2))) return "Enter a number."
  }
  return null
}
