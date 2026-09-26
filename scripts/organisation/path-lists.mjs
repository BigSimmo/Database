// Safety-list coverage checks for the organisation framework (suggestions 2 and 7).
//
// Two questions, both answered from `scripts/pr-policy.mjs`, which owns the lists. This module
// never edits a list and never decides policy; it only reports.
//
// 1. `coverageLossFindings`: did a rename in this change move a file off a safety list? A file
//    silently losing its protection is a safety problem, not a tidiness one, so each finding is
//    marked `loud` for the integrator to print prominently. Findings never block: the owner
//    decided that only a self-contradictory map blocks a PR.
// 2. `deadEntryFindings`: does an exact file name on the ranking or clinical-risk list point at
//    no tracked file, so the entry protects nothing?
//
// Deliberately NOT checked here:
// - CODEOWNERS dead patterns: `tests/ci-audit-contracts.test.ts` already fails on any CODEOWNERS
//   pattern that matches nothing. CODEOWNERS also starts with a catch-all `*` line, so a move can
//   never leave a file without a code owner; it can only fall back to the catch-all.
// - The site-content owners list (`src/lib/site-content/site-content-change-owners.json`):
//   `scripts/ci-change-scope.mjs` already throws on an owner path that does not exist.
//
// Findings carry both `severity` (the framework's stage-2 name) and `level` (the name
// `scripts/check-organisation.mjs` prints), so either consumer can read them unchanged.

import { spawnSync } from "node:child_process";

import { safetyPathLists } from "../pr-policy.mjs";
import { safetyClassesFor } from "./safety-lists.mjs";

const POLICY_FILE = "scripts/pr-policy.mjs";

// What each list is called in pr-policy, what it does for a PR, and how to put a file back on it.
const LIST_DESCRIPTIONS = Object.freeze({
  ragRanking: {
    label: "the ranking-protected list",
    variable: "ragRankingPatterns",
    effect: "PRs that change it are no longer flagged as ranking-sensitive or asked for a `RAG impact:` line",
  },
  clinicalRisk: {
    label: "the clinical-risk list",
    variable: "clinicalRiskPatterns",
    effect: "PRs that change it no longer require the Clinical Governance Preflight",
  },
  migration: {
    label: "the database-migration list",
    variable: "migrationPatterns",
    effect: "PRs that change it no longer get the migration-history and deploy-claim checks",
  },
});

function describeList(name) {
  return (
    LIST_DESCRIPTIONS[name] ?? {
      label: `the ${name} list`,
      variable: name,
      effect: "PRs that change it no longer get that list's checks",
    }
  );
}

/**
 * @typedef {object} PathListFinding
 * @property {"warning"} severity
 * @property {"warning"} level
 * @property {boolean} loud true when the integrator should print it prominently
 * @property {string} key stable identity, e.g. `coverage-lost:<new path>`
 * @property {string} subject the path the finding is about
 * @property {string} [about] the related path (the old name of a rename, or the policy file)
 * @property {string} message plain-English explanation and remedy
 */

/**
 * @param {{ key: string, subject: string, about?: string, message: string, loud?: boolean }} fields
 * @returns {PathListFinding}
 */
function warning({ key, subject, about, message, loud = false }) {
  /** @type {PathListFinding} */
  const finding = { severity: "warning", level: "warning", loud, key, subject, message };
  if (about) finding.about = about;
  return finding;
}

function checkRef(name, value) {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("-") || /[\s\0]/.test(value)) {
    throw new Error(`${name} must be a git revision, got ${JSON.stringify(value)}`);
  }
}

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    // Plain-English git messages, so the rename-limit warning below is recognisable.
    env: { ...process.env, LC_ALL: "C", LANG: "C", GIT_OPTIONAL_LOCKS: "0" },
  });
  if (result.error) throw new Error(`git could not run: ${result.error.message}`);
  if (result.status !== 0) {
    const reason = (result.stderr || "").trim().split("\n")[0] || `exit ${result.status}`;
    throw new Error(`git ${args[0]} failed: ${reason}`);
  }
  return result;
}

/**
 * Parses `git diff --name-status -z` output into `{ status, path, from? }` entries.
 * @param {string} output
 * @returns {{ status: string, path: string, from?: string }[]}
 */
export function parseNameStatus(output) {
  const tokens = String(output ?? "").split("\0");
  const entries = [];
  let index = 0;
  while (index < tokens.length && tokens[index] !== "") {
    const status = tokens[index];
    if (/^[RC]/.test(status)) {
      entries.push({ status: status[0], from: tokens[index + 1], path: tokens[index + 2] });
      index += 3;
    } else {
      entries.push({ status: status[0], path: tokens[index + 1] });
      index += 2;
    }
  }
  return entries;
}

/**
 * Safety coverage a change loses by renaming files, as findings. Never blocking.
 *
 * - A rename whose new path is missing a safety list the old path was on gives one `loud`
 *   warning keyed `coverage-lost:<new>`, naming each lost list and how to restore it.
 * - A deleted file that was on a safety list gives a plain warning: deletion is not lost
 *   protection, but a move git did not recognise as a rename looks exactly like one.
 * - If git skipped rename detection (too many files), a `loud` warning says so, because a
 *   lost-protection rename would then show only as a deletion.
 *
 * `classify(path)` returns the list names covering a path; it defaults to pr-policy's lists via
 * `safetyClassesFor`. Throws when git cannot run or a revision cannot be read, so the caller can
 * report "could not check" instead of a false pass.
 *
 * @param {{ root: string, base: string, head?: string, classify?: (file: string) => readonly string[] }} options
 * @returns {PathListFinding[]}
 */
export function coverageLossFindings({ root, base, head = "HEAD", classify = safetyClassesFor }) {
  if (typeof root !== "string" || root.length === 0) throw new Error("root is required");
  checkRef("base", base);
  checkRef("head", head);
  const diff = git(root, ["diff", "-M", "--name-status", "-z", "--no-color", "--no-ext-diff", base, head, "--"]);
  const findings = [];
  if (/rename detection was skipped/i.test(diff.stderr || "")) {
    findings.push(
      warning({
        key: "coverage-rename-detection-skipped",
        subject: `${base}..${head}`,
        loud: true,
        message:
          "git skipped rename detection for this change because it touches too many files, so a file moved off a safety list would show only as a deletion. Check the deleted safety-listed files below by hand.",
      }),
    );
  }
  for (const entry of parseNameStatus(diff.stdout)) {
    if (entry.status === "R") {
      const before = classify(entry.from);
      const after = new Set(classify(entry.path));
      const lost = before.filter((name) => !after.has(name));
      if (lost.length === 0) continue;
      const details = lost.map((name) => {
        const list = describeList(name);
        return `${list.label} (${list.variable}): ${list.effect}`;
      });
      const variables = lost.map((name) => describeList(name).variable).join(" and ");
      findings.push(
        warning({
          key: `coverage-lost:${entry.path}`,
          subject: entry.path,
          about: entry.from,
          loud: true,
          message: `renamed from \`${entry.from}\`, and the new path has lost its safety protection. It is no longer on ${details.join("; and no longer on ")}. To restore it, add \`${entry.path}\` to ${variables} in ${POLICY_FILE}.`,
        }),
      );
    } else if (entry.status === "D") {
      const lists = classify(entry.path);
      if (lists.length === 0) continue;
      const labels = lists.map((name) => `${describeList(name).label} (${describeList(name).variable})`).join(" and ");
      findings.push(
        warning({
          key: `coverage-deleted:${entry.path}`,
          subject: entry.path,
          about: POLICY_FILE,
          message: `was on ${labels} and has been deleted. Deleting a file is not lost protection, but if its content moved to a new file, add the new path to the same list in ${POLICY_FILE}.`,
        }),
      );
    }
  }
  return findings;
}

const MAX_ALTERNATIVES = 512;

/**
 * Expands an anchored regular expression that is only literal text, non-capturing alternation
 * groups and optional groups into every string it can match, e.g.
 * `/^src\/lib\/(?:a|b)\.ts$/` gives `{ anchoredEnd: true, texts: ["src/lib/a.ts", "src/lib/b.ts"] }`.
 *
 * Returns null for anything else (wildcards, character classes, `\b`, repetition, lookaround,
 * an unanchored start, a top-level `|`), which marks a keyword-style pattern with no literal
 * file names. Without a trailing `$` the texts are prefixes (usually folders).
 *
 * @param {RegExp | string} pattern
 * @returns {{ anchoredEnd: boolean, texts: string[] } | null}
 */
export function literalAlternatives(pattern) {
  const source = pattern instanceof RegExp ? pattern.source : String(pattern ?? "");
  if (!source.startsWith("^")) return null;
  let body = source.slice(1);
  let anchoredEnd = false;
  // A final `$` is an anchor unless an odd number of backslashes escapes it.
  if (body.endsWith("$") && body.slice(0, -1).match(/\\*$/)[0].length % 2 === 0) {
    anchoredEnd = true;
    body = body.slice(0, -1);
  }
  const state = { text: body, index: 0 };
  const texts = parseAlternation(state, true);
  if (texts === null || state.index !== body.length) return null;
  return { anchoredEnd, texts: [...new Set(texts)] };
}

function parseAlternation(state, topLevel) {
  const options = parseSequence(state);
  if (options === null) return null;
  while (state.text[state.index] === "|") {
    if (topLevel) return null;
    state.index += 1;
    const more = parseSequence(state);
    if (more === null) return null;
    options.push(...more);
    if (options.length > MAX_ALTERNATIVES) return null;
  }
  return options;
}

function parseSequence(state) {
  let accumulated = [""];
  while (state.index < state.text.length) {
    const char = state.text[state.index];
    if (char === "|" || char === ")") break;
    let piece;
    if (char === "\\") {
      const escaped = state.text[state.index + 1];
      // `\b`, `\d`, `\w`, `\s`, back-references and the like are not literal text.
      if (escaped === undefined || /[A-Za-z0-9]/.test(escaped)) return null;
      piece = [escaped];
      state.index += 2;
    } else if (char === "(") {
      if (state.text.startsWith("(?:", state.index)) state.index += 3;
      else if (state.text[state.index + 1] === "?") return null;
      else state.index += 1;
      const inner = parseAlternation(state, false);
      if (inner === null || state.text[state.index] !== ")") return null;
      state.index += 1;
      piece = inner;
    } else if (".[]{}*+?^$".includes(char)) {
      return null;
    } else {
      piece = [char];
      state.index += 1;
    }
    if (state.text[state.index] === "?") {
      state.index += 1;
      piece = ["", ...piece];
    }
    if (state.index < state.text.length && "*+?{".includes(state.text[state.index])) return null;
    const next = [];
    for (const prefix of accumulated) for (const suffix of piece) next.push(prefix + suffix);
    if (next.length > MAX_ALTERNATIVES) return null;
    accumulated = next;
  }
  return accumulated;
}

function trackedFilesAt(root) {
  return git(root, ["ls-files", "-z"]).stdout.split("\0").filter(Boolean);
}

/**
 * Warnings for safety-list entries that point at nothing, so they protect nothing.
 *
 * - Every exact file name on each list (grouped alternations such as
 *   `src\/lib\/(?:a|b)\.ts$` are split into single names) that matches no tracked file.
 * - Every literal folder or name prefix on a list that no tracked file starts with.
 * - A keyword-style pattern (no literal names) is not split; it warns only when it matches no
 *   tracked file at all.
 *
 * `lists` maps a list name to its patterns and defaults to pr-policy's ranking and clinical-risk
 * lists. `trackedFiles` defaults to `git ls-files` at `root`. Never blocking.
 *
 * @param {{ root?: string, trackedFiles?: readonly string[], lists?: Readonly<Record<string, readonly RegExp[]>> }} [options]
 * @returns {PathListFinding[]}
 */
export function deadEntryFindings({ root, trackedFiles, lists = safetyPathLists } = {}) {
  let files = trackedFiles;
  if (!Array.isArray(files)) {
    if (typeof root !== "string" || root.length === 0) throw new Error("root or trackedFiles is required");
    files = trackedFilesAt(root);
  }
  const exact = new Set(files);
  const lowerExact = new Set(files.map((file) => file.toLowerCase()));
  const findings = [];
  const seen = new Set();
  const push = (finding) => {
    if (seen.has(finding.key)) return;
    seen.add(finding.key);
    findings.push(finding);
  };
  for (const [name, patterns] of Object.entries(lists)) {
    const list = describeList(name);
    const where = `${list.variable} in ${POLICY_FILE}`;
    for (const pattern of patterns) {
      const ignoreCase = pattern instanceof RegExp && pattern.flags.includes("i");
      const expanded = literalAlternatives(pattern);
      if (expanded === null) {
        if (!files.some((file) => pattern.test(file))) {
          push(
            warning({
              key: `dead-pattern:${name}:${pattern.source}`,
              subject: POLICY_FILE,
              message: `the pattern \`${pattern}\` on ${list.label} (${list.variable}) matches no tracked file, so it protects nothing. If the files it covered moved, update the pattern; retiring it is the owner's call.`,
            }),
          );
        }
        continue;
      }
      for (const text of expanded.texts) {
        if (expanded.anchoredEnd) {
          const present = ignoreCase ? lowerExact.has(text.toLowerCase()) : exact.has(text);
          if (present) continue;
          push(
            warning({
              key: `dead-entry:${name}:${text}`,
              subject: text,
              about: POLICY_FILE,
              message: `is named on ${list.label} (${where}) but no tracked file has that path, so the entry protects nothing. If the file moved, add its new path to ${list.variable}; removing the name is the owner's call.`,
            }),
          );
        } else {
          const needle = ignoreCase ? text.toLowerCase() : text;
          const present = files.some((file) => (ignoreCase ? file.toLowerCase() : file).startsWith(needle));
          if (present) continue;
          push(
            warning({
              key: `dead-entry:${name}:${text}`,
              subject: text,
              about: POLICY_FILE,
              message: `is a folder or name prefix on ${list.label} (${where}) but no tracked file starts with it, so the entry protects nothing. If the files moved, add their new location to ${list.variable}; removing it is the owner's call.`,
            }),
          );
        }
      }
    }
  }
  return findings;
}
