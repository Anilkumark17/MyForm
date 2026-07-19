import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { requireUser } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { formBaselines, projects } from "@/lib/db/schema"
import { MIN_SAMPLES, STD_FLOOR_SECONDS } from "@/lib/fraud/constants"
import {
  describeSurveyStats,
  welfordStateFromProject,
} from "@/lib/fraud/score-submission"
import { sampleStd } from "@/lib/fraud/welford"

export async function getProjectBaselines(projectId: string) {
  const user = await requireUser()
  if (!user) {
    redirect("/login")
  }

  const [owned] = await db
    .select({
      id: projects.id,
      fraudRunningMean: projects.fraudRunningMean,
      fraudRunningM2: projects.fraudRunningM2,
      fraudSampleCount: projects.fraudSampleCount,
      fraudPendingSinceMean: projects.fraudPendingSinceMean,
      fraudWindowTimes: projects.fraudWindowTimes,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1)

  if (!owned) return null

  const state = welfordStateFromProject(owned)
  const stats = describeSurveyStats(state)
  const std = sampleStd(state, STD_FLOOR_SECONDS)

  // Synthetic row so existing FraudInsights table still renders
  const rows =
    state.sampleCount > 0
      ? [
          {
            id: `welford-${projectId}`,
            formId: projectId,
            signalName: "completion_time_seconds",
            mean: state.runningMean,
            stddev: std,
            sampleSize: state.sampleCount,
            lastComputedAt: new Date(),
          },
        ]
      : []

  // Also merge any legacy form_baselines rows (field-level) if present
  const legacy = await db
    .select()
    .from(formBaselines)
    .where(eq(formBaselines.formId, projectId))

  return {
    ready: stats.ready,
    minSamplesRequired: MIN_SAMPLES,
    signalCount: rows.length + legacy.length,
    lastComputedAt: rows[0]?.lastComputedAt ?? null,
    rows: [...rows, ...legacy],
    welford: stats,
  }
}
