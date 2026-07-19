"use server"

import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireUser } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { notifications, projects } from "@/lib/db/schema"

export async function getUnreadNotifications(limit = 20) {
  const user = await requireUser()
  if (!user) return []

  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      type: notifications.type,
      read: notifications.read,
      createdAt: notifications.createdAt,
      projectId: notifications.projectId,
      projectName: projects.name,
    })
    .from(notifications)
    .leftJoin(projects, eq(notifications.projectId, projects.id))
    .where(
      and(eq(notifications.userId, user.id), eq(notifications.read, false))
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getRecentNotifications(limit = 30) {
  const user = await requireUser()
  if (!user) return []

  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      type: notifications.type,
      read: notifications.read,
      createdAt: notifications.createdAt,
      projectId: notifications.projectId,
      projectName: projects.name,
    })
    .from(notifications)
    .leftJoin(projects, eq(notifications.projectId, projects.id))
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireUser()
  if (!user) return

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.id)
      )
    )

  revalidatePath("/dashboard")
}

export async function markAllNotificationsRead() {
  const user = await requireUser()
  if (!user) return

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.userId, user.id), eq(notifications.read, false))
    )

  revalidatePath("/dashboard")
}
