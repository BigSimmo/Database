#!/usr/bin/env node
/**
 * WHO IS IN WHICH WORKTREE — resolve a ward chat by LOCATION, never by name.
 *
 * A session name is not an identity. On 2026-09-01 one session messaged as `database-46` saying it
 * was NOT Ward Lead, then messaged again as `Ward Lead` from the identical address; every session
 * was renamed twice more the same day; a branch called `ward-flow-ward-board` held no board work
 * while `ward-flow-print-fixes` held all of it; and a worktree folder named for commit 89d7f99ec
 * had a different commit checked out. Four labels, four lies, one day.
 *
 * A FOLDER cannot lie about which branch is checked out in it, because git answers that, not the
 * occupant. So identity is anchored to the folder and everything else is derived.
 *
 * ⚠️ **THIS IS A FOLDER AUDIT, NOT AN IDENTITY SYSTEM, AND IT WOULD NOT HAVE PREVENTED THE
 * CONFUSION DESCRIBED ABOVE.** It answers "what is checked out in folder X". The failure asked a
 * different question — "who sent this message" — and an inbound message carries a name and a
 * transport ADDRESS, never a folder. Nothing here connects a marker to a message.
 *
 * What actually resolved that confusion was the transport address: both messages arrived from the
 * identical pipe, an identifier the occupant cannot choose the way it chooses a display name, and
 * it survived two rename waves the same day. **Route on the address. Use this to verify a folder
 * claim ONCE, and never as the thing that says who is speaking.** Full protocol in
 * docs/ward-flow/who-is-who.md.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MARKER = ".ward-session.json";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/** Folder -> { branch, head }, straight from git. Nothing here is self-reported. */
function worktrees() {
  const out = [];
  let current = null;
  for (const line of git(["worktree", "list", "--porcelain"]).split(/\r?\n/)) {
    if (line.startsWith("worktree ")) current = { dir: line.slice(9), branch: null, head: null };
    else if (line.startsWith("HEAD ")) {
      if (current) current.head = line.slice(5, 12);
    } else if (line.startsWith("branch ")) {
      if (current) current.branch = line.slice(7).replace("refs/heads/", "");
    } else if (line.startsWith("detached")) {
      if (current) current.branch = "(detached)";
    } else if (line === "" && current) {
      out.push(current);
      current = null;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * The marker a chat writes INSIDE its own worktree. It is a claim — but a claim pinned to a
 * location, which is the binding that was missing. A marker naming a branch the folder does not
 * hold is reported as STALE rather than believed.
 */
function marker(dir) {
  const file = path.join(dir, MARKER);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { role: "(unreadable marker)", session: "?", branch: null };
  }
}

const argv = process.argv.slice(2);
const showAll = argv.includes("--all");
const wanted = argv.find((a) => !a.startsWith("--"))?.toLowerCase() ?? null;

/*
 * ⚠️ THE DEFAULT VIEW FILTERS BY NAME, WHICH IS THE MISTAKE THIS TOOL EXISTS TO FIX — so the
 * filtering is now VISIBLE rather than silent. Ward Verifier found the old filter omitted
 * D:/Worktrees/Database/pr-2390-fix: no "ward" in the path and no marker, yet it is the recorded
 * working line and one of the six live paths a verification claim depends on. A who-is-where
 * tool that cannot see the working line is doing exactly what it was built to prevent.
 *
 * The filter stays — this machine has over 160 worktrees and an unfiltered list is unusable.
 * What changed is that the number it hides is printed, and --all removes it.
 */
const all = worktrees().map((w) => ({ ...w, mark: marker(w.dir) }));
const rows = showAll ? all : all.filter((w) => w.mark || /ward/i.test(w.dir));
const hidden = all.length - rows.length;

if (rows.length === 0) {
  console.log("No ward worktrees and no session markers found.");
  process.exit(0);
}

for (const w of rows) {
  const m = w.mark;
  const claimed = m?.branch ?? null;
  // The one check that matters: does the marker's claim match what git says is actually here?
  /*
   * THREE states, not two. A marker that omits `branch`, or sets it null, cannot be compared
   * against git at all — and it used to print "ok", the same word as a claim git had actually
   * verified. An unchecked claim wearing the verified badge is a label lying with this tool's
   * authority behind it, which is the exact failure the tool exists to stop. Found by Ward
   * Verifier, measured across five cases.
   */
  const status = !m
    ? "no marker"
    : !claimed
      ? "UNVERIFIABLE (marker claims no branch)"
      : claimed !== w.branch
        ? `CONTRADICTED (marker says ${claimed})`
        : "verified";
  const role = m?.role ?? "unclaimed";
  const session = m?.session ?? "-";
  if (wanted && !`${role} ${w.dir}`.toLowerCase().includes(wanted)) continue;
  console.log(
    `${role.padEnd(14)} ${String(session).padEnd(34)} ${w.branch ?? "?"}@${w.head ?? "?"}\n${" ".repeat(14)} ${w.dir}   [${status}]`,
  );
}

if (hidden > 0) {
  console.log(
    `
${hidden} further worktree${hidden === 1 ? "" : "s"} hidden by the name filter — run with --all to see every one.`,
  );
}
