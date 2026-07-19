import type { Metadata } from "next"
import { Source_Sans_3, Sora } from "next/font/google"

import "./globals.css"

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const sora = Sora({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Myform — Verified lead forms",
  description:
    "Embeddable forms with adaptive questions and real-time fraud detection — so your team only follows up on real leads.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${sourceSans.variable} ${sora.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  )
}
