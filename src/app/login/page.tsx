import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { CoasterMark } from "@/components/icons";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <div className="rise mx-auto max-w-sm py-10">
      <div className="mb-7 text-center">
        <span className="inline-block" style={{ color: "var(--brand)" }}>
          <CoasterMark size={30} />
        </span>
        <h1 className="display mt-3 text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          Sign in to log rides and see your stats.
        </p>
      </div>

      <div className="card p-6">
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>

      <p className="mt-6 text-center text-sm text-[var(--ink-2)]">
        No account yet?{" "}
        <Link href="/signup" className="font-medium" style={{ color: "var(--brand)" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
