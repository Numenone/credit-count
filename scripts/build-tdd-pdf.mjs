/**
 * Renders docs/TDD.md to a print-ready PDF.
 *
 * The Markdown is the source of truth — it lives in the repository, reviews in
 * a diff, and cannot drift from a binary someone exported once and forgot. This
 * regenerates the PDF from it.
 *
 * The converter handles exactly the subset the document uses rather than
 * pulling in a Markdown library: headings, paragraphs, tables, lists,
 * blockquotes, rules, and inline code, links, bold and italic. A general parser
 * would be more code to review for no benefit, and a wrong render is obvious
 * the moment you open the result.
 *
 * Run: node scripts/build-tdd-pdf.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SOURCE = "docs/TDD.md";
const OUT = "docs/TDD.pdf";

/* --------------------------------------------------------------- inline -- */

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Marks a lifted code span while the emphasis rules run.
 *
 * A vertical tab, because it cannot appear in the document and does not collide
 * with anything. The first attempt used " index " — which meant every bare
 * number in the prose ("63 unit tests", "39 checks") was mistaken for a
 * placeholder on the way back and replaced with <code>undefined</code>.
 */
const MARK = "\v";

/**
 * Inline formatting.
 *
 * Code spans are lifted out first and put back last, so a backtick containing
 * an underscore or an asterisk is not then mangled by the emphasis rules.
 */
function inline(text) {
  const code = [];
  let out = text.replace(/`([^`]+)`/g, (_, body) => {
    code.push(escapeHtml(body));
    return `${MARK}${code.length - 1}${MARK}`;
  });

  out = escapeHtml(out);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Bare URLs, which the header table uses.
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  return out.replace(
    new RegExp(`${MARK}(\\d+)${MARK}`, "g"),
    (_, i) => `<code>${code[Number(i)]}</code>`,
  );
}

/* ---------------------------------------------------------------- block -- */

function toHtml(markdown) {
  // Split on either line ending, keeping no carriage return.
  //
  // In JavaScript `.` does not match \r — it counts as a line terminator — so
  // on a CRLF file a plain split("\n") leaves one at the end of every line and
  // every `$`-anchored pattern below silently stops matching. The heading rule
  // failed, the line fell through to the paragraph branch, which refuses
  // headings, and the index stopped advancing: an infinite loop that presented
  // as this script exhausting Node's heap after three minutes.
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let i = 0;

  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const cells = (line) =>
    line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    const start = i;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      html.push("<hr>");
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // Tables. The separator row is what distinguishes one from a stray pipe.
    if (isTableRow(line) && /^[\s|:-]+$/.test(lines[i + 1] ?? "")) {
      const header = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && isTableRow(lines[i])) {
        body.push(cells(lines[i]));
        i += 1;
      }
      // A header row of empty cells is a layout table, not a labelled one.
      const labelled = header.some((c) => c !== "");
      html.push(
        `<table>${
          labelled
            ? `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`
            : ""
        }<tbody>${body
          .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }

    if (line.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote><p>${inline(quote.join(" ").trim())}</p></blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*[-*]\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        // A wrapped continuation line belongs to the item above it.
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i += 1;
      }
      html.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|>|---+$)/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }

    if (i === start) {
      // Nothing consumed the line and nothing advanced. Name it rather than
      // spinning until the process dies, which is how the bug above was found.
      throw new Error(`Unhandled line ${i + 1}: ${JSON.stringify(lines[i])}`);
    }

    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}

/* ----------------------------------------------------------------- page -- */

/**
 * Print styling.
 *
 * Same palette and proportions as the app, so the document and the thing it
 * describes look related. Sized for A4 and told where it may not break: a
 * heading orphaned at the foot of a page, or a table split across two, is the
 * tell of a document nobody opened after generating it.
 */
const CSS = `
:root {
  --ink: #14140f; --ink-2: #43423c; --ink-3: #6f6d66;
  --line: #e0ddd5; --brand: #b8391b; --surface-2: #faf9f6;
}
@page { size: A4; margin: 12mm 14mm 11mm; }

* { box-sizing: border-box; }
body {
  margin: 0; color: var(--ink); background: #fff;
  font: 9.7pt/1.40 "Segoe UI", -apple-system, system-ui, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

h1 {
  font-size: 17pt; line-height: 1.15; letter-spacing: -0.02em;
  margin: 0 0 4pt; font-weight: 650;
}
h1 + p { color: var(--ink-2); margin-top: 0; }
h2 {
  font-size: 12.5pt; letter-spacing: -0.01em; margin: 12pt 0 5pt;
  padding-bottom: 4pt; border-bottom: 1px solid var(--line); font-weight: 640;
  break-after: avoid;
}

p { margin: 0 0 5.5pt; }
strong { font-weight: 650; }

/* The rules in the source separate sections whose headings are already ruled,
   so on the page they would double up. */
hr { display: none; }

ul { margin: 0 0 7pt; padding-left: 14pt; }
li { margin-bottom: 3pt; }
li::marker { color: var(--ink-3); }

code {
  font-family: "Cascadia Mono", Consolas, ui-monospace, monospace;
  font-size: 0.86em; background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 3px; padding: 0.5pt 3pt;
}
a { color: var(--brand); text-decoration: none; }

blockquote {
  margin: 8pt 0; padding: 6pt 10pt; background: var(--surface-2);
  border-left: 2.5pt solid var(--brand); border-radius: 0 4px 4px 0;
  color: var(--ink-2); break-inside: avoid;
}
blockquote p { margin: 0; }

/* A table that refuses to break moves wholesale to the next page when it
   does not fit, and the gap it leaves behind is what turned a three-page
   document into four: pages two and three were running about 60% full.
   Rows are what must not split; the table itself may, and a header group
   repeats so a continued table keeps its column labels. */
table {
  width: 100%; border-collapse: collapse; margin: 6pt 0 9pt;
  font-size: 9pt; break-inside: auto;
}
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td {
  text-align: left; vertical-align: top; padding: 4.5pt 7pt;
  border-bottom: 1px solid var(--line);
}
th {
  font-weight: 640; font-size: 8pt; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--ink-3);
  border-bottom: 1px solid #cbc7bd;
}
/* The header table has no column labels; its first column is the label. */
table:not(:has(th)) td:first-child { font-weight: 640; width: 20%; }
`;

/* ----------------------------------------------------------------- build -- */

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Credit Count — Technical Design Document</title>
<style>${CSS}</style></head>
<body>${toHtml(readFileSync(SOURCE, "utf8"))}</body></html>`;

const work = join(tmpdir(), "credit-count-tdd");
if (!existsSync(work)) mkdirSync(work, { recursive: true });
const htmlPath = join(work, "tdd.html");
writeFileSync(htmlPath, page, "utf8");

// Chromium prints it. Edge ships with Windows, so this needs nothing installed.
const BROWSERS = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const browser = BROWSERS.find((path) => path && existsSync(path));
if (!browser) {
  console.error(`No Chromium found. The HTML is at ${htmlPath} — open it and print to PDF.`);
  process.exit(1);
}

// Absolute, because the browser does not inherit this process's working
// directory: a relative path writes the PDF somewhere else and leaves nothing
// where it was asked for, while the browser still exits successfully.
const target = resolve(OUT);

execFileSync(
  browser,
  [
    "--headless",
    "--disable-gpu",
    // Without this the sandbox fails to start in some environments and the
    // browser exits cleanly having printed nothing at all.
    "--no-sandbox",
    "--no-pdf-header-footer",
    `--print-to-pdf=${target}`,
    `file:///${htmlPath.replace(/\\/g, "/")}`,
  ],
  { stdio: "pipe", timeout: 120_000 },
);

if (!existsSync(target)) {
  console.error(
    `${browser} exited without writing ${target}.\n` +
      `The HTML is at ${htmlPath} — open it and print to PDF.`,
  );
  process.exit(1);
}

console.log(
  `${OUT} — ${(statSync(target).size / 1024).toFixed(0)} KB, ` +
    `printed by ${browser.split(/[\\/]/).pop()}`,
);
