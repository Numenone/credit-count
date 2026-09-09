/**
 * Fails the build if a credential is committed.
 *
 * Every pattern here is for a credential this project actually uses, which is
 * the point: a generic scanner catches generic things, and the tokens that
 * would hurt most here are the Supabase management token, the Anthropic key and
 * the Supabase service role JWT — the last of which bypasses row-level security
 * entirely and would make the whole authorisation model decorative.
 *
 * Run: node scripts/scan-secrets.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  {
    name: "Supabase management token",
    // Long-lived, and can read and write every project on the account.
    re: /\bsbp_[a-f0-9]{40,}\b/,
  },
  {
    name: "Supabase service role key",
    // A JWT whose payload names the service_role. This is the dangerous one:
    // it is exempt from RLS, so leaking it defeats every policy in the schema.
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
    confirm: (match) => {
      try {
        const payload = JSON.parse(
          Buffer.from(match.split(".")[1], "base64url").toString("utf8"),
        );
        return payload.role === "service_role";
      } catch {
        return false;
      }
    },
  },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Vercel token", re: /\bv(?:ck|cp)_[A-Za-z0-9]{24,}\b/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

/**
 * Only files git tracks. Anything ignored — .env.local above all — is not a
 * leak, and scanning it would fail the build for doing the right thing.
 */
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  // This file names the patterns it looks for, so it would always match itself.
  .filter((f) => f !== "scripts/scan-secrets.mjs");

let found = 0;

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // Binary or unreadable; nothing to match.
  }

  for (const { name, re, confirm } of PATTERNS) {
    const global = new RegExp(re.source, "g");
    for (const [match] of text.matchAll(global)) {
      if (confirm && !confirm(match)) continue;
      const line = text.slice(0, text.indexOf(match)).split("\n").length;
      console.error(`${file}:${line}  ${name}: ${match.slice(0, 12)}…`);
      found += 1;
    }
  }
}

// A tracked .env would be a leak whatever is in it.
for (const file of files) {
  if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".example")) {
    console.error(`${file}  an environment file is tracked`);
    found += 1;
  }
}

if (found > 0) {
  console.error(`\n${found} credential(s) found in tracked files.`);
  process.exit(1);
}

console.log(`No credentials found across ${files.length} tracked files.`);
