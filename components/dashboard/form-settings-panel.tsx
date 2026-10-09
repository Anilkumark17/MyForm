"use client"

import { useState, useTransition } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveFormSettings } from "@/lib/projects/actions"
import type { FormSettings } from "@/lib/forms/settings"

type FormSettingsPanelProps = {
  projectId: string
  initialSettings: FormSettings
  responseCount: number
}

function ToggleRow({
  id,
  checked,
  onChange,
  title,
  description,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  title: string
  description: string
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(Boolean(next))}
        className="mt-0.5"
      />
      <span className="text-sm leading-snug">
        <span className="font-medium">{title}</span>
        <span className="block text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

export function FormSettingsPanel({
  projectId,
  initialSettings,
  responseCount,
}: FormSettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  )
  const [pending, startTransition] = useTransition()

  function update(patch: Partial<FormSettings>) {
    setMessage(null)
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  function save() {
    startTransition(async () => {
      const result = await saveFormSettings(projectId, settings)
      setMessage(
        result.ok
          ? { ok: true, text: "Settings saved." }
          : { ok: false, text: result.error ?? "Could not save settings." }
      )
    })
  }

  return (
    <div className="space-y-4">
      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b">
          <CardTitle>Presentation</CardTitle>
          <CardDescription>How respondents see the form</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ToggleRow
            id="set-progress"
            checked={settings.showProgress}
            onChange={(showProgress) => update({ showProgress })}
            title="Show progress bar"
            description="Fills as respondents move through the form."
          />
          <ToggleRow
            id="set-shuffle"
            checked={settings.shuffleQuestions}
            onChange={(shuffleQuestions) => update({ shuffleQuestions })}
            title="Shuffle question order"
            description="Each respondent sees a different order. With sections, the first question of each section stays put. Forms with answer flows are not shuffled. Shuffle answer options per question in the question editor."
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="set-confirmation">Confirmation message</Label>
            <Textarea
              id="set-confirmation"
              rows={3}
              value={settings.confirmationMessage}
              onChange={(event) =>
                update({ confirmationMessage: event.target.value })
              }
              placeholder="Your response has been recorded."
            />
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b">
          <CardTitle>Responses</CardTitle>
          <CardDescription>
            {responseCount} response{responseCount === 1 ? "" : "s"} so far
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ToggleRow
            id="set-accepting"
            checked={settings.acceptingResponses}
            onChange={(acceptingResponses) => update({ acceptingResponses })}
            title="Accepting responses"
            description="Turn off to close the form."
          />
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="set-limit">Close after N responses</Label>
            <Input
              id="set-limit"
              type="number"
              min={1}
              value={settings.responseLimit ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value)
                update({
                  responseLimit:
                    event.target.value && value > 0 ? Math.floor(value) : null,
                })
              }}
              placeholder="Unlimited"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="set-closed">Message when closed</Label>
            <Textarea
              id="set-closed"
              rows={2}
              value={settings.closedMessage}
              onChange={(event) => update({ closedMessage: event.target.value })}
              placeholder="This form is no longer accepting responses."
            />
          </div>
          <ToggleRow
            id="set-once"
            checked={settings.limitOneResponse}
            onChange={(limitOneResponse) => update({ limitOneResponse })}
            title="Limit to one response per browser"
            description="Remembered on the respondent's device. Anyone can bypass it by clearing site data, because respondents do not sign in."
          />
        </CardContent>
      </Card>

      {message ? (
        <Alert variant={message.ok ? "default" : "destructive"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  )
}
