"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  ListChecks,
  MoreVertical,
  Quote,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { DocumentOrganizationBadges, documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { SafeBoldText } from "@/components/SafeBoldText";
import {
  cn,
  floatingControl,
  LoadingPanel,
  metadataPill,
  panelSubtle,
  sourceCard,
  textMuted,
} from "@/components/ui-primitives";
import {
  buildSmartDocumentTagFacets,
  filterDocumentsBySmartTagFacets,
  smartDocumentFacetGroups,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
  type SmartDocumentTagGroup,
} from "@/lib/document-tags";
import type { DocumentMatch, SearchResult } from "@/lib/types";

type SearchFacet = { value: string; count: number };
type ResultTypeFilter = "all" | "tables" | "images" | "pdfs";
export type SearchFacets = {
  status?: SearchFacet[];
  validation?: SearchFacet[];
  extractionQuality?: SearchFacet[];
  sections?: SearchFacet[];
  labels?: SearchFacet[];
  sites?: SearchFacet[];
  documentTypes?: SearchFacet[];
  evidence?: SearchFacet[];
};

const documentFacetIcons: Record<SmartDocumentTagGroup, LucideIcon> = {
  Site: FileText,
  Medication: Target,
  Risk: ShieldAlert,
  Workflow: ListChecks,
  Topic: Tag,
  Population: FileText,
  Setting: FileText,
  Service: Sparkles,
  "Document type": FileText,
  Manual: Sparkles,
};

function DocumentTagFacetRail({
  groups,
  activeKeys,
  onToggle,
  onClear,
}: {
  groups: Array<{ group: SmartDocumentTagGroup; facets: SmartDocumentTagFacet[] }>;
  activeKeys: string[];
  onToggle: (facet: SmartDocumentTagFacet) => void;
  onClear: () => void;
}) {
  if (groups.length === 0) return null;
  const active = new Set(activeKeys);

  return (
    <aside
      aria-label="Document tag filters"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Tag facets</p>
        {activeKeys.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(floatingControl, "min-h-11 px-2 text-[11px] sm:min-h-8")}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {smartDocumentFacetGroups
          .map((group) => groups.find((item) => item.group === group))
          .filter((group): group is { group: SmartDocumentTagGroup; facets: SmartDocumentTagFacet[] } => Boolean(group))
          .map(({ group, facets }) => {
            const Icon = documentFacetIcons[group];
            return (
              <section key={group} className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                  <Icon className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                  {group}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {facets.map((facet) => {
                    const selected = active.has(facet.key);
                    return (
                      <button
                        key={facet.key}
                        type="button"
                        onClick={() => onToggle(facet)}
                        aria-pressed={selected}
                        title={`Filter to ${facet.label}`}
                        className={cn(
                          "inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border px-2 text-[11px] font-semibold shadow-[var(--shadow-inset)] transition",
                          selected
                            ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                            : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                        )}
                      >
                        <span className="truncate">{facet.label}</span>
                        <span className="rounded bg-[color:var(--surface)] px-1 text-[10px] text-[color:var(--text-soft)]">
                          {facet.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </aside>
  );
}

function documentKindLabel(document: DocumentMatch) {
  const fileName = document.file_name.toLowerCase();
  if (document.imageCount > 0 && document.tableCount > 0) return "Guideline";
  if (document.tableCount > 0) return "Table source";
  if (fileName.endsWith(".pdf")) return "PDF";
  return "Document";
}

function documentPageLabel(document: DocumentMatch) {
  const pages = document.bestPages.filter((page) => Number.isFinite(page));
  if (pages.length === 0) return "Page n/a";
  if (pages.length === 1) return `p.${pages[0]}`;
  return `p.${pages.slice(0, 2).join("-")}`;
}

function resultTypeTabs(matches: DocumentMatch[]) {
  const tabs = [
    { key: "all" as const, label: "All", count: matches.length },
    { key: "tables" as const, label: "Tables", count: matches.filter((match) => match.tableCount > 0).length },
    { key: "images" as const, label: "Images", count: matches.filter((match) => match.imageCount > 0).length },
    {
      key: "pdfs" as const,
      label: "PDFs",
      count: matches.filter((match) => match.file_name.toLowerCase().endsWith(".pdf")).length,
    },
  ];

  return tabs.filter((tab) => tab.key === "all" || tab.count > 0);
}

function filterMatchesByResultType(matches: DocumentMatch[], filter: ResultTypeFilter) {
  if (filter === "tables") return matches.filter((match) => match.tableCount > 0);
  if (filter === "images") return matches.filter((match) => match.imageCount > 0);
  if (filter === "pdfs") return matches.filter((match) => match.file_name.toLowerCase().endsWith(".pdf"));
  return matches;
}

function compactEvidenceBadges(document: DocumentMatch) {
  return [
    document.file_name.toLowerCase().endsWith(".pdf")
      ? "PDF"
      : document.file_name.split(".").pop()?.toUpperCase() || "DOC",
    documentPageLabel(document),
    document.tableCount > 0 ? `${document.tableCount} table${document.tableCount === 1 ? "" : "s"}` : "",
    document.imageCount > 0 ? `${document.imageCount} image${document.imageCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
}

function compactMatchReason(document: DocumentMatch) {
  const relevance = document.relevance;
  if (relevance?.verdict === "direct") {
    if (document.tableCount > 0) return `Table match - ${documentPageLabel(document)}`;
    if (document.imageCount > 0) return `Image match - ${documentPageLabel(document)}`;
    return `Source match - ${documentPageLabel(document)}`;
  }
  if (relevance?.verdict === "partial") return `Related source - ${documentPageLabel(document)}`;
  if (document.matchReason) return document.matchReason;
  return `${documentKindLabel(document)} - ${documentPageLabel(document)}`;
}

function relevancePercent(document: DocumentMatch) {
  const verdict = document.relevance?.verdict as string | undefined;
  if (verdict === "direct") return 96;
  if (verdict === "partial") return 84;
  if (verdict === "nearby") return 78;
  const values = [document.relevance?.score, document.score].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const raw = values[0] ?? 0;
  if (raw > 0 && raw < 0.1) return 96;
  const normalized = raw > 1 ? raw : raw * 100;
  return Math.max(0, Math.min(99, Math.round(normalized)));
}

function relevanceTone(document: DocumentMatch) {
  const verdict = document.relevance?.verdict as string | undefined;
  const percent = relevancePercent(document);
  if (verdict === "direct" || percent >= 90) return { label: "Strong match", short: `${percent}% match` };
  if (verdict === "partial" || percent >= 75) return { label: "Related source", short: `${percent}% related` };
  return { label: "Nearby source", short: `${percent}% nearby` };
}

function FileTypeTile({ document }: { document: DocumentMatch }) {
  const extension = document.file_name.split(".").pop()?.toUpperCase() || "DOC";
  const isDocx = extension === "DOCX" || extension === "DOC";
  return (
    <span
      className={cn(
        "grid h-14 w-14 shrink-0 place-items-center rounded-lg border text-[10px] font-bold uppercase shadow-[var(--shadow-inset)]",
        isDocx
          ? "border-[color:var(--info)]/15 bg-[color:var(--info-soft)]/60 text-[color:var(--info)]"
          : "border-[color:var(--clinical-chat-teal)]/12 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
      )}
      aria-hidden
    >
      <FileText className="h-5 w-5" />
      <span className="mt-0.5 leading-none">{extension}</span>
    </span>
  );
}

const exploreEntries = [
  {
    title: "Documents",
    detail: "Guidelines, protocols, policies",
    icon: FileText,
    query: "clinical guideline",
  },
  {
    title: "Tables",
    detail: "Monitoring and threshold tables",
    icon: FileSpreadsheet,
    query: "monitoring table",
  },
  {
    title: "Images",
    detail: "Figures, forms, diagrams",
    icon: FileImage,
    query: "diagram",
  },
  {
    title: "Quotes",
    detail: "Evidence statements",
    icon: Quote,
    query: "clinical recommendation",
  },
] as const;

const startRows = [
  {
    title: "Recent documents",
    detail: "Continue with recently viewed documents",
    icon: ListChecks,
    query: "recent documents",
  },
  {
    title: "Browse library",
    detail: "Explore all indexed clinical documents",
    icon: FolderOpen,
    query: "clinical guideline",
  },
  {
    title: "Open a source PDF",
    detail: "Search by source name or file title",
    icon: ExternalLink,
    query: "PDF",
  },
] as const;

function DocumentSearchHome({
  documentCount,
  onSuggestedSearch,
}: {
  documentCount: number;
  onSuggestedSearch: (query: string) => void;
}) {
  const suggestedSearches = ["lithium", "clozapine", "ECT pathway"];
  const [localQuery, setLocalQuery] = useState("");
  const trimmedLocalQuery = localQuery.trim();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 py-4 sm:py-8">
      <section data-testid="document-home-overview" className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-[1.25rem] bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
          <FileText className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-normal text-[color:var(--text-heading)]">Documents</h2>
        <p className={cn("mx-auto mt-2 max-w-xs text-sm leading-6", textMuted)}>
          Find source PDFs, guidelines, policies, forms, tables, and figures.
        </p>
        {documentCount > 0 ? (
          <span className={cn(metadataPill, "nums mx-auto mt-3 min-h-7 px-2.5 text-[11px]")}>
            {documentCount.toLocaleString()} indexed
          </span>
        ) : null}
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmedLocalQuery) onSuggestedSearch(trimmedLocalQuery);
        }}
        className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2 shadow-[var(--shadow-tight)] sm:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        <label className="relative block min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
          <input
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            aria-label="Search your clinical documents"
            placeholder="Search your clinical documents"
            className="min-h-11 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-9 pr-3 text-sm font-medium text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/15"
          />
        </label>
        <button
          type="button"
          className={cn(
            floatingControl,
            "min-h-11 justify-center rounded-md px-3 text-xs text-[color:var(--text-muted)]",
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort: Relevance
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="submit"
          disabled={!trimmedLocalQuery}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-chat-teal)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </form>

      <section
        data-testid="document-home-recent-sources"
        className={cn(panelSubtle, "p-4 shadow-[0_8px_22px_rgb(15_27_45_/_5%)] sm:p-5")}
      >
        <h3 className="text-base font-semibold text-[color:var(--text-heading)]">Start here</h3>
        <div className="mt-3 divide-y divide-[color:var(--border)]">
          {startRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.title}
                type="button"
                onClick={() => onSuggestedSearch(row.query)}
                className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left first:pt-1 last:pb-1"
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{row.title}</span>
                  <span className={cn("mt-0.5 block truncate text-xs", textMuted)}>{row.detail}</span>
                </span>
                <ChevronDown className="-rotate-90 text-[color:var(--text-soft)]" />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Explore document evidence" className="grid gap-2 sm:grid-cols-4">
        {exploreEntries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.title}
              type="button"
              onClick={() => onSuggestedSearch(entry.query)}
              className="grid min-h-[88px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 text-left shadow-[var(--shadow-tight)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] sm:block sm:min-h-[118px]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 sm:mt-3 sm:block">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{entry.title}</span>
                <span className={cn("mt-0.5 block line-clamp-2 text-xs leading-5", textMuted)}>{entry.detail}</span>
              </span>
              <ChevronDown className="-rotate-90 text-[color:var(--text-soft)] sm:hidden" />
            </button>
          );
        })}
      </section>

      <section aria-label="Suggested searches">
        <p className={cn("mb-2 text-sm font-semibold", textMuted)}>Suggested searches</p>
        <div className="flex flex-wrap gap-2">
          {suggestedSearches.map((search) => (
            <button
              key={search}
              type="button"
              onClick={() => onSuggestedSearch(search)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
            >
              <Search className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" />
              {search}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchResultsHeader({ resultLabel, trimmedQuery }: { resultLabel: string; trimmedQuery: string }) {
  return (
    <section className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-6 text-[color:var(--text-heading)]">{resultLabel}</h3>
            {trimmedQuery ? (
              <p className="truncate text-sm font-medium text-[color:var(--clinical-chat-teal)]">{trimmedQuery}</p>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        className={cn(
          floatingControl,
          "min-h-10 shrink-0 gap-1.5 rounded-lg px-3 text-[11px] text-[color:var(--text-muted)]",
        )}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        Sort: Relevance
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}

export function MatchExplanationChips({ source }: { source: SearchResult }) {
  const explanation = source.match_explanation;
  const reasons = explanation?.reasons?.length
    ? explanation.reasons
    : [
        source.score_explanation?.titleBoost ? "title" : "",
        source.score_explanation?.textRank ? "text" : "",
        source.score_explanation?.vectorScore ? "vector" : "",
        source.source_metadata?.document_status ? `status:${source.source_metadata.document_status}` : "",
      ].filter(Boolean);
  const score = source.score_explanation?.finalScore ?? source.hybrid_score ?? source.similarity;
  const chips = [
    ...reasons.slice(0, 5),
    Number.isFinite(score) ? `score:${Number(score).toFixed(2)}` : "",
    explanation?.indexQualityScore !== undefined && explanation.indexQualityScore !== null
      ? `index:${Number(explanation.indexQualityScore).toFixed(2)}`
      : "",
    explanation?.indexQualityIssues?.length ? "index warning" : "",
    explanation?.tableHit ? "table fact" : "",
    explanation?.indexUnitType ? `unit:${explanation.indexUnitType.replaceAll("_", " ")}` : "",
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.slice(0, 7).map((chip) => (
        <span key={chip} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
          {chip}
        </span>
      ))}
    </div>
  );
}

export function DocumentSearchResultsPanel({
  matches,
  query,
  loading,
  documentCount,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
  facets: _facets,
  onQueryChange,
  onSearch,
  onScopeDocument,
  onAnswerFromDocument,
  onTagSearch,
}: {
  matches: DocumentMatch[];
  query: string;
  loading: boolean;
  documentCount: number;
  realDataReady: boolean;
  authUnavailable: boolean;
  apiUnavailable: boolean;
  setupWarning: string | null;
  facets?: SearchFacets | null;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onScopeDocument: (documentId: string) => void;
  onAnswerFromDocument: (documentId: string) => void;
  onTagSearch: (tag: SmartDocumentTag | SmartDocumentTagFacet) => void;
}) {
  void _facets;
  const trimmedQuery = query.trim();
  const [activeFacetState, setActiveFacetState] = useState<{ query: string; keys: string[] }>({ query: "", keys: [] });
  const [activeResultType, setActiveResultType] = useState<ResultTypeFilter>("all");
  const activeFacetKeys = useMemo(
    () => (activeFacetState.query === query ? activeFacetState.keys : []),
    [activeFacetState, query],
  );
  const tagFacetGroups = useMemo(() => buildSmartDocumentTagFacets(matches, { query }), [matches, query]);
  const visibleMatches = useMemo(
    () => filterDocumentsBySmartTagFacets(matches, activeFacetKeys),
    [matches, activeFacetKeys],
  );
  const resultTabs = useMemo(() => resultTypeTabs(visibleMatches), [visibleMatches]);
  const effectiveResultType = resultTabs.some((tab) => tab.key === activeResultType) ? activeResultType : "all";
  const displayedMatches = useMemo(
    () => filterMatchesByResultType(visibleMatches, effectiveResultType),
    [visibleMatches, effectiveResultType],
  );

  function toggleTagFacet(facet: SmartDocumentTagFacet) {
    setActiveFacetState((current) => {
      const keys = current.query === query ? current.keys : [];
      return {
        query,
        keys: keys.includes(facet.key) ? keys.filter((key) => key !== facet.key) : [...keys, facet.key],
      };
    });
  }

  const unavailableMessage = apiUnavailable
    ? "The local API is unavailable. Check the app server before searching documents."
    : authUnavailable
      ? "Sign in or enable local no-auth mode before listing private indexed documents."
      : !realDataReady
        ? setupWarning || "Complete the search setup before using Documents mode."
        : null;
  const resultLabel = loading
    ? "Finding matching documents"
    : matches.length
      ? `${displayedMatches.length} result${displayedMatches.length === 1 ? "" : "s"}`
      : documentCount === 0
        ? "No indexed source documents"
        : trimmedQuery
          ? "No matching documents"
          : `${documentCount} document${documentCount === 1 ? "" : "s"}`;
  const runSuggestedSearch = (nextQuery: string) => {
    onQueryChange(nextQuery);
    window.setTimeout(() => onSearch(), 0);
  };

  return (
    <div data-testid="document-search-workspace" className="space-y-3">
      {matches.length > 0 || trimmedQuery || loading || unavailableMessage ? (
        <SearchResultsHeader resultLabel={resultLabel} trimmedQuery={trimmedQuery} />
      ) : null}

      {unavailableMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/45 p-4 text-sm font-semibold leading-6 text-[color:var(--warning)]"
        >
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {unavailableMessage}
        </div>
      ) : loading ? (
        <LoadingPanel label="Finding matching documents" />
      ) : matches.length === 0 ? (
        trimmedQuery ? (
          <div className={cn(panelSubtle, "grid gap-3 p-5 text-center sm:p-6")}>
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[color:var(--text-heading)]">
                {documentCount === 0 ? "No indexed source documents" : "No matching documents"}
              </h3>
              <p className={cn("mx-auto mt-1 max-w-md text-sm leading-6", textMuted)}>
                {documentCount === 0
                  ? "Upload and index source documents before using Documents mode."
                  : `No indexed documents matched "${trimmedQuery}". Try a medication, acronym, policy name, or workflow term.`}
              </p>
            </div>
          </div>
        ) : (
          <DocumentSearchHome documentCount={documentCount} onSuggestedSearch={runSuggestedSearch} />
        )
      ) : (
        <>
          {resultTabs.length > 1 ? (
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-1 shadow-[var(--shadow-inset)]">
              {resultTabs.map((tab) => {
                const active = tab.key === effectiveResultType;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveResultType(tab.key)}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-bold transition",
                      active
                        ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                        : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                    )}
                  >
                    {tab.label}
                    <span className="nums opacity-75">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {activeFacetKeys.length > 0 ? (
            <DocumentTagFacetRail
              groups={tagFacetGroups}
              activeKeys={activeFacetKeys}
              onToggle={toggleTagFacet}
              onClear={() => setActiveFacetState({ query, keys: [] })}
            />
          ) : null}
          {activeFacetKeys.length > 0 ? (
            <div className={cn(metadataPill, "min-h-8 w-fit max-w-full text-[11px]")}>
              {displayedMatches.length} result{displayedMatches.length === 1 ? "" : "s"} after filters
            </div>
          ) : null}
          <div className="grid gap-3">
            {displayedMatches.length === 0 ? (
              <div className={cn(panelSubtle, "p-4 text-sm font-semibold text-[color:var(--text-muted)]")}>
                No document matches include all selected filters.
              </div>
            ) : null}
            {displayedMatches.map((document, index) => {
              const evidenceBadges = compactEvidenceBadges(document);
              const relevanceDisplay = relevanceTone(document);
              const openHref = `/documents/${document.document_id}?page=${document.bestPages[0] ?? 1}&chunk=${
                document.bestChunkIds[0] ?? ""
              }`;
              return (
                <article
                  key={document.document_id}
                  className={cn(
                    sourceCard,
                    "relative overflow-hidden p-0 shadow-[0_8px_22px_rgb(15_27_45_/_5%)]",
                    index === 0 && "border-l-4 border-l-[color:var(--clinical-chat-teal)]",
                  )}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 sm:p-4">
                    <FileTypeTile document={document} />
                    <div className="min-w-0 pr-9 sm:pr-24">
                      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
                        {index === 0 ? (
                          <span className="inline-flex min-h-6 items-center gap-1 rounded-md bg-[color:var(--clinical-chat-teal)] px-2 text-[10px] font-bold text-white">
                            <Sparkles className="h-3 w-3" />
                            Best match
                          </span>
                        ) : null}
                        <span className="inline-flex min-h-6 items-center gap-1 rounded-md border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] px-2 text-[10px] font-bold text-[color:var(--clinical-chat-teal)]">
                          <Target className="h-3 w-3" />
                          {relevanceDisplay.short}
                        </span>
                        <button
                          type="button"
                          className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-soft)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] sm:right-2 sm:top-2 sm:h-9 sm:w-9"
                          aria-label={`More actions for ${document.title}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                      <Link
                        href={openHref}
                        className="mt-1 inline-flex min-h-7 items-center text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)]"
                      >
                        <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[color:var(--text-soft)]">
                        <span className="uppercase text-[color:var(--text-muted)]">{documentKindLabel(document)}</span>
                        {evidenceBadges.map((badge) => (
                          <span key={badge} className="inline-flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" aria-hidden />
                            {badge}
                          </span>
                        ))}
                      </div>
                      <DocumentOrganizationBadges document={document} compact className="mt-1.5" />
                      <p className={cn("mt-1 line-clamp-1 text-xs leading-5", textMuted)}>
                        {compactMatchReason(document)}
                      </p>
                      {evidenceBadges.length ? <span className="sr-only">{evidenceBadges.join(", ")}</span> : null}
                      {document.summarySnippet && (
                        <p className={cn("mt-1.5 line-clamp-2 text-xs leading-5", textMuted)}>
                          <SafeBoldText text={document.summarySnippet} />
                        </p>
                      )}
                      <DocumentTagCloud
                        labels={document.labels}
                        query={query}
                        limit={3}
                        className="mt-2"
                        onTagClick={onTagSearch}
                      />
                      <div className="absolute right-3 top-14 hidden rounded-lg bg-[color:var(--clinical-chat-teal-soft)] px-3 py-2 text-center text-[color:var(--clinical-chat-teal)] sm:block">
                        <span className="nums block text-lg font-bold leading-none">{relevancePercent(document)}%</span>
                        <span className="mt-1 block text-[10px] font-bold leading-none">{relevanceDisplay.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-[color:var(--border)]">
                    <Link
                      href={openHref}
                      className="inline-flex min-h-11 items-center justify-center gap-2 border-r border-[color:var(--border)] text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
                      aria-label={`Open ${document.title}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => onScopeDocument(document.document_id)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 border-r border-[color:var(--border)] text-xs font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
                      aria-label={`Scope search to ${document.title}`}
                    >
                      <Filter className="h-4 w-4" />
                      Scope
                    </button>
                    <button
                      type="button"
                      onClick={() => onAnswerFromDocument(document.document_id)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 text-xs font-semibold text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--clinical-chat-teal-soft)]"
                      aria-label={`Answer from ${document.title}`}
                    >
                      <Sparkles className="h-4 w-4" />
                      Answer
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
