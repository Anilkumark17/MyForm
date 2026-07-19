import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { projectCollaborators, projects } from "@/lib/db/schema"

export type ProjectAccess = {
  project: typeof projects.$inferSelect
  role: "owner" | "editor"
}

export async function getAccessibleProject(
  projectId: string,
  userId: string
): Promise<ProjectAccess | null> {
  const [owned] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  if (owned) {
    return { project: owned, role: "owner" }
  }

  const [collab] = await db
    .select({
      project: projects,
    })
    .from(projectCollaborators)
    .innerJoin(projects, eq(projectCollaborators.projectId, projects.id))
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      )
    )
    .limit(1)

  if (!collab) return null

  return {
    project: collab.project,
    role: "editor",
  }
}

export async function userCanAccessProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const access = await getAccessibleProject(projectId, userId)
  return Boolean(access)
}

/** Owned + shared projects for dashboard listing. */
export async function listAccessibleProjects(userId: string) {
  const owned = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))

  const sharedRows = await db
    .select({ project: projects })
    .from(projectCollaborators)
    .innerJoin(projects, eq(projectCollaborators.projectId, projects.id))
    .where(eq(projectCollaborators.userId, userId))
    .orderBy(desc(projects.updatedAt))

  const map = new Map<
    string,
    { project: typeof projects.$inferSelect; role: "owner" | "shared" }
  >()

  for (const project of owned) {
    map.set(project.id, { project, role: "owner" })
  }
  for (const row of sharedRows) {
    if (!map.has(row.project.id)) {
      map.set(row.project.id, { project: row.project, role: "shared" })
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.project.updatedAt.getTime() - a.project.updatedAt.getTime()
  )
}
