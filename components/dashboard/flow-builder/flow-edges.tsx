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
  const { deleteElements, setEdges } = useReactFlow()
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
        style={{
          ...style,
          strokeWidth: selected ? 3.5 : (style?.strokeWidth ?? 2),
        }}
        interactionWidth={28}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-auto absolute flex items-center gap-1 rounded-md border px-2 py-1 text-sm shadow-sm ${
            selected
              ? "border-foreground/40 bg-background"
              : "border-border/70 bg-background/95"
          }`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onClick={(event) => {
            event.stopPropagation()
            setEdges((current) =>
              current.map((edge) => ({
                ...edge,
                selected: edge.id === id,
              }))
            )
          }}
        >
          {label ? (
            <span className="max-w-36 truncate font-medium text-foreground">
              {String(label)}
            </span>
          ) : null}
          <Button
            type="button"
            size="icon-xs"
            variant={selected ? "secondary" : "ghost"}
            aria-label="Remove connection"
            className="size-6"
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
