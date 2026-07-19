"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { Submission } from "@/lib/db/schema"
import { buildComparisonAggregate } from "@/lib/projects/comparison-analytics"
import type { SurveyQuestion } from "@/lib/survey/questions"

type ComparisonResultsProps = {
  question: SurveyQuestion
  submissions: Submission[]
}

export function ComparisonResults({
  question,
  submissions,
}: ComparisonResultsProps) {
  const [includeFlagged, setIncludeFlagged] = useState(false)
  const [segment, setSegment] = useState<string>("overall")

  const aggregate = useMemo(
    () =>
      buildComparisonAggregate(question, submissions, { includeFlagged }),
    [question, submissions, includeFlagged]
  )

  if (!aggregate) return null

  const activeStats =
    segment === "overall"
      ? aggregate.stats
      : (aggregate.segments.find((s) => s.segment === segment)?.stats ??
        aggregate.stats)

  const chartData = activeStats.map((stat) => ({
    name: stat.label,
    value: Number(
      (stat.average != null ? stat.average : stat.value).toFixed(2)
    ),
    percent: stat.percent,
  }))

  const chartConfig = {
    value: {
      label: aggregate.metricLabel,
      color: "var(--brand-signal)",
    },
  } satisfies ChartConfig

  const winner = activeStats.find(
    (s) => s.optionId === aggregate.winnerOptionId
  )

  return (
    <div className="surface space-y-5 rounded-lg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{question.prompt}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Comparison · {aggregate.selectionMode.replaceAll("_", " ")} ·{" "}
            {aggregate.metricLabel}
          </p>
        </div>
        {winner ? (
          <Badge variant="secondary" className="shrink-0">
            Best: {winner.label}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="text-muted-foreground">
          {aggregate.includedResponses} responses in chart
          {aggregate.flaggedExcluded > 0
            ? ` · ${aggregate.flaggedExcluded} low-trust excluded`
            : ""}
          {aggregate.totalResponses !== aggregate.includedResponses &&
          includeFlagged
            ? ` · ${aggregate.totalResponses} total`
            : ""}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIncludeFlagged((v) => !v)}
        >
          {includeFlagged ? "Exclude low-trust" : "Include low-trust"}
        </Button>
        {aggregate.flaggedExcluded > 0 && !includeFlagged ? (
          <span className="text-xs text-muted-foreground">
            Toggle to view flagged responses in stats
          </span>
        ) : null}
      </div>

      {aggregate.segments.length > 0 ? (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label>Segment</Label>
          <NativeSelect
            value={segment}
            onChange={(event) => setSegment(event.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="overall">Overall</NativeSelectOption>
            {aggregate.segments.map((row) => (
              <NativeSelectOption key={row.segment} value={row.segment}>
                {row.segment} ({row.responseCount})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {chartData.every((d) => d.value === 0) ? (
        <p className="text-sm text-muted-foreground">
          No qualifying responses yet for this comparison.
        </p>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-[16/7] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="value"
              fill="var(--color-value)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {activeStats.map((stat) => (
          <div
            key={stat.optionId}
            className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
          >
            {stat.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stat.imageUrl}
                alt=""
                className="size-12 rounded object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{stat.label}</p>
              <p className="text-xs text-muted-foreground">
                {aggregate.selectionMode === "allocate" ||
                aggregate.selectionMode === "rate_each"
                  ? `Avg ${stat.value.toFixed(1)}`
                  : `${stat.value} wins (${stat.percent}%)`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {segment !== "overall" && winner ? (
        <p className="text-sm text-muted-foreground">
          Among <span className="text-foreground">{segment}</span> leads,{" "}
          <span className="text-foreground">{winner.label}</span> leads at{" "}
          {winner.percent}%
          {aggregate.winnerOptionId === winner.optionId
            ? " (also overall leader)"
            : " (differs from overall)"}.
        </p>
      ) : null}
    </div>
  )
}
