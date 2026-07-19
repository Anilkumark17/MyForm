"use server"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createSession, destroySession, getSessionUser } from "@/lib/auth/session"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

const credentialsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120).optional(),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
})

export type AuthState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return {
      error: "Check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, email, password } = parsed.data
  if (!name) {
    return { error: "Name is required." }
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (existing) {
    return { error: "An account with this email already exists." }
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: email.toLowerCase(),
      passwordHash,
    })
    .returning({ id: users.id })

  await createSession(user.id)
  redirect("/dashboard")
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return {
      error: "Check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { email, password } = parsed.data
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  if (!user) {
    return { error: "Invalid email or password." }
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return { error: "Invalid email or password." }
  }

  await createSession(user.id)
  redirect("/dashboard")
}

export async function signOut() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }
  await destroySession()
  redirect("/")
}
