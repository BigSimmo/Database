#!/usr/bin/env node
// Claude Code hooks for the organisation framework (docs/organisation/README.md). Each mode is run
// by a thin wrapper in .claude/hooks/ that checks for `node` first:
//
//   edit     PreToolUse on Edit|Write|MultiEdit|NotebookEdit. Adds a short note to the model's
//            context when the file being edited is on one of pr-policy's safety lists: on every
//            edit for ranking-protected files and database migrations, once per session for
//            clinical-risk files (884 of them, so repeating it would be noise). On the first edit
//            in each area of the organisation map it also names the area and its key docs.
//   session  SessionStart. One line of map health when something needs attention (map problems,
//            unplaced files, stale entries, rules matching nothing, files not yet placed); silent
//            when all is clean.
//
// Contract (docs/agents/claude-hook-scripts.md): it warns and never blocks. It never emits
// `permissionDecision` (an "allow" would skip the user's permission prompt), always exits 0, and
// prints nothing at all on any error, so a failure leaves the tool call exactly as it was. It
// writes no report and takes no lock; its only write is a small per-session memory file in the OS
// temp folder, so that a once-per-session note is not repeated.
//
// PreToolUse context travels in `hookSpecificOutput.additionalContext`. Claude Code accepts that
// field with `permissionDecision` absent and then leaves the permission flow untouched (checked
// against the CLI's own hook-output schema and handler, 2026-09-26).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate } from "../check-organisation.mjs";
import { safetyClassesFor } from "./safety-lists.mjs";

const OWN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MAP_DIR = "docs/organisation";
const MAP_LISTS = ["shared.json", "not-yet-placed.json", "ignored.json", "kinds.json", "pins.json"];
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const STATE_DIR_NAME = "psychsift-organisation-hooks";
const STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const GIT_TIMEOUT_MS = 3000;
const CHECKER_TIMEOUT_MS = 10_000;
const STDIN_LIMIT_MS = 3000;
const HARD_LIMIT_MS = 15_000;
// Checker warnings for entries left behind by a move or out of order: `--fix` tidies all of these.
const STALE_KINDS = new Set([
  "dead-rule",
  "dead-shared",
  "dead-nyp",
  "dead-list",
  "dead-canonical",
  "dead-pin",
  "nyp-superseded",
  "map-sort",
  "map-dup",
]);
// A pattern that matches nothing (usually a moved folder). `--fix` leaves these for a person.
const EMPTY_KINDS = new Set(["empty-glob", "empty-list-glob"]);

// ---------- shared helpers ----------

function parsePayload(raw) {
  try {
    const value = JSON.parse(String(raw ?? ""));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function defaultStateDir() {
  return path.join(os.tmpdir(), STATE_DIR_NAME);
}

/**
 * The memory key for one conversation context. A subagent has its own context, so it gets its own
 * key (session plus agent id) and sees the once-per-session notes for itself. Null when the payload
 * carries no usable session id; the notes are then shown every time rather than never.
 */
export function stateKey(payload) {
  const session = payload?.session_id;
  if (typeof session !== "string" || !ID_PATTERN.test(session)) return null;
  const agent = payload?.agent_id;
  return typeof agent === "string" && ID_PATTERN.test(agent) ? `${session}--${agent}` : session;
}

function emptyMemory() {
  return { clinical: false, areas: [] };
}

function loadMemory(stateDir, key) {
  if (!key) return emptyMemory();
  try {
    const data = JSON.parse(fs.readFileSync(path.join(stateDir, `${key}.json`), "utf8"));
    return {
      clinical: data?.clinical === true,
      areas: Array.isArray(data?.areas) ? data.areas.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return emptyMemory();
  }
}

function saveMemory(stateDir, key, memory) {
  if (!key) return;
  try {
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const file = path.join(stateDir, `${key}.json`);
    if (!fs.existsSync(file)) pruneOldMemory(stateDir);
    // Write then rename, so a parallel edit never reads half a file.
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify({ version: 1, ...memory })}\n`);
    fs.renameSync(temp, file);
  } catch {
    // Memory is a convenience; without it a note is simply shown again.
  }
}

function pruneOldMemory(stateDir, now = Date.now()) {
  try {
    for (const name of fs.readdirSync(stateDir)) {
      const file = path.join(stateDir, name);
      if (now - fs.statSync(file).mtimeMs > STATE_MAX_AGE_MS) fs.rmSync(file, { force: true });
    }
  } catch {
    // best effort
  }
}

// ---------- edit mode ----------

function gitTopLevel(dir) {
  const env = { ...process.env };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete env[name];
  const result = spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    env,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const top = result.status === 0 ? result.stdout.trim() : "";
  return top || null;
}

/**
 * Where a file sits in its own checkout: the git top folder of the file's own directory (so an
 * edit in another worktree is judged against that worktree) and the file's path relative to it,
 * with forward slashes. Works for a file that does not exist yet. Null outside any git work tree.
 */
export function repoRelativePath(filePath, cwd = process.cwd()) {
  if (typeof filePath !== "string" || filePath.trim() === "") return null;
  // `resolve` also collapses `..` segments, so `src/../supabase/…` is judged as `supabase/…`.
  const target = path.resolve(cwd, filePath.trim().replaceAll("\\", "/"));
  // Walk up to the nearest folder that exists: Write may be creating new folders.
  const missing = [path.basename(target)];
  let dir = path.dirname(target);
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    missing.unshift(path.basename(dir));
    dir = parent;
  }
  try {
    if (!fs.statSync(dir).isDirectory()) return null;
    const realDir = fs.realpathSync.native(dir);
    const topRaw = gitTopLevel(realDir);
    if (!topRaw) return null;
    const top = fs.realpathSync.native(topRaw);
    const rel = path.relative(top, path.join(realDir, ...missing)).replaceAll("\\", "/");
    if (!rel || rel === ".." || rel.startsWith("../") || path.isAbsolute(rel)) return null;
    return { top, rel };
  } catch {
    return null;
  }
}

/**
 * The areas (and workstreams) the map places one file in: none for an ignored, unplaced or tied
 * file, one normally, two or more for a shared file. Placement comes from the checker's own
 * `evaluate`, run on a snapshot holding just the map and this one path, so it is the checker's
 * answer without listing the whole repository.
 */
export function areasFor(mapRoot, rel) {
  const systemsDir = path.join(mapRoot, MAP_DIR, "systems");
  if (!fs.existsSync(systemsDir)) return [];
  const texts = new Map();
  for (const name of fs.readdirSync(systemsDir).sort()) {
    if (name.endsWith(".json")) texts.set(`${MAP_DIR}/systems/${name}`, null);
  }
  for (const name of MAP_LISTS) texts.set(`${MAP_DIR}/${name}`, null);
  const read = (file) => {
    if (!texts.has(file)) return null;
    if (texts.get(file) === null) {
      try {
        texts.set(file, fs.readFileSync(path.join(mapRoot, file), "utf8"));
      } catch {
        texts.set(file, undefined);
      }
    }
    return texts.get(file) ?? null;
  };
  const blobs = new Map([...texts.keys()].filter((file) => read(file) !== null).map((file) => [file, ""]));
  blobs.set(rel, "");
  const placement = evaluate({ label: "edit hook", blobs, read }).placement[rel];
  if (typeof placement !== "string") return [];
  const ids = placement.startsWith("(shared) ")
    ? placement.slice("(shared) ".length).split(" + ")
    : placement.startsWith("(")
      ? []
      : [placement];
  return ids.map((id) => {
    let data = null;
    try {
      data = JSON.parse(read(`${MAP_DIR}/systems/${id}.json`) ?? "null");
    } catch {
      data = null;
    }
    const docs = Array.isArray(data?.canonicalDocs) ? data.canonicalDocs.filter((d) => typeof d === "string") : [];
    return { id, name: typeof data?.name === "string" && data.name ? data.name : id, canonicalDocs: docs };
  });
}

/**
 * The notes for one edit, and the session memory after it. Pure: `classes` are the safety lists
 * covering the file, `areas` its map areas, `memory` what this session has already been told.
 */
export function editNotes({ rel, classes, areas, memory }) {
  const lines = [];
  const next = { clinical: memory?.clinical === true, areas: new Set(memory?.areas ?? []) };
  if (classes.includes("ragRanking")) {
    lines.push(
      `[organisation] ${rel} is ranking-protected: read docs/rag-behaviour/ before changing it, flag the change to the user, and put a \`RAG impact:\` line in the PR body.`,
    );
  }
  if (classes.includes("migration")) {
    lines.push(
      `[organisation] ${rel} is a database migration: merging it applies it to the live clinical database within seconds, so never edit one already on main and merge only inside an approved window.`,
    );
  }
  if (classes.includes("clinicalRisk") && !next.clinical) {
    lines.push(
      `[organisation] ${rel} is on the clinical-risk list, so the PR will need a complete \`## Clinical Governance Preflight\` section (said once per session).`,
    );
    next.clinical = true;
  }
  for (const area of areas) {
    if (next.areas.has(area.id)) continue;
    next.areas.add(area.id);
    const docs = area.canonicalDocs.length
      ? `its key docs are ${area.canonicalDocs.join(", ")}`
      : "it lists no key docs";
    lines.push(`[organisation] First edit in ${area.name} this session; ${docs}.`);
  }
  return { lines, memory: { clinical: next.clinical, areas: [...next.areas].sort() } };
}

/** The PreToolUse hook's stdout for one payload, or null when there is nothing to say. */
export function editHookOutput(raw, { stateDir = defaultStateDir(), ownRoot = OWN_ROOT } = {}) {
  const payload = parsePayload(raw);
  if (!payload) return null;
  if (payload.tool_name !== undefined && !EDIT_TOOLS.has(payload.tool_name)) return null;
  const input = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
  const target = [input.file_path, input.notebook_path].find((value) => typeof value === "string" && value.trim());
  if (!target) return null;
  const located = repoRelativePath(target, typeof payload.cwd === "string" && payload.cwd ? payload.cwd : undefined);
  // Only this project's checkouts: pr-policy's lists mean nothing in another repository.
  if (!located || !fs.existsSync(path.join(located.top, "scripts", "pr-policy.mjs"))) return null;

  const classes = safetyClassesFor(located.rel);
  let areas = [];
  try {
    // Prefer the edited checkout's own map; fall back to this checkout's when it predates the map.
    const mapRoot = fs.existsSync(path.join(located.top, MAP_DIR, "systems")) ? located.top : ownRoot;
    areas = areasFor(mapRoot, located.rel);
  } catch {
    areas = [];
  }
  const key = stateKey(payload);
  const memory = loadMemory(stateDir, key);
  const { lines, memory: next } = editNotes({ rel: located.rel, classes, areas, memory });
  if (JSON.stringify(next) !== JSON.stringify({ clinical: memory.clinical, areas: [...memory.areas].sort() })) {
    saveMemory(stateDir, key, next);
  }
  if (lines.length === 0) return null;
  return `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: lines.join("\n") } })}\n`;
}

// ---------- session mode ----------

function count(value) {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * One line of map health from a checker report (`--no-report --json`), or null when every count
 * is zero or the checker could not run (exit 2): an advisory line must not add noise.
 */
export function sessionHealthLine(report) {
  if (!report || typeof report !== "object" || ![0, 1].includes(report.exitCode)) return null;
  const totals = report.totals && typeof report.totals === "object" ? report.totals : {};
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const problems = findings.filter((f) => f?.level === "broken").length;
  const warningsOf = (kinds) =>
    findings.filter((f) => f?.level === "warning" && typeof f.key === "string" && kinds.has(f.key.split(":")[0]))
      .length;
  const stale = warningsOf(STALE_KINDS);
  const parts = [
    [problems, "map problem", "map problems"],
    [count(totals.unplaced), "unplaced file", "unplaced files"],
    [stale, "stale entry", "stale entries"],
    [warningsOf(EMPTY_KINDS), "rule matching nothing", "rules matching nothing"],
    [count(totals.notYetPlaced), "file not yet placed", "files not yet placed"],
  ]
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (parts.length === 0) return null;
  const fix = stale > 0 ? ", and `npm run check:organisation -- --fix` tidies the stale entries" : "";
  return `[organisation] Map health: ${parts.join(", ")}. \`npm run check:organisation\` lists them${fix}.`;
}

function forgetSession(payload, stateDir) {
  const key = stateKey({ session_id: payload?.session_id });
  if (!key) return;
  try {
    fs.rmSync(path.join(stateDir, `${key}.json`), { force: true });
  } catch {
    // best effort
  }
}

/**
 * The SessionStart hook's stdout, or null. Runs the checker with `--no-report --json`, which
 * writes no report and takes no lock, bounded by a timeout. After a compaction the model has lost
 * the edit notes, so this session's once-per-session memory is cleared and they are shown again.
 */
export function sessionHookOutput(
  raw,
  { root = OWN_ROOT, stateDir = defaultStateDir(), timeoutMs = CHECKER_TIMEOUT_MS } = {},
) {
  const payload = parsePayload(raw);
  if (payload?.source === "compact") forgetSession(payload, stateDir);
  const checker = path.join(OWN_ROOT, "scripts", "check-organisation.mjs");
  if (!fs.existsSync(checker)) return null;
  const env = { ...process.env };
  for (const name of ["ORGANISATION_CHECK_MODE", "GITHUB_STEP_SUMMARY", "BASE_SHA", "HEAD_SHA"]) delete env[name];
  const run = spawnSync(process.execPath, [checker, "--root", root, "--no-report", "--json"], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (run.error || typeof run.stdout !== "string") return null;
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    return null;
  }
  const line = sessionHealthLine(report);
  if (!line) return null;
  return `${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: line } })}\n`;
}

// ---------- command line ----------

function readStdin(limitMs) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    const chunks = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
    setTimeout(finish, limitMs).unref();
  });
}

function invokedDirectly() {
  try {
    return (
      Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const mode = process.argv[2];
  setTimeout(() => process.exit(0), HARD_LIMIT_MS).unref();
  process.on("uncaughtException", () => process.exit(0));
  process.stdout.on("error", () => {});
  readStdin(STDIN_LIMIT_MS)
    .then((raw) => {
      let out = null;
      try {
        if (mode === "edit") out = editHookOutput(raw);
        else if (mode === "session") out = sessionHookOutput(raw);
      } catch {
        out = null;
      }
      if (out) process.stdout.write(out);
    })
    .catch(() => {})
    .finally(() => {
      process.exitCode = 0;
      process.stdin.destroy();
    });
}
