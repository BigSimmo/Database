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
  /^(?:api-csrf-proxy|adaptive-answer-ui|answer-progress-ui-smoke|dsm-ui-smoke|ui-(?:smoke|stress|accessibility|caring-contacts-workspace|clinical-ask|cme-phone|dictionary|document-canvas|tools|tools-show-all|overlap|universal-search|specifiers|sources|formulation(?:-result-cards)?|forms-section-nav|chrome-scroll|therapy-nav-scroll|therapy-pathways|mode-nav-density|on-call-(?:boards|service)|patient-number-field|phone-motion|phone-scroll(?:-[a-z0-9-]+)?|pwa|route-coverage|style-contract|token-layer-resolution|visual-artifacts|hydration))\.spec\.ts$/;

/**
 * Same matcher as playwright.config.ts `seededSpecPattern` (keep in sync).
 *
 * These specs run in `chromium-caring-contacts-seeded`, against `run-playwright.mjs`'s SECOND
 * server, so they are deliberately NOT in `productionSpecFilePattern` above — that list is held
 * byte-for-byte against `productionSpecPattern`, and adding them there would point the journey at
 * the unseeded server. They still belong to a shard: a spec wired into no gate is a spec that
 * silently never runs, which is the defect these groups exist to make impossible.
 */
export const seededSpecFilePattern = /^ui-caring-contacts-(activation|populated)\.spec\.ts$/;

/** The project each shard file must be collected by. Production files use `chromium`. */
export const SEEDED_PR_UI_PROJECT = "chromium-caring-contacts-seeded";

/**
 * Timings: successful production Chromium reports from CI run 35737796786
 * (2026-09-22), including critical tests. Group longest files first by their
 * post-critical duration; keep seeded journeys together to share one server.
 * These measurements guide grouping, never test omission or passing status.
 */
export const prUiSpecProfiles = Object.freeze([
  {
    file: "tests/adaptive-answer-ui.spec.ts",
    shard: 3,
    fullSeconds: 18.4,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-smoke.spec.ts",
    shard: 3,
    fullSeconds: 155,
    criticalSeconds: 17.7,
  },
  {
    file: "tests/ui-mode-nav-density.spec.ts",
    shard: 1,
    fullSeconds: 40.6,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-cme-phone.spec.ts",
    shard: 3,
    fullSeconds: 3.4,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-on-call-boards.spec.ts",
    shard: 1,
    fullSeconds: 31,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-on-call-service.spec.ts",
    shard: 1,
    fullSeconds: 6.5,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-phone-scroll-page-owned.spec.ts",
    shard: 2,
    fullSeconds: 35.8,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-accessibility.spec.ts",
    shard: 1,
    fullSeconds: 26,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-route-coverage.spec.ts",
    shard: 1,
    fullSeconds: 17.5,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-formulation.spec.ts",
    shard: 1,
    fullSeconds: 13.5,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-dictionary.spec.ts",
    shard: 2,
    fullSeconds: 19.1,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-sources.spec.ts",
    shard: 3,
    fullSeconds: 24.8,
    criticalSeconds: 4.9,
  },
  {
    file: "tests/ui-token-layer-resolution.spec.ts",
    shard: 1,
    fullSeconds: 2.1,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-tools-show-all.spec.ts",
    shard: 2,
    fullSeconds: 0.5,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-clinical-ask.spec.ts",
    shard: 2,
    fullSeconds: 16.5,
    criticalSeconds: 16.5,
  },
  {
    file: "tests/api-csrf-proxy.spec.ts",
    shard: 2,
    fullSeconds: 0.1,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-phone-motion.spec.ts",
    shard: 3,
    fullSeconds: 14.4,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-therapy-pathways.spec.ts",
    shard: 3,
    fullSeconds: 3.7,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-patient-number-field.spec.ts",
    shard: 2,
    fullSeconds: 6.2,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-caring-contacts-activation.spec.ts",
    shard: 3,
    fullSeconds: 4.3,
    criticalSeconds: 0,
    project: "chromium-caring-contacts-seeded",
  },
  {
    file: "tests/ui-caring-contacts-populated.spec.ts",
    shard: 3,
    fullSeconds: 21.4,
    criticalSeconds: 0,
    project: "chromium-caring-contacts-seeded",
  },
  {
    file: "tests/ui-phone-scroll-routes.spec.ts",
    shard: 2,
    fullSeconds: 155.2,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-phone-scroll.spec.ts",
    shard: 1,
    fullSeconds: 183.2,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-universal-search.spec.ts",
    shard: 2,
    fullSeconds: 29.9,
    criticalSeconds: 0,
  },
  {
    file: "tests/dsm-ui-smoke.spec.ts",
    shard: 3,
    fullSeconds: 4.2,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-caring-contacts-workspace.spec.ts",
    shard: 3,
    fullSeconds: 153.9,
    criticalSeconds: 0,
  },
  {
    file: "tests/answer-progress-ui-smoke.spec.ts",
    shard: 3,
    fullSeconds: 33,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-tools.spec.ts",
    shard: 2,
    fullSeconds: 122,
    criticalSeconds: 4,
  },
  {
    file: "tests/ui-chrome-scroll.spec.ts",
    shard: 1,
    fullSeconds: 68.9,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-overlap.spec.ts",
    shard: 2,
    fullSeconds: 25.5,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-stress.spec.ts",
    shard: 1,
    fullSeconds: 8.2,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-specifiers.spec.ts",
    shard: 1,
    fullSeconds: 22.8,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-formulation-result-cards.spec.ts",
    shard: 3,
    fullSeconds: 2.6,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-style-contract.spec.ts",
    shard: 2,
    fullSeconds: 14.7,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-hydration.spec.ts",
    shard: 2,
    fullSeconds: 3.9,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-pwa.spec.ts",
    shard: 3,
    fullSeconds: 10.1,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-phone-scroll-document-rail.spec.ts",
    shard: 1,
    fullSeconds: 3.5,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-visual-artifacts.spec.ts",
    shard: 1,
    fullSeconds: 4.2,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-forms-section-nav.spec.ts",
    shard: 2,
    fullSeconds: 12.1,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-therapy-nav-scroll.spec.ts",
    shard: 2,
    fullSeconds: 3.6,
    criticalSeconds: 0,
  },
  {
    file: "tests/ui-phone-scroll-submitted-root.spec.ts",
    shard: 2,
    fullSeconds: 0.6,
    criticalSeconds: 0.6,
  },
  {
    file: "tests/ui-document-canvas.spec.ts",
    shard: 1,
    fullSeconds: 4.6,
    criticalSeconds: 0,
  },
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

export function listSeededSpecFiles(testsDir = path.join(process.cwd(), "tests")) {
  return readdirSync(testsDir)
    .filter((file) => seededSpecFilePattern.test(file))
    .map((file) => `tests/${file}`)
    .sort();
}

/**
 * Every spec the required Production UI shards must cover, whichever server it runs against.
 *
 * The union, not `listProductionSpecFiles` alone: an on-disk seeded spec missing from the groups
 * has to be a shard-parity FAILURE, or the one gate that catches an unrun journey stops seeing the
 * seeded lane at all.
 */
export function listPrUiSpecFiles(testsDir = path.join(process.cwd(), "tests")) {
  return [...listProductionSpecFiles(testsDir), ...listSeededSpecFiles(testsDir)].sort();
}

export function validatePrUiShardGroups(groups = prUiShardGroups, { listFiles = listPrUiSpecFiles } = {}) {
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

/**
 * The projects a shard must select, in a stable order.
 *
 * A file list alone is not enough: Playwright collects a file only in a project whose `testMatch`
 * accepts it, so a seeded spec passed to a `--project=chromium` run contributes ZERO tests and the
 * run still exits 0. Naming the seeded project alongside `chromium` is what makes the shard
 * actually run it — and it is named only when the shard holds such a file, so no other shard pays
 * for the second server `run-playwright.mjs` starts for it.
 */
export function projectsForPrUiShard(shard, groups = prUiShardGroups, profiles = prUiSpecProfiles) {
  const files = filesForPrUiShard(shard, groups);
  const projects = ["chromium"];
  for (const profile of profiles) {
    if (profile.project && files.includes(profile.file) && !projects.includes(profile.project)) {
      projects.push(profile.project);
    }
  }
  return projects;
}

export function playwrightArgsForPrUiShard(shard, { excludeCritical = false } = {}) {
  const grepInvert = excludeCritical ? "@critical|@quarantine|@mockup" : "@quarantine|@mockup";
  return [
    "scripts/run-playwright.mjs",
    ...filesForPrUiShard(shard),
    ...projectsForPrUiShard(shard).map((project) => `--project=${project}`),
    "--grep-invert",
    grepInvert,
  ];
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
