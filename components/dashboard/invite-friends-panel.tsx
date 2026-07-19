"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  inviteFriend,
  type InviteFormState,
} from "@/lib/projects/invitations"

const initialState: InviteFormState = {}

type ProjectInvite = {
  id: string
  inviteeEmail: string
  status: string
  createdAt: Date
}

type InviteFriendsPanelProps = {
  projectId: string
  invitations: ProjectInvite[]
}

export function InviteFriendsPanel({
  projectId,
  invitations,
}: InviteFriendsPanelProps) {
  const [state, formAction, pending] = useActionState(inviteFriend, initialState)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Invite friends
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite by email. They’ll see the invitation on their Myform dashboard
          when they sign in with that address.
        </p>
      </div>

      <form action={formAction} className="surface space-y-4 rounded-lg p-5">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Friend&apos;s email</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="friend@company.com"
              className="h-10"
            />
            <Button
              type="submit"
              size="lg"
              className="h-10 shrink-0"
              disabled={pending}
            >
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <Alert>
            <AlertDescription>{state.success}</AlertDescription>
          </Alert>
        ) : null}
      </form>

      <div>
        <h3 className="text-sm font-medium">Invites for this project</h3>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No invitations sent yet.
          </p>
        ) : (
          <ul className="surface mt-3 divide-y divide-border overflow-hidden rounded-lg">
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {invite.inviteeEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invite.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Badge
                  variant={
                    invite.status === "accepted"
                      ? "secondary"
                      : invite.status === "declined"
                        ? "outline"
                        : "default"
                  }
                >
                  {invite.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
