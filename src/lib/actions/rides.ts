"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/actions/auth";

const today = () => new Date().toISOString().slice(0, 10);

const rideSchema = z.object({
  coasterId: z.uuid("Pick a coaster from the catalogue"),
  riddenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .refine((d) => d <= today(), "You cannot log a ride in the future"),
  note: z.string().trim().max(280, "Notes are limited to 280 characters").optional(),
});

/**
 * Every mutation below writes through the user's own session. The `user_id`
 * column defaults to auth.uid() and the RLS policies check it, so there is no
 * way to write a ride onto another account even by forging the form payload.
 */
export async function logRide(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = rideSchema.safeParse({
    coasterId: formData.get("coasterId"),
    riddenOn: formData.get("riddenOn") || today(),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("rides").insert({
    coaster_id: parsed.data.coasterId,
    ridden_on: parsed.data.riddenOn,
    note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/rides");
  return { message: "Ride logged." };
}

export async function updateRide(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("rideId"));
  const parsed = rideSchema.safeParse({
    coasterId: formData.get("coasterId"),
    riddenOn: formData.get("riddenOn"),
    note: formData.get("note") ?? undefined,
  });
  if (!id.success) return { error: "Unknown ride." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // No user_id filter needed: the RLS UPDATE policy scopes this to the caller's
  // own rows, so a forged rideId simply matches nothing.
  const { error, count } = await supabase
    .from("rides")
    .update(
      {
        coaster_id: parsed.data.coasterId,
        ridden_on: parsed.data.riddenOn,
        note: parsed.data.note || null,
      },
      { count: "exact" },
    )
    .eq("id", id.data);

  if (error) return { error: error.message };
  if (!count) return { error: "Ride not found." };

  revalidatePath("/dashboard");
  revalidatePath("/rides");
  return { message: "Ride updated." };
}

export async function deleteRide(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("rideId"));
  if (!id.success) return { error: "Unknown ride." };

  const supabase = await createClient();
  const { error } = await supabase.from("rides").delete().eq("id", id.data);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/rides");
  return { message: "Ride deleted." };
}
