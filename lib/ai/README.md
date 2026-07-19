# Mom Test Question Generation

Prompting contract and runtime path for AI-generated customer discovery questions.

## Why this exists

Founders routinely write leading, hypothetical, or product-pitch questions. This module forces the model to produce **Mom Test–compliant** interview questions: past-tense, instance-specific, product-blind, and tied to a stated research objective.

If output drifts toward generic “tell me about your workflow” filler, treat that as a **prompt regression**, not a model quirk.

## Architecture

```
UI (GenerateQuestionsPanel)
  → server action generateProjectQuestions
    → generateMomTestQuestions()          # lib/ai/groq.ts
        ├── MOM_TEST_SYSTEM_PROMPT        # lib/ai/mom-test.ts  (policy)
        ├── buildMomTestUserPrompt(...)   # lib/ai/mom-test.ts  (context)
        └── Groq chat.completions
  → normalizeSurveyQuestion(...)          # schema / type safety
  → persist + OT broadcast (collab)
```

| File | Responsibility |
|------|----------------|
| `mom-test.ts` | System + user prompt strings. **Source of truth for question quality.** |
| `groq.ts` | Provider client, sampling params, JSON extraction, normalization. |
| `../survey/question-types.ts` | Allowed `type` IDs injected into the system prompt. |

Do not bury policy in `groq.ts`. Keep model I/O and Mom Test rules separated.

## Message roles

### System (`MOM_TEST_SYSTEM_PROMPT`)

Defines:

1. **Role** — expert Mom Test interviewer (Fitzpatrick).
2. **Primary failure mode** — generic discovery that ignores the objective.
3. **Hard rules** — no future/hypotheticals, no product hints, force concrete memories, dig into failed attempts, bind to objective.
4. **Bad → good patterns** — few-shot style constraints without overfitting to exact strings.
5. **Type guidance** — when to use `long_text`, numbers, `yes_no` + follow-up, etc.
6. **Silent self-check** — rewrite before emit.
7. **Output schema** — JSON array only, 6–8 objects.

### User (`buildMomTestUserPrompt`)

Injects per-project context:

- `RESEARCH_OBJECTIVE` ← project objectives  
- `ICP_DESCRIPTION` ← ICP  
- `PROJECT_NAME` ← project name  

Plus set-level requirements (story density, numeric probe, “what they tried”, realistic choice options).

`PROJECT_NAME` is for founder context only. The model must **not** turn it into product-pitch language in questions.

## Expected model output

```json
[
  {
    "prompt": "Last time X happened, what did you do first?",
    "type": "long_text",
    "options": [],
    "config": {}
  }
]
```

| Field | Rules |
|-------|--------|
| `prompt` | Exactly one question. Past / present instance. No product. |
| `type` | Must be in `QUESTION_TYPE_IDS`. |
| `options` | Realistic labels for choice/ranking/matrix types; otherwise `[]`. |
| `config` | Optional UI hints (`min`, `max`, `step`, labels, etc.). |

`groq.ts` tolerates markdown fences and string-only items, then normalizes through `normalizeSurveyQuestion`. Prefer teaching the model to emit clean JSON; parsers are a safety net, not the product.

## Runtime config

| Knob | Default | Notes |
|------|---------|--------|
| Model | `llama-3.3-70b-versatile` | Override with `GROQ_MODEL`. |
| API key | `GROQ_API` or `GROQ_API_KEY` | Required. |
| `temperature` | `0.65` | Higher than “safe” JSON defaults to reduce template phrasing. |
| `top_p` | `0.9` | Paired with temperature for controlled creativity. |

```env
GROQ_API=...
# Optional:
GROQ_MODEL=llama-3.1-8b-instant
```

Smaller models are cheaper/faster but regress more often into generic questions. Prefer 70B-class for generation quality.

## Quality bar (acceptance)

A generation is **good** when:

- [ ] Every question maps to the stated research objective (no filler).
- [ ] No future tense / “would you” / solution pitching.
- [ ] No product/feature naming or implication.
- [ ] Answers require a memory (date, tool, $, person, count) — not an adjective.
- [ ] ≥50% `long_text` story questions.
- [ ] ≥1 numeric / money / frequency probe.
- [ ] ≥1 “what did you already try / what happened” probe.
- [ ] Any `yes_no` is followed by a story `long_text`.
- [ ] Choice options are ICP-realistic (never “Option A”).

A generation is **bad** when it could be reused across unrelated ICPs with a find-replace of nouns.

## Editing the prompt (playbook)

1. Change copy in `mom-test.ts` only.
2. Regenerate against **2–3 real projects** (different ICPs / objectives).
3. Score against the checklist above.
4. If JSON breaks, tighten the `YOUR OUTPUT` section — don’t lower temperature first.
5. If questions get generic, strengthen failure-mode + BAD/GOOD + user-prompt requirements — don’t only swap models.
6. Keep diffs reviewable; prompt churn without eval is how quality silently dies.

### What not to do

- Don’t put ICP/objectives into the system prompt (they’re request-scoped).
- Don’t add “be creative” without constraints — creativity without Mom Test rules = clever hypotheticals.
- Don’t expand to 15+ questions; survey fatigue kills completion and trust scoring signal.

## Failure modes & ops

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `model_not_found` | Bad / gated `GROQ_MODEL` | Use `llama-3.3-70b-versatile` or `llama-3.1-8b-instant`. |
| Empty / non-JSON | Model ignored schema | Re-check output section; confirm parser still finds `[...]`. |
| Hypothetical questions | Prompt drift or weak model | Reassert rules 1–2; prefer larger model. |
| Generic set | Objective ignored | Strengthen user prompt “core belief” + checklist. |
| Product mentioned | Name leakage | Reinforce rule 2; avoid product jargon in objectives when possible. |

Generation also respects product limits (`generationCount` / free tier) in `lib/projects/actions.ts` — unrelated to prompt quality, but it gates how often this path runs.

## Related

- Methodology: *The Mom Test* — Rob Fitzpatrick  
- Question type catalog: `lib/survey/question-types.ts`  
- Normalization: `lib/survey/questions.ts`  
- Call site: `lib/projects/actions.ts` → `generateProjectQuestions`
