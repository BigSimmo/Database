import { normalizeSearchText } from "@/lib/catalog-search";
import { smartSearchContentTerms } from "@/lib/smart-search-intent";

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
  return normalizeSearchText(query);
}

export function calculatorMatchesQuery(calc: CalculatorFixture, query: string, expansions: readonly string[] = []) {
  return calculatorQueryScore(calc, query, expansions) > 0;
}

function calculatorQueryScore(calc: CalculatorFixture, query: string, expansions: readonly string[] = []) {
  const normalized = normalizeCalculatorQuery(query);
  if (!normalized) return 1;
  if (calculatorIdentityMatchesQuery(calc, normalized)) return 1_000;

  const primaryText = normalizeSearchText(
    [calc.abbrev, calc.name, calc.indication, calc.summary, domainLabels[calc.domain]].join(" "),
  );
  const itemText = normalizeSearchText(calc.items.map((item) => item.text).join(" "));
  const haystack = `${primaryText} ${itemText}`;
  if (haystack.includes(normalized)) return 500;

  const terms = Array.from(new Set([...expansions, ...smartSearchContentTerms("calculators", query)]))
    .map(normalizeSearchText)
    .filter(Boolean);
  return terms.reduce((score, term) => {
    const specificity = term.includes(" ") ? term.split(" ").length : 1;
    if (primaryText.includes(term)) return score + 10 * specificity;
    if (itemText.includes(term)) return score + 2 * specificity;
    return score;
  }, 0);
}

function calculatorIdentityMatchesQuery(calc: CalculatorFixture, normalizedQuery: string) {
  return [calc.id, calc.abbrev, calc.name]
    .map(normalizeSearchText)
    .filter(Boolean)
    .some((identity) => identityBoundaryPattern(identity).test(normalizedQuery));
}

function identityBoundaryPattern(identity: string) {
  const parts = identity.match(/[a-z]+|\d+/g);
  if (!parts?.length) return /(?!)/;
  const body = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[+./\\s-]*");
  return new RegExp(`(?:^|[^a-z0-9])${body}(?:$|[^a-z0-9])`);
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
  expansions: readonly string[] = [],
) {
  return (
    calculatorMatchesQuery(record.calc, query, expansions) &&
    (filters.domains.size === 0 || filters.domains.has(record.calc.domain)) &&
    calculatorMatchesProgress(record.derived, filters.progress) &&
    calculatorMatchesTime(record.calc, filters.time)
  );
}

export function filterCalculatorRecords(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  expansions: readonly string[] = [],
) {
  const matchingRecords = records.filter((record) => calculatorMatchesFilters(record, query, filters, expansions));
  const normalizedQuery = normalizeCalculatorQuery(query);
  if (!normalizedQuery) return matchingRecords;
  return matchingRecords.sort(
    (left, right) =>
      calculatorQueryScore(right.calc, query, expansions) - calculatorQueryScore(left.calc, query, expansions),
  );
}

export function calculatorDomainCandidateCount(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  candidate: CalculatorDomain,
  expansions: readonly string[] = [],
) {
  const domains = new Set(filters.domains);
  if (domains.has(candidate)) domains.delete(candidate);
  else domains.add(candidate);
  return filterCalculatorRecords(records, query, { ...filters, domains }, expansions).length;
}

export function calculatorProgressCandidateCount(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  candidate: CalculatorProgressFilter,
  expansions: readonly string[] = [],
) {
  return filterCalculatorRecords(records, query, { ...filters, progress: candidate }, expansions).length;
}

export function calculatorTimeCandidateCount(
  records: readonly CalculatorFilterRecord[],
  query: string,
  filters: CalculatorFilterState,
  candidate: CalculatorTimeFilter,
  expansions: readonly string[] = [],
) {
  return filterCalculatorRecords(records, query, { ...filters, time: candidate }, expansions).length;
}
