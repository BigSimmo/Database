#!/usr/bin/env node

/**
 * Ward Flow compact-chat control.
 *
 * This tool is local-only. It validates the fixed role contract, creates
 * content-addressed assignments, handovers and reset certificates, manages
 * atomic local role leases, and renders a recreation prompt. It never commits,
 * merges, fetches, pushes, or contacts a provider.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, hostname, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECEIPT_FORMAT_VERSION, receiptKey } from "../gate-receipts.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
export const controlDirectory = path.join(repositoryRoot, "docs", "ward-flow", "control");
export const handoverDirectory = path.join(controlDirectory, "handovers");
const promptDirectory = path.join(controlDirectory, "prompts");
const HANDOVER_SUFFIX = ".handover.json";
const CERTIFICATE_SUFFIX = ".reset.json";
const ASSIGNMENT_SUFFIX = ".assignment.json";
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTANCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const ROLE_IDS = ["lead", "builder", "verifier"];
const TASK_STATUSES = ["complete", "blocked", "parked", "idle"];
const INTEGRATION_STATUSES = ["integrated", "parked", "not-required"];
const AUDIT_FIELDS = [
  "decisionsCaptured",
  "workCaptured",
  "questionsCaptured",
  "evidenceCaptured",
  "uncommittedWorkCaptured",
  "noUniqueChatContentRemaining",
];
const PRIVACY_FIELDS = ["syntheticOnly", "noSecrets", "noPatientData"];
const CLAUDE_EVENT_TYPES = new Set([
  "agent-name",
  "assistant",
  "atis-latch",
  "attachment",
  "bridge-session",
  "custom-title",
  "last-prompt",
  "mode",
  "pr-link",
  "queue-operation",
  "system",
  "user",
]);
const BANNED_ACTIVE_TERMS = [
  "Ward Orchestrator",
  "Ward Core",
  "Ward Decisions",
  "Ward Referrals",
  "Ward Board",
  "ListAgents",
  "SendMessage",
];

function fail(message) {
  const error = new Error(message);
  error.code = "ward-flow-chat-control";
  throw error;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requireString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    fail(`${label} must be a${allowEmpty ? "" : " non-empty"} string`);
  }
  return value;
}

function requireNullableSha(value, label) {
  if (value !== null && (typeof value !== "string" || !SHA_PATTERN.test(value))) {
    fail(`${label} must be null or a full lowercase 40-character commit SHA`);
  }
}

function normalizeRepositoryPath(value) {
  requireString(value, "repository path");
  const withSlashes = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(withSlashes) || path.win32.isAbsolute(value)) {
    fail(`repository path must be relative: ${value}`);
  }
  const normalized = withSlashes.replace(/\/+$/, "");
  const segments = normalized.split("/");
  if (normalized.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail(`repository path must not contain empty or dot segments: ${value}`);
  }
  return normalized;
}

function repositoryPathIdentity(value) {
  const normalized = normalizeRepositoryPath(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathIsInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function localPathIdentity(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function readContainedRegularFile(checkoutRoot, candidate, label) {
  const rootRealPath = realpathSync(path.resolve(checkoutRoot));
  const candidateAbsolute = path.resolve(candidate);
  const metadata = lstatSync(candidateAbsolute);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    fail(`${label} must be a single-link regular file, not a symlink, hard link or special filesystem entry`);
  }
  const candidateRealPath = realpathSync(candidateAbsolute);
  if (!pathIsInside(rootRealPath, candidateRealPath)) {
    fail(`${label} resolves outside the recorded checkout`);
  }
  return readFileSync(candidateRealPath);
}

function defaultClaudeLogRoot() {
  return path.join(homedir(), ".claude", "projects");
}

/** Recursively sort object keys so equivalent records converge on identical bytes. */
export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

export function canonicalJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function handoverRelativePath(record) {
  return path.posix.join(
    "docs",
    "ward-flow",
    "control",
    "handovers",
    `${sha256(canonicalJson(record))}${HANDOVER_SUFFIX}`,
  );
}

function assignmentRelativePath(record) {
  return path.posix.join(
    "docs",
    "ward-flow",
    "control",
    "assignments",
    `${sha256(canonicalJson(record))}${ASSIGNMENT_SUFFIX}`,
  );
}

function certificateRelativePath(record) {
  return path.posix.join(
    "docs",
    "ward-flow",
    "control",
    "certificates",
    `${sha256(canonicalJson(record))}${CERTIFICATE_SUFFIX}`,
  );
}

function readJson(filePath, label = filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Node's default maxBuffer is 1 MiB, and this helper reads whole committed blobs back out of Git.
// Chat-export envelopes pass that on their own — five of the six committed on 2026-08-31 are between
// 1.7 MB and 2.6 MB — so the default turned every current-truth inventory build into
// `spawnSync git ENOBUFS`, an error that names the buffer and not the evidence it failed to read.
// The ceiling exists to catch runaway output, so keep one, well above any plausible envelope.
const GIT_OUTPUT_LIMIT_BYTES = 512 * 1024 * 1024;

function git(args, { cwd = repositoryRoot, encoding = "utf8" } = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
  });
}

function gitStatusEntries(root = repositoryRoot) {
  const output = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root });
  const tokens = output.split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const status = token.slice(0, 2);
    const sourcePath = normalizeRepositoryPath(token.slice(3));
    let originalPath = null;
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      if (index >= tokens.length) fail(`Git status omitted the original path for ${status} ${sourcePath}`);
      originalPath = normalizeRepositoryPath(tokens[index]);
    }
    entries.push({ status, path: sourcePath, originalPath });
  }
  return entries;
}

function gitStatus(root = repositoryRoot) {
  return gitStatusEntries(root).map(
    (entry) => `${entry.status} ${entry.path}${entry.originalPath ? ` <- ${entry.originalPath}` : ""}`,
  );
}

function fullSha(ref, root = repositoryRoot) {
  const value = git(["rev-parse", "--verify", `${ref}^{commit}`], { cwd: root }).trim();
  if (!SHA_PATTERN.test(value)) fail(`could not resolve ${ref} to a full commit SHA`);
  return value;
}

function refExists(ref, root = repositoryRoot) {
  const result = spawnSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function isAncestor(ancestor, descendant, root = repositoryRoot) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  fail(result.stderr?.trim() || `could not compare ${ancestor} with ${descendant}`);
}

function diffChanges(base, head, root = repositoryRoot) {
  if (!refExists(base, root) || !refExists(head, root)) return [];
  const output = git(["diff", "--name-status", "--no-renames", `${base}..${head}`], { cwd: root });
  return output
    .replaceAll("\r", "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("\t");
      if (separator < 1) fail(`could not parse git diff status line ${line}`);
      return {
        status: line.slice(0, separator),
        path: normalizeRepositoryPath(line.slice(separator + 1)),
      };
    });
}

function headFile(relative, root = repositoryRoot, { ref = "HEAD", encoding = "utf8" } = {}) {
  return git(["show", `${ref}:${normalizeRepositoryPath(relative)}`], { cwd: root, encoding });
}

function pathExistsAtRef(relative, ref = "HEAD", root = repositoryRoot) {
  const result = spawnSync("git", ["cat-file", "-e", `${ref}:${normalizeRepositoryPath(relative)}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function gitCommonDirectory(root = repositoryRoot) {
  const common = git(["rev-parse", "--git-common-dir"], { cwd: root }).trim();
  return path.resolve(root, common);
}

function repositoryWorktreeRoots(root = repositoryRoot) {
  return git(["worktree", "list", "--porcelain"], { cwd: root })
    .replaceAll("\r", "")
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));
}

function pathIsIndependentOfRepository(candidate, root = repositoryRoot) {
  const absolute = path.resolve(candidate);
  if (pathIsInside(gitCommonDirectory(root), absolute)) return false;
  return repositoryWorktreeRoots(root).every((worktree) => !pathIsInside(worktree, absolute));
}

function readIndependentRegularFile(candidate, root, label) {
  const absolute = path.resolve(candidate);
  const metadata = lstatSync(absolute);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    fail(`${label} must be a single-link regular file, not a symlink, hard link or special filesystem entry`);
  }
  const real = realpathSync(absolute);
  if (!pathIsIndependentOfRepository(real, root)) {
    fail(`${label} resolves inside a repository checkout or the shared Git directory`);
  }
  return { bytes: readFileSync(real), realPath: real };
}

function leaseDirectory(root = repositoryRoot) {
  return path.join(gitCommonDirectory(root), "ward-flow-chat-control");
}

function activeLeasePath(role, root = repositoryRoot) {
  return path.join(leaseDirectory(root), "active", `${role}.lease.json`);
}

function withLeaseAcquisitionLock(root, action) {
  const directory = leaseDirectory(root);
  const lockPath = path.join(directory, "acquire.lock.json");
  const owner = {
    schemaVersion: 1,
    kind: "ward-flow-lease-acquisition-lock",
    host: hostname(),
    processId: process.pid,
    token: randomUUID(),
  };
  mkdirSync(directory, { recursive: true });
  let acquired = false;
  let observedOwner = null;
  for (let attempt = 0; attempt < 200 && !acquired; attempt += 1) {
    try {
      writeFileSync(lockPath, canonicalJson(owner), { encoding: "utf8", flag: "wx" });
      acquired = true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let existing;
      try {
        existing = JSON.parse(readFileSync(lockPath, "utf8"));
        observedOwner = existing;
      } catch {
        fail(`lease acquisition lock is unreadable at ${lockPath}; inspect it rather than bypassing custody`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  if (!acquired) {
    fail(
      `Ward Flow lease acquisition is blocked by ${observedOwner?.host ?? "unknown host"} process ` +
        `${observedOwner?.processId ?? "unknown"} at ${lockPath}; the tool never deletes a possibly replaced lock`,
    );
  }
  try {
    return action();
  } finally {
    try {
      const existing = JSON.parse(readFileSync(lockPath, "utf8"));
      if (existing.token === owner.token) rmSync(lockPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function readActiveLease(role, root = repositoryRoot) {
  const leasePath = activeLeasePath(role, root);
  if (!existsSync(leasePath)) return null;
  const bytes = readFileSync(leasePath, "utf8");
  const lease = JSON.parse(bytes);
  if (bytes !== canonicalJson(lease)) fail(`active ${role} lease is not canonical JSON`);
  if (
    lease.schemaVersion !== 1 ||
    lease.kind !== "ward-flow-chat-lease" ||
    lease.role !== role ||
    !INSTANCE_PATTERN.test(lease.instanceId) ||
    !Number.isInteger(lease.generation) ||
    lease.generation < 1
  ) {
    fail(`active ${role} lease is invalid`);
  }
  if (role === "verifier" && !SHA_PATTERN.test(lease.targetSha)) fail("active verifier lease targetSha is invalid");
  if (role !== "verifier" && lease.targetSha !== null) fail(`active ${role} lease targetSha must be null`);
  if (role === "builder" && typeof lease.assignment !== "string") fail("active Builder lease requires an assignment");
  if (role !== "builder" && lease.assignment !== null) fail(`active ${role} lease assignment must be null`);
  // Symmetric with the assignment check above, and the reason it exists is in
  // `loadCommittedCriterion`. Read with `?? null` so a lease written before this field existed is
  // still valid rather than being invalidated retroactively — the Lead lease held while this landed
  // is exactly such a lease, and failing it closed would have locked the running chat out of its
  // own role.
  const leaseCriterion = lease.criterion ?? null;
  if (role === "verifier") {
    if (
      !isObject(leaseCriterion) ||
      typeof leaseCriterion.path !== "string" ||
      !SHA256_PATTERN.test(String(leaseCriterion.sha256 ?? ""))
    ) {
      fail("active Verifier lease requires a committed criterion; a target SHA alone is not a task");
    }
  } else if (leaseCriterion !== null) {
    fail(`active ${role} lease criterion must be null`);
  }
  if (!SHA_PATTERN.test(lease.head)) fail(`active ${role} lease head is invalid`);
  requireString(lease.branch, `active ${role} lease branch`);
  requireString(lease.worktree, `active ${role} lease worktree`);
  if (
    lease.previousHandover !== null &&
    (typeof lease.previousHandover !== "string" || !lease.previousHandover.endsWith(HANDOVER_SUFFIX))
  ) {
    fail(`active ${role} lease previousHandover is invalid`);
  }
  if (Number.isNaN(new Date(lease.acquiredAt).getTime())) fail(`active ${role} lease acquiredAt is invalid`);
  const ownedPaths = requireArray(lease.ownedPaths, `active ${role} lease ownedPaths`);
  for (const [index, ownedPath] of ownedPaths.entries()) {
    requireString(ownedPath, `active ${role} lease ownedPaths[${index}]`);
    if (path.isAbsolute(ownedPath) || normalizeRepositoryPath(ownedPath).startsWith("../")) {
      fail(`active ${role} lease ownedPaths[${index}] must be repository-relative`);
    }
  }
  if (role === "verifier" && ownedPaths.length > 0) fail("active Verifier lease cannot own product paths");
  return { lease, leasePath, sha256: sha256(bytes) };
}

/**
 * WHAT A WARD VERIFIER IS ACTUALLY BEING ASKED TO DECIDE.
 *
 * ⚠️ **THIS EXISTS BECAUSE THE ROLE THAT REFUSES TO TAKE CLAIMS ON TRUST WAS THE ONLY ROLE WHOSE OWN
 * TASK COULD REACH IT SOLELY BY THE ONE CHANNEL THIS SYSTEM DECLARES UNTRUSTWORTHY.** Ward Builder
 * has always received a committed, content-addressed assignment, and its lease carries
 * `assignment` so a handover can be checked against it. Ward Verifier received `--target-sha` and
 * nothing else. A SHA says WHICH commit to decide and is silent on WHAT is being decided, what
 * would falsify it, and which check settles it.
 *
 * Found by the Ward Verifier of 2026-08-31, in its own retirement handover, from having lived it:
 * that chat sat unable to produce a verdict for the whole first half of its life because its
 * criterion existed only in a chat message, while `validate` reported 0 assignments throughout and
 * Ward Lead reasonably believed it had been tasked. A successful send is not evidence of receipt,
 * and the control README already says a message does not transfer custody — the Verifier was simply
 * the one role the rule was never enforced for.
 *
 * The record must be COMMITTED under the control evidence path and must carry both halves: what
 * would make the answer yes, and what would make it no. A criterion with no falsifier is a wish.
 */
export function loadCommittedCriterion(relative, state, root = repositoryRoot) {
  const normalized = normalizeRepositoryPath(requireString(relative, "verification criterion path"));
  if (!normalized.startsWith("docs/ward-flow/control/evidence/")) {
    fail("verification criterion must be committed under docs/ward-flow/control/evidence/");
  }
  const ref = state.integrationBranch;
  if (!pathExistsAtRef(normalized, ref, root)) {
    fail(`verification criterion ${normalized} is not committed on ${ref}`);
  }
  const bytes = headFile(normalized, root, { ref, encoding: "buffer" });
  const text = bytes.toString("utf8");
  const record = JSON.parse(text);
  if (text !== canonicalJson(record)) fail("verification criterion is not canonical JSON");
  if (record.schemaVersion !== 1 || record.kind !== "ward-flow-verification-criterion") {
    fail("verification criterion identity is invalid");
  }
  requireString(record.acceptanceCriterion, "verification criterion acceptanceCriterion");
  requireString(record.falsifier, "verification criterion falsifier");
  requireString(record.focusedCheck, "verification criterion focusedCheck");
  return { relative: normalized, sha256: sha256(bytes) };
}

/**
 * @param {{
 *   role: string,
 *   instanceId: string,
 *   generation: number,
 *   snapshot: { branch: string, worktree: string, head: string },
 *   handover?: { relative: string } | null,
 *   assignment?: { relative: string } | null,
 *   criterion?: { relative: string, sha256: string } | null,
 *   targetSha?: string | null,
 *   ownedPaths?: readonly string[],
 * }} input
 * @param {string} [root]
 *
 * Typed here because the destructured defaults are all `null`, so a caller passing a real target
 * SHA or criterion was reported as assigning to `null | undefined`. Two of those errors predate this
 * field and two arrived with it; annotating the shape clears all four rather than adding a third
 * pair to a known-red file.
 */
export function acquireLease(
  {
    role,
    instanceId,
    generation,
    snapshot,
    handover,
    assignment = null,
    criterion = null,
    targetSha = null,
    ownedPaths = [],
  },
  root = repositoryRoot,
) {
  if (!INSTANCE_PATTERN.test(instanceId)) {
    fail("recreate requires --session-id with 3-80 letters, digits, dots, underscores or hyphens");
  }
  const lease = {
    schemaVersion: 1,
    kind: "ward-flow-chat-lease",
    role,
    instanceId,
    generation,
    acquiredAt: new Date().toISOString(),
    branch: snapshot.branch,
    worktree: snapshot.worktree,
    head: snapshot.head,
    previousHandover: handover?.relative ?? null,
    assignment: assignment?.relative ?? null,
    criterion: criterion === null ? null : { path: criterion.relative, sha256: criterion.sha256 },
    targetSha,
    ownedPaths: ownedPaths.map(normalizeRepositoryPath),
  };
  return withLeaseAcquisitionLock(root, () => {
    const active = readActiveLease(role, root);
    if (active) {
      fail(
        `${role} is already leased to ${active.lease.instanceId} generation ${active.lease.generation}; ` +
          "certify that chat's reset before creating any replacement, even with the same session ID",
      );
    }
    for (const otherRole of ROLE_IDS.filter((candidate) => candidate !== role)) {
      const other = readActiveLease(otherRole, root);
      if (!other) continue;
      if (localPathIdentity(other.lease.worktree) === localPathIdentity(lease.worktree)) {
        fail(`${role} cannot lease the worktree already held by ${otherRole} ${other.lease.instanceId}`);
      }
      const overlaps = lease.ownedPaths.filter((candidate) =>
        other.lease.ownedPaths.some((otherPath) => pathsOverlap(candidate, otherPath)),
      );
      if (overlaps.length > 0) {
        fail(
          `${role} cannot lease paths already held by ${otherRole} ${other.lease.instanceId}: ${overlaps.join(", ")}`,
        );
      }
    }
    const leasePath = activeLeasePath(role, root);
    mkdirSync(path.dirname(leasePath), { recursive: true });
    try {
      writeFileSync(leasePath, canonicalJson(lease), { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const raced = readActiveLease(role, root);
      fail(
        `${role} is already leased to ${raced.lease.instanceId} generation ${raced.lease.generation}; ` +
          "certify that chat's reset before creating any replacement, even with the same session ID",
      );
    }
    return readActiveLease(role, root);
  });
}

function retireLease(record, root = repositoryRoot) {
  const active = readActiveLease(record.role, root);
  if (!active) fail(`no active ${record.role} lease exists for reset retirement`);
  if (active.lease.instanceId !== record.instanceId || active.lease.generation !== record.roleGeneration) {
    fail("active role lease does not match the handover instance and generation");
  }
  const history = path.join(
    leaseDirectory(root),
    "history",
    record.role,
    `${String(record.roleGeneration).padStart(6, "0")}-${record.instanceId}-${active.sha256}.lease.json`,
  );
  mkdirSync(path.dirname(history), { recursive: true });
  if (existsSync(history)) fail(`retired lease history already exists at ${history}`);
  renameSync(active.leasePath, history);
}

export function collectRepositorySnapshot(root = repositoryRoot) {
  const branch = git(["branch", "--show-current"], { cwd: root }).trim();
  return {
    branch: branch || "DETACHED",
    head: fullSha("HEAD", root),
    status: gitStatus(root),
    worktree: path.resolve(root).replaceAll("\\", "/"),
  };
}

export function validateRolesContract(contract) {
  requireObject(contract, "roles contract");
  if (contract.schemaVersion !== 1) fail("roles contract schemaVersion must be 1");
  if (contract.systemId !== "ward-flow-compact-multichat") fail("roles contract systemId is invalid");
  if (contract.maxPersistentChats !== 3) fail("maxPersistentChats must be exactly 3");
  const modes = requireObject(contract.modes, "roles contract modes");
  const recovery = requireArray(modes.recovery, "roles contract recovery mode");
  const steady = requireArray(modes["steady-state"], "roles contract steady-state mode");
  if (JSON.stringify(recovery) !== JSON.stringify(["lead", "verifier"])) {
    fail("recovery mode must activate only lead and verifier");
  }
  if (JSON.stringify(steady) !== JSON.stringify(ROLE_IDS)) {
    fail("steady-state mode must activate lead, builder and verifier in that order");
  }
  const truth = requireObject(contract.truthContract, "truth contract");
  for (const [field, expected] of Object.entries({
    chatMemoryIsAuthority: false,
    messagesTransferCustody: false,
    durableRecordsAreRequired: true,
    humanClinicalDecisionsRemainHuman: true,
  })) {
    if (truth[field] !== expected) fail(`truth contract ${field} must be ${expected}`);
  }
  const modelPolicy = requireObject(contract.subagentModelPolicy, "subagent model policy");
  const aliases = requireObject(modelPolicy.modelAliases, "subagent model aliases");
  if (aliases.judgment !== "opus" || aliases.mechanical !== "sonnet") {
    fail("subagent model aliases must route judgement to Opus and mechanical work to Sonnet");
  }
  if (modelPolicy.default !== "explicit-classification-required") {
    fail("subagent model policy must require explicit classification instead of inherited-model fallback");
  }
  const expectedOpusVetoes = [
    "clinical, legal, privacy or patient-facing judgement is involved",
    "the subagent is the final unchecked reviewer or must assess correctness",
    "the task changes test strength or mutation coverage, specifications, plans, briefs or decision records",
    "the failure is unknown or the implementation needs an unbriefed design decision",
  ];
  const expectedSonnetRequirements = [
    "the task is mechanical and fully specified",
    "a named gate, test, type error, build failure or visible screen will catch a wrong result",
    "the brief names exact files, symbols, ordered steps and the decisive check",
    "a parent or Opus reviewer will inspect the resulting diff or evidence",
  ];
  if (
    JSON.stringify(requireArray(modelPolicy.opusRequiredWhen, "Opus vetoes")) !== JSON.stringify(expectedOpusVetoes)
  ) {
    fail("subagent model policy must preserve the complete Opus veto list");
  }
  if (
    JSON.stringify(requireArray(modelPolicy.sonnetAllowedOnlyWhen, "Sonnet requirements")) !==
    JSON.stringify(expectedSonnetRequirements)
  ) {
    fail("subagent model policy must preserve the complete Sonnet catcher and brief requirements");
  }
  if (
    modelPolicy.sonnetExtractionException !==
    "Read-only list, count and locate tasks may use Sonnet when the brief names exact sources and output and a parent inspects the evidence; assessment remains Opus."
  ) {
    fail("subagent model policy must preserve the bounded read-only Sonnet extraction exception");
  }
  const adaptiveRules = requireObject(modelPolicy.adaptiveRules, "subagent adaptive model rules");
  if (adaptiveRules.firstOfShape !== "opus" || adaptiveRules.thirdAttemptAfterTwoSonnetReviewRejections !== "opus") {
    fail("subagent model policy must escalate first-of-shape and third-attempt work to Opus");
  }
  if (modelPolicy.sonnetStopRule !== "If you reach a decision this brief does not cover, stop and hand it back.") {
    fail("subagent model policy must preserve the Sonnet stop-and-handoff rule");
  }
  if (
    modelPolicy.reviewRule !==
    "Prefer a Sonnet draft followed by Opus review when mechanical work still feeds a judgement-bearing result."
  ) {
    fail("subagent model policy must preserve Opus review for judgement-bearing results");
  }
  if (modelPolicy.dispatchSummaryRequirement !== "State the model tier and routing reason in every dispatch summary.") {
    fail("subagent model policy must record the model tier in every dispatch summary");
  }
  const roles = requireArray(contract.roles, "roles contract roles");
  if (roles.length !== 3) fail("roles contract must define exactly three roles");
  if (JSON.stringify(roles.map((role) => role.id)) !== JSON.stringify(ROLE_IDS)) {
    fail("roles must be lead, builder and verifier in that order");
  }
  const lead = roles[0];
  const builder = roles[1];
  const verifier = roles[2];
  if (
    lead.persistentChatModel !== "opus" ||
    builder.persistentChatModel !== "assignment-dependent" ||
    verifier.persistentChatModel !== "opus"
  ) {
    fail("persistent role models must be Opus for Lead and Verifier and assignment-dependent for Builder");
  }
  if (lead.integrationAuthority !== "sole" || lead.productWrites !== "integration-worktree-only") {
    fail("Ward Lead must be the sole integration authority and use only the integration worktree");
  }
  if (builder.integrationAuthority !== "none" || builder.productWrites !== "assigned-paths-on-isolated-branch") {
    fail("Ward Builder must have no integration authority and only assigned-path writes");
  }
  if (
    verifier.integrationAuthority !== "none" ||
    verifier.productWrites !== "forbidden" ||
    verifier.independentVerification !== true
  ) {
    fail("Ward Verifier must have no integration authority, remain independent and forbid product writes");
  }
  if (roles.filter((role) => role.integrationAuthority === "sole").length !== 1) {
    fail("roles contract must define exactly one sole integration authority");
  }
  for (const role of roles) {
    requireString(role.title, `role ${role.id} title`);
    requireString(role.purpose, `role ${role.id} purpose`);
    if (role.maxActiveTasks !== 1) fail(`role ${role.id} must have maxActiveTasks 1`);
    requireArray(role.must, `role ${role.id} must`);
    requireArray(role.mustNot, `role ${role.id} mustNot`);
  }
  return contract;
}

export function validateSystemState(state, contract) {
  requireObject(state, "system state");
  if (state.schemaVersion !== 1) fail("system state schemaVersion must be 1");
  if (!Object.hasOwn(contract.modes, state.mode)) fail(`unsupported system mode ${state.mode}`);
  const expected = contract.modes[state.mode];
  const active = requireArray(state.activeRoles, "system state activeRoles");
  if (JSON.stringify(active) !== JSON.stringify(expected)) {
    fail(`activeRoles must exactly match mode ${state.mode}`);
  }
  if (state.soleIntegrationRole !== "lead") fail("soleIntegrationRole must be lead");
  requireString(state.integrationBranch, "system state integrationBranch");
  if (!SHA_PATTERN.test(state.integrationBase)) fail("system state integrationBase must be a full commit SHA");
  requireString(state.sourceSnapshot, "system state sourceSnapshot");
  const activationGate = requireObject(state.builderActivationGate, "system state builderActivationGate");
  requireString(activationGate.instruction, "system state builderActivationGate instruction");
  const requiredEvidence = requireArray(
    activationGate.requiredEvidence,
    "system state builderActivationGate requiredEvidence",
  );
  if (JSON.stringify(requiredEvidence) !== JSON.stringify(["recovery-bundle", "current-truth", "control-plane"])) {
    fail("builderActivationGate requiredEvidence must name recovery-bundle, current-truth and control-plane");
  }
  const transitionEvidence = requireArray(state.transitionEvidence, "system state transitionEvidence");
  for (const [index, receipt] of transitionEvidence.entries()) {
    requireObject(receipt, `system state transitionEvidence[${index}]`);
    if (!requiredEvidence.includes(receipt.id)) fail(`unsupported transition evidence id ${receipt.id}`);
    requireString(receipt.path, `system state transitionEvidence[${index}] path`);
    if (!SHA256_PATTERN.test(receipt.sha256)) {
      fail(`system state transitionEvidence[${index}] sha256 must be 64 lowercase hex characters`);
    }
  }
  if (state.mode === "steady-state") {
    if (!SHA_PATTERN.test(state.activationSnapshot)) {
      fail("steady-state mode requires a full activationSnapshot commit SHA");
    }
    const provided = transitionEvidence.map((receipt) => receipt.id);
    if (JSON.stringify(provided) !== JSON.stringify(requiredEvidence)) {
      fail("steady-state transitionEvidence must name each required receipt exactly once in gate order");
    }
  } else if (state.activationSnapshot !== null) fail("recovery mode activationSnapshot must be null");
  const updated = new Date(state.updatedAt);
  if (Number.isNaN(updated.getTime())) fail("system state updatedAt must be an ISO timestamp");
  return state;
}

function validateTask(task, role) {
  requireObject(task, "handover task");
  requireString(task.id, "handover task id");
  if (!TASK_STATUSES.includes(task.status)) fail(`unsupported task status ${task.status}`);
  requireString(task.objective, "handover task objective");
  if (!SHA_PATTERN.test(task.baseSha)) fail("handover task baseSha must be a full commit SHA");
  const ownedPaths = requireArray(task.ownedPaths, "handover task ownedPaths");
  for (const [index, ownedPath] of ownedPaths.entries()) {
    requireString(ownedPath, `handover task ownedPaths[${index}]`);
    if (path.isAbsolute(ownedPath) || normalizeRepositoryPath(ownedPath).startsWith("../")) {
      fail(`handover task ownedPaths[${index}] must be repository-relative`);
    }
  }
  requireNullableSha(task.completionCommit, "handover task completionCommit");
  if (task.status === "complete" && task.completionCommit === null) {
    fail("a complete task requires completionCommit");
  }
  if (role === "builder") {
    requireString(task.assignmentPath, "Builder handover task assignmentPath");
    if (!normalizeRepositoryPath(task.assignmentPath).startsWith("docs/ward-flow/control/assignments/")) {
      fail("Builder assignmentPath must be under docs/ward-flow/control/assignments/");
    }
  } else if (task.assignmentPath !== null) {
    fail(`${role} handover task assignmentPath must be null`);
  }
  if (role === "verifier") {
    if (!SHA_PATTERN.test(task.verificationTarget)) {
      fail("Verifier handover task verificationTarget must be a full commit SHA");
    }
  } else if (task.verificationTarget !== null) {
    fail(`${role} handover task verificationTarget must be null`);
  }
}

function validateEvidenceItem(item, label, { verifier = false } = {}) {
  requireObject(item, label);
  if (!["passed", "failed", "blocked", "unrun"].includes(item.outcome)) {
    fail(`${label} outcome must be passed, failed, blocked or unrun`);
  }
  requireString(item.decisiveEvidence, `${label} decisiveEvidence`);
  if (verifier) {
    if (!SHA_PATTERN.test(item.targetSha)) fail(`${label} targetSha must be a full commit SHA`);
    requireString(item.acceptanceCriterion, `${label} acceptanceCriterion`);
    requireString(item.falsifier, `${label} falsifier`);
    requireString(item.action, `${label} action`);
  }
}

function validateContent(content, role, task) {
  requireObject(content, "handover content");
  requireString(content.summary, "handover content summary");
  for (const field of [
    "decisions",
    "completedWork",
    "pendingWork",
    "questions",
    "evidence",
    "risks",
    "subagentDispatches",
  ]) {
    requireArray(content[field], `handover content ${field}`);
  }
  requireString(content.nextAction, "handover content nextAction");
  if (task.status === "complete" && content.completedWork.length === 0) {
    fail("a complete task requires at least one completedWork item");
  }
  if (task.status === "complete" && content.evidence.length === 0) {
    fail("a complete task requires at least one evidence item");
  }
  for (const [index, item] of content.evidence.entries()) {
    validateEvidenceItem(item, `handover content evidence[${index}]`, { verifier: role === "verifier" });
    if (role === "verifier" && item.targetSha !== task.verificationTarget) {
      fail(`handover content evidence[${index}] targetSha must match the Verifier task target`);
    }
  }
  for (const [index, dispatch] of content.subagentDispatches.entries()) {
    const label = `handover content subagentDispatches[${index}]`;
    requireObject(dispatch, label);
    requireString(dispatch.task, `${label} task`);
    if (!new Set(["opus", "sonnet"]).has(dispatch.modelTier)) {
      fail(`${label} modelTier must be opus or sonnet`);
    }
    requireString(dispatch.routingReason, `${label} routingReason`);
    if (!new Set(["completed", "blocked", "rejected"]).has(dispatch.outcome)) {
      fail(`${label} outcome must be completed, blocked or rejected`);
    }
    requireString(dispatch.decisiveEvidence, `${label} decisiveEvidence`);
    if (typeof dispatch.reviewedByParent !== "boolean") fail(`${label} reviewedByParent must be boolean`);
    if (dispatch.modelTier === "sonnet") {
      if (dispatch.reviewedByParent !== true) fail(`${label} Sonnet result must be reviewed by its parent`);
      if (dispatch.stopRuleIncluded !== true) fail(`${label} Sonnet brief must include the stop-and-handoff rule`);
      const catcher = requireObject(dispatch.catcher, `${label} catcher`);
      if (
        !new Set(["gate", "test", "type-error", "build", "visible-screen", "extraction-spot-check"]).has(catcher.kind)
      ) {
        fail(`${label} catcher kind is invalid`);
      }
      requireString(catcher.reference, `${label} catcher reference`);
    } else if (dispatch.catcher !== null) {
      fail(`${label} Opus catcher must be null`);
    }
  }
}

function validateIntegration(integration, role, task, state) {
  requireObject(integration, "handover integration");
  if (!INTEGRATION_STATUSES.includes(integration.status)) {
    fail(`unsupported integration status ${integration.status}`);
  }
  requireNullableSha(integration.commit, "handover integration commit");
  requireString(integration.targetBranch, "handover integration targetBranch");
  if (integration.targetBranch !== state.integrationBranch) {
    fail(`integration targetBranch must be the configured integration branch ${state.integrationBranch}`);
  }
  if (role === "builder") {
    if (task.status === "complete" && integration.status !== "integrated") {
      fail("a completed Builder task must be integrated before reset");
    }
    if (integration.status === "integrated" && integration.commit === null) {
      fail("an integrated Builder handover requires the target integration commit");
    }
    if (integration.status === "not-required") {
      fail("Ward Builder must have an integrated or durably parked disposition");
    }
    if (integration.status === "parked") {
      const checkpoint = requireObject(integration.durableCheckpoint, "parked Builder durableCheckpoint");
      if (!["commit", "artifact"].includes(checkpoint.kind)) {
        fail("parked Builder durableCheckpoint kind must be commit or artifact");
      }
      requireString(checkpoint.ref, "parked Builder durableCheckpoint ref");
      requireNullableSha(checkpoint.commit, "parked Builder durableCheckpoint commit");
      if (!SHA256_PATTERN.test(checkpoint.sha256)) {
        fail("parked Builder durableCheckpoint sha256 must be 64 lowercase hex characters");
      }
      if (checkpoint.kind === "commit") {
        if (!checkpoint.ref.startsWith("refs/heads/") || checkpoint.commit === null) {
          fail("a commit checkpoint requires a refs/heads/... ref and full commit SHA");
        }
      } else {
        const normalized = normalizeRepositoryPath(checkpoint.ref);
        if (
          checkpoint.commit !== null ||
          !normalized.startsWith("docs/ward-flow/control/parked/") ||
          path.isAbsolute(checkpoint.ref)
        ) {
          fail("an artifact checkpoint requires a repository path under docs/ward-flow/control/parked/");
        }
      }
    }
  } else {
    if (integration.status === "parked") fail(`${role} cannot use the Builder parked disposition`);
    if (role === "verifier" && integration.status !== "not-required") {
      fail("Ward Verifier integration status must be not-required");
    }
  }
}

function validateAudit(audit, label, fields) {
  requireObject(audit, label);
  for (const field of fields) {
    if (audit[field] !== true) fail(`${label} ${field} must be true`);
  }
}

function assertNoSensitiveMaterial(value) {
  const serialized = JSON.stringify(value);
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{12,}/,
    /\bghp_[A-Za-z0-9]{12,}/,
    /\bgithub_pat_[A-Za-z0-9_]{12,}/,
    /\b(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL)\s*=/i,
    /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  ];
  if (patterns.some((pattern) => pattern.test(serialized))) {
    fail("handover appears to contain a secret or credential; remove it before recording");
  }
}

export function validateHandoverDraft(draft, contract, state) {
  requireObject(draft, "handover draft");
  if (draft.schemaVersion !== 1) fail("handover draft schemaVersion must be 1");
  if (!ROLE_IDS.includes(draft.role)) fail(`unsupported handover role ${draft.role}`);
  if (!state.activeRoles.includes(draft.role)) fail(`role ${draft.role} is inactive in ${state.mode} mode`);
  requireString(draft.sessionLabel, "handover sessionLabel");
  if (!["context-reset", "chat-deletion", "replacement", "normal-handoff"].includes(draft.reason)) {
    fail(`unsupported handover reason ${draft.reason}`);
  }
  validateTask(draft.task, draft.role);
  validateContent(draft.content, draft.role, draft.task);
  validateIntegration(draft.integration, draft.role, draft.task, state);
  validateAudit(draft.contentAudit, "contentAudit", AUDIT_FIELDS);
  validateAudit(draft.privacyAudit, "privacyAudit", PRIVACY_FIELDS);
  assertNoSensitiveMaterial(draft);
  return draft;
}

function pathIsOwned(changedPath, ownedPaths) {
  const changed = repositoryPathIdentity(changedPath);
  return ownedPaths.some((candidate) => {
    const owned = repositoryPathIdentity(candidate);
    return changed === owned || changed.startsWith(`${owned}/`);
  });
}

export function pathsOverlap(first, second) {
  const a = repositoryPathIdentity(first);
  const b = repositoryPathIdentity(second);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/**
 * @param {string} role
 * @param {unknown} task
 * @param {readonly (string | { status?: string | null, path: string })[]} changedPaths
 * @param {{ extraAllowedPaths?: readonly string[] }} [options]
 *
 * `extraAllowedPaths` defaults to a bare `[]`, which TypeScript infers as `never[]` - so no
 * caller could ever pass a path into it and the signature was simply wrong. Annotated rather
 * than cast at the call sites, because the defect is here.
 */
export function validateRoleDiff(role, task, changedPaths, { extraAllowedPaths = [] } = {}) {
  const changes = changedPaths.map((change) =>
    typeof change === "string"
      ? { status: null, path: normalizeRepositoryPath(change) }
      : { status: change.status, path: normalizeRepositoryPath(change.path) },
  );
  if (role === "verifier") {
    const appendOnlyPrefixes = [
      "docs/ward-flow/control/evidence/",
      "docs/ward-flow/control/handovers/",
      "docs/ward-flow/control/certificates/",
    ];
    const productChanges = changes.filter(
      (change) => !appendOnlyPrefixes.some((prefix) => change.path.startsWith(prefix)),
    );
    if (productChanges.length > 0) {
      fail(`Ward Verifier changed non-control paths: ${productChanges.map((change) => change.path).join(", ")}`);
    }
    const nonAdditions = changes.filter((change) => change.status !== "A");
    if (nonAdditions.length > 0) {
      fail(
        "Ward Verifier control records must be append-only additions: " +
          nonAdditions.map((change) => `${change.status ?? "unknown"} ${change.path}`).join(", "),
      );
    }
    return;
  }
  const allowed = [...task.ownedPaths, ...extraAllowedPaths];
  const outside = changes.map((change) => change.path).filter((changedPath) => !pathIsOwned(changedPath, allowed));
  if (outside.length > 0) fail(`${role} changed paths outside its task ownership: ${outside.join(", ")}`);
}

export function buildHandoverRecord({ draft, snapshot, lease, previousHandover = null, now = () => new Date() }) {
  if (!lease) fail("building a handover requires the active role lease");
  return {
    schemaVersion: 1,
    kind: "ward-flow-chat-handover",
    createdAt: now().toISOString(),
    role: draft.role,
    roleGeneration: lease.lease.generation,
    instanceId: lease.lease.instanceId,
    leaseSha256: lease.sha256,
    previousHandover,
    sessionLabel: draft.sessionLabel,
    reason: draft.reason,
    source: snapshot,
    task: draft.task,
    content: draft.content,
    integration: draft.integration,
    contentAudit: draft.contentAudit,
    privacyAudit: draft.privacyAudit,
  };
}

export function validateHandoverRecord(record, { relativePath } = {}) {
  requireObject(record, "handover record");
  if (record.schemaVersion !== 1 || record.kind !== "ward-flow-chat-handover") {
    fail("handover record identity is invalid");
  }
  const createdAt = new Date(record.createdAt);
  if (Number.isNaN(createdAt.getTime())) fail("handover createdAt must be an ISO timestamp");
  if (!Number.isInteger(record.roleGeneration) || record.roleGeneration < 1) {
    fail("handover roleGeneration must be a positive integer");
  }
  if (!INSTANCE_PATTERN.test(record.instanceId)) fail("handover instanceId is invalid");
  if (!SHA256_PATTERN.test(record.leaseSha256)) fail("handover leaseSha256 must be 64 lowercase hex characters");
  if (
    record.previousHandover !== null &&
    (typeof record.previousHandover !== "string" || !record.previousHandover.endsWith(HANDOVER_SUFFIX))
  ) {
    fail("handover previousHandover must be null or a handover path");
  }
  requireObject(record.source, "handover source");
  requireString(record.source.branch, "handover source branch");
  if (!SHA_PATTERN.test(record.source.head)) fail("handover source head must be a full commit SHA");
  requireArray(record.source.status, "handover source status");
  if (record.source.status.length !== 0) fail("handover source must record a clean worktree");
  requireString(record.source.worktree, "handover source worktree");
  const syntheticState = {
    activeRoles: ROLE_IDS,
    mode: "record-validation",
    integrationBranch: record.integration?.targetBranch,
  };
  validateHandoverDraft(
    {
      schemaVersion: 1,
      role: record.role,
      sessionLabel: record.sessionLabel,
      reason: record.reason,
      task: record.task,
      content: record.content,
      integration: record.integration,
      contentAudit: record.contentAudit,
      privacyAudit: record.privacyAudit,
    },
    {},
    syntheticState,
  );
  if (relativePath && normalizeRepositoryPath(relativePath) !== handoverRelativePath(record)) {
    fail(`handover path does not match its content hash: expected ${handoverRelativePath(record)}`);
  }
  return record;
}

export function writeHandoverRecord(record, root = repositoryRoot) {
  const relative = handoverRelativePath(record);
  const target = path.join(root, ...relative.split("/"));
  const body = canonicalJson(record);
  mkdirSync(path.dirname(target), { recursive: true });
  try {
    writeFileSync(target, body, { encoding: "utf8", flag: "wx" });
    return { relative, target, disposition: "created" };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = readFileSync(target, "utf8");
    if (existing !== body) fail("content-addressed handover path already has different bytes");
    return { relative, target, disposition: "existing" };
  }
}

function writeContentAddressedRecord(record, relative, root = repositoryRoot) {
  const target = path.join(root, ...relative.split("/"));
  const body = canonicalJson(record);
  mkdirSync(path.dirname(target), { recursive: true });
  try {
    writeFileSync(target, body, { encoding: "utf8", flag: "wx" });
    return { relative, target, disposition: "created" };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    if (readFileSync(target, "utf8") !== body) fail(`content-addressed path ${relative} has different bytes`);
    return { relative, target, disposition: "existing" };
  }
}

function validateAssignmentRecord(record, { relativePath } = {}) {
  requireObject(record, "Builder assignment");
  if (record.schemaVersion !== 1 || record.kind !== "ward-flow-builder-assignment") {
    fail("Builder assignment identity is invalid");
  }
  if (!INSTANCE_PATTERN.test(record.issuedByInstance)) fail("Builder assignment issuer instance is invalid");
  if (!SHA_PATTERN.test(record.issuedAtHead)) fail("Builder assignment issuedAtHead must be a full commit SHA");
  requireString(record.taskId, "Builder assignment taskId");
  requireString(record.objective, "Builder assignment objective");
  if (!SHA_PATTERN.test(record.baseSha)) fail("Builder assignment baseSha must be a full commit SHA");
  requireString(record.branch, "Builder assignment branch");
  requireString(record.worktree, "Builder assignment worktree");
  const ownedPaths = requireArray(record.ownedPaths, "Builder assignment ownedPaths");
  if (ownedPaths.length === 0) fail("Builder assignment must own at least one path");
  for (const [index, ownedPath] of ownedPaths.entries()) {
    requireString(ownedPath, `Builder assignment ownedPaths[${index}]`);
    const normalized = normalizeRepositoryPath(ownedPath);
    if (path.isAbsolute(ownedPath) || normalized.startsWith("../") || normalized === "") {
      fail(`Builder assignment ownedPaths[${index}] must be repository-relative`);
    }
    if (normalized === "docs/ward-flow/control" || normalized.startsWith("docs/ward-flow/control/")) {
      fail("Builder may not own the control plane");
    }
  }
  const symbols = requireArray(record.symbols, "Builder assignment symbols");
  if (symbols.length === 0) fail("Builder assignment must name at least one exact symbol");
  for (const [index, symbol] of symbols.entries()) {
    requireString(symbol, `Builder assignment symbols[${index}]`);
  }
  const steps = requireArray(record.steps, "Builder assignment steps");
  if (steps.length === 0) fail("Builder assignment must name at least one ordered implementation step");
  for (const [index, step] of steps.entries()) {
    requireString(step, `Builder assignment steps[${index}]`);
  }
  requireString(record.acceptanceCriterion, "Builder assignment acceptanceCriterion");
  requireString(record.falsifier, "Builder assignment falsifier");
  requireString(record.focusedCheck, "Builder assignment focusedCheck");
  validateAssignmentModelRouting(record.modelRouting, record.focusedCheck);
  if (relativePath && normalizeRepositoryPath(relativePath) !== assignmentRelativePath(record)) {
    fail(`Builder assignment path does not match its content hash: expected ${assignmentRelativePath(record)}`);
  }
  return record;
}

function validateAssignmentModelRouting(candidate, focusedCheck) {
  const routing = requireObject(candidate, "Builder assignment modelRouting");
  if (!new Set(["opus", "sonnet"]).has(routing.tier)) {
    fail("Builder assignment modelRouting tier must be opus or sonnet");
  }
  requireString(routing.reason, "Builder assignment modelRouting reason");
  requireString(routing.taskShape, "Builder assignment modelRouting taskShape");
  let catcher = null;
  if (routing.catcher !== null) {
    catcher = requireObject(routing.catcher, "Builder assignment modelRouting catcher");
    if (!new Set(["gate", "test", "type-error", "build", "visible-screen"]).has(catcher.kind)) {
      fail("Builder assignment modelRouting catcher kind must be gate, test, type-error, build or visible-screen");
    }
    requireString(catcher.reference, "Builder assignment modelRouting catcher reference");
    if (catcher.reference !== focusedCheck) {
      fail("Builder assignment modelRouting catcher reference must exactly match focusedCheck");
    }
  }
  if (typeof routing.firstOfShape !== "boolean") {
    fail("Builder assignment modelRouting firstOfShape must be boolean");
  }
  if (!Number.isInteger(routing.priorSonnetReviewRejections) || routing.priorSonnetReviewRejections < 0) {
    fail("Builder assignment modelRouting priorSonnetReviewRejections must be a non-negative integer");
  }
  const vetoes = requireObject(routing.vetoes, "Builder assignment modelRouting vetoes");
  const vetoFields = [
    "clinicalLegalPrivacyOrPatientFacing",
    "finalUncheckedOrJudgementCriterion",
    "testStrengthOrMutation",
    "unknownCauseDebugging",
    "specPlanBriefOrDecisionRecord",
  ];
  for (const field of vetoFields) {
    if (typeof vetoes[field] !== "boolean") fail(`Builder assignment modelRouting veto ${field} must be boolean`);
  }
  if (routing.tier === "sonnet") {
    if (Object.values(vetoes).some((value) => value === true)) {
      fail("Sonnet Builder assignment may not have an Opus veto");
    }
    if (routing.firstOfShape) fail("the first Builder task of a shape must use Opus");
    if (routing.priorSonnetReviewRejections >= 2) {
      fail("the third attempt after two Sonnet review rejections must use Opus");
    }
    if (catcher === null) fail("Sonnet Builder assignment requires a named mechanical catcher");
  }
  return routing;
}

function validateAssignmentDraft(draft) {
  requireObject(draft, "Builder assignment draft");
  if (draft.schemaVersion !== 1) fail("Builder assignment draft schemaVersion must be 1");
  const record = {
    schemaVersion: 1,
    kind: "ward-flow-builder-assignment",
    issuedByInstance: "placeholder-instance",
    issuedAtHead: "0".repeat(40),
    taskId: draft.taskId,
    objective: draft.objective,
    baseSha: draft.baseSha,
    branch: draft.branch,
    worktree: draft.worktree,
    ownedPaths: draft.ownedPaths,
    symbols: draft.symbols,
    steps: draft.steps,
    acceptanceCriterion: draft.acceptanceCriterion,
    falsifier: draft.falsifier,
    focusedCheck: draft.focusedCheck,
    modelRouting: draft.modelRouting,
  };
  validateAssignmentRecord(record);
  return draft;
}

function loadCommittedJson(relative, root = repositoryRoot, ref = "HEAD") {
  const normalized = normalizeRepositoryPath(relative);
  if (!pathExistsAtRef(normalized, ref, root)) fail(`${normalized} is not committed at ${ref}`);
  const bytes = headFile(normalized, root, { ref });
  const record = JSON.parse(bytes);
  if (bytes !== canonicalJson(record)) fail(`${normalized} is not canonical JSON at ${ref}`);
  return record;
}

export function loadCommittedAssignment(relative, state, root = repositoryRoot) {
  const normalized = normalizeRepositoryPath(relative);
  const record = loadCommittedJson(normalized, root, state.integrationBranch);
  validateAssignmentRecord(record, { relativePath: normalized });
  assertPathIntroducedAlone(normalized, state.integrationBranch, "Builder assignment", root);
  return { relative: normalized, record };
}

function validateBuilderTaskAgainstAssignment(task, assignment) {
  const expected = assignment.record;
  if (
    task.id !== expected.taskId ||
    task.objective !== expected.objective ||
    task.baseSha !== expected.baseSha ||
    JSON.stringify(task.ownedPaths.map(normalizeRepositoryPath)) !==
      JSON.stringify(expected.ownedPaths.map(normalizeRepositoryPath)) ||
    normalizeRepositoryPath(task.assignmentPath) !== assignment.relative
  ) {
    fail("Builder handover task does not exactly match its committed Lead-issued assignment");
  }
}

function loadControl(root = repositoryRoot) {
  const contract = validateRolesContract(readJson(path.join(root, "docs", "ward-flow", "control", "roles.json")));
  const state = validateSystemState(
    readJson(path.join(root, "docs", "ward-flow", "control", "system-state.json")),
    contract,
  );
  return { contract, state };
}

function listHandoverPaths(root = repositoryRoot, { committedOnly = false, ref = "HEAD" } = {}) {
  if (committedOnly) {
    const output = git(["ls-tree", "-r", "--name-only", ref, "--", "docs/ward-flow/control/handovers"], {
      cwd: root,
    });
    return output
      .replaceAll("\r", "")
      .split("\n")
      .filter((entry) => entry.endsWith(HANDOVER_SUFFIX));
  }
  const directory = path.join(root, "docs", "ward-flow", "control", "handovers");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(HANDOVER_SUFFIX))
    .sort()
    .map((name) => path.posix.join("docs", "ward-flow", "control", "handovers", name));
}

function loadHandover(relative, root = repositoryRoot, { committedOnly = false, ref = "HEAD" } = {}) {
  const normalized = normalizeRepositoryPath(relative);
  const bytes = committedOnly
    ? headFile(normalized, root, { ref })
    : readFileSync(path.join(root, ...normalized.split("/")), "utf8");
  const record = JSON.parse(bytes);
  if (bytes !== canonicalJson(record)) fail(`${relative} is not canonical JSON`);
  return validateHandoverRecord(record, { relativePath: relative });
}

export function latestHandover(role, root = repositoryRoot, { committedOnly = true, ref = "HEAD" } = {}) {
  const matches = listHandoverPaths(root, { committedOnly, ref })
    .map((relative) => ({ relative, record: loadHandover(relative, root, { committedOnly, ref }) }))
    .filter(({ record }) => record.role === role)
    .sort((a, b) => a.record.roleGeneration - b.record.roleGeneration);
  return matches.at(-1) ?? null;
}

function validateActiveControlLanguage(root = repositoryRoot) {
  const activeFiles = [
    path.join(root, "docs", "ward-flow", "control", "README.md"),
    ...ROLE_IDS.map((role) => path.join(root, "docs", "ward-flow", "control", "prompts", `${role}.md`)),
  ];
  for (const activeFile of activeFiles) {
    const body = readFileSync(activeFile, "utf8");
    const found = BANNED_ACTIVE_TERMS.filter((term) => body.includes(term));
    if (found.length > 0) fail(`${path.relative(root, activeFile)} contains retired role terms: ${found.join(", ")}`);
  }
}

function validateHandoverChains(entries) {
  for (const role of ROLE_IDS) {
    const chain = entries
      .filter(({ record }) => record.role === role)
      .sort((a, b) => a.record.roleGeneration - b.record.roleGeneration);
    let previous = null;
    for (const [index, entry] of chain.entries()) {
      const expectedGeneration = index + 1;
      if (entry.record.roleGeneration !== expectedGeneration) {
        fail(`${role} handover chain expected generation ${expectedGeneration}, found ${entry.record.roleGeneration}`);
      }
      const expectedPrevious = previous ? previous.relative : null;
      if (entry.record.previousHandover !== expectedPrevious) {
        fail(`${role} handover generation ${expectedGeneration} does not point to its immediate predecessor`);
      }
      previous = entry;
    }
  }
}

function objectExists(objectId, root = repositoryRoot) {
  const result = spawnSync("git", ["cat-file", "-e", `${objectId}^{object}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

export function verifyRecoveryBundleGate({ gate, evidence, state, bundleBytes, root = repositoryRoot }) {
  const independentBundlePath = path.resolve(
    requireString(gate.independentBundlePath, "recovery-bundle independentBundlePath"),
  );
  if (!path.isAbsolute(gate.independentBundlePath) || !existsSync(independentBundlePath)) {
    fail("recovery-bundle independentBundlePath must exist outside every checkout and the shared Git directory");
  }
  const independent = readIndependentRegularFile(independentBundlePath, root, "recovery-bundle independent copy");
  if (!independent.bytes.equals(bundleBytes)) {
    fail("recovery-bundle independent copy does not match the committed bundle bytes");
  }
  const restoreCheckout = path.resolve(requireString(gate.restoreCheckout, "recovery-bundle restoreCheckout"));
  if (!path.isAbsolute(gate.restoreCheckout) || !existsSync(restoreCheckout)) {
    fail("recovery-bundle restoreCheckout must be an existing absolute path");
  }
  const restoreInside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: restoreCheckout,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (restoreInside.status !== 0 || restoreInside.stdout.trim() !== "true") {
    fail("recovery-bundle restoreCheckout is not a Git worktree");
  }
  if (gitCommonDirectory(restoreCheckout) === gitCommonDirectory(root)) {
    fail("recovery-bundle restoreCheckout must use an independent Git object database");
  }
  if (!SHA_PATTERN.test(gate.restoreHead) || gate.restoreHead !== evidence.sourceSha) {
    fail("recovery-bundle restoreHead must equal the receipt sourceSha");
  }
  if (fullSha("HEAD", restoreCheckout) !== gate.restoreHead) {
    fail("recovery-bundle restoreCheckout HEAD does not match restoreHead");
  }
  const requiredObjects = requireArray(gate.requiredObjects, "recovery-bundle requiredObjects");
  if (
    requiredObjects.length < 2 ||
    requiredObjects.some((objectId) => typeof objectId !== "string" || !SHA_PATTERN.test(objectId)) ||
    !requiredObjects.includes(evidence.sourceSha) ||
    !requiredObjects.includes(state.integrationBase)
  ) {
    fail("recovery-bundle requiredObjects must include full sourceSha and integrationBase commit IDs");
  }
  for (const objectId of new Set(requiredObjects)) {
    if (!objectExists(objectId, restoreCheckout)) {
      fail(`recovery-bundle restoreCheckout is missing required object ${objectId}`);
    }
  }
  const bundleRef = requireString(gate.bundleRef, "recovery-bundle bundleRef");
  if (!bundleRef.startsWith("refs/heads/") || bundleRef.length === "refs/heads/".length) {
    fail("recovery-bundle bundleRef must be a full refs/heads/... name");
  }
  const temporary = mkdtempSync(path.join(tmpdir(), "ward-flow-bundle-verify-"));
  const bundleFile = path.join(temporary, "recovery.bundle");
  try {
    writeFileSync(bundleFile, bundleBytes);
    const verified = spawnSync("git", ["bundle", "verify", bundleFile], {
      cwd: restoreCheckout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (verified.status !== 0) {
      fail(`recovery-bundle failed git bundle verify: ${verified.stderr.trim() || verified.stdout.trim()}`);
    }
    const heads = git(["bundle", "list-heads", bundleFile], { cwd: restoreCheckout })
      .replaceAll("\r", "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(" ");
        return { sha: line.slice(0, separator), ref: line.slice(separator + 1) };
      });
    if (!heads.some((entry) => entry.sha === evidence.sourceSha && entry.ref === bundleRef)) {
      fail("recovery-bundle does not advertise sourceSha at the recorded bundleRef");
    }
    const emptyRestore = path.join(temporary, "empty-restore");
    const cloned = spawnSync(
      "git",
      ["clone", "--branch", bundleRef.slice("refs/heads/".length), bundleFile, emptyRestore],
      {
        cwd: temporary,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (cloned.status !== 0) {
      fail(
        "recovery-bundle cannot restore into an empty repository without external objects: " +
          (cloned.stderr.trim() || cloned.stdout.trim()),
      );
    }
    if (fullSha("HEAD", emptyRestore) !== evidence.sourceSha) {
      fail("recovery-bundle empty restore HEAD does not equal sourceSha");
    }
    for (const objectId of new Set(requiredObjects)) {
      if (!objectExists(objectId, emptyRestore)) {
        fail(`recovery-bundle empty restore is missing required object ${objectId}`);
      }
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function gitWardDocuments(ref, root = repositoryRoot) {
  const output = git(["ls-tree", "-r", ref, "--", "docs"], { cwd: root });
  return output
    .replaceAll("\r", "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/.exec(line);
      if (!match) fail(`could not parse source inventory tree entry ${line}`);
      return { mode: match[1], type: match[2], objectId: match[3], path: normalizeRepositoryPath(match[4]) };
    })
    .filter((entry) => entry.path.toLowerCase().includes("ward") && !entry.path.startsWith("docs/ward-flow/control/"));
}

function verifiedEvidenceBytes(relative, expectedSha256, ref, label, root = repositoryRoot) {
  const normalized = normalizeRepositoryPath(requireString(relative, `${label} path`));
  if (!normalized.startsWith("docs/ward-flow/control/evidence/")) {
    fail(`${label} must be committed under docs/ward-flow/control/evidence/`);
  }
  const expected = String(expectedSha256).toLowerCase();
  if (!SHA256_PATTERN.test(expected)) fail(`${label} SHA-256 is invalid`);
  if (!pathExistsAtRef(normalized, ref, root)) fail(`${label} is not committed at ${ref}`);
  const bytes = headFile(normalized, root, { ref, encoding: "buffer" });
  if (sha256(bytes) !== expected) fail(`${label} hash does not match committed bytes`);
  return { normalized, bytes };
}

export function assertCheckoutMatchesSnapshot(source, status, sourceId) {
  const checkout = path.resolve(requireString(source.checkout, `${sourceId} checkout`));
  if (!path.isAbsolute(source.checkout) || !existsSync(checkout)) {
    fail(`${sourceId} checkout must be an existing absolute path`);
  }
  const topLevel = git(["rev-parse", "--show-toplevel"], { cwd: checkout }).trim();
  if (localPathIdentity(realpathSync(topLevel)) !== localPathIdentity(realpathSync(checkout))) {
    fail(`${sourceId} checkout does not resolve to the recorded Git worktree root`);
  }
  const actualBranch = git(["branch", "--show-current"], { cwd: checkout }).trim() || "DETACHED";
  const expectedBranch = requireString(source.branch, `${sourceId} branch`);
  if (actualBranch !== expectedBranch) {
    fail(`${sourceId} checkout branch drifted: expected ${expectedBranch}, found ${actualBranch}`);
  }
  const expectedHead = requireString(source.head, `${sourceId} head`);
  if (!SHA_PATTERN.test(expectedHead)) fail(`${sourceId} head must be a full commit SHA`);
  const actualHead = fullSha("HEAD", checkout);
  if (actualHead !== expectedHead) {
    fail(`${sourceId} checkout HEAD drifted: expected ${expectedHead}, found ${actualHead}`);
  }
  const expectedTracked = [...requireArray(status?.tracked ?? [], `${sourceId} tracked status`)].sort();
  const expectedUntracked = status?.untrackedCount ?? source.untrackedCount ?? 0;
  if (!Number.isInteger(expectedUntracked) || expectedUntracked < 0) fail(`${sourceId} untrackedCount is invalid`);
  const actualEntries = gitStatusEntries(checkout);
  const actualTracked = actualEntries
    .filter((entry) => entry.status !== "??")
    .map((entry) => `${entry.status} ${entry.path}${entry.originalPath ? ` <- ${entry.originalPath}` : ""}`)
    .sort();
  const actualUntrackedPaths = actualEntries
    .filter((entry) => entry.status === "??")
    .map((entry) => entry.path)
    .sort();
  if (
    canonicalJson(actualTracked) !== canonicalJson(expectedTracked) ||
    actualUntrackedPaths.length !== expectedUntracked
  ) {
    fail(`${sourceId} checkout status drifted from the source snapshot`);
  }
  return {
    checkout,
    branch: actualBranch,
    head: actualHead,
    tracked: actualTracked,
    untrackedPaths: actualUntrackedPaths,
  };
}

export function durableDirtyArtifactManifest(
  source,
  status,
  sourceSha,
  sourceId,
  root = repositoryRoot,
  { artifactEvidencePaths = new Set() } = {},
) {
  const tracked = requireArray(status?.tracked ?? [], `${sourceId} tracked status`);
  const untrackedCount = status?.untrackedCount ?? source.untrackedCount ?? 0;
  if (!Number.isInteger(untrackedCount) || untrackedCount < 0) fail(`${sourceId} untrackedCount is invalid`);
  if (tracked.length === 0 && untrackedCount === 0) return null;
  const manifestPath = requireString(source.artifactManifestPath, `${sourceId} artifactManifestPath`);
  const manifestSha256 = requireString(
    source.artifactManifestSha256,
    `${sourceId} artifactManifestSha256`,
  ).toLowerCase();
  const { normalized, bytes } = verifiedEvidenceBytes(
    manifestPath,
    manifestSha256,
    sourceSha,
    `${sourceId} artifact manifest`,
    root,
  );
  const text = bytes.toString("utf8");
  const manifest = JSON.parse(text);
  if (text !== canonicalJson(manifest)) fail(`${sourceId} artifact manifest is not canonical JSON`);
  if (
    manifest.schemaVersion !== 1 ||
    manifest.kind !== "ward-flow-dirty-artifact-manifest" ||
    manifest.sourceId !== sourceId ||
    manifest.head !== source.head
  ) {
    fail(`${sourceId} artifact manifest identity does not match the source snapshot`);
  }
  const artifacts = requireArray(manifest.artifacts, `${sourceId} artifact manifest artifacts`);
  const checkoutRoot = path.resolve(requireString(source.checkout, `${sourceId} checkout`));
  const liveStatus = gitStatusEntries(checkoutRoot);
  const liveUntrackedPaths = liveStatus
    .filter((entry) => entry.status === "??")
    .map((entry) => entry.path)
    .sort();
  if (artifacts.length !== tracked.length + liveUntrackedPaths.length) {
    fail(`${sourceId} artifact manifest does not preserve every tracked and untracked item`);
  }
  const expectedTracked = [...tracked].sort();
  const actualTracked = [];
  const actualUntrackedPaths = [];
  const seenSourcePaths = new Set();
  const seenArtifactPaths = new Set();
  for (const [index, artifact] of artifacts.entries()) {
    requireObject(artifact, `${sourceId} artifact[${index}]`);
    const sourcePath = normalizeRepositoryPath(requireString(artifact.sourcePath, `${sourceId} artifact sourcePath`));
    if (path.isAbsolute(sourcePath) || sourcePath.startsWith("../")) {
      fail(`${sourceId} artifact sourcePath must be relative to the recorded checkout`);
    }
    if (seenSourcePaths.has(sourcePath)) fail(`${sourceId} artifact manifest repeats ${sourcePath}`);
    seenSourcePaths.add(sourcePath);
    if (artifact.status === "untracked") actualUntrackedPaths.push(sourcePath);
    else actualTracked.push(requireString(artifact.status, `${sourceId} artifact status`) + " " + sourcePath);
    const sourceSha256 = requireString(artifact.sourceSha256, `${sourceId} artifact sourceSha256`).toLowerCase();
    const preserved = verifiedEvidenceBytes(
      artifact.artifactPath,
      sourceSha256,
      sourceSha,
      `${sourceId} preserved artifact ${sourcePath}`,
      root,
    );
    const artifactIdentity = process.platform === "win32" ? preserved.normalized.toLowerCase() : preserved.normalized;
    if (seenArtifactPaths.has(artifactIdentity)) {
      fail(`${sourceId} artifact manifest reuses preserved artifact ${preserved.normalized}`);
    }
    if (artifactEvidencePaths.has(artifactIdentity)) {
      fail(`${sourceId} artifact manifest reuses evidence already claimed by another source`);
    }
    seenArtifactPaths.add(artifactIdentity);
    artifactEvidencePaths.add(artifactIdentity);
    const originalPath = path.resolve(checkoutRoot, ...sourcePath.split("/"));
    if (!pathIsInside(checkoutRoot, originalPath) || !existsSync(originalPath)) {
      fail(`${sourceId} original artifact ${sourcePath} is missing from the recorded checkout`);
    }
    const originalBytes = readContainedRegularFile(
      checkoutRoot,
      originalPath,
      `${sourceId} original artifact ${sourcePath}`,
    );
    if (sha256(originalBytes) !== sourceSha256 || !originalBytes.equals(preserved.bytes)) {
      fail(`${sourceId} preserved artifact ${sourcePath} does not match the original checkout bytes`);
    }
  }
  if (
    canonicalJson(actualUntrackedPaths.sort()) !== canonicalJson(liveUntrackedPaths) ||
    JSON.stringify(actualTracked.sort()) !== JSON.stringify(expectedTracked)
  ) {
    fail(`${sourceId} artifact manifest statuses do not match the captured checkout status`);
  }
  return { path: normalized, sha256: manifestSha256, artifactCount: artifacts.length };
}

export function buildChatLogRecords(sourceBytes, label = "chat source log", expectedSessionId = null) {
  const records = [];
  const observedTypes = new Set();
  let observedUuid = false;
  let observedTimestamp = false;
  if (expectedSessionId && !UUID_PATTERN.test(expectedSessionId)) fail(`${label} session ID is not a UUID`);
  const lines = sourceBytes.toString("utf8").split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    if (line.length === 0) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      fail(`${label} line ${lineIndex + 1} is not JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (expectedSessionId && (!isObject(parsed) || parsed.sessionId !== expectedSessionId)) {
      fail(`${label} line ${lineIndex + 1} is not bound to session ${expectedSessionId}`);
    }
    if (expectedSessionId) {
      if (!CLAUDE_EVENT_TYPES.has(parsed.type)) {
        fail(`${label} line ${lineIndex + 1} has unsupported Claude event type ${String(parsed.type)}`);
      }
      observedTypes.add(parsed.type);
      if (typeof parsed.uuid === "string" && UUID_PATTERN.test(parsed.uuid)) observedUuid = true;
      if (typeof parsed.timestamp === "string" && !Number.isNaN(Date.parse(parsed.timestamp))) {
        observedTimestamp = true;
      }
    }
    const lineBytes = Buffer.from(line, "utf8");
    const declaredType = isObject(parsed) && typeof parsed.type === "string" ? parsed.type : "unknown";
    const type = /^[A-Za-z0-9._-]{1,64}$/.test(declaredType) ? declaredType : "unknown";
    records.push({
      index: records.length,
      line: lineIndex + 1,
      bytes: lineBytes.length,
      sha256: sha256(lineBytes),
      type,
    });
  }
  if (records.length === 0) fail(`${label} contains no JSONL records`);
  if (
    expectedSessionId &&
    (!observedTypes.has("user") || !observedTypes.has("assistant") || !observedUuid || !observedTimestamp)
  ) {
    fail(`${label} does not contain the required Claude user/assistant event envelope, UUID and timestamp`);
  }
  return records;
}

export function buildChatExportEnvelope({ chat, sessionId, sourceLogPath, archivedLogPath, sourceBytes }) {
  const sourceAbsolute = path.resolve(requireString(sourceLogPath, "chat sourceLogPath"));
  const archivedAbsolute = path.resolve(requireString(archivedLogPath, "chat archivedLogPath"));
  requireString(chat, "chat export chat");
  requireString(sessionId, "chat export sessionId");
  if (!path.isAbsolute(sourceLogPath) || path.basename(sourceAbsolute) !== `${sessionId}.jsonl`) {
    fail("chat sourceLogPath must be absolute and its filename must equal <sessionId>.jsonl");
  }
  if (!path.isAbsolute(archivedLogPath) || path.basename(archivedAbsolute) !== `${sessionId}.jsonl`) {
    fail("chat archivedLogPath must be absolute and its filename must equal <sessionId>.jsonl");
  }
  if (sourceAbsolute === archivedAbsolute || pathIsInside(repositoryRoot, archivedAbsolute)) {
    fail("chat archivedLogPath must be a separate path outside the repository checkout");
  }
  const records = buildChatLogRecords(sourceBytes, `chat source log ${sessionId}`, sessionId);
  const sourceLogSha256 = sha256(sourceBytes);
  return {
    schemaVersion: 1,
    kind: "ward-flow-chat-export",
    chat,
    sessionId,
    sourceLogPath: sourceAbsolute.replaceAll("\\", "/"),
    sourceLogSha256,
    sourceLogBytes: sourceBytes.length,
    archivedLogPath: archivedAbsolute.replaceAll("\\", "/"),
    archivedLogSha256: sourceLogSha256,
    recordCount: records.length,
    records,
  };
}

function verifiedOwnerProvenance(chat, sourceSha, root) {
  const chatName = requireString(chat.chat, "source snapshot chat name");
  const sessionId = requireString(chat.sessionId, "source snapshot chat sessionId");
  if (chat.provenanceDecision !== "owner-confirmed") {
    fail(`chat export ${sessionId} requires provenanceDecision owner-confirmed`);
  }
  const decisionId = requireString(chat.ownerDecisionId, `chat export ${sessionId} ownerDecisionId`);
  const decisionSha256 = requireString(
    chat.ownerDecisionSha256,
    `chat export ${sessionId} ownerDecisionSha256`,
  ).toLowerCase();
  const decisionEvidence = verifiedEvidenceBytes(
    chat.ownerDecisionPath,
    decisionSha256,
    sourceSha,
    `chat export ${sessionId} owner provenance decision`,
    root,
  );
  if (!decisionEvidence.normalized.startsWith("docs/ward-flow/control/evidence/owner-decisions/")) {
    fail(`chat export ${sessionId} owner provenance decision must be under the owner-decisions evidence path`);
  }
  const text = decisionEvidence.bytes.toString("utf8");
  const decision = JSON.parse(text);
  if (text !== canonicalJson(decision))
    fail(`chat export ${sessionId} owner provenance decision is not canonical JSON`);
  if (
    decision.schemaVersion !== 1 ||
    decision.kind !== "ward-flow-owner-provenance-decision" ||
    decision.decisionId !== decisionId ||
    decision.decision !== "owner-confirmed" ||
    decision.chat !== chatName ||
    decision.sessionId !== sessionId ||
    Number.isNaN(new Date(decision.decidedAt).getTime())
  ) {
    fail(`chat export ${sessionId} owner provenance decision does not match the source snapshot`);
  }
  return { decisionId, path: decisionEvidence.normalized, sha256: decisionSha256 };
}

function verifiedChatExport(chat, sourceSha, root, uniqueness, { chatLogRoot = defaultClaudeLogRoot() } = {}) {
  const chatName = requireString(chat.chat, "source snapshot chat name");
  const sessionId = requireString(chat.sessionId, "source snapshot chat sessionId");
  const provenance = verifiedOwnerProvenance(chat, sourceSha, root);
  if (uniqueness.sessionIds.has(sessionId)) fail(`chat sessionId ${sessionId} is listed more than once`);
  uniqueness.sessionIds.add(sessionId);
  const exportSha256 = requireString(chat.exportSha256, "source snapshot chat exportSha256").toLowerCase();
  const exported = verifiedEvidenceBytes(chat.exportPath, exportSha256, sourceSha, `chat export ${sessionId}`, root);
  if (uniqueness.exportPaths.has(exported.normalized)) {
    fail(`chat export path ${exported.normalized} is reused by more than one session`);
  }
  uniqueness.exportPaths.add(exported.normalized);
  const text = exported.bytes.toString("utf8");
  const envelope = JSON.parse(text);
  if (text !== canonicalJson(envelope)) fail(`chat export ${sessionId} is not canonical JSON`);
  if (
    envelope.schemaVersion !== 1 ||
    envelope.kind !== "ward-flow-chat-export" ||
    envelope.chat !== chatName ||
    envelope.sessionId !== sessionId
  ) {
    fail(`chat export ${sessionId} identity does not match the source snapshot`);
  }
  const sourceLogPath = path.resolve(requireString(envelope.sourceLogPath, `chat export ${sessionId} sourceLogPath`));
  const archivedLogPath = path.resolve(
    requireString(envelope.archivedLogPath, `chat export ${sessionId} archivedLogPath`),
  );
  if (!path.isAbsolute(envelope.sourceLogPath) || path.basename(sourceLogPath) !== `${sessionId}.jsonl`) {
    fail(`chat export ${sessionId} source log path does not identify the session`);
  }
  if (!pathIsInside(chatLogRoot, sourceLogPath)) {
    fail(`chat export ${sessionId} source log is outside the configured Claude log root`);
  }
  if (
    !path.isAbsolute(envelope.archivedLogPath) ||
    path.basename(archivedLogPath) !== `${sessionId}.jsonl` ||
    !pathIsIndependentOfRepository(archivedLogPath, root) ||
    archivedLogPath === sourceLogPath
  ) {
    fail(`chat export ${sessionId} archive must be a separate session-named file outside every repository checkout`);
  }
  const sourceLogIdentity = localPathIdentity(sourceLogPath);
  const archivedLogIdentity = localPathIdentity(archivedLogPath);
  if (uniqueness.sourceLogPaths.has(sourceLogIdentity) || uniqueness.archivedLogPaths.has(archivedLogIdentity)) {
    fail(`chat export ${sessionId} reuses a source or archive path`);
  }
  uniqueness.sourceLogPaths.add(sourceLogIdentity);
  uniqueness.archivedLogPaths.add(archivedLogIdentity);
  if (!existsSync(archivedLogPath)) fail(`chat export ${sessionId} independent archive does not exist`);
  const archive = readIndependentRegularFile(archivedLogPath, root, `chat export ${sessionId} independent archive`);
  const archivedBytes = archive.bytes;
  const sourceLogSha256 = sha256(archivedBytes);
  if (
    envelope.sourceLogSha256 !== sourceLogSha256 ||
    envelope.archivedLogSha256 !== sourceLogSha256 ||
    envelope.sourceLogBytes !== archivedBytes.length
  ) {
    fail(`chat export ${sessionId} does not match the source log and independent archive bytes`);
  }
  if (!existsSync(sourceLogPath)) fail(`chat export ${sessionId} source log does not exist during activation`);
  const sourceBytes = readContainedRegularFile(chatLogRoot, sourceLogPath, `chat source log ${sessionId}`);
  if (localPathIdentity(realpathSync(sourceLogPath)) === localPathIdentity(archive.realPath)) {
    fail(`chat export ${sessionId} source log and independent archive resolve to the same file`);
  }
  if (!sourceBytes.equals(archivedBytes)) {
    fail(`chat export ${sessionId} does not match the source log and independent archive bytes`);
  }
  const expectedRecords = buildChatLogRecords(archivedBytes, `chat source log ${sessionId}`, sessionId);
  if (
    envelope.recordCount !== expectedRecords.length ||
    canonicalJson(envelope.records) !== canonicalJson(expectedRecords)
  ) {
    fail(`chat export ${sessionId} record manifest is not a complete mechanical export of the source log`);
  }
  return {
    normalized: exported.normalized,
    exportSha256,
    exportBytes: exported.bytes.length,
    sourceLogPath: sourceLogPath.replaceAll("\\", "/"),
    sourceLogSha256,
    sourceLogBytes: archivedBytes.length,
    archivedLogPath: archivedLogPath.replaceAll("\\", "/"),
    archivedLogSha256: sourceLogSha256,
    recordCount: expectedRecords.length,
    provenance,
  };
}

export function buildExpectedSourceInventory({
  state,
  sourceSha,
  root = repositoryRoot,
  chatLogRoot = defaultClaudeLogRoot(),
}) {
  if (!pathExistsAtRef(state.sourceSnapshot, sourceSha, root)) {
    fail(`current-truth source snapshot ${state.sourceSnapshot} is not committed at ${sourceSha}`);
  }
  const snapshotBytes = headFile(state.sourceSnapshot, root, { ref: sourceSha });
  const snapshot = JSON.parse(snapshotBytes);
  const refs = new Set([sourceSha, state.integrationBase, snapshot.workingLine?.head]);
  for (const checkout of snapshot.checkouts ?? []) refs.add(checkout.head);
  for (const document of snapshot.sourceDocuments ?? []) refs.add(document.ref);
  const sources = [];
  for (const candidate of refs) {
    if (!candidate || !SHA_PATTERN.test(candidate) || !refExists(candidate, root)) {
      fail(`current-truth source inventory contains an unresolved snapshot ref ${candidate}`);
    }
    const ref = fullSha(candidate, root);
    for (const entry of gitWardDocuments(ref, root)) {
      const identity = { kind: "git-document", ref, ...entry };
      sources.push({ id: sha256(canonicalJson(identity)), ...identity });
    }
  }
  const artifactEvidencePaths = new Set();
  const workingLine = snapshot.workingLine;
  if (workingLine) {
    assertCheckoutMatchesSnapshot(workingLine, workingLine.status, "working-line");
    const baseIdentity = {
      kind: "working-line",
      branch: requireString(workingLine.branch, "source snapshot workingLine branch"),
      head: requireString(workingLine.head, "source snapshot workingLine head"),
      checkout: requireString(workingLine.checkout, "source snapshot workingLine checkout"),
    };
    const identity = {
      ...baseIdentity,
      dirtyArtifactManifest: durableDirtyArtifactManifest(
        workingLine,
        workingLine.status,
        sourceSha,
        "working-line",
        root,
        { artifactEvidencePaths },
      ),
    };
    sources.push({ id: sha256(canonicalJson(identity)), ...identity });
  }
  for (const checkout of snapshot.checkouts ?? []) {
    const sourceId = requireString(checkout.id, "source snapshot checkout id");
    assertCheckoutMatchesSnapshot(
      checkout,
      { tracked: checkout.trackedStatus, untrackedCount: checkout.untrackedCount },
      sourceId,
    );
    const baseIdentity = {
      kind: "auxiliary-checkout",
      sourceId,
      branch: requireString(checkout.branch, "source snapshot checkout branch"),
      head: requireString(checkout.head, "source snapshot checkout head"),
      checkout: requireString(checkout.checkout, "source snapshot checkout path"),
    };
    const identity = {
      ...baseIdentity,
      dirtyArtifactManifest: durableDirtyArtifactManifest(
        checkout,
        { tracked: checkout.trackedStatus, untrackedCount: checkout.untrackedCount },
        sourceSha,
        sourceId,
        root,
        { artifactEvidencePaths },
      ),
    };
    sources.push({ id: sha256(canonicalJson(identity)), ...identity });
  }
  const chatUniqueness = {
    sessionIds: new Set(),
    exportPaths: new Set(),
    sourceLogPaths: new Set(),
    archivedLogPaths: new Set(),
  };
  for (const chat of snapshot.chatLogs ?? []) {
    const exported = verifiedChatExport(chat, sourceSha, root, chatUniqueness, { chatLogRoot });
    const identity = {
      kind: "chat-log-export",
      chat: requireString(chat.chat, "source snapshot chat name"),
      sessionId: requireString(chat.sessionId, "source snapshot chat sessionId"),
      provenanceDecision: chat.provenanceDecision,
      ownerDecisionId: chat.ownerDecisionId,
      ownerDecisionPath: exported.provenance.path,
      ownerDecisionSha256: exported.provenance.sha256,
      exportPath: exported.normalized,
      exportSha256: exported.exportSha256,
      exportBytes: exported.exportBytes,
      sourceLogPath: exported.sourceLogPath,
      sourceLogSha256: exported.sourceLogSha256,
      sourceLogBytes: exported.sourceLogBytes,
      archivedLogPath: exported.archivedLogPath,
      archivedLogSha256: exported.archivedLogSha256,
      recordCount: exported.recordCount,
    };
    sources.push({ id: sha256(canonicalJson(identity)), ...identity });
  }
  if (snapshot.priorProcessAudit) {
    const auditPath = normalizeRepositoryPath(
      requireString(snapshot.priorProcessAudit.path, "source snapshot process audit path"),
    );
    const auditSha256 = requireString(
      snapshot.priorProcessAudit.sha256,
      "source snapshot process audit sha256",
    ).toLowerCase();
    if (!SHA256_PATTERN.test(auditSha256) || !pathExistsAtRef(auditPath, sourceSha, root)) {
      fail("source snapshot process audit must be committed at the inventory source SHA with a valid hash");
    }
    const auditBytes = headFile(auditPath, root, { ref: sourceSha, encoding: "buffer" });
    if (sha256(auditBytes) !== auditSha256) fail("source snapshot process audit hash does not match committed bytes");
    const identity = {
      kind: "process-audit",
      path: auditPath,
      sha256: auditSha256,
      bytes: auditBytes.length,
    };
    sources.push({ id: sha256(canonicalJson(identity)), ...identity });
  }
  const unique = new Map(sources.map((source) => [source.id, source]));
  return {
    schemaVersion: 1,
    kind: "ward-flow-source-inventory",
    sourceSnapshot: state.sourceSnapshot,
    sourceSnapshotSha256: sha256(snapshotBytes),
    sources: [...unique.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * @param {unknown} manifest
 * @param {unknown} inventory
 * @param {{ activationSha?: string | null, root?: string }} [options]
 *
 * Typed for the same reason as `acquireLease` above: the destructured default for
 * `activationSha` is `null`, so TypeScript inferred the parameter as `null` and reported every
 * caller passing a real SHA as assigning a string to `null | undefined`. The annotation states
 * the shape the function has always accepted rather than changing its behaviour.
 */
export function validateCurrentTruthManifest(
  manifest,
  inventory,
  { activationSha = null, root = repositoryRoot } = {},
) {
  requireObject(manifest, "current-truth manifest");
  if (
    manifest.schemaVersion !== 1 ||
    manifest.kind !== "ward-flow-source-disposition-manifest" ||
    manifest.inventorySha256 !== sha256(canonicalJson(inventory)) ||
    manifest.unclassifiedSources !== 0
  ) {
    fail("current-truth manifest identity, inventory hash or unclassified count is invalid");
  }
  const dispositions = new Set(["canonical", "historical", "superseded", "parked", "rejected"]);
  const entries = requireArray(manifest.sources, "current-truth manifest sources");
  const expectedIds = inventory.sources.map((source) => source.id);
  const actualIds = entries.map((entry, index) => {
    requireObject(entry, `current-truth manifest sources[${index}]`);
    requireString(entry.id, `current-truth manifest sources[${index}] id`);
    requireString(entry.rationale, `current-truth manifest sources[${index}] rationale`);
    if (!dispositions.has(entry.disposition)) {
      fail(`current-truth manifest sources[${index}] disposition is invalid`);
    }
    if (entry.disposition === "canonical") {
      requireString(entry.canonicalPath, `current-truth manifest sources[${index}] canonicalPath`);
    } else if (entry.canonicalPath !== null) {
      fail(`current-truth manifest sources[${index}] canonicalPath must be null unless canonical`);
    }
    if (entry.disposition === "superseded") {
      requireString(entry.supersededBy, `current-truth manifest sources[${index}] supersededBy`);
    } else if (entry.supersededBy !== null) {
      fail(`current-truth manifest sources[${index}] supersededBy must be null unless superseded`);
    }
    return entry.id;
  });
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    fail("current-truth manifest must classify every generated inventory source exactly once in inventory order");
  }
  const knownIds = new Set(expectedIds);
  const sourceById = new Map(inventory.sources.map((source) => [source.id, source]));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    if (entry.supersededBy && (!knownIds.has(entry.supersededBy) || entry.supersededBy === entry.id)) {
      fail(`current-truth manifest ${entry.id} has an invalid supersededBy reference`);
    }
    if (entry.disposition === "superseded") {
      const visited = new Set([entry.id]);
      let cursor = entry;
      while (cursor.disposition === "superseded") {
        if (visited.has(cursor.supersededBy)) fail(`current-truth supersession cycle includes ${cursor.supersededBy}`);
        visited.add(cursor.supersededBy);
        cursor = entryById.get(cursor.supersededBy);
        if (!cursor) fail(`current-truth supersession target ${entry.supersededBy} is missing`);
      }
      if (cursor.disposition !== "canonical") {
        fail(`current-truth supersession from ${entry.id} does not terminate at a canonical source`);
      }
    }
    if (entry.disposition === "canonical" && activationSha) {
      const canonicalPath = normalizeRepositoryPath(entry.canonicalPath);
      if (path.isAbsolute(entry.canonicalPath) || canonicalPath.startsWith("../")) {
        fail(`current-truth canonicalPath for ${entry.id} must be repository-relative`);
      }
      if (!pathExistsAtRef(canonicalPath, activationSha, root)) {
        fail(`current-truth canonicalPath ${canonicalPath} does not exist at activation source ${activationSha}`);
      }
      const source = sourceById.get(entry.id);
      if (source.kind === "git-document") {
        const canonicalIdentity = treeIdentity(activationSha, canonicalPath, root);
        const match = canonicalIdentity && /^(\d+) (\w+) ([0-9a-f]+)\t/.exec(canonicalIdentity);
        if (!match || match[1] !== source.mode || match[2] !== source.type || match[3] !== source.objectId) {
          fail(`current-truth canonicalPath ${canonicalPath} does not match source ${entry.id}`);
        }
      } else if (source.kind === "process-audit" || source.kind === "chat-log-export") {
        const expectedHash = source.kind === "process-audit" ? source.sha256 : source.exportSha256;
        const canonicalBytes = headFile(canonicalPath, root, { ref: activationSha, encoding: "buffer" });
        if (sha256(canonicalBytes) !== expectedHash) {
          fail(`current-truth canonicalPath ${canonicalPath} does not match source ${entry.id}`);
        }
      } else {
        fail(`current-truth metadata source ${entry.id} cannot be canonical without a content-bearing source`);
      }
    }
  }
  return manifest;
}

function committedTreeInputSignature(ref, root = repositoryRoot) {
  const output = git(["ls-tree", "-r", "-z", ref], { cwd: root });
  const contents = new Map();
  for (const entry of output.split("\0").filter(Boolean)) {
    const match = /^(\d+) \w+ ([0-9a-f]+)\t(.+)$/.exec(entry);
    if (!match) fail(`could not parse committed gate input ${entry}`);
    const relative = normalizeRepositoryPath(match[3]);
    if (relative.startsWith("node_modules/")) continue;
    contents.set(relative, `${match[1]} ${match[2]}`);
  }
  const digest = createHash("sha256");
  for (const relative of [...contents.keys()].sort()) {
    digest.update(`${relative}\0${contents.get(relative)}\0`);
  }
  return { hash: digest.digest("hex"), fileCount: contents.size };
}

export function validateRunnerReceiptCandidate(candidate, { gate, args, inputHash, fileCount }) {
  requireObject(candidate, `${gate} gate receipt`);
  if (
    !SHA256_PATTERN.test(candidate.key) ||
    !SHA256_PATTERN.test(candidate.inputHash) ||
    !SHA256_PATTERN.test(candidate.environmentHash)
  ) {
    fail(`${gate} gate receipt key and content/environment hashes must be 64 lowercase hex characters`);
  }
  if (!Array.isArray(candidate.args) || candidate.args.some((argument) => typeof argument !== "string")) {
    fail(`${gate} gate receipt args must be an array of strings`);
  }
  if (!Number.isInteger(candidate.fileCount) || candidate.fileCount < 1) {
    fail(`${gate} gate receipt fileCount must be a positive integer`);
  }
  if (
    typeof candidate.recordedAt !== "string" ||
    Number.isNaN(Date.parse(candidate.recordedAt)) ||
    new Date(candidate.recordedAt).toISOString() !== candidate.recordedAt
  ) {
    fail(`${gate} gate receipt recordedAt must be a canonical ISO timestamp`);
  }
  const expectedKey = receiptKey({
    gate,
    args: candidate.args,
    inputHash: candidate.inputHash,
    environmentHash: candidate.environmentHash,
  });
  if (candidate.key !== expectedKey) fail(`${gate} gate receipt key does not match the runner receipt algorithm`);
  return (
    candidate.inputHash === inputHash &&
    candidate.fileCount === fileCount &&
    JSON.stringify(candidate.args) === JSON.stringify(args)
  );
}

/**
 * Every checkout of this repository, so a receipt produced in one can be read from another.
 *
 * ⚠️ **THE RECEIPT ATTESTS A COMMITTED TREE, AND A COMMITTED TREE IS THE SAME IN EVERY WORKTREE.**
 * Reading the store from the CURRENT worktree alone made steady-state validation impossible in any
 * checkout that had not itself run the test at the activation snapshot — which is every fresh one.
 * Found 2026-09-01 while creating a Ward Verifier: its worktree is detached at a LATER commit, so
 * it could never produce a receipt for the snapshot's tree no matter how many times it ran the
 * test. The role that exists to check the work could not be created because of where a cache file
 * happened to live.
 *
 * This does not weaken the gate. The identity being checked is still the exact committed tree, and
 * `validateRunnerReceiptCandidate` still recomputes the receipt key from the receipt's own inputs;
 * all that changes is which directories are searched for an attestation about that tree.
 */
function gateReceiptStorePaths(root) {
  const roots = [root];
  try {
    const listed = git(["worktree", "list", "--porcelain"], { cwd: root });
    for (const line of listed.replaceAll("\r", "").split("\n")) {
      if (line.startsWith("worktree ")) roots.push(line.slice("worktree ".length));
    }
  } catch {
    /* not a worktree list we can read — the current root alone is still a valid place to look */
  }
  const seen = new Set();
  const paths = [];
  for (const candidate of roots) {
    const storePath = path.join(candidate, "node_modules", ".cache", "database-gate-receipts.json");
    const identity = localPathIdentity(storePath);
    if (seen.has(identity)) continue;
    seen.add(identity);
    paths.push(storePath);
  }
  return paths;
}

function assertRunnerProducedFocusedTestReceipt(ref, root = repositoryRoot) {
  const signature = committedTreeInputSignature(ref, root);
  const args = ["run", "tests/ward-flow-chat-control.test.ts"];
  const storePaths = gateReceiptStorePaths(root).filter((storePath) => existsSync(storePath));
  if (storePaths.length === 0) {
    fail("control-plane activation requires the gate runner receipt store; rerun the exact focused test");
  }
  for (const storePath of storePaths) {
    const store = readJson(storePath, "gate runner receipt store");
    if (store.version !== RECEIPT_FORMAT_VERSION || !isObject(store.gates)) continue;
    const receipts = requireArray(store.gates.vitest ?? [], "Vitest gate receipts");
    const receipt = receipts.find((candidate) =>
      validateRunnerReceiptCandidate(candidate, {
        gate: "vitest",
        args,
        inputHash: signature.hash,
        fileCount: signature.fileCount,
      }),
    );
    if (receipt) return receipt;
  }
  fail(
    "control-plane activation has no runner-produced passing receipt for the exact activation tree in any " +
      "checkout of this repository; run node scripts/run-vitest.mjs run tests/ward-flow-chat-control.test.ts " +
      "at that clean commit",
  );
}

export function assertTransitionEvidenceWindow(sourceSha, activationSnapshot, root = repositoryRoot) {
  if (!isAncestor(sourceSha, activationSnapshot, root)) {
    fail("transition evidence sourceSha is not an ancestor of activationSnapshot");
  }
  const sourceAffecting = diffChanges(sourceSha, activationSnapshot, root).filter(
    (change) => !change.path.startsWith("docs/ward-flow/control/evidence/"),
  );
  if (sourceAffecting.length > 0) {
    fail(
      "transition evidence was replayed across source-affecting changes: " +
        sourceAffecting.map((change) => change.path).join(", "),
    );
  }
}

export function assertCommonTransitionSourceSha(sourceShas) {
  const unique = new Set(sourceShas);
  if (sourceShas.length !== 3 || unique.size !== 1 || !SHA_PATTERN.test(sourceShas[0] ?? "")) {
    fail("all three transition receipts must use one common pre-receipt sourceSha");
  }
  return sourceShas[0];
}

function validateStateRepositoryEvidence(state, root = repositoryRoot) {
  if (!refExists(state.integrationBranch, root)) {
    fail(`system integrationBranch ${state.integrationBranch} does not resolve locally`);
  }
  if (!refExists(state.integrationBase, root)) {
    fail(`system integrationBase ${state.integrationBase} does not resolve locally`);
  }
  if (!isAncestor(state.integrationBase, fullSha(state.integrationBranch, root), root)) {
    fail(`system integrationBase is not an ancestor of ${state.integrationBranch}`);
  }
  const evidenceRef = state.mode === "steady-state" ? state.activationSnapshot : state.integrationBranch;
  if (state.mode === "steady-state") {
    if (!refExists(evidenceRef, root) || !isAncestor(evidenceRef, fullSha(state.integrationBranch, root), root)) {
      fail("steady-state activationSnapshot must resolve and remain on the integration branch");
    }
  }
  const transitionSourceShas = [];
  for (const receipt of state.transitionEvidence) {
    const relative = normalizeRepositoryPath(receipt.path);
    if (!relative.startsWith("docs/ward-flow/control/evidence/")) {
      fail(`transition evidence ${receipt.id} must be under docs/ward-flow/control/evidence/`);
    }
    if (!pathExistsAtRef(relative, evidenceRef, root)) {
      fail(`transition evidence ${receipt.id} is not committed at activation evidence ref ${evidenceRef}`);
    }
    const bytes = headFile(relative, root, { ref: evidenceRef, encoding: "buffer" });
    if (sha256(bytes) !== receipt.sha256) fail(`transition evidence ${receipt.id} hash does not match committed bytes`);
    const text = bytes.toString("utf8");
    const evidence = JSON.parse(text);
    if (text !== canonicalJson(evidence)) fail(`transition evidence ${receipt.id} is not canonical JSON`);
    requireObject(evidence, `transition evidence ${receipt.id}`);
    if (
      evidence.schemaVersion !== 1 ||
      evidence.kind !== "ward-flow-transition-receipt" ||
      evidence.id !== receipt.id ||
      evidence.outcome !== "passed"
    ) {
      fail(`transition evidence ${receipt.id} identity or outcome is invalid`);
    }
    if (!SHA_PATTERN.test(evidence.sourceSha) || !refExists(evidence.sourceSha, root)) {
      fail(`transition evidence ${receipt.id} sourceSha does not resolve locally`);
    }
    if (!isAncestor(evidence.sourceSha, fullSha(state.integrationBranch, root), root)) {
      fail(`transition evidence ${receipt.id} sourceSha is not retained by the integration branch`);
    }
    transitionSourceShas.push(evidence.sourceSha);
    if (state.mode === "steady-state") {
      assertTransitionEvidenceWindow(evidence.sourceSha, evidenceRef, root);
    }
    requireString(evidence.acceptanceCriterion, `transition evidence ${receipt.id} acceptanceCriterion`);
    requireString(evidence.falsifier, `transition evidence ${receipt.id} falsifier`);
    requireString(evidence.decisiveEvidence, `transition evidence ${receipt.id} decisiveEvidence`);
    const gate = requireObject(evidence.gateEvidence, `transition evidence ${receipt.id} gateEvidence`);
    if (receipt.id === "recovery-bundle") {
      const bundlePath = normalizeRepositoryPath(
        requireString(gate.bundlePath, "recovery-bundle gateEvidence bundlePath"),
      );
      if (!bundlePath.startsWith("docs/ward-flow/control/evidence/bundles/")) {
        fail("recovery-bundle bundlePath must be under docs/ward-flow/control/evidence/bundles/");
      }
      if (!SHA256_PATTERN.test(gate.bundleSha256)) fail("recovery-bundle bundleSha256 is invalid");
      if (!pathExistsAtRef(bundlePath, evidenceRef, root)) {
        fail("recovery-bundle bytes are not committed at the activation evidence ref");
      }
      const bundleBytes = headFile(bundlePath, root, { ref: evidenceRef, encoding: "buffer" });
      if (sha256(bundleBytes) !== gate.bundleSha256) fail("recovery-bundle hash does not match committed bytes");
      if (
        gate.bundleHashVerified !== true ||
        gate.requiredObjectsVerified !== true ||
        gate.restoreResult !== "passed"
      ) {
        fail("recovery-bundle gateEvidence must record passed restore, hash and required-object checks");
      }
      verifyRecoveryBundleGate({ gate, evidence, state, bundleBytes, root });
    } else if (receipt.id === "current-truth") {
      const inventoryPath = normalizeRepositoryPath(
        requireString(gate.inventoryPath, "current-truth gateEvidence inventoryPath"),
      );
      const manifestPath = normalizeRepositoryPath(
        requireString(gate.manifestPath, "current-truth gateEvidence manifestPath"),
      );
      if (
        !inventoryPath.startsWith("docs/ward-flow/control/evidence/") ||
        !manifestPath.startsWith("docs/ward-flow/control/evidence/")
      ) {
        fail("current-truth inventoryPath and manifestPath must be under docs/ward-flow/control/evidence/");
      }
      if (!SHA256_PATTERN.test(gate.inventorySha256)) fail("current-truth inventorySha256 is invalid");
      if (!SHA256_PATTERN.test(gate.manifestSha256)) fail("current-truth manifestSha256 is invalid");
      const inventoryBytes = headFile(inventoryPath, root, { ref: evidenceRef });
      const manifestBytes = headFile(manifestPath, root, { ref: evidenceRef });
      if (sha256(inventoryBytes) !== gate.inventorySha256) fail("current-truth inventory hash does not match");
      if (sha256(manifestBytes) !== gate.manifestSha256) fail("current-truth manifest hash does not match");
      const inventory = JSON.parse(inventoryBytes);
      const manifest = JSON.parse(manifestBytes);
      if (inventoryBytes !== canonicalJson(inventory) || manifestBytes !== canonicalJson(manifest)) {
        fail("current-truth inventory and manifest must be canonical JSON");
      }
      const expectedInventory = buildExpectedSourceInventory({ state, sourceSha: evidence.sourceSha, root });
      if (inventoryBytes !== canonicalJson(expectedInventory)) {
        fail("current-truth inventory does not match the mechanically generated Ward source inventory");
      }
      validateCurrentTruthManifest(manifest, inventory, { activationSha: evidence.sourceSha, root });
    } else if (receipt.id === "control-plane") {
      if (
        gate.validatorCommand !== "node scripts/ward-flow/chat-control.mjs validate" ||
        gate.validatorOutcome !== "passed" ||
        typeof gate.validatorDecisiveLine !== "string" ||
        !gate.validatorDecisiveLine.startsWith("[ward-flow-chat] VALID:") ||
        gate.focusedTestCommand !== "node scripts/run-vitest.mjs run tests/ward-flow-chat-control.test.ts" ||
        gate.focusedTestOutcome !== "passed"
      ) {
        fail("control-plane gateEvidence must record the exact validator and focused-test pass");
      }
      assertRunnerProducedFocusedTestReceipt(evidenceRef, root);
    }
  }
  if (state.mode === "steady-state") assertCommonTransitionSourceSha(transitionSourceShas);
}

export function validateControlPlane(root = repositoryRoot) {
  const { contract, state } = loadControl(root);
  validateStateRepositoryEvidence(state, root);
  const claudeInstructions = readFileSync(path.join(root, "CLAUDE.md"), "utf8");
  if (
    claudeInstructions
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0)
      ?.trim() !== "@AGENTS.md"
  ) {
    fail("CLAUDE.md must import AGENTS.md as its first non-empty line so repository rules cannot drift");
  }
  for (const role of contract.roles) {
    const promptPath = path.join(root, "docs", "ward-flow", "control", "prompts", `${role.id}.md`);
    if (!existsSync(promptPath)) fail(`missing recreation prompt for ${role.id}`);
    const prompt = readFileSync(promptPath, "utf8");
    if (!prompt.includes(role.title)) fail(`recreation prompt for ${role.id} does not name ${role.title}`);
  }
  validateActiveControlLanguage(root);
  const workingHandoverPaths = listHandoverPaths(root);
  const missingCommittedHandovers = listHandoverPaths(root, { committedOnly: true }).filter(
    (relative) => !workingHandoverPaths.includes(relative),
  );
  if (missingCommittedHandovers.length > 0) {
    fail(`committed handovers are missing from the checkout: ${missingCommittedHandovers.join(", ")}`);
  }
  const entries = workingHandoverPaths.map((relative) => ({ relative, record: loadHandover(relative, root) }));
  validateHandoverChains(entries);
  const assignmentDirectory = path.join(root, "docs", "ward-flow", "control", "assignments");
  const assignments = existsSync(assignmentDirectory)
    ? readdirSync(assignmentDirectory)
        .filter((name) => name.endsWith(ASSIGNMENT_SUFFIX))
        .map((name) => {
          const relative = path.posix.join("docs", "ward-flow", "control", "assignments", name);
          const bytes = readFileSync(path.join(assignmentDirectory, name), "utf8");
          const record = JSON.parse(bytes);
          if (bytes !== canonicalJson(record)) fail(`${relative} is not canonical JSON`);
          return validateAssignmentRecord(record, { relativePath: relative });
        })
    : [];
  const certificates = listCertificatePaths(root).map((relative) => ({
    relative,
    certificate: loadCertificate(relative, root),
  }));
  const seenCertifiedHandovers = new Set();
  for (const certificate of certificates) {
    if (seenCertifiedHandovers.has(certificate.certificate.handoverPath)) {
      fail(`multiple reset certificates exist for ${certificate.certificate.handoverPath}`);
    }
    seenCertifiedHandovers.add(certificate.certificate.handoverPath);
    const handover = entries.find((entry) => entry.relative === certificate.certificate.handoverPath);
    if (!handover) fail(`reset certificate refers to missing handover ${certificate.certificate.handoverPath}`);
    validateCertificateAgainstHandover(certificate, handover, root);
  }
  return {
    contract,
    state,
    recordCount: entries.length,
    assignmentCount: assignments.length,
    certificateCount: certificates.length,
  };
}

export function buildRecreationPrompt({ roleContract, state, template, handover, snapshot, lease, assignment }) {
  const lines = [template.trimEnd(), "", "---", "", "## Machine-provided control context", ""];
  lines.push(`- Active mode: \`${state.mode}\``);
  lines.push(`- Integration branch: \`${state.integrationBranch}\``);
  lines.push(`- Current checkout branch: \`${snapshot.branch}\``);
  lines.push(`- Current checkout HEAD: \`${snapshot.head}\``);
  lines.push(`- Current checkout status: ${snapshot.status.length === 0 ? "clean" : "DIRTY — inspect before acting"}`);
  lines.push(`- Fixed role: \`${roleContract.id}\` — ${roleContract.title}`);
  lines.push(`- Session ID: \`${lease.lease.instanceId}\``);
  lines.push(`- Role generation: \`${lease.lease.generation}\``);
  lines.push(`- Lease SHA-256: \`${lease.sha256}\``);
  lines.push(`- Lease starting HEAD: \`${lease.lease.head}\``);
  if (assignment) {
    lines.push(`- Builder assignment: \`${assignment.relative}\``);
    lines.push(`- Builder model tier: \`${assignment.record.modelRouting.tier}\``);
    lines.push(`- Builder model routing reason: ${assignment.record.modelRouting.reason}`);
    const catcher = assignment.record.modelRouting.catcher;
    lines.push(
      `- Builder model catcher: ${catcher ? `${catcher.kind}: ${catcher.reference}` : "not required for Opus routing"}`,
    );
  }
  if (lease.lease.targetSha) lines.push(`- Frozen verification target: \`${lease.lease.targetSha}\``);
  lines.push("");
  if (handover) {
    lines.push("## Latest committed handover", "", `Path: \`${handover.relative}\``, "", "```json");
    lines.push(canonicalJson(handover.record).trimEnd(), "```", "");
    lines.push(`Reset certificate: \`${handover.certificate.relative}\``);
    lines.push(`Begin with this next action: ${handover.record.content.nextAction}`);
  } else {
    lines.push(
      "## Latest committed handover",
      "",
      "No committed handover exists for this role. Bootstrap only; do not infer prior work.",
    );
  }
  lines.push("");
  return lines.join("\n");
}

function parseOptions(tokens) {
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) fail(`unexpected argument ${token}`);
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for ${token}`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return options;
}

export function assertDurableCheckpoint(record, root = repositoryRoot) {
  if (record.role !== "builder" || record.integration.status !== "parked") return;
  const checkpoint = record.integration.durableCheckpoint;
  if (checkpoint.kind === "commit") {
    if (!refExists(checkpoint.ref, root)) fail(`parked checkpoint ref ${checkpoint.ref} does not resolve locally`);
    if (!refExists(checkpoint.commit, root))
      fail(`parked checkpoint commit ${checkpoint.commit} does not resolve locally`);
    if (!isAncestor(checkpoint.commit, fullSha(checkpoint.ref, root), root)) {
      fail(`parked checkpoint commit ${checkpoint.commit} is not retained by ${checkpoint.ref}`);
    }
    const bytes = git(["cat-file", "commit", checkpoint.commit], { cwd: root, encoding: "buffer" });
    if (sha256(bytes) !== checkpoint.sha256) fail("parked checkpoint commit hash does not match the commit object");
    return;
  }
  const relative = normalizeRepositoryPath(checkpoint.ref);
  if (!record.source?.head || !refExists(record.source.head, root)) {
    fail("parked checkpoint artifact requires a locally resolving recorded source HEAD");
  }
  if (!pathExistsAtRef(relative, record.source.head, root)) {
    fail(`parked checkpoint artifact ${relative} is not committed at recorded source HEAD ${record.source.head}`);
  }
  const bytes = headFile(relative, root, { ref: record.source.head, encoding: "buffer" });
  if (sha256(bytes) !== checkpoint.sha256) fail("parked checkpoint artifact hash does not match committed bytes");
}

function treeIdentity(ref, relative, root = repositoryRoot) {
  const result = spawnSync("git", ["ls-tree", ref, "--", normalizeRepositoryPath(relative)], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) fail(result.stderr?.trim() || `could not inspect ${relative} at ${ref}`);
  return result.stdout.trim() || null;
}

export function assertIntegratedRecord(record, state, root = repositoryRoot) {
  if (record.role !== "builder" || record.integration.status !== "integrated") return;
  const target = record.integration.targetBranch;
  if (target !== state.integrationBranch) {
    fail(`Builder integration target must be configured branch ${state.integrationBranch}`);
  }
  if (!refExists(target, root)) fail(`Builder integration target ${target} does not resolve locally`);
  if (!isAncestor(record.integration.commit, fullSha(target, root), root)) {
    fail(`Builder integration commit ${record.integration.commit} is not present on ${target}`);
  }
  const sourceCommit = record.task?.completionCommit;
  if (!sourceCommit || !refExists(sourceCommit, root)) {
    fail("Builder completion commit does not resolve locally");
  }
  if (sourceCommit !== record.source.head) {
    fail("Builder completion commit must be the recorded clean source HEAD");
  }
  const changes = diffChanges(record.task.baseSha, sourceCommit, root);
  validateRoleDiff("builder", record.task, changes);
  const targetTip = fullSha(target, root);
  for (const change of changes) {
    const sourceEntry = treeIdentity(sourceCommit, change.path, root);
    const landingEntry = treeIdentity(record.integration.commit, change.path, root);
    if (sourceEntry !== landingEntry) {
      fail(`Builder integration commit does not preserve source mode, type and content for ${change.path}`);
    }
    const currentEntry = treeIdentity(targetTip, change.path, root);
    if (sourceEntry !== currentEntry) {
      fail(`Builder integration is absent from the current target tip for ${change.path}`);
    }
  }
}

function assertRecordDisposition(record, state, root = repositoryRoot) {
  assertDurableCheckpoint(record, root);
  assertIntegratedRecord(record, state, root);
}

function listCertificatePaths(root = repositoryRoot, { committedOnly = false, ref = "HEAD" } = {}) {
  if (committedOnly) {
    const output = git(["ls-tree", "-r", "--name-only", ref, "--", "docs/ward-flow/control/certificates"], {
      cwd: root,
    });
    return output
      .replaceAll("\r", "")
      .split("\n")
      .filter((entry) => entry.endsWith(CERTIFICATE_SUFFIX));
  }
  const directory = path.join(root, "docs", "ward-flow", "control", "certificates");
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(CERTIFICATE_SUFFIX))
    .sort()
    .map((name) => path.posix.join("docs", "ward-flow", "control", "certificates", name));
}

function validateResetCertificate(certificate, { relativePath } = {}) {
  requireObject(certificate, "reset certificate");
  if (certificate.schemaVersion !== 1 || certificate.kind !== "ward-flow-reset-certificate") {
    fail("reset certificate identity is invalid");
  }
  if (!ROLE_IDS.includes(certificate.role)) fail("reset certificate role is invalid");
  if (!Number.isInteger(certificate.roleGeneration) || certificate.roleGeneration < 1) {
    fail("reset certificate roleGeneration must be a positive integer");
  }
  if (!INSTANCE_PATTERN.test(certificate.instanceId)) fail("reset certificate instanceId is invalid");
  requireString(certificate.handoverPath, "reset certificate handoverPath");
  if (!SHA256_PATTERN.test(certificate.handoverSha256)) {
    fail("reset certificate handoverSha256 must be 64 lowercase hex characters");
  }
  if (!SHA_PATTERN.test(certificate.certificationHead)) {
    fail("reset certificate certificationHead must be a full commit SHA");
  }
  const certifiedAt = new Date(certificate.certifiedAt);
  if (Number.isNaN(certifiedAt.getTime())) fail("reset certificate certifiedAt must be an ISO timestamp");
  const checks = requireArray(certificate.checks, "reset certificate checks");
  const expectedChecks = [
    "handover-committed",
    "handover-current",
    "worktree-clean",
    "source-retained",
    "role-lease-matched",
    "disposition-proven",
  ];
  if (JSON.stringify(checks) !== JSON.stringify(expectedChecks)) fail("reset certificate checks are incomplete");
  if (relativePath && normalizeRepositoryPath(relativePath) !== certificateRelativePath(certificate)) {
    fail(`reset certificate path does not match its content hash: expected ${certificateRelativePath(certificate)}`);
  }
  return certificate;
}

function loadCertificate(relative, root = repositoryRoot, { committedOnly = false, ref = "HEAD" } = {}) {
  const normalized = normalizeRepositoryPath(relative);
  const bytes = committedOnly
    ? headFile(normalized, root, { ref })
    : readFileSync(path.join(root, ...normalized.split("/")), "utf8");
  const certificate = JSON.parse(bytes);
  if (bytes !== canonicalJson(certificate)) fail(`${relative} is not canonical JSON`);
  return validateResetCertificate(certificate, { relativePath: normalized });
}

function certificateForHandover(handover, root = repositoryRoot, { committedOnly = true, ref = "HEAD" } = {}) {
  const matches = listCertificatePaths(root, { committedOnly, ref })
    .map((relative) => ({ relative, certificate: loadCertificate(relative, root, { committedOnly, ref }) }))
    .filter(({ certificate }) => certificate.handoverPath === handover.relative);
  if (matches.length > 1) fail(`multiple reset certificates exist for ${handover.relative}`);
  return matches[0] ?? null;
}

function validateCertificateAgainstHandover(certificateEntry, handover, root = repositoryRoot, retainedRef = "HEAD") {
  const certificate = certificateEntry.certificate;
  if (
    certificate.handoverSha256 !== sha256(canonicalJson(handover.record)) ||
    certificate.role !== handover.record.role ||
    certificate.roleGeneration !== handover.record.roleGeneration ||
    certificate.instanceId !== handover.record.instanceId
  ) {
    fail("reset certificate does not match its handover");
  }
  if (!isAncestor(certificate.certificationHead, fullSha(retainedRef, root), root)) {
    fail(`reset certificate certificationHead is not retained by ${retainedRef}`);
  }
}

function latestCertifiedHandover(role, state, root = repositoryRoot) {
  const ref = state.integrationBranch;
  const latest = latestHandover(role, root, { committedOnly: true, ref });
  if (!latest) return null;
  const certificate = certificateForHandover(latest, root, { committedOnly: true, ref });
  if (!certificate) fail(`latest ${role} handover is committed but has no committed reset certificate`);
  validateCertificateAgainstHandover(certificate, latest, root, ref);
  return { ...latest, certificate };
}

function assertSinglePurposeCommit(base, head, expectedPath, label, root = repositoryRoot) {
  if (!isAncestor(base, head, root)) fail(`${label} base ${base} is not an ancestor of ${head}`);
  const count = Number.parseInt(git(["rev-list", "--count", `${base}..${head}`], { cwd: root }).trim(), 10);
  const changed = diffChanges(base, head, root).map((change) => change.path);
  if (count !== 1 || JSON.stringify(changed) !== JSON.stringify([normalizeRepositoryPath(expectedPath)])) {
    fail(`${label} must be exactly one commit changing only ${normalizeRepositoryPath(expectedPath)}`);
  }
}

function assertPathIntroducedAlone(relative, ref, label, root = repositoryRoot) {
  const introduction = git(["log", "-1", "--format=%H", "--diff-filter=A", ref, "--", relative], {
    cwd: root,
  }).trim();
  if (!SHA_PATTERN.test(introduction)) fail(`${label} has no committed introduction on ${ref}`);
  const lineage = git(["rev-list", "--parents", "-n", "1", introduction], { cwd: root }).trim().split(/\s+/);
  if (lineage.length !== 2) fail(`${label} introduction must have exactly one parent`);
  assertSinglePurposeCommit(lineage[1], introduction, relative, `${label} introduction`, root);
  return introduction;
}

function commandValidate() {
  const result = validateControlPlane();
  console.log(
    `[ward-flow-chat] VALID: ${result.contract.roles.length} fixed roles, mode ${result.state.mode}, ` +
      `${result.assignmentCount} assignment(s), ${result.recordCount} handover(s), ` +
      `${result.certificateCount} reset certificate(s).`,
  );
}

function commandStatus() {
  const { contract, state } = validateControlPlane();
  console.log(
    `[ward-flow-chat] mode=${state.mode}; maximum=${contract.maxPersistentChats}; integration=${state.integrationBranch}`,
  );
  for (const role of contract.roles) {
    const active = state.activeRoles.includes(role.id);
    const latest = latestHandover(role.id, repositoryRoot, { committedOnly: true, ref: state.integrationBranch });
    const lease = readActiveLease(role.id);
    console.log(
      `[ward-flow-chat] ${role.id}: ${active ? "ACTIVE" : "INACTIVE"}; latest handover=` +
        (latest ? `${latest.relative} @ generation ${latest.record.roleGeneration}` : "none") +
        `; lease=${lease ? `${lease.lease.instanceId} generation ${lease.lease.generation}` : "none"}`,
    );
  }
}

function commandCreateAssignment(options) {
  if (!options.input || !options["issuer-session"]) {
    fail("create-assignment requires --input <path> --issuer-session <Ward Lead session id>");
  }
  const { state } = validateControlPlane();
  if (state.mode !== "steady-state") fail("Builder assignments cannot be issued before steady-state activation");
  const leadLease = readActiveLease("lead");
  if (!leadLease || leadLease.lease.instanceId !== options["issuer-session"]) {
    fail("create-assignment requires the active Ward Lead lease");
  }
  const snapshot = collectRepositorySnapshot();
  if (snapshot.status.length > 0) fail(`worktree is not clean: ${snapshot.status.join(" | ")}`);
  if (snapshot.branch !== state.integrationBranch)
    fail("Builder assignments must be issued from the integration branch");
  const draft = validateAssignmentDraft(readJson(path.resolve(repositoryRoot, options.input), options.input));
  if (draft.branch === state.integrationBranch || path.resolve(draft.worktree) === path.resolve(snapshot.worktree)) {
    fail("Builder assignment must name a branch and worktree isolated from Ward Lead integration");
  }
  const overlapsLead = draft.ownedPaths.filter((builderPath) =>
    leadLease.lease.ownedPaths.some((leadPath) => pathsOverlap(builderPath, leadPath)),
  );
  if (overlapsLead.length > 0) {
    fail(`Builder assignment overlaps Ward Lead's active task paths: ${overlapsLead.join(", ")}`);
  }
  if (!refExists(draft.baseSha) || !isAncestor(draft.baseSha, snapshot.head)) {
    fail("Builder assignment baseSha must resolve and be retained by the integration branch");
  }
  const record = validateAssignmentRecord({
    ...draft,
    kind: "ward-flow-builder-assignment",
    issuedByInstance: leadLease.lease.instanceId,
    issuedAtHead: snapshot.head,
  });
  const written = writeContentAddressedRecord(record, assignmentRelativePath(record));
  console.log(`[ward-flow-chat] ASSIGNMENT ${written.disposition.toUpperCase()}: ${written.relative}`);
  console.log("[ward-flow-chat] NEXT: review and commit only the assignment before recreating Ward Builder.");
}

function commandExportChatLog(options) {
  const chat = options.chat;
  const sessionId = options["session-id"];
  const sourceLogPath = options["source-log"];
  const archiveDirectory = options["archive-dir"];
  if (!chat || !sessionId || !sourceLogPath || !archiveDirectory) {
    fail("export-chat-log requires --chat <name> --session-id <id> --source-log <path> --archive-dir <path>");
  }
  const status = gitStatus();
  if (status.length > 0) fail(`export-chat-log requires a clean worktree: ${status.join(" | ")}`);
  const sourceAbsolute = path.resolve(sourceLogPath);
  const archiveRoot = path.resolve(archiveDirectory);
  if (!path.isAbsolute(sourceLogPath) || !existsSync(sourceAbsolute)) {
    fail("export-chat-log source log must be an existing absolute path");
  }
  const chatLogRoot = defaultClaudeLogRoot();
  if (!pathIsInside(chatLogRoot, sourceAbsolute)) {
    fail(`export-chat-log source must be below the Claude log root ${chatLogRoot}`);
  }
  if (!path.isAbsolute(archiveDirectory) || !pathIsIndependentOfRepository(archiveRoot)) {
    fail("export-chat-log archive directory must be absolute and outside every checkout and the shared Git directory");
  }
  const archivedLogPath = path.join(archiveRoot, `${sessionId}.jsonl`);
  const sourceBytes = readContainedRegularFile(chatLogRoot, sourceAbsolute, `chat source log ${sessionId}`);
  const envelope = buildChatExportEnvelope({
    chat,
    sessionId,
    sourceLogPath: sourceAbsolute,
    archivedLogPath,
    sourceBytes,
  });
  mkdirSync(archiveRoot, { recursive: true });
  if (!pathIsIndependentOfRepository(realpathSync(archiveRoot))) {
    fail("export-chat-log archive directory resolves inside a repository checkout or the shared Git directory");
  }
  if (existsSync(archivedLogPath)) {
    const archive = readIndependentRegularFile(archivedLogPath, repositoryRoot, "chat export independent archive");
    if (
      localPathIdentity(archive.realPath) === localPathIdentity(realpathSync(sourceAbsolute)) ||
      !archive.bytes.equals(sourceBytes)
    ) {
      fail(`export-chat-log refuses to overwrite a different archive at ${archivedLogPath}`);
    }
  } else {
    writeFileSync(archivedLogPath, sourceBytes, { flag: "wx" });
    readIndependentRegularFile(archivedLogPath, repositoryRoot, "chat export independent archive");
  }
  const envelopeBytes = canonicalJson(envelope);
  const relative = path.posix.join(
    "docs",
    "ward-flow",
    "control",
    "evidence",
    "chat-exports",
    `${sessionId}-${sha256(envelopeBytes)}.json`,
  );
  const absolute = path.join(repositoryRoot, ...relative.split("/"));
  mkdirSync(path.dirname(absolute), { recursive: true });
  if (existsSync(absolute) && readFileSync(absolute, "utf8") !== envelopeBytes) {
    fail(`export-chat-log refuses to overwrite different envelope bytes at ${relative}`);
  }
  if (!existsSync(absolute)) writeFileSync(absolute, envelopeBytes, { flag: "wx" });
  console.log(`[ward-flow-chat] CHAT EXPORT CREATED: ${relative}`);
  console.log(`[ward-flow-chat] CHAT EXPORT SHA256: ${sha256(envelopeBytes)}`);
  console.log(`[ward-flow-chat] INDEPENDENT RAW ARCHIVE: ${archivedLogPath}`);
  console.log(
    "[ward-flow-chat] NEXT: review both copies, add exportPath/exportSha256 to live-state.json, and commit them together.",
  );
}

function commandCaptureCheckoutArtifacts(options) {
  const sourceId = options["source-id"];
  const checkout = options.checkout;
  const sourceHead = options["source-head"];
  if (!sourceId || !checkout || !sourceHead) {
    fail("capture-checkout-artifacts requires --source-id <id> --checkout <path> --source-head <sha>");
  }
  if (!INSTANCE_PATTERN.test(sourceId)) fail("capture-checkout-artifacts source-id is invalid");
  const controlStatus = gitStatus();
  if (controlStatus.length > 0) {
    fail(`capture-checkout-artifacts requires a clean control worktree: ${controlStatus.join(" | ")}`);
  }
  const checkoutRoot = path.resolve(checkout);
  if (!path.isAbsolute(checkout) || !existsSync(checkoutRoot)) {
    fail("capture-checkout-artifacts checkout must be an existing absolute path");
  }
  if (!SHA_PATTERN.test(sourceHead) || fullSha("HEAD", checkoutRoot) !== sourceHead) {
    fail("capture-checkout-artifacts source-head must equal the checkout HEAD");
  }
  const statusEntries = gitStatusEntries(checkoutRoot);
  if (statusEntries.length === 0) fail("capture-checkout-artifacts found no dirty or untracked files");
  const pendingArtifacts = [];
  for (const entry of statusEntries) {
    const { status, path: sourcePath } = entry;
    if (status.includes("R") || status.includes("C") || status.includes("D")) {
      fail(
        `capture-checkout-artifacts cannot represent deletion/rename/copy status ${status} ${sourcePath}; ` +
          "create a dedicated local preservation commit or named bundle/ref in the source checkout before inventory, and do not discard it",
      );
    }
    const originalPath = path.resolve(checkoutRoot, ...sourcePath.split("/"));
    if (!pathIsInside(checkoutRoot, originalPath) || !existsSync(originalPath)) {
      fail(`capture-checkout-artifacts source path is missing or escapes the checkout: ${sourcePath}`);
    }
    const bytes = readContainedRegularFile(checkoutRoot, originalPath, `source artifact ${sourcePath}`);
    const contentHash = sha256(bytes);
    const safeName = path.basename(sourcePath).replace(/[^A-Za-z0-9._-]/g, "_") || "artifact";
    const artifactPath = path.posix.join(
      "docs",
      "ward-flow",
      "control",
      "evidence",
      "artifacts",
      sourceId,
      `${sha256(sourcePath).slice(0, 16)}-${contentHash}-${safeName}`,
    );
    pendingArtifacts.push({
      bytes,
      record: {
        sourcePath,
        status: status === "??" ? "untracked" : status,
        sourceSha256: contentHash,
        artifactPath,
      },
    });
  }
  const artifacts = pendingArtifacts.map((artifact) => artifact.record);
  artifacts.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  const manifest = {
    schemaVersion: 1,
    kind: "ward-flow-dirty-artifact-manifest",
    sourceId,
    head: sourceHead,
    artifacts,
  };
  const manifestBytes = canonicalJson(manifest);
  const manifestPath = path.posix.join(
    "docs",
    "ward-flow",
    "control",
    "evidence",
    "artifact-manifests",
    `${sourceId}-${sha256(manifestBytes)}.json`,
  );
  const manifestAbsolute = path.join(repositoryRoot, ...manifestPath.split("/"));
  for (const artifact of pendingArtifacts) {
    const artifactAbsolute = path.join(repositoryRoot, ...artifact.record.artifactPath.split("/"));
    mkdirSync(path.dirname(artifactAbsolute), { recursive: true });
    if (existsSync(artifactAbsolute)) {
      if (!readFileSync(artifactAbsolute).equals(artifact.bytes)) {
        fail(`capture-checkout-artifacts refuses to overwrite different bytes at ${artifact.record.artifactPath}`);
      }
    } else {
      writeFileSync(artifactAbsolute, artifact.bytes, { flag: "wx" });
    }
  }
  mkdirSync(path.dirname(manifestAbsolute), { recursive: true });
  if (existsSync(manifestAbsolute)) {
    if (readFileSync(manifestAbsolute, "utf8") !== manifestBytes) {
      fail(`capture-checkout-artifacts refuses to overwrite different bytes at ${manifestPath}`);
    }
  } else {
    writeFileSync(manifestAbsolute, manifestBytes, { flag: "wx" });
  }
  console.log(`[ward-flow-chat] ARTIFACT MANIFEST CREATED: ${manifestPath}`);
  console.log(`[ward-flow-chat] ARTIFACT MANIFEST SHA256: ${sha256(manifestBytes)}`);
  console.log(`[ward-flow-chat] PRESERVED FILES: ${artifacts.length}`);
  console.log(
    "[ward-flow-chat] NEXT: review the copies, record the manifest path/hash in live-state.json, and commit them together.",
  );
}

export function publishHandover({ source, handover, issuerSession, root = repositoryRoot }) {
  const { state } = validateControlPlane(root);
  const leadLease = readActiveLease("lead", root);
  if (!leadLease || leadLease.lease.instanceId !== issuerSession) {
    fail("publish-handover requires the active Ward Lead lease");
  }
  const snapshot = collectRepositorySnapshot(root);
  if (snapshot.status.length > 0) fail(`integration worktree is not clean: ${snapshot.status.join(" | ")}`);
  if (snapshot.branch !== state.integrationBranch) fail("handover publication must run on the integration branch");
  if (!refExists(source, root)) fail(`handover source ${source} does not resolve locally`);
  const relative = normalizeRepositoryPath(handover);
  const record = loadHandover(relative, root, { committedOnly: true, ref: source });
  if (record.role === "lead") fail("Ward Lead handovers are created directly on the integration branch");
  if (!isAncestor(record.source.head, fullSha(source, root), root)) {
    fail("handover source HEAD is not retained by the named source ref");
  }
  const roleLease = readActiveLease(record.role, root);
  if (
    !roleLease ||
    roleLease.lease.instanceId !== record.instanceId ||
    roleLease.lease.generation !== record.roleGeneration ||
    roleLease.sha256 !== record.leaseSha256 ||
    JSON.stringify(roleLease.lease.ownedPaths) !== JSON.stringify(record.task.ownedPaths.map(normalizeRepositoryPath))
  ) {
    fail("published handover does not match the active source-role lease");
  }
  const previous = latestHandover(record.role, root, {
    committedOnly: true,
    ref: state.integrationBranch,
  });
  if (
    record.previousHandover !== (previous?.relative ?? null) ||
    record.roleGeneration !== (previous?.record.roleGeneration ?? 0) + 1
  ) {
    fail("published handover does not continue the integration-branch role chain");
  }
  assertRecordDisposition(record, state, root);
  return writeContentAddressedRecord(record, relative, root);
}

function commandPublishHandover(options) {
  if (!options.source || !options.handover || !options["issuer-session"]) {
    fail("publish-handover requires --source <ref> --handover <path> --issuer-session <Ward Lead session id>");
  }
  const written = publishHandover({
    source: options.source,
    handover: options.handover,
    issuerSession: options["issuer-session"],
  });
  console.log(`[ward-flow-chat] HANDOVER PUBLISHED ${written.disposition.toUpperCase()}: ${written.relative}`);
  console.log("[ward-flow-chat] NEXT: review and commit only this handover on the integration branch.");
}

function commandCreateHandover(options) {
  const input = options.input;
  const instanceId = options["session-id"];
  if (!input || !instanceId) fail("create-handover requires --input <path> --session-id <id>");
  const { contract, state } = validateControlPlane();
  const draft = validateHandoverDraft(readJson(path.resolve(repositoryRoot, input), input), contract, state);
  const lease = readActiveLease(draft.role);
  if (!lease || lease.lease.instanceId !== instanceId) fail(`no active ${draft.role} lease matches ${instanceId}`);
  const snapshot = collectRepositorySnapshot();
  if (snapshot.status.length > 0) {
    fail(`worktree is not clean; commit or durably disposition these paths first: ${snapshot.status.join(" | ")}`);
  }
  if (!refExists(draft.task.baseSha)) fail(`task base ${draft.task.baseSha} does not resolve locally`);
  if (draft.task.baseSha !== lease.lease.head) fail("handover task baseSha must equal the active lease starting HEAD");
  if (!isAncestor(draft.task.baseSha, snapshot.head)) {
    fail(`task base ${draft.task.baseSha} is not an ancestor of source HEAD ${snapshot.head}`);
  }
  if (snapshot.branch !== lease.lease.branch || snapshot.worktree !== lease.lease.worktree) {
    fail("handover source branch and worktree must match the active role lease");
  }
  if (draft.task.completionCommit && !refExists(draft.task.completionCommit)) {
    fail(`completion commit ${draft.task.completionCommit} does not resolve locally`);
  }
  if (draft.task.status === "complete" && draft.task.completionCommit !== snapshot.head) {
    fail("a completed handover must name the current source HEAD as completionCommit");
  }
  if (JSON.stringify(draft.task.ownedPaths.map(normalizeRepositoryPath)) !== JSON.stringify(lease.lease.ownedPaths)) {
    fail("handover task ownedPaths must exactly match the active role lease");
  }
  const changedPaths = diffChanges(draft.task.baseSha, snapshot.head);
  const parkedArtifact =
    draft.role === "builder" &&
    draft.integration.status === "parked" &&
    draft.integration.durableCheckpoint.kind === "artifact"
      ? [draft.integration.durableCheckpoint.ref]
      : [];
  validateRoleDiff(draft.role, draft.task, changedPaths, { extraAllowedPaths: parkedArtifact });
  if (draft.role === "builder") {
    if (lease.lease.assignment !== normalizeRepositoryPath(draft.task.assignmentPath)) {
      fail("Builder handover assignment does not match its active lease");
    }
    const assignment = loadCommittedAssignment(draft.task.assignmentPath, state);
    validateBuilderTaskAgainstAssignment(draft.task, assignment);
  } else if (draft.role === "verifier" && draft.task.verificationTarget !== lease.lease.targetSha) {
    fail("Verifier handover target does not match the active frozen-target lease");
  }
  const previous = latestHandover(draft.role, repositoryRoot, {
    committedOnly: true,
    ref: state.integrationBranch,
  });
  if ((previous?.relative ?? null) !== lease.lease.previousHandover) {
    fail("active lease predecessor does not match the current committed handover chain");
  }
  if (lease.lease.generation !== (previous?.record.roleGeneration ?? 0) + 1) {
    fail("active lease generation does not continue the integration-branch handover chain");
  }
  const existingGeneration = listHandoverPaths()
    .map((relative) => loadHandover(relative))
    .some((record) => record.role === draft.role && record.roleGeneration === lease.lease.generation);
  if (existingGeneration) fail(`handover generation ${lease.lease.generation} already exists for ${draft.role}`);
  const record = validateHandoverRecord(
    buildHandoverRecord({ draft, snapshot, lease, previousHandover: previous?.relative ?? null }),
  );
  assertRecordDisposition(record, state);
  const written = writeHandoverRecord(record);
  console.log(`[ward-flow-chat] HANDOVER ${written.disposition.toUpperCase()}: ${written.relative}`);
  if (draft.role === "lead") {
    console.log("[ward-flow-chat] NEXT: review and commit only the handover, then run certify-reset.");
  } else {
    console.log(
      "[ward-flow-chat] NEXT: commit only the handover on this source branch, then Ward Lead must publish its exact bytes to the integration branch.",
    );
  }
}

function assertResetSourceUnchanged(record, handoverPath, integrationRoot) {
  const sourceRoot = path.resolve(requireString(record.source.worktree, "handover source worktree"));
  if (!path.isAbsolute(record.source.worktree) || !existsSync(sourceRoot)) {
    fail("handover source worktree must remain available at its recorded absolute path");
  }
  const topLevel = git(["rev-parse", "--show-toplevel"], { cwd: sourceRoot }).trim();
  if (localPathIdentity(realpathSync(topLevel)) !== localPathIdentity(realpathSync(sourceRoot))) {
    fail("handover source worktree no longer resolves to its recorded Git worktree root");
  }
  const branch = git(["branch", "--show-current"], { cwd: sourceRoot }).trim() || "DETACHED";
  if (branch !== record.source.branch) {
    fail(`handover source branch drifted: expected ${record.source.branch}, found ${branch}`);
  }
  const status = gitStatus(sourceRoot);
  if (status.length > 0) fail(`handover source worktree is no longer clean: ${status.join(" | ")}`);
  if (record.role === "lead") {
    if (localPathIdentity(realpathSync(sourceRoot)) !== localPathIdentity(realpathSync(integrationRoot))) {
      fail("Ward Lead handover source must be the integration worktree");
    }
    return;
  }
  const sourceTip = fullSha("HEAD", sourceRoot);
  if (!pathExistsAtRef(handoverPath, sourceTip, sourceRoot)) {
    fail("handover source tip no longer contains the committed handover");
  }
  const sourceHandoverBytes = headFile(handoverPath, sourceRoot, { ref: sourceTip, encoding: "buffer" });
  if (!sourceHandoverBytes.equals(Buffer.from(canonicalJson(record)))) {
    fail("handover source tip contains different handover bytes");
  }
  assertSinglePurposeCommit(record.source.head, sourceTip, handoverPath, "source handover commit", sourceRoot);
}

export function certifyReset({ handover, root = repositoryRoot }) {
  if (!handover) fail("certify-reset requires a handover path");
  const { state } = validateControlPlane(root);
  const snapshot = collectRepositorySnapshot(root);
  if (snapshot.branch !== state.integrationBranch) {
    fail(`certify-reset must run from the integration branch ${state.integrationBranch}`);
  }
  const relative = normalizeRepositoryPath(handover);
  if (!pathExistsAtRef(relative, "HEAD", root)) fail("handover is not committed at HEAD");
  const record = loadHandover(relative, root, { committedOnly: true });
  const headBytes = headFile(relative, root, { encoding: "buffer" });
  const workingBytes = readFileSync(path.join(root, ...relative.split("/")));
  if (!headBytes.equals(workingBytes)) fail("handover bytes at HEAD differ from the working file");
  const status = gitStatus(root);
  if (status.length > 0) fail(`worktree is not clean: ${status.join(" | ")}`);
  if (!refExists(record.source.head, root)) fail(`handover source ${record.source.head} no longer resolves locally`);
  const latest = latestHandover(record.role, root, { committedOnly: true, ref: state.integrationBranch });
  if (!latest || latest.relative !== relative) fail("handover is not the newest committed record for its role");
  assertPathIntroducedAlone(relative, state.integrationBranch, "handover", root);
  const activeLease = readActiveLease(record.role, root);
  if (
    !activeLease ||
    activeLease.lease.instanceId !== record.instanceId ||
    activeLease.lease.generation !== record.roleGeneration ||
    activeLease.sha256 !== record.leaseSha256 ||
    JSON.stringify(activeLease.lease.ownedPaths) !== JSON.stringify(record.task.ownedPaths.map(normalizeRepositoryPath))
  ) {
    fail("active role lease does not match the handover instance, generation and bytes");
  }
  assertResetSourceUnchanged(record, relative, root);
  assertRecordDisposition(record, state, root);
  const committedCertificate = certificateForHandover(latest, root, {
    committedOnly: true,
    ref: state.integrationBranch,
  });
  if (committedCertificate) {
    validateCertificateAgainstHandover(committedCertificate, latest, root, state.integrationBranch);
    assertSinglePurposeCommit(
      committedCertificate.certificate.certificationHead,
      fullSha(state.integrationBranch, root),
      committedCertificate.relative,
      "reset certificate commit",
      root,
    );
    retireLease(record, root);
    return { record, relative, certificate: committedCertificate.relative, safe: true };
  }
  const certificate = validateResetCertificate({
    schemaVersion: 1,
    kind: "ward-flow-reset-certificate",
    certifiedAt: new Date().toISOString(),
    certificationHead: fullSha("HEAD", root),
    handoverPath: relative,
    handoverSha256: sha256(canonicalJson(record)),
    role: record.role,
    roleGeneration: record.roleGeneration,
    instanceId: record.instanceId,
    checks: [
      "handover-committed",
      "handover-current",
      "worktree-clean",
      "source-retained",
      "role-lease-matched",
      "disposition-proven",
    ],
  });
  const written = writeContentAddressedRecord(certificate, certificateRelativePath(certificate), root);
  return { record, relative, certificate: written.relative, safe: false };
}

function commandCertifyReset(options) {
  if (!options.handover) fail("certify-reset requires --handover <path>");
  const { record, relative, certificate, safe } = certifyReset({ handover: options.handover });
  if (!safe) {
    console.log(`[ward-flow-chat] RESET CERTIFICATE CREATED: ${certificate}`);
    console.log(
      "[ward-flow-chat] NOT SAFE TO RESET: review and commit only the certificate, then rerun certify-reset.",
    );
    return;
  }
  console.log(
    `[ward-flow-chat] SAFE TO RESET: ${record.sessionLabel} handover ${path.basename(relative, HANDOVER_SUFFIX)} ` +
      "is committed, current, and repository-clean.",
  );
  console.log(`[ward-flow-chat] CERTIFICATE: ${certificate}`);
  const recreate = {
    lead: "node scripts/ward-flow/chat-control.mjs recreate --role lead --session-id <new-session-id> --owned-paths <comma-separated-exact-task-paths>",
    builder:
      "node scripts/ward-flow/chat-control.mjs recreate --role builder --session-id <new-session-id> --assignment <new-committed-assignment-path>",
    verifier:
      "node scripts/ward-flow/chat-control.mjs recreate --role verifier --session-id <new-session-id> --target-sha <full-frozen-commit-sha>",
  }[record.role];
  console.log(`[ward-flow-chat] RECREATE TEMPLATE: ${recreate}`);
}

export function assertFrozenVerifierCheckout(snapshot, targetSha) {
  if (snapshot.head !== targetSha) {
    fail(`Ward Verifier checkout HEAD ${snapshot.head} does not equal frozen target ${targetSha}`);
  }
}

function commandRecreate(options) {
  const role = options.role;
  if (!ROLE_IDS.includes(role)) fail("recreate requires --role lead|builder|verifier");
  const instanceId = options["session-id"];
  if (!instanceId) fail("recreate requires --session-id <stable local chat id>");
  const { contract, state } = validateControlPlane();
  if (!state.activeRoles.includes(role)) {
    fail(`role ${role} is inactive in ${state.mode} mode: ${state.builderActivationGate.instruction}`);
  }
  const roleContract = contract.roles.find((candidate) => candidate.id === role);
  const template = readFileSync(path.join(promptDirectory, `${role}.md`), "utf8");
  const handover = latestCertifiedHandover(role, state);
  const snapshot = collectRepositorySnapshot();
  if (snapshot.status.length > 0)
    fail("recreate requires a clean checkout so staged or unsaved state cannot masquerade as truth");
  if (role === "lead" && snapshot.branch !== state.integrationBranch) {
    fail(`Ward Lead must be recreated on integration branch ${state.integrationBranch}`);
  }
  let assignment = null;
  let criterion = null;
  let targetSha = null;
  let ownedPaths = [];
  if (role === "lead") {
    if (!options["owned-paths"]) {
      fail("Ward Lead recreation requires --owned-paths with comma-separated exact task paths");
    }
    ownedPaths = options["owned-paths"]
      .split(",")
      .map((value) => normalizeRepositoryPath(value.trim()))
      .filter(Boolean);
    if (ownedPaths.length === 0) fail("Ward Lead must lease at least one exact task path");
  }
  if (role === "builder") {
    if (!options.assignment) fail("Ward Builder recreation requires --assignment <committed assignment path>");
    assignment = loadCommittedAssignment(options.assignment, state);
    if (assignment.record.branch === state.integrationBranch) {
      fail("Ward Builder assignment branch must be isolated from the integration branch");
    }
    if (snapshot.branch !== assignment.record.branch || snapshot.worktree !== assignment.record.worktree) {
      fail("Ward Builder checkout does not match the committed assignment branch and worktree");
    }
    if (assignment.record.baseSha !== snapshot.head) {
      fail("Ward Builder must acquire its lease before changing the assigned base checkout");
    }
    ownedPaths = assignment.record.ownedPaths;
  } else if (role === "verifier") {
    targetSha = options["target-sha"];
    if (!targetSha || !SHA_PATTERN.test(targetSha) || !refExists(targetSha)) {
      fail("Ward Verifier recreation requires --target-sha with a locally resolving full commit SHA");
    }
    if (!options.criterion) {
      fail(
        "Ward Verifier recreation requires --criterion <committed criterion path>; " +
          "a target SHA names WHICH commit to decide and says nothing about WHAT is being decided",
      );
    }
    criterion = loadCommittedCriterion(options.criterion, state);
    assertFrozenVerifierCheckout(snapshot, targetSha);
  }
  const generation = (handover?.record.roleGeneration ?? 0) + 1;
  const lease = acquireLease({
    role,
    instanceId,
    generation,
    snapshot,
    handover,
    assignment,
    criterion,
    targetSha,
    ownedPaths,
  });
  console.log(buildRecreationPrompt({ roleContract, state, template, handover, snapshot, lease, assignment }));
}

function usage() {
  console.log(`Usage:
  node scripts/ward-flow/chat-control.mjs validate
  node scripts/ward-flow/chat-control.mjs status
  node scripts/ward-flow/chat-control.mjs export-chat-log --chat <name> --session-id <id> --source-log <path> --archive-dir <path>
  node scripts/ward-flow/chat-control.mjs capture-checkout-artifacts --source-id <id> --checkout <path> --source-head <sha>
  node scripts/ward-flow/chat-control.mjs create-assignment --input <draft.json> --issuer-session <id>
  node scripts/ward-flow/chat-control.mjs create-handover --input <draft.json> --session-id <id>
  node scripts/ward-flow/chat-control.mjs publish-handover --source <ref> --handover <record.json> --issuer-session <id>
  node scripts/ward-flow/chat-control.mjs certify-reset --handover <record.json>
  node scripts/ward-flow/chat-control.mjs recreate --role lead|builder|verifier --session-id <id> [--owned-paths <paths>] [--assignment <path>] [--target-sha <sha> --criterion <path>]`);
}

async function main() {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    usage();
    if (!command) process.exitCode = 1;
    return;
  }
  const options = parseOptions(tokens);
  if (command === "validate") commandValidate();
  else if (command === "status") commandStatus();
  else if (command === "export-chat-log") commandExportChatLog(options);
  else if (command === "capture-checkout-artifacts") commandCaptureCheckoutArtifacts(options);
  else if (command === "create-assignment") commandCreateAssignment(options);
  else if (command === "create-handover") commandCreateHandover(options);
  else if (command === "publish-handover") commandPublishHandover(options);
  else if (command === "certify-reset") commandCertifyReset(options);
  else if (command === "recreate") commandRecreate(options);
  else fail(`unknown command ${command}`);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[ward-flow-chat] REFUSED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
