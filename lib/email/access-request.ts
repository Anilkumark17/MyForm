import { eq } from "drizzle-orm"

import { ACCESS_REQUEST_EMAIL } from "@/lib/auth/account-limits"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

type AccessRequestReason = "generations" | "projects"

type NotifyAccessRequestInput = {
  userId: string
  userName: string
  userEmail: string
  reason: AccessRequestReason
}

/**
 * Emails the admin once when a free-tier user hits a limit.
 * Requires RESEND_API_KEY (optional RESEND_FROM_EMAIL).
 */
export async function notifyAccessRequest(
  input: NotifyAccessRequestInput
): Promise<{ sent: boolean }> {
  const [account] = await db
    .select({
      accessRequestSentAt: users.accessRequestSentAt,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!account) {
    return { sent: false }
  }

  // Avoid spamming the admin on every blocked click.
  if (account.accessRequestSentAt) {
    return { sent: false }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Myform <onboarding@resend.dev>"

  const reasonLabel =
    input.reason === "generations"
      ? "AI question generation limit (4)"
      : "project limit (2)"

  const subject = `Myform access request — ${input.userEmail}`
  const text = [
    "A user has reached their free Myform limit and is requesting access.",
    "",
    `Name: ${input.userName}`,
    `Email: ${input.userEmail}`,
    `Limit hit: ${reasonLabel}`,
    "",
    "Please grant them expanded access if appropriate.",
  ].join("\n")

  let sent = false

  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [ACCESS_REQUEST_EMAIL],
          subject,
          text,
        }),
      })
      sent = response.ok
      if (!response.ok) {
        console.error(
          "Access request email failed:",
          response.status,
          await response.text()
        )
      }
    } catch (error) {
      console.error("Access request email error:", error)
    }
  } else {
    console.warn(
      "RESEND_API_KEY is not set; access request email was not sent.",
      { to: ACCESS_REQUEST_EMAIL, subject }
    )
  }

  // Mark once when delivered, or when mail isn't configured (avoid log spam).
  // If Resend is configured but fails, leave unset so the next attempt can retry.
  if (sent || !apiKey) {
    await db
      .update(users)
      .set({ accessRequestSentAt: new Date() })
      .where(eq(users.id, input.userId))
  }

  return { sent }
}
