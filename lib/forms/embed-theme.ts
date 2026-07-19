import type { CSSProperties } from "react"

export type EmbedTheme = {
  embed: boolean
  theme: "light" | "dark" | "transparent"
  accent: string
  background: string
  text: string
  hideTitle: boolean
  hideBrand: boolean
  compact: boolean
  radius: number
  maxWidth: number
}

const DEFAULTS: EmbedTheme = {
  embed: false,
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

function cleanHex(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  const hex = value.replace("#", "").trim()
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback
}

function boolParam(value: string | null | undefined) {
  return value === "1" || value === "true"
}

export function parseEmbedTheme(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): EmbedTheme {
  const get = (key: string) => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key)
    }
    const raw = searchParams[key]
    return Array.isArray(raw) ? raw[0] : raw
  }

  const themeRaw = get("theme")
  const theme =
    themeRaw === "dark" || themeRaw === "transparent" || themeRaw === "light"
      ? themeRaw
      : DEFAULTS.theme

  const presetBackground =
    theme === "dark" ? "111111" : theme === "transparent" ? "00000000" : "ffffff"
  const presetText = theme === "dark" ? "f5f5f5" : "0f172a"

  const bgRaw = get("bg")

  return {
    embed: boolParam(get("embed")),
    theme,
    accent: cleanHex(get("accent"), DEFAULTS.accent),
    background:
      bgRaw === "transparent" || (!bgRaw && theme === "transparent")
        ? "transparent"
        : cleanHex(
            bgRaw,
            theme === "dark" ? "111111" : DEFAULTS.background
          ),
    text: cleanHex(get("text"), presetText),
    hideTitle: boolParam(get("hideTitle")),
    hideBrand: boolParam(get("hideBrand")),
    compact: boolParam(get("compact")),
    radius: Math.min(
      32,
      Math.max(0, Number(get("radius") ?? DEFAULTS.radius) || DEFAULTS.radius)
    ),
    maxWidth: Math.min(
      960,
      Math.max(
        320,
        Number(get("maxWidth") ?? DEFAULTS.maxWidth) || DEFAULTS.maxWidth
      )
    ),
  }
}

export function embedThemeToSearchParams(theme: EmbedTheme): URLSearchParams {
  const params = new URLSearchParams()
  if (theme.embed) params.set("embed", "1")
  params.set("theme", theme.theme)
  params.set("accent", theme.accent)
  if (theme.background !== "transparent") {
    params.set("bg", theme.background.replace("#", ""))
  } else {
    params.set("bg", "transparent")
  }
  params.set("text", theme.text)
  if (theme.hideTitle) params.set("hideTitle", "1")
  if (theme.hideBrand) params.set("hideBrand", "1")
  if (theme.compact) params.set("compact", "1")
  params.set("radius", String(theme.radius))
  params.set("maxWidth", String(theme.maxWidth))
  return params
}

export function buildEmbedUrl(origin: string, formId: string, theme: EmbedTheme) {
  const params = embedThemeToSearchParams({ ...theme, embed: true })
  return `${origin}/f/${formId}?${params.toString()}`
}

export function buildEmbedSnippet(origin: string, formId: string, theme: EmbedTheme) {
  const src = buildEmbedUrl(origin, formId, theme)
  const height = theme.compact ? 520 : 720
  return `<iframe
  src="${src}"
  title="Myform"
  width="100%"
  height="${height}"
  style="border:0;border-radius:${theme.radius}px;max-width:${theme.maxWidth}px;width:100%;background:transparent;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>`
}

export function themeToCssVars(theme: EmbedTheme): CSSProperties {
  const bg =
    theme.background === "transparent" ? "transparent" : `#${theme.background}`
  return {
    ["--embed-accent" as string]: `#${theme.accent}`,
    ["--embed-bg" as string]: bg,
    ["--embed-text" as string]: `#${theme.text}`,
    ["--embed-radius" as string]: `${theme.radius}px`,
    ["--embed-max-width" as string]: `${theme.maxWidth}px`,
  }
}
