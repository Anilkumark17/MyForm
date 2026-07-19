"use client"

import { useActionState } from "react"

import { PageHeader } from "@/components/layout/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createProject } from "@/lib/projects/actions"
import type { ProjectFormState } from "@/lib/projects/types"

const initialState: ProjectFormState = {}

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, initialState)

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="New project"
        description="Only a name is required. Add ICP and objectives now, or later when you generate questions."
      />

      <form action={formAction} className="surface mt-8 space-y-5 rounded-lg p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            Project name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="Q3 customer discovery"
            required
            minLength={2}
            className="h-10"
          />
          {state.fieldErrors?.name?.[0] ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="icp">ICP (optional)</Label>
          <Textarea
            id="icp"
            name="icp"
            placeholder="Who are you interviewing? e.g. Growth marketers at B2B SaaS companies"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="objectives">Objectives (optional)</Label>
          <Textarea
            id="objectives"
            name="objectives"
            placeholder="What are you trying to learn?"
            rows={3}
          />
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </form>
    </div>
  )
}
