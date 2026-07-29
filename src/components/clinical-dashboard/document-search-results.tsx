"use client";

import { memo, useMemo, useState } from "react";
import {
  BookOpen,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  Pill,
  Route,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { ScopeAndGovernanceNotice } from "@/components/clinical-dashboard/answer-content";
import {
  MobileResultFilterControl,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { deriveDocumentSearchUnavailable } from "@/components/clinical-dashboard/document-search-unavailable-status";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { useResultSort } from "@/components/use-result-sort";
import { SafeBoldText } from "@/components/SafeBoldText";
import {
  DocumentActionButton,
  DocumentActionLink,
  DocumentBadge,
  DocumentFileTile,
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
  buildSmartDocumentTagFacetIndex,
  filterDocumentsBySmartTagFacetIndex,
  smartDocumentFacetGroups,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
  type SmartDocumentTagGroup,
} from "@/lib/document-tags";
import type { SourceGovernanceWarning } from "@/lib/source-governance";
import type { ServiceSearchMatch } from "@/lib/services";
import type { FormSearchMatch } from "@/lib/forms";
import type { ClinicalDocument, DocumentMatch, SearchResult, SearchScopeSummary } from "@/lib/types";
import type { RegistryRequestStatus } from "@/lib/use-registry-records";
import { sortResultItems } from "@/lib/result-sort";
import { documentRelevancePercent } from "./relevance-score";

type SearchFacet = { value: string; count: number };
type ResultTypeFilter = "all" | "tables" | "images" | "pdfs";

/** Initial DOM budget for document result cards; further rows reveal on demand. */
const DOCUMENT_RESULTS_INITIAL_WINDOW = 25;
const DOCUMENT_RESULTS_PAGE_SIZE = 25;
export type SearchFacets = {
  status?: SearchFacet[];
  validation?: SearchFacet[];
  extractionQuality?: SearchFacet[];
  sections?: SearchFacet[];
  labels?: SearchFacet[];
  sites?: SearchFacet[];
  documentTypes?: SearchFacet[];
  services?: SearchFacet[];
  settings?: SearchFacet[];
  populations?: SearchFacet[];
  risks?: SearchFacet[];
  clinicalActions?: SearchFacet[];
  carePhases?: SearchFacet[];
  documentIntents?: SearchFacet[];
  contentFeatures?: SearchFacet[];
  evidence?: SearchFacet[];
};

type SearchRecordMode = "services" | "forms";
type SearchRecordMatch = ServiceSearchMatch | FormSearchMatch;

const EMPTY_SOURCE_GOVERNANCE_WARNINGS: SourceGovernanceWarning[] = [];

const searchRecordConfig: Record<
  SearchRecordMode,
  {
    routePrefix: string;
    ariaLabel: string;
    heading: string;
    chip: string;
    recordLabel: string;
    testIdPrefix: string;
  }
> = {
  services: {
    routePrefix: "/services",
    ariaLabel: "Service record matches",
    heading: "Verified service records",
    chip: "Services mode",
    recordLabel: "service record",
    testIdPrefix: "service-search",
  },
  forms: {
    routePrefix: "/forms",
    ariaLabel: "Form record matches",
    heading: "Verified forms",
    chip: "Forms mode",
    recordLabel: "form record",
    testIdPrefix: "form-search",
  },
};

const documentFacetIcons: Record<SmartDocumentTagGroup, LucideIcon> = {
  Site: FileText,
  Medication: Pill,
  Risk: ShieldAlert,
  Workflow: ListChecks,
  Topic: Tag,
  Population: Users,
  Setting: FileText,
  Service: Route,
  "Document type": FileText,
  "Clinical action": ListChecks,
  "Care phase": Clock3,
  "Document intent": Sparkles,
  "Content feature": FileText,
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
        <p className="text-xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">Tag facets</p>
        {activeKeys.length > 0 ? (
          <button type="button" onClick={onClear} className={cn(floatingControl, "min-h-tap px-2 text-2xs sm:min-h-8")}>
            <X aria-hidden="true" className="h-3.5 w-3.5" />
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
                <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                  <Icon className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
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
                          "inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border px-2 text-2xs font-semibold shadow-[var(--shadow-inset)] transition",
                          selected
                            ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                            : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                        )}
                      >
                        <span className="truncate">{facet.label}</span>
                        <span className="rounded bg-[color:var(--surface)] px-1 text-2xs text-[color:var(--text-muted)]">
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
  return `p.${pages[0]} +${pages.length - 1}`;
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

function relevanceTone(document: DocumentMatch) {
  const verdict = document.relevance?.verdict as string | undefined;
  const percent = documentRelevancePercent(document);
  if (verdict === "direct") {
    return { label: "High relevance", short: "High relevance", detail: `${percent}% match` };
  }
  if (verdict === "partial" || percent >= 75) {
    return { label: "Relevant", short: "Relevant", detail: `${percent}% related` };
  }
  return { label: "Related", short: "Related", detail: `${percent}% nearby` };
}

function contextualOpenLabel(document: DocumentMatch) {
  if (document.tableCount > 0) return "Open table";
  if (document.imageCount > 0) return "Open image";
  if (document.file_name.toLowerCase().endsWith(".pdf")) return "Open PDF";
  return "Open source";
}

function documentOpenHref(document: DocumentMatch) {
  const params = new URLSearchParams();
  params.set("page", String(document.bestPages[0] ?? 1));
  const chunkId = document.bestChunkIds[0];
  if (chunkId) params.set("chunk", chunkId);
  return `/documents/${document.document_id}?${params.toString()}`;
}

function DocumentSearchHome({
  documentCount,
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenSourcePdf,
  desktopComposerSlotId,
}: {
  documentCount: number;
  onOpenRecentDocuments: () => void;
  onOpenLibrary: () => void;
  onOpenSourcePdf: () => void;
  desktopComposerSlotId?: string;
}) {
  const startItems = [
    {
      label: "Recent documents",
      description: "Pick up where you left off.",
      icon: Clock3,
      action: onOpenRecentDocuments,
    },
    {
      label: "Browse sources",
      description: "Filter all indexed sources.",
      icon: BookOpen,
      action: onOpenLibrary,
    },
    {
      label: "Open a source PDF",
      description: "Original source files.",
      icon: ExternalLink,
      action: onOpenSourcePdf,
    },
  ];

  return (
    <ModeHomeTemplate
      testId="document-search-empty-state"
      title="Documents"
      subtitle="Open, browse, and continue reading your clinical sources."
      icon={FileText}
      headingLevel={2}
      desktopComposerSlotId={desktopComposerSlotId}
      actionsLabel="Start here"
      actions={startItems.map((item) => ({
        title: item.label,
        description: item.description,
        icon: item.icon,
        onClick: item.action,
      }))}
      footer={
        <div className="grid w-full gap-3">
          <ModeHomeVerificationFooter
            icon={ShieldCheck}
            label="Searches indexed clinical sources"
            body="Clinical source collection"
          />
          {documentCount > 0 ? (
            <p className="text-xs font-semibold text-[color:var(--text-soft)]" aria-live="polite">
              {documentCount.toLocaleString()} indexed source{documentCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

function DocumentSourceTypeFilters({
  resultTabs,
  activeResultType,
  onResultTypeChange,
}: {
  resultTabs: Array<{ key: ResultTypeFilter; label: string; count: number }>;
  activeResultType: ResultTypeFilter;
  onResultTypeChange: (value: ResultTypeFilter) => void;
}) {
  const resultTypeIcons: Record<ResultTypeFilter, LucideIcon> = {
    all: BookOpen,
    tables: ListChecks,
    images: FileImage,
    pdfs: FileText,
  };

  return (
    <div data-testid="document-results-controls" className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
        Source type
      </span>
      <div
        role="group"
        aria-label="Filter by source type"
        className="polished-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
      >
        {resultTabs.map((tab) => {
          const active = tab.key === activeResultType;
          const Icon = resultTypeIcons[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={active}
              onClick={() => onResultTypeChange(tab.key)}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-bold transition motion-reduce:transition-none sm:text-xs",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                active
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              )}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
              <span className="nums opacity-75">{tab.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function metadataBadgeLabel(document: DocumentMatch) {
  const kind = documentKindLabel(document);
  const page = documentPageLabel(document);
  return `${kind} - ${page}`;
}

function cautionBadgeLabel(document: DocumentMatch) {
  if (document.tableCount > 0) return `${document.tableCount} table${document.tableCount === 1 ? "" : "s"}`;
  if (document.imageCount > 0) return `${document.imageCount} image${document.imageCount === 1 ? "" : "s"}`;
  const missingTerms = document.relevance?.missingTerms?.length ?? 0;
  if (missingTerms > 0) return `${missingTerms} term${missingTerms === 1 ? "" : "s"} nearby`;
  return contextualOpenLabel(document);
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
        <span key={chip} className={cn(metadataPill, "min-h-7 px-2 text-2xs")}>
          {chip}
        </span>
      ))}
    </div>
  );
}

function SearchRecordResults({
  matches,
  query,
  mode,
}: {
  matches: SearchRecordMatch[];
  query: string;
  mode: SearchRecordMode;
}) {
  if (matches.length === 0) return null;
  const copy = searchRecordConfig[mode];
  const recordRoute = (slug: string) => `${copy.routePrefix}/${slug}`;
  return (
    <section
      data-testid={`${copy.testIdPrefix}-results`}
      aria-label={copy.ariaLabel}
      className="grid gap-3 rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-tight)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[color:var(--text-heading)]">{copy.heading}</h3>
            <p className={cn("text-sm leading-5", textMuted)}>
              {matches.length} structured {copy.recordLabel}
              {matches.length === 1 ? "" : "s"} matched
              {query.trim() ? ` "${query.trim()}"` : ""}.
            </p>
          </div>
        </div>
        <span className={cn(metadataPill, "min-h-8 px-2.5 text-2xs")}>{copy.chip}</span>
      </div>

      <div className="grid gap-3">
        {matches.map(({ service, reasons }, index) => {
          const summaryCards = service.summaryCards?.slice(0, 3) ?? [];
          const chips = [
            ...(service.statusChips ?? []).map((chip) => chip.label).filter(Boolean),
            service.primaryContact?.value,
            service.source?.status,
          ].filter((value): value is string => Boolean(value?.trim()));

          return (
            <article
              key={service.slug}
              data-testid={`${copy.testIdPrefix}-result-${service.slug}`}
              className={cn(
                sourceCard,
                "content-auto",
                "grid gap-3 p-3 shadow-[var(--shadow-tight)] transition hover:border-[color:var(--clinical-accent-border)] sm:p-4",
                index === 0 && "ring-1 ring-[color:var(--clinical-accent)]/15",
              )}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                    {service.catalogueLabel ?? "Source-backed record"}
                  </p>
                  <a
                    href={recordRoute(service.slug)}
                    className="mt-0.5 inline-flex min-h-tap items-center text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] sm:min-h-7"
                  >
                    <span className="line-clamp-2">{service.title}</span>
                  </a>
                  <p className={cn("mt-1 line-clamp-2 text-sm leading-6", textMuted)}>
                    {service.subtitle ?? service.bestUse ?? service.route ?? "Open the source-backed record."}
                  </p>
                </div>
                <a
                  href={recordRoute(service.slug)}
                  className={cn(
                    floatingControl,
                    "inline-flex min-h-tap w-full justify-center rounded-lg px-3 text-sm text-[color:var(--clinical-accent)] sm:w-auto",
                  )}
                  aria-label={`Open ${service.title}`}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open
                </a>
              </div>

              {chips.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {chips.slice(0, 5).map((chip) => (
                    <span key={chip} className={cn(metadataPill, "min-h-7 px-2 text-2xs")}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}

              {summaryCards.length ? (
                <dl className="grid gap-2 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5"
                    >
                      <dt className="text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                        {card.label ?? card.id}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                        {card.title ?? "Check record"}
                      </dd>
                      {card.detail ? (
                        <dd className={cn("mt-0.5 text-xs leading-5", textMuted)}>{card.detail}</dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              ) : null}

              {reasons.length ? (
                <p className="text-xs font-medium text-[color:var(--text-soft)]">
                  Matched by {reasons.slice(0, 3).join(", ")}.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RecordRegistryNotice({ status, mode }: { status: RegistryRequestStatus; mode: SearchRecordMode }) {
  if (status === "ready") return null;
  const noun = mode === "forms" ? "forms" : "services";
  const config =
    status === "loading"
      ? { Icon: Loader2, spin: true, tone: "info" as const, text: `Loading your ${noun} registry...` }
      : status === "unauthorized"
        ? {
            Icon: Shield,
            spin: false,
            tone: "warning" as const,
            text: `Your session expired. Sign in again to search your private ${noun} registry.`,
          }
        : {
            Icon: ShieldAlert,
            spin: false,
            tone: "danger" as const,
            text: `Couldn't load the ${noun} registry. Try again shortly.`,
          };
  const toneClass =
    config.tone === "danger"
      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/50 text-[color:var(--danger)]"
      : config.tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 text-[color:var(--warning)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]";
  return (
    <p
      data-testid="dashboard-registry-status-notice"
      className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold", toneClass)}
    >
      <config.Icon className={cn("h-4 w-4 shrink-0", config.spin && "animate-spin")} aria-hidden />
      {config.text}
    </p>
  );
}

function DocumentSearchResultsPanelImpl({
  matches,
  recordMatches = [],
  recordMode = "services",
  recordStatus = "ready",
  showRecordMatches = false,
  query,
  loading,
  documentCount,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
  facets: _facets,
  searchScope = null,
  sourceGovernanceWarnings = EMPTY_SOURCE_GOVERNANCE_WARNINGS,
  onScopeDocument,
  onAnswerFromDocument,
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenSourcePdf,
  onTagSearch,
  showHome = false,
  desktopComposerSlotId,
}: {
  matches: DocumentMatch[];
  recordMatches?: SearchRecordMatch[];
  recordMode?: SearchRecordMode;
  recordStatus?: RegistryRequestStatus;
  showRecordMatches?: boolean;
  query: string;
  loading: boolean;
  documentCount: number;
  recentDocuments?: ClinicalDocument[];
  realDataReady: boolean;
  authUnavailable: boolean;
  apiUnavailable: boolean;
  setupWarning: string | null;
  facets?: SearchFacets | null;
  searchScope?: SearchScopeSummary | null;
  sourceGovernanceWarnings?: SourceGovernanceWarning[];
  onScopeDocument: (documentId: string) => void;
  onAnswerFromDocument: (documentId: string) => void;
  onOpenRecentDocuments: () => void;
  onOpenLibrary: () => void;
  onOpenSourcePdf: () => void;
  onTagSearch: (tag: SmartDocumentTag | SmartDocumentTagFacet) => void;
  showHome?: boolean;
  desktopComposerSlotId?: string;
}) {
  void _facets;
  const [sortValue, setSortValue] = useResultSort();
  const trimmedQuery = query.trim();
  const [activeFacetState, setActiveFacetState] = useState<{ query: string; keys: string[] }>({ query: "", keys: [] });
  const [activeResultType, setActiveResultType] = useState<ResultTypeFilter>("all");
  const activeFacetKeys = useMemo(
    () => (activeFacetState.query === query ? activeFacetState.keys : []),
    [activeFacetState, query],
  );
  const tagFacetIndex = useMemo(() => buildSmartDocumentTagFacetIndex(matches, { query }), [matches, query]);
  const tagFacetGroups = tagFacetIndex.groups;
  const visibleMatches = useMemo(
    () => filterDocumentsBySmartTagFacetIndex(tagFacetIndex, activeFacetKeys),
    [tagFacetIndex, activeFacetKeys],
  );
  const resultTabs = useMemo(() => resultTypeTabs(visibleMatches), [visibleMatches]);
  const effectiveResultType = resultTabs.some((tab) => tab.key === activeResultType) ? activeResultType : "all";
  const displayedMatches = useMemo(
    () => filterMatchesByResultType(visibleMatches, effectiveResultType),
    [visibleMatches, effectiveResultType],
  );
  const sortedMatches = useMemo(
    () => sortResultItems(displayedMatches, sortValue, documentDisplayTitle),
    [displayedMatches, sortValue],
  );
  // Progressive reveal so large libraries do not mount every card on first paint.
  // Reset the window whenever the sorted result set identity changes (query/filter/sort).
  const resultsSignature = [
    trimmedQuery,
    sortValue,
    effectiveResultType,
    activeFacetKeys.join(","),
    sortedMatches.map((document) => document.document_id).join(","),
  ].join("\0");
  const [visibleCountState, setVisibleCountState] = useState({
    signature: resultsSignature,
    count: DOCUMENT_RESULTS_INITIAL_WINDOW,
  });
  if (visibleCountState.signature !== resultsSignature) {
    setVisibleCountState({ signature: resultsSignature, count: DOCUMENT_RESULTS_INITIAL_WINDOW });
  }
  const visibleCount = Math.min(visibleCountState.count, sortedMatches.length);
  const renderedMatches = sortedMatches.slice(0, visibleCount);
  const hasMoreMatches = visibleCount < sortedMatches.length;
  const recordMatchCount = recordMatches.length;
  const shouldShowHome = showHome || !trimmedQuery;

  function toggleTagFacet(facet: SmartDocumentTagFacet) {
    setActiveFacetState((current) => {
      const keys = current.query === query ? current.keys : [];
      return {
        query,
        keys: keys.includes(facet.key) ? keys.filter((key) => key !== facet.key) : [...keys, facet.key],
      };
    });
  }

  const unavailable = deriveDocumentSearchUnavailable({
    apiUnavailable,
    authUnavailable,
    realDataReady,
    setupWarning,
    deployedClinicalKb: isDeployedClinicalKb(),
  });
  const unavailableMessage = unavailable?.message ?? null;
  // On the record path the band's fault panel now reports a failed registry, so
  // RecordRegistryNotice would repeat that verbatim two lines below — the same
  // double-reporting removed from the standalone services/forms pages. Loading
  // is still the notice's to own: the band only says "Searching…" there.
  const recordBandOwnsFault =
    showRecordMatches && (recordStatus === "error" || recordStatus === "not_found" || recordStatus === "unauthorized");
  const showResultsControls = matches.length > 0 && !loading;
  const showIdentityHeader =
    recordMatchCount > 0 ||
    matches.length > 0 ||
    (trimmedQuery && !shouldShowHome) ||
    loading ||
    (unavailableMessage && !shouldShowHome);

  return (
    <div data-testid="document-search-workspace" className="w-full space-y-3">
      {showIdentityHeader ? (
        <SearchResultsHeaderBand
          modeId={showRecordMatches ? recordMode : "documents"}
          query={trimmedQuery}
          matchCount={recordMatchCount + sortedMatches.length}
          // Derive the fault from whichever source this ribbon is actually
          // counting. On the services/forms path the registry has its own status
          // and can be perfectly healthy while the unrelated document API is
          // down; letting that invalidate the ribbon would announce "Couldn't
          // search" and hide a valid recordMatchCount while SearchRecordResults
          // renders those very matches below.
          status={
            showRecordMatches
              ? recordStatus === "unauthorized"
                ? "unauthorized"
                : recordStatus === "error" || recordStatus === "not_found"
                  ? "error"
                  : recordStatus === "loading"
                    ? "loading"
                    : "ready"
              : (unavailable?.status ?? (loading ? "loading" : "ready"))
          }
          faultBody={showRecordMatches ? undefined : (unavailableMessage ?? undefined)}
          sortValue={sortValue}
          onSortChange={matches.length > 0 ? setSortValue : undefined}
          utilityControls={
            !loading && !shouldShowHome ? (
              <button
                type="button"
                onClick={onOpenLibrary}
                aria-label="Open source filters"
                title="Filter and browse sources"
                className={cn(
                  floatingControl,
                  "min-h-tap min-w-tap gap-1.5 rounded-lg bg-[color:var(--surface)] px-2.5 text-xs sm:min-h-10 sm:min-w-10 sm:px-3",
                )}
              >
                <BookOpen aria-hidden="true" className="size-icon-md shrink-0" />
                <span>Sources</span>
              </button>
            ) : null
          }
          filterLabel="Filter documents by source type"
          mobileControls={
            showResultsControls && resultTabs.length > 1 ? (
              <MobileResultFilterControl
                label="Show"
                ariaLabel="Filter by source type"
                testId="document-source-type-select"
                value={effectiveResultType}
                options={resultTabs.map((tab) => ({
                  value: tab.key,
                  label: `${tab.label} (${tab.count})`,
                }))}
                onChange={setActiveResultType}
              />
            ) : null
          }
          filterControls={
            showResultsControls && resultTabs.length > 1 ? (
              <DocumentSourceTypeFilters
                resultTabs={resultTabs}
                activeResultType={effectiveResultType}
                onResultTypeChange={setActiveResultType}
              />
            ) : null
          }
        />
      ) : null}

      {/* When the ribbon is shown it owns this message in its fault panel. This
          standalone alert remains for the routes that render no ribbon, so the
          message is never lost. */}
      {/* The ribbon only carries this message on the documents path; in record
          mode its fault comes from the registry, so the notice must still
          render or an auth/API/setup warning is reported nowhere. */}
      {unavailableMessage && (showRecordMatches || !showIdentityHeader) ? (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/45 p-4 text-sm font-semibold leading-6 text-[color:var(--warning)]"
        >
          {unavailableMessage}
        </div>
      ) : null}

      {!showRecordMatches && trimmedQuery && !shouldShowHome ? (
        <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
      ) : null}

      {showRecordMatches ? (
        <>
          {recordBandOwnsFault ? null : <RecordRegistryNotice status={recordStatus} mode={recordMode} />}
          <SearchRecordResults matches={recordMatches} query={query} mode={recordMode} />
        </>
      ) : null}

      {loading ? (
        <LoadingPanel label="Finding matching documents" />
      ) : matches.length === 0 ? (
        recordMatchCount > 0 ? null : trimmedQuery && !shouldShowHome ? (
          <div className={cn(panelSubtle, "grid gap-3 p-5 text-center sm:p-6")}>
            <span className="mx-auto grid h-tap w-tap place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <FileText aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[color:var(--text-heading)]">No matching documents</h3>
              <p className={cn("mx-auto mt-1 max-w-md text-sm leading-6", textMuted)}>
                {`No documents matched "${trimmedQuery}". Try a medication, acronym, policy name, or workflow term.`}
              </p>
            </div>
          </div>
        ) : (
          <DocumentSearchHome
            documentCount={documentCount}
            onOpenRecentDocuments={onOpenRecentDocuments}
            onOpenLibrary={onOpenLibrary}
            onOpenSourcePdf={onOpenSourcePdf}
            desktopComposerSlotId={desktopComposerSlotId}
          />
        )
      ) : (
        <>
          {activeFacetKeys.length > 0 ? (
            <DocumentTagFacetRail
              groups={tagFacetGroups}
              activeKeys={activeFacetKeys}
              onToggle={toggleTagFacet}
              onClear={() => setActiveFacetState({ query, keys: [] })}
            />
          ) : null}
          {activeFacetKeys.length > 0 ? (
            <div className={cn(metadataPill, "min-h-8 w-fit max-w-full text-2xs")}>
              {sortedMatches.length} result{sortedMatches.length === 1 ? "" : "s"} after filters
            </div>
          ) : null}
          <div className="grid gap-4">
            <div className="min-w-0 space-y-3">
              {sortedMatches.length === 0 ? (
                <div className={cn(panelSubtle, "p-4 text-sm font-semibold text-[color:var(--text-muted)]")}>
                  No document matches include all selected filters.
                </div>
              ) : null}
              {renderedMatches.map((document, index) => {
                const relevanceDisplay = relevanceTone(document);
                const fileKind = documentFileKind(document.file_name, "DOC");
                const relevanceVariant = relevanceDisplay.short === "High relevance" ? "high" : "relevant";
                const summaryText = cleanDocumentCardSummary(document.summarySnippet || compactMatchReason(document));
                const openHref = documentOpenHref(document);
                return (
                  <article
                    key={document.document_id}
                    className={cn(
                      sourceCard,
                      "content-auto",
                      "relative overflow-visible p-0 shadow-[var(--shadow-tight)] transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-hover)]",
                    )}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3 py-3 sm:px-4">
                      <DocumentFileTile kind={fileKind} tone={documentTileTone(fileKind)} compact />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                              <span>{documentKindLabel(document)}</span>
                              {index === 0 ? (
                                <>
                                  <span
                                    className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]"
                                    aria-hidden="true"
                                  />
                                  <span className="text-[color:var(--clinical-accent)]">Best match</span>
                                </>
                              ) : null}
                            </p>
                            <a
                              href={openHref}
                              className="mt-0.5 inline-flex min-h-tap items-center rounded-md text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-7"
                            >
                              <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                            </a>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <DocumentBadge
                            variant={relevanceVariant}
                            icon={Target}
                            className="min-h-7 rounded-lg px-2.5 text-2xs"
                          >
                            {relevanceDisplay.short}
                            <span className="sr-only">, {relevanceDisplay.detail}</span>
                          </DocumentBadge>
                          <DocumentBadge
                            variant="neutral"
                            icon={BookOpen}
                            className="min-h-7 rounded-lg px-2.5 text-2xs"
                          >
                            {metadataBadgeLabel(document)}
                          </DocumentBadge>
                          <DocumentBadge
                            variant={document.tableCount > 0 || document.imageCount > 0 ? "relevant" : "neutral"}
                            icon={
                              document.tableCount > 0 ? ListChecks : document.imageCount > 0 ? FileImage : ExternalLink
                            }
                            className="min-h-7 rounded-lg px-2.5 text-2xs"
                          >
                            {cautionBadgeLabel(document)}
                          </DocumentBadge>
                        </div>
                        <p className={cn("mt-1.5 line-clamp-2 text-sm leading-6", textMuted)}>
                          <SafeBoldText text={summaryText} />
                        </p>
                        <DocumentTagCloud
                          labels={document.labels}
                          query={query}
                          limit={2}
                          compact
                          className="mt-2"
                          onTagClick={onTagSearch}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 border-t border-[color:var(--border)] px-2 py-1.5 sm:px-3">
                      <DocumentActionLink
                        href={openHref}
                        className="min-h-tap rounded-lg px-2.5 text-xs text-[color:var(--text)]"
                        aria-label={`Open ${document.title}`}
                      >
                        {contextualOpenLabel(document)}
                      </DocumentActionLink>
                      <DocumentActionButton
                        onClick={() => onScopeDocument(document.document_id)}
                        icon={Filter}
                        className="min-h-tap rounded-lg px-2.5 text-xs text-[color:var(--text)]"
                        aria-label={`Scope search to ${document.title}`}
                      >
                        Scope
                      </DocumentActionButton>
                      <DocumentActionButton
                        onClick={() => onAnswerFromDocument(document.document_id)}
                        icon={Sparkles}
                        className="ml-auto min-h-tap rounded-lg px-2.5 text-xs text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]"
                        aria-label={`Answer from ${document.title}`}
                      >
                        Answer
                      </DocumentActionButton>
                    </div>
                  </article>
                );
              })}
              {hasMoreMatches ? (
                <button
                  type="button"
                  className={cn(
                    floatingControl,
                    "min-h-tap w-full justify-center rounded-xl px-4 text-sm font-semibold",
                  )}
                  onClick={() =>
                    setVisibleCountState((current) => ({
                      signature: resultsSignature,
                      count: Math.min(current.count + DOCUMENT_RESULTS_PAGE_SIZE, sortedMatches.length),
                    }))
                  }
                  data-testid="document-search-show-more"
                >
                  Show more ({sortedMatches.length - visibleCount} remaining)
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}

      {trimmedQuery && !shouldShowHome ? <UniversalSearchAlsoMatches modeId="documents" query={trimmedQuery} /> : null}
    </div>
  );
}

// Memoized so this panel (and its result list) stops re-rendering on unrelated
// dashboard state changes. It still receives the live `query` prop for its
// header, so keystrokes in documents mode re-render it, but the expensive
// `matches` list only changes on submit; every other parent render is now
// suppressed once the parent's callbacks are stabilized.
export const DocumentSearchResultsPanel = memo(DocumentSearchResultsPanelImpl);
