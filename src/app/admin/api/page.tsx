import type { Metadata } from "next";
import { ApiExplorer } from "./api-explorer";
import { LockIcon } from "@/components/icons";

export const metadata: Metadata = { title: "API explorer" };

export default function AdminApiPage() {
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Run the API as yourself</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-2)]">
          Every request below goes out from your browser with your session cookie, so it is
          answered by the same row-level security that answers the rest of the app. This is not a
          documentation page with a sandbox attached — it is the real API, and the responses are
          the real ones.
        </p>

        <div
          className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-sm)] border p-3.5"
          style={{ borderColor: "var(--brand-line)", backgroundColor: "var(--brand-soft)" }}
        >
          <span className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }}>
            <LockIcon size={14} />
          </span>
          <p className="text-sm leading-relaxed" style={{ color: "var(--brand)" }}>
            <strong>Worth trying:</strong> sign in as an enthusiast and send{" "}
            <code>POST /api/v1/coasters</code>, or add <code>&quot;role&quot;: &quot;admin&quot;</code> to{" "}
            <code>PATCH /api/v1/me</code>. Both are refused by Postgres, not by this page — the
            handlers contain no role checks at all. Requests here can change real data, so treat a
            DELETE as a DELETE.
          </p>
        </div>
      </section>

      <ApiExplorer />
    </div>
  );
}
