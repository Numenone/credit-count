"use client";

import { useState } from "react";
import { API_SPEC, ACCESS_LABEL, type Endpoint, type HttpMethod } from "@/lib/api-spec";
import { ArrowRightIcon, LockIcon } from "@/components/icons";

const METHOD_COLOUR: Record<HttpMethod, string> = {
  GET: "var(--data-1)",
  POST: "var(--data-3)",
  PATCH: "var(--data-2)",
  DELETE: "var(--brand)",
};

interface Result {
  status: number;
  statusText: string;
  ms: number;
  body: string;
  url: string;
}

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className="tabular w-16 shrink-0 rounded-[5px] px-1.5 py-0.5 text-center text-[0.66rem] font-bold tracking-wide"
      style={{ backgroundColor: METHOD_COLOUR[method], color: "#fff" }}
    >
      {method}
    </span>
  );
}

/**
 * A request runner for this app's own API.
 *
 * Requests go out from the browser with the session cookie attached, so whatever
 * you see is what the database would give *you* — sign in as an enthusiast and
 * the admin endpoints refuse you here exactly as they would anywhere else. That
 * is the point of the page: it is a live demonstration of the authorisation
 * model, not a generated reference.
 */
export function ApiExplorer() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {API_SPEC.map((group) => (
        <section key={group.name}>
          <h2 className="text-sm font-semibold">{group.name}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ink-2)]">
            {group.description}
          </p>

          <ul className="card mt-3 divide-y divide-[var(--line)] overflow-hidden">
            {group.endpoints.map((endpoint) => (
              <EndpointRow
                key={endpoint.id}
                endpoint={endpoint}
                open={openId === endpoint.id}
                onToggle={() => setOpenId(openId === endpoint.id ? null : endpoint.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EndpointRow({
  endpoint,
  open,
  onToggle,
}: {
  endpoint: Endpoint;
  open: boolean;
  onToggle: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState(
    endpoint.body ? JSON.stringify(endpoint.body, null, 2) : "",
  );
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);

  const buildUrl = () => {
    let path = endpoint.path;
    const query = new URLSearchParams();

    for (const param of endpoint.params ?? []) {
      const value = values[param.name]?.trim();
      if (!value) continue;
      if (param.in === "path") path = path.replace(`{${param.name}}`, encodeURIComponent(value));
      else query.set(param.name, value);
    }

    const qs = query.toString();
    return path + (qs ? `?${qs}` : "");
  };

  const send = async () => {
    setRunning(true);
    const url = buildUrl();
    const started = performance.now();

    try {
      const hasBody = endpoint.method === "POST" || endpoint.method === "PATCH";
      const response = await fetch(url, {
        method: endpoint.method,
        headers: hasBody ? { "Content-Type": "application/json" } : undefined,
        body: hasBody && body.trim() ? body : undefined,
        // Same-origin cookies carry the session, so the request runs as you.
        credentials: "same-origin",
      });

      const text = await response.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON — show it raw */
      }

      setResult({
        status: response.status,
        statusText: response.statusText,
        ms: Math.round(performance.now() - started),
        body: pretty,
        url,
      });
    } catch (error) {
      setResult({
        status: 0,
        statusText: "Network error",
        ms: Math.round(performance.now() - started),
        body: error instanceof Error ? error.message : String(error),
        url,
      });
    } finally {
      setRunning(false);
    }
  };

  const ok = result && result.status >= 200 && result.status < 300;
  const refused = result && (result.status === 401 || result.status === 403);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <MethodBadge method={endpoint.method} />
        <code className="shrink-0 text-[0.82rem] font-medium">{endpoint.path}</code>
        <span className="mr-auto hidden truncate text-xs text-[var(--ink-3)] sm:block">
          {endpoint.summary}
        </span>
        <span className="chip shrink-0">
          {endpoint.access === "admin" || endpoint.access === "owner" ? (
            <LockIcon size={10} />
          ) : null}
          {ACCESS_LABEL[endpoint.access]}
        </span>
      </button>

      {open && (
        <div className="fade space-y-4 border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-4">
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--ink-2)]">
            {endpoint.description}
          </p>

          {endpoint.refusal && (
            <p className="flex items-start gap-1.5 text-xs text-[var(--ink-3)]">
              <span className="mt-0.5 shrink-0">
                <LockIcon size={11} />
              </span>
              When refused: {endpoint.refusal}
            </p>
          )}

          {(endpoint.params ?? []).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {endpoint.params!.map((param) => (
                <div key={param.name}>
                  <label className="label" htmlFor={`${endpoint.id}-${param.name}`}>
                    {param.name}
                    {param.required && <span style={{ color: "var(--brand)" }}> *</span>}
                    <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                      {param.in}
                    </span>
                  </label>
                  <input
                    id={`${endpoint.id}-${param.name}`}
                    className="field !py-1.5 !text-[0.82rem]"
                    placeholder={param.placeholder || param.description}
                    value={values[param.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [param.name]: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-[0.7rem] text-[var(--ink-3)]">{param.description}</p>
                </div>
              ))}
            </div>
          )}

          {(endpoint.method === "POST" || endpoint.method === "PATCH") && (
            <div>
              <label className="label" htmlFor={`${endpoint.id}-body`}>
                Request body (JSON)
              </label>
              <textarea
                id={`${endpoint.id}-body`}
                rows={Math.min(14, body.split("\n").length + 1)}
                className="field font-mono !text-[0.78rem]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={send} disabled={running} className="btn btn-primary !py-1.5 !text-[0.82rem]">
              {running ? "Sending…" : "Send request"}
              {!running && <ArrowRightIcon size={13} />}
            </button>
            <code className="truncate text-xs text-[var(--ink-3)]">
              {endpoint.method} {buildUrl()}
            </code>
          </div>

          {result && (
            <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)]">
              <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-3.5 py-2.5">
                <span
                  className="tabular rounded-[5px] px-2 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: ok
                      ? "var(--good-soft)"
                      : refused
                        ? "var(--brand-soft)"
                        : "var(--surface-sunken)",
                    color: ok ? "var(--good)" : refused ? "var(--brand)" : "var(--ink-2)",
                  }}
                >
                  {result.status || "ERR"} {result.statusText}
                </span>
                <span className="tabular text-xs text-[var(--ink-3)]">{result.ms} ms</span>
                {refused && (
                  <span className="text-xs text-[var(--ink-3)]">
                    Refused by row-level security, not by this page.
                  </span>
                )}
              </div>
              <pre className="max-h-80 overflow-auto px-3.5 py-3 text-[0.75rem] leading-relaxed">
                <code>{result.body}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
