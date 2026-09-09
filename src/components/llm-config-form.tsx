"use client";

import { useActionState } from "react";
import { GATEWAYS, GATEWAY_INFO, MODELS, type Gateway } from "@/lib/mascot-models";

export interface ConfigState {
  gateway: Gateway;
  model: string;
  max_tokens: number;
  effort: string;
  burst_cap: number;
  daily_cap: number;
  updated_at: string;
}

export interface ConfigResult {
  ok: boolean;
  message: string;
}

/**
 * The mascot's runtime settings.
 *
 * Every field is a select or a bounded number, never free text. An admin
 * console that lets you type a model name is one that lets you take the feature
 * down for every user with a typo — and there would be no rate card for
 * whatever you typed, so the spend chart would quietly read zero.
 *
 * Authorisation is not here. set_mascot_config() raises unless the caller is an
 * admin, so this form is a convenience over a rule that holds without it.
 */
export function LlmConfigForm({
  current,
  readiness,
  action,
}: {
  current: ConfigState;
  /** Which gateways the server actually holds credentials for. */
  readiness: Record<Gateway, boolean>;
  action: (previous: ConfigResult | null, formData: FormData) => Promise<ConfigResult>;
}) {
  const [result, submit, pending] = useActionState(action, null);

  return (
    <section className="card p-5">
      <header>
        <h3 className="text-sm font-semibold">Model and limits</h3>
        <p className="mt-1 text-xs text-[var(--ink-3)]">
          Applies to the next question asked. Last changed{" "}
          {new Date(current.updated_at).toLocaleString("en-GB")}.
        </p>
      </header>

      <form action={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gateway" className="label">
            Gateway
          </label>
          <select id="gateway" name="gateway" defaultValue={current.gateway} className="field">
            {GATEWAYS.map((gateway) => (
              <option key={gateway} value={gateway}>
                {GATEWAY_INFO[gateway].label}
                {readiness[gateway] ? "" : " — not configured"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[var(--ink-3)]">
            {GATEWAY_INFO[current.gateway].note} Selecting one without its credentials
            (
            {GATEWAY_INFO[current.gateway].requires.join(", ")}) makes the endpoint return 503
            rather than fail quietly.
          </p>
        </div>

        <div>
          <label htmlFor="model" className="label">
            Model
          </label>
          <select id="model" name="model" defaultValue={current.model} className="field">
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} — ${model.inputPerMTok}/${model.outputPerMTok} per Mtok
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[var(--ink-3)]">
            Input/output price per million tokens. Calls are priced when they are made, so
            changing this does not rewrite what earlier calls cost.
          </p>
        </div>

        <div>
          <label htmlFor="max_tokens" className="label">
            Reply cap (tokens)
          </label>
          <input
            id="max_tokens"
            name="max_tokens"
            type="number"
            min={64}
            max={4000}
            step={1}
            defaultValue={current.max_tokens}
            className="field"
          />
          <p className="mt-1.5 text-xs text-[var(--ink-3)]">
            She answers in one short paragraph; 500 is comfortable.
          </p>
        </div>

        <div>
          <label htmlFor="effort" className="label">
            Reasoning effort
          </label>
          <select id="effort" name="effort" defaultValue={current.effort} className="field">
            {["low", "medium", "high"].map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[var(--ink-3)]">
            Higher spends more thinking tokens per answer.
          </p>
        </div>

        <div>
          <label htmlFor="burst_cap" className="label">
            Burst limit (per 5 minutes, per user)
          </label>
          <input
            id="burst_cap"
            name="burst_cap"
            type="number"
            min={1}
            max={100}
            step={1}
            defaultValue={current.burst_cap}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="daily_cap" className="label">
            Daily limit (per user)
          </label>
          <input
            id="daily_cap"
            name="daily_cap"
            type="number"
            min={1}
            max={5000}
            step={1}
            defaultValue={current.daily_cap}
            className="field"
          />
          <p className="mt-1.5 text-xs text-[var(--ink-3)]">
            A burst limit is not a budget: without this, eight turns every five minutes all day is
            over two thousand calls from one account.
          </p>
        </div>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save configuration"}
          </button>

          {result && (
            <p
              role="status"
              className="text-sm"
              style={{ color: result.ok ? "var(--good)" : "var(--brand)" }}
            >
              {result.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
