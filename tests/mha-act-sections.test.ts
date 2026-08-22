import { beforeEach, describe, expect, it, vi } from "vitest";

import formsActSectionCues from "../data/forms-act-section-cues.json";
import formsCatalog from "../data/forms-catalog.json";
import curatedSections from "../data/mha-2014-sections.json";
import sourceSections from "../data/mha-2014-sections.source.json";
import {
  checkProblems,
  citedSections,
  parseSectionCue as scriptParseSectionCue,
} from "../scripts/build-mha-act-sections.mjs";
import {
  actSectionsForCue,
  mhaActMetadata,
  mhaActSection,
  parseSectionCue,
  sectionCueForForm,
} from "@/lib/mha-act-sections";

describe("parseSectionCue", () => {
  it("reads every cue shape present in the forms catalogue", () => {
    expect(parseSectionCue("sections 66, 91")).toEqual(["66", "91"]);
    expect(parseSectionCue("sections 28")).toEqual(["28"]);
    // Form 4A's cue is ragged: no spaces after most commas, one space before the last.
    expect(parseSectionCue("sections 29,63,67,92,112,129,133,148, 154")).toEqual([
      "29",
      "63",
      "67",
      "92",
      "112",
      "129",
      "133",
      "148",
      "154",
    ]);
  });

  it("de-duplicates while preserving first-appearance order", () => {
    // Never sorted: cue order mirrors the approved form, and Form 1A's reviewed order
    // is pinned by tests/forms.test.ts.
    expect(parseSectionCue("sections 91, 66, 91")).toEqual(["91", "66"]);
  });

  it("treats an absent or non-numeric cue as no citation", () => {
    expect(parseSectionCue(undefined)).toEqual([]);
    expect(parseSectionCue(null)).toEqual([]);
    expect(parseSectionCue("sections")).toEqual([]);
  });

  it("matches the build script's parser, so the gate and runtime agree", () => {
    for (const form of formsCatalog.forms) {
      const cue = (form as { sourceFacts?: { sectionCue?: string } }).sourceFacts?.sectionCue;
      expect(parseSectionCue(cue)).toEqual(scriptParseSectionCue(cue));
    }
  });
});

describe("Act section coverage", () => {
  it("resolves every section cited by every archived form", () => {
    const cited = citedSections(formsCatalog);
    expect(cited.length).toBe(75);
    for (const section of cited) {
      const entry = mhaActSection(section);
      expect(entry, `section ${section} has no curated entry`).toBeTruthy();
      expect(entry?.title.trim()).not.toBe("");
    }
  });

  it("pins the Act version the summaries were written against", () => {
    expect(mhaActMetadata.actVersion).toBe(sourceSections.exportMetadata.actVersion);
    expect(mhaActMetadata.actAsAt).toBe(sourceSections.exportMetadata.actAsAt);
    expect(mhaActMetadata.sourceUrl).toContain("legislation.wa.gov.au");
  });

  it("keeps the curated and extracted files consistent", () => {
    // The same validation `npm run check:mha-act-sections` runs, so sign-off drift fails
    // the unit suite too rather than waiting for verify:cheap.
    expect(
      checkProblems({
        source: sourceSections,
        curated: curatedSections,
        catalog: formsCatalog,
        supplemental: formsActSectionCues,
      }),
    ).toEqual([]);
  });
});

describe("actSectionsForCue", () => {
  it("withholds drafted summaries from the clinical UI", () => {
    expect(actSectionsForCue("sections 66, 91")).toBeUndefined();
  });

  it("returns no sections for a form with no cue", () => {
    expect(actSectionsForCue(undefined)).toBeUndefined();
    expect(actSectionsForCue("")).toBeUndefined();
  });

  it("withholds supplemental mappings until their own review is signed off", () => {
    for (const entry of formsActSectionCues.forms) {
      expect(entry.status).toBe("drafted");
      expect(sectionCueForForm(entry.code, undefined), entry.code).toBeUndefined();
    }
  });
});

describe("actSectionsForCue against reviewed data", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const reviewedFixture = {
    exportMetadata: {
      actVersion: "02-b0-01",
      actAsAt: "2025-09-25",
      sourceUrl: "https://www.legislation.wa.gov.au/example",
    },
    sections: [
      { section: "66", title: "Transfer from general hospital", summary: "Summary of 66.", status: "reviewed" },
      { section: "91", title: "Transfer between authorised hospitals", summary: "Summary of 91.", status: "reviewed" },
      { section: "45", title: "Still being written", status: "pending" },
      { section: "46", title: "Awaiting review", summary: "Summary of 46.", status: "drafted" },
    ],
  };

  it("yields sections in cue order once every cited section has a summary", async () => {
    vi.doMock("../data/mha-2014-sections.json", () => ({ default: reviewedFixture }));
    const { actSectionsForCue: withFixture } = await import("@/lib/mha-act-sections");
    expect(withFixture("sections 91, 66")).toEqual([
      {
        section: "91",
        title: "Transfer between authorised hospitals",
        summary: "Summary of 91.",
        reviewStatus: "reviewed",
      },
      { section: "66", title: "Transfer from general hospital", summary: "Summary of 66.", reviewStatus: "reviewed" },
    ]);
  });

  it("withholds the whole list when one cited section has no summary yet", async () => {
    vi.doMock("../data/mha-2014-sections.json", () => ({ default: reviewedFixture }));
    const { actSectionsForCue: withFixture } = await import("@/lib/mha-act-sections");
    expect(withFixture("sections 66, 45")).toBeUndefined();
  });

  it("withholds the whole list when one cited summary is still drafted", async () => {
    vi.doMock("../data/mha-2014-sections.json", () => ({ default: reviewedFixture }));
    const { actSectionsForCue: withFixture } = await import("@/lib/mha-act-sections");
    expect(withFixture("sections 66, 46")).toBeUndefined();
  });

  it("throws for a cue naming a section with no curated entry", async () => {
    vi.doMock("../data/mha-2014-sections.json", () => ({ default: reviewedFixture }));
    const { actSectionsForCue: withFixture } = await import("@/lib/mha-act-sections");
    // A mis-cue is a data defect; it must never render as a chip with no title.
    expect(() => withFixture("sections 999")).toThrow(/999/);
  });
});
