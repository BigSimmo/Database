/** The non-breaking space the v5.2 detail pass puts between every number and its unit. */
export const NBSP = " ";

/** "14 h", "68 of 86", "40 min": the one way Teaching writes a number with its unit. */
export function withUnit(value: string | number, unit: string): string {
  return `${value}${NBSP}${unit}`;
}
