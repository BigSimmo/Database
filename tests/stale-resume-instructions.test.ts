import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

/**
 * A document that tells a future session to `git checkout <feature-branch>` is
 * a live instruction. Once that branch merges, the instruction is worse than
 * useless: it sends the session to a merged branch to redo settled work.
 *
 * On 2026-08-27 that cost a whole session. A handover said Phase 5 was
 * unfinished with a red check and an open decision, and opened with a checkout
 * of `claude/ward-flow-phase-5-p8rwcm`. The work had merged twenty hours
 * earlier. The session re-derived a settled decision, prepared to fix a green
 * check, and started re-running an experiment that had already been performed
 * ten times. See `docs/development-speed-playbook.md` §1.
 *
 * This gate is deliberately narrow and offline. It cannot know whether a branch
 * merged — that needs the network. What it CAN do is refuse a checkout
 * instruction that carries no status marker at all, which is exactly the state
 * the Phase 5 handover was in. A document that says "this branch is merged, do
 * not check it out" passes; one that silently says "check this out" does not.
 */
const MARKER = /\b(MERGED|merged|OBSOLETE|obsolete|HISTORICAL|historical|superseded|do not check ?it out)\b/;

/**
 * `git checkout <branch>` / `git switch <branch>` naming an EXISTING feature
 * branch.
 *
 * Deliberately does not match `-b` / `-c`, which CREATE a branch — the opposite
 * of resuming a stale one, and a perfectly good instruction that never goes out
 * of date. Nor does it match a template placeholder such as
 * `codex/cloud-<slug>`, which names no branch at all. Both exclusions were
 * added after this gate flagged them as false positives on first run.
 */
const CHECKOUT = /\bgit (?:checkout|switch)\s+((?:claude|codex)\/[\w.\-/]+)/g;

/** A capture that is a real branch name rather than a truncated placeholder. */
function isConcreteBranch(text: string, match: RegExpMatchArray): boolean {
  const branch = match[1];
  if (branch.endsWith("-") || branch.endsWith("/")) return false;
  const next = text[(match.index ?? 0) + match[0].length];
  return next !== "<" && next !== "{";
}

function trackedDocs(): string[] {
  return execFileSync("git", ["ls-files", "docs/*.md", "docs/**/*.md", "*.md"], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("documents do not silently tell a session to resume on a feature branch", () => {
  it("finds at least one document to check, so the sweep cannot pass vacuously", () => {
    expect(trackedDocs().length).toBeGreaterThan(50);
  });

  it("every feature-branch checkout instruction carries a status marker", () => {
    const offenders: string[] = [];

    for (const path of trackedDocs()) {
      const text = readFileSync(path, "utf8");
      const branches = [...text.matchAll(CHECKOUT)]
        .filter((match) => isConcreteBranch(text, match))
        .map((match) => match[1]);
      if (branches.length === 0) continue;

      // The marker must appear somewhere in the document. Requiring it on the
      // same line would be trivially satisfied by a comment and would miss the
      // banner-at-the-top pattern that actually reads well.
      if (!MARKER.test(text)) {
        offenders.push(`${path} → ${[...new Set(branches)].join(", ")}`);
      }
    }

    expect(
      offenders,
      [
        "These documents instruct a session to check out a feature branch but never say whether that",
        "branch is still live. Once it merges, the instruction sends the next session to redo settled",
        "work — the exact failure recorded in docs/development-speed-playbook.md §1.",
        "",
        "Fix by stating the branch's status in the document: a banner saying it is merged, obsolete or",
        "historical, or an explicit note that it is still the live working branch.",
        "",
        ...offenders.map((entry) => `  - ${entry}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("recognises the marker patterns it claims to recognise", () => {
    // Proving the guard is not vacuous: without a marker it must flag, with one
    // it must not.
    expect(MARKER.test("git checkout claude/thing")).toBe(false);
    expect(MARKER.test("This branch is merged; do not check it out.")).toBe(true);
    expect(MARKER.test("> **OBSOLETE — Phase 5 is built and merged.**")).toBe(true);
  });

  it("matches the checkout forms it claims to match, and only those", () => {
    const found = (text: string) =>
      [...text.matchAll(new RegExp(CHECKOUT.source, "g"))]
        .filter((match) => isConcreteBranch(text, match))
        .map((match) => match[1]);

    expect(found("git checkout claude/ward-flow-phase-5-p8rwcm")).toEqual(["claude/ward-flow-phase-5-p8rwcm"]);
    expect(found("git switch codex/some-task")).toEqual(["codex/some-task"]);

    // Creating a branch is not resuming one, and never goes stale.
    expect(found("git checkout -b claude/new-thing")).toEqual([]);
    expect(found("git switch -c codex/cloud-thing")).toEqual([]);

    // A template placeholder names no branch.
    expect(found("git switch codex/cloud-<short-generic-slug>")).toEqual([]);

    expect(found("git checkout main")).toEqual([]);
  });
});
