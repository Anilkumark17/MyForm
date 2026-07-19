"use client"

import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const MAX_BYTES = 1.5 * 1024 * 1024

type ImageFieldInputProps = {
  id: string
  label: string
  value?: string
  onChange: (value: string | undefined) => void
  hint?: string
  className?: string
}

export function ImageFieldInput({
  id,
  label,
  value,
  onChange,
  hint,
  className,
}: ImageFieldInputProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Only image files are accepted (no video).")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 1.5 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      onChange(result || undefined)
    }
    reader.onerror = () => setError("Could not read that image.")
    reader.readAsDataURL(file)
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            handleFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => fileRef.current?.click()}
        >
          Upload image
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setError(null)
              onChange(undefined)
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <Input
        id={id}
        value={value?.startsWith("data:") ? "" : (value ?? "")}
        onChange={(event) => {
          setError(null)
          onChange(event.target.value.trim() || undefined)
        }}
        placeholder="Or paste an image URL (https://…)"
        className="h-9"
      />
      {value?.startsWith("data:") ? (
        <p className="text-xs text-[var(--brand-signal)]">
          Image uploaded and attached to this question.
        </p>
      ) : null}
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="mt-1 max-h-32 rounded-md border border-border object-contain bg-muted/40"
        />
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
