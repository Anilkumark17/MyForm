"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Submission } from "@/lib/db/schema"
import {
  INSTANT_FLAG_MS,
  MIN_SAMPLES,
  Z_THRESHOLD_LOW,
  Z_THRESHOLD_REJECT,
} from "@/lib/fraud/constants"

type BaselineRow = {
  id: string
  formId: string
  signalName: string
  mean: number
  stddev: number
  sampleSize: number
  lastComputedAt: Date
}

type FraudInsightsProps = {
  submissions: Submission[]
  baselines: {
    ready: boolean
    minSamplesRequired: number
    signalCount: number
    lastComputedAt: Date | null
    rows: BaselineRow[]
    welford?: {
      mean: number
      stddev: number
      sampleCount: number
      windowSize: number
      ready: boolean
    }
  } | null
}

function asDetails(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

export function FraudInsights({ submissions, baselines }: FraudInsightsProps) {
  const normalCount = submissions.filter(
    (row) =>
      row.fraudStatus === "normal" ||
      (row.fraudStatus == null && row.flagStatus === "clean")
  ).length
  const flaggedCount = submissions.filter(
    (row) =>
      row.fraudStatus === "flagged" ||
      row.fraudStatus === "rejected" ||
      row.flagStatus === "flagged"
  ).length
  const insufficient = submissions.filter(
    (row) => row.fraudStatus === "insufficient_data"
  ).length
  const recent = submissions.slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="mb-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Trust scoring
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each survey keeps its own running mean/variance (Welford). Timing is
          measured silently — respondents never see scores.
        </p>
      </div>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b">
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Lower-tail z-score on completion time + absolute floor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Baseline ready"
              value={baselines?.ready ? "Yes" : "Not yet"}
              hint={
                baselines?.welford
                  ? `${baselines.welford.sampleCount}/${MIN_SAMPLES} samples · σ=${baselines.welford.stddev.toFixed(1)}s`
                  : `Need ${MIN_SAMPLES}+ submissions`
              }
            />
            <Stat
              label="Insufficient data"
              value={String(insufficient)}
              hint="Scored but not flagged yet"
            />
            <Stat
              label="Normal / flagged"
              value={`${normalCount} / ${flaggedCount}`}
              hint={`Flag z < ${Z_THRESHOLD_LOW} (after baseline), reject z < ${Z_THRESHOLD_REJECT}`}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="font-medium">How detection works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Completing under {INSTANT_FLAG_MS / 1000}s or filling the
                honeypot → <Badge variant="destructive">rejected</Badge>.
              </li>
              <li>
                First {MIN_SAMPLES} clean submissions build the survey mean —
                none are labeled fake.
              </li>
              <li>
                Mean refreshes every {MIN_SAMPLES} clean responses (not every
                submit).
              </li>
              <li>
                From submission {MIN_SAMPLES + 1} onward, any negative z-score
                (faster than the peer mean) is flagged fake and removed from
                valid output.
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Per-survey baseline</CardTitle>
          <CardDescription>
            Running mean/stddev of completion time (seconds), last{" "}
            {baselines?.welford?.windowSize ?? 0} samples in the rolling window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!baselines || baselines.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No baseline yet. Collect submissions — stats update automatically
              in the background on each submit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Signal</th>
                    <th className="py-2 pr-3 font-medium">Mean</th>
                    <th className="py-2 pr-3 font-medium">Stddev</th>
                    <th className="py-2 font-medium">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {row.signalName}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.mean.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.stddev.toFixed(2)}
                      </td>
                      <td className="py-2 tabular-nums">{row.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Recent scoring</CardTitle>
          <CardDescription>
            Each submission stores z-score, status, and reasons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submissions yet.
            </p>
          ) : (
            recent.map((row) => {
              const details = asDetails(row.scoringDetails)
              const reasons = Array.isArray(details?.reasons)
                ? (details.reasons as string[])
                : []
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        row.fraudStatus === "rejected" ||
                        row.fraudStatus === "flagged" ||
                        row.flagStatus === "flagged"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {row.fraudStatus ?? row.flagStatus}
                    </Badge>
                    <Badge variant="outline">Trust {row.trustScore}</Badge>
                    {row.zScore != null ? (
                      <Badge variant="outline">
                        z={row.zScore.toFixed(2)}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {(row.totalCompletionTimeMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {reasons[0] ??
                      String(details?.summary ?? "No scoring summary.")}
                  </p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
