export const SESSION_COOKIE = "myform_session"

export function hasSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return false
  return cookieHeader
    .split(";")
    .some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`))
}
