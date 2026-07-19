import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { SignJWT, jwtVerify } from "jose"

import { SESSION_COOKIE } from "@/lib/auth/constants"
import { db } from "@/lib/db"
import { sessions, users } from "@/lib/db/schema"

const SESSION_DAYS = 14

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("AUTH_SECRET is not set")
  }
  return new TextEncoder().encode(secret)
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const token = crypto.randomUUID()

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  })

  const jwt = await new SignJWT({ sub: userId, sid: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(SESSION_COOKIE)?.value

  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, getSecret())
      const token = typeof payload.sid === "string" ? payload.sid : null
      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token))
      }
    } catch {
      // Ignore invalid tokens on logout
    }
  }

  cookieStore.delete(SESSION_COOKIE)
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(SESSION_COOKIE)?.value
  if (!jwt) return null

  try {
    const { payload } = await jwtVerify(jwt, getSecret())
    const userId = typeof payload.sub === "string" ? payload.sub : null
    const token = typeof payload.sid === "string" ? payload.sid : null
    if (!userId || !token) return null

    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, token))
      .limit(1)

    if (!row || row.expiresAt.getTime() < Date.now()) {
      if (row) {
        await db.delete(sessions).where(eq(sessions.token, token))
      }
      cookieStore.delete(SESSION_COOKIE)
      return null
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
    }
  } catch {
    return null
  }
}

export async function requireUser() {
  const user = await getSessionUser()
  if (!user) {
    return null
  }
  return user
}
