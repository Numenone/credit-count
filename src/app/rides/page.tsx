import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Coaster, RideWithCoaster } from "@/lib/database.types";
import { RideRow } from "@/components/ride-row";

export const metadata: Metadata = { title: "My rides" };

export default async function RidesPage() {
  await requireUser();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rides }, { data: catalogue }] = await Promise.all([
    supabase
      .from("rides")
      .select("id, coaster_id, ridden_on, note, created_at, user_id, coaster:coasters(*)")
      .order("ridden_on", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<RideWithCoaster[]>(),
    supabase.from("coasters").select("*").order("name").returns<Coaster[]>(),
  ]);

  const list = rides ?? [];

  // The earliest ride on each coaster is the one that earned the credit; later
  // rides on the same coaster add to the ride total only. Rides come back newest
  // first, so the last occurrence in this list is the earliest chronologically.
  const creditRideIds = new Set<string>();
  const seen = new Set<string>();
  for (let i = list.length - 1; i >= 0; i--) {
    const ride = list[i];
    if (!seen.has(ride.coaster_id)) {
      seen.add(ride.coaster_id);
      creditRideIds.add(ride.id);
    }
  }

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My rides</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
            {list.length} {list.length === 1 ? "ride" : "rides"} · {seen.size}{" "}
            {seen.size === 1 ? "credit" : "credits"}. Only you can see this page.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-primary">
          Log a ride
        </Link>
      </div>

      <div className="card mt-6 overflow-hidden">
        {list.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-faint)]">
            No rides logged yet.{" "}
            <Link href="/dashboard" className="underline underline-offset-2">
              Log your first credit
            </Link>
            .
          </p>
        ) : (
          <ul>
            {list.map((ride) => (
              <RideRow
                key={ride.id}
                ride={ride}
                catalogue={catalogue ?? []}
                today={today}
                isNewCredit={creditRideIds.has(ride.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
