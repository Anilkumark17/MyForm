import type { CollabPeer, CollabServerMessage } from "@/lib/collab/types"

type Subscriber = {
  clientId: string
  userId: string
  userName: string
  color: string
  send: (message: CollabServerMessage) => void
}

type Room = {
  subscribers: Map<string, Subscriber>
}

declare global {
  // eslint-disable-next-line no-var
  var __myformCollabHub: Map<string, Room> | undefined
}

function rooms(): Map<string, Room> {
  if (!globalThis.__myformCollabHub) {
    globalThis.__myformCollabHub = new Map()
  }
  return globalThis.__myformCollabHub
}

const COLORS = [
  "#2dd4bf",
  "#f59e0b",
  "#38bdf8",
  "#f472b6",
  "#a78bfa",
  "#34d399",
]

export function subscribeCollabRoom(
  projectId: string,
  subscriber: Omit<Subscriber, "color"> & { color?: string }
): () => void {
  const map = rooms()
  let room = map.get(projectId)
  if (!room) {
    room = { subscribers: new Map() }
    map.set(projectId, room)
  }

  const color =
    subscriber.color ??
    COLORS[room.subscribers.size % COLORS.length]

  room.subscribers.set(subscriber.clientId, {
    ...subscriber,
    color,
  })

  broadcastPresence(projectId)

  return () => {
    const current = map.get(projectId)
    if (!current) return
    current.subscribers.delete(subscriber.clientId)
    if (current.subscribers.size === 0) {
      map.delete(projectId)
    } else {
      broadcastPresence(projectId)
    }
  }
}

export function getCollabPeers(projectId: string): CollabPeer[] {
  const room = rooms().get(projectId)
  if (!room) return []
  return Array.from(room.subscribers.values()).map((s) => ({
    clientId: s.clientId,
    userId: s.userId,
    userName: s.userName,
    color: s.color,
  }))
}

export function broadcastCollab(
  projectId: string,
  message: CollabServerMessage,
  exceptClientId?: string
) {
  const room = rooms().get(projectId)
  if (!room) return
  for (const sub of room.subscribers.values()) {
    if (exceptClientId && sub.clientId === exceptClientId) continue
    try {
      sub.send(message)
    } catch {
      // drop broken subscriber on next unsubscribe
    }
  }
}

function broadcastPresence(projectId: string) {
  broadcastCollab(projectId, {
    type: "presence",
    peers: getCollabPeers(projectId),
  })
}
