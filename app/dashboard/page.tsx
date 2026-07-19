import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getSessionUser } from "@/lib/auth/session"
import { getUserProjects } from "@/lib/projects/queries"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const [user, projects] = await Promise.all([
    getSessionUser(),
    getUserProjects(),
  ])

  const firstName = user?.name?.split(" ")[0]

  return (
    <div>
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : "Projects"}
        description="Create a project, generate interview questions, embed the form, and review trust scores."
        actions={
          <Link
            href="/dashboard/projects/new"
            className={cn(buttonVariants({ size: "lg" }), "h-9 px-3.5")}
          >
            New project
          </Link>
        }
      />

      <div className="mt-8">
        {projects.length === 0 ? (
          <div className="surface rounded-lg px-6 py-14 text-center">
            <p className="font-heading text-lg font-semibold">No projects yet</p>
            <p className="prose-muted mx-auto mt-2 max-w-md">
              Start with a name. You can add ICP and objectives when you&apos;re
              ready to generate questions.
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
                    <p className="font-medium text-foreground">
                      {project.name}
                    </p>
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
