import { describe, expect, it } from "vitest";
import { buildClinicalTextSearchQuery, normalizedClinicalSearchTokens } from "../src/lib/clinical-search";

describe("clinical search query normalization", () => {
  it("keeps high-yield clinical terms and removes question filler", () => {
    expect(normalizedClinicalSearchTokens("What safety monitoring is required for clozapine?")).toEqual([
      "safety",
      "monitoring",
      "clozapine",
    ]);
  });

  it("uses AND-style websearch text to avoid broad unsupported OR matches", () => {
    expect(buildClinicalTextSearchQuery("What antibiotic dose is recommended for community-acquired pneumonia?")).toBe(
      "antibiotic dose recommended community acquired pneumonia",
    );
  });

  it("falls back to the original query when only one useful token remains", () => {
    expect(buildClinicalTextSearchQuery("What are NOCC requirements?")).toBe("nocc");
  });

  it("expands community patients to the local Pts abbreviation for title matching", () => {
    expect(buildClinicalTextSearchQuery("What is the process for admission of community patients?")).toBe(
      "admission community pts",
    );
  });

  it("expands active community patients in ED to the local Pt ED title terms", () => {
    expect(buildClinicalTextSearchQuery("How are active community patients in ED managed?")).toBe(
      "active community pt ed",
    );
  });

  it("removes low-value identification filler from exact topic lookups", () => {
    expect(buildClinicalTextSearchQuery("What is required when illegal substances are identified?")).toBe(
      "illegal substance",
    );
  });
});
