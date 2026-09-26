// Review-date scope for the governance registers' expiry checks (organisation framework,
// suggestion 6: "defuse the date traps"; owner decision 2026-09-26).
//
// WHY THIS EXISTS. The clinical hazard register (docs/clinical-hazard-controls.json) and the
// privacy-readiness register (docs/governance/privacy-readiness.v1.json) record review dates that
// lapse on the calendar. Their checks run on every pull request in scope, so on the day a date
// passed, every such pull request went red whatever it changed: a date trap that blames unrelated
// work and teaches people to ignore a red governance check.
//
// WHAT CHANGES, AND ONLY THIS. In pull-request or merge-queue CI, and on a push to main
// (REVIEW_DATE_MODE=pr, with BASE_SHA and HEAD_SHA naming the change), an EXPIRED review date is reported as a warning unless
// the change touches the register file itself or a path the expired entry covers; then it still
// blocks. Nothing else moves: a date in the future, the 45-day drift-exception cap and every
// non-date check block exactly as before, and every other context (local runs, pushes to other
// branches, manual runs, release gates) stays strict. Lapsed dates are raised instead by the weekly
// review-date report (scripts/organisation/weekly/review-dates.mjs) and by release gates.
//
// FAIL CLOSED. Anything short of a clean, explicit request resolves to strict: the variable unset
// or misspelt, no GitHub event or one other than a pull request, merge queue or push to main, a missing,
// malformed or unreachable base, or any git error. Strict is the behaviour before this change, so
// a failure here can never make a check weaker than it was.
import { spawnSync } from "node:child_process";
import path from "node:path";

export const REVIEW_DATE_MODE_ENV = "REVIEW_DATE_MODE";
const PR_EVENTS = new Set(["pull_request", "merge_group"]);
const MAIN_REF = "refs/heads/main";
const ZERO_SHA = /^0+$/;
// A commit id or a plain ref. Never an option: a value starting with "-" would reach git as a flag.
const SAFE_REVISION = /^(?!-)[A-Za-z0-9._/~^@{}-]{1,200}$/;
const OFFLINE_GIT_ENV = { GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" };

export const NOT_BLOCKING_NOTE =
  "Not blocking this change, which edits neither this entry in the register nor a path this entry covers. It still " +
  "blocks in local runs, on other branches and in release checks, and the weekly review-date report lists it.";

/**
 * @typedef {{ mode: "strict" | "pr", touched: string[] | null, base: string | null, head: string | null,
 *   mergeBase?: string | null, read?: (revision: string, file: string) => string | null,
 *   notes: string[] }} ReviewDateScope
 */

/** @param {string} reason @returns {ReviewDateScope} */
function strict(reason) {
  return { mode: "strict", touched: null, base: null, head: null, notes: reason ? [reason] : [] };
}

/** The default scope: every expired date blocks. What local runs, main and release gates get. */
export const STRICT_REVIEW_DATE_SCOPE = Object.freeze(strict(""));

function git(root, args) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...OFFLINE_GIT_ENV },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

/**
 * Files the change itself touched: `git diff --no-renames` from the merge base of base and head,
 * so files main changed after the branch point are never blamed on the change, and a rename
 * counts as touching both its old and its new path.
 *
 * @param {string} root
 * @param {string} base
 * @param {string} head
 * @returns {{ ok: true, files: string[], mergeBase: string } | { ok: false, reason: string }}
 */
export function gitTouchedFiles(root, base, head) {
  const mergeBase = git(root, ["merge-base", base, head])?.trim();
  if (!mergeBase) return { ok: false, reason: `the base ${base.slice(0, 12)} is not reachable from ${head}` };
  const out = git(root, ["diff", "--no-renames", "--name-only", "-z", `${mergeBase}...${head}`]);
  if (out === null) return { ok: false, reason: `git diff ${mergeBase.slice(0, 12)}...${head} failed` };
  return { ok: true, files: out.split("\0").filter(Boolean), mergeBase };
}

/**
 * Decide how expired review dates are treated in this run. Only an explicit `REVIEW_DATE_MODE=pr`
 * with a usable `BASE_SHA` (and optionally `HEAD_SHA`, default HEAD) in a pull-request or
 * merge-queue context yields pr mode; everything else is strict, with a note saying why whenever
 * pr mode was asked for and refused.
 *
 * @param {{ env?: Record<string, string | undefined>, root: string,
 *   listTouched?: (root: string, base: string, head: string) =>
 *     { ok: true, files: string[], mergeBase?: string } | { ok: false, reason: string },
 *   readAt?: (root: string, revision: string, file: string) => string | null }} options
 * @returns {ReviewDateScope}
 */
export function resolveReviewDateScope({
  env = process.env,
  root,
  listTouched = gitTouchedFiles,
  readAt = (dir, revision, file) => git(dir, ["show", `${revision}:${file}`]),
}) {
  const requested = (env[REVIEW_DATE_MODE_ENV] ?? "").trim();
  if (requested === "" || requested === "strict") return strict("");
  const refuse = (why) =>
    strict(`${REVIEW_DATE_MODE_ENV}=${requested} was not applied (${why}), so expired review dates block as usual.`);
  if (requested !== "pr") return refuse('the only other accepted value is "pr"');
  // The event is required, not merely checked when present: pr mode exists for pull-request CI,
  // where GitHub always sets it. A run without one (local, a script, a release gate) stays strict.
  const event = (env.GITHUB_EVENT_NAME ?? "").trim();
  if (!event) return refuse("GITHUB_EVENT_NAME is not set, so this is not a pull request or merge queue");
  // A push to main is judged by what the push changed (BASE_SHA is the commit before it), so a
  // review date lapsing on the calendar does not turn main red on every later push; the weekly
  // report raises it instead (owner decision 2026-09-26). Pushes to any other branch, including
  // release branches, stay strict.
  const ref = (env.GITHUB_REF ?? "").trim();
  if (event === "push" && ref !== MAIN_REF)
    return refuse(`the GitHub event is push to ${ref || "an unnamed branch"}, not ${MAIN_REF}`);
  if (event !== "push" && !PR_EVENTS.has(event))
    return refuse(`the GitHub event is ${event}, not a pull request, merge queue or push to main`);
  const base = (env.BASE_SHA ?? "").trim();
  const head = (env.HEAD_SHA ?? "").trim() || "HEAD";
  if (!base || ZERO_SHA.test(base)) return refuse("BASE_SHA is not set");
  if (!SAFE_REVISION.test(base) || !SAFE_REVISION.test(head)) return refuse("BASE_SHA or HEAD_SHA is malformed");
  let listed;
  try {
    listed = listTouched(root, base, head);
  } catch (error) {
    return refuse(`the changed files could not be listed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!listed?.ok || !Array.isArray(listed.files)) {
    return refuse(`the changed files could not be listed: ${listed?.ok === false ? listed.reason : "no result"}`);
  }
  const mergeBase =
    typeof listed.mergeBase === "string" && SAFE_REVISION.test(listed.mergeBase) ? listed.mergeBase : null;
  return {
    mode: "pr",
    touched: [...listed.files],
    base,
    head,
    mergeBase,
    read: (revision, file) => readAt(root, revision, file),
    notes: [],
  };
}

/**
 * A register path reference in canonical form, without its `#anchor`: POSIX-normalised, with a
 * leading "./" and any trailing "/" removed, so "./src/a.ts", "src//a.ts" and "src/lib/" compare
 * with the paths git lists. Null when it is not a usable string or names the repository root.
 */
export function referencePath(value) {
  if (typeof value !== "string") return null;
  const raw = value.split("#", 1)[0].trim();
  if (!raw) return null;
  let file = path.posix.normalize(raw);
  while (file.startsWith("./")) file = file.slice(2);
  file = file.replace(/\/+$/, "");
  return file && file !== "." ? file : null;
}

/** The touched path a covered reference matches: the file itself, or the first file under the folder. */
function coveredTouch(touched, file) {
  if (touched.has(file)) return file;
  const prefix = `${file}/`;
  for (const candidate of touched) if (candidate.startsWith(prefix)) return candidate;
  return null;
}

/**
 * Did this change edit one entry of a register? `select` picks the entry out of the parsed
 * register; the entry is compared at the merge base and at the head. Anything that cannot be read
 * or parsed is "unknown", which blocks like an edit, so a failure to tell never weakens the check.
 */
function entryChange(scope, registerPath, select) {
  if (typeof select !== "function" || typeof scope.read !== "function" || !scope.mergeBase) return "unknown";
  try {
    const at = (revision) => {
      const text = scope.read(revision, registerPath);
      if (typeof text !== "string") throw new Error(`no ${registerPath} at ${revision}`);
      return JSON.stringify(select(JSON.parse(text.replace(/^\uFEFF/, ""))) ?? null);
    };
    return at(scope.mergeBase) === at(scope.head ?? "HEAD") ? "unchanged" : "edited";
  } catch {
    return "unknown";
  }
}

/**
 * Does an expired review date block this run? Always in strict mode. In pr mode only when the
 * change edits the expired entry itself in the register, or touches one of the paths the entry
 * covers (owner decision 2026-09-26: "Yes, block on a lapsed review date only when the change
 * edits that item."). Touching the register elsewhere no longer blocks. Without a `select` for
 * the entry, any touch of the register still blocks. `because` names what made it apply.
 *
 * @param {ReviewDateScope | null | undefined} scope
 * @param {{ registerPath: string, coveredPaths?: Iterable<unknown>, select?: (register: any) => unknown }} entry
 * @returns {{ blocking: boolean, because: string | null }}
 */
export function expiredReviewDateDisposition(scope, { registerPath, coveredPaths = [], select }) {
  // Anything that is not a well-formed pr scope is strict: never weaker than before.
  if (!scope || scope.mode !== "pr" || !Array.isArray(scope.touched)) return { blocking: true, because: null };
  const touched = new Set(scope.touched);
  if (touched.has(registerPath)) {
    const change = entryChange(scope, registerPath, select);
    if (change === "edited") return { blocking: true, because: `this entry in ${registerPath}` };
    if (change === "unknown") return { blocking: true, because: registerPath };
  }
  for (const covered of coveredPaths) {
    const file = referencePath(covered);
    const hit = file ? coveredTouch(touched, file) : null;
    if (hit) return { blocking: true, because: hit };
  }
  return { blocking: false, because: null };
}

/**
 * Route one expired-date finding into `errors` or `warnings`. A blocking finding keeps its exact
 * message in strict mode; in pr mode it says which touched path made it apply to this change.
 *
 * @param {{ errors: string[], warnings: string[], scope: ReviewDateScope | null | undefined,
 *   registerPath: string }} sink
 * @param {string} message
 * @param {Iterable<unknown>} coveredPaths
 * @param {(register: any) => unknown} [select] picks the expired entry out of the parsed register
 * @returns {boolean} true when the finding blocks
 */
export function reportExpiredReviewDate({ errors, warnings, scope, registerPath }, message, coveredPaths, select) {
  const { blocking, because } = expiredReviewDateDisposition(scope, { registerPath, coveredPaths, select });
  if (blocking) errors.push(because ? `${message} (blocking: this change touches ${because})` : message);
  else warnings.push(`${message}${/[.!?]$/.test(message) ? "" : "."} ${NOT_BLOCKING_NOTE}`);
  return blocking;
}

/** A register's own top-level review fields: every scalar at its top level, none of its lists. */
export function registerTopLevel(register) {
  if (!register || typeof register !== "object") return null;
  return Object.fromEntries(
    Object.entries(register).filter(([, value]) => value === null || typeof value !== "object"),
  );
}

/** One-line description of the scope for a check's PASS line and log. */
export function describeReviewDateScope(scope) {
  if (scope?.mode === "pr" && Array.isArray(scope.touched)) return `review-dates=pr touched=${scope.touched.length}`;
  return "review-dates=strict";
}

/** Print the scope's notes and each non-blocking finding; a GitHub annotation too when in Actions. */
export function printReviewDateWarnings(prefix, scope, warnings, env = process.env) {
  for (const note of scope?.notes ?? []) console.warn(`${prefix}_REVIEW_DATE_MODE: ${note}`);
  for (const warning of warnings) {
    console.warn(`${prefix}_REVIEW_DATE_WARNING: ${warning}`);
    if (env.GITHUB_ACTIONS === "true") {
      console.log(`::warning title=${prefix} review date::${warning.replace(/\r?\n/g, " ")}`);
    }
  }
}
