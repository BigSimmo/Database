#!/usr/bin/env node
/**
 * check-bundle-budget — guard client JS bundle size against regression.
 *
 * The repo did perf/bundle-hygiene work, but nothing stops a regression: the next
 * heavy dependency or an accidental client-side import of a big module (e.g. pulling
 * a snapshot into a client component) silently undoes it. This measures the built
 * client chunks and compares total gzip size against a committed baseline
 * (bundle-budget.json), failing when growth exceeds the tolerance.
 *
 * STATUS: enforced. `bundle-budget.json` carries `enforce: true` and a committed
 * `totalGzipBytes` baseline, so CI fails on >tolerancePct gzip growth.
 *   - After an intentional, known-good production build, run
 *     `npm run check:bundle-budget -- --update` to refresh the baseline.
 *   - Set `enforce: false` to fall back to warn-only.
 * Reads .next/static/chunks/**.js. If no build output exists it prints a note and
 * exits 0 (so it never breaks a run that didn't build).
 *
 * Flags: --update (write current measurement as the baseline), --json.
 *
 * Exit hardening: CI has observed this check print success then never terminate
 * (GHA then cancels the Build job at timeout-minutes, which "Re-run failed jobs"
 * will not re-run). Measurement streams one file at a time, and every exit path
 * goes through {@link exitProcess} (stdio drain + hard failsafe).
 */
import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// `BUNDLE_BUDGET_ROOT` lets tests point at a disposable fixture tree without
// mutating the repo checkout's `.next` (and without relying on `process.cwd()`,
// which npm scripts do not always keep at the package root).
const root = process.env.BUNDLE_BUDGET_ROOT
  ? path.resolve(process.env.BUNDLE_BUDGET_ROOT)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHUNKS_DIR = path.join(root, ".next", "static", "chunks");
const BUDGET_PATH = path.join(root, "bundle-budget.json");
const APP_BUILD_MANIFEST_PATH = path.join(root, ".next", "app-build-manifest.json");
const BUILD_MANIFEST_PATH = path.join(root, ".next", "build-manifest.json");
const ROOT_PAGE_CLIENT_REFERENCE_MANIFEST_PATH = path.join(
  root,
  ".next",
  "server",
  "app",
  "page_client-reference-manifest.js",
);

/** Hard ceiling so a stuck stdio drain cannot burn the whole Build job timeout. */
export const EXIT_FAILSAFE_MS = 1_000;

const fixtureSnapshotMarkerGroups = [
  {
    name: "services snapshot",
    markers: ["deep_research_citation_tokens", "canonical_name_key", "source_table_lines"],
  },
  {
    name: "forms fixture catalogue",
    markers: ["transport-crisis-form", "extension-transport-order", "detention-examination-movement"],
  },
  {
    name: "differentials snapshot",
    markers: ["redFlagFlows", "searchAliases", "exportedAt"],
  },
];

function walkJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** Measure client chunks → { files, totalRawBytes, totalGzipBytes, largest[] }. */
export function measureChunks(files) {
  const measured = files.map(({ name, buffer }) => ({
    name,
    rawBytes: buffer.length,
    gzipBytes: gzipSync(buffer).length,
  }));
  const totalRawBytes = measured.reduce((sum, f) => sum + f.rawBytes, 0);
  const totalGzipBytes = measured.reduce((sum, f) => sum + f.gzipBytes, 0);
  const largest = [...measured].sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, 5);
  return { files: measured.length, totalRawBytes, totalGzipBytes, largest };
}

/**
 * Stream-measure every JS chunk without retaining file buffers. Keeps peak RSS
 * low and avoids leaving multi‑MiB ArrayBuffers alive across process exit on CI.
 */
export function measureChunkPaths(paths, readFile = readFileSync) {
  const measured = [];
  let totalRawBytes = 0;
  let totalGzipBytes = 0;
  for (const full of paths) {
    const buffer = readFile(full);
    const rawBytes = buffer.length;
    const gzipBytes = gzipSync(buffer).length;
    totalRawBytes += rawBytes;
    totalGzipBytes += gzipBytes;
    measured.push({ name: path.relative(CHUNKS_DIR, full), rawBytes, gzipBytes });
  }
  const largest = [...measured].sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, 5);
  return { files: measured.length, totalRawBytes, totalGzipBytes, largest };
}

/**
 * Pure comparison. Returns { status: "ok"|"warn"|"fail", overPct, ... }.
 * - no baseline → "warn" (nothing to compare yet).
 * - within tolerance → "ok".
 * - over tolerance → "fail" if enforcing, else "warn".
 */
export function compareToBudget(current, budget) {
  const baseline = budget?.totalGzipBytes ?? null;
  const tolerancePct = budget?.tolerancePct ?? 10;
  const enforce = Boolean(budget?.enforce);
  if (baseline == null) {
    return { status: "warn", reason: "no baseline recorded", overPct: null, baseline, tolerancePct, enforce };
  }
  const overPct = ((current.totalGzipBytes - baseline) / baseline) * 100;
  const withinTolerance = overPct <= tolerancePct;
  return {
    status: withinTolerance ? "ok" : enforce ? "fail" : "warn",
    reason: withinTolerance ? "within tolerance" : `+${overPct.toFixed(1)}% vs baseline (tolerance ${tolerancePct}%)`,
    overPct,
    baseline,
    tolerancePct,
    enforce,
  };
}

/** Resolve the JavaScript chunks required by the root App Router dashboard. */
export function initialDashboardChunkNames(appBuildManifest, pageClientReferenceManifest) {
  const pages = appBuildManifest?.pages ?? {};
  const pageClientChunks = Object.values(pageClientReferenceManifest?.clientModules ?? {}).flatMap((module) =>
    Array.isArray(module?.chunks) ? module.chunks : [],
  );
  const names = new Set([
    ...(appBuildManifest?.rootMainFiles ?? []),
    ...(pages["/layout"] ?? []),
    ...(pages["/page"] ?? []),
    ...pageClientChunks,
  ]);
  return [...names]
    .filter((name) => typeof name === "string" && name.endsWith(".js"))
    .map((name) => name.replace(/^\/?static\/chunks\//, ""));
}

function loadRootPageClientReferenceManifest() {
  if (!existsSync(ROOT_PAGE_CLIENT_REFERENCE_MANIFEST_PATH)) return null;
  const source = readFileSync(ROOT_PAGE_CLIENT_REFERENCE_MANIFEST_PATH, "utf8");
  const marker = 'globalThis.__RSC_MANIFEST["/page"]=';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const jsonEnd = source.lastIndexOf(";");
  if (jsonEnd <= jsonStart) return null;
  return JSON.parse(source.slice(jsonStart, jsonEnd));
}

/** Identify large fixture payloads from stable groups of serialized keys/slugs.
 * Requiring every marker in a group avoids failing on ordinary UI copy that
 * happens to mention one fixture term. */
export function findFixtureSnapshotsInChunks(files) {
  const content = files.map(({ buffer }) => buffer.toString("utf8")).join("\n");
  return fixtureSnapshotMarkerGroups
    .filter((group) => group.markers.every((marker) => content.includes(marker)))
    .map((group) => group.name);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function loadBudget() {
  try {
    return JSON.parse(readFileSync(BUDGET_PATH, "utf8"));
  } catch {
    return { enforce: false, tolerancePct: 10, totalGzipBytes: null };
  }
}

/**
 * Injectable stdio/timer/exit surface for {@link exitProcess}. Defaults match
 * Node's process helpers; tests pass narrow mocks. Typed via JSDoc so Vitest
 * mocks do not have to satisfy `WriteStream` / `never` inference from defaults
 * (Static PR typecheck regression on PR #1489).
 *
 * @typedef {object} ExitProcessOptions
 * @property {(code: number) => void} [exitImpl]
 * @property {{ write: (chunk: string) => boolean; once?: (event: string, listener: () => void) => unknown }} [stdout]
 * @property {typeof setTimeout} [setTimer]
 * @property {number} [failsafeMs]
 */

/**
 * Force the process to terminate even when stdio drain or a stray handle would
 * otherwise keep the event loop alive (the PR #1489 Build cancellation mode).
 * Exported for unit tests; `exitImpl` / `setTimer` are injectable.
 *
 * @param {number} code
 * @param {ExitProcessOptions} [options]
 */
export function exitProcess(code, options = {}) {
  const {
    exitImpl = (value) => {
      process.exit(value);
    },
    stdout = process.stdout,
    setTimer = setTimeout,
    failsafeMs = EXIT_FAILSAFE_MS,
  } = options;
  process.exitCode = code;
  let exited = false;
  const force = () => {
    if (exited) return;
    exited = true;
    exitImpl(code);
  };
  const timer = setTimer(force, failsafeMs);
  timer.unref?.();
  try {
    if (!stdout || typeof stdout.write !== "function") {
      force();
      return;
    }
    // Drain any pending stdout before exit; if the write buffer is already
    // empty, `write` returns true and we can exit immediately.
    if (stdout.write("")) {
      force();
      return;
    }
    stdout.once?.("drain", force);
  } catch {
    force();
  }
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

/** Run the check. Returns the process exit code (does not exit by itself). */
export function runBundleBudgetCheck(argv = process.argv.slice(2)) {
  const asJson = argv.includes("--json");
  const update = argv.includes("--update");

  if (!existsSync(CHUNKS_DIR)) {
    console.log(
      `[bundle-budget] no build output at ${path.relative(root, CHUNKS_DIR)} — run \`npm run build\` first. Skipping.`,
    );
    return 0;
  }

  const chunkPaths = walkJsFiles(CHUNKS_DIR);
  const manifestPath = existsSync(APP_BUILD_MANIFEST_PATH)
    ? APP_BUILD_MANIFEST_PATH
    : existsSync(BUILD_MANIFEST_PATH)
      ? BUILD_MANIFEST_PATH
      : null;
  if (!manifestPath) {
    console.error("[bundle-budget] FAIL — no build manifest is available; cannot verify initial dashboard chunks.");
    return 1;
  }
  const appBuildManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pageClientReferenceManifest = loadRootPageClientReferenceManifest();
  const initialChunkNames = new Set(initialDashboardChunkNames(appBuildManifest, pageClientReferenceManifest));
  const initialDashboardChunks = chunkPaths
    .filter((full) => initialChunkNames.has(path.relative(CHUNKS_DIR, full).replace(/\\/g, "/")))
    .map((full) => ({
      name: path.relative(CHUNKS_DIR, full),
      buffer: readFileSync(full),
    }));
  if (initialDashboardChunks.length === 0) {
    console.error("[bundle-budget] FAIL — no root dashboard JavaScript chunks were resolved from the build manifest.");
    return 1;
  }
  const fixtureViolations = findFixtureSnapshotsInChunks(initialDashboardChunks);
  if (fixtureViolations.length > 0) {
    console.error(
      `[bundle-budget] FAIL — initial dashboard chunks contain fixture payloads: ${fixtureViolations.join(", ")}.`,
    );
    return 1;
  }
  // Drop fixture buffers before the full-tree gzip pass so peak RSS stays low.
  for (const chunk of initialDashboardChunks) chunk.buffer = Buffer.alloc(0);
  const current = measureChunkPaths(chunkPaths);
  const budget = loadBudget();

  if (update) {
    const next = { ...budget, totalGzipBytes: current.totalGzipBytes, updatedAt: new Date().toISOString() };
    writeFileSync(BUDGET_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(`[bundle-budget] baseline updated to ${kb(current.totalGzipBytes)} gzip (${current.files} chunks).`);
    return 0;
  }

  const verdict = compareToBudget(current, budget);
  if (asJson) {
    console.log(JSON.stringify({ current, verdict, initialDashboardChunks: initialDashboardChunks.length }, null, 2));
  } else {
    console.log(
      `[bundle-budget] client chunks: ${current.files} files, ${kb(current.totalGzipBytes)} gzip (${kb(current.totalRawBytes)} raw).`,
    );
    if (verdict.baseline != null)
      console.log(`[bundle-budget] baseline ${kb(verdict.baseline)} gzip; ${verdict.reason}.`);
    console.log("[bundle-budget] largest chunks (gzip):");
    for (const c of current.largest) console.log(`  ${kb(c.gzipBytes).padStart(12)}  ${c.name}`);
    console.log(
      `[bundle-budget] initial dashboard fixture assertion passed (${initialDashboardChunks.length} chunks).`,
    );
  }

  if (verdict.status === "fail") {
    console.error(
      `[bundle-budget] FAIL — ${verdict.reason}. Refresh intentionally with \`npm run check:bundle-budget -- --update\`.`,
    );
    return 1;
  }
  if (verdict.status === "warn" && verdict.baseline == null) {
    console.log(
      "[bundle-budget] warn-only: capture a baseline with --update after a known-good build, then set enforce:true.",
    );
  } else if (verdict.status === "warn") {
    console.warn(`[bundle-budget] WARN (not enforced) — ${verdict.reason}.`);
  }
  console.log("[bundle-budget] done.");
  return 0;
}

function main() {
  let code = 1;
  try {
    code = runBundleBudgetCheck(process.argv.slice(2));
  } catch (error) {
    // Unexpected throws must still hit exitProcess; otherwise a stray handle
    // after a partial run can recreate the CI "printed nothing / hung" mode.
    console.error("[bundle-budget] FAIL — unexpected error:", error);
    code = 1;
  }
  exitProcess(code);
}

if (isMainModule()) main();
