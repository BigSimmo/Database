export const medicationScopeValues = new Set(["best", "all"] as const);
export type MedicationScope = "best" | "all";

export const medicationMatchValues = new Set(["all", "exact", "good", "related"] as const);
export type MedicationMatchQuality = "all" | "exact" | "good" | "related";

export const medicationSignalValues = new Set(["safety", "monitoring"] as const);
export type MedicationClinicalSignal = "safety" | "monitoring";

export type MedicationFilterRow = {
  drugClass: string;
  result: {
    match: string;
    action: string;
    actionTone: "danger" | "warning" | "neutral";
    dose: string;
    ceiling: string;
  };
};

export type MedicationFilters = {
  match: MedicationMatchQuality;
  classes: ReadonlySet<string>;
  signals: ReadonlySet<MedicationClinicalSignal>;
};

export function medicationMatchQuality(match: string): Exclude<MedicationMatchQuality, "all"> | null {
  if (match === "Exact clinical fit") return "exact";
  if (match === "Good clinical fit") return "good";
  if (match === "Related match") return "related";
  return null;
}

export function medicationResultHasSignal(
  result: MedicationFilterRow["result"],
  signal: MedicationClinicalSignal,
): boolean {
  if (signal === "safety") {
    return result.actionTone !== "neutral" || /check|avoid|caution|ceiling|max/i.test(result.action);
  }
  return (
    result.actionTone === "warning" ||
    /monitor|level|review|renal|hepatic/i.test(`${result.action} ${result.dose} ${result.ceiling}`)
  );
}

/** OR within class/signal groups, AND across groups. */
export function medicationRowMatchesFilters(row: MedicationFilterRow, filters: MedicationFilters): boolean {
  if (filters.match !== "all" && medicationMatchQuality(row.result.match) !== filters.match) return false;
  if (filters.classes.size > 0 && !filters.classes.has(row.drugClass)) return false;
  if (
    filters.signals.size > 0 &&
    ![...filters.signals].some((signal) => medicationResultHasSignal(row.result, signal))
  ) {
    return false;
  }
  return true;
}
