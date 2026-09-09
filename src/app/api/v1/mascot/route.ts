import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { apiError, getAuthedClient, json, readJson, unauthorised } from "@/lib/api";
import {
  HISTORY_LIMIT,
  MAX_REPLY_CHARS,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  fenceMessage,
  isEmotion,
  isWellFormedHistory,
  sanitise,
} from "@/lib/mascot";
import { describeContext, loadMascotContext } from "@/lib/mascot-context";
import { GATEWAY_INFO, MODEL_IDS, priceCall, type Gateway } from "@/lib/mascot-models";

/**
 * POST /api/v1/mascot — ask the mascot a question.
 *
 * This is the app's only LLM surface and its only endpoint that spends money,
 * so it is the only one with a queue of gates in front of it. In order, and
 * cheapest first:
 *
 *   1. Shape of the request — method, content type, origin. A cross-site page
 *      cannot forge a JSON POST without a preflight, so requiring JSON is what
 *      makes this endpoint uninteresting to CSRF.
 *   2. A valid session. Anonymous callers cannot spend the API key.
 *   3. Input validation and sanitising, which bound the prompt and strip the
 *      invisible characters injection is smuggled in.
 *   4. A rate limit enforced in Postgres by claim_mascot_turn(), against a
 *      table with RLS on and no policies — the caller cannot read or reset
 *      their own allowance. Both a burst window and a daily ceiling.
 *
 * Only then does a token get bought, and every call that gets that far is
 * recorded — spend included — whether it succeeded or not.
 *
 * What actually contains prompt injection here is none of the above: it is that
 * the model's output never becomes anything but display text. No tool, no
 * query, no navigation, no write. The emotion is re-validated against a fixed
 * enum before it can select an illustration, and the reply is truncated before
 * it can reach the DOM. A perfectly successful injection buys the attacker some
 * off-topic text in their own chat window.
 */

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURN_CHARS = 1500;
/** Whole-transcript budget, independent of the per-turn caps. */
const MAX_HISTORY_CHARS = 6000;

// These bounds only stop a body large enough to be a denial of service. The
// meaningful limits are applied after sanitising, against the text that would
// actually be sent — stripping invisible padding first means a legitimate
// message is not refused for characters that were never going to reach the
// model anyway.
const ABSURD = 20_000;

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(ABSURD),
});

const requestSchema = z.object({
  message: z.string().min(1, "Say something first").max(ABSURD),
  history: z.array(turnSchema).max(HISTORY_LIMIT).optional(),
});

interface Config {
  gateway: Gateway;
  model: string;
  max_tokens: number;
  effort: "low" | "medium" | "high";
  burst_cap: number;
  daily_cap: number;
}

const FALLBACK: Config = {
  gateway: "anthropic",
  model: "claude-opus-5",
  max_tokens: 500,
  effort: "low",
  burst_cap: 8,
  daily_cap: 60,
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Same-origin fetches may omit it entirely.
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Whether the environment holds what a gateway needs to be used at all. */
function gatewayReady(gateway: Gateway) {
  return GATEWAY_INFO[gateway].requires.every((key) => Boolean(process.env[key]));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return apiError("Forbidden", 403, "Cross-origin requests are not accepted here.");
  }

  // Deliberately strict: a request that is not JSON cannot be a simple request,
  // so it cannot be made cross-site without a preflight this endpoint fails.
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
    return apiError("Unsupported media type", 415, "Send application/json.");
  }

  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorised();

  const body = await readJson(request);
  if (!body) return apiError("Bad request", 400, "Body must be a JSON object.");

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Unprocessable entity", 422, parsed.error.issues[0].message);
  }

  // Sanitising happens before anything is measured, so the budgets below are
  // counted on the text that will actually be sent.
  const message = sanitise(parsed.data.message);
  if (!message) {
    return apiError("Unprocessable entity", 422, "Say something first.");
  }
  // Refused rather than truncated: answering half a question, and charging a
  // turn for it, is worse than saying the message is too long.
  if (message.length > MAX_MESSAGE_CHARS) {
    return apiError(
      "Unprocessable entity",
      422,
      `Keep it under ${MAX_MESSAGE_CHARS} characters — that one is ${message.length}.`,
    );
  }

  // History is replay of turns that were already bounded when they were made,
  // so here truncation is the proportionate answer.
  const history = (parsed.data.history ?? [])
    .map((turn) => ({ role: turn.role, text: sanitise(turn.text, MAX_HISTORY_TURN_CHARS) }))
    .filter((turn) => turn.text.length > 0);

  if (!isWellFormedHistory(history)) {
    return apiError("Unprocessable entity", 422, "That conversation history is not valid.");
  }

  if (history.reduce((n, turn) => n + turn.text.length, 0) > MAX_HISTORY_CHARS) {
    return apiError("Unprocessable entity", 422, "That conversation is too long to continue.");
  }

  // The admin console can change the model, the gateway and both caps without a
  // deploy. Anything unrecognised falls back rather than being passed through —
  // a bad row here would otherwise take the endpoint down for everyone.
  const { data: row } = await supabase
    .from("mascot_config")
    .select("gateway, model, max_tokens, effort, burst_cap, daily_cap")
    .maybeSingle<Config>();

  const config: Config = {
    ...FALLBACK,
    ...(row ?? {}),
    ...(row && MODEL_IDS.includes(row.model) ? {} : { model: FALLBACK.model }),
    ...(row && GATEWAY_INFO[row.gateway] ? {} : { gateway: FALLBACK.gateway }),
  };

  if (!gatewayReady(config.gateway)) {
    return apiError(
      "Not configured",
      503,
      `The ${GATEWAY_INFO[config.gateway].label} gateway needs ` +
        `${GATEWAY_INFO[config.gateway].requires.join(", ")} on the server. ` +
        "Everything else works without it.",
    );
  }

  // Claimed before the model call, so a rejected turn still costs the caller
  // their allowance rather than handing them a free retry.
  const { data: allowed, error: limitError } = await supabase.rpc("claim_mascot_turn", {
    max_turns: config.burst_cap,
    window_minutes: 5,
    max_per_day: config.daily_cap,
  });

  if (limitError) return apiError("Bad request", 400, limitError.message);
  if (allowed !== true) {
    await record(supabase, config, 0, 0, 0, null, "rate_limited", null);
    return apiError(
      "Too many requests",
      429,
      "Rusty needs a moment — you have asked a lot recently. Try again shortly.",
    );
  }

  // What she knows about the person asking. Read on the caller's own session,
  // so row-level security scopes it to their rows and there is no path by which
  // she can be made to describe anyone else's history.
  const context = await loadMascotContext(supabase);

  const anthropic = new Anthropic();
  const started = Date.now();

  // History is treated exactly like the new message: content, never
  // instruction. There is no channel here through which a caller can add a
  // system turn — the roles are constrained to user and assistant by the schema
  // above, and the order by isWellFormedHistory.
  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.text })),
    { role: "user" as const, content: fenceMessage(message) },
  ];

  try {
    const response = await anthropic.messages.create(
      {
        model: config.model,
        max_tokens: config.max_tokens,
        system: `${SYSTEM_PROMPT}\n\nWHO YOU ARE TALKING TO\n${describeContext(context)}`,
        // Low effort suits a character answering in one short paragraph, and is
        // documented as strong on this model. Thinking stays on (the default):
        // disabling it is the setting that leaks reasoning into visible text.
        output_config: {
          effort: config.effort,
          format: { type: "json_schema", schema: RESPONSE_SCHEMA },
        },
        messages,
      },
      // A hung upstream would otherwise hold the function open until the
      // platform kills it, which costs a slot and tells the caller nothing.
      { timeout: 30_000, maxRetries: 1 },
    );

    const latency = Date.now() - started;
    const inTokens = response.usage?.input_tokens ?? 0;
    const outTokens = response.usage?.output_tokens ?? 0;

    if (response.stop_reason === "refusal") {
      await record(supabase, config, inTokens, outTokens, latency, "stern", "refusal", null);
      return json({
        data: {
          emotion: "stern",
          reply: "I am not going to help with that. Ask me about a coaster instead.",
        },
      });
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") {
      await record(supabase, config, inTokens, outTokens, latency, null, "error", "no_text_block");
      return apiError("Bad gateway", 502, "The mascot did not answer. Try again.");
    }

    // A completion cut off at max_tokens leaves the JSON unterminated, so the
    // parse is allowed to fail rather than being assumed to succeed.
    let answer: { emotion?: unknown; reply?: unknown };
    try {
      answer = JSON.parse(text.text) as typeof answer;
    } catch {
      await record(supabase, config, inTokens, outTokens, latency, null, "error", "unparseable");
      return apiError("Bad gateway", 502, "The mascot lost her train of thought. Ask again.");
    }

    // Re-validate rather than trust: the emotion selects an illustration, so an
    // unexpected value would render an undefined face.
    const emotion = isEmotion(answer.emotion) ? answer.emotion : "happy";
    const raw = typeof answer.reply === "string" ? answer.reply : "";
    const reply =
      sanitise(raw, MAX_REPLY_CHARS) || "Sorry — I lost my train of thought there. Ask me again?";

    await record(supabase, config, inTokens, outTokens, latency, emotion, "ok", null);
    return json({ data: { emotion, reply } });
  } catch (error) {
    const latency = Date.now() - started;

    // Never surface the provider's error text: it can name the model, the
    // account and the prompt, and this endpoint is reachable by any user. The
    // ledger gets a short machine-readable reason instead.
    if (error instanceof Anthropic.RateLimitError) {
      await record(supabase, config, 0, 0, latency, null, "error", "upstream_rate_limit");
      return apiError("Too many requests", 429, "Rusty is busy right now. Try again in a moment.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      await record(supabase, config, 0, 0, latency, null, "error", "auth");
      return apiError("Not configured", 503, "The mascot's API credentials are not valid.");
    }
    console.error("mascot request failed", error);
    await record(supabase, config, 0, 0, latency, null, "error", "upstream");
    return apiError("Bad gateway", 502, "The mascot could not answer just now.");
  }
}

/**
 * Appends the call to the ledger.
 *
 * Deliberately never throws: a failure to record is not a reason to fail a
 * request the user already paid for. It is also priced here rather than at read
 * time, so history keeps what it actually cost when rates change.
 */
async function record(
  supabase: Awaited<ReturnType<typeof getAuthedClient>>["supabase"],
  config: Config,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  emotion: string | null,
  outcome: "ok" | "refusal" | "error" | "rate_limited",
  errorKind: string | null,
) {
  try {
    await supabase.rpc("record_mascot_call", {
      p_gateway: config.gateway,
      p_model: config.model,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cost_usd: priceCall(config.model, inputTokens, outputTokens),
      p_latency_ms: latencyMs,
      p_emotion: emotion,
      p_outcome: outcome,
      p_error_kind: errorKind,
    });
  } catch (error) {
    console.error("could not record mascot usage", error);
  }
}
