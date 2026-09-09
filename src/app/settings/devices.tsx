"use client";

import { useState, useTransition } from "react";
import { LockIcon } from "@/components/icons";
import {
  connectedFor,
  describeDevice,
  describePlace,
  flagFor,
  type Device,
} from "@/lib/devices";

/**
 * Everywhere this account is signed in, and a way to end any of it.
 *
 * The list is worth having on its own — "is anything signed in that I do not
 * recognise" is a question people ask and most apps cannot answer — but it also
 * closes a specific gap. The session is verified by checking its signature
 * locally rather than by asking Supabase Auth on every request, which is much
 * faster and, on its own, would mean a revoked session kept working until its
 * token expired. Signing a device out here deletes the session, and the next
 * request that device makes is refused, because the profile lookup every page
 * already performs now also reports whether the session still exists.
 */
export function Devices({
  devices,
  currentSessionId,
  action,
}: {
  devices: Device[];
  currentSessionId: string | null;
  action: (sessionId: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = devices.filter((d) => !removed.has(d.session_id));

  function revoke(device: Device) {
    startTransition(async () => {
      const result = await action(device.session_id);
      setConfirming(null);
      setStatus(result.message);
      if (result.ok) setRemoved(new Set([...removed, device.session_id]));
    });
  }

  return (
    <section className="card p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Connected devices</h2>
        <span className="text-xs text-[var(--ink-3)]">
          {visible.length} {visible.length === 1 ? "session" : "sessions"}
        </span>
      </header>

      <p className="mt-1.5 max-w-prose text-sm text-[var(--ink-2)]">
        Every browser currently signed in to this account. Signing one out takes effect on its
        next request — it will be asked to sign in again.
      </p>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ink-3)]">No other sessions.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((device) => {
            const isCurrent = device.session_id === currentSessionId;
            const name = describeDevice(device.user_agent);
            const place = describePlace(device);
            const flag = flagFor(device.country);

            return (
              <li
                key={device.session_id}
                className="rounded-[var(--radius-sm)] border border-[var(--line)] p-3.5"
                style={isCurrent ? { borderColor: "var(--brand-line)" } : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {name}
                      {isCurrent && (
                        <span className="chip chip-brand !py-0.5 !text-[0.68rem]">This device</span>
                      )}
                    </p>

                    <p className="mt-1 text-xs text-[var(--ink-3)]">
                      {flag && <span aria-hidden>{flag} </span>}
                      {place}
                    </p>

                    <p className="mt-0.5 text-xs text-[var(--ink-3)]">
                      Connected {connectedFor(device.created_at)} · signed in{" "}
                      <time dateTime={device.created_at}>
                        {new Date(device.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                      {" · last used "}
                      <time dateTime={device.last_active}>
                        {new Date(device.last_active).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </p>
                  </div>

                  {/* Two steps, because this one cannot be undone from the
                      device it happens to. Confirming in place rather than in a
                      dialog keeps the device you are about to end in view. */}
                  {confirming === device.session_id ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => revoke(device)}
                        disabled={pending}
                        className="btn btn-primary !py-1 !text-[0.78rem]"
                      >
                        {pending ? "Signing out…" : isCurrent ? "Sign out here" : "Sign out"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="btn btn-ghost !py-1 !text-[0.78rem]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(device.session_id)}
                      className="btn btn-quiet shrink-0 !py-1 !text-[0.78rem]"
                      aria-label={`Sign out ${name}${place === "Location unknown" ? "" : ` in ${place}`}`}
                    >
                      <LockIcon size={11} />
                      Sign out
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p role="status" aria-live="polite" className="mt-3 text-xs text-[var(--ink-3)]">
        {status}
      </p>
    </section>
  );
}
