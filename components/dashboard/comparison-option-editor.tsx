"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"

import { ImageFieldInput } from "@/components/dashboard/image-field-input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type {
  ComparisonRevealMode,
  ComparisonSelectionMode,
} from "@/lib/survey/comparison"
import {
  createComparisonOption,
  type AnswerOption,
  type SurveyQuestion,
} from "@/lib/survey/questions"

type ComparisonOptionEditorProps = {
  question: SurveyQuestion
  onChange: (patch: Partial<SurveyQuestion>) => void
  onOptionsChange: (options: AnswerOption[]) => void
}

export function ComparisonOptionEditor({
  question,
  onChange,
  onOptionsChange,
}: ComparisonOptionEditorProps) {
  const config = question.config
  const mode = config.selectionMode ?? "single_select"

  function patchConfig(partial: SurveyQuestion["config"]) {
    onChange({ config: { ...config, ...partial } })
  }

  function updateOption(optionId: string, patch: Partial<AnswerOption>) {
    onOptionsChange(
      question.options.map((option) =>
        option.id === optionId
          ? { ...option, contentType: "image_text", ...patch }
          : option
      )
    )
  }

  function addOption() {
    const nextIndex = question.options.length
    const label = `Option ${String.fromCharCode(65 + Math.min(nextIndex, 25))}`
    onOptionsChange([
      ...question.options,
      createComparisonOption(label, "image_text"),
    ])
  }

  function removeOption(optionId: string) {
    if (question.options.length <= 2) return
    onOptionsChange(question.options.filter((o) => o.id !== optionId))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>How people answer</Label>
          <NativeSelect
            value={mode}
            onChange={(event) =>
              patchConfig({
                selectionMode: event.target.value as ComparisonSelectionMode,
              })
            }
            className="w-full"
          >
            <NativeSelectOption value="single_select">
              Pick one favorite
            </NativeSelectOption>
            <NativeSelectOption value="rank">
              Rank from favorite to least
            </NativeSelectOption>
            <NativeSelectOption value="allocate">
              Split 100 points across options
            </NativeSelectOption>
            <NativeSelectOption value="rate_each">
              Rate every option
            </NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>How options appear</Label>
          <NativeSelect
            value={config.revealMode ?? "side_by_side"}
            onChange={(event) =>
              patchConfig({
                revealMode: event.target.value as ComparisonRevealMode,
              })
            }
            className="w-full"
          >
            <NativeSelectOption value="side_by_side">
              All options together
            </NativeSelectOption>
            <NativeSelectOption value="sequential">
              One option at a time
            </NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(config.blindMode)}
            onCheckedChange={(checked) =>
              patchConfig({ blindMode: Boolean(checked) })
            }
          />
          Hide names until after they submit
        </label>
        {mode === "single_select" && question.options.length === 2 ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(config.beforeAfterSlider)}
              onCheckedChange={(checked) =>
                patchConfig({ beforeAfterSlider: Boolean(checked) })
              }
            />
            Use before/after slider
          </label>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>Options</Label>
            <p className="text-xs text-muted-foreground">
              Each option is an image plus a short title. Add as many as you
              need.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <PlusIcon data-icon="inline-start" />
            Add option
          </Button>
        </div>

        {question.options.map((option, index) => (
          <div key={option.id} className="surface space-y-3 rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Option {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeOption(option.id)}
                disabled={question.options.length <= 2}
                aria-label="Remove option"
              >
                <Trash2Icon />
              </Button>
            </div>

            <ImageFieldInput
              id={`opt-img-${option.id}`}
              label="Image"
              value={option.imageUrl}
              onChange={(imageUrl) => updateOption(option.id, { imageUrl })}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`opt-title-${option.id}`}>Title</Label>
              <Input
                id={`opt-title-${option.id}`}
                value={option.caption || option.label}
                onChange={(event) => {
                  const title = event.target.value
                  updateOption(option.id, {
                    caption: title,
                    label: title.trim() || `Option ${index + 1}`,
                  })
                }}
                placeholder="e.g. Version A — blue headline"
                className="h-10"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
