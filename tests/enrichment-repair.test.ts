import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";
import {
  assessEnrichmentHealth,
  formatStrictGateRepairRows,
  selectStrictGateRepairCandidates,
  strictGateRepairSummary,
  type StrictGateRepairRow,
  type StrictGateStatusRow,
} from "../src/lib/enrichment-repair";

// #W98GR7. Two of the issue's four claims held and two did not, so these tests pin the two
// that did — the repair function reached nothing, and nothing counted a stuck document.
//
// The refuted claim, recorded here so a later reader does not re-open it: the issue said
// supabase/functions/indexing-v3-agent deletes an artifact family BEFORE calling OpenAI, so
// a provider outage leaves it permanently empty. On main it does the opposite. In all four
// writers — upsertMemoryCardsFromSections, upsertSectionIndexUnits, upsertVisualArtifacts,
// upsertCoreEmbeddingFields — the `embeddingBatch` await completes before `sql.begin` is
// entered, and the delete and insert share one transaction, so an outage aborts before any
// delete and a failed insert rolls the delete back.
// tests/indexing-v3-agent.test.ts already pins that ordering statically.

const row = (overrides: Partial<StrictGateRepairRow> = {}): StrictGateRepairRow => ({
  document_id: "11111111-1111-1111-1111-111111111111",
  missing: [],
  repaired: ["metadata_completed"],
  status: "completed",
  ...overrides,
});

describe("strictGateRepairSummary", () => {
  it("counts nothing for an empty repair batch", () => {
    expect(strictGateRepairSummary([])).toEqual({ total: 0, completed: 0, deferred: 0, agentJobsReset: 0 });
  });

  it("separates completed from deferred documents", () => {
    const summary = strictGateRepairSummary([
      row(),
      row({ document_id: "2", status: "deferred", missing: ["memory_cards"], repaired: ["metadata_deferred"] }),
      row({ document_id: "3", status: "deferred", missing: ["index_units"], repaired: ["metadata_deferred"] }),
    ]);
    expect(summary).toEqual({ total: 3, completed: 1, deferred: 2, agentJobsReset: 0 });
  });

  // The number that did not exist before 20260907041700. The repair function only ever
  // touched documents.metadata, document_index_quality and ingestion_jobs, so a document
  // stuck in indexing_v3_agent_jobs stayed unclaimable no matter how often it "repaired".
  it("counts the agent-job resets that make a stuck document claimable again", () => {
    const summary = strictGateRepairSummary([
      row({ repaired: ["metadata_completed", "quality_good", "agent_job_reset"] }),
      row({ document_id: "2", repaired: ["metadata_completed"] }),
    ]);
    expect(summary.agentJobsReset).toBe(1);
  });

  it("treats a null repaired array as no repairs rather than throwing", () => {
    expect(strictGateRepairSummary([row({ repaired: null, missing: null })]).agentJobsReset).toBe(0);
  });
});

describe("formatStrictGateRepairRows", () => {
  it("says so plainly when there was nothing to repair", () => {
    expect(formatStrictGateRepairRows([])).toContain("no documents required repair");
  });

  it("prints what was missing and what was done for each document", () => {
    const output = formatStrictGateRepairRows([
      row({ status: "deferred", missing: ["memory_cards", "index_units"], repaired: ["agent_job_reset"] }),
    ]);
    expect(output).toContain("missing=memory_cards,index_units");
    expect(output).toContain("repaired=agent_job_reset");
  });
});

describe("assessEnrichmentHealth", () => {
  const counts = {
    needsEnrichmentArtifacts: 0,
    failedExhausted: 0,
    attemptsExhausted: 0,
    gateFailing: 0,
  };

  it("reports a healthy corpus and does not fail", () => {
    const verdict = assessEnrichmentHealth(counts);
    expect(verdict.stuck).toBe(0);
    expect(verdict.ok).toBe(true);
    expect(verdict.lines.join("\n")).toContain("No document is permanently excluded");
  });

  // All three states are excluded from claim_indexing_v3_agent_jobs, by two different
  // mechanisms: 'needs_enrichment_artifacts' by name in `status not in (...)`, and both
  // 'failed' and an exhausted budget through `attempt_count < max_attempts`. A count that
  // only looked at the status name would under-report.
  it("counts every permanently-excluded state as stuck", () => {
    const verdict = assessEnrichmentHealth({
      ...counts,
      needsEnrichmentArtifacts: 2,
      failedExhausted: 3,
      attemptsExhausted: 1,
    });
    expect(verdict.stuck).toBe(6);
    expect(verdict.lines.join("\n")).toContain("cannot be claimed again");
    expect(verdict.lines.join("\n")).toContain("npm run repair:enrichment-gate");
  });

  // A gate-failing document is a signal, not a terminal state: the agent may still claim it.
  it("does not count a gate-failing document as stuck on its own", () => {
    const verdict = assessEnrichmentHealth({ ...counts, gateFailing: 9 });
    expect(verdict.stuck).toBe(0);
    expect(verdict.ok).toBe(true);
  });

  it("stays informational by default and fails only when the operator asks it to", () => {
    const stuck = { ...counts, needsEnrichmentArtifacts: 1 };
    expect(assessEnrichmentHealth(stuck).ok).toBe(true);
    expect(assessEnrichmentHealth(stuck, { failOnStuck: true }).ok).toBe(false);
    expect(assessEnrichmentHealth(counts, { failOnStuck: true }).ok).toBe(true);
  });
});

// SQL owns candidate filtering; callers must preserve its ordered, bounded result.
describe("selectStrictGateRepairCandidates", () => {
  const candidate = (overrides: Partial<StrictGateStatusRow> = {}): StrictGateStatusRow => ({
    document_id: "11111111-1111-1111-1111-111111111111",
    gate_passed: false,
    missing: ["memory_cards"],
    enrichment_status: "pending",
    indexing_v3_agent_status: "needs_enrichment_artifacts",
    quality_extraction_quality: "unknown",
    ...overrides,
  });
  const client = (data: unknown = [], error: { message: string } | null = null) => ({
    rpc: vi.fn().mockResolvedValue({ data, error }),
  });

  it("preserves terminal jobs and stale open jobs that metadata-only filters miss", async () => {
    const rows = [
      candidate(),
      candidate({
        document_id: "2",
        gate_passed: true,
        missing: [],
        enrichment_status: "completed",
        indexing_v3_agent_status: "completed",
        quality_extraction_quality: "good",
      }),
    ];
    const db = client(rows);
    expect(await selectStrictGateRepairCandidates(db, 50)).toEqual(rows);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("preview_strict_enrichment_gate_repair", { p_limit: 50 });
  });

  it("returns an empty server verdict without a second local query", async () => {
    const db = client([]);
    expect(await selectStrictGateRepairCandidates(db, 50)).toEqual([]);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, 1],
    [-3, 1],
    [1, 1],
    [50, 50],
    [500, 500],
    [501, 500],
    [1.9, 1],
    [NaN, 50],
    [Infinity, 50],
  ])("normalizes limit %s to %s before preview", async (input, expected) => {
    const db = client();
    await selectStrictGateRepairCandidates(db, input);
    expect(db.rpc).toHaveBeenCalledWith("preview_strict_enrichment_gate_repair", { p_limit: expected });
  });

  it("fails closed when the deployed database lacks the preview migration", async () => {
    await expect(selectStrictGateRepairCandidates(client(null, { message: "function not found" }), 50)).rejects.toThrow(
      "function not found",
    );
  });

  it.each([null, undefined, {}, "unavailable"])("rejects a malformed RPC response %s", async (data) => {
    const db = client();
    db.rpc.mockResolvedValue({ data, error: null });
    await expect(selectStrictGateRepairCandidates(db, 50)).rejects.toThrow("no candidate list");
  });

  it("propagates a rejected request without inventing a zero-candidate verdict", async () => {
    const db = client();
    db.rpc.mockRejectedValue(new Error("network unavailable"));
    await expect(selectStrictGateRepairCandidates(db, 50)).rejects.toThrow("network unavailable");
  });
});

describe("repair deployment contract", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260907041700_repair_strict_enrichment_gate_unsticks_agent_jobs.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const script = readFileSync(new URL("../scripts/repair-strict-enrichment-gate.ts", import.meta.url), "utf8");

  it("keeps the deployed repair body and preview identical to the forward migration", () => {
    const start = migration.indexOf("create or replace function public.preview_strict_enrichment_gate_repair");
    const end = migration.indexOf("$function$;") + "$function$;".length;
    expect(schema).toContain(migration.slice(start, end));
  });

  it("uses the same preview RPC boundary before operator apply", () => {
    expect(script).toContain("await selectStrictGateRepairCandidates(supabase, limit)");
    expect(script).not.toContain(".range(");
    expect(migration).toContain("from public.preview_strict_enrichment_gate_repair(p_limit) g");
  });
});
