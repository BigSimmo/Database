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
 * ROLLOUT: warn-only until a baseline is captured and enforcement is turned on.
 *   - `bundle-budget.json` ships with `enforce: false` and `totalGzipBytes: null`.
 *   - After a known-good production build, run `--update` to record the baseline.
 *   - Flip `enforce` to true to make CI fail on >tolerancePct growth.
 * Reads .next/static/chunks/**.js. If no build output exists it prints a note and
 * exits 0 (so it never breaks a run that didn't build).
 *
 * Flags: --update (write current measurement as the baseline), --json.
 */
import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHUNKS_DIR = path.join(root, ".next", "static", "chunks");
const BUDGET_PATH = path.join(root, "bundle-budget.json");

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

function main() {
  const asJson = process.argv.includes("--json");
  const update = process.argv.includes("--update");

  if (!existsSync(CHUNKS_DIR)) {
    console.log(
      `[bundle-budget] no build output at ${path.relative(root, CHUNKS_DIR)} — run \`npm run build\` first. Skipping.`,
    );
    process.exit(0);
  }

  const files = walkJsFiles(CHUNKS_DIR).map((full) => ({
    name: path.relative(CHUNKS_DIR, full),
    buffer: readFileSync(full),
  }));
  const current = measureChunks(files);
  const budget = loadBudget();

  if (update) {
    const next = { ...budget, totalGzipBytes: current.totalGzipBytes, updatedAt: new Date().toISOString() };
    writeFileSync(BUDGET_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(`[bundle-budget] baseline updated to ${kb(current.totalGzipBytes)} gzip (${current.files} chunks).`);
    process.exit(0);
  }

  const verdict = compareToBudget(current, budget);
  if (asJson) {
    console.log(JSON.stringify({ current, verdict }, null, 2));
  } else {
    console.log(
      `[bundle-budget] client chunks: ${current.files} files, ${kb(current.totalGzipBytes)} gzip (${kb(current.totalRawBytes)} raw).`,
    );
    if (verdict.baseline != null)
      console.log(`[bundle-budget] baseline ${kb(verdict.baseline)} gzip; ${verdict.reason}.`);
    console.log("[bundle-budget] largest chunks (gzip):");
    for (const c of current.largest) console.log(`  ${kb(c.gzipBytes).padStart(12)}  ${c.name}`);
  }

  if (verdict.status === "fail") {
    console.error(
      `[bundle-budget] FAIL — ${verdict.reason}. Refresh intentionally with \`npm run check:bundle-budget -- --update\`.`,
    );
    process.exit(1);
  }
  if (verdict.status === "warn" && verdict.baseline == null) {
    console.log(
      "[bundle-budget] warn-only: capture a baseline with --update after a known-good build, then set enforce:true.",
    );
  } else if (verdict.status === "warn") {
    console.warn(`[bundle-budget] WARN (not enforced) — ${verdict.reason}.`);
  }
  process.exit(0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
