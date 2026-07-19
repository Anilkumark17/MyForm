import { and, desc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { projects, submissions } from "@/lib/db/schema"

export async function getProjectSubmissions(projectId: string) {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const [ownedProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1)

  if (!ownedProject) {
    return null
  }

  return db
    .select()
    .from(submissions)
    .where(eq(submissions.formId, projectId))
    .orderBy(desc(submissions.createdAt))
}
