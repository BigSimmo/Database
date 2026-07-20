import { describe, expect, it } from "vitest";

import { VERIFY_AGAINST_SOURCE_NOTE } from "../src/lib/answer-verification";
import { applyNumericVerification, truncateForModel, unboldUnverifiedNumbers } from "../src/lib/rag/rag";
import { attachAdjacentContext } from "../src/lib/rag/rag-cache";
import type { RagAnswer, SearchResult } from "../src/lib/types";

describe("truncateForModel — boundary-aware, number-safe source truncation (P7)", () => {
  it("returns text unchanged when within the limit", () => {
    const text = "Withhold clozapine if the ANC falls below 1.5.";
    expect(truncateForModel(text, 200)).toBe(text);
  });

  it("ends on the last complete sentence when that keeps most of the budget (no ellipsis)", () => {
    const text =
      "Monitor FBC weekly for the first 18 weeks. Withhold clozapine if the ANC falls below 1.5 and contact haematology immediately for review.";
    const out = truncateForModel(text, 60);
    expect(out).toBe("Monitor FBC weekly for the first 18 weeks.");
    expect(out).not.toContain("...");
  });

  it("never strands a bare number whose unit was cut off", () => {
    // Cutting at the raw char boundary would leave "...titrate to 150"; the unit "mg" is beyond it.
    const text = "The patient should continue current therapy and titrate to 150 mg over several weeks as tolerated.";
    const out = truncateForModel(text, 62);
    expect(out.endsWith("...")).toBe(true);
    // The stranded number must be dropped, not shown without its unit.
    expect(out).not.toMatch(/\b150\.\.\.$/);
    expect(out).not.toMatch(/150$/);
  });

  it("falls back to a word-boundary cut with an ellipsis when there is no usable sentence break", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi";
    const out = truncateForModel(text, 40);
    expect(out.endsWith("...")).toBe(true);
    // No mid-word split: every token before the ellipsis is a whole word from the input.
    const body = out.slice(0, -3).trim();
    expect(text.startsWith(body)).toBe(true);
    expect(text[body.length]).toBe(" ");
  });
});

describe("unboldUnverifiedNumbers — emphasis tracks verification (P8)", () => {
  it("removes bold around a segment carrying an unverified numeric token", () => {
    const out = unboldUnverifiedNumbers("The maximum dose is **500 mg** daily.", new Set(["500mg"]));
    expect(out).toBe("The maximum dose is 500 mg daily.");
  });

  it("keeps bold around verified figures and non-numeric emphasis", () => {
    const out = unboldUnverifiedNumbers("Give **10 mg** now and **withhold** if unstable.", new Set(["500mg"]));
    expect(out).toBe("Give **10 mg** now and **withhold** if unstable.");
  });

  it("is a no-op when there are no unverified tokens or no bold markup", () => {
    expect(unboldUnverifiedNumbers("Give **10 mg** now.", new Set())).toBe("Give **10 mg** now.");
    expect(unboldUnverifiedNumbers("Give 10 mg now.", new Set(["10mg"]))).toBe("Give 10 mg now.");
  });
});

describe("applyNumericVerification — single faithfulness caveat even when the gate runs twice", () => {
  function unverifiedAnswer(answerText: string): RagAnswer {
    const source: SearchResult = {
      id: "c1",
      document_id: "d1",
      title: "Service Overview",
      file_name: "service-overview.pdf",
      page_number: 1,
      chunk_index: 0,
      section_heading: "Overview",
      content: "The service supports patients through their recovery journey with structured input.",
      image_ids: [],
      similarity: 0.9,
      hybrid_score: 0.9,
      images: [],
    };
    return {
      answer: answerText,
      grounded: true,
      confidence: "high",
      citations: [
        {
          chunk_id: "c1",
          document_id: "d1",
          title: "Service Overview",
          file_name: "service-overview.pdf",
          page_number: 1,
          chunk_index: 0,
          similarity: 0.9,
        },
      ],
      sources: [source],
      answerSections: [],
    };
  }

  it("flags, un-bolds, downgrades — and never duplicates the caveat on the second (finalize-time) run", () => {
    // Non-actionable context (no dose/threshold/monitoring wording), so the caveat path applies
    // rather than the hard numeric fail-closed gate. The gate runs at parse-time AND finalize-time
    // on the model path; the caveat must not stack.
    const once = applyNumericVerification(unverifiedAnswer("Symptoms usually settle within **18 weeks** of starting."));
    expect(once.unverifiedNumericTokens).toContain("18weeks");
    expect(once.answer).not.toContain("**18 weeks**");
    expect(once.confidence).toBe("medium");

    const twice = applyNumericVerification(once);
    const faithfulnessGaps = (twice.conflictsOrGaps ?? []).filter((gap) =>
      gap.message.startsWith(VERIFY_AGAINST_SOURCE_NOTE),
    );
    expect(faithfulnessGaps).toHaveLength(1);
  });

  it("fails closed entirely when the unverified number sits in actionable dose/threshold context", () => {
    // Merged policy from main: an unverified figure in actionable clinical context must not reach
    // the clinician at all — the whole answer is replaced with a source-gap review message.
    const gated = applyNumericVerification(unverifiedAnswer("The usual therapeutic dose is **500 mg** daily."));
    expect(gated.grounded).toBe(false);
    expect(gated.confidence).toBe("unsupported");
    expect(gated.routingReason).toContain("numeric_faithfulness_gate_source_gap");
    expect(gated.answer).not.toContain("500 mg");
  });

  // Regression: the model generates from the PACKED context (adjacent_context carries neighbour
  // -chunk text), but answer.sources is the UNPACKED answer-input set. Re-verifying finalize-time
  // against the unpacked sources blanked correct dose answers whose figure lived only in the packed
  // adjacent_context. Passing the packed corpus as verificationSources keeps the number verified.
  it("does not suppress a dose the model saw only in the packed adjacent_context (corpus-parity fix)", () => {
    const packedCorpus: SearchResult[] = [
      {
        id: "c1",
        document_id: "d1",
        title: "Service Overview",
        file_name: "service-overview.pdf",
        page_number: 1,
        chunk_index: 0,
        section_heading: "Overview",
        content: "The service supports patients through their recovery journey with structured input.",
        image_ids: [],
        similarity: 0.9,
        hybrid_score: 0.9,
        images: [],
        adjacent_context: "Adults: the usual therapeutic dose is 500 mg daily.",
      },
    ];

    // Bug repro: verifying against the unpacked sources (no adjacent_context) fails the answer closed.
    const suppressed = applyNumericVerification(unverifiedAnswer("The usual therapeutic dose is **500 mg** daily."));
    expect(suppressed.grounded).toBe(false);
    expect(suppressed.confidence).toBe("unsupported");

    // Fix: verifying against the packed corpus the model actually saw keeps the answer intact.
    const verified = applyNumericVerification(
      unverifiedAnswer("The usual therapeutic dose is **500 mg** daily."),
      packedCorpus,
    );
    expect(verified.grounded).toBe(true);
    expect(verified.confidence).toBe("high");
    expect(verified.answer).toContain("500 mg");
    expect(verified.routingReason ?? "").not.toContain("numeric_faithfulness_gate_source_gap");
  });
});

describe("attachAdjacentContext — rebuild the packed verification corpus by chunk id", () => {
  const base: SearchResult = {
    id: "c1",
    document_id: "d1",
    title: "Doc",
    file_name: "doc.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: null,
    content: "See the neighbouring row.",
    image_ids: [],
    similarity: 0.9,
    images: [],
  };

  it("overlays adjacent_context from the packed set onto matching ids", () => {
    const unpacked: SearchResult[] = [base];
    const packed: SearchResult[] = [{ ...base, adjacent_context: "Dose is 500 mg daily." }];
    const merged = attachAdjacentContext(unpacked, packed);
    expect(merged[0]!.adjacent_context).toBe("Dose is 500 mg daily.");
    // Does not mutate the input source object.
    expect(base.adjacent_context).toBeUndefined();
  });

  it("returns the original array reference when the packed set adds nothing", () => {
    const unpacked: SearchResult[] = [base];
    expect(attachAdjacentContext(unpacked, [])).toBe(unpacked);
    expect(attachAdjacentContext(unpacked, [{ ...base, adjacent_context: undefined }])).toBe(unpacked);
  });

  it("leaves non-matching ids untouched", () => {
    const unpacked: SearchResult[] = [base, { ...base, id: "c2" }];
    const packed: SearchResult[] = [{ ...base, id: "c1", adjacent_context: "neighbour text" }];
    const merged = attachAdjacentContext(unpacked, packed);
    expect(merged[0]!.adjacent_context).toBe("neighbour text");
    expect(merged[1]!.adjacent_context).toBeUndefined();
  });
});
