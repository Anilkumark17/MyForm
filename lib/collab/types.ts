import type { SurveyQuestion } from "@/lib/survey/questions"

/**
 * Operations on the shared questions document.
 * Transformed with OT so concurrent edits from collaborators converge.
 */
export type QuestionOp =
  | {
      type: "insert"
      index: number
      question: SurveyQuestion
    }
  | {
      type: "delete"
      index: number
      questionId: string
    }
  | {
      type: "update"
      questionId: string
      patch: Partial<SurveyQuestion>
    }
  | {
      type: "move"
      from: number
      to: number
    }
  | {
      type: "replace_all"
      questions: SurveyQuestion[]
    }

export type CollabServerMessage =
  | {
      type: "snapshot"
      revision: number
      questions: SurveyQuestion[]
      peers: CollabPeer[]
    }
  | {
      type: "op"
      revision: number
      clientId: string
      userId: string
      userName: string
      op: QuestionOp
    }
  | {
      type: "presence"
      peers: CollabPeer[]
    }
  | {
      type: "error"
      message: string
    }

export type CollabPeer = {
  clientId: string
  userId: string
  userName: string
  color: string
}

export type SubmitOpBody = {
  clientId: string
  baseRevision: number
  op: QuestionOp
}
