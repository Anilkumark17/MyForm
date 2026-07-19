import { getAccountUsage } from "@/lib/auth/account-usage"

/** @deprecated Prefer `getAccountUsage`. */
export async function getGenerationUsage(userId: string) {
  const usage = await getAccountUsage(userId)
  if (!usage) return null
  return {
    used: usage.generations.used,
    limit: usage.generations.limit,
    remaining: usage.generations.remaining,
    unlimited: usage.unlimited,
  }
}
