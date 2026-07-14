import { describe, expect, it } from "vitest";

import { getMedicationRecord, loadMedicationSnapshot } from "@/lib/medication-snapshot";
import {
  firstClinicalSentence,
  medicationActionDetail,
  medicationHeroMetrics,
  medicationIndication,
  medicationToSearchResult,
  rankMedicationRecords,
  shortValue,
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
      expect(medicationActionDetail(record as MedicationRecord).tone).toBe("warning");
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

  it("does not cut at single-letter genus abbreviations (lone letter + lowercase species)", () => {
    expect(firstClinicalSentence("Atypical CAP, H. pylori eradication, severe MAC complex in HIV.")).toBe(
      "Atypical CAP, H. pylori eradication, severe MAC complex in HIV",
    );
    expect(firstClinicalSentence("E. coli UTI. Second line.")).toBe("E. coli UTI");
    expect(firstClinicalSentence("C. difficile colitis (severe). Oral only.")).toBe("C. difficile colitis (severe)");
  });

  it("still splits genuine single-letter sentence ends (lone letter + uppercase next word)", () => {
    expect(firstClinicalSentence("ABSOLUTE — Pregnancy Category D. Associated with malformations.")).toBe(
      "ABSOLUTE — Pregnancy Category D",
    );
    expect(firstClinicalSentence("Vitamin C. Essential antioxidant.")).toBe("Vitamin C");
    expect(firstClinicalSentence("Depot formulation of Penicillin G. Slowly leaches.")).toBe(
      "Depot formulation of Penicillin G",
    );
  });
});

describe("shortValue", () => {
  it("returns short text unchanged and strips markdown bold", () => {
    expect(shortValue("200 mg/day")).toBe("200 mg/day");
    expect(shortValue("**6 g/day**")).toBe("6 g/day");
    expect(shortValue("")).toBe("");
  });

  it("caps long text on a word boundary with a trailing ellipsis and no dangling punctuation", () => {
    const out = shortValue("PO 2 tablets (666 mg) three times daily with meals", 24);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(25); // cap + the ellipsis char
    expect(out).not.toMatch(/[\s,;:]…$/); // no space/punctuation immediately before the ellipsis
  });

  it("caps by length only — no sentence-splitting — so dotted abbreviations survive", () => {
    // Stat values are curated tokens ("L.O.T. DRUG", "b.d."), not prose; splitting
    // at an internal period would drop clinical label content.
    expect(shortValue("L.O.T. DRUG")).toBe("L.O.T. DRUG");
    expect(shortValue("Start 1.5 mg NOCTE. Titrate weekly.", 40)).toBe("Start 1.5 mg NOCTE. Titrate weekly.");
  });
});

describe("medicationHeroMetrics", () => {
  it("leads with Max Dose as the primary/clinical tile and keeps the other stats in order", () => {
    const record = buildRecord({
      stats: [
        { label: "Half-life", value: "26 h", cls: "", flag: "" },
        { label: "GI Upset", value: "COMMON", cls: "warn", flag: "" },
        { label: "Max Dose", value: "200 mg/day", cls: "hi", flag: "hi" },
        { label: "Post-MI Safe", value: "YES", cls: "good", flag: "" },
      ],
    });
    const metrics = medicationHeroMetrics(record);
    expect(metrics.map((metric) => metric.label)).toEqual(["Max Dose", "Half-life", "GI Upset", "Post-MI Safe"]);
    // Max Dose's flag:"hi" marks ceiling importance, not danger — keep red reserved.
    expect(metrics.map((metric) => metric.tone)).toEqual(["clinical", "neutral", "warning", "success"]);
  });

  it("caps to four metrics; keeps the ceiling full but shortens other over-long values", () => {
    const record = buildRecord({
      stats: [
        { label: "Max Dose", value: "Buvidal 160 mg/month; Sublocade 300 mg/month", cls: "hi", flag: "hi" },
        { label: "Note", value: "An unusually long caution token that should be capped", cls: "", flag: "" },
        { label: "Renal Adj.", value: "DOSE RED.", cls: "warn", flag: "warn" },
        { label: "Efficacy", value: "MODERATE", cls: "warn", flag: "" },
        { label: "Extra", value: "SHOULD NOT APPEAR", cls: "", flag: "" },
      ],
    });
    const metrics = medicationHeroMetrics(record);
    expect(metrics).toHaveLength(4);
    expect(metrics.some((metric) => metric.label === "Extra")).toBe(false);
    // The prescribing ceiling is never truncated — the full multi-variant value stays.
    expect(metrics.find((metric) => metric.label === "Max Dose")?.value).toBe(
      "Buvidal 160 mg/month; Sublocade 300 mg/month",
    );
    // ...but other over-long stat values are still capped.
    const note = metrics.find((metric) => metric.label === "Note");
    expect(note?.value.endsWith("…")).toBe(true);
    expect(note?.value.length ?? 0).toBeLessThanOrEqual(25);
  });

  it("marks genuine hi-risk stats as danger even though Max Dose is not", () => {
    const record = buildRecord({
      stats: [
        { label: "Max Dose", value: "3 g/day", cls: "hi", flag: "hi" },
        { label: "Lactic Acidosis", value: "CRITICAL", cls: "hi", flag: "warn" },
      ],
    });
    const metrics = medicationHeroMetrics(record);
    expect(metrics.find((metric) => metric.label === "Max Dose")?.tone).toBe("clinical");
    expect(metrics.find((metric) => metric.label === "Lactic Acidosis")?.tone).toBe("danger");
  });

  it("backfills from crisp derived tokens when a record has fewer than four stats", () => {
    const record = buildRecord({
      schedule: "S8",
      category: "Opioid",
      stats: [{ label: "Max Dose", value: "Titrated", cls: "hi", flag: "hi" }],
      quick: [{ label: "Usual dose", value: "PO 5 mg BD" }],
    });
    const metrics = medicationHeroMetrics(record);
    expect(metrics.map((metric) => metric.label)).toEqual(["Max Dose", "Usual dose", "Schedule", "Category"]);
    expect(metrics.find((metric) => metric.label === "Schedule")?.value).toBe("S8");
    expect(metrics.find((metric) => metric.label === "Usual dose")?.value).toBe("PO 5 mg BD");
  });

  it("promotes Max Dose first even when the curated array lists it later, from the snapshot", () => {
    const record = getMedicationRecord("metformin");
    expect(record).toBeTruthy();
    const metrics = medicationHeroMetrics(record as MedicationRecord);
    expect(metrics.length).toBeLessThanOrEqual(4);
    expect(metrics[0].label).toMatch(/max dose/i);
    expect(metrics[0].tone).toBe("clinical");
  });

  it("preserves dotted-abbreviation stat values from the snapshot (L.O.T. DRUG)", () => {
    const record = getMedicationRecord("lorazepam");
    expect(record).toBeTruthy();
    const hepaticSafe = medicationHeroMetrics(record as MedicationRecord).find(
      (metric) => metric.label === "Hepatic Safe",
    );
    expect(hepaticSafe?.value).toBe("L.O.T. DRUG");
  });

  it("preserves repeated stat labels from the snapshot (adrenaline has two Route metrics)", () => {
    // Duplicate labels mean the render must key tiles by index, not by label.
    const record = getMedicationRecord("adrenaline-epinephrine");
    expect(record).toBeTruthy();
    const labels = medicationHeroMetrics(record as MedicationRecord).map((metric) => metric.label);
    expect(labels.filter((label) => label === "Route")).toHaveLength(2);
  });

  it("keeps a multi-variant max-dose ceiling complete from the snapshot (not truncated)", () => {
    // The ceiling's full value is not repeated elsewhere on the page, so it must
    // not be clamped away — both depot brand ceilings must survive.
    const record = getMedicationRecord("buprenorphine-sl-depot");
    expect(record).toBeTruthy();
    const maxDose = medicationHeroMetrics(record as MedicationRecord).find((metric) => /max dose/i.test(metric.label));
    expect(maxDose?.value).toBe("Buvidal 160 mg/month; Sublocade 300 mg/month");
  });
});

describe("medicationIndication", () => {
  it("crisps the indication to a single clinical clause", () => {
    const record = buildRecord({
      sections: [
        {
          title: "Indication",
          type: "ind",
          rows: [{ key: "Primary", val: "Alcohol dependence maintenance. Adjunct to psychosocial support." }],
        },
      ],
    });
    expect(medicationIndication(record)).toBe("Alcohol dependence maintenance");
  });

  it("falls back to taxonomy when no indication content exists", () => {
    expect(medicationIndication(buildRecord({ subclass: "SSRI" }))).toBe("SSRI");
  });

  it("keeps genus abbreviations intact from the snapshot (does not truncate H. pylori)", () => {
    const record = getMedicationRecord("clarithromycin");
    expect(record).toBeTruthy();
    const indication = medicationIndication(record as MedicationRecord);
    expect(indication).toContain("H. pylori");
    expect(indication).not.toBe("Atypical CAP, H");
  });
});
