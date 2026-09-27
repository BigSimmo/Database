import { isComplianceEntry } from "@/lib/on-call/compliance";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { isRoleExplainerEntry } from "@/lib/on-call/who-is-who";

/**
 * A page of the On Call mode.
 *
 * Who's who and Compliance are views over stored sections rather than stored
 * sections themselves: Who's who is `contacts` rows behind `details.kind`,
 * and Compliance is `logistics` rows behind `details.kind`.
 */
export type OnCallPageView = OnCallSection | "who-is-who" | "compliance";

export const ON_CALL_VIEW_PAGES: readonly OnCallPageView[] = [
  "contacts",
  "who-is-who",
  "playbook",
  "referrals",
  "orientation",
  "education",
  "logistics",
  "compliance",
] as const;

/**
 * Which stored section a view writes to.
 * Who's who writes `contacts` rows; Compliance writes `logistics` rows;
 * every other view writes its own.
 */
export function onCallViewStorageSection(view: OnCallPageView): OnCallSection {
  if (view === "who-is-who") return "contacts";
  if (view === "compliance") return "logistics";
  return view;
}

/**
 * Which view an entry belongs to.
 *
 * Anything that turns an entry into a destination, a heading, a glyph or a freshness
 * calculation must go through this rather than reading `entry.section`, because two of
 * this mode's pages are views over a stored section rather than sections themselves.
 */
export function onCallViewForEntry(entry: OnCallEntry): OnCallPageView {
  if (isComplianceEntry(entry)) return "compliance";
  if (isRoleExplainerEntry(entry)) return "who-is-who";
  return entry.section;
}
