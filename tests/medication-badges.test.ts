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
