import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 mb-6 text-sm text-[var(--color-ink-soft)]">
        Start logging credits in under a minute.
      </p>
      <div className="card p-6">
        <SignupForm />
      </div>
      <p className="mt-5 text-center text-sm text-[var(--color-ink-soft)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--color-accent)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
