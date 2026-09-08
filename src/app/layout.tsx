import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Credit Count — track every rollercoaster you have ridden",
    template: "%s · Credit Count",
  },
  description:
    "Log every ride against a shared coaster catalogue, watch your credit count and stats, and appear on the public leaderboard only if you choose to.",
  openGraph: {
    title: "Credit Count",
    description: "A credit tracker for the rollercoaster enthusiast community.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint, so a dark-mode user
            never sees a white flash on navigation. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
          {children}
        </main>

        <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-[var(--ink-3)]">
            <p>
              Credit Count — a credit tracker for rollercoaster enthusiasts. Catalogue seeded from
              public RCDB records.
            </p>
            <p className="flex items-center gap-3">
              <Link href="/leaderboard" className="link-quiet">
                Leaderboard
              </Link>
              <span aria-hidden>·</span>
              <span>Your ride history is private by default.</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
