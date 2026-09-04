import { describe, expect, it } from "vitest";

import { getMedicationRecord } from "@/lib/medication-snapshot";
import { recordToRow, rowGovernance, rowToMedicationRecord, type MedicationRecordRow } from "@/lib/medication-records";

function baseRow(overrides: Partial<MedicationRecordRow> = {}): MedicationRecordRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    last_reviewed_at: null,
    review_due_at: null,
    slug: "test-med",
    name: "Test Med",
    class: "Addiction",
    subclass: "GABA",
    category: "Addiction Medicine",
    accent: "#0f766e",
    tag: "AUD",
    schedule: "S4",
    stats: [],
    sections: [],
    quick: [],
    source_status: "unknown",
    validation_status: "unverified",
    ...overrides,
  };
}

const validStats = [
  { label: "Max Dose", value: "1998 mg/day", cls: "hi", flag: "hi" },
  { label: "Half-life", value: "13-28.4 h" },
];

const validSections = [
  {
    title: "Rapid Summary",
    type: "summary",
    rows: [{ key: "Overview", val: "Anti-craving agent.", tags: [] }],
  },
  {
    title: "Contraindications",
    type: "contra",
    rows: [
      {
        key: "Absolute",
        val: "Renal insufficiency.",
        tags: ["renal"],
        patient: {
          factors: ["renal"],
          action: "contraindication",
          severity: "danger",
          match: { scr: { gt: 120 } },
          note: "Source-backed from Campral Australian PI.",
        },
      },
    ],
  },
];

const validQuick = [
  { label: "Start", value: "666 mg TDS" },
  { label: "Monitor", value: "Renal function" },
];

describe("rowToMedicationRecord", () => {
  it("parses valid stats, sections, and quick JSONB including nested patient metadata", () => {
    const record = rowToMedicationRecord(
      baseRow({
        stats: validStats,
        sections: validSections,
        quick: validQuick,
      }),
    );

    expect(record.slug).toBe("test-med");
    expect(record.stats).toEqual(validStats);
    expect(record.sections).toEqual(validSections);
    expect(record.quick).toEqual(validQuick);
    expect(record.sections[1]?.rows[0]?.patient?.match).toEqual({ scr: { gt: 120 } });
  });

  it("keeps unknown keys on well-formed JSONB objects rather than stripping them", () => {
    const record = rowToMedicationRecord(
      baseRow({
        stats: [{ label: "Max Dose", value: "10 mg", extra: "forward-compat" }],
        sections: [{ title: "Dose", type: "dose", rows: [], extra: true }],
        quick: [{ label: "Start", value: "5 mg", extra: 1 }],
      }),
    );

    expect(record.stats[0]).toMatchObject({ label: "Max Dose", value: "10 mg", extra: "forward-compat" });
    expect(record.sections[0]).toMatchObject({ title: "Dose", type: "dose", extra: true });
    expect(record.quick[0]).toMatchObject({ label: "Start", value: "5 mg", extra: 1 });
  });

  it("defaults malformed stats, sections, and quick JSONB to empty arrays", () => {
    const malformedValues = [
      { not: "an-array" },
      "json-string",
      42,
      [{ label: 123, value: "10 mg" }],
      [{ title: "Dose" }],
      [{ label: "Start" }],
      [{ label: "Max Dose", value: "10 mg" }, "mixed"],
    ];

    for (const malformed of malformedValues) {
      const record = rowToMedicationRecord(
        baseRow({
          stats: malformed,
          sections: malformed,
          quick: malformed,
        }),
      );

      expect(record.stats, `stats for ${JSON.stringify(malformed)}`).toEqual([]);
      expect(record.sections, `sections for ${JSON.stringify(malformed)}`).toEqual([]);
      expect(record.quick, `quick for ${JSON.stringify(malformed)}`).toEqual([]);
    }
  });

  it("defaults null JSONB columns to empty arrays", () => {
    const record = rowToMedicationRecord(
      baseRow({
        stats: null,
        sections: null,
        quick: null,
      }),
    );

    expect(record.stats).toEqual([]);
    expect(record.sections).toEqual([]);
    expect(record.quick).toEqual([]);
  });

  it("parses a snapshot medication row without dropping clinical JSONB", () => {
    const snapshot = getMedicationRecord("acamprosate");
    if (!snapshot) throw new Error("acamprosate fixture missing");

    const insert = recordToRow(snapshot, "22222222-2222-4222-8222-222222222222");
    const record = rowToMedicationRecord(
      baseRow({
        slug: insert.slug,
        name: insert.name,
        class: insert.class ?? null,
        subclass: insert.subclass ?? null,
        category: insert.category ?? null,
        accent: insert.accent ?? null,
        tag: insert.tag ?? null,
        schedule: insert.schedule ?? null,
        stats: insert.stats,
        sections: insert.sections,
        quick: insert.quick,
      }),
    );

    expect(record.stats.length).toBeGreaterThan(0);
    expect(record.sections.some((section) => section.type === "dose")).toBe(true);
    expect(record.quick.length).toBeGreaterThan(0);
    expect(record.stats).toEqual(snapshot.stats);
    expect(record.sections).toEqual(snapshot.sections);
    expect(record.quick).toEqual(snapshot.quick);
  });
});

describe("rowGovernance", () => {
  const datedSections = [
    {
      title: "Sources",
      type: "src",
      rows: [{ key: "Source Review", val: "TGA PI checked 2026-05-14" }],
    },
  ];

  it("ages the stored status from the row's own sections instead of trusting the column", () => {
    // `source_status` is written once, by `recordToRow` at insert time, and never
    // ages. Before this, a row inserted as `current` claimed `current` forever in
    // production while demo mode — which re-derives per request — aged correctly.
    const row = baseRow({ sections: datedSections, source_status: "current" });
    const governance = rowGovernance(row, new Date("2028-01-01T00:00:00.000Z"));

    expect(governance.sourceStatus).toBe("review_due");
    expect(governance.sourceCheckedAt).toBe("2026-05-14");
  });

  it("still reports current while the stored sections are inside the review interval", () => {
    const row = baseRow({ sections: datedSections, source_status: "unknown" });
    const governance = rowGovernance(row, new Date("2026-09-02T00:00:00.000Z"));

    expect(governance.sourceStatus).toBe("current");
    expect(governance.sourceCheckedAt).toBe("2026-05-14");
  });

  it("reports unknown for a row with no source section even when the column says current", () => {
    const row = baseRow({ sections: [], source_status: "current" });
    const governance = rowGovernance(row, new Date("2026-09-02T00:00:00.000Z"));

    expect(governance.sourceStatus).toBe("unknown");
    expect(governance.sourceCheckedAt).toBeNull();
  });

  it("reports unknown for malformed sections JSONB rather than falling back to the column", () => {
    const row = baseRow({ sections: { not: "an array" } as never, source_status: "current" });
    const governance = rowGovernance(row, new Date("2026-09-02T00:00:00.000Z"));

    expect(governance.sourceStatus).toBe("unknown");
  });

  it("never downgrades a stored superseded status by re-deriving from age", () => {
    // `outdated` asserts a recorded clinical judgement that guidance was superseded.
    // Age can neither establish nor refute it, so re-derivation must not erase it.
    const row = baseRow({ sections: datedSections, source_status: "outdated" });
    const governance = rowGovernance(row, new Date("2026-09-02T00:00:00.000Z"));

    expect(governance.sourceStatus).toBe("outdated");
  });

  it("passes validation status and review timestamps through unchanged", () => {
    const row = baseRow({
      sections: datedSections,
      validation_status: "approved",
      last_reviewed_at: "2026-05-14T00:00:00.000Z",
      review_due_at: "2027-05-14T00:00:00.000Z",
    });
    const governance = rowGovernance(row, new Date("2026-09-02T00:00:00.000Z"));

    expect(governance.validationStatus).toBe("approved");
    expect(governance.lastReviewedAt).toBe("2026-05-14T00:00:00.000Z");
    expect(governance.reviewDueAt).toBe("2027-05-14T00:00:00.000Z");
  });
});
