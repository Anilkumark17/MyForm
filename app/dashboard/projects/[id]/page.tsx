import Link from "next/link"
import { notFound } from "next/navigation"

import { ProjectWorkspace } from "@/components/dashboard/project-workspace"
import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getGenerationUsage } from "@/lib/auth/generation-usage"
import { getSessionUser } from "@/lib/auth/session"
import { getProjectBaselines } from "@/lib/projects/baselines"
import { getProjectById } from "@/lib/projects/queries"
import { getProjectSubmissions } from "@/lib/projects/submissions"
import { parseProjectQuestions } from "@/lib/projects/utils"
import { cn } from "@/lib/utils"

type ProjectPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const user = await getSessionUser()
  const [project, submissionRows, baselines, usage] = await Promise.all([
    getProjectById(id),
    getProjectSubmissions(id),
    getProjectBaselines(id),
    user ? getGenerationUsage(user.id) : Promise.resolve(null),
  ])

  if (!project) {
    notFound()
  }

  const questions = parseProjectQuestions(project.questions)
  const submissions = submissionRows ?? []
  const created = project.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Projects
        </Link>
      </div>

      <PageHeader
        title={project.name}
        description={`Created ${created} · ${submissions.length} response${submissions.length === 1 ? "" : "s"} · ${questions.length} question${questions.length === 1 ? "" : "s"}`}
        actions={
          <Link
            href={`/f/${project.id}`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Open form
          </Link>
        }
      />

      <ProjectWorkspace
        projectId={project.id}
        icp={project.icp}
        objectives={project.objectives}
        questions={questions}
        submissions={submissions}
        generationsRemaining={usage?.remaining ?? 0}
        generationsLimit={usage?.limit ?? 4}
        generationsUnlimited={usage?.unlimited ?? false}
        baselines={baselines}
      />
    </div>
  )
}
