import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 border-b border-transparent bg-background/40 backdrop-blur-md">
      <div className="page flex h-16 items-center justify-between">
        <Link
          href="/"
          className="font-heading text-[1.35rem] font-semibold tracking-tight text-foreground"
        >
          Myform
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "sm" }), "h-8 px-3")}
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
