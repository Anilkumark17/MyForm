"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth/actions"

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline" size="sm" className="h-8">
        Sign out
      </Button>
    </form>
  )
}
