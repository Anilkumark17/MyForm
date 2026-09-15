import {
  getComparisonBranchValue,
  isComparisonQuestion,
} from "@/lib/survey/comparison"
import type { AnswerOption, SurveyQuestion } from "@/lib/survey/questions"

export const SHOW_IF_OPERATORS = ["is", "is_not"] as const

export type ShowIfOperator = (typeof SHOW_IF_OPERATORS)[number]

export type ShowIfCondition = {
  questionId: string
  operator: ShowIfOperator
  /** Option ids (preferred), option values, or free-text answers */
  values: string[]
}

export type ShowIfRule = {
  logic: "and" | "or"
  conditions: ShowIfCondition[]
}

const ANSWER_KEYS_TO_KEEP = [
  "utm_source",
  "source",
  "campaign",
  "utm_campaign",
]

function asStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()]
  return []
}

function asOperator(raw: unknown): ShowIfOperator {
  return raw === "is_not" || raw === "not_equals" ? "is_not" : "is"
}

export function normalizeShowIf(raw: unknown): ShowIfRule | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const rule = raw as Record<string, unknown>

  const fromConditions = Array.isArray(rule.conditions)
    ? rule.conditions
        .map((item) => normalizeCondition(item))
        .filter((item): item is ShowIfCondition => Boolean(item))
    : []

  if (fromConditions.length > 0) {
    return {
      logic: rule.logic === "or" ? "or" : "and",
      conditions: fromConditions,
    }
  }

  // Legacy: { questionId, equals }
  const questionId = String(rule.questionId ?? "").trim()
  const equals = String(rule.equals ?? "").trim()
  if (questionId && equals) {
    return {
      logic: "and",
      conditions: [
        {
          questionId,
          operator: asOperator(rule.operator),
          values: [equals],
        },
      ],
    }
  }

  const single = normalizeCondition(rule)
  if (!single) return undefined
  return { logic: "and", conditions: [single] }
}

function normalizeCondition(raw: unknown): ShowIfCondition | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const questionId = String(item.questionId ?? "").trim()
  if (!questionId) return null
  const values = asStringArray(item.values ?? item.equals ?? item.value)
  if (values.length === 0) return null
  return {
    questionId,
    operator: asOperator(item.operator),
    values,
  }
}

export function hasShowIf(question: SurveyQuestion): boolean {
  return Boolean(normalizeShowIf(question.config.showIf))
}

export function previousQuestions(
  questions: SurveyQuestion[],
  questionId: string
): SurveyQuestion[] {
  const index = questions.findIndex((question) => question.id === questionId)
  if (index <= 0) return []
  return questions.slice(0, index)
}

export function laterQuestions(
  questions: SurveyQuestion[],
  questionId: string
): SurveyQuestion[] {
  const index = questions.findIndex((question) => question.id === questionId)
  if (index < 0) return []
  return questions.slice(index + 1)
}

export function canBranchFrom(question: SurveyQuestion): boolean {
  return question.options.length > 0
}

export function questionRefLabel(
  questions: SurveyQuestion[],
  questionId: string,
  max = 52
): string {
  const index = questions.findIndex((question) => question.id === questionId)
  const question = index >= 0 ? questions[index] : undefined
  const prompt = question?.prompt.trim() || "Untitled question"
  const clipped = prompt.length > max ? `${prompt.slice(0, max - 1)}…` : prompt
  return index >= 0 ? `Q${index + 1}: ${clipped}` : clipped
}

function optionMatchers(option: AnswerOption): string[] {
  return [option.id, option.value, option.label]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
}

function answerTokens(question: SurveyQuestion | undefined, answer: unknown): string[] {
  if (answer == null || answer === "") return []

  if (question && isComparisonQuestion(question)) {
    const branch = getComparisonBranchValue(answer)
    return branch ? [branch] : []
  }

  if (typeof answer === "boolean") {
    return answer ? ["true", "yes"] : ["false", "no"]
  }

  if (Array.isArray(answer)) {
    return answer.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof answer === "object") {
    const obj = answer as Record<string, unknown>
    if (typeof obj.selectedId === "string" && obj.selectedId.trim()) {
      return [obj.selectedId.trim()]
    }
  }

  const text = String(answer).trim()
  return text ? [text] : []
}

export function selectedOptionIds(
  question: SurveyQuestion,
  answer: unknown
): string[] {
  const tokens = answerTokens(question, answer)
  if (tokens.length === 0) return []
  if (question.options.length === 0) return tokens

  return question.options
    .filter((option) => {
      const matchers = optionMatchers(option)
      return tokens.some((token) => matchers.includes(token))
    })
    .map((option) => option.id)
}

function valueMatchesAnswer(
  source: SurveyQuestion,
  answer: unknown,
  expected: string
): boolean {
  const tokens = answerTokens(source, answer)
  if (tokens.includes(expected)) return true

  const selected = selectedOptionIds(source, answer)
  if (selected.includes(expected)) return true

  const option = source.options.find((item) =>
    optionMatchers(item).includes(expected)
  )
  if (!option) return false

  const matchers = optionMatchers(option)
  return (
    selected.includes(option.id) ||
    tokens.some((token) => matchers.includes(token))
  )
}

function conditionMatches(
  condition: ShowIfCondition,
  answers: Record<string, unknown>,
  allQuestions: SurveyQuestion[],
  visiting: Set<string>
): boolean {
  const source = allQuestions.find((question) => question.id === condition.questionId)
  if (!source) return false
  if (!isQuestionVisible(source, answers, allQuestions, visiting)) return false

  const answer = answers[condition.questionId]
  const tokens = answerTokens(source, answer)
  if (tokens.length === 0) return false

  const hit = condition.values.some((value) =>
    valueMatchesAnswer(source, answer, value)
  )
  return condition.operator === "is_not" ? !hit : hit
}

/** Whether a question should be shown given current answers. Nested rules require ancestors to be visible too. */
export function isQuestionVisible(
  question: SurveyQuestion,
  answers: Record<string, unknown>,
  allQuestions: SurveyQuestion[],
  visiting: Set<string> = new Set()
): boolean {
  const rule = normalizeShowIf(question.config.showIf)
  if (!rule) return true
  if (visiting.has(question.id)) return false

  const nextVisiting = new Set(visiting)
  nextVisiting.add(question.id)

  const results = rule.conditions.map((condition) =>
    conditionMatches(condition, answers, allQuestions, nextVisiting)
  )
  return rule.logic === "or" ? results.some(Boolean) : results.every(Boolean)
}

export function getVisibleQuestions(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): SurveyQuestion[] {
  return questions.filter((question) =>
    isQuestionVisible(question, answers, questions)
  )
}

/** Keep answers for the visible path (plus hidden fields / attribution keys). */
export function answersForVisiblePath(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): Record<string, unknown> {
  const keepIds = new Set(
    questions
      .filter(
        (question) =>
          question.type === "hidden" ||
          isQuestionVisible(question, answers, questions)
      )
      .map((question) => question.id)
  )

  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(answers)) {
    if (keepIds.has(key) || ANSWER_KEYS_TO_KEEP.includes(key)) {
      next[key] = value
    }
  }
  return next
}

export function createDefaultShowIf(
  previous: SurveyQuestion[]
): ShowIfRule | undefined {
  if (previous.length === 0) return undefined
  const source =
    [...previous].reverse().find((question) => question.options.length > 0) ??
    previous[previous.length - 1]
  return {
    logic: "and",
    conditions: [
      {
        questionId: source.id,
        operator: "is",
        values: source.options[0] ? [source.options[0].id] : [],
      },
    ],
  }
}

/** Keep incomplete rules in the editor (empty match values) that normalizeShowIf would drop. */
export function showIfForEditor(raw: unknown): ShowIfRule | undefined {
  const normalized = normalizeShowIf(raw)
  if (normalized) return normalized
  if (!raw || typeof raw !== "object") return undefined
  const rule = raw as Partial<ShowIfRule>
  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    return undefined
  }
  const conditions = rule.conditions
    .map((item) => {
      const questionId = String(item?.questionId ?? "").trim()
      if (!questionId) return null
      return {
        questionId,
        operator: asOperator(item?.operator),
        values: asStringArray(item?.values),
      } satisfies ShowIfCondition
    })
    .filter((item): item is ShowIfCondition => Boolean(item))
  if (conditions.length === 0) return undefined
  return {
    logic: rule.logic === "or" ? "or" : "and",
    conditions,
  }
}

export function emptyCondition(source: SurveyQuestion): ShowIfCondition {
  return {
    questionId: source.id,
    operator: "is",
    values: source.options[0] ? [source.options[0].id] : [],
  }
}

export function isFollowUpForOption(
  followUp: SurveyQuestion,
  sourceId: string,
  optionId: string
): boolean {
  const rule = normalizeShowIf(followUp.config.showIf)
  if (!rule) return false
  return rule.conditions.some(
    (condition) =>
      condition.questionId === sourceId &&
      condition.operator === "is" &&
      condition.values.includes(optionId)
  )
}

export function toggleFollowUpForOption(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string,
  followUpId: string,
  enabled: boolean
): SurveyQuestion[] {
  return questions.map((question) => {
    if (question.id !== followUpId) return question
    const rule = normalizeShowIf(question.config.showIf) ?? {
      logic: "and" as const,
      conditions: [] as ShowIfCondition[],
    }

    if (enabled) {
      const existing = rule.conditions.find(
        (condition) =>
          condition.questionId === sourceId && condition.operator === "is"
      )
      if (existing) {
        if (!existing.values.includes(optionId)) {
          existing.values = [...existing.values, optionId]
        }
      } else {
        rule.conditions.push({
          questionId: sourceId,
          operator: "is",
          values: [optionId],
        })
      }
      return {
        ...question,
        config: { ...question.config, showIf: rule },
      }
    }

    const conditions = rule.conditions
      .map((condition) => {
        if (condition.questionId !== sourceId || condition.operator !== "is") {
          return condition
        }
        return {
          ...condition,
          values: condition.values.filter((value) => value !== optionId),
        }
      })
      .filter((condition) => condition.values.length > 0)

    return {
      ...question,
      config: {
        ...question.config,
        showIf: conditions.length > 0 ? { ...rule, conditions } : undefined,
      },
    }
  })
}

/** Drop rules that point at deleted questions or options. */
export function cleanupConditionalLogic(
  questions: SurveyQuestion[]
): SurveyQuestion[] {
  const ids = new Set(questions.map((question) => question.id))

  return questions.map((question) => {
    const rule = normalizeShowIf(question.config.showIf)
    if (!rule) {
      if (!question.config.showIf) return question
      return {
        ...question,
        config: { ...question.config, showIf: undefined },
      }
    }

    const conditions = rule.conditions
      .filter(
        (condition) =>
          ids.has(condition.questionId) && condition.questionId !== question.id
      )
      .map((condition) => {
        const source = questions.find((item) => item.id === condition.questionId)
        if (!source || source.options.length === 0) return condition
        const allowed = new Set(
          source.options.flatMap((option) => optionMatchers(option))
        )
        return {
          ...condition,
          values: condition.values.filter((value) => allowed.has(value)),
        }
      })
      .filter((condition) => condition.values.length > 0)

    const nextRule =
      conditions.length > 0 ? { ...rule, conditions } : undefined
    const prev = normalizeShowIf(question.config.showIf)
    const unchanged =
      JSON.stringify(prev) === JSON.stringify(nextRule) &&
      Boolean(question.config.showIf) === Boolean(nextRule)
    if (unchanged) return question

    return {
      ...question,
      config: { ...question.config, showIf: nextRule },
    }
  })
}

export function describeShowIf(
  question: SurveyQuestion,
  questions: SurveyQuestion[]
): string | null {
  const rule = normalizeShowIf(question.config.showIf)
  if (!rule) return null

  const parts = rule.conditions.map((condition) => {
    const source = questions.find((item) => item.id === condition.questionId)
    const sourceLabel = questionRefLabel(questions, condition.questionId)
    const valueLabels = condition.values.map((value) => {
      const option = source?.options.find((item) =>
        optionMatchers(item).includes(value)
      )
      return option?.label ?? value
    })
    const verb = condition.operator === "is_not" ? "is not" : "is"
    return `${sourceLabel} ${verb} ${valueLabels.join(" or ")}`
  })

  return parts.join(rule.logic === "or" ? " or " : " and ")
}

export function questionsDependingOn(
  questions: SurveyQuestion[],
  sourceId: string
): SurveyQuestion[] {
  return questions.filter((question) => {
    const rule = normalizeShowIf(question.config.showIf)
    return rule?.conditions.some((condition) => condition.questionId === sourceId)
  })
}
