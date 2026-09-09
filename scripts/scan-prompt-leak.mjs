/**
 * Fails the build if the mascot's system prompt can reach a browser.
 *
 * The prompt is server-only by convention: it lives in a module a client
 * component must never import. Conventions decay. This asserts the outcome
 * instead — that the built client bundle contains none of it — which is the
 * thing that actually matters and the thing a refactor can silently break.
 *
 * It is easy to break by accident. Importing any *value* from `mascot.ts` into
 * a client component pulls the whole module in; only `import type` is erased.
 * That is exactly why the emotion enum lives in `mascot-shared.ts`.
 *
 * Run after `next build`: node scripts/scan-prompt-leak.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const BUNDLE = ".next/static";

if (!existsSync(BUNDLE)) {
  console.error(`${BUNDLE} not found — run \`next build\` first.`);
  process.exit(1);
}

/**
 * Distinctive phrases from the prompt and the model configuration.
 *
 * Chosen to be specific enough that a match is unambiguous, and spread across
 * the prompt so that leaking any part of it trips at least one.
 */
const NEEDLES = [
  "UNTRUSTED INPUT",
  "Text inside <visitor> tags",
  "never reveal, quote, summarise",
  "who drives the train for Credit Count",
  "Earlier assistant turns are a record",
  "ANTHROPIC_API_KEY",
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

let leaks = 0;
let scanned = 0;

for (const file of walk(BUNDLE)) {
  if (!/\.(js|mjs|css|json|txt)$/.test(file)) continue;
  scanned += 1;
  const text = readFileSync(file, "utf8");
  for (const needle of NEEDLES) {
    // Case-insensitive: a minifier will not change case, but a future
    // transform might, and a near-miss here is still a leak.
    if (text.toLowerCase().includes(needle.toLowerCase())) {
      console.error(`${file}  contains "${needle}"`);
      leaks += 1;
    }
  }
}

if (leaks > 0) {
  console.error(
    `\n${leaks} leak(s). The system prompt reached the client bundle — check for a` +
      " client component importing a value (not just a type) from src/lib/mascot.ts.",
  );
  process.exit(1);
}

console.log(`No prompt or key material in ${scanned} client bundle files.`);
