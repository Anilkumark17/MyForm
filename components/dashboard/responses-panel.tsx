"use client"

import { useMemo } from "react"

import { ComparisonResults } from "@/components/dashboard/comparison-results"
import { ResponseCharts } from "@/components/dashboard/response-charts"
import { SubmissionsTable } from "@/components/dashboard/submissions-table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Submission } from "@/lib/db/schema"
import { downloadSubmissionsExcel } from "@/lib/projects/export-excel"
import {
  buildQuestionAggregates,
  questionTypeLabel,
  type QuestionAggregate,
} from "@/lib/projects/response-analytics"
import { splitSubmissions } from "@/lib/projects/submission-filters"
import type { SurveyQuestion } from "@/lib/survey/questions"

type ResponsesPanelProps = {
  projectName: string
  questions: SurveyQuestion[]
  submissions: Submission[]
}

export function ResponsesPanel({
  projectName,
  questions,
  submissions,
}: ResponsesPanelProps) {
  const { valid, fake } = useMemo(
    () => splitSubmissions(submissions),
    [submissions]
  )

  const aggregates = useMemo(
    () => buildQuestionAggregates(questions, valid),
    [questions, valid]
  )
  const comparisonQuestions = useMemo(
    () => questions.filter((q) => q.type === "comparison_choice"),
    [questions]
  )

  function handleExport() {
    downloadSubmissionsExcel({
      projectName,
      questions,
      submissions,
    })
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Responses
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {valid.length} valid · {fake.length} flagged fake ·{" "}
            {submissions.length} total
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Z-score flags fakes. They are removed from charts, tables, and the
            Valid Excel sheet.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={handleExport}
          disabled={submissions.length === 0}
        >
          Export Excel
        </Button>
      </div>

      {fake.length > 0 ? (
        <Alert className="mb-5 border-destructive/40 bg-destructive/10">
          <AlertDescription>
            {fake.length} submission{fake.length === 1 ? "" : "s"} flagged as
            fake by z-score and kept out of your actual results. Review them in
            the Flagged fake tab.
          </AlertDescription>
        </Alert>
      ) : null}

      {submissions.length === 0 ? (
        <div className="surface rounded-lg px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No responses yet. Share the form link, invite friends, or embed to
            start collecting.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="insights" className="gap-4">
          <TabsList
            variant="line"
            className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
          >
            <TabsTrigger
              value="insights"
              className="rounded-none px-3 pb-2.5 pt-0"
            >
              Insights
            </TabsTrigger>
            <TabsTrigger
              value="table"
              className="rounded-none px-3 pb-2.5 pt-0"
            >
              Table
              <span className="ml-1.5 text-muted-foreground">{valid.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="flagged"
              className="rounded-none px-3 pb-2.5 pt-0"
            >
              Flagged fake
              <span className="ml-1.5 text-muted-foreground">{fake.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="grouped"
              className="rounded-none px-3 pb-2.5 pt-0"
            >
              By question
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="mt-4">
            <ResponseCharts questions={questions} submissions={submissions} />
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <SubmissionsTable
              questions={questions}
              submissions={valid}
              emptyLabel="No valid submissions yet."
              variant="valid"
            />
          </TabsContent>

          <TabsContent value="flagged" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Flagged by z-score (and reinforcing signals). Excluded from valid
              output, charts, and the main Excel sheet.
            </p>
            <SubmissionsTable
              questions={questions}
              submissions={fake}
              emptyLabel="No flagged submissions."
              variant="fake"
            />
          </TabsContent>

          <TabsContent value="grouped" className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Charts use valid responses only ({valid.length}).
            </p>
            {comparisonQuestions.map((question) => (
              <ComparisonResults
                key={question.id}
                question={question}
                submissions={valid}
              />
            ))}
            {aggregates.length === 0 && comparisonQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add questions to see grouped response breakdowns.
              </p>
            ) : (
              aggregates
                .filter(
                  (aggregate) =>
                    aggregate.question.type !== "comparison_choice"
                )
                .map((aggregate) => (
                  <QuestionGroupCard
                    key={aggregate.question.id}
                    aggregate={aggregate}
                  />
                ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function QuestionGroupCard({ aggregate }: { aggregate: QuestionAggregate }) {
  const {
    question,
    kind,
    responseCount,
    emptyCount,
    buckets,
    numeric,
    textSamples,
  } = aggregate
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count))

  return (
    <div className="surface rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{question.prompt}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {questionTypeLabel(question.type)} · {responseCount} answered
            {emptyCount > 0 ? ` · ${emptyCount} skipped` : ""}
          </p>
        </div>
        <Badge variant="secondary">{kind}</Badge>
      </div>

      {responseCount === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No answers yet.</p>
      ) : null}

      {numeric ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Min" value={formatNumber(numeric.min)} />
          <Stat label="Max" value={formatNumber(numeric.max)} />
          <Stat label="Average" value={formatNumber(numeric.avg)} />
          <Stat label="Median" value={formatNumber(numeric.median)} />
        </div>
      ) : null}

      {(kind === "choice" || kind === "boolean" || kind === "numeric") &&
      buckets.length > 0 ? (
        <div className="mt-4 space-y-2">
          {buckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{bucket.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {bucket.count} ({bucket.percent}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-sm bg-[var(--brand-signal)] transition-all"
                  style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {(kind === "text" || kind === "other") && textSamples.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {textSamples.map((sample) => (
            <li
              key={sample.value}
              className="rounded-lg bg-muted/50 px-3 py-2 text-sm"
            >
              <p className="whitespace-pre-wrap break-words">{sample.value}</p>
              {sample.count > 1 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Appears {sample.count} times
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  )
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}
