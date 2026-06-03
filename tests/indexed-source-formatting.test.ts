import { describe, expect, it } from "vitest";
import { parseIndexedSourceText } from "../src/lib/indexed-source-formatting";

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
        items: [
          "Amisulpride, Risperidone, Olanzapine > 20mg, Paliperidone - prolactin",
          "Quetiapine - TSH",
        ],
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
});
