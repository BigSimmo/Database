import { describe, expect, it } from "vitest";
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

  // The number that did not exist before 20260902120000. The repair function only ever
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

// The operator script's dry run is the safety property the whole thing rests on, so its
// candidate set has to be the function's candidate set and not an approximation. The obvious
// preview — "every indexed document, count the gate-failing ones" — is a different set in
// both directions, which is worse than no preview.
describe("selectStrictGateRepairCandidates", () => {
  const row = (overrides: Partial<StrictGateStatusRow> = {}): StrictGateStatusRow => ({
    document_id: "11111111-1111-1111-1111-111111111111",
    gate_passed: true,
    missing: [],
    enrichment_status: "completed",
    indexing_v3_agent_status: "completed",
    quality_extraction_quality: "good",
    ...overrides,
  });

  it("skips a gate-passing document whose recorded state already agrees", () => {
    expect(selectStrictGateRepairCandidates([row()], 50)).toEqual([]);
  });

  // The direction the naive preview gets wrong first: this document passes the gate, so a
  // "count the gate-failing ones" preview reports zero, and apply repairs it.
  it.each([
    ["enrichment_status", { enrichment_status: "pending" }],
    ["indexing_v3_agent_status", { indexing_v3_agent_status: "processing" }],
    ["quality_extraction_quality", { quality_extraction_quality: "unknown" }],
  ])("selects a gate-passing document whose %s disagrees", (_label, overrides) => {
    expect(selectStrictGateRepairCandidates([row(overrides)], 50)).toHaveLength(1);
  });

  // And the other direction: this one fails the gate, so the naive preview counts it, but
  // its recorded state is already correct so apply leaves it alone.
  it("skips a gate-failing document whose recorded state is already correct", () => {
    const candidates = selectStrictGateRepairCandidates(
      [row({ gate_passed: false, enrichment_status: "pending", indexing_v3_agent_status: "pending" })],
      50,
    );
    expect(candidates).toEqual([]);
  });

  it("selects a gate-failing document still recorded as completed", () => {
    expect(selectStrictGateRepairCandidates([row({ gate_passed: false, missing: ["memory_cards"] })], 50)).toHaveLength(
      1,
    );
  });

  // Mirrors greatest(1, least(coalesce(p_limit, 50), 500)) in the SQL.
  it("clamps the limit the way the function does", () => {
    const many = Array.from({ length: 600 }, (_, index) =>
      row({ document_id: String(index), gate_passed: false, missing: ["index_units"] }),
    );
    expect(selectStrictGateRepairCandidates(many, 50)).toHaveLength(50);
    expect(selectStrictGateRepairCandidates(many, 5000)).toHaveLength(500);
    expect(selectStrictGateRepairCandidates(many, 0)).toHaveLength(1);
  });

  it("treats a null recorded status as not-completed rather than throwing", () => {
    expect(
      selectStrictGateRepairCandidates([row({ enrichment_status: null, indexing_v3_agent_status: null })], 50),
    ).toHaveLength(1);
  });
});
