import { NextResponse } from "next/server"
import { z } from "zod"

import { processSubmission } from "@/lib/fraud/process-submission"

const bodySchema = z.object({
  formId: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  totalCompletionTimeMs: z.number().nonnegative(),
  perFieldTimeMs: z.record(z.string(), z.number()).default({}),
  honeypotFieldFilled: z.boolean().default(false),
  source: z.string().max(255).optional().nullable(),
})

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission payload.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const result = await processSubmission(parsed.data)
    return NextResponse.json({
      id: result.submission.id,
      // Intentionally omit fraud details from public clients in production UX;
      // kept here for dashboard debugging of the API. Public form ignores these.
      trustScore: result.submission.trustScore,
      flagStatus: result.submission.flagStatus,
      fraudStatus: result.fraudStatus,
      zScore: result.zScore,
      flaggedImmediately: result.flaggedImmediately,
      baselineUsed: result.baselineUsed,
      zScores: result.zScores,
      reasons: result.reasons,
      scoringDetails: result.scoringDetails,
      createdAt: result.submission.createdAt,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process submission."
    const status = message === "Form not found." ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
