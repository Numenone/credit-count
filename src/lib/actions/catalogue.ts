"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/actions/auth";

/** Empty form fields arrive as "" and mean "no value", not zero. */
const optionalNumber = (max: number, label: string) =>
  z
    .union([z.literal(""), z.coerce.number().positive(`${label} must be positive`).max(max)])
    .transform((v) => (v === "" ? null : v));

const coasterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  park: z.string().trim().min(1, "Park is required").max(120),
  country: z.string().trim().min(1, "Country is required").max(60),
  manufacturer: z.string().trim().min(1, "Manufacturer is required").max(80),
  type: z.enum(["Steel", "Wooden", "Hybrid"]),
  height_m: optionalNumber(999, "Height"),
  length_m: optionalNumber(99999, "Track length"),
  speed_kmh: optionalNumber(999, "Top speed"),
  inversions: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(99)])
    .transform((v) => (v === "" ? null : v)),
  opened_year: z
    .union([z.literal(""), z.coerce.number().int().min(1884, "No coasters before 1884").max(2100)])
    .transform((v) => (v === "" ? null : v)),
  park_city: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v || null),
  park_url: z
    .union([z.literal(""), z.url("Park website must be a URL").startsWith("https://", "Use https://")])
    .transform((v) => (v === "" ? null : v)),
  latitude: z
    .union([z.literal(""), z.coerce.number().min(-90).max(90)])
    .transform((v) => (v === "" ? null : v)),
  longitude: z
    .union([z.literal(""), z.coerce.number().min(-180).max(180)])
    .transform((v) => (v === "" ? null : v)),
});

function readCoaster(formData: FormData) {
  const field = (name: string) => (formData.get(name) ?? "") as string;
  return coasterSchema.safeParse({
    name: field("name"),
    park: field("park"),
    country: field("country"),
    manufacturer: field("manufacturer"),
    type: field("type"),
    height_m: field("height_m"),
    length_m: field("length_m"),
    speed_kmh: field("speed_kmh"),
    inversions: field("inversions"),
    opened_year: field("opened_year"),
    park_city: field("park_city"),
    park_url: field("park_url"),
    latitude: field("latitude"),
    longitude: field("longitude"),
  });
}

/**
 * Catalogue writes. These actions carry no role check of their own by design —
 * the "coasters: admin *" RLS policies are the single place that decides, so an
 * enthusiast POSTing straight to PostgREST is refused by the same rule that
 * refuses them here (SOW 5.8).
 */
export async function createCoaster(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readCoaster(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("coasters").insert(parsed.data);

  if (error) return { error: friendly(error.code, error.message) };

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { message: `${parsed.data.name} added.` };
}

export async function updateCoaster(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("coasterId"));
  const parsed = readCoaster(formData);
  if (!id.success) return { error: "Unknown coaster." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("coasters")
    .update(parsed.data, { count: "exact" })
    .eq("id", id.data);

  if (error) return { error: friendly(error.code, error.message) };
  if (!count) return { error: "Not permitted." };

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { message: `${parsed.data.name} updated.` };
}

export async function deleteCoaster(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("coasterId"));
  if (!id.success) return { error: "Unknown coaster." };

  const supabase = await createClient();
  const { error } = await supabase.from("coasters").delete().eq("id", id.data);

  if (error) return { error: friendly(error.code, error.message) };

  revalidatePath("/admin");
  return { message: "Coaster removed." };
}

function friendly(code: string | undefined, fallback: string) {
  // 23505 unique_violation — the (name, park) index that stops duplicate entries.
  if (code === "23505") return "That coaster already exists for this park.";
  // 23503 foreign_key_violation — rides reference the coaster (on delete restrict).
  if (code === "23503") {
    return "This coaster has rides logged against it and cannot be deleted. Edit it instead.";
  }
  // 42501 insufficient_privilege / empty RLS result — non-admin caller.
  if (code === "42501") return "Only admins can change the catalogue.";
  return fallback;
}
