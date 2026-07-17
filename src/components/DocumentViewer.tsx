"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
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
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibleTable, hasRenderableAccessibleTable } from "@/components/AccessibleTable";
import { documentDisplayTitle, documentOrganizationProfile } from "@/components/DocumentOrganizationBadges";
import { formatDocumentLabelDisplay } from "@/lib/document-tags";
import {
  DocumentActionAnchor,
  DocumentActionButton,
  DocumentFileTile,
  DocumentMetaRow,
  documentFileKind,
  documentTileTone,
} from "@/components/clinical-dashboard/document-ui";
import { useHideOnScroll } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { AnswerProgressStepper } from "@/components/clinical-dashboard/answer-status";
import type { TimedAnswerProgressUpdate } from "@/components/clinical-dashboard/answer-progress";
import { readAnswerStream } from "@/components/clinical-dashboard/search-utils";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
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
} from "@/components/ui-primitives";
import { BadgeCluster } from "@/components/clinical-dashboard/clinical-badge";
import { SignedImage } from "@/components/clinical-dashboard/signed-image";
import { NativePdfEmbed, PdfCanvasViewer } from "@/components/document-viewer/pdf-canvas-viewer";
import { NonPdfSourcePreview } from "@/components/document-viewer/non-pdf-source-preview";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import {
  documentLoadKey,
  documentPageHref,
  isFullDocumentReload,
  nextLoadedDocumentKey,
} from "@/lib/document-viewer-navigation";
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
import { documentSummaryQuestion } from "@/lib/answer-contract";
import type { DocumentDetailPayload } from "@/lib/document-detail-contract";

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

type SignedUrlResponsePayload = {
  url?: string;
  caption?: string;
  mimeType?: string;
  fileType?: string;
  expiresAt?: string;
  error?: string;
};

// Single signed-URL GET: parse JSON, mark the session expired on 401, and throw
// a message on failure. Shared by the initial load and the expiry refresh so the
// fetch/auth handling lives in exactly one place.
async function requestSignedUrlPayload(
  endpoint: string,
  options: {
    signal: AbortSignal;
    headers: HeadersInit | undefined;
    onUnauthorized: () => void;
    errorMessage: string;
  },
): Promise<SignedUrlResponsePayload> {
  const response = await fetch(endpoint, { signal: options.signal, headers: options.headers });
  const payload: SignedUrlResponsePayload = await response.json();
  if (response.status === 401) options.onUnauthorized();
  if (!response.ok) throw new Error(payload?.error || options.errorMessage);
  return payload;
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

function rowsById<T extends { id: string }>(incoming: T[]) {
  const rows = new Map<string, T>();
  for (const row of incoming) rows.set(row.id, row);
  return Array.from(rows.values());
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
      {/* The overview sentence leads the document landing card; the profile here
          shows only the structured detail so the same text is not printed twice. */}
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

function FormattedHighYieldSummary({
  formatted,
  showLead = true,
}: {
  formatted: FormattedDocumentSummaryModel;
  showLead?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (formatted.isEmpty) return null;
  // The lead sentence already leads the document landing "Overview" card, so the
  // right rail can suppress it to avoid printing the same sentence twice.
  const leadVisible = showLead && Boolean(formatted.lead);

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
      {leadVisible ? (
        <p className={cn(proseMeasure, "text-base-minus leading-6 text-[color:var(--text-muted)]")}>
          <SafeBoldText text={formatted.lead ?? ""} />
        </p>
      ) : null}
      {visibleSections.map((section, index) => (
        <section
          key={section.id}
          className={cn((leadVisible || index > 0) && "border-t border-[color:var(--border)] pt-3")}
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

  const tableHeading = sourceTextForCompactDisplay([image.tableLabel, image.tableTitle].filter(Boolean).join(": "));
  const cleanCaption = image.caption ? sourceTextForCompactDisplay(image.caption) : "";
  const tableMarkdown = image.accessibleTableMarkdown?.trim()
    ? image.accessibleTableMarkdown
    : looksLikeTableText(image.tableTextSnippet)
      ? image.tableTextSnippet
      : null;
  // Only let the table "lead" (collapsing the source image) when AccessibleTable
  // will actually render a table. Columns-only input or unparseable markdown
  // render nothing, so those route to the image-first branch instead of leaving
  // an empty caption above a hidden source image.
  const hasStructuredTable = hasRenderableAccessibleTable({
    markdown: tableMarkdown,
    rows: image.tableRows,
    columns: image.tableColumns,
  });
  const tableCaption = tableHeading || cleanCaption || "Document table";
  const showImageCaptionLine = cleanCaption && cleanCaption !== tableCaption;
  const displayLabels = smartEvidenceTags(
    image.labels,
    [tableHeading, cleanCaption, image.tableTextSnippet ? sourceTextForCompactDisplay(image.tableTextSnippet) : null]
      .filter(Boolean)
      .join(" "),
  );

  // When a structured, accessible table exists the extracted table leads and the
  // raw 4:3 table image collapses behind a "Show original" toggle, so the same
  // content is not shown twice at full height. Without a structured table the
  // image is the only representation, so it stays inline and prominent.
  const imageBlock = (
    <div className="rounded-lg bg-[color:var(--surface-inset)] p-3">
      <SignedImage
        endpoint={endpoint}
        alt={cleanCaption || tableHeading || "Document image"}
        caption={tableHeading || cleanCaption || undefined}
        failureLabel="Image preview failed."
        retryLabel="Retry"
        className="w-full"
        zoomable
      />
    </div>
  );

  const figcaptionBlock = (
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
  );
  return (
    <figure className={cn(sourceCard, "overflow-hidden p-3")}>
      <p className={cn("text-xs font-semibold uppercase tracking-[0.08em]", textMuted)}>
        page {image.page_number ?? "n/a"}
        {image.image_type ? ` · ${image.image_type.replaceAll("_", " ")}` : ""}
        {image.tableRole ? ` · ${image.tableRole}` : ""}
        {image.clinicalUseClass && image.clinicalUseClass !== "clinical_evidence"
          ? ` · ${image.clinicalUseClass.replaceAll("_", " ")}`
          : ""}
      </p>
      {hasStructuredTable ? (
        <>
          {figcaptionBlock}
          <details className="group mt-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text)]">
              <FileImage aria-hidden="true" className="h-4 w-4 shrink-0" />
              Show original table image
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition group-open:rotate-180" />
            </summary>
            <div className="mt-2">{imageBlock}</div>
          </details>
        </>
      ) : (
        <>
          <div className="mt-2">{imageBlock}</div>
          {figcaptionBlock}
        </>
      )}
      {displayLabels.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {displayLabels.map((label) => (
            <span
              key={`${image.id}:${label}`}
              className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 text-2xs font-semibold text-[color:var(--text-muted)]"
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
    <details className={cn(sourceCard, "p-3")}>
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
                      <Loader2 aria-hidden="true" className="mr-1 h-3 w-3 animate-spin" />
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
  textHref: "#source-text";
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
            onClick={() => {
              const target = window.document.querySelector(anchor.href);
              window.document
                .querySelectorAll<HTMLDetailsElement>('details[name="document-viewer-section"]')
                .forEach((disclosure) => {
                  if (disclosure !== target) disclosure.open = false;
                });
              if (target instanceof HTMLDetailsElement) target.open = true;
            }}
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

function DocumentSectionSummary({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
      <span className="inline-flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span
            role="heading"
            aria-level={2}
            className="block text-base font-semibold text-[color:var(--text-heading)]"
          >
            {title}
          </span>
          <span className={cn("mt-1 block text-sm leading-6", textMuted)}>{description}</span>
        </span>
      </span>
      <ChevronDown
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180"
      />
    </summary>
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
    // Nothing is pinned (e.g. a direct visit, not arrived-at via a citation), so
    // this stays a quiet one-line hint rather than a full card taking prime space.
    return (
      <p
        id={sectionId}
        data-testid="pinned-source-evidence"
        className={cn("scroll-mt-24 flex items-center gap-2 text-xs leading-5", textMuted)}
      >
        <Quote aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-70" />
        Open a cited answer passage to pin its exact excerpt here.
      </p>
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
              <Target aria-hidden="true" className="h-3.5 w-3.5" />
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
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
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

// Memoised: both the mobile <details> and desktop copies stay mounted and are
// CSS-toggled, so without this every unrelated parent re-render (e.g. composer
// typing) re-rendered both instances. All props are referentially stable across
// those renders (onSearchChange is a stable setState), so memo actually elides them.
const IndexedTextPanel = memo(function IndexedTextPanel({
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
  sectionId?: "source-text";
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
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveHit(1)}
                className={cn(secondaryButton, "min-h-9 min-w-9 justify-center p-0")}
                aria-label="Next document search hit"
                title="Next document search hit"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
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
                          className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-2 text-2xs font-bold text-[color:var(--clinical-accent)]"
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
});

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
          <Tag aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
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
          {busyAction === "add" ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="h-4 w-4" />
          )}
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
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check aria-hidden="true" className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={busyAction !== null}
                        className={cn(secondaryButton, "min-h-9 px-2 text-xs")}
                        aria-label="Cancel edit"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
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
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteManualTag(label)}
                        disabled={!canManage || busyAction !== null}
                        className={cn(secondaryButton, "min-h-9 px-2 text-xs text-[color:var(--danger)]")}
                        aria-label={`Remove ${label.label}`}
                      >
                        {busyAction === `delete:${label.id}` ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
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

// Derive the header eyebrow from the document's real type instead of asserting
// every document is a "Clinical guideline". Prefers the organization profile's
// document_type, then a high-confidence document_type label, then a neutral fallback.
function documentTypeEyebrow(document: ClinicalDocument) {
  const profile = documentOrganizationProfile(document);
  const profileType =
    typeof profile?.document_type?.label === "string" && profile.document_type.label !== "unknown"
      ? profile.document_type.label
      : null;
  const labelType = document.labels?.find(
    (label) => label.label_type === "document_type" && (label.confidence ?? 0) >= 0.5,
  )?.label;
  const typeLabel = profileType ?? labelType;
  return typeLabel ? formatDocumentLabelDisplay(typeLabel, "document_type") : "Clinical document";
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

function DocumentPagePreview({
  href,
  pageNumber,
  onNavigate,
}: {
  href: string;
  pageNumber: number | null;
  onNavigate: (page: number) => void;
}) {
  // A real "jump to page" chip rather than a fake wireframe thumbnail that looks
  // like a skeleton that never resolves.
  return (
    <a
      href={href}
      onClick={(event) => {
        if (
          pageNumber === null ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        onNavigate(pageNumber);
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)]/40 hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent)]"
    >
      <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
      <span className="nums">Jump to p.{pageNumber ?? "n/a"}</span>
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
  pageHref,
  onPageChange,
  onAskFromDocument,
  onAddToScope,
  onDownload,
  downloading,
  canSummarizeDocument,
}: {
  document: ClinicalDocument;
  initialPage: number;
  signedUrl: string | null;
  downloadUrl: string | null;
  pages: PageRow[];
  pageHref: (page: number) => string;
  onPageChange: (page: number) => void;
  onAskFromDocument: () => void;
  onAddToScope: () => void;
  onDownload: () => void;
  downloading: boolean;
  canSummarizeDocument: boolean;
}) {
  const keySections = documentKeySections(document);
  const usefulPages = usefulDocumentPages(initialPage, pages);
  const documentType = compactDocumentType(document);
  const overviewText = documentOverviewText(document);

  return (
    <section className="grid gap-4 lg:grid-cols-3 lg:items-start">
      <article className={cn(panel, "p-4 sm:p-5 lg:col-span-3")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <DocumentFileTile
            kind={documentType}
            tone={documentTileTone(documentType)}
            className="h-20 w-20 rounded-xl text-sm sm:h-24 sm:w-24"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
              {documentTypeEyebrow(document)}
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
            {overviewText ? (
              <p className={cn("mt-2 line-clamp-2 text-sm leading-6", textMuted)}>{overviewText}</p>
            ) : null}
            {/* Search relevance badges are rendered in document search results; the viewer has no ranking context. */}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {signedUrl ? (
            <DocumentActionAnchor
              href={signedUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(primaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
            >
              Open PDF
            </DocumentActionAnchor>
          ) : (
            <DocumentActionAnchor
              href="#pdf-preview-section"
              className={cn(primaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
            >
              Open preview
            </DocumentActionAnchor>
          )}
          {downloadUrl ? (
            <DocumentActionAnchor
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              icon={Download}
              download={document.file_name || "clinical-source.pdf"}
              className={cn(secondaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
            >
              Download
            </DocumentActionAnchor>
          ) : (
            <DocumentActionButton
              onClick={onDownload}
              disabled={downloading}
              icon={downloading ? Loader2 : Download}
              className={cn(secondaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
            >
              {downloading ? "Preparing" : "Download"}
            </DocumentActionButton>
          )}
          <DocumentActionButton
            onClick={onAddToScope}
            icon={Target}
            className={cn(secondaryButton, "w-full min-h-12 px-2 text-xs sm:text-sm")}
          >
            Add to scope
          </DocumentActionButton>
          <DocumentActionButton
            onClick={onAskFromDocument}
            disabled={!canSummarizeDocument}
            icon={Sparkles}
            className={cn(secondaryButton, "w-full min-h-12 whitespace-nowrap px-2 text-xs sm:text-sm")}
          >
            Answer from this
          </DocumentActionButton>
        </div>
      </article>

      <section id="document-overview" className={cn(sourceCard, "scroll-mt-24 p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Overview</h3>
            <p className={cn("mt-1 line-clamp-3 text-sm leading-6", textMuted)}>{documentOverviewText(document)}</p>
          </div>
        </div>
      </section>

      <section className={cn(sourceCard, "p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Tag aria-hidden="true" className="h-5 w-5" />
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
        </div>
      </section>

      <section className={cn(sourceCard, "p-4")}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[color:var(--text-heading)]">Useful pages</h3>
            <p className={cn("mt-1 text-sm leading-6", textMuted)}>Most relevant pages for this document.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(usefulPages.length ? usefulPages : [initialPage]).map((page) => (
                <DocumentPagePreview key={page} href={pageHref(page)} pageNumber={page} onNavigate={onPageChange} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

/**
 * Renders the clinical document viewer with source previews, extracted content, summaries, and document tools.
 *
 * @param documentId - The identifier of the document to load.
 * @param initialPage - The page to display initially in the source preview.
 * @param chunkId - An optional indexed passage to pin and scroll into view.
 * @returns The document viewer interface.
 */
export function DocumentViewer({
  documentId,
  initialPage,
  chunkId,
  initialDetail,
  initialError,
}: {
  documentId: string;
  initialPage: number;
  chunkId?: string;
  initialDetail?: DocumentDetailPayload;
  initialError?: string;
}) {
  const router = useRouter();
  const [activeRoute, setActiveRoute] = useState(() => ({ page: initialPage, chunkId }));
  const activePage = activeRoute.page;
  const activeChunkId = activeRoute.chunkId;

  useEffect(() => {
    const syncFromHistory = () => {
      const params = new URLSearchParams(window.location.search);
      const parsedPage = Number.parseInt(params.get("page") ?? "", 10);
      setActiveRoute({
        page: Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1,
        chunkId: params.get("chunk") ?? undefined,
      });
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  const navigateToPage = useCallback(
    (page: number) => {
      const nextPage = Math.max(1, Math.trunc(page));
      if (nextPage === activePage) return;
      window.history.pushState(null, "", documentPageHref(documentId, nextPage));
      setActiveRoute({ page: nextPage, chunkId: undefined });
    },
    [activePage, documentId],
  );
  useEffect(() => {
    const previousOpenStates = new Map<HTMLDetailsElement, boolean>();
    const expandPrintableDisclosures = () => {
      if (previousOpenStates.size) return;
      previousOpenStates.clear();
      const printable = window.document.querySelectorAll<HTMLDetailsElement>("details.source-print");
      window.document
        .querySelectorAll<HTMLDetailsElement>('details.source-print, details[name="document-viewer-section"]')
        .forEach((disclosure) => {
          previousOpenStates.set(disclosure, disclosure.open);
        });
      printable.forEach((disclosure) => {
        disclosure.open = true;
      });
    };
    const restorePrintableDisclosures = () => {
      const connected = [...previousOpenStates].filter(([disclosure]) => disclosure.isConnected);
      connected.forEach(([disclosure]) => {
        disclosure.open = false;
      });
      connected.forEach(([disclosure, wasOpen]) => {
        if (wasOpen) disclosure.open = true;
      });
      previousOpenStates.clear();
    };
    window.addEventListener("beforeprint", expandPrintableDisclosures);
    window.addEventListener("afterprint", restorePrintableDisclosures);
    return () => {
      restorePrintableDisclosures();
      window.removeEventListener("beforeprint", expandPrintableDisclosures);
      window.removeEventListener("afterprint", restorePrintableDisclosures);
    };
  }, []);
  const [document, setDocument] = useState<ClinicalDocument | null>(() => initialDetail?.document ?? null);
  const [pages, setPages] = useState<PageRow[]>(() => initialDetail?.pages ?? []);
  const [images, setImages] = useState<ImageRow[]>(() => initialDetail?.images ?? []);
  const [tableFacts, setTableFacts] = useState<TableFactRow[]>(() => initialDetail?.tableFacts ?? []);
  const [chunks, setChunks] = useState<ChunkRow[]>(() => initialDetail?.chunks ?? []);
  const [indexHealth, setIndexHealth] = useState<DocumentIndexHealth | null>(() => initialDetail?.indexHealth ?? null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloadSignedUrl, setDownloadSignedUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<RagAnswer | null>(null);
  const [summaryQuery, setSummaryQuery] = useState(documentSummaryQuestion);
  const [summaryProgressEvents, setSummaryProgressEvents] = useState<TimedAnswerProgressUpdate[]>([]);
  const [summaryProgressStartedAt, setSummaryProgressStartedAt] = useState<number | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(() => !initialDetail && !initialError);
  const [viewerError, setViewerError] = useState<string | null>(() => initialError ?? null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingSource, setDownloadingSource] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  // Bounds *consecutive* auto-refreshes of an expired PDF signed URL so a
  // persistently failing URL can't loop. Reset on document change and on a
  // successful reload, so a long session that legitimately expires many times
  // over is never dead-ended — only an unrecoverable URL exhausts the budget.
  const signedUrlRefreshCountRef = useRef(0);
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
    let observer: MutationObserver | null = null;
    // #main-content is the app-shell scroll container: it mounts once (usually
    // before this effect runs) and persists for the viewer's lifetime. Resolve it
    // synchronously, and only fall back to observing the DOM until it appears —
    // then disconnect, rather than reacting to every app-wide mutation forever.
    const sync = () => {
      if (cancelled) return;
      const main = window.document.getElementById("main-content");
      if (!main) return;
      setShellScrollContainer((current) => (current === main ? current : main));
      observer?.disconnect();
      observer = null;
    };
    observer = new MutationObserver(sync);
    observer.observe(window.document.body, { childList: true, subtree: true });
    sync();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);
  const scrollHidden = useHideOnScroll({
    ...(shellScrollContainer ? { scrollContainer: shellScrollContainer } : {}),
    resetKey: `${documentId}:${activePage}:${activeChunkId ?? ""}`,
  });
  const composerScrollHidden = scrollHidden && !mobileActionsOpen && !composerChromeFocused;
  // Read localStorage once on mount, then seed both derived states from it.
  const [initialPdfViewerMode] = useState(getInitialPdfViewerMode);
  const [useNativePdfViewer, setUseNativePdfViewer] = useState(initialPdfViewerMode.useNativePdfViewer);
  const [hasExplicitPdfViewerMode, setHasExplicitPdfViewerMode] = useState(
    initialPdfViewerMode.hasExplicitPdfViewerMode,
  );
  const [viewerModeInitialized] = useState(true);
  const generatedSummaryRef = useRef<HTMLElement | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      summaryAbortRef.current?.abort();
    },
    [],
  );
  const {
    status: authStatus,
    isConfigured,
    authorizationHeader,
    registerAuthRequest,
    isAuthEpochCurrent,
    markSessionExpired,
  } = useAuthSession();
  const [authLoadingTimedOut, setAuthLoadingTimedOut] = useState(false);
  const [serverDemoMode, setServerDemoMode] = useState(
    () => initialDetail?.demoMode ?? process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  );
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

  const applyPreviewSignedUrlResult = useCallback(
    (result: PromiseSettledResult<SignedUrlResponsePayload>, endpoint: string) => {
      if (result.status === "fulfilled") {
        const payload = result.value;
        if (payload.url) setCachedSignedUrl(endpoint, { ...payload, url: payload.url });
        setSignedUrl(payload.url ?? null);
        setPreviewError(null);
        return;
      }
      setSignedUrl(null);
      setPreviewError(result.reason instanceof Error ? result.reason.message : "Source preview could not be loaded.");
    },
    [],
  );

  const openSourcePreview = useCallback(
    (options: { signal: AbortSignal; useCache: boolean }) => {
      const endpoint = `/api/documents/${documentId}/signed-url`;
      const cached = options.useCache ? getCachedSignedUrl(endpoint) : null;
      return cached
        ? Promise.resolve(cached)
        : requestSignedUrlPayload(endpoint, {
            signal: options.signal,
            headers: clientDemoMode ? undefined : authorizationHeader,
            onUnauthorized: markSessionExpired,
            errorMessage: "Source preview could not be loaded.",
          });
    },
    [authorizationHeader, clientDemoMode, documentId, markSessionExpired],
  );

  // Re-issue only the preview URL (no document-detail or download request) when a PDF's URL
  // expires mid-session, so the viewer refreshes in place without the full
  // reload/flicker. Its AbortController is cancelled on the next refresh and on unmount.
  const refreshControllerRef = useRef<AbortController | null>(null);
  const refreshSignedUrls = useCallback(() => {
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;

    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    const authRequest = registerAuthRequest(controller);

    readLocalProjectIdentity()
      .then((identity) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) {
          throw new DOMException("Stale authentication epoch", "AbortError");
        }
        if (!identity?.localServer?.safeLocalOrigin) {
          throw new Error(unsafeLocalProjectMessage(identity));
        }
        // handleSignedUrlExpired already cleared the cache, so always mint fresh.
        return openSourcePreview({ signal: controller.signal, useCache: false });
      })
      .then((payload) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        applyPreviewSignedUrlResult({ status: "fulfilled", value: payload }, signedUrlEndpoint);
      })
      .catch((error) => {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        setPreviewError(error instanceof Error ? error.message : "Source preview could not be loaded.");
      })
      .finally(() => {
        authRequest.release();
        if (refreshControllerRef.current === controller) refreshControllerRef.current = null;
      });
  }, [documentId, registerAuthRequest, isAuthEpochCurrent, openSourcePreview, applyPreviewSignedUrlResult]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  const downloadActionRef = useRef<Promise<void> | null>(null);
  const downloadControllerRef = useRef<AbortController | null>(null);
  const currentDocumentFileName = document?.file_name;
  const openSourceDownload = useCallback(() => {
    if (downloadActionRef.current) return downloadActionRef.current;

    const endpoint = `/api/documents/${documentId}/signed-url?download=true`;
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    const authRequest = registerAuthRequest(controller);
    const action = (async () => {
      setDownloadingSource(true);
      setDownloadError(null);
      try {
        const identity = await readLocalProjectIdentity();
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        if (!identity?.localServer?.safeLocalOrigin) throw new Error(unsafeLocalProjectMessage(identity));

        const cached = getCachedSignedUrl(endpoint);
        const payload =
          cached ??
          (await requestSignedUrlPayload(endpoint, {
            signal: controller.signal,
            headers: clientDemoMode ? undefined : authorizationHeader,
            onUnauthorized: markSessionExpired,
            errorMessage: "Download URL could not be loaded.",
          }));
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch) || !payload.url) return;

        setCachedSignedUrl(endpoint, { ...payload, url: payload.url });
        setDownloadSignedUrl(payload.url);
        const anchor = window.document.createElement("a");
        anchor.href = payload.url;
        anchor.rel = "noreferrer";
        anchor.download = currentDocumentFileName || "clinical-source";
        anchor.click();
      } catch (error) {
        if (controller.signal.aborted || !isAuthEpochCurrent(authRequest.epoch)) return;
        setDownloadError(error instanceof Error ? error.message : "Download URL could not be loaded.");
      } finally {
        authRequest.release();
        if (downloadControllerRef.current === controller) {
          downloadControllerRef.current = null;
          setDownloadingSource(false);
        }
      }
    })();
    downloadActionRef.current = action;
    void action.finally(() => {
      if (downloadActionRef.current === action) downloadActionRef.current = null;
    });
    return action;
  }, [
    authorizationHeader,
    clientDemoMode,
    currentDocumentFileName,
    documentId,
    isAuthEpochCurrent,
    markSessionExpired,
    registerAuthRequest,
  ]);

  useEffect(
    () => () => {
      downloadControllerRef.current?.abort();
      downloadControllerRef.current = null;
      downloadActionRef.current = null;
    },
    [documentId],
  );

  // Distinguishes a full document (re)load — a new documentId or an explicit
  // retry (previewAttempt) — from page/chunk navigation on the already-loaded
  // document. Navigation only re-windows the detail; a full load also resets the
  // preview and re-issues only its signed URL.
  const loadedKeyRef = useRef<string | null>(null);
  const detailControllerRef = useRef<AbortController | null>(null);
  const detailRequestSequenceRef = useRef(0);
  const localProjectIdentityPromiseRef = useRef<ReturnType<typeof readLocalProjectIdentity> | null>(null);
  const initialRouteRef = useRef({ documentId, initialPage, chunkId });
  const navigatedFromInitialRouteRef = useRef(false);

  useEffect(() => {
    if (!canViewSourceDocuments && authStatus === "loading") {
      return () => undefined;
    }
    if (!canViewSourceDocuments) {
      return () => undefined;
    }

    const matchesInitialRoute =
      initialRouteRef.current.documentId === documentId &&
      initialRouteRef.current.initialPage === activePage &&
      initialRouteRef.current.chunkId === activeChunkId;
    if (!matchesInitialRoute) navigatedFromInitialRouteRef.current = true;
    const useInitialResult =
      previewAttempt === 0 &&
      matchesInitialRoute &&
      !navigatedFromInitialRouteRef.current &&
      Boolean(initialDetail || initialError);

    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    const requestSequence = ++detailRequestSequenceRef.current;
    const authRequest = registerAuthRequest(controller);
    const loadKey = documentLoadKey(documentId, previewAttempt);
    const isFullReload = isFullDocumentReload(loadedKeyRef.current, loadKey);
    const reset = window.setTimeout(() => {
      // Skip the reset on navigation so the mounted PDF and current content stay
      // visible (no loading flash) while the new page window loads in the background.
      if (!controller.signal.aborted && isFullReload && !useInitialResult) {
        setLoadingDocument(true);
        setViewerError(null);
        setPreviewError(null);
        setDownloadError(null);
        setDownloadingSource(false);
        setSignedUrl(null);
        setDownloadSignedUrl(null);
      }
    }, 0);
    const detailParams = new URLSearchParams({
      page: String(Math.max(1, activePage || 1)),
      pageLimit: "9",
      chunkLimit: "16",
      assetScope: "window",
    });
    if (activeChunkId) detailParams.set("chunk", activeChunkId);
    const detailUrl = `/api/documents/${documentId}?${detailParams.toString()}`;
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;
    if (!localProjectIdentityPromiseRef.current) {
      const pendingIdentity = readLocalProjectIdentity();
      localProjectIdentityPromiseRef.current = pendingIdentity;
      void pendingIdentity.then(
        (identity) => {
          if (!identity?.localServer?.safeLocalOrigin && localProjectIdentityPromiseRef.current === pendingIdentity) {
            localProjectIdentityPromiseRef.current = null;
          }
        },
        () => {
          if (localProjectIdentityPromiseRef.current === pendingIdentity) {
            localProjectIdentityPromiseRef.current = null;
          }
        },
      );
    }
    const identityRequest = localProjectIdentityPromiseRef.current!;
    identityRequest
      .then((identity) => {
        if (
          controller.signal.aborted ||
          requestSequence !== detailRequestSequenceRef.current ||
          !isAuthEpochCurrent(authRequest.epoch)
        ) {
          throw new DOMException("Stale authentication epoch", "AbortError");
        }
        if (!identity?.localServer?.safeLocalOrigin) {
          setLocalProjectReady(false);
          throw new Error(unsafeLocalProjectMessage(identity));
        }
        setLocalProjectReady(true);

        const detailRequest: Promise<DocumentDetailPayload> = useInitialResult
          ? initialDetail
            ? Promise.resolve(initialDetail)
            : Promise.reject(new Error(initialError || "Document could not be loaded."))
          : fetch(detailUrl, {
              signal: controller.signal,
              headers: clientDemoMode ? undefined : authorizationHeader,
            }).then(async (response) => {
              const payload = await response.json();
              if (response.status === 401) markSessionExpired();
              if (!response.ok) throw new Error(payload.error || "Document details could not be loaded.");
              return payload as DocumentDetailPayload;
            });
        // Navigation keeps the current preview; a full load re-issues only the preview URL.
        const previewRequest = isFullReload
          ? Promise.allSettled([openSourcePreview({ signal: controller.signal, useCache: true })])
          : Promise.resolve(null);

        return Promise.all([Promise.allSettled([detailRequest]), previewRequest]);
      })
      .then(([[detailResult], previewResults]) => {
        if (
          controller.signal.aborted ||
          requestSequence !== detailRequestSequenceRef.current ||
          !isAuthEpochCurrent(authRequest.epoch)
        )
          return;
        const detailLoaded = detailResult.status === "fulfilled";
        // The server-rendered initial result (including a sanitized failure) is
        // already authoritative for this attempt. Mark it handled so an auth
        // state refresh cannot duplicate the initial detail/preview requests;
        // an explicit retry increments previewAttempt and gets a fresh key.
        loadedKeyRef.current = useInitialResult
          ? loadKey
          : nextLoadedDocumentKey(loadedKeyRef.current, loadKey, detailLoaded);

        if (detailLoaded) {
          const detail = detailResult.value;
          setDocument(detail.document ?? null);
          // Keep the previous window visible while loading, then atomically
          // replace it so client memory and mounted DOM stay bounded.
          setPages(rowsById(detail.pages));
          setImages(rowsById(detail.images));
          setTableFacts(rowsById(detail.tableFacts));
          setChunks(rowsById(detail.chunks));
          setIndexHealth(detail.indexHealth ?? null);
          setServerDemoMode(detail.demoMode);
          setViewerError(null);
        } else {
          // Never retain evidence from the previous page under a newly selected
          // route. A navigation failure becomes an explicit retryable error.
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

        if (previewResults) {
          const previewResult = previewResults[0];
          if (previewResult) applyPreviewSignedUrlResult(previewResult, signedUrlEndpoint);
        }
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          requestSequence !== detailRequestSequenceRef.current ||
          !isAuthEpochCurrent(authRequest.epoch)
        )
          return;
        setDocument(null);
        setPages([]);
        setImages([]);
        setTableFacts([]);
        setChunks([]);
        setIndexHealth(null);
        setViewerError(error instanceof Error ? error.message : "Document could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted && requestSequence === detailRequestSequenceRef.current) {
          setLoadingDocument(false);
          if (detailControllerRef.current === controller) detailControllerRef.current = null;
        }
      });

    return () => {
      window.clearTimeout(reset);
      controller.abort();
      authRequest.release();
      if (detailControllerRef.current === controller) detailControllerRef.current = null;
    };
  }, [
    authStatus,
    authorizationHeader,
    canUsePrivateApis,
    canViewSourceDocuments,
    clientDemoMode,
    documentId,
    activeChunkId,
    activePage,
    isConfigured,
    markSessionExpired,
    registerAuthRequest,
    isAuthEpochCurrent,
    previewAttempt,
    initialDetail,
    initialError,
    openSourcePreview,
    applyPreviewSignedUrlResult,
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
    const summaryMode = sourceSearch.trim().length === 0;
    const query = summaryMode ? documentSummaryQuestion : sourceSearch.trim();
    const controller = new AbortController();
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = controller;
    const authRequest = registerAuthRequest(controller);
    const startedAt = Date.now();
    setLoadingSummary(true);
    setSummary(null);
    setSummaryQuery(query);
    setSummaryError(null);
    setSummaryProgressStartedAt(startedAt);
    setSummaryProgressEvents([
      {
        stage: "scoping",
        message: "Preparing the clinical search scope.",
        receivedAt: startedAt,
      },
    ]);
    try {
      if (!isAuthEpochCurrent(authRequest.epoch)) {
        throw new DOMException("Stale authentication epoch", "AbortError");
      }
      const response = await fetch("/api/answer/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({ query, documentId, ...(summaryMode ? { summaryMode: true } : {}) }),
        signal: controller.signal,
      });
      if (response.status === 401) markSessionExpired();
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Answer could not be generated from this document.",
        );
      }
      const payload = await readAnswerStream(response, (progress) => {
        if (
          controller.signal.aborted ||
          summaryAbortRef.current !== controller ||
          !isAuthEpochCurrent(authRequest.epoch)
        )
          return;
        setSummaryProgressEvents((events) => [...events, { ...progress, receivedAt: Date.now() }].slice(-20));
      });
      if (controller.signal.aborted || summaryAbortRef.current !== controller || !isAuthEpochCurrent(authRequest.epoch))
        return;
      setSummary(payload);
      window.requestAnimationFrame(() => {
        generatedSummaryRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (controller.signal.aborted || summaryAbortRef.current !== controller || !isAuthEpochCurrent(authRequest.epoch))
        return;
      setSummaryProgressEvents([]);
      setSummaryProgressStartedAt(null);
      setSummaryError(error instanceof Error ? error.message : "Answer could not be generated from this document.");
    } finally {
      authRequest.release();
      if (summaryAbortRef.current === controller) {
        summaryAbortRef.current = null;
        setLoadingSummary(false);
      }
    }
  }

  function stopSummary() {
    summaryAbortRef.current?.abort();
    summaryAbortRef.current = null;
    setLoadingSummary(false);
    setSummaryProgressEvents([]);
    setSummaryProgressStartedAt(null);
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
    ? `page ${activePage} · ${readyDocument.file_name}`
    : viewerState === "loading"
      ? `page ${activePage} · loading source`
      : (effectiveViewerError ?? "Source unavailable");
  const documentHomeHref = "/?mode=documents";
  const scopedDocumentHref = readyDocument
    ? `/?mode=documents&q=${encodeURIComponent(documentDisplayTitle(readyDocument))}&documentId=${encodeURIComponent(documentId)}`
    : documentHomeHref;
  const usefulPageHref = (page: number) => documentPageHref(documentId, page);
  const canSummarizeDocument = viewerState === "ready" && !loadingSummary && canUsePrivateApis;
  const summarizeTitle = canSummarizeDocument ? "Answer from this document" : "Load a source document before answering";
  const pageByNumber = useMemo(() => new Map(pages.map((page) => [page.page_number, page])), [pages]);
  const chunkById = useMemo(() => new Map(chunks.map((chunk) => [chunk.id, chunk])), [chunks]);
  const selectedPage = pageByNumber.get(activePage) ?? pages[0];
  const selectedChunk = activeChunkId ? chunkById.get(activeChunkId) : undefined;
  const { clinicalImages, auditImages } = partitionViewerImages(images);
  const generatedSummaryText = summary ? cleanClinicalSummaryText(summary.answer) : "";
  const generatedAnswerIsSummary = summaryQuery === documentSummaryQuestion;
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
    if (!activeChunkId || loadingDocument) return;
    window.document
      .querySelector<HTMLElement>(`[data-source-chunk-id="${CSS.escape(activeChunkId)}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeChunkId, loadingDocument, chunks.length]);
  const retryPreview = () => {
    setViewerError(null);
    setPreviewError(null);
    setDownloadError(null);
    // Re-open the guarded load path after a transient identity failure; the
    // cleared identity promise is still revalidated before any API request.
    setLocalProjectReady(true);
    setLoadingDocument(true);
    setPreviewAttempt((current) => current + 1);
  };
  useEffect(() => {
    signedUrlRefreshCountRef.current = 0;
  }, [documentId]);
  // The PDF signed URL has a 10-min TTL and pdf.js holds a dead reference once it
  // expires. When the canvas reports an expiry, drop cached URLs and mint a fresh
  // preview only (bounded so a broken URL can't loop). Download remains click-gated.
  // Stable identity (useCallback) so the memoised PdfCanvasViewer isn't re-rendered
  // — and its page re-rastered — every time an unrelated parent state (source-search
  // keystroke, composer focus, online/offline) changes.
  const handleSignedUrlExpired = useCallback(() => {
    if (signedUrlRefreshCountRef.current >= 2) return;
    signedUrlRefreshCountRef.current += 1;
    const signedUrlEndpoint = `/api/documents/${documentId}/signed-url`;
    clearCachedSignedUrl(signedUrlEndpoint);
    clearCachedSignedUrl(`${signedUrlEndpoint}?download=true`);
    setDownloadSignedUrl(null);
    refreshSignedUrls();
  }, [documentId, refreshSignedUrls]);
  // A successful reload means the refreshed URL was accepted, so the recovery
  // worked — restore the budget for the next (unrelated) TTL expiry. A broken
  // URL never loads, so it never resets, and the cap still stops its loop.
  const handlePdfLoadSuccess = useCallback(() => {
    signedUrlRefreshCountRef.current = 0;
  }, []);
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
      <header className="edge-glass-header z-30 border-b border-[color:var(--border)] py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[var(--shadow-tight)] backdrop-blur-xl sm:sticky sm:top-0">
        <div className="mx-auto flex h-12 min-w-0 max-w-[1440px] items-center gap-2">
          <Link
            href={documentHomeHref}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-sm font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
            aria-label="Back to documents"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="hidden sm:inline">Documents</span>
          </Link>

          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text)] sm:text-base">
            {headerTitle}
          </h1>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              href={scopedDocumentHref}
              className="hidden h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] min-[380px]:grid"
              aria-label="Add this document to scope"
              title={headerSubtitle}
            >
              <Target aria-hidden="true" className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileActionsOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              aria-label="Open document actions"
            >
              <Plus aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
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
                <Search aria-hidden="true" className="h-4 w-4" />
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
                {loadingSummary ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                )}
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
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Open original PDF
                </a>
              ) : (
                <a
                  href="#pdf-preview-section"
                  onClick={() => setMobileActionsOpen(false)}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
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
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Download PDF
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileActionsOpen(false);
                    void openSourceDownload();
                  }}
                  disabled={downloadingSource}
                  className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
                >
                  {downloadingSource ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download aria-hidden="true" className="h-4 w-4" />
                  )}
                  {downloadingSource ? "Preparing PDF" : "Download PDF"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileActionsOpen(false);
                  router.push(scopedDocumentHref);
                }}
                className={cn(secondaryButton, "min-h-12 justify-start text-xs")}
              >
                <Target aria-hidden="true" className="h-4 w-4" />
                Add to scope
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
        {downloadError ? (
          <InlineNotice tone="warning" className="lg:col-span-2">
            {downloadError}
          </InlineNotice>
        ) : null}
        {(loadingSummary || summary || summaryError) && (
          <div className="min-w-0 space-y-3 lg:col-span-2">
            {summaryProgressStartedAt && summaryProgressEvents.length > 0 ? (
              <AnswerProgressStepper
                events={summaryProgressEvents}
                startedAt={summaryProgressStartedAt}
                active={loadingSummary}
                onStop={stopSummary}
              />
            ) : null}
            {summary && (
              <section
                ref={generatedSummaryRef}
                data-testid="generated-clinical-summary"
                className={cn(panel, "p-4 source-print")}
              >
                <PanelHeading
                  icon={Sparkles}
                  title={generatedAnswerIsSummary ? "Clinical summary" : "Answer from this document"}
                  description={
                    generatedAnswerIsSummary
                      ? "From indexed passages, cleaned for practical use."
                      : "Grounded in indexed passages from this source."
                  }
                />
                <p className="mt-3 whitespace-pre-wrap text-base-minus leading-6 text-[color:var(--text-muted)]">
                  <SafeBoldText text={generatedSummaryText} />
                </p>
              </section>
            )}
            {summaryError && (
              <section className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-4 text-sm font-medium text-[color:var(--danger)]">
                <CircleAlert aria-hidden="true" className="mr-2 inline h-4 w-4" />
                {summaryError}
              </section>
            )}
          </div>
        )}

        {readyDocument ? (
          <div className="min-w-0 lg:col-span-2">
            <DocumentOverviewLanding
              document={readyDocument}
              initialPage={activePage}
              signedUrl={signedUrl}
              downloadUrl={downloadSignedUrl}
              pages={pages}
              pageHref={usefulPageHref}
              onPageChange={navigateToPage}
              onAskFromDocument={() => void summarize()}
              onAddToScope={() => router.push(scopedDocumentHref)}
              onDownload={() => void openSourceDownload()}
              downloading={downloadingSource}
              canSummarizeDocument={canSummarizeDocument}
            />
          </div>
        ) : null}

        {!readyDocument && viewerState !== "loading" ? (
          <div className="min-w-0 lg:col-span-2">
            <section className={cn(panel, "p-4")}>
              <button type="button" disabled className={cn(secondaryButton, "min-h-11 text-xs")}>
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Answer from this
              </button>
            </section>
          </div>
        ) : null}

        <div className="min-w-0 space-y-4 sm:space-y-5 lg:mx-auto lg:w-full lg:max-w-4xl">
          <DocumentViewerAnchors evidenceHref="#source-evidence" textHref="#source-text" className="lg:hidden" />

          <div id="pdf-preview-section" className={cn(panel, "scroll-mt-24 overflow-hidden")}>
            <div data-testid="pdf-preview">
              {effectiveLoadingDocument ? (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--clinical-accent-soft)_55%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm font-semibold text-[color:var(--text-muted)] sm:min-h-72">
                  <div className="max-w-sm">
                    <Loader2
                      aria-hidden="true"
                      className="mx-auto mb-3 h-5 w-5 animate-spin text-[color:var(--clinical-accent)]"
                    />
                    <p>Preparing PDF preview</p>
                    <ul className="mt-3 space-y-1 text-left text-xs font-medium text-[color:var(--text-muted)]">
                      <li>Loading source metadata</li>
                      <li>Preparing PDF preview</li>
                      <li>Loading extracted tables</li>
                    </ul>
                    {signedUrl && (
                      <a href={signedUrl} target="_blank" rel="noreferrer" className={cn(secondaryButton, "mt-3")}>
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
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
                        <Download aria-hidden="true" className="h-4 w-4" />
                        Download PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : effectiveViewerError || previewError ? (
                <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--danger-soft)_62%,transparent),transparent_22rem),var(--surface-inset)] p-5 text-center text-sm text-[color:var(--danger)] sm:min-h-72">
                  <div>
                    <CircleAlert aria-hidden="true" className="mx-auto mb-2 h-8 w-8" />
                    <p className="font-semibold">{effectiveViewerError ?? previewError}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={retryPreview} className={secondaryButton}>
                        <RefreshCw aria-hidden="true" className="h-4 w-4" />
                        Retry preview
                      </button>
                      {signedUrl && (
                        <a href={signedUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
                          <ExternalLink aria-hidden="true" className="h-4 w-4" />
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
                          <Download aria-hidden="true" className="h-4 w-4" />
                          Download PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : signedUrl && document?.file_type === "application/pdf" ? (
                <>
                  <div className="mb-2 flex items-center justify-end px-2 pt-2 sm:px-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHasExplicitPdfViewerMode(true);
                        setUseNativePdfViewer((current) => !current);
                      }}
                      aria-label={
                        useNativePdfViewer
                          ? "Switch to the standard viewer with fit and zoom controls"
                          : "Switch to sharper zoom using your browser's PDF viewer"
                      }
                      title={
                        useNativePdfViewer
                          ? "Standard viewer with built-in fit and zoom controls."
                          : "Sharper zoom — uses your browser's PDF engine to keep heavy-zoom pages crisp."
                      }
                      className={cn(secondaryButton, "min-h-11 w-full justify-center px-3 text-xs sm:w-auto")}
                    >
                      {useNativePdfViewer ? "Standard view" : "Sharper zoom"}
                    </button>
                  </div>
                  {useNativePdfViewer ? (
                    <NativePdfEmbed url={signedUrl} title={documentDisplayTitle(document)} initialPage={activePage} />
                  ) : (
                    <PdfCanvasViewer
                      key={`${documentId}-${useNativePdfViewer ? "native" : "canvas"}`}
                      url={signedUrl}
                      title={documentDisplayTitle(document)}
                      initialPage={activePage}
                      onUrlExpired={handleSignedUrlExpired}
                      onLoadSuccess={handlePdfLoadSuccess}
                      onPageChange={navigateToPage}
                    />
                  )}
                </>
              ) : (
                <NonPdfSourcePreview
                  fileType={document?.file_type}
                  title={document ? documentDisplayTitle(document) : "Source document"}
                  signedUrl={signedUrl}
                  downloadSignedUrl={downloadSignedUrl}
                />
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 md:items-start lg:block">
            <div className="lg:hidden">
              <PinnedSourceEvidence
                loading={effectiveLoadingDocument}
                chunk={selectedChunk}
                compact
                sectionId="source-evidence"
              />
            </div>
            <IndexedTextPanel
              loading={effectiveLoadingDocument}
              selectedPage={selectedPage}
              chunks={chunks}
              search={sourceSearch}
              documentSearchResults={documentSearchResults}
              searchingDocument={searchingDocument}
              documentSearchError={documentSearchError}
              idPrefix="source-chunk"
              sectionId="source-text"
              selectedChunkId={activeChunkId}
              onSearchChange={setSourceSearch}
            />
          </div>
        </div>

        <aside className="min-w-0 grid content-start gap-4 sm:gap-5 md:grid-cols-2 md:items-start lg:sticky lg:top-[69px] lg:grid-cols-1 lg:self-start lg:pr-1">
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
            <DocumentViewerAnchors evidenceHref="#source-evidence-rail" textHref="#source-text" className="mb-3" />
            <PinnedSourceEvidence
              loading={effectiveLoadingDocument}
              chunk={selectedChunk}
              compact
              sectionId="source-evidence-rail"
            />
          </div>

          {document ? (
            <details
              id="source-summary"
              name="document-viewer-section"
              data-testid="high-yield-summary"
              className={cn(panel, "group scroll-mt-24 source-print md:col-span-2 lg:col-span-1")}
            >
              <DocumentSectionSummary
                icon={Sparkles}
                title={
                  document.summary?.clinical_specifics?.profile ? "Clinical document profile" : "High-yield summary"
                }
                description="What this document covers, from its indexed evidence."
              />
              <div className={cn(clinicalDivider, "p-4 pt-3")}>
                <BadgeCluster items={summaryBadges} limit={8} showOverflowCount />
                {document.summary?.clinical_specifics?.profile ? (
                  <ClinicalSummaryProfile profile={document.summary.clinical_specifics.profile} />
                ) : (
                  <FormattedHighYieldSummary
                    formatted={formattedStoredSummary}
                    showLead={formattedStoredSummary.sections.length === 0}
                  />
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
              </div>
            </details>
          ) : null}

          <details
            id="source-images"
            name="document-viewer-section"
            className={cn(panel, "group scroll-mt-24 md:col-span-2 lg:col-span-1")}
          >
            <DocumentSectionSummary
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
            <div className={cn(clinicalDivider, "space-y-3 p-4 pt-3")}>
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
          </details>

          {indexHealth ? (
            <details
              name="document-viewer-section"
              data-testid="indexing-details"
              className={cn(panel, "group md:col-span-2 lg:col-span-1")}
            >
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className={eyebrowText}>Indexing details</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180"
                />
              </summary>
              <dl
                className={cn(
                  clinicalDivider,
                  "grid gap-2 p-4 text-xs font-semibold text-[color:var(--text-muted)] sm:grid-cols-2",
                )}
              >
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
            <Plus aria-hidden="true" className="h-5 w-5" />
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
            {loadingSummary ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </form>
      ) : null}
    </main>
  );
}
