# Developer hub — Phase 1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/mockups/development` into a login-gated developer hub whose first live panel is a task ledger rendered from `docs/outstanding-issues.md`, and which cannot silently go stale.

**Architecture:** A build-time generator parses the ledger markdown and the inbox into `data/outstanding-issues-snapshot.json`; a check gate fails the build if that snapshot disagrees with the ledger. Both pages are Server Components importing the snapshot, so no ledger data reaches the client bundle. The hub is one page mounting the repo's canonical `InPageNavHeader` through a `"use client"` nav-header sibling; the ledger is its own route.

**Tech Stack:** Node 24 / npm 11, Next.js 16 App Router (React 19 Server Components), TypeScript 6 strict, Tailwind 4 with `@theme` tokens, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-developer-hub-phase-1-design.md`

## Global Constraints

Every task's requirements implicitly include all of these.

- **Node 24.x / npm 11.x**, `engine-strict`. Never downgrade.
- **Design tokens only.** No hex literals — `eslint-rules/no-hardcoded-hex.mjs` fails the build.
- **Tap targets `min-h-12`** (48 px). Never `min-h-11` — that reintroduces a known `ui-smoke` flake and is explicitly excluded from generic accessibility advice by `AGENTS.md`.
- **Internal navigation** uses `<Link>` / `router.push` / server `redirect()`. Never `<a href="/…">`.
- **Every `<button>` does something.** A control unavailable for a stated reason uses `aria-disabled="true"` + `onClick={ignoreUnavailableActivation}` (from `@/components/ui-primitives`) + `title="… — coming soon"` + an `sr-only` note wired by `aria-describedby`. Never native `disabled` for that case, and never both attributes on one button.
- **One search composer per page.** The hub and ledger own none.
- **The section table lives in the nav-header sibling — always** (`docs/search-chrome-behaviour.md`). Not inline in the page, not in a separate section-index module.
- **Anchors are asserted against rendered DOM, never by grepping for `id=`** — that shortcut is the failure `/issues #256` records.
- **No provider calls.** Phase 1 touches no OpenAI or Supabase surface. Never run `eval:*`, `verify:release`, `check:supabase-project`, or `test:live`.
- **Do not edit `docs/outstanding-issues.md`.** It is serial-only; `check:ledger-write-discipline` rejects direct edits.
- **Run `npm run format` and commit the result** before any push.

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/generate-outstanding-issues-snapshot.mjs` | Parse ledger + inbox + git revision → write snapshot. Owns all markdown parsing. |
| `scripts/check-outstanding-issues-snapshot.mjs` | Regenerate in memory, compare, fail on mismatch. |
| `data/outstanding-issues-snapshot.json` | Generated. Never hand-edited. |
| `src/lib/developer-area/ledger-snapshot.ts` | Import the JSON, validate version, expose typed accessors + freshness. |
| `src/lib/developer-area/hub-panels.ts` | Panel registry: one entry per panel with group, phase, target. |
| `src/components/developer-area/developer-hub-nav-header.tsx` | `"use client"`. Owns `developerHubNavSections`, mounts `InPageNavHeader`. |
| `src/components/developer-area/hub/environment-strip.tsx` | Environment facts row. |
| `src/components/developer-area/hub/freshness-stamp.tsx` | Content date vs build date. Reused by later phases. |
| `src/components/developer-area/hub/panel-card.tsx` | One panel card, live or placeholder. |
| `src/components/developer-area/hub/ledger-item.tsx` | One ledger row with `<details>` expansion. |
| `src/app/mockups/development/page.tsx` | Hub page (Server Component). Modified. |
| `src/app/mockups/development/ledger/page.tsx` | Ledger page (Server Component). |
| `src/components/clinical-dashboard/settings-dialog.tsx:1037-1054` | Rename entry to "Developer". Modified. |

---

### Task 1: Snapshot generator and parser

**Files:**
- Create: `scripts/generate-outstanding-issues-snapshot.mjs`
- Create: `tests/outstanding-issues-snapshot.test.ts`
- Create (generated): `data/outstanding-issues-snapshot.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildSnapshot({ ledgerMarkdown, inboxRecords, revision }) => Snapshot`, exported from the script for testing. `Snapshot` shape is § 5 of the spec.

Ledger table formats, copied verbatim from the live file:

```
Queue:  | Order | ID(s) | Acuity | Capability | When | Estimate | Outcome, gate, verification, and stopping condition |
Open:   | ID | Pri | Type | Summary | Detail / next action | Source | Added |
```

Queue `ID(s)` cells wrap IDs in backticks: `` `#231` ``. IDs are `#` + one or more alphanumerics — **both** `#001` and `#CCZ4HB` occur. Inbox records are `docs/outstanding-issues-inbox/*.json` (skip `README.md` and the `applied/` directory) with shape `{ version, id, createdOn, action, payload: { pri, type, summary, detail, source, issueUlid } }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/outstanding-issues-snapshot.test.ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:focused -- --files tests/outstanding-issues-snapshot.test.ts`
Expected: FAIL — cannot resolve `scripts/generate-outstanding-issues-snapshot.mjs`.

- [ ] **Step 3: Write the generator**

```javascript
// scripts/generate-outstanding-issues-snapshot.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LEDGER_PATH = "docs/outstanding-issues.md";
const INBOX_DIR = "docs/outstanding-issues-inbox";
const OUTPUT_PATH = "data/outstanding-issues-snapshot.json";
export const SNAPSHOT_VERSION = "outstanding-issues-snapshot-v1";

const ID_PATTERN = /#[A-Za-z0-9]+/g;

function tableRowsUnder(markdown, heading, expectedColumns) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`Ledger is missing the "${heading}" heading.`);
  const rows = [];
  let seenHeader = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!seenHeader) {
      seenHeader = true;
      continue;
    }
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    if (cells.length !== expectedColumns) {
      throw new Error(`Malformed row under "${heading}" at line ${index + 1}: expected ${expectedColumns} cells, got ${cells.length} — ${line.slice(0, 80)}`);
    }
    rows.push(cells);
  }
  return rows;
}

export function buildSnapshot({ ledgerMarkdown, inboxRecords, revision }) {
  const openRows = tableRowsUnder(ledgerMarkdown, "## Open items", 7).map((cells) => ({
    id: cells[0],
    priority: cells[1],
    type: cells[2],
    summary: cells[3],
    detail: cells[4],
    source: cells[5],
    added: cells[6],
  }));

  const detailById = new Map(openRows.map((row) => [row.id, row.detail]));

  const queue = tableRowsUnder(ledgerMarkdown, "## Recommended execution queue", 7).map((cells) => {
    const ids = cells[1].match(ID_PATTERN) ?? [];
    // Prose comes from the cited row's own Detail cell. `issues-report.mjs`
    // does the same after the queue's independent copy drifted and spent days
    // pointing at an approach its row had already refuted. A composite ID cell
    // has no single row to speak for it, so it keeps the queue's Outcome cell.
    const detail = ids.length === 1 && detailById.has(ids[0]) ? detailById.get(ids[0]) : cells[6];
    return { order: Number(cells[0]), ids, acuity: cells[2], capability: cells[3], timing: cells[4], estimate: cells[5], detail };
  });

  const resolvedCount = tableRowsUnder(ledgerMarkdown, "## Resolved / archive", 5).length;

  const pending = inboxRecords.map((record) => ({
    request_id: record.id,
    action: record.action,
    summary: record.payload?.summary ?? "",
    created_at: record.createdOn ?? null,
  }));

  const countBy = (priority) => openRows.filter((row) => row.priority === priority).length;

  return {
    version: SNAPSHOT_VERSION,
    ledger_revision: revision,
    counts: {
      open: openRows.length,
      p1: countBy("P1"),
      p2: countBy("P2"),
      p3: countBy("P3"),
      queued: queue.length,
      pending: pending.length,
      resolved: resolvedCount,
    },
    queue,
    open: openRows,
    pending,
  };
}

export function readInboxRecords(dir = INBOX_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => JSON.parse(readFileSync(join(dir, entry.name), "utf8")));
}

export function readLedgerRevision(path = LEDGER_PATH) {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%H%x09%cI", "--", path], { encoding: "utf8" }).trim();
    if (!output) return null;
    const [sha, committed_at] = output.split("\t");
    return { sha, committed_at };
  } catch {
    return null;
  }
}

export function generate() {
  return buildSnapshot({
    ledgerMarkdown: readFileSync(LEDGER_PATH, "utf8"),
    inboxRecords: readInboxRecords(),
    revision: readLedgerRevision(),
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(generate(), null, 2)}\n`, "utf8");
  console.log(`[snapshot] wrote ${OUTPUT_PATH}`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:focused -- --files tests/outstanding-issues-snapshot.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Generate the real snapshot and eyeball it**

Run: `node scripts/generate-outstanding-issues-snapshot.mjs`
Then: `node -e "const s=require('./data/outstanding-issues-snapshot.json');console.log(s.counts)"`
Expected: `open` ≈ 67, `p1` = 2, `queued` ≈ 11, `pending` = 3. If `open` is 0 the heading match is wrong — fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-outstanding-issues-snapshot.mjs tests/outstanding-issues-snapshot.test.ts data/outstanding-issues-snapshot.json
git commit -m "feat(developer-hub): generate the outstanding-issues snapshot at build time"
```

---

### Task 2: The staleness gate

**Files:**
- Create: `scripts/check-outstanding-issues-snapshot.mjs`
- Modify: `package.json` (scripts)
- Create: `tests/outstanding-issues-snapshot-gate.test.ts`

**Interfaces:**
- Consumes: `generate()` and `SNAPSHOT_VERSION` from Task 1.
- Produces: `compareSnapshots(committed, regenerated) => string[]` — a list of human-readable differences, empty when in step.

**The trap this task exists to avoid:** a naive byte comparison fails every run if the snapshot carries a "generated at" timestamp. It does not. The snapshot is **purely ledger-derived and therefore deterministic**; the build date is supplied at render time by Task 3, not stored here. If a future field is ever non-deterministic, it must be excluded from the comparison explicitly, never by loosening the gate.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/outstanding-issues-snapshot-gate.test.ts
import { describe, expect, it } from "vitest";
import { compareSnapshots } from "../scripts/check-outstanding-issues-snapshot.mjs";

const BASE = { version: "outstanding-issues-snapshot-v1", counts: { open: 2, p1: 1 }, open: [{ id: "#1" }, { id: "#2" }] };

describe("compareSnapshots", () => {
  it("reports no differences when in step", () => {
    expect(compareSnapshots(BASE, structuredClone(BASE))).toEqual([]);
  });

  it("detects a stale snapshot", () => {
    const stale = structuredClone(BASE);
    stale.counts.open = 1;
    stale.open = [{ id: "#1" }];
    expect(compareSnapshots(stale, BASE).join(" ")).toMatch(/open/);
  });

  it("detects a version change", () => {
    const old = { ...structuredClone(BASE), version: "outstanding-issues-snapshot-v0" };
    expect(compareSnapshots(old, BASE).join(" ")).toMatch(/version/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:focused -- --files tests/outstanding-issues-snapshot-gate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the gate**

```javascript
// scripts/check-outstanding-issues-snapshot.mjs
import { readFileSync } from "node:fs";
import { generate } from "./generate-outstanding-issues-snapshot.mjs";

const OUTPUT_PATH = "data/outstanding-issues-snapshot.json";
const FIX = "node scripts/generate-outstanding-issues-snapshot.mjs";

export function compareSnapshots(committed, regenerated) {
  const differences = [];
  if (committed?.version !== regenerated.version) {
    differences.push(`version: committed ${committed?.version} vs regenerated ${regenerated.version}`);
  }
  for (const key of Object.keys(regenerated.counts)) {
    if (committed?.counts?.[key] !== regenerated.counts[key]) {
      differences.push(`counts.${key}: committed ${committed?.counts?.[key]} vs regenerated ${regenerated.counts[key]}`);
    }
  }
  for (const key of ["queue", "open", "pending", "ledger_revision"]) {
    if (JSON.stringify(committed?.[key]) !== JSON.stringify(regenerated[key])) {
      differences.push(`${key} differs from the ledger`);
    }
  }
  return differences;
}

function main() {
  const regenerated = generate();
  let committed = null;
  try {
    committed = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    console.error(`[snapshot] ${OUTPUT_PATH} is missing or unreadable. Run: ${FIX}`);
    process.exit(1);
  }
  const differences = compareSnapshots(committed, regenerated);
  if (differences.length > 0) {
    console.error("[snapshot] The committed snapshot is behind docs/outstanding-issues.md:");
    for (const difference of differences) console.error(`  - ${difference}`);
    console.error(`[snapshot] Fix with: ${FIX}`);
    process.exit(1);
  }
  console.log(`[snapshot] in step with ${OUTPUT_PATH} (${regenerated.counts.open} open, ${regenerated.counts.pending} pending)`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) main();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:focused -- --files tests/outstanding-issues-snapshot-gate.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the gate actually catches staleness**

```bash
node -e "const f='data/outstanding-issues-snapshot.json';const fs=require('fs');const s=JSON.parse(fs.readFileSync(f));s.counts.open=1;fs.writeFileSync(f,JSON.stringify(s,null,2)+'\n')"
node scripts/check-outstanding-issues-snapshot.mjs; echo "exit=$?"
node scripts/generate-outstanding-issues-snapshot.mjs
node scripts/check-outstanding-issues-snapshot.mjs; echo "exit=$?"
```

Expected: first run prints the `counts.open` difference and `exit=1`; second run prints "in step" and `exit=0`. **A gate that cannot fail is not a gate** — do not proceed until you have seen `exit=1`.

- [ ] **Step 6: Wire it into the build**

In `package.json` add:

```json
"snapshot:issues": "node scripts/generate-outstanding-issues-snapshot.mjs",
"check:outstanding-issues-snapshot": "node scripts/check-outstanding-issues-snapshot.mjs"
```

Append `&& npm run snapshot:issues` to the existing `docs:update` script, and add `npm run check:outstanding-issues-snapshot` to the existing `check:outstanding-issues` chain so it runs in `verify:cheap` and CI.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-outstanding-issues-snapshot.mjs tests/outstanding-issues-snapshot-gate.test.ts package.json data/outstanding-issues-snapshot.json
git commit -m "feat(developer-hub): fail the build when the issues snapshot falls behind the ledger"
```

---

### Task 3: The typed reader

**Files:**
- Create: `src/lib/developer-area/ledger-snapshot.ts`
- Create: `tests/developer-ledger-snapshot.test.ts`

**Interfaces:**
- Consumes: `data/outstanding-issues-snapshot.json` from Task 1.
- Produces:
  - `type LedgerSnapshot`, `type LedgerOpenItem`, `type LedgerQueueEntry`, `type LedgerPendingRequest`
  - `loadLedgerSnapshot(): LedgerSnapshot`
  - `type Freshness = { contentAt: string | null; builtAt: string; gapHours: number | null }`
  - `resolveFreshness(snapshot: LedgerSnapshot, now: Date): Freshness`
  - `openItemsByPriority(snapshot): Record<"P1" | "P2" | "P3", LedgerOpenItem[]>`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/developer-ledger-snapshot.test.ts
import { describe, expect, it } from "vitest";
import { loadLedgerSnapshot, openItemsByPriority, resolveFreshness } from "@/lib/developer-area/ledger-snapshot";

describe("ledger snapshot", () => {
  it("loads the generated snapshot and validates its version", () => {
    const snapshot = loadLedgerSnapshot();
    expect(snapshot.version).toBe("outstanding-issues-snapshot-v1");
    expect(snapshot.counts.open).toBeGreaterThan(0);
  });

  it("groups open items by priority without inventing acuity", () => {
    const grouped = openItemsByPriority(loadLedgerSnapshot());
    expect(grouped.P1.every((item) => item.priority === "P1")).toBe(true);
    expect(grouped.P1).not.toHaveProperty("acuity");
  });

  it("reports a gap between ledger content and build", () => {
    const snapshot = { ...loadLedgerSnapshot(), ledger_revision: { sha: "a".repeat(40), committed_at: "2026-08-20T00:00:00Z" } };
    const freshness = resolveFreshness(snapshot, new Date("2026-08-21T00:00:00Z"));
    expect(freshness.gapHours).toBe(24);
  });

  it("says the revision is unknown rather than fabricating a date", () => {
    const snapshot = { ...loadLedgerSnapshot(), ledger_revision: null };
    const freshness = resolveFreshness(snapshot, new Date("2026-08-21T00:00:00Z"));
    expect(freshness.contentAt).toBeNull();
    expect(freshness.gapHours).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:focused -- --files tests/developer-ledger-snapshot.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the reader**

```typescript
// src/lib/developer-area/ledger-snapshot.ts
import snapshotJson from "../../../data/outstanding-issues-snapshot.json";

export const LEDGER_SNAPSHOT_VERSION = "outstanding-issues-snapshot-v1";

export type LedgerPriority = "P1" | "P2" | "P3";

export type LedgerOpenItem = {
  id: string;
  priority: string;
  type: string;
  summary: string;
  detail: string;
  source: string;
  added: string;
};

export type LedgerQueueEntry = {
  order: number;
  ids: string[];
  /** Urgency. Deliberately NOT derived from, or merged with, `LedgerOpenItem.priority`. */
  acuity: string;
  capability: string;
  timing: string;
  estimate: string;
  detail: string;
};

export type LedgerPendingRequest = {
  request_id: string;
  action: string;
  summary: string;
  created_at: string | null;
};

export type LedgerSnapshot = {
  version: string;
  ledger_revision: { sha: string; committed_at: string } | null;
  counts: { open: number; p1: number; p2: number; p3: number; queued: number; pending: number; resolved: number };
  queue: LedgerQueueEntry[];
  open: LedgerOpenItem[];
  pending: LedgerPendingRequest[];
};

export function loadLedgerSnapshot(): LedgerSnapshot {
  const snapshot = snapshotJson as LedgerSnapshot;
  if (snapshot.version !== LEDGER_SNAPSHOT_VERSION) {
    // Loud, not a render fallback: an unrecognised shape means the page would
    // silently under-report outstanding work, which is the `#338` failure.
    throw new Error(`Unrecognised ledger snapshot version ${snapshot.version}; expected ${LEDGER_SNAPSHOT_VERSION}. Run: npm run snapshot:issues`);
  }
  return snapshot;
}

export type Freshness = { contentAt: string | null; builtAt: string; gapHours: number | null };

export function resolveFreshness(snapshot: LedgerSnapshot, now: Date): Freshness {
  const contentAt = snapshot.ledger_revision?.committed_at ?? null;
  const builtAt = now.toISOString();
  const gapHours = contentAt
    ? Math.round((now.getTime() - new Date(contentAt).getTime()) / 3_600_000)
    : null;
  return { contentAt, builtAt, gapHours };
}

export function openItemsByPriority(snapshot: LedgerSnapshot): Record<LedgerPriority, LedgerOpenItem[]> {
  const grouped: Record<LedgerPriority, LedgerOpenItem[]> = { P1: [], P2: [], P3: [] };
  for (const item of snapshot.open) {
    if (item.priority === "P1" || item.priority === "P2" || item.priority === "P3") grouped[item.priority].push(item);
  }
  return grouped;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:focused -- --files tests/developer-ledger-snapshot.test.ts`
Expected: PASS, 4 tests. If TypeScript rejects the JSON import, confirm `resolveJsonModule` is on in `tsconfig.json` — the nine existing `data/*.json` imports prove it is.

- [ ] **Step 5: Commit**

```bash
git add src/lib/developer-area/ledger-snapshot.ts tests/developer-ledger-snapshot.test.ts
git commit -m "feat(developer-hub): typed reader and freshness for the ledger snapshot"
```

---

### Task 4: The panel registry

**Files:**
- Create: `src/lib/developer-area/hub-panels.ts`
- Create: `tests/developer-hub-panels.test.ts`

**Interfaces:**
- Produces: `type HubPanelGroup = "work" | "clinical" | "system" | "reference"`, `type HubPanel`, `HUB_PANELS: readonly HubPanel[]`, `panelsInGroup(group): HubPanel[]`.

A panel is `{ id, name, summary, group, phase, href? }`. `phase: 1` means built now and must carry an `href`; `phase: 2 | 3 | 4` means placeholder and must not. That invariant is what a later phase flips with a one-line change.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/developer-hub-panels.test.ts
import { describe, expect, it } from "vitest";
import { HUB_PANELS, panelsInGroup } from "@/lib/developer-area/hub-panels";

describe("hub panels", () => {
  it("gives every built panel a destination and every planned panel none", () => {
    for (const panel of HUB_PANELS) {
      if (panel.phase === 1) expect(panel.href, `${panel.id} is built but has no href`).toBeTruthy();
      else expect(panel.href, `${panel.id} is planned but has an href`).toBeUndefined();
    }
  });

  it("has unique ids", () => {
    expect(new Set(HUB_PANELS.map((panel) => panel.id)).size).toBe(HUB_PANELS.length);
  });

  it("places every panel in exactly one group", () => {
    const total = (["work", "clinical", "system", "reference"] as const).reduce((sum, group) => sum + panelsInGroup(group).length, 0);
    expect(total).toBe(HUB_PANELS.length);
  });

  it("ships the ledger as a phase 1 panel", () => {
    const ledger = HUB_PANELS.find((panel) => panel.id === "task-ledger");
    expect(ledger?.phase).toBe(1);
    expect(ledger?.href).toBe("/mockups/development/ledger");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:focused -- --files tests/developer-hub-panels.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the registry**

```typescript
// src/lib/developer-area/hub-panels.ts
export type HubPanelGroup = "work" | "clinical" | "system" | "reference";

export type HubPanel = {
  id: string;
  name: string;
  summary: string;
  group: HubPanelGroup;
  /** 1 = built now. 2–4 = declared placeholder; flipping the phase and adding an href is the whole change. */
  phase: 1 | 2 | 3 | 4;
  href?: string;
};

export const HUB_PANELS: readonly HubPanel[] = [
  { id: "task-ledger", name: "Task ledger", summary: "Outstanding work, in recommended order", group: "work", phase: 1, href: "/mockups/development/ledger" },
  { id: "work-in-flight", name: "Work in flight", summary: "Open changes, their checks, and whether reviewed", group: "work", phase: 2 },
  { id: "decision-log", name: "Decision log", summary: "Why things are the way they are", group: "work", phase: 4 },

  { id: "source-review", name: "Source review queue", summary: "Documents shaping answers most, with no qualified human sign-off", group: "clinical", phase: 3 },
  { id: "source-currency", name: "Source currency", summary: "Age, publisher, jurisdiction, superseded guidance", group: "clinical", phase: 3 },
  { id: "governance-debt", name: "Governance debt", summary: "Missing metadata and unattributed reviews", group: "clinical", phase: 3 },
  { id: "answer-quality", name: "Answer quality", summary: "Retrieval scores and document quality signals", group: "clinical", phase: 3 },
  { id: "hazard-register", name: "Hazard register", summary: "Known clinical risks and their mitigations", group: "clinical", phase: 4 },

  { id: "environment", name: "Environment", summary: "Which database, which build, live or demo", group: "system", phase: 1, href: "#developer-hub-environment" },
  { id: "database-drift", name: "Database drift", summary: "Schema and function differences against the repo", group: "system", phase: 3 },
  { id: "ingestion", name: "Ingestion", summary: "Stuck, failed, and queued document jobs", group: "system", phase: 3 },
  { id: "errors", name: "Errors and alerts", summary: "What is failing for real users", group: "system", phase: 4 },
  { id: "test-health", name: "Test health", summary: "Unstable and quarantined tests", group: "system", phase: 2 },
  { id: "budgets", name: "Speed and weight", summary: "Page weight and performance budgets", group: "system", phase: 4 },

  { id: "documentation", name: "Documentation", summary: "Every document, its age, and its broken links", group: "reference", phase: 2 },
  { id: "routes", name: "Routes and modes", summary: "Every page and all 15 modes", group: "reference", phase: 2 },
  { id: "prototypes", name: "Prototypes", summary: "Caring contact and Ward flow", group: "reference", phase: 1, href: "#developer-hub-reference" },
  { id: "commands", name: "Commands", summary: "What each repository command does", group: "reference", phase: 4 },
];

export function panelsInGroup(group: HubPanelGroup): HubPanel[] {
  return HUB_PANELS.filter((panel) => panel.group === group);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:focused -- --files tests/developer-hub-panels.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/developer-area/hub-panels.ts tests/developer-hub-panels.test.ts
git commit -m "feat(developer-hub): panel registry covering all four phases"
```

---

### Task 5: The nav-header sibling

**Files:**
- Create: `src/components/developer-area/developer-hub-nav-header.tsx`

**Interfaces:**
- Consumes: `InPageNavHeader`, `PageSection`, `useInPageSectionNav`.
- Produces: `developerHubNavSections: readonly PageSection[]` and `DeveloperHubNavHeader({ actions? })`.

Copy the shape of `src/components/formulation/formulation-nav-header.tsx` exactly. Per `docs/search-chrome-behaviour.md`, the section table lives **here**, not in the page and not in a separate module — PR #1766 shipped two shapes at once and the closed PR #1767 proposed a third, which is why the rule is pinned.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { FlaskConical, ListChecks, Server, Stethoscope, BookOpen } from "lucide-react";
import type { ReactNode } from "react";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";

/**
 * All four groups are declared in Phase 1, including panels that do not exist
 * yet. `useResolvedPageSections` drops any section whose anchor is not
 * rendered, so phases 2–4 need no navigation change — and an unbuilt group
 * produces no dead jump.
 */
export const developerHubNavSections: readonly PageSection[] = [
  { id: "developer-hub-environment", label: "Environment", icon: Server },
  { id: "developer-hub-work", label: "Work and decisions", icon: ListChecks },
  { id: "developer-hub-clinical", label: "Clinical trust", icon: Stethoscope },
  { id: "developer-hub-system", label: "System truth", icon: FlaskConical },
  { id: "developer-hub-reference", label: "Reference", icon: BookOpen },
];

/** The client half of the hub page, which is a Server Component. */
export function DeveloperHubNavHeader({ actions }: { actions?: ReactNode }) {
  const { sections, activeId, selectSection } = useInPageSectionNav(developerHubNavSections);

  return (
    <InPageNavHeader
      back={{ href: "/", label: "Home" }}
      title="Developer"
      sections={sections}
      activeId={activeId}
      onSelectSection={selectSection}
      actions={actions}
      actionsNoun="developer hub"
      actionsDescription="Choose how to use this hub."
      testIdPrefix="developer-hub"
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck:source`
Expected: no errors. If `useInPageSectionNav`'s return shape differs, read `src/components/in-page-nav/use-in-page-section-nav.ts` and match it — do not cast.

- [ ] **Step 3: Commit**

```bash
git add src/components/developer-area/developer-hub-nav-header.tsx
git commit -m "feat(developer-hub): nav-header sibling owning the hub section table"
```

---

### Task 6: Hub presentation components

**Files:**
- Create: `src/components/developer-area/hub/freshness-stamp.tsx`
- Create: `src/components/developer-area/hub/environment-strip.tsx`
- Create: `src/components/developer-area/hub/panel-card.tsx`
- Create: `tests/developer-hub-components.dom.test.tsx`

**Interfaces:**
- Consumes: `Freshness` (Task 3), `HubPanel` (Task 4), `ignoreUnavailableActivation` from `@/components/ui-primitives`.
- Produces: `FreshnessStamp({ freshness })`, `EnvironmentStrip({ demoMode, documentCount, buildSha, email })`, `PanelCard({ panel })`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/developer-hub-components.dom.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FreshnessStamp } from "@/components/developer-area/hub/freshness-stamp";
import { PanelCard } from "@/components/developer-area/hub/panel-card";

afterEach(cleanup);

describe("FreshnessStamp", () => {
  it("always renders, and says so when the revision is unknown", () => {
    render(<FreshnessStamp freshness={{ contentAt: null, builtAt: "2026-08-21T00:00:00Z", gapHours: null }} />);
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/revision unknown/i);
  });

  it("reports the gap between ledger content and build", () => {
    render(<FreshnessStamp freshness={{ contentAt: "2026-08-20T00:00:00Z", builtAt: "2026-08-21T00:00:00Z", gapHours: 24 }} />);
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/24 hours/i);
  });
});

describe("PanelCard", () => {
  it("links a built panel", () => {
    render(<PanelCard panel={{ id: "task-ledger", name: "Task ledger", summary: "s", group: "work", phase: 1, href: "/mockups/development/ledger" }} />);
    expect(screen.getByRole("link", { name: /task ledger/i })).toHaveAttribute("href", "/mockups/development/ledger");
  });

  it("marks a planned panel unavailable with a reachable reason, never native disabled", () => {
    render(<PanelCard panel={{ id: "work-in-flight", name: "Work in flight", summary: "s", group: "work", phase: 2 }} />);
    const button = screen.getByRole("button", { name: /work in flight/i });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).toHaveAttribute("title", expect.stringContaining("coming soon"));
    expect(button.getAttribute("aria-describedby")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:focused -- --files tests/developer-hub-components.dom.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `freshness-stamp.tsx`**

```tsx
import { Clock } from "lucide-react";

import type { Freshness } from "@/lib/developer-area/ledger-snapshot";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Unconditional by design. There is no "fresh" short-circuit that could
 * suppress it — a page that can hide its own age is the `#338` defect.
 */
export function FreshnessStamp({ freshness }: { freshness: Freshness }) {
  return (
    <p
      data-testid="developer-hub-freshness"
      className="flex flex-wrap items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs text-[color:var(--text-muted)]"
    >
      <Clock aria-hidden="true" className="size-icon-sm" />
      {freshness.contentAt ? (
        <span>
          Ledger content as of {formatDate(freshness.contentAt)} · site built {formatDate(freshness.builtAt)} ·{" "}
          {freshness.gapHours} hours apart
        </span>
      ) : (
        <span>Ledger revision unknown · site built {formatDate(freshness.builtAt)}</span>
      )}
    </p>
  );
}
```

- [ ] **Step 4: Write `panel-card.tsx`**

```tsx
import Link from "next/link";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import type { HubPanel } from "@/lib/developer-area/hub-panels";

const CARD_CLASS =
  "grid min-h-12 gap-1 rounded-xl border border-[color:var(--border)] p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export function PanelCard({ panel }: { panel: HubPanel }) {
  if (panel.phase === 1 && panel.href) {
    return (
      <Link href={panel.href} className={CARD_CLASS} data-testid={`developer-hub-panel-${panel.id}`}>
        <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{panel.name}</span>
        <span className="text-xs leading-5 text-[color:var(--text-muted)]">{panel.summary}</span>
      </Link>
    );
  }

  // Unavailable for a *stated* reason, so `aria-disabled` + an inert handler,
  // never native `disabled` — which would remove the tab stop and make the
  // reason unreachable. See docs/wiring-conventions.md.
  const noteId = `developer-hub-panel-${panel.id}-note`;
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={noteId}
      onClick={ignoreUnavailableActivation}
      title={`${panel.name} — coming soon`}
      className={`${CARD_CLASS} opacity-70`}
      data-testid={`developer-hub-panel-${panel.id}`}
    >
      <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{panel.name}</span>
      <span className="text-xs leading-5 text-[color:var(--text-muted)]">{panel.summary}</span>
      <span className="text-xs font-bold text-[color:var(--text-muted)]">Phase {panel.phase}</span>
      <span id={noteId} className="sr-only">
        {panel.name} is not built yet. It arrives in phase {panel.phase}.
      </span>
    </button>
  );
}
```

- [ ] **Step 5: Write `environment-strip.tsx`**

```tsx
export function EnvironmentStrip({
  demoMode,
  documentCount,
  buildSha,
  email,
}: {
  demoMode: boolean;
  documentCount: number | null;
  buildSha: string | null;
  email: string | null;
}) {
  const facts = [
    demoMode ? "Demo corpus" : "Live data",
    documentCount === null ? "document count unavailable" : `${documentCount.toLocaleString("en-AU")} documents`,
    buildSha ? `build ${buildSha.slice(0, 7)}` : "build unknown",
    email ?? "signed in",
  ];

  return (
    <p
      data-testid="developer-hub-environment-strip"
      className="rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-6 text-[color:var(--text-muted)]"
    >
      {facts.join(" · ")}
    </p>
  );
}
```

- [ ] **Step 6: Run to verify the tests pass**

Run: `npm run test:focused -- --files tests/developer-hub-components.dom.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/developer-area/hub tests/developer-hub-components.dom.test.tsx
git commit -m "feat(developer-hub): freshness stamp, environment strip, and panel card"
```

---

### Task 7: The hub page

**Files:**
- Modify: `src/app/mockups/development/page.tsx` (full rewrite)
- Modify: `tests/in-page-nav-route-sections.dom.test.tsx`

**Interfaces:**
- Consumes: `DeveloperHubNavHeader` + `developerHubNavSections` (Task 5), `panelsInGroup` (Task 4), `loadLedgerSnapshot` (Task 3), the Task 6 components.
- Produces: the route. Section headings carry ids matching `developerHubNavSections`.

Existing content that must survive: the synthetic-data warning, and the Caring Contact and Ward Flow entries (now cards in the reference group).

- [ ] **Step 1: Write the hub page**

Each group renders as `<section id="developer-hub-<group>" className={inPageAnchor}>` with an `<h2>`, then a grid of `<PanelCard>`. The `needs you now` band renders **only** `snapshot.counts.p1` — no hand-written text about unbuilt panels, per spec § 8.1. Keep the page a Server Component: import `DeveloperHubNavHeader` and render it; it carries its own `"use client"`.

```tsx
import type { Metadata } from "next";

import { DeveloperHubNavHeader } from "@/components/developer-area/developer-hub-nav-header";
import { EnvironmentStrip } from "@/components/developer-area/hub/environment-strip";
import { PanelCard } from "@/components/developer-area/hub/panel-card";
import { inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { panelsInGroup, type HubPanelGroup } from "@/lib/developer-area/hub-panels";
import { loadLedgerSnapshot } from "@/lib/developer-area/ledger-snapshot";

export const metadata: Metadata = {
  title: "Developer · Clinical KB",
  description: "In-progress surfaces and repository state, reachable only to a signed-in administrator account.",
};

const GROUPS: { id: HubPanelGroup; anchor: string; label: string }[] = [
  { id: "work", anchor: "developer-hub-work", label: "Work and decisions" },
  { id: "clinical", anchor: "developer-hub-clinical", label: "Clinical trust" },
  { id: "system", anchor: "developer-hub-system", label: "System truth" },
  { id: "reference", anchor: "developer-hub-reference", label: "Reference" },
];

export default function DeveloperHubPage() {
  const snapshot = loadLedgerSnapshot();

  return (
    <>
      <DeveloperHubNavHeader />
      <main className="mx-auto grid w-full max-w-[64rem] gap-6 px-4 py-8 sm:px-6" data-testid="development-index">
        <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">Developer hub</h1>

        <section id="developer-hub-environment" className={inPageAnchor}>
          <h2 className="sr-only">Environment</h2>
          <EnvironmentStrip demoMode={false} documentCount={null} buildSha={null} email={null} />
        </section>

        {snapshot.counts.p1 > 0 ? (
          <p
            data-testid="developer-hub-needs-you-now"
            className="rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
          >
            {snapshot.counts.p1} blocking {snapshot.counts.p1 === 1 ? "item" : "items"} in the task ledger.
          </p>
        ) : null}

        {GROUPS.map((group) => (
          <section key={group.id} id={group.anchor} className={inPageAnchor}>
            <h2 className="mb-3 text-lg font-extrabold text-[color:var(--text-heading)]">{group.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {panelsInGroup(group.id).map((panel) => (
                <PanelCard key={panel.id} panel={panel} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Register the route in the anchor test**

In `tests/in-page-nav-route-sections.dom.test.tsx`, import `developerHubNavSections` and `DeveloperHubPage`, then add a `RouteCase`:

```typescript
{
  name: "/mockups/development",
  sections: developerHubNavSections,
  render: () => <DeveloperHubPage />,
},
```

- [ ] **Step 3: Run the anchor test**

Run: `npm run test:focused -- --files tests/in-page-nav-route-sections.dom.test.tsx`
Expected: PASS. If a section is reported missing, the anchor id and the `PageSection.id` disagree — fix the page, and **do not** add it to `absent` to silence it. `absent` is for sections no fixture can render, not for ones you broke.

- [ ] **Step 4: Commit**

```bash
git add src/app/mockups/development/page.tsx tests/in-page-nav-route-sections.dom.test.tsx
git commit -m "feat(developer-hub): grouped hub page with in-page section navigation"
```

---

### Task 8: The ledger page

**Files:**
- Create: `src/app/mockups/development/ledger/page.tsx`
- Create: `src/components/developer-area/hub/ledger-item.tsx`
- Create: `tests/developer-ledger-page.dom.test.tsx`

**Interfaces:**
- Consumes: `loadLedgerSnapshot`, `resolveFreshness`, `openItemsByPriority` (Task 3), `FreshnessStamp` (Task 6).
- Produces: the route.

Order on the page: back link, title, freshness stamp, four counts, P1 blockers, recommended running order, open items by priority, pending requests.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/developer-ledger-page.dom.test.tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DeveloperLedgerPage from "@/app/mockups/development/ledger/page";
import { loadLedgerSnapshot } from "@/lib/developer-area/ledger-snapshot";

afterEach(cleanup);

describe("developer ledger page", () => {
  it("renders priority and acuity as visibly distinct labels", () => {
    render(<DeveloperLedgerPage />);
    const queue = screen.getByTestId("developer-ledger-queue");
    // Acuity lives only in the queue; priority only in the open list. A shared
    // badge would report the P1 rows and the A1 queue entry as one urgent set.
    expect(within(queue).queryByText(/^P1$/)).toBeNull();
    expect(within(screen.getByTestId("developer-ledger-open")).queryByText(/^A1$/)).toBeNull();
  });

  it("shows counts that match the snapshot", () => {
    const snapshot = loadLedgerSnapshot();
    render(<DeveloperLedgerPage />);
    expect(screen.getByTestId("developer-ledger-count-open")).toHaveTextContent(String(snapshot.counts.open));
    expect(screen.getByTestId("developer-ledger-count-pending")).toHaveTextContent(String(snapshot.counts.pending));
  });

  it("always shows the freshness stamp", () => {
    render(<DeveloperLedgerPage />);
    expect(screen.getByTestId("developer-hub-freshness")).toBeInTheDocument();
  });

  it("keeps full detail in the DOM behind a native disclosure, not a click handler", () => {
    render(<DeveloperLedgerPage />);
    const item = screen.getAllByTestId(/^developer-ledger-item-/)[0];
    expect(item.querySelector("details")).not.toBeNull();
    expect(item.querySelector("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:focused -- --files tests/developer-ledger-page.dom.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ledger-item.tsx`**

```tsx
import type { LedgerOpenItem } from "@/lib/developer-area/ledger-snapshot";

const PRIORITY_CLASS: Record<string, string> = {
  P1: "bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  P2: "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  P3: "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

/**
 * Progressive detail. Native `<details>` keeps this a Server Component with no
 * client JavaScript, gives correct keyboard and screen-reader behaviour for
 * free, and is not a `<button>` — so `require-button-wiring` does not apply.
 */
export function LedgerItem({ item }: { item: LedgerOpenItem }) {
  return (
    <li
      data-testid={`developer-ledger-item-${item.id.replace("#", "")}`}
      className="grid gap-2 rounded-xl border border-[color:var(--border)] p-4"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-xs text-[color:var(--text-muted)]">{item.id}</span>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${PRIORITY_CLASS[item.priority] ?? ""}`}>{item.priority}</span>
        <span className="rounded-lg border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--text-muted)]">{item.type}</span>
      </div>
      <p className="text-sm leading-6 text-[color:var(--text-heading)]">{item.summary}</p>
      <details>
        <summary className="cursor-pointer text-xs font-bold text-[color:var(--text-muted)]">Detail and source</summary>
        <p className="mt-2 text-xs leading-6 text-[color:var(--text-muted)]">{item.detail}</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          Source: {item.source} · added {item.added}
        </p>
      </details>
    </li>
  );
}
```

- [ ] **Step 4: Write the ledger page**

Render, in order: a `<Link href="/mockups/development">` back control; `<h1>Task ledger</h1>`; `<FreshnessStamp>`; a counts grid with `data-testid="developer-ledger-count-open"`, `-p1`, `-queued`, `-pending`; the P1 group; `<ol data-testid="developer-ledger-queue">` with acuity badges and the caption `urgency, not priority`; `<ul data-testid="developer-ledger-open">` of `<LedgerItem>` grouped P1 → P2 → P3; then pending requests. Call `resolveFreshness(snapshot, new Date())`.

- [ ] **Step 5: Run to verify the tests pass**

Run: `npm run test:focused -- --files tests/developer-ledger-page.dom.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/mockups/development/ledger src/components/developer-area/hub/ledger-item.tsx tests/developer-ledger-page.dom.test.tsx
git commit -m "feat(developer-hub): task ledger page with progressive item detail"
```

---

### Task 9: Rename the Settings entry to "Developer"

**Files:**
- Modify: `src/components/clinical-dashboard/settings-dialog.tsx:80` and `:1037-1054`
- Modify: `tests/settings-dialog-actions.dom.test.tsx`

- [ ] **Step 1: Update the test first**

In `tests/settings-dialog-actions.dom.test.tsx`, change the expected link text from `Open Development page` to `Developer`. Leave `data-testid="settings-row-development-page"` unchanged — renaming a test id is a separate concern and would churn unrelated selectors.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:focused -- --files tests/settings-dialog-actions.dom.test.tsx`
Expected: FAIL — the link still reads "Open Development page".

- [ ] **Step 3: Rename in the dialog**

At line 80 change `navLabel: "Development"` to `navLabel: "Developer"`. At lines 1038–1054 change `title="Development"` to `title="Developer"`, the heading `Development page` to `Developer hub`, and the link text `Open Development page` to `Developer`. Leave `href="/mockups/development"` unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:focused -- --files tests/settings-dialog-actions.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/clinical-dashboard/settings-dialog.tsx tests/settings-dialog-actions.dom.test.tsx
git commit -m "feat(settings): rename the Development entry to Developer"
```

---

### Task 10: Documentation and verification

**Files:**
- Modify: `docs/codebase-index.md`
- Modify: `docs/site-map.md` (generated)

- [ ] **Step 1: Document the new route and modules**

Add `docs/codebase-index.md` entries for `src/app/mockups/development/ledger`, `src/lib/developer-area/ledger-snapshot.ts`, `src/lib/developer-area/hub-panels.ts`, and the two scripts.

- [ ] **Step 2: Regenerate the generated docs**

Run: `npm run docs:update`
Expected: `docs/site-map.md` gains `/mockups/development/ledger`, and the snapshot regenerates.

- [ ] **Step 3: Format, and commit the result**

Run: `npm run format`
Formatting is in neither `test`, `typecheck`, nor `lint`, so the ordinary loop reports green while changed-file CI fails. **Committing after formatting is required — a push sends commits, not your working tree.**

- [ ] **Step 4: Run the handoff gate**

Run: `npm run verify:pr-local`
Expected: PASS. Paste the decisive line — exit code 0 alone is not proof.

- [ ] **Step 5: Run the phone-chrome gate**

Run: `npm run ensure` then `npm run verify:phone-chrome`
Required despite the desktop-first design: `InPageNavHeader` is shared chrome, so a defect here degrades phone behaviour on pages that *are* used on a phone. Grep the output for the "N passed" line — under lock contention this gate exits 1 on timeout rather than soft-skipping green.

- [ ] **Step 6: Commit**

```bash
git add docs/codebase-index.md docs/site-map.md data/outstanding-issues-snapshot.json
git commit -m "docs(developer-hub): index the hub routes and modules"
```

---

## Self-Review

**Spec coverage.** § 2 scope → Tasks 1–9. § 3 domain model → Task 1 tests (both ID schemes, priority/acuity separation) and Task 8 test (distinct rendering). § 4 architecture → Tasks 1, 3, 5, 7. § 5 data contract → Task 1. § 6 freshness, all three mechanisms → Task 2 steps 5–6 (generation wired in, gate proven to fail) and Task 6 (unconditional stamp). § 7 failure behaviour → Task 1 (malformed row, null revision) and Task 3 (version check). § 8 page design → Tasks 6–8; the "computed signals only" rule is Task 7 step 1. § 9 verification → every task's test steps plus Task 10. § 10 extension points → Task 4 registry and Task 5 declared sections.

**Placeholder scan.** No TBD/TODO. Every code step carries real code. Task 8 step 4 describes composition rather than pasting the full page: every element it names has its testid pinned by the step-1 test, so it is specified by its test rather than left vague.

**Type consistency.** `LedgerSnapshot`, `LedgerOpenItem`, `LedgerQueueEntry`, `Freshness`, `HubPanel`, `HubPanelGroup` are defined in Tasks 3–4 and used unchanged afterwards. `developerHubNavSections` ids match the `GROUPS` anchors in Task 7 and the `href` anchors in Task 4's registry (`#developer-hub-environment`, `#developer-hub-reference`).

**Known gap, deliberate.** Task 6's `EnvironmentStrip` is called with `demoMode={false}` and nulls in Task 7 — the component and its contract exist, the real values are not wired. Wiring `isDemoMode()` and the build SHA is small but touches environment plumbing, so it is left to Phase 2 rather than smuggled into Phase 1. The strip renders honestly ("build unknown") rather than inventing values.
