"use client"

import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { SUBMIT_TARGET, getSections } from "@/lib/survey/conditional"
import type { SurveyQuestion } from "@/lib/survey/questions"

type SectionHeaderProps = {
  question: SurveyQuestion
  questions: SurveyQuestion[]
  onQuestionsChange: (questions: SurveyQuestion[]) => void
}

export function SectionHeader({
  question,
  questions,
  onQuestionsChange,
}: SectionHeaderProps) {
  const sections = getSections(questions)
  const position = sections.findIndex((section) => section.id === question.id)
  const section = sections[position]
  if (!section) return null
  const start = question.config.sectionStart ?? { title: "" }
  const later = sections.slice(position + 1)
  const canRemove = position > 0

  function patch(next: Partial<NonNullable<typeof start>>) {
    onQuestionsChange(
      questions.map((item) =>
        item.id === question.id
          ? {
              ...item,
              config: {
                ...item.config,
                sectionStart: { ...start, ...next },
              },
            }
          : item
      )
    )
  }

  function remove() {
    onQuestionsChange(
      questions.map((item) =>
        item.id === question.id
          ? { ...item, config: { ...item.config, sectionStart: undefined } }
          : item
      )
    )
  }

  return (
    <div className="rounded-lg border-2 border-[var(--brand-signal)]/40 bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-semibold">
          Section {position + 1} of {sections.length}
        </p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove section break"
            onClick={remove}
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`section-title-${question.id}`}>Section title</Label>
          <Input
            id={`section-title-${question.id}`}
            value={start.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="Untitled section"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`section-desc-${question.id}`}>
            Description (optional)
          </Label>
          <Textarea
            id={`section-desc-${question.id}`}
            value={start.description ?? ""}
            onChange={(event) =>
              patch({ description: event.target.value || undefined })
            }
            rows={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`section-after-${question.id}`}>
            After section {position + 1}
          </Label>
          <NativeSelect
            id={`section-after-${question.id}`}
            className="w-full max-w-md"
            value={start.after ?? ""}
            onChange={(event) =>
              patch({ after: event.target.value || undefined })
            }
          >
            <NativeSelectOption value="">
              Continue to next section
            </NativeSelectOption>
            {later.map((item, offset) => (
              <NativeSelectOption key={item.id} value={item.id}>
                Go to section {position + offset + 2}
                {item.title ? `: ${item.title}` : ""}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={SUBMIT_TARGET}>
              Submit form
            </NativeSelectOption>
          </NativeSelect>
          <p className="text-sm text-muted-foreground">
            Answer rules on a choice question in this section take priority.
          </p>
        </div>
      </div>
    </div>
  )
}
