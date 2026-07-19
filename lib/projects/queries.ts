import { and, desc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"

export async function getUserProjects() {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt))
}

export async function getProjectById(projectId: string) {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1)

  return project ?? null
}
