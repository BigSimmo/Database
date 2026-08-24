#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "docs/governance/privacy-readiness.v1.json");
const requiredIds = [
  "PRIV-CODE-QUERY-HASH",
  "PRIV-CODE-DURABLE-ANSWER-MINIMISATION",
  "PRIV-CODE-RAW-QUERY-PERSISTENCE",
  "PRIV-PROVIDER-PRODUCTION-HMAC-SECRET",
  "PRIV-PROVIDER-RETENTION-SCHEDULE-PARITY",
  "PRIV-PROVIDER-OPENAI-ZDR",
  "PRIV-LEGAL-OPENAI-DPA",
  "PRIV-LEGAL-RAILWAY-DPA",
  "PRIV-LEGAL-APP8-CROSS-BORDER-BASIS",
  "PRIV-LEGAL-APP1-APP5-NOTICE",
  "PRIV-CLINICAL-PHI-MINIMISATION",
];
const classes = new Set(["code", "provider", "legal", "clinical"]);
const statuses = new Set(["pending", "partial", "verified", "accepted_decision"]);
const transitions = {
  pending: new Set(["pending", "partial", "verified", "accepted_decision"]),
  partial: new Set(["pending", "partial", "verified", "accepted_decision"]),
  verified: new Set(["pending", "partial", "verified"]),
  accepted_decision: new Set(["accepted_decision"]),
};
const acceptedDecisionRoles = {
  provider: new Set(["Production platform owner", "Privacy engineering owner"]),
  legal: new Set(["Authorised legal signatory", "Privacy adviser"]),
  clinical: new Set(["Clinical safety owner", "Clinical governance authority"]),
};

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

function repositoryPath(reference) {
  if (typeof reference !== "string") return null;
  const file = reference.split("#", 1)[0];
  if (!file || file.includes("\\") || isAbsolute(file)) return null;
  const absolute = resolve(root, file);
  const fromRoot = relative(root, absolute);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  return { file, absolute };
}

function commitExists(commit) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function commitIsAncestor(commit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" });
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

export function validatePrivacyReadiness(
  manifest,
  { release = false, checkFiles = true, checkGit = checkFiles, now = new Date() } = {},
) {
  const errors = [];
  const today = todayIso(now);
  if (manifest?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  const reviewedCommit = manifest?.reviewedCommit ?? "";
  let reviewedCommitExists = false;
  if (!/^[0-9a-f]{40}$/.test(reviewedCommit)) errors.push("reviewedCommit must be a full commit SHA");
  else if (checkGit && !commitExists(reviewedCommit)) errors.push(`reviewedCommit does not exist: ${reviewedCommit}`);
  else {
    reviewedCommitExists = true;
    if (checkGit && !commitIsAncestor(reviewedCommit))
      errors.push(`reviewedCommit is not an ancestor of HEAD: ${reviewedCommit}`);
  }
  if (!validDate(manifest?.reviewedAt) || !validDate(manifest?.reviewExpiresAt))
    errors.push("manifest review dates must be ISO dates");
  if (
    validDate(manifest?.reviewedAt) &&
    validDate(manifest?.reviewExpiresAt) &&
    manifest.reviewExpiresAt < manifest.reviewedAt
  ) {
    errors.push("manifest reviewExpiresAt precedes reviewedAt");
  }
  if (validDate(manifest?.reviewedAt) && manifest.reviewedAt > today)
    errors.push("manifest reviewedAt is in the future");
  if (validDate(manifest?.reviewExpiresAt) && manifest.reviewExpiresAt < today)
    errors.push("manifest review has expired");
  if (!Array.isArray(manifest?.requirements)) errors.push("requirements must be an array");
  const requirements = Array.isArray(manifest?.requirements) ? manifest.requirements : [];
  const ids = new Set();
  for (const item of requirements) {
    const label = item?.id ?? "<missing-id>";
    if (!/^[A-Z0-9-]+$/.test(label)) errors.push(`${label}: invalid id`);
    if (ids.has(label)) errors.push(`${label}: duplicate id`);
    ids.add(label);
    if (!classes.has(item.evidenceClass)) errors.push(`${label}: invalid evidenceClass`);
    if (!statuses.has(item.status)) errors.push(`${label}: invalid status`);
    if (typeof item.accountableRole !== "string" || !item.accountableRole.trim())
      errors.push(`${label}: accountableRole is required`);
    if (!validDate(item.reviewedAt) || !validDate(item.reviewExpiresAt))
      errors.push(`${label}: review dates must be ISO dates`);
    if (validDate(item.reviewedAt) && validDate(item.reviewExpiresAt) && item.reviewExpiresAt < item.reviewedAt) {
      errors.push(`${label}: reviewExpiresAt precedes reviewedAt`);
    }
    if (validDate(item.reviewedAt) && item.reviewedAt > today) errors.push(`${label}: reviewedAt is in the future`);
    if (validDate(item.reviewExpiresAt) && item.reviewExpiresAt < today) errors.push(`${label}: review has expired`);
    if (!Array.isArray(item.evidenceReferences) || item.evidenceReferences.length === 0) {
      errors.push(`${label}: evidenceReferences must be non-empty`);
    } else if (checkFiles) {
      for (const reference of item.evidenceReferences) {
        const resolved = repositoryPath(reference);
        if (!resolved || !existsSync(resolved.absolute)) {
          errors.push(`${label}: missing evidence ${reference}`);
        } else if (checkGit && reviewedCommitExists && !pathExistsAtCommit(reviewedCommit, resolved.file)) {
          errors.push(`${label}: evidence is absent from reviewedCommit ${reference}`);
        }
      }
    }
    if (!Array.isArray(item.statusHistory) || item.statusHistory.length === 0) {
      errors.push(`${label}: statusHistory must be non-empty`);
    } else {
      let previous;
      let previousDate;
      for (const event of item.statusHistory) {
        if (!statuses.has(event.status) || !validDate(event.date)) errors.push(`${label}: invalid statusHistory entry`);
        if (previous && !transitions[previous]?.has(event.status))
          errors.push(`${label}: transition ${previous} -> ${event.status} is not allowed`);
        if (previousDate && event.date < previousDate) errors.push(`${label}: statusHistory dates are not ordered`);
        previous = event.status;
        previousDate = event.date;
      }
      if (previous !== item.status) errors.push(`${label}: current status does not match statusHistory`);
    }
    if (item.status === "verified" && item.evidenceClass !== "code") {
      if (typeof item.externalEvidenceReference !== "string" || !item.externalEvidenceReference.trim()) {
        errors.push(`${label}: verified external evidence requires externalEvidenceReference`);
      }
      if (typeof item.verifiedByRole !== "string" || !item.verifiedByRole.trim()) {
        errors.push(`${label}: verified external evidence requires verifiedByRole`);
      }
    }
    if (item.status === "accepted_decision") {
      const allowedRoles = acceptedDecisionRoles[item.evidenceClass];
      if (!allowedRoles) errors.push(`${label}: ${item.evidenceClass} evidence cannot use accepted_decision`);
      if (!item.decisionReference || !item.acceptedByRole) {
        errors.push(`${label}: accepted_decision requires decisionReference and acceptedByRole`);
      } else {
        if (!allowedRoles?.has(item.acceptedByRole)) {
          errors.push(`${label}: acceptedByRole is not authorised for ${item.evidenceClass} evidence`);
        }
        const decision = repositoryPath(item.decisionReference);
        if (
          !decision ||
          !decision.file.startsWith("docs/governance/") ||
          (checkFiles && !existsSync(decision.absolute))
        ) {
          errors.push(`${label}: decisionReference must be an existing docs/governance record`);
        }
      }
    }
    if (release && !["verified", "accepted_decision"].includes(item.status))
      errors.push(`${label}: release-blocking status ${item.status}`);
  }
  for (const id of requiredIds) if (!ids.has(id)) errors.push(`missing required id ${id}`);
  return errors;
}

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const release = process.argv.includes("--release");
  const errors = validatePrivacyReadiness(manifest, { release });
  if (errors.length) {
    console.error(`PRIVACY_READINESS_FAIL mode=${release ? "release" : "structural"}`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `PRIVACY_READINESS_PASS mode=${release ? "release" : "structural"} requirements=${manifest.requirements.length}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
