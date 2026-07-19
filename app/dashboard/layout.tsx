import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getAccountUsage } from "@/lib/auth/account-usage"
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

  const usage = await getAccountUsage(user.id)

  return (
    <DashboardShell
      userName={user.name}
      userEmail={user.email}
      generationsRemaining={
        usage?.unlimited ? null : (usage?.generations.remaining ?? 0)
      }
      generationsLimit={usage?.generations.limit ?? 4}
      projectsRemaining={
        usage?.unlimited ? null : (usage?.projects.remaining ?? 0)
      }
      projectsLimit={usage?.projects.limit ?? 2}
      projectsUsed={usage?.projects.used ?? 0}
      unlimited={usage?.unlimited ?? false}
    >
      {children}
    </DashboardShell>
  )
}
