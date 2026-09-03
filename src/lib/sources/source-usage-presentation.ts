import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import type { SourceUsage } from "@/lib/sources/catalogue-types";

/**
 * Where a source is used in PsychSift, in reader-facing terms.
 *
 * The catalogue stores a usage as `{ modeId, recordId, recordLabel, field }`,
 * which answers "which row of which fixture cites this" — a provenance fact, not
 * a clinical one. A clinician reading a source record wants the other direction:
 * which parts of this application rest on it, which records specifically, and
 * what each record uses it for. This module is that projection, and it is the
 * only place a stored `field` name is allowed to become sentence text.
 *
 * Two rules keep it honest:
 * - A record is deep-linked only where `recordId` is provably the route
 *   parameter for that mode. Everywhere else the link resolves through the
 *   mode's own search, which always lands somewhere real. A confident-looking
 *   404 is worse than a search that finds the record.
 * - An unmapped field falls back to the neutral "Cited as evidence" rather than
 *   title-casing itself. Title-casing a backend field is how `public_source_urls`
 *   ends up on screen as "Public Source Urls".
 */

/** Modes whose stored `recordId` is exactly the `[slug]`/`[id]` route segment. */
const recordRoutePrefixes: Partial<Record<AppModeId, string>> = {
  dictionary: "/dictionary",
  documents: "/documents",
  factsheets: "/factsheets",
  // Prescribing records are medication slugs, served from `/medications/[slug]`.
  prescribing: "/medications",
  "therapy-compass": "/therapy-compass",
};

const purposeByField: Record<string, string> = {
  act: "Underpins the legislation summary",
  authoritativeSources: "Listed as an authoritative source",
  comparison: "Supports a term comparison",
  definition: "Supports the definition",
  public_source_urls: "Linked as the service's public source",
  "review.sourceFamily": "Underpins the review criteria",
  source: "Cited as evidence",
  "source metadata": "Provides the document's source record",
  source_documents: "Supplies the source document",
  source_repository: "Cited as evidence",
  sourceDocumentId: "Supplies the source document",
  sourceDocuments: "Supplies the source document",
  sources: "Cited as evidence",
};

export type PresentedSourceUsage = {
  /** Stable within one group; safe as a React key. */
  key: string;
  recordLabel: string;
  purpose: string;
  href: string;
};

export type SourceUsageGroup = {
  modeId: AppModeId;
  modeLabel: string;
  /** Distinct records in this mode, which is what "used in 3 medications" counts. */
  recordCount: number;
  usages: readonly PresentedSourceUsage[];
};

/** Where the reader goes to see this usage in context. Never null — a mode search always resolves. */
export function sourceUsageHref(usage: SourceUsage): string {
  // A dictionary comparison's record id is the pair ("mania--hypomania"), which
  // is not a term slug. `/dictionary/compare` selects its two entries from `a`
  // and `b`, so the bare route would open an empty picker rather than the
  // comparison that cites the source. The pair is split back out here rather
  // than routed through `dictionaryCompareHref`, whose slug validation would
  // pull the whole dictionary dataset into the catalogue's client bundle.
  if (usage.modeId === "dictionary" && usage.field === "comparison") {
    const [first, second] = usage.recordId.split("--");
    const params = new URLSearchParams();
    if (first) params.set("a", first);
    if (second) params.set("b", second);
    return `/dictionary/compare${params.size ? `?${params.toString()}` : ""}`;
  }

  const prefix = recordRoutePrefixes[usage.modeId];
  if (prefix && usage.recordId) return `${prefix}/${usage.recordId}`;

  return appModeHomeHref(usage.modeId, { query: usage.recordLabel, run: true });
}

/** What the record uses this source for, in clinical language. */
export function sourceUsagePurpose(usage: SourceUsage): string {
  if (usage.field.startsWith("distinctions.")) return "Supports a distinction between terms";
  const mapped = purposeByField[usage.field];
  if (mapped) return mapped;
  // A prescribing usage names the record section it backs ("Dosing.adult dose"),
  // which is worth saying: it tells the reader which half of the medication
  // record rests on this source.
  const [section] = usage.field.split(".");
  if (section && section !== usage.field) return `Supports the ${section.toLocaleLowerCase("en-AU")} section`;
  return "Cited as evidence";
}

/**
 * Every place the source is used, grouped by the part of the site it belongs to.
 *
 * Groups and records are ordered alphabetically so the same source always reads
 * the same way, and a record cited twice for the same purpose collapses to one
 * line — the catalogue emits one usage per citing field, which is provenance
 * detail the reader does not need repeated.
 */
export function groupSourceUsagesByMode(usages: readonly SourceUsage[]): readonly SourceUsageGroup[] {
  const byMode = new Map<AppModeId, Map<string, PresentedSourceUsage & { recordId: string }>>();

  for (const usage of usages) {
    const purpose = sourceUsagePurpose(usage);
    const key = `${usage.recordId}::${purpose}`;
    const group = byMode.get(usage.modeId) ?? new Map();
    if (!group.has(key)) {
      group.set(key, {
        key,
        recordId: usage.recordId,
        recordLabel: usage.recordLabel,
        purpose,
        href: sourceUsageHref(usage),
      });
    }
    byMode.set(usage.modeId, group);
  }

  const compare = (left: string, right: string) => left.localeCompare(right, "en-AU", { sensitivity: "base" });

  return [...byMode.entries()]
    .map(([modeId, records]) => {
      const usagesForMode = [...records.values()].sort(
        (left, right) => compare(left.recordLabel, right.recordLabel) || compare(left.purpose, right.purpose),
      );
      return {
        modeId,
        modeLabel: appModeDefinition(modeId).label,
        recordCount: new Set(usagesForMode.map((entry) => entry.recordId)).size,
        usages: usagesForMode.map(({ key, recordLabel, purpose, href }) => ({ key, recordLabel, purpose, href })),
      };
    })
    .sort((left, right) => compare(left.modeLabel, right.modeLabel));
}
