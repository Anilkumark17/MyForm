"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { Submission } from "@/lib/db/schema"
import {
  buildQuestionAggregates,
  questionTypeLabel,
} from "@/lib/projects/response-analytics"
import { splitSubmissions } from "@/lib/projects/submission-filters"
import type { SurveyQuestion } from "@/lib/survey/questions"
import { Z_THRESHOLD_LOW } from "@/lib/fraud/constants"

const QUALITY_COLORS = {
  valid: "var(--brand-signal)",
  fake: "hsl(0 72% 55%)",
}

type ResponseChartsProps = {
  questions: SurveyQuestion[]
  submissions: Submission[]
}

export function ResponseCharts({
  questions,
  submissions,
}: ResponseChartsProps) {
  const { valid, fake } = useMemo(
    () => splitSubmissions(submissions),
    [submissions]
  )

  const qualityData = useMemo(
    () => [
      { name: "Valid", key: "valid", value: valid.length },
      { name: "Flagged fake", key: "fake", value: fake.length },
    ],
    [valid.length, fake.length]
  )

  const timelineData = useMemo(() => {
    const byDay = new Map<string, { date: string; valid: number; fake: number }>()
    for (const row of submissions) {
      const date = new Date(row.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
      const bucket = byDay.get(date) ?? { date, valid: 0, fake: 0 }
      const isFake =
        row.fraudStatus === "flagged" ||
        row.fraudStatus === "rejected" ||
        row.flagStatus === "flagged"
      if (isFake) bucket.fake += 1
      else bucket.valid += 1
      byDay.set(date, bucket)
    }
    return Array.from(byDay.values()).slice(-14)
  }, [submissions])

  const zScoreData = useMemo(() => {
    return [...submissions]
      .filter((row) => row.zScore != null)
      .slice(0, 24)
      .reverse()
      .map((row, index) => {
        const isFake =
          row.fraudStatus === "flagged" ||
          row.fraudStatus === "rejected" ||
          row.flagStatus === "flagged"
        return {
          name: `#${index + 1}`,
          z: Number(row.zScore!.toFixed(2)),
          fill: isFake ? QUALITY_COLORS.fake : QUALITY_COLORS.valid,
        }
      })
  }, [submissions])

  const aggregates = useMemo(
    () => buildQuestionAggregates(questions, valid),
    [questions, valid]
  )

  const choiceCharts = aggregates
    .filter(
      (a) =>
        a.kind === "choice" ||
        a.kind === "boolean" ||
        (a.kind === "numeric" && a.buckets.length > 0)
    )
    .slice(0, 6)

  const qualityConfig = {
    valid: { label: "Valid", color: QUALITY_COLORS.valid },
    fake: { label: "Flagged fake", color: QUALITY_COLORS.fake },
  } satisfies ChartConfig

  const timelineConfig = {
    valid: { label: "Valid", color: QUALITY_COLORS.valid },
    fake: { label: "Flagged fake", color: QUALITY_COLORS.fake },
  } satisfies ChartConfig

  const zConfig = {
    z: { label: "Z-score", color: "var(--brand-signal)" },
  } satisfies ChartConfig

  if (submissions.length === 0) return null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-semibold tracking-tight">
          Insights
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Charts use valid responses only. Flagged fakes (by z-score) stay
          separate.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface rounded-lg p-4">
          <p className="text-sm font-medium">Response quality</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {valid.length} kept in results · {fake.length} removed as fake
          </p>
          <ChartContainer config={qualityConfig} className="mx-auto aspect-square max-h-[240px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={qualityData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                strokeWidth={2}
              >
                {qualityData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={
                      entry.key === "fake"
                        ? QUALITY_COLORS.fake
                        : QUALITY_COLORS.valid
                    }
                  />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>

        <div className="surface rounded-lg p-4">
          <p className="text-sm font-medium">Submissions over time</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Valid vs flagged fake by day
          </p>
          {timelineData.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Not enough data yet.
            </p>
          ) : (
            <ChartContainer config={timelineConfig} className="mt-2 aspect-auto h-[240px] w-full">
              <AreaChart data={timelineData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="valid"
                  stackId="1"
                  stroke={QUALITY_COLORS.valid}
                  fill={QUALITY_COLORS.valid}
                  fillOpacity={0.35}
                />
                <Area
                  type="monotone"
                  dataKey="fake"
                  stackId="1"
                  stroke={QUALITY_COLORS.fake}
                  fill={QUALITY_COLORS.fake}
                  fillOpacity={0.45}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {zScoreData.length > 0 ? (
        <div className="surface rounded-lg p-4">
          <p className="text-sm font-medium">Z-score by submission</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            After the first 15 responses, red bars (z &lt; {Z_THRESHOLD_LOW}) are
            faster than the peer mean — flagged fake and excluded from output.
            Mean refreshes every 15 clean responses.
          </p>
          <ChartContainer config={zConfig} className="mt-2 aspect-auto h-[220px] w-full">
            <BarChart data={zScoreData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="z" radius={3}>
                {zScoreData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      ) : null}

      {choiceCharts.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">Answer breakdown (valid only)</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {choiceCharts.map((aggregate) => {
              const chartData = aggregate.buckets.map((bucket) => ({
                name:
                  bucket.label.length > 18
                    ? `${bucket.label.slice(0, 18)}…`
                    : bucket.label,
                fullName: bucket.label,
                count: bucket.count,
                percent: bucket.percent,
              }))
              const config = {
                count: {
                  label: "Responses",
                  color: "var(--brand-signal)",
                },
              } satisfies ChartConfig

              return (
                <div key={aggregate.question.id} className="surface rounded-lg p-4">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {aggregate.question.prompt}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {questionTypeLabel(aggregate.question.type)} ·{" "}
                    {aggregate.responseCount} answers
                  </p>
                  <ChartContainer
                    config={config}
                    className="mt-2 aspect-auto h-[200px] w-full"
                  >
                    <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        fill="var(--brand-signal)"
                        radius={3}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
