/** @deprecated Prefer `@/lib/auth/account-limits`. */
export {
  ACCESS_REQUEST_EMAIL,
  FREE_GENERATION_LIMIT,
  FREE_PROJECT_LIMIT,
  getRemainingGenerations,
  getRemainingProjects,
  hasUnlimitedAccess as hasUnlimitedGenerations,
  isGenerationLimitReached,
  isProjectLimitReached,
  UNLIMITED_ACCESS_EMAILS,
} from "@/lib/auth/account-limits"

export const UNLIMITED_GENERATION_EMAIL = "anilkondeboina@gmail.com"
