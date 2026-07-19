const PREFIX = "myform_draft:"

export type FormDraft = {
  answers: Record<string, unknown>
  startedAt: number
  perFieldTimeMs: Record<string, number>
  updatedAt: number
}

export function draftKey(formId: string) {
  return `${PREFIX}${formId}`
}

export function loadDraft(formId: string): FormDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(draftKey(formId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FormDraft
    if (!parsed || typeof parsed !== "object") return null
    return {
      answers: parsed.answers ?? {},
      startedAt: Number(parsed.startedAt) || Date.now(),
      perFieldTimeMs: parsed.perFieldTimeMs ?? {},
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    }
  } catch {
    return null
  }
}

export function saveDraft(formId: string, draft: FormDraft) {
  if (typeof window === "undefined") return
  localStorage.setItem(
    draftKey(formId),
    JSON.stringify({ ...draft, updatedAt: Date.now() })
  )
}

export function clearDraft(formId: string) {
  if (typeof window === "undefined") return
  localStorage.removeItem(draftKey(formId))
}
