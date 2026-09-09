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
import { MODEL_EMOTIONS } from "@/lib/mascot-shared";
import { LlmUsageChart, type UsagePoint } from "@/components/llm-usage-chart";
import { BudgetMeter, type BudgetState } from "@/components/budget-meter";
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

/** One row, from `mascot_latency()`. Real percentiles over the calls themselves. */
interface LatencyRow {
  p50: number;
  p95: number;
  p99: number;
  slowest: number;
  calls: number;
}

/** One row, from `mascot_budget()`. numeric arrives as a string or a number. */
interface BudgetRow {
  day_spend: string | number;
  day_budget: string | number;
  month_spend: string | number;
  month_budget: string | number;
  exhausted: boolean;
  action: string;
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
  const dailyBudget = Number(formData.get("daily_budget"));
  const monthlyBudget = Number(formData.get("monthly_budget"));
  const onExhausted = String(formData.get("on_exhausted") ?? "");

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
  // Money, so not an integer check. Rounded to the cent the column stores,
  // otherwise a third of a dollar typed here reads back as something else and
  // looks like the form lost the value.
  if (!Number.isFinite(dailyBudget) || dailyBudget < 0 || dailyBudget > 10000) {
    return { ok: false, message: "Daily budget must be between $0 and $10,000." };
  }
  if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0 || monthlyBudget > 100000) {
    return { ok: false, message: "Monthly budget must be between $0 and $100,000." };
  }
  if (!["warn", "stop"].includes(onExhausted)) {
    return { ok: false, message: "Choose whether to refuse new questions or carry on." };
  }

  const { error } = await supabase.rpc("set_mascot_config", {
    p_gateway: gateway,
    p_model: model,
    p_max_tokens: maxTokens,
    p_effort: effort,
    p_burst_cap: burstCap,
    p_daily_cap: dailyCap,
    p_daily_budget: Math.round(dailyBudget * 100) / 100,
    p_monthly_budget: Math.round(monthlyBudget * 100) / 100,
    p_on_exhausted: onExhausted,
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

  const [configResult, seriesResult, emotionResult, latencyResult, budgetResult] =
    await Promise.all([
      supabase
        .from("mascot_config")
        .select(
          "gateway, model, max_tokens, effort, burst_cap, daily_cap, daily_budget_usd, monthly_budget_usd, on_budget_exhausted, updated_at",
        )
        .maybeSingle<ConfigState>(),
      supabase.rpc("mascot_usage_series", { p_bucket: spec.bucket, p_hours: spec.windowHours }),
      supabase.rpc("mascot_emotion_counts", { p_hours: spec.windowHours }),
      // Over the same window as the charts, so the tile and the picture agree.
      supabase.rpc("mascot_latency", { p_hours: spec.windowHours }),
      // Not windowed: the budgets are today and this month by definition, and
      // looking at the yearly chart should not change what "today" means.
      supabase.rpc("mascot_budget"),
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

  // Percentiles over the calls themselves. This used to be the median of the
  // per-bucket medians, which is not a percentile of anything: a bucket holding
  // one slow call weighed the same as a bucket holding a thousand fast ones, so
  // the figure moved with how the traffic happened to fall across buckets. It
  // costs one more round trip and is the difference between a number and a
  // number that means something.
  const latency = ((latencyResult.data ?? []) as LatencyRow[])[0] ?? {
    p50: 0,
    p95: 0,
    p99: 0,
    slowest: 0,
    calls: 0,
  };

  const budgetRow = ((budgetResult.data ?? []) as BudgetRow[])[0];
  const budget: BudgetState | null = budgetRow
    ? {
        daySpend: Number(budgetRow.day_spend),
        dayBudget: Number(budgetRow.day_budget),
        monthSpend: Number(budgetRow.month_spend),
        monthBudget: Number(budgetRow.month_budget),
        exhausted: budgetRow.exhausted,
        action: budgetRow.action,
      }
    : null;

  const config = configResult.data ?? {
    gateway: "anthropic" as Gateway,
    model: "claude-opus-5",
    max_tokens: 500,
    effort: "low",
    burst_cap: 8,
    daily_cap: 60,
    daily_budget_usd: 5,
    monthly_budget_usd: 50,
    on_budget_exhausted: "stop",
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
            label="p95 latency"
            value={latency.p95}
            suffix=" ms"
            hint={
              latency.calls === 0
                ? "No calls reached a model in this window"
                : // Naming the sample matters more than the figure. A p95 over
                  // eleven calls is the second-slowest one, and reading it as a
                  // tail estimate would be reading noise.
                  `p50 ${latency.p50} ms · p99 ${latency.p99} ms · over ${latency.calls} ${
                    latency.calls === 1 ? "call" : "calls"
                  } that reached a model`
            }
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

      {budget && (
        <Reveal>
          <BudgetMeter state={budget} />
        </Reveal>
      )}

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
          {/* `metric` is a string, not a function. Functions do not cross the
              RSC boundary — passing `measure` and `format` here failed at
              serialisation with a digest and no stack. */}
          <LlmUsageChart title="Spend" subtitle={spec.label} points={points} metric="cost" />
          <LlmUsageChart title="Calls" subtitle={spec.label} points={points} metric="calls" />
          <LlmUsageChart
            title="Tokens out"
            subtitle="What she said, which is the expensive half"
            points={points}
            metric="outputTokens"
          />
          <BarList
            title="Expressions returned"
            subtitle={`${emotions.length} of the ${MODEL_EMOTIONS.length} she can choose`}
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
            No prompt or reply text is stored <em>here</em>. The ledger answers &ldquo;what did
            this cost and is it healthy&rdquo;, which does not require keeping what anyone asked.
            Transcripts live separately, owned by the person who wrote them, and are not readable
            from this console — being an admin is not a reason to read someone&rsquo;s
            conversation.
          </li>
          <li>
            The budgets above are enforced by the same ledger. Before a call is made the endpoint
            sums today&rsquo;s and this month&rsquo;s cost and refuses if either threshold is
            reached, so the answer to &ldquo;are we overspending&rdquo; does not depend on anyone
            opening this page.
          </li>
          <li>
            Latency is a real percentile, computed by Postgres over the calls in the window rather
            than averaged out of the chart buckets. It excludes requests turned away by the rate
            limit, which never reached a model and would otherwise drag every figure towards zero.
          </li>
        </ul>
      </section>
    </div>
  );
}
