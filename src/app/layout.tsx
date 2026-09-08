import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Credit Count",
    template: "%s · Credit Count",
  },
  description:
    "Track the rollercoasters you have ridden, see your stats, and compare credits on the public leaderboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
        <footer className="border-t border-[var(--color-line)] px-5 py-5 text-center text-xs text-[var(--color-ink-faint)]">
          Credit Count — a credit tracker for rollercoaster enthusiasts. Catalogue data seeded from
          public RCDB records.
        </footer>
      </body>
    </html>
  );
}
