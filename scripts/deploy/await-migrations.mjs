#!/usr/bin/env node
/**
 * scripts/deploy/await-migrations.mjs
 *
 * Railway `deploy.preDeployCommand` gate for both the app and worker
 * services. Railway deploys code and the Supabase GitHub integration applies
 * merged migrations independently and unordered, so a redeploy can start
 * serving traffic against a database that has not yet taken a migration the
 * new code depends on. This script checks (or, in `enforce` mode, blocks)
 * until every migration version this build's manifest expects is present in
 * live migration history.
 *
 * Modes (env `DEPLOY_MIGRATION_GATE`, default `report`):
 *   - `off`     — skip immediately; the migration-history RPC is never called.
 *   - `report`  — makes exactly ONE read, logs PASS / missing / error, and
 *                 always exits 0. No polling, no wait. This is the default
 *                 for this change: observe real deploys before anything can
 *                 block one.
 *   - `enforce` — polls (every DEPLOY_MIGRATION_GATE_POLL_S) and exits 1 if
 *                 migrations are still missing, or the read keeps failing,
 *                 once DEPLOY_MIGRATION_GATE_MAX_WAIT_S has elapsed.
 *   Any other value (a typo, an unset variable holding garbage) is treated as
 *   `report` — a value this gate does not recognise must never be the reason
 *   a deploy blocks — and logs a warning naming the bad value.
 *
 * Fails safe by construction: the whole body below the `--self-test`/`off`
 * checks runs inside a try/catch, and every unexpected error — a missing or
 * corrupt manifest, a malformed URL, anything else — exits 0 unless the mode
 * is exactly `enforce`. `report` mode can therefore never be the reason a
 * deploy is blocked, including by a bug in this script.
 *
 * Env:
 *   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — required in
 *     `report`/`enforce` mode to read live migration history. Never logged;
 *     only the URL's host is logged, never the key or the full URL.
 *   - DEPLOY_MIGRATION_GATE_POLL_S (default 20, clamped to >= 1) — seconds
 *     between reads in `enforce` mode. Unused in `report` mode.
 *   - DEPLOY_MIGRATION_GATE_MAX_WAIT_S (default 600, clamped to <= 3000) —
 *     seconds to keep polling in `enforce` mode before giving up. Unused in
 *     `report` mode. A non-numeric, blank, zero, or negative value for either
 *     setting falls back to its default rather than producing NaN (which
 *     would never end the poll) or 0 (which would flood the RPC).
 *
 * Emergency override: set DEPLOY_MIGRATION_GATE=off on the Railway service to
 * skip this check entirely (see docs/worker-deploy-runbook.md §0).
 */
import { readFileSync } from "node:fs";

import { missingVersions } from "./migration-versions.mjs";

export const DEFAULT_POLL_S = 20;
export const DEFAULT_MAX_WAIT_S = 600;
/** Floor for DEPLOY_MIGRATION_GATE_POLL_S: below this the RPC would be flooded. */
export const MIN_POLL_S = 1;
/** Ceiling for DEPLOY_MIGRATION_GATE_MAX_WAIT_S: bounds a misconfigured enforce wait. */
export const MAX_WAIT_S = 3000;
export const DEFAULT_MANIFEST_PATH = new URL("../../deploy/expected-migrations.json", import.meta.url);

/**
 * @param {string | URL} [manifestPath]
 * @returns {string[]}
 */
export function readManifestVersions(manifestPath = DEFAULT_MANIFEST_PATH) {
  const raw = readFileSync(manifestPath, "utf8");
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Migration manifest at ${manifestPath} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }
  const versions = /** @type {{ versions?: unknown }} */ (parsed)?.versions;
  if (!Array.isArray(versions)) {
    throw new Error(`Migration manifest at ${manifestPath} is missing a "versions" array`);
  }
  return /** @type {string[]} */ (versions);
}

/** Strip trailing slashes so `${url}/rest/v1/...` never doubles up. @param {string} url */
export function normalizeSupabaseUrl(url) {
  return url.replace(/\/+$/, "");
}

/** @param {string} url */
function redactedHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(unreadable URL)";
  }
}

/**
 * Defense in depth for the "only the host is logged" contract: `redactedHost`
 * above never echoes an unparseable URL, but an underlying fetch/network
 * error's own message can still mention the literal URL or origin (some
 * runtimes embed it in a connection-refused message). Strip both the exact
 * URL and its origin from any text before logging it. NEXT_PUBLIC_SUPABASE_URL
 * is not a secret — it ships in the client bundle — this is about honouring
 * the documented log shape, not hiding a credential.
 *
 * @param {string} text
 * @param {string} url
 * @returns {string}
 */
export function scrubUrl(text, url) {
  if (!url) return text;
  let scrubbed = text.split(url).join("[project url]");
  try {
    const origin = new URL(url).origin;
    scrubbed = scrubbed.split(origin).join("[project url]");
  } catch {
    // url itself did not parse; nothing further to scrub.
  }
  return scrubbed;
}

/**
 * A non-numeric, blank, zero, or negative override falls back to `fallback`
 * rather than becoming NaN (which would never satisfy a deadline check — an
 * unbounded poll) or 0 (which would flood the RPC on every tick).
 *
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function positiveNumberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read live migration-history versions via the service-role-only RPC
 * (`public.migration_history_versions()`, migration 20260820120000) — the
 * same RPC scripts/check-migration-history-alignment.ts prefers. Unlike that
 * script, this gate does not fall back to the Accept-Profile read: a project
 * old enough to lack the RPC is not this gate's concern, and failing loudly
 * here is safer than silently reading a schema this project does not expose.
 *
 * @param {string} url
 * @param {string} serviceKey
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<string[]>}
 */
export async function fetchLiveVersions(url, serviceKey, { fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const response = await fetchImpl(`${url}/rest/v1/rpc/migration_history_versions`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`migration_history_versions() RPC failed (status ${response.status}): ${text.slice(0, 240)}`);
  }

  const payload = /** @type {{ probe?: string, versions?: { version: string }[] } | null} */ (await response.json());
  if (!payload || payload.probe !== "ok" || !Array.isArray(payload.versions)) {
    throw new Error(
      `migration_history_versions() returned an unexpected payload (probe: ${payload?.probe ?? "unknown"})`,
    );
  }
  return payload.versions.map((row) => row.version);
}

/**
 * Pure poll loop — injected fetchVersions/sleep/now so it is unit-testable
 * without a real clock or network. Reads once immediately, then keeps
 * re-reading every `pollS` seconds until either every expected version is
 * present or `maxWaitS` seconds (measured via the injected `now`) have
 * elapsed. A read that throws is treated as "still missing" for this
 * iteration and retried, so one transient failure never ends the poll early.
 *
 * `maxWaitS: 0` (what `runGate` passes for `report` mode) forces exactly one
 * read and no sleep: the deadline is already met the instant the first read
 * returns, success or not.
 *
 * @param {{
 *   expectedVersions: string[],
 *   fetchVersions: () => Promise<string[]>,
 *   sleep: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   pollS?: number,
 *   maxWaitS?: number,
 *   log?: (message: string) => void,
 * }} args
 * @returns {Promise<{ ok: boolean, missing: string[], error: string | null }>}
 */
export async function pollForMigrations({
  expectedVersions,
  fetchVersions,
  sleep,
  now = () => Date.now(),
  pollS = DEFAULT_POLL_S,
  maxWaitS = DEFAULT_MAX_WAIT_S,
  log = () => {},
}) {
  const deadline = now() + maxWaitS * 1000;
  let missing = expectedVersions;
  let lastError = /** @type {string | null} */ (null);

  for (;;) {
    try {
      const live = await fetchVersions();
      lastError = null;
      missing = missingVersions(expectedVersions, live);
      if (missing.length === 0) {
        return { ok: true, missing: [], error: null };
      }
      log(`${missing.length} expected migration version(s) not yet in live history.`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      log(`migration history read failed: ${lastError}`);
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      return { ok: false, missing, error: lastError };
    }
    // Never sleep past the deadline: a poll interval larger than the wait budget would
    // otherwise stall the deploy for the whole interval instead of maxWaitS.
    await sleep(Math.min(pollS * 1000, remainingMs));
  }
}

/**
 * The whole gate, with every side effect injectable: env, the fetch
 * implementation, the clock, and the sleep function. Returns an exit code
 * rather than throwing, so `report` mode's "always exit 0" contract and
 * `enforce` mode's "exit 1 on failure" contract are both plain return values
 * a test can assert on directly — no process spawning or real network access
 * needed to exercise `off` / `report` / `enforce` / missing-env behaviour.
 *
 * @param {{
 *   argv?: string[],
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   readManifest?: (path?: string | URL) => string[],
 *   log?: (message: string) => void,
 * }} [options]
 * @returns {Promise<{ exitCode: number }>}
 */
export async function runGate({
  argv = [],
  env = process.env,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  readManifest = readManifestVersions,
  log = () => {},
} = {}) {
  if (argv.includes("--self-test")) {
    try {
      const versions = readManifest();
      if (versions.length === 0) {
        log("[deploy-migration-gate] self-test FAILED: manifest has no migration versions");
        return { exitCode: 1 };
      }
      log(`[deploy-migration-gate] self-test passed: manifest has ${versions.length} migration version(s).`);
      return { exitCode: 0 };
    } catch (error) {
      log(`[deploy-migration-gate] self-test FAILED: ${error instanceof Error ? error.message : error}`);
      return { exitCode: 1 };
    }
  }

  const rawMode = (env.DEPLOY_MIGRATION_GATE ?? "report").trim().toLowerCase();
  if (rawMode === "off") {
    log("[deploy-migration-gate] mode=off — skipping the migration-history check.");
    return { exitCode: 0 };
  }

  // Anything other than exactly "enforce" behaves as "report": an unrecognised
  // value must never be the reason a deploy blocks.
  const mode = rawMode === "enforce" ? "enforce" : "report";
  if (mode === "report" && rawMode !== "report") {
    log(
      `[deploy-migration-gate] unrecognised DEPLOY_MIGRATION_GATE="${rawMode}" — treating as "report" ` +
        `(never blocks deploy). Valid values: off, report, enforce.`,
    );
  }

  try {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const missingEnv = [];
    if (!url) missingEnv.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!serviceKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missingEnv.length > 0) {
      log(`[deploy-migration-gate] missing required environment variable(s): ${missingEnv.join(", ")}`);
      if (mode === "enforce") {
        return { exitCode: 1 };
      }
      log("[deploy-migration-gate] mode=report — not blocking deploy.");
      return { exitCode: 0 };
    }

    const normalizedUrl = normalizeSupabaseUrl(/** @type {string} */ (url));
    const scrub = (/** @type {string} */ text) => scrubUrl(text, normalizedUrl);
    const expectedVersions = readManifest();

    // report mode never polls or waits (see module docstring); enforce mode
    // polls up to a clamped max wait. Passing maxWaitS: 0 to pollForMigrations
    // forces exactly one read regardless of pollS.
    const pollS = Math.max(MIN_POLL_S, positiveNumberOr(env.DEPLOY_MIGRATION_GATE_POLL_S, DEFAULT_POLL_S));
    const maxWaitS =
      mode === "enforce"
        ? Math.min(MAX_WAIT_S, positiveNumberOr(env.DEPLOY_MIGRATION_GATE_MAX_WAIT_S, DEFAULT_MAX_WAIT_S))
        : 0;

    log(
      mode === "enforce"
        ? `[deploy-migration-gate] mode=enforce host=${redactedHost(normalizedUrl)} ` +
            `expected=${expectedVersions.length} poll=${pollS}s max-wait=${maxWaitS}s`
        : `[deploy-migration-gate] mode=report host=${redactedHost(normalizedUrl)} ` +
            `expected=${expectedVersions.length} (single read, no polling)`,
    );

    const result = await pollForMigrations({
      expectedVersions,
      fetchVersions: () => fetchLiveVersions(normalizedUrl, /** @type {string} */ (serviceKey), { fetchImpl }),
      sleep,
      now,
      pollS,
      maxWaitS,
      log: (message) => log(`[deploy-migration-gate] ${scrub(message)}`),
    });

    if (result.ok) {
      log("[deploy-migration-gate] PASS: all expected migrations are present in live history.");
      return { exitCode: 0 };
    }

    if (result.error) {
      log(`[deploy-migration-gate] error: ${scrub(result.error)}`);
    }
    if (result.missing.length > 0) {
      log(`[deploy-migration-gate] missing: ${result.missing.join(", ")}`);
    }

    if (mode === "enforce") {
      return { exitCode: 1 };
    }

    log("[deploy-migration-gate] mode=report — not blocking deploy.");
    return { exitCode: 0 };
  } catch (error) {
    // Fail safe: a bug here (a corrupt manifest, an unreadable file, anything
    // unanticipated) must never block a deploy unless the mode is exactly
    // "enforce".
    const message = error instanceof Error ? error.message : String(error);
    log(`[deploy-migration-gate] unexpected error: ${message}`);
    if (mode === "enforce") {
      return { exitCode: 1 };
    }
    log("[deploy-migration-gate] mode=report — not blocking deploy.");
    return { exitCode: 0 };
  }
}

const invokedDirectly = process.argv[1] && /await-migrations\.mjs$/.test(process.argv[1]);
if (invokedDirectly) {
  runGate({ argv: process.argv.slice(2), env: process.env, log: (message) => console.log(message) })
    .then((result) => {
      process.exitCode = result.exitCode;
    })
    .catch((error) => {
      // runGate wraps its own body in try/catch and should never reach here,
      // but fail the same safe direction if it somehow does: only an
      // exactly-"enforce" mode may fail the pre-deploy step.
      console.error(
        `[deploy-migration-gate] unexpected top-level error: ${error instanceof Error ? error.message : error}`,
      );
      const mode = (process.env.DEPLOY_MIGRATION_GATE ?? "report").trim().toLowerCase();
      process.exitCode = mode === "enforce" ? 1 : 0;
    });
}
