import { count, eq } from "drizzle-orm"

import {
  FREE_GENERATION_LIMIT,
  FREE_PROJECT_LIMIT,
  getRemainingGenerations,
  getRemainingProjects,
  hasUnlimitedAccess,
} from "@/lib/auth/account-limits"
import { db } from "@/lib/db"
import { projects, users } from "@/lib/db/schema"

export type AccountUsage = {
  unlimited: boolean
  generations: {
    used: number
    limit: number
    remaining: number | null
  }
  projects: {
    used: number
    limit: number
    remaining: number | null
  }
}

export async function getAccountUsage(
  userId: string
): Promise<AccountUsage | null> {
  const [row] = await db
    .select({
      email: users.email,
      generationCount: users.generationCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) return null

  const [projectRow] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.userId, userId))

  const projectCount = Number(projectRow?.value ?? 0)
  const unlimited = hasUnlimitedAccess(row.email)

  return {
    unlimited,
    generations: {
      used: row.generationCount,
      limit: FREE_GENERATION_LIMIT,
      remaining: getRemainingGenerations(row.email, row.generationCount),
    },
    projects: {
      used: projectCount,
      limit: FREE_PROJECT_LIMIT,
      remaining: getRemainingProjects(row.email, projectCount),
    },
  }
}
