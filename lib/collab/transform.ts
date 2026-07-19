import type { QuestionOp } from "@/lib/collab/types"

/**
 * Operational Transformation for question-list ops.
 * transform(clientOp, serverOp) → clientOp' so both converge when
 * the server already applied serverOp and the client was based on an older revision.
 *
 * Convention: `priority` true means `left` was server-side (wins on ties).
 */
export function transformQuestionOp(
  left: QuestionOp,
  right: QuestionOp,
  priority: boolean
): QuestionOp {
  if (left.type === "replace_all") {
    return priority ? left : right.type === "replace_all" ? right : left
  }
  if (right.type === "replace_all") {
    return left
  }

  if (left.type === "insert" && right.type === "insert") {
    if (right.index < left.index || (right.index === left.index && priority)) {
      return left
    }
    if (right.index === left.index && !priority) {
      return { ...left, index: left.index + 1 }
    }
    if (right.index < left.index) {
      return { ...left, index: left.index + 1 }
    }
    return left
  }

  if (left.type === "insert" && right.type === "delete") {
    if (right.index < left.index) {
      return { ...left, index: Math.max(0, left.index - 1) }
    }
    return left
  }

  if (left.type === "delete" && right.type === "insert") {
    if (right.index <= left.index) {
      return { ...left, index: left.index + 1 }
    }
    return left
  }

  if (left.type === "delete" && right.type === "delete") {
    if (left.questionId === right.questionId || left.index === right.index) {
      // Already deleted on server — no-op delete at safe index
      return { ...left, index: -1, questionId: left.questionId }
    }
    if (right.index < left.index) {
      return { ...left, index: left.index - 1 }
    }
    return left
  }

  if (left.type === "update" && right.type === "delete") {
    if (left.questionId === right.questionId) {
      return { type: "delete", index: right.index, questionId: left.questionId }
    }
    return left
  }

  if (left.type === "delete" && right.type === "update") {
    return left
  }

  if (left.type === "update" && right.type === "update") {
    if (left.questionId !== right.questionId) return left
    // Field-level merge: server (priority) wins on overlapping keys
    if (priority) {
      return {
        type: "update",
        questionId: left.questionId,
        patch: { ...left.patch, ...right.patch },
      }
    }
    return {
      type: "update",
      questionId: left.questionId,
      patch: { ...right.patch, ...left.patch },
    }
  }

  if (left.type === "move" && right.type === "insert") {
    let from = left.from
    let to = left.to
    if (right.index <= from) from += 1
    if (right.index <= to) to += 1
    return { ...left, from, to }
  }

  if (left.type === "move" && right.type === "delete") {
    if (right.index === left.from) {
      return { type: "delete", index: -1, questionId: "" }
    }
    let from = left.from
    let to = left.to
    if (right.index < from) from -= 1
    if (right.index < to) to -= 1
    return { ...left, from, to }
  }

  if (left.type === "insert" && right.type === "move") {
    return left
  }

  if (left.type === "delete" && right.type === "move") {
    return left
  }

  return left
}

/** Transform client op against a sequence of already-applied server ops. */
export function transformAgainstServerOps(
  clientOp: QuestionOp,
  serverOps: QuestionOp[]
): QuestionOp {
  return serverOps.reduce(
    (op, serverOp) => transformQuestionOp(op, serverOp, false),
    clientOp
  )
}
