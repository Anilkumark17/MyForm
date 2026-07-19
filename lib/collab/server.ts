import { and, asc, eq, gt } from "drizzle-orm"

import { applyQuestionOp } from "@/lib/collab/apply"
import { broadcastCollab } from "@/lib/collab/hub"
import { transformAgainstServerOps } from "@/lib/collab/transform"
import type { QuestionOp } from "@/lib/collab/types"
import { db } from "@/lib/db"
import { projectOps, projects } from "@/lib/db/schema"
import { parseProjectQuestions } from "@/lib/projects/utils"

export async function acceptQuestionOp(input: {
  projectId: string
  userId: string
  userName: string
  clientId: string
  baseRevision: number
  op: QuestionOp
}): Promise<
  | { ok: true; revision: number; op: QuestionOp }
  | { ok: false; error: string; revision?: number }
> {
  const [project] = await db
    .select({
      id: projects.id,
      questions: projects.questions,
      questionsRevision: projects.questionsRevision,
    })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1)

  if (!project) {
    return { ok: false, error: "Project not found." }
  }

  const currentRevision = project.questionsRevision ?? 0

  if (input.baseRevision > currentRevision) {
    return {
      ok: false,
      error: "Client revision ahead of server.",
      revision: currentRevision,
    }
  }

  const concurrent = await db
    .select({
      op: projectOps.op,
      revision: projectOps.revision,
    })
    .from(projectOps)
    .where(
      and(
        eq(projectOps.projectId, input.projectId),
        gt(projectOps.revision, input.baseRevision)
      )
    )
    .orderBy(asc(projectOps.revision))

  const serverOps = concurrent.map((row) => row.op as unknown as QuestionOp)
  let transformed = transformAgainstServerOps(input.op, serverOps)

  // Drop no-op deletes
  if (transformed.type === "delete" && transformed.index < 0) {
    return { ok: true, revision: currentRevision, op: transformed }
  }

  const questions = parseProjectQuestions(project.questions)
  const nextQuestions = applyQuestionOp(questions, transformed)
  const nextRevision = currentRevision + 1

  await db
    .update(projects)
    .set({
      questions: JSON.stringify(nextQuestions),
      questionsRevision: nextRevision,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, input.projectId))

  await db.insert(projectOps).values({
    projectId: input.projectId,
    revision: nextRevision,
    clientId: input.clientId,
    userId: input.userId,
    op: transformed as unknown as Record<string, unknown>,
  })

  broadcastCollab(
    input.projectId,
    {
      type: "op",
      revision: nextRevision,
      clientId: input.clientId,
      userId: input.userId,
      userName: input.userName,
      op: transformed,
    },
    input.clientId
  )

  return { ok: true, revision: nextRevision, op: transformed }
}
