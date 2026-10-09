# Myform

Customer discovery platform for founders. Generates Mom Test interview questions, serves them as public/embeddable forms, supports real-time collaborative editing, and scores every submission for fraud so analysis runs on trustworthy signal.

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Database and migrations](#database-and-migrations)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Design decisions](#design-decisions)
- [Testing](#testing)
- [Production checklist](#production-checklist)
- [Contributing](#contributing)

## How it works

```text
Define ICP + research goal
  -> generate Mom Test questions (AI)
  -> edit collaboratively (real time)
  -> publish public / embed form
  -> collect responses
  -> score each submission (valid / flagged / rejected)
  -> export valid evidence (Excel)
```

## Features

- **AI question generation.** Prompts enforce Mom Test rules: past behavior, no pitching, anchored to the research goal.
- **Survey builder.** Multiple question types, conditional branching, flow graph view.
- **Public and embeddable forms.** Share a link (`/f/[formId]`) or embed with theme settings.
- **Collaborative editing.** Operation-based OT over SSE, with invitations and per-project roles.
- **Fraud scoring.** Timing z-scores (Welford), absolute time floor, answer entropy, and hard bot rules. Valid and fake traffic stay separated.
- **Analytics.** Response and comparison dashboards (Recharts).
- **Export.** Valid responses to `.xlsx`.
- **Free-tier limits.** Account and generation caps, plus an access-request flow with optional email notification.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/Base UI primitives, React Flow + dagre |
| Database | Neon Postgres via `@neondatabase/serverless` |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | bcryptjs, jose (JWT), DB-backed revocable sessions |
| AI | Groq chat completions |
| Validation | Zod |
| Export | SheetJS (`xlsx`) |
| Email (optional) | Resend |
| Tests | Node test runner via `tsx` |

> This repo uses a Next.js version with breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`). For example, route protection lives in `proxy.ts`, not `middleware.ts`.

## Getting started

**Prerequisites:** Node.js 20+, a Postgres database (Neon recommended), a Groq API key.

```bash
npm install
cp .env.example .env     # then fill in values
npm run db:push          # create schema (dev)
npm run dev              # http://localhost:3000
```

## Configuration

Copy `.env.example` to `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `AUTH_SECRET` | Yes | Signs session JWTs. Use a long random value. |
| `GROQ_API` / `GROQ_API_KEY` | Yes | Groq API key |
| `GROQ_MODEL` | No | Model override (default `llama-3.3-70b-versatile`) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Yes | Stable key for Server Actions. Generate with `openssl rand -base64 32`. |
| `RESEND_API_KEY` | No | Enables access-request emails |
| `RESEND_FROM_EMAIL` | No | Sender address for outbound email |

Never commit `.env`.

## Database and migrations

Tables: `users`, `sessions`, `projects`, `project_collaborators`, `project_ops`, `submissions`, `form_baselines`, `notifications`, `invitations`. Schema lives in `lib/db/schema.ts`.

- **Local/dev:** `npm run db:push` syncs the schema directly.
- **Existing databases:** apply the idempotent scripts in `scripts/` instead of pushing.

```bash
node scripts/migrate-projects.mjs
node scripts/migrate-submissions.mjs
node scripts/migrate-submission-source.mjs
node scripts/migrate-fraud-welford.mjs
node scripts/migrate-fraud-mean-batch.mjs
node scripts/migrate-scoring-details.mjs
node scripts/migrate-generation-count.mjs
node scripts/migrate-access-request.mjs
node scripts/migrate-invitations.mjs
node scripts/migrate-notifications.mjs
node scripts/migrate-collab.mjs
```

Diagnostics: `scripts/check-collab-schema.mjs`, `scripts/probe-user-projects.mjs`.

## Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Fraud, collab (OT), and survey tests |
| `npm run test:fraud` | Fraud tests only |
| `npm run test:ot` | Collaboration transform tests only |
| `npm run test:fraud-accuracy` | Fraud scoring accuracy report |
| `npm run db:generate` / `db:push` / `db:studio` | Drizzle tooling |

## Architecture

```text
proxy.ts                    auth gate: /dashboard requires session, /login|/signup redirect when signed in
app/
  page.tsx                  landing
  login|signup/             auth pages
  dashboard/                workspace, project create/detail
  f/[formId]/               public form
  api/
    forms/[formId]          form config for public/embed
    submissions             submission intake + fraud scoring
    collab/[projectId]/     ops (write) and stream (SSE)
lib/
  ai/                       prompt policy (mom-test.ts) and Groq transport (groq.ts)
  auth/                     sessions, password hashing, usage limits
  collab/                   OT transform/apply, hub, access
  fraud/                    scoring, Welford stats, baseline, entropy, composite score
  projects/                 actions, queries, access, invitations, analytics, export
  survey/                   question types, branching, validation, flow graph
  forms/                    embed theme, settings, local drafts
  notifications/, email/    fake-flag alerts, access-request email
  db/                       schema and client
components/                 auth, dashboard, landing, layout, public, ui
hooks/                      use-question-collab, use-mobile
scripts/                    migration and diagnostic scripts
```

Module-level docs: [`lib/ai/README.md`](lib/ai/README.md).

## Design decisions

1. **Signal quality over volume.** Fraud scoring is part of intake, not a post-processing step.
2. **Explicit trust boundaries.** Public input is untrusted. Zod validation and fraud checks run at the API boundary before data counts as signal.
3. **Policy separate from transport.** Mom Test rules (`mom-test.ts`) are product logic. The Groq client (`groq.ts`) is replaceable. Weak output means a prompt regression, so fix the prompt.
4. **Fraud baseline before judgment.** The first `MIN_SAMPLES` (15) clean responses build the survey's timing baseline and are never labeled fake. After that, faster-than-mean completions (negative z) are flagged, and z below -1.5 is rejected. Mean/std refresh every 15 clean responses over a 200-sample rolling window. Constants: `lib/fraud/constants.ts`.
5. **OT instead of CRDT.** Question sets are ordered lists with small edits. Operation transform over SSE is simpler and enough here. Ops are persisted in `project_ops` with revision tracking.
6. **Compact architecture.** Direct DB access and explicit server actions. Add layers only when needed.

## Testing

Tests cover the highest-risk logic:

- fraud scoring, Welford stats, baseline readiness, bot detection, fake-response gating
- OT transform/apply correctness
- survey branching and validation

```bash
npm test
```

There are no end-to-end or API route tests yet. Run `npm run lint` and `npm run build` before merging.

## Production checklist

- Rotate secrets and review access to `AUTH_SECRET`, DB credentials, and API keys.
- Add rate limiting on `/api/submissions` and public form endpoints (not implemented).
- Define Postgres backup and retention policy.
- Add observability for AI failures and slow requests.
- Review SSE collaboration scaling. The in-memory hub (`lib/collab/hub.ts`) does not span multiple instances.
- Use least-privilege DB credentials.

## Security and privacy

- Sessions are signed and revocable (stored in `sessions`).
- Respondents never see fraud classification.
- Treat project and response data as customer-sensitive.

## Contributing

Keep changes focused and test what you touch. Review closely for:

- prompt constraints and generation quality
- fraud baseline and scoring correctness
- collaborative revision handling
- migration safety and backward compatibility (add a script in `scripts/` for every schema change)

## License

Private and unpublished. Confirm license terms before publishing or deploying externally.
