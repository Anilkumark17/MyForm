import * as XLSX from "xlsx"

import type { Submission } from "@/lib/db/schema"
import { formatComparisonForList } from "@/lib/projects/comparison-analytics"
import { formatAnswerValue } from "@/lib/projects/response-analytics"
import { isFakeSubmission } from "@/lib/projects/submission-filters"
import type { SurveyQuestion } from "@/lib/survey/questions"

function rowFromSubmission(
  submission: Submission,
  questions: SurveyQuestion[],
  index: number
): Record<string, string | number> {
  const row: Record<string, string | number> = {
    "#": index,
    Submitted: new Date(submission.createdAt).toISOString(),
    "Duration (s)": Number((submission.totalCompletionTimeMs / 1000).toFixed(2)),
    Status: submission.fraudStatus ?? submission.flagStatus,
    "Trust score": submission.trustScore,
    "Z-score":
      submission.zScore == null ? "" : Number(submission.zScore.toFixed(3)),
    Source: submission.source ?? "",
  }

  for (const question of questions) {
    const key = question.prompt.slice(0, 80) || question.id
    const raw = submission.answers?.[question.id]
    row[key] =
      question.type === "comparison_choice"
        ? formatComparisonForList(question, raw)
        : formatAnswerValue(raw)
  }

  return row
}

export function downloadSubmissionsExcel(input: {
  projectName: string
  questions: SurveyQuestion[]
  submissions: Submission[]
}) {
  const valid = input.submissions.filter((row) => !isFakeSubmission(row))
  const fake = input.submissions.filter((row) => isFakeSubmission(row))

  const workbook = XLSX.utils.book_new()

  const validRows = valid.map((submission, index) =>
    rowFromSubmission(submission, input.questions, index + 1)
  )
  const validSheet = XLSX.utils.json_to_sheet(
    validRows.length
      ? validRows
      : [{ Note: "No valid submissions to export." }]
  )
  XLSX.utils.book_append_sheet(workbook, validSheet, "Valid responses")

  if (fake.length > 0) {
    const fakeRows = fake.map((submission, index) =>
      rowFromSubmission(submission, input.questions, index + 1)
    )
    const fakeSheet = XLSX.utils.json_to_sheet(fakeRows)
    XLSX.utils.book_append_sheet(workbook, fakeSheet, "Flagged fake")
  }

  const safeName = input.projectName
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
  const filename = `${safeName || "myform"}-responses.xlsx`
  XLSX.writeFile(workbook, filename)
}
