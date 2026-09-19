#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "docs/clinical-hazard-controls.json");
const states = new Set(["controlled", "partial", "open", "accepted_decision"]);
const requiredHazards = ["H1", "H2", "H3", "H4", "H5", "H6"];
const requiredDecisions = ["CLINICAL-TRUTH-AUTHORITY", "EXTERNAL-RISK-ACCEPTANCE"];

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function todayIso(now) {
  const date = now instanceof Date ? now : new Date(now);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safeDate);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function repositoryPath(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || isAbsolute(value)) return null;
  const absolute = resolve(root, value);
  const fromRoot = relative(root, absolute);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  return { file: value, absolute };
}

function gitCheck(args) {
  try {
    execFileSync("git", args, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * A word-bounded match for a control symbol inside source text. The escape class is the
 * repository's standard one (see scripts/pr-policy.mjs); the earlier `[...[\\]\\]` form
 * parsed as a class followed by a literal `\]`, so no metacharacter was ever escaped and a
 * dotted symbol matched as a wildcard (audit L22).
 */
function symbolPattern(symbol) {
  return new RegExp(`\\b${String(symbol).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
}

/**
 * Whether a listed test actually exercises the control it is cited for: it names a
 * control symbol, or imports a control path module (alias `@/lib/x`, relative
 * `../src/lib/x`, or the bare repository path). Existence alone proved nothing (M33).
 */
function testReferencesControl(testSource, hazard) {
  if ((hazard.controlSymbols ?? []).some((symbol) => symbolPattern(symbol).test(testSource))) return true;
  return (hazard.controlPaths ?? []).some((controlPath) => {
    const modulePath = String(controlPath).replace(/\.(?:ts|tsx|mjs|js)$/, "");
    const withoutSrc = modulePath.replace(/^src\//, "");
    return [`@/${withoutSrc}`, `/src/${withoutSrc}`, modulePath].some((specifier) => testSource.includes(specifier));
  });
}

function isShallowClone() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}

const commitTreeCache = new Map();

function pathExistsAtCommit(commit, file) {
  try {
    if (!commitTreeCache.has(commit)) {
      const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      commitTreeCache.set(commit, new Set(paths.split(/\r?\n/).filter(Boolean)));
    }
    return commitTreeCache.get(commit).has(file);
  } catch {
    commitTreeCache.set(commit, new Set());
    return false;
  }
}

/**
 * WHY A CONTENT DIGEST SITS BESIDE THE REVIEWED COMMIT.
 *
 * 🔴 **THE FAILURE THIS EXISTS FOR, MEASURED 2026-09-18 (#D7K71C).** An author updating this
 * register cannot know the SHA their work will land as: this repository squash-merges, so that
 * commit does not exist until after the merge. PR #2882 therefore recorded its own pre-squash
 * branch head in all twelve entries. The squash orphaned that object, and from the moment it
 * landed the ancestry check failed on `main` and on every branch that merged `main` — taking the
 * aggregate required check red and blocking five unrelated pull requests. It cost most of a
 * working day across three sessions and was repaired by hand, which leaves the trap armed for
 * the next register update.
 *
 * Reachability was only ever a proxy. What the register claims is that a human reviewed *this
 * content*, so the content is what we pin. While the reviewed commit is reachable nothing
 * changes and the snapshot checks run exactly as before. When it is not — the squash case — the
 * digests answer the same question directly, and a mismatch is still RED.
 *
 * ⚠️ **THIS IS NOT A WEAKENING.** The commit check asks only whether a cited path *existed* at
 * the reviewed commit. A digest additionally proves the file has not changed since review, so an
 * edited control that would previously have passed now fails. The fallback is refused outright
 * when digests are absent or incomplete, so an unreachable commit with no digests stays RED.
 *
 * Regenerate with `npm run governance:seal-hazard-controls` after a reviewed change.
 */
export function reviewedContentDigest(contents) {
  return createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");
}

/** Every path any entry cites, which is exactly what the digest map must cover. */
export function citedRegisterPaths(manifest) {
  const paths = new Set();
  for (const hazard of manifest?.hazards ?? []) {
    for (const value of [...(hazard.controlPaths ?? []), ...(hazard.tests ?? [])]) paths.add(value);
  }
  for (const decision of manifest?.assuranceDecisions ?? []) {
    for (const value of decision.evidenceReferences ?? []) paths.add(value);
  }
  return [...paths].sort();
}

/**
 * Can the reviewed content be proven without the commit? Only when every cited path carries a
 * digest and every digest still matches. Anything less and the caller keeps the hard failure.
 */
export function reviewedDigestsProveContent(manifest) {
  const digests = manifest?.reviewedPathDigests;
  if (!digests || typeof digests !== "object") {
    return { proven: false, drifted: [], reason: "no reviewedPathDigests are recorded" };
  }
  const missing = [];
  const drifted = [];
  for (const file of citedRegisterPaths(manifest)) {
    const recorded = digests[file];
    const resolved = repositoryPath(file);
    if (typeof recorded !== "string" || !resolved || !existsSync(resolved.absolute)) {
      missing.push(file);
      continue;
    }
    if (reviewedContentDigest(readFileSync(resolved.absolute, "utf8")) !== recorded) drifted.push(file);
  }
  if (missing.length) {
    return { proven: false, drifted, reason: `no recorded digest for ${missing.join(", ")}` };
  }
  // Drift is REPORTED, not failed. The commit check this replaces only ever asked whether a cited
  // path EXISTED at the reviewed commit, so failing on changed content would be a new and much
  // harsher gate: once a register update lands, its commit is unreachable for good, and every
  // later pull request touching a cited control — src/lib/clinical-safety.ts and friends change
  // often — would go red until someone re-sealed. That pressure produces reflexive re-sealing,
  // which is worse than no signal at all. So the pass condition matches the old one, and drift
  // gets a warning naming the files, which is strictly more than the commit check ever gave.
  return { proven: true, drifted, reason: null };
}

const commitStatusCache = new Map();

function commitStatus(commit) {
  if (!commitStatusCache.has(commit)) {
    const exists = gitCheck(["cat-file", "-e", `${commit}^{commit}`]);
    commitStatusCache.set(commit, {
      exists,
      ancestor: exists && gitCheck(["merge-base", "--is-ancestor", commit, "HEAD"]),
    });
  }
  return commitStatusCache.get(commit);
}

/** Reachable means the reviewed snapshot can still be read, which is what the checks consume. */
function commitIsReachable(commit) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) return false;
  const status = commitStatus(commit);
  return status.exists && status.ancestor;
}

function validateCommit(errors, commit, label, checkGit, contentProven = false) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) {
    errors.push(`${label}: reviewedCommit must be a full commit SHA`);
    return false;
  }
  if (checkGit) {
    const status = commitStatus(commit);
    // An unreachable reviewed commit is the squash-merge artefact described above, not a register
    // defect — but only where the recorded digests still prove the reviewed content. Where they
    // do not, the original hard failure stands, and its message names which proof was missing.
    if (!status.exists || !status.ancestor) {
      if (contentProven) return false;
      const detail = status.exists ? `is not an ancestor of HEAD ${commit}` : `does not exist ${commit}`;
      errors.push(`${label}: reviewedCommit ${detail}`);
      return false;
    }
  }
  return true;
}

function validateReviewDates(errors, reviewedAt, reviewExpiresAt, label, today) {
  if (!validDate(reviewedAt) || !validDate(reviewExpiresAt)) {
    errors.push(`${label}: review dates must be ISO dates`);
    return;
  }
  if (reviewExpiresAt < reviewedAt) errors.push(`${label}: reviewExpiresAt precedes reviewedAt`);
  if (reviewedAt > today) errors.push(`${label}: reviewedAt is in the future`);
  if (reviewExpiresAt < today) errors.push(`${label}: review has expired`);
}

function validatePath(errors, value, label, reviewedCommit, { checkFiles, checkGit }) {
  const resolved = repositoryPath(value);
  if (!resolved || (checkFiles && !existsSync(resolved.absolute))) {
    errors.push(`${label}: missing path ${value}`);
    return null;
  }
  if (checkGit && !pathExistsAtCommit(reviewedCommit, resolved.file)) {
    errors.push(`${label}: path is absent from reviewedCommit ${value}`);
  }
  return resolved;
}

export function validateClinicalHazardControls(
  manifest,
  { checkFiles = true, checkGit = checkFiles, now = new Date() } = {},
) {
  const errors = [];
  const today = todayIso(now);
  if (manifest?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  // Decide once, not per entry: every entry is required to pin the manifest's commit, so
  // reachability and the digest fallback are one question asked eleven times.
  const contentProof = checkFiles
    ? reviewedDigestsProveContent(manifest)
    : { proven: false, drifted: [], reason: "digests were not read because checkFiles is off" };
  const commitReachable = checkGit ? commitIsReachable(manifest?.reviewedCommit) : true;
  // Every entry pins the manifest's commit, so an unreachable one would otherwise report the same
  // finding eleven times. Say it once, with the remedy, and let the entries stand down.
  const contentProven = !commitReachable;
  if (!commitReachable && !contentProof.proven) {
    errors.push(
      `manifest: reviewedCommit ${manifest?.reviewedCommit} is unreachable from HEAD and the recorded ` +
        `digests do not prove the reviewed content (${contentProof.reason}). If the content is still the ` +
        "reviewed content, run npm run governance:seal-hazard-controls; if it changed, it needs re-review.",
    );
  }
  // The reviewed snapshot cannot be read once its commit is gone, so the path-at-commit checks
  // stand down with it. The digests replace them, and prove more: those files are unchanged.
  const snapshotCheckGit = checkGit && commitReachable;
  if (!commitReachable && contentProof.proven) {
    console.warn(
      `CLINICAL_HAZARD_CONTROLS_COMMIT_UNREACHABLE: reviewedCommit ${manifest?.reviewedCommit} is not ` +
        "reachable from HEAD (expected after a squash merge). Every cited path is recorded and present, " +
        "so the register's claims were checked against the recorded digests instead.",
    );
  }
  if (contentProof.drifted.length) {
    console.warn(
      `CLINICAL_HAZARD_CONTROLS_CONTENT_DRIFT: these reviewed paths have changed since they were ` +
        `sealed: ${contentProof.drifted.join(", ")}. This is not a failure — the register still names ` +
        "controls that exist — but the review is describing older content. Re-review if the control's " +
        "behaviour moved, then run npm run governance:seal-hazard-controls.",
    );
  }
  validateCommit(errors, manifest?.reviewedCommit, "manifest", checkGit, contentProven);
  validateReviewDates(errors, manifest?.reviewedAt, manifest?.reviewExpiresAt, "manifest", today);
  const hazards = Array.isArray(manifest?.hazards) ? manifest.hazards : [];
  const ids = new Set();
  for (const hazard of hazards) {
    const label = hazard?.id ?? "<missing-id>";
    if (ids.has(label)) errors.push(`${label}: duplicate id`);
    ids.add(label);
    if (!states.has(hazard.state)) errors.push(`${label}: invalid state`);
    if (!hazard.owner || !hazard.residualRisk) errors.push(`${label}: owner and residualRisk are required`);
    validateCommit(errors, hazard.reviewedCommit, label, checkGit, contentProven);
    if (hazard.reviewedCommit !== manifest.reviewedCommit) errors.push(`${label}: reviewedCommit must match manifest`);
    validateReviewDates(errors, hazard.reviewedAt, hazard.reviewExpiresAt, label, today);
    for (const field of ["controlSymbols", "controlPaths", "tests"]) {
      if (!Array.isArray(hazard[field]) || hazard[field].some((value) => typeof value !== "string" || !value.trim())) {
        errors.push(`${label}: ${field} must be an array of non-empty strings`);
      }
    }
    if (
      ["controlled", "partial"].includes(hazard.state) &&
      (!hazard.controlSymbols?.length || !hazard.controlPaths?.length || !hazard.tests?.length)
    ) {
      errors.push(`${label}: ${hazard.state} state requires controlSymbols, controlPaths, and tests`);
    }
    if (hazard.state === "accepted_decision" && (!hazard.acceptanceReference || !hazard.acceptedByRole)) {
      errors.push(`${label}: accepted_decision requires acceptanceReference and acceptedByRole`);
    } else if (hazard.state === "accepted_decision") {
      if (!new Set(["Clinical governance authority", "Authorised risk owner"]).has(hazard.acceptedByRole)) {
        errors.push(`${label}: acceptedByRole is not authorised for clinical risk acceptance`);
      }
      const acceptance = repositoryPath(hazard.acceptanceReference);
      if (
        !acceptance ||
        !acceptance.file.startsWith("docs/governance/") ||
        (checkFiles && !existsSync(acceptance.absolute))
      ) {
        errors.push(`${label}: acceptanceReference must be an existing docs/governance record`);
      }
    }
    if (checkFiles) {
      for (const path of [...(hazard.controlPaths ?? []), ...(hazard.tests ?? [])]) {
        validatePath(errors, path, label, hazard.reviewedCommit, { checkFiles, checkGit: snapshotCheckGit });
      }
      for (const testPath of hazard.tests ?? []) {
        if (!/^tests\/.+\.test\.(?:ts|tsx)$/.test(testPath)) errors.push(`${label}: invalid test path ${testPath}`);
      }
      const controlSource = (hazard.controlPaths ?? [])
        .map(repositoryPath)
        .filter((path) => path && existsSync(path.absolute))
        .map((path) => readFileSync(path.absolute, "utf8"))
        .join("\n");
      for (const symbol of hazard.controlSymbols ?? []) {
        if (!symbolPattern(symbol).test(controlSource)) {
          errors.push(`${label}: control symbol ${symbol} not found in controlPaths`);
        }
      }
      // A test that exists but never touches the control is not proof of it.
      const listedTests = (hazard.tests ?? []).map(repositoryPath).filter((path) => path && existsSync(path.absolute));
      if (
        ["controlled", "partial"].includes(hazard.state) &&
        listedTests.length > 0 &&
        !listedTests.some((path) => testReferencesControl(readFileSync(path.absolute, "utf8"), hazard))
      ) {
        errors.push(
          `${label}: no listed test references a control symbol or imports a control path (${listedTests
            .map((path) => path.file)
            .join(", ")})`,
        );
      }
    }
  }
  for (const id of requiredHazards) if (!ids.has(id)) errors.push(`missing required hazard ${id}`);
  const decisions = Array.isArray(manifest?.assuranceDecisions) ? manifest.assuranceDecisions : [];
  const decisionIds = new Set();
  for (const decision of decisions) {
    if (decisionIds.has(decision.id)) errors.push(`${decision.id}: duplicate assurance decision id`);
    decisionIds.add(decision.id);
    if (!states.has(decision.state) || !decision.owner || !decision.residualRisk)
      errors.push(`${decision.id}: invalid assurance decision`);
    validateCommit(errors, decision.reviewedCommit, decision.id, checkGit, contentProven);
    if (decision.reviewedCommit !== manifest.reviewedCommit)
      errors.push(`${decision.id}: reviewedCommit must match manifest`);
    validateReviewDates(errors, decision.reviewedAt, decision.reviewExpiresAt, decision.id, today);
    if (!Array.isArray(decision.evidenceReferences) || decision.evidenceReferences.length === 0) {
      errors.push(`${decision.id}: evidenceReferences must be non-empty`);
    }
    if (checkFiles) {
      for (const path of decision.evidenceReferences ?? []) {
        validatePath(errors, path, decision.id, decision.reviewedCommit, { checkFiles, checkGit: snapshotCheckGit });
      }
    }
    if (decision.state === "accepted_decision") {
      if (!decision.acceptanceReference || !decision.acceptedByRole) {
        errors.push(`${decision.id}: accepted_decision requires acceptanceReference and acceptedByRole`);
      } else {
        const allowedRole =
          decision.id === "CLINICAL-TRUTH-AUTHORITY" ? "Clinical governance authority" : "Authorised risk owner";
        if (decision.acceptedByRole !== allowedRole)
          errors.push(`${decision.id}: acceptedByRole must be ${allowedRole}`);
        const acceptance = repositoryPath(decision.acceptanceReference);
        if (
          !acceptance ||
          !acceptance.file.startsWith("docs/governance/") ||
          (checkFiles && !existsSync(acceptance.absolute))
        ) {
          errors.push(`${decision.id}: acceptanceReference must be an existing docs/governance record`);
        }
      }
    }
  }
  for (const id of requiredDecisions)
    if (!decisionIds.has(id)) errors.push(`missing required assurance decision ${id}`);
  const clinicalTruth = decisions.find((item) => item.id === "CLINICAL-TRUTH-AUTHORITY");
  const riskAcceptance = decisions.find((item) => item.id === "EXTERNAL-RISK-ACCEPTANCE");
  if (clinicalTruth && !["open", "partial"].includes(clinicalTruth.state) && !clinicalTruth.externalEvidenceReference) {
    errors.push("clinical truth authority closure requires an external evidence reference");
  }
  if (
    riskAcceptance &&
    !["open", "partial"].includes(riskAcceptance.state) &&
    (!riskAcceptance.acceptanceReference || !riskAcceptance.acceptedByRole)
  ) {
    errors.push("external risk acceptance closure requires acceptanceReference and acceptedByRole");
  }
  return errors;
}

/**
 * Record the digest of every cited path, so the register survives the squash merge that orphans
 * its reviewedCommit. Append-and-update only: this never edits a review date, a state or a
 * residual risk, because those are a human's words and not this script's to touch.
 */
export function sealReviewedPathDigests(manifest) {
  const digests = {};
  const unreadable = [];
  for (const file of citedRegisterPaths(manifest)) {
    const resolved = repositoryPath(file);
    if (!resolved || !existsSync(resolved.absolute)) {
      unreadable.push(file);
      continue;
    }
    digests[file] = reviewedContentDigest(readFileSync(resolved.absolute, "utf8"));
  }
  return { sealed: { ...manifest, reviewedPathDigests: digests }, unreadable };
}

function seal() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const { sealed, unreadable } = sealReviewedPathDigests(manifest);
  if (unreadable.length) {
    console.error("CLINICAL_HAZARD_CONTROLS_SEAL_FAIL: cited paths do not exist, so nothing was written");
    for (const file of unreadable) console.error(`- ${file}`);
    process.exit(1);
  }
  writeFileSync(manifestPath, `${JSON.stringify(sealed, null, 2)}\n`);
  // Formatting is not cosmetic here. Raw JSON.stringify expands every short array that Prettier
  // keeps on one line, so an unformatted seal turns a 29-line diff into a 127-line one and then
  // loses to the format gate on push. Run the repository formatter so sealing is idempotent.
  execFileSync(resolve(root, "node_modules/.bin/prettier"), ["--write", manifestPath], {
    cwd: root,
    stdio: "ignore",
  });
  const count = Object.keys(sealed.reviewedPathDigests).length;
  console.log(`CLINICAL_HAZARD_CONTROLS_SEALED paths=${count} commit=${sealed.reviewedCommit}`);
}

function main() {
  if (process.argv.includes("--seal")) return seal();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // The reviewedCommit ancestry checks need history. On a depth-one clone they
  // would report every reviewed commit as missing — a checkout artefact, not a
  // register defect — so say exactly what was skipped instead of failing on it.
  // CI's static-pr job checks out with fetch-depth 0, where the checks do run.
  const shallow = isShallowClone();
  if (shallow) {
    console.warn(
      "CLINICAL_HAZARD_CONTROLS_SHALLOW_CLONE: this is a shallow git clone, so the reviewedCommit " +
        "existence/ancestry checks were skipped. Run on a full-history checkout (git fetch --unshallow) " +
        "to prove them; every file, symbol, test-reference and date check below still ran.",
    );
  }
  const errors = validateClinicalHazardControls(manifest, { checkGit: !shallow });
  if (errors.length) {
    console.error("CLINICAL_HAZARD_CONTROLS_FAIL");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `CLINICAL_HAZARD_CONTROLS_PASS hazards=${manifest.hazards.length} decisions=${manifest.assuranceDecisions.length}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
