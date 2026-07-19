import { z } from "zod"

import { getAccessibleProject } from "@/lib/collab/access"
import { acceptQuestionOp } from "@/lib/collab/server"
import { getSessionUser } from "@/lib/auth/session"

export const runtime = "nodejs"

const opSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("insert"),
    index: z.number().int().nonnegative(),
    question: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("delete"),
    index: z.number().int(),
    questionId: z.string(),
  }),
  z.object({
    type: z.literal("update"),
    questionId: z.string(),
    patch: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("move"),
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("replace_all"),
    questions: z.array(z.record(z.string(), z.unknown())),
  }),
])

const bodySchema = z.object({
  clientId: z.string().min(1).max(64),
  baseRevision: z.number().int().nonnegative(),
  op: opSchema,
})

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await context.params
  const access = await getAccessibleProject(projectId, user.id)
  if (!access) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Invalid op payload" }, { status: 400 })
  }

  const result = await acceptQuestionOp({
    projectId,
    userId: user.id,
    userName: user.name,
    clientId: parsed.data.clientId,
    baseRevision: parsed.data.baseRevision,
    op: parsed.data.op as never,
  })

  if (!result.ok) {
    return Response.json(
      { error: result.error, revision: result.revision },
      { status: 409 }
    )
  }

  return Response.json({
    ok: true,
    revision: result.revision,
    op: result.op,
  })
}
