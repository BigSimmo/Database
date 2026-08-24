import { normalizeSearchText } from "@/lib/catalog-search";
import {
  dictionaryComparisonPairs,
  dictionaryEntries,
  dictionaryEntryKinds,
  dictionarySource,
  dictionarySources,
  dictionaryTopics,
  type DictionaryAlias,
  type DictionaryComparisonPair,
  type DictionaryEntry,
  type DictionaryEntryKind,
  type DictionarySource,
  type DictionaryTopic,
} from "@/lib/dictionary-data";

export type DictionarySearchHit =
  | { type: "entry"; entry: DictionaryEntry; score: number; reason: string }
  | {
      type: "abbreviation";
      abbreviation: string;
      senses: readonly DictionaryEntry[];
      score: number;
      reason: string;
    }
  | { type: "topic"; topic: DictionaryTopic; score: number; reason: string };

export type DictionarySearchView = "all" | "definitions" | "abbreviations" | "topics";
export type DictionarySort = "relevance" | "az";

export type DictionaryFilters = {
  q: string;
  view: DictionarySearchView;
  topics: readonly string[];
  kinds: readonly DictionaryEntryKind[];
  sources: readonly string[];
  sort: DictionarySort;
};

const validSearchViews = new Set<DictionarySearchView>(["all", "definitions", "abbreviations", "topics"]);
const validSort = new Set<DictionarySort>(["relevance", "az"]);

export const allDictionaryEntries = [...dictionaryEntries].sort((a, b) => a.term.localeCompare(b.term));

export function dictionaryKindLabel(kind: DictionaryEntryKind) {
  return {
    "clinical-concept": "Clinical concept",
    "clinical-finding": "Clinical finding",
    assessment: "Assessment",
    condition: "Condition",
    "medication-class": "Medication class",
    therapy: "Therapy",
    "service-model": "Service model",
    "legal-ethical-concept": "Legal / ethical",
  }[kind];
}

export function findDictionaryEntry(slug: string | null | undefined) {
  return allDictionaryEntries.find((entry) => entry.slug === slug) ?? null;
}

export function findDictionaryTopic(slug: string | null | undefined) {
  return dictionaryTopics.find((topic) => topic.slug === slug) ?? null;
}

export function dictionaryEntrySources(entry: DictionaryEntry): DictionarySource[] {
  return entry.sourceRefs.flatMap((reference) => {
    const source = dictionarySource(reference.sourceId);
    return source ? [source] : [];
  });
}

export function dictionaryTopicEntries(topic: DictionaryTopic) {
  const slugs = new Set(topic.entrySlugs);
  return allDictionaryEntries.filter((entry) => slugs.has(entry.slug));
}

export function dictionaryComparisonPair(a: string, b: string): DictionaryComparisonPair | null {
  return (
    dictionaryComparisonPairs.find(
      (pair) => (pair.slugs[0] === a && pair.slugs[1] === b) || (pair.slugs[0] === b && pair.slugs[1] === a),
    ) ?? null
  );
}

function uniqueKnown(values: readonly string[], known: ReadonlySet<string>) {
  return Array.from(new Set(values.filter((value) => known.has(value))));
}

function valuesFrom(params: URLSearchParams, key: string) {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseDictionaryFilters(params: URLSearchParams): DictionaryFilters {
  const rawView = params.get("view") as DictionarySearchView | null;
  const rawSort = params.get("sort") as DictionarySort | null;
  return {
    q: (params.get("q") ?? "").trim(),
    view: rawView && validSearchViews.has(rawView) ? rawView : "all",
    topics: uniqueKnown(valuesFrom(params, "topic"), new Set(dictionaryTopics.map((topic) => topic.slug))),
    kinds: uniqueKnown(valuesFrom(params, "kind"), new Set(dictionaryEntryKinds)) as DictionaryEntryKind[],
    sources: uniqueKnown(valuesFrom(params, "source"), new Set(dictionarySources.map((source) => source.id))),
    sort: rawSort && validSort.has(rawSort) ? rawSort : "relevance",
  };
}

function entryPassesFilters(entry: DictionaryEntry, filters: DictionaryFilters) {
  if (filters.topics.length && !filters.topics.includes(entry.topicSlug)) return false;
  if (filters.kinds.length && !filters.kinds.includes(entry.kind)) return false;
  if (filters.sources.length && !entry.sourceRefs.some((reference) => filters.sources.includes(reference.sourceId))) {
    return false;
  }
  // There is deliberately no "recently updated" lens. The catalogue is one
  // review cohort stamped with a single `checkedOn`, so any date predicate would
  // either return everything or nothing while still rendering an active filter
  // chip. Re-add it with a real cutoff when entries carry distinct review dates.
  return true;
}

function entryScore(entry: DictionaryEntry, query: string) {
  if (!query) return { score: 10, reason: "Browse result" };
  const normalized = normalizeSearchText(query);
  const term = normalizeSearchText(entry.term);
  const aliases = entry.aliases.map((alias) => ({ alias, normalized: normalizeSearchText(alias.value) }));
  const exactAlias = aliases.find(({ normalized: value }) => value === normalized);
  if (term === normalized) return { score: 100, reason: "Exact term" };
  if (exactAlias) {
    return {
      score: exactAlias.alias.kind === "abbreviation" ? 98 : 94,
      reason: exactAlias.alias.kind === "abbreviation" ? `Abbreviation: ${exactAlias.alias.value}` : "Exact alias",
    };
  }
  if (term.startsWith(normalized)) return { score: 88, reason: "Term begins with the search" };
  if (aliases.some(({ normalized: value }) => value.startsWith(normalized))) {
    return { score: 82, reason: "Alias begins with the search" };
  }
  if (term.includes(normalized)) return { score: 72, reason: "Term contains the search" };
  if (aliases.some(({ normalized: value }) => value.includes(normalized))) return { score: 68, reason: "Alias match" };
  const context = normalizeSearchText(
    `${entry.definition} ${entry.meaning} ${entry.context.join(" ")} ${dictionaryKindLabel(entry.kind)}`,
  );
  if (context.includes(normalized)) return { score: 44, reason: "Definition or context match" };
  return null;
}

function abbreviationGroups(entries: readonly DictionaryEntry[]) {
  const groups = new Map<string, DictionaryEntry[]>();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (alias.kind !== "abbreviation") continue;
      const key = alias.value.toLocaleUpperCase();
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
  }
  return groups;
}

export function searchDictionary(filters: DictionaryFilters): DictionarySearchHit[] {
  const filteredEntries = allDictionaryEntries.filter((entry) => entryPassesFilters(entry, filters));
  const hits: DictionarySearchHit[] = [];
  const q = filters.q;

  if (filters.view === "all" || filters.view === "definitions") {
    for (const entry of filteredEntries) {
      const match = entryScore(entry, q);
      if (match) hits.push({ type: "entry", entry, ...match });
    }
  }

  if (filters.view === "all" || filters.view === "abbreviations") {
    const normalizedQuery = normalizeSearchText(q);
    for (const [abbreviation, senses] of abbreviationGroups(filteredEntries)) {
      const normalizedAbbreviation = normalizeSearchText(abbreviation);
      const searchable = normalizeSearchText(`${abbreviation} ${senses.map((entry) => entry.term).join(" ")}`);
      if (!normalizedQuery || searchable.includes(normalizedQuery)) {
        hits.push({
          type: "abbreviation",
          abbreviation,
          senses,
          score:
            normalizedAbbreviation === normalizedQuery
              ? 99
              : normalizedAbbreviation.startsWith(normalizedQuery)
                ? 84
                : 55,
          reason: senses.length > 1 ? `${senses.length} recognised meanings` : "Governed abbreviation",
        });
      }
    }
  }

  if (filters.view === "all" || filters.view === "topics") {
    const allowedTopics = new Set(filteredEntries.map((entry) => entry.topicSlug));
    const normalizedQuery = normalizeSearchText(q);
    for (const topic of dictionaryTopics) {
      if (!allowedTopics.has(topic.slug)) continue;
      const searchable = normalizeSearchText(`${topic.title} ${topic.description}`);
      if (!normalizedQuery || searchable.includes(normalizedQuery)) {
        hits.push({
          type: "topic",
          topic,
          score: normalizeSearchText(topic.title) === normalizedQuery ? 96 : 42,
          reason: `${topic.entrySlugs.length} governed terms`,
        });
      }
    }
  }

  return hits.sort((a, b) => {
    if (filters.sort === "az") {
      const aTitle = a.type === "entry" ? a.entry.term : a.type === "topic" ? a.topic.title : a.abbreviation;
      const bTitle = b.type === "entry" ? b.entry.term : b.type === "topic" ? b.topic.title : b.abbreviation;
      return aTitle.localeCompare(bTitle);
    }
    return b.score - a.score;
  });
}

/**
 * The letter a hit files under in the browse index.
 *
 * Exported because the alphabetical control has to offer exactly the letters the
 * list can actually show. Deriving that from a second copy of this expression is
 * how an index comes to offer a letter that strands the reader on an empty page.
 */
export function dictionaryBrowseLetter(hit: DictionarySearchHit) {
  const title =
    hit.type === "entry" ? hit.entry.term : hit.type === "abbreviation" ? hit.abbreviation : hit.topic.title;
  return title.charAt(0).toLocaleUpperCase();
}

/**
 * The catalogue's two scopes.
 *
 * `/dictionary/search` and `/dictionary/browse` were one catalogue behind two
 * destinations, and this is the axis that actually separated them: Browse's
 * Definitions/Abbreviations view switch. The retired search lenses `all` and
 * `topics` are not scopes — Topics is its own mode-nav destination, and `all`
 * mixed two row shapes that read as one list.
 */
export type DictionaryCatalogueScope = "definitions" | "abbreviations";

/** Relevance is only meaningful against a query; A–Z / Z–A order the catalogue. */
export type DictionaryCatalogueSort = "relevance" | "az" | "za";

export type DictionaryCatalogueParams = {
  q: string;
  scope: DictionaryCatalogueScope;
  /** `all`, or a single A–Z initial. Always applied: the A–Z control stays on the page. */
  letter: string;
  topics: readonly string[];
  kinds: readonly DictionaryEntryKind[];
  sources: readonly string[];
  sort: DictionaryCatalogueSort;
};

const catalogueSorts = new Set<DictionaryCatalogueSort>(["relevance", "az", "za"]);

/**
 * Reads the merged catalogue's URL state.
 *
 * `view=all` and `view=topics` are the two retired lenses. They degrade to the
 * definitions scope rather than 404-ing a bookmark or, worse, rendering an empty
 * list for a `view` value nothing can produce any more.
 *
 * Sort defaults by state, not by constant: relevance ranking on an empty query
 * scores every entry identically (`entryScore` returns a flat 10), so the
 * catalogue would arrive in source order. A–Z is the browse answer, relevance is
 * the search answer, and the URL only carries `sort` once the reader picks one.
 */
export function parseDictionaryCatalogueParams(params: URLSearchParams): DictionaryCatalogueParams {
  const filters = parseDictionaryFilters(params);
  const rawLetter = (params.get("letter") ?? "all").toLocaleUpperCase();
  const rawSort = params.get("sort");
  return {
    q: filters.q,
    scope: filters.view === "abbreviations" ? "abbreviations" : "definitions",
    letter: /^[A-Z]$/.test(rawLetter) ? rawLetter : "all",
    topics: filters.topics,
    kinds: filters.kinds,
    sources: filters.sources,
    sort:
      rawSort && catalogueSorts.has(rawSort as DictionaryCatalogueSort)
        ? (rawSort as DictionaryCatalogueSort)
        : filters.q
          ? "relevance"
          : "az",
  };
}

/**
 * The URL keys a "clear the search" control has to remove.
 *
 * Facets and the letter jump stay: they remain visible on the page after the
 * query is dismissed, each removable in one tap. Dropping `letter` would reset
 * an A–Z choice the chip still shows. Anything `dictionaryCatalogue` learns to
 * ignore while searching belongs in this list; `tests/dictionary-data.test.ts`
 * pins the pair together.
 */
export const dictionaryClearedQueryKeys = ["q", "query", "run"] as const;

/**
 * One selector for the merged catalogue: the query, the scope, the alphabet and
 * the facets all narrow the same list.
 *
 * The A–Z control stays visible during a search, so a `letter` in the URL is
 * never an invisible filter. Honouring it here is what `docs/filter-contract.md`
 * requires of a control the reader can still see.
 */
export function dictionaryCatalogue(params: DictionaryCatalogueParams): DictionarySearchHit[] {
  const filters: DictionaryFilters = {
    q: params.q,
    view: params.scope,
    topics: params.topics,
    kinds: params.kinds,
    sources: params.sources,
    sort: params.sort === "relevance" ? "relevance" : "az",
  };
  const letter = params.letter;
  let hits = searchDictionary(filters).filter((hit) => {
    if (!letter || letter === "all") return true;
    return dictionaryBrowseLetter(hit) === letter.toLocaleUpperCase();
  });
  if (params.sort === "za") hits = hits.reverse();
  return hits;
}

export function dictionaryCompareHref(slugs: readonly string[]) {
  const valid = Array.from(new Set(slugs.filter((slug) => Boolean(findDictionaryEntry(slug))))).slice(0, 2);
  const params = new URLSearchParams();
  if (valid[0]) params.set("a", valid[0]);
  if (valid[1]) params.set("b", valid[1]);
  return `/dictionary/compare${params.size ? `?${params.toString()}` : ""}`;
}

export function dictionaryCatalogueIssues() {
  const issues: string[] = [];
  const slugs = new Set<string>();
  const topicSlugs = new Set(dictionaryTopics.map((topic) => topic.slug));
  const sourceIds = new Set<string>(dictionarySources.map((source) => source.id));
  const entrySlugs = new Set(dictionaryEntries.map((entry) => entry.slug));
  if (dictionaryEntries.length !== 96) issues.push(`expected 96 entries, found ${dictionaryEntries.length}`);
  if (dictionaryTopics.length !== 12) issues.push(`expected 12 topics, found ${dictionaryTopics.length}`);
  for (const source of dictionarySources) {
    try {
      const protocol = new URL(source.url).protocol;
      if (protocol !== "https:" && protocol !== "http:") issues.push(`${source.id}: unsafe URL`);
    } catch {
      issues.push(`${source.id}: invalid URL`);
    }
  }
  for (const entry of dictionaryEntries) {
    if (slugs.has(entry.slug)) issues.push(`${entry.slug}: duplicate slug`);
    slugs.add(entry.slug);
    if (!topicSlugs.has(entry.topicSlug)) issues.push(`${entry.slug}: unknown topic`);
    if (!entry.definition.trim() || !entry.meaning.trim()) issues.push(`${entry.slug}: missing required copy`);
    if (!entry.sourceRefs.length) issues.push(`${entry.slug}: no source`);
    if (entry.sourceRefs.some((reference) => !sourceIds.has(reference.sourceId))) {
      issues.push(`${entry.slug}: unknown source`);
    }
    if (entry.relatedSlugs.length !== 4 || entry.relatedSlugs.some((slug) => !entrySlugs.has(slug))) {
      issues.push(`${entry.slug}: invalid related entries`);
    }
    if (entry.review.clinicalApproval !== "pending") issues.push(`${entry.slug}: approval state must remain pending`);
  }
  return issues;
}

export function dictionaryAliasSenses(value: string) {
  const normalized = normalizeSearchText(value);
  return allDictionaryEntries.filter((entry) =>
    entry.aliases.some((alias: DictionaryAlias) => normalizeSearchText(alias.value) === normalized),
  );
}
