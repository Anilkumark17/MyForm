import Link from "next/link"

import { SiteHeader } from "@/components/landing/site-header"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const problems = [
  {
    title: "Paid traffic, unpaid waste",
    body: "A large share of lead-gen submissions are bots or low-intent noise. Most tools still treat every row as equal.",
  },
  {
    title: "Sales pays the tax",
    body: "Reps burn cycles on names that never existed. Pipeline looks full; conversion tells the truth later.",
  },
  {
    title: "Forms are blind",
    body: "Builders collect answers. Almost none score whether those answers were left by a real person.",
  },
]

const steps = [
  {
    n: "1",
    title: "Publish a form",
    body: "Create a project, generate Mom Test questions, and share a link or embed.",
  },
  {
    n: "2",
    title: "Collect with signal",
    body: "Timing, pacing, and honeypots are measured quietly as people answer.",
  },
  {
    n: "3",
    title: "Act on trust",
    body: "Each submission gets a trust score and flag — before it lands in your CRM.",
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero — one composition: brand, headline, sentence, CTAs, visual plane */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(62,207,142,0.12),transparent_55%),linear-gradient(180deg,#0a0a0a_0%,#0f0f0f_50%,#111111_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:28px_28px]"
        />

        <div className="page relative grid min-h-[100svh] items-end gap-10 pb-16 pt-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-20">
          <div className="fade-up max-w-xl">
            <p className="font-heading text-5xl font-semibold tracking-tight sm:text-6xl">
              Myform
            </p>
            <h1 className="mt-5 font-heading text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl">
              Stop paying for fake leads
            </h1>
            <p className="prose-muted mt-4 max-w-md">
              Embeddable forms that ask sharper questions and score every
              submission for fraud — so sales only follows up on real people.
            </p>
            <div className="fade-up-delay mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
              >
                Start free
              </Link>
              <a
                href="#how"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-10 px-4"
                )}
              >
                How it works
              </a>
            </div>
          </div>

          {/* Dominant visual: full-bleed form plane, not a floating product card */}
          <div className="fade-up-delay-2 relative -mx-5 min-h-[320px] border-y border-border bg-card sm:mx-0 sm:min-h-[420px] sm:border lg:min-h-[480px]">
            <div className="flex h-full flex-col justify-between p-6 sm:p-8">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--brand-signal)]">
                  Live form
                </p>
                <p className="mt-3 font-heading text-2xl font-semibold tracking-tight">
                  Qualify this lead
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Answers stay on-device until submit. Timing is measured silently.
                </p>
              </div>

              <div className="mt-8 space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    What triggered you to look for a solution now?
                  </p>
                  <div className="h-20 rounded-md border border-input bg-background/80" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    How are you handling this today?
                  </p>
                  <div className="h-9 rounded-md border border-input bg-background/80" />
                </div>
                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Trust scoring runs on submit
                  </p>
                  <div className="h-9 w-28 rounded-md bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem — one job */}
      <section className="border-t border-border bg-card py-20">
        <div className="page">
          <p className="eyebrow">The cost</p>
          <h2 className="mt-3 max-w-2xl font-heading text-3xl font-semibold tracking-tight">
            You&apos;re buying clicks. Too many of them aren&apos;t people.
          </h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {problems.map((item) => (
              <div key={item.title} className="border-t border-border pt-5">
                <h3 className="font-heading text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="prose-muted mt-3">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities — one job */}
      <section className="border-t border-border py-20">
        <div className="page grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="eyebrow">Adaptive questions</p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
              Better signal, not longer forms
            </h2>
            <p className="prose-muted mt-4 max-w-md">
              Generate Mom Test interview questions from your ICP and
              objectives. Edit types, options, and wording before you publish.
            </p>
          </div>
          <div>
            <p className="eyebrow">Fraud detection</p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
              Score every submission on the way in
            </h2>
            <p className="prose-muted mt-4 max-w-md">
              Instant rules catch obvious abuse. Z-score baselines learn normal
              pacing for your form, then flag outliers — with a breakdown you
              can audit.
            </p>
          </div>
        </div>
      </section>

      {/* How — one job */}
      <section id="how" className="border-t border-border bg-secondary py-20">
        <div className="page">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
            From embed to verified lead
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n} className="border-t border-border pt-5">
                <span className="font-heading text-sm font-medium text-[var(--brand-signal)]">
                  {step.n}
                </span>
                <h3 className="mt-3 font-heading text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="prose-muted mt-3">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Audience + CTA — one job */}
      <section className="border-t border-border py-20">
        <div className="page flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Who it&apos;s for</p>
            <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
              Growth teams tired of guessing which leads deserve a call
            </h2>
            <p className="prose-muted mt-4">
              Built for paid lead-gen campaigns where every fake submission
              costs ad budget and sales time.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
            >
              Create account
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-10 px-4"
              )}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="page flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-heading text-lg font-semibold">Myform</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Verified lead forms for teams who care about quality.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Myform
          </p>
        </div>
      </footer>
    </div>
  )
}
