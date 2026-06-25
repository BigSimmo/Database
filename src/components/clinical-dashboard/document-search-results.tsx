"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  FileText,
  Filter,
  ListChecks,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { SafeBoldText } from "@/components/SafeBoldText";
import { QueryCoverageChips, RelevanceBadge } from "@/components/clinical-dashboard/relevance";
import {
  cn,
  floatingControl,
  LoadingPanel,
  metadataPill,
  panelSubtle,
  primaryControl,
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
import type { DocumentMatch, EvidenceRelevance, SearchResult } from "@/lib/types";

type SearchFacet = { value: string; count: number };
export type SearchFacets = {
  status?: SearchFacet[];
  validation?: SearchFacet[];
  extractionQuality?: SearchFacet[];
  sections?: SearchFacet[];
  labels?: SearchFacet[];
  documentTypes?: SearchFacet[];
  evidence?: SearchFacet[];
};

function SearchFacetDisclosure({ facets }: { facets?: SearchFacets | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!facets) return null;
  const chips = [
    ...(facets.status ?? []).map((facet) => ({ ...facet, prefix: "status" })),
    ...(facets.documentTypes ?? []).map((facet) => ({ ...facet, prefix: "type" })),
    ...(facets.sections ?? []).map((facet) => ({ ...facet, prefix: "section" })),
    ...(facets.evidence ?? []).map((facet) => ({ ...facet, prefix: "evidence" })),
  ].slice(0, 14);
  if (chips.length === 0) return null;
  return (
    <div className="w-fit max-w-full">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className={cn(
          metadataPill,
          "min-h-11 cursor-pointer list-none gap-1.5 px-2.5 text-[11px] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-8",
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        Result filters
        <span className="text-[color:var(--text-soft)]">({chips.length})</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="mt-2 flex max-w-3xl flex-wrap gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2">
          {chips.map((facet) => (
            <span key={`${facet.prefix}:${facet.value}`} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
              {facet.prefix}: {facet.value} ({facet.count})
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const documentFacetIcons: Record<SmartDocumentTagGroup, LucideIcon> = {
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
  relevance,
  facets,
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
  relevance?: EvidenceRelevance | null;
  facets?: SearchFacets | null;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onScopeDocument: (documentId: string) => void;
  onAnswerFromDocument: (documentId: string) => void;
  onTagSearch: (tag: SmartDocumentTag | SmartDocumentTagFacet) => void;
}) {
  const trimmedQuery = query.trim();
  const [activeFacetState, setActiveFacetState] = useState<{ query: string; keys: string[] }>({ query: "", keys: [] });
  const activeFacetKeys = useMemo(
    () => (activeFacetState.query === query ? activeFacetState.keys : []),
    [activeFacetState, query],
  );
  const tagFacetGroups = useMemo(() => buildSmartDocumentTagFacets(matches, { query }), [matches, query]);
  const visibleMatches = useMemo(
    () => filterDocumentsBySmartTagFacets(matches, activeFacetKeys),
    [matches, activeFacetKeys],
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
  const canSearch = trimmedQuery.length > 0 && !loading && !unavailableMessage;
  const resultLabel = loading
    ? "Finding matching documents"
    : matches.length
      ? `${visibleMatches.length} result${visibleMatches.length === 1 ? "" : "s"}`
      : documentCount === 0
        ? "No indexed documents"
        : trimmedQuery
          ? "No matching documents"
          : `${documentCount} document${documentCount === 1 ? "" : "s"}`;

  return (
    <div data-testid="document-search-workspace" className="space-y-3">
      <section className={cn(panelSubtle, "space-y-3 p-3 sm:p-4")}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSearch) onSearch();
          }}
          className="flex min-h-[48px] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 shadow-[var(--shadow-inset)]"
        >
          <Search className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search your clinical documents..."
            aria-label="Search your clinical documents"
            className="min-h-[44px] min-w-0 flex-1 bg-transparent text-sm font-medium text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
          />
          <button
            type="submit"
            disabled={!canSearch}
            className={cn(primaryControl, "min-h-11 px-3 text-xs sm:min-h-9")}
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {["All sources", "Document type", "Date / status"].map((label) => (
              <button
                key={label}
                type="button"
                className={cn(
                  floatingControl,
                  "min-h-11 gap-1.5 rounded-lg px-2.5 text-[11px] text-[color:var(--text-muted)] sm:min-h-9",
                )}
              >
                {label === "All sources" ? <Filter className="h-3.5 w-3.5" /> : null}
                {label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={cn(
              floatingControl,
              "min-h-11 gap-1.5 rounded-lg px-2.5 text-[11px] text-[color:var(--text-muted)] sm:min-h-9",
            )}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort: Relevance
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(metadataPill, "nums inline-flex min-h-8 w-fit max-w-full flex-wrap gap-x-1.5 leading-5")}>
          {resultLabel}
          {trimmedQuery ? (
            <>
              {" "}
              <span className="text-[color:var(--text-soft)]">for &quot;{trimmedQuery}&quot;</span>
            </>
          ) : null}
        </div>
        {relevance ? <RelevanceBadge relevance={relevance} /> : null}
      </div>

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
        <div className={cn(panelSubtle, "grid gap-3 p-5 text-center sm:p-6")}>
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-[color:var(--text-heading)]">
              {documentCount === 0
                ? "No indexed documents"
                : trimmedQuery
                  ? "No matching documents"
                  : "Search documents"}
            </h3>
            <p className={cn("mx-auto mt-1 max-w-md text-sm leading-6", textMuted)}>
              {documentCount === 0
                ? "Upload and index source documents before using Documents mode."
                : trimmedQuery
                  ? `No indexed documents matched "${trimmedQuery}". Try a medication, acronym, policy name, or workflow term.`
                  : "Enter a clinical topic, medication, workflow, or policy name to list matching source documents."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <SearchFacetDisclosure facets={facets} />
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
              {visibleMatches.length} result{visibleMatches.length === 1 ? "" : "s"} after tag filters
            </div>
          ) : null}
          <div className="grid gap-3">
            {visibleMatches.length === 0 ? (
              <div className={cn(panelSubtle, "p-4 text-sm font-semibold text-[color:var(--text-muted)]")}>
                No document matches include all selected tag facets.
              </div>
            ) : null}
            {visibleMatches.map((document) => {
              const relevance = document.relevance;
              const showSupportChips = Boolean(relevance && relevance.verdict !== "none");
              return (
                <article key={document.document_id} className={cn(sourceCard, "p-3 sm:p-4")}>
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                    <span className="hidden h-10 w-10 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--clinical-chat-document)] text-[color:var(--text-muted)] sm:grid">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--clinical-chat-teal)]">
                          {documentKindLabel(document)}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]" aria-hidden />
                        <span className={cn("text-[11px] font-semibold", textMuted)}>{document.file_name}</span>
                      </div>
                      <Link
                        href={`/documents/${document.document_id}?page=${document.bestPages[0] ?? 1}&chunk=${document.bestChunkIds[0] ?? ""}`}
                        className="mt-1 inline-flex min-h-[44px] items-center text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)]"
                      >
                        <span className="line-clamp-2">{document.title}</span>
                      </Link>
                      <p className={cn("text-xs leading-5", textMuted)}>
                        {documentPageLabel(document)} · {document.tableCount} tables · {document.imageCount} images
                      </p>
                      <p className={cn("mt-1 text-xs leading-5", textMuted)}>{document.matchReason}</p>
                      {document.summarySnippet && (
                        <p className={cn("mt-2 line-clamp-3 text-[15px] leading-6", textMuted)}>
                          <SafeBoldText text={document.summarySnippet} />
                        </p>
                      )}
                    {relevance && showSupportChips ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RelevanceBadge relevance={relevance} />
                        <QueryCoverageChips relevance={relevance} />
                      </div>
                    ) : null}
                      <DocumentTagCloud
                        labels={document.labels}
                        query={query}
                        limit={4}
                        className="mt-3"
                        onTagClick={onTagSearch}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-3">
                        <Link
                          href={`/documents/${document.document_id}?page=${document.bestPages[0] ?? 1}&chunk=${document.bestChunkIds[0] ?? ""}`}
                          className={cn(floatingControl, "min-h-11 px-2.5 text-xs sm:min-h-9")}
                          aria-label={`Open ${document.title}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => onScopeDocument(document.document_id)}
                          className={cn(floatingControl, "min-h-11 px-2.5 text-xs sm:min-h-9")}
                          aria-label={`Scope search to ${document.title}`}
                        >
                          <Filter className="h-4 w-4" />
                          Scope
                        </button>
                        <button
                          type="button"
                          onClick={() => onAnswerFromDocument(document.document_id)}
                          className={cn(primaryControl, "min-h-11 rounded-lg px-2.5 text-xs sm:min-h-9")}
                          aria-label={`Answer from ${document.title}`}
                        >
                          <Sparkles className="h-4 w-4" />
                          Answer
                        </button>
                      </div>
                    </div>
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
