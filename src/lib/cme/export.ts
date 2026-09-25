import { totalAllocatedHours } from "@/lib/cme/evaluate";
import { cmeCategories, type CmeEntry, type CmeRequirementSet } from "@/lib/cme/types";

export function activeCmeYearEntries(entries: readonly CmeEntry[], year: number): CmeEntry[] {
  return entries
    .filter((entry) => !entry.archivedAt && entry.date.startsWith(`${year}-`))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
/** Quote every field; spreadsheet commands stay literal even behind leading whitespace. */
export function cmeCsvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (typeof value === "string" && (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)))
    text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function formatCmeYearCsv(entries: readonly CmeEntry[], set: CmeRequirementSet): string {
  const rows: (string | number | null)[][] = [
    [
      "CPD year",
      "Activity date (Perth calendar)",
      "Activity",
      "Total hours",
      "Educational hours",
      "Reviewing hours",
      "Measuring hours",
      "Formal peer review hours (subset of reviewing)",
      "Domains",
      "Reflection",
      "Cost (AUD)",
      "Source document ID (not evidence)",
      "Source URL (not evidence)",
      "Copied to clipboard for CPD home",
      "Targets confirmed on",
      "Targets confirmed source",
    ],
  ];
  for (const entry of activeCmeYearEntries(entries, set.year)) {
    const hours = (category: string) =>
      entry.allocations.filter((a) => a.category === category).reduce((sum, a) => sum + a.hours, 0);
    rows.push([
      set.year,
      entry.date,
      entry.title,
      totalAllocatedHours([entry]),
      ...cmeCategories.map(hours),
      Math.min(entry.formalPeerReviewHours ?? 0, hours("reviewing")),
      entry.buckets.join("; "),
      entry.reflection,
      entry.costCents === null ? null : (entry.costCents / 100).toFixed(2),
      entry.documentId,
      entry.sourceUrl ?? null,
      entry.transcribed ? "Yes" : "No",
      set.confirmedOn,
      set.confirmedSource,
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(cmeCsvCell).join(",")).join("\r\n") + "\r\n";
}
