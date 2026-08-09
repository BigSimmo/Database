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
  /^(?:answer-progress-ui-smoke|ui-(?:smoke|stress|accessibility|tools|overlap|universal-search|specifiers|formulation|forms-section-nav|chrome-scroll|therapy-nav-scroll|mode-nav-density|phone-scroll(?:-[a-z0-9-]+)?|pwa|route-coverage|style-contract|visual-artifacts|hydration))\.spec\.ts$/;

/**
 * Explicit shard membership. Ordered to mix the measured slow phone-scroll
 * family away from chrome-scroll/accessibility while keeping mega-specs apart.
 */
export const prUiShardGroups = {
  1: [
    "tests/ui-phone-scroll.spec.ts",
    "tests/ui-phone-scroll-page-owned.spec.ts",
    "tests/ui-phone-scroll-document-rail.spec.ts",
    "tests/ui-phone-scroll-routes.spec.ts",
    "tests/ui-route-coverage.spec.ts",
    "tests/ui-specifiers.spec.ts",
    "tests/ui-forms-section-nav.spec.ts",
    "tests/ui-pwa.spec.ts",
    "tests/ui-hydration.spec.ts",
    "tests/ui-style-contract.spec.ts",
    "tests/ui-visual-artifacts.spec.ts",
    "tests/ui-mode-nav-density.spec.ts",
  ],
  2: [
    "tests/ui-smoke.spec.ts",
    "tests/ui-chrome-scroll.spec.ts",
    "tests/answer-progress-ui-smoke.spec.ts",
    "tests/ui-formulation.spec.ts",
  ],
  3: [
    "tests/ui-tools.spec.ts",
    "tests/ui-accessibility.spec.ts",
    "tests/ui-overlap.spec.ts",
    "tests/ui-universal-search.spec.ts",
    "tests/ui-stress.spec.ts",
    "tests/ui-therapy-nav-scroll.spec.ts",
  ],
};

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

function parseArgs(args) {
  const options = { shard: undefined, list: false, validate: false };
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
    if (token === "--shard") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--shard requires a shard number (1..N).");
      options.shard = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      console.log(
        "Usage: node scripts/playwright-pr-shards.mjs --validate | --list | --shard N\n" +
          "  --validate  Assert every production e2e:pr spec is in exactly one group.\n" +
          "  --list      Print shard membership.\n" +
          "  --shard N   Run test:e2e:pr for that explicit file group.",
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

  const files = filesForPrUiShard(options.shard);
  const result = spawnSync(
    process.execPath,
    ["scripts/run-playwright.mjs", ...files, "--project=chromium", "--grep-invert", "@quarantine|@mockup"],
    { stdio: "inherit", env: process.env },
  );
  process.exit(childProcessExitCode(result));
}

export const playwrightPrShardsInternals = { productionSpecFilePattern, prUiShardGroups };
