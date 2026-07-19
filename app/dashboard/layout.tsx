import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/layout/dashboard-shell"
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

  return (
    <DashboardShell userName={user.name} userEmail={user.email}>
      {children}
    </DashboardShell>
  )
}
