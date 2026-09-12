import { calculators, type CalculatorFixture } from "./calculator-fixtures";

export const CALCULATOR_RECORD_PARAM = "calculator" as const;

export function calculatorRecordById(value: string | null | undefined): CalculatorFixture | null {
  if (!value || value !== value.trim() || !/^[a-z0-9-]+$/.test(value)) return null;
  return calculators.find((calculator) => calculator.id === value) ?? null;
}

export function calculatorRecordHref(calculatorId: string): string {
  const calculator = calculatorRecordById(calculatorId);
  if (!calculator) throw new Error(`Unknown calculator record: ${calculatorId}`);
  return `/calculators/search?${CALCULATOR_RECORD_PARAM}=${encodeURIComponent(calculator.id)}`;
}

export function calculatorSearchHref(query: string): string {
  const normalized = query.trim();
  return normalized ? `/calculators/search?q=${encodeURIComponent(normalized)}&run=1` : "/?mode=calculators";
}
