import { describe, expect, it } from "vitest";
import {
  flowIndexedText,
  mergeContinuationBlocks,
  parseIndexedSourceText,
  type IndexedTextBlock,
} from "../src/lib/indexed-source-formatting";

describe("indexed source formatting", () => {
  it("turns raw PDF page extraction into headings, paragraphs, lists, and tables", () => {
    const blocks = parseIndexedSourceText(`
                                      Clozapine Prescribing, Administering and Monitoring

NB Clinical judgement and or emerging signs and symptoms will determine appropriate
intervals of monitoring outside the recommended parameters.

9. Polypharmacy
Additionally, consumers may be taking other medications which require monitoring including:
• Amisulpride, Risperidone, Olanzapine > 20mg, Paliperidone - prolactin
• Quetiapine - TSH

11. Therapy Interruption
The Clozapine monitoring protocol must be followed if a patient's blood test is missed.

 Time since last Clozapine    Clozapine dose            Blood test monitoring
 dose

 <48 hours                     Restart at normal dose of     No changes to monitoring
                              Clozapine

>= 48 hours - <=72 hours      Restart Clozapine at 12.5mg.  No changes to monitoring
                               Consideration for inpatient
                               admission.

 >=72 hours- <4 weeks          Restart Clozapine at 12.5mg   Patient on weekly monitoring:
                          and retitrate in IPU               Continue weekly blood tests
                                                               for at least 6 weeks

                                                                              Page 8 of 15
`);

    expect(blocks[0]).toMatchObject({
      type: "heading",
      level: "title",
      text: "Clozapine Prescribing, Administering and Monitoring",
    });
    expect(blocks).toContainEqual(expect.objectContaining({ type: "heading", text: "9. Polypharmacy" }));
    expect(blocks).toContainEqual(
      expect.objectContaining({
        type: "paragraph",
        text: "NB Clinical judgement and or emerging signs and symptoms will determine appropriate intervals of monitoring outside the recommended parameters.",
      }),
    );
    expect(blocks).toContainEqual(
      expect.objectContaining({
        type: "list",
        items: ["Amisulpride, Risperidone, Olanzapine > 20mg, Paliperidone - prolactin", "Quetiapine - TSH"],
      }),
    );

    const table = blocks.find((block) => block.type === "table");
    expect(table).toMatchObject({
      type: "table",
      rows: [
        ["Time since last Clozapine dose", "Clozapine dose", "Blood test monitoring"],
        ["<48 hours", "Restart at normal dose of Clozapine", "No changes to monitoring"],
        [
          ">= 48 hours - <=72 hours",
          "Restart Clozapine at 12.5mg. Consideration for inpatient admission.",
          "No changes to monitoring",
        ],
        [
          ">=72 hours- <4 weeks",
          "Restart Clozapine at 12.5mg and retitrate in IPU",
          "Patient on weekly monitoring: Continue weekly blood tests for at least 6 weeks",
        ],
      ],
    });
    expect(JSON.stringify(blocks)).not.toContain("Page 8 of 15");
  });

  it("re-joins soft-wrap continuations that extraction split with blank lines", () => {
    const blocks = parseIndexedSourceText(`
Lithium Therapy - Initiation and Continuation

• NSAIDs: (e.g. ibuprofen) can reduce lithium clearance and therefore

increase lithium levels and the risk of toxicity. Avoid the combination where possible.

• Serotonergic drugs: Lithium can contribute to serotonin toxicity, therefore

patients who are prescribed combinations of serotonergic drugs should be closely monitored

2.7. Dosage (as lithium carbonate)

Doses should be individualised depending on indication and patient risk

factors i.e. weight, comorbidities (e.g. renal impairment) and concomitant medications.
`);

    const list = blocks.find((block) => block.type === "list");
    expect(list).toMatchObject({
      type: "list",
      items: [
        "NSAIDs: (e.g. ibuprofen) can reduce lithium clearance and therefore increase lithium levels and the risk of toxicity. Avoid the combination where possible.",
        "Serotonergic drugs: Lithium can contribute to serotonin toxicity, therefore patients who are prescribed combinations of serotonergic drugs should be closely monitored",
      ],
    });

    // Multi-level numbered heading is recognised and blocks merging across it.
    expect(blocks).toContainEqual(
      expect.objectContaining({ type: "heading", level: "section", text: "2.7. Dosage (as lithium carbonate)" }),
    );
    expect(blocks).toContainEqual(
      expect.objectContaining({
        type: "paragraph",
        text: "Doses should be individualised depending on indication and patient risk factors i.e. weight, comorbidities (e.g. renal impairment) and concomitant medications.",
      }),
    );
  });

  it("merges unterminated paragraphs but never merges across headings or tables", () => {
    const heading: IndexedTextBlock = { type: "heading", id: "h", text: "1. Scope", level: "section" };
    const merged = mergeContinuationBlocks([
      { type: "paragraph", id: "a", text: "Monitoring must continue until" },
      { type: "paragraph", id: "b", text: "the level stabilises." },
      heading,
      { type: "paragraph", id: "c", text: "applies to all adult inpatients." },
    ]);
    expect(merged).toEqual([
      { type: "paragraph", id: "a", text: "Monitoring must continue until the level stabilises." },
      heading,
      { type: "paragraph", id: "c", text: "applies to all adult inpatients." },
    ]);
  });

  it("keeps genuinely separate sentences as separate paragraphs", () => {
    const merged = mergeContinuationBlocks([
      { type: "paragraph", id: "a", text: "Reduce doses in the elderly." },
      { type: "paragraph", id: "b", text: "Twice daily dosing should be spaced by 12 hours." },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("flowIndexedText", () => {
  it("flows hard-wrapped excerpt text into readable sentences", () => {
    const flowed = flowIndexedText(
      "NSAIDs: (e.g. ibuprofen) can reduce lithium clearance and therefore\nincrease lithium levels and the risk of toxicity. Avoid the combination where\npossible. Low dose aspirin is safe to use.",
    );
    expect(flowed).toBe(
      "NSAIDs: (e.g. ibuprofen) can reduce lithium clearance and therefore increase lithium levels and the risk of toxicity. Avoid the combination where possible. Low dose aspirin is safe to use.",
    );
  });

  it("keeps paragraph breaks but heals blank lines that split a sentence", () => {
    expect(flowIndexedText("First paragraph ends here.\n\nSecond paragraph starts here.")).toBe(
      "First paragraph ends here.\n\nSecond paragraph starts here.",
    );
    expect(flowIndexedText("can reduce lithium clearance and therefore\n\nincrease lithium levels.")).toBe(
      "can reduce lithium clearance and therefore increase lithium levels.",
    );
  });
});
