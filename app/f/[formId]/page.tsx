import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { PublicForm } from "@/components/public/public-form"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { parseEmbedTheme } from "@/lib/forms/embed-theme"
import { parseSurveyQuestions } from "@/lib/survey/questions"

type FormPageProps = {
  params: Promise<{ formId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PublicFormPage({
  params,
  searchParams,
}: FormPageProps) {
  const { formId } = await params
  const query = await searchParams
  const theme = parseEmbedTheme(query)

  const [form] = await db
    .select({
      id: projects.id,
      name: projects.name,
      questions: projects.questions,
    })
    .from(projects)
    .where(eq(projects.id, formId))
    .limit(1)

  if (!form) {
    notFound()
  }

  const questions = parseSurveyQuestions(form.questions).filter(
    (question) => question.type !== "hidden"
  )

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <p className="font-heading text-xl font-semibold">{form.name}</p>
          <p className="prose-muted mt-2">
            This form has no questions yet. Ask the owner to add some.
          </p>
        </div>
      </div>
    )
  }

  if (theme.embed) {
    return (
      <div
        className="min-h-screen px-2 py-2"
        style={{
          background:
            theme.background === "transparent" ? "transparent" : undefined,
        }}
      >
        <PublicForm
          formId={form.id}
          formName={form.name}
          questions={questions}
          theme={theme}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-lg">
        <PublicForm
          formId={form.id}
          formName={form.name}
          questions={questions}
          theme={{ ...theme, accent: theme.accent || "3ecf8e" }}
        />
      </div>
    </div>
  )
}
