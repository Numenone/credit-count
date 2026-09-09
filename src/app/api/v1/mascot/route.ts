import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { apiError, getAuthedClient, json, readJson, unauthorised } from "@/lib/api";
import {
  HISTORY_LIMIT,
  MASCOT_MAX_TOKENS,
  MASCOT_MODEL,
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  isEmotion,
} from "@/lib/mascot";

/**
 * POST /api/v1/mascot — ask the mascot a question.
 *
 * Three gates before a single token is bought, in this order:
 *   1. A valid session. Anonymous callers cannot spend the API key.
 *   2. A rate limit enforced in Postgres by claim_mascot_turn(), on a table with
 *      no RLS policies — the caller cannot reset their own allowance.
 *   3. Input validation, which bounds message length and history depth so a
 *      caller cannot inflate the prompt.
 *
 * The model's output never becomes anything but display text: no tool, no query,
 * no navigation, no write. That is what actually contains prompt injection here —
 * the system prompt's boundary wording is the polite layer on top.
 */

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4000),
});

const requestSchema = z.object({
  message: z.string().trim().min(1, "Say something first").max(1000),
  history: z.array(turnSchema).max(HISTORY_LIMIT).optional(),
});

export async function POST(request: Request) {
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

  // Claimed before the model call, so a rejected turn still costs the caller
  // their allowance rather than handing them a free retry.
  const { data: allowed, error: limitError } = await supabase.rpc("claim_mascot_turn", {
    max_turns: 12,
    window_minutes: 5,
  });

  if (limitError) return apiError("Bad request", 400, limitError.message);
  if (allowed !== true) {
    return apiError(
      "Too many requests",
      429,
      "Rusty needs a moment — you have asked a lot in the last few minutes. Try again shortly.",
    );
  }

  const anthropic = new Anthropic();

  // History arrives from the client, so it is treated exactly like the new
  // message: content, never instruction. There is no channel here through which
  // a caller can add a system turn.
  const messages: Anthropic.MessageParam[] = [
    ...(parsed.data.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    { role: "user" as const, content: parsed.data.message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: MASCOT_MODEL,
      max_tokens: MASCOT_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      // Low effort suits a character answering in two short paragraphs, and is
      // documented as strong on this model. Thinking stays on (the default):
      // disabling it is the setting that leaks reasoning into visible text.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      messages,
    });

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

    const answer = JSON.parse(text.text) as { emotion?: unknown; reply?: unknown };

    // Re-validate rather than trust: the emotion selects an illustration, so an
    // unexpected value would render an undefined face.
    const emotion = isEmotion(answer.emotion) ? answer.emotion : "happy";
    const reply =
      typeof answer.reply === "string" && answer.reply.trim()
        ? answer.reply.trim()
        : "Sorry — I lost my train of thought there. Ask me again?";

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
