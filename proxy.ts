import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { hasSessionCookie } from "@/lib/auth/constants"

const protectedPrefixes = ["/dashboard"]
const authRoutes = ["/login", "/signup"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const loggedIn = hasSessionCookie(request.headers.get("cookie"))

  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (isProtected && !loggedIn) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthRoute && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/login", "/signup"],
}
