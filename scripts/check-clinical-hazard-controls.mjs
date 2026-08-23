#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

const commitStatusCache = new Map();

function validateCommit(errors, commit, label, checkGit) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) {
    errors.push(`${label}: reviewedCommit must be a full commit SHA`);
    return false;
  }
  if (checkGit) {
    if (!commitStatusCache.has(commit)) {
      const exists = gitCheck(["cat-file", "-e", `${commit}^{commit}`]);
      commitStatusCache.set(commit, {
        exists,
        ancestor: exists && gitCheck(["merge-base", "--is-ancestor", commit, "HEAD"]),
      });
    }
    const status = commitStatusCache.get(commit);
    if (!status.exists) {
      errors.push(`${label}: reviewedCommit does not exist ${commit}`);
      return false;
    }
    if (!status.ancestor) {
      errors.push(`${label}: reviewedCommit is not an ancestor of HEAD ${commit}`);
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
  validateCommit(errors, manifest?.reviewedCommit, "manifest", checkGit);
  validateReviewDates(errors, manifest?.reviewedAt, manifest?.reviewExpiresAt, "manifest", today);
  const hazards = Array.isArray(manifest?.hazards) ? manifest.hazards : [];
  const ids = new Set();
  for (const hazard of hazards) {
    const label = hazard?.id ?? "<missing-id>";
    if (ids.has(label)) errors.push(`${label}: duplicate id`);
    ids.add(label);
    if (!states.has(hazard.state)) errors.push(`${label}: invalid state`);
    if (!hazard.owner || !hazard.residualRisk) errors.push(`${label}: owner and residualRisk are required`);
    validateCommit(errors, hazard.reviewedCommit, label, checkGit);
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
        validatePath(errors, path, label, hazard.reviewedCommit, { checkFiles, checkGit });
      }
      for (const testPath of hazard.tests ?? []) {
        if (!/^tests\/.+\.test\.(?:ts|tsx)$/.test(testPath)) errors.push(`${label}: invalid test path ${testPath}`);
      }
      const controlSource = (hazard.controlPaths ?? [])
        .filter((path) => existsSync(resolve(root, path)))
        .map((path) => readFileSync(resolve(root, path), "utf8"))
        .join("\n");
      for (const symbol of hazard.controlSymbols ?? []) {
        if (!new RegExp(`\\b${String(symbol).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`).test(controlSource)) {
          errors.push(`${label}: control symbol ${symbol} not found in controlPaths`);
        }
      }
    }
  }
  for (const id of requiredHazards) if (!ids.has(id)) errors.push(`missing required hazard ${id}`);
  const decisions = Array.isArray(manifest?.assuranceDecisions) ? manifest.assuranceDecisions : [];
  const decisionIds = new Set(decisions.map((item) => item.id));
  for (const decision of decisions) {
    if (!states.has(decision.state) || !decision.owner || !decision.residualRisk)
      errors.push(`${decision.id}: invalid assurance decision`);
    validateCommit(errors, decision.reviewedCommit, decision.id, checkGit);
    if (decision.reviewedCommit !== manifest.reviewedCommit)
      errors.push(`${decision.id}: reviewedCommit must match manifest`);
    validateReviewDates(errors, decision.reviewedAt, decision.reviewExpiresAt, decision.id, today);
    if (!Array.isArray(decision.evidenceReferences) || decision.evidenceReferences.length === 0) {
      errors.push(`${decision.id}: evidenceReferences must be non-empty`);
    }
    if (checkFiles) {
      for (const path of decision.evidenceReferences ?? []) {
        validatePath(errors, path, decision.id, decision.reviewedCommit, { checkFiles, checkGit });
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

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = validateClinicalHazardControls(manifest);
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
