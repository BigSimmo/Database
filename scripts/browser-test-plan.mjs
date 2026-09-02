#!/usr/bin/env node
/**
 * browser-test-plan.mjs — choose the smallest browser gate that still covers a change.
 *
 * `gate-receipts.mjs` removed local-versus-local duplication. `gate-arbiter.mjs`
 * weighs the local-versus-CI duplication for the static gates. Neither touches the
 * single most expensive run in this repository:
 *
 *     npm run verify:ui   ->   646 Chromium tests, ~25 minutes
 *
 * CI repeats it wholesale. `Production UI critical` and the three `Production UI`
 * shards are guarded by `needs.changes.outputs.ui_changed == 'true'`, so for any
 * change that touches a browser surface the full suite runs on GitHub whether or
 * not it ran locally first. Measured on this repository 2026-09-02: two
 * consecutive changes ran the full local gate (25.0m and 20.5m), and between them
 * the focused selection for the same diffs took 37s and 6.1s and reached the same
 * verdict.
 *
 * The arbiter cannot answer this one. Its lever is DEFERRAL — run the gate or hand
 * it to CI — and `ui` is in `NEVER_DEFER_CLASSES`, correctly: a UI change with no
 * browser evidence at all before a push is not a bet this repository takes. So the
 * lever here is a different one:
 *
 *     not "run it or skip it", but "run the part of it that can actually fail"
 *
 * Narrowing is strictly safer than deferring. Something always runs locally; what
 * changes is how much of the suite that cannot be affected by the diff is dragged
 * along with it.
 *
 * The levels, cheapest first. Each is chosen only when it can be justified from the
 * tree, never from a hand-maintained ownership table that rots in silence:
 *
 *   none      No browser surface changed. `ui_changed` is false, so CI skips its
 *             Production UI jobs too — nothing is left unrun by running nothing.
 *   changed   A `ui-*.spec.ts` file changed: run those specs COMPLETE. An edited
 *             spec is evidence about itself, and a grep inside it would be the
 *             author marking their own work.
 *   focused   Changed UI source, attributed to the specs that exercise it by an
 *             identifier both files contain — a `data-testid` the source renders,
 *             or a route the source defines and the spec navigates to.
 *   full      Shared foundations changed, or a changed UI file could not be
 *             attributed to any spec. Both are fail-closed: an unattributable
 *             change is treated exactly as CI treats unknown scope.
 *
 * Boundaries, all of them the conservative direction:
 *
 * - **Fail closed to `full`.** Every uncertainty — an unreadable file, a changed UI
 *   source with no owning spec, an unrecognised path — escalates. A bug here costs
 *   a full local run, never a missed one. That is the opposite of the arbiter's
 *   fail-open contract, and deliberately so: the arbiter's failure mode is a
 *   redundant run, this one's would be an unrun journey.
 * - **CI is never advised by this file.** It plans local work only. GitHub keeps
 *   running exactly what it runs today.
 * - **A narrowed run is not a full run.** The plan says which level it chose and
 *   what it is leaving to CI, and must be reported that way — "focused browser
 *   proof, full suite left to CI", never "the UI gate passed".
 * - **Dry-run by default**, like every other planner in `docs/productivity-workflows.md`.
 *   `--run` executes; nothing happens without it.
 *
 * CLI:
 *   node scripts/browser-test-plan.mjs                    plan for the diff vs origin/main
 *   node scripts/browser-test-plan.mjs --files a.tsx,b.ts plan for an explicit file list
 *   node scripts/browser-test-plan.mjs --diff HEAD~1      plan against another base
 *   node scripts/browser-test-plan.mjs --json             machine-readable plan
 *   node scripts/browser-test-plan.mjs --run              execute the planned stages
 *   node scripts/browser-test-plan.mjs --full             force the full suite
 *   node scripts/browser-test-plan.mjs --self-test        offline contract self-test
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveCiCoverage } from "./gate-arbiter.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const normalize = (file) =>
  String(file ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "");

/**
 * Files whose blast radius is the whole suite.
 *
 * Not a list of "important" files — a list of files whose effect cannot be
 * attributed to any subset of journeys. A design token, the global stylesheet, the
 * Playwright config, the runner, or a shared fixture changes what EVERY spec
 * renders or how every spec runs, so narrowing on them would be narrowing on
 * nothing. Kept in step with `sharedFoundation` in `phone-chrome-plan.mjs`, which
 * makes the same call for the phone-chrome subset.
 */
export const SHARED_FOUNDATION_PATTERNS = [
  /^src\/app\/globals\.css$/,
  /^src\/styles\//,
  /^src\/app\/layout\.tsx$/,
  /^playwright(?:\..*)?\.config\.ts$/,
  /^tests\/helpers\//,
  /^tests\/playwright-.*\.ts$/,
  /^scripts\/(?:run-playwright|playwright-base-url|playwright-browser-preflight|playwright-pr-shards)\.mjs$/,
  /^src\/components\/ClinicalDashboard\.tsx$/,
  /^src\/components\/clinical-dashboard\/(?:global-search-shell|master-search-header|mobile-composer-reserve|phone-footer-layer-portal|scroll-surface|use-active-scroll-owner|use-dashboard-chrome-coordinator|use-hide-on-scroll|use-phone-overlay-chrome-reserve)\.(?:ts|tsx)$/,
  /^src\/lib\/app-modes\.ts$/,
];

/** A Playwright spec this planner can select. Mirrors `uiPatterns` in `ci-change-scope.mjs`. */
export const BROWSER_SPEC_PATTERN = /^tests\/(?:ui-.*|answer-progress-ui-smoke)\.spec\.ts$/;

export function isSharedFoundation(file) {
  return SHARED_FOUNDATION_PATTERNS.some((pattern) => pattern.test(file));
}

/**
 * Is this file in CI's browser lane at all?
 *
 * A mirror of `uiPatterns` in `ci-change-scope.mjs`, and the one piece of that file's
 * routing this planner has to restate rather than shell out for: `ci-change-scope.mjs`
 * answers for a CHANGE, not for a FILE, so a mixed change reports one `ui_changed` for
 * the whole set. Without a per-file answer, every documentation or config file in a
 * mixed change looks like an unclassified browser file and forces the full suite —
 * which is nearly every real change, and would make the planner useless.
 *
 * Restating a rule is a drift risk, so it is not left to inspection:
 * `tests/browser-test-plan.test.ts` cross-checks this predicate against
 * `ci-change-scope.mjs` itself, path by path, and fails when the two disagree.
 */
export const BROWSER_LANE_PATTERNS = [
  /^data\//,
  /^public\//,
  /^src\/(?:app|components|styles)\//,
  /^\.github\/actions\/setup-ui-e2e\//,
  /^tests\/(?:ui-.*|answer-progress-ui-smoke)\.spec\.ts$/,
  /^tests\/playwright-.*\.ts$/,
  /^tests\/helpers\/.*\.ts$/,
  /^tests\/__screenshots__\//,
  /^playwright(?:\..*)?\.config\.ts$/,
  /^scripts\/(?:run-playwright|playwright-base-url|playwright-browser-preflight|playwright-pr-shards|check-playwright-browser-revision)\.(?:mjs|ts)$/,
  /^scripts\/(?:run|check)-lighthouse-budget\.mjs$/,
  /^lighthouse-budget\.json$/,
  /^src\/lib\/(?:app-modes|app-mode-icons|search-route-ownership|ui-copy|mode-home-composer|mode-secondary-navigation|category-identity(?:-icons)?|brand-mark|brand-image|search-command-surface|search-navigation-context|search-scope-filter-chips|search-shell-props|document-flow-routes|document-viewer-navigation|differentials-navigation|therapy-compass-navigation|therapies)\.tsx?$/,
];

export function isBrowserLanePath(file) {
  if (file === "src/app/api" || file.startsWith("src/app/api/")) return false;
  return BROWSER_LANE_PATTERNS.some((pattern) => pattern.test(file));
}

/**
 * Files that can carry an identifier a spec names — routes and components.
 *
 * Nothing else is attributable, and that is the point rather than a limitation: a
 * `src/lib` module, a public asset or a screenshot baseline renders no `data-testid`
 * of its own, so no honest attribution exists for it. Such a file either sits
 * outside the browser lane entirely (and is ignored) or sits inside it and cannot be
 * classified (and escalates to the full suite). API handlers are excluded for the
 * same reason `ci-change-scope.mjs` excludes them from `ui_changed`: they are not
 * browser journeys.
 */
export function isRenderingSource(file) {
  if (file === "src/app/api" || file.startsWith("src/app/api/")) return false;
  return /^src\/(?:app|components)\/.+\.(?:tsx|ts|css)$/.test(file);
}

/**
 * The identifiers a changed source file and a spec can both name.
 *
 * Deliberately only two kinds, both of them literal strings that appear verbatim
 * on each side of the tap:
 *
 *   - `data-testid="x"` — what a spec reaches with `getByTestId("x")`.
 *   - a route segment from `src/app/**\/page.tsx` — what a spec navigates to.
 *
 * Component names are NOT used. A spec never names a component, so matching on one
 * would mean matching a comment, and a comment is not evidence that a journey
 * covers the code. Rejecting that is what keeps a `focused` plan honest: an
 * attribution either rests on a string the browser actually sees, or the file is
 * unattributable and the plan escalates to `full`.
 *
 * @param {string} file repository-relative path
 * @param {string} contents
 * @returns {{ testIds: string[], routes: string[] }}
 */
export function ownershipKeys(file, contents) {
  const testIds = [
    ...new Set(
      [...String(contents ?? "").matchAll(/data-testid=(?:"([^"]+)"|\{"([^"]+)"\}|'([^']+)')/g)]
        .map((match) => match[1] ?? match[2] ?? match[3])
        .filter(Boolean),
    ),
  ].sort();

  const routes = [];
  const routeMatch = file.match(/^src\/app\/(.+)\/page\.tsx$/);
  if (routeMatch) {
    const segments = routeMatch[1]
      .split("/")
      // Route groups `(search-app)` are organisational and absent from the URL;
      // a dynamic `[slug]` cannot be matched against a literal in a spec.
      .filter((segment) => !/^\(.*\)$/.test(segment));
    if (!segments.some((segment) => /^\[.*\]$/.test(segment))) routes.push(`/${segments.join("/")}`);
  }

  return { testIds, routes };
}

/**
 * Which specs reference any of these identifiers.
 *
 * A plain substring test, because that is exactly how the identifier is written in
 * both files. A quoted `"answer-feedback-trigger"` in a spec is the spec asking the
 * browser for the element the source renders under that name; nothing subtler is
 * needed, and anything subtler would be guessing.
 *
 * @param {{ testIds: string[], routes: string[] }} keys
 * @param {Map<string, string>} specSources spec path -> contents
 * @returns {string[]} spec paths, sorted
 */
export function specsReferencing(keys, specSources) {
  const needles = [...keys.testIds.map((id) => `"${id}"`), ...keys.routes.map((route) => `"${route}"`)];
  if (needles.length === 0) return [];
  const owners = [];
  for (const [spec, contents] of specSources) {
    if (needles.some((needle) => contents.includes(needle))) owners.push(spec);
  }
  return owners.sort();
}

/**
 * Build the plan.
 *
 * Pure: every input is passed in, so the self-test and `tests/browser-test-plan.test.ts`
 * drive it without a worktree, a build, or a browser.
 *
 * @param {object} input
 * @param {string[]} input.files changed files, repository-relative
 * @param {{ ui_changed?: boolean }} input.scope output of `ci-change-scope.mjs --json`
 * @param {Map<string, string>} input.specSources every browser spec -> its contents
 * @param {Map<string, string>} input.sourceSources changed UI source files -> their contents
 * @param {"auto" | "full"} [input.mode]
 */
export function browserTestPlan({ files, scope, specSources, sourceSources, mode = "auto" }) {
  const normalized = [...new Set((files ?? []).map(normalize).filter(Boolean))].sort();
  const uiChanged = Boolean(scope?.ui_changed);

  const changedSpecs = normalized.filter((file) => BROWSER_SPEC_PATTERN.test(file));
  const foundation = normalized.filter((file) => isSharedFoundation(file));
  // The files that have to be attributed to a journey: rendering sources that are
  // neither a spec nor a foundation. Anything else in the change is either outside
  // the browser lane (ignored) or inside it and unclassifiable (handled last, by
  // escalating).
  const attributable = normalized.filter(
    (file) => !BROWSER_SPEC_PATTERN.test(file) && !isSharedFoundation(file) && isRenderingSource(file),
  );
  const classified = new Set([...changedSpecs, ...foundation, ...attributable]);
  // Only files that are themselves in the browser lane can be an unclassified
  // browser file. A doc or a config file riding along in a mixed change is simply
  // not this planner's business, and treating it as unknown scope would escalate
  // nearly every real change.
  const unclassifiedBrowserFiles = normalized.filter((file) => isBrowserLanePath(file) && !classified.has(file));
  // `ui_changed` is true but nothing here is recognised as a browser-lane path:
  // the mirror above has drifted from `ci-change-scope.mjs`. Fail closed on the
  // drift rather than narrow on a rule that no longer matches CI's.
  const laneMirrorDrifted = uiChanged && !normalized.some((file) => isBrowserLanePath(file));

  const attribution = [];
  const unattributed = [];
  for (const file of attributable) {
    const keys = ownershipKeys(file, sourceSources.get(file) ?? "");
    const owners = specsReferencing(keys, specSources);
    if (owners.length === 0) unattributed.push(file);
    else attribution.push({ file, keys, owners });
  }

  const forced = mode === "full";
  let level;
  const reasons = [];

  if (!uiChanged && !forced) {
    level = "none";
    reasons.push("No browser surface changed, so CI skips its Production UI jobs for this scope too.");
  } else if (forced) {
    level = "full";
    reasons.push("The full suite was requested explicitly.");
  } else if (foundation.length > 0) {
    level = "full";
    reasons.push(
      `Shared foundations changed (${foundation.join(", ")}); their effect cannot be attributed to a subset of journeys.`,
    );
  } else if (unattributed.length > 0) {
    level = "full";
    reasons.push(
      `No spec references anything rendered by ${unattributed.join(", ")}; an unattributable UI change fails closed to the full suite.`,
    );
  } else if (laneMirrorDrifted) {
    level = "full";
    reasons.push(
      "CI puts this change in the browser lane but no changed path matches BROWSER_LANE_PATTERNS; the mirror of ci-change-scope has drifted, so the full suite runs.",
    );
  } else if (unclassifiedBrowserFiles.length > 0) {
    // `ui_changed` is true because of a file this planner cannot attribute — a
    // public asset, a screenshot baseline, a runner script outside the foundation
    // list. Unknown scope is heavy scope, exactly as CI routes it.
    level = "full";
    reasons.push(
      `${unclassifiedBrowserFiles.join(", ")} puts this change in the browser lane but cannot be attributed to a journey; unknown scope runs the full suite.`,
    );
  } else if (attribution.length > 0) {
    level = "focused";
    reasons.push("Every changed UI file is exercised by a spec that names something it renders.");
  } else if (changedSpecs.length > 0) {
    level = "changed";
    reasons.push("Only browser specs changed; each one runs complete.");
  } else {
    level = "full";
    reasons.push("The change could not be classified; unknown scope runs the full suite.");
  }

  // A changed spec always runs in full, at every level below `full` — it is the one
  // file whose own assertions the diff rewrote.
  const specsToRun = [...new Set([...changedSpecs, ...attribution.flatMap((entry) => entry.owners)])].sort();

  const stages = [];
  if (level === "full") {
    stages.push({
      id: "full-ui",
      label: "full Chromium UI suite",
      command: { executable: "npm", args: ["run", "verify:ui"] },
    });
  } else if (level !== "none") {
    stages.push({
      id: "browser-owners",
      label: `complete browser specs owning the change (${specsToRun.length})`,
      command: { executable: "node", args: ["scripts/run-playwright.mjs", ...specsToRun, "--project=chromium"] },
    });
  }

  return {
    files: normalized,
    level,
    stages,
    specs: specsToRun,
    attribution,
    unattributed,
    foundation,
    unclassifiedBrowserFiles,
    laneMirrorDrifted,
    uiChanged,
    reasons,
  };
}

export function renderCommand(command) {
  return [command.executable, ...command.args.map((arg) => (/\s|\|/.test(arg) ? JSON.stringify(arg) : arg))].join(" ");
}

/* ------------------------------------------------------------------ *
 * CLI                                                                *
 * ------------------------------------------------------------------ */

function git(args) {
  return execFileSync("git", args, { cwd: projectRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function changedFilesFromGit(base) {
  const tracked = git(["diff", "--name-only", `${base}...HEAD`]).split("\n");
  const working = git(["diff", "--name-only", "HEAD"]).split("\n");
  const staged = git(["diff", "--name-only", "--cached"]).split("\n");
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n");
  return [...tracked, ...working, ...staged, ...untracked].map(normalize).filter(Boolean);
}

function readChangeScope(files) {
  // `--files <list>` as two arguments: `getArgValue` in that script reads the NEXT
  // argv entry, so the `--files=a,b` spelling is silently ignored and
  // `resolveChangedFiles` falls through to the local working tree — classifying a
  // different change from the one being planned. Verified against its parser rather
  // than assumed; the scope this returns decides whether the plan may narrow at all.
  const output = execFileSync(
    process.execPath,
    [path.join(projectRoot, "scripts", "ci-change-scope.mjs"), "--json", "--files", files.join(",")],
    { cwd: projectRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const scope = JSON.parse(output);
  // Fail closed on a scope that did not classify what was asked: an empty list, or
  // a list that came back different, means the fallback fired.
  const asked = [...new Set(files)].sort().join("|");
  const answered = [...new Set(scope.files ?? [])].sort().join("|");
  if (files.length > 0 && asked !== answered) {
    throw new Error(
      `ci-change-scope classified a different file set than requested (asked ${asked || "<none>"}, answered ${answered || "<none>"})`,
    );
  }
  return scope;
}

function readAllSpecs() {
  const testsDir = path.join(projectRoot, "tests");
  const specs = new Map();
  for (const entry of readdirSync(testsDir)) {
    const relative = `tests/${entry}`;
    if (!BROWSER_SPEC_PATTERN.test(relative)) continue;
    specs.set(relative, readFileSync(path.join(testsDir, entry), "utf8"));
  }
  return specs;
}

function readSources(files) {
  const sources = new Map();
  for (const file of files) {
    if (BROWSER_SPEC_PATTERN.test(file)) continue;
    const absolute = path.join(projectRoot, file);
    // A deleted file cannot be attributed and must not be silently dropped: leaving
    // it out of `sourceSources` keeps it out of `attributable`, which would let a
    // deletion narrow the plan. Recording it empty makes it unattributable instead,
    // and unattributable escalates to the full suite.
    sources.set(file, existsSync(absolute) ? readFileSync(absolute, "utf8") : "");
  }
  return sources;
}

function selfTest() {
  const specSources = new Map([
    ["tests/ui-smoke.spec.ts", 'getByTestId("answer-feedback-trigger"); gotoApp(page, "/documents");'],
    ["tests/ui-tools.spec.ts", 'getByTestId("tools-launcher");'],
  ]);
  const assert = (name, condition) => {
    if (!condition) throw new Error(`browser-test-plan self-test failed: ${name}`);
  };

  const attributed = browserTestPlan({
    files: ["src/components/clinical-dashboard/evidence-panels.tsx"],
    scope: { ui_changed: true },
    specSources,
    sourceSources: new Map([
      ["src/components/clinical-dashboard/evidence-panels.tsx", '<button data-testid="answer-feedback-trigger" />'],
    ]),
  });
  assert("a testid the spec names selects that spec", attributed.level === "focused");
  assert("and only that spec", attributed.specs.join() === "tests/ui-smoke.spec.ts");

  const orphan = browserTestPlan({
    files: ["src/components/clinical-dashboard/mystery.tsx"],
    scope: { ui_changed: true },
    specSources,
    sourceSources: new Map([["src/components/clinical-dashboard/mystery.tsx", "export const x = 1;"]]),
  });
  assert("an unattributable UI file escalates", orphan.level === "full");

  const foundation = browserTestPlan({
    files: ["src/app/globals.css"],
    scope: { ui_changed: true },
    specSources,
    sourceSources: new Map([["src/app/globals.css", ":root { --x: 1; }"]]),
  });
  assert("a shared foundation escalates", foundation.level === "full");

  const docs = browserTestPlan({
    files: ["docs/testing.md"],
    scope: { ui_changed: false },
    specSources,
    sourceSources: new Map([["docs/testing.md", "# testing"]]),
  });
  assert("a non-UI change plans nothing", docs.level === "none" && docs.stages.length === 0);

  const specOnly = browserTestPlan({
    files: ["tests/ui-tools.spec.ts"],
    scope: { ui_changed: true },
    specSources,
    sourceSources: new Map(),
  });
  assert("a changed spec runs complete", specOnly.level === "changed");
  assert("and is the only spec run", specOnly.specs.join() === "tests/ui-tools.spec.ts");

  console.log("browser-test-plan self-test passed.");
}

function main(argv) {
  if (argv.includes("--self-test")) {
    selfTest();
    return 0;
  }

  const fileFlag = argv.find((arg) => arg.startsWith("--files="))?.slice("--files=".length);
  const diffBase = argv.find((arg) => arg.startsWith("--diff="))?.slice("--diff=".length) ?? "origin/main";
  const files = fileFlag ? fileFlag.split(",").map(normalize).filter(Boolean) : changedFilesFromGit(diffBase);

  const scope = readChangeScope(files);
  const plan = browserTestPlan({
    files,
    scope,
    specSources: readAllSpecs(),
    sourceSources: readSources(files),
    mode: argv.includes("--full") ? "full" : "auto",
  });

  // What CI will do with this same change, read from the workflow rather than
  // asserted — the claim "the full suite runs on GitHub anyway" is the whole basis
  // for narrowing locally, so it is derived, and printed even when it is false.
  const ciCritical = deriveCiCoverage(projectRoot, "test:e2e:critical", { scope });
  const ciShards = deriveCiCoverage(projectRoot, "test:e2e:pr:shard", { scope });
  const ciRunsBrowser = ciCritical.covered || ciShards.covered;

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ...plan, ci: { critical: ciCritical, shards: ciShards, ciRunsBrowser } }, null, 2));
    return 0;
  }

  console.log(`[browser-test-plan] level: ${plan.level}  (${plan.files.length} changed file(s))`);
  for (const reason of plan.reasons) console.log(`  why: ${reason}`);
  for (const entry of plan.attribution) {
    const keys = [...entry.keys.testIds, ...entry.keys.routes].slice(0, 4).join(", ");
    console.log(`  ${entry.file} -> ${entry.owners.join(", ")}  (via ${keys})`);
  }
  if (plan.level === "none") {
    console.log("  CI: Production UI is skipped for this scope on GitHub too, so nothing is being left unrun.");
  } else if (ciRunsBrowser) {
    console.log(
      "  CI: Production UI runs the complete Chromium suite on this change, so a narrowed local run is not a coverage hole.",
    );
  } else {
    console.log(
      "  CI: Production UI does NOT run for this change — a local run is the only browser evidence there will be.",
    );
    if (plan.level !== "full") {
      console.log("  NOTE: CI will not repeat this. Consider `--full` before relying on the narrowed run.");
    }
  }
  if (plan.stages.length === 0) {
    console.log("  plan: no local browser run needed.");
  } else {
    for (const stage of plan.stages) console.log(`  run: ${renderCommand(stage.command)}   # ${stage.label}`);
  }

  if (!argv.includes("--run")) {
    console.log("  (dry run — pass --run to execute)");
    return 0;
  }

  for (const stage of plan.stages) {
    console.log(`\n[browser-test-plan] ${stage.label}`);
    const result = spawnSync(stage.command.executable, stage.command.args, { cwd: projectRoot, stdio: "inherit" });
    if (result.status !== 0) return result.status ?? 1;
  }
  // Never let a narrowed pass be read as a full pass.
  if (plan.level !== "full" && plan.stages.length > 0) {
    console.log(
      `\n[browser-test-plan] PASSED at level "${plan.level}" — this is focused browser proof, not the full UI gate.`,
    );
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
