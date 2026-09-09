import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { apiError, getAuthedClient, json, readJson, unauthorised } from "@/lib/api";
import {
  HISTORY_LIMIT,
  MASCOT_MAX_TOKENS,
  MASCOT_MODEL,
  MAX_REPLY_CHARS,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  fenceMessage,
  isEmotion,
  isWellFormedHistory,
  sanitise,
} from "@/lib/mascot";

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
 * Only then does a token get bought.
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

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Same-origin fetches may omit it entirely.
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError(
      "Not configured",
      503,
      "The mascot needs an ANTHROPIC_API_KEY on the server. Everything else works without it.",
    );
  }

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

  // Claimed before the model call, so a rejected turn still costs the caller
  // their allowance rather than handing them a free retry.
  const { data: allowed, error: limitError } = await supabase.rpc("claim_mascot_turn", {
    max_turns: 8,
    window_minutes: 5,
    max_per_day: 60,
  });

  if (limitError) return apiError("Bad request", 400, limitError.message);
  if (allowed !== true) {
    return apiError(
      "Too many requests",
      429,
      "Rusty needs a moment — you have asked a lot recently. Try again shortly.",
    );
  }

  const anthropic = new Anthropic();

  // History is treated exactly like the new message: content, never
  // instruction. There is no channel here through which a caller can add a
  // system turn — the roles are constrained to user and assistant by the schema
  // above, and the order by isWellFormed.
  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.text })),
    { role: "user" as const, content: fenceMessage(message) },
  ];

  try {
    const response = await anthropic.messages.create(
      {
        model: MASCOT_MODEL,
        max_tokens: MASCOT_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        // Low effort suits a character answering in one short paragraph, and is
        // documented as strong on this model. Thinking stays on (the default):
        // disabling it is the setting that leaks reasoning into visible text.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: RESPONSE_SCHEMA },
        },
        messages,
      },
      // A hung upstream would otherwise hold the function open until the
      // platform kills it, which costs a slot and tells the caller nothing.
      { timeout: 30_000, maxRetries: 1 },
    );

    if (response.stop_reason === "refusal") {
      return json({
        data: {
          emotion: "stern",
          reply: "I am not going to help with that. Ask me about a coaster instead.",
        },
      });
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") {
      return apiError("Bad gateway", 502, "The mascot did not answer. Try again.");
    }

    // A completion cut off at max_tokens leaves the JSON unterminated, so the
    // parse is allowed to fail rather than being assumed to succeed.
    let answer: { emotion?: unknown; reply?: unknown };
    try {
      answer = JSON.parse(text.text) as typeof answer;
    } catch {
      return apiError("Bad gateway", 502, "The mascot lost her train of thought. Ask again.");
    }

    // Re-validate rather than trust: the emotion selects an illustration, so an
    // unexpected value would render an undefined face.
    const emotion = isEmotion(answer.emotion) ? answer.emotion : "happy";
    const raw = typeof answer.reply === "string" ? answer.reply : "";
    const reply =
      sanitise(raw, MAX_REPLY_CHARS) || "Sorry — I lost my train of thought there. Ask me again?";

    return json({ data: { emotion, reply } });
  } catch (error) {
    // Never surface the provider's error text: it can name the model, the
    // account and the prompt, and this endpoint is reachable by any user.
    if (error instanceof Anthropic.RateLimitError) {
      return apiError("Too many requests", 429, "Rusty is busy right now. Try again in a moment.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return apiError("Not configured", 503, "The mascot's API credentials are not valid.");
    }
    console.error("mascot request failed", error);
    return apiError("Bad gateway", 502, "The mascot could not answer just now.");
  }
}
