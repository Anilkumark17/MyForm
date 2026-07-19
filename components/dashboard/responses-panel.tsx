"use client"

import { useMemo, useState } from "react"

import { ComparisonResults } from "@/components/dashboard/comparison-results"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Submission } from "@/lib/db/schema"
import { formatComparisonForList } from "@/lib/projects/comparison-analytics"
import {
  buildQuestionAggregates,
  formatAnswerValue,
  questionTypeLabel,
  type QuestionAggregate,
} from "@/lib/projects/response-analytics"
import type { SurveyQuestion } from "@/lib/survey/questions"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

type ResponsesPanelProps = {
  questions: SurveyQuestion[]
  submissions: Submission[]
}

export function ResponsesPanel({
  questions,
  submissions,
}: ResponsesPanelProps) {
  const aggregates = useMemo(
    () => buildQuestionAggregates(questions, submissions),
    [questions, submissions]
  )
  const comparisonQuestions = useMemo(
    () => questions.filter((q) => q.type === "comparison_choice"),
    [questions]
  )

  const cleanCount = submissions.filter((row) => row.flagStatus === "clean").length
  const flaggedCount = submissions.length - cleanCount

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Responses
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {submissions.length} total · {cleanCount} clean · {flaggedCount}{" "}
          flagged
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="surface rounded-lg px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No responses yet. Share the form link or embed to start collecting.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="grouped" className="gap-4">
          <TabsList variant="line" className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="grouped" className="rounded-none px-3 pb-2.5 pt-0">
              By question
            </TabsTrigger>
            <TabsTrigger value="individual" className="rounded-none px-3 pb-2.5 pt-0">
              Individual
            </TabsTrigger>
          </TabsList>

            <TabsContent value="grouped" className="mt-4 space-y-4">
              {comparisonQuestions.map((question) => (
                <ComparisonResults
                  key={question.id}
                  question={question}
                  submissions={submissions}
                />
              ))}
              {aggregates.length === 0 && comparisonQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add questions to see grouped response breakdowns.
                </p>
              ) : (
                aggregates
                  .filter((aggregate) => aggregate.question.type !== "comparison_choice")
                  .map((aggregate) => (
                    <QuestionGroupCard
                      key={aggregate.question.id}
                      aggregate={aggregate}
                    />
                  ))
              )}
            </TabsContent>

          <TabsContent value="individual" className="mt-0 space-y-3">
            {submissions.map((submission, index) => (
              <IndividualResponseCard
                key={submission.id}
                submission={submission}
                questions={questions}
                index={submissions.length - index}
                defaultOpen={index === 0}
              />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function QuestionGroupCard({ aggregate }: { aggregate: QuestionAggregate }) {
  const { question, kind, responseCount, emptyCount, buckets, numeric, textSamples } =
    aggregate
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

function IndividualResponseCard({
  submission,
  questions,
  index,
  defaultOpen,
}: {
  submission: Submission
  questions: SurveyQuestion[]
  index: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="surface rounded-lg">
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">Response #{index}</p>
            <p className="text-xs text-muted-foreground">
              {submission.createdAt.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              · {(submission.totalCompletionTimeMs / 1000).toFixed(1)}s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                submission.fraudStatus === "rejected" ||
                submission.fraudStatus === "flagged" ||
                submission.flagStatus === "flagged"
                  ? "destructive"
                  : "secondary"
              }
            >
              {submission.fraudStatus ?? submission.flagStatus}
            </Badge>
            <Badge variant="outline">Trust {submission.trustScore}</Badge>
            {submission.zScore != null ? (
              <Badge variant="outline">z={submission.zScore.toFixed(2)}</Badge>
            ) : null}
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border px-4 py-3">
          <div className="space-y-3">
            {submission.scoringDetails &&
            typeof submission.scoringDetails === "object" &&
            "summary" in submission.scoringDetails ? (
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Trust scoring</p>
                <p className="mt-1">
                  {String(
                    (submission.scoringDetails as { summary?: string }).summary
                  )}
                </p>
              </div>
            ) : null}
            {questions.map((question) => (
              <div key={question.id} className="text-sm">
                <p className="text-muted-foreground">{question.prompt}</p>
                <p className="mt-1 font-medium whitespace-pre-wrap break-words">
                  {question.type === "comparison_choice"
                    ? formatComparisonForList(
                        question,
                        submission.answers?.[question.id]
                      )
                    : formatAnswerValue(submission.answers?.[question.id])}
                </p>
              </div>
            ))}
            {questions.length === 0 ? (
              <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">
                {JSON.stringify(submission.answers, null, 2)}
              </pre>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
