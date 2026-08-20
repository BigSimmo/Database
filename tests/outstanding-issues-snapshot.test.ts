import { describe, expect, it } from "vitest";
import { buildSnapshot } from "../scripts/generate-outstanding-issues-snapshot.mjs";

const LEDGER = `# Universal Task Ledger

## Recommended execution queue

| Order | ID(s) | Acuity | Capability | When | Estimate | Outcome, gate, verification, and stopping condition |
| ----: | ----- | ----- | ----- | ----- | ----- | ----- |
| 1 | \`#231\` | A1 | Specialist | Immediate | 2-4 hours | Fix the fast-route budget. |
| 2 | \`#CCZ4HB\` | A2 | Standard | After review | 1 hour | Restore review budget. |

## Open items

| ID | Pri | Type | Summary | Detail / next action | Source | Added |
| ---- | --- | ----- | ----- | ----- | ----- | ---------- |
| #231 | P2 | task | Answers degrade to source-only | Measure the fast-route budget. | PR #901 | 2026-07-21 |
| #316 | P1 | issue | Live DB missing 20 indexes | Route the drift check. | session | 2026-08-11 |
| #CCZ4HB | P1 | rec | PR churn exhausted review budget | Reduce open PR count. | session | 2026-08-14 |

## Resolved / archive

| ID | Type | Summary | Outcome | Resolved |
| ---- | ----- | ----- | ----- | ---------- |
| #338 | issue | Visual register drifts | Retired | 2026-08-18 |
`;

const INBOX = [
  {
    version: 2,
    id: "a20fc4ce",
    createdOn: "2026-08-19",
    action: "add",
    payload: { pri: "P3", type: "task", summary: "Add docling fixtures", detail: "…", source: "coordinator" },
  },
];

const REVISION = { sha: "a".repeat(40), committed_at: "2026-08-20T09:14:00Z" };

describe("buildSnapshot", () => {
  it("parses both ID schemes and never drops alphanumeric ids", () => {
    const snapshot = buildSnapshot({ ledgerMarkdown: LEDGER, inboxRecords: INBOX, revision: REVISION });
    expect(snapshot.open.map((row) => row.id)).toEqual(["#231", "#316", "#CCZ4HB"]);
    expect(snapshot.queue[1].ids).toEqual(["#CCZ4HB"]);
  });

  it("keeps priority and acuity as separate, non-derived fields", () => {
    const snapshot = buildSnapshot({ ledgerMarkdown: LEDGER, inboxRecords: INBOX, revision: REVISION });
    // #231 is A1 in the queue but only P2 in the open table. Conflating them
    // would report three urgent items where there are two P1 and one A1.
    expect(snapshot.queue[0].acuity).toBe("A1");
    expect(snapshot.open.find((row) => row.id === "#231")?.priority).toBe("P2");
    expect(snapshot.counts.p1).toBe(2);
  });

  it("takes queue prose from the cited row's own Detail cell, not the queue Outcome cell", () => {
    const snapshot = buildSnapshot({ ledgerMarkdown: LEDGER, inboxRecords: INBOX, revision: REVISION });
    expect(snapshot.queue[0].detail).toBe("Measure the fast-route budget.");
  });

  it("counts resolved rows without shipping them", () => {
    const snapshot = buildSnapshot({ ledgerMarkdown: LEDGER, inboxRecords: INBOX, revision: REVISION });
    expect(snapshot).not.toHaveProperty("resolved");
    expect(snapshot.counts.open).toBe(3);
  });

  it("includes pending inbox requests", () => {
    const snapshot = buildSnapshot({ ledgerMarkdown: LEDGER, inboxRecords: INBOX, revision: REVISION });
    expect(snapshot.counts.pending).toBe(1);
    expect(snapshot.pending[0].summary).toBe("Add docling fixtures");
  });

  it("fails loudly on a malformed row rather than dropping it", () => {
    const broken = LEDGER.replace("| #316 | P1 | issue |", "| #316 | P1 |");
    expect(() => buildSnapshot({ ledgerMarkdown: broken, inboxRecords: [], revision: REVISION })).toThrow(/#316/);
  });

  it("records a null revision rather than fabricating a date", () => {
    const snapshot = buildSnapshot({ ledgerMarkdown: LEDGER, inboxRecords: [], revision: null });
    expect(snapshot.ledger_revision).toBeNull();
  });

  // Hazard 1: 62 of the real ledger's rows carry a ULID in an HTML comment
  // inside the ID cell. Taking the cell verbatim breaks the queue→row join.
  it("strips the issue-ulid HTML comment out of an ID cell", () => {
    const withUlid = LEDGER.replace(
      "| #316 | P1 | issue |",
      "| #316 <!-- issue-ulid:01M0A10Q19SZGPAH22TYYY2366 --> | P1 | issue |",
    );
    const snapshot = buildSnapshot({ ledgerMarkdown: withUlid, inboxRecords: [], revision: REVISION });
    const row = snapshot.open.find((item) => item.id === "#316");
    expect(row).toBeDefined();
    expect(row.id).not.toMatch(/<!--/);
  });

  // Hazard 2: the real ledger contains 8 escaped pipes. A naive split turns
  // each into a column boundary and rejects a valid row as malformed.
  it("keeps an escaped pipe inside a cell instead of splitting on it", () => {
    const withEscapedPipe = LEDGER.replace("Route the drift check.", "Compare index a \\| index b before routing.");
    const snapshot = buildSnapshot({ ledgerMarkdown: withEscapedPipe, inboxRecords: [], revision: REVISION });
    expect(snapshot.counts.open).toBe(3);
    expect(snapshot.open.find((item) => item.id === "#316").detail).toContain("index a");
  });

  // Hazard 3: `## Resolved / archive` holds three tables. A one-shot
  // header-skip counts the 2nd and 3rd header rows as resolved items.
  it("does not count a second archive table's header row as data", () => {
    const twoTables = `${LEDGER}
| ID | Type | Summary | Outcome | Resolved |
| ---- | ----- | ----- | ----- | ---------- |
| #337 | task | Second table row | Done | 2026-08-17 |
`;
    const snapshot = buildSnapshot({ ledgerMarkdown: twoTables, inboxRecords: [], revision: REVISION });
    expect(snapshot.counts.resolved).toBe(2);
  });
});
