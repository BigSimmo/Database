#!/usr/bin/env node
/**
 * guard-push — pre-push safety net for this repo's known, repeated traps.
 *
 * Runs three independent guards; any one can BLOCK the push (non-zero exit) and
 * each honours an explicit override env var so you are never truly stuck:
 *
 *   1. Auto-merge race sentinel (claude/* branches only)
 *      This repo auto-merges claude/* PRs on green. Pushing a late follow-up
 *      commit to a PR whose auto-merge is already armed races the merge and has
 *      orphaned commits before. If `gh` reports an armed autoMergeRequest for the
 *      current branch's open PR, block. Override: ALLOW_AUTOMERGE_PUSH=1.
 *      Fails OPEN (never blocks) when gh is missing/unauthenticated, so
 *      contributors without gh can still push.
 *
 *   2. Format-before-push
 *      verify:cheap does NOT run format:check but CI requires it, so unformatted
 *      files reach CI and fail there. Reproduces what CI sees: the pushed blobs
 *      *and* the pushed prettier config are materialised into a scratch tree and
 *      checked there. Neither half can come from the working copy — formatting
 *      after committing, or correcting a committed config without committing the
 *      correction, both left the guard green and CI red.
 *      Override: SKIP_FORMAT_GUARD=1.
 *
 *   3. Drift-manifest freshness
 *      Editing supabase/schema.sql without regenerating supabase/drift-manifest.json
 *      fails check:drift in CI. Caught here at push time instead. Override:
 *      SKIP_DRIFT_GUARD=1.
 *
 * The .githooks/pre-push hook invokes this with the raw `git push` stdin (lines of
 * "<localRef> <localSha> <remoteRef> <remoteSha>"). Run `--self-test` for the
 * offline unit checks used by tests/guard-push.test.ts.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ZERO_SHA = "0000000000000000000000000000000000000000";
const SCHEMA_PATH = "supabase/schema.sql";
const MANIFEST_PATH = "supabase/drift-manifest.json";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * sha256 over CRLF-normalized schema text. MUST stay byte-identical to
 * normalizedSchemaSha256() in scripts/check-drift.ts — tests/guard-push.test.ts
 * asserts parity so the two cannot silently diverge.
 */
export function normalizedSchemaSha256(schemaSqlText) {
  return createHash("sha256").update(schemaSqlText.replace(/\r\n/g, "\n")).digest("hex");
}

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function tryGit(args) {
  try {
    return runGit(args);
  } catch {
    return undefined;
  }
}

function currentBranch() {
  return tryGit(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "";
}

/**
 * Resolve the set of files being pushed from the pre-push stdin payload. Each
 * line is "<localRef> <localSha> <remoteRef> <remoteSha>". For a brand-new remote
 * branch (remoteSha all-zero) we diff against origin/main so we still see the new
 * work rather than the whole history. Deletion pushes (local sha all-zero) are
 * dropped, so an empty array means "nothing to check".
 */
export function parsePushRanges(stdinText) {
  const ranges = [];
  for (const raw of stdinText.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const [localRef, localSha, , remoteSha] = line.split(/\s+/);
    if (!localSha || localSha === ZERO_SHA) continue; // branch deletion — nothing to push
    ranges.push({ localRef, localSha, remoteSha: remoteSha ?? ZERO_SHA });
  }
  return ranges;
}

function changedFilesForRange(range) {
  const base =
    range.remoteSha && range.remoteSha !== ZERO_SHA
      ? range.remoteSha
      : tryGit(["rev-parse", "--verify", "--quiet", "origin/main"])
        ? "origin/main"
        : undefined;
  const spec = base ? `${base}..${range.localSha}` : range.localSha;
  const out = base
    ? tryGit(["diff", "--name-only", spec])
    : tryGit(["show", "--name-only", "--pretty=format:", range.localSha]);
  if (!out) return [];
  return out
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

function collectChangedFiles(ranges) {
  const files = new Set();
  for (const range of ranges) {
    for (const file of changedFilesForRange(range)) files.add(file);
  }
  return [...files];
}

/**
 * Changed files paired with the commit they are being pushed at.
 *
 * A push sends commits, not the working tree. Checking `<file>` on disk lets a
 * formatted working copy vouch for an unformatted committed blob: commit
 * `const a   =    1`, run `npm run format`, and `prettier --check <path>` passes
 * while `git show HEAD:<path>` is still unformatted — so the guard went green and
 * CI failed anyway. Carry the sha so the guard can read what is actually pushed.
 */
function collectChangedBlobs(ranges) {
  const seen = new Map();
  for (const range of ranges) {
    for (const file of changedFilesForRange(range)) {
      seen.set(`${range.localSha}:${file}`, { sha: range.localSha, file });
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Guard 1: auto-merge race sentinel
// ---------------------------------------------------------------------------
function ghIsAvailable() {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Exported for tests: decide from a parsed `gh pr view` payload. */
export function autoMergeVerdict(branch, prPayload) {
  if (!branch.startsWith("claude/")) return { block: false, reason: "not-a-claude-branch" };
  if (!prPayload) return { block: false, reason: "no-open-pr" };
  if (prPayload.state && prPayload.state !== "OPEN") return { block: false, reason: "pr-not-open" };
  if (prPayload.autoMergeRequest) {
    return { block: true, reason: "auto-merge-armed", number: prPayload.number };
  }
  return { block: false, reason: "auto-merge-not-armed" };
}

function autoMergeGuard(branch) {
  if (process.env.ALLOW_AUTOMERGE_PUSH === "1") {
    return { name: "auto-merge", ok: true, skipped: "ALLOW_AUTOMERGE_PUSH=1" };
  }
  if (!branch.startsWith("claude/")) return { name: "auto-merge", ok: true };
  if (!ghIsAvailable()) {
    return { name: "auto-merge", ok: true, note: "gh not available — auto-merge check skipped (fail-open)" };
  }
  let payload;
  try {
    const raw = execFileSync("gh", ["pr", "view", "--json", "autoMergeRequest,state,number"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    payload = JSON.parse(raw);
  } catch {
    // No PR for this branch, or gh unauthenticated: fail open.
    return { name: "auto-merge", ok: true, note: "no open PR resolvable — auto-merge check skipped" };
  }
  const verdict = autoMergeVerdict(branch, payload);
  if (verdict.block) {
    return {
      name: "auto-merge",
      ok: false,
      message:
        `PR #${verdict.number} on ${branch} has auto-merge ARMED.\n` +
        `  Pushing now races the squash-merge and can orphan this commit (it has happened before).\n` +
        `  Let the armed merge land first, or disable auto-merge on the PR, then push.\n` +
        `  To push anyway: ALLOW_AUTOMERGE_PUSH=1 git push`,
    };
  }
  return { name: "auto-merge", ok: true };
}

// ---------------------------------------------------------------------------
// Guard 2: format-before-push
// ---------------------------------------------------------------------------
function fileSha256(file) {
  try {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
  } catch {
    return undefined;
  }
}

function worktreeRoots() {
  const output = tryGit(["worktree", "list", "--porcelain"]);
  if (!output) return [];
  return output
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length).trim());
}

/**
 * Find Prettier only in a dependency tree produced from this exact lockfile.
 *
 * Isolated worktrees commonly junction a sibling node_modules tree. The push
 * guard must work before that junction exists, but accepting an arbitrary
 * sibling would let a stale Prettier version disagree with CI. Byte-identical
 * lockfiles plus the installed package version make the fallback deterministic.
 */
export function findPrettierBin(projectRoot, candidateRoots) {
  const lockPath = path.join(projectRoot, "package-lock.json");
  const lockSha = fileSha256(lockPath);
  let lockedVersion;
  try {
    lockedVersion = JSON.parse(readFileSync(lockPath, "utf8")).packages?.["node_modules/prettier"]?.version;
  } catch {
    return undefined;
  }
  if (!lockSha || !lockedVersion) return undefined;

  const roots = [projectRoot, ...candidateRoots.filter((root) => path.resolve(root) !== path.resolve(projectRoot))];
  for (const root of roots) {
    if (fileSha256(path.join(root, "package-lock.json")) !== lockSha) continue;
    const packageRoot = path.join(root, "node_modules", "prettier");
    const prettierBin = path.join(packageRoot, "bin", "prettier.cjs");
    if (!existsSync(prettierBin)) continue;
    try {
      if (JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")).version === lockedVersion) {
        return prettierBin;
      }
    } catch {
      // An incomplete candidate is not a usable dependency source.
    }
  }
  return undefined;
}

function resolvePrettierBin() {
  const prettierBin = findPrettierBin(PROJECT_ROOT, worktreeRoots());
  if (!prettierBin) {
    throw new Error("no exact-lock worktree provides node_modules/prettier");
  }
  return prettierBin;
}

/**
 * Does this path decide Prettier's verdict for files other than itself?
 *
 * Matched on the basename so a nested config counts too. When one of these
 * changes, the verdict for *unchanged* files can change with it — a `tabWidth`
 * edit can make existing source fail CI's repository-wide `prettier --check .`
 * while a changed-paths-only check passes — so a policy change escalates to a
 * whole-tree check.
 */
/** Does `<ref>:<file>` parse as JSON carrying a top-level `prettier` field? */
function carriesPrettierField(ref, file) {
  const contents = tryGit(["show", `${ref}:${file}`]);
  if (contents === undefined) return false; // absent at this ref (or no such ref)
  try {
    return JSON.parse(contents).prettier !== undefined;
  } catch {
    // Unparseable: assume it is policy rather than assume it is not.
    return true;
  }
}

/**
 * Does this path decide Prettier's verdict for files other than itself?
 *
 * A package.json counts only when it actually carries a `prettier` field —
 * matching every package.json would send each routine dependency bump through a
 * whole-tree check it cannot possibly need. **Both endpoints are inspected**, not
 * just the pushed one: adding a field and removing one each re-decide the verdict
 * for untouched files, and reading only the pushed side misses the removal (drop
 * `tabWidth: 4` and four-space-formatted source starts failing CI).
 */
function isPrettierPolicyFile(file, sha) {
  const base = path.basename(file);
  if (/^(?:\.prettierrc(?:\..+)?|prettier\.config\.(?:js|cjs|mjs|ts)|\.prettierignore|\.editorconfig)$/.test(base)) {
    return true;
  }
  if (base !== "package.json") return false;
  return carriesPrettierField(sha, file) || carriesPrettierField(`${sha}^`, file);
}

/**
 * Check the pushed commit the way CI does: in a real checkout of it.
 *
 * A worktree is what makes the verdict trustworthy, and it is cheap (<1s here).
 * Every earlier attempt leaked working-tree state into the answer:
 * - checking `<file>` on disk let a formatted working copy vouch for an
 *   unformatted committed blob (a push sends commits, not the working tree)
 * - piping committed blobs through stdin still resolved `.prettierrc` from disk,
 *   so a committed-broken/tree-corrected config passed here and failed CI
 * - hand-staging config files could not evaluate a dynamic `prettier.config.mjs`
 *   at all, because it may import plugins from `node_modules`
 * A checkout with `node_modules` linked in has none of those gaps.
 */
function checkPushedCommit(prettierBin, sha, files) {
  tryGit(["worktree", "prune"]); // clear any worktree a crashed run left behind
  const dir = mkdtempSync(path.join(tmpdir(), "guard-push-format-"));
  rmSync(dir, { recursive: true, force: true }); // `git worktree add` wants a fresh path
  try {
    execFileSync("git", ["worktree", "add", "--detach", "--quiet", dir, sha], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (error) {
    // Fail CLOSED. Being unable to check is not evidence that the push is clean,
    // and SKIP_FORMAT_GUARD=1 is the escape hatch when this is genuinely stuck.
    const detail = (error?.stderr ? error.stderr.toString() : "").trim();
    return {
      verdict: "error",
      detail: `could not check out ${sha} to verify formatting${detail ? `: ${detail}` : ""}`,
    };
  }
  try {
    // The Prettier doing the checking is this checkout's, not the pushed
    // lockfile's. That only matters when the push changes dependencies — then a
    // version difference can make CI disagree with this verdict, so say so rather
    // than answer confidently with the wrong Prettier.
    if (files.some((file) => ["package.json", "package-lock.json"].includes(path.basename(file)))) {
      const mismatch = prettierVersionMismatch(prettierBin, dir);
      if (mismatch) return { verdict: "error", detail: mismatch };
    }
    // A dynamic config may import plugins; without this it cannot load at all.
    const modules = path.dirname(path.dirname(path.dirname(prettierBin)));
    try {
      symlinkSync(modules, path.join(dir, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      return {
        verdict: "error",
        detail: `could not link the exact-lock dependency tree into the formatting checkout: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const policyChanged = files.some((file) => isPrettierPolicyFile(file, sha));
    // Deleted paths are gone from the checkout, and prettier errors on a missing
    // argument, so ask only for what is actually there.
    const present = files.filter((file) => existsSync(path.join(dir, file)));
    if (!policyChanged && present.length === 0) return { verdict: "formatted" };
    // A policy change alters the verdict for files this push never touched, so
    // check the whole tree — exactly what CI's `prettier --check .` does.
    const batches = policyChanged ? [["."]] : chunk(present, 200);
    for (const batch of batches) {
      const result = runPrettierCheck(prettierBin, dir, batch);
      if (result.verdict !== "formatted") return result;
    }
    return { verdict: "formatted" };
  } finally {
    tryGit(["worktree", "remove", "--force", dir]);
    rmSync(dir, { recursive: true, force: true });
  }
}

function chunk(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/**
 * Does the pushed lockfile pin a different Prettier than the one installed?
 *
 * The guard formats with this checkout's Prettier while CI installs the pushed
 * lockfile, so a push that bumps Prettier itself would be judged by the wrong
 * version. Returns a message when they disagree, and null when they agree or when
 * either version cannot be read — an unknown must not manufacture a block.
 */
function prettierVersionMismatch(prettierBin, checkoutDir) {
  const readJson = (file) => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return undefined;
    }
  };
  const installed = readJson(path.join(path.dirname(path.dirname(prettierBin)), "package.json"))?.version;
  const pinned = readJson(path.join(checkoutDir, "package-lock.json"))?.packages?.["node_modules/prettier"]?.version;
  if (!installed || !pinned || installed === pinned) return null;
  return (
    `node_modules has prettier ${installed}, but the pushed lockfile pins ${pinned}, so this ` +
    `check would not match CI. Run \`npm ci\` and push again.`
  );
}

/** Prettier: 0 clean, 1 unformatted, anything else a real failure. */
function runPrettierCheck(prettierBin, cwd, args) {
  try {
    execFileSync(process.execPath, [prettierBin, "--check", "--ignore-unknown", ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { verdict: "formatted" };
  } catch (error) {
    const detail = [error?.stdout, error?.stderr]
      .map((buffer) => (buffer ? buffer.toString() : ""))
      .join("")
      .trim();
    // An invalid config option also exits 1 under --check, reported as
    // `[error] Invalid tabWidth value…`, so the status alone cannot tell a
    // formatting difference from a broken config.
    if (error?.status === 1 && !detail.includes("[error]")) return { verdict: "unformatted", detail };
    // A malformed or unloadable config in the push fails CI's `prettier --check .`
    // for the same reason. Treating it as "unknown, allow" is how the guard would
    // wave through the break it exists to catch.
    return { verdict: "error", detail: detail || `prettier exited ${error?.status ?? "non-zero"}` };
  }
}

export function formatGuard(changedBlobs, prettierResolver = resolvePrettierBin) {
  if (process.env.SKIP_FORMAT_GUARD === "1") {
    return { name: "format", ok: true, skipped: "SKIP_FORMAT_GUARD=1" };
  }
  if (changedBlobs.length === 0) return { name: "format", ok: true };
  let prettierBin;
  try {
    prettierBin = prettierResolver();
  } catch (error) {
    return {
      name: "format",
      ok: false,
      message:
        `Prettier is unavailable for this exact lockfile, so formatting cannot be verified before push.\n` +
        `  ${error instanceof Error ? error.message : String(error)}\n` +
        `  Run \`npm ci --include=dev\` in this worktree, or make an exact-lock worktree dependency tree available.\n` +
        `  To push anyway: SKIP_FORMAT_GUARD=1 git push`,
    };
  }

  const bySha = new Map();
  for (const { sha, file } of changedBlobs) {
    if (!bySha.has(sha)) bySha.set(sha, []);
    bySha.get(sha).push(file);
  }

  const unformatted = [];
  const errors = [];
  for (const [sha, files] of bySha) {
    const { verdict, detail } = checkPushedCommit(prettierBin, sha, files);
    if (verdict === "unformatted") unformatted.push(detail);
    else if (verdict === "error") errors.push(detail);
  }

  if (errors.length > 0) {
    return {
      name: "format",
      ok: false,
      message:
        `Prettier could not check this push, so CI's \`prettier --check .\` will fail too:\n` +
        errors.map((detail) => `${detail}\n`).join("") +
        `  A malformed prettier config in the push is the usual cause.\n` +
        `  To push anyway: SKIP_FORMAT_GUARD=1 git push`,
    };
  }
  if (unformatted.length === 0) return { name: "format", ok: true };
  return {
    name: "format",
    ok: false,
    message:
      `Prettier found unformatted files in this push (CI format:check would fail):\n` +
      unformatted.map((detail) => `${detail}\n`).join("") +
      `  This is a checkout of the pushed commit, not your working copy — run\n` +
      `  \`npm run format\` and commit the result.\n` +
      `  To push anyway: SKIP_FORMAT_GUARD=1 git push`,
  };
}

// ---------------------------------------------------------------------------
// Guard 3: drift-manifest freshness
// ---------------------------------------------------------------------------
/** Exported for tests: pure comparison of schema text vs the manifest's sha. */
export function driftVerdict(schemaText, manifestJson) {
  const expected = manifestJson?.schema_sha256;
  const actual = normalizedSchemaSha256(schemaText);
  return { stale: Boolean(expected) && expected !== actual, expected, actual };
}

function driftGuard(changedFiles) {
  if (process.env.SKIP_DRIFT_GUARD === "1") {
    return { name: "drift", ok: true, skipped: "SKIP_DRIFT_GUARD=1" };
  }
  const schemaTouched = changedFiles.some((f) => f.replaceAll("\\", "/") === SCHEMA_PATH);
  if (!schemaTouched) return { name: "drift", ok: true };
  if (!existsSync(SCHEMA_PATH) || !existsSync(MANIFEST_PATH)) return { name: "drift", ok: true };
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { name: "drift", ok: true, note: "drift-manifest.json unreadable — drift check skipped" };
  }
  const verdict = driftVerdict(readFileSync(SCHEMA_PATH, "utf8"), manifest);
  if (verdict.stale) {
    return {
      name: "drift",
      ok: false,
      message:
        `${SCHEMA_PATH} changed but ${MANIFEST_PATH} is stale (check:drift would fail).\n` +
        `  schema sha:   ${verdict.actual}\n` +
        `  manifest sha: ${verdict.expected}\n` +
        `  Regenerate with: npm run drift:manifest (needs Docker)\n` +
        `  To push anyway: SKIP_DRIFT_GUARD=1 git push`,
    };
  }
  return { name: "drift", ok: true };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
function report(results) {
  const blocked = results.filter((r) => !r.ok);
  for (const r of results) {
    if (r.skipped) console.error(`[guard-push] ${r.name}: skipped (${r.skipped})`);
    else if (r.note) console.error(`[guard-push] ${r.name}: ${r.note}`);
  }
  if (blocked.length === 0) return 0;
  console.error("\n[guard-push] Push blocked:\n");
  for (const r of blocked) console.error(`✖ ${r.name}\n  ${r.message}\n`);
  return 1;
}

function main() {
  if (process.argv.includes("--self-test")) {
    return selfTest();
  }
  const stdin = readStdinSync();
  const ranges = parsePushRanges(stdin);
  if (ranges.length === 0) process.exit(0); // deletion-only push or nothing to do
  const branch = currentBranch();
  const changedFiles = collectChangedFiles(ranges);
  // formatGuard reads the pushed blobs; driftGuard only needs the paths.
  const results = [autoMergeGuard(branch), formatGuard(collectChangedBlobs(ranges)), driftGuard(changedFiles)];
  process.exit(report(results));
}

function readStdinSync() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Self-test: offline assertions on the pure decision functions.
// ---------------------------------------------------------------------------
function assert(condition, label) {
  if (!condition) {
    console.error(`✖ self-test failed: ${label}`);
    process.exitCode = 1;
    throw new Error(label);
  }
}

function selfTest() {
  // auto-merge verdicts
  assert(autoMergeVerdict("main", { autoMergeRequest: {} }).block === false, "non-claude branch never blocks");
  assert(
    autoMergeVerdict("claude/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 7 }).block === true,
    "armed auto-merge on claude/* blocks",
  );
  assert(
    autoMergeVerdict("claude/x", { autoMergeRequest: null, state: "OPEN" }).block === false,
    "unarmed does not block",
  );
  assert(autoMergeVerdict("claude/x", null).block === false, "no PR does not block");
  assert(
    autoMergeVerdict("claude/x", { autoMergeRequest: {}, state: "MERGED" }).block === false,
    "non-open PR does not block",
  );

  // drift verdicts
  const text = "create table t();\n";
  const sha = normalizedSchemaSha256(text);
  assert(driftVerdict(text, { schema_sha256: sha }).stale === false, "matching sha is fresh");
  assert(driftVerdict(text, { schema_sha256: "deadbeef" }).stale === true, "mismatched sha is stale");
  assert(driftVerdict(text, {}).stale === false, "no manifest sha is treated as fresh (no false block)");
  assert(normalizedSchemaSha256("a\r\nb") === normalizedSchemaSha256("a\nb"), "CRLF normalization matches LF");

  // push-range parsing
  const ranges = parsePushRanges(`refs/heads/x abc123 refs/heads/x ${ZERO_SHA}\n`);
  assert(ranges.length === 1 && ranges[0].remoteSha === ZERO_SHA, "new-branch range parsed");
  assert(parsePushRanges(`refs/heads/x ${ZERO_SHA} refs/heads/x abc\n`).length === 0, "deletion range skipped");

  const missingPrettier = formatGuard([{ sha: "abc123", file: "README.md" }], () => {
    throw new Error("missing fixture dependency");
  });
  assert(missingPrettier.ok === false, "missing Prettier fails the format guard closed");

  if (process.exitCode !== 1) console.error("[guard-push] self-test passed");
  return process.exitCode ?? 0;
}

// Only run as a CLI when invoked directly — importing (tests) must not exit.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
