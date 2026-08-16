import { describe, expect, it } from "vitest";

import { parseIssues } from "../scripts/check-outstanding-issues.mjs";
import { displayIdForUlid, issueUlid } from "../scripts/issue-id.mjs";
import { addIssue, escapeCell, resolveIssue, splitCells, updateIssue } from "../scripts/outstanding-issues.mjs";

const OPEN_CELLS = 7;
const ARCHIVE_CELLS = 5;
const TEST_ULID = issueUlid(Date.UTC(2026, 1, 2), Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
const TEST_ID = displayIdForUlid(TEST_ULID);

const ledger = [
  "# Outstanding",
  "",
  "<!-- issues:next-id=7 -->",
  "",
  "## Open items",
  "",
  "| ID | Pri | Type | Summary | Detail / next action | Source | Added |",
  "| ---- | --- | ---- | ---- | ---- | ---- | ---- |",
  "| #005 | P2 | issue | first | detail one | src | 2026-01-01 |",
  "| #006 | P3 | task | second | detail two | src | 2026-01-02 |",
  "",
  "## Resolved / archive",
  "",
  "| ID | Type | Summary | Outcome | Resolved |",
  "| ---- | ---- | ---- | ---- | ---- |",
  "| #001 | task | old | done long ago | 2025-12-01 |",
  "",
].join("\n");

const rowFor = (markdown: string, id: string) => parseIssues(markdown).rows.find((row) => row.id === id);

describe("outstanding-issues writer", () => {
  it("appends into the open table, never the archive", () => {
    // The defect this writer exists for: hand edits anchored on an id that had
    // been archived, so the new row landed in the archive table.
    const next = addIssue(
      ledger,
      { pri: "P1", type: "rec", summary: "third" },
      { date: "2026-02-02", issueUlid: TEST_ULID },
    );
    const row = rowFor(next, TEST_ID);
    expect(row?.table).toBe("open");
    expect(row?.ulid).toBe(TEST_ULID);
    expect(next.indexOf(`| ${TEST_ID} `)).toBeLessThan(next.indexOf("## Resolved / archive"));
  });

  it("derives a permanent display id and leaves the deprecated marker untouched", () => {
    const next = addIssue(ledger, { summary: "third" }, { date: "2026-02-02", issueUlid: TEST_ULID });
    expect(rowFor(next, TEST_ID)?.ulid).toBe(TEST_ULID);
    expect(parseIssues(next).nextId).toBe(7);
  });

  it("escapes pipes in prose instead of creating columns", () => {
    const next = addIssue(ledger, { summary: "a | b", detail: "c | d" }, { date: "2026-02-02", issueUlid: TEST_ULID });
    const row = rowFor(next, TEST_ID);
    expect(splitCells(row!.raw)).toHaveLength(OPEN_CELLS);
    expect(row!.raw).toContain("a \\| b");
  });

  it("moves a row to the archive rather than copying it, reshaping its width", () => {
    const next = resolveIssue(ledger, "#005", "Resolved by PR #1", { date: "2026-03-03" });
    const rows = parseIssues(next).rows.filter((row) => row.id === "#005");
    expect(rows).toHaveLength(1);
    expect(rows[0].table).toBe("archive");
    expect(splitCells(rows[0].raw)).toHaveLength(ARCHIVE_CELLS);
    expect(rows[0].raw).toContain("Resolved by PR #1");
  });

  it("edits an open row in place without changing its width", () => {
    const next = updateIssue(ledger, "#006", { detail: "replaced | detail" });
    const row = rowFor(next, "#006");
    expect(row?.table).toBe("open");
    expect(splitCells(row!.raw)).toHaveLength(OPEN_CELLS);
    expect(row!.raw).toContain("replaced \\| detail");
  });

  it("extends a colliding display id and preserves it through update and archive", () => {
    const firstUlid = "0000000000ABCDEF0000000000";
    const secondUlid = "0000000000ABCDEF1000000000";
    const first = addIssue(ledger, { summary: "first modern" }, { date: "2026-02-02", issueUlid: firstUlid });
    const second = addIssue(first, { summary: "second modern" }, { date: "2026-02-03", issueUlid: secondUlid });
    expect(rowFor(second, "#ABCDEF")?.ulid).toBe(firstUlid);
    expect(rowFor(second, "#ABCDEF1")?.ulid).toBe(secondUlid);

    const updated = updateIssue(second, "#ABCDEF1", { detail: "retained identity" });
    const archived = resolveIssue(updated, "#ABCDEF1", "done", { date: "2026-03-03" });
    const row = rowFor(archived, "#ABCDEF1");
    expect(row?.table).toBe("archive");
    expect(row?.ulid).toBe(secondUlid);
  });

  it("refuses edits that would not survive the gate", () => {
    expect(() => resolveIssue(ledger, "#999", "x")).toThrow(/not in/);
    expect(() => addIssue(ledger, { pri: "P9", summary: "x" })).toThrow(/--pri/);
    expect(() => addIssue(ledger, { type: "nope", summary: "x" })).toThrow(/--type/);
    expect(() => addIssue(ledger, {})).toThrow(/--summary/);
    expect(() => updateIssue(ledger, "#006", {})).toThrow(/at least one/);
  });

  it("refuses to archive a row twice", () => {
    const once = resolveIssue(ledger, "#005", "first", { date: "2026-03-03" });
    expect(() => resolveIssue(once, "#005", "again")).toThrow(/already archived/);
  });

  it("collapses newlines so a row stays one line", () => {
    expect(escapeCell("a\nb\r\nc")).toBe("a b c");
  });
});
