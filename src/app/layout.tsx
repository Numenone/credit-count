import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CoasterScene } from "@/components/coaster-scene";
import { themeScript, motionScript } from "@/lib/appearance";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by the proxy, one value per request. Without it the inline script below
  // would be blocked by our own Content-Security-Policy — which is the point.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        {/*
          Applies the stored theme and motion preference before the page paints.

          This lives at the top of <body>, not inside a <head> element. A manual
          <head> in the App Router root layout is not a supported insertion point
          — Next owns that element, and the script was being dropped from the
          server HTML entirely. The symptom was specific and misleading: the
          toggle read "light" from localStorage and looked correct, while the
          page rendered dark because the attribute the stylesheet reads was
          never set.
        */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript + motionScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-5 sm:py-8 2xl:max-w-7xl">
          {children}
        </main>

        {/* Breathing room, then the ride. Full-bleed on purpose: the scene is
            the one element that should not sit inside the content column. */}
        <div className="mt-16" />
        <CoasterScene />

        <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-[var(--ink-3)] sm:px-5 2xl:max-w-7xl">
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
