import { describe, expect, it } from "vitest";

import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import {
  medicationAccessBadges,
  medicationIdentityBadges,
  medicationRowBadges,
  medicationStatTone,
} from "@/lib/medication-badges";
import { deriveGovernanceFromSections } from "@/lib/medication-records";
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
    expect(labels).toContain("Reviewed");
    expect(badges.some((badge) => badge.label === "8357W")).toBe(true);
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
