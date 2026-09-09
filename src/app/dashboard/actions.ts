"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves the caller's top ten.
 *
 * The whole list goes in one call. Reordering row by row would transiently
 * violate the unique constraint on (user_id, position) — moving #3 to #2
 * collides with the row already there — and the fix for that is not to relax
 * the constraint but to make the intermediate state never exist.
 *
 * No authorisation here on purpose: set_ranking runs as the caller, so the
 * table's own policies decide what it may touch, and it drops any coaster the
 * caller has not actually ridden.
 */
export async function saveRanking(coasterIds: string[]) {
  const supabase = await createClient();

  if (coasterIds.length > 10) {
    return { ok: false, message: "A top ten holds ten." };
  }

  const { error } = await supabase.rpc("set_ranking", { p_coaster_ids: coasterIds });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return { ok: true, message: "Saved." };
}
