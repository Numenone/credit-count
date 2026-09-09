/**
 * The models and gateways the mascot may be pointed at, and what they cost.
 *
 * Shared between the server and the admin console — it holds no secrets, only
 * names and rate cards. Keys live in the environment and never here.
 *
 * The rate card is the load-bearing part. Prices are applied when a call is
 * made and stored on the row, so this table only ever prices *new* calls;
 * history keeps whatever it cost at the time. Editing a number here does not
 * rewrite last month.
 */

export const GATEWAYS = ["anthropic", "bedrock", "vertex"] as const;
export type Gateway = (typeof GATEWAYS)[number];

export interface GatewayInfo {
  id: Gateway;
  label: string;
  /** What the server needs before this can be selected. */
  requires: string[];
  note: string;
}

export const GATEWAY_INFO: Record<Gateway, GatewayInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic API",
    requires: ["ANTHROPIC_API_KEY"],
    note: "First-party. What this deployment uses.",
  },
  bedrock: {
    id: "bedrock",
    label: "Amazon Bedrock",
    requires: ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    note: "Routes through your AWS account. Model ids are prefixed and the region gates availability.",
  },
  vertex: {
    id: "vertex",
    label: "Google Vertex AI",
    requires: ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_REGION"],
    note: "Routes through your Google Cloud project.",
  },
};

export interface ModelInfo {
  id: string;
  label: string;
  /** USD per million tokens. */
  inputPerMTok: number;
  outputPerMTok: number;
  note: string;
}

/**
 * Deliberately an allowlist rather than a free text field.
 *
 * An admin console that lets you type a model name is a console that lets you
 * break the endpoint for every user with a typo, and there would be no price
 * for whatever you typed.
 */
export const MODELS: ModelInfo[] = [
  {
    id: "claude-opus-5",
    label: "Opus 5",
    inputPerMTok: 5,
    outputPerMTok: 25,
    note: "Most capable. What she runs on.",
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    inputPerMTok: 3,
    outputPerMTok: 15,
    note: "Cheaper, still strong. A sensible default if volume grows.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    inputPerMTok: 1,
    outputPerMTok: 5,
    note: "Fastest and cheapest. Fine for a character answering in one paragraph.",
  },
  {
    id: "claude-opus-4-6",
    label: "Opus 4.6",
    inputPerMTok: 5,
    outputPerMTok: 25,
    note: "Previous generation, same price.",
  },
];

export const MODEL_IDS = MODELS.map((m) => m.id);

export function modelInfo(id: string) {
  return MODELS.find((m) => m.id === id) ?? null;
}

/**
 * Prices one call.
 *
 * Returns 0 for a model that is not in the table rather than guessing. A wrong
 * cost is worse than a missing one: it goes into a chart and gets believed.
 */
export function priceCall(model: string, inputTokens: number, outputTokens: number) {
  const info = modelInfo(model);
  if (!info) return 0;
  return (
    (inputTokens / 1_000_000) * info.inputPerMTok +
    (outputTokens / 1_000_000) * info.outputPerMTok
  );
}

/** Formats a cost for display. Sub-cent figures are the common case here. */
export function formatUsd(value: number) {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* --------------------------------------------------------------- periods -- */

export const PERIODS = ["minute", "hour", "day", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

/**
 * How far back to look, and how to bucket, for each period the console offers.
 *
 * `bucket` is the granularity of one bar; `windowHours` is how much history to
 * draw. Sixty-ish points is the target — enough to see a shape, few enough to
 * label.
 */
export const PERIOD_SPEC: Record<Period, { bucket: Period; windowHours: number; label: string }> = {
  minute: { bucket: "minute", windowHours: 1, label: "Last hour, by minute" },
  hour: { bucket: "hour", windowHours: 24, label: "Last 24 hours, by hour" },
  day: { bucket: "day", windowHours: 24 * 30, label: "Last 30 days, by day" },
  week: { bucket: "week", windowHours: 24 * 7 * 26, label: "Last 26 weeks, by week" },
  month: { bucket: "month", windowHours: 24 * 365, label: "Last 12 months, by month" },
  year: { bucket: "year", windowHours: 24 * 365 * 5, label: "Last 5 years, by year" },
};

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}
