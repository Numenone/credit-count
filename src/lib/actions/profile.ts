"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/actions/auth";

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters").max(40),
  leaderboardOptIn: z.boolean(),
  unitSystem: z.enum(["metric", "imperial"]),
});

/**
 * Updates the caller's own profile.
 *
 * `role` is not in this payload and could not be written even if it were: the
 * authenticated role only holds column-level UPDATE grants on display_name,
 * leaderboard_opt_in and unit_system, so privilege escalation is blocked in
 * Postgres rather than by this schema.
 */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    leaderboardOptIn: formData.get("leaderboardOptIn") === "on",
    unitSystem: formData.get("unitSystem") ?? "metric",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out." };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      leaderboard_opt_in: parsed.data.leaderboardOptIn,
      unit_system: parsed.data.unitSystem,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Opting out must take effect immediately (SOW 5.7), so the cached public
  // leaderboard is invalidated here rather than waiting for a revalidation window.
  revalidatePath("/leaderboard");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/rides");
  revalidatePath("/chase");
  return { message: "Settings saved." };
}
