"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Target,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AccessibleTable } from "@/components/AccessibleTable";
import { documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import {
  DocumentActionAnchor,
  DocumentActionButton,
  DocumentFileTile,
  DocumentMetaRow,
  documentFileKind,
  documentTileTone,
} from "@/components/clinical-dashboard/document-ui";
import { useHideOnScroll } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  appBackdrop,
  clinicalDivider,
  cn,
  codeText,
  eyebrowText,
  fieldControl,
  fieldLabel,
  floatingControl,
  InlineNotice,
  LoadingPanel,
  panel,
  PanelHeading,
  primaryControl,
  proseMeasure,
  sourceCard,
  textMuted,
  toolbarButton,
} from "@/components/ui-primitives";
import { BadgeCluster } from "@/components/clinical-dashboard/clinical-badge";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { formatClinicalDate } from "@/lib/source-metadata";
import { partitionViewerImages } from "@/lib/image-filtering";
import { isLocalNoAuthMode } from "@/lib/client-env";
import { useAuthSession } from "@/lib/supabase/client";
import { SafeBoldText } from "@/components/SafeBoldText";
import { DocumentManagementActions } from "@/components/DocumentManagementActions";
import { Sheet } from "@/components/ui/sheet";
import type {
  ClinicalDocument,
  ClinicalDocumentSummaryProfile,
  DocumentLabel,
  DocumentLabelType,
  DocumentSummaryProfileItem,
  RagAnswer,
} from "@/lib/types";
import {
  cleanClinicalSummaryText,
  sourceTextForCompactDisplay,
  sourceTextForDocumentViewer,
  sourceTextForIndexedPage,
} from "@/lib/source-text-sanitizer";
import { smartEvidenceTags } from "@/lib/evidence-tags";
import { flowIndexedText, parseIndexedSourceText } from "@/lib/indexed-source-formatting";
import {
  formatDocumentSummary,
  type FormattedDocumentSummary as FormattedDocumentSummaryModel,
} from "@/lib/document-summary-formatting";
import { buildDocumentSummaryBadges } from "@/lib/document-summary-badges";

type PageRow = {
  id: string;
  page_number: number;
  text: string;
  ocr_used: boolean;
};

type ImageRow = {
  id: string;
  page_number: number | null;
  caption: string;
  image_type?: string | null;
  searchable?: boolean | null;
  clinical_relevance_score?: number | null;
  labels?: string[] | null;
  source_kind?: string | null;
  tableLabel?: string | null;
  tableTitle?: string | null;
  tableRole?: string | null;
  tableTextSnippet?: string | null;
  clinicalUseClass?: string | null;
  clinicalUseReason?: string | null;
  accessibleTableMarkdown?: string | null;
  tableRows?: string[][] | null;
  tableColumns?: string[] | null;
};

type TableFactRow = {
  id: string;
  document_id: string;
  source_image_id: string | null;
  page_number: number | null;
  table_title: string | null;
  row_label: string | null;
  clinical_parameter: string | null;
  threshold_value: string | null;
  action: string | null;
  metadata?: Record<string, unknown> | null;
};

type ChunkRow = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
  image_ids: string[];
  metadata?: Record<string, unknown> | null;
};

type DocumentSearchResult = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  snippet: string;
  matched_terms: string[];
  image_ids: string[];
  score: number;
};

type DocumentIndexHealth = {
  extractionQuality?: string | null;
  indexedAt?: string | null;
  indexVersion?: string | null;
  warnings?: unknown;
};

const profileSectionLabels: Array<{
  key: keyof Omit<ClinicalDocumentSummaryProfile, "overview">;
  label: string;
}> = [
  { key: "applies_to", label: "Applies to / scope" },
  { key: "key_clinical_actions", label: "Key clinical actions" },
  { key: "medication_dose_monitoring", label: "Medication, dose and monitoring" },
  { key: "thresholds_timing", label: "Thresholds and timing" },
  { key: "escalation_risk_warnings", label: "Escalation and risk warnings" },
  { key: "required_forms_documentation", label: "Required forms / documentation" },
  { key: "not_covered", label: "Not covered / source gaps" },
  { key: "important_tables_images", label: "Important tables / images" },
  { key: "best_questions", label: "Best questions this document can answer" },
  { key: "source_quality_notes", label: "Source quality notes" },
];

const iconButton = toolbarButton;
const primaryButton = primaryControl;
const secondaryButton = floatingControl;
const pdfViewerModeStorageKey = "clinical-kb:pdf-viewer-mode";
const pdfViewerNativeModeBreakpoint = 820;
const pdfViewerModeValue = {
  native: "native",
  canvas: "canvas",
} as const;
const pdfViewerModeNativeValue = pdfViewerModeValue.native;

function getDefaultPdfViewerMode(): boolean {
  return false;
}

function getInitialPdfViewerMode() {
  if (typeof window === "undefined") {
    return {
      useNativePdfViewer: getDefaultPdfViewerMode(),
      hasExplicitPdfViewerMode: false,
    };
  }

  try {
    const savedMode = window.localStorage.getItem(pdfViewerModeStorageKey);
    if (savedMode === pdfViewerModeNativeValue) {
      return { useNativePdfViewer: true, hasExplicitPdfViewerMode: true };
    }

    if (savedMode === pdfViewerModeValue.canvas) {
      return { useNativePdfViewer: false, hasExplicitPdfViewerMode: true };
    }
  } catch {
    // window.localStorage may be unavailable in strict or private-browser contexts.
  }

  return {
    useNativePdfViewer: getDefaultPdfViewerMode(),
    hasExplicitPdfViewerMode: false,
  };
}

function hasProfileItems(items: unknown): items is DocumentSummaryProfileItem[] {
  return Array.isArray(items) && items.some((item) => item && typeof item === "object" && "text" in item);
}

function profileItemText(item: DocumentSummaryProfileItem) {
  return cleanClinicalSummaryText(item.text);
}

function ClinicalSummaryProfile({ profile }: { profile: ClinicalDocumentSummaryProfile }) {
  const sections = profileSectionLabels
    .map((section) => ({ ...section, items: profile[section.key] }))
    .filter((section) => hasProfileItems(section.items));

  return (
    <div data-testid="clinical-document-profile" className="mt-3 space-y-4">
      {profile.overview ? (
        <p className={cn(proseMeasure, "whitespace-pre-wrap text-base-minus leading-6 text-[color:var(--text-muted)]")}>
          <SafeBoldText text={cleanClinicalSummaryText(profile.overview)} />
        </p>
      ) : null}
      {sections.map((section) => (
        <section key={section.key} className="border-t border-[color:var(--border)] pt-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            {section.label}
          </h3>
          <ul className={cn(proseMeasure, "mt-2 space-y-1.5 text-base-minus leading-6 text-[color:var(--text-muted)]")}>
            {section.items.slice(0, section.key === "best_questions" ? 8 : 6).map((item, index) => {
              const text = profileItemText(item);
              if (!text) return null;
              return (
                <li key={`${section.key}:${index}:${text}`} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]"
                  />
                  <span>
                    <SafeBoldText text={text} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Structured renderer for the raw stored summary text, sharing
// ClinicalSummaryProfile's visual language (lead paragraph, eyebrow section
// headings, accent-dot bullets). Collapsed by default with an explicit
// "Show full summary" toggle so nothing is silently hidden.
const collapsedSummarySectionCap = 4;
const collapsedSummaryItemCap = 5;

function FormattedHighYieldSummary({ formatted }: { formatted: FormattedDocumentSummaryModel }) {
  const [expanded, setExpanded] = useState(false);
  if (formatted.isEmpty) return null;

  const visibleSections = expanded
    ? formatted.sections
    : formatted.sections
        .slice(0, collapsedSummarySectionCap)
        .map((section) => ({ ...section, items: section.items.slice(0, collapsedSummaryItemCap) }));
  const totalItems = formatted.sections.reduce((count, section) => count + section.items.length, 0);
  const visibleItems = visibleSections.reduce((count, section) => count + section.items.length, 0);
  const hasOverflow = totalItems > visibleItems || formatted.sections.length > visibleSections.length;

  return (
    <div data-testid="formatted-high-yield-summary" className="mt-3 space-y-4">
      {formatted.lead ? (
        <p className={cn(proseMeasure, "text-base-minus leading-6 text-[color:var(--text-muted)]")}>
          <SafeBoldText text={formatted.lead} />
        </p>
      ) : null}
      {visibleSections.map((section, index) => (
        <section
          key={section.id}
          className={cn((formatted.lead || index > 0) && "border-t border-[color:var(--border)] pt-3")}
        >
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            {section.heading ?? "Key points"}
          </h3>
          <ul className={cn(proseMeasure, "mt-2 space-y-1.5 text-base-minus leading-6 text-[color:var(--text-muted)]")}>
            {section.items.map((item, itemIndex) => (
              <li key={`${section.id}:${itemIndex}`} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]"
                />
                <span>
                  <SafeBoldText text={item} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hasOverflow || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={cn(floatingControl, "min-h-9 px-3 text-xs")}
          data-testid="toggle-full-summary"
        >
          {expanded ? "Show key points only" : "Show full summary"}
        </button>
      ) : null}
      {formatted.truncatedTail ? (
        <p className={cn("text-xs leading-5", textMuted)}>
          Summary trimmed at indexing — open the source PDF for full detail.
        </p>
      ) : null}
    </div>
  );
}

function looksLikeTableText(value?: string | null) {
  return Boolean(value?.includes("|") && value.split("|").filter((cell) => cell.trim()).length >= 3);
}

function DocumentImage({ image }: { image: ImageRow }) {
  const endpoint = `/api/images/${image.id}/signed-url`;
  const [url, setUrl] = useState(() => getCachedSignedUrl(endpoint)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(() => Boolean(getCachedSignedUrl(endpoint)));
  const [loaded, setLoaded] = useState(false);
  const figureRef = useRef<HTMLElement | null>(null);
  const { authorizationHeader, markSessionExpired } = useAuthSession();

  useEffect(() => {
    if (shouldLoad) return () => undefined;

    const element = figureRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return () => undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "640px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return () => undefined;

    const cached = getCachedSignedUrl(endpoint);
    if (cached) {
      let active = true;
      window.requestAnimationFrame(() => {
        if (!active) return;
        setUrl(cached.url);
        setFailed(false);
      });
      return () => {
        active = false;
      };
    }

    let active = true;
    fetch(endpoint, { headers: authorizationHeader })
      .then((response) => {
        if (response.status === 401) markSessionExpired();
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (active && data?.url) {
          setCachedSignedUrl(endpoint, data);
          setUrl(data.url);
          setFailed(false);
        } else if (active) {
          setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, authorizationHeader, endpoint, markSessionExpired, shouldLoad]);

  function retryImage() {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(false);
    setLoaded(false);
    setShouldLoad(true);
    setAttempt((current) => current + 1);
  }

  function handleImageError() {
    clearCachedSignedUrl(endpoint);
    setLoaded(false);
    setFailed(true);
  }

  const tableHeading = sourceTextForCompactDisplay([image.tableLabel, image.tableTitle].filter(Boolean).join(": "));
  const cleanCaption = image.caption ? sourceTextForCompactDisplay(image.caption) : "";
  const tableMarkdown = image.accessibleTableMarkdown?.trim()
    ? image.accessibleTableMarkdown
    : looksLikeTableText(image.tableTextSnippet)
      ? image.tableTextSnippet
      : null;
  const hasStructuredTable = Boolean(tableMarkdown || image.tableRows?.length || image.tableColumns?.length);
  const tableCaption = tableHeading || cleanCaption || "Document table";
  const showImageCaptionLine = cleanCaption && cleanCaption !== tableCaption;
  const displayLabels = smartEvidenceTags(
    image.labels,
    [tableHeading, cleanCaption, image.tableTextSnippet ? sourceTextForCompactDisplay(image.tableTextSnippet) : null]
      .filter(Boolean)
      .join(" "),
  );

  return (
    <figure ref={figureRef} className={cn(sourceCard, "overflow-hidden p-3")}>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.08em]", textMuted)}>
        page {image.page_number ?? "n/a"}
        {image.image_type ? ` · ${image.image_type.replaceAll("_", " ")}` : ""}
        {image.tableRole ? ` · ${image.tableRole}` : ""}
        {image.clinicalUseClass && image.clinicalUseClass !== "clinical_evidence"
          ? ` · ${image.clinicalUseClass.replaceAll("_", " ")}`
          : ""}
      </p>
      <div className="mt-2 rounded-lg bg-[color:var(--surface-inset)] p-3">
        {failed ? (
          <div className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-3 text-center text-xs font-semibold text-[color:var(--warning)]">
            <div>
              <AlertCircle className="mx-auto mb-2 h-4 w-4" />
              Image preview failed.
              <button
                type="button"
                onClick={retryImage}
                className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          // Fixed-aspect frame: placeholder and image share one reserved box so
          // the loaded image never resizes the layout (no content shift on load).
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg">
            {url ? (
              <img
                src={url}
                alt={cleanCaption || tableHeading || "Document image"}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={handleImageError}
                className={cn(
                  "absolute inset-0 h-full w-full rounded-lg object-contain transition-opacity duration-300 motion-reduce:transition-none",
                  loaded ? "opacity-100" : "opacity-0",
                )}
              />
            ) : null}
            {!url || !loaded ? (
              <div className="absolute inset-0 grid place-items-center gap-1 rounded-lg text-center text-xs font-semibold text-[color:var(--text-muted)]">
                {shouldLoad ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading image
                  </>
                ) : (
                  "Image preview will load when visible"
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <figcaption className="mt-3 space-y-2 text-base-minus leading-6 text-[color:var(--text)]">
        {tableHeading ? <p className="font-semibold">{tableHeading}</p> : null}
        {showImageCaptionLine ? <p className={textMuted}>{cleanCaption}</p> : null}
        <AccessibleTable
          caption={tableCaption}
          markdown={tableMarkdown}
          rows={image.tableRows}
          columns={image.tableColumns}
          compact={false}
          expandOnMobile
          dialogTitle={tableCaption}
        />
        {!hasStructuredTable && image.tableTextSnippet ? (
          <p className={cn("text-sm leading-6", textMuted)}>{image.tableTextSnippet}</p>
        ) : null}
        {image.clinicalUseClass && image.clinicalUseClass !== "clinical_evidence" && image.clinicalUseReason ? (
          <p className={cn("text-xs leading-5", textMuted)}>{image.clinicalUseReason}</p>
        ) : null}
      </figcaption>
      {displayLabels.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {displayLabels.map((label) => (
            <span
              key={`${image.id}:${label}`}
              className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 text-3xs font-semibold text-[color:var(--text-muted)]"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

function TableReviewPanel({
  tableFacts,
  canReview,
  busyFactId,
  onReview,
}: {
  tableFacts: TableFactRow[];
  canReview: boolean;
  busyFactId: string | null;
  onReview: (fact: TableFactRow, reviewClass: string) => void;
}) {
  if (!tableFacts.length) return null;
  return (
    <details className={cn(sourceCard, "p-3")} open>
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
        Table review queue ({tableFacts.length})
      </summary>
      <div className="mt-3 grid gap-2">
        {tableFacts.slice(0, 12).map((fact) => {
          const metadata = fact.metadata ?? {};
          const reviewClass = typeof metadata.review_class === "string" ? metadata.review_class : "unreviewed";
          const text = [fact.table_title, fact.row_label, fact.clinical_parameter, fact.threshold_value, fact.action]
            .filter(Boolean)
            .join(" | ");
          return (
            <div
              key={fact.id}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Page {fact.page_number ?? "n/a"} · {reviewClass.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-sm leading-5 text-[color:var(--text)]">{text || "Table fact has no text."}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  ["clinical_useful", "Clinical"],
                  ["administrative", "Admin"],
                  ["reference", "Reference"],
                  ["unrelated", "Unrelated"],
                  ["bad_extraction", "Bad extraction"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!canReview || busyFactId === fact.id}
                    onClick={() => onReview(fact, value)}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-md border px-2 text-2xs font-semibold transition",
                      reviewClass === value
                        ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {busyFactId === fact.id && value === reviewClass ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function DocumentViewerAnchors({
  evidenceHref,
  textHref,
  className,
}: {
  evidenceHref: "#source-evidence" | "#source-evidence-rail";
  textHref: "#source-text-mobile" | "#source-text-desktop";
  className?: string;
}) {
  const anchors = [
    { label: "PDF", href: "#pdf-preview-section", icon: FileText },
    { label: "Evidence", href: evidenceHref, icon: Quote },
    { label: "Text", href: textHref, icon: Search },
    { label: "Summary", href: "#source-summary", icon: Sparkles },
    { label: "Images", href: "#source-images", icon: FileImage },
  ];

  return (
    <nav
      aria-label="Document viewer sections"
      className={cn("flex gap-2 overflow-x-auto pb-1 polished-scroll", className)}
    >
      {anchors.map((anchor) => {
        const Icon = anchor.icon;
        return (
          <a
            key={anchor.href}
            href={anchor.href}
            className="inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--clinical-accent)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <Icon className="h-3.5 w-3.5" />
            {anchor.label}
          </a>
        );
      })}
    </nav>
  );
}

function PinnedSourceEvidence({
  loading,
  chunk,
  compact = false,
  sectionId = "source-evidence",
}: {
  loading: boolean;
  chunk: ChunkRow | undefined;
  compact?: boolean;
  sectionId?: "source-evidence" | "source-evidence-rail";
}) {
  const displayContent = chunk ? flowIndexedText(sourceTextForDocumentViewer(chunk.content)) : "";
  const previewLimit = compact ? 220 : 300;
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const isLong = displayContent.length > previewLimit;
  const expanded = !compact || (chunk?.id ? expandedChunkId === chunk.id : false);
  const showingPreview = compact && isLong && !expanded;
  const visibleContent = showingPreview ? `${displayContent.slice(0, previewLimit).trim()}...` : displayContent;
  const chunkMeta = chunk
    ? [`Page ${chunk.page_number ?? "n/a"}`, `chunk ${chunk.chunk_index}`].filter(Boolean).join(" · ")
    : "";

  if (!loading && !chunk) {
    return (
      <section
        id={sectionId}
        data-testid="pinned-source-evidence"
        className={cn(
          sourceCard,
          "scroll-mt-24 border-[color:var(--clinical-accent)]/20 bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)]",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Quote className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--text)]">Source evidence</p>
            <p className={cn("mt-1 text-xs leading-5", textMuted)}>
              Open a cited answer passage to pin the exact indexed excerpt here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id={sectionId}
      data-testid="pinned-source-evidence"
      className={cn(panel, "scroll-mt-24", compact ? "p-3" : "p-4")}
    >
      <PanelHeading icon={Quote} title="Pinned source evidence" />
      {loading ? (
        <LoadingPanel label="Loading pinned source evidence" />
      ) : chunk ? (
        <div
          data-testid="highlighted-source-passage"
          className={cn("mt-3", compact ? "text-sm leading-6" : "text-base-minus leading-7")}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="inline-flex min-h-6 items-center gap-1.5 rounded-md bg-[color:var(--clinical-accent-soft)] px-2 text-xs font-semibold text-[color:var(--clinical-accent)]">
              <Target className="h-3.5 w-3.5" />
              Highlighted source passage
            </p>
            {chunkMeta ? <p className={cn("text-2xs text-[color:var(--text-muted)]", codeText)}>{chunkMeta}</p> : null}
          </div>
          {chunk.section_heading && (
            <p className="mt-2 text-sm font-semibold text-[color:var(--text)]">{chunk.section_heading}</p>
          )}
          <blockquote className="mt-2 whitespace-pre-line rounded-lg bg-[color:var(--surface-inset)] px-3 py-2.5 text-[color:var(--text)]">
            {visibleContent || "No displayable clinical text was available for this indexed passage."}
          </blockquote>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="#pdf-preview-section" className={cn(primaryButton, "min-h-9 px-3 text-xs")}>
              <ExternalLink className="h-4 w-4" />
              Open source
            </a>
            {compact && isLong ? (
              <button
                type="button"
                onClick={() => setExpandedChunkId((current) => (current === chunk.id ? null : chunk.id))}
                className={cn(secondaryButton, "min-h-9 px-3 text-xs")}
                data-testid="toggle-full-passage"
              >
                {expanded ? "Show passage preview" : "Show full passage"}
              </button>
            ) : null}
          </div>
          {compact ? (
            <p className={cn("mt-2 text-xs leading-5", textMuted)}>
              Full indexed page text remains available in the source text section.
            </p>
          ) : null}
        </div>
      ) : (
        <p className={cn("mt-3 text-base-minus leading-6", textMuted)}>
          Open a citation from an answer to see the exact indexed passage.
        </p>
      )}
    </section>
  );
}

function IndexedSourceText({
  text,
  emptyText,
  compact = false,
}: {
  text: string;
  emptyText: string;
  compact?: boolean;
}) {
  const blocks = parseIndexedSourceText(text);
  if (blocks.length === 0) {
    return <p className={cn("mt-4 text-base-minus leading-6", textMuted)}>{emptyText}</p>;
  }

  return (
    <div className={cn("mt-4 grid", proseMeasure, compact ? "gap-2.5" : "gap-3")}>
      {blocks.map((block) => {
        if (block.type === "heading") {
          return block.level === "title" ? (
            <h3 key={block.id} className="text-base font-semibold leading-6 text-[color:var(--text-heading)]">
              {block.text}
            </h3>
          ) : (
            <h4 key={block.id} className="mt-2 text-sm font-bold text-[color:var(--text-heading)]">
              {block.text}
            </h4>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={block.id}
              className={cn(
                "list-disc space-y-1.5 pl-5 text-base-minus leading-7 text-[color:var(--text)] marker:text-[color:var(--text-soft)]",
                compact && "text-sm leading-6",
              )}
            >
              {block.items.map((item, index) => (
                <li key={`${block.id}:${index}:${item}`} className="pl-1">
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "table") {
          return (
            <AccessibleTable
              key={block.id}
              caption={block.caption}
              rows={block.rows}
              compact={false}
              expandOnMobile
              dialogTitle={block.caption ?? "Document table"}
            />
          );
        }

        return (
          <p
            key={block.id}
            className={cn("text-base-minus leading-7 text-[color:var(--text)]", compact && "text-sm leading-6")}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function highlightTermsFor(terms: string[], fallback: string) {
  const fallbackTerms = fallback
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length >= 3);
  return Array.from(new Set((terms.length ? terms : fallbackTerms).map((term) => term.toLowerCase()).filter(Boolean)));
}

function HighlightedSearchText({ text, terms }: { text: string; terms: string[] }) {
  if (!text.trim() || terms.length === 0) return <>{text}</>;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!escaped.length) return <>{text}</>;
  const matcher = new RegExp(`(${escaped.join("|")})`, "gi");
  return (
    <>
      {text.split(matcher).map((part, index) =>
        terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
          <mark
            key={`${part}:${index}`}
            className="rounded-sm bg-[color:var(--clinical-accent-soft)] px-0.5 font-semibold text-[color:var(--clinical-accent)]"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}:${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function IndexedTextPanel({
  loading,
  selectedPage,
  chunks,
  search,
  documentSearchResults,
  searchingDocument,
  documentSearchError,
  idPrefix,
  sectionId,
  selectedChunkId,
  onSearchChange,
}: {
  loading: boolean;
  selectedPage: PageRow | undefined;
  chunks: ChunkRow[];
  search: string;
  documentSearchResults: DocumentSearchResult[];
  searchingDocument: boolean;
  documentSearchError: string | null;
  idPrefix: string;
  sectionId?: "source-text-mobile" | "source-text-desktop";
  selectedChunkId?: string;
  onSearchChange: (value: string) => void;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const displayChunks = chunks.map((chunk) => ({
    ...chunk,
    displayContent: sourceTextForDocumentViewer(chunk.content),
  }));
  const loadedChunkById = new Map(displayChunks.map((chunk) => [chunk.id, chunk]));
  const visibleChunks = normalizedSearch
    ? documentSearchResults.map((result) => {
        const loadedChunk = loadedChunkById.get(result.id);
        return {
          id: result.id,
          page_number: result.page_number,
          chunk_index: result.chunk_index,
          section_heading: result.section_heading,
          displayContent: loadedChunk?.displayContent ?? result.snippet,
          matchedTerms: result.matched_terms,
          serverRanked: true,
        };
      })
    : displayChunks.slice(0, 8).map((chunk) => ({ ...chunk, matchedTerms: [], serverRanked: false }));
  const [activeHitIndex, setActiveHitIndex] = useState(0);
  const clampedActiveHitIndex = visibleChunks.length ? Math.min(activeHitIndex, visibleChunks.length - 1) : 0;
  const activeHit = normalizedSearch && visibleChunks.length ? visibleChunks[clampedActiveHitIndex] : null;
  const pageHitCounts = visibleChunks.reduce<Map<number, number>>((counts, chunk) => {
    if (!chunk.page_number) return counts;
    counts.set(chunk.page_number, (counts.get(chunk.page_number) ?? 0) + 1);
    return counts;
  }, new Map());
  const pageHitSummary = Array.from(pageHitCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 5)
    .map(([page, count]) => `p${page}: ${count}`)
    .join(" · ");
  const selectedPageText = selectedPage ? sourceTextForIndexedPage(selectedPage.text) : "";

  useEffect(() => {
    if (!activeHit) return;
    document.getElementById(`${idPrefix}-${activeHit.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeHit, idPrefix]);

  function moveHit(delta: number) {
    if (visibleChunks.length === 0) return;
    setActiveHitIndex((current) => (current + delta + visibleChunks.length) % visibleChunks.length);
  }

  return (
    <section
      id={sectionId}
      data-testid={`${idPrefix}-indexed-text-panel`}
      className={cn(panel, "scroll-mt-24 p-5 source-print")}
    >
      <PanelHeading
        icon={FileText}
        title="Indexed source text"
        description={
          loading
            ? "Loading extracted source text."
            : `Extracted text for page ${selectedPage?.page_number ?? "n/a"} with searchable source passages.`
        }
      />
      <label className="mt-4 block">
        <span className={fieldLabel}>Search within indexed source text</span>
        <input
          value={search}
          onChange={(event) => {
            setActiveHitIndex(0);
            onSearchChange(event.target.value);
          }}
          placeholder="Find a term, warning, or monitoring item"
          className={fieldControl}
        />
      </label>
      {loading ? (
        <LoadingPanel label="Loading indexed source text" />
      ) : selectedPage ? (
        <IndexedSourceText
          text={selectedPageText}
          emptyText="No displayable extracted text has been indexed for this page yet."
        />
      ) : (
        <p className={cn("mt-4 text-base-minus", textMuted)}>No extracted text has been indexed for this page yet.</p>
      )}
      <div className={cn("mt-4 pt-4", clinicalDivider)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[color:var(--text)]">Source passages</p>
          {normalizedSearch ? (
            <span className={cn("text-xs font-semibold", textMuted)}>
              {searchingDocument
                ? "Searching all indexed passages"
                : `${visibleChunks.length} full-document hit${visibleChunks.length === 1 ? "" : "s"}`}
            </span>
          ) : null}
        </div>
        {normalizedSearch && visibleChunks.length > 0 && !searchingDocument ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
            <div className="min-w-0">
              <p className="nums text-xs font-bold text-[color:var(--text)]">
                Hit {clampedActiveHitIndex + 1} of {visibleChunks.length}
              </p>
              <p className={cn("mt-0.5 truncate text-2xs font-semibold", textMuted)}>
                {pageHitSummary || "No page numbers indexed for these hits"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => moveHit(-1)}
                className={cn(secondaryButton, "min-h-9 min-w-9 justify-center p-0")}
                aria-label="Previous document search hit"
                title="Previous document search hit"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveHit(1)}
                className={cn(secondaryButton, "min-h-9 min-w-9 justify-center p-0")}
                aria-label="Next document search hit"
                title="Next document search hit"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
        {documentSearchError ? (
          <p className="mt-2 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--warning)]">
            {documentSearchError}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3">
          {searchingDocument ? (
            <LoadingPanel label="Searching all indexed passages" />
          ) : visibleChunks.length === 0 ? (
            <p className={cn("text-base-minus leading-6", textMuted)}>No indexed passage matched that search.</p>
          ) : (
            visibleChunks.map((chunk) => (
              <article
                id={`${idPrefix}-${chunk.id}`}
                key={chunk.id}
                data-testid={selectedChunkId === chunk.id ? "highlighted-indexed-source-chunk" : undefined}
                data-source-chunk-id={chunk.id}
                className={cn(
                  sourceCard,
                  "overflow-hidden p-0 transition",
                  (selectedChunkId === chunk.id || activeHit?.id === chunk.id) &&
                    "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] shadow-[var(--glow-soft)] ring-2 ring-[color:var(--clinical-accent)]/25",
                )}
              >
                <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-3">
                  <p
                    className={cn(
                      "mb-2 inline-flex min-h-6 items-center rounded-md px-2 text-xs font-bold",
                      selectedChunkId === chunk.id
                        ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : activeHit?.id === chunk.id
                          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                          : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {selectedChunkId === chunk.id
                      ? "Highlighted quoted passage"
                      : activeHit?.id === chunk.id
                        ? "Active search hit"
                        : "Source passage"}
                  </p>
                  <p className={eyebrowText}>
                    Page {chunk.page_number ?? "n/a"} · chunk {chunk.chunk_index}
                    {chunk.serverRanked ? " · full-document search" : ""}
                  </p>
                  {chunk.section_heading && (
                    <p className="mt-1 text-sm font-semibold text-[color:var(--text)]">{chunk.section_heading}</p>
                  )}
                  {chunk.matchedTerms.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chunk.matchedTerms.slice(0, 5).map((term) => (
                        <span
                          key={`${chunk.id}:${term}`}
                          className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-2 text-3xs font-bold text-[color:var(--clinical-accent)]"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="px-3 pb-3">
                  <p className="mb-2 mt-3 text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                    Excerpt
                  </p>
                  {normalizedSearch ? (
                    <p className="whitespace-pre-line rounded-lg bg-[color:var(--surface-inset)] px-3 py-2.5 text-sm leading-6 text-[color:var(--text)]">
                      <HighlightedSearchText
                        text={
                          chunk.displayContent
                            ? flowIndexedText(chunk.displayContent)
                            : "No displayable clinical text was available for this indexed passage."
                        }
                        terms={highlightTermsFor(chunk.matchedTerms, normalizedSearch)}
                      />
                    </p>
                  ) : (
                    <IndexedSourceText
                      text={chunk.displayContent}
                      emptyText="No displayable clinical text was available for this indexed passage."
                      compact
                    />
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function PdfCanvasViewer({ url, title, initialPage }: { url: string; title: string; initialPage: number }) {
  const maxFitScale = 2.8;
  const maxZoomScale = 4;
  const minZoomScale = 0.55;
  const maxRenderScale = 2.5;

  const fullscreenRootRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.1);
  const [fitWidth, setFitWidth] = useState(true);
  const [holderWidth, setHolderWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);

  useEffect(() => {
    let active = true;
    let loadTask: PDFDocumentLoadingTask | null = null;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setPdf(null);
      setTotalPages(0);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadTask = pdfjs.getDocument({ url });
        const loadedPdf = await loadTask.promise;
        if (!active) return;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setPage((current) => Math.min(Math.max(current, 1), loadedPdf?.numPages ?? current));
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load PDF preview.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      active = false;
      setPdf(null);
      void loadTask?.destroy();
    };
  }, [loadAttempt, url]);

  useEffect(() => {
    const nextPage = Math.max(1, initialPage || 1);
    const boundedPage = totalPages > 0 ? Math.min(nextPage, totalPages) : nextPage;
    const frame = window.requestAnimationFrame(() => {
      setPage((current) => (current === boundedPage ? current : boundedPage));
      setPageInput(String(boundedPage));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialPage, totalPages]);

  useEffect(() => {
    if (!holderRef.current) return;
    let timeout: number | undefined;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setHolderWidth(width), 120);
    });

    observer.observe(holderRef.current);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    function updateFullscreenState() {
      const active = document.fullscreenElement === fullscreenRootRef.current;
      setIsFullscreen(active);
      if (active) setFullscreenFallback(false);
    }

    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    if (!fullscreenFallback) return;

    function exitOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setFullscreenFallback(false);
    }

    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [fullscreenFallback]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || !holderRef.current) return;
    const activePdf = pdf;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    async function renderPage() {
      setRendering(true);
      try {
        const pdfPage = await activePdf.getPage(page);
        if (cancelled || !canvasRef.current || !holderRef.current) return;
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(220, holderRef.current.clientWidth - 16);
        const requestedScale = fitWidth
          ? Math.min(maxFitScale, Math.max(minZoomScale, availableWidth / baseViewport.width))
          : zoom;
        const viewportScale = Math.min(maxZoomScale, Math.max(minZoomScale, requestedScale));
        const outputScale = Math.min(maxRenderScale, window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale: viewportScale * outputScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
          setError("Could not initialize the PDF canvas.");
          return;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.imageSmoothingEnabled = true;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(baseViewport.width * viewportScale)}px`;
        canvas.style.height = `${Math.floor(baseViewport.height * viewportScale)}px`;
        canvas.style.maxWidth = fitWidth ? "100%" : "none";

        renderTask = pdfPage.render({
          canvasContext: context,
          canvas,
          viewport,
        });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled && renderError instanceof Error && renderError.name !== "RenderingCancelledException") {
          setError(renderError.message);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [fitWidth, holderWidth, page, pdf, zoom]);

  function jumpToPage(nextPage: number) {
    const bounded = Math.min(Math.max(nextPage, 1), totalPages || nextPage);
    setPage(bounded);
    setPageInput(String(bounded));
  }

  async function enterFullscreenFitView() {
    setFitWidth(true);
    const element = fullscreenRootRef.current;
    if (!element) return;

    try {
      if (document.fullscreenElement === element) {
        setIsFullscreen(true);
        return;
      }
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        setIsFullscreen(true);
        return;
      }
    } catch {
      // Fall back to a fixed in-app fullscreen surface when native fullscreen is unavailable.
    }

    setFullscreenFallback(true);
    setIsFullscreen(true);
  }

  async function exitFullscreenView() {
    if (document.fullscreenElement === fullscreenRootRef.current && document.exitFullscreen) {
      await document.exitFullscreen();
    }
    setFullscreenFallback(false);
    setIsFullscreen(false);
  }

  const pagesReady = Boolean(pdf && totalPages > 0 && !loading);
  const fullscreenActive = isFullscreen || fullscreenFallback;

  return (
    <div
      ref={fullscreenRootRef}
      data-testid="pdf-fullscreen-root"
      className={cn(
        "bg-[color:var(--surface-inset)]",
        fullscreenActive &&
          "fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[color:var(--surface)] supports-[selector(:fullscreen)]:fixed",
      )}
    >
      <div
        data-testid="pdf-toolbar"
        className="z-10 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 border-b border-[color:var(--border-lux)] bg-[linear-gradient(180deg,var(--surface-highlight),transparent_78%),var(--surface-glass)] p-2 shadow-[var(--shadow-tight)] backdrop-blur-xl sm:sticky sm:top-[69px] sm:flex sm:flex-wrap sm:p-3"
      >
        <button
          onClick={() => jumpToPage(page - 1)}
          disabled={!pagesReady || page <= 1}
          className={iconButton}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pagesReady ? (
          <label className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 text-sm font-medium text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] backdrop-blur-md sm:gap-2 sm:px-3">
            <span className="hidden sm:inline">Page</span>
            <input
              aria-label="PDF page number"
              value={pageInput}
              disabled={!pagesReady}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={() => jumpToPage(Number(pageInput) || page)}
              onKeyDown={(event) => {
                if (event.key === "Enter") jumpToPage(Number(pageInput) || page);
              }}
              inputMode="numeric"
              className="nums h-11 w-12 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-center text-sm font-semibold text-[color:var(--text)] outline-none transition focus:border-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-14"
            />
            <span className="nums text-sm-minus font-semibold sm:text-sm">of {totalPages}</span>
          </label>
        ) : (
          <div className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-glass)] px-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] backdrop-blur-md sm:px-3">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--clinical-accent)]" />
            <span className="hidden sm:inline">{error ? "Page unavailable" : "Loading pages"}</span>
            <span className="sm:hidden">{error ? "Unavailable" : "Loading"}</span>
          </div>
        )}
        <button
          onClick={() => jumpToPage(page + 1)}
          disabled={!pagesReady || page >= totalPages}
          className={iconButton}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="col-span-3 grid grid-cols-3 gap-1.5 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1 shadow-[var(--shadow-inset)] sm:col-span-1 sm:ml-auto sm:flex sm:items-center">
          <button
            onClick={() => {
              setFitWidth(false);
              setZoom((current) => Math.max(0.55, Number((current - 0.15).toFixed(2))));
            }}
            disabled={!pagesReady}
            className={iconButton}
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={enterFullscreenFitView}
            disabled={!pagesReady}
            aria-label="Fit page width and enter fullscreen"
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
              "disabled:cursor-not-allowed disabled:opacity-45",
              fitWidth || fullscreenActive
                ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Fit</span>
          </button>
          <button
            onClick={() => {
              setFitWidth(false);
              setZoom((current) => Math.min(2.8, Number((current + 0.15).toFixed(2))));
            }}
            disabled={!pagesReady}
            className={iconButton}
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          {fullscreenActive ? (
            <button
              onClick={exitFullscreenView}
              className={cn(iconButton, "col-span-3 sm:col-span-1")}
              aria-label="Exit fullscreen document view"
              type="button"
            >
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          ) : null}
        </div>
      </div>

      <div
        data-testid="pdf-canvas-scroll"
        ref={holderRef}
        className={cn(
          "polished-scroll relative flex min-h-[46vh] w-full min-w-0 max-w-full justify-center overscroll-contain p-2 [-webkit-overflow-scrolling:touch] sm:min-h-[62vh] sm:p-4",
          fullscreenActive && "min-h-0 flex-1 sm:min-h-0",
          fitWidth
            ? "overflow-x-hidden overflow-y-auto [touch-action:pan-y]"
            : "overflow-auto [touch-action:pan-x_pan-y]",
        )}
      >
        {(loading || rendering) && (
          <div className="absolute left-3 right-3 top-3 z-[1] flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-tight)] sm:left-4 sm:right-auto sm:top-4">
            <span className="inline-flex min-h-8 items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--clinical-accent)]" />
              {loading ? "Loading PDF" : "Rendering page"}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-[color:var(--clinical-accent)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Source PDF
            </a>
          </div>
        )}
        {error ? (
          <div className="grid min-h-72 place-items-center text-center text-sm text-[color:var(--text-muted)]">
            <div>
              <FileText className="mx-auto mb-2 h-8 w-8" />
              <p>{error}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setLoadAttempt((current) => current + 1)}
                  className={secondaryButton}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry preview
                </button>
                <a href={url} target="_blank" rel="noreferrer" className={secondaryButton}>
                  <ExternalLink className="h-4 w-4" />
                  Source PDF
                </a>
              </div>
            </div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={`${title} page ${page}`}
            className="mx-auto max-w-full rounded-lg bg-[color:var(--surface)] shadow-[var(--shadow-tight)]"
          />
        )}
      </div>
    </div>
  );
}

function nativePdfEmbedUrl(url: string, initialPage: number) {
  const page = Math.max(1, Math.trunc(initialPage || 1));
  return `${url.split("#")[0]}#page=${page}`;
}

function NativePdfEmbed({ url, title, initialPage }: { url: string; title: string; initialPage: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-tight)]">
      <iframe
        title={title}
        src={nativePdfEmbedUrl(url, initialPage)}
        className="h-[min(76vh,64rem)] w-full border-0 bg-[color:var(--surface-raised)]"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

const manualLabelTypeOptions: Array<{ value: DocumentLabelType; label: string }> = [
  { value: "site", label: "Site" },
  { value: "topic", label: "Topic" },
  { value: "medication", label: "Medication" },
  { value: "risk", label: "Risk" },
  { value: "workflow", label: "Workflow" },
  { value: "setting", label: "Setting" },
  { value: "service", label: "Service" },
  { value: "document_type", label: "Document type" },
  { value: "population", label: "Population" },
  { value: "clinical_action", label: "Clinical action" },
  { value: "care_phase", label: "Care phase" },
  { value: "document_intent", label: "Document intent" },
  { value: "content_feature", label: "Content feature" },
  { value: "custom", label: "Manual" },
];

function manualLabelTypeLabel(value: DocumentLabelType) {
  return manualLabelTypeOptions.find((option) => option.value === value)?.label ?? "Manual";
}

function DocumentManualTagEditor({
  document,
  canManage,
  clientDemoMode,
  authorizationHeader,
  onLabelsUpdated,
  onUnauthorized,
}: {
  document: ClinicalDocument;
  canManage: boolean;
  clientDemoMode: boolean;
  authorizationHeader: Record<string, string>;
  onLabelsUpdated: (labels: DocumentLabel[]) => void;
  onUnauthorized: () => void;
}) {
  const manualLabels = (document.labels ?? []).filter((label) => label.source === "manual");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<DocumentLabelType>("topic");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingType, setEditingType] = useState<DocumentLabelType>("topic");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitManualTag(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, action: string) {
    setBusyAction(action);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${document.id}/labels`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) onUnauthorized();
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Tag update failed.");
      if (Array.isArray(payload.labels)) onLabelsUpdated(payload.labels as DocumentLabel[]);
      return true;
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : "Tag update failed.");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function addManualTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const added = await submitManualTag("POST", { label: draftLabel, label_type: draftType }, "add");
    if (added) {
      setDraftLabel("");
      setDraftType("topic");
    }
  }

  async function saveManualTag(label: DocumentLabel) {
    const saved = await submitManualTag(
      "PATCH",
      { labelId: label.id, label: editingLabel, label_type: editingType },
      `edit:${label.id}`,
    );
    if (saved) {
      setEditingId(null);
      setEditingLabel("");
    }
  }

  async function deleteManualTag(label: DocumentLabel) {
    await submitManualTag("DELETE", { labelId: label.id }, `delete:${label.id}`);
  }

  return (
    <div className={cn(sourceCard, "mt-4 p-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
          <Tag className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
          Manual tags
        </p>
        <span className={cn("text-2xs font-semibold", textMuted)}>
          {manualLabels.length ? `${manualLabels.length} curated` : "Generated tags are read-only"}
        </span>
      </div>

      <form onSubmit={addManualTag} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
        <label htmlFor="manual-tag-input" className="sr-only">
          Manual tag
        </label>
        <input
          id="manual-tag-input"
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          placeholder="Add clean manual tag"
          disabled={!canManage || busyAction !== null}
          className={fieldControl}
          aria-label="Manual tag"
        />
        <select
          value={draftType}
          onChange={(event) => setDraftType(event.target.value as DocumentLabelType)}
          disabled={!canManage || busyAction !== null}
          className={fieldControl}
          aria-label="Manual tag type"
        >
          {manualLabelTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!canManage || busyAction !== null || !draftLabel.trim()}
          className={cn(primaryButton, "min-h-11 px-3 text-xs")}
        >
          {busyAction === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>

      {error ? (
        <p className="mt-2 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--warning)]">
          {error}
        </p>
      ) : null}

      {manualLabels.length ? (
        <div className="mt-3 grid gap-2">
          {manualLabels.map((label) => {
            const editing = editingId === label.id;
            return (
              <div
                key={label.id}
                className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                {editing ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                    <input
                      value={editingLabel}
                      onChange={(event) => setEditingLabel(event.target.value)}
                      className={fieldControl}
                      aria-label="Manual tag label"
                    />
                    <select
                      value={editingType}
                      onChange={(event) => setEditingType(event.target.value as DocumentLabelType)}
                      className={fieldControl}
                      aria-label="Manual tag type"
                    >
                      {manualLabelTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text)]">{label.label}</p>
                    <p className={cn("text-2xs font-semibold", textMuted)}>{manualLabelTypeLabel(label.label_type)}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveManualTag(label)}
                        disabled={!editingLabel.trim() || busyAction !== null}
                        className={cn(primaryButton, "min-h-9 px-2 text-xs")}
                        aria-label={`Save ${label.label}`}
                      >
                        {busyAction === `edit:${label.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={busyAction !== null}
                        className={cn(secondaryButton, "min-h-9 px-2 text-xs")}
                        aria-label="Cancel edit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(label.id);
                          setEditingLabel(label.label);
                          setEditingType(label.label_type);
                        }}
                        disabled={!canManage || busyAction !== null}
                        className={cn(secondaryButton, "min-h-9 px-2 text-xs")}
                        aria-label={`Rename ${label.label}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteManualTag(label)}
                        disabled={!canManage || busyAction !== null}
                        className={cn(secondaryButton, "min-h-9 px-2 text-xs text-[color:var(--danger)]")}
                        aria-label={`Remove ${label.label}`}
                      >
                        {busyAction === `delete:${label.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function compactDocumentType(document: ClinicalDocument) {
  return documentFileKind(document.file_name, "PDF");
}

function documentOverviewText(document: ClinicalDocument) {
  const profile = document.summary?.clinical_specifics?.profile;
  // The stored raw summary opens with PDF-header boilerplate on many live
  // documents, so route it through the smart formatter and show its lead
  // sentences instead of the raw string.
  const formattedSummary = profile?.overview ? null : formatDocumentSummary(document.summary?.summary);
  const overview = profile?.overview
    ? cleanClinicalSummaryText(profile.overview)
    : (formattedSummary?.lead ?? formattedSummary?.sections[0]?.items.join(" ") ?? "");
  if (overview && !/source-backed review/i.test(overview)) return overview;
  return "A clear overview of this document, useful pages, and source PDF access.";
}

function documentKeySections(document: ClinicalDocument) {
  const labels = (document.labels ?? []).map((label) => label.label).filter(Boolean);
  return Array.from(new Set(labels)).slice(0, 3);
}

function DocumentPagePreview({ pageNumber }: { pageNumber: number | null }) {
  return (
    <a href="#pdf-preview-section" className="group grid min-w-0 justify-items-center gap-2 text-center">
      <span className="grid aspect-[0.76] min-h-[86px] w-full max-w-[7.5rem] place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 shadow-[var(--shadow-inset)] transition group-hover:border-[color:var(--border-strong)] group-hover:bg-[color:var(--surface-subtle)] sm:max-w-[5.5rem]">
        <span className="grid w-full gap-1.5">
          <span className="h-2 rounded bg-[color:var(--clinical-accent-soft)]" />
          <span className="h-1 rounded bg-[color:var(--border-strong)]/55" />
          <span className="h-1 rounded bg-[color:var(--border-strong)]/45" />
          <span className="h-1 rounded bg-[color:var(--border-strong)]/35" />
          <span className="mt-1 grid grid-cols-2 gap-1">
            <span className="h-8 rounded bg-[color:var(--clinical-accent-soft)]/75" />
            <span className="grid gap-1">
              <span className="h-1 rounded bg-[color:var(--border-strong)]/35" />
              <span className="h-1 rounded bg-[color:var(--border-strong)]/30" />
              <span className="h-1 rounded bg-[color:var(--border-strong)]/25" />
            </span>
          </span>
        </span>
      </span>
      <span className="nums text-sm font-semibold text-[color:var(--text-muted)]">p.{pageNumber ?? "n/a"}</span>
    </a>
  );
}

function usefulDocumentPages(initialPage: number, pages: PageRow[]) {
  return Array.from(new Set([initialPage, ...pages.map((page) => page.page_number)]))
    .filter((page) => Number.isFinite(page))
    .slice(0, 3);
}

function DocumentOverviewLanding({
  document,
  initialPage,
  signedUrl,
  downloadUrl,
  pages,
  onAskFromDocument,
  onAddToScope,
  canSummarizeDocument,
}: {
  document: ClinicalDocument;
  initialPage: number;
  signedUrl: string | null;
  downloadUrl: string | null;
  pages: PageRow[];
  onAskFromDocument: () => void;
  onAddToScope: () => void;
  canSummarizeDocument: boolean;
}) {
  const keySections = documentKeySections(document);
  const usefulPages = usefulDocumentPages(initialPage, pages);
  const documentType = compactDocumentType(document);

  return (
    <section className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
      <Link
        href="/?mode=documents"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-1 text-sm font-semibold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] lg:col-span-3"
      >
        <ChevronLeft className="h-4 w-4" />
        Documents
      </Link>

      <article className={cn(panel, "p-4 sm:p-5 lg:col-span-3")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <DocumentFileTile
            kind={documentType}
            tone={documentTileTone(documentType)}
            className="h-20 w-20 rounded-xl text-sm sm:h-24 sm:w-24"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
              Clinical guideline
            </p>
            <h2 className="line-clamp-2 text-xl font-semibold leading-7 text-[color:var(--text-heading)]">
              {documentDisplayTitle(document)}
            </h2>
            <DocumentMetaRow
              className="mt-1"
              items={[
                documentType,
                `${document.page_count ?? (pages.length || "?")} pages`,
                `Uploaded ${formatClinicalDate(document.created_at)}`,
              ]}
            />
            {/* Search relevance badges are rendered in document search results; the viewer has no ranking context. */}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1fr)]">
          {signedUrl ? (
            <DocumentActionAnchor
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(primaryButton, "w-full min-h-12 text-sm")}
            >
              Open PDF (new tab)
            </DocumentActionAnchor>
          ) : (
            <DocumentActionAnchor href="#pdf-preview-section" className={cn(primaryButton, "w-full min-h-12 text-sm")}>
              Open PDF preview
            </DocumentActionAnchor>
          )}
          {downloadUrl ? (
            <DocumentActionAnchor
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              icon={Download}
              download={document.file_name || "clinical-source.pdf"}
              className={cn(secondaryButton, "w-full min-h-12 text-sm")}
            >
              Download PDF
            </DocumentActionAnchor>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <DocumentActionButton
              onClick={onAddToScope}
              icon={Target}
              className={cn(secondaryButton, "min-h-12 px-2 text-xs sm:text-sm")}
            >
              Scope
            </DocumentActionButton>
            <DocumentActionButton
              onClick={onAskFromDocument}
              disabled={!canSummarizeDocument}
              icon={Sparkles}
              className={cn(secondaryButton, "min-h-12 whitespace-nowrap px-2 text-xs sm:text-sm")}
            >
              Answer from this
            </DocumentActionButton>
          </div>
        </div>
      </article>

      <section id="document-overview" className={cn(sourceCard, "scroll-mt-24 p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Overview</h3>
            <p className={cn("mt-1 line-clamp-3 text-sm leading-6", textMuted)}>{documentOverviewText(document)}</p>
          </div>
          <ChevronDown className="h-6 w-6 -rotate-90 text-[color:var(--text-soft)]" />
        </div>
      </section>

      <section className={cn(sourceCard, "p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Tag className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Key sections</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(keySections.length ? keySections : ["Overview", "Useful pages", "Source PDF"]).map((section) => (
                <span
                  key={section}
                  className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-medium text-[color:var(--clinical-accent)]"
                >
                  {section}
                </span>
              ))}
            </div>
          </div>
          <ChevronDown className="h-6 w-6 -rotate-90 text-[color:var(--text-soft)]" />
        </div>
      </section>

      <section className={cn(sourceCard, "p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Useful pages</h3>
            <p className={cn("mt-1 text-sm leading-6", textMuted)}>Most relevant pages for this document.</p>
            <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
              {(usefulPages.length ? usefulPages : [initialPage]).map((page) => (
                <DocumentPagePreview key={page} pageNumber={page} />
              ))}
            </div>
          </div>
          <ChevronDown className="h-6 w-6 -rotate-90 text-[color:var(--text-soft)]" />
        </div>
      </section>
    </section>
  );
}

export function DocumentViewer({
  documentId,
  initialPage,
  chunkId,
}: {
  documentId: string;
  initialPage: number;
  chunkId?: string;
}) {
  const router = useRouter();
  const [document, setDocument] = useState<ClinicalDocument | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [tableFacts, setTableFacts] = useState<TableFactRow[]>([]);
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const [indexHealth, setIndexHealth] = useState<DocumentIndexHealth | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloadSignedUrl, setDownloadSignedUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<RagAnswer | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [sourceSearch, setSourceSearch] = useState("");
  const [documentSearchResults, setDocumentSearchResults] = useState<DocumentSearchResult[]>([]);
  const [searchingDocument, setSearchingDocument] = useState(false);
  const [documentSearchError, setDocumentSearchError] = useState<string | null>(null);
  const [reviewingTableFactId, setReviewingTableFactId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [localProjectReady, setLocalProjectReady] = useState(true);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  // Phone-only hide-on-scroll for the bottom composer: never hide while the
  // mobile actions sheet is open or while focus sits inside the composer
  // (keyboard users must not tab into invisible controls).
  const [composerChromeFocused, setComposerChromeFocused] = useState(false);
  const [shellScrollContainer, setShellScrollContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      const main = window.document.getElementById("main-content");
      setShellScrollContainer((current) => (current === main ? current : main));
    };
    const frame = window.requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(window.document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  const scrollHidden = useHideOnScroll(shellScrollContainer ? { scrollContainer: shellScrollContainer } : {});
  const composerScrollHidden = scrollHidden && !mobileActionsOpen && !composerChromeFocused;
  const [useNativePdfViewer, setUseNativePdfViewer] = useState(() => getInitialPdfViewerMode().useNativePdfViewer);
  const [hasExplicitPdfViewerMode, setHasExplicitPdfViewerMode] = useState(
    () => getInitialPdfViewerMode().hasExplicitPdfViewerMode,
  );
  const [viewerModeInitialized] = useState(true);
  const generatedSummaryRef = useRef<HTMLElement | null>(null);
  const {
    status: authStatus,
    isConfigured,
    authorizationHeader,
    registerAuthRequest,
    isAuthEpochCurrent,
    markSessionExpired,
  } = useAuthSession();
  const [authLoadingTimedOut, setAuthLoadingTimedOut] = useState(false);
  const [serverDemoMode, setServerDemoMode] = useState(process.env.NEXT_PUBLIC_DEMO_MODE === "true");
  const localNoAuthMode = isLocalNoAuthMode();
  const clientDemoMode = localNoAuthMode || serverDemoMode;
  const canViewSourceDocuments = localProjectReady;
  const canUsePrivateApis = localProjectReady && (clientDemoMode || authStatus === "authenticated");

  useEffect(() => {
    if (authStatus !== "loading") {
      const resetId = window.setTimeout(() => setAuthLoadingTimedOut(false), 0);
      return () => window.clearTimeout(resetId);
    }
    const timeoutId = window.setTimeout(() => setAuthLoadingTimedOut(true), 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [authStatus]);

  useEffect(() => {
    if (typeof window === "undefined" || !viewerModeInitialized || hasExplicitPdfViewerMode) return;

    const syncDefaultViewerMode = () => {
      setUseNativePdfViewer(getDefaultPdfViewerMode());
    };

    const smallScreen = window.matchMedia(`(max-width: ${pdfViewerNativeModeBreakpoint}px)`);

    const syncFrame = window.requestAnimationFrame(syncDefaultViewerMode);
    smallScreen.addEventListener("change", syncDefaultViewerMode);

    return () => {
      window.cancelAnimationFrame(syncFrame);
      smallScreen.removeEventListener("change", syncDefaultViewerMode);
    };
  }, [viewerModeInitialized, hasExplicitPdfViewerMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== pdfViewerModeStorageKey || !event.newValue) return;
      if (event.newValue === pdfViewerModeValue.native) {
        setHasExplicitPdfViewerMode(true);
        setUseNativePdfViewer(true);
      } else if (event.newValue === pdfViewerModeValue.canvas) {
        setHasExplicitPdfViewerMode(true);
        setUseNativePdfViewer(false);
      }
    };

    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, []);

  useEffect(() => {
    if (!viewerModeInitialized || !hasExplicitPdfViewerMode) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        pdfViewerModeStorageKey,
        useNativePdfViewer ? pdfViewerModeNativeValue : pdfViewerModeValue.canvas,
      );
    } catch {
      // localStorage can be unavailable in hardened browsers/private mode.
    }
  }, [useNativePdfViewer, viewerModeInitialized, hasExplicitPdfViewerMode]);

  useEffect(() => {
    let active = true;
    readLocalProjectIdentity()
      .then((identity) => {
        if (!active) return null;
        if (!identity?.localServer?.safeLocalOrigin) {
          setLocalProjectReady(false);
          setViewerError(unsafeLocalProjectMessage(identity));
          setLoadingDocument(false);
          return null;
        }
        setLocalProjectReady(true);
        return fetch("/api/setup-status");
      })
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload) => {
        if (active && typeof payload?.demoMode === "boolean") setServerDemoMode(payload.demoMode);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!canViewSourceDocuments && authStatus === "loading") {
      return () => undefined;
    }
    if (!canViewSourceDocuments) {
      return () => undefined;
    }

    const controller = new AbortController();
    const authRequest = registerAuthRequest(controller);
    const reset = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setLoadingDocument(true);
        setViewerError(null);
        setPreviewError(null);
        setSignedUrl(null);
        setDownloadSignedUrl(null);
      }
    }, 0);
    const detailParams = new URLSearchParams({
      page: String(Math.max(1, initialPage || 1)),
      pageLimit: "9",
      chunkLimit: "16",
    });
    if (chunkId) detailParams.set("chunk", chunkId);
    const detailUrl = `/api/documents/${documentId}?${detailParams.toString()}`;
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;
    const downloadSignedUrlEndpoint = `${signedUrlEndpoint}?download=true`;
    readLocalProjectIdentity()
      .then((identity) => {
        if (!isAuthEpochCurrent(authRequest.epoch)) {
          throw new DOMException("Stale authentication epoch", "AbortError");
        }
        if (!identity?.localServer?.safeLocalOrigin) {
          setLocalProjectReady(false);
          throw new Error(unsafeLocalProjectMessage(identity));
        }
        setLocalProjectReady(true);

        const detailRequest = fetch(detailUrl, {
          signal: controller.signal,
          headers: clientDemoMode ? undefined : authorizationHeader,
        }).then(async (response) => {
          const payload = await response.json();
          if (response.status === 401) markSessionExpired();
          if (!response.ok) throw new Error(payload.error || "Document details could not be loaded.");
          return payload;
        });
        const cachedSignedUrl = getCachedSignedUrl(signedUrlEndpoint);
        const cachedDownloadSignedUrl = getCachedSignedUrl(downloadSignedUrlEndpoint);
        const signedUrlRequest = cachedSignedUrl
          ? Promise.resolve(cachedSignedUrl)
          : fetch(signedUrlEndpoint, {
              signal: controller.signal,
              headers: clientDemoMode ? undefined : authorizationHeader,
            }).then(async (response) => {
              const payload = await response.json();
              if (response.status === 401) markSessionExpired();
              if (!response.ok) throw new Error(payload.error || "Source preview could not be loaded.");
              return payload;
            });
        const signedDownloadUrlRequest = cachedDownloadSignedUrl
          ? Promise.resolve(cachedDownloadSignedUrl)
          : fetch(downloadSignedUrlEndpoint, {
              signal: controller.signal,
              headers: clientDemoMode ? undefined : authorizationHeader,
            }).then(async (response) => {
              const payload = await response.json();
              if (response.status === 401) markSessionExpired();
              if (!response.ok) throw new Error(payload.error || "Download URL could not be loaded.");
              return payload;
            });

        return Promise.allSettled([detailRequest, signedUrlRequest, signedDownloadUrlRequest]);
      })
      .then(([detailResult, signedUrlResult, signedDownloadUrlResult]) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;

        if (detailResult.status === "fulfilled") {
          const detail = detailResult.value;
          setDocument(detail.document ?? null);
          setPages(detail.pages ?? []);
          setImages(detail.images ?? []);
          setTableFacts(detail.tableFacts ?? []);
          setChunks(detail.chunks ?? []);
          setIndexHealth(detail.indexHealth ?? null);
        } else {
          setDocument(null);
          setPages([]);
          setImages([]);
          setTableFacts([]);
          setChunks([]);
          setIndexHealth(null);
          const message =
            detailResult.reason instanceof Error ? detailResult.reason.message : "Document could not be loaded.";
          if (!canUsePrivateApis && !clientDemoMode && message === "Document not found.") {
            setViewerError(
              isConfigured
                ? "Sign in to open private source documents."
                : "Supabase browser authentication is not configured for private source documents.",
            );
          } else {
            setViewerError(message);
          }
        }

        if (signedUrlResult.status === "fulfilled") {
          const payload = signedUrlResult.value;
          if (payload?.url) setCachedSignedUrl(signedUrlEndpoint, payload);
          setSignedUrl(payload?.url ?? null);
          setPreviewError(null);
        } else {
          setSignedUrl(null);
          setDownloadSignedUrl(null);
          setPreviewError(
            signedUrlResult.reason instanceof Error
              ? signedUrlResult.reason.message
              : "Source preview could not be loaded.",
          );
        }

        if (signedDownloadUrlResult.status === "fulfilled") {
          const payload = signedDownloadUrlResult.value;
          if (payload?.url) {
            setCachedSignedUrl(downloadSignedUrlEndpoint, payload);
            setDownloadSignedUrl(payload.url);
            return;
          }
        }

        if (signedUrlResult.status === "fulfilled") {
          const payload = signedUrlResult.value;
          setDownloadSignedUrl(payload?.url ?? null);
        } else {
          setDownloadSignedUrl(null);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        setViewerError(error instanceof Error ? error.message : "Document could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDocument(false);
      });

    return () => {
      window.clearTimeout(reset);
      controller.abort();
      authRequest.release();
    };
  }, [
    authStatus,
    authorizationHeader,
    canUsePrivateApis,
    canViewSourceDocuments,
    clientDemoMode,
    documentId,
    chunkId,
    initialPage,
    isConfigured,
    markSessionExpired,
    registerAuthRequest,
    isAuthEpochCurrent,
    previewAttempt,
  ]);

  useEffect(() => {
    const query = sourceSearch.trim();
    if (!canViewSourceDocuments || query.length < 2) {
      const reset = window.setTimeout(() => {
        setDocumentSearchResults([]);
        setSearchingDocument(false);
        setDocumentSearchError(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const authRequest = registerAuthRequest(controller);
    const timeout = window.setTimeout(() => {
      setSearchingDocument(true);
      setDocumentSearchError(null);
      fetch(`/api/documents/${documentId}/search?q=${encodeURIComponent(query)}&limit=30`, {
        signal: controller.signal,
        headers: clientDemoMode ? undefined : authorizationHeader,
      })
        .then(async (response) => {
          const payload = await response.json();
          if (response.status === 401) markSessionExpired();
          if (!response.ok) throw new Error(payload.error || "Document search could not be loaded.");
          return payload;
        })
        .then((payload) => {
          if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
          setDocumentSearchResults(payload.results ?? []);
          setDocumentSearchError(null);
        })
        .catch((error) => {
          if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
          setDocumentSearchResults([]);
          setDocumentSearchError(error instanceof Error ? error.message : "Document search could not be loaded.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchingDocument(false);
        });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      authRequest.release();
    };
  }, [
    authorizationHeader,
    canViewSourceDocuments,
    clientDemoMode,
    documentId,
    isAuthEpochCurrent,
    markSessionExpired,
    registerAuthRequest,
    sourceSearch,
  ]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  async function summarize() {
    if (!canSummarizeDocument) {
      setSummaryError("Load a source document before summarising.");
      return;
    }
    if (!canUsePrivateApis) {
      setSummaryError("Sign in before summarising private documents.");
      return;
    }
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/summarize`, {
        method: "POST",
        headers: clientDemoMode ? undefined : authorizationHeader,
      });
      const payload = await response.json();
      if (response.status === 401) markSessionExpired();
      if (!response.ok) throw new Error(payload.error || "Summary could not be generated.");
      setSummary({ ...payload, answer: cleanClinicalSummaryText(String(payload.answer ?? "")) });
      window.requestAnimationFrame(() => {
        generatedSummaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Summary could not be generated.");
    } finally {
      setLoadingSummary(false);
    }
  }

  const authViewerError =
    !canUsePrivateApis &&
    !clientDemoMode &&
    !loadingDocument &&
    !document &&
    (authStatus !== "loading" || authLoadingTimedOut) &&
    (viewerError === "Sign in to open private source documents." ||
      viewerError === "Supabase browser authentication is not configured for private source documents.")
      ? viewerError
      : null;
  const effectiveLoadingDocument =
    !canUsePrivateApis && authStatus === "loading" && !authLoadingTimedOut && loadingDocument ? true : loadingDocument;
  const effectiveViewerError = authViewerError ?? viewerError;
  const viewerState = effectiveLoadingDocument
    ? "loading"
    : document
      ? "ready"
      : authViewerError
        ? "auth-required"
        : "error";
  const readyDocument = viewerState === "ready" ? document : null;
  const headerTitle = readyDocument
    ? documentDisplayTitle(readyDocument)
    : viewerState === "auth-required"
      ? "Sign in required"
      : viewerState === "loading"
        ? "Document"
        : "Source unavailable";
  const headerSubtitle = readyDocument
    ? `page ${initialPage} · ${readyDocument.file_name}`
    : viewerState === "loading"
      ? `page ${initialPage} · loading source`
      : (effectiveViewerError ?? "Source unavailable");
  const documentHomeHref = "/?mode=documents";
  const scopedDocumentHref = readyDocument
    ? `/?mode=documents&q=${encodeURIComponent(documentDisplayTitle(readyDocument))}`
    : documentHomeHref;
  const canSummarizeDocument = viewerState === "ready" && !loadingSummary && canUsePrivateApis;
  const summarizeTitle = canSummarizeDocument ? "Answer from this document" : "Load a source document before answering";
  const selectedPage = pages.find((page) => page.page_number === initialPage) ?? pages[0];
  const selectedChunk = chunkId ? chunks.find((chunk) => chunk.id === chunkId) : undefined;
  const { clinicalImages, auditImages } = partitionViewerImages(images);
  const generatedSummaryText = summary ? cleanClinicalSummaryText(summary.answer) : "";
  const storedSummaryText = document?.summary?.summary ?? null;
  const documentLabels = document?.labels;
  const formattedStoredSummary = useMemo(() => formatDocumentSummary(storedSummaryText), [storedSummaryText]);
  const summaryBadges = useMemo(
    () => buildDocumentSummaryBadges({ labels: documentLabels, summaryText: storedSummaryText }),
    [documentLabels, storedSummaryText],
  );
  const indexWarnings = Array.isArray(indexHealth?.warnings)
    ? indexHealth.warnings.map((warning) => String(warning)).filter(Boolean)
    : typeof indexHealth?.warnings === "string" && indexHealth.warnings
      ? [indexHealth.warnings]
      : [];
  useEffect(() => {
    if (!chunkId || loadingDocument) return;
    // Both the mobile and desktop IndexedTextPanel render the pinned chunk, so a
    // plain querySelector returns the first match in DOM order — the mobile one,
    // which is display:none on lg+ and lives in a collapsed <details> on phones.
    // Scroll the copy the user can actually see: skip display:none matches and
    // expand the mobile <details> when the pinned chunk only exists inside it.
    const matches = Array.from(
      window.document.querySelectorAll<HTMLElement>(`[data-source-chunk-id="${CSS.escape(chunkId)}"]`),
    );
    const isDisplayed = (element: HTMLElement) => element.offsetParent !== null || element.getClientRects().length > 0;
    const inClosedDetails = (element: HTMLElement) => Boolean(element.closest("details:not([open])"));
    let target = matches.find((element) => isDisplayed(element) && !inClosedDetails(element));
    if (!target) {
      const collapsed = matches
        .map((element) => element.closest("details"))
        .find((node): node is HTMLDetailsElement => node instanceof HTMLDetailsElement && !node.open);
      if (collapsed) collapsed.open = true;
      target = matches.find((element) => isDisplayed(element) && !inClosedDetails(element)) ?? matches[0];
    }
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [chunkId, loadingDocument, chunks.length]);
  const retryPreview = () => {
    setViewerError(null);
    setPreviewError(null);
    setLoadingDocument(true);
    setPreviewAttempt((current) => current + 1);
  };
  const handleDocumentRenamed = (updatedDocument: ClinicalDocument) => {
    setDocument((current) => (current?.id === updatedDocument.id ? { ...current, ...updatedDocument } : current));
  };
  const handleDocumentDeleted = () => {
    router.push("/?mode=documents");
  };
  const handleDocumentLabelsUpdated = (labels: DocumentLabel[]) => {
    setDocument((current) => (current ? { ...current, labels } : current));
  };
  const searchByTag = (tag: { searchText: string; label: string }) => {
    const params = new URLSearchParams({ mode: "documents", q: tag.searchText || tag.label });
    router.push(`/?${params.toString()}`);
  };
  async function reviewTableFact(fact: TableFactRow, reviewClass: string) {
    setReviewingTableFactId(fact.id);
    try {
      const response = await fetch(`/api/documents/${documentId}/table-facts`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({ factId: fact.id, reviewClass }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) markSessionExpired();
      if (!response.ok) throw new Error(payload.error || "Table review update failed.");
      setTableFacts((current) =>
        current.map((candidate) => (candidate.id === fact.id ? (payload.tableFact as TableFactRow) : candidate)),
      );
      setImages((current) =>
        current.map((image) =>
          image.id === fact.source_image_id
            ? {
                ...image,
                clinicalUseClass: reviewClass === "clinical_useful" ? "clinical_evidence" : reviewClass,
                tableRole: reviewClass === "clinical_useful" ? "clinical" : reviewClass,
                searchable: reviewClass === "clinical_useful" || reviewClass === "reference",
              }
            : image,
        ),
      );
    } catch (error) {
      setViewerError(error instanceof Error ? error.message : "Table review update failed.");
    } finally {
      setReviewingTableFactId(null);
    }
  }

  return (
    <main
      id="document-viewer-main"
      tabIndex={-1}
      className={cn(appBackdrop, "min-h-[100dvh] overflow-x-clip text-[color:var(--text)] focus:outline-none")}
    >
      <header className="edge-glass-header z-30 border-b border-[color:var(--border)] py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[var(--shadow-tight)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 min-w-0 max-w-[1440px] items-center gap-2">
          <Link
            href={documentHomeHref}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
            aria-label="Back to documents"
          >
            <Menu className="h-5 w-5 sm:hidden" />
            <ArrowLeft className="hidden h-5 w-5 sm:block" />
          </Link>

          <div
            role="group"
            aria-label="Search mode"
            className="mx-auto grid w-[min(13.25rem,52vw)] grid-cols-2 gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)] sm:mx-0 sm:w-auto sm:min-w-[14rem]"
          >
            <Link
              href="/"
              className="inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] sm:text-sm"
            >
              Answer
            </Link>
            <Link
              href="/?mode=documents"
              className="inline-flex min-h-9 items-center justify-center rounded-full bg-[color:var(--clinical-accent)] px-3 text-xs font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] sm:text-sm"
            >
              Documents
            </Link>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              href={scopedDocumentHref}
              className="hidden h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] min-[380px]:grid"
              aria-label="Scope this document"
              title={headerSubtitle}
            >
              <Target className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileActionsOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              aria-label="Open document actions"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
        <h1 className="sr-only">{headerTitle}</h1>
      </header>

      {readyDocument ? (
        <Sheet
          open={mobileActionsOpen}
          onClose={() => setMobileActionsOpen(false)}
          title="This document"
          description="Search, answer, open, or scope this document."
          closeLabel="Close document actions"
        >
          <div className="space-y-3 pb-2">
            <section className={cn(sourceCard, "p-3")}>
              <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text)]">
                {documentDisplayTitle(readyDocument)}
              </p>
              <p className={cn("mt-1 truncate text-xs", textMuted)}>{readyDocument.file_name}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!isOnline ? <span className={cn("text-xs font-semibold", textMuted)}>Offline</span> : null}
              </div>
            </section>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  setSourceSearch(documentDisplayTitle(readyDocument));
                }}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                <Search className="h-4 w-4" />
                Search in document
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  void summarize();
                }}
                disabled={!canSummarizeDocument}
                title={summarizeTitle}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Answer from this
              </button>
              {signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileActionsOpen(false)}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open original PDF
                </a>
              ) : (
                <a
                  href="#pdf-preview-section"
                  onClick={() => setMobileActionsOpen(false)}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open original PDF
                </a>
              )}
              {downloadSignedUrl ? (
                <a
                  href={downloadSignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={readyDocument.file_name || "clinical-source.pdf"}
                  onClick={() => setMobileActionsOpen(false)}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  router.push(scopedDocumentHref);
                }}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                <Target className="h-4 w-4" />
                Scope
              </button>
            </div>
            <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Admin controls
              </summary>
              <DocumentManagementActions
                document={readyDocument}
                disabled={!canUsePrivateApis}
                className="mt-3 justify-start gap-2"
                onRenamed={handleDocumentRenamed}
                onDeleted={handleDocumentDeleted}
              />
            </details>
          </div>
        </Sheet>
      ) : null}

      <section className="mx-auto grid max-w-[1440px] gap-4 px-3 py-4 pb-36 sm:gap-5 sm:px-4 sm:py-5 sm:pb-40 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-start lg:px-8">
        {(summary || summaryError) && (
          <div className="min-w-0 space-y-3 lg:col-span-2">
            {summary && (
              <section
                ref={generatedSummaryRef}
                data-testid="generated-clinical-summary"
                className={cn(panel, "p-4 source-print")}
              >
                <PanelHeading
                  icon={Sparkles}
                  title="Clinical summary"
                  description="From indexed passages, cleaned for practical use."
                />
                <p className="mt-3 whitespace-pre-wrap text-base-minus leading-6 text-[color:var(--text-muted)]">
                  <SafeBoldText text={generatedSummaryText} />
                </p>
              </section>
            )}
            {summaryError && (
              <section className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-4 text-sm font-medium text-[color:var(--danger)]">
                <AlertCircle className="mr-2 inline h-4 w-4" />
                {summaryError}
              </section>
            )}
          </div>
        )}

        {readyDocument ? (
          <div className="min-w-0 lg:col-span-2">
            <DocumentOverviewLanding
              document={readyDocument}
              initialPage={initialPage}
              signedUrl={signedUrl}
              downloadUrl={downloadSignedUrl}
              pages={pages}
              onAskFromDocument={() => void summarize()}
              onAddToScope={() => router.push(scopedDocumentHref)}
              canSummarizeDocument={canSummarizeDocument}
            />
          </div>
        ) : null}

        {!readyDocument && viewerState !== "loading" ? (
          <div className="min-w-0 lg:col-span-2">
            <section className={cn(panel, "p-4")}>
              <button type="button" disabled className={cn(secondaryButton, "min-h-11 text-xs")}>
                <Sparkles className="h-4 w-4" />
                Answer from this
              </button>
            </section>
          </div>
        ) : null}

        <div className="min-w-0 space-y-4 sm:space-y-5 lg:mx-auto lg:w-full lg:max-w-4xl">
          <DocumentViewerAnchors evidenceHref="#source-evidence" textHref="#source-text-mobile" className="lg:hidden" />

          <div id="pdf-preview-section" className={cn(panel, "scroll-mt-24 overflow-hidden")}>
            <div data-testid="pdf-preview">
              {effectiveLoadingDocument ? (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--clinical-accent-soft)_55%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm font-semibold text-[color:var(--text-muted)] sm:min-h-72">
                  <div className="max-w-sm">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[color:var(--clinical-accent)]" />
                    <p>Preparing PDF preview</p>
                    <ul className="mt-3 space-y-1 text-left text-xs font-medium text-[color:var(--text-muted)]">
                      <li>Loading source metadata</li>
                      <li>Preparing PDF preview</li>
                      <li>Loading extracted tables</li>
                    </ul>
                    {signedUrl && (
                      <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "mt-3")}>
                        <ExternalLink className="h-4 w-4" />
                        Source PDF
                      </a>
                    )}
                    {downloadSignedUrl && (
                      <a
                        href={downloadSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={document?.file_name || "clinical-source.pdf"}
                        className={cn(secondaryButton, "mt-3")}
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : effectiveViewerError || previewError ? (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--danger-soft)_62%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm text-[color:var(--danger)] sm:min-h-72">
                  <div>
                    <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                    <p className="font-semibold">{effectiveViewerError ?? previewError}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={retryPreview} className={secondaryButton}>
                        <RefreshCw className="h-4 w-4" />
                        Retry preview
                      </button>
                      {signedUrl && (
                        <a href={signedUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
                          <ExternalLink className="h-4 w-4" />
                          Source PDF
                        </a>
                      )}
                      {downloadSignedUrl && (
                        <a
                          href={downloadSignedUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={document?.file_name || "clinical-source.pdf"}
                          className={secondaryButton}
                        >
                          <Download className="h-4 w-4" />
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : signedUrl && document?.file_type === "application/pdf" ? (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2 pt-2 sm:px-3">
                    <p className={cn("hidden min-w-0 flex-1 text-2xs sm:block", textMuted)}>
                      Browser PDF mode keeps heavy-zoom pages crisp and is recommended when zoom quality looks soft.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setHasExplicitPdfViewerMode(true);
                        setUseNativePdfViewer((current) => !current);
                      }}
                      aria-label={useNativePdfViewer ? "Switch to canvas zoom mode" : "Switch to browser PDF mode"}
                      className={cn(secondaryButton, "min-h-11 w-full justify-center px-3 text-xs sm:w-auto")}
                    >
                      <span className="sm:hidden">{useNativePdfViewer ? "Canvas mode" : "Browser mode"}</span>
                      <span className="hidden sm:inline">
                        {useNativePdfViewer ? "Use canvas zoom mode" : "Use browser PDF mode"}
                      </span>
                    </button>
                  </div>
                  {useNativePdfViewer ? (
                    <NativePdfEmbed url={signedUrl} title={documentDisplayTitle(document)} initialPage={initialPage} />
                  ) : (
                    <PdfCanvasViewer
                      key={`${documentId}-${useNativePdfViewer ? "native" : "canvas"}`}
                      url={signedUrl}
                      title={documentDisplayTitle(document)}
                      initialPage={initialPage}
                    />
                  )}
                </>
              ) : (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--clinical-accent-soft)_40%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm text-[color:var(--text-muted)] sm:min-h-72">
                  <div>
                    <FileText className="mx-auto mb-2 h-8 w-8" />
                    Source preview is available after a signed URL is generated.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 md:items-start lg:hidden">
            <PinnedSourceEvidence
              loading={effectiveLoadingDocument}
              chunk={selectedChunk}
              compact
              sectionId="source-evidence"
            />
            <details id="source-text-mobile" className={cn("group min-w-0 scroll-mt-24", panel)}>
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="inline-flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[color:var(--text)]">Indexed page text</span>
                    <span className={cn("block truncate text-xs", textMuted)}>
                      {effectiveLoadingDocument
                        ? "Loading indexed page text"
                        : `Page ${selectedPage?.page_number ?? initialPage} extracted text`}
                    </span>
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
              </summary>
              <div className={cn(clinicalDivider, "p-4")}>
                <IndexedTextPanel
                  loading={effectiveLoadingDocument}
                  selectedPage={selectedPage}
                  chunks={chunks}
                  search={sourceSearch}
                  documentSearchResults={documentSearchResults}
                  searchingDocument={searchingDocument}
                  documentSearchError={documentSearchError}
                  idPrefix="mobile-chunk"
                  selectedChunkId={chunkId}
                  onSearchChange={setSourceSearch}
                />
              </div>
            </details>
          </div>

          <div className="hidden lg:block">
            <IndexedTextPanel
              loading={effectiveLoadingDocument}
              selectedPage={selectedPage}
              chunks={chunks}
              search={sourceSearch}
              documentSearchResults={documentSearchResults}
              searchingDocument={searchingDocument}
              documentSearchError={documentSearchError}
              idPrefix="desktop-chunk"
              sectionId="source-text-desktop"
              selectedChunkId={chunkId}
              onSearchChange={setSourceSearch}
            />
          </div>
        </div>

        <aside className="polished-scroll min-w-0 grid content-start gap-4 sm:gap-5 md:grid-cols-2 md:items-start lg:sticky lg:top-[81px] lg:max-h-[calc(100dvh-97px)] lg:grid-cols-1 lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {indexWarnings.length ? (
            <InlineNotice tone="warning" className="text-xs md:col-span-2 lg:col-span-1">
              <span className="font-bold">Extraction warnings</span>
              {indexWarnings.slice(0, 4).map((warning) => (
                <span key={warning} className="mt-1 block font-semibold">
                  {warning}
                </span>
              ))}
            </InlineNotice>
          ) : null}

          <div className="hidden lg:block">
            <DocumentViewerAnchors
              evidenceHref="#source-evidence-rail"
              textHref="#source-text-desktop"
              className="mb-3"
            />
            <PinnedSourceEvidence
              loading={effectiveLoadingDocument}
              chunk={selectedChunk}
              compact
              sectionId="source-evidence-rail"
            />
          </div>

          {document ? (
            <section
              id="source-summary"
              data-testid="high-yield-summary"
              className={cn(panel, "scroll-mt-24 p-4 source-print md:col-span-2 lg:col-span-1")}
            >
              <PanelHeading
                icon={Sparkles}
                title={
                  document.summary?.clinical_specifics?.profile ? "Clinical document profile" : "High-yield summary"
                }
                description="What this document covers, from its indexed evidence."
              />
              <BadgeCluster items={summaryBadges} limit={8} showOverflowCount className="mt-3" />
              {document.summary?.clinical_specifics?.profile ? (
                <ClinicalSummaryProfile profile={document.summary.clinical_specifics.profile} />
              ) : (
                <FormattedHighYieldSummary formatted={formattedStoredSummary} />
              )}
              {!document.summary?.clinical_specifics?.profile && document.summary?.clinical_specifics && (
                <div className="mt-4 space-y-4">
                  {Object.entries(document.summary.clinical_specifics)
                    .filter(([key, items]) => key !== "profile" && Array.isArray(items) && items.length > 0)
                    .slice(0, 6)
                    .map(([key, items]) => (
                      <section key={key} className="border-t border-[color:var(--border)] pt-3">
                        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                          {key.replaceAll("_", " ")}
                        </h3>
                        <ul
                          className={cn(
                            proseMeasure,
                            "mt-2 space-y-1.5 text-base-minus leading-6 text-[color:var(--text-muted)]",
                          )}
                        >
                          {(items as string[]).slice(0, 5).map((item, index) => (
                            <li key={`${key}:${index}:${item}`} className="flex gap-2">
                              <span
                                aria-hidden="true"
                                className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--clinical-accent)]"
                              />
                              <span>
                                <SafeBoldText text={item} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                </div>
              )}
              {document.labels?.length ? (
                <div className="mt-4 border-t border-[color:var(--border)] pt-3">
                  <p className={eyebrowText}>Browse by tag</p>
                  <DocumentTagCloud
                    labels={document.labels}
                    limit={18}
                    className="mt-2"
                    onTagClick={searchByTag}
                    grouped
                  />
                </div>
              ) : null}
              {canUsePrivateApis ? (
                <details className={cn(sourceCard, "mt-4 p-3")}>
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
                    Document tools
                  </summary>
                  <DocumentManualTagEditor
                    document={document}
                    canManage={canUsePrivateApis}
                    clientDemoMode={clientDemoMode}
                    authorizationHeader={authorizationHeader}
                    onLabelsUpdated={handleDocumentLabelsUpdated}
                    onUnauthorized={markSessionExpired}
                  />
                </details>
              ) : null}
            </section>
          ) : null}

          <section id="source-images" className={cn(panel, "scroll-mt-24 p-4 md:col-span-2 lg:col-span-1")}>
            <PanelHeading
              icon={FileImage}
              title="Tables and diagrams"
              description={
                effectiveLoadingDocument
                  ? "Indexed tables, diagrams, and image captions."
                  : clinicalImages.length === 1
                    ? "1 indexed table, diagram, or image caption."
                    : `${clinicalImages.length} indexed tables, diagrams, and image captions.`
              }
            />
            <div className="mt-3 space-y-3">
              {canUsePrivateApis && tableFacts.length ? (
                <details className={cn(sourceCard, "p-3")}>
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
                    Table tools
                  </summary>
                  <div className="mt-3">
                    <TableReviewPanel
                      tableFacts={tableFacts}
                      canReview={canUsePrivateApis}
                      busyFactId={reviewingTableFactId}
                      onReview={reviewTableFact}
                    />
                  </div>
                </details>
              ) : null}
              {effectiveLoadingDocument ? (
                <LoadingPanel label="Loading extracted tables" />
              ) : clinicalImages.length === 0 ? (
                <p className={cn("text-base-minus", textMuted)}>No indexed clinically useful tables or diagrams.</p>
              ) : (
                clinicalImages.map((image) => <DocumentImage key={image.id} image={image} />)
              )}
              {!effectiveLoadingDocument && auditImages.length > 0 ? (
                <details className={cn(sourceCard, "p-3")}>
                  <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
                    Administrative/reference tables retained for audit ({auditImages.length})
                  </summary>
                  <div className="mt-3 grid gap-3">
                    {auditImages.map((image) => (
                      <DocumentImage key={image.id} image={image} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          {indexHealth ? (
            <details data-testid="indexing-details" className={cn(panel, "p-3 md:col-span-2 lg:col-span-1")}>
              <summary className={cn("cursor-pointer select-none", eyebrowText)}>Indexing details</summary>
              <dl className="mt-3 grid gap-2 text-xs font-semibold text-[color:var(--text-muted)] sm:grid-cols-2">
                <div>
                  <dt>Extraction</dt>
                  <dd className="mt-0.5 text-[color:var(--text)]">{indexHealth.extractionQuality ?? "unknown"}</dd>
                </div>
                <div>
                  <dt>Index version</dt>
                  <dd className={cn("mt-0.5 truncate text-[color:var(--text)]", codeText)}>
                    {indexHealth.indexVersion ?? "unknown"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt>Indexed</dt>
                  <dd className="mt-0.5 text-[color:var(--text)]">{indexHealth.indexedAt ?? "not recorded"}</dd>
                </div>
              </dl>
            </details>
          ) : null}
        </aside>
      </section>
      {readyDocument ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSummarizeDocument) void summarize();
          }}
          data-scroll-hidden={composerScrollHidden ? "true" : undefined}
          onFocusCapture={() => setComposerChromeFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerChromeFocused(false);
          }}
          className="document-viewer-composer floating-composer-edge dashboard-composer-edge fixed z-40 mx-auto flex min-h-[56px] max-w-3xl items-center gap-2 rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 shadow-[var(--shadow-lux)] ring-1 ring-white/35 backdrop-blur-xl max-sm:transition-transform max-sm:duration-200 max-sm:ease-out motion-reduce:transition-none"
        >
          <button
            type="button"
            onClick={() => setMobileActionsOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
            aria-label="Open document actions"
          >
            <Plus className="h-5 w-5" />
          </button>
          <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
            <span className="sr-only">Search or answer from this document</span>
            <input
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder="Search or answer from this document..."
              className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-base font-medium text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
            />
          </label>
          <button
            type="submit"
            disabled={!canSummarizeDocument}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-inset),var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Answer from this document"
          >
            {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      ) : null}
    </main>
  );
}
