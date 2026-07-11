import { describe, expect, it } from "vitest";

import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import {
  firstClinicalSentence,
  medicationActionDetail,
  medicationToSearchResult,
  rankMedicationRecords,
  type MedicationRecord,
} from "@/lib/medications";

function buildRecord(overrides: Partial<MedicationRecord>): MedicationRecord {
  return {
    slug: "test-med",
    name: "Test Med",
    class: "",
    subclass: "",
    category: "",
    accent: "#0f766e",
    tag: "",
    schedule: "",
    stats: [],
    sections: [],
    quick: [],
    ...overrides,
  };
}

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

  it("does not treat mid-word substrings as name matches", () => {
    const records = loadMedicationSnapshot();
    // "renal" hides inside "adrenaline"/"noradrenaline"; a name-level hit for
    // it would outrank genuinely relevant content matches.
    const matches = rankMedicationRecords(records, "renal dose", 10);
    const adrenaline = matches.find((match) => match.medication.slug.includes("adrenaline"));
    expect(adrenaline?.reasons ?? []).not.toContain("name");
  });

  it("boosts name-prefix matches above content-only matches", () => {
    const records = loadMedicationSnapshot();
    const matches = rankMedicationRecords(records, "sert", 10);
    expect(matches[0]?.medication.slug).toBe("sertraline");
    expect(matches[0]?.reasons).toContain("name prefix");
  });

  it("exposes prescribing summary fields for search results", () => {
    const record = getMedicationRecord("acamprosate");
    expect(record).toBeTruthy();
    expect(record?.stats.length).toBeGreaterThan(0);
    expect(record?.sections.some((section) => section.type === "dose")).toBe(true);
    expect(record?.quick.length).toBeGreaterThan(0);
  });
});

describe("medication action tone", () => {
  it("marks quick avoid guidance as danger", () => {
    const record = buildRecord({
      quick: [{ label: "Avoid if", value: "**Severe renal impairment.** Check creatinine first." }],
    });
    expect(medicationActionDetail(record)).toEqual({ text: "Severe renal impairment", tone: "danger" });
  });

  it("marks absolute contraindications as danger", () => {
    const record = buildRecord({
      sections: [
        {
          title: "Contraindications",
          type: "contra",
          rows: [{ key: "Absolute", val: "Known hypersensitivity. Do not rechallenge." }],
        },
      ],
    });
    expect(medicationActionDetail(record)).toEqual({ text: "Known hypersensitivity", tone: "danger" });
  });

  it("keeps summary clinical-focus text neutral even when monitoring rows exist", () => {
    const record = buildRecord({
      sections: [
        {
          title: "Summary",
          type: "summary",
          rows: [{ key: "Clinical focus", val: "Supports abstinence maintenance." }],
        },
        {
          title: "Monitoring",
          type: "mon",
          rows: [{ key: "Laboratory", val: "Check LFTs at baseline." }],
        },
      ],
    });
    expect(medicationActionDetail(record)).toEqual({ text: "Supports abstinence maintenance", tone: "neutral" });
  });

  it("marks laboratory monitoring guidance as warning", () => {
    const record = buildRecord({
      sections: [
        {
          title: "Monitoring",
          type: "mon",
          rows: [{ key: "Laboratory", val: "Check LFTs at baseline and 3 months." }],
        },
      ],
    });
    expect(medicationActionDetail(record)).toEqual({
      text: "Check LFTs at baseline and 3 months",
      tone: "warning",
    });
  });

  it("falls back to a neutral reference prompt", () => {
    expect(medicationActionDetail(buildRecord({}))).toEqual({
      text: "Review full prescribing reference",
      tone: "neutral",
    });
  });

  it("threads actionTone into search results", () => {
    const record = buildRecord({
      quick: [{ label: "Avoid if", value: "Severe renal impairment." }],
    });
    const result = medicationToSearchResult({ medication: record, score: 15, reasons: [] });
    expect(result.actionTone).toBe("danger");
    expect(result.action).toBe("Severe renal impairment");
  });

  it("flags acamprosate's renal contraindication as danger from the snapshot", () => {
    const record = getMedicationRecord("acamprosate");
    expect(record).toBeTruthy();
    expect(medicationActionDetail(record as MedicationRecord).tone).toBe("danger");
  });

  it("does not mark explicit no-contraindication text as danger", () => {
    const none = buildRecord({
      quick: [{ label: "Avoid if", value: "NONE — No absolute contraindications in respiratory depression." }],
    });
    expect(medicationActionDetail(none).tone).toBe("neutral");

    const noAbsolute = buildRecord({
      quick: [{ label: "Avoid if", value: "No absolute contraindication in life-threatening anaphylaxis." }],
    });
    expect(medicationActionDetail(noAbsolute).tone).toBe("neutral");

    const noneWithCaution = buildRecord({
      quick: [{ label: "Avoid if", value: "None strictly absolute, but severe caution in respiratory failure." }],
    });
    expect(medicationActionDetail(noneWithCaution).tone).toBe("warning");
  });

  it("keeps naloxone's explicit NONE contraindication off the danger tone from the snapshot", () => {
    const record = getMedicationRecord("naloxone");
    expect(record).toBeTruthy();
    expect(medicationActionDetail(record as MedicationRecord).tone).not.toBe("danger");
  });

  it("downgrades caution-only avoid guidance to warning", () => {
    const pregnancyCategory = buildRecord({
      quick: [{ label: "Avoid if", value: "Pregnancy Category B2." }],
    });
    expect(medicationActionDetail(pregnancyCategory).tone).toBe("warning");

    const doseReview = buildRecord({
      quick: [
        { label: "Avoid if", value: "Liver disease requires pharmacist/doctor review and possible dose reduction." },
      ],
    });
    expect(medicationActionDetail(doseReview).tone).toBe("warning");
  });

  it("keeps condition-list and setting-based hard stops on danger", () => {
    const conditionList = buildRecord({
      quick: [{ label: "Avoid if", value: "Severe respiratory depression, paralytic ileus." }],
    });
    expect(medicationActionDetail(conditionList).tone).toBe("danger");

    const unmonitoredSetting = buildRecord({
      quick: [{ label: "Avoid if", value: "Unmonitored environments without airway equipment." }],
    });
    expect(medicationActionDetail(unmonitoredSetting).tone).toBe("danger");
  });

  it("keeps fexofenadine and loratadine caution rows off the danger tone from the snapshot", () => {
    for (const slug of ["fexofenadine", "loratadine"]) {
      const record = getMedicationRecord(slug);
      expect(record).toBeTruthy();
      expect(medicationActionDetail(record as MedicationRecord).tone).not.toBe("danger");
    }
  });

  it("does not cut action text at abbreviations or decimals", () => {
    expect(firstClinicalSentence("Any hepatic impairment (e.g. cirrhosis). Review LFTs.")).toBe(
      "Any hepatic impairment (e.g. cirrhosis)",
    );
    expect(firstClinicalSentence("Start 1.5 mg NOCTE. Titrate weekly.")).toBe("Start 1.5 mg NOCTE");
    expect(firstClinicalSentence("Rash, nausea, etc. may occur. Stop if severe.")).toBe("Rash, nausea, etc. may occur");
    expect(firstClinicalSentence("No trailing period")).toBe("No trailing period");
  });
});
