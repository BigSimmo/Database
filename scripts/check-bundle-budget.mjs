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
 * WHICH QUESTION THIS ANSWERS — two, separately, on purpose.
 *
 * It used to answer one blurred question. `totalGzipBytes` summed EVERY built
 * client chunk, including `src/app/mockups/**` design scratch that 404s in
 * production, and compared that to a ceiling named as though it were production
 * weight. Two repo positions then disagreed with nothing to arbitrate them:
 * `#013` held that mockup chunks "are not an initial production bundle", while
 * this gate charged them against the ceiling anyway — which is how PR #1580
 * blocked on "+10.1% vs baseline" for chunks no user can load.
 *
 * Measured on `main` at af85cbc (2026-08-09), the blur had become the whole
 * signal: 1546.5 KiB total was +9.96% of the old baseline — 576 bytes from
 * failing — while the production-only number was 1279.1 KiB, or 9.06% BELOW
 * that same baseline. Every byte of the apparent regression was design scratch;
 * production had actually shrunk. So the split is not a way to raise a ceiling,
 * it is the only way either number means anything.
 *
 *   - `production` — chunks any non-mockup route reaches, plus every chunk no
 *     route manifest claims (framework, polyfills, runtime). This is user-facing
 *     weight and the regression guard the budget was written for. Enforced at
 *     `production.tolerancePct` (default 10%).
 *   - `mockups` — chunks reachable ONLY from `/mockups/**`. Nobody downloads
 *     these, so this is a repo-hygiene ceiling that exists to catch unbounded
 *     accumulation (66 mockup routes today), not to gate the next mockup.
 *     Enforced at the deliberately looser `mockups.tolerancePct` (default 25%).
 *
 * A chunk shared by both is production: it would be built with or without the
 * mockup. Attribution failures fail the check rather than collapsing the
 * buckets.
 *
 * STATUS: enforced. `bundle-budget.json` carries `enforce: true` and committed
 * `production.gzipBytes` / `mockups.gzipBytes` baselines.
 *   - After an intentional, known-good production build, run
 *     `npm run check:bundle-budget -- --update` to refresh both baselines.
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
const SERVER_APP_DIR = path.join(root, ".next", "server", "app");

/**
 * Route segment that marks design-scratch routes. `src/app/mockups/**` 404s in
 * production (see next.config.ts) and is exempt from the wiring and
 * reachability gates, so its client chunks are not production weight — but they
 * are still built, so they are still repo weight. Everything downstream of this
 * constant exists to keep those two facts in separate numbers.
 */
export const MOCKUP_ROUTE_SEGMENT = "mockups";

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
  // `measured` carries names and byte counts only — no buffers — so exposing it
  // for per-bucket subtotals does not reintroduce the RSS problem above.
  return { files: measured.length, totalRawBytes, totalGzipBytes, largest, measured };
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

/**
 * Parse any per-route `*_client-reference-manifest.js` and return the client
 * chunk names it references. Next 16 (webpack) emits no `app-build-manifest.json`,
 * so these per-route manifests are the only route -> chunk mapping available.
 * Unparseable input yields an empty set; the caller decides whether that is fatal.
 *
 * @param {string} source raw manifest file contents
 * @returns {Set<string>} chunk names relative to `.next/static/chunks`
 */
export function clientChunkNamesFromManifestSource(source) {
  const names = new Set();
  const marker = "globalThis.__RSC_MANIFEST[";
  const start = source.indexOf(marker);
  if (start < 0) return names;
  const assign = source.indexOf("]=", start);
  if (assign < 0) return names;
  const end = source.lastIndexOf(";");
  if (end <= assign) return names;
  let manifest;
  try {
    manifest = JSON.parse(source.slice(assign + 2, end));
  } catch {
    return names;
  }
  for (const clientModule of Object.values(manifest?.clientModules ?? {})) {
    for (const chunk of Array.isArray(clientModule?.chunks) ? clientModule.chunks : []) {
      if (typeof chunk === "string" && chunk.endsWith(".js")) {
        names.add(chunk.replace(/^\/?static\/chunks\//, ""));
      }
    }
  }
  return names;
}

/**
 * Walk `.next/server/app` and split client chunk names into the ones reachable
 * only from `/mockups/**` and the ones any production route reaches.
 *
 * A chunk shared by a mockup route and a production route is **production**: it
 * would be built regardless of whether the mockup existed, so charging it to
 * design scratch would understate production weight. Chunks no manifest
 * references at all (framework, polyfills, webpack runtime) are likewise
 * production — attribution failures must never shrink the production number,
 * because that is the number with the enforced ceiling.
 *
 * @returns {{ mockupExclusive: Set<string>, routeCount: number, mockupRouteCount: number }}
 */
export function partitionRouteClientChunks(serverAppDir, deps = {}) {
  const { readDir = readdirSync, readFile = readFileSync } = deps;
  const mockupChunks = new Set();
  const productionChunks = new Set();
  let routeCount = 0;
  let mockupRouteCount = 0;

  const walk = (dir, isMockup) => {
    for (const entry of readDir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, isMockup || entry.name === MOCKUP_ROUTE_SEGMENT);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith("_client-reference-manifest.js")) continue;
      routeCount += 1;
      if (isMockup) mockupRouteCount += 1;
      const target = isMockup ? mockupChunks : productionChunks;
      for (const name of clientChunkNamesFromManifestSource(readFile(full, "utf8"))) target.add(name);
    }
  };
  walk(serverAppDir, false);

  const mockupExclusive = new Set([...mockupChunks].filter((name) => !productionChunks.has(name)));
  return { mockupExclusive, routeCount, mockupRouteCount };
}

/** Sum the gzip bytes of the measured chunks whose names are in `names`. */
export function gzipBytesOf(measuredFiles, names) {
  return measuredFiles.reduce(
    (sum, file) => (names.has(file.name.replace(/\\/g, "/")) ? sum + file.gzipBytes : sum),
    0,
  );
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

  // Attribute chunks to production vs design scratch. Fail closed: a broken or
  // missing route manifest tree must not silently collapse the two buckets,
  // because "everything is production" inflates the enforced number and
  // "everything is scratch" would hide a real regression.
  if (!existsSync(SERVER_APP_DIR)) {
    console.error(
      `[bundle-budget] FAIL — no route manifests at ${path.relative(root, SERVER_APP_DIR)}; cannot separate production weight from ${MOCKUP_ROUTE_SEGMENT}/ scratch.`,
    );
    return 1;
  }
  const { mockupExclusive, routeCount, mockupRouteCount } = partitionRouteClientChunks(SERVER_APP_DIR);
  if (routeCount === 0) {
    console.error("[bundle-budget] FAIL — the route manifest tree resolved no routes; chunk attribution is broken.");
    return 1;
  }
  const mockupRoutesBuilt = existsSync(path.join(SERVER_APP_DIR, MOCKUP_ROUTE_SEGMENT));
  if (mockupRoutesBuilt && mockupRouteCount === 0) {
    console.error(
      `[bundle-budget] FAIL — ${MOCKUP_ROUTE_SEGMENT}/ routes were built but none resolved a client manifest; chunk attribution is broken.`,
    );
    return 1;
  }

  const mockupGzipBytes = gzipBytesOf(current.measured, mockupExclusive);
  const productionGzipBytes = current.totalGzipBytes - mockupGzipBytes;
  const budget = loadBudget();

  if (update) {
    const next = {
      ...budget,
      production: { ...(budget.production ?? {}), gzipBytes: productionGzipBytes },
      mockups: { ...(budget.mockups ?? {}), gzipBytes: mockupGzipBytes },
      totalGzipBytes: current.totalGzipBytes,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(BUDGET_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(
      `[bundle-budget] baselines updated — production ${kb(productionGzipBytes)}, ${MOCKUP_ROUTE_SEGMENT} ${kb(mockupGzipBytes)}, total ${kb(current.totalGzipBytes)} gzip (${current.files} chunks).`,
    );
    return 0;
  }

  const enforce = Boolean(budget?.enforce);
  const productionVerdict = compareToBudget(
    { totalGzipBytes: productionGzipBytes },
    {
      totalGzipBytes: budget?.production?.gzipBytes ?? null,
      tolerancePct: budget?.production?.tolerancePct ?? 10,
      enforce,
    },
  );
  // Scratch weight is a runaway detector, not a per-mockup gate: a ceiling tight
  // enough to fire on the next mockup would just be `--update`d reflexively,
  // which is worse than no gate. It is always reported, enforced only on a jump.
  const mockupVerdict = compareToBudget(
    { totalGzipBytes: mockupGzipBytes },
    { totalGzipBytes: budget?.mockups?.gzipBytes ?? null, tolerancePct: budget?.mockups?.tolerancePct ?? 25, enforce },
  );

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          current: { ...current, measured: undefined },
          production: { gzipBytes: productionGzipBytes, verdict: productionVerdict },
          mockups: {
            gzipBytes: mockupGzipBytes,
            chunks: mockupExclusive.size,
            routes: mockupRouteCount,
            verdict: mockupVerdict,
          },
          initialDashboardChunks: initialDashboardChunks.length,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `[bundle-budget] client chunks: ${current.files} files, ${kb(current.totalGzipBytes)} gzip (${kb(current.totalRawBytes)} raw) across ${routeCount} routes.`,
    );
    // Say which question each number answers — the ambiguity these two lines
    // remove is the whole point of splitting the budget (`#013`/`#252`).
    console.log(
      `[bundle-budget] production (what users download, ${routeCount - mockupRouteCount} routes): ${kb(productionGzipBytes)} gzip` +
        (productionVerdict.baseline != null
          ? ` — baseline ${kb(productionVerdict.baseline)}, ${productionVerdict.reason}.`
          : " — no baseline recorded."),
    );
    console.log(
      `[bundle-budget] ${MOCKUP_ROUTE_SEGMENT} (design scratch, 404s in production, ${mockupRouteCount} routes, ${mockupExclusive.size} exclusive chunks): ${kb(mockupGzipBytes)} gzip` +
        (mockupVerdict.baseline != null
          ? ` — baseline ${kb(mockupVerdict.baseline)}, ${mockupVerdict.reason}.`
          : " — no baseline recorded."),
    );
    console.log("[bundle-budget] largest chunks (gzip):");
    for (const c of current.largest) console.log(`  ${kb(c.gzipBytes).padStart(12)}  ${c.name}`);
    console.log(
      `[bundle-budget] initial dashboard fixture assertion passed (${initialDashboardChunks.length} chunks).`,
    );
  }

  let failed = false;
  if (productionVerdict.status === "fail") {
    console.error(
      `[bundle-budget] FAIL — production bundle ${productionVerdict.reason}. This is user-facing weight; find the regression before refreshing the baseline.`,
    );
    failed = true;
  }
  if (mockupVerdict.status === "fail") {
    console.error(
      `[bundle-budget] FAIL — ${MOCKUP_ROUTE_SEGMENT} scratch ${mockupVerdict.reason}. No user loads these chunks, so this is a hygiene ceiling: prune stale mockups, or refresh deliberately with \`npm run check:bundle-budget -- --update\` and say why in the PR.`,
    );
    failed = true;
  }
  if (failed) return 1;

  for (const [label, verdict] of [
    ["production bundle", productionVerdict],
    [`${MOCKUP_ROUTE_SEGMENT} scratch`, mockupVerdict],
  ]) {
    if (verdict.status !== "warn") continue;
    if (verdict.baseline == null) {
      console.log(
        `[bundle-budget] warn-only: no ${label} baseline — capture one with --update after a known-good build, then set enforce:true.`,
      );
    } else {
      console.warn(`[bundle-budget] WARN (not enforced) — ${label} ${verdict.reason}.`);
    }
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
