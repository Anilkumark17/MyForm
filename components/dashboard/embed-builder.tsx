"use client"

import { useEffect, useMemo, useState } from "react"

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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  buildEmbedSnippet,
  buildEmbedUrl,
  type EmbedTheme,
} from "@/lib/forms/embed-theme"

type EmbedBuilderProps = {
  formId: string
}

const initialTheme: EmbedTheme = {
  embed: true,
  theme: "dark",
  accent: "3ecf8e",
  background: "111111",
  text: "f5f5f5",
  hideTitle: false,
  hideBrand: false,
  compact: false,
  radius: 12,
  maxWidth: 560,
}

export function EmbedBuilder({ formId }: EmbedBuilderProps) {
  const [origin, setOrigin] = useState("")
  const [theme, setTheme] = useState<EmbedTheme>(initialTheme)
  const [copied, setCopied] = useState<"link" | "code" | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const embedUrl = useMemo(
    () => (origin ? buildEmbedUrl(origin, formId, theme) : ""),
    [origin, formId, theme]
  )
  const snippet = useMemo(
    () => (origin ? buildEmbedSnippet(origin, formId, theme) : ""),
    [origin, formId, theme]
  )

  function patch(partial: Partial<EmbedTheme>) {
    setTheme((prev) => {
      const next = { ...prev, ...partial }
      if (partial.theme === "dark") {
        next.background = "111111"
        next.text = "f5f5f5"
        next.accent = next.accent === "0f6e56" ? "3ecf8e" : next.accent
      } else if (partial.theme === "light") {
        next.background = "ffffff"
        next.text = "0f172a"
      } else if (partial.theme === "transparent") {
        next.background = "transparent"
        next.text = "f5f5f5"
      }
      return next
    })
  }

  async function copy(kind: "link" | "code") {
    await navigator.clipboard.writeText(kind === "link" ? embedUrl : snippet)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="mb-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Embed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize appearance, then copy a share link or iframe snippet.
          Fraud detection still runs on every submit.
        </p>
      </div>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b">
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Theme, accent, and layout options for the embedded form.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Theme</Label>
              <NativeSelect
                value={theme.theme}
                onChange={(event) =>
                  patch({
                    theme: event.target.value as EmbedTheme["theme"],
                  })
                }
                className="w-full"
              >
                <NativeSelectOption value="light">Light</NativeSelectOption>
                <NativeSelectOption value="dark">Dark</NativeSelectOption>
                <NativeSelectOption value="transparent">
                  Transparent
                </NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="accent">Accent</Label>
                <Input
                  id="accent"
                  type="color"
                  value={`#${theme.accent}`}
                  onChange={(event) =>
                    patch({ accent: event.target.value.replace("#", "") })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="textColor">Text</Label>
                <Input
                  id="textColor"
                  type="color"
                  value={`#${theme.text}`}
                  onChange={(event) =>
                    patch({ text: event.target.value.replace("#", "") })
                  }
                />
              </div>
            </div>

            {theme.theme !== "transparent" ? (
              <div className="grid gap-2">
                <Label htmlFor="bg">Background</Label>
                <Input
                  id="bg"
                  type="color"
                  value={`#${theme.background === "transparent" ? "ffffff" : theme.background}`}
                  onChange={(event) =>
                    patch({ background: event.target.value.replace("#", "") })
                  }
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="radius">Radius ({theme.radius}px)</Label>
                <Input
                  id="radius"
                  type="range"
                  min={0}
                  max={32}
                  value={theme.radius}
                  onChange={(event) =>
                    patch({ radius: Number(event.target.value) })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxWidth">Max width ({theme.maxWidth}px)</Label>
                <Input
                  id="maxWidth"
                  type="range"
                  min={320}
                  max={960}
                  step={10}
                  value={theme.maxWidth}
                  onChange={(event) =>
                    patch({ maxWidth: Number(event.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={theme.hideBrand}
                  onCheckedChange={(checked) =>
                    patch({ hideBrand: Boolean(checked) })
                  }
                />
                Hide brand
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={theme.hideTitle}
                  onCheckedChange={(checked) =>
                    patch({ hideTitle: Boolean(checked) })
                  }
                />
                Hide title
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={theme.compact}
                  onCheckedChange={(checked) =>
                    patch({ compact: Boolean(checked) })
                  }
                />
                Compact spacing
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Live preview</p>
              {embedUrl ? (
                <iframe
                  title="Embed preview"
                  src={embedUrl}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  className="h-[420px] w-full rounded-md bg-transparent"
                  style={{ maxWidth: theme.maxWidth }}
                />
              ) : (
                <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
                  Loading preview…
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Share link</CardTitle>
          <CardDescription>Open in a new tab or send directly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input readOnly value={embedUrl || `/f/${formId}`} className="font-mono text-xs" />
          <Button type="button" onClick={() => copy("link")} className="shrink-0">
            {copied === "link" ? "Copied" : "Copy link"}
          </Button>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader>
          <CardTitle>Embed code</CardTitle>
          <CardDescription>
            Paste this iframe into Webflow, WordPress, Framer, or any HTML page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            readOnly
            value={snippet}
            rows={8}
            className="font-mono text-xs"
          />
          <Button type="button" onClick={() => copy("code")}>
            {copied === "code" ? "Copied" : "Copy embed code"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
