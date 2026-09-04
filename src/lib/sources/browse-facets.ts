import type { AppModeId } from "@/lib/app-modes";
import type {
  ClinicalSourceCatalogueEntry,
  ClinicalSourceType,
  SourceGeographyScope,
  SourceQualityBand,
} from "@/lib/sources/catalogue-types";
import { compareQuality, compareText, normalizeSearchValue } from "@/lib/sources/catalogue-view";
import { sourceAttentionFlags } from "@/lib/sources/source-status-presentation";

/**
 * What one heading on Topics or Publishers is actually worth.
 *
 * The two browse tabs used to say "ADHD 5" and "Beyond Blue · 1 source". A count
 * answers "how much" and nothing else: five sources under a topic can be five
 * current WA guidelines or five review-required orphans with no publisher, and
 * the reader could not tell without opening the filtered catalogue five times.
 *
 * These summaries carry the same three signals the catalogue tile leads with —
 * quality band, jurisdiction, currency — aggregated over the group, plus the
 * highest-rated member so a heading can name its own best source. Everything is
 * plain JSON so a server page can derive it once and hand it to the client
 * component that renders and filters it.
 */

export const SOURCE_BAND_ORDER: readonly SourceQualityBand[] = ["A", "B", "C", "D", "excluded"];

export type SourceBandCounts = Record<SourceQualityBand, number>;

export type SourceBrowseSummary = {
  /** The raw facet value, which is what the catalogue href carries. */
  value: string;
  /** Display form: title-cased for topics, verbatim for publishers. */
  label: string;
  count: number;
  bandCounts: SourceBandCounts;
  /** Members carrying at least one `sourceAttentionFlags` flag. */
  attentionCount: number;
  /** Topics: the publishers behind them. Publishers: empty. */
  publishers: readonly string[];
  /** Publishers: the topics they cover. Topics: empty. */
  topics: readonly string[];
  sourceTypes: readonly ClinicalSourceType[];
  usedByModes: readonly AppModeId[];
  /** Every jurisdiction present, most-represented first. */
  jurisdictions: readonly SourceGeographyScope[];
  /** The group's jurisdiction: the publisher group's scope, or a topic's dominant one. */
  scope: SourceGeographyScope;
  /** The most recent publication or review date across the group, ISO, or null. */
  latestDate: string | null;
  /** The member the catalogue would list first. */
  leadEntry: { id: string; title: string } | null;
};

export type SourceBrowseOrder = "coverage" | "alpha" | "attention";

/** How many summaries carry supporting detail before the row starts to crowd. */
const DETAIL_LIMIT = 3;

export function sourceTopicLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emptyBandCounts(): SourceBandCounts {
  return { A: 0, B: 0, C: 0, D: 0, excluded: 0 };
}

function dateValue(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

/**
 * The most recent date the group can stand behind. Expiry is deliberately not a
 * candidate: a source that expires in 2027 is not thereby current, and reading a
 * future expiry as recency is exactly the inference the Method page forbids.
 */
function latestKnownDate(entries: readonly ClinicalSourceCatalogueEntry[]) {
  let best: string | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    for (const candidate of [entry.publicationDate, entry.reviewDate]) {
      const value = dateValue(candidate);
      if (candidate && value > bestValue) {
        best = candidate;
        bestValue = value;
      }
    }
  }
  return best;
}

/** Values ordered by how many entries carry them, ties broken alphabetically. */
function rankedValues<Value extends string>(values: readonly Value[], limit?: number): Value[] {
  const counts = new Map<Value, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ranked = [...counts]
    .sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))
    .map(([value]) => value);
  return limit === undefined ? ranked : ranked.slice(0, limit);
}

function summarise(params: {
  value: string;
  label: string;
  entries: readonly ClinicalSourceCatalogueEntry[];
  /** Set for publisher groups, which are derived per jurisdiction. */
  scope?: SourceGeographyScope;
  /** Publisher summaries describe topics; topic summaries describe publishers. */
  kind: "topic" | "publisher";
}): SourceBrowseSummary {
  const { value, label, entries, kind } = params;
  const bandCounts = emptyBandCounts();
  for (const entry of entries) bandCounts[entry.rating.band] += 1;
  const jurisdictions = rankedValues(entries.map((entry) => entry.geography.scope));
  const lead = [...entries].sort(compareQuality)[0] ?? null;

  return {
    value,
    label,
    count: entries.length,
    bandCounts,
    attentionCount: entries.filter((entry) => sourceAttentionFlags(entry).length > 0).length,
    publishers:
      kind === "topic"
        ? rankedValues(
            entries.map((entry) => entry.publisher).filter((publisher): publisher is string => Boolean(publisher)),
            DETAIL_LIMIT,
          )
        : [],
    topics:
      kind === "publisher"
        ? rankedValues(
            entries.flatMap((entry) => entry.topics),
            DETAIL_LIMIT,
          )
        : [],
    sourceTypes: rankedValues(
      entries.map((entry) => entry.sourceType),
      DETAIL_LIMIT,
    ),
    usedByModes: rankedValues(entries.flatMap((entry) => entry.usedBy.map((usage) => usage.modeId))),
    jurisdictions,
    scope: params.scope ?? jurisdictions[0] ?? "unknown",
    latestDate: latestKnownDate(entries),
    leadEntry: lead ? { id: lead.id, title: lead.title } : null,
  };
}

export function deriveTopicBrowseSummaries(
  entries: readonly ClinicalSourceCatalogueEntry[],
): readonly SourceBrowseSummary[] {
  const byTopic = new Map<string, ClinicalSourceCatalogueEntry[]>();
  for (const entry of entries) {
    // One entry can carry the same topic twice upstream; the group is a set of
    // entries, so a repeated tag must not inflate the count.
    for (const topic of new Set(entry.topics)) {
      const group = byTopic.get(topic);
      if (group) group.push(entry);
      else byTopic.set(topic, [entry]);
    }
  }
  return [...byTopic]
    .map(([topic, group]) => summarise({ value: topic, label: sourceTopicLabel(topic), entries: group, kind: "topic" }))
    .sort((left, right) => compareText(left.label, right.label));
}

/**
 * Publishers within one jurisdiction scope.
 *
 * Per-scope rather than global because a publisher can appear under two scopes —
 * RANZCP with an Australian national source and an international one — and the
 * catalogue link carries the scope, so merging them would send the reader to a
 * filtered result narrower than the count promised.
 */
export function derivePublisherBrowseSummaries(
  entries: readonly ClinicalSourceCatalogueEntry[],
  scope: SourceGeographyScope,
): readonly SourceBrowseSummary[] {
  const byPublisher = new Map<string, ClinicalSourceCatalogueEntry[]>();
  for (const entry of entries) {
    if (!entry.publisher || entry.geography.scope !== scope) continue;
    const group = byPublisher.get(entry.publisher);
    if (group) group.push(entry);
    else byPublisher.set(entry.publisher, [entry]);
  }
  return [...byPublisher]
    .map(([publisher, group]) =>
      summarise({ value: publisher, label: publisher, entries: group, scope, kind: "publisher" }),
    )
    .sort((left, right) => compareText(left.label, right.label));
}

/**
 * Whether a browse row survives the composer's query.
 *
 * Matched against the same normalised terms `filterAndSortSourceCatalogue` uses,
 * plus the group's own supporting detail, so a query that would find a source in
 * the catalogue also finds the heading that source sits under. Without this the
 * two tabs listed everything while the composer displayed a query — a browse
 * result asserted for a search that never ran.
 */
export function matchesBrowseQuery(summary: SourceBrowseSummary, query: string) {
  const needle = normalizeSearchValue(query);
  if (!needle) return true;
  return [
    summary.label,
    summary.value,
    summary.leadEntry?.title ?? "",
    ...summary.publishers,
    ...summary.topics.map(sourceTopicLabel),
    ...summary.sourceTypes.map(sourceTopicLabel),
  ]
    .map(normalizeSearchValue)
    .some((candidate) => candidate.includes(needle));
}

export function sortBrowseSummaries(
  summaries: readonly SourceBrowseSummary[],
  order: SourceBrowseOrder,
): readonly SourceBrowseSummary[] {
  return [...summaries].sort((left, right) => {
    if (order === "coverage") {
      return right.count - left.count || compareText(left.label, right.label);
    }
    if (order === "attention") {
      return (
        right.attentionCount - left.attentionCount ||
        right.bandCounts.D - left.bandCounts.D ||
        compareText(left.label, right.label)
      );
    }
    return compareText(left.label, right.label);
  });
}

/** Totals across a filtered set, for the sheet summary and the section headers. */
export function totalSourceCount(summaries: readonly SourceBrowseSummary[]) {
  return summaries.reduce((total, summary) => total + summary.count, 0);
}
