import { describe, expect, it } from "vitest";

import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import {
  medicationAccessBadges,
  medicationIdentityBadges,
  medicationRowBadges,
  medicationStatTone,
} from "@/lib/medication-badges";
import { deriveGovernanceFromSections, evaluateSourceStatus, parseSourceDate } from "@/lib/medication-records";
import type { MedicationRecord } from "@/lib/medications";

describe("medication badge mappers", () => {
  const acamprosate = getMedicationRecord("acamprosate");
  if (!acamprosate) throw new Error("acamprosate fixture missing");

  it("maps acamprosate identity badges from snapshot fields", () => {
    const governance = deriveGovernanceFromSections(acamprosate);
    const badges = medicationIdentityBadges(acamprosate, {
      sourceStatus: governance.source_status,
      validationStatus: governance.validation_status,
    });
    const labels = badges.map((badge) => badge.label);

    expect(labels).toContain("AUD");
    expect(labels).toContain("S4");
    expect(labels).toContain("Campral");
    expect(labels).toContain("333 mg EC tablet");
    expect(labels).toContain("PBS streamlined");
    expect(labels).toContain("PBS");
    expect(labels).toContain("TGA");
    expect(badges.some((badge) => badge.label === "8357W")).toBe(true);

    // Snapshot governance is derived from the record's own Sources rows, which record when a
    // source was last checked but nothing about clinical review. A derived record therefore
    // shows no "Reviewed" badge: that badge is a validation claim, and `deriveTrust` treats
    // `locally_reviewed` as clearing the authority gate for high-risk clinical claims.
    // Promotion comes from the source-review flow, which records an actual reviewer.
    expect(governance.validation_status).toBe("unverified");
    expect(labels).not.toContain("Reviewed");
  });

  it("shows the reviewed badge only once a validation status has actually been recorded", () => {
    const badges = medicationIdentityBadges(acamprosate, {
      sourceStatus: "current",
      validationStatus: "locally_reviewed",
    });
    expect(badges.map((badge) => badge.label)).toContain("Reviewed");
  });

  it("maps contra absolute row badges from patient metadata", () => {
    const contraSection = acamprosate.sections.find((section) => section.type === "contra");
    const absoluteRow = contraSection?.rows.find((row) => row.key === "Absolute");
    expect(absoluteRow).toBeTruthy();

    const badges = medicationRowBadges(absoluteRow!, "contra");
    expect(badges.some((badge) => badge.label === "Cr >120 avoid" || badge.label === "Renal")).toBe(true);
    expect(badges.every((badge) => badge.tone === "danger" || badge.tone === "warning")).toBe(true);
  });

  it("maps dose renal impairment row badges", () => {
    const doseSection = acamprosate.sections.find((section) => section.type === "dose");
    const renalRow = doseSection?.rows.find((row) => row.key === "Renal Impairment");
    expect(renalRow).toBeTruthy();

    const badges = medicationRowBadges(renalRow!, "dose");
    expect(badges.some((badge) => badge.label === "Renal adjustment" || badge.label === "Contraindicated")).toBe(true);
  });

  it("maps risk gastrointestinal severity badge", () => {
    const riskSection = acamprosate.sections.find((section) => section.type === "risk");
    const giRow = riskSection?.rows.find((row) => row.key === "Gastrointestinal");
    expect(giRow).toBeTruthy();

    const badges = medicationRowBadges(giRow!, "risk");
    expect(badges.some((badge) => badge.label === "High")).toBe(true);
    expect(badges.find((badge) => badge.label === "High")?.tone).toBe("warning");
  });

  it("maps access badges for acamprosate", () => {
    const badges = medicationAccessBadges(acamprosate);
    expect(badges.some((badge) => badge.label === "Campral")).toBe(true);
    expect(badges.some((badge) => badge.label.includes("8357W"))).toBe(true);
    expect(badges.some((badge) => badge.label === "PBS streamlined")).toBe(true);
  });

  it("maps stat cls and flag to tones", () => {
    const maxDose = acamprosate.stats.find((stat) => stat.label.includes("Max Dose"));
    const renalAdj = acamprosate.stats.find((stat) => stat.label.includes("Renal"));
    expect(maxDose).toBeTruthy();
    expect(renalAdj).toBeTruthy();
    expect(medicationStatTone(maxDose!)).toBe("danger");
    expect(medicationStatTone(renalAdj!)).toBe("warning");
  });

  it("keeps badge lists stable across the full snapshot corpus", () => {
    const records = loadMedicationSnapshot();

    for (const record of records) {
      const governance = deriveGovernanceFromSections(record);
      const identityBadges = medicationIdentityBadges(record, {
        sourceStatus: governance.source_status,
        validationStatus: governance.validation_status,
      });

      expect(identityBadges.length).toBeLessThanOrEqual(12);
      expect(new Set(identityBadges.map((badge) => badge.id)).size).toBe(identityBadges.length);

      for (const section of record.sections) {
        for (const row of section.rows) {
          const rowBadges = medicationRowBadges(row, section.type);
          expect(rowBadges.length).toBeLessThanOrEqual(4);
          expect(new Set(rowBadges.map((badge) => badge.id)).size).toBe(rowBadges.length);
        }
      }
    }
  });
});

describe("medications catalogue regression", () => {
  it("exposes PBS streamlined on acamprosate identity badges", () => {
    const record = getMedicationRecord("acamprosate");
    expect(record).toBeTruthy();
    const badges = medicationIdentityBadges(record!);
    expect(badges.some((badge) => badge.label === "PBS streamlined")).toBe(true);
  });

  it("verifies Ramipril cardiovascular profile, pregnancy contraindication, and triple whammy interaction", () => {
    const record = getMedicationRecord("ramipril");
    expect(record).toBeTruthy();
    expect(record?.class).toBe("Antihypertensive");
    expect(record?.subclass).toBe("ACE Inhibitor");
    expect(record?.schedule).toBe("S4");
    expect(record?.tag).toBe("ACEi");

    const badges = medicationIdentityBadges(record!);
    expect(badges.some((b) => b.label === "ACEi")).toBe(true);
    expect(badges.some((b) => b.label === "S4")).toBe(true);

    const contraSection = record?.sections.find((s) => s.type === "contra");
    expect(contraSection).toBeTruthy();
    const pregRow = contraSection?.rows.find((r) => r.key === "Pregnancy");
    expect(pregRow?.patient?.factors).toContain("pregnancy");
    expect(pregRow?.patient?.severity).toBe("danger");
    expect(pregRow?.patient?.action).toBe("contraindication");

    const interSection = record?.sections.find((s) => s.type === "inter");
    expect(interSection).toBeTruthy();
    const tripleWhammy = interSection?.rows.find((r) => r.key === "Triple Whammy");
    expect(tripleWhammy?.val).toMatch(/^CRITICAL/);
    expect(tripleWhammy?.val).toContain("NSAID");
  });

  it("verifies Simvastatin lipid-lowering profile, evening administration, and CYP3A4 interaction", () => {
    const record = getMedicationRecord("simvastatin");
    expect(record).toBeTruthy();
    expect(record?.class).toBe("Lipid-Lowering");
    expect(record?.subclass).toBe("HMG-CoA Reductase Inhibitor");
    expect(record?.schedule).toBe("S4");
    expect(record?.tag).toBe("STATIN");

    const badges = medicationIdentityBadges(record!);
    expect(badges.some((b) => b.label === "STATIN")).toBe(true);
    expect(badges.some((b) => b.label === "S4")).toBe(true);

    const contraSection = record?.sections.find((s) => s.type === "contra");
    expect(contraSection).toBeTruthy();
    const hepaticRow = contraSection?.rows.find((r) => r.key === "Absolute");
    expect(hepaticRow?.patient?.factors).toContain("hepatic");
    expect(hepaticRow?.patient?.severity).toBe("danger");

    const interSection = record?.sections.find((s) => s.type === "inter");
    expect(interSection).toBeTruthy();
    const cyp3a4Row = interSection?.rows.find((r) => r.val.includes("CYP3A4"));
    expect(cyp3a4Row?.val).toMatch(/^CRITICAL/);
    expect(cyp3a4Row?.val).toContain("Clarithromycin");
  });
});

describe("controlled-drug (S8) schedule badge", () => {
  const baseRecord: MedicationRecord = {
    slug: "test-schedule",
    name: "Test Schedule",
    class: "",
    subclass: "",
    category: "",
    accent: "#0f766e",
    tag: "",
    schedule: "S8",
    stats: [],
    sections: [],
    quick: [],
  };

  it("shows S8 as a controlled warning with a lock icon, never danger", () => {
    const badges = medicationIdentityBadges(baseRecord);
    const scheduleBadge = badges.find((badge) => badge.label === "S8");
    expect(scheduleBadge).toBeTruthy();
    expect(scheduleBadge?.tone).toBe("warning");
    expect(scheduleBadge?.iconKey).toBe("controlled");
    // Regulatory scheduling must not consume the danger tone reserved for stops.
    expect(badges.every((badge) => badge.tone !== "danger")).toBe(true);
  });

  it("keeps non-S8 schedules as plain info metadata", () => {
    const badges = medicationIdentityBadges({ ...baseRecord, schedule: "S4" });
    const scheduleBadge = badges.find((badge) => badge.label === "S4");
    expect(scheduleBadge?.tone).toBe("info");
    expect(scheduleBadge?.iconKey).toBeUndefined();
  });
});

describe("formulation strength badge", () => {
  // The hero identity badge is the glanceable strength on a medication record,
  // so a number here is one a clinician can act on. Three token shapes broke it:
  // a decimal strength read from its fractional digits ("0.5 mg" -> "5 mg"), a
  // per-volume concentration read as a unit strength ("5 mg/mL" -> "5 mg"), and
  // a combination product read as one of its parts ("2/0.5 mg" -> "5 mg").
  const baseRecord: MedicationRecord = {
    slug: "test-formulation",
    name: "Test Formulation",
    class: "",
    subclass: "",
    category: "",
    accent: "#0f766e",
    tag: "",
    schedule: "",
    stats: [],
    sections: [],
    quick: [],
  };

  function formulationBadge(routeFormulation: string) {
    const badges = medicationIdentityBadges({
      ...baseRecord,
      quick: [{ label: "Route / Formulation", value: routeFormulation }],
    });
    return badges.find((badge) => badge.id === "identity-formulation")?.label ?? null;
  }

  function accessFormulationBadge(oralRoutes: string) {
    const badges = medicationAccessBadges({
      ...baseRecord,
      sections: [{ title: "Formulation", type: "form", rows: [{ key: "Oral Routes", val: oralRoutes }] }],
    });
    return badges.find((badge) => badge.id === "access-formulation")?.label ?? null;
  }

  it("keeps the decimal point of a sub-milligram strength", () => {
    expect(formulationBadge("Tablets (0.5 mg, 1 mg). Take strictly after food.")).toBe("0.5 mg tablet");
  });

  it("keeps the decimal point of a fractional strength", () => {
    expect(formulationBadge("Tablets (7.5 mg, 15 mg).")).toBe("7.5 mg tablet");
  });

  it("skips a per-millilitre concentration and reads the unit strength that follows", () => {
    expect(formulationBadge("Oral liquid syrup (5 mg/mL). Tablets (10 mg).")).toBe("10 mg tablet");
  });

  it("shows no strength badge when the only number is a concentration", () => {
    expect(formulationBadge("Ampoules (80 mg/2 mL) for IV infusion.")).toBeNull();
    expect(formulationBadge("Oral viscous solution (20 mg/mL).")).toBeNull();
  });

  it("shows no strength badge for a combination product's paired strengths", () => {
    // Neither number in "2/0.5 mg" is the product's strength, so no badge is the
    // only honest answer; the full formulation text stays in the sections below.
    expect(formulationBadge("Sublingual/buccal films (2/0.5 mg and 8/2 mg supplied in Australia).")).toBeNull();
    expect(formulationBadge("Tablets (500/125 mg, 875/125 mg).")).toBeNull();
  });

  it("still reads a plain integer strength, enteric coating included", () => {
    expect(formulationBadge("Enteric-coated tablets (333 mg).")).toBe("333 mg EC tablet");
    expect(accessFormulationBadge("Enteric-coated tablets (333 mg).")).toBe("333 mg EC tablet");
  });

  it("applies the same rules to the access badge's Oral routes row", () => {
    expect(accessFormulationBadge("Tablets (0.5 mg, 1 mg).")).toBe("0.5 mg tablet");
    expect(accessFormulationBadge("Oral liquid drops (7.5 mg/mL). Oral powder sachets (bowel prep).")).toBeNull();
  });

  it("reproduces the committed records the misread strength was found on", () => {
    for (const [slug, expected] of [
      ["varenicline", "0.5 mg tablet"],
      ["meloxicam", "7.5 mg tablet"],
      ["methadone", "10 mg tablet"],
      ["nicotine-lozenge", "1.5 mg"],
      ["colchicine", "0.5 mg tablet"],
    ] as const) {
      const record = getMedicationRecord(slug);
      expect(record, `${slug} fixture missing`).toBeTruthy();
      const badge = medicationIdentityBadges(record!).find((item) => item.id === "identity-formulation");
      expect(badge?.label, slug).toBe(expected);
    }
  });

  it("never invents a strength the source text does not state, across the whole corpus", () => {
    for (const record of loadMedicationSnapshot()) {
      const sources = [
        record.quick.find((row) => row.label.toLowerCase().includes("route / formulation"))?.value ?? "",
        record.sections
          .find((section) => section.type === "form")
          ?.rows.find((row) => row.key.toLowerCase().includes("oral routes"))?.val ?? "",
      ].join(" ");

      const badges = [...medicationIdentityBadges(record), ...medicationAccessBadges(record)].filter(
        (badge) => badge.id === "identity-formulation" || badge.id === "access-formulation",
      );

      for (const badge of badges) {
        const strength = badge.label.match(/^(\d+(?:\.\d+)?)\s*mg\b/);
        if (!strength) continue;
        // The badged number must appear as a whole strength token in the source:
        // not as the tail of a longer number ("0.5 mg" badged as "5 mg"), and not
        // as a per-volume concentration ("5 mg/mL") or one half of a combination.
        const token = new RegExp(String.raw`(?<![\d./])${strength[1].replace(".", String.raw`\.`)}\s*mg\b(?!\s*/)`);
        expect(token.test(sources), `${record.slug}: badge "${badge.label}" is not a strength in "${sources}"`).toBe(
          true,
        );
      }
    }
  });
});

describe("medication governance date evaluation", () => {
  it("parses valid ISO dates and rejects negative phrases", () => {
    expect(parseSourceDate("checked 2026-06-30 for this entry")).toEqual(new Date("2026-06-30T00:00:00.000Z"));
    expect(parseSourceDate("not checked 2026-06-30")).toBeNull();
    expect(parseSourceDate("unchecked entry")).toBeNull();
    expect(parseSourceDate("no date in this string")).toBeNull();
  });

  it("rejects an impossible calendar date instead of letting Date roll it forward", () => {
    // 2026 is not a leap year, so `new Date("2026-02-29T00:00:00.000Z")` silently normalizes
    // to March 1 rather than throwing. parseSourceDate must reject this rather than reporting
    // a fabricated "checked" date one day off from what the source text actually said.
    expect(parseSourceDate("checked 2026-02-29 for this entry")).toBeNull();
  });

  it("evaluates governance status based on review interval", () => {
    const refDate = new Date("2026-08-26T00:00:00.000Z");
    const freshDate = new Date("2026-06-30T00:00:00.000Z");
    const expiredDate = new Date("2024-01-01T00:00:00.000Z");

    expect(evaluateSourceStatus(freshDate, refDate, 365)).toBe("current");
    expect(evaluateSourceStatus(expiredDate, refDate, 365)).toBe("review_due");
    expect(evaluateSourceStatus(null, refDate, 365)).toBe("unknown");
  });

  it("derives review_due when the source date is older than the review interval", () => {
    const refDate = new Date("2028-01-01T00:00:00.000Z");
    const record: MedicationRecord = {
      slug: "test-med",
      name: "Test Med",
      class: "",
      subclass: "",
      category: "",
      accent: "#0f766e",
      tag: "",
      schedule: "",
      stats: [],
      sections: [
        {
          title: "Sources",
          type: "src",
          rows: [{ key: "Source Review", val: "checked 2026-06-30" }],
        },
      ],
      quick: [],
    };
    const governance = deriveGovernanceFromSections(record, refDate);
    expect(governance.source_status).toBe("review_due");
  });
});
