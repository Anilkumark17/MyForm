"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import type { SurveyQuestion } from "@/lib/survey/questions"
import {
  rulesFor,
  validationConfigIssue,
  type ValidationConfig,
  type ValidationRuleId,
} from "@/lib/survey/validation"

type ValidationEditorProps = {
  question: SurveyQuestion
  onChange: (validation: ValidationConfig | undefined) => void
}

export function ValidationEditor({ question, onChange }: ValidationEditorProps) {
  const rules = rulesFor(question)
  if (rules.length === 0) return null

  const validation = question.config.validation
  const meta = rules.find((rule) => rule.id === validation?.rule)
  const issue = validationConfigIssue(question)
  const prefix = `validation-${question.id}`
  const numeric = rules.some((rule) => rule.id === "gte")

  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-3">
      <div className="grid gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-rule`}>Response validation</Label>
          <NativeSelect
            id={`${prefix}-rule`}
            className="w-full max-w-md"
            value={validation?.rule ?? ""}
            onChange={(event) => {
              const rule = event.target.value as ValidationRuleId | ""
              onChange(rule ? { rule } : undefined)
            }}
          >
            <NativeSelectOption value="">None</NativeSelectOption>
            {rules.map((rule) => (
              <NativeSelectOption key={rule.id} value={rule.id}>
                {rule.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {validation && meta ? (
          <>
            {meta.needsValue >= 1 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${prefix}-value`}>
                    {meta.needsValue === 2 ? "From" : "Value"}
                  </Label>
                  <Input
                    id={`${prefix}-value`}
                    type={
                      numeric || validation.rule.endsWith("_length")
                        ? "number"
                        : "text"
                    }
                    value={validation.value ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...validation,
                        value: event.target.value || undefined,
                      })
                    }
                    placeholder={
                      validation.rule === "regex" ? "^[A-Z]{3}-\\d+$" : undefined
                    }
                  />
                </div>
                {meta.needsValue === 2 ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${prefix}-value2`}>To</Label>
                    <Input
                      id={`${prefix}-value2`}
                      type="number"
                      value={validation.value2 ?? ""}
                      onChange={(event) =>
                        onChange({
                          ...validation,
                          value2: event.target.value || undefined,
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${prefix}-message`}>
                Custom error message (optional)
              </Label>
              <Input
                id={`${prefix}-message`}
                value={validation.message ?? ""}
                onChange={(event) =>
                  onChange({
                    ...validation,
                    message: event.target.value || undefined,
                  })
                }
                placeholder="Shown when the answer is not valid"
              />
            </div>
            {issue ? (
              <p className="text-sm text-destructive">{issue}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
