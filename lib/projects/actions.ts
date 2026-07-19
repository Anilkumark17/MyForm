"use server"

import { and, count, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { generateMomTestQuestions } from "@/lib/ai/groq"
import {
  ACCESS_REQUEST_EMAIL,
  FREE_GENERATION_LIMIT,
  FREE_PROJECT_LIMIT,
  isGenerationLimitReached,
  isProjectLimitReached,
} from "@/lib/auth/account-limits"
import { requireUser } from "@/lib/auth/session"
import { getAccessibleProject } from "@/lib/collab/access"
import { acceptQuestionOp } from "@/lib/collab/server"
import { db } from "@/lib/db"
import { projects, users } from "@/lib/db/schema"
import { notifyAccessRequest } from "@/lib/email/access-request"
import type {
  GenerateQuestionsState,
  ProjectFormState,
  SaveQuestionsState,
} from "@/lib/projects/types"
import { normalizeSurveyQuestion } from "@/lib/survey/questions"

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required").max(160),
  icp: z.string().trim().max(4000).optional(),
  objectives: z.string().trim().max(4000).optional(),
})

const projectContextSchema = z.object({
  projectId: z.string().uuid(),
  icp: z
    .string()
    .trim()
    .min(2, "ICP is required to generate better questions")
    .max(4000),
  objectives: z
    .string()
    .trim()
    .min(2, "Objectives are required to generate better questions")
    .max(4000),
})

async function getOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)

  return project ?? null
}

async function getEditableProject(projectId: string, userId: string) {
  const access = await getAccessibleProject(projectId, userId)
  return access?.project ?? null
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    icp: formData.get("icp") || undefined,
    objectives: formData.get("objectives") || undefined,
  })

  if (!parsed.success) {
    return {
      error: "Please enter a project name.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const [projectCountRow] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.userId, user.id))

  const projectCount = Number(projectCountRow?.value ?? 0)

  if (isProjectLimitReached(user.email, projectCount)) {
    const { sent } = await notifyAccessRequest({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      reason: "projects",
    })

    return {
      error: sent
        ? `Your project limit is over (${FREE_PROJECT_LIMIT}). We emailed ${ACCESS_REQUEST_EMAIL} to request access for you.`
        : `Your project limit is over (${FREE_PROJECT_LIMIT}). An access request was recorded for ${ACCESS_REQUEST_EMAIL}.`,
    }
  }

  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      name: parsed.data.name,
      icp: parsed.data.icp || null,
      objectives: parsed.data.objectives || null,
    })
    .returning({ id: projects.id })

  redirect(`/dashboard/projects/${project.id}`)
}

export async function updateProjectContext(
  _prev: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const projectId = String(formData.get("projectId") ?? "")
  const parsed = projectContextSchema.safeParse({
    projectId,
    icp: formData.get("icp"),
    objectives: formData.get("objectives"),
  })

  if (!parsed.success) {
    return {
      error:
        "Add your ICP and survey objectives so we can frame better questions.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const project = await getEditableProject(parsed.data.projectId, user.id)
  if (!project) {
    return { error: "Project not found." }
  }

  await db
    .update(projects)
    .set({
      icp: parsed.data.icp,
      objectives: parsed.data.objectives,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id))

  revalidatePath(`/dashboard/projects/${project.id}`)
  revalidatePath("/dashboard")
  return {}
}

export async function generateProjectQuestions(
  projectId: string
): Promise<GenerateQuestionsState> {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const project = await getEditableProject(projectId, user.id)
  if (!project) {
    return { error: "Project not found." }
  }

  const [account] = await db
    .select({
      email: users.email,
      generationCount: users.generationCount,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!account) {
    return { error: "Account not found." }
  }

  if (isGenerationLimitReached(account.email, account.generationCount)) {
    const { sent } = await notifyAccessRequest({
      userId: user.id,
      userName: user.name,
      userEmail: account.email,
      reason: "generations",
    })

    return {
      error: sent
        ? `Your limit is over. Free accounts get ${FREE_GENERATION_LIMIT} AI generations. We emailed ${ACCESS_REQUEST_EMAIL} to request access for you.`
        : `Your limit is over. Free accounts get ${FREE_GENERATION_LIMIT} AI generations. An access request was recorded for ${ACCESS_REQUEST_EMAIL}.`,
    }
  }

  const icp = project.icp?.trim() ?? ""
  const objectives = project.objectives?.trim() ?? ""

  if (icp.length < 2 || objectives.length < 2) {
    return {
      needsContext: true,
      error:
        "Add your ICP and survey objectives first so we can frame better Mom Test questions.",
    }
  }

  try {
    const questions = await generateMomTestQuestions({
      projectName: project.name,
      icp,
      objectives,
    })

    await acceptQuestionOp({
      projectId: project.id,
      userId: user.id,
      userName: user.name,
      clientId: `generate-${user.id}`,
      baseRevision: project.questionsRevision ?? 0,
      op: { type: "replace_all", questions },
    })

    await db
      .update(users)
      .set({
        generationCount: account.generationCount + 1,
      })
      .where(eq(users.id, user.id))

    revalidatePath(`/dashboard/projects/${project.id}`)
    return { questions }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not generate questions right now.",
    }
  }
}

export async function saveProjectQuestions(
  projectId: string,
  questionsInput: unknown
): Promise<SaveQuestionsState> {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const project = await getEditableProject(projectId, user.id)
  if (!project) {
    return { error: "Project not found." }
  }

  if (!Array.isArray(questionsInput)) {
    return { error: "Invalid questions payload." }
  }

  const questions = questionsInput
    .map((item) => normalizeSurveyQuestion(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      ...item,
      prompt: item.prompt.trim(),
    }))
    .filter((item) => item.prompt.length > 0)

  const accepted = await acceptQuestionOp({
    projectId: project.id,
    userId: user.id,
    userName: user.name,
    clientId: `save-${user.id}`,
    baseRevision: project.questionsRevision ?? 0,
    op: { type: "replace_all", questions },
  })

  if (!accepted.ok) {
    return { error: accepted.error ?? "Could not save questions." }
  }

  revalidatePath(`/dashboard/projects/${project.id}`)
  return { ok: true }
}
