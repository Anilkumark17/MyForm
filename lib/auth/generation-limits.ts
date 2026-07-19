/** Unlimited generations for this account. */
export const UNLIMITED_GENERATION_EMAIL = "anilkondeboina@gmail.com"

/** Free-tier AI question generations per user. */
export const FREE_GENERATION_LIMIT = 4

export function hasUnlimitedGenerations(email: string): boolean {
  return email.trim().toLowerCase() === UNLIMITED_GENERATION_EMAIL
}

export function getRemainingGenerations(
  email: string,
  generationCount: number
): number | null {
  if (hasUnlimitedGenerations(email)) return null
  return Math.max(0, FREE_GENERATION_LIMIT - generationCount)
}

export function isGenerationLimitReached(
  email: string,
  generationCount: number
): boolean {
  if (hasUnlimitedGenerations(email)) return false
  return generationCount >= FREE_GENERATION_LIMIT
}
