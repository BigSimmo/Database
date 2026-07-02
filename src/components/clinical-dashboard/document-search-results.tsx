"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
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
  buildSmartDocumentTagFacetIndex,
  filterDocumentsBySmartTagFacetIndex,
  smartDocumentFacetGroups,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
  type SmartDocumentTagGroup,
} from "@/lib/document-tags";
import type { ServiceSearchMatch } from "@/lib/services";
import type { FormSearchMatch } from "@/lib/forms";
import type { ClinicalDocument, DocumentMatch, SearchResult } from "@/lib/types";
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
          <button type="button" onClick={onClear} className={cn(floatingControl, "min-h-11 px-2 text-2xs sm:min-h-8")}>
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
                <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
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
                          "inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border px-2 text-2xs font-semibold shadow-[var(--shadow-inset)] transition",
                          selected
                            ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                            : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                        )}
                      >
                        <span className="truncate">{facet.label}</span>
                        <span className="rounded bg-[color:var(--surface)] px-1 text-3xs text-[color:var(--text-soft)]">
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

function documentMetadataRecord(document: Pick<ClinicalDocument, "metadata">) {
  return document.metadata && typeof document.metadata === "object" && !Array.isArray(document.metadata)
    ? (document.metadata as Record<string, unknown>)
    : {};
}

function documentStatusText(document: ClinicalDocument) {
  const metadata = documentMetadataRecord(document);
  const sourceStatus = String(metadata.document_status ?? "");
  if (sourceStatus === "review_due") return "Review due";
  if (sourceStatus === "outdated") return "Outdated";
  if (document.status === "indexed") return "Indexed";
  if (document.status === "processing") return "Indexing";
  if (document.status === "failed") return "Failed";
  return "Queued";
}

function formatDocumentDate(value?: string | null) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(date);
}

function topDocumentFacets(documents: ClinicalDocument[]) {
  return buildSmartDocumentTagFacetIndex(documents, { limitPerGroup: 4 })
    .groups.flatMap((group) => group.facets.map((facet) => ({ ...facet, group: facet.group })))
    .slice(0, 8);
}

function DocumentHomeLane({
  title,
  count,
  icon: Icon,
  tone,
}: {
  title: string;
  count: number | string;
  icon: LucideIcon;
  tone: "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
        : "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";

  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg border", toneClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="nums mt-3 text-2xl font-extrabold text-[color:var(--text-heading)]">{count}</p>
      <p className="mt-0.5 text-xs font-bold text-[color:var(--text-muted)]">{title}</p>
    </div>
  );
}

function RecentDocumentLink({ document }: { document: ClinicalDocument }) {
  const kind = documentFileKind(document.file_name, "PDF");
  return (
    <Link
      href={`/documents/${document.id}`}
      className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      <DocumentFileTile kind={kind} tone={documentTileTone(kind)} compact />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">
          {documentDisplayTitle(document)}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[color:var(--text-soft)]">
          {documentStatusText(document)} - {document.page_count} page{document.page_count === 1 ? "" : "s"} -{" "}
          {formatDocumentDate(document.updated_at)}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
    </Link>
  );
}

function DocumentSearchHome({
  documentCount,
  recentDocuments = [],
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenSourcePdf,
  onTagSearch,
  desktopComposerSlotId,
}: {
  documentCount: number;
  recentDocuments?: ClinicalDocument[];
  onOpenRecentDocuments: () => void;
  onOpenLibrary: () => void;
  onOpenSourcePdf: () => void;
  onTagSearch: (tag: SmartDocumentTagFacet) => void;
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
  const recent = recentDocuments.slice(0, 4);
  const reviewDueCount = recentDocuments.filter((document) => {
    const status = String(documentMetadataRecord(document).document_status ?? "");
    return status === "review_due" || status === "outdated";
  }).length;
  const tableLikeCount = recentDocuments.filter((document) =>
    document.labels?.some((label) => /table|chart|checklist|form/i.test(label.label)),
  ).length;
  const previewDocument = recent[0] ?? null;
  const facets = topDocumentFacets(recentDocuments);
  const previewFacetCount = facets.length;

  return (
    <div data-testid="document-search-empty-state" className="mx-auto w-full max-w-6xl space-y-4">
      <section className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
                Documents
              </p>
            </div>
            <h2 className="mt-4 text-balance text-2xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
              Start from source health, recent work, or a focused search.
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
              The library opens as a triage board until you search. Use the composer to jump into compact results, or
              continue with the most recent indexed sources.
            </p>
          </div>
          <div className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              Indexed library
            </p>
            <p className="nums text-4xl font-extrabold text-[color:var(--text-heading)]">
              {documentCount.toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-[color:var(--text-muted)]" aria-live="polite">
              source document{documentCount === 1 ? "" : "s"} ready for search
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)]">
            Command center
          </span>
          <span className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-muted)]">
            Fast scan
          </span>
          {previewFacetCount > 0 ? (
            <span className="ml-auto text-xs font-bold text-[color:var(--text-muted)]">
              {previewFacetCount} live facet{previewFacetCount === 1 ? "" : "s"} active
            </span>
          ) : null}
        </div>

        {desktopComposerSlotId ? <div id={desktopComposerSlotId} className="mt-5 hidden lg:block" /> : null}
      </section>

      <section aria-label="Start here" className="grid grid-cols-3 gap-2 md:gap-3">
        {startItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              className="grid min-h-[5.25rem] grid-cols-1 place-items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-center shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:p-3 md:text-left"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-extrabold leading-4 text-[color:var(--text-heading)] sm:text-sm">
                  {item.label}
                </span>
                <span className="mt-1 hidden text-xs font-medium leading-5 text-[color:var(--text-muted)] md:block">
                  {item.description}
                </span>
              </span>
              <ChevronDown
                className="hidden -rotate-90 h-4 w-4 text-[color:var(--text-soft)] md:block"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <DocumentHomeLane
              title="Current sources"
              count={documentCount.toLocaleString()}
              icon={CheckCircle2}
              tone="success"
            />
            <DocumentHomeLane title="Review states" count={reviewDueCount} icon={AlertCircle} tone="warning" />
            <DocumentHomeLane title="Tables and forms" count={tableLikeCount} icon={ListChecks} tone="info" />
          </div>
          {previewDocument ? (
            <section
              aria-label="Active source preview"
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Active source preview</h3>
                <button
                  type="button"
                  onClick={onOpenRecentDocuments}
                  className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                >
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  History
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                <p className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--text-heading)]">
                  {documentDisplayTitle(previewDocument)}
                </p>
                <p className="text-xs font-semibold text-[color:var(--text-soft)]">
                  {documentStatusText(previewDocument)} • {previewDocument.page_count} page
                  {previewDocument.page_count === 1 ? "" : "s"} • {formatDocumentDate(previewDocument.updated_at)}
                </p>
                <DocumentActionLink
                  href={`/documents/${previewDocument.id}`}
                  icon={ExternalLink}
                  className="min-h-10 w-full rounded-lg px-2.5 text-xs"
                  aria-label={`Open ${documentDisplayTitle(previewDocument)} preview`}
                >
                  Open active source
                </DocumentActionLink>
              </div>
            </section>
          ) : null}
          <section
            aria-label="Smart facets"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Smart facets</h3>
              <button type="button" onClick={onOpenLibrary} className={cn(floatingControl, "min-h-9 px-3 text-xs")}>
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                Browse
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {facets.length ? (
                facets.map((facet) => {
                  const Icon = documentFacetIcons[facet.group] ?? Tag;
                  return (
                    <button
                      key={facet.key}
                      type="button"
                      onClick={() => onTagSearch(facet)}
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                    >
                      <Icon className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                      <span>{facet.label}</span>
                      <span className="nums text-[color:var(--text-soft)]">{facet.count}</span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
                  Facets appear after labels are loaded for indexed documents.
                </p>
              )}
            </div>
          </section>
        </div>

        <section
          aria-label="Recent documents"
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Recent documents</h3>
            <button
              type="button"
              onClick={onOpenRecentDocuments}
              className={cn(floatingControl, "min-h-9 px-3 text-xs")}
            >
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Recent
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {recent.length ? (
              recent.map((document) => <RecentDocumentLink key={document.id} document={document} />)
            ) : (
              <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm font-semibold text-[color:var(--text-muted)]">
                Indexed documents will appear here after upload.
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function SearchResultsHeader({ resultLabel, trimmedQuery }: { resultLabel: string; trimmedQuery: string }) {
  return (
    <section className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-6 text-[color:var(--text-heading)]">{resultLabel}</h3>
            {trimmedQuery ? (
              <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)] sm:truncate">
                <span className="block sm:inline">Results for</span>{" "}
                <span className="line-clamp-2 font-semibold text-[color:var(--clinical-accent)] sm:inline sm:line-clamp-none">
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
          <DocumentBadge variant="best" icon={FileText} className="min-h-7 rounded-lg px-2.5 text-2xs">
            {documentCount.toLocaleString()} indexed
          </DocumentBadge>
          <DocumentBadge variant="neutral" icon={Target} className="min-h-7 rounded-lg px-2.5 text-2xs">
            {matchCount.toLocaleString()} match{matchCount === 1 ? "" : "es"}
          </DocumentBadge>
          {activeFacetCount > 0 ? (
            <DocumentBadge variant="relevant" icon={Filter} className="min-h-7 rounded-lg px-2.5 text-2xs">
              {displayedCount.toLocaleString()} after filters
            </DocumentBadge>
          ) : null}
          {trimmedQuery ? (
            <DocumentBadge variant="neutral" icon={BookOpen} className="min-h-7 max-w-full rounded-lg px-2.5 text-2xs">
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

function EvidencePanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <p className="text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--text-heading)]">{value}</p>
    </div>
  );
}

function SelectedDocumentEvidencePanel({
  document,
  query,
  onScopeDocument,
  onAnswerFromDocument,
}: {
  document: DocumentMatch;
  query: string;
  onScopeDocument: (documentId: string) => void;
  onAnswerFromDocument: (documentId: string) => void;
}) {
  const openHref = documentOpenHref(document);
  const relevanceDisplay = relevanceTone(document);
  const matchedTerms = document.relevance?.matchedTerms?.slice(0, 5) ?? [];
  const missingTerms = document.relevance?.missingTerms?.slice(0, 4) ?? [];
  const evidence = [
    document.tableCount > 0 ? `${document.tableCount} table${document.tableCount === 1 ? "" : "s"}` : "",
    document.imageCount > 0 ? `${document.imageCount} image${document.imageCount === 1 ? "" : "s"}` : "",
    document.file_name.toLowerCase().endsWith(".pdf") ? "PDF text" : documentFileKind(document.file_name, "DOC"),
  ].filter(Boolean);

  return (
    <aside
      aria-label="Selected document evidence"
      className="sticky top-3 grid gap-3 self-start rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-subtle)] p-3 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-start gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
          <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
            Selected evidence
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-extrabold leading-5 text-[color:var(--text-heading)]">
            {documentDisplayTitle(document)}
          </h3>
        </div>
      </div>

      <div className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/65 p-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
          Why this result
        </p>
        <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--text-heading)]">
          {sourceSupportLabel(document)}. {compactMatchReason(document)}
        </p>
        {query.trim() ? (
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
            Search: {query.trim()}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <EvidencePanelRow
          label="Open target"
          value={document.bestChunkIds[0] ? `${documentPageLabel(document)} with chunk` : documentPageLabel(document)}
        />
        <EvidencePanelRow label="Relevance" value={`${relevanceDisplay.short} - ${relevanceDisplay.detail}`} />
        <EvidencePanelRow label="Evidence type" value={evidence.length ? evidence.join(", ") : "Indexed text"} />
        {matchedTerms.length ? <EvidencePanelRow label="Matched terms" value={matchedTerms.join(", ")} /> : null}
        {missingTerms.length ? <EvidencePanelRow label="Nearby terms" value={missingTerms.join(", ")} /> : null}
      </div>

      <div className="grid gap-2">
        <DocumentActionLink
          href={openHref}
          className="min-h-11 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] hover:bg-[color:var(--command-hover)]"
          aria-label={`Open exact evidence for ${document.title}`}
        >
          Open exact evidence
        </DocumentActionLink>
        <div className="grid grid-cols-2 gap-2">
          <DocumentActionButton
            onClick={() => onScopeDocument(document.document_id)}
            icon={Filter}
            className="min-h-11 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-2 text-xs"
            aria-label={`Scope search to ${document.title}`}
          >
            Scope
          </DocumentActionButton>
          <DocumentActionButton
            onClick={() => onAnswerFromDocument(document.document_id)}
            icon={Sparkles}
            className="min-h-11 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 text-xs text-[color:var(--clinical-accent)]"
            aria-label={`Answer from ${document.title}`}
          >
            Answer
          </DocumentActionButton>
        </div>
      </div>
    </aside>
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
                "grid gap-3 p-3 shadow-[0_8px_18px_rgb(15_27_45_/_4%)] transition hover:border-[color:var(--clinical-accent-border)] sm:p-4",
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
                    "inline-flex min-h-11 w-full justify-center rounded-lg px-3 text-sm text-[color:var(--clinical-accent)] sm:w-auto",
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
                      <dt className="text-3xs font-bold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
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
  recentDocuments = [],
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
  recentDocuments?: ClinicalDocument[];
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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
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
  const selectedDocument =
    displayedMatches.find((document) => document.document_id === selectedDocumentId) ?? displayedMatches[0] ?? null;
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
    if (recordMatchCount > 0)
      return `${recordMatchCount} ${recordCopy.recordLabel}${recordMatchCount === 1 ? "" : "s"}`;
    if (matches.length) return `${displayedMatches.length} document${displayedMatches.length === 1 ? "" : "s"}`;
    if (documentCount === 0) return "No indexed source documents";
    if (trimmedQuery) return "No matching documents";
    return `${documentCount} document${documentCount === 1 ? "" : "s"}`;
  })();
  return (
    <div data-testid="document-search-workspace" className="w-full space-y-3">
      {recordMatchCount > 0 ||
      matches.length > 0 ||
      (trimmedQuery && !shouldShowHome) ||
      loading ||
      unavailableMessage ? (
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
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
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
            recentDocuments={recentDocuments}
            onOpenRecentDocuments={onOpenRecentDocuments}
            onOpenLibrary={onOpenLibrary}
            onOpenSourcePdf={onOpenSourcePdf}
            onTagSearch={onTagSearch}
            desktopComposerSlotId={desktopComposerSlotId}
          />
        )
      ) : (
        <>
          <DocumentResultsOverview
            documentCount={Math.max(documentCount, matches.length)}
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
                      "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-2xs font-bold transition",
                      active
                        ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
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
            <div className={cn(metadataPill, "min-h-8 w-fit max-w-full text-2xs")}>
              {displayedMatches.length} result{displayedMatches.length === 1 ? "" : "s"} after filters
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-3">
              {displayedMatches.length === 0 ? (
                <div className={cn(panelSubtle, "p-4 text-sm font-semibold text-[color:var(--text-muted)]")}>
                  No document matches include all selected filters.
                </div>
              ) : null}
              {displayedMatches.map((document, index) => {
                const relevanceDisplay = relevanceTone(document);
                const fileKind = documentFileKind(document.file_name, "DOC");
                const relevanceVariant = relevanceDisplay.short === "High relevance" ? "high" : "relevant";
                const summaryText = cleanDocumentCardSummary(document.summarySnippet || compactMatchReason(document));
                const openHref = documentOpenHref(document);
                const selected = selectedDocument?.document_id === document.document_id;
                return (
                  <article
                    key={document.document_id}
                    className={cn(
                      sourceCard,
                      "relative overflow-visible p-0 shadow-[0_8px_18px_rgb(15_27_45_/_4%)] transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[0_14px_32px_rgb(15_27_45_/_7%)]",
                      selected &&
                        "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent)]/20",
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
                              className="mt-0.5 inline-flex min-h-11 items-center rounded-md text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-7"
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
                      <DocumentActionButton
                        onClick={() => setSelectedDocumentId(document.document_id)}
                        icon={Sparkles}
                        className={cn(
                          "min-h-11 rounded-lg px-2.5 text-xs",
                          selected
                            ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                            : "text-[color:var(--text)]",
                        )}
                        aria-label={`Preview evidence for ${document.title}`}
                      >
                        Preview
                      </DocumentActionButton>
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
                        className="ml-auto min-h-11 rounded-lg px-2.5 text-xs text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]"
                        aria-label={`Answer from ${document.title}`}
                      >
                        Answer
                      </DocumentActionButton>
                    </div>
                  </article>
                );
              })}
            </div>
            {selectedDocument ? (
              <SelectedDocumentEvidencePanel
                document={selectedDocument}
                query={query}
                onScopeDocument={onScopeDocument}
                onAnswerFromDocument={onAnswerFromDocument}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
