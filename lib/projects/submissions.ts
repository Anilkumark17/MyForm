import { desc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { getAccessibleProject } from "@/lib/collab/access"
import { db } from "@/lib/db"
import { submissions } from "@/lib/db/schema"

export async function getProjectSubmissions(projectId: string) {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const access = await getAccessibleProject(projectId, user.id)
  if (!access) {
    return null
  }

  return db
    .select()
    .from(submissions)
    .where(eq(submissions.formId, projectId))
    .orderBy(desc(submissions.createdAt))
}
