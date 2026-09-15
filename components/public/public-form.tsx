"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

import { ComparisonField } from "@/components/public/comparison-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/lib/forms/local-draft"
import {
  themeToCssVars,
  type EmbedTheme,
} from "@/lib/forms/embed-theme"
import { isComparisonAnswerComplete } from "@/lib/survey/comparison"
import {
  answersForVisiblePath,
  getVisibleQuestions,
} from "@/lib/survey/conditional"
import type { SurveyQuestion } from "@/lib/survey/questions"
import { cn } from "@/lib/utils"

const AUTO_ADVANCE_TYPES = new Set([
  "yes_no",
  "single_select",
  "dropdown",
  "likert",
  "emoji_scale",
  "opt_in_toggle",
  "image_choice",
])

type PublicFormProps = {
  formId: string
  formName: string
  questions: SurveyQuestion[]
  theme: EmbedTheme
}

type SubmitResult = {
  trustScore: number
  flagStatus: string
}

function isQuestionAnswered(question: SurveyQuestion, value: unknown) {
  if (question.type === "comparison_choice") {
    return isComparisonAnswerComplete(question, value)
  }
  if (question.type === "consent_checkbox") return Boolean(value)
  if (
    question.type === "multi_select" ||
    question.type === "multi_select_dropdown" ||
    question.type === "ranked_choice" ||
    question.type === "ranking"
  ) {
    return Array.isArray(value) && value.length > 0
  }
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "string") return value.trim().length > 0
  return value != null && value !== ""
}

export function PublicForm({
  formId,
  formName,
  questions,
  theme,
}: PublicFormProps) {
  const startedAtRef = useRef<number>(Date.now())
  const fieldFocusStarted = useRef<Record<string, number>>({})
  const perFieldTimeMs = useRef<Record<string, number>>({})
  const advanceTimer = useRef<number | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [honeypot, setHoneypot] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [ready, setReady] = useState(false)
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [currentQuestionId, setCurrentQuestionId] = useState(
    questions[0]?.id ?? ""
  )

  const visibleQuestions = getVisibleQuestions(questions, answers)
  const visibleKey = visibleQuestions.map((question) => question.id).join(",")
  const currentIndex = Math.max(
    0,
    visibleQuestions.findIndex((question) => question.id === currentQuestionId)
  )
  const current = visibleQuestions[currentIndex] ?? visibleQuestions[0] ?? null
  const isLast = Boolean(current) && currentIndex === visibleQuestions.length - 1
  const progress = !welcomeDone
    ? 0
    : visibleQuestions.length === 0
      ? 0
      : ((currentIndex + 1) / visibleQuestions.length) * 100

  useEffect(() => {
    const draft = loadDraft(formId)
    if (draft) {
      setAnswers(draft.answers)
      startedAtRef.current = draft.startedAt || Date.now()
      perFieldTimeMs.current = draft.perFieldTimeMs ?? {}
      if (draft.currentQuestionId) setCurrentQuestionId(draft.currentQuestionId)
      if (draft.welcomeDone || Object.keys(draft.answers).length > 0) {
        setWelcomeDone(true)
      }
    } else {
      startedAtRef.current = Date.now()
      saveDraft(formId, {
        answers: {},
        startedAt: startedAtRef.current,
        perFieldTimeMs: {},
        updatedAt: Date.now(),
        currentQuestionId: questions[0]?.id,
        welcomeDone: false,
      })
    }
    setReady(true)
  }, [formId, questions])

  useEffect(() => {
    if (!ready) return
    saveDraft(formId, {
      answers,
      startedAt: startedAtRef.current,
      perFieldTimeMs: perFieldTimeMs.current,
      updatedAt: Date.now(),
      currentQuestionId,
      welcomeDone,
    })
  }, [answers, currentQuestionId, formId, ready, welcomeDone])

  useEffect(() => {
    const ids = visibleKey ? visibleKey.split(",") : []
    if (!currentQuestionId || ids.includes(currentQuestionId)) return
    setCurrentQuestionId(ids[0] ?? "")
  }, [currentQuestionId, visibleKey])

  useEffect(() => {
    if (!welcomeDone || !current) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(current.id)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [current, welcomeDone])

  useEffect(() => {
    return () => {
      if (advanceTimer.current != null) {
        window.clearTimeout(advanceTimer.current)
      }
    }
  }, [])

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function onFieldFocus(questionId: string) {
    fieldFocusStarted.current[questionId] = performance.now()
  }

  function onFieldBlur(questionId: string) {
    const started = fieldFocusStarted.current[questionId]
    if (started == null) return
    const elapsed = Math.max(0, performance.now() - started)
    perFieldTimeMs.current[questionId] =
      (perFieldTimeMs.current[questionId] ?? 0) + elapsed
    delete fieldFocusStarted.current[questionId]
  }

  function persistFieldTime(questionId: string) {
    onFieldBlur(questionId)
  }

  function canProceed(question: SurveyQuestion, value = answers[question.id]) {
    if (!question.config.required) return true
    return isQuestionAnswered(question, value)
  }

  function goToQuestion(questionId: string) {
    if (advanceTimer.current != null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (current) persistFieldTime(current.id)
    setError(null)
    setCurrentQuestionId(questionId)
  }

  function submitForm() {
    if (!current) return
    persistFieldTime(current.id)
    setError(null)

    startTransition(async () => {
      const totalCompletionTimeMs = Math.round(
        Date.now() - startedAtRef.current
      )
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null
      const source =
        params?.get("utm_source") ||
        params?.get("source") ||
        params?.get("campaign") ||
        null

      const mergedAnswers = answersForVisiblePath(questions, { ...answers })
      if (source && !mergedAnswers.utm_source) {
        mergedAnswers.utm_source = source
      }

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          answers: mergedAnswers,
          source,
          totalCompletionTimeMs,
          perFieldTimeMs: Object.fromEntries(
            Object.entries(perFieldTimeMs.current).map(([key, value]) => [
              key,
              Math.round(value),
            ])
          ),
          honeypotFieldFilled: honeypot.trim().length > 0,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        trustScore?: number
        flagStatus?: string
      }

      if (!response.ok) {
        setError(data.error ?? "Submission failed.")
        return
      }

      clearDraft(formId)
      setResult({
        trustScore: data.trustScore ?? 0,
        flagStatus: data.flagStatus ?? "clean",
      })
    })
  }

  function goNext(options?: { auto?: boolean; value?: unknown }) {
    if (!current) return
    const value = options?.value ?? answers[current.id]
    if (!canProceed(current, value)) {
      if (options?.auto) return
      setError("Please answer this question to continue.")
      return
    }
    const nextVisible = getVisibleQuestions(questions, {
      ...answers,
      [current.id]: value,
    })
    const index = nextVisible.findIndex((item) => item.id === current.id)
    const next = nextVisible[index + 1]
    if (!next) {
      if (options?.auto) return
      submitForm()
      return
    }
    goToQuestion(next.id)
  }

  function goBack() {
    if (!welcomeDone) return
    if (currentIndex <= 0) {
      if (current) persistFieldTime(current.id)
      setWelcomeDone(false)
      return
    }
    const previous = visibleQuestions[currentIndex - 1]
    if (previous) goToQuestion(previous.id)
  }

  function handleChoice(question: SurveyQuestion, value: unknown) {
    setError(null)
    setAnswer(question.id, value)
    if (!AUTO_ADVANCE_TYPES.has(question.type)) return
    if (advanceTimer.current != null) window.clearTimeout(advanceTimer.current)
    advanceTimer.current = window.setTimeout(() => {
      goNext({ auto: true, value })
    }, 280)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key !== "Enter") return
    const target = event.target as HTMLElement
    if (target.tagName === "TEXTAREA" && !event.metaKey && !event.ctrlKey) {
      return
    }
    event.preventDefault()
    if (!welcomeDone) {
      setWelcomeDone(true)
      return
    }
    goNext()
  }

  const shellStyle = themeToCssVars(theme)

  if (result) {
    return (
      <div
        style={shellStyle}
        className="flex min-h-screen items-center justify-center bg-[var(--embed-bg)] px-6 py-16 text-[var(--embed-text)]"
        data-embed={theme.embed ? "true" : "false"}
      >
        <div className="fade-up max-w-xl text-center">
          <p
            className="font-heading text-sm font-semibold tracking-tight"
            style={{ color: "var(--embed-accent)" }}
          >
            Done
          </p>
          <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Thank you
          </h1>
          <p className="mt-4 text-lg leading-7 opacity-70">
            Your response for{" "}
            <span className="font-medium opacity-100">{formName}</span> was
            received.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!welcomeDone) {
          setWelcomeDone(true)
          return
        }
        goNext()
      }}
      onKeyDown={handleKeyDown}
      style={shellStyle}
      className="relative flex min-h-screen flex-col bg-[var(--embed-bg)] text-[var(--embed-text)]"
      data-embed={theme.embed ? "true" : "false"}
    >
      <div
        className="h-1 w-full bg-[color-mix(in_oklab,var(--embed-text)_12%,transparent)]"
        aria-hidden="true"
      >
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${progress}%`,
            backgroundColor: "var(--embed-accent)",
          }}
        />
      </div>

      <div className="flex items-center justify-between px-5 py-4 sm:px-8">
        {!theme.hideBrand ? (
          <p
            className="font-heading text-sm font-semibold tracking-tight sm:text-base"
            style={{ color: "var(--embed-accent)" }}
          >
            Myform
          </p>
        ) : (
          <span />
        )}
        {welcomeDone && visibleQuestions.length > 0 ? (
          <p className="text-sm tabular-nums opacity-55">
            {currentIndex + 1} / {visibleQuestions.length}
          </p>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
      >
        <Label htmlFor="company_website">Company website</Label>
        <Input
          id="company_website"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div
          className="w-full"
          style={{ maxWidth: "min(44rem, var(--embed-max-width))" }}
        >
          {!welcomeDone ? (
            <div className="fade-up">
              <h1
                className={cn(
                  "font-heading font-semibold tracking-tight",
                  theme.compact
                    ? "text-3xl sm:text-4xl"
                    : "text-4xl sm:text-5xl"
                )}
              >
                {theme.hideTitle ? "Ready when you are" : formName}
              </h1>
              <p className="mt-4 max-w-lg text-lg leading-7 opacity-70">
                One question at a time. Your progress is saved on this device.
              </p>
              <Button
                type="button"
                size="lg"
                disabled={!ready}
                className="mt-8 h-11 px-5 text-base text-white hover:opacity-90"
                style={{ backgroundColor: "var(--embed-accent)" }}
                onClick={() => {
                  setWelcomeDone(true)
                  setCurrentQuestionId(
                    visibleQuestions[0]?.id ?? questions[0]?.id ?? ""
                  )
                }}
              >
                Start
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <p className="mt-3 text-sm opacity-50">press Enter ↵</p>
            </div>
          ) : current ? (
            <div key={current.id} className="fade-up">
              <p className="text-sm font-medium opacity-55">
                {currentIndex + 1} →
              </p>
              <Label
                htmlFor={current.id}
                className={cn(
                  "font-heading mt-2 block font-semibold tracking-tight leading-snug",
                  theme.compact
                    ? "text-2xl sm:text-3xl"
                    : "text-3xl sm:text-[2.5rem]"
                )}
              >
                {current.prompt || "Untitled question"}
                {current.config.required ? (
                  <span className="ml-1 opacity-50">*</span>
                ) : null}
              </Label>
              <div className="mt-8">
                <FieldInput
                  question={current}
                  value={answers[current.id]}
                  onChange={(value) => {
                    if (AUTO_ADVANCE_TYPES.has(current.type)) {
                      handleChoice(current, value)
                      return
                    }
                    setError(null)
                    setAnswer(current.id, value)
                  }}
                  onFocus={() => onFieldFocus(current.id)}
                  onBlur={() => persistFieldTime(current.id)}
                />
              </div>
              {error ? (
                <Alert variant="destructive" className="mt-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="lg"
                  disabled={pending || !ready}
                  className="h-11 px-5 text-base text-white hover:opacity-90"
                  style={{ backgroundColor: "var(--embed-accent)" }}
                  onClick={() => goNext()}
                >
                  {pending ? "Submitting…" : isLast ? "Submit" : "OK"}
                  {pending ? null : <ArrowRightIcon data-icon="inline-end" />}
                </Button>
                {!isLast ? (
                  <span className="text-sm opacity-50">press Enter ↵</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {welcomeDone ? (
        <div className="flex items-center gap-2 px-5 pb-5 sm:px-8">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous question"
            onClick={goBack}
            className="border-[color-mix(in_oklab,var(--embed-text)_18%,transparent)] bg-transparent"
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next question"
            onClick={() => goNext()}
            disabled={pending}
            className="border-[color-mix(in_oklab,var(--embed-text)_18%,transparent)] bg-transparent"
          >
            <ArrowRightIcon />
          </Button>
        </div>
      ) : null}
    </form>
  )
}

function FieldInput({
  question,
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  question: SurveyQuestion
  value: unknown
  onChange: (value: unknown) => void
  onFocus: () => void
  onBlur: () => void
}) {
  const stringValue = typeof value === "string" ? value : ""
  const arrayValue = Array.isArray(value) ? value.map(String) : []

  switch (question.type) {
    case "comparison_choice":
      return (
        <ComparisonField
          question={question}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )
    case "long_text":
    case "rich_text":
      return (
        <Textarea
          id={question.id}
          value={stringValue}
          placeholder={question.config.placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          rows={5}
          className="min-h-28 bg-background/60 text-base"
        />
      )
    case "image_choice":
      return (
        <RadioGroup
          id={question.id}
          value={stringValue}
          onValueChange={onChange}
          className="grid gap-3 sm:grid-cols-2"
        >
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border/80 bg-background/40 text-[15px] transition-colors hover:bg-background/70 has-[[data-checked]]:border-[var(--brand-signal)]"
              onFocus={onFocus}
              onBlur={onBlur}
            >
              {option.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.imageUrl}
                  alt=""
                  className="aspect-[4/3] w-full object-cover bg-muted"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">
                  No image
                </div>
              )}
              <span className="flex items-center gap-2.5 px-3 py-3">
                <RadioGroupItem value={option.value ?? option.label} />
                {option.label}
              </span>
            </label>
          ))}
        </RadioGroup>
      )
    case "yes_no":
    case "single_select":
    case "dropdown":
    case "likert":
    case "emoji_scale":
    case "opt_in_toggle":
      return (
        <RadioGroup
          id={question.id}
          value={stringValue}
          onValueChange={onChange}
          className="gap-2.5"
        >
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3.5 text-base leading-snug transition-colors hover:bg-background/70 has-[[data-checked]]:border-[var(--brand-signal)]"
              onFocus={onFocus}
              onBlur={onBlur}
            >
              <RadioGroupItem value={option.value ?? option.label} />
              {option.label}
            </label>
          ))}
        </RadioGroup>
      )
    case "multi_select":
    case "multi_select_dropdown":
    case "ranked_choice":
    case "ranking":
      return (
        <div className="space-y-2.5">
          {question.options.map((option) => {
            const optionValue = option.value ?? option.label
            const checked = arrayValue.includes(optionValue)
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3.5 text-base leading-snug transition-colors hover:bg-background/70"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    onFocus()
                    if (next) {
                      onChange([...arrayValue, optionValue])
                    } else {
                      onChange(
                        arrayValue.filter((item) => item !== optionValue)
                      )
                    }
                    onBlur()
                  }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      )
    case "consent_checkbox":
      return (
        <label className="flex items-center gap-3 text-base">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(next) => {
              onFocus()
              onChange(Boolean(next))
              onBlur()
            }}
          />
          {question.options[0]?.label ?? "I agree"}
        </label>
      )
    case "number":
    case "currency":
    case "percentage":
    case "slider":
    case "stepper":
    case "nps":
    case "star_rating":
      return (
        <Input
          id={question.id}
          type="number"
          value={stringValue}
          min={question.config.min}
          max={question.config.max}
          step={question.config.step}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 max-w-xs bg-background/60 text-base"
        />
      )
    case "email":
      return (
        <Input
          id={question.id}
          type="email"
          value={stringValue}
          placeholder={question.config.placeholder ?? "you@company.com"}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 bg-background/60 text-base"
        />
      )
    case "phone":
      return (
        <Input
          id={question.id}
          type="tel"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 bg-background/60 text-base"
        />
      )
    case "date":
      return (
        <Input
          id={question.id}
          type="date"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 max-w-xs bg-background/60 text-base"
        />
      )
    case "time":
      return (
        <Input
          id={question.id}
          type="time"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 max-w-xs bg-background/60 text-base"
        />
      )
    case "datetime":
      return (
        <Input
          id={question.id}
          type="datetime-local"
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 max-w-md bg-background/60 text-base"
        />
      )
    default:
      return (
        <Input
          id={question.id}
          value={stringValue}
          placeholder={question.config.placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-12 bg-background/60 text-base"
        />
      )
  }
}
