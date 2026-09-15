"use client"

import { GitBranchIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import {
  canBranchFrom,
  createDefaultShowIf,
  describeShowIf,
  emptyCondition,
  isFollowUpForOption,
  laterQuestions,
  previousQuestions,
  questionRefLabel,
  questionsDependingOn,
  showIfForEditor,
  toggleFollowUpForOption,
  type ShowIfCondition,
  type ShowIfRule,
} from "@/lib/survey/conditional"
import type { SurveyQuestion } from "@/lib/survey/questions"

type ConditionalLogicEditorProps = {
  question: SurveyQuestion
  questions: SurveyQuestion[]
  onQuestionChange: (patch: Partial<SurveyQuestion>) => void
  onQuestionsChange: (questions: SurveyQuestion[]) => void
}

function setShowIf(
  question: SurveyQuestion,
  showIf: ShowIfRule | undefined
): Partial<SurveyQuestion> {
  return {
    config: {
      ...question.config,
      showIf,
    },
  }
}

function updateCondition(
  rule: ShowIfRule,
  index: number,
  patch: Partial<ShowIfCondition>
): ShowIfRule {
  return {
    ...rule,
    conditions: rule.conditions.map((condition, i) =>
      i === index ? { ...condition, ...patch } : condition
    ),
  }
}

export function ConditionalLogicEditor({
  question,
  questions,
  onQuestionChange,
  onQuestionsChange,
}: ConditionalLogicEditorProps) {
  const previous = previousQuestions(questions, question.id)
  const later = laterQuestions(questions, question.id)
  const rule = showIfForEditor(question.config.showIf)
  const summary = describeShowIf(question, questions)
  const dependents = questionsDependingOn(questions, question.id)
  const branchable = canBranchFrom(question)

  function enableRule() {
    const next = createDefaultShowIf(previous)
    if (!next) return
    onQuestionChange(setShowIf(question, next))
  }

  function disableRule() {
    onQuestionChange(setShowIf(question, undefined))
  }

  function patchRule(next: ShowIfRule) {
    if (next.conditions.length === 0) {
      onQuestionChange(setShowIf(question, undefined))
      return
    }
    onQuestionChange(setShowIf(question, next))
  }

  return (
    <details className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        <span className="inline-flex items-center gap-2">
        <GitBranchIcon className="size-3.5 text-muted-foreground" />
        Conditional logic
        {rule ? (
          <Badge variant="secondary">On</Badge>
        ) : dependents.length > 0 ? (
          <Badge variant="outline">Branches</Badge>
        ) : (
          <span className="font-normal text-muted-foreground">Optional</span>
        )}
        </span>
      </summary>

      <div className="mt-3 space-y-4">
        {summary ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Shown when {summary}.
          </p>
        ) : null}

        {previous.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a question above this one to show it only for certain answers.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={Boolean(rule)}
                onCheckedChange={(checked) => {
                  if (checked) enableRule()
                  else disableRule()
                }}
              />
              <span>
                Show this question only when a previous answer matches
              </span>
            </label>

            {rule ? (
              <div className="space-y-3 rounded-md border border-border/70 bg-background/70 p-3">
                {rule.conditions.length > 1 ? (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`logic-${question.id}`}>
                      Match these conditions
                    </Label>
                    <NativeSelect
                      id={`logic-${question.id}`}
                      className="w-full max-w-xs"
                      value={rule.logic}
                      onChange={(event) =>
                        patchRule({
                          ...rule,
                          logic: event.target.value === "or" ? "or" : "and",
                        })
                      }
                    >
                      <NativeSelectOption value="and">
                        All of them (AND)
                      </NativeSelectOption>
                      <NativeSelectOption value="or">
                        Any of them (OR)
                      </NativeSelectOption>
                    </NativeSelect>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {rule.conditions.map((condition, index) => {
                    const source =
                      previous.find((item) => item.id === condition.questionId) ??
                      previous[0]
                    if (!source) return null
                    return (
                      <ConditionRow
                        key={`${condition.questionId}-${index}`}
                        questionId={question.id}
                        index={index}
                        condition={{
                          ...condition,
                          questionId: source.id,
                        }}
                        previous={previous}
                        questions={questions}
                        canRemove={rule.conditions.length > 1}
                        onChange={(patch) =>
                          patchRule(updateCondition(rule, index, patch))
                        }
                        onRemove={() =>
                          patchRule({
                            ...rule,
                            conditions: rule.conditions.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                      />
                    )
                  })}
                </div>

                {previous.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const source =
                        previous.find(
                          (item) =>
                            !rule.conditions.some(
                              (condition) => condition.questionId === item.id
                            )
                        ) ?? previous[0]
                      patchRule({
                        ...rule,
                        conditions: [...rule.conditions, emptyCondition(source)],
                      })
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add condition
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {branchable && later.length > 0 ? (
          <div className="space-y-3 border-t border-border/70 pt-3">
            <div>
              <p className="text-sm font-medium">Then show questions</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Pick which later questions appear for each answer. Nested
                questions can also depend on those follow-ups.
              </p>
            </div>
            <div className="space-y-3">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className="rounded-md border border-border/70 bg-background/70 p-3"
                >
                  <p className="text-sm font-medium text-muted-foreground">
                    If “{option.label || "Untitled option"}” is selected
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {later.map((followUp) => {
                      const checked = isFollowUpForOption(
                        followUp,
                        question.id,
                        option.id
                      )
                      return (
                        <label
                          key={followUp.id}
                          className="flex items-start gap-2.5 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) =>
                              onQuestionsChange(
                                toggleFollowUpForOption(
                                  questions,
                                  question.id,
                                  option.id,
                                  followUp.id,
                                  Boolean(next)
                                )
                              )
                            }
                          />
                          <span className="leading-snug">
                            {questionRefLabel(questions, followUp.id)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : branchable && later.length === 0 ? (
          <p className="border-t border-border/70 pt-3 text-sm text-muted-foreground">
            Add questions below this one to show a different set for each
            answer.
          </p>
        ) : null}
      </div>
    </details>
  )
}

function ConditionRow({
  questionId,
  index,
  condition,
  previous,
  questions,
  canRemove,
  onChange,
  onRemove,
}: {
  questionId: string
  index: number
  condition: ShowIfCondition
  previous: SurveyQuestion[]
  questions: SurveyQuestion[]
  canRemove: boolean
  onChange: (patch: Partial<ShowIfCondition>) => void
  onRemove: () => void
}) {
  const source =
    previous.find((item) => item.id === condition.questionId) ?? previous[0]
  if (!source) return null

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <NativeSelect
            aria-label="Previous question"
            className="w-full"
            value={source.id}
            onChange={(event) => {
              const nextSource =
                previous.find((item) => item.id === event.target.value) ??
                source
              onChange({
                questionId: nextSource.id,
                values: nextSource.options[0] ? [nextSource.options[0].id] : [],
              })
            }}
          >
            {previous.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {questionRefLabel(questions, item.id)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Operator"
            className="w-full"
            value={condition.operator}
            onChange={(event) =>
              onChange({
                operator: event.target.value === "is_not" ? "is_not" : "is",
              })
            }
          >
            <NativeSelectOption value="is">is</NativeSelectOption>
            <NativeSelectOption value="is_not">is not</NativeSelectOption>
          </NativeSelect>
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="Remove condition"
          >
            <Trash2Icon />
          </Button>
        ) : null}
      </div>

      {source.options.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {source.options.map((option) => {
            const checked =
              condition.values.includes(option.id) ||
              (option.value != null &&
                condition.values.includes(option.value)) ||
              condition.values.includes(option.label)
            return (
              <label
                key={option.id}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    const values = next
                      ? [...new Set([...condition.values, option.id])]
                      : condition.values.filter((value) => value !== option.id)
                    onChange({ values })
                  }}
                />
                {option.label || "Untitled option"}
              </label>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`cond-value-${questionId}-${index}`}>Answer</Label>
          <Input
            id={`cond-value-${questionId}-${index}`}
            value={condition.values[0] ?? ""}
            onChange={(event) =>
              onChange({
                values: event.target.value.trim()
                  ? [event.target.value]
                  : [],
              })
            }
            placeholder="Exact answer to match"
          />
        </div>
      )}
    </div>
  )
}

export function BranchingOverview({
  questions,
}: {
  questions: SurveyQuestion[]
}) {
  const sources = questions.filter(
    (question) => questionsDependingOn(questions, question.id).length > 0
  )
  if (sources.length === 0) return null

  return (
    <div className="rounded-lg border border-border/80 bg-muted/15 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <GitBranchIcon className="size-3.5 text-muted-foreground" />
        Branching map
      </div>
      <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
        {sources.map((source) => {
          const dependents = questionsDependingOn(questions, source.id)
          return (
            <li key={source.id}>
              <span className="font-medium text-foreground">
                {questionRefLabel(questions, source.id)}
              </span>
              {source.options.length > 0 ? (
                <ul className="mt-1 space-y-0.5 pl-3">
                  {source.options.map((option) => {
                    const followUps = dependents.filter((item) =>
                      isFollowUpForOption(item, source.id, option.id)
                    )
                    return (
                      <li key={option.id}>
                        {option.label || "Untitled"} →{" "}
                        {followUps.length > 0
                          ? followUps
                              .map((item) =>
                                questionRefLabel(questions, item.id)
                              )
                              .join(", ")
                          : "continue"}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-1 pl-3">
                  {dependents
                    .map((item) => questionRefLabel(questions, item.id))
                    .join(", ")}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
