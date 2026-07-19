/** Accounts with unlimited projects and AI generations. */
export const UNLIMITED_ACCESS_EMAILS = [
  "anilkondeboina@gmail.com",
  "anilkumarkondeboina@gmail.com",
] as const

/** Inbox that receives access requests when free limits are hit. */
export const ACCESS_REQUEST_EMAIL = "anilkumarkondeboina@gmail.com"

/** Free-tier AI question generations per user. */
export const FREE_GENERATION_LIMIT = 4

/** Free-tier projects per user. */
export const FREE_PROJECT_LIMIT = 2

export function hasUnlimitedAccess(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return UNLIMITED_ACCESS_EMAILS.some((item) => item === normalized)
}

export function getRemainingGenerations(
  email: string,
  generationCount: number
): number | null {
  if (hasUnlimitedAccess(email)) return null
  return Math.max(0, FREE_GENERATION_LIMIT - generationCount)
}

export function isGenerationLimitReached(
  email: string,
  generationCount: number
): boolean {
  if (hasUnlimitedAccess(email)) return false
  return generationCount >= FREE_GENERATION_LIMIT
}

export function getRemainingProjects(
  email: string,
  projectCount: number
): number | null {
  if (hasUnlimitedAccess(email)) return null
  return Math.max(0, FREE_PROJECT_LIMIT - projectCount)
}

export function isProjectLimitReached(
  email: string,
  projectCount: number
): boolean {
  if (hasUnlimitedAccess(email)) return false
  return projectCount >= FREE_PROJECT_LIMIT
}
