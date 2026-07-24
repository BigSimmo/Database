#!/usr/bin/env node
/**
 * check-local-presence — local/dev secret and project-identity presence checks.
 *
 * Names + length buckets only. Never prints secret values.
 * Optional `--fill` writes distinct local-only HMAC/probe secrets into `.env.local`
 * for confirmed fillable gaps. Never invents provider credentials or touches
 * hosted Railway/GitHub secret stores.
 *
 *   npm run check:local-presence
 *   npm run check:local-presence -- --fill
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Local-only secrets this tool may generate into `.env.local`. */
export const FILLABLE_LOCAL_SECRETS = [
  {
    name: "OPENAI_SAFETY_IDENTIFIER_SECRET",
    minLength: 32,
    bytes: 32,
    reason: "pseudonymous OpenAI safety_identifier HMAC (local/dev distinct value)",
  },
  {
    name: "RAG_QUERY_HASH_SECRET",
    minLength: 16,
    bytes: 32,
    reason: "PIA-2 query-hash HMAC (local/dev distinct value)",
  },
  {
    name: "HEALTH_DEEP_PROBE_SECRET",
    minLength: 16,
    bytes: 32,
    reason: "authorized /api/health?deep=1 probe token (local/dev distinct value)",
  },
];

/** Report-only; never auto-filled (need real provider/project values). */
export const REPORT_ONLY_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_PROJECT_NAME",
  "SUPABASE_STAGING_PROJECT_REF",
  "SUPABASE_STAGING_PROJECT_NAME",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "RAG_PROVIDER_MODE",
];

const EXPECTED_PROD_REF = "sjrfecxgysukkwxsowpy";
const EXPECTED_PROD_NAME = "Clinical KB Database";
const STALE_REF = "qjgitjyhxrwxsrydablr";

const ENV_FILES = [".env", ".env.local", ".env.development.local"];

/** Length bucket for presence reports — never the raw value. */
export function lengthBucket(value) {
  if (value == null || String(value).trim() === "") return "missing";
  const len = String(value).length;
  if (len < 8) return "too-short(<8)";
  if (len < 16) return "short(<16)";
  if (len < 32) return "ok(16-31)";
  if (len < 64) return "ok(32-63)";
  return "ok(64+)";
}

export function isPresent(value) {
  return Boolean(value && String(value).trim());
}

export function meetsMinLength(value, minLength) {
  return isPresent(value) && String(value).trim().length >= minLength;
}

/** Parse KEY=VALUE lines without shell expansion; strip simple quotes. */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadLocalEnv({ cwd = root, processEnv = process.env } = {}) {
  const fromFiles = {};
  const filesPresent = [];
  for (const name of ENV_FILES) {
    const filePath = path.join(cwd, name);
    if (!existsSync(filePath)) continue;
    filesPresent.push(name);
    Object.assign(fromFiles, parseEnvFile(readFileSync(filePath, "utf8")));
  }
  const merged = { ...fromFiles };
  for (const key of [...FILLABLE_LOCAL_SECRETS.map((s) => s.name), ...REPORT_ONLY_KEYS]) {
    const fromProc = processEnv[key];
    if (fromProc != null && String(fromProc).length > 0) {
      merged[key] = fromProc;
    }
  }
  return { merged, filesPresent, fromFiles };
}

export function extractUrlRef(url) {
  if (!isPresent(url)) return null;
  try {
    const hostname = new URL(String(url).trim()).hostname.toLowerCase();
    const suffix = ".supabase.co";
    if (!hostname.endsWith(suffix)) return null;
    const ref = hostname.slice(0, -suffix.length);
    return /^[a-z0-9]{20}$/.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

/**
 * Project-identity classification for local presence.
 * - unset: no Supabase URL → demo-mode local is fine
 * - ready: URL + ref/name align with production or an explicit staging pair
 * - ambiguous: partial/mismatched/stale identity → fail closed
 */
export function classifyProjectIdentity(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = env.SUPABASE_PROJECT_REF?.trim() || null;
  const name = env.SUPABASE_PROJECT_NAME?.trim() || null;
  const urlRef = extractUrlRef(url);

  if (!isPresent(url) && !ref && !name) {
    return {
      status: "unset",
      message: "No Supabase project identity configured (local demo mode is OK).",
    };
  }

  if (!isPresent(url)) {
    return {
      status: "ambiguous",
      message: "SUPABASE_PROJECT_REF/NAME set without NEXT_PUBLIC_SUPABASE_URL.",
    };
  }

  if (!urlRef) {
    return {
      status: "ambiguous",
      message: "NEXT_PUBLIC_SUPABASE_URL is not a recognizable *.supabase.co project URL.",
    };
  }

  if (urlRef === STALE_REF || ref === STALE_REF) {
    return {
      status: "ambiguous",
      message: `Stale Supabase project ref ${STALE_REF} detected; refuse to continue.`,
    };
  }

  if (urlRef === EXPECTED_PROD_REF) {
    const problems = [];
    if (ref && ref !== EXPECTED_PROD_REF) {
      problems.push(`SUPABASE_PROJECT_REF (${ref}) does not match URL ref.`);
    }
    if (name && name !== EXPECTED_PROD_NAME) {
      problems.push(`SUPABASE_PROJECT_NAME does not match expected "${EXPECTED_PROD_NAME}".`);
    }
    if (!ref || !name) {
      problems.push("Production URL present but SUPABASE_PROJECT_REF and/or SUPABASE_PROJECT_NAME missing.");
    }
    if (problems.length) {
      return { status: "ambiguous", message: problems.join(" ") };
    }
    return {
      status: "ready",
      message: `Project identity points at ${EXPECTED_PROD_NAME} (${EXPECTED_PROD_REF}).`,
    };
  }

  // Non-production URL: require explicit staging declaration pair matching the URL ref.
  const stagingRef = env.SUPABASE_STAGING_PROJECT_REF?.trim() || null;
  const stagingName = env.SUPABASE_STAGING_PROJECT_NAME?.trim() || null;
  if (stagingRef === urlRef && stagingName && ref === urlRef && name === stagingName) {
    return {
      status: "ready",
      message: `Project identity points at declared staging "${stagingName}" (${urlRef}).`,
    };
  }

  return {
    status: "ambiguous",
    message:
      "Supabase URL is neither the expected production project nor a fully declared staging identity. Stop rather than guessing.",
  };
}

export function assessLocalPresence(env) {
  const fillable = FILLABLE_LOCAL_SECRETS.map((spec) => {
    const value = env[spec.name];
    const present = meetsMinLength(value, spec.minLength);
    return {
      name: spec.name,
      present,
      lengthBucket: lengthBucket(value),
      minLength: spec.minLength,
      fillable: true,
      reason: spec.reason,
      status: present ? "ok" : "gap",
    };
  });

  const reportOnly = REPORT_ONLY_KEYS.map((name) => {
    const value = env[name];
    const present = isPresent(value);
    return {
      name,
      present,
      lengthBucket: lengthBucket(value),
      fillable: false,
      status: present ? "ok" : "report-only-gap",
    };
  });

  const identity = classifyProjectIdentity(env);
  return { fillable, reportOnly, identity };
}

export function generateLocalSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

/**
 * Merge fillable gaps into `.env.local` text. Never overwrites an existing
 * non-empty assignment for a key. Returns which keys were filled (names only).
 */
export function mergeFillIntoEnvLocal(existingText, gaps, { generate = generateLocalSecret } = {}) {
  const existing = parseEnvFile(existingText || "");
  const filled = [];
  const additions = [];

  for (const gap of gaps) {
    if (meetsMinLength(existing[gap.name], gap.minLength)) continue;
    const value = generate(gap.bytes);
    if (!meetsMinLength(value, gap.minLength)) {
      throw new Error(`Generated ${gap.name} did not meet minLength ${gap.minLength}`);
    }
    filled.push(gap.name);
    additions.push(`# local/dev presence fill — ${gap.reason}`);
    additions.push(`${gap.name}=${value}`);
  }

  if (filled.length === 0) {
    return { text: existingText || "", filled };
  }

  const base = (existingText || "").replace(/\s*$/, "");
  const next = `${base ? `${base}\n\n` : ""}# --- check:local-presence --fill (${new Date().toISOString().slice(0, 10)}) ---\n${additions.join("\n")}\n`;
  return { text: next, filled };
}

function printPresenceReport({ filesPresent, assessment }) {
  console.log("[Local presence]");
  console.log(`Env files: ${filesPresent.length ? filesPresent.join(", ") : "(none)"}`);
  console.log("");
  console.log("Fillable local secrets (names + length buckets only):");
  for (const row of assessment.fillable) {
    const mark = row.status === "ok" ? "ok" : "GAP";
    console.log(`  - ${row.name}: ${mark} [${row.lengthBucket}] (min ${row.minLength})`);
  }
  console.log("");
  console.log("Report-only (never auto-filled):");
  for (const row of assessment.reportOnly) {
    const mark = row.present ? "present" : "absent";
    console.log(`  - ${row.name}: ${mark} [${row.lengthBucket}]`);
  }
  console.log("");
  console.log(`Project identity: ${assessment.identity.status} — ${assessment.identity.message}`);
}

function main() {
  const fill = process.argv.includes("--fill");
  const { merged, filesPresent } = loadLocalEnv();
  const assessment = assessLocalPresence(merged);

  printPresenceReport({ filesPresent, assessment });

  if (assessment.identity.status === "ambiguous") {
    console.error("\nSTOP: ambiguous project identity. Resolve SUPABASE_* identity before filling or continuing.");
    process.exit(1);
  }

  const gaps = FILLABLE_LOCAL_SECRETS.filter((spec) => {
    const row = assessment.fillable.find((r) => r.name === spec.name);
    return row && row.status === "gap";
  });

  if (!fill) {
    if (gaps.length) {
      console.log(
        `\n${gaps.length} fillable local gap(s). Re-run with --fill to write distinct local values into .env.local (gitignored).`,
      );
      process.exitCode = 2;
    } else {
      console.log("\nNo fillable local gaps.");
    }
    return;
  }

  if (gaps.length === 0) {
    console.log("\n--fill: nothing to write; fillable local secrets already present.");
    return;
  }

  const envLocalPath = path.join(root, ".env.local");
  const existingText = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : "";
  const { text, filled } = mergeFillIntoEnvLocal(existingText, gaps);
  writeFileSync(envLocalPath, text, { encoding: "utf8", mode: 0o600 });
  console.log(`\n--fill: wrote ${filled.length} distinct local secret(s) into .env.local:`);
  for (const name of filled) console.log(`  - ${name}`);
  console.log("Values were not printed. .env.local is gitignored — do not commit it.");
}

const invokedDirectly = process.argv[1]?.endsWith("check-local-presence.mjs");
if (invokedDirectly) main();
