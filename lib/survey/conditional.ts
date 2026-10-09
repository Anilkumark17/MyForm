import {
  getComparisonBranchValue,
  isComparisonQuestion,
} from "@/lib/survey/comparison"
import type { AnswerOption, SurveyQuestion } from "@/lib/survey/questions"

/**
 * Per-answer flows.
 *
 * Questions run top to bottom. On a choice, dropdown or yes/no question each
 * answer can own a flow: a set of later questions (`config.branchOf` on each
 * member). Picking that answer runs only that answer's flow, then everyone
 * continues with the next question that belongs to no flow. Flows can nest.
 */
export type BranchRef = { questionId: string; optionId: string }

const BRANCHING_TYPES = new Set(["single_select", "dropdown", "yes_no"])

const ANSWER_KEYS_TO_KEEP = [
  "utm_source",
  "source",
  "campaign",
  "utm_campaign",
]

export function canBranchFrom(question: SurveyQuestion): boolean {
  return BRANCHING_TYPES.has(question.type) && question.options.length > 0
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

function answerTokens(
  question: SurveyQuestion | undefined,
  answer: unknown
): string[] {
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

export function branchRefs(question: SurveyQuestion): BranchRef[] {
  return question.config.branchOf ?? []
}

/** Question ids that belong to this answer's flow, in form order. */
export function flowMemberIds(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string
): string[] {
  return questions
    .filter((question) =>
      branchRefs(question).some(
        (ref) => ref.questionId === sourceId && ref.optionId === optionId
      )
    )
    .map((question) => question.id)
}

export const SUBMIT_TARGET = "__submit__"

export type FormSection = {
  /** Id of the first question in the section */
  id: string
  title: string
  description?: string
  after?: string
  questions: SurveyQuestion[]
}

/** Split the form into sections at every question marked `sectionStart`. */
export function getSections(questions: SurveyQuestion[]): FormSection[] {
  const sections: FormSection[] = []
  questions.forEach((question, index) => {
    const start = question.config.sectionStart
    if (index === 0 || start) {
      sections.push({
        id: question.id,
        title: start?.title ?? "",
        description: start?.description,
        after: start?.after,
        questions: [question],
      })
    } else {
      sections[sections.length - 1].questions.push(question)
    }
  })
  return sections
}

export function hasSections(questions: SurveyQuestion[]): boolean {
  return questions.some((question, index) => index > 0 && question.config.sectionStart)
}

/**
 * Where the respondent goes when leaving a section: the first answered
 * question with a matching go-to rule, else the section's "after" setting,
 * else the next section. Returns SUBMIT_TARGET to finish, undefined for next.
 */
export function targetAfterSection(
  section: FormSection,
  answers: Record<string, unknown>
): string | undefined {
  for (const question of section.questions) {
    if (!canBranchFrom(question) || !question.config.goTo) continue
    for (const optionId of selectedOptionIds(question, answers[question.id])) {
      const target = question.config.goTo[optionId]
      if (target) return target
    }
  }
  return section.after || undefined
}

/** Sections the respondent will pass through, in order. Jumps go forward only. */
export function getSectionPath(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): FormSection[] {
  const sections = getSections(questions)
  const path: FormSection[] = []
  let index = 0
  while (index >= 0 && index < sections.length) {
    const section = sections[index]
    path.push(section)
    const target = targetAfterSection(section, answers)
    if (target === SUBMIT_TARGET) break
    const jump = target ? sections.findIndex((item) => item.id === target) : -1
    index = jump > index ? jump : index + 1
  }
  return path
}

/** Questions the respondent will see, in order, given the answers so far. */
export function getVisibleQuestions(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): SurveyQuestion[] {
  if (hasSections(questions)) {
    return getSectionPath(questions, answers).flatMap(
      (section) => section.questions
    )
  }
  const path: SurveyQuestion[] = []
  const seen = new Set<string>()

  const visit = (question: SurveyQuestion) => {
    if (seen.has(question.id)) return
    seen.add(question.id)
    path.push(question)
    if (!canBranchFrom(question)) return

    const selected = selectedOptionIds(question, answers[question.id])
    const members = questions.filter((item) =>
      branchRefs(item).some(
        (ref) =>
          ref.questionId === question.id && selected.includes(ref.optionId)
      )
    )
    for (const member of members) visit(member)
  }

  for (const question of questions) {
    if (branchRefs(question).length > 0) continue
    visit(question)
  }
  return path
}

export function isQuestionVisible(
  question: SurveyQuestion,
  answers: Record<string, unknown>,
  allQuestions: SurveyQuestion[]
): boolean {
  return getVisibleQuestions(allQuestions, answers).some(
    (item) => item.id === question.id
  )
}

/** Keep answers for the visible path (plus hidden fields / attribution keys). */
export function answersForVisiblePath(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): Record<string, unknown> {
  const keepIds = new Set(
    getVisibleQuestions(questions, answers).map((question) => question.id)
  )
  for (const question of questions) {
    if (question.type === "hidden") keepIds.add(question.id)
  }

  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(answers)) {
    if (keepIds.has(key) || ANSWER_KEYS_TO_KEEP.includes(key)) {
      next[key] = value
    }
  }
  return next
}

/** True when some answer of this question owns a flow. */
export function hasOutgoingBranches(
  questions: SurveyQuestion[],
  question: SurveyQuestion
): boolean {
  return questions.some((item) =>
    branchRefs(item).some((ref) => ref.questionId === question.id)
  )
}

/** Flow sources this question belongs to. */
export function questionsTargeting(
  questions: SurveyQuestion[],
  questionId: string
): SurveyQuestion[] {
  const member = questions.find((question) => question.id === questionId)
  if (!member) return []
  const sources = new Set(branchRefs(member).map((ref) => ref.questionId))
  return questions.filter((question) => sources.has(question.id))
}

function withBranchOf(
  question: SurveyQuestion,
  refs: BranchRef[]
): SurveyQuestion {
  return {
    ...question,
    config: {
      ...question.config,
      branchOf: refs.length > 0 ? refs : undefined,
    },
  }
}

/** Add or remove a question from an answer's flow. */
export function toggleFlowMember(
  questions: SurveyQuestion[],
  sourceId: string,
  optionId: string,
  memberId: string,
  enabled: boolean
): SurveyQuestion[] {
  return questions.map((question) => {
    if (question.id !== memberId) return question
    const others = branchRefs(question).filter(
      (ref) => !(ref.questionId === sourceId && ref.optionId === optionId)
    )
    return withBranchOf(
      question,
      enabled ? [...others, { questionId: sourceId, optionId }] : others
    )
  })
}

/** Remove a question from every flow it belongs to. */
export function clearTargetsTo(
  questions: SurveyQuestion[],
  questionId: string
): SurveyQuestion[] {
  return questions.map((question) =>
    question.id === questionId ? withBranchOf(question, []) : question
  )
}

/** Drop flow memberships that point at missing or earlier questions/options. */
export function cleanupConditionalLogic(
  questions: SurveyQuestion[]
): SurveyQuestion[] {
  const indexById = new Map(
    questions.map((question, index) => [question.id, index])
  )

  const sectionIds = new Set(
    questions
      .filter((question, index) => index === 0 || question.config.sectionStart)
      .map((question) => question.id)
  )
  const validSectionTarget = (target: string | undefined, index: number) =>
    !target ||
    target === SUBMIT_TARGET ||
    (sectionIds.has(target) && (indexById.get(target) ?? -1) > index)

  return questions.map((question, index) => {
    const withSections = cleanupSectionRouting(
      question,
      index,
      validSectionTarget
    )
    if (withSections !== question) {
      return cleanupFlowRefs(withSections, index, questions, indexById)
    }
    return cleanupFlowRefs(question, index, questions, indexById)
  })
}

function cleanupSectionRouting(
  question: SurveyQuestion,
  index: number,
  validSectionTarget: (target: string | undefined, index: number) => boolean
): SurveyQuestion {
  const { goTo, sectionStart } = question.config
  const optionIds = new Set(question.options.map((option) => option.id))
  const cleanGoTo =
    goTo && canBranchFrom(question)
      ? Object.fromEntries(
          Object.entries(goTo).filter(
            ([optionId, target]) =>
              optionIds.has(optionId) && validSectionTarget(target, index)
          )
        )
      : undefined
  const goToChanged =
    JSON.stringify(cleanGoTo ?? {}) !== JSON.stringify(goTo ?? {})
  const afterChanged =
    sectionStart?.after != null && !validSectionTarget(sectionStart.after, index)
  if (!goToChanged && !afterChanged) return question
  return {
    ...question,
    config: {
      ...question.config,
      goTo:
        cleanGoTo && Object.keys(cleanGoTo).length > 0 ? cleanGoTo : undefined,
      sectionStart:
        sectionStart && afterChanged
          ? { ...sectionStart, after: undefined }
          : sectionStart,
    },
  }
}

function cleanupFlowRefs(
  question: SurveyQuestion,
  index: number,
  questions: SurveyQuestion[],
  indexById: Map<string, number>
): SurveyQuestion {
  {
    const refs = question.config.branchOf
    if (!refs && question.config.showIf === undefined) return question

    const valid = (refs ?? []).filter((ref) => {
      const sourceIndex = indexById.get(ref.questionId) ?? -1
      if (sourceIndex < 0 || sourceIndex >= index) return false
      const source = questions[sourceIndex]
      return (
        canBranchFrom(source) &&
        source.options.some((option) => option.id === ref.optionId)
      )
    })
    if (
      question.config.showIf === undefined &&
      valid.length === (refs ?? []).length
    ) {
      return question
    }
    return {
      ...question,
      config: {
        ...question.config,
        showIf: undefined,
        branchOf: valid.length > 0 ? valid : undefined,
      },
    }
  }
}

/** Convert old "show this question when…" rules into per-answer flows. */
export function migrateLegacyShowIf(
  questions: SurveyQuestion[]
): SurveyQuestion[] {
  if (!questions.some((question) => question.config.showIf !== undefined)) {
    return questions
  }

  const byId = new Map(questions.map((question) => [question.id, question]))
  return cleanupConditionalLogic(
    questions.map((question) => {
      const rule = question.config.showIf as
        | { conditions?: unknown }
        | undefined
      if (!rule) return question
      const refs = [...branchRefs(question)]
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
      for (const raw of conditions) {
        const condition = raw as {
          questionId?: unknown
          operator?: unknown
          values?: unknown
        }
        if (condition.operator === "is_not") continue
        const source = byId.get(String(condition.questionId ?? ""))
        if (!source || !canBranchFrom(source)) continue
        const values = Array.isArray(condition.values)
          ? condition.values.map((value) => String(value).trim())
          : []
        for (const option of source.options) {
          if (!values.some((value) => optionMatchers(option).includes(value))) {
            continue
          }
          const exists = refs.some(
            (ref) => ref.questionId === source.id && ref.optionId === option.id
          )
          if (!exists) refs.push({ questionId: source.id, optionId: option.id })
        }
      }
      return withBranchOf(
        { ...question, config: { ...question.config, showIf: undefined } },
        refs
      )
    })
  )
}
