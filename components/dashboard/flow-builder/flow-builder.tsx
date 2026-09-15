"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type EdgeMouseHandler,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnReconnect,
} from "@xyflow/react"
import {
  GitBranchIcon,
  LayoutGridIcon,
  Maximize2Icon,
  Minimize2Icon,
  PlusIcon,
  SquareStackIcon,
  UnlinkIcon,
} from "lucide-react"
import "@xyflow/react/dist/style.css"

import {
  FlowBuilderActionsContext,
  GroupFlowNode,
  QuestionFlowNode,
} from "@/components/dashboard/flow-builder/flow-nodes"
import { BranchFlowEdge } from "@/components/dashboard/flow-builder/flow-edges"
import { QuestionEditSheet } from "@/components/dashboard/flow-builder/question-edit-sheet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cleanupConditionalLogic } from "@/lib/survey/conditional"
import {
  applyNodePositions,
  buildFlowGraph,
  connectMerge,
  connectOptionToTargets,
  createQuestionGroup,
  disconnectOptionFromTargets,
  layoutFlow,
  parseBranchEdgeId,
  renameQuestionGroup,
  resolveConnectionTargets,
  validateFlow,
  wouldCreateCycle,
} from "@/lib/survey/flow-graph"
import {
  createEmptyQuestion,
  duplicateQuestion as cloneQuestion,
  type SurveyQuestion,
} from "@/lib/survey/questions"
import { cn } from "@/lib/utils"

const nodeTypes = {
  question: QuestionFlowNode,
  questionGroup: GroupFlowNode,
}

const edgeTypes = {
  branch: BranchFlowEdge,
}

type FlowBuilderProps = {
  questions: SurveyQuestion[]
  onChange: (questions: SurveyQuestion[]) => void
}

function toXyNodes(questions: SurveyQuestion[]): Node[] {
  return buildFlowGraph(questions).nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    parentId: node.parentId,
    extent: node.parentId ? ("parent" as const) : undefined,
    deletable: node.type !== "questionGroup",
    style:
      node.type === "questionGroup"
        ? { width: node.width, height: node.height }
        : { width: node.width },
    data: node.data,
  }))
}

function toXyEdges(questions: SurveyQuestion[]): Edge[] {
  return buildFlowGraph(questions).edges.map((edge) => ({
    id: edge.id,
    type: edge.kind === "branch" ? "branch" : undefined,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.kind === "branch" ? edge.label : undefined,
    animated: edge.kind === "branch",
    selectable: true,
    focusable: true,
    deletable: edge.kind === "branch",
    reconnectable: edge.kind === "branch",
    style: {
      stroke: edge.color,
      strokeWidth: edge.kind === "branch" ? 2 : 1.5,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edge.color,
      width: 16,
      height: 16,
    },
    labelStyle: { fontSize: 13, fontWeight: 500, fill: "var(--foreground)" },
    data: { kind: edge.kind, removable: edge.kind === "branch" },
  }))
}

function withEdgeSelection(edges: Edge[], selectedIds: Set<string>): Edge[] {
  return edges.map((edge) => {
    const selected = selectedIds.has(edge.id)
    const branch = edge.data?.kind === "branch"
    return {
      ...edge,
      selected,
      zIndex: selected ? 1000 : branch ? 1 : 0,
      style: {
        ...edge.style,
        strokeWidth: selected ? (branch ? 3.5 : 2.5) : branch ? 2 : 1.5,
      },
    }
  })
}

function FlowCanvas({ questions, onChange }: FlowBuilderProps) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const questionsRef = useRef(questions)
  questionsRef.current = questions

  const [nodes, setNodes] = useState<Node[]>(() => toXyNodes(questions))
  const [edges, setEdges] = useState<Edge[]>(() => toXyEdges(questions))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    setNodes((current) => {
      const selected = new Set(
        current.filter((node) => node.selected).map((node) => node.id)
      )
      return toXyNodes(questions).map((node) => ({
        ...node,
        selected: selected.has(node.id),
      }))
    })
    setEdges((current) =>
      withEdgeSelection(
        toXyEdges(questions),
        new Set(current.filter((edge) => edge.selected).map((edge) => edge.id))
      )
    )
  }, [questions])

  useEffect(() => {
    if (!maximized) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMaximized(false)
    }
    window.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [maximized])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      fitView({ padding: maximized ? 0.12 : 0.18, duration: 180 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fitView, maximized])

  const issues = useMemo(() => validateFlow(questions), [questions])
  const editing = questions.find((question) => question.id === editingId) ?? null

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, nextNodes) => {
      onChange(
        applyNodePositions(
          questionsRef.current,
          nextNodes.map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            parentId: node.parentId,
          }))
        )
      )
    },
    [onChange]
  )

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((current) => {
      const next = applyEdgeChanges(changes, current)
      return withEdgeSelection(
        next,
        new Set(next.filter((edge) => edge.selected).map((edge) => edge.id))
      )
    })
  }, [])

  const removeBranchEdges = useCallback(
    (deleted: Edge[]) => {
      const branchEdges = deleted.filter((edge) => parseBranchEdgeId(edge.id))
      if (branchEdges.length === 0) return

      const removedIds = new Set(branchEdges.map((edge) => edge.id))
      setEdges((current) => current.filter((edge) => !removedIds.has(edge.id)))

      let nextQuestions = questionsRef.current
      for (const edge of branchEdges) {
        const parsed = parseBranchEdgeId(edge.id)
        if (!parsed) continue
        const targets = parsed.targetGroupId
          ? resolveConnectionTargets(
              nextQuestions,
              `group:${parsed.targetGroupId}`
            )
          : parsed.targetQuestionId
            ? [parsed.targetQuestionId]
            : []
        nextQuestions = disconnectOptionFromTargets(
          nextQuestions,
          parsed.sourceId,
          parsed.optionId,
          targets
        )
      }
      onChange(cleanupConditionalLogic(nextQuestions))
    },
    [onChange]
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      removeBranchEdges(deleted)
    },
    [removeBranchEdges]
  )

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setNodes((current) =>
      current.map((node) => ({ ...node, selected: false }))
    )
    setEdges((current) => withEdgeSelection(current, new Set([edge.id])))
    setNotice(null)
  }, [])

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const ids = new Set(
        deleted
          .filter((node) => node.type === "question")
          .map((node) => node.id)
      )
      if (ids.size === 0) return
      onChange(
        cleanupConditionalLogic(
          questionsRef.current.filter((question) => !ids.has(question.id))
        )
      )
    },
    [onChange]
  )

  const tryConnect = useCallback((connection: Connection): SurveyQuestion[] | null => {
    const sourceId = connection.source
    const handle = connection.sourceHandle ?? ""
    const targets = resolveConnectionTargets(
      questionsRef.current,
      connection.target
    )
    if (!sourceId || targets.length === 0) return null

    if (handle === "next") {
      if (wouldCreateCycle(questionsRef.current, sourceId, targets)) {
        setNotice("That connection would loop the form. Choose a later question.")
        return null
      }
      let next = questionsRef.current
      for (const targetId of targets) {
        next = connectMerge(next, sourceId, targetId)
      }
      setNotice(null)
      return next
    }

    if (!handle.startsWith("option:")) return null
    const optionId = handle.slice("option:".length)
    if (wouldCreateCycle(questionsRef.current, sourceId, targets)) {
      setNotice("That connection would loop the form. Choose a later question.")
      return null
    }
    setNotice(null)
    return connectOptionToTargets(
      questionsRef.current,
      sourceId,
      optionId,
      targets
    )
  }, [])

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const next = tryConnect(connection)
      if (next) onChange(next)
    },
    [onChange, tryConnect]
  )

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, connection) => {
      let nextQuestions = questionsRef.current
      const parsed = parseBranchEdgeId(oldEdge.id)
      if (parsed) {
        const oldTargets = parsed.targetGroupId
          ? resolveConnectionTargets(
              nextQuestions,
              `group:${parsed.targetGroupId}`
            )
          : parsed.targetQuestionId
            ? [parsed.targetQuestionId]
            : []
        nextQuestions = disconnectOptionFromTargets(
          nextQuestions,
          parsed.sourceId,
          parsed.optionId,
          oldTargets
        )
        questionsRef.current = nextQuestions
      }
      const connected = tryConnect(connection)
      onChange(connected ?? nextQuestions)
      if (connected) {
        setEdges((current) => reconnectEdge(oldEdge, connection, current))
      }
    },
    [onChange, tryConnect]
  )

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!connection.source || !connection.target) return false
    if (connection.source === connection.target) return false
    const handle = connection.sourceHandle ?? ""
    if (handle !== "next" && !handle.startsWith("option:")) return false
    const targets = resolveConnectionTargets(
      questionsRef.current,
      connection.target
    )
    if (targets.length === 0) return false
    return !wouldCreateCycle(questionsRef.current, connection.source, targets)
  }, [])

  function addQuestionAtCenter() {
    const position = screenToFlowPosition({
      x: typeof window === "undefined" ? 400 : window.innerWidth / 2,
      y: typeof window === "undefined" ? 320 : window.innerHeight / 2,
    })
    const question = {
      ...createEmptyQuestion("single_select"),
      prompt: "New question",
    }
    question.config.flowX = position.x
    question.config.flowY = position.y
    onChange([...questionsRef.current, question])
  }

  function groupSelected() {
    const selectedIds = nodes
      .filter((node) => node.selected && node.type === "question")
      .map((node) => node.id)
    if (selectedIds.length < 2) {
      setNotice("Select two or more questions, then group them into a set.")
      return
    }
    setNotice(null)
    onChange(
      createQuestionGroup(questionsRef.current, selectedIds, "Question set")
    )
  }

  function removeSelectedConnections() {
    const selected = edges.filter((edge) => edge.selected && edge.deletable)
    if (selected.length === 0) {
      setNotice("Click a colored connection first, then remove it.")
      return
    }
    setNotice(null)
    removeBranchEdges(selected)
  }

  const selectedBranchCount = edges.filter(
    (edge) => edge.selected && edge.deletable
  ).length

  const actions = useMemo(
    () => ({
      editQuestion: (id: string) => setEditingId(id),
      duplicateQuestion: (id: string) => {
        const source = questionsRef.current.find((item) => item.id === id)
        if (!source) return
        onChange([...questionsRef.current, cloneQuestion(source)])
      },
      deleteQuestion: (id: string) => {
        onChange(
          cleanupConditionalLogic(
            questionsRef.current.filter((item) => item.id !== id)
          )
        )
        setEditingId((current) => (current === id ? null : current))
      },
      renameGroup: (groupId: string, name: string) => {
        onChange(renameQuestionGroup(questionsRef.current, groupId, name))
      },
      clearIncoming: (id: string) => {
        onChange(
          questionsRef.current.map((question) =>
            question.id === id
              ? {
                  ...question,
                  config: { ...question.config, showIf: undefined },
                }
              : question
          )
        )
      },
    }),
    [onChange]
  )

  const canvasHelp = (
    <>
      <p className="text-sm leading-6 text-muted-foreground">
        <GitBranchIcon className="mr-1 inline size-4 align-text-bottom" />
        Drag from an answer dot to a later question to branch. Click a
        connection to select it, then Remove connection — or use the X on the
        line. Each answer only continues to the questions you connect.
      </p>
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {issues.length > 0 ? (
        <ul className="space-y-1.5 text-sm leading-6">
          {issues.map((issue) => (
            <li
              key={`${issue.severity}-${issue.message}`}
              className={cn(
                issue.severity === "error"
                  ? "text-destructive"
                  : issue.severity === "warning"
                    ? "text-[var(--brand-warn)]"
                    : "text-muted-foreground"
              )}
            >
              {issue.severity === "error"
                ? "Error: "
                : issue.severity === "warning"
                  ? "Check: "
                  : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : questions.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Flow looks complete. Changes save automatically.
        </p>
      ) : null}
    </>
  )

  return (
    <FlowBuilderActionsContext.Provider value={actions}>
      <div
        className={cn(
          "relative overflow-hidden border border-border bg-muted/20",
          maximized
            ? "fixed inset-0 z-[45] rounded-none"
            : "h-[calc(100dvh-11rem)] min-h-[680px] rounded-lg"
        )}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onEdgeClick={onEdgeClick}
          isValidConnection={isValidConnection}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          panOnScroll
          minZoom={0.2}
          maxZoom={2}
          colorMode="dark"
          edgesReconnectable
          edgesFocusable
          elementsSelectable
          selectNodesOnDrag={false}
          className="h-full w-full"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            color="var(--border)"
          />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
          <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-6.5rem)] flex-wrap gap-2">
            <Button type="button" onClick={addQuestionAtCenter}>
              <PlusIcon data-icon="inline-start" />
              Add question
            </Button>
            <Button type="button" variant="outline" onClick={groupSelected}>
              <SquareStackIcon data-icon="inline-start" />
              Group selected
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={selectedBranchCount === 0}
              onClick={removeSelectedConnections}
            >
              <UnlinkIcon data-icon="inline-start" />
              {selectedBranchCount > 1
                ? `Remove ${selectedBranchCount} connections`
                : "Remove connection"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onChange(layoutFlow(questionsRef.current))
                window.setTimeout(() => fitView({ padding: 0.16 }), 50)
              }}
            >
              <LayoutGridIcon data-icon="inline-start" />
              Auto arrange
            </Button>
          </div>
          <div className="absolute top-3 right-3 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMaximized((open) => !open)}
              aria-label={maximized ? "Minimise canvas" : "Maximise canvas"}
            >
              {maximized ? (
                <Minimize2Icon data-icon="inline-start" />
              ) : (
                <Maximize2Icon data-icon="inline-start" />
              )}
              {maximized ? "Minimise" : "Maximise"}
            </Button>
          </div>
          {maximized ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 max-w-xl rounded-md border border-border/80 bg-background/90 p-3 shadow-sm backdrop-blur-sm">
              <div className="pointer-events-auto space-y-2">{canvasHelp}</div>
            </div>
          ) : null}
        </ReactFlow>
      </div>

      {maximized ? null : <div className="space-y-2">{canvasHelp}</div>}

      <QuestionEditSheet
        question={editing}
        questions={questions}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        onChange={(id, patch) => {
          onChange(
            questionsRef.current.map((question) =>
              question.id === id ? { ...question, ...patch, id } : question
            )
          )
        }}
        onOptionsChange={(id, nextQuestion) => {
          onChange(
            cleanupConditionalLogic(
              questionsRef.current.map((question) =>
                question.id === id ? nextQuestion : question
              )
            )
          )
        }}
      />
    </FlowBuilderActionsContext.Provider>
  )
}

export function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <div className="space-y-3">
        <FlowCanvas {...props} />
      </div>
    </ReactFlowProvider>
  )
}
