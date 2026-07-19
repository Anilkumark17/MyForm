"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"

import { ComparisonOptionEditor } from "@/components/dashboard/comparison-option-editor"
import { ImageFieldInput } from "@/components/dashboard/image-field-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useQuestionCollab } from "@/hooks/use-question-collab"
import { saveProjectQuestions } from "@/lib/projects/actions"
import {
  questionTypesByCategory,
  QUESTION_TYPE_MAP,
  type QuestionTypeId,
} from "@/lib/survey/question-types"
import {
  applyTypeChange,
  createEmptyQuestion,
  createOption,
  type AnswerOption,
  type SurveyQuestion,
} from "@/lib/survey/questions"

type QuestionEditorProps = {
  projectId: string
  questions: SurveyQuestion[]
  onChange: (questions: SurveyQuestion[]) => void
}

const typeGroups = questionTypesByCategory()

export function QuestionEditor({
  projectId,
  questions,
  onChange,
}: QuestionEditorProps) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const collab = useQuestionCollab({
    projectId,
    questions,
    onRemoteQuestions: (next) => {
      setDirty(false)
      setMessage("Synced from collaborator")
      onChange(next)
    },
  })

  function updateQuestions(next: SurveyQuestion[]) {
    setDirty(true)
    setMessage(null)
    onChange(next)
    collab.publishLocalChange(next)
  }

  function updateQuestion(id: string, patch: Partial<SurveyQuestion>) {
    updateQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, ...patch } : question
      )
    )
  }

  function changeType(id: string, type: QuestionTypeId) {
    updateQuestions(
      questions.map((question) =>
        question.id === id ? applyTypeChange(question, type) : question
      )
    )
  }

  function removeQuestion(id: string) {
    updateQuestions(questions.filter((question) => question.id !== id))
  }

  function addQuestion() {
    updateQuestions([...questions, createEmptyQuestion("long_text")])
  }

  function updateOption(
    questionId: string,
    optionId: string,
    label: string
  ) {
    updateQuestions(
      questions.map((question) => {
        if (question.id !== questionId) return question
        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, label } : option
          ),
        }
      })
    )
  }

  function removeOption(questionId: string, optionId: string) {
    updateQuestions(
      questions.map((question) => {
        if (question.id !== questionId) return question
        return {
          ...question,
          options: question.options.filter((option) => option.id !== optionId),
        }
      })
    )
  }

  function addOption(questionId: string) {
    updateQuestions(
      questions.map((question) => {
        if (question.id !== questionId) return question
        return {
          ...question,
          options: [
            ...question.options,
            createOption(`Option ${question.options.length + 1}`),
          ],
        }
      })
    )
  }

  function updateConfigField(
    questionId: string,
    key: keyof SurveyQuestion["config"],
    value: string
  ) {
    updateQuestions(
      questions.map((question) => {
        if (question.id !== questionId) return question
        const numericKeys = ["min", "max", "step"] as const
        if ((numericKeys as readonly string[]).includes(key)) {
          const parsed = value === "" ? undefined : Number(value)
          return {
            ...question,
            config: {
              ...question.config,
              [key]: Number.isFinite(parsed) ? parsed : undefined,
            },
          }
        }
        if (key === "rows" || key === "columns") {
          return {
            ...question,
            config: {
              ...question.config,
              [key]: value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            },
          }
        }
        return {
          ...question,
          config: {
            ...question.config,
            [key]: value,
          },
        }
      })
    )
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await saveProjectQuestions(projectId, questions)
      if (result.error) {
        setError(result.error)
        return
      }
      setDirty(false)
      setMessage("Questions saved.")
    })
  }

  if (questions.length === 0) {
    return (
      <div className="surface rounded-lg border-dashed px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No questions yet. Generate a set or add one manually.
        </p>
        <Button type="button" className="mt-4 h-9" onClick={addQuestion}>
          Add question
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={collab.connected ? "secondary" : "outline"}>
          {collab.connected ? "Live sync on" : "Connecting…"}
        </Badge>
        <span>rev {collab.revision}</span>
        {collab.syncing ? <span>Syncing…</span> : null}
        {collab.peers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {collab.peers.map((peer) => (
              <span
                key={peer.clientId}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5"
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: peer.color }}
                />
                {peer.userName}
              </span>
            ))}
          </div>
        ) : (
          <span>Only you editing</span>
        )}
      </div>

      {questions.map((question, index) => {
        const meta = QUESTION_TYPE_MAP[question.type]
        return (
          <div
            key={question.id}
            className="surface rounded-lg p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Question {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeQuestion(question.id)}
                aria-label="Delete question"
              >
                <Trash2Icon />
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`prompt-${question.id}`}>Question</Label>
                <Textarea
                  id={`prompt-${question.id}`}
                  value={question.prompt}
                  onChange={(event) =>
                    updateQuestion(question.id, { prompt: event.target.value })
                  }
                  rows={3}
                  placeholder="Ask about the past or present..."
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`type-${question.id}`}>Answer type</Label>
                <NativeSelect
                  id={`type-${question.id}`}
                  value={question.type}
                  onChange={(event) =>
                    changeType(
                      question.id,
                      event.target.value as QuestionTypeId
                    )
                  }
                  className="w-full max-w-md"
                >
                  {[...typeGroups.entries()].map(([category, types]) => (
                    <NativeSelectOptGroup key={category} label={category}>
                      {types.map((type) => (
                        <NativeSelectOption key={type.id} value={type.id}>
                          {type.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  {meta.description}
                </p>
              </div>

              {question.type === "comparison_choice" ? (
                <ComparisonOptionEditor
                  question={question}
                  onChange={(patch) => updateQuestion(question.id, patch)}
                  onOptionsChange={(options: AnswerOption[]) =>
                    updateQuestion(question.id, { options })
                  }
                />
              ) : meta.hasOptions ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Answer options</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(question.id)}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={option.id}
                        className={
                          question.type === "image_choice"
                            ? "surface space-y-2 rounded-lg p-3"
                            : "flex items-center gap-2"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={option.label}
                            onChange={(event) =>
                              updateOption(
                                question.id,
                                option.id,
                                event.target.value
                              )
                            }
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              removeOption(question.id, option.id)
                            }
                            aria-label="Delete option"
                            disabled={question.options.length <= 1}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                        {question.type === "image_choice" ? (
                          <ImageFieldInput
                            id={`img-choice-${option.id}`}
                            label="Option image"
                            value={option.imageUrl}
                            onChange={(imageUrl) =>
                              updateQuestions(
                                questions.map((q) =>
                                  q.id !== question.id
                                    ? q
                                    : {
                                        ...q,
                                        options: q.options.map((o) =>
                                          o.id === option.id
                                            ? { ...o, imageUrl }
                                            : o
                                        ),
                                      }
                                )
                              )
                            }
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {meta.hasConfig && question.type !== "comparison_choice" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.type === "semantic_differential" ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Left label</Label>
                        <Input
                          value={question.config.leftLabel ?? ""}
                          onChange={(event) =>
                            updateConfigField(
                              question.id,
                              "leftLabel",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Right label</Label>
                        <Input
                          value={question.config.rightLabel ?? ""}
                          onChange={(event) =>
                            updateConfigField(
                              question.id,
                              "rightLabel",
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  {["number", "slider", "stepper", "percentage", "currency", "nps", "star_rating", "semantic_differential", "constant_sum"].includes(
                    question.type
                  ) ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Min</Label>
                        <Input
                          type="number"
                          value={question.config.min ?? ""}
                          onChange={(event) =>
                            updateConfigField(
                              question.id,
                              "min",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Max</Label>
                        <Input
                          type="number"
                          value={question.config.max ?? ""}
                          onChange={(event) =>
                            updateConfigField(
                              question.id,
                              "max",
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  {["short_text", "long_text", "rich_text", "email", "phone"].includes(
                    question.type
                  ) ? (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Label>Placeholder</Label>
                      <Input
                        value={question.config.placeholder ?? ""}
                        onChange={(event) =>
                          updateConfigField(
                            question.id,
                            "placeholder",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  ) : null}

                  {["matrix_rating", "matrix_single", "matrix_multi", "table_input"].includes(
                    question.type
                  ) ? (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label>Rows (one per line)</Label>
                        <Textarea
                          value={(question.config.rows ?? []).join("\n")}
                          onChange={(event) =>
                            updateConfigField(
                              question.id,
                              "rows",
                              event.target.value
                            )
                          }
                          rows={3}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Columns (one per line)</Label>
                        <Textarea
                          value={(question.config.columns ?? []).join("\n")}
                          onChange={(event) =>
                            updateConfigField(
                              question.id,
                              "columns",
                              event.target.value
                            )
                          }
                          rows={3}
                        />
                      </div>
                    </>
                  ) : null}

                  {question.type === "hidden" ? (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Label>Hidden field key</Label>
                      <Input
                        value={question.config.hiddenKey ?? ""}
                        onChange={(event) =>
                          updateConfigField(
                            question.id,
                            "hiddenKey",
                            event.target.value
                          )
                        }
                        placeholder="utm_source"
                      />
                    </div>
                  ) : null}

                  {question.type === "currency" ? (
                    <div className="flex flex-col gap-2">
                      <Label>Currency</Label>
                      <Input
                        value={question.config.currency ?? "USD"}
                        onChange={(event) =>
                          updateConfigField(
                            question.id,
                            "currency",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={addQuestion}>
          <PlusIcon data-icon="inline-start" />
          Add question
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
        >
          {pending ? "Saving…" : "Save questions"}
        </Button>
        {dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
