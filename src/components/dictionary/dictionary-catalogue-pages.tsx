"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpenText, Check, ChevronDown, Filter, GitCompareArrows, Layers3, Search } from "lucide-react";

import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { DictionaryResultRow } from "@/components/dictionary/dictionary-result-row";
import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { type PageSection } from "@/components/in-page-nav/page-section-index";
import { useInPageSectionNav } from "@/components/in-page-nav/use-in-page-section-nav";
import { InformationPageFooter, InformationPageShell } from "@/components/information-page-shell";
import { cn } from "@/components/ui-primitives";
import {
  allDictionaryEntries,
  browseDictionary,
  dictionaryKindLabel,
  dictionaryTopicEntries,
  findDictionaryTopic,
  parseDictionaryFilters,
  searchDictionary,
  type DictionaryFilters,
  type DictionarySearchView,
} from "@/lib/dictionary";
import {
  dictionaryEntryKinds,
  dictionarySources,
  dictionaryTopics,
  type DictionaryEntryKind,
} from "@/lib/dictionary-data";

const lensOptions: ReadonlyArray<{ value: DictionarySearchView; label: string }> = [
  { value: "all", label: "All" },
  { value: "definitions", label: "Definitions" },
  { value: "abbreviations", label: "Abbreviations" },
  { value: "topics", label: "Topics" },
];

const topicDetailSections = [
  { id: "dictionary-topic-terms", label: "Terms", icon: BookOpenText },
  {
    id: "dictionary-topic-details",
    label: "Collection details",
    icon: Layers3,
    targetIds: ["dictionary-topic-details-phone", "dictionary-topic-details-desktop"],
  },
] as const satisfies readonly PageSection[];

function useDictionaryUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const replace = (edit: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    edit(next);
    const suffix = next.toString();
    router.replace(`${pathname}${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };
  const setOne = (key: string, value: string, defaultValue?: string) =>
    replace((next) => {
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
    });
  const toggleMany = (key: string, value: string) =>
    replace((next) => {
      const values = new Set(next.getAll(key));
      next.delete(key);
      if (values.has(value)) values.delete(value);
      else values.add(value);
      for (const selected of values) next.append(key, selected);
    });
  return { searchParams, replace, setOne, toggleMany };
}

function selectedFilterCount(filters: DictionaryFilters) {
  return filters.topics.length + filters.kinds.length + filters.sources.length;
}

export function DictionarySearchPage() {
  const { searchParams, replace, setOne, toggleMany } = useDictionaryUrl();
  const serializedSearchParams = searchParams.toString();
  const filters = useMemo(
    () => parseDictionaryFilters(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const hits = useMemo(() => searchDictionary(filters), [filters]);
  const activeCount = selectedFilterCount(filters);
  const lensCounts = useMemo(
    () =>
      Object.fromEntries(
        lensOptions.map((option) => [option.value, searchDictionary({ ...filters, view: option.value }).length]),
      ) as Record<DictionarySearchView, number>,
    [filters],
  );

  const clearFilters = () =>
    replace((next) => {
      for (const key of ["topic", "kind", "source"]) next.delete(key);
    });

  const groups = [
    resultFilterFacetGroup({
      id: "topics",
      label: "Topics",
      description: "Select one or more governed collections.",
      selected: new Set(filters.topics),
      options: dictionaryTopics.map((topic) => ({
        value: topic.slug,
        label: topic.title,
        hint: String(searchDictionary({ ...filters, topics: [topic.slug] }).length),
      })),
      onToggle: (value) => toggleMany("topic", value),
    }),
    resultFilterFacetGroup({
      id: "kinds",
      label: "Entry kind",
      selected: new Set(filters.kinds),
      options: dictionaryEntryKinds.map((kind) => ({
        value: kind,
        label: dictionaryKindLabel(kind),
        hint: String(searchDictionary({ ...filters, kinds: [kind] }).length),
      })),
      onToggle: (value) => toggleMany("kind", value),
    }),
    resultFilterFacetGroup({
      id: "sources",
      // Labelled by the source's own title, not its organisation: five of the
      // twelve sources are published by Healthdirect Australia, so an
      // organisation label rendered five identical options that each filtered to
      // a different single document.
      label: "Source",
      selected: new Set(filters.sources),
      options: dictionarySources.map((source) => ({
        value: source.id,
        label: source.title,
        searchText: `${source.title} ${source.organisation}`,
        hint: String(searchDictionary({ ...filters, sources: [source.id] }).length),
      })),
      onToggle: (value) => toggleMany("source", value),
    }),
  ];

  const appliedFilters = [
    ...filters.topics.map((slug) => ({
      id: `topic-${slug}`,
      groupLabel: "Topic",
      valueLabel: findDictionaryTopic(slug)?.title ?? slug,
      onRemove: () => toggleMany("topic", slug),
    })),
    ...filters.kinds.map((kind) => ({
      id: `kind-${kind}`,
      groupLabel: "Kind",
      valueLabel: dictionaryKindLabel(kind),
      onRemove: () => toggleMany("kind", kind),
    })),
    ...filters.sources.map((sourceId) => ({
      id: `source-${sourceId}`,
      groupLabel: "Source",
      valueLabel: dictionarySources.find((source) => source.id === sourceId)?.title ?? sourceId,
      onRemove: () => toggleMany("source", sourceId),
    })),
  ];

  // The lens rail lives on the page, not in the band's `filterControls` row: the
  // band hides that row below `sm` whenever a phone control is supplied, so the
  // four result lenses were unreachable on a phone. One rail, every width.
  const lensControls = (
    <div role="group" aria-label="Result type" className="flex min-w-0 flex-wrap items-center gap-1.5">
      {lensOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={filters.view === option.value}
          onClick={() => setOne("view", option.value, "all")}
          className={cn(
            "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10",
            filters.view === option.value
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
          )}
        >
          {option.label}
          <span
            className={cn(
              "nums text-2xs",
              filters.view === option.value ? "opacity-80" : "text-[color:var(--text-muted)]",
            )}
          >
            {lensCounts[option.value]}
          </span>
        </button>
      ))}
    </div>
  );

  const trigger = (slot: "desktop" | "phone") => (
    <ResultFilterTrigger
      panelId="dictionary-filter-sheet"
      testId={`dictionary-filter-trigger-${slot}`}
      open={filterOpen}
      activeCount={activeCount}
      onToggle={() => setFilterOpen((value) => !value)}
      title="Filter dictionary results"
    />
  );

  return (
    <>
      <InformationPageShell testId="dictionary-search-main" width="bleed" gap={false}>
        {/* The band used to be the first thing under the mode nav, so its card
            edge sat flush against the tab rule with no page title and no
            breathing room. The route now opens with its own titled header, and
            the band is what it is elsewhere: the result spine below the title. */}
        <header className="mx-auto w-full max-w-[76rem] px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-7">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Clinical dictionary
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Search terms
          </h1>
          <div className="mt-4">{lensControls}</div>
        </header>
        <div className="mx-auto w-full max-w-[76rem] px-4 sm:px-6">
          <SearchResultsHeaderBand
            modeId="dictionary"
            query={filters.q}
            matchCount={hits.length}
            status="ready"
            sortValue={filters.sort === "az" ? "alpha" : "relevance"}
            onSortChange={(value) => setOne("sort", value === "alpha" ? "az" : "relevance", "relevance")}
            utilityControls={<div className="hidden shrink-0 sm:flex">{trigger("desktop")}</div>}
            mobileControls={trigger("phone")}
            mobileControlsPlacement="inline"
            appliedFilters={appliedFilters}
            onClearFilters={activeCount ? clearFilters : undefined}
          />
        </div>
        <div className="mx-auto w-full max-w-[76rem] px-0 py-3 sm:px-6 sm:py-4">
          {hits.length ? (
            <section
              aria-label="Dictionary results"
              className="border-y border-[color:var(--border)] sm:overflow-hidden sm:rounded-xl sm:border-x sm:bg-[color:var(--surface)]"
            >
              {hits.map((hit) => {
                const key =
                  hit.type === "entry"
                    ? `entry-${hit.entry.slug}`
                    : hit.type === "topic"
                      ? `topic-${hit.topic.slug}`
                      : `abbr-${hit.abbreviation}`;
                return <DictionaryResultRow key={key} hit={hit} />;
              })}
            </section>
          ) : (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto size-icon-xl text-[color:var(--decoration-soft)]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-extrabold text-[color:var(--text-heading)]">
                No matching dictionary entries
              </h2>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Keep the search term and remove a filter, or try a broader term.
              </p>
              {activeCount ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 min-h-tap rounded-lg px-4 text-sm font-bold text-[color:var(--clinical-accent)]"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          )}
        </div>
        <InformationPageFooter>Reference terminology · Not patient-specific guidance</InformationPageFooter>
      </InformationPageShell>
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId="dictionary-filter-sheet"
        testId="dictionary-filter-sheet"
        title="Filter results"
        description="Facets narrow the current search; result type remains a separate lens."
        groups={groups}
        onClearAll={activeCount ? clearFilters : undefined}
        summary={{ count: hits.length, noun: hits.length === 1 ? "result" : "results" }}
        primaryActionLabel={`Show ${hits.length} ${hits.length === 1 ? "result" : "results"}`}
        onApply={() => setFilterOpen(false)}
        chromeResetKey={filters.q}
      />
    </>
  );
}

export function DictionaryBrowsePage() {
  const { searchParams, replace, setOne, toggleMany } = useDictionaryUrl();
  const rawView = searchParams.get("view");
  const view = rawView === "abbreviations" ? "abbreviations" : "az";
  const rawLetter = (searchParams.get("letter") ?? "all").toLocaleUpperCase();
  const letter = /^[A-Z]$/.test(rawLetter) ? rawLetter : "all";
  const topics = searchParams.getAll("topic").filter((slug) => Boolean(findDictionaryTopic(slug)));
  const kinds = searchParams
    .getAll("kind")
    .filter((kind): kind is DictionaryEntryKind => dictionaryEntryKinds.includes(kind as DictionaryEntryKind));
  const sort = searchParams.get("sort") === "za" ? "za" : "az";
  const [filterOpen, setFilterOpen] = useState(false);
  const hits = browseDictionary({ view, letter, topics, kinds, sort });
  const activeCount = topics.length + kinds.length;
  const clearFilters = () =>
    replace((next) => {
      next.delete("topic");
      next.delete("kind");
    });
  const groups = [
    resultFilterFacetGroup({
      id: "topics",
      label: "Topics",
      selected: new Set(topics),
      options: dictionaryTopics.map((topic) => ({
        value: topic.slug,
        label: topic.title,
        hint: String(topic.entrySlugs.length),
      })),
      onToggle: (value) => toggleMany("topic", value),
    }),
    resultFilterFacetGroup({
      id: "kinds",
      label: "Entry kind",
      selected: new Set(kinds),
      options: dictionaryEntryKinds.map((kind) => ({ value: kind, label: dictionaryKindLabel(kind) })),
      onToggle: (value) => toggleMany("kind", value),
    }),
  ];
  return (
    <>
      <InformationPageShell width="bleed" gap={false} testId="dictionary-browse-main">
        <header className="mx-auto w-full max-w-[76rem] px-4 pb-4 pt-5 sm:px-6 sm:pt-7">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Complete catalogue
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Browse terms
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Scan the same source-linked result system by letter or abbreviation.
          </p>
        </header>
        <div className="border-y border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="mx-auto grid w-full max-w-[76rem] gap-3 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex min-h-tap overflow-hidden rounded-lg border border-[color:var(--border)] sm:min-h-10"
                role="group"
                aria-label="Browse view"
              >
                {(["az", "abbreviations"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={view === option}
                    onClick={() => setOne("view", option, "az")}
                    className={cn(
                      "min-w-[8rem] px-3 text-sm font-bold",
                      view === option
                        ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {option === "az" ? "A–Z" : "Abbreviations"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)] sm:min-h-10"
              >
                <Filter className="size-icon-sm" aria-hidden="true" /> Filters{" "}
                {activeCount ? <span className="nums text-[color:var(--clinical-accent)]">{activeCount}</span> : null}
              </button>
              <button
                type="button"
                onClick={() => setOne("sort", sort === "az" ? "za" : "az", "az")}
                className="ml-auto inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text-muted)] sm:min-h-10"
              >
                {sort === "az" ? "A–Z" : "Z–A"}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Browse by letter" className="flex gap-1 overflow-x-auto pb-1">
              {["all", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-current={letter === value ? "page" : undefined}
                  onClick={() => setOne("letter", value, "all")}
                  className={cn(
                    "grid min-h-tap min-w-tap place-items-center rounded-md border text-xs font-extrabold sm:min-h-10 sm:min-w-10",
                    letter === value
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                      : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
                  )}
                >
                  {value === "all" ? "All" : value}
                </button>
              ))}
            </nav>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[76rem] py-2 sm:px-4 sm:py-4">
          <p className="px-4 pb-2 text-xs font-semibold text-[color:var(--text-muted)] sm:px-0">
            {hits.length} showing
          </p>
          <section className="border-y border-[color:var(--border)] sm:border-x" aria-label="Browse results">
            {hits.map((hit) => (
              <DictionaryResultRow
                key={
                  hit.type === "entry"
                    ? hit.entry.slug
                    : hit.type === "abbreviation"
                      ? hit.abbreviation
                      : hit.topic.slug
                }
                hit={hit}
              />
            ))}
          </section>
        </div>
        <InformationPageFooter>
          All published entries link a source · Specialist clinical approval remains pending
        </InformationPageFooter>
      </InformationPageShell>
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId="dictionary-browse-filters"
        testId="dictionary-browse-filters"
        title="Filter browse results"
        groups={groups}
        onClearAll={activeCount ? clearFilters : undefined}
        summary={{ count: hits.length, noun: hits.length === 1 ? "term" : "terms" }}
        onApply={() => setFilterOpen(false)}
      />
    </>
  );
}

function topicMatches(topicSlug: string, query: string, kinds: readonly DictionaryEntryKind[]) {
  const topic = findDictionaryTopic(topicSlug);
  if (!topic) return false;
  const entries = dictionaryTopicEntries(topic);
  if (kinds.length && !entries.some((entry) => kinds.includes(entry.kind))) return false;
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${topic.title} ${topic.description} ${entries.map((entry) => entry.term).join(" ")}`
    .toLocaleLowerCase()
    .includes(needle);
}

export function DictionaryTopicsPage() {
  const { searchParams, replace, setOne, toggleMany } = useDictionaryUrl();
  const query = searchParams.get("q") ?? "";
  const kinds = searchParams
    .getAll("kind")
    .filter((kind): kind is DictionaryEntryKind => dictionaryEntryKinds.includes(kind as DictionaryEntryKind));
  const sort = searchParams.get("sort") === "za" ? "za" : "az";
  const [filterOpen, setFilterOpen] = useState(false);
  const visible = dictionaryTopics
    .filter((topic) => topicMatches(topic.slug, query, kinds))
    .sort((a, b) => (sort === "az" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)));
  const groups = [
    resultFilterFacetGroup({
      id: "kinds",
      label: "Entry kind",
      selected: new Set(kinds),
      options: dictionaryEntryKinds.map((kind) => ({ value: kind, label: dictionaryKindLabel(kind) })),
      onToggle: (value) => toggleMany("kind", value),
    }),
  ];
  return (
    <>
      <InformationPageShell width="bleed" gap={false} testId="dictionary-topics-main">
        <div className="mx-auto grid w-full max-w-[76rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-8">
          <main className="min-w-0">
            <header>
              <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
                Governed collections
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
                Topics
              </h1>
            </header>
            {/* The page-level topic search was removed: twelve collections fit on
                one screen, and the universal composer already searches the whole
                dictionary. Kind filtering and sort stay, as a compact toolbar. */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] pb-3">
              <p className="mr-auto text-sm font-bold text-[color:var(--text-muted)]">
                <span className="nums text-[color:var(--text-heading)]">{visible.length}</span>{" "}
                {visible.length === 1 ? "collection" : "collections"}
              </p>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] hover:border-[color:var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
              >
                <Filter className="size-icon-sm" aria-hidden="true" />
                Filter
                {kinds.length ? <span className="nums text-[color:var(--clinical-accent)]">{kinds.length}</span> : null}
              </button>
              <button
                type="button"
                onClick={() => setOne("sort", sort === "az" ? "za" : "az", "az")}
                className="inline-flex min-h-tap items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
              >
                {sort === "az" ? "A–Z" : "Z–A"}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <section className="border-b border-[color:var(--border)]" aria-label="Clinical topics">
              {visible.map((topic) => {
                const entries = dictionaryTopicEntries(topic);
                return (
                  <Link
                    key={topic.slug}
                    href={`/dictionary/topics/${topic.slug}`}
                    className="group grid min-h-[6rem] grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] py-3 last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <Layers3 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-extrabold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                        {topic.title}
                      </span>
                      <span className="mt-0.5 block text-sm leading-5 text-[color:var(--text-muted)]">
                        {topic.description}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
                        <span className="text-[color:var(--clinical-accent)]">{entries.length} terms</span>
                        {entries.slice(0, 3).map((entry) => (
                          <span
                            key={entry.slug}
                            className="rounded-md bg-[color:var(--surface-inset)] px-1.5 py-0.5 text-3xs"
                          >
                            {entry.aliases.find((alias) => alias.kind === "abbreviation")?.value ?? entry.term}
                          </span>
                        ))}
                      </span>
                    </span>
                    <ArrowRight className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  </Link>
                );
              })}
            </section>
            <div className="mt-3 grid border-y border-[color:var(--border)] lg:hidden">
              <DisclosureLink
                title="Browse by kind"
                summary={`${dictionaryEntryKinds.length} entry kinds`}
                href="/dictionary/browse"
              />
              <DisclosureLink
                title="Common comparisons"
                summary="MSE vs MMSE · Delirium vs dementia"
                href="/dictionary/compare"
              />
            </div>
          </main>
          <aside className="hidden border-l border-[color:var(--border)] pl-6 lg:block">
            <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Browse by kind</h2>
            <div className="mt-2 grid">
              {dictionaryEntryKinds.map((kind) => (
                <Link
                  key={kind}
                  href={`/dictionary/search?view=definitions&kind=${kind}`}
                  className="flex min-h-10 items-center justify-between border-b border-[color:var(--border)] text-sm font-semibold text-[color:var(--clinical-accent)]"
                >
                  {dictionaryKindLabel(kind)}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
            <h2 className="mt-8 text-sm font-extrabold text-[color:var(--text-heading)]">Common comparisons</h2>
            <div className="mt-2 grid">
              <DisclosureLink
                title="MSE vs MMSE"
                summary="Assessment and measurement"
                href="/dictionary/compare?a=mental-state-examination&b=mini-mental-state-examination"
              />
              <DisclosureLink
                title="Delirium vs dementia"
                summary="Cognition"
                href="/dictionary/compare?a=delirium&b=dementia"
              />
              <DisclosureLink
                title="Mood vs affect"
                summary="Mental state examination"
                href="/dictionary/compare?a=mood&b=affect"
              />
            </div>
          </aside>
        </div>
        <InformationPageFooter>
          {dictionaryTopics.length} source-governed collections · {allDictionaryEntries.length} canonical entries
        </InformationPageFooter>
      </InformationPageShell>
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId="dictionary-topic-filters"
        testId="dictionary-topic-filters"
        title="Filter topics"
        groups={groups}
        onClearAll={kinds.length ? () => replace((next) => next.delete("kind")) : undefined}
        summary={{ count: visible.length, noun: visible.length === 1 ? "topic" : "topics" }}
        onApply={() => setFilterOpen(false)}
      />
    </>
  );
}

function DisclosureLink({ title, summary, href }: { title: string; summary: string; href: string }) {
  return (
    <Link
      href={href}
      className="grid min-h-tap grid-cols-[minmax(0,1fr)_auto] items-center border-b border-[color:var(--border)] py-2.5 last:border-b-0"
    >
      <span>
        <span className="block text-sm font-bold text-[color:var(--text-heading)]">{title}</span>
        <span className="block text-xs text-[color:var(--text-muted)]">{summary}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
    </Link>
  );
}

export function DictionaryTopicDetailPage({ topicSlug }: { topicSlug: string }) {
  const topic = findDictionaryTopic(topicSlug);
  const router = useRouter();
  const sectionNav = useInPageSectionNav(topicDetailSections);
  const { searchParams, replace, setOne, toggleMany } = useDictionaryUrl();
  const query = (searchParams.get("q") ?? "").trim().toLocaleLowerCase();
  const kinds = searchParams
    .getAll("kind")
    .filter((kind): kind is DictionaryEntryKind => dictionaryEntryKinds.includes(kind as DictionaryEntryKind));
  const sort = searchParams.get("sort") === "za" ? "za" : "az";
  const [filterOpen, setFilterOpen] = useState(false);
  if (!topic) return null;
  const entries = dictionaryTopicEntries(topic)
    .filter(
      (entry) =>
        (!query ||
          `${entry.term} ${entry.definition} ${entry.aliases.map((alias) => alias.value).join(" ")}`
            .toLocaleLowerCase()
            .includes(query)) &&
        (!kinds.length || kinds.includes(entry.kind)),
    )
    .sort((a, b) => (sort === "az" ? a.term.localeCompare(b.term) : b.term.localeCompare(a.term)));
  const grouped = dictionaryEntryKinds
    .map((kind) => ({ kind, entries: entries.filter((entry) => entry.kind === kind) }))
    .filter((group) => group.entries.length);
  const groups = [
    resultFilterFacetGroup({
      id: "kinds",
      label: "Entry kind",
      selected: new Set(kinds),
      options: Array.from(new Set(dictionaryTopicEntries(topic).map((entry) => entry.kind))).map((kind) => ({
        value: kind,
        label: dictionaryKindLabel(kind),
      })),
      onToggle: (value) => toggleMany("kind", value),
    }),
  ];
  return (
    <>
      <InPageNavHeader
        back={{ href: "/dictionary/topics", label: "Back to topics" }}
        title={topic.title}
        sections={sectionNav.sections}
        activeId={sectionNav.activeId}
        onSelectSection={sectionNav.selectSection}
        primaryAction={{
          label: "Compare terms",
          icon: GitCompareArrows,
          onClick: () => router.push("/dictionary/compare"),
        }}
        actionsTitle="Collection actions"
        actionsDescription="Continue from this governed topic collection."
        actionsNoun="collection"
        testIdPrefix="dictionary-topic-detail"
        actions={
          <div className="grid">
            <Link
              href="/dictionary/compare"
              className="flex min-h-tap items-center gap-2 rounded-lg px-3 text-sm font-bold hover:bg-[color:var(--surface-subtle)]"
            >
              <GitCompareArrows className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
              Compare terms
            </Link>
            <Link
              href="/dictionary/sources"
              className="flex min-h-tap items-center gap-2 rounded-lg px-3 text-sm font-bold hover:bg-[color:var(--surface-subtle)]"
            >
              <BookOpenText className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
              How sources are governed
            </Link>
          </div>
        }
      />
      <InformationPageShell width="bleed" gap={false} testId="dictionary-topic-detail-main">
        <div className="mx-auto grid w-full max-w-[76rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-8">
          <main id="dictionary-topic-terms" className="min-w-0 scroll-mt-page-section">
            <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
              {topic.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{topic.description}</p>
            <p className="mt-2 inline-flex items-center gap-3 text-xs font-semibold text-[color:var(--text-muted)]">
              <span>{topic.entrySlugs.length} terms</span>
              <span className="inline-flex items-center gap-1 text-[color:var(--success)]">
                <Check className="h-4 w-4" aria-hidden="true" />
                Source linked
              </span>
            </p>
            <div className="mt-5 flex gap-2">
              <label className="flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 sm:min-h-10">
                <Search className="size-icon-sm text-[color:var(--decoration-soft)]" aria-hidden="true" />
                <span className="sr-only">Search this topic</span>
                <input
                  defaultValue={searchParams.get("q") ?? ""}
                  onChange={(event) => setOne("q", event.target.value)}
                  placeholder="Search this topic"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold sm:min-h-10"
              >
                <Filter className="size-icon-sm" aria-hidden="true" />
                Filter{kinds.length ? ` ${kinds.length}` : ""}
              </button>
              <button
                type="button"
                onClick={() => setOne("sort", sort === "az" ? "za" : "az", "az")}
                className="hidden min-h-tap items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold sm:inline-flex sm:min-h-10"
              >
                {sort === "az" ? "A–Z" : "Z–A"}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 grid gap-6">
              {grouped.map((group) => (
                <section key={group.kind} aria-labelledby={`group-${group.kind}`}>
                  <h2
                    id={`group-${group.kind}`}
                    className="border-b border-[color:var(--border)] pb-2 text-sm font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]"
                  >
                    {dictionaryKindLabel(group.kind)}
                  </h2>
                  <div>
                    {group.entries.map((entry) => (
                      <DictionaryResultRow
                        key={entry.slug}
                        hit={{ type: "entry", entry, score: 10, reason: topic.title }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div
              id="dictionary-topic-details-phone"
              className="mt-5 grid scroll-mt-page-section border-y border-[color:var(--border)] lg:hidden"
            >
              <details className="border-b border-[color:var(--border)]">
                <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between py-2.5 text-sm font-bold">
                  About this collection
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </summary>
                <div className="pb-4 text-sm leading-6 text-[color:var(--text-muted)]">
                  <p>{topic.description}</p>
                  <p className="mt-2">Australian terminology · Updated 18 Aug 2026</p>
                </div>
              </details>
              <details className="border-b border-[color:var(--border)]">
                <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between py-2.5 text-sm font-bold">
                  Related topics
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </summary>
                <div className="grid pb-2">
                  {topic.relatedTopicSlugs.map((slug) => {
                    const related = findDictionaryTopic(slug);
                    return related ? (
                      <DisclosureLink
                        key={slug}
                        title={related.title}
                        summary={`${related.entrySlugs.length} terms`}
                        href={`/dictionary/topics/${slug}`}
                      />
                    ) : null;
                  })}
                </div>
              </details>
              <details>
                <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between py-2.5 text-sm font-bold">
                  Common comparisons
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </summary>
                <div className="grid pb-2">
                  {topic.curatedComparisons.map(([a, b]) => (
                    <DisclosureLink
                      key={`${a}-${b}`}
                      title={`${allDictionaryEntries.find((entry) => entry.slug === a)?.term ?? a} vs ${allDictionaryEntries.find((entry) => entry.slug === b)?.term ?? b}`}
                      summary="Open comparison"
                      href={`/dictionary/compare?a=${a}&b=${b}`}
                    />
                  ))}
                </div>
              </details>
            </div>
          </main>
          <aside
            id="dictionary-topic-details-desktop"
            aria-label="Collection details"
            className="hidden scroll-mt-page-section border-l border-[color:var(--border)] pl-6 lg:block"
          >
            <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">About this collection</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="text-xs font-bold text-[color:var(--text-muted)]">Scope</dt>
                <dd className="mt-1 text-[color:var(--text)]">{topic.description}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[color:var(--text-muted)]">Region</dt>
                <dd className="mt-1 text-[color:var(--text)]">Australian terminology</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[color:var(--text-muted)]">Updated</dt>
                <dd className="mt-1 text-[color:var(--text)]">18 Aug 2026</dd>
              </div>
            </dl>
            <h2 className="mt-8 text-sm font-extrabold text-[color:var(--text-heading)]">Related topics</h2>
            {topic.relatedTopicSlugs.map((slug) => {
              const related = findDictionaryTopic(slug);
              return related ? (
                <DisclosureLink
                  key={slug}
                  title={related.title}
                  summary={`${related.entrySlugs.length} terms`}
                  href={`/dictionary/topics/${slug}`}
                />
              ) : null;
            })}
            <h2 className="mt-8 text-sm font-extrabold text-[color:var(--text-heading)]">Common comparisons</h2>
            {topic.curatedComparisons.map(([a, b]) => (
              <DisclosureLink
                key={`${a}-${b}`}
                title={`${allDictionaryEntries.find((entry) => entry.slug === a)?.term ?? a} vs ${allDictionaryEntries.find((entry) => entry.slug === b)?.term ?? b}`}
                summary="Open comparison"
                href={`/dictionary/compare?a=${a}&b=${b}`}
              />
            ))}
          </aside>
        </div>
        <InformationPageFooter>
          Collection scope is descriptive · It is not a clinical lesson or care pathway
        </InformationPageFooter>
      </InformationPageShell>
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId="dictionary-topic-detail-filters"
        testId="dictionary-topic-detail-filters"
        title={`Filter ${topic.title}`}
        groups={groups}
        onClearAll={kinds.length ? () => replace((next) => next.delete("kind")) : undefined}
        summary={{ count: entries.length, noun: entries.length === 1 ? "term" : "terms" }}
        onApply={() => setFilterOpen(false)}
      />
    </>
  );
}
