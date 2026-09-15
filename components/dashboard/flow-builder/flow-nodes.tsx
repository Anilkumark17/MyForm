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

const handleClass =
  "!size-3 !border-2 !border-background !bg-foreground !static !translate-x-0 !translate-y-0 !transform-none"

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
        "w-[320px] rounded-xl border bg-card shadow-sm",
        selected ? "border-foreground" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-3 !border-2 !border-background !bg-[var(--brand-signal)]"
      />
      <div className="flex items-start justify-between gap-2 border-b border-border/80 px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              Q{data.index + 1}
            </p>
            <Badge variant="outline">{data.typeLabel}</Badge>
            {data.required ? (
              <Badge variant="secondary">Required</Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Optional</span>
            )}
            {data.hasShowIf ? (
              <Badge variant="secondary">Branched</Badge>
            ) : null}
          </div>
          <p className="font-heading mt-1.5 line-clamp-2 text-[15px] font-medium leading-snug">
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
        {options.map((option) => (
          <div
            key={option.id}
            className="flex min-h-9 items-center rounded-md px-2.5 text-[15px] hover:bg-muted/60"
          >
            <span className="mr-2.5 size-2 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="min-w-0 flex-1 truncate pr-2 leading-snug">
              {fakeContinue ? "Then continue" : option.label}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={fakeContinue ? "next" : optionHandleId(option.id)}
              className={handleClass}
            />
          </div>
        ))}
        {data.options.length > 0 ? (
          <div className="flex min-h-9 items-center px-2.5 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1">Then continue</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="next"
              className="!size-3 !border-2 !border-background !bg-muted-foreground"
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
        className="!size-3.5 !border-2 !border-background !bg-[var(--brand-signal)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="next"
        className="!size-3.5 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-2 px-3.5 py-3">
        <input
          className="font-heading h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-[15px] font-medium outline-none hover:border-border focus:border-ring"
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
        <span className="text-sm text-muted-foreground">
          {data.memberCount} questions
        </span>
      </div>
    </div>
  )
}
