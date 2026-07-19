"use client"

import { EmbedBuilder } from "@/components/dashboard/embed-builder"
import { FraudInsights } from "@/components/dashboard/fraud-insights"
import { GenerateQuestionsPanel } from "@/components/dashboard/generate-questions-panel"
import { ResponsesPanel } from "@/components/dashboard/responses-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Submission } from "@/lib/db/schema"
import type { SurveyQuestion } from "@/lib/survey/questions"

type ProjectWorkspaceProps = {
  projectId: string
  icp: string | null
  objectives: string | null
  questions: SurveyQuestion[]
  submissions: Submission[]
  generationsRemaining: number | null
  generationsLimit: number
  generationsUnlimited: boolean
  baselines: {
    ready: boolean
    minSamplesRequired: number
    signalCount: number
    lastComputedAt: Date | null
    rows: Array<{
      id: string
      formId: string
      signalName: string
      mean: number
      stddev: number
      sampleSize: number
      lastComputedAt: Date
    }>
    welford?: {
      mean: number
      stddev: number
      sampleCount: number
      windowSize: number
      ready: boolean
    }
  } | null
}

export function ProjectWorkspace({
  projectId,
  icp,
  objectives,
  questions,
  submissions,
  generationsRemaining,
  generationsLimit,
  generationsUnlimited,
  baselines,
}: ProjectWorkspaceProps) {
  return (
    <div className="mt-8">
      <Tabs defaultValue="questions" className="gap-6">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
        >
          <TabsTrigger
            value="questions"
            className="rounded-none px-3 pb-3 pt-0 data-active:bg-transparent"
          >
            Questions
          </TabsTrigger>
          <TabsTrigger
            value="responses"
            className="rounded-none px-3 pb-3 pt-0 data-active:bg-transparent"
          >
            Responses
            {submissions.length > 0 ? (
              <span className="ml-1.5 text-muted-foreground">
                {submissions.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="embed"
            className="rounded-none px-3 pb-3 pt-0 data-active:bg-transparent"
          >
            Embed
          </TabsTrigger>
          <TabsTrigger
            value="trust"
            className="rounded-none px-3 pb-3 pt-0 data-active:bg-transparent"
          >
            Trust
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="rounded-none px-3 pb-3 pt-0 data-active:bg-transparent"
          >
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-0">
          <GenerateQuestionsPanel
            projectId={projectId}
            icp={icp}
            objectives={objectives}
            initialQuestions={questions}
            generationsRemaining={generationsRemaining}
            generationsLimit={generationsLimit}
            generationsUnlimited={generationsUnlimited}
          />
        </TabsContent>

        <TabsContent value="responses" className="mt-0">
          <ResponsesPanel questions={questions} submissions={submissions} />
        </TabsContent>

        <TabsContent value="embed" className="mt-0">
          <EmbedBuilder formId={projectId} />
        </TabsContent>

        <TabsContent value="trust" className="mt-0">
          <FraudInsights submissions={submissions} baselines={baselines} />
        </TabsContent>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <Card size="sm" className="shadow-none">
            <CardHeader className="border-b">
              <CardTitle>ICP</CardTitle>
              <CardDescription>Who you&apos;re interviewing</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {icp?.trim() ||
                  "Not set yet — add this before generating questions."}
              </p>
            </CardContent>
          </Card>

          <Card size="sm" className="shadow-none">
            <CardHeader className="border-b">
              <CardTitle>Objectives</CardTitle>
              <CardDescription>
                What this survey is trying to learn
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {objectives?.trim() ||
                  "Not set yet — add this before generating questions."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
