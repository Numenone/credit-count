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
  // Set by the interface, never chosen by the model.
  "idle",
  "thinking",

  // Warmth and agreement.
  "happy",
  "thrilled",
  "amused",
  "cheeky",
  "proud",
  "impressed",
  "awestruck",

  // Subject matter.
  "history",
  "geography",
  "focused",
  "determined",
  "nostalgic",

  // Not following, or not sure.
  "curious",
  "confused",
  "uncertain",
  "surprised",

  // Care, and the two refusals.
  "sympathetic",
  "reassuring",
  "sheepish",
  "stern",

  // After describing something violent enough to rattle her.
  "dizzy",
  "sleepy",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

/**
 * The subset the model may actually choose from.
 *
 * `idle` and `thinking` are states of the interface, not of the character — she
 * is idle because nobody has asked anything, and thinking because a request is
 * in flight. The model cannot know either, so it is not offered them.
 *
 * Derived once here because it was previously filtered inline in the response
 * schema and counted by hand in the admin console, which is two places to
 * update and one of them would have been missed.
 */
export const MODEL_EMOTIONS: readonly Emotion[] = EMOTIONS.filter(
  (emotion) => emotion !== "idle" && emotion !== "thinking",
);

export function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (EMOTIONS as readonly string[]).includes(value);
}

/**
 * How many turns of history to send.
 *
 * Six is three exchanges — enough for "and the other one?" to resolve, which is
 * what context is actually for here. Twelve doubled the prompt on every long
 * conversation for almost no gain, and the prompt is the term that grows.
 */
export const HISTORY_LIMIT = 6;

export const MASCOT_NAME = "Rusty";
