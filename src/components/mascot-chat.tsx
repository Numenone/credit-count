"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot";
import type { Emotion } from "@/lib/mascot-shared";
import { ArrowRightIcon } from "@/components/icons";

export interface Turn {
  role: "user" | "assistant";
  text: string;
  emotion?: Emotion;
}

const SUGGESTIONS = [
  "Why did wooden coasters make a comeback?",
  "What makes a Mack launch feel different to an Intamin one?",
  "Where would you go for a first European coaster trip?",
];

/**
 * The conversation modal.
 *
 * Rusty sits bottom-right with his paws over the top edge of the input box —
 * the same pose as the dashboard card, with the composer standing in for the
 * ledge. Built on <dialog> so focus trapping and Escape come from the platform.
 */
export function MascotChat({
  open,
  turns,
  emotion,
  pending,
  error,
  onSend,
  onClose,
}: {
  open: boolean;
  turns: Turn[];
  emotion: Emotion;
  pending: boolean;
  error: string | null;
  onSend: (message: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Keep the newest turn in view as the conversation grows. Writing to the DOM
  // directly rather than through state: this is a scroll position, not data.
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, pending]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setDraft("");
    onSend(trimmed);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="mascot-chat-title"
      className="m-auto h-[min(46rem,calc(100vh-2rem))] w-[min(44rem,calc(100vw-1.5rem))] max-h-none max-w-none rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-[var(--shadow-lg)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="mascot-chat-title" className="text-sm font-semibold">
              Ask Rusty
            </h2>
            <p className="truncate text-xs text-[var(--ink-3)]">
              Rollercoasters and theme parks only — he is a specialist.
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="btn btn-ghost shrink-0 !px-2 !py-1 text-lg leading-none"
          >
            ×
          </button>
        </header>

        {/* The bottom padding is Rusty's headroom: he leans up out of the
            composer into this area, so the newest message has to clear him. */}
        <div
          ref={scroller}
          className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-5 sm:pb-[10.5rem]"
        >
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                Ask me about a ride, a park, a manufacturer, or where to go next. History and
                geography are my favourites.
              </p>
              <ul className="space-y-2">
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => submit(suggestion)}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] px-3.5 py-2.5 text-left text-sm transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {turns.map((turn, i) => (
            <div
              key={i}
              className={`fade flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] rounded-[var(--radius)] px-3.5 py-2.5 text-sm leading-relaxed"
                style={
                  turn.role === "user"
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-ink)" }
                    : { backgroundColor: "var(--surface-2)", border: "1px solid var(--line)" }
                }
              >
                {turn.text.split("\n").map((line, j) => (
                  <p key={j} className={j > 0 ? "mt-2" : undefined}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: "var(--ink-3)",
                      animation: `puff 1.1s ease-in-out ${i * 0.16}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--brand)" }}>
              {error}
            </p>
          )}
        </div>

        {/* The composer is Rusty's ledge in here: he leans on its top edge, the
            same pose as on the dashboard card with the border moved.

            The top padding is not decoration — his paws hang 0.18667 × his
            width below that edge, so the input has to start below them or he
            sits on top of the controls. 200px × 0.18667 ≈ 38, plus a gap. */}
        <div className="relative border-t border-[var(--line)] px-5 pb-5 pt-4 sm:pt-[3.75rem]">
          <div className="mascot-perch-top mascot-perch-chat pointer-events-none absolute right-2 hidden sm:block">
            <Mascot emotion={pending ? "thinking" : emotion} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder="Ask about a coaster or a park…"
              aria-label="Your question for Rusty"
              className="field"
              autoFocus
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              className="btn btn-primary shrink-0"
            >
              Ask
              <ArrowRightIcon size={13} />
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
