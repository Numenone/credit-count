"use client";

import { useCallback, useRef, useState } from "react";
import { Mascot } from "@/components/mascot";
import { MascotChat, type Turn } from "@/components/mascot-chat";
import type { Emotion } from "@/lib/mascot-shared";
import { HISTORY_LIMIT } from "@/lib/mascot-shared";
import { ArrowRightIcon, SparkIcon } from "@/components/icons";

/**
 * The dashboard's mascot card.
 *
 * Rusty leans out from behind the card's bottom edge, which acts as the parapet
 * of her cab and crops her there. The card therefore clips — as a Tailwind
 * utility rather than a bare rule, because unlayered CSS beats every @layer and
 * would silently win against it.
 *
 * This component owns the conversation. The card and the modal are two views of
 * the same state, so asking from the card and asking from the modal are the same
 * action — the card's box just happens to be the first turn.
 */
export function MascotCard() {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The transcript is mirrored in a ref so `send` can read the current history
  // without being re-created on every turn. Deriving it inside a state updater
  // would make that updater impure, which React is free to run twice.
  const transcript = useRef<Turn[]>([]);
  const append = useCallback((turn: Turn) => {
    transcript.current = [...transcript.current, turn];
    setTurns(transcript.current);
  }, []);

  const send = useCallback(
    async (message: string) => {
      setError(null);
      setPending(true);
      setEmotion("thinking");

      // What came before this message — the new one is sent separately.
      const history = transcript.current.slice(-HISTORY_LIMIT);
      append({ role: "user", text: message });

      try {
        const response = await fetch("/api/v1/mascot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: history.map((turn) => ({ role: turn.role, text: turn.text })),
          }),
        });

        const payload = (await response.json()) as {
          data?: { emotion?: Emotion; reply?: string };
          error?: { message?: string; detail?: string };
        };

        if (!response.ok || !payload.data) {
          setEmotion("sheepish");
          setError(
            payload.error?.detail ??
              payload.error?.message ??
              "Rusty could not answer just now. Try again.",
          );
          return;
        }

        const reply = payload.data.reply ?? "";
        const next = payload.data.emotion ?? "happy";
        setEmotion(next);
        append({ role: "assistant", text: reply, emotion: next });
      } catch {
        setEmotion("sheepish");
        setError("The connection dropped before Rusty could answer.");
      } finally {
        setPending(false);
      }
    },
    [append],
  );

  const ask = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || pending) return;
    setDraft("");
    setOpen(true);
    void send(trimmed);
  };

  return (
    <>
      <section className="rise">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Ask Rusty</h2>
          <p className="text-xs text-[var(--ink-3)]">
            The house engineer. Coasters and parks only — she is a specialist.
          </p>
        </div>

        <div className="card relative isolate overflow-hidden p-5 pb-[8.5rem] sm:min-h-[13.75rem] sm:pb-6 sm:pr-[14rem]">
          <span className="chip chip-brand !py-1">
            <SparkIcon size={11} />
            AI mascot
          </span>

          <p className="mt-3 max-w-prose text-sm leading-relaxed text-[var(--ink-2)]">
            Ask her about a ride&rsquo;s history, who built it, what a park&rsquo;s scene is like,
            or where to point your next trip.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder="Which park should I visit next?"
              aria-label="Ask Rusty about rollercoasters or theme parks"
              className="field"
            />
            <button type="submit" disabled={pending || !draft.trim()} className="btn btn-primary shrink-0">
              {pending ? "Thinking…" : "Ask Rusty"}
              <ArrowRightIcon size={13} />
            </button>
          </form>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="link-quiet mt-3 text-xs"
            >
              Reopen the conversation ({turns.filter((t) => t.role === "user").length}{" "}
              {turns.filter((t) => t.role === "user").length === 1 ? "question" : "questions"})
            </button>
          )}

          {/* She leans out from behind the card's bottom edge, which crops her
              there — .mascot-perch does the alignment at either size. */}
          <div className="mascot-perch mascot-perch-card mascot-arrive pointer-events-none absolute -right-2 -z-10 sm:right-2">
            <Mascot emotion={pending ? "thinking" : emotion} />
          </div>
        </div>
      </section>

      <MascotChat
        open={open}
        turns={turns}
        emotion={emotion}
        pending={pending}
        error={error}
        onSend={(message) => void send(message)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
