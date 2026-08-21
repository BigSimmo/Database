#!/usr/bin/env node
/**
 * check-base-freshness — advisory stale-base tripwire.
 *
 * main moves fast (claude/* branches auto-merge on green), so a worktree branched
 * a while ago can be many commits behind origin/main — which is how duplicate work
 * gets built against a stale base. This fetches origin/main and reports how far
 * behind the current branch is, warning loudly past a threshold.
 *
 * ADVISORY ONLY — never exits non-zero on staleness, so it is safe to wire into a
 * SessionStart hook or statusline without ever blocking work. Exit is non-zero
 * only on a genuine tooling error under `--strict` (off by default).
 *
 * HOOK MODE — why stdout matters. This is registered as a SessionStart hook in
 * .claude/settings.json, and Claude Code injects only a SessionStart hook's STDOUT
 * into the model's context; stderr is not injected. Every human-readable branch of
 * finish() used console.error, including the loud "N commits BEHIND origin/main"
 * warning, so the tripwire this script exists to trigger never reached the agent —
 * confirmed on a live session whose injected SessionStart context carried the sibling
 * hook's stdout lines but no `[base-freshness]` line at all, even though this hook ran
 * and exited 0. In hook mode we therefore also emit the hook JSON envelope on stdout:
 *   {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}
 * and only when the message is worth the context it costs — the loud stale warning or
 * an error. A healthy base prints nothing at all to stdout; "ok" is not worth a token
 * in every session's preamble.
 *
 * How hook mode is detected (detected, not guessed). An explicit `--hook` flag wins.
 * Otherwise we infer it from CLAUDE_PROJECT_DIR being set — Claude Code exports that
 * for hook commands specifically; it is absent from the Bash-tool environment, checked
 * directly on 2026-08-18 — together with a non-TTY stdout. `--json` is never hook mode.
 * The inference is also fail-safe rather than fail-closed: the human line still goes to
 * stderr in every mode, so a misfire on a manual run cannot break the terminal output
 * that `npm run check:base-freshness`, the `newtask` skill (step 4) and the `handoff`
 * skill read — it would only add one extra JSON line on stdout.
 *
 * The origin/main fetch is capped at 10s. Claude Code gives a hook a 60s budget, so an
 * un-timed fetch against an unreachable remote could burn the entire SessionStart
 * budget; on timeout we fall back to the last-known origin/main exactly as the offline
 * path already did.
 *
 * Env:
 *   STALE_BASE_THRESHOLD  commits-behind that triggers the loud warning (default 10)
 *   BASE_FRESHNESS_NO_FETCH=1  skip the network fetch (use last-known origin/main)
 * Flags:
 *   --json    machine-readable output
 *   --hook    force SessionStart hook output on stdout (auto-detected; see above)
 *   --strict  exit 1 when the base ref cannot be resolved (default: exit 0)
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

const threshold = Number.parseInt(process.env.STALE_BASE_THRESHOLD ?? "10", 10) || 10;
const asJson = process.argv.includes("--json");
const strict = process.argv.includes("--strict");

// `--json` is a machine contract of its own and must keep stdout byte-identical, so it
// short-circuits the inference. The CLAUDE_PROJECT_DIR + non-TTY pair is the narrowest
// signal that separates a hook invocation from every other way this script is run: a
// human terminal has a TTY stdout, and the Bash tool (the other non-TTY caller) does not
// get CLAUDE_PROJECT_DIR exported into its environment.
const hookMode =
  !asJson && (process.argv.includes("--hook") || (Boolean(process.env.CLAUDE_PROJECT_DIR) && !process.stdout.isTTY));

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return undefined;
  }
}

function finish(result) {
  const stale = !result.error && result.behind > threshold;

  if (asJson) {
    console.log(JSON.stringify(result));
    process.exit(result.error && strict ? 1 : 0);
  }

  // The human line stays on stderr in every mode, hook runs included. Docs, the
  // `newtask` skill and the `handoff` skill all read this exact line off the terminal,
  // and stderr costs the model nothing because Claude Code drops it.
  if (result.error) {
    console.error(`[base-freshness] ${result.error}`);
  } else if (stale) {
    console.error(
      `\n⚠  [base-freshness] ${result.branch} is ${result.behind} commits BEHIND origin/main ` +
        `(ahead ${result.ahead}).\n` +
        `   You may be building on a stale base — rebase/merge origin/main before starting new work.\n`,
    );
  } else {
    console.error(
      `[base-freshness] ${result.branch}: behind ${result.behind}, ahead ${result.ahead} vs origin/main — ok`,
    );
  }

  // Only a stale base or a tooling error earns a place in the session's injected
  // context; a fresh base stays silent on stdout so it costs the model nothing.
  if (hookMode && (stale || result.error)) {
    const additionalContext = result.error
      ? `[base-freshness] ${result.error} — ahead/behind vs origin/main is unknown, so treat this base as unverified.`
      : `[base-freshness] Branch ${result.branch} is ${result.behind} commits BEHIND origin/main (ahead ${result.ahead}). ` +
        `You may be building on a stale base — rebase or merge origin/main before starting new work.`;
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }));
  }

  process.exit(result.error && strict ? 1 : 0);
}

// Worktree-identity tripwire. A worktree's `.git` file can vanish (observed repeatedly
// against `.claude/worktrees/*` this week — see AGENTS.md "Worktree sweep destroys live
// work") without any command erroring: git just walks up the directory tree, finds the
// next real `.git` above it, and silently treats THAT repository as the target from then
// on — wrong branch, wrong working tree, commands that look like they succeeded. Detect
// it the same way a human would: ask git where it thinks the repo root is, and compare
// that to where Claude Code was actually told the project lives. CLAUDE_PROJECT_DIR is
// exported for every hook invocation and is the one signal available here that names the
// INTENDED worktree independent of whatever `.git` link git happens to resolve.
const expectedRoot = process.env.CLAUDE_PROJECT_DIR;
if (expectedRoot) {
  const resolvedToplevel = tryGit(["rev-parse", "--show-toplevel"]);
  // realpath, not just path.resolve: CLAUDE_PROJECT_DIR can name the intended checkout
  // through a symlink or junction (D: Dev Drive worktrees are reached that way in some
  // setups) while `git rev-parse --show-toplevel` always returns the canonical path. Two
  // spellings of the same real directory must not trip the tripwire. If either side can't be
  // resolved (permissions, a path that vanished between the git call and this one), fall back
  // to the lexical form rather than throwing — this check is advisory-only and must never take
  // down the SessionStart hook it runs in.
  const normalize = (p) => {
    let resolved = path.resolve(p);
    try {
      resolved = realpathSync.native(resolved);
    } catch {
      // Leave `resolved` as the lexical path.resolve() form.
    }
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  if (resolvedToplevel && normalize(resolvedToplevel) !== normalize(expectedRoot)) {
    finish({
      branch: "(unknown)",
      error:
        `this worktree's .git link is broken — git resolved the repo root as "${resolvedToplevel}" ` +
        `instead of the expected "${expectedRoot}". Commands run here are silently operating on a ` +
        `DIFFERENT checkout. Stop and recreate this worktree before doing any more work in it.`,
      behind: 0,
      ahead: 0,
    });
  }
}

const branch = tryGit(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "(unknown)";

if (process.env.BASE_FRESHNESS_NO_FETCH !== "1") {
  try {
    // 10s cap: a hook gets ~60s total, and a fetch that hangs (unreachable remote, a
    // credential prompt, a wedged proxy) would otherwise eat the whole SessionStart
    // budget for an advisory check. The default SIGTERM killSignal is sufficient here —
    // libuv maps SIGTERM to TerminateProcess on Windows, so the child dies even if it
    // installs a SIGTERM handler (measured on node v24 / win32: ETIMEDOUT at ~1.5s for a
    // 1500ms timeout, both with and without a handler). No SIGKILL override needed.
    execFileSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "ignore", timeout: 10_000 });
  } catch {
    // Offline, no remote, or the fetch timed out — fall back to whatever origin/main we
    // already have. A slightly stale answer beats a stalled session start.
  }
}

if (!tryGit(["rev-parse", "--verify", "--quiet", "origin/main"])) {
  finish({ branch, error: "origin/main not resolvable (no remote or never fetched)", behind: 0, ahead: 0 });
}

const counts = tryGit(["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
if (!counts) {
  finish({ branch, error: "could not compute ahead/behind vs origin/main", behind: 0, ahead: 0 });
}

const [behind, ahead] = counts.split(/\s+/).map((n) => Number.parseInt(n, 10) || 0);
finish({ branch, behind, ahead, threshold });
