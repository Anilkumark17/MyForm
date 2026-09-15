"use client"

import { GitBranchIcon, ListIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react"

import { ComparisonOptionEditor } from "@/components/dashboard/comparison-option-editor"
import {
  BranchingOverview,
  ConditionalLogicEditor,
} from "@/components/dashboard/conditional-logic-editor"
import { FlowBuilder } from "@/components/dashboard/flow-builder/flow-builder"
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
  cleanupConditionalLogic,
  hasShowIf,
  questionsDependingOn,
} from "@/lib/survey/conditional"
import {
  questionTypesByCategory,
  QUESTION_TYPE_MAP,
  type QuestionTypeId,
} from "@/lib/survey/question-types"
import {
  applyTypeChange,
  commitOptionLabel,
  createEmptyQuestion,
  createOption,
  isDraftOptionId,
  labeledAnswerOptions,
  optionRowsForEditor,
  type AnswerOption,
  type SurveyQuestion,
} from "@/lib/survey/questions"
import { cn } from "@/lib/utils"

type QuestionEditorProps = {
  projectId: string
  questions: SurveyQuestion[]
  onChange: (questions: SurveyQuestion[]) => void
}

const typeGroups = questionTypesByCategory()

type SaveStatus = "idle" | "saving" | "saved" | "error"

export function QuestionEditor({
  projectId,
  questions,
  onChange,
}: QuestionEditorProps) {
  const [view, setView] = useState<"editor" | "flow">("editor")
  const [pending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)

  const questionsRef = useRef(questions)
  const lastSavedJsonRef = useRef(JSON.stringify(questions))
  const fallbackTimerRef = useRef<number | null>(null)
  const snapshotGenRef = useRef(0)
  const connectedRef = useRef(false)
  const collabRef = useRef<{
    clientId: string
    retryPersist: () => void
    acknowledgePersist: (revision: number, next: SurveyQuestion[]) => void
    syncing: boolean
  } | null>(null)

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  function clearFallback() {
    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }

  const persistSnapshot = useEffectEvent(async () => {
    const payload = questionsRef.current
    const serialized = JSON.stringify(payload)
    if (serialized === lastSavedJsonRef.current) {
      setSaveStatus("saved")
      setSaveError(null)
      return true
    }

    snapshotGenRef.current += 1
    const generation = snapshotGenRef.current
    setSaveStatus("saving")
    setSaveError(null)

    const result = await saveProjectQuestions(
      projectId,
      payload,
      collabRef.current?.clientId
    )
    if (generation !== snapshotGenRef.current) return false

    if (result.error) {
      setSaveStatus("error")
      setSaveError(result.error)
      return false
    }

    lastSavedJsonRef.current = serialized
    if (typeof result.revision === "number") {
      collabRef.current?.acknowledgePersist(result.revision, payload)
    }
    setSaveStatus("saved")
    setSaveError(null)
    return true
  })

  const collab = useQuestionCollab({
    projectId,
    questions,
    onRemoteQuestions: (next, meta) => {
      lastSavedJsonRef.current = JSON.stringify(next)
      setSaveStatus("saved")
      setSaveError(null)
      clearFallback()
      if (meta?.source === "op") {
        setSyncNotice("Synced from collaborator")
      }
      onChange(next)
    },
    onPersistIdle: () => {
      lastSavedJsonRef.current = JSON.stringify(questionsRef.current)
      setSaveStatus("saved")
      setSaveError(null)
      clearFallback()
    },
    onPersistError: (message) => {
      setSaveStatus("error")
      setSaveError(message)
      clearFallback()
      fallbackTimerRef.current = window.setTimeout(() => {
        fallbackTimerRef.current = null
        void persistSnapshot()
      }, 1200)
    },
  })

  connectedRef.current = collab.connected
  collabRef.current = {
    clientId: collab.clientId,
    retryPersist: collab.retryPersist,
    acknowledgePersist: collab.acknowledgePersist,
    syncing: collab.syncing,
  }

  useEffect(() => {
    function flushIfNeeded() {
      if (document.visibilityState && document.visibilityState !== "hidden") {
        return
      }
      if (collabRef.current?.syncing) return
      const current = JSON.stringify(questionsRef.current)
      if (current === lastSavedJsonRef.current) return
      if (connectedRef.current) {
        collabRef.current?.retryPersist()
        return
      }
      void persistSnapshot()
    }

    document.addEventListener("visibilitychange", flushIfNeeded)
    window.addEventListener("pagehide", flushIfNeeded)
    return () => {
      document.removeEventListener("visibilitychange", flushIfNeeded)
      window.removeEventListener("pagehide", flushIfNeeded)
      clearFallback()
    }
  }, [])

  function updateQuestions(next: SurveyQuestion[]) {
    setSaveStatus("saving")
    setSaveError(null)
    setSyncNotice(null)
    onChange(next)
    collab.publishLocalChange(next)
  }

  function handleRetrySave() {
    clearFallback()
    startTransition(async () => {
      const saved = await persistSnapshot()
      if (!saved) collab.retryPersist()
    })
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
      cleanupConditionalLogic(
        questions.map((question) =>
          question.id === id ? applyTypeChange(question, type) : question
        )
      )
    )
  }

  function removeQuestion(id: string) {
    updateQuestions(
      cleanupConditionalLogic(questions.filter((question) => question.id !== id))
    )
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
          options: commitOptionLabel(question.options, optionId, label),
        }
      })
    )
  }

  function removeOption(questionId: string, optionId: string) {
    updateQuestions(
      cleanupConditionalLogic(
        questions.map((question) => {
          if (question.id !== questionId) return question
          return {
            ...question,
            options: question.options.filter((option) => option.id !== optionId),
          }
        })
      )
    )
  }

  function addOption(questionId: string) {
    updateQuestions(
      questions.map((question) => {
        if (question.id !== questionId) return question
        const labeled = labeledAnswerOptions(question.options)
        return {
          ...question,
          options: [
            ...labeled,
            createOption(`Option ${labeled.length + 1}`),
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

  if (questions.length === 0 && view === "editor") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AutosaveStatus
            status={saveStatus}
            error={saveError}
            pending={pending}
            onRetry={handleRetrySave}
          />
          <ViewToggle view={view} onChange={setView} />
        </div>
        <div className="surface rounded-lg border-dashed px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No questions yet. Generate a set, add one here, or switch to Flow
            Builder to map branches visually.
          </p>
          <Button type="button" className="mt-4 h-9" onClick={addQuestion}>
            Add question
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={collab.connected ? "secondary" : "outline"}>
          {collab.connected ? "Live sync on" : "Connecting…"}
        </Badge>
        <span>rev {collab.revision}</span>
        <AutosaveStatus
          status={saveStatus}
          error={saveError}
          pending={pending || collab.syncing}
          onRetry={handleRetrySave}
        />
        {syncNotice ? <span>{syncNotice}</span> : null}
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
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "flow" ? (
        <FlowBuilder questions={questions} onChange={updateQuestions} />
      ) : (
        <>
      <BranchingOverview questions={questions} />

      {questions.map((question, index) => {
        const meta = QUESTION_TYPE_MAP[question.type]
        const branchedFrom = hasShowIf(question)
        const branchesOthers =
          questionsDependingOn(questions, question.id).length > 0
        return (
          <div
            key={question.id}
            className="surface rounded-lg p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-heading text-sm font-medium text-muted-foreground">
                  Question {index + 1}
                </p>
                {question.config.groupName ? (
                  <Badge variant="outline">{question.config.groupName}</Badge>
                ) : null}
                {branchedFrom ? (
                  <Badge variant="secondary">Conditional</Badge>
                ) : null}
                {branchesOthers ? (
                  <Badge variant="outline">Branches</Badge>
                ) : null}
              </div>
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
                <p className="text-sm leading-6 text-muted-foreground">
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
                    {optionRowsForEditor(question.options, question.id).map(
                      (option, optionIndex) => (
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
                            placeholder={
                              isDraftOptionId(option.id)
                                ? "Add option"
                                : `Option ${optionIndex + 1}`
                            }
                          />
                          {isDraftOptionId(option.id) ? null : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              removeOption(question.id, option.id)
                            }
                            aria-label="Delete option"
                            disabled={
                              labeledAnswerOptions(question.options).length <= 1
                            }
                          >
                            <Trash2Icon />
                          </Button>
                          )}
                        </div>
                        {question.type === "image_choice" ? (
                          <ImageFieldInput
                            id={`img-choice-${option.id}`}
                            label="Option image"
                            value={option.imageUrl}
                            onChange={(imageUrl) =>
                              updateQuestions(
                                questions.map((q) => {
                                  if (q.id !== question.id) return q
                                  if (isDraftOptionId(option.id)) {
                                    return {
                                      ...q,
                                      options: [
                                        ...labeledAnswerOptions(q.options),
                                        { ...createOption(""), imageUrl },
                                      ],
                                    }
                                  }
                                  return {
                                    ...q,
                                    options: q.options.map((o) =>
                                      o.id === option.id
                                        ? { ...o, imageUrl }
                                        : o
                                    ),
                                  }
                                })
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

              <ConditionalLogicEditor
                question={question}
                questions={questions}
                onQuestionChange={(patch) =>
                  updateQuestion(question.id, patch)
                }
                onQuestionsChange={updateQuestions}
              />
            </div>
          </div>
        )
      })}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {view === "editor" ? (
        <Button type="button" variant="outline" onClick={addQuestion}>
          <PlusIcon data-icon="inline-start" />
          Add question
        </Button>
        ) : null}
      </div>

      {saveError ? (
        <Alert variant="destructive">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

function AutosaveStatus({
  status,
  error,
  pending,
  onRetry,
}: {
  status: SaveStatus
  error: string | null
  pending: boolean
  onRetry: () => void
}) {
  const saving = status === "saving" || pending
  const label = saving
    ? "Saving…"
    : status === "saved"
      ? "Saved"
      : status === "error"
        ? error ?? "Could not save"
        : "Autosave on"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "text-sm",
          status === "error" ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      {status === "error" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={onRetry}
          disabled={saving}
        >
          Retry save
        </Button>
      ) : null}
    </div>
  )
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "editor" | "flow"
  onChange: (view: "editor" | "flow") => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
      <Button
        type="button"
        variant={view === "editor" ? "secondary" : "ghost"}
        className={cn("gap-1.5", view === "editor" && "shadow-sm")}
        onClick={() => onChange("editor")}
      >
        <ListIcon data-icon="inline-start" />
        Form Editor
      </Button>
      <Button
        type="button"
        variant={view === "flow" ? "secondary" : "ghost"}
        className={cn("gap-1.5", view === "flow" && "shadow-sm")}
        onClick={() => onChange("flow")}
      >
        <GitBranchIcon data-icon="inline-start" />
        Flow Builder
      </Button>
    </div>
  )
}
