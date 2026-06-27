"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  FileText,
  Filter,
  ListChecks,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Target,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { SafeBoldText } from "@/components/SafeBoldText";
import {
  DocumentActionButton,
  DocumentActionLink,
  DocumentBadge,
  DocumentFileTile,
  DocumentMetaRow,
  documentFileKind,
  documentTileTone,
} from "@/components/clinical-dashboard/document-ui";
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

function cleanDocumentCardSummary(value: string) {
  if (/source-backed review/i.test(value)) {
    return "Indexed source text is available for this document.";
  }
  return value;
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
  if (verdict === "direct" || percent >= 90) {
    return { label: "High relevance", short: "High relevance", detail: `${percent}% match` };
  }
  if (verdict === "partial" || percent >= 75) {
    return { label: "High relevance", short: "High relevance", detail: `${percent}% related` };
  }
  return { label: "Relevant", short: "Relevant", detail: `${percent}% nearby` };
}

function documentOpenHref(document: DocumentMatch) {
  const params = new URLSearchParams();
  params.set("page", String(document.bestPages[0] ?? 1));
  const chunkId = document.bestChunkIds[0];
  if (chunkId) params.set("chunk", chunkId);
  return `/documents/${document.document_id}?${params.toString()}`;
}

function DocumentSearchHome({ documentCount }: { documentCount: number }) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-210px)] w-full min-w-0 max-w-[34rem] place-items-start px-3 pb-36 pt-10 sm:min-h-[calc(100dvh-230px)] sm:px-0 sm:pb-40 sm:pt-16 lg:pb-32">
      <section data-testid="document-search-empty-state" className="min-w-0 justify-self-center text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-[1.15rem] bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-[4.5rem] sm:w-[4.5rem] sm:rounded-[1.25rem]">
          <FileText className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-[2rem] font-semibold leading-tight tracking-normal text-[color:var(--text-heading)] sm:text-[2.25rem]">
          Documents
        </h2>
        <p className={cn("mx-auto mt-2 max-w-[34rem] text-base leading-6 sm:leading-7", textMuted)}>
          Find guidelines, policies, forms, and source PDFs.
        </p>
        <div className="mt-4 flex min-w-0 flex-wrap justify-center gap-2">
          <DocumentBadge variant="neutral" icon={FileText} className="min-h-8 rounded-lg px-3 text-xs">
            {documentCount > 0
              ? `${documentCount.toLocaleString()} source${documentCount === 1 ? "" : "s"} indexed`
              : "No indexed sources"}
          </DocumentBadge>
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
              <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)] sm:truncate">
                <span className="block sm:inline">Results for</span>{" "}
                <span className="line-clamp-2 font-semibold text-[color:var(--clinical-chat-teal)] sm:inline sm:line-clamp-none">
                  {trimmedQuery}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        className={cn(
          floatingControl,
          "min-h-11 shrink-0 gap-2 rounded-lg px-3 text-sm text-[color:var(--text-heading)]",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Best match
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
      ? `${displayedMatches.length} document${displayedMatches.length === 1 ? "" : "s"}`
      : documentCount === 0
        ? "No indexed source documents"
        : trimmedQuery
          ? "No matching documents"
          : `${documentCount} document${documentCount === 1 ? "" : "s"}`;

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
          <DocumentSearchHome documentCount={documentCount} />
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
              const fileKind = documentFileKind(document.file_name, "DOC");
              const relevanceVariant = relevanceDisplay.short === "Relevant" ? "relevant" : "high";
              const summaryText = cleanDocumentCardSummary(document.summarySnippet || compactMatchReason(document));
              const openHref = documentOpenHref(document);
              return (
                <article
                  key={document.document_id}
                  className={cn(
                    sourceCard,
                    "relative overflow-hidden p-0 shadow-[0_10px_24px_rgb(15_27_45_/_5%)]",
                    index === 0 && "border-l-4 border-l-[color:var(--clinical-chat-teal)]",
                  )}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
                    <DocumentFileTile kind={fileKind} tone={documentTileTone(fileKind)} className="h-16 w-16 text-xs" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                            {documentKindLabel(document)}
                          </p>
                          <Link
                            href={openHref}
                            className="mt-1 inline-flex min-h-7 items-center text-lg font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)]"
                          >
                            <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                          </Link>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                          {index === 0 ? (
                            <DocumentBadge variant="best" icon={Star} className="min-h-8 rounded-lg px-3 text-xs">
                              Best match
                            </DocumentBadge>
                          ) : null}
                          <DocumentBadge
                            variant={relevanceVariant}
                            icon={TrendingUp}
                            className="min-h-8 rounded-lg px-3 text-xs"
                          >
                            {relevanceDisplay.short}
                            <span className="sr-only">, {relevanceDisplay.detail}</span>
                          </DocumentBadge>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                        {index === 0 ? (
                          <DocumentBadge variant="best" icon={Star} className="min-h-7 rounded-lg px-2.5 text-[11px]">
                            Best match
                          </DocumentBadge>
                        ) : null}
                        <DocumentBadge
                          variant={relevanceVariant}
                          icon={TrendingUp}
                          className="min-h-7 rounded-lg px-2.5 text-[11px]"
                        >
                          {relevanceDisplay.short}
                          <span className="sr-only">, {relevanceDisplay.detail}</span>
                        </DocumentBadge>
                      </div>
                      <DocumentMetaRow className="mt-2 text-sm" items={evidenceBadges} />
                      {evidenceBadges.length ? <span className="sr-only">{evidenceBadges.join(", ")}</span> : null}
                      <p className={cn("mt-2 line-clamp-2 text-sm leading-6", textMuted)}>
                        <SafeBoldText text={summaryText} />
                      </p>
                      <DocumentTagCloud
                        labels={document.labels}
                        query={query}
                        limit={2}
                        className="mt-2"
                        onTagClick={onTagSearch}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-[color:var(--border)]">
                    <DocumentActionLink
                      href={openHref}
                      className="min-h-12 border-r border-[color:var(--border)] text-sm text-[color:var(--text)]"
                      aria-label={`Open ${document.title}`}
                    >
                      Open
                    </DocumentActionLink>
                    <DocumentActionButton
                      onClick={() => onScopeDocument(document.document_id)}
                      icon={Filter}
                      className="min-h-12 border-r border-[color:var(--border)] text-sm text-[color:var(--text)]"
                      aria-label={`Scope search to ${document.title}`}
                    >
                      Scope
                    </DocumentActionButton>
                    <DocumentActionButton
                      onClick={() => onAnswerFromDocument(document.document_id)}
                      icon={Sparkles}
                      className="min-h-12 text-sm text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--clinical-chat-teal-soft)]"
                      aria-label={`Answer from ${document.title}`}
                    >
                      Answer
                    </DocumentActionButton>
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
