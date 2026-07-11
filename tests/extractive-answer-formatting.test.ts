import { describe, expect, it } from "vitest";
import {
  buildExtractiveAnswer,
  sentenceFromFact,
  splitClinicalEvidenceSentences,
} from "../src/lib/rag-extractive-answer";
import type { RagAnswer, SearchResult } from "../src/lib/types";

// Regression for the live source-only answer that rendered as:
// "For lithium, twice daily dosing should be spaced by 12 hours. The guidance
// is that for lithium, acute Mania: o IR product: 750 to 1000mg daily in 2 or
// 3 divided doses or as a single dose at night."
// — a literal Word/PDF sub-bullet "o" glyph in the answer body, the section
// heading glued mid-sentence, and the query entity stitched in twice.
describe("extractive evidence splitting", () => {
  const lithiumPassage =
    "Twice daily dosing should be spaced by 12 hours. Acute Mania: o IR product: 750 to 1000mg daily in 2 or 3 divided doses or as a single dose at night.";

  it("treats the sub-bullet 'o' glyph as a fact boundary instead of leaving it mid-sentence", () => {
    const sentences = splitClinicalEvidenceSentences(lithiumPassage);
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/\bo\s+[A-Z]/);
      expect(sentence).not.toContain("Mania: o");
    }
  });

  it("keeps the indication heading as context on the dose fact instead of dropping it", () => {
    const sentences = splitClinicalEvidenceSentences(lithiumPassage);
    const doseFact = sentences.find((sentence) => sentence.includes("750 to 1000mg"));
    expect(doseFact).toBeDefined();
    expect(doseFact).toMatch(/acute mania/i);
  });

  it("rewrites a leading heading colon into readable context", () => {
    const sentences = splitClinicalEvidenceSentences(
      "Renal Impairment: o Reduce the maintenance dose and monitor levels closely.",
    );
    expect(sentences.some((sentence) => /^For renal impairment,/i.test(sentence))).toBe(true);
  });

  it("keeps a directive heading attached to its bullet item", () => {
    const sentences = splitClinicalEvidenceSentences(
      "Do not use: o Pregnancy or breastfeeding without specialist advice.",
    );
    const contraindication = sentences.find((sentence) => /pregnancy/i.test(sentence));
    expect(contraindication).toBeDefined();
    expect(contraindication).toMatch(/^Do not use:/i);
  });

  it("keeps digit-bearing schedule headings attached to their dose items", () => {
    const daySentences = splitClinicalEvidenceSentences("Day 1: o 25 mg nightly before considering an increase.");
    const dayDose = daySentences.find((sentence) => sentence.includes("25 mg"));
    expect(dayDose).toBeDefined();
    expect(dayDose).toMatch(/^Day 1\b/);
    expect(dayDose).not.toMatch(/\bo\s+\d/);

    const stepSentences = splitClinicalEvidenceSentences("Step 2: o Increase to 50 mg nightly if tolerated.");
    const stepDose = stepSentences.find((sentence) => sentence.includes("50 mg"));
    expect(stepDose).toBeDefined();
    expect(stepDose).toMatch(/^Step 2\b/);
    expect(stepDose).not.toMatch(/\bo\s+[A-Z0-9]/);
  });

  it("preserves a newline boundary before bare sub-bullets after numeric headings", () => {
    const sentences = splitClinicalEvidenceSentences("Step 1\no Start at 12.5 mg nightly and review tomorrow.");
    expect(sentences.some((sentence) => sentence.includes("Start at 12.5 mg"))).toBe(true);
    expect(sentences.join(" ")).not.toMatch(/\bo\s+Start\b/);
  });

  it("keeps comparator threshold headings attached to their action items", () => {
    const renal = splitClinicalEvidenceSentences("eGFR <30: o Reduce the maintenance dose to 500 mg daily.").find(
      (sentence) => sentence.includes("500 mg"),
    );
    expect(renal).toBeDefined();
    expect(renal).toMatch(/^eGFR <30:/);

    const anc = splitClinicalEvidenceSentences("ANC <0.5: o Withhold clozapine and repeat FBC tomorrow.").find(
      (sentence) => /withhold clozapine/i.test(sentence),
    );
    expect(anc).toBeDefined();
    expect(anc).toMatch(/^ANC <0\.5:/);
  });

  it("keeps clinical section headings while excluding structural section labels", () => {
    const caesarean = splitClinicalEvidenceSentences(
      "Caesarean section: o Give antibiotic prophylaxis before skin incision.",
    ).find((sentence) => /antibiotic prophylaxis/i.test(sentence));
    expect(caesarean).toBeDefined();
    expect(caesarean).toMatch(/caesarean section/i);
  });

  it("keeps reference-range headings attached to their numeric items", () => {
    const range = splitClinicalEvidenceSentences(
      "Reference range: o 0.6-1.0 mmol/L for maintenance lithium therapy.",
    ).find((sentence) => sentence.includes("0.6-1.0 mmol/L"));
    expect(range).toBeDefined();
    expect(range).toMatch(/reference range/i);
  });

  it("keeps the clinical source-control heading attached to its action item", () => {
    const sourceControl = splitClinicalEvidenceSentences(
      "Source control: o Review antibiotics and arrange drainage within six hours.",
    ).find((sentence) => /review antibiotics/i.test(sentence));
    expect(sourceControl).toBeDefined();
    expect(sourceControl).toMatch(/source control/i);
  });

  it("keeps plus-bearing electrolyte thresholds attached to their action items", () => {
    const potassium = splitClinicalEvidenceSentences(
      "K+ >5.5 mmol/L: o Withhold the next dose and recheck electrolytes.",
    ).find((sentence) => /withhold/i.test(sentence));
    expect(potassium).toBeDefined();
    expect(potassium).toMatch(/^K\+ >5\.5 mmol\/L:/);
  });

  it("keeps degree and micro threshold headings attached to their action items", () => {
    const temperature = splitClinicalEvidenceSentences(
      "Temp ≥38°C: o Contact the treating team and repeat observations.",
    ).find((sentence) => /contact the treating team/i.test(sentence));
    expect(temperature).toBeDefined();
    expect(temperature).toMatch(/^Temp ≥38°C:/);
  });

  it("keeps numeric time-window headings attached to their restart items", () => {
    const restart = splitClinicalEvidenceSentences("48-72 hours: o Restart clozapine at 12.5 mg and review.").find(
      (sentence) => sentence.includes("12.5 mg"),
    );
    expect(restart).toBeDefined();
    expect(restart).toMatch(/^48-72 hours:/i);
    expect(restart).not.toMatch(/\bo\s+[A-Z0-9]/);
  });

  it("merges lowercase headings with their bullet items", () => {
    const contraindication = splitClinicalEvidenceSentences(
      "do not use: o Pregnancy or breastfeeding without specialist advice.",
    ).find((sentence) => /pregnancy/i.test(sentence));
    expect(contraindication).toBeDefined();
    expect(contraindication).toMatch(/^do not use:/i);

    const schedule = splitClinicalEvidenceSentences("day 1: o 25 mg nightly before considering an increase.").find(
      (sentence) => sentence.includes("25 mg"),
    );
    expect(schedule).toBeDefined();
    expect(schedule).toMatch(/^day 1\b/i);
    expect(schedule).not.toMatch(/\bo\s+\d/);
  });

  it("keeps an advisory heading attached to its bullet item in colon form", () => {
    const sentences = splitClinicalEvidenceSentences(
      "Caution: o Pregnancy or breastfeeding requires specialist advice before dosing.",
    );
    const caveat = sentences.find((sentence) => /pregnancy/i.test(sentence));
    expect(caveat).toBeDefined();
    expect(caveat).toMatch(/^Caution:/i);
  });

  it("keeps a directive dose heading in colon form instead of a copula rewrite", () => {
    const avoidance = splitClinicalEvidenceSentences(
      "Avoid: o 12.5 mg after a treatment interruption of two days.",
    ).find((sentence) => sentence.includes("12.5 mg"));
    expect(avoidance).toBeDefined();
    expect(avoidance).toMatch(/^Avoid: 12\.5 mg/);
    expect(avoidance).not.toMatch(/Avoid is/);
  });

  it("keeps a directive heading's colon form instead of rewriting it as noun context", () => {
    const sentences = splitClinicalEvidenceSentences("Avoid: o Pregnancy in the first trimester of treatment.");
    const avoidance = sentences.find((sentence) => /pregnancy/i.test(sentence));
    expect(avoidance).toBeDefined();
    expect(avoidance).not.toMatch(/^For avoid,/i);
    expect(avoidance).toMatch(/^Avoid:/i);
  });

  it("does not rewrite a preposition-ended colon phrase as a dose label", () => {
    const sentences = splitClinicalEvidenceSentences(
      "If tolerated poorly, reduce the total daily dose to: 500mg at night and review within one week.",
    );
    const doseSentence = sentences.find((sentence) => sentence.includes("500mg"));
    expect(doseSentence).toBeDefined();
    expect(doseSentence).not.toMatch(/to is 500mg/);
  });
});

describe("extractive sentence stitching", () => {
  it("never duplicates the query entity across the prefix and the guidance wrapper", () => {
    const sentence = sentenceFromFact(
      {
        kind: "dose",
        text: "twice daily dosing should be spaced by 12 hours",
        citationChunkIds: ["chunk-1"],
        priority: 1,
      },
      "lithium dosing",
    );
    expect(sentence).toBeTruthy();
    expect(sentence).not.toMatch(/that for lithium/i);
    expect((sentence.match(/lithium/gi) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("does not prefix the entity when the fact already names it", () => {
    const sentence = sentenceFromFact(
      {
        kind: "monitoring",
        text: "lithium levels should be checked 5 to 7 days after any dose change",
        citationChunkIds: ["chunk-1"],
        priority: 1,
      },
      "lithium monitoring",
    );
    expect(sentence).toBeTruthy();
    expect((sentence.match(/lithium/gi) ?? []).length).toBe(1);
  });

  it("suppresses the entity prefix when asked so lead answers do not repeat it", () => {
    const sentence = sentenceFromFact(
      {
        kind: "dose",
        text: "twice daily dosing should be spaced by 12 hours",
        citationChunkIds: ["chunk-1"],
        priority: 1,
      },
      "lithium dosing",
      { suppressEntityPrefix: true },
    );
    expect(sentence).toBeTruthy();
    expect(sentence).not.toMatch(/lithium/i);
  });
});

describe("extractive answer end to end", () => {
  it("renders the lithium source-only case cleanly through buildExtractiveAnswer", () => {
    const result = {
      id: "lithium-chunk-1",
      document_id: "lithium-doc",
      title: "Lithium Therapy Guideline",
      file_name: "Lithium Therapy Guideline.pdf",
      page_number: 3,
      chunk_index: 2,
      section_heading: "Dosing",
      content:
        "Twice daily dosing should be spaced by 12 hours. Acute Mania: o IR product: 750 to 1000mg daily in 2 or 3 divided doses or as a single dose at night.",
      image_ids: [],
      similarity: 0.88,
      hybrid_score: 0.93,
      images: [],
    } as unknown as SearchResult;

    const answer = buildExtractiveAnswer({
      query: "lithium dosing",
      queryClass: "medication_dose_risk",
      results: [result],
      quoteCards: [],
      documentBreakdown: [] as RagAnswer["documentBreakdown"],
      evidenceSummary: undefined as unknown as RagAnswer["evidenceSummary"],
      sourceCoverage: undefined as unknown as RagAnswer["sourceCoverage"],
      conflictsOrGaps: [],
      visualEvidence: [] as unknown as RagAnswer["visualEvidence"],
      bestSource: undefined as unknown as RagAnswer["bestSource"],
      smartPanel: undefined as unknown as RagAnswer["smartPanel"],
      relatedDocuments: [] as unknown as RagAnswer["relatedDocuments"],
      routeReason: "demo",
      timings: undefined as unknown as RagAnswer["latencyTimings"],
    });

    const plain = (answer.answer ?? "").replace(/\*\*/g, "");
    expect(plain).not.toMatch(/\bo\s+[A-Z]/);
    expect(plain).not.toMatch(/that for lithium/i);
    expect(plain).toMatch(/^For lithium, twice daily dosing should be spaced by 12 hours\./);
    expect(plain).toMatch(/For acute mania, IR product is 750 to 1000mg daily/);
  });
});
