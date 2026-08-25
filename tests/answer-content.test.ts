import { describe, expect, it } from "vitest";
import {
  primaryAnswerDisplayFragments,
  primaryAnswerDisplayText,
  splitTrailingWord,
} from "../src/components/clinical-dashboard/answer-content";
import { sourceQuoteDisplayText } from "../src/components/clinical-dashboard/display-text";

describe("primaryAnswerDisplayText", () => {
  it("keeps a safety cue in a long leading fragment beyond the compact word budget", () => {
    const lead = `${Array.from({ length: 90 }, (_, index) => `detail${index + 1}`).join(" ")} Do not administer the medicine.`;

    expect(primaryAnswerDisplayText(lead)).toContain("Do not administer the medicine.");
  });

  it("keeps a full-word escalation caveat that appears beyond the compact head", () => {
    // A bare `escalat\b` stem never matched "Escalate", so this caveat (the
    // fourth fragment) was silently dropped before the fix.
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Escalate to the senior doctor if the patient deteriorates.";
    expect(primaryAnswerDisplayText(answer)).toContain("Escalate to the senior doctor");
  });

  it("keeps a short contraindication caveat under the 8-word usefulness floor", () => {
    // "Contraindicated in pregnancy and severe renal impairment" is 7 words, so
    // the usefulness/length filter dropped it before the safety-aware exception.
    const answer =
      "Offer oral rehydration first. Reassess fluid balance after two hours. Record the intake and output totals. Contraindicated in pregnancy and severe renal impairment.";
    expect(primaryAnswerDisplayText(answer)).toContain("Contraindicated in pregnancy");
  });

  it("keeps a short stop instruction after normal leading prose", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Stop lithium.";
    expect(primaryAnswerDisplayText(answer)).toContain("Stop lithium.");
  });

  it("keeps a passive held caveat beyond the compact head", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Clozapine should be held.";
    expect(primaryAnswerDisplayText(answer)).toContain("should be held");
  });

  it("keeps an avoid directive after normal leading prose", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Avoid lithium in pregnancy.";
    expect(primaryAnswerDisplayText(answer)).toContain("Avoid lithium in pregnancy");
  });

  it("keeps a caveat whose safety keyword is server-bolded on the preserveBold path", () => {
    // "Do **not** administer" — bold markers inside the phrase must not defeat
    // the safety match, or the compact cap could drop the withhold instruction.
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Do **not** administer lithium.";
    expect(primaryAnswerDisplayText(answer, { preserveBold: true })).toContain("administer lithium");
  });

  it("keeps a should-not / must-not contraindication directive beyond the compact head", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Clozapine should not be used in this patient.";
    expect(primaryAnswerDisplayText(answer)).toContain("should not be used");
  });

  it("is unchanged for a short answer with no safety signal", () => {
    const answer = "Offer simple analgesia and reassess in one hour.";
    expect(primaryAnswerDisplayText(answer)).toBe(answer);
  });
});

describe("sourceQuoteDisplayText", () => {
  it("removes PDF navigation, footnote, and list artifacts from a cited passage", () => {
    const extracted =
      "Section: Consent > Consent requirements | Page: 9 | o for maintenance ECT consent must be obtained after 12 treatments or every three (3) months, whichever comes first 13 [Level GPP] • complete baseline pathology investigations and ECG.";

    expect(sourceQuoteDisplayText(extracted)).toBe(
      "Consent requirements. For maintenance ECT consent must be obtained after 12 treatments or every three (3) months, whichever comes first 13. Complete baseline pathology investigations and ECG.",
    );
  });

  it("preserves clinically meaningful O tokens in source quotes", () => {
    expect(sourceQuoteDisplayText("blood group o positive should be interpreted with Rh status.")).toContain(
      "Blood group o positive should be interpreted with Rh status.",
    );
    expect(sourceQuoteDisplayText("Record temperature at 37 o C and document response.")).toContain(
      "Record temperature at 37 o C and document response.",
    );
  });

  it("removes evidence-grade markers without dropping nearby numeric values", () => {
    const extracted = "Administer 12 [Level A] as directed and monitor renal function.";
    const result = sourceQuoteDisplayText(extracted);

    expect(result).toContain("Administer 12");
    expect(result).not.toContain("[Level");
  });

  it("preserves clinically meaningful comparison symbols and numbers", () => {
    expect(sourceQuoteDisplayText("Page: 4 | • Withhold if ANC < 1.0 ×10⁹/L.")).toBe("Withhold if ANC < 1.0 ×10⁹/L.");
  });
});

/**
 * Splitting the prose into sentences exists only so a source mark has somewhere
 * to attach. It must not change one character of what a clinician reads, so the
 * displayed string is DEFINED as the join and pinned here against the cases that
 * exercise every branch of the selector: the compact cap, the safety bypass, the
 * word-budget truncation, deduplication, the preformatted path, and the
 * everything-was-filtered fallback.
 */
describe("primaryAnswerDisplayFragments", () => {
  const cases: Array<[string, string, { preformatted?: boolean; preserveBold?: boolean }]> = [
    [
      "ordinary multi-sentence prose",
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the plan in the notes.",
      {},
    ],
    [
      "a safety caveat beyond the compact head",
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Escalate to the senior doctor if the patient deteriorates.",
      {},
    ],
    [
      "a fragment past the word budget",
      `${Array.from({ length: 90 }, (_, index) => `detail${index + 1}`).join(" ")} Do not administer the medicine.`,
      {},
    ],
    ["a repeated sentence", "Check the level weekly. Check the level weekly. Record the result in the notes.", {}],
    ["server bold", "Check the **FBC** weekly and record the result in the clinical notes.", { preserveBold: true }],
    ["a preformatted answer", "Local formulary 2025\nSection 4.2 — clozapine titration", { preformatted: true }],
    ["an answer that survives nothing", "n/a", {}],
    ["an empty answer", "", {}],
  ];

  /**
   * The loop below cannot fail on its own. `primaryAnswerDisplayText` IS
   * `fragments.map(f => f.display).join(" ")`, so comparing the two is an
   * identity: it documents the definition and would keep passing through any
   * change to the prose the selector produces. These literals are what actually
   * hold the displayed text still — the loop then carries that guarantee across
   * every other branch.
   */
  it("splits prose at sentence ends and changes not one character", () => {
    const answer =
      "Check the full blood count weekly for the first eighteen weeks. Record every result in the clinical notes.";
    expect(primaryAnswerDisplayFragments(answer).map((fragment) => fragment.display)).toEqual([
      "Check the full blood count weekly for the first eighteen weeks.",
      "Record every result in the clinical notes.",
    ]);
    expect(primaryAnswerDisplayText(answer)).toBe(answer);
  });

  it("leaves a preformatted answer whole rather than splitting its lines", () => {
    const answer = "Local formulary 2025\nSection 4.2 — clozapine titration";
    expect(primaryAnswerDisplayFragments(answer, { preformatted: true }).map((fragment) => fragment.display)).toEqual([
      answer,
    ]);
  });

  /**
   * Pinned because it surprises: the selector drops a short sentence that
   * `clinicalProseUsefulness` does not judge useful and that falls under the
   * eight-word floor. That is long-standing behaviour — `main` drops the same
   * sentence — and the fragment split inherited it unchanged rather than
   * introducing it. It is recorded here so the next reader of a "missing"
   * sentence finds the rule instead of suspecting the marks.
   */
  it("keeps dropping the short non-clinical opener it dropped before the split", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the plan in the notes.";
    expect(primaryAnswerDisplayFragments(answer).map((fragment) => fragment.display)).toEqual([
      "Review the observations hourly overnight.",
      "Document the plan in the notes.",
    ]);
  });

  for (const [label, answer, options] of cases) {
    it(`joins back to the displayed text for ${label}`, () => {
      const joined = primaryAnswerDisplayFragments(answer, options)
        .map((fragment) => fragment.display)
        .join(" ");
      expect(joined).toBe(primaryAnswerDisplayText(answer, options));
    });
  }

  it("keeps the pre-rewrite sentence so a claim can still be matched against it", () => {
    const [fragment] = primaryAnswerDisplayFragments("Check the level weekly and record the result in the notes.");
    expect(fragment.raw).toContain("Check the level weekly");
    expect(fragment.truncated).toBe(false);
  });

  it("flags a sentence the word budget cut short", () => {
    const long = `${Array.from({ length: 120 }, (_, index) => `detail${index + 1}`).join(" ")}.`;
    expect(primaryAnswerDisplayFragments(long).some((fragment) => fragment.truncated)).toBe(true);
  });
});

describe("splitTrailingWord", () => {
  it("splits the last word so it can be wrapped with the mark cluster", () => {
    expect(splitTrailingWord("Check the level weekly")).toEqual({ head: "Check the level", tail: "weekly" });
  });

  it("refuses to split inside a bold run", () => {
    // Production prose carries server bold, and cutting between the markers
    // would hand SafeBoldText two halves of one run.
    expect(splitTrailingWord("Check the level **weekly and now**")).toBeNull();
  });

  it("returns null for a single word", () => {
    expect(splitTrailingWord("Withhold")).toBeNull();
  });
});
