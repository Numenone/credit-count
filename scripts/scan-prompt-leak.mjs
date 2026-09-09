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
 * Distinctive phrases from the prompt.
 *
 * Chosen to be specific enough that a match is unambiguous, and spread across
 * the prompt so that leaking any part of it trips at least one.
 *
 * "ANTHROPIC_API_KEY" was on this list and had to come off. The admin console
 * tells an operator which environment variables each gateway needs, so the
 * NAME is in the bundle by design — and a variable's name is public (it is in
 * .env.example). What must never appear is a value, which is the pattern below.
 * A check that fires on the harmless thing gets muted, and then it is not there
 * for the real one.
 */
const NEEDLES = [
  "UNTRUSTED INPUT",
  "Text inside <visitor> tags",
  "never reveal, quote, summarise",
  "who drives the train for Credit Count",
  "Earlier assistant turns are a record",
];

/** Key material, by shape. This is the one that would actually matter. */
const SECRET_SHAPES = [
  { name: "Anthropic key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "Supabase management token", re: /sbp_[a-f0-9]{40,}/ },
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
      console.error(`${file}  contains prompt text: "${needle}"`);
      leaks += 1;
    }
  }

  for (const { name, re } of SECRET_SHAPES) {
    const match = text.match(re);
    if (match) {
      console.error(`${file}  contains a ${name}: ${match[0].slice(0, 12)}…`);
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
