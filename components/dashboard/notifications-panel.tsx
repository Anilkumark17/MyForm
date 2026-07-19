"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/queries"

export type DashboardNotification = {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: Date
  projectId: string | null
  projectName: string | null
}

type NotificationsPanelProps = {
  notifications: DashboardNotification[]
}

export function NotificationsPanel({
  notifications,
}: NotificationsPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (notifications.length === 0) return null

  const unread = notifications.filter((n) => !n.read).length

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Alerts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fake submissions flagged by z-score are removed from valid output.
          </p>
        </div>
        {unread > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead()
                router.refresh()
              })
            }
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      <ul className="surface mt-4 divide-y divide-border overflow-hidden rounded-lg">
        {notifications.slice(0, 8).map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                {!item.read ? <Badge variant="destructive">New</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.projectId ? (
                <Link
                  href={`/dashboard/projects/${item.projectId}?tab=responses`}
                  className="text-xs font-medium text-[var(--brand-signal)] hover:underline"
                  onClick={() => {
                    if (!item.read) {
                      startTransition(async () => {
                        await markNotificationRead(item.id)
                      })
                    }
                  }}
                >
                  Review
                </Link>
              ) : null}
              {!item.read ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await markNotificationRead(item.id)
                      router.refresh()
                    })
                  }
                >
                  Dismiss
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
