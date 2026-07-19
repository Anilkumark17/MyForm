import Link from "next/link"

import { AuthForm } from "@/components/auth/auth-form"

type AuthShellProps = {
  mode: "login" | "signup"
}

export function AuthShell({ mode }: AuthShellProps) {
  const isLogin = mode === "login"

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between border-r border-border bg-black px-12 py-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_20%_0%,rgba(62,207,142,0.14),transparent_60%)]"
        />
        <Link
          href="/"
          className="relative font-heading text-xl font-semibold text-foreground"
        >
          Myform
        </Link>
        <div className="relative max-w-sm">
          <p className="font-heading text-3xl font-semibold leading-snug tracking-tight text-foreground">
            Forms that tell you which leads are real.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Adaptive questions, silent timing signals, and trust scores —
            without another bloated form builder.
          </p>
        </div>
        <p className="relative text-sm text-muted-foreground">
          Built for paid lead-gen teams
        </p>
      </aside>

      <main className="flex flex-col justify-center bg-background px-6 py-12">
        <div className="mx-auto w-full max-w-[380px]">
          <Link
            href="/"
            className="mb-10 inline-block font-heading text-xl font-semibold lg:hidden"
          >
            Myform
          </Link>

          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {isLogin ? "Sign in" : "Create account"}
            </h1>
            <p className="prose-muted mt-1.5">
              {isLogin
                ? "Access your projects and submission trust scores."
                : "Set up your first project in a few minutes."}
            </p>
          </div>

          <div className="mt-8">
            <AuthForm mode={mode} />
          </div>
        </div>
      </main>
    </div>
  )
}
