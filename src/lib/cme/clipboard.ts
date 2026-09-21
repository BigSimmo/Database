import { totalAllocatedHours } from "@/lib/cme/evaluate";
import { cmeCategories, cmeCategoryLabels, type CmeEntry, type CmeRequirementSet } from "@/lib/cme/types";

/**
 * The control this mode's owner presses most: one entry, formatted for
 * pasting straight into his college's CPD portal (design-decisions.md §11 —
 * "built first; it is the control that gets pressed a hundred times").
 *
 * **Field order is fixed and matches what a CPD-home form asks for, in the
 * order it asks it**: the date, what it was, the total hours, then the split
 * across the three national categories a portal takes as separate fields
 * rather than one combined figure, then the CPD year the entry counts
 * against, then the reflection — the part an audit actually reads.
 *
 * **Deliberately excluded, and not an oversight:**
 * - **Cost.** Design decision §7: "the year's total appears on the export
 *   and nowhere else" — a CPD portal has no field for what a course cost its
 *   owner, and a per-entry cost figure has no business leaving this device
 *   through this control.
 * - **Internal bookkeeping** — `id`, `documentId`, `routineId`,
 *   `transcribed`, `buckets` — none of it is something the owner would type
 *   into a portal himself, and none of it is safe to assume the portal even
 *   has a field for.
 * - **Anything the reader typed into a search box.** This function only ever
 *   reads fields the owner wrote directly onto the entry — never a query —
 *   so it carries nothing the global "never the search text" rule would
 *   forbid in the first place.
 *
 * The total on the `Hours:` line is computed the same way every other screen
 * in this mode computes it — `totalAllocatedHours` from `evaluate.ts` — so it
 * can never read differently here than it does on the dashboard or the entry
 * screen for the same entry.
 */
export function formatEntryForCpdHome(entry: CmeEntry, set: CmeRequirementSet): string {
  const hoursByCategory = new Map(
    entry.allocations.map((allocation) => [allocation.category, allocation.hours] as const),
  );

  const lines: string[] = [`Date: ${entry.date}`, `Activity: ${entry.title}`, `Hours: ${totalAllocatedHours([entry])}`];

  // Canonical category order, not the order the allocations happen to have
  // been entered in — a portal's own category list has a fixed order, and an
  // entry saved with reviewing typed before educational must not reshuffle it.
  for (const category of cmeCategories) {
    const hours = hoursByCategory.get(category);
    if (hours === undefined) continue;
    lines.push(`${cmeCategoryLabels[category]}: ${hours}`);
  }

  lines.push(`Year: ${set.year}`);

  const reflection = entry.reflection.trim();
  if (reflection.length > 0) lines.push(`Reflection: ${reflection}`);

  return lines.join("\n");
}
