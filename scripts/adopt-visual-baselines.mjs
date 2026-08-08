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
 *     asserting they looked at the images. A baseline of a broken render silently
 *     blesses the break, and that is exactly what the human-review field in the
 *     provenance contract exists to prevent.
 *
 * Usage:
 *   node scripts/adopt-visual-baselines.mjs \
 *     --from <extracted-artifact-dir> --run-id <id> --head <40-char-sha> \
 *     --reviewed-by "<name>" [--write]
 *
 * Without `--write` it reports what would change and touches nothing.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const BASELINE_DIR = "tests/__screenshots__/linux";
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

const from = arg("from");
const runId = arg("run-id");
const head = arg("head");
const reviewedBy = arg("reviewed-by");

if (!from) fail("--from <dir> is required (the extracted visual-baseline-<run_id> artifact)");
if (!runId || !/^\d+$/.test(runId)) fail("--run-id <digits> is required and must match the artifact name");
if (!head || !/^[0-9a-f]{40}$/.test(head)) fail("--head <sha> must be the full 40-character capture commit");
if (!reviewedBy || !reviewedBy.trim()) {
  fail("--reviewed-by '<name>' is required — this records a HUMAN review of the six images, so look at them first");
}

// The capture commit must be real and reachable, or the provenance describes a
// tree nobody can check the images against.
try {
  execFileSync("git", ["cat-file", "-e", `${head}^{commit}`], { cwd: ROOT, stdio: "ignore" });
} catch {
  fail(`--head ${head} is not a commit in this repository`);
}

/**
 * Candidates land in one of two places depending on whether the target had a
 * baseline at capture time: `visual-candidates/` when it was skipped for want of
 * one, and the Playwright output directory when it was compared and differed.
 * A refresh is the second case, which is why looking only at the first made the
 * script useless for exactly the workflow it exists to serve.
 */
function findCandidate(id) {
  const direct = path.join(from, "test-results", "visual-candidates", "linux", `${id}.png`);
  if (fs.existsSync(direct)) return direct;
  const results = path.join(from, "test-results");
  if (!fs.existsSync(results)) return null;
  const wanted = [`${id}-actual.png`, `${id}.png`];
  const stack = [results];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (wanted.includes(entry.name)) return full;
    }
  }
  return null;
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
  const source = findCandidate(id);
  if (!source) {
    missing.push(id);
    continue;
  }
  const image = fs.readFileSync(source);
  const size = pngSize(image);
  if (!size) fail(`${source} is not a PNG`);
  const target = path.join(ROOT, BASELINE_DIR, `${id}.png`);
  const previous = fs.existsSync(target) ? createHash("sha256").update(fs.readFileSync(target)).digest("hex") : null;
  const sha256 = createHash("sha256").update(image).digest("hex");
  resolved.push({ id, source, image, sha256, previous, ...size });
}

if (missing.length > 0) {
  fail(
    `no candidate image found for: ${missing.join(", ")}. The artifact must contain either ` +
      `test-results/visual-candidates/linux/<id>.png (target was awaiting a baseline) or ` +
      `<id>-actual.png under test-results/ (target compared and differed).`,
  );
}

const changed = resolved.filter((entry) => entry.sha256 !== entry.previous);
for (const entry of resolved) {
  const state = entry.previous === null ? "NEW" : entry.sha256 === entry.previous ? "unchanged" : "CHANGED";
  console.log(`${state.padEnd(9)} ${entry.id}  ${entry.width}x${entry.height}  ${entry.sha256.slice(0, 12)}`);
}
console.log(`\n${changed.length} of ${resolved.length} baselines would change.`);

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
  source: { kind: "hosted-ci-artifact", runId, artifactName: `visual-baseline-${runId}`, candidateSourceHead: head },
  review: {
    status: "approved",
    reviewerType: "human",
    reviewedBy: reviewedBy.trim(),
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
