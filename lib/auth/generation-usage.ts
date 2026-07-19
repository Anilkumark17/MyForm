import { eq } from "drizzle-orm"

import {
  FREE_GENERATION_LIMIT,
  getRemainingGenerations,
  hasUnlimitedGenerations,
} from "@/lib/auth/generation-limits"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

export type GenerationUsage = {
  used: number
  limit: number
  remaining: number | null
  unlimited: boolean
}

export async function getGenerationUsage(
  userId: string
): Promise<GenerationUsage | null> {
  const [row] = await db
    .select({
      email: users.email,
      generationCount: users.generationCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) return null

  const unlimited = hasUnlimitedGenerations(row.email)
  return {
    used: row.generationCount,
    limit: FREE_GENERATION_LIMIT,
    remaining: getRemainingGenerations(row.email, row.generationCount),
    unlimited,
  }
}
