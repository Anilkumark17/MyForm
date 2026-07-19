import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getGenerationUsage } from "@/lib/auth/generation-usage"
import { getSessionUser } from "@/lib/auth/session"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  const usage = await getGenerationUsage(user.id)

  return (
    <DashboardShell
      userName={user.name}
      userEmail={user.email}
      generationsRemaining={
        usage?.unlimited ? null : (usage?.remaining ?? 0)
      }
      generationsLimit={usage?.limit ?? 4}
      generationsUnlimited={usage?.unlimited ?? false}
    >
      {children}
    </DashboardShell>
  )
}
