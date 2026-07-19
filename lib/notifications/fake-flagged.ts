import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { projects, users } from "@/lib/db/schema"

type NotifyFakeFlaggedInput = {
  projectId: string
  submissionId: string
  fraudStatus: string
  zScore: number | null
  reasons: string[]
}

/**
 * Notify the project owner in-app (and via Resend when configured)
 * when a submission is flagged/rejected as fake by z-score.
 * Never throws — submission processing must not fail because of alerts.
 */
export async function notifyOwnerFakeFlagged(
  input: NotifyFakeFlaggedInput
): Promise<void> {
  try {
    const [row] = await db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        ownerId: users.id,
        ownerEmail: users.email,
        ownerName: users.name,
      })
      .from(projects)
      .innerJoin(users, eq(projects.userId, users.id))
      .where(eq(projects.id, input.projectId))
      .limit(1)

    if (!row?.ownerId) {
      console.warn("Fake-flag notify skipped: project owner not found", {
        projectId: input.projectId,
      })
      return
    }

    const zLabel =
      input.zScore == null ? "n/a" : input.zScore.toFixed(2)
    const title = `Fake submission flagged on ${row.projectName}`
    const body = [
      `Status: ${input.fraudStatus}`,
      `Z-score: ${zLabel}`,
      input.reasons[0] ?? "Flagged by z-score.",
      "Kept out of your valid response output.",
    ].join(" · ")

    // In-app fake alerts are intentionally not shown on the dashboard.
    // Optional email only when Resend is configured.
    const apiKey = process.env.RESEND_API_KEY?.trim()
    if (!apiKey) return

    const from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "Myform <onboarding@resend.dev>"

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [row.ownerEmail],
        subject: title,
        text: [
          `Hi ${row.ownerName},`,
          "",
          `A submission on "${row.projectName}" was flagged as fake by z-score.`,
          `Status: ${input.fraudStatus}`,
          `Z-score: ${zLabel}`,
          "",
          ...input.reasons.map((r) => `- ${r}`),
          "",
          "This response is excluded from valid analytics and Excel export.",
          "Review it under Responses → Flagged fake.",
        ].join("\n"),
      }),
    })

    if (!response.ok) {
      console.error(
        "Fake-flagged email failed:",
        response.status,
        await response.text()
      )
    }
  } catch (error) {
    console.error("notifyOwnerFakeFlagged failed:", error)
  }
}
