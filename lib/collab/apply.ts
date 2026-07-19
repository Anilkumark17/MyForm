import type { QuestionOp } from "@/lib/collab/types"
import type { SurveyQuestion } from "@/lib/survey/questions"

/** Apply a single OT operation to the questions document. */
export function applyQuestionOp(
  questions: SurveyQuestion[],
  op: QuestionOp
): SurveyQuestion[] {
  switch (op.type) {
    case "insert": {
      const next = [...questions]
      const index = Math.max(0, Math.min(op.index, next.length))
      next.splice(index, 0, op.question)
      return next
    }
    case "delete": {
      const next = [...questions]
      const atId = next.findIndex((q) => q.id === op.questionId)
      const index = atId >= 0 ? atId : op.index
      if (index < 0 || index >= next.length) return next
      next.splice(index, 1)
      return next
    }
    case "update": {
      return questions.map((question) =>
        question.id === op.questionId
          ? { ...question, ...op.patch, id: question.id }
          : question
      )
    }
    case "move": {
      const next = [...questions]
      if (
        op.from < 0 ||
        op.from >= next.length ||
        op.to < 0 ||
        op.to >= next.length ||
        op.from === op.to
      ) {
        return next
      }
      const [item] = next.splice(op.from, 1)
      next.splice(op.to, 0, item)
      return next
    }
    case "replace_all":
      return [...op.questions]
    default:
      return questions
  }
}

export function applyQuestionOps(
  questions: SurveyQuestion[],
  ops: QuestionOp[]
): SurveyQuestion[] {
  return ops.reduce((acc, op) => applyQuestionOp(acc, op), questions)
}
