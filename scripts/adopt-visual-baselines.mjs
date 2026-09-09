#!/usr/bin/env node
/**
 * Adopt or refresh the Linux visual baselines from a hosted-CI artifact.
 *
 * Everything this writes was hand-assembled before: six PNG copies, then a
 * `provenance.json` carrying a SHA-256 and pixel dimensions per candidate, the
 * capture commit, the run id, and the reviewer attestation. Hand-assembling that
 * on every design change is the friction that makes people skip the refresh and
 * leave a red advisory standing, which is how a pixel gate stops being read.
 *
 * What it deliberately does NOT do:
 *
 *   - It never captures screenshots. Baselines are platform-scoped, and a Windows
 *     or macOS shot lands in a directory ubuntu CI never reads; font hinting alone
 *     would make every later run red. The artifact is the only supported source.
 *   - It never invents the review. `--reviewed-by` is required and the caller is
 *     asserting they looked at the images. That field is a display name, not a
 *     GitHub login — single-token names such as `Alice` are valid. Optional
 *     `--reviewed-by-login` is the only allowlisted GitHub-login field. A baseline
 *     of a broken render silently blesses the break, and that is exactly what the
 *     human-review field in the provenance contract exists to prevent.
 *
 * Usage:
 *   node scripts/adopt-visual-baselines.mjs \
 *     --from <extracted-artifact-dir> --run-id <id> --head <40-char-sha> \
 *     --reviewed-by "<display name>" [--reviewed-by-login <github-login>] [--write]
 *
 * Without `--write` it reports what would change and touches nothing.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { humanReviewerAttributionFailure, visualBaselineAwaitingIds } from "./generate-design-system-adoption.mjs";

const ROOT = process.cwd();
const BASELINE_DIR = "tests/__screenshots__/linux";
const VISUAL_SUITE_FILE = "tests/ui-visual-baseline.spec.ts";
const PROVENANCE = `${BASELINE_DIR}/provenance.json`;
const CANONICAL = [
  "dashboard-shell",
  "dashboard-shell-phone",
  "search-results-band",
  "search-results-band-phone",
  "document-viewer",
  "therapy-compass-home",
];

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const WRITE = process.argv.includes("--write");

function fail(message) {
  console.error(`adopt-visual-baselines: ${message}`);
  process.exit(1);
}

function gitSucceeds(args) {
  try {
    execFileSync("git", args, { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitOutput(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const from = arg("from");
const runId = arg("run-id");
const head = arg("head");
const reviewedBy = arg("reviewed-by");
const reviewedByLogin = arg("reviewed-by-login");

if (!from) fail("--from <dir> is required (the extracted visual-baseline-<run_id> artifact)");
if (!runId || !/^\d+$/.test(runId)) fail("--run-id <digits> is required and must match the artifact name");
if (!head || !/^[0-9a-f]{40}$/.test(head)) fail("--head <sha> must be the full 40-character capture commit");
if (!reviewedBy || !reviewedBy.trim()) {
  fail(
    "--reviewed-by '<display name>' is required — this records a HUMAN review of the six images, so look at them first",
  );
}
const attributionFailure = humanReviewerAttributionFailure({
  login: reviewedByLogin,
  displayName: reviewedBy,
});
if (attributionFailure) fail(attributionFailure);

// The capture commit must be real and reachable, or the provenance describes a
// tree nobody can check the images against.
if (!gitSucceeds(["cat-file", "-e", `${head}^{commit}`])) {
  fail(`--head ${head} is not a commit in this repository`);
}

const candidateSuite = gitOutput(["show", `${head}:${VISUAL_SUITE_FILE}`]);
if (!candidateSuite) fail(`--head ${head} does not contain ${VISUAL_SUITE_FILE}`);
const candidateAwaiting = visualBaselineAwaitingIds(candidateSuite, VISUAL_SUITE_FILE);
if (!candidateAwaiting.valid) {
  fail(`--head ${head} ${VISUAL_SUITE_FILE} AWAITING_BASELINE is invalid: ${candidateAwaiting.failure ?? "unknown"}`);
}
const canonicalAwaiting = [...CANONICAL].sort();
const candidateAwaitingIds = [...candidateAwaiting.ids].sort();
const captureKind =
  JSON.stringify(candidateAwaitingIds) === JSON.stringify(canonicalAwaiting)
    ? "first-adoption"
    : candidateAwaitingIds.length === 0
      ? "refresh"
      : null;
if (!captureKind) {
  fail(
    `--head ${head} AWAITING_BASELINE must be either the canonical six ids (first adoption) or empty (refresh); ` +
      `found ${candidateAwaitingIds.join(", ") || "(none)"}`,
  );
}

const currentSuite = fs.existsSync(path.join(ROOT, VISUAL_SUITE_FILE))
  ? fs.readFileSync(path.join(ROOT, VISUAL_SUITE_FILE), "utf8")
  : null;
const currentAwaiting = currentSuite ? visualBaselineAwaitingIds(currentSuite, VISUAL_SUITE_FILE) : null;
if (!currentAwaiting?.valid) {
  fail(`current ${VISUAL_SUITE_FILE} AWAITING_BASELINE is invalid: ${currentAwaiting?.failure ?? "missing suite"}`);
}
if (captureKind === "first-adoption" && currentAwaiting.ids.length !== 0) {
  fail(
    "first adoption requires the current tree to empty AWAITING_BASELINE in the same commit as the adopted baselines",
  );
}
if (captureKind === "refresh" && currentAwaiting.ids.length !== 0) {
  fail("refresh adoption requires AWAITING_BASELINE to already be empty in the current tree");
}

/**
 * Candidates land in one of several places depending on capture outcome:
 *
 *   - `visual-candidates/` when the target had no baseline at capture time
 *   - Playwright output (`*-actual.png`) when it compared and differed
 *   - `tests/__screenshots__/linux/` inside the artifact when it compared and passed
 *   - the committed baseline in this repository when a partial refresh left the
 *     target unchanged and the artifact carried no replacement image
 *
 * Retained baselines (the last two) are only trusted when visual-junit.xml shows
 * that target passed. The artifact always uploads `tests/__screenshots__/`, even
 * for a target that failed before producing an actual — without the junit gate a
 * partial refresh could silently keep a stale PNG and claim it came from this run.
 */
function findCandidateSource(id) {
  const candidate = path.join(from, "test-results", "visual-candidates", "linux", `${id}.png`);
  if (fs.existsSync(candidate)) return { source: candidate, origin: "candidate" };

  const results = path.join(from, "test-results");
  if (fs.existsSync(results)) {
    // Only Playwright's `*-actual.png` counts as a fresh diff under test-results.
    // A bare `<id>.png` here can be an expected-snapshot copy and must not override
    // a retained baseline for an unchanged target.
    const wanted = `${id}-actual.png`;
    const stack = [results];
    while (stack.length > 0) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name === wanted) return { source: full, origin: "diff" };
      }
    }
  }

  const artifactBaseline = path.join(from, BASELINE_DIR, `${id}.png`);
  if (fs.existsSync(artifactBaseline)) return { source: artifactBaseline, origin: "artifact-baseline" };

  const committedBaseline = path.join(ROOT, BASELINE_DIR, `${id}.png`);
  if (fs.existsSync(committedBaseline)) return { source: committedBaseline, origin: "committed" };

  return null;
}

/**
 * Map canonical baseline ids to pass/fail/skip from the artifact's visual-junit.xml.
 * Missing file or missing case → null (caller decides whether that is fatal).
 */
function readJunitBaselineOutcomes() {
  const junitPath = path.join(from, "test-results", "visual-junit.xml");
  if (!fs.existsSync(junitPath)) return null;
  const xml = fs.readFileSync(junitPath, "utf8");
  const outcomes = new Map();
  const casePattern =
    /<testcase\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/testcase>|<testcase\b[^>]*\bname="([^"]+)"[^>]*\/>/g;
  let match;
  while ((match = casePattern.exec(xml)) !== null) {
    const name = match[1] ?? match[3] ?? "";
    const body = match[2] ?? "";
    const id = CANONICAL.find((candidate) => name.includes(`${candidate} matches its baseline`));
    if (!id) continue;
    if (body.includes("<skipped")) outcomes.set(id, "skipped");
    else if (body.includes("<failure") || body.includes("<error")) outcomes.set(id, "failed");
    else outcomes.set(id, "passed");
  }
  return outcomes;
}

/** Minimal PNG header read — width/height live at a fixed offset in the IHDR chunk. */
function pngSize(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const resolved = [];
const missing = [];
for (const id of CANONICAL) {
  const located = findCandidateSource(id);
  if (!located) {
    missing.push(id);
    continue;
  }
  if (captureKind === "first-adoption" && located.origin === "committed") {
    missing.push(id);
    continue;
  }
  const image = fs.readFileSync(located.source);
  const size = pngSize(image);
  if (!size) fail(`${located.source} is not a PNG`);
  const target = path.join(ROOT, BASELINE_DIR, `${id}.png`);
  const previous = fs.existsSync(target) ? createHash("sha256").update(fs.readFileSync(target)).digest("hex") : null;
  const sha256 = createHash("sha256").update(image).digest("hex");
  resolved.push({
    id,
    source: located.source,
    origin: located.origin,
    image,
    sha256,
    previous,
    ...size,
  });
}

if (missing.length > 0) {
  fail(
    `no candidate image found for: ${missing.join(", ")}. The artifact must contain either ` +
      `test-results/visual-candidates/linux/<id>.png (target was awaiting a baseline), ` +
      `<id>-actual.png under test-results/ (target compared and differed), ` +
      `${BASELINE_DIR}/<id>.png inside the artifact (target compared and passed), or an existing ` +
      `committed baseline when refreshing unchanged targets.`,
  );
}

const replacedCandidateIds = resolved
  .filter((entry) => entry.origin === "candidate" || entry.origin === "diff")
  .map((entry) => entry.id)
  .sort();
const retainedIds = resolved
  .filter((entry) => entry.origin === "artifact-baseline" || entry.origin === "committed")
  .map((entry) => entry.id)
  .sort();

if (captureKind === "refresh" && replacedCandidateIds.length === 0) {
  fail(
    "refresh requires at least one fresh candidate or actual image — refusing an all-green run with nothing to adopt",
  );
}

if (retainedIds.length > 0) {
  const outcomes = readJunitBaselineOutcomes();
  if (!outcomes) {
    fail(
      `retained baselines (${retainedIds.join(", ")}) require test-results/visual-junit.xml in the artifact ` +
        "so each can be confirmed passed rather than assumed from a stale screenshots upload",
    );
  }
  const unproven = retainedIds.filter((id) => outcomes.get(id) !== "passed");
  if (unproven.length > 0) {
    fail(
      `cannot retain baseline(s) without a passing visual-junit result: ${unproven
        .map((id) => `${id}=${outcomes.get(id) ?? "missing"}`)
        .join(", ")}`,
    );
  }
}

const changed = resolved.filter((entry) => entry.sha256 !== entry.previous);
for (const entry of resolved) {
  const state = entry.previous === null ? "NEW" : entry.sha256 === entry.previous ? "unchanged" : "CHANGED";
  const origin = entry.origin === "committed" || entry.origin === "artifact-baseline" ? "retained" : "replaced";
  console.log(
    `${state.padEnd(9)} ${entry.id}  ${entry.width}x${entry.height}  ${entry.sha256.slice(0, 12)}  (${origin})`,
  );
}
console.log(`\n${changed.length} of ${resolved.length} baselines would change.`);
if (captureKind === "refresh") {
  console.log(`Capture kind: refresh (${replacedCandidateIds.length} replaced from artifact).`);
} else {
  console.log("Capture kind: first-adoption.");
}

if (!WRITE) {
  console.log("Dry run. Re-run with --write to update the baselines and provenance.");
  process.exit(0);
}

fs.mkdirSync(path.join(ROOT, BASELINE_DIR), { recursive: true });
for (const entry of resolved) fs.writeFileSync(path.join(ROOT, BASELINE_DIR, `${entry.id}.png`), entry.image);

const provenance = {
  schemaVersion: 2,
  platform: "linux",
  runnerImage: "ubuntu-24.04",
  candidateSourceHead: head,
  capture: {
    kind: captureKind,
    ...(captureKind === "refresh" ? { replacedCandidateIds } : {}),
  },
  source: { kind: "hosted-ci-artifact", runId, artifactName: `visual-baseline-${runId}`, candidateSourceHead: head },
  review: {
    status: "approved",
    reviewerType: "human",
    reviewedBy: reviewedBy.trim(),
    ...(reviewedByLogin?.trim() ? { reviewerLogin: reviewedByLogin.trim() } : {}),
    reviewedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    candidateSourceHead: head,
  },
  candidates: resolved.map(({ id, sha256, width, height }) => ({
    id,
    path: `${BASELINE_DIR}/${id}.png`,
    sha256,
    width,
    height,
  })),
};
fs.writeFileSync(path.join(ROOT, PROVENANCE), `${JSON.stringify(provenance, null, 2)}\n`);

console.log(`\nWrote ${resolved.length} baselines and ${PROVENANCE}.`);
console.log("Next: npm run check:design-system-adoption, then npm run format before committing.");
