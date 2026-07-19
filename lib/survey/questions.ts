import {
  isQuestionTypeId,
  QUESTION_TYPE_MAP,
  type QuestionTypeId,
} from "@/lib/survey/question-types"
import type {
  ComparisonOptionContentType,
  ComparisonRevealMode,
  ComparisonSelectionMode,
  ShowIfRule,
} from "@/lib/survey/comparison"

export type AnswerOption = {
  id: string
  label: string
  value?: string
  imageUrl?: string
  /** Comparison: how this option is presented */
  contentType?: ComparisonOptionContentType
  /** Comparison: caption/headline (can differ from internal label used in blind mode) */
  caption?: string
  /** Comparison: render this option's media as a before/after pair */
  beforeAfterPair?: boolean
  beforeImageUrl?: string
  afterImageUrl?: string
}

export type QuestionConfig = {
  min?: number
  max?: number
  step?: number
  leftLabel?: string
  rightLabel?: string
  rows?: string[]
  columns?: string[]
  placeholder?: string
  required?: boolean
  currency?: string
  hiddenKey?: string
  /** Optional stimulus / context image above options (comparison_choice) */
  questionImage?: string
  selectionMode?: ComparisonSelectionMode
  revealMode?: ComparisonRevealMode
  blindMode?: boolean
  /** When true + exactly 2 imaged options + single_select → before/after slider UI */
  beforeAfterSlider?: boolean
  rateMin?: number
  rateMax?: number
  /** Conditional visibility — show when source answer branch equals option id */
  showIf?: ShowIfRule
}

export type SurveyQuestion = {
  id: string
  prompt: string
  type: QuestionTypeId
  options: AnswerOption[]
  config: QuestionConfig
}

function id() {
  return crypto.randomUUID()
}

export function createOption(label = "Option"): AnswerOption {
  return { id: id(), label, contentType: "text" }
}

export function createComparisonOption(
  label: string,
  contentType: ComparisonOptionContentType = "image_text"
): AnswerOption {
  return {
    id: id(),
    label,
    contentType,
    caption: label,
  }
}

export function defaultOptionsForType(type: QuestionTypeId): AnswerOption[] {
  switch (type) {
    case "yes_no":
      return [
        { id: id(), label: "Yes", value: "yes" },
        { id: id(), label: "No", value: "no" },
      ]
    case "likert":
      return [
        "Strongly disagree",
        "Disagree",
        "Neutral",
        "Agree",
        "Strongly agree",
      ].map((label) => ({ id: id(), label }))
    case "emoji_scale":
      return ["😞", "😐", "🙂", "😊", "🤩"].map((label) => ({
        id: id(),
        label,
      }))
    case "consent_checkbox":
      return [{ id: id(), label: "I agree to the terms", value: "agree" }]
    case "opt_in_toggle":
      return [
        { id: id(), label: "Yes, keep me updated", value: "opt_in" },
        { id: id(), label: "No thanks", value: "opt_out" },
      ]
    case "comparison_choice":
      return [
        createComparisonOption("Option A"),
        createComparisonOption("Option B"),
      ]
    case "single_select":
    case "multi_select":
    case "dropdown":
    case "multi_select_dropdown":
    case "image_choice":
    case "ranked_choice":
    case "ranking":
    case "constant_sum":
    case "matrix_rating":
    case "matrix_single":
    case "matrix_multi":
      return [
        createOption("Option 1"),
        createOption("Option 2"),
        createOption("Option 3"),
      ]
    default:
      return []
  }
}

export function defaultConfigForType(type: QuestionTypeId): QuestionConfig {
  switch (type) {
    case "slider":
      return { min: 0, max: 100, step: 1 }
    case "stepper":
      return { min: 0, max: 100, step: 1 }
    case "number":
      return { min: 0 }
    case "percentage":
      return { min: 0, max: 100, step: 1 }
    case "currency":
      return { min: 0, currency: "USD" }
    case "nps":
      return { min: 0, max: 10, step: 1 }
    case "star_rating":
      return { min: 1, max: 5, step: 1 }
    case "semantic_differential":
      return { min: 1, max: 7, leftLabel: "Difficult", rightLabel: "Easy" }
    case "matrix_rating":
    case "matrix_single":
    case "matrix_multi":
      return {
        rows: ["Item 1", "Item 2"],
        columns: ["Low", "Medium", "High"],
      }
    case "table_input":
      return { rows: ["Row 1"], columns: ["Column 1", "Column 2"] }
    case "constant_sum":
      return { max: 100 }
    case "comparison_choice":
      return {
        selectionMode: "single_select",
        revealMode: "side_by_side",
        blindMode: false,
        beforeAfterSlider: false,
        rateMin: 1,
        rateMax: 5,
        min: 1,
        max: 5,
      }
    case "hidden":
      return { hiddenKey: "utm_source" }
    case "short_text":
    case "email":
    case "phone":
      return { placeholder: "Type your answer" }
    case "long_text":
    case "rich_text":
      return { placeholder: "Share details..." }
    default:
      return {}
  }
}

export function createEmptyQuestion(
  type: QuestionTypeId = "long_text"
): SurveyQuestion {
  return {
    id: id(),
    prompt: "",
    type,
    options: defaultOptionsForType(type),
    config: defaultConfigForType(type),
  }
}

export function applyTypeChange(
  question: SurveyQuestion,
  type: QuestionTypeId
): SurveyQuestion {
  const meta = QUESTION_TYPE_MAP[type]
  const keepOptions =
    meta.hasOptions &&
    question.options.length > 0 &&
    QUESTION_TYPE_MAP[question.type].hasOptions

  return {
    ...question,
    type,
    options: keepOptions ? question.options : defaultOptionsForType(type),
    config: defaultConfigForType(type),
  }
}

function normalizeOptions(raw: unknown): AnswerOption[] {
  if (!Array.isArray(raw)) return []
  const options: AnswerOption[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      options.push({ id: id(), label: item, contentType: "text" })
      continue
    }
    if (!item || typeof item !== "object") continue
    const option = item as Partial<AnswerOption>
    const label = String(option.label ?? option.caption ?? "").trim()
    const imageUrl = option.imageUrl ? String(option.imageUrl) : undefined
    const beforeImageUrl = option.beforeImageUrl
      ? String(option.beforeImageUrl)
      : undefined
    const afterImageUrl = option.afterImageUrl
      ? String(option.afterImageUrl)
      : undefined
    if (!label && !imageUrl && !beforeImageUrl) continue

    const contentType = option.contentType
    const resolvedType: ComparisonOptionContentType =
      contentType === "image" ||
      contentType === "text" ||
      contentType === "image_text"
        ? contentType
        : imageUrl
          ? label
            ? "image_text"
            : "image"
          : "text"

    options.push({
      id: option.id || id(),
      label: label || "Option",
      value: option.value ? String(option.value) : undefined,
      imageUrl,
      contentType: resolvedType,
      caption: option.caption ? String(option.caption) : undefined,
      beforeAfterPair: Boolean(option.beforeAfterPair),
      beforeImageUrl,
      afterImageUrl,
    })
  }
  return options
}

function normalizeShowIf(raw: unknown): ShowIfRule | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const rule = raw as Partial<ShowIfRule>
  const questionId = String(rule.questionId ?? "").trim()
  const equals = String(rule.equals ?? "").trim()
  if (!questionId || !equals) return undefined
  return { questionId, equals }
}

export function normalizeSurveyQuestion(raw: unknown): SurveyQuestion | null {
  if (typeof raw === "string") {
    const prompt = raw.trim()
    if (!prompt) return null
    return {
      id: id(),
      prompt,
      type: "long_text",
      options: [],
      config: defaultConfigForType("long_text"),
    }
  }

  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const prompt = String(item.prompt ?? item.text ?? item.question ?? "").trim()
  if (!prompt) return null

  const typeValue = String(item.type ?? "long_text")
  const type = isQuestionTypeId(typeValue) ? typeValue : "long_text"
  const meta = QUESTION_TYPE_MAP[type]
  let options = normalizeOptions(item.options)
  if (meta.hasOptions && options.length === 0) {
    options = defaultOptionsForType(type)
  }

  if (type === "comparison_choice") {
    options = options.map((option) => ({
      ...option,
      contentType: "image_text" as const,
      caption: option.caption || option.label,
    }))
  }

  const baseConfig = defaultConfigForType(type)
  const incoming =
    item.config && typeof item.config === "object"
      ? (item.config as QuestionConfig)
      : {}
  const config: QuestionConfig = {
    ...baseConfig,
    ...incoming,
    showIf: normalizeShowIf(incoming.showIf ?? item.showIf),
    questionImage:
      incoming.questionImage != null
        ? String(incoming.questionImage)
        : item.question_image != null
          ? String(item.question_image)
          : baseConfig.questionImage,
    blindMode:
      incoming.blindMode != null
        ? Boolean(incoming.blindMode)
        : item.blind_mode != null
          ? Boolean(item.blind_mode)
          : baseConfig.blindMode,
  }

  return {
    id: String(item.id ?? id()),
    prompt,
    type,
    options,
    config,
  }
}

export function parseSurveyQuestions(raw: string | null): SurveyQuestion[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeSurveyQuestion(item))
      .filter((item): item is SurveyQuestion => Boolean(item))
  } catch {
    return []
  }
}

export function suggestTypeFromPrompt(prompt: string): QuestionTypeId {
  const text = prompt.toLowerCase()
  if (/\b(compare|comparison|a\/b|versus|vs\.?|which (image|design|version))\b/.test(text))
    return "comparison_choice"
  if (/\b(email)\b/.test(text)) return "email"
  if (/\b(phone|mobile|call)\b/.test(text)) return "phone"
  if (/\b(when|date|last time|how long ago)\b/.test(text)) return "date"
  if (/\b(how much|\$|budget|spend|cost|price|paid)\b/.test(text))
    return "currency"
  if (/\b(how many|hours|times|count|number of)\b/.test(text)) return "number"
  if (/\b(percent|%|share of)\b/.test(text)) return "percentage"
  if (/\b(rate|rating|scale|agree)\b/.test(text)) return "likert"
  if (/\b(recommend|nps)\b/.test(text)) return "nps"
  if (/\b(which|what tools|what software|which of)\b/.test(text))
    return "multi_select"
  if (/\b(yes or no|did you|have you|do you currently)\b/.test(text))
    return "yes_no"
  if (/\b(name)\b/.test(text)) return "name"
  return "long_text"
}
