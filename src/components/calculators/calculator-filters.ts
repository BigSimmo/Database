import { domainLabels, type CalculatorDomain, type CalculatorFixture } from "./calculator-fixtures";
import type { DerivedCalculator } from "./calculator-ui";

export type CalculatorProgressFilter = "all" | "not-started" | "in-progress" | "completed";
export type CalculatorTimeFilter = "all" | "quick" | "standard" | "extended";

export type CalculatorFilterState = {
  domains: ReadonlySet<CalculatorDomain>;
  progress: CalculatorProgressFilter;
  time: CalculatorTimeFilter;
};

export type CalculatorFilterRecord = {
  calc: CalculatorFixture;
  derived: DerivedCalculator;
};

export function normalizeCalculatorQuery(query: string) {
  return query.trim().toLowerCase();
}

export function calculatorMatchesQuery(calc: CalculatorFixture, query: string) {
  const normalized = normalizeCalculatorQuery(query);
  if (!normalized) return true;
  const haystack = [calc.abbrev, calc.name, calc.indication, calc.summary, domainLabels[calc.domain]]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized) || calc.items.some((item) => item.text.toLowerCase().includes(normalized));
}

export function calculatorMatchesProgress(derived: DerivedCalculator, progress: CalculatorProgressFilter) {
  if (progress === "all") return true;
  if (progress === "not-started") return !derived.started;
  if (progress === "completed") return derived.complete;
  return derived.started && !derived.complete;
}

export function calculatorMatchesTime(calc: CalculatorFixture, time: CalculatorTimeFilter) {
  if (time === "all") return true;
  if (time === "quick") return calc.timeEstimateMinutes.max <= 2;
  if (time === "standard") return calc.timeEstimateMinutes.max >= 3 && calc.timeEstimateMinutes.max <= 4;
  return calc.timeEstimateMinutes.max >= 5;
}

export function calculatorMatchesFilters(
  record: CalculatorFilterRecord,
  query: string,
  filters: CalculatorFilterState,
) {
  return (
    calculatorMatchesQuery(record.calc, query) &&
    (filters.domains.size === 0 || filters.domains.has(record.calc.domain)) &&
    calculatorMatchesProgress(record.derived, filters.progress) &&
    calculatorMatchesTime(record.calc, filters.time)
  );
}

export function filterCalculatorRecords(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
) {
  return records.filter((record) => calculatorMatchesFilters(record, query, filters));
}

export function calculatorDomainCandidateCount(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  candidate: CalculatorDomain,
) {
  const domains = new Set(filters.domains);
  if (domains.has(candidate)) domains.delete(candidate);
  else domains.add(candidate);
  return filterCalculatorRecords(records, query, { ...filters, domains }).length;
}

export function calculatorProgressCandidateCount(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  candidate: CalculatorProgressFilter,
) {
  return filterCalculatorRecords(records, query, { ...filters, progress: candidate }).length;
}

export function calculatorTimeCandidateCount(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  candidate: CalculatorTimeFilter,
) {
  return filterCalculatorRecords(records, query, { ...filters, time: candidate }).length;
}
