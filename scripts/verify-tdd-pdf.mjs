/**
 * Checks the HTML the PDF is printed from. Run after build-tdd-pdf.mjs.
 *
 *   node scripts/build-tdd-pdf.mjs && node scripts/verify-tdd-pdf.mjs
 *
 * Every expectation is derived from docs/TDD.md rather than restated here.
 *
 * The PDF itself cannot be read back cheaply — Chromium embeds subset fonts and
 * writes text as glyph indices rather than characters — so the honest place to
 * verify the conversion is its input. If the HTML is right and the PDF is three
 * pages of the expected density, the conversion is right.
 */
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const html = readFileSync(join(tmpdir(), "credit-count-tdd", "tdd.html"), "utf8");
const markdown = readFileSync("docs/TDD.md", "utf8");

const body = html.slice(html.indexOf("<body>"));
const visible = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const haystack = flat(visible);

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

console.log("Every heading survived the conversion");
for (const [, heading] of markdown.matchAll(/^##\s+(.+)$/gm)) {
  check(heading.trim(), haystack.includes(flat(heading.trim())));
}

console.log("\nStructure");
// Counted from the source rather than asserted from memory: the first version
// of this check expected three and the document has two.
const expectedTables = (markdown.match(/^\|---/gm) ?? []).length;
check(`${expectedTables} tables rendered`,
  (body.match(/<table>/g) ?? []).length === expectedTables,
  `${(body.match(/<table>/g) ?? []).length} found`);
// Derived like the others. The document lost its blockquote when it was cut to
// three pages, and a hardcoded expectation failed for a reason that had nothing
// to do with the conversion this file exists to check.
const expectedQuotes = /^>\s/m.test(markdown);
check(
  expectedQuotes ? "the blockquote rendered" : "no blockquote in the source, none rendered",
  body.includes("<blockquote>") === expectedQuotes,
);
// Derived, not assumed. The document was rewritten into prose and now has no
// lists at all, which would have failed a hardcoded expectation for no reason.
const expectedLists = /^[-*]\s/m.test(markdown) ? 1 : 0;
check(
  expectedLists ? "lists rendered" : "no lists in the source, none rendered",
  ((body.match(/<ul>/g) ?? []).length > 0) === (expectedLists > 0),
);
check("headings rendered", (body.match(/<h2>/g) ?? []).length === 7,
  `${(body.match(/<h2>/g) ?? []).length} found`);

console.log("\nNothing leaked from the converter");
check("no 'undefined' from the code-span placeholder", !/undefined/.test(visible));
check("no stray placeholder markers", !visible.includes("\v"));
check("no unconverted bold markers", !/\*\*/.test(visible));
check("no unconverted table pipes", !/\|---/.test(visible));
check("no unconverted backticks", !visible.includes("`"));

console.log("\nThe facts a reviewer needs");
// Read the counts out of the source rather than restating them. Hardcoded, they
// failed every time a suite grew, for a reason unrelated to the conversion.
const claimedCounts = [...markdown.matchAll(/\b\d+\s+(?:unit tests|checks)\b/g)].map((m) => m[0]);
if (claimedCounts.length === 0) throw new Error("no test counts found in the source");

for (const needle of [
  "credit-count-iota.vercel.app",
  "enthusiast@creditcount.app",
  "admin@creditcount.app",
  ...claimedCounts,
]) {
  check(needle, haystack.includes(flat(needle)));
}

console.log(`\n${failures === 0 ? "The HTML matches the source." : `${failures} problem(s).`}`);
process.exit(failures === 0 ? 0 : 1);
