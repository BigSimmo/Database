#!/usr/bin/env node
/**
 * Duration-aware Production UI shard groups for required Chromium PR journeys.
 *
 * Playwright `--shard=i/N` balances by test *count* in collection (alphabetical)
 * order, which packs the slow phone-scroll family into one shard. Explicit
 * groups mix slow-per-test and faster mega-specs so wall time is closer across
 * runners. Every production `test:e2e:pr` file must appear in exactly one group
 * — `tests/playwright-pr-shards.test.ts` fails closed on orphans/duplicates.
 *
 * Do not rename specs to game alphabetical sharding. Re-measure after suite
 * growth before changing group membership.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { childProcessExitCode } from "./child-process-result.mjs";

/** Same matcher as playwright.config.ts `productionSpecPattern` (keep in sync). */
export const productionSpecFilePattern =
  /^(?:answer-progress-ui-smoke|ui-(?:smoke|stress|accessibility|document-canvas|tools|overlap|universal-search|specifiers|formulation(?:-result-cards)?|forms-section-nav|chrome-scroll|therapy-nav-scroll|mode-nav-density|phone-scroll(?:-[a-z0-9-]+)?|pwa|route-coverage|style-contract|visual-artifacts|hydration))\.spec\.ts$/;

/**
 * One source of truth for shard membership and its latest hosted timing sample.
 * Durations are summed from the list reporter in CI run 31285952061 (2026-08-09).
 * `criticalSeconds` is removed on PR/merge-queue runs because the preceding
 * fail-fast job already proved those exact tests. Re-measure after suite growth.
 */
export const prUiSpecProfiles = Object.freeze([
  { file: "tests/ui-smoke.spec.ts", shard: 1, fullSeconds: 149.0, criticalSeconds: 21.7 },
  { file: "tests/ui-mode-nav-density.spec.ts", shard: 1, fullSeconds: 47.1, criticalSeconds: 0 },
  { file: "tests/ui-accessibility.spec.ts", shard: 1, fullSeconds: 17.7, criticalSeconds: 0 },
  { file: "tests/ui-route-coverage.spec.ts", shard: 1, fullSeconds: 12.6, criticalSeconds: 0 },
  { file: "tests/ui-formulation.spec.ts", shard: 1, fullSeconds: 12.9, criticalSeconds: 0 },

  { file: "tests/ui-phone-scroll-routes.spec.ts", shard: 2, fullSeconds: 129.2, criticalSeconds: 0 },
  { file: "tests/ui-phone-scroll.spec.ts", shard: 2, fullSeconds: 63.7, criticalSeconds: 0 },
  { file: "tests/ui-universal-search.spec.ts", shard: 2, fullSeconds: 19.7, criticalSeconds: 0 },
  { file: "tests/answer-progress-ui-smoke.spec.ts", shard: 2, fullSeconds: 10.8, criticalSeconds: 0 },

  { file: "tests/ui-tools.spec.ts", shard: 3, fullSeconds: 83.9, criticalSeconds: 3.1 },
  { file: "tests/ui-chrome-scroll.spec.ts", shard: 3, fullSeconds: 44.9, criticalSeconds: 0 },
  { file: "tests/ui-phone-scroll-page-owned.spec.ts", shard: 3, fullSeconds: 42.7, criticalSeconds: 0 },
  { file: "tests/ui-overlap.spec.ts", shard: 3, fullSeconds: 7.6, criticalSeconds: 0 },
  { file: "tests/ui-stress.spec.ts", shard: 3, fullSeconds: 7.6, criticalSeconds: 0 },
  { file: "tests/ui-specifiers.spec.ts", shard: 3, fullSeconds: 7.3, criticalSeconds: 0 },
  { file: "tests/ui-formulation-result-cards.spec.ts", shard: 3, fullSeconds: 8.0, criticalSeconds: 0 },
  { file: "tests/ui-style-contract.spec.ts", shard: 3, fullSeconds: 6.3, criticalSeconds: 0 },
  { file: "tests/ui-hydration.spec.ts", shard: 3, fullSeconds: 4.5, criticalSeconds: 0 },
  { file: "tests/ui-pwa.spec.ts", shard: 3, fullSeconds: 3.8, criticalSeconds: 0 },
  { file: "tests/ui-phone-scroll-document-rail.spec.ts", shard: 3, fullSeconds: 3.7, criticalSeconds: 0 },
  { file: "tests/ui-visual-artifacts.spec.ts", shard: 3, fullSeconds: 2.7, criticalSeconds: 0 },
  { file: "tests/ui-forms-section-nav.spec.ts", shard: 3, fullSeconds: 2.5, criticalSeconds: 0 },
  { file: "tests/ui-therapy-nav-scroll.spec.ts", shard: 3, fullSeconds: 1.9, criticalSeconds: 0 },
  // Skipped in the sampled runner because pdf.js could not raster there.
  { file: "tests/ui-document-canvas.spec.ts", shard: 3, fullSeconds: 0, criticalSeconds: 0 },
]);

export const prUiShardGroups = Object.freeze(
  Object.fromEntries(
    [1, 2, 3].map((shard) => [
      shard,
      prUiSpecProfiles.filter((profile) => profile.shard === shard).map((profile) => profile.file),
    ]),
  ),
);

export function estimatedPrUiShardSeconds({ excludeCritical = false, profiles = prUiSpecProfiles } = {}) {
  const totals = { 1: 0, 2: 0, 3: 0 };
  for (const profile of profiles) {
    totals[profile.shard] += profile.fullSeconds - (excludeCritical ? profile.criticalSeconds : 0);
  }
  return totals;
}

export function listProductionSpecFiles(testsDir = path.join(process.cwd(), "tests")) {
  return readdirSync(testsDir)
    .filter((file) => productionSpecFilePattern.test(file))
    .map((file) => `tests/${file}`)
    .sort();
}

export function validatePrUiShardGroups(groups = prUiShardGroups, { listFiles = listProductionSpecFiles } = {}) {
  const onDisk = listFiles();
  const assigned = [];
  const duplicates = [];
  for (const shard of Object.keys(groups).sort((a, b) => Number(a) - Number(b))) {
    const files = groups[shard];
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error(`PR UI shard ${shard} is empty — empty shards fail test:e2e:pr (no --pass-with-no-tests).`);
    }
    for (const file of files) {
      if (assigned.includes(file)) duplicates.push(file);
      assigned.push(file);
    }
  }
  const assignedSorted = [...assigned].sort();
  const missing = onDisk.filter((file) => !assigned.includes(file));
  const extra = assignedSorted.filter((file) => !onDisk.includes(file));
  return {
    ok: missing.length === 0 && extra.length === 0 && duplicates.length === 0,
    onDisk,
    assigned: assignedSorted,
    missing,
    extra,
    duplicates: [...new Set(duplicates)].sort(),
    shardCount: Object.keys(groups).length,
  };
}

export function filesForPrUiShard(shard, groups = prUiShardGroups) {
  const key = String(shard);
  const files = groups[key] ?? groups[Number(key)];
  if (!files?.length) {
    throw new Error(`Unknown or empty PR UI shard: ${shard}`);
  }
  return files;
}

export function playwrightArgsForPrUiShard(shard, { excludeCritical = false } = {}) {
  const grepInvert = excludeCritical ? "@critical|@quarantine|@mockup" : "@quarantine|@mockup";
  return ["scripts/run-playwright.mjs", ...filesForPrUiShard(shard), "--project=chromium", "--grep-invert", grepInvert];
}

function parseArgs(args) {
  const options = { shard: undefined, list: false, validate: false, excludeCritical: false };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--list") {
      options.list = true;
      continue;
    }
    if (token === "--validate") {
      options.validate = true;
      continue;
    }
    if (token === "--exclude-critical") {
      options.excludeCritical = true;
      continue;
    }
    if (token === "--shard") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--shard requires a shard number (1..N).");
      options.shard = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(
        "Usage: node scripts/playwright-pr-shards.mjs --validate | --list | --shard N [--exclude-critical]\n" +
          "  --validate  Assert every production e2e:pr spec is in exactly one group.\n" +
          "  --list      Print shard membership.\n" +
          "  --shard N   Run test:e2e:pr for that explicit file group.\n" +
          "  --exclude-critical  Exclude @critical tests already proved by the fail-fast job.",
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return options;
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const options = parseArgs(process.argv.slice(2));
  if (options.validate || options.list) {
    const result = validatePrUiShardGroups();
    if (options.list) {
      for (const [shard, files] of Object.entries(prUiShardGroups)) {
        console.log(`shard ${shard} (${files.length} files):`);
        for (const file of files) console.log(`  ${file}`);
      }
    }
    if (!result.ok) {
      console.error(
        [
          "PR UI shard groups are out of sync with production specs.",
          result.missing.length ? `missing from groups: ${result.missing.join(", ")}` : null,
          result.extra.length ? `unknown in groups: ${result.extra.join(", ")}` : null,
          result.duplicates.length ? `duplicated: ${result.duplicates.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      process.exit(1);
    }
    console.log(`PR UI shard parity OK: ${result.onDisk.length} production specs across ${result.shardCount} groups.`);
    process.exit(0);
  }

  if (!options.shard) {
    console.error("Provide --shard N, --validate, or --list.");
    process.exit(2);
  }

  const result = spawnSync(process.execPath, playwrightArgsForPrUiShard(options.shard, options), {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(childProcessExitCode(result));
}

export const playwrightPrShardsInternals = { productionSpecFilePattern, prUiSpecProfiles, prUiShardGroups };
