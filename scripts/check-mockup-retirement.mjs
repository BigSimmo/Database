#!/usr/bin/env node
/**
 * check-mockup-retirement — make the written record, not a reachability scan, the gate on
 * retiring a mockup.
 *
 * Written after a 2026-09-02 survey found the mockup surface at ~430 files / ~98,000 lines
 * with three problems no existing gate could see:
 *
 *   1. `mockups/README.md` is the repo's only record of which mockup is superseded, and
 *      nothing kept it in step with the tree. It was refuted in five places by a single
 *      afternoon of evidence-gathering (the answer family, both document families, the
 *      closed issue #162, and the calculators family promoted to production by PR #1227).
 *   2. A third of the surface is not design scratch at all. `/mockups/development`,
 *      `/mockups/caring-contacts`, `/mockups/care-plan` and `/mockups/ward-flow` are live in
 *      production behind `DeveloperAreaGate` (src/proxy.ts) and linked from Settings. Any
 *      policy keyed on the path `src/app/mockups/**` hits them too.
 *   3. Filename supersession is systematically backwards. `example-round-two` IMPORTS
 *      `example-round-one`; dictionary rounds 2 and 3 both import round 1; the privacy
 *      study imports the privacy winner. Deleting "the older generation" breaks the newer one
 *      in at least five families.
 *
 * `check-dead-code-candidate.mjs` already refuses to call a SYMBOL dead on "nothing imports
 * it". This is its route-and-file-level sibling: it refuses to call a MOCKUP retired on
 * anything except a written record, and it fails CLOSED — an unanswerable question is a
 * refusal, never a pass, because proceeding on a weak signal is the exact failure mode of
 * PR #2204 (~1,644 lines, walked back seven times).
 *
 * Usage:
 *   node scripts/check-mockup-retirement.mjs                 # audit the working tree
 *   node scripts/check-mockup-retirement.mjs --diff <base>   # audit a deletion diff
 *   node scripts/check-mockup-retirement.mjs --json
 *   node scripts/check-mockup-retirement.mjs --self-test
 *
 * Exit 0 = clean. Exit 1 = at least one violation. Exit 2 = bad invocation.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CLI_USAGE = [
  "Usage:",
  "  node scripts/check-mockup-retirement.mjs",
  "  node scripts/check-mockup-retirement.mjs --diff <base-ref>",
  "  node scripts/check-mockup-retirement.mjs --json",
  "  node scripts/check-mockup-retirement.mjs --self-test",
].join("\n");

export const MOCKUP_ROUTE_ROOT = "src/app/mockups";
export const MOCKUP_INDEX_FILE = "mockups/README.md";
export const RETIRED_SECTION_HEADING = "## Retired mockups";
export const DEVELOPER_GATE_SOURCE = "src/lib/developer-area/headers.ts";

/** Directories under the mockup route root that are shell/infrastructure, not routes. */
const NON_ROUTE_ENTRIES = new Set(["mockups.css", "layout.tsx", "mockups-layout-client.tsx"]);

const errorMessage = (error) => (error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : String(error));

/** @typedef {{ readFileSync: typeof readFileSync, readdirSync: typeof readdirSync, existsSync: typeof existsSync }} FileSystemAdapter */
/** @type {FileSystemAdapter} */
const NODE_FILE_SYSTEM = { readFileSync, readdirSync, existsSync };

/** Git is repository-guaranteed; a failed command is a safety error, never a soft skip. */
const sh = (args, root = process.cwd()) => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error?.stdout?.toString().trim();
    throw new Error(`git ${args[0]} failed${detail ? `: ${detail.split(/\r?\n/, 1)[0]}` : ""}`, { cause: error });
  }
};

export function normalizeRepoPath(file) {
  return String(file)
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/");
}

/**
 * Top-level route slugs that actually exist on disk.
 * Nested routes (`document-search/search`) roll up to their top-level slug, because the
 * README indexes mockups at that granularity and always has.
 */
export function listRouteSlugs(root, fileSystem = NODE_FILE_SYSTEM) {
  const base = resolve(root, ...MOCKUP_ROUTE_ROOT.split("/"));
  // Fail closed. Returning [] here made auditIndex pass with "0 routes indexed", which is
  // indistinguishable from a healthy repo and is exactly the soft-skip this gate must not do.
  if (!fileSystem.existsSync(base))
    throw new Error(`${MOCKUP_ROUTE_ROOT} does not exist — cannot audit the mockup surface`);
  return fileSystem
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NON_ROUTE_ENTRIES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Read the developer-gated prefixes from their own source of truth rather than restating
 * them. If that list grows, this check follows it the same day.
 */
export function readDeveloperGatedPrefixes(root, fileSystem = NODE_FILE_SYSTEM) {
  const source = fileSystem.readFileSync(resolve(root, ...DEVELOPER_GATE_SOURCE.split("/")), "utf8");
  const block = source.match(/DEVELOPER_GATED_PATH_PREFIXES\s*=\s*\[([\s\S]*?)\]/u);
  if (!block) throw new Error(`${DEVELOPER_GATE_SOURCE} no longer declares DEVELOPER_GATED_PATH_PREFIXES`);
  const prefixes = [...block[1].matchAll(/["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
  if (!prefixes.length) throw new Error(`${DEVELOPER_GATE_SOURCE} declares an empty developer-gate list`);
  return prefixes;
}

/** Every inline-code span in a Markdown body, unwrapped. */
export function inlineCodeSpans(markdown) {
  return [...String(markdown).matchAll(/`([^`\n]+)`/gu)].map((match) => match[1].trim());
}

/** The body of the "## Retired mockups" section, or "" when the section is absent. */
export function retiredSection(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === RETIRED_SECTION_HEADING);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/u.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/**
 * Route slugs recorded as retired.
 *
 * Only the Route column of the section's table counts. The "Superseded by" column names the
 * LIVE winner, and reading every code span in the section made that winner look retired — a
 * bug caught by this check against its own first record on 2026-09-02.
 */
export const RETIRED_TABLE_HEADER = ["Retired", "Route", "Superseded by", "Evidence"];

export function retiredSlugs(markdown) {
  const section = retiredSection(markdown);
  if (!section.trim()) return new Set();
  const rows = section.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  if (!rows.length) return new Set();

  // Column order is load-bearing — the Route column records the retirement, the "Superseded by"
  // column names a LIVE route. Reordering the table silently changes what the record means, so
  // the header is verified rather than assumed.
  const header = rows[0]
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  if (header.join("|") !== RETIRED_TABLE_HEADER.join("|")) {
    throw new Error(
      `the "${RETIRED_SECTION_HEADING}" table header must be ${RETIRED_TABLE_HEADER.join(" | ")} — found ${header.join(" | ") || "<none>"}`,
    );
  }

  const slugs = new Set();
  for (const line of rows.slice(1)) {
    const cells = line.split("|").map((cell) => cell.trim());
    const route = inlineCodeSpans(cells[2] ?? "")[0];
    if (!route) continue;
    slugs.add(route.replace(/^\/mockups\//u, "").replace(/\/.*$/u, ""));
  }
  return slugs;
}

/** Slugs the index mentions anywhere — the completeness signal. */
export function mentionedSlugs(markdown) {
  return new Set(inlineCodeSpans(markdown).map((span) => span.replace(/^\/mockups\//u, "").replace(/\/.*$/u, "")));
}

/**
 * Audit the working tree: the index must describe the tree, and the tree must not contradict
 * the index. This is the forward-looking half — it is what stops the record drifting away
 * from the files again.
 */
export function auditIndex(root, fileSystem = NODE_FILE_SYSTEM) {
  const violations = [];
  const slugs = listRouteSlugs(root, fileSystem);
  let markdown;
  try {
    markdown = fileSystem.readFileSync(resolve(root, ...MOCKUP_INDEX_FILE.split("/")), "utf8");
  } catch (error) {
    return {
      routeCount: slugs.length,
      violations: [`${MOCKUP_INDEX_FILE} is unreadable — ${errorMessage(error)}`],
    };
  }

  const mentioned = mentionedSlugs(markdown);
  const retired = retiredSlugs(markdown);

  for (const slug of slugs) {
    if (!mentioned.has(slug)) {
      violations.push(
        `/mockups/${slug} has no entry in ${MOCKUP_INDEX_FILE} — every mockup route carries a recorded status`,
      );
    }
    if (retired.has(slug)) {
      violations.push(
        `/mockups/${slug} is listed under "${RETIRED_SECTION_HEADING}" but still exists on disk — retire it or correct the record`,
      );
    }
  }

  return { routeCount: slugs.length, retiredCount: retired.size, violations };
}

/** Files a diff deletes outright, restricted to the mockup surface. */
export function deletedMockupFiles(base, { root = process.cwd(), runGit = sh } = {}) {
  const raw = runGit(["diff", "--diff-filter=D", "--name-only", base, "--", "src", "tests"], root);
  return raw
    .split("\n")
    .map((line) => normalizeRepoPath(line.trim()))
    .filter(Boolean)
    .filter((file) => file.startsWith(`${MOCKUP_ROUTE_ROOT}/`) || /mockup/iu.test(file));
}

/** Route slugs a diff removes entirely (no surviving page.tsx under them). */
export function deletedRouteSlugs(deletedFiles, survivingSlugs) {
  const live = new Set(survivingSlugs);
  const slugs = new Set();
  for (const file of deletedFiles) {
    if (!file.startsWith(`${MOCKUP_ROUTE_ROOT}/`)) continue;
    const slug = file.slice(MOCKUP_ROUTE_ROOT.length + 1).split("/")[0];
    if (!slug || NON_ROUTE_ENTRIES.has(slug)) continue;
    if (!live.has(slug)) slugs.add(slug);
  }
  return [...slugs].sort();
}

/**
 * Every specifier a survivor could name a deleted file by.
 *
 * The alias form alone was not enough: 59 files in this surface import by relative path, and a
 * first version of this gate missed `./x`, `../../x`, `dynamic(() => import("./x"))` and CSS
 * `composes … from "./x.module.css"` — every one of which the policy claims to cover. Matching
 * is anchored on a quote OR a slash (see `referencePattern`) so a relative prefix cannot hide a
 * reference.
 */
export function moduleSpecifiersFor(file) {
  const path = normalizeRepoPath(file);
  const withoutExtension = path.replace(/\.(tsx?|mjs|jsx?)$/u, "");
  const specifiers = new Set();

  if (withoutExtension.startsWith("src/")) {
    const aliased = `@/${withoutExtension.slice("src/".length)}`;
    specifiers.add(aliased);
    if (aliased.endsWith("/index")) specifiers.add(aliased.slice(0, -"/index".length));
  }

  // A route directory is referenced by its URL, never by a module specifier — the four dead
  // `pathname === "/mockups/<slug>"` branches this gate first shipped without are why.
  if (path.startsWith(`${MOCKUP_ROUTE_ROOT}/`)) {
    const slug = path.slice(MOCKUP_ROUTE_ROOT.length + 1).split("/")[0];
    if (slug && !NON_ROUTE_ENTRIES.has(slug)) specifiers.add(`/mockups/${slug}`);
  }

  // The bare tail, so `./name`, `../../dir/name` and a CSS-module `composes` source all match.
  const basename = withoutExtension.split("/").pop();
  if (basename && basename !== "index" && basename !== "page") {
    specifiers.add(basename);
    if (path.endsWith(".css")) specifiers.add(path.split("/").pop());
  }
  return [...specifiers];
}

/** A reference to `specifier` that survives a relative prefix. */
export function referencePattern(specifier) {
  const escaped = specifier.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:["'\`]|/)${escaped}["'\`]`, "u");
}

/** Every tracked text file that survives the diff, with its contents. */
function survivingSources(root, runGit, fileSystem, deleted) {
  const gone = new Set(deleted.map(normalizeRepoPath));
  const tracked = runGit(["ls-files", "src", "tests", "scripts", "worker"], root)
    .split("\n")
    .map((line) => normalizeRepoPath(line.trim()))
    .filter(Boolean)
    .filter((file) => !gone.has(file))
    .filter((file) => /\.(tsx?|mjs|jsx?|css)$/u.test(file));
  const sources = new Map();
  for (const file of tracked) {
    try {
      sources.set(file, fileSystem.readFileSync(resolve(root, ...file.split("/")), "utf8"));
    } catch {
      // A tracked file we cannot read is a question we cannot answer. Fail closed below.
      sources.set(file, null);
    }
  }
  return sources;
}

/**
 * Audit a deletion diff. Every refusal here exists because the survey found a real file that
 * would have been wrongly removed by a reachability scan.
 */
/**
 * Resolve the base a deletion is measured against.
 *
 * `auto` lets one npm script be enforced locally, in verify:cheap and in CI without each caller
 * knowing the branch shape. It fails closed: an unresolvable base is a refusal, not a skip.
 */
export function resolveDiffBase(base, { root = process.cwd(), runGit = sh, env = process.env } = {}) {
  if (base !== "auto") return base;
  const configured = env.MOCKUP_RETIREMENT_BASE;
  if (configured) return configured;
  const merged = runGit(["merge-base", "origin/main", "HEAD"], root).trim();
  if (!merged) throw new Error("could not resolve a diff base — pass --diff <ref> or set MOCKUP_RETIREMENT_BASE");
  return merged;
}

export function auditDeletions(
  rawBase,
  { root = process.cwd(), runGit = sh, fileSystem = NODE_FILE_SYSTEM, env = process.env } = {},
) {
  const violations = [];
  const base = resolveDiffBase(rawBase, { root, runGit, env });
  const deleted = deletedMockupFiles(base, { root, runGit });
  if (!deleted.length) return { deleted: [], violations };

  const gatedPrefixes = readDeveloperGatedPrefixes(root, fileSystem);
  const survivingSlugs = listRouteSlugs(root, fileSystem);
  const markdown = fileSystem.readFileSync(resolve(root, ...MOCKUP_INDEX_FILE.split("/")), "utf8");
  const recorded = retiredSlugs(markdown);
  const sources = survivingSources(root, runGit, fileSystem, deleted);

  // Tier B — developer-gated applications are live behind admin auth, not design scratch.
  for (const file of deleted) {
    const routePath = file.startsWith(`${MOCKUP_ROUTE_ROOT}/`)
      ? `/mockups/${file.slice(MOCKUP_ROUTE_ROOT.length + 1)}`
      : null;
    const gated = gatedPrefixes.find(
      (prefix) => routePath && (routePath === prefix || routePath.startsWith(`${prefix}/`)),
    );
    if (gated) {
      violations.push(
        `${file} is under the developer-gated prefix ${gated} — that subtree is live in production behind DeveloperAreaGate, so retiring it is a product decision, not cleanup`,
      );
    }
  }

  // Tier C + import-graph safety — anything still named by a survivor.
  for (const file of deleted) {
    const specifiers = moduleSpecifiersFor(file);
    for (const [survivor, body] of sources) {
      if (body === null) {
        violations.push(`${survivor} is unreadable — cannot prove ${file} is unreferenced`);
        continue;
      }
      if (body.includes(file)) {
        violations.push(`${file} is still named as a path by ${survivor} — remove that reference first`);
        continue;
      }
      for (const specifier of specifiers) {
        if (!referencePattern(specifier).test(body)) continue;
        const kind = survivor.startsWith("tests/")
          ? "a committed test"
          : survivor.startsWith("scripts/") || survivor.startsWith("worker/")
            ? "repository tooling"
            : "a surviving module";
        violations.push(`${file} is still referenced as "${specifier}" by ${kind} (${survivor})`);
      }
    }
  }

  // Evidence of record — the whole point of the policy.
  for (const slug of deletedRouteSlugs(deleted, survivingSlugs)) {
    if (recorded.has(slug)) continue;
    violations.push(
      `/mockups/${slug} is deleted but is not recorded under "${RETIRED_SECTION_HEADING}" in ${MOCKUP_INDEX_FILE} — a retirement without a written record is not a retirement`,
    );
  }

  return { deleted, violations: [...new Set(violations)] };
}

export function parseArguments(argv) {
  const options = new Set(argv.filter((arg) => arg.startsWith("--")));
  if (options.has("--self-test")) return { mode: "self-test" };
  const json = options.has("--json");
  const diffIndex = argv.indexOf("--diff");
  if (diffIndex !== -1) {
    const base = argv[diffIndex + 1];
    if (!base || base.startsWith("--")) throw new Error("--diff requires a base ref (or the literal `auto`)");
    return { mode: "diff", base, json };
  }
  const unknown = [...options].filter((option) => !["--json", "--diff", "--self-test"].includes(option));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(", ")}`);
  return { mode: "index", json };
}

function selfTest({ stdout = console.log, stderr = console.error } = {}) {
  const failures = [];
  const check = (name, condition) => {
    if (!condition) failures.push(name);
  };

  const markdown = [
    "# Project Mockups",
    "",
    "`example-study` — Active study.",
    "",
    RETIRED_SECTION_HEADING,
    "",
    "| Retired | Route | Superseded by | Evidence |",
    "| --- | --- | --- | --- |",
    "| 2026-09-02 | `document-navigation-pane` | `document-navigation-perfected` | Exact code match. |",
    "",
    "## Design tokens",
    "",
    "`not-a-retired-slug`",
  ].join("\n");

  check("retiredSection stops at the next heading", !retiredSection(markdown).includes("not-a-retired-slug"));
  check("retiredSlugs finds the recorded slug", retiredSlugs(markdown).has("document-navigation-pane"));
  check("retiredSlugs excludes live entries", !retiredSlugs(markdown).has("example-study"));
  check(
    "retiredSlugs never treats the successor column as retired",
    !retiredSlugs(markdown).has("document-navigation-perfected"),
  );
  check("mentionedSlugs sees the live entry", mentionedSlugs(markdown).has("example-study"));
  check("inlineCodeSpans unwraps backticks", inlineCodeSpans("a `b` c").join() === "b");

  check(
    "moduleSpecifiersFor builds the @/ alias",
    moduleSpecifiersFor("src/components/example-study-mockups.tsx").includes("@/components/example-study-mockups"),
  );
  check(
    "moduleSpecifiersFor strips a trailing /index",
    moduleSpecifiersFor("src/components/tools-page-mockups/index.ts").includes("@/components/tools-page-mockups"),
  );
  check(
    "moduleSpecifiersFor ignores a bare page basename",
    !moduleSpecifiersFor("src/app/mockups/foo/page.tsx").includes("page"),
  );

  check(
    "deletedRouteSlugs reports a fully removed route",
    deletedRouteSlugs([`${MOCKUP_ROUTE_ROOT}/gone/page.tsx`], ["stays"]).join() === "gone",
  );
  check(
    "deletedRouteSlugs ignores a route with a surviving sibling page",
    deletedRouteSlugs([`${MOCKUP_ROUTE_ROOT}/stays/nested/page.tsx`], ["stays"]).length === 0,
  );

  let parsedDiff;
  try {
    parsedDiff = parseArguments(["--diff", "origin/main"]);
  } catch {
    parsedDiff = null;
  }
  check("parseArguments accepts --diff <base>", parsedDiff?.mode === "diff" && parsedDiff.base === "origin/main");
  let rejectedBareDiff = false;
  try {
    parseArguments(["--diff"]);
  } catch {
    rejectedBareDiff = true;
  }
  check("parseArguments rejects a bare --diff", rejectedBareDiff);

  if (failures.length) {
    for (const failure of failures) stderr(`  x ${failure}`);
    stderr(`[mockup-retirement] SELF-TEST FAILED — ${failures.length} assertion(s).`);
    return 1;
  }
  stdout("[mockup-retirement] self-test passed.");
  return 0;
}

export function main(
  argv = process.argv.slice(2),
  {
    root = process.cwd(),
    runGit = sh,
    fileSystem = NODE_FILE_SYSTEM,
    stdout = console.log,
    stderr = console.error,
  } = {},
) {
  let parsed;
  try {
    parsed = parseArguments(argv);
  } catch (error) {
    stderr(`${errorMessage(error)}\n${CLI_USAGE}`);
    return 2;
  }
  if (parsed.mode === "self-test") return selfTest({ stdout, stderr });

  let result;
  try {
    result =
      parsed.mode === "diff" ? auditDeletions(parsed.base, { root, runGit, fileSystem }) : auditIndex(root, fileSystem);
  } catch (error) {
    stderr(`[mockup-retirement] REFUSE — ${errorMessage(error)}`);
    return 1;
  }

  if (parsed.json) {
    stdout(JSON.stringify(result, null, 2));
    return result.violations.length ? 1 : 0;
  }

  if (result.violations.length) {
    for (const violation of result.violations) stdout(`  x ${violation}`);
    stderr(
      `[mockup-retirement] FAIL — ${result.violations.length} violation(s). See docs/mockup-retirement-policy.md.`,
    );
    return 1;
  }

  stdout(
    parsed.mode === "diff"
      ? `[mockup-retirement] PASS — ${result.deleted.length} deleted mockup file(s), each recorded and unreferenced.`
      : `[mockup-retirement] PASS — ${result.routeCount} mockup route(s) indexed, ${result.retiredCount} recorded as retired.`,
  );
  return 0;
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) process.exitCode = main();
