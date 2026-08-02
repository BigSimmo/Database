import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// RAG-ranking contract pins (docs/rag-behaviour/safeguards.md — layer 2).
//
// These are deliberate SOURCE-TEXT pins on the score-imputation formulas and the release
// comparator key order. They exist because retrieval ORDERING behaviour is live-validated:
// on 2026-07-20 a change that passed 121/121 offline tests and an adversarial code review
// still regressed the live golden eval 3/36 within one run (canary #55) and was reverted.
//
// If an edit turns one of these pins red, that is the safeguard working — do NOT simply
// update the expected strings. The required protocol (docs/rag-behaviour/refuted-approaches.md)
// is: dedicated design, discriminating offline tests with DIFFERENTLY-relevant candidates,
// an explicit `RAG impact:` PR declaration, user approval, and a live canary before/after
// pair (doc/content recall pinned 1.0, zero per-case rr regressions) before the change is
// trusted. Update these pins in the same PR as that evidence, never alone.

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("RAG imputation and release-order contract", () => {
  it("pins the table-fact imputed-primary formulas (S2)", () => {
    const source = read("src/lib/rag/rag-candidate-sources.ts");
    expect(source).toContain("similarity: Math.min(0.94, 0.62 + Math.min(textRank, 1) * 0.3)");
    expect(source).toContain("hybridScore: Math.min(0.97, 0.66 + Math.min(textRank, 1) * 0.3)");
  });

  it("pins the lexical-chunk truthful-score contract in SQL (S1: similarity 0, hybrid capped at 0.48)", () => {
    const schema = read("supabase/schema.sql");
    // Both text-RPC generations carry the cap; spacing differs between them.
    const matches = schema.match(/least\(0\.5,\s*0\.18 \+ \(least\(ranked\.text_rank, 1\) \* 0\.3\)\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("pins the release comparator key order: score -> similarity -> relevance -> id", () => {
    const source = read("src/lib/released-search-order.ts");
    // Key order is the load-bearing contract: in all-saturated pools the score keys tie and
    // ordering falls to relevance.score — the boost/title/subject-aware clinical rank. A new
    // key inserted ABOVE relevance lets raw text-rank override clinical ranking (the proven
    // Phase C regression mechanism). Assert relative positions of the four keys in both
    // comparators by stripping to their comparison lines.
    const hybridKey = source.indexOf("rightHybrid - leftHybrid");
    const releaseKey = source.indexOf("rightReleaseScore - leftReleaseScore");
    const similarityKeys = [...source.matchAll(/rightSimilarity - leftSimilarity/g)].map((match) => match.index ?? -1);
    const relevanceKeys = [
      ...source.matchAll(/right\.relevance\?\.score \?\? 0\) - \(left\.relevance\?\.score \?\? 0\)/g),
    ].map((match) => match.index ?? -1);
    const idKeys = [...source.matchAll(/left\.id\.localeCompare\(right\.id\)/g)].map((match) => match.index ?? -1);

    expect(hybridKey).toBeGreaterThan(-1);
    expect(releaseKey).toBeGreaterThan(-1);
    expect(similarityKeys).toHaveLength(2);
    expect(relevanceKeys).toHaveLength(2);
    expect(idKeys.length).toBeGreaterThanOrEqual(2);
    // First comparator: hybrid < similarity < relevance < id.
    expect(hybridKey).toBeLessThan(similarityKeys[0]);
    expect(similarityKeys[0]).toBeLessThan(relevanceKeys[0]);
    expect(relevanceKeys[0]).toBeLessThan(idKeys[0]);
    // Second comparator: releaseScore < similarity < relevance < id.
    expect(releaseKey).toBeLessThan(similarityKeys[1]);
    expect(similarityKeys[1]).toBeLessThan(relevanceKeys[1]);
    expect(relevanceKeys[1]).toBeLessThan(idKeys[1]);
  });

  it("pins the selection tie-break contract: coverage stays a late tie-break, never added to score", () => {
    const source = read("src/lib/retrieval-selection.ts");
    expect(source).toContain("contentCoverageScore");
    // The clamped-score contract comment and the coverage comparator must both survive.
    expect(source).toMatch(/clamp/i);
  });
});
