import Link from "next/link"

import { DashboardInvitations } from "@/components/dashboard/dashboard-invitations"
import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getAccountUsage } from "@/lib/auth/account-usage"
import { getSessionUser } from "@/lib/auth/session"
import { getInvitationsForUserEmail } from "@/lib/projects/invitations"
import { getUserProjects } from "@/lib/projects/queries"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const user = await getSessionUser()
  const [projects, usage, invitations] = await Promise.all([
    getUserProjects(),
    user ? getAccountUsage(user.id) : Promise.resolve(null),
    user
      ? getInvitationsForUserEmail(user.email)
      : Promise.resolve([]),
  ])

  const firstName = user?.name?.split(" ")[0]
  const atProjectLimit =
    !usage?.unlimited && (usage?.projects.remaining ?? 0) === 0

  return (
    <div>
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : "Projects"}
        description={
          usage?.unlimited
            ? "Create a project, invite collaborators, and edit questions together in real time."
            : `Free plan: ${usage?.projects.used ?? 0} of ${usage?.projects.limit ?? 2} projects · ${usage?.generations.remaining ?? 0} of ${usage?.generations.limit ?? 4} AI generations left.`
        }
        actions={
          atProjectLimit ? (
            <span
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-9 cursor-not-allowed px-3.5 opacity-60"
              )}
              title="Project limit reached"
            >
              Limit reached
            </span>
          ) : (
            <Link
              href="/dashboard/projects/new"
              className={cn(buttonVariants({ size: "lg" }), "h-9 px-3.5")}
            >
              New project
            </Link>
          )
        }
      />

      <div className="mt-8">
        <DashboardInvitations invitations={invitations} />

        {projects.length === 0 ? (
          <div className="surface rounded-lg px-6 py-14 text-center">
            <p className="font-heading text-lg font-semibold">No projects yet</p>
            <p className="prose-muted mx-auto mt-2 max-w-md">
              Start with a name, or accept an invite to collaborate on a shared
              project.
            </p>
            <Link
              href="/dashboard/projects/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-6 h-9 px-3.5"
              )}
            >
              Create project
            </Link>
          </div>
        ) : (
          <ul className="surface divide-y divide-border overflow-hidden rounded-lg">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/60"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {project.name}
                      </p>
                      {project.accessRole === "shared" ? (
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Shared
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {project.icp?.trim() || "ICP not set"}
                      {" · "}
                      {project.objectives?.trim()
                        ? "Objectives set"
                        : "Objectives not set"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
