import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 mb-6 text-sm text-[var(--color-ink-soft)]">
        Sign in to log rides and see your stats.
      </p>
      <div className="card p-6">
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
      <p className="mt-5 text-center text-sm text-[var(--color-ink-soft)]">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-[var(--color-accent)]">
          Sign up
        </Link>
      </p>
    </div>
  );
}
