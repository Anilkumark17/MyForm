# Myform

Customer-discovery forms built for founders who need **Mom Test–quality questions**, **fraud-aware responses**, and **real-time collaboration** — without paying to chase bot leads.

Create a project → generate interview questions from ICP + research objective → embed or share a public form → review valid submissions in tables/charts/Excel while fake traffic stays quarantined.

---

## Table of contents

1. [Product overview](#product-overview)
2. [Tech stack](#tech-stack)
3. [Methodologies](#methodologies)
4. [Features](#features)
5. [Engineering decisions](#engineering-decisions)
6. [Architecture](#architecture)
7. [Getting started](#getting-started)
8. [Environment variables](#environment-variables)
9. [Scripts & migrations](#scripts--migrations)
10. [Routes](#routes)
11. [Testing](#testing)
12. [Further reading](#further-reading)

---

## Product overview

| Persona | Job to be done |
|---------|----------------|
| Founder / PM | Run structured discovery without leading interviewees |
| Team collaborator | Co-edit the same question set live |
| Ops / research | Trust analytics after bots and speed-runners are filtered |

**Core loop**

```
Project (ICP + objectives)
  → AI Mom Test questions (or manual editor)
  → Public / embed form `/f/[formId]`
  → Submissions scored (Welford z-score + hard rules)
  → Valid output (insights, table, Excel) vs Flagged fake
```

---

## Tech stack

| Layer | Choice | Version / notes |
|-------|--------|-----------------|
| Framework | Next.js (App Router) | `16.2.10` |
| UI | React | `19.2.4` |
| Language | TypeScript | `^5` |
| Styling | Tailwind CSS v4 + shadcn / Base UI | `tailwindcss ^4`, `shadcn`, `@base-ui/react` |
| Icons / UX | Lucide, Sonner | — |
| Database | Neon Postgres (serverless HTTP) | `@neondatabase/serverless ^1.1` |
| ORM | Drizzle ORM + Drizzle Kit | `drizzle-orm ^0.45`, `drizzle-kit ^0.31` |
| Auth | bcryptjs + jose JWT cookie + DB sessions | cost 12; `myform_session` |
| Validation | Zod | `^4.4` |
| AI | Groq Chat Completions (HTTP, no SDK) | default `llama-3.3-70b-versatile` |
| Charts | Recharts | `^3.8` |
| Excel | SheetJS (`xlsx`) | `^0.18` |
| Email (optional) | Resend HTTP API | access-request / fake-flag mail |
| Tests | Node test runner via `tsx` | fraud + OT unit tests |

Schema source of truth: `lib/db/schema.ts`. Client: `lib/db/index.ts`.

---

## Methodologies

### 1. Mom Test question generation (Rob Fitzpatrick)

AI questions are constrained to **past instances**, **no product pitching**, and **objective-bound** discovery. Prompt policy lives separately from the Groq transport layer.

- Policy: `lib/ai/mom-test.ts`
- Client / parse / normalize: `lib/ai/groq.ts`
- Prompt ops docs: [`lib/ai/README.md`](./lib/ai/README.md)

### 2. Welford online statistics + z-score fraud

Per-survey completion-time baseline:

- Running mean / M2 on clean submissions
- Rolling window (last 200 times), rebuilt from the window for correctness
- **First 15** clean samples build baseline — **no fake labels**
- Mean / std **refresh every 15** clean samples (not every response)
- From sample **16+**, negative z-score ⇒ flagged fake; stricter reject threshold for extreme outliers
- Hard gates: honeypot, &lt;1.5s completion, absolute time floor, straight-lining entropy

Core: `lib/fraud/*` (`constants.ts`, `welford.ts`, `score-submission.ts`, `process-submission.ts`).

### 3. Operational Transformation (OT) collaboration

Google Docs–style concurrent editing on the **question list** (not character-level CRDT):

- Ops: `insert` · `delete` · `update` · `move` · `replace_all`
- Server transforms client ops against concurrent revisions
- Revision counter + `project_ops` log
- Real-time fan-out via SSE (`/api/collab/.../stream`)

Core: `lib/collab/*`, `hooks/use-question-collab.ts`.

### 4. Free-tier product limits

| Resource | Free cap |
|----------|----------|
| Projects | 2 |
| AI generations | 4 |

Allowlisted accounts are unlimited. Hitting a limit can email an access request (once) when Resend is configured.

`lib/auth/account-limits.ts`, `lib/auth/account-usage.ts`, `lib/email/access-request.ts`.

### 5. Valid vs fake data separation

Flagged / rejected submissions are **excluded** from charts, the primary table, and the Excel “Valid responses” sheet. They remain inspectable under **Flagged fake**.

`lib/projects/submission-filters.ts`.

---

## Features

### Auth
- Email / password sign-up and sign-in
- HttpOnly signed JWT cookie with revocable DB session rows (14-day expiry)
- Dashboard routes require a session

### Projects
- Create projects; capture ICP + research objectives
- Workspace tabs: **Questions · Responses · Invite · Embed · Trust · Overview**
- Owned projects + **shared** projects (accepted invites) on the dashboard

### AI + question editor
- Generate 6–8 Mom Test questions from ICP / objectives
- Full survey type catalog (text, choice, scales, date, currency, comparison-choice, …)
- Manual edit, regenerate, save
- Comparison-choice option media + analytics

### Public / embed forms
- Public URL: `/f/[formId]`
- Silent client timing + honeypot (respondents never see scores)
- Optional UTM / source capture
- Local draft resume (`localStorage`)
- Themeable embed (light/dark/transparent, colors, compact, hide chrome)

### Responses & analytics
- Insights (Recharts): quality pie, timeline, z-score bars, answer breakdowns
- Table view of valid submissions
- Separate flagged-fake table
- Excel export (`Valid responses` + `Flagged fake` sheets)

### Fraud / trust
- Trust tab: baseline readiness, Welford stats, scoring explanations
- Statuses: `insufficient_data` · `normal` · `flagged` · `rejected`
- Trust score + z-score persisted per submission

### Invites & collaboration
- Owner invites by email
- Invitee sees invites on dashboard → Accept / Decline
- Accept grants `project_collaborators` editor access
- Live OT sync + presence while editing questions

### Account usage UI
- Header badges: projects used / AI generations remaining
- Limit messaging when free caps are hit

---

## Engineering decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js App Router + Server Actions** | Colocate UI with mutations; keep secrets on the server; simple deploy path (Vercel-friendly). |
| **Drizzle + Neon HTTP** | Typed schema, lightweight serverless Postgres, no always-on connection pooler required for the app process. |
| **Custom auth (bcrypt + jose + sessions table)** | Full control, minimal surface, revocable sessions without adopting a full Auth.js stack for v1. |
| **Prompt / transport split** (`mom-test.ts` vs `groq.ts`) | Question quality is a product policy artifact; model I/O and JSON repair stay replaceable. |
| **Welford + batched mean updates** | Online stats without rewriting history every row; freezing the mean for 15 samples reduces self-contamination and noise. |
| **Z-score as USP after baseline** | First 15 establish peers; labeling before that creates false confidence. Negative z = faster than peers ⇒ fake for this product. |
| **Public submit API hides fraud fields** | Respondents must not learn they were flagged; dashboard is the only inspection surface. |
| **OT for question lists (not full CRDT)** | Small, ordered document; server-authoritative revisions are enough for multiplayer editing without Yjs infrastructure. |
| **SSE for collab fan-out** | Works in a Node Next.js process with cookie auth; acceptable for single-instance / early multiplayer. Multi-region would need shared pub/sub later. |
| **xlsx client export** | No export microservice; founders download immediately from the dashboard. |
| **Imperative SQL migrate scripts** | Fast iteration on Neon without blocking on full Drizzle migration history during product discovery. Prefer `db:generate` / `db:push` for greenfield; scripts under `scripts/` for incremental prod columns. |
| **Zod at boundaries** | Validate public POST bodies and form actions; keep trust boundaries thin. |

---

## Architecture

```
app/
  page.tsx                 Landing
  login|signup/            Auth
  dashboard/               Authenticated product shell
  f/[formId]/             Public form
  api/
    forms/[formId]/       Public form JSON
    submissions/           Ingest + fraud pipeline
    collab/[projectId]/   OT stream + ops

lib/
  ai/                      Mom Test prompts + Groq
  auth/                    Sessions, limits, passwords
  collab/                  OT transform / apply / hub
  fraud/                   Welford, scoring, process
  projects/                Actions, queries, export, invites
  survey/                  Question types + normalization
  forms/                   Embed theme, drafts
  db/                      Drizzle schema + client

components/
  dashboard/               Workspace UI
  public/                  Public form
  landing/                 Marketing
```

**Data model (high level)**

- `users` — account, `generation_count`, access-request stamp  
- `sessions` — revocable login tokens  
- `projects` — owner, ICP, objectives, questions JSON, Welford stats, `questions_revision`  
- `submissions` — answers, timing, fraud fields  
- `invitations` / `project_collaborators` — sharing  
- `project_ops` — OT history  
- `form_baselines` — legacy / auxiliary baseline rows  
- `notifications` — optional alerts table (fake flags not shown on dashboard UI)

---

## Getting started

### Prerequisites

- Node.js 20+
- Neon (or any Postgres) database
- Groq API key

### Install & run

```bash
cd my-app
npm install
cp .env.example .env
# fill DATABASE_URL, AUTH_SECRET, GROQ_API, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

# Apply incremental SQL migrations (see scripts/ below), e.g.:
node scripts/migrate-projects.mjs
node scripts/migrate-fraud-welford.mjs
node scripts/migrate-fraud-mean-batch.mjs
node scripts/migrate-generation-count.mjs
node scripts/migrate-access-request.mjs
node scripts/migrate-invitations.mjs
node scripts/migrate-notifications.mjs
node scripts/migrate-collab.mjs

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Alternatively, for a clean schema push:

```bash
npm run db:push
```

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Neon / Postgres connection string |
| `AUTH_SECRET` | Yes | JWT signing secret |
| `GROQ_API` or `GROQ_API_KEY` | Yes | Groq API key for question generation |
| `GROQ_MODEL` | No | Override model (default `llama-3.3-70b-versatile`) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Yes | Next.js server actions encryption |
| `RESEND_API_KEY` | No | Email access requests / optional fake-flag mail |
| `RESEND_FROM_EMAIL` | No | From address (defaults to Resend onboarding sender) |

See `.env.example`.

---

## Scripts & migrations

### npm

| Script | Command |
|--------|---------|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |
| `npm run db:generate` | Drizzle generate |
| `npm run db:push` | Push schema |
| `npm run db:studio` | Drizzle Studio |
| `npm test` | Fraud unit tests |

### SQL helpers (`scripts/`)

Run with `node` (loads `.env` via `dotenv`):

| Script | Adds |
|--------|------|
| `migrate-projects.mjs` | Project ICP / objectives / questions |
| `migrate-submissions.mjs` | Submissions table evolution |
| `migrate-scoring-details.mjs` | Scoring details JSON |
| `migrate-submission-source.mjs` | Source / UTM column |
| `migrate-fraud-welford.mjs` | Welford columns |
| `migrate-fraud-mean-batch.mjs` | Pending-since-mean batching |
| `migrate-generation-count.mjs` | User generation counter |
| `migrate-access-request.mjs` | Access-request timestamp |
| `migrate-invitations.mjs` | Invitations |
| `migrate-notifications.mjs` | Notifications |
| `migrate-collab.mjs` | Collaborators, ops, `questions_revision` |

---

## Routes

### Pages

| Path | Description |
|------|-------------|
| `/` | Marketing landing |
| `/login`, `/signup` | Auth |
| `/dashboard` | Projects, invites, usage |
| `/dashboard/projects/new` | Create project |
| `/dashboard/projects/[id]` | Project workspace |
| `/f/[formId]` | Public / embeddable form |

### API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/forms/[formId]` | Public form definition |
| `POST` | `/api/submissions` | Accept submission (no fraud fields returned) |
| `GET` | `/api/collab/[projectId]/stream` | SSE: snapshot, ops, presence |
| `POST` | `/api/collab/[projectId]/ops` | Submit OT operation |

---

## Testing

```bash
npm test
# fraud scoring + Welford

npx tsx --test lib/collab/__tests__/ot.test.ts
# OT transform convergence
```

Manual QA checklist:

1. Generate questions for a real ICP/objective — score against Mom Test bar (`lib/ai/README.md`).
2. Submit &lt;15 responses — none labeled fake (except honeypot / instant bot).
3. Submit fast outliers after baseline — appear under Flagged fake; excluded from Valid Excel.
4. Invite a second user — both see the project; question edits sync live.
5. Hit free generation / project caps on a non-allowlisted account.

---

## Further reading

- Prompt contract & quality bar: [`lib/ai/README.md`](./lib/ai/README.md)
- Mom Test methodology: Rob Fitzpatrick, *The Mom Test*
- Welford’s online algorithm: standard running mean / M2 formulation in `lib/fraud/welford.ts`
- OT overview: transform concurrent ops so replicas converge without last-write-wins

---

## License

Private / unpublished — all rights reserved unless otherwise noted.
