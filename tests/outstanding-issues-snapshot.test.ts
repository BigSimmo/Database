import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SNAPSHOT_VERSION,
  buildSnapshot,
  generate,
  readCommittedRevision,
  readLedgerRevision,
} from "../scripts/generate-outstanding-issues-snapshot.mjs";

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
    expect(row?.id).not.toMatch(/<!--/);
  });

  // Hazard 2: the real ledger contains 8 escaped pipes. A naive split turns
  // each into a column boundary and rejects a valid row as malformed.
  it("keeps an escaped pipe inside a cell instead of splitting on it", () => {
    const withEscapedPipe = LEDGER.replace("Route the drift check.", "Compare index a \\| index b before routing.");
    const snapshot = buildSnapshot({ ledgerMarkdown: withEscapedPipe, inboxRecords: [], revision: REVISION });
    expect(snapshot.counts.open).toBe(3);
    expect(snapshot.open.find((item) => item.id === "#316")?.detail).toContain("index a");
  });

  // Hazard 2b: having survived the split, the escape must not survive into the
  // JSON. `\|` is a markdown-table requirement — a pipe inside a cell would
  // otherwise read as a column boundary — and JSON has no such rule, so leaving
  // it in the data contract makes every consumer render a literal backslash.
  // The ledger page showed exactly that for `#SZGPAH`: "2 failed \| 14 passed".
  //
  // The unescape lives in this generator and NOT in `splitCells`, which the
  // ledger tooling uses to round-trip cells back into markdown; unescaping
  // there would write a bare pipe into a table row and corrupt
  // `issues:reconcile`.
  it("drops the markdown pipe escape when writing cell text into the JSON", () => {
    const withEscapedPipe = LEDGER.replace("Route the drift check.", "2 failed \\| 14 passed");
    const snapshot = buildSnapshot({ ledgerMarkdown: withEscapedPipe, inboxRecords: [], revision: REVISION });

    const detail = snapshot.open.find((item) => item.id === "#316")?.detail;
    expect(detail).toBe("2 failed | 14 passed");
    expect(detail).not.toContain("\\");
    // The row is still one row: unescaping must not reintroduce a column split.
    expect(snapshot.counts.open).toBe(3);
  });

  it("drops the escape in every cell, not only the detail column", () => {
    const withEscapedPipe = LEDGER.replace("Answers degrade to source-only", "Answers degrade \\| source-only").replace(
      "Fix the fast-route budget.",
      "Fix \\| the budget.",
    );
    const snapshot = buildSnapshot({ ledgerMarkdown: withEscapedPipe, inboxRecords: [], revision: REVISION });

    expect(snapshot.open.find((item) => item.id === "#231")?.summary).toBe("Answers degrade | source-only");
    // Nothing anywhere in the emitted document keeps the escape — including the
    // queue, whose capability/timing/estimate cells go straight through.
    expect(JSON.stringify(snapshot)).not.toContain("\\\\|");
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

/**
 * The production image has no git repository: `.dockerignore` excludes `.git`,
 * the Dockerfile build stage does `COPY . .`, and `prebuild` then regenerates
 * this snapshot inside that image. `readLedgerRevision()` shells out to `git
 * log`, so there it fails and returns `null` — and writing that `null` over the
 * committed revision left `FreshnessStamp` on its "Ledger revision unknown"
 * branch permanently, in the one environment `#338` actually failed in. Spec
 * §6.3 (the page states its own age and cannot hide it) was inert in production.
 *
 * These reproduce that condition without Docker: the fixture paths are outside
 * any git working tree, so `git log -- <path>` refuses them exactly as it
 * refuses a repo-less image. The `fatal:` line git prints on stderr during this
 * block is the reproduction, not a test failure.
 */
describe("ledger revision when git cannot be read", () => {
  let dir: string;
  let ledgerPath: string;
  let inboxDir: string;
  let snapshotPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "issues-snapshot-nogit-"));
    ledgerPath = join(dir, "outstanding-issues.md");
    inboxDir = join(dir, "inbox");
    snapshotPath = join(dir, "outstanding-issues-snapshot.json");
    mkdirSync(inboxDir);
    writeFileSync(ledgerPath, LEDGER, "utf8");
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("cannot read a revision for a ledger outside any git repository", () => {
    // The premise the rest of this block rests on. If git ever started
    // answering here, the tests below would pass for the wrong reason.
    expect(readLedgerRevision(ledgerPath)).toBeNull();
  });

  it("keeps the committed revision rather than writing null over it", () => {
    writeFileSync(
      snapshotPath,
      JSON.stringify({
        version: SNAPSHOT_VERSION,
        ledger_revision: REVISION,
        counts: {},
        queue: [],
        open: [],
        pending: [],
      }),
      "utf8",
    );

    const snapshot = generate({ ledgerPath, inboxDir, snapshotPath });
    expect(snapshot.ledger_revision).toEqual(REVISION);
  });

  it("records null when there is no committed snapshot to preserve from", () => {
    // Fail-safe in the honest direction: no revision anywhere means the page
    // says it does not know, which is true.
    const snapshot = generate({ ledgerPath, inboxDir, snapshotPath });
    expect(snapshot.ledger_revision).toBeNull();
  });

  it("preserves the revision and nothing else, so stale content cannot ride along", () => {
    // The committed file here claims one open item; the ledger has three. Only
    // `ledger_revision` may survive from the committed snapshot — every content
    // key must still be rebuilt from the ledger, or this fix would let the
    // staleness gate compare regenerated content against itself.
    writeFileSync(
      snapshotPath,
      JSON.stringify({
        version: SNAPSHOT_VERSION,
        ledger_revision: REVISION,
        counts: { open: 1, p1: 0, p2: 0, p3: 0, queued: 0, pending: 0, resolved: 0 },
        queue: [],
        open: [{ id: "#stale", priority: "P3", type: "task", summary: "stale", detail: "", source: "", added: "" }],
        pending: [],
      }),
      "utf8",
    );

    const snapshot = generate({ ledgerPath, inboxDir, snapshotPath });
    expect(snapshot.ledger_revision).toEqual(REVISION);
    expect(snapshot.counts.open).toBe(3);
    expect(snapshot.open.map((row: { id: string }) => row.id)).toEqual(["#231", "#316", "#CCZ4HB"]);
    expect(snapshot.queue).toHaveLength(2);
  });

  it("refuses a malformed committed revision instead of carrying it forward", () => {
    // `resolveFreshness` does date arithmetic on `committed_at`. Carrying a
    // shape it cannot use would put "Invalid Date" and `NaN` on the one surface
    // whose job is stating age.
    writeFileSync(snapshotPath, JSON.stringify({ ledger_revision: "2026-08-20T00:00:00Z" }), "utf8");
    expect(readCommittedRevision(snapshotPath)).toBeNull();

    writeFileSync(snapshotPath, JSON.stringify({ ledger_revision: { sha: "abc" } }), "utf8");
    expect(readCommittedRevision(snapshotPath)).toBeNull();
  });

  it("returns null for a snapshot file that is missing or unreadable", () => {
    expect(readCommittedRevision(join(dir, "no-such-file.json"))).toBeNull();
    writeFileSync(snapshotPath, "{ not json", "utf8");
    expect(readCommittedRevision(snapshotPath)).toBeNull();
  });
});
