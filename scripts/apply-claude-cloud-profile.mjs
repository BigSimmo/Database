#!/usr/bin/env node
/**
 * apply-claude-cloud-profile — materialise .claude/cloud-profile/ into the container's ~/.claude.
 *
 * Claude Code on the web starts from a bare Linux container holding the repository checkout and
 * nothing else. Everything that lives in the operator's Windows home directory — the personal
 * CLAUDE.md writing-style file, the enabled user skills, this project's saved memories, and the
 * user-level settings that turn on auto permission mode and the four plugins — is absent, so a cloud
 * session behaves noticeably differently from a local one. The repository cannot reach into that home
 * directory, so the durable fix is to carry a copy in-tree (.claude/cloud-profile/) and unpack it into
 * the container at SessionStart. That directory is the source of truth for the container; the
 * container is disposable.
 *
 * SAFETY — this writes outside the repository, so it is deliberately narrow:
 *   - It refuses to run unless CLAUDE_CODE_REMOTE=true, or --force is passed explicitly. A local
 *     Windows workstation must never have its real ~/.claude overwritten by a checked-in snapshot.
 *   - Memory files are copied only when absent. Memories the container writes during a session are
 *     newer than the snapshot and must win; clobbering them would silently delete work.
 *   - ~/.claude/settings.json is DEEP-MERGED, not replaced, with the profile winning per key, so
 *     anything the platform put there (auth state, machine ids, feature flags) survives.
 *   - An existing ~/.claude/CLAUDE.md is backed up once to CLAUDE.md.pre-cloud-profile before the
 *     profile copy replaces it, so nothing is lost irrecoverably.
 *   - It never reads, writes, or prints an environment variable value.
 *
 * Exit codes are real (non-zero on failure) so this stays testable. The SessionStart hook that calls
 * it is what swallows failure, because a hook must never be able to fail a session.
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const profileDir = join(repoRoot, ".claude", "cloud-profile");

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const quiet = args.includes("--quiet");

// --skip=settings,claude-md,skills,memory. The skills part is several megabytes across ~500 files, so
// re-copying it is by far the slowest thing here; skipping it keeps a targeted re-run (and the tests
// that do not exercise skills) fast.
const KNOWN_PARTS = new Set(["settings", "claude-md", "skills", "memory"]);
const skipped = new Set(
  args
    .filter((arg) => arg.startsWith("--skip="))
    .flatMap((arg) => arg.slice("--skip=".length).split(","))
    .map((part) => part.trim())
    .filter(Boolean),
);
for (const part of skipped) {
  if (!KNOWN_PARTS.has(part)) {
    console.error(`[cloud-profile] ERROR: unknown --skip part '${part}' (known: ${[...KNOWN_PARTS].join(", ")})`);
    process.exit(2);
  }
}

function note(message) {
  if (!quiet) console.log(`[cloud-profile] ${message}`);
}

function fail(message) {
  console.error(`[cloud-profile] ERROR: ${message}`);
  process.exit(1);
}

if (process.env.CLAUDE_CODE_REMOTE !== "true" && !force) {
  // Not an error: the hook calls this unconditionally and this is the normal local outcome.
  note("not a remote container (CLAUDE_CODE_REMOTE is not true); nothing to do");
  process.exit(0);
}

if (!existsSync(profileDir)) {
  fail(`profile directory is missing at ${profileDir}`);
}

const claudeHome = process.env.CLAUDE_CONFIG_DIR ? resolve(process.env.CLAUDE_CONFIG_DIR) : join(homedir(), ".claude");

function ensureDir(dir) {
  if (dryRun) return;
  mkdirSync(dir, { recursive: true });
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge with `overlay` winning. Plain objects recurse; arrays and scalars are replaced whole,
 * because a half-merged array (a permission list, a marketplace list) is more surprising than a
 * replaced one.
 */
function deepMerge(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out;
}

function readJsonOr(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    // A corrupt settings file must not take the session down with it. Preserve it and start clean:
    // losing the merge is recoverable, losing whatever the platform wrote there may not be.
    const backup = `${path}.unparseable`;
    if (!dryRun && !existsSync(backup)) renameSync(path, backup);
    note(`WARNING: ${path} was not valid JSON (${error.message}); preserved as ${backup}`);
    return fallback;
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// ---------------------------------------------------------------------------
// 1. user-level settings — deep merge, profile wins
// ---------------------------------------------------------------------------
const profileSettingsPath = join(profileDir, "settings.json");
if (existsSync(profileSettingsPath) && !skipped.has("settings")) {
  const settingsPath = join(claudeHome, "settings.json");
  const profileSettings = JSON.parse(readFileSync(profileSettingsPath, "utf8"));
  const existing = readJsonOr(settingsPath, {});
  const merged = deepMerge(existing, profileSettings);
  const serialised = `${JSON.stringify(merged, null, 2)}\n`;
  const unchanged = existsSync(settingsPath) && readFileSync(settingsPath, "utf8") === serialised;
  if (unchanged) {
    note("settings.json already matches the profile");
  } else {
    ensureDir(claudeHome);
    if (!dryRun) writeFileSync(settingsPath, serialised);
    note(`settings.json merged (${Object.keys(profileSettings).join(", ")})`);
  }
}

// ---------------------------------------------------------------------------
// 2. personal CLAUDE.md — back up any existing copy once, then install
// ---------------------------------------------------------------------------
const profileClaudeMd = join(profileDir, "CLAUDE.md");
if (existsSync(profileClaudeMd) && !skipped.has("claude-md")) {
  const target = join(claudeHome, "CLAUDE.md");
  if (existsSync(target) && sha256(target) === sha256(profileClaudeMd)) {
    note("CLAUDE.md already matches the profile");
  } else {
    ensureDir(claudeHome);
    const backup = `${target}.pre-cloud-profile`;
    if (existsSync(target) && !existsSync(backup)) {
      if (!dryRun) cpSync(target, backup);
      note(`existing CLAUDE.md backed up to ${backup}`);
    }
    if (!dryRun) cpSync(profileClaudeMd, target);
    note("CLAUDE.md installed");
  }
}

// ---------------------------------------------------------------------------
// 3. user skills — overwrite; these are vendored copies with no container-side edits
// ---------------------------------------------------------------------------
const profileSkills = join(profileDir, "skills");
if (existsSync(profileSkills) && !skipped.has("skills")) {
  const target = join(claudeHome, "skills");
  ensureDir(target);
  const names = readdirSync(profileSkills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const name of names) {
    const destination = join(target, name);
    // Remove first. `cp -r` cannot replace a non-directory with a directory, and on the workstation
    // these very names ARE symlinks into ~/.agents/skills — so a plain copy throws
    // ERR_FS_CP_DIR_TO_NON_DIR on the first entry and aborts the whole tier (observed 2026-08-21).
    // Replacing outright is also the correct semantic: the checked-in profile is the source of truth
    // for a container, and a half-updated skill directory left from an older profile is worse than a
    // clean one.
    if (!dryRun) {
      rmSync(destination, { recursive: true, force: true });
      cpSync(join(profileSkills, name), destination, { recursive: true });
    }
  }
  note(`${names.length} user skills installed`);
}

// ---------------------------------------------------------------------------
// 4. project memories — copy only what is absent, so container-written memories always win
// ---------------------------------------------------------------------------
const profileMemory = join(profileDir, "memory");
if (existsSync(profileMemory) && !skipped.has("memory")) {
  // Claude Code keys project state by the working directory with path separators and the Windows
  // drive colon flattened to dashes: D:\Repos\Database -> D--Repos-Database, and in a Linux container
  // /home/user/Database -> -home-user-Database. Derive it rather than hard-coding either shape.
  const projectDir = process.env.CLAUDE_PROJECT_DIR ? resolve(process.env.CLAUDE_PROJECT_DIR) : repoRoot;
  const slug = projectDir.replace(/[/\\:]/g, "-");
  const target = join(claudeHome, "projects", slug, "memory");
  ensureDir(target);
  const files = readdirSync(profileMemory).filter((file) => file.endsWith(".md"));
  let copied = 0;
  let kept = 0;
  for (const file of files) {
    const destination = join(target, file);
    if (existsSync(destination)) {
      kept += 1;
      continue;
    }
    if (!dryRun) cpSync(join(profileMemory, file), destination);
    copied += 1;
  }
  note(`memories: ${copied} installed, ${kept} already present (kept) in projects/${slug}/memory`);
}

if (dryRun) {
  note("dry run — nothing was written");
}
