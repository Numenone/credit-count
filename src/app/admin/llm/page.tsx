import Link from "next/link";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  GATEWAYS,
  GATEWAY_INFO,
  MODEL_IDS,
  PERIODS,
  PERIOD_SPEC,
  formatUsd,
  isPeriod,
  modelInfo,
  type Gateway,
} from "@/lib/mascot-models";
import { LlmUsageChart, type UsagePoint } from "@/components/llm-usage-chart";
import { LlmConfigForm, type ConfigResult, type ConfigState } from "@/components/llm-config-form";
import { StatTile } from "@/components/stat-tile";
import { BarList } from "@/components/bar-list";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/components/reveal";
import { SparkIcon } from "@/components/icons";

export const metadata: Metadata = { title: "LLM usage" };

/**
 * What the mascot costs, and what she is doing.
 *
 * A feature that spends money and keeps no record of it is a feature nobody can
 * defend in a review — "how much does this cost?" should have an answer that is
 * not a shrug. Everything here reads the ledger written by the endpoint itself.
 *
 * The aggregation happens in Postgres. A busy month is tens of thousands of
 * rows and this page needs about sixty points; shipping the rows to the browser
 * to reduce them there would be the same picture at a hundred times the cost.
 */

interface SeriesRow {
  bucket: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  // numeric arrives over PostgREST as a string, because a double would lose
  // precision on money. Converted once, here.
  cost_usd: string | number;
  errors: number;
  p50_latency: number;
}

async function saveConfig(_previous: ConfigResult | null, formData: FormData): Promise<ConfigResult> {
  "use server";

  await requireAdmin();
  const supabase = await createClient();

  const gateway = String(formData.get("gateway") ?? "");
  const model = String(formData.get("model") ?? "");
  const effort = String(formData.get("effort") ?? "");
  const maxTokens = Number(formData.get("max_tokens"));
  const burstCap = Number(formData.get("burst_cap"));
  const dailyCap = Number(formData.get("daily_cap"));

  // Checked here as well as by the column constraints. The database is the
  // authority; this exists so a mistake reads as a sentence rather than a
  // Postgres error code.
  if (!(GATEWAYS as readonly string[]).includes(gateway)) {
    return { ok: false, message: "Unknown gateway." };
  }
  if (!MODEL_IDS.includes(model)) {
    return { ok: false, message: "Unknown model." };
  }
  if (!["low", "medium", "high"].includes(effort)) {
    return { ok: false, message: "Effort must be low, medium or high." };
  }
  if (!Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 4000) {
    return { ok: false, message: "Reply cap must be between 64 and 4000 tokens." };
  }
  if (!Number.isInteger(burstCap) || burstCap < 1 || burstCap > 100) {
    return { ok: false, message: "Burst limit must be between 1 and 100." };
  }
  if (!Number.isInteger(dailyCap) || dailyCap < 1 || dailyCap > 5000) {
    return { ok: false, message: "Daily limit must be between 1 and 5000." };
  }

  const { error } = await supabase.rpc("set_mascot_config", {
    p_gateway: gateway,
    p_model: model,
    p_max_tokens: maxTokens,
    p_effort: effort,
    p_burst_cap: burstCap,
    p_daily_cap: dailyCap,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/llm");
  return { ok: true, message: "Saved. It applies to the next question asked." };
}

export default async function LlmPage({ searchParams }: PageProps<"/admin/llm">) {
  await requireAdmin();
  const supabase = await createClient();

  const params = await searchParams;
  const period = isPeriod(params.period) ? params.period : "day";
  const spec = PERIOD_SPEC[period];

  const [configResult, seriesResult, emotionResult] = await Promise.all([
    supabase
      .from("mascot_config")
      .select("gateway, model, max_tokens, effort, burst_cap, daily_cap, updated_at")
      .maybeSingle<ConfigState>(),
    supabase.rpc("mascot_usage_series", { p_bucket: spec.bucket, p_hours: spec.windowHours }),
    supabase.rpc("mascot_emotion_counts", { p_hours: spec.windowHours }),
  ]);

  const points: UsagePoint[] = ((seriesResult.data ?? []) as SeriesRow[]).map((row) => ({
    bucket: row.bucket,
    calls: Number(row.calls),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    costUsd: Number(row.cost_usd),
    errors: Number(row.errors),
    p50Latency: Number(row.p50_latency),
  }));

  const emotions = ((emotionResult.data ?? []) as { emotion: string; calls: number }[]).map(
    (row) => ({ label: row.emotion, credits: Number(row.calls), rides: Number(row.calls) }),
  );

  const totals = points.reduce(
    (acc, p) => ({
      calls: acc.calls + p.calls,
      cost: acc.cost + p.costUsd,
      input: acc.input + p.inputTokens,
      output: acc.output + p.outputTokens,
      errors: acc.errors + p.errors,
    }),
    { calls: 0, cost: 0, input: 0, output: 0, errors: 0 },
  );

  // Median of the per-bucket medians. Not the true median of every call — the
  // rows are already aggregated — but the right shape for a health figure, and
  // cheaper than shipping every latency to compute it exactly.
  const latencies = points.filter((p) => p.calls > 0).map((p) => p.p50Latency).sort((a, b) => a - b);
  const medianLatency = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;

  const config = configResult.data ?? {
    gateway: "anthropic" as Gateway,
    model: "claude-opus-5",
    max_tokens: 500,
    effort: "low",
    burst_cap: 8,
    daily_cap: 60,
    // Only reached if the single config row is missing, which would be a
    // migration that did not run rather than a normal state.
    updated_at: "1970-01-01T00:00:00.000Z",
  };

  const readiness = Object.fromEntries(
    GATEWAYS.map((gateway) => [
      gateway,
      GATEWAY_INFO[gateway].requires.every((key) => Boolean(process.env[key])),
    ]),
  ) as Record<Gateway, boolean>;

  const rate = modelInfo(config.model);
  const errorRate = totals.calls > 0 ? (totals.errors / totals.calls) * 100 : 0;

  return (
    <div className="space-y-6">
      <section className="rise">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Rusty&rsquo;s usage</h2>
            <p className="mt-1 text-xs text-[var(--ink-3)]">
              Every call to the mascot, priced when it was made. {spec.label}.
            </p>
          </div>

          <nav aria-label="Time period" className="flex flex-wrap gap-1">
            {PERIODS.map((option) => {
              const active = option === period;
              return (
                <Link
                  key={option}
                  href={`/admin/llm?period=${option}`}
                  aria-current={active ? "page" : undefined}
                  className={`chip !py-1 capitalize ${active ? "chip-brand" : ""}`}
                >
                  {option}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Spend"
            value={formatUsd(totals.cost)}
            hint={rate ? `${rate.label} at $${rate.inputPerMTok}/$${rate.outputPerMTok} per Mtok` : "Unknown model"}
            emphasis
            icon={<SparkIcon size={13} />}
          />
          <StatTile
            label="Calls"
            value={totals.calls}
            hint={`${(totals.input + totals.output).toLocaleString("en-GB")} tokens in total`}
          />
          <StatTile
            label="Median latency"
            value={medianLatency}
            suffix=" ms"
            hint="Across buckets that saw traffic"
          />
          <StatTile
            label="Failures"
            value={totals.errors}
            hint={
              totals.calls === 0
                ? "No calls in this window"
                : `${errorRate.toFixed(1)}% of calls — refusals, timeouts and rate limits`
            }
          />
        </div>
      </section>

      {totals.calls === 0 ? (
        <section className="card rise p-2">
          <EmptyState
            icon={<SparkIcon size={18} />}
            title="Nothing recorded in this window"
            body="Ask Rusty something from the dashboard and it will appear here. Try a wider period — the ledger starts from when it was first deployed."
          />
        </section>
      ) : (
        <Reveal className="grid gap-4 lg:grid-cols-2">
          <LlmUsageChart
            title="Spend"
            subtitle={spec.label}
            points={points}
            measure={(p) => p.costUsd}
            format={formatUsd}
          />
          <LlmUsageChart
            title="Calls"
            subtitle={spec.label}
            points={points}
            measure={(p) => p.calls}
            format={(v) => `${v.toLocaleString("en-GB")}`}
          />
          <LlmUsageChart
            title="Tokens out"
            subtitle="What she said, which is the expensive half"
            points={points}
            measure={(p) => p.outputTokens}
            format={(v) => v.toLocaleString("en-GB")}
          />
          <BarList
            title="Expressions returned"
            subtitle={`${emotions.length} of the 22 she can draw`}
            items={emotions}
            limit={10}
            unit="replies"
          />
        </Reveal>
      )}

      <Reveal>
        <LlmConfigForm current={config} readiness={readiness} action={saveConfig} />
      </Reveal>

      <section className="card p-5">
        <h3 className="text-sm font-semibold">How this is recorded</h3>
        <ul className="mt-3 space-y-2 text-sm text-[var(--ink-2)]">
          <li>
            The ledger has row-level security on and a single select policy, for admins. There is
            no insert, update or delete policy at all — rows arrive only through a
            <code className="mx-1 text-xs">security definer</code> function that takes the user id
            from the session, so nobody can attribute their spending to someone else or quietly
            erase it.
          </li>
          <li>
            Cost is computed and stored when the call is made. Repricing history against today&rsquo;s
            rate card would silently rewrite what last month actually cost.
          </li>
          <li>
            Failures are recorded too, including rate-limited attempts that never reached a model —
            an error rate you cannot see is one you will not fix.
          </li>
          <li>
            No prompt or reply text is stored. The ledger answers &ldquo;what did this cost and is
            it healthy&rdquo;, which does not require keeping what anyone asked.
          </li>
        </ul>
      </section>
    </div>
  );
}
