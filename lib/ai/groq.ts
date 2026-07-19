import {
  buildMomTestUserPrompt,
  MOM_TEST_SYSTEM_PROMPT,
} from "@/lib/ai/mom-test"
import {
  normalizeSurveyQuestion,
  suggestTypeFromPrompt,
  type SurveyQuestion,
} from "@/lib/survey/questions"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
/** Strong default; override with GROQ_MODEL in .env if needed. */
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

function getGroqApiKey() {
  return process.env.GROQ_API_KEY || process.env.GROQ_API
}

function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
}

function extractJsonArray(content: string): unknown[] {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1]?.trim() ?? trimmed
  const start = raw.indexOf("[")
  const end = raw.lastIndexOf("]")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a question list.")
  }

  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Model returned an empty question list.")
  }

  return parsed
}

export async function generateMomTestQuestions(input: {
  projectName: string
  icp: string
  objectives: string
}): Promise<SurveyQuestion[]> {
  const apiKey = getGroqApiKey()
  if (!apiKey) {
    throw new Error("GROQ_API is not set in your environment.")
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getGroqModel(),
      temperature: 0.65,
      top_p: 0.9,
      messages: [
        { role: "system", content: MOM_TEST_SYSTEM_PROMPT },
        { role: "user", content: buildMomTestUserPrompt(input) },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      detail || `Groq request failed with status ${response.status}`
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("Groq returned no content.")
  }

  const parsed = extractJsonArray(content)
  const questions = parsed
    .map((item) => {
      if (typeof item === "string") {
        return normalizeSurveyQuestion({
          prompt: item,
          type: suggestTypeFromPrompt(item),
        })
      }
      return normalizeSurveyQuestion(item)
    })
    .filter((item): item is SurveyQuestion => Boolean(item))

  if (questions.length === 0) {
    throw new Error("Model returned no usable questions.")
  }

  return questions
}
