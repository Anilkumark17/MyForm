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
  onRemoteQuestions: (questions: SurveyQuestion[]) => void
}

export function useQuestionCollab({
  projectId,
  enabled = true,
  questions,
  onRemoteQuestions,
}: UseQuestionCollabArgs) {
  const [revision, setRevision] = useState(0)
  const [peers, setPeers] = useState<CollabPeer[]>([])
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const clientIdRef = useRef(makeClientId())
  const revisionRef = useRef(0)
  const questionsRef = useRef(questions)
  const applyingRemoteRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const applyRemote = useEffectEvent((message: CollabServerMessage) => {
    if (message.type === "snapshot") {
      revisionRef.current = message.revision
      setRevision(message.revision)
      setPeers(message.peers)
      applyingRemoteRef.current = true
      onRemoteQuestions(message.questions)
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
      onRemoteQuestions(next)
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
      setSyncing(true)
      try {
        const response = await fetch(`/api/collab/${projectId}/ops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: clientIdRef.current,
            baseRevision: revisionRef.current,
            op,
          }),
        })
        const data = (await response.json()) as {
          ok?: boolean
          revision?: number
          error?: string
        }
        if (response.ok && typeof data.revision === "number") {
          revisionRef.current = data.revision
          setRevision(data.revision)
        }
      } finally {
        setSyncing(false)
      }
    }
  }

  function publishLocalChange(next: SurveyQuestion[]) {
    if (!enabled || applyingRemoteRef.current) {
      questionsRef.current = next
      return
    }

    const prev = questionsRef.current
    questionsRef.current = next
    const ops = diffQuestions(prev, next)
    if (ops.length === 0) return

    queueRef.current = queueRef.current.then(() => submitOps(ops))
  }

  return {
    clientId: clientIdRef.current,
    revision,
    peers,
    connected,
    syncing,
    publishLocalChange,
  }
}
