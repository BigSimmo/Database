import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `medicationSearchText` is memoised on the record object (see the comment above
 * `searchTextByRecord` in `src/lib/medications.ts`). A memo that returns the right string is
 * invisible from the outside — JavaScript string equality cannot tell a cached value from a
 * freshly computed one — so the only way to prove the work is skipped is to count calls into the
 * shared normalizer the function delegates to.
 *
 * The wrapped module is scoped to this file precisely so no other suite ranks against a spied
 * `catalog-search`.
 */
vi.mock("@/lib/catalog-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog-search")>();
  return { ...actual, normalizeSearchText: vi.fn(actual.normalizeSearchText) };
});

import { normalizeSearchText } from "@/lib/catalog-search";
import { medicationSearchText, rankMedicationRecords, type MedicationRecord } from "@/lib/medications";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";

const normalizeCalls = vi.mocked(normalizeSearchText);

function buildRecord(overrides: Partial<MedicationRecord> = {}): MedicationRecord {
  return {
    slug: "sertraline",
    name: "Sertraline",
    class: "Antidepressant",
    subclass: "SSRI",
    category: "Mood",
    accent: "#0f766e",
    tag: "First line",
    schedule: "S4",
    stats: [{ label: "Usual dose", value: "50-200 mg daily" }],
    sections: [
      {
        title: "Formulation & Access",
        type: "form",
        rows: [{ key: "Brand Names", val: "Zoloft, Setrona", tags: ["pbs"] }],
      },
    ],
    quick: [{ label: "Onset", value: "2-4 weeks" }],
    ...overrides,
  };
}

beforeEach(() => {
  normalizeCalls.mockClear();
});

describe("medicationSearchText memoisation", () => {
  it("normalizes a given record object exactly once, however often it is ranked", () => {
    const record = buildRecord();

    const first = medicationSearchText(record);
    const second = medicationSearchText(record);
    const third = medicationSearchText(record);

    expect(normalizeCalls).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
    // Still the real haystack, not an empty cache hit: every lane of the record is in it.
    expect(first).toContain("sertraline");
    expect(first).toContain("zoloft");
    expect(first).toContain("formulation");
    expect(first).toContain("2-4 weeks");
  });

  it("gives two distinct but equal records their own correct result", () => {
    const left = buildRecord();
    const right = buildRecord();

    const leftText = medicationSearchText(left);
    const rightText = medicationSearchText(right);

    // Keyed on object identity, so equal-but-distinct records are two separate computations.
    // Neither is allowed to be served the other's entry, and both must be correct.
    expect(left).not.toBe(right);
    expect(normalizeCalls).toHaveBeenCalledTimes(2);
    expect(rightText).toEqual(leftText);
    expect(leftText).toContain("sertraline");
    expect(rightText).toContain("sertraline");
  });

  it("does not let one record's haystack answer for a different record", () => {
    const sertraline = buildRecord();
    const fluoxetine = buildRecord({ slug: "fluoxetine", name: "Fluoxetine" });

    const sertralineText = medicationSearchText(sertraline);
    const fluoxetineText = medicationSearchText(fluoxetine);

    expect(sertralineText).toContain("sertraline");
    expect(sertralineText).not.toContain("fluoxetine");
    expect(fluoxetineText).toContain("fluoxetine");
    expect(fluoxetineText).not.toContain("sertraline");
  });

  it("returns identical rankings on a warm cache as on a cold one", () => {
    // The memo must be invisible to scoring. Ranking the real catalogue twice is the end-to-end
    // form of that claim: the second pass reads every haystack from the WeakMap.
    const records = loadMedicationSnapshot();

    const cold = rankMedicationRecords(records, "ssri nausea", 20);
    const warm = rankMedicationRecords(records, "ssri nausea", 20);

    expect(cold.length).toBeGreaterThan(0);
    expect(warm.map((match) => [match.medication.slug, match.score, match.reasons])).toEqual(
      cold.map((match) => [match.medication.slug, match.score, match.reasons]),
    );
  });
});
