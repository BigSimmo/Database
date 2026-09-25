import { describe, expect, it } from "vitest";
import { documentRelevanceLabel, documentRelevancePercent } from "../src/components/clinical-dashboard/relevance-score";

describe("document relevance score display", () => {
  it("does not inflate weak fractional scores into high relevance", () => {
    expect(documentRelevancePercent({ score: 0.05 })).toBe(5);
    expect(documentRelevancePercent({ relevance: { score: 0.08 } as never, score: 0.9 })).toBe(8);
  });

  it("keeps calibrated verdict percentages ahead of raw scores", () => {
    expect(documentRelevancePercent({ relevance: { verdict: "direct", score: 0.2 } as never, score: 0.2 })).toBe(96);
    expect(documentRelevancePercent({ relevance: { verdict: "partial", score: 0.2 } as never, score: 0.2 })).toBe(84);
    expect(documentRelevancePercent({ relevance: { verdict: "nearby", score: 0.2 } as never, score: 0.2 })).toBe(78);
  });

  it("does not collapse a strong unit-scale score just above 1 into ~1%", () => {
    // A raw search score of 1.2 is a strong score on the unit scale, not 1.2%.
    expect(documentRelevancePercent({ score: 1.2 })).toBe(99);
    expect(documentRelevancePercent({ score: 1 })).toBe(99);
  });
});

describe("document relevance label (#1M22X5)", () => {
  it("names the verdict in words and ignores the raw score", () => {
    expect(documentRelevanceLabel({ relevance: { verdict: "direct", score: 0.01 } as never })).toBe("Strong match");
    expect(documentRelevanceLabel({ relevance: { verdict: "partial", score: 0.01 } as never })).toBe("Partial match");
    // The defect: a nearby verdict used to read "Relevant" because its constant 78 cleared 75.
    expect(documentRelevanceLabel({ relevance: { verdict: "nearby", score: 0.99 } as never })).toBe("Nearby only");
    expect(documentRelevanceLabel({ relevance: { verdict: "none", score: 0.99 } as never })).toBe("No direct support");
    expect(documentRelevanceLabel({})).toBe("No direct support");
  });
});
