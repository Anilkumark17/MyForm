"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { respondToInvitation } from "@/lib/projects/invitations"
import { cn } from "@/lib/utils"

export type DashboardInvitation = {
  id: string
  status: string
  createdAt: Date
  projectId: string
  projectName: string
  inviterName: string
  inviterEmail: string
}

type DashboardInvitationsProps = {
  invitations: DashboardInvitation[]
}

export function DashboardInvitations({
  invitations,
}: DashboardInvitationsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (invitations.length === 0) return null

  const pendingInvites = invitations.filter((row) => row.status === "pending")
  const others = invitations.filter((row) => row.status !== "pending")

  function respond(id: string, decision: "accepted" | "declined") {
    startTransition(async () => {
      const result = await respondToInvitation(id, decision)
      if (!result.error && decision === "accepted") {
        const invite = invitations.find((row) => row.id === id)
        if (invite) {
          router.push(`/dashboard/projects/${invite.projectId}`)
          router.refresh()
          return
        }
      }
      router.refresh()
    })
  }

  return (
    <section className="mb-8">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Invitations
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Accept to join the project and edit questions together in real time.
      </p>

      <ul className="surface mt-4 divide-y divide-border overflow-hidden rounded-lg">
        {pendingInvites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">{invite.projectName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                From {invite.inviterName} ({invite.inviterEmail})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>pending</Badge>
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={pending}
                onClick={() => respond(invite.id, "accepted")}
              >
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={pending}
                onClick={() => respond(invite.id, "declined")}
              >
                Decline
              </Button>
            </div>
          </li>
        ))}

        {others.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">{invite.projectName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                From {invite.inviterName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  invite.status === "accepted" ? "secondary" : "outline"
                }
              >
                {invite.status}
              </Badge>
              {invite.status === "accepted" ? (
                <Link
                  href={`/dashboard/projects/${invite.projectId}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8"
                  )}
                >
                  Open project
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
