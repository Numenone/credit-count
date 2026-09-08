import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";
import { CoasterMark } from "@/components/icons";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="rise mx-auto max-w-sm py-10">
      <div className="mb-7 text-center">
        <span className="inline-block" style={{ color: "var(--brand)" }}>
          <CoasterMark size={30} />
        </span>
        <h1 className="display mt-3 text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          Start logging credits in under a minute.
        </p>
      </div>

      <div className="card p-6">
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-sm text-[var(--ink-2)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium" style={{ color: "var(--brand)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
