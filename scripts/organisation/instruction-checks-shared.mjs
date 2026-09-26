// Shared plumbing for the instruction-file checks (retired rules and the size budget):
// argument parsing, the CI env mode, git access and reading files at a commit.
//
// Exit-code convention, shared with scripts/check-organisation.mjs:
//   0  checked, nothing wrong
//   1  a real problem the change is responsible for
//   2  the check could not run or could not be trusted (bad input, missing file, unreachable commit)

import { spawnSync } from "node:child_process";

/** Raised for anything that makes the check impossible to trust; the CLI maps it to exit 2. */
export class BadInput extends Error {}

const ZERO_SHA = /^0+$/;

export function git(root, args, { allowFail = false, input } = {}) {
  // No `encoding`: stdout stays a Buffer so blob sizes from `cat-file --batch` are byte-exact.
  const result = spawnSync("git", ["--no-optional-locks", "-c", "core.quotePath=false", "-C", root, ...args], {
    maxBuffer: 512 * 1024 * 1024,
    input: input === undefined ? undefined : Buffer.from(input, "utf8"),
  });
  if (result.error) throw new BadInput(`git could not be run: ${result.error.message}`);
  if (result.status !== 0) {
    if (allowFail) return null;
    const detail = result.stderr.toString("utf8").trim().split("\n")[0];
    throw new BadInput(`git ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout;
}

export function gitText(root, args, options) {
  const out = git(root, args, options);
  return out === null ? null : out.toString("utf8");
}

/**
 * Parse the options the instruction checks share. Returns
 * { root, rules, budget, paths, base, head, mode } where mode is "tree" (the working tree, local
 * use), "range" (a CI comparison) or "paths" (arbitrary files). `--base` and `--head` go together.
 * With INSTRUCTIONS_CHECK_MODE=ci the range comes from BASE_SHA and HEAD_SHA instead, so CI can
 * run the npm script with no arguments.
 */
export function parseInstructionArgs(argv, env = process.env, { allow = [] } = {}) {
  const args = { root: null, rules: null, budget: null, paths: null, base: undefined, head: undefined };
  const takeValue = (flag, i) => {
    if (i + 1 >= argv.length) throw new BadInput(`${flag} needs a value`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const eq = raw.startsWith("--") ? raw.indexOf("=") : -1;
    const flag = eq > 0 ? raw.slice(0, eq) : raw;
    const inline = eq > 0 ? raw.slice(eq + 1) : undefined;
    const value = () => {
      if (inline !== undefined) return inline;
      const next = takeValue(flag, i);
      i++;
      return next;
    };
    if (flag === "--base") args.base = value();
    else if (flag === "--head") args.head = value();
    else if (flag === "--root") args.root = value();
    else if (flag === "--rules" && allow.includes("rules")) args.rules = value();
    else if (flag === "--budget" && allow.includes("budget")) args.budget = value();
    else if (flag === "--paths" && allow.includes("paths")) {
      args.paths = argv.slice(i + 1);
      if (args.paths.length === 0) throw new BadInput("--paths needs at least one file or folder");
      break;
    } else throw new BadInput(`unknown argument ${raw}`);
  }

  if (env.INSTRUCTIONS_CHECK_MODE === "ci") {
    if (args.base !== undefined || args.head !== undefined || args.paths) {
      throw new BadInput(
        "INSTRUCTIONS_CHECK_MODE=ci takes the range from BASE_SHA and HEAD_SHA; do not pass flags too",
      );
    }
    args.base = env.BASE_SHA ?? "";
    args.head = env.HEAD_SHA ?? "";
    args.fromEnv = true;
  }

  if (args.paths) {
    if (args.base !== undefined || args.head !== undefined) {
      throw new BadInput("--paths checks the given files as they are; it cannot be combined with --base/--head");
    }
    args.mode = "paths";
  } else if (args.base !== undefined || args.head !== undefined) {
    const names = args.fromEnv ? ["BASE_SHA", "HEAD_SHA"] : ["--base", "--head"];
    if (!(args.base ?? "").trim())
      throw new BadInput(`${names[0]} is missing or empty; CI must pass the PR's base commit`);
    if (!(args.head ?? "").trim())
      throw new BadInput(`${names[1]} is missing or empty; CI must pass the PR's head commit`);
    args.base = args.base.trim();
    args.head = args.head.trim();
    args.mode = "range";
  } else args.mode = "tree";
  return args;
}

/**
 * Resolve a range to commits. An all-zero base (the first push of a new branch) has nothing to
 * compare against, so it returns mergeBase null and the caller checks the head in full.
 */
export function resolveRange(root, base, head) {
  const headSha = gitText(root, ["rev-parse", "--verify", "--quiet", `${head}^{commit}`], { allowFail: true });
  if (!headSha) throw new BadInput(`the head commit ${head.slice(0, 12)} is not in this checkout`);
  if (ZERO_SHA.test(base)) return { head: headSha.trim(), mergeBase: null };
  const baseSha = gitText(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`], { allowFail: true });
  if (!baseSha) throw new BadInput(`the base commit ${base.slice(0, 12)} is not in this checkout (needs a full clone)`);
  const mergeBase = gitText(root, ["merge-base", baseSha.trim(), headSha.trim()], { allowFail: true });
  if (!mergeBase) throw new BadInput(`the base ${base.slice(0, 12)} and head ${head.slice(0, 12)} share no history`);
  return { head: headSha.trim(), mergeBase: mergeBase.trim() };
}

/** Read one file at a commit, or null when the commit does not have it. */
export function readAtCommit(root, commit, file) {
  const out = git(root, ["cat-file", "blob", `${commit}:${file}`], { allowFail: true });
  return out === null ? null : out.toString("utf8");
}

/** Read many files at a commit with one git process. Paths containing a newline are skipped. */
export function readManyAtCommit(root, commit, files) {
  const wanted = files.filter((file) => !file.includes("\n"));
  const result = new Map();
  if (wanted.length === 0) return result;
  const out = git(root, ["cat-file", "--batch"], { input: wanted.map((file) => `${commit}:${file}\n`).join("") });
  let offset = 0;
  for (const file of wanted) {
    const end = out.indexOf(0x0a, offset);
    const header = out.subarray(offset, end).toString("utf8");
    offset = end + 1;
    const parts = header.split(" ");
    if (parts[1] === "missing" || parts.length < 3) continue;
    const size = Number(parts[2]);
    if (parts[1] === "blob") result.set(file, out.subarray(offset, offset + size));
    offset += size + 1;
  }
  return result;
}

/** Git's view of a text file's content size: CRLF counts as LF, as it is stored. */
export function normalisedText(buffer) {
  return buffer.toString("utf8").replace(/\r\n/g, "\n");
}

export function looksBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

/** 54000 -> "54,000", independent of the machine's locale. */
export function formatBytes(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
