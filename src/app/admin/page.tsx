import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Coaster } from "@/lib/database.types";
import { AddCoasterForm, CoasterRow } from "./coaster-forms";

export const metadata: Metadata = { title: "Catalogue" };

function sanitiseQuery(raw: string) {
  return raw.replace(/[(),*]/g, " ").replace(/[%_\\]/g, "\\$&").trim().slice(0, 60);
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  // Redirects non-admins. The database would refuse their writes regardless;
  // this only avoids showing a page full of controls that would all fail.
  await requireAdmin();

  const supabase = await createClient();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = sanitiseQuery(rawQuery);

  let request = supabase.from("coasters").select("*", { count: "exact" });
  if (query) {
    request = request.or(
      `name.ilike.%${query}%,park.ilike.%${query}%,country.ilike.%${query}%,manufacturer.ilike.%${query}%`,
    );
  }

  const { data, count } = await request.order("name").limit(200).returns<Coaster[]>();
  const coasters = data ?? [];

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coaster catalogue</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
            Shared by every user. {count ?? coasters.length} entries. Keeping this clean is what
            makes credit counts comparable.
          </p>
        </div>
        <AddCoasterForm />
      </div>

      <div className="card mt-6 overflow-hidden">
        <form method="get" className="flex gap-2 border-b border-[var(--color-line)] p-4">
          <input
            type="search"
            name="q"
            defaultValue={rawQuery}
            placeholder="Filter by coaster, park, country or manufacturer…"
            aria-label="Filter the catalogue"
            className="field"
          />
          <button type="submit" className="btn btn-quiet shrink-0">
            Filter
          </button>
        </form>

        {coasters.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-ink-faint)]">
            No entries match “{rawQuery}”.
          </p>
        ) : (
          <ul>
            {coasters.map((coaster) => (
              <CoasterRow key={coaster.id} coaster={coaster} />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--color-ink-faint)]">
        A coaster with rides logged against it cannot be removed — edit it instead, so nobody loses
        a credit. Duplicate name and park combinations are rejected by the database.
      </p>
    </div>
  );
}
