/**
 * Bypasses the UI entirely and calls Supabase directly with the anon key, the
 * way an attacker with a browser devtools console would. Every check asserts
 * that Postgres — not the Next.js layer — is what refuses the request.
 *
 * Run: node --env-file=.env.local scripts/verify-security.mjs
 *
 * Covers SOW acceptance criteria 2, 3 and 4, and functional requirements 6-9.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.");
  process.exit(1);
}

const anonClient = () => createClient(url, anonKey);

async function signedIn(email, password) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

let failures = 0;
function check(name, passed, detail = "") {
  const mark = passed ? "PASS" : "FAIL";
  if (!passed) failures++;
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const env = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k} in the environment. See .env.example.`);
    process.exit(1);
  }
  return v;
};

console.log("\nCredit Count — database-level security checks\n");

// ---------------------------------------------------------------- visitors --
console.log("Visitor (anon key, not signed in)");
{
  const anon = anonClient();

  const leaderboard = await anon.from("leaderboard").select("*");
  check(
    "can read the public leaderboard",
    !leaderboard.error,
    leaderboard.error?.message ?? `${leaderboard.data.length} rows`,
  );

  const leaked = (leaderboard.data ?? []).some((row) =>
    Object.keys(row).some((k) => !["display_name", "credits", "rank"].includes(k)),
  );
  check("leaderboard exposes only display_name, credits and rank", !leaked);

  const rides = await anon.from("rides").select("*");
  check("cannot read any rides", (rides.data ?? []).length === 0, rides.error?.message ?? "0 rows");

  const coasters = await anon.from("coasters").select("*");
  check(
    "cannot read the catalogue",
    (coasters.data ?? []).length === 0,
    coasters.error?.message ?? "0 rows",
  );

  const profiles = await anon.from("profiles").select("*");
  check(
    "cannot read profiles",
    (profiles.data ?? []).length === 0,
    profiles.error?.message ?? "0 rows",
  );
}

// ------------------------------------------------------------- enthusiasts --
console.log("\nEnthusiast A vs Enthusiast B");
const a = await signedIn(env("E2E_ENTHUSIAST_EMAIL"), env("E2E_ENTHUSIAST_PASSWORD"));
const b = await signedIn(env("E2E_SECOND_USER_EMAIL"), env("E2E_SECOND_USER_PASSWORD"));
{
  const ownRides = await a.client.from("rides").select("id, user_id");
  check("A can read their own rides", !ownRides.error, `${ownRides.data?.length ?? 0} rows`);

  const foreign = await b.client.from("rides").select("*").eq("user_id", a.userId);
  check(
    "B cannot read A's rides by user_id",
    (foreign.data ?? []).length === 0,
    foreign.error?.message ?? "0 rows",
  );

  const allRides = await b.client.from("rides").select("user_id");
  const onlyOwn = (allRides.data ?? []).every((r) => r.user_id === b.userId);
  check("B's unfiltered ride query returns only B's rows", onlyOwn);

  const targetRide = ownRides.data?.[0];
  if (targetRide) {
    const hijack = await b.client
      .from("rides")
      .update({ note: "hijacked" }, { count: "exact" })
      .eq("id", targetRide.id);
    check("B cannot edit A's ride", (hijack.count ?? 0) === 0, hijack.error?.message ?? "0 rows");

    const wipe = await b.client
      .from("rides")
      .delete({ count: "exact" })
      .eq("id", targetRide.id);
    check("B cannot delete A's ride", (wipe.count ?? 0) === 0, wipe.error?.message ?? "0 rows");
  } else {
    check("B cannot edit A's ride", false, "A has no rides to test against — log one first");
  }

  const forged = await a.client
    .from("rides")
    .insert({ user_id: b.userId, coaster_id: (await anyCoasterId(a.client)) ?? null, ridden_on: "2026-01-01" });
  check("A cannot write a ride onto B's account", Boolean(forged.error), forged.error?.message);

  const otherProfile = await a.client.from("profiles").select("*").eq("id", b.userId);
  check(
    "A cannot read B's profile row",
    (otherProfile.data ?? []).length === 0,
    otherProfile.error?.message ?? "0 rows",
  );
}

// ------------------------------------------------------- catalogue writing --
console.log("\nCatalogue permissions");
{
  const attempt = await a.client.from("coasters").insert({
    name: `Unauthorised ${Date.now()}`,
    park: "Nowhere",
    country: "Testland",
    manufacturer: "Nobody",
    type: "Steel",
  });
  check("enthusiast cannot add a coaster", Boolean(attempt.error), attempt.error?.message);

  const id = await anyCoasterId(a.client);
  const edit = await a.client
    .from("coasters")
    .update({ name: "Renamed by an enthusiast" }, { count: "exact" })
    .eq("id", id);
  check("enthusiast cannot edit a coaster", (edit.count ?? 0) === 0, edit.error?.message ?? "0 rows");

  const remove = await a.client.from("coasters").delete({ count: "exact" }).eq("id", id);
  check(
    "enthusiast cannot delete a coaster",
    (remove.count ?? 0) === 0,
    remove.error?.message ?? "0 rows",
  );

  const escalate = await a.client
    .from("profiles")
    .update({ role: "admin" }, { count: "exact" })
    .eq("id", a.userId);
  check(
    "enthusiast cannot promote themselves to admin",
    Boolean(escalate.error) || (escalate.count ?? 0) === 0,
    escalate.error?.message ?? "no rows updated",
  );

  const stillEnthusiast = await a.client.from("profiles").select("role").eq("id", a.userId).single();
  check("A's role is still 'enthusiast'", stillEnthusiast.data?.role === "enthusiast");
}

// ------------------------------------------------------------------ admins --
if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
  console.log("\nAdmin");
  const admin = await signedIn(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  const name = `Verification Coaster ${Date.now()}`;
  const created = await admin.client
    .from("coasters")
    .insert({
      name,
      park: "Verification Park",
      country: "Testland",
      manufacturer: "Test Works",
      type: "Steel",
    })
    .select()
    .single();
  check("admin can add a coaster", !created.error, created.error?.message);

  if (created.data) {
    const renamed = await admin.client
      .from("coasters")
      .update({ name: `${name} (edited)` }, { count: "exact" })
      .eq("id", created.data.id);
    check("admin can edit a coaster", (renamed.count ?? 0) === 1, renamed.error?.message);

    const removed = await admin.client
      .from("coasters")
      .delete({ count: "exact" })
      .eq("id", created.data.id);
    check("admin can remove a coaster", (removed.count ?? 0) === 1, removed.error?.message);
  }

  const adminSnooping = await admin.client.from("rides").select("user_id");
  const onlyOwn = (adminSnooping.data ?? []).every((r) => r.user_id === admin.userId);
  check("admin cannot read other users' ride histories", onlyOwn);
} else {
  console.log("\nAdmin — skipped (set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to include)");
}

async function anyCoasterId(client) {
  const { data } = await client.from("coasters").select("id").limit(1).single();
  return data?.id ?? null;
}

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
