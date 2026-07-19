import { getAccessibleProject } from "@/lib/collab/access"

/** Shared helper for server actions that need owner or collaborator access. */
export async function requireProjectAccess(projectId: string, userId: string) {
  return getAccessibleProject(projectId, userId)
}
