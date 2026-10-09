"use client"

import { useRef, useState, useTransition } from "react"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

import {
  FieldInput,
  isQuestionAnswered,
  markSubmitted,
} from "@/components/public/public-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { themeToCssVars, type EmbedTheme } from "@/lib/forms/embed-theme"
import type { FormSettings } from "@/lib/forms/settings"
import {
  SUBMIT_TARGET,
  answersForVisiblePath,
  getSectionPath,
  getSections,
  targetAfterSection,
} from "@/lib/survey/conditional"
import { validateAnswer } from "@/lib/survey/validation"
import type { SurveyQuestion } from "@/lib/survey/questions"
import { cn } from "@/lib/utils"

type SectionedFormProps = {
  formId: string
  formName: string
  questions: SurveyQuestion[]
  theme: EmbedTheme
  settings: FormSettings
}

export function SectionedForm({
  formId,
  formName,
  questions,
  theme,
  settings,
}: SectionedFormProps) {
  const startedAtRef = useRef(Date.now())
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [sectionId, setSectionId] = useState(questions[0]?.id ?? "")
  const [history, setHistory] = useState<string[]>([])
  const [honeypot, setHoneypot] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const sections = getSections(questions)
  const path = getSectionPath(questions, answers)
  const section = sections.find((item) => item.id === sectionId) ?? sections[0]
  const position = Math.max(
    0,
    path.findIndex((item) => item.id === section?.id)
  )
  const target = section ? targetAfterSection(section, answers) : undefined
  const nextSection =
    target === SUBMIT_TARGET
      ? undefined
      : (path[position + 1] ??
        (target ? sections.find((item) => item.id === target) : undefined))
  const isLast = !nextSection
  const progress = path.length > 0 ? ((position + 1) / path.length) * 100 : 0
  const shellStyle = themeToCssVars(theme)

  function setAnswer(questionId: string, value: unknown) {
    setError(null)
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function missingRequired() {
    return section?.questions.find(
      (question) =>
        question.config.required &&
        !isQuestionAnswered(question, answers[question.id])
    )
  }

  function firstInvalid() {
    for (const question of section?.questions ?? []) {
      const message = validateAnswer(question, answers[question.id])
      if (message) return { question, message }
    }
    return null
  }

  function submit() {
    startTransition(async () => {
      const params = new URLSearchParams(window.location.search)
      const source =
        params.get("utm_source") ||
        params.get("source") ||
        params.get("campaign") ||
        null
      const merged = answersForVisiblePath(questions, answers)
      if (source && !merged.utm_source) merged.utm_source = source

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          answers: merged,
          source,
          totalCompletionTimeMs: Math.round(Date.now() - startedAtRef.current),
          perFieldTimeMs: {},
          honeypotFieldFilled: honeypot.trim().length > 0,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(data.error ?? "Submission failed.")
        return
      }
      markSubmitted(formId)
      setDone(true)
    })
  }

  function next() {
    const missing = missingRequired()
    if (missing) {
      setError(`“${missing.prompt || "Untitled question"}” is required.`)
      return
    }
    const invalid = firstInvalid()
    if (invalid) {
      setError(`“${invalid.question.prompt || "Untitled question"}”: ${invalid.message}`)
      return
    }
    setError(null)
    if (!nextSection) {
      submit()
      return
    }
    setHistory((prev) => [...prev, section.id])
    setSectionId(nextSection.id)
    window.scrollTo({ top: 0 })
  }

  function back() {
    const previous = history[history.length - 1]
    if (!previous) return
    setError(null)
    setHistory((prev) => prev.slice(0, -1))
    setSectionId(previous)
    window.scrollTo({ top: 0 })
  }

  if (done) {
    return (
      <div
        style={shellStyle}
        className="flex min-h-screen items-center justify-center bg-[var(--embed-bg)] px-6 py-16 text-[var(--embed-text)]"
        data-embed={theme.embed ? "true" : "false"}
      >
        <div className="fade-up max-w-xl text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Thank you
          </h1>
          {settings.confirmationMessage.trim() ? (
            <p className="mt-4 whitespace-pre-wrap text-lg leading-7 opacity-70">
              {settings.confirmationMessage}
            </p>
          ) : (
            <p className="mt-4 text-lg leading-7 opacity-70">
              Your response for{" "}
              <span className="font-medium opacity-100">{formName}</span> was
              received.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!section) return null

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        next()
      }}
      style={shellStyle}
      className="relative flex min-h-screen flex-col bg-[var(--embed-bg)] text-[var(--embed-text)]"
      data-embed={theme.embed ? "true" : "false"}
    >
      {settings.showProgress ? (
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
      ) : null}

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

      <div className="flex flex-1 justify-center px-5 py-10 sm:px-8">
        <div
          className="w-full space-y-8"
          style={{ maxWidth: "min(44rem, var(--embed-max-width))" }}
        >
          <div key={section.id} className="fade-up space-y-3">
            {position === 0 && !theme.hideTitle ? (
              <h1
                className={cn(
                  "font-heading font-semibold tracking-tight",
                  theme.compact ? "text-3xl" : "text-4xl"
                )}
              >
                {formName}
              </h1>
            ) : null}
            {section.title ? (
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {section.title}
              </h2>
            ) : null}
            {section.description ? (
              <p className="whitespace-pre-wrap text-lg leading-7 opacity-70">
                {section.description}
              </p>
            ) : null}
            <p className="text-sm opacity-55">
              Page {position + 1} of {path.length}
            </p>
          </div>

          {section.questions.map((question) => (
            <div key={question.id} className="space-y-3">
              <Label
                htmlFor={question.id}
                className="font-heading block text-xl font-semibold leading-snug tracking-tight"
              >
                {question.prompt || "Untitled question"}
                {question.config.required ? (
                  <span className="ml-1 text-destructive">*</span>
                ) : null}
              </Label>
              <FieldInput
                question={question}
                value={answers[question.id]}
                onChange={(value) => setAnswer(question.id, value)}
                onFocus={() => {}}
                onBlur={() => {}}
              />
            </div>
          ))}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center gap-3">
            {history.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 bg-transparent px-5 text-base"
                onClick={back}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                Back
              </Button>
            ) : null}
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="h-11 px-5 text-base text-white hover:opacity-90"
              style={{ backgroundColor: "var(--embed-accent)" }}
            >
              {pending ? "Submitting…" : isLast ? "Submit" : "Next"}
              {pending ? null : <ArrowRightIcon data-icon="inline-end" />}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
