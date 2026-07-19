import { and, desc, eq } from "drizzle-orm"

import {
  BASELINE_WINDOW,
  MIN_BASELINE_SAMPLES,
  SIGNAL_TOTAL_TIME,
} from "@/lib/fraud/constants"
import { mean, stddev } from "@/lib/fraud/stats"
import { buildSignalMap } from "@/lib/fraud/signals"
import { db } from "@/lib/db"
import { formBaselines, submissions } from "@/lib/db/schema"

function collectSignalSeries(
  rows: Array<{
    totalCompletionTimeMs: number
    perFieldTimeMs: Record<string, number>
    perFieldTextLength: Record<string, number>
    perFieldEntropyScore: Record<string, number>
  }>
) {
  const series = new Map<string, number[]>()

  for (const row of rows) {
    const map = buildSignalMap({
      totalCompletionTimeMs: row.totalCompletionTimeMs,
      perFieldTimeMs: row.perFieldTimeMs ?? {},
      perFieldTextLength: row.perFieldTextLength ?? {},
      perFieldEntropyScore: row.perFieldEntropyScore ?? {},
    })
    for (const [name, value] of Object.entries(map)) {
      if (!Number.isFinite(value)) continue
      const list = series.get(name) ?? []
      list.push(value)
      series.set(name, list)
    }
  }

  return series
}

/** Recompute baselines from the last N clean submissions. Returns false if insufficient data. */
export async function recomputeFormBaselines(formId: string): Promise<boolean> {
  const rows = await db
    .select({
      totalCompletionTimeMs: submissions.totalCompletionTimeMs,
      perFieldTimeMs: submissions.perFieldTimeMs,
      perFieldTextLength: submissions.perFieldTextLength,
      perFieldEntropyScore: submissions.perFieldEntropyScore,
    })
    .from(submissions)
    .where(
      and(eq(submissions.formId, formId), eq(submissions.flagStatus, "clean"))
    )
    .orderBy(desc(submissions.createdAt))
    .limit(BASELINE_WINDOW)

  if (rows.length < MIN_BASELINE_SAMPLES) {
    return false
  }

  const series = collectSignalSeries(rows)
  const now = new Date()

  // Always keep total time; only keep field signals present in enough rows.
  const entries: Array<{
    signalName: string
    mean: number
    stddev: number
    sampleSize: number
  }> = []

  for (const [signalName, values] of series.entries()) {
    if (
      signalName !== SIGNAL_TOTAL_TIME &&
      values.length < MIN_BASELINE_SAMPLES
    ) {
      continue
    }
    if (values.length < 2) continue
    const avg = mean(values)
    const deviation = stddev(values, avg)
    entries.push({
      signalName,
      mean: avg,
      stddev: deviation === 0 ? 1e-9 : deviation,
      sampleSize: values.length,
    })
  }

  if (entries.length === 0) {
    return false
  }

  for (const entry of entries) {
    await db
      .insert(formBaselines)
      .values({
        formId,
        signalName: entry.signalName,
        mean: entry.mean,
        stddev: entry.stddev,
        sampleSize: entry.sampleSize,
        lastComputedAt: now,
      })
      .onConflictDoUpdate({
        target: [formBaselines.formId, formBaselines.signalName],
        set: {
          mean: entry.mean,
          stddev: entry.stddev,
          sampleSize: entry.sampleSize,
          lastComputedAt: now,
        },
      })
  }

  return true
}

export async function getFormBaselines(formId: string) {
  return db
    .select()
    .from(formBaselines)
    .where(eq(formBaselines.formId, formId))
}
