import { formCatalogDetails, type FormAvailability, type FormSearchMatch } from "@/lib/form-ranker";
import { readResultFilterValues, writeResultFilterValues } from "@/lib/result-filter-url";

export type FormRiskFilter = "high" | "medium" | "low";

export type FormFilterSelection = {
  categories: ReadonlySet<string>;
  risks: ReadonlySet<FormRiskFilter>;
  availability: ReadonlySet<FormAvailability>;
};

export const formRiskFilterValues = ["high", "medium", "low"] as const;
export const formAvailabilityFilterValues = ["downloadable", "contact_ocp", "unavailable"] as const;

export const formRiskFilterLabels: Record<FormRiskFilter, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const formAvailabilityFilterLabels: Record<FormAvailability, string> = {
  downloadable: "Downloadable",
  contact_ocp: "Contact required",
  unavailable: "Unavailable",
};

export function formMatchCategory(match: FormSearchMatch): string {
  return formCatalogDetails(match.service)?.category?.trim() || "Other forms";
}

export function formMatchRisk(match: FormSearchMatch): FormRiskFilter | null {
  const level = formCatalogDetails(match.service)?.riskLevel;
  if (level && formRiskFilterValues.includes(level)) return level;
  for (const chip of match.service.statusChips ?? []) {
    const label = chip.label?.trim().toLowerCase();
    const matched = formRiskFilterValues.find((candidate) => label === `${candidate} risk`);
    if (matched) return matched;
  }
  return null;
}

export function formMatchAvailability(match: FormSearchMatch): FormAvailability {
  return formCatalogDetails(match.service)?.availability ?? "unavailable";
}

export function deriveFormCategories(matches: ReadonlyArray<FormSearchMatch>): string[] {
  return [...new Set(matches.map(formMatchCategory))].sort((left, right) => left.localeCompare(right));
}

export function formFilterSelectionFromParams(
  params: Pick<URLSearchParams, "get">,
  categories: ReadonlyArray<string>,
): FormFilterSelection {
  return {
    categories: new Set(readResultFilterValues(params, "category", new Set(categories))),
    risks: new Set(readResultFilterValues(params, "risk", new Set(formRiskFilterValues))),
    availability: new Set(readResultFilterValues(params, "availability", new Set(formAvailabilityFilterValues))),
  };
}

export function writeFormFilterSelection(params: URLSearchParams, selection: FormFilterSelection): void {
  const categories = [...selection.categories];
  writeResultFilterValues(params, "category", categories, new Set(categories));
  writeResultFilterValues(params, "risk", selection.risks, new Set(formRiskFilterValues));
  writeResultFilterValues(params, "availability", selection.availability, new Set(formAvailabilityFilterValues));
}

export function formFilterSelectionSize(selection: FormFilterSelection): number {
  return selection.categories.size + selection.risks.size + selection.availability.size;
}

export function filterFormMatches(
  matches: ReadonlyArray<FormSearchMatch>,
  selection: FormFilterSelection,
): FormSearchMatch[] {
  return matches.filter((match) => {
    if (selection.categories.size > 0 && !selection.categories.has(formMatchCategory(match))) return false;
    const risk = formMatchRisk(match);
    if (selection.risks.size > 0 && (!risk || !selection.risks.has(risk))) return false;
    if (selection.availability.size > 0 && !selection.availability.has(formMatchAvailability(match))) return false;
    return true;
  });
}

export function formFilterCandidateCount(
  matches: ReadonlyArray<FormSearchMatch>,
  selection: FormFilterSelection,
  dimension: keyof FormFilterSelection,
  value: string,
): number {
  const next = new Set(selection[dimension] as ReadonlySet<string>);
  if (!next.has(value)) next.add(value);
  return filterFormMatches(matches, { ...selection, [dimension]: next }).length;
}
