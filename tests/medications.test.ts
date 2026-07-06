import { describe, expect, it } from "vitest";

import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import { rankMedicationRecords } from "@/lib/medications";

describe("medications catalogue", () => {
  it("loads the full reviewed export snapshot", () => {
    const records = loadMedicationSnapshot();
    expect(records.length).toBe(328);
    expect(records.some((record) => record.slug === "acamprosate")).toBe(true);
    expect(records.some((record) => record.slug === "sertraline")).toBe(true);
  });

  it("ranks exact medication names ahead of broad matches", () => {
    const records = loadMedicationSnapshot();
    const matches = rankMedicationRecords(records, "acamprosate renal dose", 5);
    expect(matches[0]?.medication.slug).toBe("acamprosate");
    expect(matches[0]?.score).toBeGreaterThan(0);
  });

<<<<<<< HEAD
  it("does not treat mid-word substrings as name matches", () => {
    const records = loadMedicationSnapshot();
    // "renal" hides inside "adrenaline"/"noradrenaline"; a name-level hit for
    // it would outrank genuinely relevant content matches.
    const matches = rankMedicationRecords(records, "renal dose", 10);
    const adrenaline = matches.find((match) => match.medication.slug.includes("adrenaline"));
    expect(adrenaline?.reasons ?? []).not.toContain("name");
=======
  it("boosts name-prefix matches above content-only matches", () => {
    const records = loadMedicationSnapshot();
    const matches = rankMedicationRecords(records, "sert", 10);
    expect(matches[0]?.medication.slug).toBe("sertraline");
    expect(matches[0]?.reasons).toContain("name prefix");
>>>>>>> origin/main
  });

  it("exposes prescribing summary fields for search results", () => {
    const record = getMedicationRecord("acamprosate");
    expect(record).toBeTruthy();
    expect(record?.stats.length).toBeGreaterThan(0);
    expect(record?.sections.some((section) => section.type === "dose")).toBe(true);
    expect(record?.quick.length).toBeGreaterThan(0);
  });
});
