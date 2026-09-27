import {
  handbookAliases,
  handbookMobileRoute,
  parseHandbookTitle,
  type ParsedHandbookTitle,
} from "@/lib/on-call/handbook-title";
import { resolveHandbookPhone, type HandbookDial } from "@/lib/on-call/number-resolver";
import type { ServiceContent, ServiceDetail } from "@/lib/on-call/service-model";

/**
 * A published hospital handbook entry, as every rebuilt On Call page reads it.
 *
 * Built from `publishedContent` only (plan correction C6): for editors the
 * handbook's `content` is the DRAFT, and a reader must never see an unpublished
 * edit. `updatedAt` is shown as "Updated", never "Checked".
 */
export type HandbookItem = {
  readonly id: string;
  readonly section: ServiceContent["section"];
  readonly kind: ServiceContent["kind"];
  readonly title: string;
  readonly parsed: ParsedHandbookTitle;
  readonly body: string;
  readonly aliases: readonly string[];
  readonly phone: string;
  readonly dial: HandbookDial;
  /** The route from a mobile (a `From a mobile:` body line), when the editor recorded one. */
  readonly mobileDial: HandbookDial | null;
  readonly sources: ServiceContent["sources"];
  readonly orientationPhase: ServiceContent["orientationPhase"];
  readonly siteId: string | null;
  /**
   * When the published text last changed. Null while a newer draft sits over
   * it: the entry's own time then dates the draft, not what readers see, so no
   * "Updated" date is shown rather than a false one.
   */
  readonly updatedAt: string | null;
};

export function publishedHandbookItems(detail: Pick<ServiceDetail, "entries">): HandbookItem[] {
  const items: HandbookItem[] = [];
  for (const entry of detail.entries) {
    const content = entry.publishedContent;
    if (!content || entry.status === "withdrawn") continue;
    const mobileRoute = handbookMobileRoute(content.body);
    const mobileDial = mobileRoute ? resolveHandbookPhone(mobileRoute) : null;
    items.push({
      id: entry.id,
      section: content.section,
      kind: content.kind,
      title: content.title,
      parsed: parseHandbookTitle(content.title),
      body: content.body,
      aliases: handbookAliases(content.body),
      phone: content.phone,
      dial: resolveHandbookPhone(content.phone),
      mobileDial: mobileDial?.tel ? mobileDial : null,
      sources: content.sources,
      orientationPhase: content.orientationPhase,
      siteId: content.siteId,
      updatedAt: entry.publishedRevision === entry.revision ? entry.updatedAt : null,
    });
  }
  return items.sort((a, b) => a.parsed.label.localeCompare(b.parsed.label) || a.id.localeCompare(b.id));
}

/** At most three pinned rows: every qualifying row shows, never "the first" alone (review F2). */
export const ON_CALL_EMERGENCY_PIN_LIMIT = 3;

/**
 * The hospital's pinned emergency rows for Now.
 *
 * An entry is pinned only when its title carries the `Emergency:` prefix, it
 * names this hospital's site (an entry with no site shows at every hospital in
 * the service, so it could be another hospital's code), and it was saved as
 * `clinical`, which in today's database forces a source and a second
 * reviewer. It must also carry a number: the pin is the emergency NUMBER.
 */
export function pinnedEmergencyEntries(entries: readonly HandbookItem[], siteId: string | null): HandbookItem[] {
  if (!siteId) return [];
  return entries
    .filter(
      (item) =>
        item.parsed.prefix === "Emergency" &&
        item.siteId !== null &&
        item.siteId === siteId &&
        item.kind === "clinical" &&
        item.dial.kind !== "none",
    )
    .slice(0, ON_CALL_EMERGENCY_PIN_LIMIT);
}
