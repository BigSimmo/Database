import { describe, expect, it } from "vitest";

import {
  medicationResultHasSignal,
  medicationRowMatchesFilters,
  type MedicationFilterRow,
} from "@/lib/medication-filters";

function row(
  drugClass: string,
  match: string,
  action: string,
  actionTone: "danger" | "warning" | "neutral" = "neutral",
): MedicationFilterRow {
  return {
    drugClass,
    result: { match, action, actionTone, dose: "10 mg", ceiling: "20 mg" },
  };
}

describe("medication filters", () => {
  it("uses OR within class and signal groups and AND across groups", () => {
    const antipsychoticSafety = row("Antipsychotic", "Exact clinical fit", "Avoid when ANC is low", "danger");
    const antidepressantMonitoring = row("Antidepressant", "Good clinical fit", "Monitor sodium", "warning");
    const moodStabiliser = row("Mood stabiliser", "Related match", "Open reference");
    const filters = {
      match: "all" as const,
      classes: new Set(["Antipsychotic", "Antidepressant"]),
      signals: new Set(["safety", "monitoring"] as const),
    };

    expect(medicationRowMatchesFilters(antipsychoticSafety, filters)).toBe(true);
    expect(medicationRowMatchesFilters(antidepressantMonitoring, filters)).toBe(true);
    expect(medicationRowMatchesFilters(moodStabiliser, filters)).toBe(false);
  });

  it("separates match quality without changing row order", () => {
    const rows = [
      row("A", "Exact clinical fit", "Open reference"),
      row("A", "Good clinical fit", "Open reference"),
      row("A", "Related match", "Open reference"),
    ];
    const visible = rows.filter((item) =>
      medicationRowMatchesFilters(item, { match: "good", classes: new Set(), signals: new Set() }),
    );

    expect(visible).toEqual([rows[1]]);
  });

  it("keeps safety and monitoring as overlapping clinical signals", () => {
    const warning = row("A", "Exact clinical fit", "Review renal function", "warning");
    expect(medicationResultHasSignal(warning.result, "safety")).toBe(true);
    expect(medicationResultHasSignal(warning.result, "monitoring")).toBe(true);
  });
});
