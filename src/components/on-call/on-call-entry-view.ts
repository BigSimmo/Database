import { isComplianceEntry } from "@/lib/on-call/compliance";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { isRoleExplainerEntry } from "@/lib/on-call/who-is-who";
import { type OnCallPageView } from "@/components/on-call/on-call-section-identity";

/**
 * The two functions that map between a stored section and the page a reader
 * sees — split out of `on-call-section-identity.ts`, which they were making
 * expensive to import.
 *
 * They are the only things in that file that need the On Call domain model at
 * RUNTIME rather than as a type. Everything else there is titles, hrefs and
 * glyphs, and `mode-nav-icons.ts` wants only the glyphs — but it is imported
 * by the shared `MasterSearchHeader`, so one value import in the identity
 * module put six Zod schemas into the bundle for `/` and `/documents/search`.
 * See `tests/on-call-root-bundle-isolation.test.ts` for the measured cost of
 * the last time that happened through a different door.
 *
 * Every caller of these two is an On Call surface or the developer hub, none
 * of which is on the home page, so the weight lands only where it is used.
 *
 * They stay in ONE file because they are exact inverses of each other. Adding
 * a third view means editing both, and a reader who changes one has the other
 * in front of them.
 */

/**
 * Which stored section a view writes to. Who's who writes `contacts` rows; every
 * other view writes its own. The editor takes this rather than the view, so a
 * role explainer is saved as what it actually is.
 */
export function onCallViewStorageSection(view: OnCallPageView): OnCallSection {
  if (view === "who-is-who") return "contacts";
  if (view === "compliance") return "logistics";
  return view;
}

/**
 * Which view an entry BELONGS TO — the exact inverse of
 * `onCallViewStorageSection`, and next to it so the pair cannot drift.
 *
 * Anything that turns an entry into a destination, a heading or a glyph must go
 * through this rather than reading `entry.section`, because two of this mode's
 * pages are views over a stored section rather than sections themselves. A
 * compliance requirement is stored as `logistics`; keying off the section sends
 * it to the Admin page, under the Admin name and the Admin glyph, and the row
 * is not on that page — a search result that navigates to a page not containing
 * the thing it found. Who's who is the same shape over `contacts`.
 *
 * If a third view is ever added, adding it here and to
 * `onCallViewStorageSection` is the whole change; that is the point of them
 * sitting together.
 */
export function onCallViewForEntry(entry: OnCallEntry): OnCallPageView {
  if (isComplianceEntry(entry)) return "compliance";
  if (isRoleExplainerEntry(entry)) return "who-is-who";
  return entry.section;
}
