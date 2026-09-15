"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"

import { applyQuestionOp } from "@/lib/collab/apply"
import { diffQuestions } from "@/lib/collab/diff"
import type { CollabPeer, CollabServerMessage, QuestionOp } from "@/lib/collab/types"
import type { SurveyQuestion } from "@/lib/survey/questions"

function makeClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `c-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type UseQuestionCollabArgs = {
  projectId: string
  enabled?: boolean
  questions: SurveyQuestion[]
  onRemoteQuestions: (
    questions: SurveyQuestion[],
    meta?: { source: "snapshot" | "op" }
  ) => void
  onPersistIdle?: () => void
  onPersistError?: (message: string) => void
}

export function useQuestionCollab({
  projectId,
  enabled = true,
  questions,
  onRemoteQuestions,
  onPersistIdle,
  onPersistError,
}: UseQuestionCollabArgs) {
  const [revision, setRevision] = useState(0)
  const [peers, setPeers] = useState<CollabPeer[]>([])
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const clientIdRef = useRef(makeClientId())
  const revisionRef = useRef(0)
  const questionsRef = useRef(questions)
  const ackedRef = useRef(questions)
  const applyingRemoteRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const inflightRef = useRef(0)
  const persistFailedRef = useRef(false)
  const lastErrorRef = useRef("Could not save questions.")

  const notifyIdle = useEffectEvent(() => {
    onPersistIdle?.()
  })

  const notifyError = useEffectEvent((message: string) => {
    onPersistError?.(message)
  })

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const applyRemote = useEffectEvent((message: CollabServerMessage) => {
    if (message.type === "snapshot") {
      revisionRef.current = message.revision
      setRevision(message.revision)
      setPeers(message.peers)
      questionsRef.current = message.questions
      ackedRef.current = message.questions
      applyingRemoteRef.current = true
      onRemoteQuestions(message.questions, { source: "snapshot" })
      queueMicrotask(() => {
        applyingRemoteRef.current = false
      })
      return
    }

    if (message.type === "presence") {
      setPeers(message.peers)
      return
    }

    if (message.type === "op") {
      if (message.clientId === clientIdRef.current) {
        revisionRef.current = message.revision
        setRevision(message.revision)
        return
      }
      revisionRef.current = message.revision
      setRevision(message.revision)
      applyingRemoteRef.current = true
      const next = applyQuestionOp(questionsRef.current, message.op)
      questionsRef.current = next
      ackedRef.current = next
      onRemoteQuestions(next, { source: "op" })
      queueMicrotask(() => {
        applyingRemoteRef.current = false
      })
    }
  })

  useEffect(() => {
    if (!enabled) return

    const clientId = clientIdRef.current
    const source = new EventSource(
      `/api/collab/${projectId}/stream?clientId=${encodeURIComponent(clientId)}`
    )

    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as CollabServerMessage
        applyRemote(message)
      } catch {
        // ignore malformed
      }
    }

    return () => {
      source.close()
      setConnected(false)
    }
  }, [projectId, enabled])

  async function submitOps(ops: QuestionOp[]) {
    for (const op of ops) {
      const response = await fetch(`/api/collab/${projectId}/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdRef.current,
          baseRevision: revisionRef.current,
          op,
        }),
      })
      let data: { ok?: boolean; revision?: number; error?: string } = {}
      try {
        data = (await response.json()) as typeof data
      } catch {
        data = {}
      }
      if (!response.ok) {
        throw new Error(data.error ?? "Could not save questions.")
      }
      if (typeof data.revision === "number") {
        revisionRef.current = data.revision
        setRevision(data.revision)
      }
    }
  }

  function finishBatch() {
    inflightRef.current = Math.max(0, inflightRef.current - 1)
    if (inflightRef.current > 0) return
    setSyncing(false)
    if (persistFailedRef.current) {
      persistFailedRef.current = false
      notifyError(lastErrorRef.current)
      return
    }
    ackedRef.current = questionsRef.current
    notifyIdle()
  }

  function enqueueOps(ops: QuestionOp[]) {
    if (!enabled || ops.length === 0) return
    inflightRef.current += 1
    setSyncing(true)
    queueRef.current = queueRef.current.then(async () => {
      try {
        await submitOps(ops)
        persistFailedRef.current = false
      } catch (error) {
        persistFailedRef.current = true
        lastErrorRef.current =
          error instanceof Error ? error.message : "Could not save questions."
      } finally {
        finishBatch()
      }
    })
  }

  function publishLocalChange(next: SurveyQuestion[]) {
    if (!enabled || applyingRemoteRef.current) {
      questionsRef.current = next
      return
    }

    const prev = questionsRef.current
    questionsRef.current = next
    enqueueOps(diffQuestions(prev, next))
  }

  function retryPersist() {
    enqueueOps(diffQuestions(ackedRef.current, questionsRef.current))
  }

  function acknowledgePersist(nextRevision: number, next: SurveyQuestion[]) {
    revisionRef.current = nextRevision
    setRevision(nextRevision)
    ackedRef.current = next
  }

  return {
    clientId: clientIdRef.current,
    revision,
    peers,
    connected,
    syncing,
    publishLocalChange,
    retryPersist,
    acknowledgePersist,
  }
}
