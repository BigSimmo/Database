import { describe, expect, it } from "vitest";

import { crossModeDifferentialCatalog } from "@/lib/cross-mode-differentials";
import { buildCrossModeLinks } from "@/lib/cross-mode-links";
import { extractKeywordTerms, keywordQueryFromNaturalLanguage } from "@/lib/keyword-query";
import { defaultMedicationRecords } from "@/lib/medication-fixtures";
import type { ServiceRecord } from "@/lib/services";

const medications = defaultMedicationRecords();
const differentials = crossModeDifferentialCatalog();

const homeTreatmentTeam: ServiceRecord = {
  slug: "adult-home-treatment-team",
  title: "Adult Home Treatment Team",
  subtitle: "Intensive home-based acute care",
  statusChips: [{ label: "Acute", tone: "info" }],
  tags: ["home treatment"],
};

// Matches "adult" and "treatment" via tags only — must stay below the
// title-reason gate no matter how many tag/content points it accumulates.
const tagOnlyService: ServiceRecord = {
  slug: "crisis-line",
  title: "Crisis Line",
  tags: ["adult", "treatment"],
};

describe("extractKeywordTerms", () => {
  it("normalizes, strips stop words, and dedupes", () => {
    expect(extractKeywordTerms("What is the max dose of clozapine?")).toEqual(["what", "max", "dose", "clozapine"]);
    expect(extractKeywordTerms("dose dose DOSE")).toEqual(["dose"]);
    expect(extractKeywordTerms("the of and to a is")).toEqual([]);
  });

  it("caps terms and keeps the legacy 7-term keyword query behavior", () => {
    const long = Array.from({ length: 15 }, (_, index) => `token${index}`).join(" ");
    expect(extractKeywordTerms(long)).toHaveLength(12);
    expect(keywordQueryFromNaturalLanguage(long).split(" ")).toHaveLength(7);
  });
});

describe("buildCrossModeLinks", () => {
  it("links a full question to the named medication", () => {
    const links = buildCrossModeLinks("what is the max dose of clozapine", { medications });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      modeId: "prescribing",
      slug: "clozapine",
      detailHref: "/medications/clozapine",
      modeSearchQuery: "Clozapine",
    });
    expect(links[0]!.modeLabel).toBe("Medication");
    expect(links[0]!.matchReason).toContain("name");
  });

  it("returns nothing for question filler that only content-matches records", () => {
    expect(buildCrossModeLinks("what is the maximum dose", { medications, differentials })).toEqual([]);
  });

  it("links services on title matches and rejects tag-only matches", () => {
    const links = buildCrossModeLinks("how do I refer to the adult home treatment team", {
      services: [homeTreatmentTeam, tagOnlyService],
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      modeId: "services",
      slug: "adult-home-treatment-team",
      detailHref: "/services/adult-home-treatment-team",
      subtitle: "Intensive home-based acute care",
    });
    expect(links[0]!.badges).toEqual([{ label: "Acute", tone: "info" }]);
    expect(links[0]!.modeSearchHref).toContain("/services?");
    expect(links[0]!.modeSearchHref).toContain("run=1");
  });

  it("links differentials via alias expansion", () => {
    const links = buildCrossModeLinks("how do I manage an acutely psychotic patient", { differentials });
    expect(links).toHaveLength(1);
    expect(links[0]!.modeId).toBe("differentials");
    expect(links[0]!.title.toLowerCase()).toMatch(/psychosis|psychotic/);
    expect(links[0]!.detailHref).toMatch(/^\/differentials\/(diagnoses|presentations)\//);
  });

  it("does not surface differentials for queries that only name a medication", () => {
    const links = buildCrossModeLinks("acamprosate renal dosing", { medications, differentials });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.modeId === "prescribing")).toBe(true);
  });

  it("caps per-mode and total results", () => {
    const sleepClinic = (slug: string, title: string): ServiceRecord => ({ slug, title });
    const services = [
      sleepClinic("sleep-clinic-north", "Sleep Clinic North"),
      sleepClinic("sleep-clinic-south", "Sleep Clinic South"),
      sleepClinic("sleep-clinic-east", "Sleep Clinic East"),
    ];
    const forms = [
      sleepClinic("sleep-referral-form", "Sleep Clinic Referral"),
      sleepClinic("sleep-review-form", "Sleep Clinic Review"),
      sleepClinic("sleep-audit-form", "Sleep Clinic Audit"),
    ];

    const links = buildCrossModeLinks("sleep clinic", { services, forms });
    expect(links).toHaveLength(4);
    expect(links.filter((link) => link.modeId === "services")).toHaveLength(2);
    expect(links.filter((link) => link.modeId === "forms")).toHaveLength(2);

    const capped = buildCrossModeLinks("sleep clinic", { services, forms }, { maxTotal: 3 });
    expect(capped).toHaveLength(3);
  });

  it("dedupes a slug shared between the services and forms registries", () => {
    const shared: ServiceRecord = { slug: "shared-pathway", title: "Shared Pathway" };
    const links = buildCrossModeLinks("shared pathway", { services: [shared], forms: [shared] });
    expect(links).toHaveLength(1);
    expect(links[0]!.modeId).toBe("services");
  });

  it("returns nothing for empty or stop-word-only queries and empty catalogs", () => {
    expect(buildCrossModeLinks("", { medications })).toEqual([]);
    expect(buildCrossModeLinks("the of and", { medications })).toEqual([]);
    expect(buildCrossModeLinks("clozapine dose", {})).toEqual([]);
  });
});
