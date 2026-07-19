import type { QuestionOp } from "@/lib/collab/types"
import type { SurveyQuestion } from "@/lib/survey/questions"

function sameQuestion(a: SurveyQuestion, b: SurveyQuestion): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Diff two question lists into OT ops (best-effort for the editor).
 * Prefer small update/insert/delete ops over replace_all when possible.
 */
export function diffQuestions(
  prev: SurveyQuestion[],
  next: SurveyQuestion[]
): QuestionOp[] {
  if (prev.length === 0 && next.length === 0) return []

  const prevIds = prev.map((q) => q.id)
  const nextIds = next.map((q) => q.id)
  const prevMap = new Map(prev.map((q) => [q.id, q]))
  const nextMap = new Map(next.map((q) => [q.id, q]))

  // Fast path: identical order, only field updates
  if (
    prevIds.length === nextIds.length &&
    prevIds.every((id, i) => id === nextIds[i])
  ) {
    const updates: QuestionOp[] = []
    for (const id of nextIds) {
      const before = prevMap.get(id)!
      const after = nextMap.get(id)!
      if (!sameQuestion(before, after)) {
        updates.push({ type: "update", questionId: id, patch: after })
      }
    }
    return updates
  }

  const ops: QuestionOp[] = []

  // Deletes (reverse order so indices stay valid if applied sequentially on prev)
  for (let i = prev.length - 1; i >= 0; i--) {
    if (!nextMap.has(prev[i].id)) {
      ops.push({ type: "delete", index: i, questionId: prev[i].id })
    }
  }

  // After deletes conceptually, build working list of remaining ids in prev order
  let working = prev.filter((q) => nextMap.has(q.id)).map((q) => q.id)

  for (let i = 0; i < next.length; i++) {
    const q = next[i]
    const at = working.indexOf(q.id)
    if (at === -1) {
      ops.push({ type: "insert", index: i, question: q })
      working.splice(i, 0, q.id)
    } else if (at !== i) {
      ops.push({ type: "move", from: at, to: i })
      working.splice(at, 1)
      working.splice(i, 0, q.id)
    }
    const before = prevMap.get(q.id)
    if (before && !sameQuestion(before, q)) {
      ops.push({ type: "update", questionId: q.id, patch: q })
    }
  }

  // If diff exploded, fall back to replace_all
  if (ops.length > next.length + prev.length + 4) {
    return [{ type: "replace_all", questions: next }]
  }

  return ops
}
