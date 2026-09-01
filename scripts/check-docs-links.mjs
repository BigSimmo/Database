#!/usr/bin/env node
/**
 * check-docs-links.mjs — verify that repo paths referenced in the maintained
 * documentation surface actually exist.
 *
 * Two kinds of references are checked:
 *  - Inline code spans (`docs/foo.md`, `src/bar.ts:12`) — treated as
 *    repo-root-relative paths when they start with a known top-level prefix.
 *  - Markdown link targets ([text](codebase-index.md), [text](../AGENTS.md))
 *    — resolved relative to the file containing the link and required to stay
 *    inside the repository.
 *
 * Scanned by default: README.md, AGENTS.md, and all Markdown files under docs/,
 * excluding docs/archive/, docs/audit/, dated point-in-time filenames
 * (docs/README.md classifies those as historical records that intentionally
 * reference the repo as it was), and docs/prompts/codex-cloud-review/ (verbatim
 * as-provided prompt inputs whose paths must not be edited). Pass --all to scan
 * those too (informational deeper sweep; still fails on missing paths).
 *
 * Blocking for maintained docs: runs in verify:cheap and CI. Historical
 * directories and dated point-in-time records stay excluded unless --all is
 * requested, so preserved history cannot block unrelated PRs.
 *
 * Outstanding-issues inbox citations are special: an immutable request is
 * queued at `docs/outstanding-issues-inbox/<uuid>.json` and, after reconcile,
 * lives at `docs/outstanding-issues-inbox/applied/<uuid>.json`. Ledger rows
 * (and the request's own source/detail) keep citing the pending path because
 * the JSON is immutable. Treat the applied sibling as the same file.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { applyRequestBatch, validateRequest } from "./ledger-inbox.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanAll = process.argv.includes("--all");

const ROOT_PREFIXES = [
  "docs/",
  "src/",
  "scripts/",
  "supabase/",
  "worker/",
  "tests/",
  "public/",
  ".github/",
  ".cursor/",
];

// Paths that docs intentionally reference although they do not exist:
// designed-but-unbuilt drivers and hypothetical future splits.
const ALLOWLIST = new Set([
  "scripts/reindex-shadow.ts", // designed-only harness driver (docs/reindex-shadow-harness-design.md)
  "docs/site-map.generated.md", // hypothetical future split named in docs/process-hardening.md
  // Legacy pre-(search-app) paths still cited in docs/ledger/redesign records:
  "src/app/page.tsx",
  "src/app/services/page.tsx",
  "src/app/tools/page.tsx",
  "src/app/(search-app)/tools/page.tsx",
  "src/lib/tools.ts",
  "src/components/ServiceDetailPage.tsx",
]);

// Paths a SPECIFIC document intentionally names although they do not exist, keyed by the
// document. Preferred over ALLOWLIST above, which suppresses a path everywhere: a global
// entry keeps passing if the file is later created and then deleted again, in a document
// that never meant to reference it. Scope new suppressions here unless the path is
// genuinely repo-wide.
const SCOPED_ALLOWLIST = new Map([
  [
    "docs/caring-contacts/phase-2a-sdd-archive/task-15-report.md",
    // A nested not-found route Task 15 considered and decided against after reading the
    // Next 16 docs. Naming it is the point of the paragraph.
    new Set(["src/app/caring-contacts/not-found.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2a-sdd-archive/task-18-report.md",
    // A temporary mutation probe Task 18 created, quoted the failure of, and deleted.
    new Set(["src/components/caring-contacts/workspace/overlays/guard-probe.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-1-brief.md",
    // The brief specs the file under its original planned name; Task 1's own
    // report documents the later `git mv` to `list-empty-state.tsx`.
    new Set(["src/components/caring-contacts/workspace/empty-state.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-1-report.md",
    // Same rename as above, named here to narrate why it happened.
    new Set(["src/components/caring-contacts/workspace/empty-state.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-3-report.md",
    // Quotes a `tsc` failure verbatim: `file.ts(107,7): error TS2578: ...`.
    // codeSpanCandidates() splits every backtick span on commas, so the
    // ",7)" half of that location is already gone by the time the path is
    // checked and this candidate arrives as the unclosed "...tsx(107".
    // The test file itself exists; only this quoted diagnostic fragment
    // does not resolve as a path.
    new Set(["tests/caring-contacts-overlay-trigger.dom.test.tsx(107"]),
  ],
  [
    "docs/ward-flow-pinned-clock-handover.md",
    // Both files exist on `claude/ward-flow-phases-6-7-design` and not on this branch —
    // naming them is the entire point of the handover, which exists to send a later session
    // to that branch to finish the work. The document says so where it names them, and gives
    // the `git show` command to read the spec from there. Remove this entry once Phase 6
    // lands on `main` and both paths resolve normally.
    new Set([
      "docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md",
      "tests/ward-morning-page.dom.test.tsx",
    ]),
  ],
  [
    "docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md",
    // Design spec proposed layout path implemented at component level in WardFlowProvider.
    new Set(["src/app/ward-management/layout.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2b-build-record.md",
    // Three references that cannot resolve, and each is the point of the sentence containing it:
    //   * `src/app/ward-management/**` is named while DESCRIBING `main`'s rename of that path --
    //     the record exists to say the old name is gone, so making it resolve would erase the
    //     finding. Same reason as the design-spec entry above.
    //   * the assurances location is a quoted `tsc` diagnostic, `file.ts(88,7): error TS...`.
    //     codeSpanCandidates() splits backtick spans on commas, so the ",7)" half is gone before
    //     the path is checked and the candidate arrives unclosed. The file itself exists.
    //   * `docs/…/phase-2b-build-record.md` is an ELLIPSIS standing for a directory in prose about
    //     this file's own name, not a path anybody could follow.
    new Set([
      "src/app/ward-management/**",
      "src/lib/caring-contacts/assurances.ts(88",
      "docs/…/phase-2b-build-record.md",
    ]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/main-catchup-inventory.md",
    // The inventory of what `main` changed under this branch. It names the pre-rename path because
    // recording the rename is what the document is for.
    new Set(["src/app/ward-management/**"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-11b-review.md",
    // A throwaway probe test, written to prove one assertion could fail and DELETED in the same
    // session -- it was never committed. The review names it so the mutation it ran can be
    // reproduced; a file that still existed would be the defect, not the reference.
    new Set(["tests/zz-review-probe-task11b.dom.test.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-11b-round-1-report.md",
    // The same deleted probe, named by the report whose work the review above checked.
    new Set(["tests/zz-review-probe-task11b.dom.test.tsx"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-14-report.md",
    // Another quoted `tsc` diagnostic arriving unclosed after the comma split, exactly as the
    // task-3-report entry above records. The test file itself exists.
    new Set(["tests/caring-contacts-overlay-trigger.dom.test.tsx(108"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-9-report.md",
    // A scratch module written to prove an untracked file behaved as claimed, then deleted. Named
    // so the check can be repeated; it was deliberately never committed.
    new Set(["src/lib/caring-contacts/scratch-untracked-probe.ts"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-9b-report.md",
    // The same quoted-diagnostic fragment as the build-record entry above; the file exists.
    new Set(["src/lib/caring-contacts/assurances.ts(88"]),
  ],
  [
    "docs/caring-contacts/phase-2b-sdd-archive/task-p-brief.md",
    // A governance document that has NOT been written. The brief cites it as the lived-experience
    // and clinical-programme approval gate that owns final wording, which is real and outstanding
    // (`#1S81R8`). Allowlisted rather than removed because deleting the citation would delete the
    // statement that the wording is unapproved -- the single most important line in that brief.
    new Set(["docs/caring-contacts/message-review-pack.md"]),
  ],
  [
    "docs/caring-contacts/task-seed-timeline-report.md",
    // An ephemeral test that drove the real seeded store to print its cadence table as evidence,
    // then was deleted -- the report says so where it names it. The table it produced is quoted in
    // the report, which is the durable part.
    new Set(["tests/caring-contacts-demo-seed-timeline-proof.test.ts"]),
  ],
]);

/** True when `repoRelative` is allowed outright, or allowed for the document being scanned. */
function isAllowedPath(repoRelative, target) {
  if (ALLOWLIST.has(repoRelative)) return true;
  return SCOPED_ALLOWLIST.get(target)?.has(repoRelative) === true;
}

const DATED_DOC = /\b20\d{2}-\d{2}(-\d{2})?\b/;
// Historical directories: only scanned with --all.
const HISTORICAL_DIRS = new Set(["archive", "audit"]);
// Verbatim as-provided inputs: retained byte-for-byte, so their internal path
// references cannot be corrected. Only scanned with --all.
const VERBATIM_DIRS = new Set(["codex-cloud-review"]);
const APP_ROUTE_GROUPS = ["(search-app)"];
const OUTSTANDING_ISSUES = "docs/outstanding-issues.md";
const OUTSTANDING_ISSUES_INBOX = "docs/outstanding-issues-inbox";
const INBOX_REQUEST_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;

/**
 * Pending inbox UUID paths keep being cited after reconcile moves the file
 * into `applied/`. Return that applied sibling, or null when the path is not
 * a pending inbox request citation.
 */
export function appliedInboxFallbackPath(repoRelative) {
  const cleaned = repoRelative.replace(/\/$/, "");
  const prefix = `${OUTSTANDING_ISSUES_INBOX}/`;
  const appliedPrefix = `${OUTSTANDING_ISSUES_INBOX}/applied/`;
  if (!cleaned.startsWith(prefix) || cleaned.startsWith(appliedPrefix)) return null;
  const name = cleaned.slice(prefix.length);
  if (name.includes("/") || !INBOX_REQUEST_NAME.test(name)) return null;
  return `${appliedPrefix}${name}`;
}

function repoPathExists(repoRelative) {
  const cleaned = repoRelative.replace(/\/$/, "");
  if (existsSync(path.join(repoRoot, cleaned))) return true;
  const applied = appliedInboxFallbackPath(cleaned);
  if (applied && existsSync(path.join(repoRoot, applied))) return true;

  if (!cleaned.startsWith("src/app/") || cleaned.includes("src/app/(")) return false;
  const appRelative = cleaned.slice("src/app/".length);
  return APP_ROUTE_GROUPS.some((group) => existsSync(path.join(repoRoot, "src/app", group, appRelative)));
}

export function markdownAnchorSlugs(markdown) {
  const slugs = new Set();
  const slugCounts = new Map();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (!match) continue;
    const headingText = match[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_~]/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    let rawSlug = headingText
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!rawSlug) rawSlug = "section";
    const count = slugCounts.get(rawSlug) ?? 0;
    slugCounts.set(rawSlug, count + 1);
    const uniqueSlug = count === 0 ? rawSlug : `${rawSlug}-${count}`;
    slugs.add(uniqueSlug);

    const collapsedSlug = rawSlug.replace(/-+/g, "-");
    if (collapsedSlug !== rawSlug) {
      slugs.add(collapsedSlug);
    }
  }
  for (const match of markdown.matchAll(/<(?:a|span|div|section|h[1-6])[^>]+(?:id|name)=["']([^"']+)["']/gi)) {
    slugs.add(match[1].toLowerCase());
  }
  return slugs;
}

function collectDocs(dirRelative, targets) {
  const absolute = path.join(repoRoot, dirRelative);
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const entryRelative = path.posix.join(dirRelative, entry.name);
    if (entry.isDirectory()) {
      const isSkippable = HISTORICAL_DIRS.has(entry.name) || VERBATIM_DIRS.has(entry.name);
      if (isSkippable && !scanAll) continue;
      collectDocs(entryRelative, targets);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const isSpecDoc = dirRelative === "docs/superpowers/specs" || dirRelative.startsWith("docs/superpowers/specs/");
    if (!scanAll && DATED_DOC.test(entry.name) && !isSpecDoc) continue;
    targets.push(entryRelative);
  }
}

function defaultTargets() {
  const targets = ["README.md", "AGENTS.md"];
  collectDocs("docs", targets);
  return targets;
}

function markdownForTarget(target, absoluteTarget) {
  const markdown = readFileSync(absoluteTarget, "utf8");
  if (target !== OUTSTANDING_ISSUES) return markdown;

  // Feature branches are forbidden from editing the canonical issues ledger.
  // Validate links against the deterministic projection of its pending immutable
  // inbox instead, which is the content `issues:reconcile` will write after the
  // relevant PRs land. This keeps docs-link validation compatible with the
  // conflict-free ledger architecture without weakening either gate.
  const inbox = path.join(repoRoot, OUTSTANDING_ISSUES_INBOX);
  const requests = readdirSync(inbox)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const request = JSON.parse(readFileSync(path.join(inbox, name), "utf8"));
      const problems = validateRequest(request);
      if (problems.length > 0) {
        throw new Error(`${OUTSTANDING_ISSUES_INBOX}/${name}: ${problems.join("; ")}`);
      }
      return request;
    });
  return requests.length > 0 ? applyRequestBatch(markdown, requests).markdown : markdown;
}

function codeSpanCandidates(markdown) {
  const candidates = new Set();
  for (const match of markdown.matchAll(/`([^`\n]+)`/g)) {
    for (const rawPiece of match[1].split(/,\s*/)) {
      candidates.add(rawPiece.trim());
    }
  }
  return candidates;
}

function linkCandidates(markdown) {
  const candidates = new Set();
  for (const match of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
    candidates.add(match[1].trim());
  }
  return candidates;
}

function stripSuffixes(value) {
  let result = value;
  if (result.startsWith("./")) result = result.slice(2);
  // Drop #anchor fragments and :line / :line-line / :line:col suffixes.
  result = result.replace(/#[^#]*$/, "");
  result = result.replace(/:\d+([-:]\d+)?$/, "");
  return result;
}

function looksLikeRootPath(value) {
  if (!ROOT_PREFIXES.some((prefix) => value.startsWith(prefix))) return false;
  if (/[<>{}$\\]/.test(value)) return false; // templates/placeholders
  if (value.includes("*")) return false; // globs checked via their base dir below
  if (value.includes("...")) return false; // ellipsis placeholders like src/app/api/...
  if (/\s/.test(value)) return false;
  // Require a file extension or an explicit trailing slash so that
  // non-path tokens sharing a prefix (e.g. the `supabase/postgres` Docker
  // image) are not misread as repo paths. Extensionless directory mentions
  // are simply skipped, never failed.
  const lastSegment = value.replace(/\/$/, "").split("/").pop() ?? "";
  if (!value.endsWith("/") && !lastSegment.includes(".")) return false;
  return true;
}

function globBaseDir(value) {
  const starIndex = value.indexOf("*");
  if (starIndex === -1) return null;
  const base = value.slice(0, starIndex);
  const lastSlash = base.lastIndexOf("/");
  return lastSlash === -1 ? null : base.slice(0, lastSlash);
}

function isExternalLink(value) {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
}

function main() {
  let missing = 0;
  let checked = 0;
  const targetAnchorsCache = new Map();

  function getAnchorsForFile(absPath, relPath) {
    if (targetAnchorsCache.has(absPath)) return targetAnchorsCache.get(absPath);
    if (!existsSync(absPath) || !relPath.endsWith(".md")) return null;
    const content = markdownForTarget(relPath, absPath);
    const anchors = markdownAnchorSlugs(content);
    targetAnchorsCache.set(absPath, anchors);
    return anchors;
  }

  for (const target of defaultTargets()) {
    const absoluteTarget = path.join(repoRoot, target);
    if (!existsSync(absoluteTarget)) continue;
    const markdown = markdownForTarget(target, absoluteTarget);
    const targetDir = path.posix.dirname(target);
    const failures = [];
    const currentFileAnchors = markdownAnchorSlugs(markdown);
    targetAnchorsCache.set(absoluteTarget, currentFileAnchors);

    const check = (repoRelative, label) => {
      if (isAllowedPath(repoRelative, target)) return;
      checked += 1;
      if (!repoPathExists(repoRelative)) failures.push(label);
    };

    // Inline code spans: repo-root-relative repo paths.
    for (const rawCandidate of codeSpanCandidates(markdown)) {
      const value = stripSuffixes(rawCandidate);
      const base = ROOT_PREFIXES.some((prefix) => value.startsWith(prefix)) ? globBaseDir(value) : null;
      if (base !== null) {
        if (isAllowedPath(value, target)) continue;
        checked += 1;
        if (!existsSync(path.join(repoRoot, base))) failures.push(`${value} (glob base '${base}' missing)`);
        continue;
      }
      if (!looksLikeRootPath(value)) continue;
      check(value, value);
    }

    // Markdown link targets: repo docs use both repo-root-relative targets
    // (`src/lib/env.ts`) and file-relative targets (`codebase-index.md`,
    // `../AGENTS.md`). Accept whichever resolves, confined to the repository.
    for (const rawCandidate of linkCandidates(markdown)) {
      if (isExternalLink(rawCandidate)) continue;
      let targetPart = rawCandidate;
      let anchorPart = null;
      const hashIndex = targetPart.indexOf("#");
      if (hashIndex !== -1) {
        anchorPart = targetPart.slice(hashIndex + 1);
        targetPart = targetPart.slice(0, hashIndex);
      }
      targetPart = stripSuffixes(targetPart);

      if (targetPart === "") {
        // Same-document anchor link: [heading](#heading)
        if (anchorPart) {
          checked += 1;
          const normalizedAnchor = anchorPart.toLowerCase();
          if (!currentFileAnchors.has(normalizedAnchor)) {
            failures.push(`${rawCandidate} (missing anchor #${anchorPart} in ${target})`);
          }
        }
        continue;
      }

      if (targetPart.includes("*") || /[<>{}$\\]/.test(targetPart) || /\s/.test(targetPart)) continue;
      const relative = path.posix.normalize(path.posix.join(targetDir === "." ? "" : targetDir, targetPart));
      if (relative.startsWith("..")) {
        checked += 1;
        failures.push(`${rawCandidate} (escapes repository root)`);
        continue;
      }
      const rootStyle = path.posix.normalize(targetPart);
      const candidates = rootStyle === relative || rootStyle.startsWith("..") ? [relative] : [rootStyle, relative];
      if (candidates.some((candidate) => isAllowedPath(candidate, target))) continue;
      checked += 1;
      const matchingPath = candidates.find((candidate) => repoPathExists(candidate));
      if (!matchingPath) {
        failures.push(rawCandidate === relative ? relative : `${rawCandidate} (tried ${candidates.join(", ")})`);
      } else if (anchorPart && matchingPath.endsWith(".md")) {
        const absFound = path.join(repoRoot, matchingPath);
        const targetAnchors = getAnchorsForFile(absFound, matchingPath);
        if (targetAnchors && !targetAnchors.has(anchorPart.toLowerCase())) {
          failures.push(`${rawCandidate} (missing anchor #${anchorPart} in ${matchingPath})`);
        }
      }
    }

    if (failures.length > 0) {
      missing += failures.length;
      console.error(`\n${target}:`);
      for (const failure of failures) console.error(`  MISSING ${failure}`);
    }
  }

  if (missing > 0) {
    console.error(`\ndocs link check FAILED: ${missing} missing path(s) across ${checked} checked references.`);
    process.exit(1);
  }

  console.log(`docs link check passed: ${checked} repo path references resolve.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
