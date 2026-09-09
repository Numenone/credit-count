"use client";

import { useState, useTransition } from "react";
import { TrophyIcon } from "@/components/icons";

export interface Rankable {
  id: string;
  name: string;
  park: string;
  country: string;
}

/**
 * A personal top ten.
 *
 * Counting credits is what this app does; ranking them is what enthusiasts
 * actually argue about, so it is worth the interaction cost.
 *
 * ## Why buttons and not drag-and-drop
 *
 * Dragging is the obvious gesture and the wrong one. A drag target is
 * unreachable by keyboard without a parallel implementation, invisible to a
 * screen reader without a live region describing every move, and fiddly on a
 * phone where the list also scrolls. Two buttons per row are none of those
 * things: they are focusable, they announce themselves, and they work the same
 * on every input device. The list is at most ten items, so the extra clicks
 * cost almost nothing.
 *
 * Each move is announced, because a reorder that only exists visually has not
 * happened for everyone.
 */
export function TopTen({
  initial,
  candidates,
  action,
}: {
  initial: Rankable[];
  /** Ridden coasters not currently in the list. */
  candidates: Rankable[];
  action: (ids: string[]) => Promise<{ ok: boolean; message: string }>;
}) {
  const [list, setList] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const inList = new Set(list.map((c) => c.id));
  const available = candidates.filter((c) => !inList.has(c.id));

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;

    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    setDirty(true);
    setStatus(`${next[target].name} moved to number ${index + 1}. Not saved yet.`);
  }

  function remove(index: number) {
    const [gone] = list.slice(index, index + 1);
    setList(list.filter((_, i) => i !== index));
    setDirty(true);
    setStatus(`${gone.name} removed from the list. Not saved yet.`);
  }

  function add(id: string) {
    const coaster = available.find((c) => c.id === id);
    if (!coaster || list.length >= 10) return;
    setList([...list, coaster]);
    setDirty(true);
    setStatus(`${coaster.name} added at number ${list.length + 1}. Not saved yet.`);
  }

  function save() {
    startTransition(async () => {
      const result = await action(list.map((c) => c.id));
      setStatus(result.message);
      if (result.ok) setDirty(false);
    });
  }

  return (
    <section className="card p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Your top ten</h3>
        <span className="text-xs text-[var(--ink-3)]">
          {list.length} of 10 · only coasters you have ridden
        </span>
      </header>

      {list.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-3)]">
          Nothing ranked yet. Counting them is one thing; putting them in order is the argument.
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {list.map((coaster, index) => (
            <li
              key={coaster.id}
              className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2"
            >
              <span
                className="tabular w-6 shrink-0 text-sm font-semibold"
                style={{ color: index === 0 ? "var(--brand)" : "var(--ink-3)" }}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{coaster.name}</p>
                <p className="truncate text-xs text-[var(--ink-3)]">
                  {coaster.park} · {coaster.country}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${coaster.name} up to number ${index}`}
                  className="btn btn-ghost !px-2 !py-1 text-xs disabled:opacity-30"
                >
                  <span aria-hidden>↑</span>
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === list.length - 1}
                  aria-label={`Move ${coaster.name} down to number ${index + 2}`}
                  className="btn btn-ghost !px-2 !py-1 text-xs disabled:opacity-30"
                >
                  <span aria-hidden>↓</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${coaster.name} from your top ten`}
                  className="btn btn-ghost !px-2 !py-1 text-xs"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {list.length < 10 && available.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="add-to-top-ten" className="sr-only">
            Add a coaster to your top ten
          </label>
          <select
            id="add-to-top-ten"
            className="field"
            value=""
            onChange={(e) => {
              if (e.target.value) add(e.target.value);
            }}
          >
            <option value="">Add a coaster you have ridden…</option>
            {available.map((coaster) => (
              <option key={coaster.id} value={coaster.id}>
                {coaster.name} — {coaster.park}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="btn btn-primary !text-[0.82rem]"
        >
          <TrophyIcon size={12} />
          {pending ? "Saving…" : dirty ? "Save order" : "Saved"}
        </button>

        {/* Polite, not assertive: a reorder is worth hearing about, but not
            worth interrupting whatever is being read. */}
        <p role="status" aria-live="polite" className="text-xs text-[var(--ink-3)]">
          {status}
        </p>
      </div>
    </section>
  );
}
