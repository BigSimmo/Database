#!/usr/bin/env node
// PR form helper (organisation framework, suggestion 8). Prints the lines to paste into a pull
// request description: `Areas touched:` from the organisation map, and — only when pr-policy
// says a ranking-protected file changed — a `RAG impact:` placeholder that pr-policy rejects
// until a person replaces it. The map never decides whether ranking was touched; pr-policy does.
//
// Usage: node scripts/organisation/pr-areas.mjs [--base <ref>] [--head <ref>] [--root <dir>] [--json]
//   --base  defaults to the merge-base of the head with `origin/main`, when that ref exists
//           locally. It never fetches: a stale local `origin/main` gives a stale base.
//   --head  defaults to HEAD. Only committed changes count; commit before running it.
//
// Exit codes: 0 printed the lines; 2 could not work out the change (no base, bad ref, no map).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluate } from "../check-organisation.mjs";
import { classifyPullRequestFiles, ragImpactDeclared } from "../pr-policy.mjs";

// Deliberately free of the two phrases pr-policy accepts ("no … behaviour change" and "canary"),
// so a pasted but unedited placeholder is reported as unsatisfied instead of passing silently.
export const RAG_IMPACT_PLACEHOLDER =
  "RAG impact: ??? replace this whole line with one of the two forms in the comment below";
// The hint sits on its own line and starts with `<!--`, which pr-policy's `RAG impact:` matcher
// never reads, so it can name the accepted forms without satisfying the check itself.
export const RAG_IMPACT_HINT =
  "<!-- Accepted forms: `RAG impact: no retrieval behaviour change — <reason>` or " +
  "`RAG impact: behaviour change — canary pair <baseline> -> <post>` (docs/rag-behaviour/safeguards.md). -->";

const DEFAULT_BASE_REF = "refs/remotes/origin/main";

class Unusable extends Error {}

function git(root, args, { allowFail = false } = {}) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw new Unusable(`git could not be run: ${result.error.message}`);
  if (result.status !== 0) {
    if (allowFail) return null;
    throw new Unusable(`git ${args.join(" ")} failed: ${(result.stderr || "").trim().split("\n")[0]}`);
  }
  return result.stdout;
}

function splitZ(text) {
  return text.split("\0").filter(Boolean);
}

/** A read-only view of one commit in the shape the organisation checker's `evaluate` expects. */
function commitSnapshot(root, sha) {
  const blobs = new Map();
  for (const entry of splitZ(git(root, ["ls-tree", "-r", "-z", sha]))) {
    const tab = entry.indexOf("\t");
    const meta = entry.slice(0, tab).split(" ");
    if (meta[1] === "blob") blobs.set(entry.slice(tab + 1), meta[2]);
  }
  return {
    label: `commit ${sha.slice(0, 9)}`,
    blobs,
    read: (file) => (blobs.has(file) ? git(root, ["cat-file", "blob", blobs.get(file)]) : null),
  };
}

function resolveCommit(root, ref, what) {
  const sha = git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true })?.trim();
  if (!sha) throw new Unusable(`the ${what} \`${ref}\` is not a commit in this checkout`);
  return sha;
}

/** Resolves the compared range. The base is always a merge-base, like a pull request's diff. */
export function resolveRange({ root, base = null, head = "HEAD" }) {
  const headSha = resolveCommit(root, head, "head");
  let baseRef = base;
  if (!baseRef) {
    const hasOriginMain = git(root, ["rev-parse", "--verify", "--quiet", DEFAULT_BASE_REF], { allowFail: true });
    if (!hasOriginMain) {
      throw new Unusable("`origin/main` does not exist locally, so there is no default base; pass --base <ref>");
    }
    baseRef = DEFAULT_BASE_REF;
  }
  const baseSha = resolveCommit(root, baseRef, "base");
  const mergeBase = git(root, ["merge-base", baseSha, headSha], { allowFail: true })?.trim();
  if (!mergeBase) throw new Unusable(`\`${baseRef}\` and \`${head}\` share no history`);
  return { baseRef, mergeBase, headSha };
}

function placementsFor(snapshot) {
  try {
    return evaluate(snapshot);
  } catch (error) {
    return { error: error?.message ?? String(error) };
  }
}

/**
 * Every changed file, the area(s) that own it, and whether pr-policy calls the change ranking-protected.
 * @param {{ root: string, base?: string | null, head?: string }} options
 */
export function prAreas({ root, base = null, head = "HEAD" }) {
  const range = resolveRange({ root, base, head });
  const files = splitZ(
    git(root, ["diff", "--no-renames", "--name-only", "-z", `${range.mergeBase}..${range.headSha}`]),
  ).sort();
  const headResult = placementsFor(commitSnapshot(root, range.headSha));
  if (headResult.error) throw new Unusable(`the organisation map at the head cannot be read: ${headResult.error}`);

  // A deleted file (or the old side of a rename) is placed by the map as it stood at the base.
  let baseResult = null;
  if (files.some((file) => !(file in headResult.placement))) {
    baseResult = placementsFor(commitSnapshot(root, range.mergeBase));
    if (baseResult.error) baseResult = null;
  }

  const names = new Map();
  for (const result of [baseResult, headResult]) {
    for (const system of result?.systems ?? []) names.set(system.id, system.name);
  }
  const touched = new Map();
  const notPlaced = [];
  const ignored = [];
  for (const file of files) {
    const placement = headResult.placement[file] ?? baseResult?.placement[file] ?? "(unplaced)";
    let ids = [];
    if (placement === "(ignored)") {
      ignored.push(file);
      continue;
    }
    if (placement.startsWith("(shared) ")) ids = placement.slice("(shared) ".length).split(" + ");
    else if (!placement.startsWith("(")) ids = [placement];
    if (ids.length === 0) {
      notPlaced.push(file);
      continue;
    }
    for (const id of ids) {
      if (!touched.has(id)) touched.set(id, { id, name: names.get(id) ?? id, files: [] });
      touched.get(id).files.push(file);
    }
  }
  const areas = [...touched.values()].sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name));
  const ragRanking = classifyPullRequestFiles(files).ragRanking;
  const summary = { fileCount: files.length, areas, notPlaced, ignored, ragRanking };
  return { ...range, files, ...summary, lines: formatPrAreaLines(summary) };
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The lines to paste into the PR description, in order. */
export function formatPrAreaLines({ fileCount, areas, notPlaced = [], ragRanking }) {
  const unplacedNote = notPlaced.length
    ? `${plural(notPlaced.length, "file", "files")} not yet placed in any area`
    : "";
  let areasLine;
  if (fileCount === 0) areasLine = "Areas touched: none (no changed files)";
  else if (areas.length === 0 && unplacedNote) areasLine = `Areas touched: none placed yet (${unplacedNote})`;
  else if (areas.length === 0) areasLine = `Areas touched: none (only ignored files changed)`;
  else {
    const list = areas.map((area) => area.name).join(", ");
    areasLine = `Areas touched: ${list}${unplacedNote ? ` (plus ${unplacedNote})` : ""}`;
  }
  const lines = [areasLine];
  if (ragRanking) lines.push(RAG_IMPACT_PLACEHOLDER, RAG_IMPACT_HINT);
  // The placeholder exists to be replaced. If pr-policy ever started accepting it, a pasted but
  // unedited line would pass silently, so refuse to print it rather than print a false pass.
  if (ragImpactDeclared(lines.join("\n")).satisfied) {
    throw new Error("the RAG impact placeholder satisfies pr-policy; change RAG_IMPACT_PLACEHOLDER");
  }
  return lines;
}

function parseArgs(argv) {
  const args = { base: null, head: "HEAD", root: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next || next.startsWith("--")) throw new Unusable(`${arg} needs a value`);
      return next;
    };
    if (arg === "--base") args.base = value();
    else if (arg === "--head") args.head = value();
    else if (arg === "--root") args.root = value();
    else if (arg === "--json") args.json = true;
    else throw new Unusable(`unknown argument ${arg}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
    const root = args.root
      ? path.resolve(args.root)
      : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const result = prAreas({ root, base: args.base, head: args.head });
    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    for (const line of result.lines) console.log(line);
    if (args.head === "HEAD") {
      const pending = git(root, ["status", "--porcelain", "--untracked-files=no"], { allowFail: true }) ?? "";
      if (pending.trim())
        console.error("pr-areas: uncommitted changes are not included; commit them and run it again.");
    }
    return 0;
  } catch (error) {
    const message = error instanceof Unusable ? error.message : `crashed: ${error?.stack ?? error}`;
    console.error(`pr-areas: could not work out the change — ${message}`);
    return 2;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
