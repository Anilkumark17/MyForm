"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Submission } from "@/lib/db/schema"
import { formatComparisonForList } from "@/lib/projects/comparison-analytics"
import { formatAnswerValue } from "@/lib/projects/response-analytics"
import type { SurveyQuestion } from "@/lib/survey/questions"

type SubmissionsTableProps = {
  questions: SurveyQuestion[]
  submissions: Submission[]
  emptyLabel?: string
  variant?: "valid" | "fake"
}

export function SubmissionsTable({
  questions,
  submissions,
  emptyLabel = "No submissions.",
  variant = "valid",
}: SubmissionsTableProps) {
  if (submissions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="surface overflow-hidden rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead className="min-w-[140px]">Submitted</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trust</TableHead>
            {questions.map((question) => (
              <TableHead key={question.id} className="min-w-[160px] max-w-[220px]">
                <span className="line-clamp-2 whitespace-normal">
                  {question.prompt}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission, index) => (
            <TableRow key={submission.id}>
              <TableCell className="tabular-nums text-muted-foreground">
                {submissions.length - index}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {new Date(submission.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell className="tabular-nums">
                {(submission.totalCompletionTimeMs / 1000).toFixed(1)}s
              </TableCell>
              <TableCell>
                <Badge
                  variant={variant === "fake" ? "destructive" : "secondary"}
                >
                  {submission.fraudStatus === "insufficient_data"
                    ? "Baseline"
                    : submission.fraudStatus === "normal"
                      ? "Valid"
                      : (submission.fraudStatus ?? submission.flagStatus)}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {submission.trustScore}
              </TableCell>
              {questions.map((question) => (
                <TableCell
                  key={question.id}
                  className="max-w-[220px] truncate text-xs"
                  title={
                    question.type === "comparison_choice"
                      ? formatComparisonForList(
                          question,
                          submission.answers?.[question.id]
                        )
                      : formatAnswerValue(submission.answers?.[question.id])
                  }
                >
                  {question.type === "comparison_choice"
                    ? formatComparisonForList(
                        question,
                        submission.answers?.[question.id]
                      )
                    : formatAnswerValue(submission.answers?.[question.id])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
