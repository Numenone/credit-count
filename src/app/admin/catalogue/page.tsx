import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COASTER_COLUMNS, type Coaster } from "@/lib/database.types";
import { AddCoasterForm, CoasterRow } from "../coaster-forms";
import { CoasterDetailsProvider } from "@/components/coaster-details";
import { EmptyState } from "@/components/empty-state";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Catalogue" };

function sanitiseQuery(raw: string) {
  return raw.replace(/[(),*]/g, " ").replace(/[%_\\]/g, "").trim().slice(0, 60);
}

export default async function AdminCataloguePage({ searchParams }: PageProps<"/admin/catalogue">) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const query = sanitiseQuery(rawQuery);

  let request = supabase.from("coasters").select(COASTER_COLUMNS, { count: "exact" });
  if (query) {
    request = request.or(
      `name.ilike.%${query}%,park.ilike.%${query}%,country.ilike.%${query}%,manufacturer.ilike.%${query}%`,
    );
  }

  const { data, count } = await request.order("name").limit(200).returns<Coaster[]>();
  const coasters = data ?? [];

  return (
    <CoasterDetailsProvider unitSystem={profile.unit_system}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-[var(--ink-2)]">
            <span className="tabular font-semibold text-[var(--ink)]">
              {count ?? coasters.length}
            </span>{" "}
            entries. Keeping this clean is what makes credit counts comparable between enthusiasts.
          </p>
          <AddCoasterForm />
        </div>

        <div className="card overflow-hidden">
          <form method="get" className="flex gap-2 border-b border-[var(--line)] p-4">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]">
                <SearchIcon />
              </span>
              <input
                type="search"
                name="q"
                defaultValue={rawQuery}
                placeholder="Filter by coaster, park, country or manufacturer…"
                aria-label="Filter the catalogue"
                className="field !pl-9"
              />
            </div>
            <button type="submit" className="btn btn-quiet shrink-0">
              Filter
            </button>
          </form>

          {coasters.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={18} />}
              title={query ? `Nothing matches “${rawQuery}”` : "The catalogue is empty"}
              body={
                query
                  ? "Try a shorter term, or add this coaster as a new entry."
                  : "Add the first coaster so enthusiasts have something to log rides against."
              }
            />
          ) : (
            <ul>
              {coasters.map((coaster) => (
                <CoasterRow key={coaster.id} coaster={coaster} />
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs leading-relaxed text-[var(--ink-3)]">
          A coaster with rides logged against it cannot be removed — edit it instead, so nobody
          loses a credit they earned. Duplicate name and park combinations are rejected by a unique
          index, not by a check in this page, so a duplicate cannot be created through the API
          either.
        </p>
      </div>
    </CoasterDetailsProvider>
  );
}
