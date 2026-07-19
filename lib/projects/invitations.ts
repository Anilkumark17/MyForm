"use server"

import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import { db } from "@/lib/db"
import {
  invitations,
  projectCollaborators,
  projects,
  users,
} from "@/lib/db/schema"

const inviteSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().trim().email("Enter a valid email"),
})

export type InviteFormState = {
  error?: string
  success?: string
}

async function getOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)
  return project ?? null
}

export async function inviteFriend(
  _prev: InviteFormState,
  formData: FormData
): Promise<InviteFormState> {
  const user = await requireUser()
  if (!user) {
    return { error: "Please sign in." }
  }

  const parsed = inviteSchema.safeParse({
    projectId: formData.get("projectId"),
    email: formData.get("email"),
  })

  if (!parsed.success) {
    return { error: "Enter a valid email address." }
  }

  const email = parsed.data.email.toLowerCase()
  if (email === user.email.toLowerCase()) {
    return { error: "You can’t invite yourself." }
  }

  const project = await getOwnedProject(parsed.data.projectId, user.id)
  if (!project) {
    return { error: "Project not found." }
  }

  const [existing] = await db
    .select({ id: invitations.id, status: invitations.status })
    .from(invitations)
    .where(
      and(
        eq(invitations.projectId, project.id),
        eq(invitations.inviteeEmail, email),
        eq(invitations.status, "pending")
      )
    )
    .limit(1)

  if (existing) {
    return { error: "That friend already has a pending invite." }
  }

  await db.insert(invitations).values({
    projectId: project.id,
    inviterId: user.id,
    inviteeEmail: email,
    status: "pending",
  })

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/projects/${project.id}`)
  return { success: `Invite sent to ${email}. They’ll see it on their dashboard.` }
}

export async function respondToInvitation(
  invitationId: string,
  decision: "accepted" | "declined"
): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!user) {
    return { error: "Please sign in." }
  }

  const [invite] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.inviteeEmail, user.email.toLowerCase()),
        eq(invitations.status, "pending")
      )
    )
    .limit(1)

  if (!invite) {
    return { error: "Invitation not found." }
  }

  await db
    .update(invitations)
    .set({
      status: decision,
      respondedAt: new Date(),
    })
    .where(eq(invitations.id, invitationId))

  if (decision === "accepted") {
    await db
      .insert(projectCollaborators)
      .values({
        projectId: invite.projectId,
        userId: user.id,
        role: "editor",
      })
      .onConflictDoNothing()
  }

  revalidatePath("/dashboard")
  revalidatePath(`/dashboard/projects/${invite.projectId}`)
  return {}
}

export async function getMyInvitations() {
  const user = await requireUser()
  if (!user) return []

  return db
    .select({
      id: invitations.id,
      status: invitations.status,
      createdAt: invitations.createdAt,
      respondedAt: invitations.respondedAt,
      projectId: projects.id,
      projectName: projects.name,
      inviterName: users.name,
      inviterEmail: users.email,
    })
    .from(invitations)
    .innerJoin(projects, eq(invitations.projectId, projects.id))
    .innerJoin(users, eq(invitations.inviterId, users.id))
    .where(eq(invitations.inviteeEmail, user.email.toLowerCase()))
    .orderBy(desc(invitations.createdAt))
}

/** Case-insensitive match for invitee email. */
export async function getInvitationsForUserEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return db
    .select({
      id: invitations.id,
      status: invitations.status,
      createdAt: invitations.createdAt,
      respondedAt: invitations.respondedAt,
      projectId: projects.id,
      projectName: projects.name,
      inviterName: users.name,
      inviterEmail: users.email,
    })
    .from(invitations)
    .innerJoin(projects, eq(invitations.projectId, projects.id))
    .innerJoin(users, eq(invitations.inviterId, users.id))
    .where(eq(invitations.inviteeEmail, normalized))
    .orderBy(desc(invitations.createdAt))
}

export async function getProjectInvitations(projectId: string) {
  const user = await requireUser()
  if (!user) return []

  const project = await getOwnedProject(projectId, user.id)
  if (!project) return []

  return db
    .select({
      id: invitations.id,
      inviteeEmail: invitations.inviteeEmail,
      status: invitations.status,
      createdAt: invitations.createdAt,
      respondedAt: invitations.respondedAt,
    })
    .from(invitations)
    .where(eq(invitations.projectId, projectId))
    .orderBy(desc(invitations.createdAt))
}
