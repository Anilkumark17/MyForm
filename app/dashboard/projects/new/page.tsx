import Link from "next/link"
import { redirect } from "next/navigation"

import { CreateProjectForm } from "@/components/dashboard/create-project-form"
import { PageHeader } from "@/components/layout/page-header"
import { buttonVariants } from "@/components/ui/button"
import { ACCESS_REQUEST_EMAIL } from "@/lib/auth/account-limits"
import { getAccountUsage } from "@/lib/auth/account-usage"
import { getSessionUser } from "@/lib/auth/session"
import { cn } from "@/lib/utils"

export default async function NewProjectPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  const usage = await getAccountUsage(user.id)
  const atLimit = !usage?.unlimited && (usage?.projects.remaining ?? 0) === 0

  if (atLimit) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="Project limit reached"
          description={`Free accounts can create ${usage?.projects.limit ?? 2} projects. An access request goes to ${ACCESS_REQUEST_EMAIL}.`}
          actions={
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
            >
              Back to projects
            </Link>
          }
        />
      </div>
    )
  }

  return <CreateProjectForm />
}
