import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { forPublicForm, parseSurveyQuestions } from "@/lib/survey/questions"

type RouteContext = {
  params: Promise<{ formId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { formId } = await context.params

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
    return NextResponse.json({ error: "Form not found." }, { status: 404 })
  }

  const questions = forPublicForm(parseSurveyQuestions(form.questions))

  return NextResponse.json({
    id: form.id,
    name: form.name,
    questions,
  })
}
