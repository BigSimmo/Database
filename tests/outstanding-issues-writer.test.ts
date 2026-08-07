import { describe, expect, it } from "vitest";

import { parseIssues } from "../scripts/check-outstanding-issues.mjs";
import { addIssue, escapeCell, resolveIssue, splitCells, updateIssue } from "../scripts/outstanding-issues.mjs";

const OPEN_CELLS = 10;
const ARCHIVE_CELLS = 5;

const ledger = [
  "# Outstanding",
  "",
  "<!-- issues:next-id=7 -->",
  "",
  "## Open items",
  "",
  "| ID | Type | Priority / status | Group / main issue | Before starting | Codex | Checks / CI | External input / time | Done when | Details |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  "| #005 | issue | <strong>P2</strong><br>Ready | <strong>Test</strong><br>first | None | 1h | 5m | None | first is fixed | <details><summary>Evidence</summary><strong>Context:</strong> detail one<br><strong>Source:</strong> src<br><strong>Added:</strong> 2026-01-01</details> |",
  "| #006 | task | <strong>P3</strong><br>Open | <strong>Test</strong><br>second | Revalidate | 2h | 10m | None | second is done | <details><summary>Evidence</summary><strong>Context:</strong> detail two<br><strong>Source:</strong> src<br><strong>Added:</strong> 2026-01-02</details> |",
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
    const next = addIssue(ledger, { pri: "P1", type: "rec", summary: "third" }, { date: "2026-02-02" });
    const row = rowFor(next, "#007");
    expect(row?.table).toBe("open");
    expect(next.indexOf("| #007 ")).toBeLessThan(next.indexOf("## Resolved / archive"));
  });

  it("allocates the marker's id and bumps it", () => {
    const next = addIssue(
      ledger,
      { summary: "third", status: "Ready", group: "Documents", codex: "30m", done: "fixture passes" },
      { date: "2026-02-02" },
    );
    const row = rowFor(next, "#007");
    expect(row).toBeDefined();
    expect(row!.raw).toContain("<strong>P2</strong><br>Ready");
    expect(row!.raw).toContain("<strong>Documents</strong><br>third");
    expect(row!.raw).toContain("| 30m |");
    expect(row!.raw).toContain("| fixture passes |");
    expect(parseIssues(next).nextId).toBe(8);
  });

  it("escapes pipes in prose instead of creating columns", () => {
    const next = addIssue(ledger, { summary: "a | b", detail: "c | d" }, { date: "2026-02-02" });
    const row = rowFor(next, "#007");
    expect(splitCells(row!.raw)).toHaveLength(OPEN_CELLS);
    expect(row!.raw).toContain("a \\| b");

    const archived = resolveIssue(next, "#007", "done | verified", { date: "2026-03-03" });
    const archivedRow = rowFor(archived, "#007");
    expect(splitCells(archivedRow!.raw)).toHaveLength(ARCHIVE_CELLS);
    expect(archivedRow!.raw).toContain("a \\| b");
    expect(archivedRow!.raw).toContain("done \\| verified");
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
    const next = updateIssue(ledger, "#006", {
      status: "Blocked",
      checks: "15m",
      detail: "replaced | detail",
    });
    const row = rowFor(next, "#006");
    expect(row?.table).toBe("open");
    expect(splitCells(row!.raw)).toHaveLength(OPEN_CELLS);
    expect(row!.raw).toContain("<strong>P3</strong><br>Blocked");
    expect(row!.raw).toContain("<strong>Test</strong><br>second");
    expect(row!.raw).toContain("| 15m |");
    expect(row!.raw).toContain("replaced \\| detail");
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
