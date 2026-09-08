"use client";

import { useActionState } from "react";
import { signUp, type FormState } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          minLength={2}
          maxLength={40}
          autoComplete="nickname"
          className="field"
          placeholder="How you appear on the leaderboard"
        />
      </div>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field"
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">At least 8 characters.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-xs leading-relaxed text-[var(--color-ink-faint)]">
        Your ride history is private. You will not appear on the leaderboard unless you turn that on
        in Settings.
      </p>
    </form>
  );
}
