"use client"

import { useEffect, useRef, useState, useTransition } from "react"

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
import {
  isComparisonAnswerComplete,
  isQuestionVisible,
} from "@/lib/survey/comparison"
import type { SurveyQuestion } from "@/lib/survey/questions"
import { cn } from "@/lib/utils"

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

export function PublicForm({
  formId,
  formName,
  questions,
  theme,
}: PublicFormProps) {
  const startedAtRef = useRef<number>(Date.now())
  const fieldFocusStarted = useRef<Record<string, number>>({})
  const perFieldTimeMs = useRef<Record<string, number>>({})
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [honeypot, setHoneypot] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [pending, startTransition] = useTransition()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const draft = loadDraft(formId)
    if (draft) {
      setAnswers(draft.answers)
      startedAtRef.current = draft.startedAt || Date.now()
      perFieldTimeMs.current = draft.perFieldTimeMs ?? {}
    } else {
      startedAtRef.current = Date.now()
      saveDraft(formId, {
        answers: {},
        startedAt: startedAtRef.current,
        perFieldTimeMs: {},
        updatedAt: Date.now(),
      })
    }
    setReady(true)
  }, [formId])

  useEffect(() => {
    if (!ready) return
    saveDraft(formId, {
      answers,
      startedAt: startedAtRef.current,
      perFieldTimeMs: perFieldTimeMs.current,
      updatedAt: Date.now(),
    })
  }, [answers, formId, ready])

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
    saveDraft(formId, {
      answers,
      startedAt: startedAtRef.current,
      perFieldTimeMs: perFieldTimeMs.current,
      updatedAt: Date.now(),
    })
  }

  const visibleQuestions = questions.filter((question) =>
    isQuestionVisible(question, answers, questions)
  )

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    for (const question of visibleQuestions) {
      if (question.type === "comparison_choice") {
        if (!isComparisonAnswerComplete(question, answers[question.id])) {
          setError("Please complete all comparison questions before submitting.")
          return
        }
      }
    }

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

      const mergedAnswers = { ...answers }
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

  const shellStyle = themeToCssVars(theme)
  const shellClass = cn(
    "mx-auto w-full",
    theme.compact ? "space-y-4 p-5" : "space-y-6 p-6 sm:p-8",
    theme.embed
      ? "border border-[color-mix(in_oklab,var(--embed-text)_12%,transparent)]"
      : "surface rounded-lg",
    !theme.embed && "max-w-lg"
  )

  if (result) {
    return (
      <div
        style={shellStyle}
        className={cn(shellClass, "text-center")}
        data-embed={theme.embed ? "true" : "false"}
      >
        <div
          className="rounded-[var(--embed-radius)] bg-[var(--embed-bg)] text-[var(--embed-text)]"
          style={{ maxWidth: "var(--embed-max-width)" }}
        >
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Thank you
          </h1>
          <p className="mt-2 text-[15px] opacity-70">
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
      onSubmit={handleSubmit}
      style={shellStyle}
      className={cn(
        shellClass,
        "rounded-[var(--embed-radius)] bg-[var(--embed-bg)] text-[var(--embed-text)]"
      )}
      data-embed={theme.embed ? "true" : "false"}
    >
      <div style={{ maxWidth: "var(--embed-max-width)" }} className="w-full">
      {!theme.hideBrand || !theme.hideTitle ? (
      <div>
        {!theme.hideBrand ? (
          <p
            className="font-heading text-sm font-semibold tracking-tight"
            style={{ color: "var(--embed-accent)" }}
          >
            Myform
          </p>
        ) : null}
        {!theme.hideTitle ? (
          <>
            <h1
              className={cn(
                "font-heading font-semibold tracking-tight",
                theme.hideBrand ? "text-2xl" : "mt-1.5 text-2xl",
                theme.compact && "text-xl"
              )}
            >
              {formName}
            </h1>
            {!theme.compact ? (
              <p className="mt-2 text-sm opacity-65">
                Your progress is saved on this device.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      ) : null}

      {/* Honeypot — visually hidden, bots often fill it */}
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

      <div className="space-y-5">
        {visibleQuestions.map((question) => (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={question.id} className="text-[15px] leading-snug">
              {question.prompt}
            </Label>
            <FieldInput
              question={question}
              value={answers[question.id]}
              onChange={(value) => setAnswer(question.id, value)}
              onFocus={() => onFieldFocus(question.id)}
              onBlur={() => onFieldBlur(question.id)}
            />
          </div>
        ))}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending || !ready}
        className="h-10 w-full text-white hover:opacity-90"
        style={{ backgroundColor: "var(--embed-accent)" }}
      >
        {pending ? "Submitting…" : "Submit"}
      </Button>
      </div>
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
          rows={4}
          className="min-h-24 bg-background/60"
        />
      )
    case "image_choice":
      return (
        <RadioGroup
          value={stringValue}
          onValueChange={onChange}
          className="grid gap-3 sm:grid-cols-2"
        >
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer flex-col overflow-hidden rounded-md border border-border/80 bg-background/40 text-sm transition-colors hover:bg-background/70 has-[[data-checked]]:border-[var(--brand-signal)]"
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
                <div className="flex aspect-[4/3] items-center justify-center bg-muted text-xs text-muted-foreground">
                  No image
                </div>
              )}
              <span className="flex items-center gap-2.5 px-3 py-2.5">
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
          value={stringValue}
          onValueChange={onChange}
          className="gap-2"
        >
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border/80 bg-background/40 px-3 py-2.5 text-sm transition-colors hover:bg-background/70"
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
        <div className="space-y-2">
          {question.options.map((option) => {
            const optionValue = option.value ?? option.label
            const checked = arrayValue.includes(optionValue)
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border/80 bg-background/40 px-3 py-2.5 text-sm transition-colors hover:bg-background/70"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    onFocus()
                    if (next) {
                      onChange([...arrayValue, optionValue])
                    } else {
                      onChange(arrayValue.filter((item) => item !== optionValue))
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
        <label className="flex items-center gap-2 text-sm">
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
          className="h-10 bg-background/60"
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
          className="h-10 bg-background/60"
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
          className="h-10 bg-background/60"
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
          className="h-10 bg-background/60"
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
          className="h-10 bg-background/60"
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
          className="h-10 bg-background/60"
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
          className="h-10 bg-background/60"
        />
      )
  }
}
