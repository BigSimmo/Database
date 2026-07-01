"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  FolderOpen,
  ListChecks,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
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
import type { ServiceSearchMatch } from "@/lib/services";
import type { FormSearchMatch } from "@/lib/forms";
import type { DocumentMatch, SearchResult } from "@/lib/types";
import { documentRelevancePercent } from "./relevance-score";

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
  Medication: Target,
  Risk: ShieldAlert,
  Workflow: ListChecks,
  Topic: Tag,
  Population: FileText,
  Setting: FileText,
  Service: Sparkles,
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

function compactEvidenceBadges(document: DocumentMatch): Array<{
  label: string;
  icon: LucideIcon;
  variant?: "neutral" | "relevant";
}> {
  const extension = document.file_name.toLowerCase().endsWith(".pdf")
    ? "PDF"
    : document.file_name.split(".").pop()?.toUpperCase() || "DOC";
  const badges: Array<{ label: string; icon: LucideIcon; variant?: "neutral" | "relevant" }> = [
    { label: extension, icon: FileText },
    { label: documentPageLabel(document), icon: BookOpen },
  ];

  if (document.tableCount > 0) {
    badges.push({
      label: `${document.tableCount} table${document.tableCount === 1 ? "" : "s"}`,
      icon: ListChecks,
      variant: "relevant",
    });
  }

  if (document.imageCount > 0) {
    badges.push({
      label: `${document.imageCount} image${document.imageCount === 1 ? "" : "s"}`,
      icon: FileImage,
      variant: "relevant",
    });
  }

  return badges;
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

function sourceSupportLabel(document: DocumentMatch) {
  const verdict = document.relevance?.verdict as string | undefined;
  if (verdict === "direct") return "Direct source support";
  if (verdict === "partial") return "Partial source support";
  if (verdict === "nearby") return "Nearby source support";
  return "Source match";
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

function WhyThisResultDisclosure({ document }: { document: DocumentMatch }) {
  const relevanceDisplay = relevanceTone(document);
  const matchedTerms = document.relevance?.matchedTerms?.slice(0, 5) ?? [];
  const missingTerms = document.relevance?.missingTerms?.slice(0, 4) ?? [];
  const evidenceTypes = [
    document.tableCount > 0 ? `${document.tableCount} table${document.tableCount === 1 ? "" : "s"}` : "",
    document.imageCount > 0 ? `${document.imageCount} image${document.imageCount === 1 ? "" : "s"}` : "",
    document.file_name.toLowerCase().endsWith(".pdf") ? "PDF source" : "",
  ].filter(Boolean);

  return (
    <details className="group relative min-w-0">
      <summary
        className={cn(
          "inline-flex min-h-10 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] [&::-webkit-details-marker]:hidden",
        )}
      >
        Why this result?
        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-2 grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 text-xs leading-5 text-[color:var(--text-muted)] shadow-[var(--shadow-lux)] sm:absolute sm:bottom-[calc(100%+0.5rem)] sm:left-0 sm:z-20 sm:w-80">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-[color:var(--text-heading)]">{sourceSupportLabel(document)}</span>
          <span className="nums text-[color:var(--text-soft)]">{relevanceDisplay.detail}</span>
        </div>
        <p>{compactMatchReason(document)}</p>
        {matchedTerms.length ? <p>Matched terms: {matchedTerms.join(", ")}</p> : null}
        {missingTerms.length ? <p>Not directly found: {missingTerms.join(", ")}</p> : null}
        {evidenceTypes.length ? <p>Evidence available: {evidenceTypes.join(", ")}</p> : null}
      </div>
    </details>
  );
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
      description: "Continue reading where you left off",
      icon: Clock3,
      action: onOpenRecentDocuments,
    },
    {
      label: "Browse library",
      description: "Search all indexed sources",
      icon: FolderOpen,
      action: onOpenLibrary,
    },
    {
      label: "Open a source PDF",
      description: "View original source files",
      icon: ExternalLink,
      action: onOpenSourcePdf,
    },
  ];
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-xl flex-col items-center justify-center gap-6 px-0 pb-36 pt-10 text-center sm:min-h-[calc(100dvh-14rem)] sm:pb-32 sm:pt-14">
      <section data-testid="document-search-empty-state" className="grid justify-items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
          <FileText className="h-7 w-7" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-normal text-[color:var(--text-heading)]">Documents</h2>
          <p className={cn("mx-auto max-w-sm text-sm leading-6", textMuted)}>
            Open, browse, and continue reading your clinical sources.
          </p>
        </div>
      </section>
      {desktopComposerSlotId ? (
        <div id={desktopComposerSlotId} className="hidden w-full max-w-3xl lg:block" />
      ) : null}

      <section
        aria-label="Start here"
        className="grid w-full overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-tight)]"
      >
        {startItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className={cn(
                "grid min-h-[72px] w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[color:var(--focus)]",
              )}
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                  {item.label}
                </span>
                <span className={cn("mt-0.5 block truncate text-xs leading-5", textMuted)}>{item.description}</span>
              </span>
              <ChevronDown className="-rotate-90 h-4 w-4 text-[color:var(--text-soft)]" />
            </button>
          );
        })}
      </section>

      <p className="text-xs font-semibold text-[color:var(--text-soft)]" aria-live="polite">
        {documentCount.toLocaleString()} indexed source{documentCount === 1 ? "" : "s"}
      </p>
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

function DocumentResultsOverview({
  documentCount,
  displayedCount,
  matchCount,
  activeFacetCount,
  trimmedQuery,
  onOpenLibrary,
}: {
  documentCount: number;
  displayedCount: number;
  matchCount: number;
  activeFacetCount: number;
  trimmedQuery: string;
  onOpenLibrary: () => void;
}) {
  return (
    <section
      aria-label="Documents overview"
      className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">Documents overview</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <DocumentBadge variant="best" icon={FileText} className="min-h-7 rounded-lg px-2.5 text-[11px]">
            {documentCount.toLocaleString()} indexed
          </DocumentBadge>
          <DocumentBadge variant="neutral" icon={Target} className="min-h-7 rounded-lg px-2.5 text-[11px]">
            {matchCount.toLocaleString()} match{matchCount === 1 ? "" : "es"}
          </DocumentBadge>
          {activeFacetCount > 0 ? (
            <DocumentBadge variant="relevant" icon={Filter} className="min-h-7 rounded-lg px-2.5 text-[11px]">
              {displayedCount.toLocaleString()} after filters
            </DocumentBadge>
          ) : null}
          {trimmedQuery ? (
            <DocumentBadge
              variant="neutral"
              icon={BookOpen}
              className="min-h-7 max-w-full rounded-lg px-2.5 text-[11px]"
            >
              <span className="truncate">{trimmedQuery}</span>
            </DocumentBadge>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenLibrary}
        className={cn(floatingControl, "min-h-9 w-full rounded-lg px-3 text-xs sm:w-auto")}
      >
        <FolderOpen className="h-4 w-4" />
        Browse library
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
      className="grid gap-3 rounded-lg border border-[color:var(--clinical-chat-teal)]/20 bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-tight)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]">
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
        <span className={cn(metadataPill, "min-h-8 px-2.5 text-[11px]")}>{copy.chip}</span>
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
                "grid gap-3 p-3 shadow-[0_8px_18px_rgb(15_27_45_/_4%)] transition hover:border-[color:var(--clinical-chat-teal-border)] sm:p-4",
                index === 0 && "ring-1 ring-[color:var(--clinical-chat-teal)]/15",
              )}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                    {service.catalogueLabel ?? "Source-backed record"}
                  </p>
                  <a
                    href={recordRoute(service.slug)}
                    className="mt-0.5 inline-flex min-h-11 items-center text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)] sm:min-h-7"
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
                    "inline-flex min-h-11 w-full justify-center rounded-lg px-3 text-sm text-[color:var(--clinical-chat-teal)] sm:w-auto",
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
                    <span key={chip} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
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
                      <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
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

export function DocumentSearchResultsPanel({
  matches,
  recordMatches = [],
  recordMode = "services",
  showRecordMatches = false,
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
  showRecordMatches?: boolean;
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
  onOpenRecentDocuments: () => void;
  onOpenLibrary: () => void;
  onOpenSourcePdf: () => void;
  onTagSearch: (tag: SmartDocumentTag | SmartDocumentTagFacet) => void;
  showHome?: boolean;
  desktopComposerSlotId?: string;
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
  const recordMatchCount = recordMatches.length;
  const recordCopy = searchRecordConfig[recordMode];
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

  const unavailableMessage = apiUnavailable
    ? "The local API is unavailable. Check the app server before searching documents."
    : authUnavailable
      ? "Sign in or enable local no-auth mode before listing private indexed documents."
      : !realDataReady
        ? setupWarning || "Complete the search setup before using Documents mode."
        : null;
  const resultLabel = (() => {
    if (loading) {
      return showRecordMatches
        ? `Finding matching ${recordCopy.recordLabel}${recordMatchCount === 1 ? "" : "s"}`
        : "Finding matching documents";
    }
    if (recordMatchCount > 0 && matches.length > 0) {
      return `${recordMatchCount} ${recordCopy.recordLabel}${recordMatchCount === 1 ? "" : "s"} and ${
        displayedMatches.length
      } document${displayedMatches.length === 1 ? "" : "s"}`;
    }
    if (recordMatchCount > 0) return `${recordMatchCount} ${recordCopy.recordLabel}${recordMatchCount === 1 ? "" : "s"}`;
    if (matches.length) return `${displayedMatches.length} document${displayedMatches.length === 1 ? "" : "s"}`;
    if (documentCount === 0) return "No indexed source documents";
    if (trimmedQuery) return "No matching documents";
    return `${documentCount} document${documentCount === 1 ? "" : "s"}`;
  })();
  return (
    <div data-testid="document-search-workspace" className="space-y-3">
      {recordMatchCount > 0 || matches.length > 0 || (trimmedQuery && !shouldShowHome) || loading || unavailableMessage ? (
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
      ) : null}

      {showRecordMatches ? <SearchRecordResults matches={recordMatches} query={query} mode={recordMode} /> : null}

      {loading ? (
        <LoadingPanel label="Finding matching documents" />
      ) : matches.length === 0 ? (
        recordMatchCount > 0 ? null : trimmedQuery && !shouldShowHome ? (
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
          <DocumentResultsOverview
            documentCount={documentCount}
            displayedCount={displayedMatches.length}
            matchCount={matches.length}
            activeFacetCount={activeFacetKeys.length}
            trimmedQuery={trimmedQuery}
            onOpenLibrary={onOpenLibrary}
          />
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
              const relevanceVariant = relevanceDisplay.short === "High relevance" ? "high" : "relevant";
              const summaryText = cleanDocumentCardSummary(document.summarySnippet || compactMatchReason(document));
              const openHref = documentOpenHref(document);
              return (
                <article
                  key={document.document_id}
                  className={cn(
                    sourceCard,
                    "relative overflow-visible p-0 shadow-[0_8px_18px_rgb(15_27_45_/_4%)] transition hover:border-[color:var(--clinical-chat-teal-border)] hover:shadow-[0_14px_32px_rgb(15_27_45_/_7%)]",
                    index === 0 && "ring-1 ring-[color:var(--clinical-chat-teal)]/15",
                  )}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3 py-3 sm:px-4">
                    <DocumentFileTile kind={fileKind} tone={documentTileTone(fileKind)} compact />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
                            <span>{documentKindLabel(document)}</span>
                            {index === 0 ? (
                              <>
                                <span
                                  className="h-1 w-1 rounded-full bg-[color:var(--border-strong)]"
                                  aria-hidden="true"
                                />
                                <span className="text-[color:var(--clinical-chat-teal)]">Best match</span>
                              </>
                            ) : null}
                          </p>
                          <a
                            href={openHref}
                            className="mt-0.5 inline-flex min-h-11 items-center text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)] sm:min-h-7"
                          >
                            <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                          </a>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <DocumentBadge
                          variant={relevanceVariant}
                          icon={Target}
                          className="min-h-7 rounded-lg px-2.5 text-[11px]"
                        >
                          {relevanceDisplay.short}
                          <span className="sr-only">, {relevanceDisplay.detail}</span>
                        </DocumentBadge>
                        {evidenceBadges.map((badge) => (
                          <DocumentBadge
                            key={badge.label}
                            variant={badge.variant ?? "neutral"}
                            icon={badge.icon}
                            className="min-h-7 rounded-lg px-2.5 text-[11px]"
                          >
                            {badge.label}
                          </DocumentBadge>
                        ))}
                      </div>
                      {evidenceBadges.length ? (
                        <span className="sr-only">{evidenceBadges.map((badge) => badge.label).join(", ")}</span>
                      ) : null}
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
                    <WhyThisResultDisclosure document={document} />
                    <DocumentActionLink
                      href={openHref}
                      className="min-h-11 rounded-lg px-2.5 text-xs text-[color:var(--text)]"
                      aria-label={`Open ${document.title}`}
                    >
                      {contextualOpenLabel(document)}
                    </DocumentActionLink>
                    <DocumentActionButton
                      onClick={() => onScopeDocument(document.document_id)}
                      icon={Filter}
                      className="min-h-11 rounded-lg px-2.5 text-xs text-[color:var(--text)]"
                      aria-label={`Scope search to ${document.title}`}
                    >
                      Scope
                    </DocumentActionButton>
                    <DocumentActionButton
                      onClick={() => onAnswerFromDocument(document.document_id)}
                      icon={Sparkles}
                      className="ml-auto min-h-11 rounded-lg px-2.5 text-xs text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--clinical-chat-teal-soft)]"
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
