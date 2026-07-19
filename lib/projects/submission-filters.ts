import type { FraudStatus, Submission } from "@/lib/db/schema"

/** Flagged or rejected — excluded from main analytics and Excel export. */
export function isFakeSubmission(submission: Submission): boolean {
  const status = (submission.fraudStatus ?? "") as FraudStatus | string
  if (status === "flagged" || status === "rejected") return true
  return submission.flagStatus === "flagged"
}

/** Valid output rows (includes insufficient_data and normal). */
export function isValidSubmission(submission: Submission): boolean {
  return !isFakeSubmission(submission)
}

export function splitSubmissions(submissions: Submission[]) {
  const valid: Submission[] = []
  const fake: Submission[] = []
  for (const row of submissions) {
    if (isFakeSubmission(row)) fake.push(row)
    else valid.push(row)
  }
  return { valid, fake }
}
