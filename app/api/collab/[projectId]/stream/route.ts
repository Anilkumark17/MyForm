import { getAccessibleProject } from "@/lib/collab/access"
import { getCollabPeers, subscribeCollabRoom } from "@/lib/collab/hub"
import type { CollabServerMessage } from "@/lib/collab/types"
import { getSessionUser } from "@/lib/auth/session"
import { parseProjectQuestions } from "@/lib/projects/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { projectId } = await context.params
  const access = await getAccessibleProject(projectId, user.id)
  if (!access) {
    return new Response("Forbidden", { status: 403 })
  }

  const url = new URL(request.url)
  const clientId =
    url.searchParams.get("clientId")?.slice(0, 64) || crypto.randomUUID()

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (message: CollabServerMessage) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
        )
      }

      unsubscribe = subscribeCollabRoom(projectId, {
        clientId,
        userId: user.id,
        userName: user.name,
        send,
      })

      send({
        type: "snapshot",
        revision: access.project.questionsRevision ?? 0,
        questions: parseProjectQuestions(access.project.questions),
        peers: getCollabPeers(projectId),
      })

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          // closed
        }
      }, 15000)

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe?.()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
