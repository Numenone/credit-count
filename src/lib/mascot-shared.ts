/**
 * The parts of the mascot that both sides of the wire need.
 *
 * Split out from `mascot.ts` deliberately: that module holds the system prompt
 * and the model configuration, and a client component importing a *value* from
 * it would pull the whole prompt into the browser bundle. Types erase at build
 * time, but constants do not — so the constants the UI needs live here instead.
 */

/**
 * The expressions the character can be drawn in.
 *
 * This list is the contract between the model and the illustration. The model
 * picks one, but the value is re-validated against this array on the server
 * before it reaches the component — a model that returns something unexpected
 * gets clamped rather than rendering an undefined face.
 */
export const EMOTIONS = [
  "idle",
  "thinking",
  "happy",
  "thrilled",
  "history",
  "geography",
  "surprised",
  "sheepish",
  "stern",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (EMOTIONS as readonly string[]).includes(value);
}

/** How many turns of history to send. Enough for context, bounded for cost. */
export const HISTORY_LIMIT = 12;

export const MASCOT_NAME = "Rusty";
