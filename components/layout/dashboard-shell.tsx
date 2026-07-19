"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { SignOutButton } from "@/components/dashboard/sign-out-button"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Projects", match: "exact" as const },
  {
    href: "/dashboard/projects/new",
    label: "New project",
    match: "prefix" as const,
  },
]

type DashboardShellProps = {
  userName: string
  userEmail: string
  generationsRemaining: number | null
  generationsLimit: number
  generationsUnlimited: boolean
  children: React.ReactNode
}

export function DashboardShell({
  userName,
  userEmail,
  generationsRemaining,
  generationsLimit,
  generationsUnlimited,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()

  const generationLabel = generationsUnlimited
    ? "Unlimited generations"
    : `${generationsRemaining ?? 0} of ${generationsLimit} left`

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="page flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="font-heading text-lg font-semibold tracking-tight"
            >
              Myform
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => {
                const active =
                  item.match === "exact"
                    ? pathname === item.href
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums",
                generationsUnlimited
                  ? "bg-secondary text-muted-foreground"
                  : generationsRemaining === 0
                    ? "bg-destructive/15 text-destructive"
                    : "bg-secondary text-foreground"
              )}
              title="AI question generations remaining"
            >
              {generationLabel}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="page py-8 sm:py-10">{children}</main>
    </div>
  )
}
