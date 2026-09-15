"use client"

import { createContext, useContext } from "react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { CopyIcon, PencilIcon, Trash2Icon, UnlinkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { optionHandleId } from "@/lib/survey/flow-graph"
import { cn } from "@/lib/utils"

export type QuestionFlowData = {
  questionId: string
  index: number
  prompt: string
  typeLabel: string
  required: boolean
  options: Array<{ id: string; label: string }>
  hasShowIf: boolean
} & Record<string, unknown>

export type GroupFlowData = {
  groupId: string
  prompt: string
  memberCount: number
} & Record<string, unknown>

export type FlowBuilderActions = {
  editQuestion: (id: string) => void
  duplicateQuestion: (id: string) => void
  deleteQuestion: (id: string) => void
  clearIncoming: (id: string) => void
  renameGroup: (groupId: string, name: string) => void
}

export const FlowBuilderActionsContext = createContext<FlowBuilderActions | null>(
  null
)

function useFlowActions() {
  const actions = useContext(FlowBuilderActionsContext)
  if (!actions) {
    throw new Error("FlowBuilderActionsContext missing")
  }
  return actions
}

export function QuestionFlowNode({
  data,
  selected,
}: NodeProps<Node<QuestionFlowData>>) {
  const actions = useFlowActions()
  const options =
    data.options.length > 0
      ? data.options
      : [{ id: "continue", label: "Continue" }]
  const fakeContinue = data.options.length === 0

  return (
    <div
      className={cn(
        "w-[280px] rounded-lg border bg-card shadow-sm",
        selected ? "border-foreground" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-2.5 !border-2 !border-background !bg-[var(--brand-signal)]"
      />
      <div className="flex items-start justify-between gap-2 border-b border-border/80 px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Q{data.index + 1}
            </p>
            <Badge variant="outline">{data.typeLabel}</Badge>
            {data.required ? (
              <Badge variant="secondary">Required</Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground">Optional</span>
            )}
            {data.hasShowIf ? (
              <Badge variant="secondary">Branched</Badge>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
            {data.prompt}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Edit question"
            onClick={() => actions.editQuestion(data.questionId)}
          >
            <PencilIcon />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Duplicate question"
            onClick={() => actions.duplicateQuestion(data.questionId)}
          >
            <CopyIcon />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Delete question"
            onClick={() => actions.deleteQuestion(data.questionId)}
          >
            <Trash2Icon />
          </Button>
          {data.hasShowIf ? (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Remove incoming connections"
              onClick={() => actions.clearIncoming(data.questionId)}
            >
              <UnlinkIcon />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-0.5 px-2 py-2">
        {options.map((option, optionIndex) => (
          <div
            key={option.id}
            className="flex min-h-7 items-center rounded-md px-2 text-xs hover:bg-muted/60"
          >
            <span className="mr-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="min-w-0 flex-1 truncate pr-3">
              {fakeContinue ? "Then continue" : option.label}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={fakeContinue ? "next" : optionHandleId(option.id)}
              style={{ top: 62 + optionIndex * 30 }}
              className="!size-2.5 !border-2 !border-background !bg-foreground"
            />
          </div>
        ))}
        {data.options.length > 0 ? (
          <div className="flex min-h-7 items-center px-2 text-[11px] text-muted-foreground">
            <span className="min-w-0 flex-1">Then / merge</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="next"
              className="!size-2.5 !border-2 !border-background !bg-muted-foreground"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function GroupFlowNode({
  data,
  selected,
}: NodeProps<Node<GroupFlowData>>) {
  const actions = useFlowActions()
  return (
    <div
      className={cn(
        "h-full rounded-xl border border-dashed bg-[color-mix(in_oklab,var(--brand-signal)_8%,transparent)]",
        selected ? "border-foreground" : "border-[var(--brand-signal)]/40"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-3 !border-2 !border-background !bg-[var(--brand-signal)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        className="!size-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-2 px-3 py-3">
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium outline-none hover:border-border focus:border-ring"
          defaultValue={data.prompt}
          aria-label="Question set name"
          onBlur={(event) =>
            actions.renameGroup(data.groupId, event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur()
            }
          }}
        />
        <span className="text-[11px] text-muted-foreground">
          {data.memberCount} questions
        </span>
      </div>
    </div>
  )
}
