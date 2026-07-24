// Presentational panels for the document viewer: clinical summary profile,
// high-yield summary, source images/tables, pinned evidence, and the indexed
// source-text search panel. Extracted from DocumentViewer.tsx (maturity X3) as a
// pure move — the DocumentViewer container composes these leaf components.
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  Quote,
  Search,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { AccessibleTable, hasRenderableAccessibleTable } from "@/components/AccessibleTable";
import { SignedImage } from "@/components/clinical-dashboard/signed-image";
import { SafeBoldText } from "@/components/SafeBoldText";
import {
  clinicalDivider,
  cn,
  codeText,
  eyebrowText,
  fieldControl,
  fieldLabel,
  floatingControl,
  LoadingPanel,
  panel,
  PanelHeading,
  primaryControl,
  proseMeasure,
  sourceCard,
  textMuted,
} from "@/components/ui-primitives";
import {
  cleanClinicalSummaryText,
  sourceTextForCompactDisplay,
  sourceTextForDocumentViewer,
  sourceTextForIndexedPage,
} from "@/lib/source-text-sanitizer";
import { smartEvidenceTags } from "@/lib/evidence-tags";
import { flowIndexedText, parseIndexedSourceText } from "@/lib/indexed-source-formatting";
import type { ClinicalDocumentSummaryProfile, DocumentSummaryProfileItem } from "@/lib/types";
import type { FormattedDocumentSummary as FormattedDocumentSummaryModel } from "@/lib/document-summary-formatting";
import type { ChunkRow, DocumentSearchResult, ImageRow, PageRow, TableFactRow } from "./types";

const primaryButton = primaryControl;
const secondaryButton = floatingControl;

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

function hasProfileItems(items: unknown): items is DocumentSummaryProfileItem[] {
  return Array.isArray(items) && items.some((item) => item && typeof item === "object" && "text" in item);
}

function profileItemText(item: DocumentSummaryProfileItem) {
  return cleanClinicalSummaryText(item.text);
}

export function ClinicalSummaryProfile({ profile }: { profile: ClinicalDocumentSummaryProfile }) {
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

export function FormattedHighYieldSummary({
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
          className={cn(floatingControl, "sm:min-h-9 px-3 text-xs")}
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function imageAspectRatio(image: ImageRow) {
  if (!image.width || !image.height || image.width <= 0 || image.height <= 0) return null;
  return image.width / image.height;
}

function tableQualityWarnings(image: ImageRow, hasStructuredTable: boolean) {
  const warnings: string[] = [];
  if (image.rowsTruncated) {
    warnings.push(
      image.rowCount
        ? `Extracted table is partial (${image.rowCount} source rows; preview is capped).`
        : "Extracted table is partial.",
    );
  }
  if (typeof image.cropCompleteness === "number" && image.cropCompleteness < 0.82) {
    warnings.push(`Source crop may be incomplete (${formatPercent(image.cropCompleteness)} completeness).`);
  }
  if (typeof image.structuredExtractionConfidence === "number" && image.structuredExtractionConfidence < 0.58) {
    warnings.push(`Structured extraction confidence is low (${formatPercent(image.structuredExtractionConfidence)}).`);
  }
  if (typeof image.ocrTextDensity === "number" && image.ocrTextDensity < 0.18) {
    warnings.push("OCR/text density is low; verify wording against the source image.");
  }
  if (!hasStructuredTable && image.source_kind === "table_crop") {
    warnings.push("No reliable generated table was available; use the source image.");
  }
  return warnings;
}

export function DocumentImage({ image }: { image: ImageRow }) {
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
  const warnings = tableQualityWarnings(image, hasStructuredTable);
  const sourceImageFirst =
    !hasStructuredTable ||
    image.rowsTruncated === true ||
    (typeof image.cropCompleteness === "number" && image.cropCompleteness < 0.82) ||
    (typeof image.structuredExtractionConfidence === "number" && image.structuredExtractionConfidence < 0.58);
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
        className="max-h-[70dvh] min-h-40 w-full"
        aspectRatio={imageAspectRatio(image)}
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
        lowConfidenceFallback={imageBlock}
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
      {warnings.length ? (
        <div className="mt-2 rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-2 text-xs leading-5 text-[color:var(--warning)]">
          <p className="font-semibold">Verify table formatting against the source.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasStructuredTable && !sourceImageFirst ? (
        <>
          {figcaptionBlock}
          <details className="group mt-3">
            <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text)] sm:min-h-9">
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

export function TableReviewPanel({
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
                      "inline-flex min-h-tap items-center rounded-md border px-2 text-2xs font-semibold transition sm:min-h-8",
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

export function DocumentViewerAnchors({
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

export function DocumentSectionSummary({
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

export function PinnedSourceEvidence({
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
            <a href="#pdf-preview-section" className={cn(primaryButton, "sm:min-h-9 px-3 text-xs")}>
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Open source
            </a>
            {compact && isLong ? (
              <button
                type="button"
                onClick={() => setExpandedChunkId((current) => (current === chunk.id ? null : chunk.id))}
                className={cn(secondaryButton, "sm:min-h-9 px-3 text-xs")}
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
export const IndexedTextPanel = memo(function IndexedTextPanel({
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
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => moveHit(-1)}
                className={cn(secondaryButton, "size-tap justify-center p-0")}
                aria-label="Previous document search hit"
                title="Previous document search hit"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveHit(1)}
                className={cn(secondaryButton, "size-tap justify-center p-0")}
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
