import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards the 2026-07-17 status-refresh edits to three operator/audit-tracking
// docs. These docs are read by operators and future agents as the source of
// truth for what is done vs. still open, so a wrong status or a dangling file
// reference is a real regression, not just prose drift.

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, "docs");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

function readDoc(name: string) {
  return readFileSync(path.join(docsDir, name), "utf8");
}

function migrationExists(timestampPrefix: string) {
  return readdirSync(migrationsDir).some((file) => file.startsWith(timestampPrefix));
}

/** Returns the single line of `doc` that contains `needle`, or undefined. */
function lineContaining(doc: string, needle: string) {
  return doc.split("\n").find((line) => line.includes(needle));
}

describe("docs/audit-remediation-plan-2026-07-14.md — 2026-07-17 reconciliation", () => {
  const doc = readDoc("audit-remediation-plan-2026-07-14.md");

  it("adds the reconciliation section for the memory-tasks review pass", () => {
    expect(doc).toContain("Reconciliation");
    expect(doc).toContain("2026-07-17");
    expect(doc).toContain("claude/memory-tasks-review-glmntq");
  });

  it("records F5 (.env.example weak-OR default) as done in code, matching src/lib/env.ts", () => {
    expect(doc).toMatch(/F5[\s\S]{0,80}weak-OR[\s\S]{0,80}default corrected to `false`/);
    expect(doc).toContain("src/lib/env.ts");
  });

  it("references the in-flight draft PRs by number", () => {
    expect(doc).toContain("#708");
    expect(doc).toContain("#710");
  });

  it("links to a findings-handover doc that actually exists on disk", () => {
    expect(doc).toContain("audit-handover-2026-07-14.md");
    expect(existsSync(path.join(docsDir, "audit-handover-2026-07-14.md"))).toBe(true);
  });

  it("still lists the OWNER:CODE cluster (D2, D3, E3, F1, F3, F6, H1-H5) as open", () => {
    expect(doc).toContain("OWNER:CODE:");
    expect(doc).toContain("D2 (tenancy CI guard");
    expect(doc).toContain("E3 (wire `decideReindexGate`");
    expect(doc).toContain("API-contract hygiene");
  });

  it("marks wave F2 as superseded rather than done or open", () => {
    expect(doc).toContain("Superseded:");
    expect(doc).toContain("F2 (CI RAG-eval scope)");
  });
});

describe("docs/ingestion-concurrency-fix-workorder.md — deep-memory scoping closed", () => {
  const doc = readDoc("ingestion-concurrency-fix-workorder.md");

  it("adds a 2026-07-17 status refresh declaring no open repository items", () => {
    expect(doc).toContain("Status refresh 2026-07-17");
    expect(doc).toContain("no open repository items");
  });

  it("replaces the 'Still open' entry with a resolved marker instead of the design-required line", () => {
    const idx = doc.indexOf("## Still open (not merged or needs design)");
    expect(idx).toBeGreaterThan(-1);
    const section = doc.slice(idx, idx + 400);
    expect(section).toContain("_None._");
    expect(section).not.toContain("design required");
  });

  it("strikes through the remaining-repo-work deep-memory scoping item as done", () => {
    expect(doc).toContain("~~**deep-memory scoping**~~");
    expect(doc).toContain("DONE (2026-07-17)");
  });

  it("references a producer-scoped migration that exists in supabase/migrations", () => {
    const migrationName = "20260713030000_producer_scoped_deep_memory.sql";
    expect(doc).toContain(migrationName);
    expect(existsSync(path.join(migrationsDir, migrationName))).toBe(true);
  });

  it("references the commit that reconciled the commit body", () => {
    expect(doc).toContain("#569");
  });

  it("retains the original 2026-07-15 status refresh and historical author-date content as provenance", () => {
    expect(doc).toContain("Status refresh 2026-07-15");
    expect(doc).toContain("Author date: 2026-07-08");
  });
});

describe("docs/operator-backlog.md — launch-gating table refresh", () => {
  const doc = readDoc("operator-backlog.md");

  it("flips the drift-codify migration row to done", () => {
    const row = lineContaining(doc, "Apply drift-codify forward migration (step 1h)");
    expect(row).toBeDefined();
    expect(row).toContain("✅ done");
    expect(row).not.toContain("⏳ pending");
  });

  it("adds a repo-ahead migrations verify row referencing the three pending migrations", () => {
    const row = lineContaining(doc, "Apply repo-ahead migrations to live (post-2026-07-13)");
    expect(row).toBeDefined();
    expect(row).toContain("🔎 verify");
    for (const ts of ["20260713201542", "20260714110000", "20260717120000"]) {
      expect(row).toContain(ts);
    }
  });

  it("links the new verify row to a runbook doc that exists on disk", () => {
    const row = lineContaining(doc, "Apply repo-ahead migrations to live (post-2026-07-13)");
    expect(row).toContain("[deploy-corrector-public-titles.md](deploy-corrector-public-titles.md)");
    expect(existsSync(path.join(docsDir, "deploy-corrector-public-titles.md"))).toBe(true);
  });

  it("links the drift-codify row to its forward-codify work-order doc that exists on disk", () => {
    const row = lineContaining(doc, "Apply drift-codify forward migration (step 1h)");
    expect(row).toContain("[forward-codify-retrieval-rpcs-workorder.md](forward-codify-retrieval-rpcs-workorder.md)");
    expect(existsSync(path.join(docsDir, "forward-codify-retrieval-rpcs-workorder.md"))).toBe(true);
  });

  it("every migration timestamp referenced in the verify row corresponds to a real migration file", () => {
    for (const ts of ["20260713201542", "20260714110000", "20260717120000"]) {
      expect(migrationExists(ts)).toBe(true);
    }
  });

  it("keeps the launch-gating table well-formed (every row has the same column count as the header)", () => {
    const lines = doc.split("\n");
    const headerIndex = lines.findIndex((line) => line.startsWith("| Action"));
    expect(headerIndex).toBeGreaterThan(-1);
    const headerCols = lines[headerIndex].split("|").length;

    let i = headerIndex + 2; // skip the header and the `---` separator row
    let rowCount = 0;
    while (lines[i]?.startsWith("|")) {
      expect(lines[i].split("|").length).toBe(headerCols);
      i += 1;
      rowCount += 1;
    }
    expect(rowCount).toBeGreaterThanOrEqual(6);
  });
});