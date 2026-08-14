import { describe, expect, it } from "vitest";

import { dirtyGovernedPaths } from "../scripts/check-ledger-write-discipline.mjs";

const ISSUES = "docs/outstanding-issues.md";
const REVIEW = "docs/branch-review-ledger.md";
const INBOX = "docs/outstanding-issues-inbox";
const REQUEST = `${INBOX}/829597d4-698b-4cc2-9bf4-65310504cba3.json`;

/** `git status --porcelain=v1 -z` emits NUL-terminated records, not lines. */
const porcelain = (...records: string[]) => `${records.join("\0")}\0`;

describe("ledger write discipline dirty-tree guard", () => {
  it("reports nothing for a clean worktree", () => {
    expect(dirtyGovernedPaths("")).toEqual([]);
    expect(dirtyGovernedPaths(porcelain())).toEqual([]);
  });

  it("flags an uncommitted edit to the canonical ledger", () => {
    // The #313 defect: both audit endpoints are commits, so this edit is
    // invisible to the range and the gate used to print a pass over it.
    const dirty = dirtyGovernedPaths(porcelain(` M ${ISSUES}`));
    expect(dirty).toHaveLength(1);
    expect(dirty[0].path).toBe(ISSUES);
    expect(dirty[0].reason).toContain("uncommitted change");
  });

  it("does not shift paths when the status field's first column is a space", () => {
    // An unstaged change is " M path". Trimming the porcelain output eats that
    // leading space and slices one character off every path, which silently
    // stops the governed-path match from ever firing.
    expect(dirtyGovernedPaths(porcelain(` M ${ISSUES}`))[0].path).toBe(ISSUES);
    expect(dirtyGovernedPaths(porcelain(`M  ${ISSUES}`))[0].path).toBe(ISSUES);
    expect(dirtyGovernedPaths(porcelain(`MM ${ISSUES}`))[0].path).toBe(ISSUES);
  });

  it("flags an untracked inbox request and the frozen review ledger", () => {
    expect(dirtyGovernedPaths(porcelain(`?? ${REQUEST}`))).toEqual([
      { path: REQUEST, status: "??", reason: "an outstanding-issues inbox request is untracked" },
    ]);
    expect(dirtyGovernedPaths(porcelain(` M ${REVIEW}`))[0].reason).toContain("branch-review ledger");
  });

  it("reports both sides of a rename record", () => {
    // Porcelain follows an R/C record with a second NUL field holding the origin.
    const dirty = dirtyGovernedPaths(porcelain(`R  ${INBOX}/applied/a.json`, `${INBOX}/a.json`));
    expect(dirty.map((entry) => entry.path)).toEqual([`${INBOX}/applied/a.json`, `${INBOX}/a.json`]);
  });

  it("consumes the rename origin field rather than reading it as a record", () => {
    const dirty = dirtyGovernedPaths(porcelain(`R  ${INBOX}/applied/a.json`, `${INBOX}/a.json`, ` M ${ISSUES}`));
    expect(dirty.map((entry) => entry.path)).toEqual([`${INBOX}/applied/a.json`, `${INBOX}/a.json`, ISSUES]);
  });

  it("ignores dirty files the gate does not govern", () => {
    // The gate must not fail an ordinary product change; only ledger paths make
    // its committed-range verdict meaningless.
    expect(dirtyGovernedPaths(porcelain(" M src/lib/rag/rag.ts", "?? scratch.txt", " M package.json"))).toEqual([]);
  });

  it("does not treat a lookalike path outside the inbox as governed", () => {
    expect(dirtyGovernedPaths(porcelain(" M docs/outstanding-issues-inbox-notes.md"))).toEqual([]);
    expect(dirtyGovernedPaths(porcelain(" M docs/outstanding-issues.md.bak"))).toEqual([]);
  });

  it("reports each governed path once", () => {
    expect(dirtyGovernedPaths(porcelain(` M ${ISSUES}`, `MM ${ISSUES}`))).toHaveLength(1);
  });
});
