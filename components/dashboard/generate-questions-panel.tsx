"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { QuestionEditor } from "@/components/dashboard/question-editor"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  generateProjectQuestions,
  updateProjectContext,
} from "@/lib/projects/actions"
import type { SurveyQuestion } from "@/lib/survey/questions"

type GenerateQuestionsPanelProps = {
  projectId: string
  icp: string | null
  objectives: string | null
  initialQuestions: SurveyQuestion[]
  generationsRemaining: number | null
  generationsLimit: number
  generationsUnlimited: boolean
}

export function GenerateQuestionsPanel({
  projectId,
  icp,
  objectives,
  initialQuestions,
  generationsRemaining,
  generationsLimit,
  generationsUnlimited,
}: GenerateQuestionsPanelProps) {
  const router = useRouter()
  const [questions, setQuestions] = useState(initialQuestions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [pending, startTransition] = useTransition()

  function runGenerate() {
    startTransition(async () => {
      const result = await generateProjectQuestions(projectId)
      if (result.needsContext) {
        setDialogOpen(true)
        setError(result.error ?? null)
        return
      }
      if (result.questions) {
        setQuestions(result.questions)
        setError(null)
        router.refresh()
        return
      }
      setError(result.error ?? "Could not generate questions.")
    })
  }

  function handleGenerate() {
    setError(null)
    setFieldErrors({})

    if (!icp?.trim() || !objectives?.trim()) {
      setDialogOpen(true)
      return
    }

    runGenerate()
  }

  function handleSaveAndGenerate(formData: FormData) {
    setError(null)
    setFieldErrors({})

    startTransition(async () => {
      const saved = await updateProjectContext({}, formData)
      if (saved.error) {
        setError(saved.error)
        setFieldErrors(saved.fieldErrors ?? {})
        return
      }

      setDialogOpen(false)
      const result = await generateProjectQuestions(projectId)
      if (result.questions) {
        setQuestions(result.questions)
        setError(null)
        router.refresh()
        return
      }
      if (result.needsContext) {
        setDialogOpen(true)
      }
      setError(result.error ?? "Could not generate questions.")
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Survey questions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate Mom Test questions, then edit wording, types, and options.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {generationsUnlimited
              ? "Unlimited AI generations on this account."
              : generationsRemaining === 0
                ? "No AI generations left."
                : `${generationsRemaining} of ${generationsLimit} AI generations left.`}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-9 px-3.5"
          onClick={handleGenerate}
          disabled={pending || (!generationsUnlimited && generationsRemaining === 0)}
        >
          {pending
            ? "Generating…"
            : questions.length
              ? "Regenerate"
              : "Generate questions"}
        </Button>
      </div>

      {error && !dialogOpen ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <QuestionEditor
        projectId={projectId}
        questions={questions}
        onChange={setQuestions}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fill this in to frame better questions</DialogTitle>
            <DialogDescription>
              Project name alone isn&apos;t enough for sharp Mom Test interviews.
              Tell us who you&apos;re talking to and what you&apos;re trying to
              learn, then we&apos;ll generate stronger questions.
            </DialogDescription>
          </DialogHeader>

          <form action={handleSaveAndGenerate} className="flex flex-col gap-4">
            <input type="hidden" name="projectId" value={projectId} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="dialog-icp">ICP</Label>
              <Textarea
                id="dialog-icp"
                name="icp"
                defaultValue={icp ?? ""}
                placeholder="Who are you interviewing and why were they selected?"
                rows={3}
                required
              />
              {fieldErrors.icp?.[0] ? (
                <p className="text-xs text-destructive">{fieldErrors.icp[0]}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="dialog-objectives">
                Objectives and goal of the survey
              </Label>
              <Textarea
                id="dialog-objectives"
                name="objectives"
                defaultValue={objectives ?? ""}
                placeholder="What hypothesis or research question are you testing?"
                rows={3}
                required
              />
              {fieldErrors.objectives?.[0] ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.objectives[0]}
                </p>
              ) : null}
            </div>

            {error && dialogOpen ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving & generating..." : "Save & generate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
