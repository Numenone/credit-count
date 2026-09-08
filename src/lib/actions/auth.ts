"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  message?: string;
}

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(40),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Read by the on_auth_user_created trigger to seed the profile row.
    options: { data: { display_name: parsed.data.displayName } },
  });

  if (error) return { error: error.message };

  // With email confirmation off (see TDD), sign-up returns an active session.
  redirect("/dashboard");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Deliberately generic: do not reveal whether the address has an account.
  if (error) return { error: "Email or password is incorrect." };

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
