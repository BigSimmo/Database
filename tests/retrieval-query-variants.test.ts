import { describe, expect, it } from "vitest";
import { analyzeClinicalQuery } from "../src/lib/clinical-search";
import {
  buildRetrievalQueryVariants,
  selectRagAliasExpansions,
  shouldApplyUnsupportedSearchShortCircuit,
} from "../src/lib/rag";

describe("retrieval query variants", () => {
  it("keeps typo-corrected acronym terms in a capped variant list", () => {
    const analysis = analyzeClinicalQuery("clozapin FBC ANC threshold");
    const variants = buildRetrievalQueryVariants("clozapin FBC ANC threshold", analysis);

    expect(variants[0]).toContain("clozapine");
    expect(variants.join(" ")).toContain("fbc");
    expect(variants.join(" ")).toContain("anc");
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("adds document-title-focused variants for document lookup intent", () => {
    const query = "Where is the active community patients in ED document?";
    const analysis = analyzeClinicalQuery(query);
    const variants = buildRetrievalQueryVariants(query, analysis);

    expect(analysis.documentTitleIntent).toBe(true);
    expect(variants.some((variant) => variant.includes("active community"))).toBe(true);
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("adds shortened core variants for long natural-language threshold questions", () => {
    const query =
      "Please can you tell me exactly when I should withhold clozapine based on ANC and FBC threshold values in the monitoring table?";
    const analysis = analyzeClinicalQuery(query);
    const variants = buildRetrievalQueryVariants(query, analysis);

    expect(variants.length).toBeGreaterThan(1);
    expect(variants.some((variant) => variant.includes("clozapine") && variant.includes("anc"))).toBe(true);
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("adds DB-backed canonical aliases without exceeding the variant cap", () => {
    const query = "What is the depot workflow for missed doses?";
    const analysis = analyzeClinicalQuery(query);
    const aliases = [
      {
        alias: "depot",
        canonical: "long acting injectable antipsychotic",
        alias_type: "clinical_term",
        weight: 2,
        owner_id: null,
      },
    ];
    const variants = buildRetrievalQueryVariants(query, analysis, aliases);

    expect(variants.join(" ")).toContain("long acting injectable antipsychotic");
    expect(variants.length).toBeLessThanOrEqual(4);
  });

  it("only expands aliases supplied for the current owner scope", () => {
    const query = "clozapin anc threshold";
    const expansions = selectRagAliasExpansions(query, [
      { alias: "clozapin", canonical: "clozapine", alias_type: "typo", owner_id: "owner-a", weight: 1 },
    ]);

    expect(expansions).toEqual(["clozapine"]);
    expect(expansions).not.toContain("private owner b neutrophil threshold");
  });

  it("does not short-circuit unsupported-looking queries when a DB alias matches", () => {
    const query = "coffee machine wobblefix";
    const analysis = analyzeClinicalQuery(query);
    const expansions = selectRagAliasExpansions(query, [
      { alias: "wobblefix", canonical: "clozapine monitoring ANC threshold", alias_type: "custom", weight: 1 },
    ]);

    expect(shouldApplyUnsupportedSearchShortCircuit(query, analysis, [])).toBe(true);
    expect(expansions).toEqual(["clozapine monitoring ANC threshold"]);
    expect(shouldApplyUnsupportedSearchShortCircuit(query, analysis, expansions)).toBe(false);
  });
});
