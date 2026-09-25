import { describe, expect, it } from "vitest";

import formsActSectionCues from "../data/forms-act-section-cues.json";
import formsCatalog from "../data/forms-catalog.json";
import curatedSections from "../data/mha-2014-sections.json";
import sourceSections from "../data/mha-2014-sections.source.json";
import { checkProblems, citedSections } from "../scripts/build-mha-act-sections.mjs";

/**
 * Act sections the "Act and Standards" page covers without any form citing them
 * (s 25 criteria, Tribunal review, advocate contact, support-person notification,
 * ECT approval, CTO criteria and duration). They live in `referenceTopics` in
 * data/forms-act-section-cues.json so the same fetch, extraction and --check gate
 * that covers form-cited sections covers them too.
 */
type Topic = { id: string; title: string; sections: string[]; basis: string };

const topics = (formsActSectionCues as { referenceTopics?: Topic[] }).referenceTopics ?? [];

describe("Act reference topics", () => {
  it("adds topic sections to the cited list, so --refresh fetches and --check gates them", () => {
    const cited = citedSections(
      { forms: [] },
      { forms: [], referenceTopics: [{ id: "t", title: "T", sections: ["25"], basis: "s 25 sets the criteria." }] },
    );
    expect(cited).toEqual(["25"]);
  });

  it("fails the gate for a topic section with no extraction or curated entry", () => {
    const problems = checkProblems({
      source: sourceSections,
      curated: curatedSections,
      catalog: formsCatalog,
      supplemental: {
        ...formsActSectionCues,
        referenceTopics: [{ id: "x", title: "X", sections: ["9999"], basis: "Invented." }],
      },
    });
    expect(problems).toContain("Form cue cites section 9999, which is absent from the Act extraction.");
    expect(problems).toContain("Form cue cites section 9999, which has no curated entry.");
  });

  it("requires every topic to state its sections, basis and a unique id", () => {
    const problems = checkProblems({
      source: sourceSections,
      curated: curatedSections,
      catalog: formsCatalog,
      supplemental: {
        ...formsActSectionCues,
        referenceTopics: [
          { id: "a", title: "A", sections: [], basis: "" },
          { id: "a", title: "", sections: ["26"], basis: "s 26 is referral." },
        ],
      },
    });
    expect(problems).toContain("Reference topic a lists no sections.");
    expect(problems).toContain("Reference topic a has no stated basis.");
    expect(problems).toContain("Reference topic a has no title.");
    expect(problems).toContain("Reference topic id a is used more than once.");
  });

  it("covers the six topics the page promises, each with a written, hash-pinned summary", () => {
    expect(topics.map((topic) => topic.id)).toEqual([
      "involuntary-treatment-criteria",
      "community-treatment-orders",
      "mental-health-tribunal-review",
      "mental-health-advocacy",
      "personal-support-persons",
      "ect-approval",
    ]);
    const curatedBySection = new Map(curatedSections.sections.map((entry) => [entry.section, entry]));
    for (const topic of topics) {
      for (const section of topic.sections) {
        const entry = curatedBySection.get(section);
        expect(entry, `s ${section} has no curated entry`).toBeTruthy();
        expect(entry?.status, `s ${section}`).toBe("drafted");
        expect(entry?.summary?.trim(), `s ${section}`).toBeTruthy();
        expect("reviewedBy" in (entry ?? {}), `s ${section} must not carry a sign-off`).toBe(false);
      }
    }
  });
});
