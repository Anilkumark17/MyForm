import { desc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  getAccessibleProject,
  listAccessibleProjects,
} from "@/lib/collab/access"
import { requireUser } from "@/lib/auth/session"

export async function getUserProjects() {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const rows = await listAccessibleProjects(user.id)
  return rows.map((row) => ({
    ...row.project,
    accessRole: row.role,
  }))
}

export async function getProjectById(projectId: string) {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const access = await getAccessibleProject(projectId, user.id)
  if (!access) return null

  return {
    ...access.project,
    accessRole: access.role === "owner" ? ("owner" as const) : ("shared" as const),
  }
}
