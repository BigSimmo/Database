import { describe, expect, it } from "vitest";

import { analyzeClinicalQuery } from "@/lib/clinical-search";
import {
  clearlyOutsideCorpusMedicalPattern,
  isUnsupportedSoftTailAnalysis,
  shouldShortCircuitUnsupportedSearch,
} from "@/lib/rag/rag-query-guard";

describe("rag-query-guard — in-corpus clinical and psychiatric queries", () => {
  it("does not classify SSRI queries as clearly outside corpus", () => {
    expect(clearlyOutsideCorpusMedicalPattern.test("Which SSRI is first line for generalised anxiety disorder?")).toBe(
      false,
    );
    expect(clearlyOutsideCorpusMedicalPattern.test("ssri discontinuation syndrome")).toBe(false);
  });

  it("does not classify hyperkalaemia / hyperkalemia as clearly outside corpus", () => {
    expect(clearlyOutsideCorpusMedicalPattern.test("hyperkalaemia monitoring in lithium therapy")).toBe(false);
    expect(clearlyOutsideCorpusMedicalPattern.test("hyperkalemia risk")).toBe(false);
  });

  it("does not classify adolescent depression as clearly outside corpus", () => {
    expect(clearlyOutsideCorpusMedicalPattern.test("adolescent depression management pathway")).toBe(false);
  });

  it("retains genuine outside-corpus acute medical conditions", () => {
    expect(clearlyOutsideCorpusMedicalPattern.test("diabetic ketoacidosis management protocol")).toBe(true);
    expect(clearlyOutsideCorpusMedicalPattern.test("community-acquired pneumonia treatment")).toBe(true);
    // Bare tokens dka and antibiotic are deliberately dropped in favor of specific phrases
    expect(clearlyOutsideCorpusMedicalPattern.test("dka fluids")).toBe(false);
    expect(clearlyOutsideCorpusMedicalPattern.test("antibiotic stewardship")).toBe(false);
  });

  it("does not short-circuit clinical queries that mention consumer tokens like phone", () => {
    const query = "phone assessment for adolescent depression";
    const analysis = analyzeClinicalQuery(query);
    expect(shouldShortCircuitUnsupportedSearch(query, analysis)).toBe(false);
  });

  it("does not short-circuit SSRI queries", () => {
    const query = "Which SSRI is first line for generalised anxiety disorder?";
    const analysis = analyzeClinicalQuery(query);
    expect(shouldShortCircuitUnsupportedSearch(query, analysis)).toBe(false);
  });

  it("still short-circuits purely non-clinical consumer queries", () => {
    const query = "best espresso coffee machine";
    const analysis = analyzeClinicalQuery(query);
    expect(shouldShortCircuitUnsupportedSearch(query, analysis)).toBe(true);
    expect(isUnsupportedSoftTailAnalysis(query, analysis)).toBe(false);
  });
});
