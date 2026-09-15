"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export type BranchFlowEdgeData = {
  kind: "branch"
  removable: boolean
} & Record<string, unknown>

export function BranchFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  selected,
}: EdgeProps<Edge<BranchFlowEdgeData>>) {
  const { deleteElements } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={24}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] shadow-sm"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {label ? (
            <span className="max-w-28 truncate text-muted-foreground">
              {String(label)}
            </span>
          ) : null}
          <Button
            type="button"
            size="icon-xs"
            variant={selected ? "secondary" : "ghost"}
            aria-label="Remove connection"
            className="size-5"
            onClick={(event) => {
              event.stopPropagation()
              void deleteElements({ edges: [{ id }] })
            }}
          >
            <XIcon />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
