"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getRevealMode,
  getSelectionMode,
  optionDisplayCaption,
  parseComparisonAnswer,
  usesBeforeAfterSlider,
  type ComparisonAnswer,
} from "@/lib/survey/comparison"
import type { AnswerOption, SurveyQuestion } from "@/lib/survey/questions"
import { cn } from "@/lib/utils"

type ComparisonFieldProps = {
  question: SurveyQuestion
  value: unknown
  onChange: (value: ComparisonAnswer) => void
  onFocus: () => void
  onBlur: () => void
}

export function ComparisonField({
  question,
  value,
  onChange,
  onFocus,
  onBlur,
}: ComparisonFieldProps) {
  const mode = getSelectionMode(question.config)
  const reveal = getRevealMode(question.config)
  const blind = Boolean(question.config.blindMode)
  const answer = parseComparisonAnswer(value)
  const [seqIndex, setSeqIndex] = useState(0)
  const [seqDone, setSeqDone] = useState(reveal !== "sequential")
  const [reaction, setReaction] = useState("")

  const reactions = answer?.sequentialReactions ?? {}

  if (reveal === "sequential" && !seqDone) {
    const option = question.options[seqIndex]
    if (!option) {
      return null
    }
    return (
      <div className="space-y-4" onFocus={onFocus} onBlur={onBlur}>
        <p className="text-xs text-muted-foreground">
          Option {seqIndex + 1} of {question.options.length}
          {blind ? "" : ` · ${option.label}`}
        </p>
        <OptionCard
          option={option}
          blind={blind}
          selected={false}
          onSelect={() => undefined}
          interactive={false}
        />
        <div className="space-y-2">
          <Label htmlFor={`reaction-${option.id}`}>
            Quick reaction (optional)
          </Label>
          <Input
            id={`reaction-${option.id}`}
            value={reaction}
            onChange={(event) => setReaction(event.target.value)}
            placeholder="First impression…"
            className="h-10"
          />
        </div>
        <Button
          type="button"
          className="h-10"
          onClick={() => {
            const nextReactions = {
              ...reactions,
              ...(reaction.trim() ? { [option.id]: reaction.trim() } : {}),
            }
            if (seqIndex >= question.options.length - 1) {
              setSeqDone(true)
              // Seed empty answer shell for final preference step
              if (!answer) {
                if (mode === "single_select") {
                  onChange({
                    mode: "single_select",
                    selectedId: "",
                    sequentialReactions: nextReactions,
                  })
                } else if (mode === "rank") {
                  onChange({
                    mode: "rank",
                    order: question.options.map((o) => o.id),
                    sequentialReactions: nextReactions,
                  })
                } else if (mode === "allocate") {
                  const even = Math.floor(100 / question.options.length)
                  const points: Record<string, number> = {}
                  question.options.forEach((o, i) => {
                    points[o.id] =
                      i === 0
                        ? 100 - even * (question.options.length - 1)
                        : even
                  })
                  onChange({
                    mode: "allocate",
                    points,
                    sequentialReactions: nextReactions,
                  })
                } else {
                  const ratings: Record<string, number> = {}
                  for (const o of question.options) ratings[o.id] = 0
                  onChange({
                    mode: "rate_each",
                    ratings,
                    sequentialReactions: nextReactions,
                  })
                }
              } else {
                onChange({ ...answer, sequentialReactions: nextReactions })
              }
            } else {
              if (answer) {
                onChange({ ...answer, sequentialReactions: nextReactions })
              } else {
                onChange({
                  mode: "single_select",
                  selectedId: "",
                  sequentialReactions: nextReactions,
                })
              }
              setReaction("")
              setSeqIndex((i) => i + 1)
            }
          }}
        >
          {seqIndex >= question.options.length - 1
            ? "Continue to preference"
            : "Next option"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4" onFocus={onFocus} onBlur={onBlur}>
      {blind ? (
        <p className="text-xs text-muted-foreground">
          Labels are hidden for an unbiased comparison.
        </p>
      ) : null}

      {usesBeforeAfterSlider(question) ? (
        <BeforeAfterSlider
          options={question.options}
          selectedId={
            answer?.mode === "single_select" ? answer.selectedId : ""
          }
          onSelect={(selectedId) =>
            onChange({
              mode: "single_select",
              selectedId,
              sequentialReactions: reactions,
            })
          }
          blind={blind}
        />
      ) : mode === "single_select" ? (
        <div
          className={cn(
            "grid gap-3",
            question.options.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {question.options.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              blind={blind}
              selected={
                answer?.mode === "single_select" &&
                answer.selectedId === option.id
              }
              onSelect={() =>
                onChange({
                  mode: "single_select",
                  selectedId: option.id,
                  sequentialReactions: reactions,
                })
              }
            />
          ))}
        </div>
      ) : mode === "rank" ? (
        <RankEditor
          options={question.options}
          order={
            answer?.mode === "rank"
              ? answer.order
              : question.options.map((o) => o.id)
          }
          blind={blind}
          onChange={(order) =>
            onChange({
              mode: "rank",
              order,
              sequentialReactions: reactions,
            })
          }
        />
      ) : mode === "allocate" ? (
        <AllocateEditor
          options={question.options}
          points={
            answer?.mode === "allocate"
              ? answer.points
              : Object.fromEntries(question.options.map((o) => [o.id, 0]))
          }
          blind={blind}
          onChange={(points) =>
            onChange({
              mode: "allocate",
              points,
              sequentialReactions: reactions,
            })
          }
        />
      ) : (
        <RateEachEditor
          options={question.options}
          ratings={
            answer?.mode === "rate_each"
              ? answer.ratings
              : Object.fromEntries(question.options.map((o) => [o.id, 0]))
          }
          min={question.config.rateMin ?? question.config.min ?? 1}
          max={question.config.rateMax ?? question.config.max ?? 5}
          blind={blind}
          onChange={(ratings) =>
            onChange({
              mode: "rate_each",
              ratings,
              sequentialReactions: reactions,
            })
          }
        />
      )}
    </div>
  )
}

function OptionCard({
  option,
  blind,
  selected,
  onSelect,
  interactive = true,
}: {
  option: AnswerOption
  blind: boolean
  selected: boolean
  onSelect: () => void
  interactive?: boolean
}) {
  const title = optionDisplayCaption(option)

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onSelect}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
        selected
          ? "border-[var(--brand-signal)] bg-[var(--brand-signal-soft)]"
          : "border-border bg-background/40 hover:border-foreground/30",
        !interactive && "cursor-default hover:border-border"
      )}
    >
      {option.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={option.imageUrl}
          alt=""
          className="aspect-[4/3] w-full object-cover bg-muted"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-muted text-xs text-muted-foreground">
          No image
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium leading-snug">
          {blind ? "Variant" : title || "Option"}
        </p>
      </div>
    </button>
  )
}

function BeforeAfterSlider({
  options,
  selectedId,
  onSelect,
  blind,
}: {
  options: AnswerOption[]
  selectedId: string
  onSelect: (id: string) => void
  blind: boolean
}) {
  const [position, setPosition] = useState(50)
  const before = options[0]
  const after = options[1]
  const beforeSrc = before?.imageUrl || before?.beforeImageUrl || ""
  const afterSrc = after?.imageUrl || after?.afterImageUrl || ""

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterSrc}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt=""
            className="absolute inset-0 size-full max-w-none object-cover"
            style={{ width: `${10000 / Math.max(position, 1)}%` }}
          />
        </div>
        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${position}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => {
          const next = Number(event.target.value)
          setPosition(next)
          onSelect(next < 50 ? before.id : after.id)
        }}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{blind ? "Side A" : before.label}</span>
        <span>
          Prefer {selectedId === before.id ? (blind ? "A" : before.label) : selectedId === after.id ? (blind ? "B" : after.label) : "—"}
        </span>
        <span>{blind ? "Side B" : after.label}</span>
      </div>
    </div>
  )
}

function RankEditor({
  options,
  order,
  blind,
  onChange,
}: {
  options: AnswerOption[]
  order: string[]
  blind: boolean
  onChange: (order: string[]) => void
}) {
  const byId = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options]
  )
  const ordered = order
    .map((id) => byId.get(id))
    .filter((o): o is AnswerOption => Boolean(o))

  function move(index: number, dir: -1 | 1) {
    const next = [...order]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <ol className="space-y-2">
      {ordered.map((option, index) => (
        <li
          key={option.id}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
        >
          <span className="w-6 text-sm font-medium text-muted-foreground">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {blind ? `Variant ${index + 1}` : optionDisplayCaption(option)}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => move(index, -1)}
              disabled={index === 0}
            >
              Up
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => move(index, 1)}
              disabled={index === ordered.length - 1}
            >
              Down
            </Button>
          </div>
        </li>
      ))}
    </ol>
  )
}

function AllocateEditor({
  options,
  points,
  blind,
  onChange,
}: {
  options: AnswerOption[]
  points: Record<string, number>
  blind: boolean
  onChange: (points: Record<string, number>) => void
}) {
  const total = Object.values(points).reduce((s, n) => s + (Number(n) || 0), 0)

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={option.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {blind ? `Variant ${index + 1}` : optionDisplayCaption(option)}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {points[option.id] ?? 0} pts
            </span>
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            value={points[option.id] ?? 0}
            onChange={(event) =>
              onChange({
                ...points,
                [option.id]: Math.max(0, Number(event.target.value) || 0),
              })
            }
            className="h-10"
          />
        </div>
      ))}
      <p
        className={cn(
          "text-sm",
          Math.round(total) === 100
            ? "text-[var(--brand-signal)]"
            : "text-amber-500"
        )}
      >
        Total: {total} / 100
      </p>
    </div>
  )
}

function RateEachEditor({
  options,
  ratings,
  min,
  max,
  blind,
  onChange,
}: {
  options: AnswerOption[]
  ratings: Record<string, number>
  min: number
  max: number
  blind: boolean
  onChange: (ratings: Record<string, number>) => void
}) {
  return (
    <div className="space-y-4">
      {options.map((option, index) => (
        <div key={option.id} className="space-y-2">
          <p className="text-sm font-medium">
            {blind ? `Variant ${index + 1}` : optionDisplayCaption(option)}
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
              (score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() =>
                    onChange({ ...ratings, [option.id]: score })
                  }
                  className={cn(
                    "size-9 rounded-md border text-sm tabular-nums transition-colors",
                    ratings[option.id] === score
                      ? "border-[var(--brand-signal)] bg-[var(--brand-signal-soft)]"
                      : "border-border hover:border-foreground/30"
                  )}
                >
                  {score}
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
