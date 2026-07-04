"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  Globe2,
  HelpCircle,
  Heart,
  Keyboard,
  Layers,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  LockKeyhole,
  Palette,
  PanelTop,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Tag,
  UploadCloud,
  UserRound,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibleTable } from "@/components/AccessibleTable";
import {
  DocumentOrganizationBadges,
  documentDisplayTitle,
  documentOrganizationProfile,
} from "@/components/DocumentOrganizationBadges";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { DocumentManagementActions, type DocumentDeleteResult } from "@/components/DocumentManagementActions";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { formatCompactCitationLabel } from "@/lib/citations";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { isLocalNoAuthMode } from "@/lib/env";
import {
  appBackdrop,
  answerSurface,
  chatMicroAction,
  clinicalDivider,
  cn,
  EmptyState,
  fieldControlPlain,
  fieldControlWithIcon,
  fieldIcon,
  floatingControl,
  iconTilePremium,
  metadataPill,
  panelSubtle,
  primaryControl,
  SourceProvenance,
  SourceStatusBadge,
  sourceCard,
  subtleStatusPill,
  tableCard,
  tableCardHeader,
  tableMicroActionRow,
  textMuted,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";
import { SafeBoldText } from "@/components/SafeBoldText";
import { Sheet } from "@/components/ui/sheet";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { AnswerEmptyState, AnswerSkeleton } from "@/components/clinical-dashboard/answer-status";
import { AuthPanel } from "@/components/clinical-dashboard/auth-panel";
import { useSidebarCollapsed } from "@/components/clinical-dashboard/use-sidebar-collapsed";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import { StatusBadge } from "@/components/clinical-dashboard/badges";
import {
  type SidebarIdentity,
  deriveSidebarIdentity,
  ClinicalDesktopSidebar,
  ClinicalMobileSidebar,
} from "@/components/clinical-dashboard/ClinicalSidebar";
import {
  SetupChecklist,
  UploadPanel,
  IndexingMonitor,
  IngestionQualityConsole,
  LibraryHealthStrip,
  fallbackSetupChecks,
  hasReadyPublicSearchSetup,
  type SetupCheck,
  type IngestionQualityReviewItem,
} from "@/components/clinical-dashboard/DocumentManagerPanel";
import {
  GuideDialog,
  GuideTrigger,
  SectionHeading,
  UtilityDrawer,
} from "@/components/clinical-dashboard/dashboard-shell";
import {
  cleanDisplayTitle,
  sanitizeAnswerDisplayText,
  sanitizeDisplayText,
} from "@/components/clinical-dashboard/display-text";
import {
  NaturalLanguageAnswer,
  ScopeAndGovernanceNotice,
  SourceImage,
  UserQuestionBubble,
} from "@/components/clinical-dashboard/answer-content";
import {
  AnswerFeedbackPanel,
  AnswerSafetyNotice,
  AnswerSupportSummaryCard,
  answerHasCentralTable,
  answerSupportPriority,
  ClinicalNotesChecklistPanel,
  clinicalNotesCount,
  clinicalNotesDisplayCountForAnswer,
  compactEvidenceSummary,
  type EvidenceTabName,
  simpleClinicalTableProps,
  evidenceMapRowsFromRenderModel,
  evidenceTabCount,
  evidenceTabOrder,
  formatQuoteCardsForClipboard,
  primaryVisualTable,
  QuoteCards,
  SafetyFindingsPanel,
} from "@/components/clinical-dashboard/evidence-panels";
import { useMobilePreviewSheet } from "@/components/clinical-dashboard/use-mobile-preview-sheet";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { emptyStates, errorCopy } from "@/lib/ui-copy";
import { applicationsLauncherItemCount } from "@/components/applications-launcher-page";

const DifferentialsHome = dynamic(
  () => import("@/components/clinical-dashboard/differentials-home").then((m) => m.DifferentialsHome),
  { ssr: false },
);
const FavouritesHub = dynamic(
  () => import("@/components/clinical-dashboard/favourites-hub").then((m) => m.FavouritesHub),
  { ssr: false },
);
const MedicationPrescribingWorkspace = dynamic(
  () =>
    import("@/components/clinical-dashboard/medication-prescribing-workspace").then(
      (m) => m.MedicationPrescribingWorkspace,
    ),
  { ssr: false },
);
const ApplicationsLauncherWorkspace = dynamic(
  () => import("@/components/applications-launcher-page").then((m) => m.ApplicationsLauncherWorkspace),
  { ssr: false },
);
import { DocumentSearchResultsPanel, type SearchFacets } from "@/components/clinical-dashboard/document-search-results";
import { isWeakRelevance, QueryCoverageChips } from "@/components/clinical-dashboard/relevance";
import {
  answerPayloadIsUsable,
  isRetryableError,
  isRetryableMessage,
  isRetryableStatus,
  keywordQueryFromNaturalLanguage,
  makeSearchError,
  progressForRetry,
  searchRetryCount,
  searchRetryDelaysMs,
  sleep,
  type AnswerPayload,
  type SearchError,
} from "@/components/clinical-dashboard/search-utils";
import {
  appModeQueryMode,
  appModeHomeHref,
  appModeResultKind,
  appModeCanUseSourceLibraryShortcut,
  appModeSearchConfig,
  appModeSourceLibrarySearchMode,
  isAppModeId,
  isAppModeVisible,
  type AppModeId,
  type AppModeSearchKind,
} from "@/lib/app-modes";
import { rankFormRecords } from "@/lib/forms";
import { rankServiceRecords } from "@/lib/services";
import { useRegistryRecords } from "@/lib/use-registry-records";
import { buildAnswerRenderModel, type AnswerRenderModel } from "@/lib/answer-render-policy";
import { sourceTextForCompactDisplay } from "@/lib/source-text-sanitizer";
import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  type SourceGovernanceWarning,
} from "@/lib/source-governance";
import { smartEvidenceTags } from "@/lib/evidence-tags";
import {
  documentLabelReviewStatus,
  documentLabelTier,
  formatDocumentLabelDisplay,
  normalizeDocumentLabelForStorage,
  reviewDocumentTagQuality,
  tagSearchText,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
  type SmartDocumentTagTier,
  type SmartDocumentTagQualityIssueKind,
} from "@/lib/document-tags";
import type {
  ClinicalDocument,
  BestSourceRecommendation,
  DocumentMatch,
  EvidenceRelevance,
  ImportBatch,
  IngestionJob,
  QuoteCard,
  RagAnswer,
  AnswerSection,
  RelatedDocument,
  EvidenceSummary,
  SearchResult,
  SearchScopeSummary,
  VisualEvidenceCard,
  ClinicalQueryMode,
  DocumentLabel,
  DocumentLabelType,
} from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { type AnswerEvidenceMapRow, type AnswerViewMode, shouldPollForUpdates } from "@/lib/ward-output";

const navigationHashes = ["#search", "#quotes", "#images", "#sources"] as const;
const mobileSectionFabMediaQuery = "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";

export const recentQueryStorageKey = "clinical-kb-recent-queries";
const documentPageSize = 150;
const activeIndexingPollFallbackMs = 5_000;
const setupRecheckPollMs = 60_000;
const indexingWorkDetailsPollMs = 15_000;
const stagedDashboardExtraction = {
  answerSurface: true,
} as const;
type DocumentPagination = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
};
type RefreshOptions = {
  includeSetup?: boolean;
  includeDashboardData?: boolean;
  includeDocumentMeta?: boolean;
};
type PollHint = {
  active?: boolean;
  pollAfterMs?: number | null;
};
type SetupStatusPayload = {
  demoMode?: boolean;
  checks?: SetupCheck[];
  indexingActive?: boolean;
  pollAfterMs?: number | null;
};
type DocumentsPayload = {
  documents?: ClinicalDocument[];
  pagination?: DocumentPagination | null;
  demoMode?: boolean;
  setupRequired?: boolean;
  error?: string;
  indexing?: PollHint;
};
type JobsPayload = {
  jobs?: IngestionJob[];
  demoMode?: boolean;
  setupRequired?: boolean;
  error?: string;
  hasActiveJobs?: boolean;
  pollAfterMs?: number | null;
};
type BatchesPayload = {
  batches?: ImportBatch[];
  demoMode?: boolean;
  hasActiveBatches?: boolean;
  pollAfterMs?: number | null;
};
export type AnswerFeedbackType =
  | "verified"
  | "needs_correction"
  | "source_insufficient"
  | "wrong_source"
  | "missing_source"
  | "unsupported_answer"
  | "numeric_error"
  | "outdated_guidance";
type IngestionQualityPayload = {
  items?: IngestionQualityReviewItem[];
  demoMode?: boolean;
};

export const clinicalQueryModeOptions: Array<{ value: ClinicalQueryMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "monitoring_schedule", label: "Monitoring" },
  { value: "dose_threshold_lookup", label: "Dose / thresholds" },
  { value: "contraindications_cautions", label: "Cautions" },
  { value: "escalation_criteria", label: "Escalation" },
  { value: "required_documentation", label: "Documentation" },
  { value: "compare_guidance", label: "Compare" },
];

function compactScopeFilters(filters: SearchScopeFilters) {
  const next: SearchScopeFilters = {};
  if (filters.medications?.length) next.medications = filters.medications;
  if (filters.topics?.length) next.topics = filters.topics;
  if (filters.documentTypes?.length) next.documentTypes = filters.documentTypes;
  if (filters.sites?.length) next.sites = filters.sites;
  if (filters.services?.length) next.services = filters.services;
  if (filters.settings?.length) next.settings = filters.settings;
  if (filters.populations?.length) next.populations = filters.populations;
  if (filters.risks?.length) next.risks = filters.risks;
  if (filters.workflows?.length) next.workflows = filters.workflows;
  if (filters.clinicalActions?.length) next.clinicalActions = filters.clinicalActions;
  if (filters.carePhases?.length) next.carePhases = filters.carePhases;
  if (filters.documentIntents?.length) next.documentIntents = filters.documentIntents;
  if (filters.contentFeatures?.length) next.contentFeatures = filters.contentFeatures;
  if (filters.sourceStatuses?.length) next.sourceStatuses = filters.sourceStatuses;
  if (filters.validationStatuses?.length) next.validationStatuses = filters.validationStatuses;
  if (filters.extractionQualities?.length) next.extractionQualities = filters.extractionQualities;
  if (filters.locality) next.locality = filters.locality;
  if (filters.importBatchIds?.length) next.importBatchIds = filters.importBatchIds;
  if (filters.collections?.length) next.collections = filters.collections;
  if (filters.labelTypesAny?.length) next.labelTypesAny = filters.labelTypesAny;
  return next;
}

type SearchResultModePayload =
  | {
      kind: "documents";
      query: string;
      demoMode?: boolean;
      sources: SearchResult[];
      documentMatches: DocumentMatch[];
      relevance?: EvidenceRelevance;
      facets?: SearchFacets;
      scope?: SearchScopeSummary;
      sourceGovernanceWarnings?: SourceGovernanceWarning[];
    }
  | {
      kind: "answer";
      query: string;
      payload: AnswerPayload;
    };

type SourceLibrarySearchMode = Extract<AppModeSearchKind, "documents" | "differentials">;

function parseSseData(lines: string[]) {
  const data = lines.join("\n").trim();
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    throw makeSearchError("Answer stream returned malformed data.", 500, true);
  }
}

function answerStreamProgressMessage(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

async function readAnswerStream(response: Response, onProgress: (message: string) => void): Promise<AnswerPayload> {
  if (!response.body) throw makeSearchError("Answer stream could not be opened.", undefined, true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: AnswerPayload | null = null;

  function processEvent(block: string) {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
    }

    if (dataLines.length === 0) return;
    const data = parseSseData(dataLines);
    if (data === null) return;
    if (event === "progress") {
      const message = answerStreamProgressMessage(data);
      if (message) onProgress(message);
      return;
    }
    if (event === "error") {
      const message = data && typeof data === "object" ? (data as { error?: unknown }).error : null;
      const details =
        data && typeof data === "object" ? (data as { details?: { message?: unknown } | unknown }).details : null;
      const detailMessage =
        details && typeof details === "object" && "message" in details && typeof details.message === "string"
          ? details.message
          : null;
      const status = data && typeof data === "object" ? (data as { status?: unknown }).status : null;
      const statusCode = typeof status === "number" ? status : undefined;
      const errorMessage =
        typeof message === "string" && message.trim()
          ? message
          : typeof detailMessage === "string" && detailMessage.trim()
            ? detailMessage
            : "Answer generation failed due to a streaming error.";
      throw makeSearchError(
        errorMessage,
        statusCode,
        isRetryableStatus(statusCode ?? 0) || isRetryableMessage(errorMessage),
      );
    }
    if (event === "final") {
      finalPayload = data as AnswerPayload;
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      if (block) processEvent(block);
      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) break;
  }

  if (buffer.trim()) processEvent(buffer.trim());
  if (!finalPayload) throw makeSearchError("Answer stream ended before a final answer was received.", undefined, true);
  return finalPayload as AnswerPayload;
}

function normalizeNavigationHash(hash: string) {
  return navigationHashes.includes(hash as (typeof navigationHashes)[number]) ? hash : "#search";
}

function compactClinicalTableCaption(item: VisualEvidenceCard) {
  const raw = item.tableTitle || item.tableLabel || item.caption || "Clinical table";
  const cleaned = sourceTextForCompactDisplay(raw)
    .replace(/\btable\s+\d+\s*[:.-]?\s*/i, "")
    .replace(/\b(?:page|p\.)\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const caption = cleaned || "Clinical table";
  return caption.length <= 72 ? caption : `${caption.slice(0, 69).trim()}...`;
}

function visualEvidenceHeader(item: VisualEvidenceCard) {
  const titleSource = [item.tableLabel, item.tableTitle].filter(Boolean).join(" · ");
  const titleText = sourceTextForCompactDisplay(titleSource).trim();
  const captionText = sourceTextForCompactDisplay(item.caption ?? "").trim();
  const normalizedTitle = titleText.toLowerCase();
  const normalizedCaption = captionText.toLowerCase();
  const isDuplicateCaption =
    Boolean(normalizedCaption) &&
    (normalizedCaption.startsWith(normalizedTitle) || normalizedCaption === normalizedTitle);
  return {
    title: titleText || captionText || "Visual evidence",
    caption: isDuplicateCaption ? null : captionText,
  };
}

function VisualEvidenceStrip({
  evidence,
  collapsed = false,
  embedded = false,
}: {
  evidence: VisualEvidenceCard[];
  collapsed?: boolean;
  embedded?: boolean;
}) {
  function looksLikeTableText(value?: string | null) {
    return Boolean(value?.includes("|") && value.split("|").filter((cell) => cell.trim()).length >= 3);
  }

  if (collapsed) {
    return (
      <section id="images" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
        <UtilityDrawer
          icon={FileImage}
          title="Nearby visual evidence"
          summary="Nearby source support only."
          mobileSummary={`${evidence.length} visuals`}
        >
          <VisualEvidenceStrip evidence={evidence} embedded />
        </UtilityDrawer>
      </section>
    );
  }

  const content = (
    <>
      <SectionHeading
        icon={FileImage}
        title="Tables and diagrams"
        description="Clinical tables, diagrams, and images from indexed documents."
        hideDescriptionOnMobile
        compactMobile
      />
      {evidence.length === 0 ? (
        <EmptyState icon={FileImage} title={emptyStates.indexedVisuals.title} body={emptyStates.indexedVisuals.body} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {evidence.map((item) => {
            const tableMarkdown = item.accessibleTableMarkdown?.trim()
              ? item.accessibleTableMarkdown
              : looksLikeTableText(item.tableTextSnippet)
                ? item.tableTextSnippet
                : null;
            const hasStructuredTable = Boolean(tableMarkdown || item.tableRows?.length || item.tableColumns?.length);
            const tableCaption = compactClinicalTableCaption(item);
            const sourceHeader = visualEvidenceHeader(item);
            const displayLabels = smartEvidenceTags(
              item.labels,
              [[item.tableLabel, item.tableTitle].filter(Boolean).join(": "), item.caption, item.tableTextSnippet]
                .filter(Boolean)
                .join(" "),
            );
            return (
              <figure key={item.id} className={cn(sourceCard, "overflow-hidden p-2.5 sm:p-3")}>
                <div className="rounded-lg bg-[color:var(--surface-inset)] p-2.5 sm:p-3">
                  <SourceImage
                    endpoint={item.signed_url_endpoint}
                    caption={sourceHeader.caption || sourceHeader.title}
                  />
                </div>
                <figcaption className="mt-2 space-y-1.5 text-[15px] leading-6 text-[color:var(--text)] sm:mt-3">
                  {!hasStructuredTable ? <p className="font-semibold">{sourceHeader.title}</p> : null}
                  {!hasStructuredTable && sourceHeader.caption ? <p>{sourceHeader.caption}</p> : null}
                  <AccessibleTable
                    caption={tableCaption}
                    markdown={tableMarkdown}
                    rows={item.tableRows}
                    columns={item.tableColumns}
                    {...simpleClinicalTableProps}
                    clinicalOnly
                    dialogTitle={tableCaption || "Clinical table"}
                  />
                  {!hasStructuredTable && item.tableTextSnippet ? (
                    <p className={cn("line-clamp-3 text-sm leading-6", textMuted)}>
                      {sourceTextForCompactDisplay(item.tableTextSnippet)}
                    </p>
                  ) : null}
                  {displayLabels.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {displayLabels.map((label) => (
                        <span key={`${item.id}:${label}`} className={cn(metadataPill, "min-h-6 px-2 text-[10px]")}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </figcaption>
                <div
                  className={cn(
                    "mt-2 flex flex-wrap items-center justify-between gap-2 pt-3 text-xs sm:mt-3 sm:gap-3",
                    clinicalDivider,
                  )}
                >
                  <span className={cn("text-[15px] font-semibold leading-6 sm:hidden", textMuted)}>
                    {formatCompactCitationLabel(item)}
                  </span>
                  <span className={cn("hidden text-xs font-semibold leading-5 sm:inline", textMuted)}>
                    {cleanDisplayTitle(item.title)}, page {item.page_number ?? "n/a"}
                  </span>
                  {item.image_type && (
                    <span className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
                      {item.image_type.replaceAll("_", " ")}
                    </span>
                  )}
                  {!hasStructuredTable ? <QueryCoverageChips relevance={item.relevance} limit={2} /> : null}
                  <Link href={item.viewer_href} className={cn(floatingControl, "min-h-[44px] px-4 text-xs")}>
                    <ExternalLink className="h-4 w-4" />
                    Open source
                  </Link>
                </div>
              </figure>
            );
          })}
        </div>
      )}
    </>
  );

  if (embedded) return <div className="space-y-3">{content}</div>;

  return (
    <section id="images" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
      {content}
    </section>
  );
}

function InlineTableCard({ item }: { item: VisualEvidenceCard }) {
  const tableMarkdown = item.accessibleTableMarkdown?.trim() ? item.accessibleTableMarkdown : null;
  const title = compactClinicalTableCaption(item);

  return (
    <section className={cn(tableCard, "max-w-lg")} aria-label="Inline table preview">
      <div
        className={cn(
          tableCardHeader,
          "flex min-h-10 items-center justify-between gap-2 bg-[color:var(--surface)] py-2",
        )}
      >
        <span className="hidden min-w-0 truncate sm:inline">{title}</span>
        <span className="min-w-0 truncate sm:hidden">{title}</span>
        <div className="flex shrink-0 items-center gap-1 sm:hidden" aria-label="Table actions">
          <Link
            href={item.viewer_href}
            className={cn(chatMicroAction, "min-h-11 min-w-11 justify-center px-0")}
            aria-label="Open table source"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="p-1.5 sm:p-2">
        <AccessibleTable
          caption={title}
          markdown={tableMarkdown}
          rows={item.tableRows}
          columns={item.tableColumns}
          compact
          expandOnMobile
          previewRows={3}
          hidePreviewCaption
          hidePreviewRowCount
          densePreview
          clinicalOnly
          dialogTitle={item.tableTitle || item.caption || title}
        />
      </div>
      <div className={cn(tableMicroActionRow, "hidden sm:flex")}>
        <Link href={item.viewer_href} className={chatMicroAction}>
          Expand
        </Link>
        <Link href={item.viewer_href} className={chatMicroAction}>
          Source
        </Link>
      </div>
    </section>
  );
}

const evidenceTabIconMap: Record<EvidenceTabName, typeof Layers> = {
  Claims: CheckCircle2,
  Quotes: Quote,
  Tables: ListChecks,
  Images: FileImage,
  Gaps: AlertCircle,
};

function supportDotClass(supportLevel: string) {
  const normalized = supportLevel.toLowerCase();
  if (normalized.includes("unsupported") || normalized.includes("none")) return "bg-[color:var(--danger)]";
  if (normalized.includes("partial") || normalized.includes("limited") || normalized.includes("nearby")) {
    return "bg-[color:var(--warning)]";
  }
  return "bg-[color:var(--clinical-accent)]";
}

function supportLabel(supportLevel: string) {
  const normalized = supportLevel.toLowerCase();
  if (normalized.includes("unsupported") || normalized.includes("none")) return "Unsupported";
  if (normalized.includes("partial") || normalized.includes("limited") || normalized.includes("nearby"))
    return "Partial";
  return "Direct";
}

function claimRowsForEvidencePanel(rows: AnswerEvidenceMapRow[], renderModel: AnswerRenderModel) {
  if (rows.length) return rows.slice(0, 6);
  return renderModel.primarySources.slice(0, 6).map((source, index) => ({
    id: source.id,
    section: source.label || cleanDisplayTitle(source.title || source.file_name) || `Source ${index + 1}`,
    detail: source.snippet || source.reason || "Open source passage to review the cited evidence.",
    supportLevel: source.sourceStrength === "none" ? "partial" : source.sourceStrength,
    citationCount: 1,
    sourceStatus:
      source.sourceStrength === "none" ? "Source requires review" : `${source.sourceStrength} source support`,
    bestSourceLabel: source.label,
    bestLinkedPassage: source.snippet || source.reason,
    href: source.href,
  }));
}

function EvidenceClaimsList({ rows, renderModel }: { rows: AnswerEvidenceMapRow[]; renderModel: AnswerRenderModel }) {
  const claimRows = claimRowsForEvidencePanel(rows, renderModel);
  const directCount = claimRows.filter((row) => supportLabel(row.supportLevel) === "Direct").length;
  const partialCount = claimRows.filter((row) => supportLabel(row.supportLevel) === "Partial").length;

  if (!claimRows.length) {
    return <EmptyState icon={BookOpen} title={emptyStates.evidenceMap.title} body={emptyStates.evidenceMap.body} />;
  }

  return (
    <div data-testid="evidence-claims-panel" className="space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Claims checked</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[color:var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--clinical-accent)]" />
              Direct
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--warning)]" />
              Partial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)]" />
              Unsupported
            </span>
          </div>
        </div>
        <p className="shrink-0 text-xs font-semibold text-[color:var(--text-muted)]">
          {directCount} direct <span className="mx-1">·</span> {partialCount} partial
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        {claimRows.map((row, index) => (
          <Link
            key={`${row.id}:${index}`}
            href={row.href ?? "#"}
            data-testid={row.href ? "evidence-map-open-source" : undefined}
            aria-disabled={!row.href}
            className={cn(
              "grid min-h-[76px] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 py-3 text-left last:border-b-0 transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
              !row.href && "pointer-events-none",
            )}
            aria-label={`Open source for ${row.section}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)]" />
            <span className={cn("h-2.5 w-2.5 rounded-full", supportDotClass(row.supportLevel))} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{row.section}</span>
              <span className={cn("mt-1 line-clamp-2 block text-xs leading-5", textMuted)}>
                {row.detail || row.bestLinkedPassage || row.bestSourceLabel}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 -rotate-90 text-[color:var(--text-muted)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function EvidenceGapsPanel({ warnings }: { warnings: string[] }) {
  if (!warnings.length) {
    return (
      <EmptyState icon={CheckCircle2} title="No evidence gaps" body="No source gaps were attached to this answer." />
    );
  }

  return (
    <div className="grid gap-2">
      {warnings.map((warning, index) => (
        <article
          key={`${warning}:${index}`}
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/45 p-3"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[color:var(--warning)]">Gap {index + 1}</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">{warning}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function MobileEvidenceSheetContent({
  answer,
  sources,
  renderModel,
  visualEvidence,
  answerEvidenceMapRows,
  sourceGovernanceWarnings,
  demoMode,
  initialTab,
  pendingFeedback,
  copiedQuotes,
  onCopyQuotes,
  onSubmitFeedback,
  onFollowUpQuote,
  onScopeDocument,
}: {
  answer: RagAnswer;
  sources: SearchResult[];
  renderModel: AnswerRenderModel;
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  sourceGovernanceWarnings: SourceGovernanceWarning[];
  demoMode: boolean;
  initialTab?: EvidenceTabName | null;
  pendingFeedback: AnswerFeedbackType | null;
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  const order = evidenceTabOrder(answer, renderModel);
  const [selectedTab, setSelectedTab] = useState<EvidenceTabName | null>(() => initialTab ?? null);
  const activeTab = selectedTab && order.includes(selectedTab) ? selectedTab : order[0];
  const panelIdFor = (tab: EvidenceTabName) => `mobile-evidence-panel-${tab.toLowerCase()}`;
  const [added, setAdded] = useState(false);
  const primarySourceHref = renderModel.primarySources[0]?.href;
  async function copyEvidence() {
    if (renderModel.quoteCards.length) {
      onCopyQuotes();
      return;
    }
    try {
      await navigator.clipboard.writeText(renderModel.copyText);
    } catch {
      // Clipboard writes can fail in locked-down browsers; keep the panel usable.
    }
  }

  return (
    <div data-testid="mobile-evidence-sheet" className="min-w-0 space-y-4 overflow-hidden">
      <div className="-mx-1 overflow-x-auto pb-1 polished-scroll" role="presentation">
        <div
          data-testid="mobile-evidence-tabs"
          role="tablist"
          aria-label="Evidence sections"
          className="flex min-w-max gap-1 px-1"
        >
          {order.map((tab) => {
            const selected = tab === activeTab;
            const Icon = evidenceTabIconMap[tab];
            const count = evidenceTabCount({
              tab,
              sources,
              visualEvidence,
              answerEvidenceMapRows,
              renderModel,
            });
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelIdFor(tab)}
                id={`mobile-evidence-tab-${tab.toLowerCase()}`}
                data-testid={`mobile-evidence-tab-${tab.toLowerCase()}`}
                onClick={() => setSelectedTab(tab)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition",
                  selected
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab}
                {count ? <span className="nums text-[11px] opacity-80">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[220px]">
        {order.map((tab) => {
          const selected = tab === activeTab;
          return (
            <div
              key={tab}
              id={panelIdFor(tab)}
              role="tabpanel"
              aria-labelledby={`mobile-evidence-tab-${tab.toLowerCase()}`}
              data-testid={`mobile-evidence-panel-${tab.toLowerCase()}`}
              hidden={!selected}
              className="min-h-[220px]"
            >
              {selected ? (
                <MobileEvidenceTabPanel
                  tab={tab}
                  renderModel={renderModel}
                  visualEvidence={visualEvidence}
                  answerEvidenceMapRows={answerEvidenceMapRows}
                  copiedQuotes={copiedQuotes}
                  onCopyQuotes={onCopyQuotes}
                  onFollowUpQuote={onFollowUpQuote}
                  onScopeDocument={onScopeDocument}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <ScopeAndGovernanceNotice scope={null} warnings={sourceGovernanceWarnings} />
      <AnswerSafetyNotice
        demoMode={demoMode}
        weakEvidence={renderModel.trust !== "high"}
        retrievalDiagnostics={answer.retrievalDiagnostics}
      />
      <AnswerFeedbackPanel pending={pendingFeedback} onSubmit={onSubmitFeedback} />
      <div className="sticky bottom-0 -mx-3 mt-auto border-t border-[color:var(--border)] bg-[color:var(--surface-raised)]/98 px-2.5 py-1.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-2">
        <div className="grid grid-cols-3 divide-x divide-[color:var(--border)] bg-[color:var(--surface)]">
          {primarySourceHref ? (
            <Link
              href={primarySourceHref}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-[color:var(--clinical-accent)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Source
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-[color:var(--text-soft)]">
              <ExternalLink className="h-3.5 w-3.5" />
              Source
            </span>
          )}
          <button
            type="button"
            onClick={() => void copyEvidence()}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-[color:var(--text)]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copiedQuotes ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => setAdded(true)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-[color:var(--clinical-accent)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {added ? "Added" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileEvidenceTabPanel({
  tab,
  renderModel,
  visualEvidence,
  answerEvidenceMapRows,
  copiedQuotes,
  onCopyQuotes,
  onFollowUpQuote,
  onScopeDocument,
}: {
  tab: EvidenceTabName;
  renderModel: AnswerRenderModel;
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  if (tab === "Claims") {
    return <EvidenceClaimsList rows={answerEvidenceMapRows} renderModel={renderModel} />;
  }

  if (tab === "Tables") {
    const tableEvidence = visualEvidence.filter((item) => item.accessibleTableMarkdown || item.tableRows?.length);
    return tableEvidence.length ? (
      <div className="grid gap-2">
        {tableEvidence.slice(0, 4).map((item, index) => (
          <article key={item.id} className={cn(sourceCard, "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3")}>
            <span className={iconTilePremium}>
              <ListChecks className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text-heading)]">
                {compactClinicalTableCaption(item)}
              </p>
              <p className={cn("mt-1 text-xs", textMuted)}>
                Table {index + 1} · p.{item.page_number ?? "n/a"}
              </p>
            </div>
            <Link href={item.viewer_href} className={chatMicroAction} aria-label={`Open table source ${index + 1}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </div>
    ) : (
      <EmptyState icon={ListChecks} title={emptyStates.tablesUsed.title} body={emptyStates.tablesUsed.body} />
    );
  }

  if (tab === "Images") {
    return visualEvidence.length ? (
      <VisualEvidenceStrip evidence={visualEvidence} embedded />
    ) : (
      <EmptyState icon={FileImage} title={emptyStates.imagesUsed.title} body={emptyStates.imagesUsed.body} />
    );
  }

  if (tab === "Quotes") {
    return (
      <QuoteCards
        quotes={renderModel.quoteCards}
        copiedQuotes={copiedQuotes}
        onCopyQuotes={onCopyQuotes}
        onFollowUp={onFollowUpQuote}
        onScopeDocument={onScopeDocument}
      />
    );
  }

  return <EvidenceGapsPanel warnings={renderModel.warnings} />;
}

function RelatedDocumentsPanel({
  documents,
  onScopeDocument,
  onTagSearch,
}: {
  documents: RelatedDocument[];
  onScopeDocument: (documentId: string) => void;
  onTagSearch: (tag: SmartDocumentTag) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <UtilityDrawer
      icon={BookOpen}
      title="Related documents"
      summary={`${documents.length} broader document match${documents.length === 1 ? "" : "es"}`}
      mobileSummary={`${documents.length} related`}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {documents.map((document) => (
          <article key={document.document_id} className={cn(sourceCard, "p-3 sm:p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/documents/${document.document_id}?page=${document.best_pages[0] ?? 1}&chunk=${document.best_chunk_ids[0] ?? ""}`}
                  className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                >
                  <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                </Link>
                <DocumentOrganizationBadges document={document} compact className="mt-1" />
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  {document.match_reason} · pages {document.best_pages.join(", ") || "n/a"} · {document.image_count}{" "}
                  images{document.table_count ? ` · ${document.table_count} tables` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onScopeDocument(document.document_id)}
                className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
              >
                Scope
              </button>
            </div>
            {document.summary && (
              <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>
                <SafeBoldText text={document.summary} />
              </p>
            )}
            <DocumentTagCloud labels={document.labels} limit={6} className="mt-3" onTagClick={onTagSearch} />
          </article>
        ))}
      </div>
    </UtilityDrawer>
  );
}

function StagedAnswerResultSurface({
  answer,
  query,
  safeAnswerText,
  bestSource,
  sourceGovernanceWarnings,
  sourceSummary,
  renderModel,
  weakEvidence,
  answerViewMode,
  answerEvidenceMapRows,
  onScopeDocument,
  answerGrounded,
  sources,
  demoMode,
  safeAnswerSections,
  safetyFindings,
  copiedAnswer,
  pendingFeedback,
  onCopyAnswer,
  onSubmitFeedback,
}: {
  answer: RagAnswer;
  query: string;
  safeAnswerText: string;
  bestSource: BestSourceRecommendation | null;
  sourceGovernanceWarnings: SourceGovernanceWarning[];
  sourceSummary?: EvidenceSummary;
  renderModel: AnswerRenderModel;
  weakEvidence: boolean;
  answerViewMode: AnswerViewMode;
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  onScopeDocument: (documentId: string) => void;
  answerGrounded: boolean;
  sources: SearchResult[];
  demoMode: boolean;
  safeAnswerSections: Array<AnswerSection & { citationSources: SearchResult[] }>;
  safetyFindings: ReturnType<typeof extractSafetyFindings>;
  copiedAnswer: boolean;
  pendingFeedback: AnswerFeedbackType | null;
  onCopyAnswer: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
}) {
  const noteCount = clinicalNotesCount(answer);
  const showClinicalNotes = safetyFindings.length > 0 || noteCount > 0;
  const clinicalNoteDisplayCount = clinicalNotesDisplayCountForAnswer(
    answer,
    answerViewMode,
    noteCount || safetyFindings.length,
  );
  const sourceCount =
    renderModel.primarySources.length ||
    sourceSummary?.total_sources ||
    sources.length ||
    answer.sources?.length ||
    answer.citations.length;
  const centralTable = answerHasCentralTable(answer) ? primaryVisualTable(answer) : null;
  const showEvidenceDrawer = renderModel.allowedBlocks.some((block) =>
    ["sourceStatus", "reviewSources", "evidenceMap", "quoteCards", "visualEvidence", "warnings"].includes(block),
  );
  const [clinicalNotesOpen, setClinicalNotesOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceInitialTab, setEvidenceInitialTab] = useState<EvidenceTabName | null>(null);
  const [activeReviewPanel, setActiveReviewPanel] = useState<"clinical" | "evidence" | null>(null);
  const [copiedQuotes, setCopiedQuotes] = useState(false);
  const clinicalNotesTriggerRef = useRef<HTMLButtonElement>(null);
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const useReviewSheet = useMobilePreviewSheet();
  const copyQuotesTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copyQuotesTimerRef.current !== null) window.clearTimeout(copyQuotesTimerRef.current);
    };
  }, []);
  function openClinicalNotes() {
    setEvidenceOpen(false);
    setEvidenceInitialTab(null);
    if (useReviewSheet) {
      setActiveReviewPanel(null);
      setClinicalNotesOpen(true);
      return;
    }
    setClinicalNotesOpen(false);
    setActiveReviewPanel("clinical");
  }
  function restoreFocusToTrigger(ref: RefObject<HTMLElement | null>) {
    window.requestAnimationFrame(() => {
      if (ref.current?.isConnected) ref.current.focus({ preventScroll: true });
    });
  }
  function closeClinicalNotesReview() {
    setClinicalNotesOpen(false);
    restoreFocusToTrigger(clinicalNotesTriggerRef);
  }
  function openEvidence(initialTab: EvidenceTabName | null = null) {
    setClinicalNotesOpen(false);
    setEvidenceInitialTab(initialTab);
    if (useReviewSheet) {
      setActiveReviewPanel(null);
      setEvidenceOpen(true);
      return;
    }
    setEvidenceOpen(false);
    setActiveReviewPanel("evidence");
  }
  function closeEvidenceReview() {
    setEvidenceOpen(false);
    setEvidenceInitialTab(null);
    restoreFocusToTrigger(evidenceTriggerRef);
  }
  function closeDesktopReviewPanel() {
    const triggerRef = activeReviewPanel === "clinical" ? clinicalNotesTriggerRef : evidenceTriggerRef;
    setActiveReviewPanel(null);
    restoreFocusToTrigger(triggerRef);
  }
  function openTableEvidence() {
    setClinicalNotesOpen(false);
    openEvidence("Tables");
  }
  const copyQuotes = useCallback(async () => {
    const quoteText = formatQuoteCardsForClipboard(renderModel.quoteCards);
    if (!quoteText) return;
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopiedQuotes(true);
      if (copyQuotesTimerRef.current !== null) window.clearTimeout(copyQuotesTimerRef.current);
      copyQuotesTimerRef.current = window.setTimeout(() => setCopiedQuotes(false), 1600);
    } catch {
      setCopiedQuotes(false);
    }
  }, [renderModel.quoteCards]);
  const priority = answerSupportPriority(answer, safeAnswerSections, centralTable, safetyFindings, {
    grounded: answerGrounded,
    weakEvidence,
  });
  const inlineEvidenceSummary = compactEvidenceSummary(answer, sources, sourceSummary, renderModel);
  const evidenceTrustLabel = inlineEvidenceSummary.split(" · ")[0] || "Review support";
  const showInlineSupportCard = Boolean(priority || showClinicalNotes || showEvidenceDrawer);
  const showLayoutAside = Boolean(activeReviewPanel || centralTable);

  return (
    <div className="min-w-0 space-y-4 motion-safe:animate-fade-up sm:space-y-5" data-dashboard-stage="answer-surface">
      <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
        <UserQuestionBubble query={query} />

        <div
          data-testid="table-specific-answer-layout"
          data-desktop-table-aside={centralTable ? "true" : "false"}
          className={cn(
            "space-y-3",
            showLayoutAside &&
              "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(21rem,0.72fr)] lg:items-start lg:gap-5 lg:space-y-0",
          )}
        >
          <div className="min-w-0 space-y-3">
            <NaturalLanguageAnswer
              text={safeAnswerText || answer.answer}
              sourceCount={sourceCount}
              weakEvidence={weakEvidence}
              grounded={answerGrounded}
              sourceOnly={answer.answerQualityTier === "source_only"}
              bestSource={bestSource}
              sources={sources}
              sourceLinks={renderModel.primarySources}
              copied={copiedAnswer}
              onCopy={onCopyAnswer}
            />

            {showInlineSupportCard ? (
              <AnswerSupportSummaryCard
                priority={priority}
                clinicalCount={clinicalNoteDisplayCount}
                evidenceSummary={inlineEvidenceSummary}
                clinicalAvailable={showClinicalNotes}
                evidenceAvailable={showEvidenceDrawer}
                clinicalTriggerRef={clinicalNotesTriggerRef}
                evidenceTriggerRef={evidenceTriggerRef}
                onOpenClinicalNotes={openClinicalNotes}
                onOpenEvidence={() => openEvidence(null)}
              />
            ) : null}

            {centralTable && activeReviewPanel ? <InlineTableCard item={centralTable} /> : null}
          </div>

          {activeReviewPanel ? (
            <aside
              data-testid="desktop-answer-review-panel"
              className="hidden min-h-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)] lg:flex lg:max-h-[calc(100dvh-8rem)] lg:flex-col lg:sticky lg:top-4"
              aria-label={activeReviewPanel === "clinical" ? "Clinical notes" : "Evidence"}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg")}>
                    {activeReviewPanel === "clinical" ? (
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-[color:var(--text-heading)]">
                        {activeReviewPanel === "clinical" ? "Clinical notes" : "Evidence"}
                      </h3>
                      <span className={cn(subtleStatusPill, "nums min-h-6 px-2 text-[11px]")}>
                        {activeReviewPanel === "clinical" ? clinicalNoteDisplayCount : "Supported"}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-sm leading-5", textMuted)}>
                      {activeReviewPanel === "clinical"
                        ? "Source-backed points from this answer."
                        : "Review by evidence type."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDesktopReviewPanel}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label={`Close ${activeReviewPanel === "clinical" ? "clinical notes" : "evidence"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 polished-scroll">
                {activeReviewPanel === "clinical" ? (
                  <ClinicalNotesChecklistPanel
                    answer={answer}
                    viewMode={answerViewMode}
                    evidenceMapRows={answerEvidenceMapRows}
                    bestSource={bestSource}
                    copied={copiedAnswer}
                    onCopy={onCopyAnswer}
                    onOpenTables={openTableEvidence}
                  />
                ) : (
                  <MobileEvidenceSheetContent
                    answer={answer}
                    sources={sources}
                    renderModel={renderModel}
                    visualEvidence={renderModel.visualEvidence}
                    answerEvidenceMapRows={answerEvidenceMapRows}
                    sourceGovernanceWarnings={sourceGovernanceWarnings}
                    demoMode={demoMode}
                    initialTab={evidenceInitialTab}
                    pendingFeedback={pendingFeedback}
                    copiedQuotes={copiedQuotes}
                    onCopyQuotes={copyQuotes}
                    onSubmitFeedback={onSubmitFeedback}
                    onScopeDocument={onScopeDocument}
                  />
                )}
              </div>
            </aside>
          ) : centralTable ? (
            <div className="min-w-0 lg:sticky lg:top-24">
              <InlineTableCard item={centralTable} />
            </div>
          ) : null}
        </div>

        {showClinicalNotes ? (
          <Sheet
            open={clinicalNotesOpen}
            onClose={closeClinicalNotesReview}
            title="Clinical notes"
            description="Source-backed points from this answer."
            closeLabel="Close clinical notes"
            headerLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--primary)]")}>
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
            }
            titleAccessory={
              <span className="nums grid h-5 min-w-5 place-items-center rounded border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] px-1 text-[11px] font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
                {clinicalNoteDisplayCount}
              </span>
            }
            headerActions={
              bestSource ? (
                <Link
                  href={bestSource.viewer_href}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label="Open clinical notes source"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null
            }
            headerClassName="gap-2 p-2.5 sm:p-3"
            titleClassName="text-[15px] leading-5"
            closeButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            contentClassName="max-h-[92dvh] translate-y-0 bg-[color:var(--surface-raised)] motion-safe:animate-none sm:h-auto sm:max-h-[88dvh] sm:max-w-lg"
            contentStyle={{ height: "80dvh" }}
            bodyClassName="flex flex-col bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={clinicalNotesTriggerRef}
            portal
          >
            <ClinicalNotesChecklistPanel
              answer={answer}
              viewMode={answerViewMode}
              evidenceMapRows={answerEvidenceMapRows}
              bestSource={bestSource}
              copied={copiedAnswer}
              onCopy={onCopyAnswer}
              onOpenTables={openTableEvidence}
            />
          </Sheet>
        ) : null}

        {showEvidenceDrawer ? (
          <Sheet
            open={evidenceOpen}
            onClose={closeEvidenceReview}
            title="Evidence"
            description="Review by evidence type."
            titleAccessory={
              <span className={cn(subtleStatusPill, "min-h-6 px-2 text-[11px]")}>{evidenceTrustLabel}</span>
            }
            closeLabel="Close evidence"
            headerLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--primary)]")}>
                <Layers className="h-3.5 w-3.5" />
              </span>
            }
            contentClassName="max-h-[92dvh] translate-y-0 bg-[color:var(--surface-raised)] motion-safe:animate-none sm:h-auto sm:max-h-[88dvh] sm:max-w-lg"
            contentStyle={{ height: "80dvh" }}
            bodyClassName="bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
            returnFocusRef={evidenceTriggerRef}
            portal
          >
            <MobileEvidenceSheetContent
              answer={answer}
              sources={sources}
              renderModel={renderModel}
              visualEvidence={renderModel.visualEvidence}
              answerEvidenceMapRows={answerEvidenceMapRows}
              sourceGovernanceWarnings={sourceGovernanceWarnings}
              demoMode={demoMode}
              initialTab={evidenceInitialTab}
              pendingFeedback={pendingFeedback}
              copiedQuotes={copiedQuotes}
              onCopyQuotes={copyQuotes}
              onSubmitFeedback={onSubmitFeedback}
              onScopeDocument={onScopeDocument}
            />
          </Sheet>
        ) : null}
      </div>

      <SafetyFindingsPanel findings={safetyFindings} />
    </div>
  );
}

const tagQualityTone: Record<SmartDocumentTagQualityIssueKind, string> = {
  noisy: toneDanger,
  duplicate: toneWarning,
  low_confidence: toneInfo,
  overused: toneNeutral,
};

const labelTierTone: Record<SmartDocumentTagTier, string> = {
  primary: toneSuccess,
  secondary: toneNeutral,
  ranking: toneInfo,
};

const documentLabelTypeOptions: Array<{ value: DocumentLabelType; label: string }> = [
  { value: "site", label: "Site" },
  { value: "topic", label: "Topic" },
  { value: "document_type", label: "Document type" },
  { value: "medication", label: "Medication" },
  { value: "risk", label: "Risk" },
  { value: "setting", label: "Setting" },
  { value: "workflow", label: "Workflow" },
  { value: "population", label: "Population" },
  { value: "service", label: "Service" },
  { value: "clinical_action", label: "Clinical action" },
  { value: "care_phase", label: "Care phase" },
  { value: "document_intent", label: "Document intent" },
  { value: "content_feature", label: "Content feature" },
  { value: "custom", label: "Manual" },
];

function tagQualityLabel(kind: SmartDocumentTagQualityIssueKind) {
  if (kind === "low_confidence") return "low confidence";
  return kind;
}

function normalizedLabelReviewRow(label: DocumentLabel) {
  const normalized = normalizeDocumentLabelForStorage(label);
  const fallbackLabelType = documentLabelTypeOptions.some((option) => option.value === label.label_type)
    ? label.label_type
    : "custom";
  const labelType = normalized?.label_type ?? fallbackLabelType;
  const labelText = normalized?.label ?? label.label?.trim() ?? "";
  const tier: SmartDocumentTagTier = normalized
    ? documentLabelTier(normalized.label, normalized.label_type)
    : "secondary";
  const reviewStatus = documentLabelReviewStatus(label);
  return {
    id: label.id,
    label: labelText,
    displayLabel: labelText ? formatDocumentLabelDisplay(labelText, labelType) : "Unreviewed label",
    labelType,
    tier,
    reviewStatus,
    source: label.source,
    confidence: normalized?.confidence ?? label.confidence ?? 0,
  };
}

function labelTypeDisplay(value: DocumentLabelType) {
  return documentLabelTypeOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}

type LabelReviewMutationBody =
  { labelId: string; action: "approve" | "hide" | "restore" } | { label: string; label_type: DocumentLabelType };

function DocumentLabelReviewPanel({
  documents,
  canManage,
  onMutateLabel,
}: {
  documents: ClinicalDocument[];
  canManage: boolean;
  onMutateLabel: (documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody) => Promise<boolean>;
}) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { label: string; labelType: DocumentLabelType }>>(
    {},
  );

  const items = useMemo(() => {
    return documents
      .map((document) => {
        const rows = (document.labels ?? [])
          .map((label) => normalizedLabelReviewRow(label))
          .filter((row): row is NonNullable<ReturnType<typeof normalizedLabelReviewRow>> => Boolean(row));
        const visible = rows.filter((row) => row.reviewStatus !== "hidden" && row.tier !== "ranking");
        const ranking = rows.filter((row) => row.reviewStatus !== "hidden" && row.tier === "ranking");
        const hidden = rows.filter((row) => row.reviewStatus === "hidden");
        const needsReview = rows.some((row) => row.reviewStatus === "new" && row.source === "generated");
        return { document, rows, visible, ranking, hidden, needsReview };
      })
      .filter((item) => item.rows.length)
      .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || b.ranking.length - a.ranking.length)
      .slice(0, 8);
  }, [documents]);

  if (!items.length) return null;

  async function mutate(documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody, actionId: string) {
    setBusyAction(actionId);
    try {
      return await onMutateLabel(documentId, method, body);
    } finally {
      setBusyAction(null);
    }
  }

  function draftFor(documentId: string) {
    return overrideDrafts[documentId] ?? { label: "", labelType: "topic" as DocumentLabelType };
  }

  function setDraft(documentId: string, next: { label: string; labelType: DocumentLabelType }) {
    setOverrideDrafts((current) => ({ ...current, [documentId]: next }));
  }

  return (
    <details className={cn(sourceCard, "group p-3")}>
      <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Label review</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              Visible labels, ranking labels, hidden labels, confidence, and manual overrides
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-3 border-t border-[color:var(--border)] pt-3">
        {items.map((item) => {
          const draft = draftFor(item.document.id);
          return (
            <article
              key={item.document.id}
              className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/documents/${item.document.id}`}
                    className="line-clamp-2 text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                  >
                    {documentDisplayTitle(item.document)}
                  </Link>
                  <p className={cn("mt-1 text-[11px] font-semibold", textMuted)}>
                    {item.visible.length} visible · {item.ranking.length} ranking · {item.hidden.length} hidden
                  </p>
                </div>
                {item.needsReview ? (
                  <span className={cn(metadataPill, toneWarning, "min-h-7 text-[11px]")}>Needs review</span>
                ) : (
                  <span className={cn(metadataPill, toneSuccess, "min-h-7 text-[11px]")}>Reviewed</span>
                )}
              </div>

              {(
                [
                  { title: "Visible", rows: item.visible },
                  { title: "Ranking", rows: item.ranking },
                  { title: "Hidden", rows: item.hidden },
                ] satisfies Array<{ title: string; rows: typeof item.rows }>
              ).map(({ title, rows: labelRows }) => {
                if (!labelRows.length) return null;
                return (
                  <section key={title} className="grid gap-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                      {title}
                    </p>
                    <div className="grid gap-1.5">
                      {labelRows.slice(0, 8).map((label) => (
                        <div
                          key={label.id}
                          className="grid gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-[color:var(--text)]">
                                {label.displayLabel}
                              </span>
                              <span className={cn(metadataPill, labelTierTone[label.tier], "min-h-6 text-[10px]")}>
                                {label.tier}
                              </span>
                              <span className={cn(metadataPill, "min-h-6 text-[10px]")}>
                                {labelTypeDisplay(label.labelType)}
                              </span>
                            </div>
                            <p className={cn("mt-1 text-[11px] font-semibold", textMuted)}>
                              {label.source} · {Math.round(label.confidence * 100)}% · {label.reviewStatus}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {label.reviewStatus === "hidden" ? (
                              <button
                                type="button"
                                disabled={!canManage || busyAction !== null}
                                onClick={() =>
                                  void mutate(
                                    item.document.id,
                                    "PATCH",
                                    { labelId: label.id, action: "restore" },
                                    `restore:${label.id}`,
                                  )
                                }
                                className={cn(floatingControl, "min-h-8 px-2 text-[11px]")}
                              >
                                Restore
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={!canManage || busyAction !== null || label.reviewStatus === "approved"}
                                  onClick={() =>
                                    void mutate(
                                      item.document.id,
                                      "PATCH",
                                      { labelId: label.id, action: "approve" },
                                      `approve:${label.id}`,
                                    )
                                  }
                                  className={cn(floatingControl, "min-h-8 px-2 text-[11px]")}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManage || busyAction !== null}
                                  onClick={() =>
                                    void mutate(
                                      item.document.id,
                                      "PATCH",
                                      { labelId: label.id, action: "hide" },
                                      `hide:${label.id}`,
                                    )
                                  }
                                  className={cn(floatingControl, "min-h-8 px-2 text-[11px] text-[color:var(--danger)]")}
                                >
                                  Hide
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              <form
                className="grid gap-2 border-t border-[color:var(--border)] pt-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = draft.label.trim();
                  if (!trimmed) return;
                  void mutate(
                    item.document.id,
                    "POST",
                    { label: trimmed, label_type: draft.labelType },
                    `override:${item.document.id}`,
                  ).then((ok) => {
                    if (ok) setDraft(item.document.id, { label: "", labelType: draft.labelType });
                  });
                }}
              >
                <input
                  value={draft.label}
                  onChange={(event) => setDraft(item.document.id, { ...draft, label: event.target.value })}
                  disabled={!canManage || busyAction !== null}
                  placeholder="Manual override label"
                  aria-label="Manual override label"
                  className={fieldControlPlain}
                />
                <select
                  value={draft.labelType}
                  onChange={(event) =>
                    setDraft(item.document.id, { ...draft, labelType: event.target.value as DocumentLabelType })
                  }
                  disabled={!canManage || busyAction !== null}
                  aria-label="Manual override label type"
                  className={fieldControlPlain}
                >
                  {documentLabelTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!canManage || busyAction !== null || !draft.label.trim()}
                  className={cn(primaryControl, "justify-center text-xs")}
                >
                  {busyAction === `override:${item.document.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Override
                </button>
              </form>
            </article>
          );
        })}
      </div>
    </details>
  );
}

function DocumentTagQualityPanel({ documents }: { documents: ClinicalDocument[] }) {
  const issues = useMemo(() => reviewDocumentTagQuality(documents), [documents]);
  const counts = issues.reduce<Record<SmartDocumentTagQualityIssueKind, number>>(
    (current, issue) => ({ ...current, [issue.kind]: current[issue.kind] + 1 }),
    { noisy: 0, duplicate: 0, low_confidence: 0, overused: 0 },
  );

  return (
    <details className={cn(panelSubtle, "group p-3")}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <Tag className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Tag quality review</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              {issues.length
                ? `${issues.length} issue${issues.length === 1 ? "" : "s"} across loaded documents`
                : "No obvious tag cleanup issues in loaded documents"}
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(counts) as SmartDocumentTagQualityIssueKind[]).map((kind) => (
            <span key={kind} className={cn(metadataPill, "min-h-7 px-2 text-[11px]", tagQualityTone[kind])}>
              {tagQualityLabel(kind)}: {counts[kind]}
            </span>
          ))}
        </div>
        {issues.length ? (
          <div className="grid gap-2">
            {issues.slice(0, 12).map((issue, index) => (
              <div
                key={`${issue.kind}:${issue.label}:${index}`}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(metadataPill, "min-h-6 px-2 text-[10px]", tagQualityTone[issue.kind])}>
                    {tagQualityLabel(issue.kind)}
                  </span>
                  <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">{issue.label}</p>
                  {issue.count > 1 ? (
                    <span className={cn("text-[11px] font-semibold", textMuted)}>{issue.count} hits</span>
                  ) : null}
                </div>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>{issue.reason}</p>
                {issue.examples.length || issue.documentTitles.length ? (
                  <p className={cn("mt-1 truncate text-[11px] font-semibold", textMuted)}>
                    {[
                      issue.examples.length ? `examples: ${issue.examples.join(", ")}` : "",
                      issue.documentTitles.length ? `docs: ${issue.documentTitles.join(", ")}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className={cn("text-sm", textMuted)}>Loaded tags are clean enough for the current smart-tag rules.</p>
        )}
      </div>
    </details>
  );
}

function DocumentIndexRepairPanel({ documents }: { documents: ClinicalDocument[] }) {
  const items = useMemo(() => {
    return documents
      .map((document) => {
        const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
        const score = Number((metadata as Record<string, unknown>).index_quality_score ?? 1);
        const issues = Array.isArray((metadata as Record<string, unknown>).index_quality_issues)
          ? ((metadata as Record<string, unknown>).index_quality_issues as unknown[]).map(String)
          : [];
        const sectionCount = Number((metadata as Record<string, unknown>).section_count ?? 0);
        const memoryCardCount = Number((metadata as Record<string, unknown>).memory_card_count ?? 0);
        const extractionQuality = String((metadata as Record<string, unknown>).extraction_quality ?? "unknown");
        const needsRepair =
          score < 0.72 ||
          issues.length > 0 ||
          sectionCount === 0 ||
          memoryCardCount === 0 ||
          extractionQuality === "poor" ||
          extractionQuality === "partial";
        return { document, score, issues, sectionCount, memoryCardCount, extractionQuality, needsRepair };
      })
      .filter((item) => item.needsRepair)
      .sort((a, b) => a.score - b.score || b.issues.length - a.issues.length)
      .slice(0, 10);
  }, [documents]);

  if (!items.length) return null;

  return (
    <details className={cn(sourceCard, "p-3")}>
      <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <ShieldAlert className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Index repair queue</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              {items.length} loaded document{items.length === 1 ? "" : "s"} need quality review or reindexing
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-2 border-t border-[color:var(--border)] pt-3">
        {items.map((item) => (
          <article
            key={item.document.id}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">{item.document.title}</p>
              <span className={cn(metadataPill, "nums text-[11px]")}>
                index {Number.isFinite(item.score) ? item.score.toFixed(2) : "n/a"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn(metadataPill, "text-[11px]")}>extraction:{item.extractionQuality}</span>
              <span className={cn(metadataPill, "text-[11px]")}>sections:{item.sectionCount}</span>
              <span className={cn(metadataPill, "text-[11px]")}>memory:{item.memoryCardCount}</span>
              {item.issues.slice(0, 4).map((issue) => (
                <span key={issue} className={cn(metadataPill, "text-[11px]")}>
                  {issue}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

function DocumentDrawer({
  documents,
  pagination,
  loadingMoreDocuments,
  mode,
  selectedDocumentIds,
  statusFilter,
  onToggleScope,
  onLoadMoreDocuments,
  onDocumentRenamed,
  onDocumentDeleted,
  onBulkReindex,
  onBulkAssignCollection,
  onBulkMetadataUpdate,
  bulkActionStatus,
  bulkActionBusy,
  canManageDocuments,
  onTagSearch,
  onMutateLabel,
}: {
  documents: ClinicalDocument[];
  pagination: DocumentPagination | null;
  loadingMoreDocuments: boolean;
  mode: DocumentDrawerMode;
  selectedDocumentIds: string[];
  statusFilter: DocumentDrawerStatusFilter;
  onToggleScope: (documentId: string) => void;
  onLoadMoreDocuments: () => void;
  onDocumentRenamed: (document: ClinicalDocument) => void;
  onDocumentDeleted: (result: DocumentDeleteResult) => void;
  onBulkReindex: (mode: "enrichment" | "full" | "retry_failed") => void;
  onBulkAssignCollection: (collection: string) => void;
  onBulkMetadataUpdate: (metadata: Record<string, unknown>) => void;
  bulkActionStatus: string | null;
  bulkActionBusy: boolean;
  canManageDocuments: boolean;
  onTagSearch: (tag: SmartDocumentTag) => void;
  onMutateLabel: (documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedPopulation, setSelectedPopulation] = useState<string>("all");
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState<boolean>(false);

  const [collectionDraft, setCollectionDraft] = useState("");
  const [metadataDraft, setMetadataDraft] = useState({
    sourceStatus: "",
    validationStatus: "",
    extractionQuality: "",
    reviewDate: "",
    publicationDate: "",
    jurisdiction: "",
    sourceType: "",
    category: "",
  });

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const doc of documents) {
      const typeLabel = doc.labels?.find((l) => l.label_type === "document_type" && l.confidence >= 0.5)?.label;
      if (typeLabel) types.add(typeLabel);
      const profile = documentOrganizationProfile(doc);
      if (profile?.document_type?.label && profile.document_type.label !== "unknown") {
        types.add(profile.document_type.label);
      }
    }
    return Array.from(types).sort();
  }, [documents]);

  const allSites = useMemo(() => {
    const sites = new Set<string>();
    for (const doc of documents) {
      const siteLabels = doc.labels?.filter((l) => l.label_type === "site" && l.confidence >= 0.5) ?? [];
      for (const l of siteLabels) sites.add(l.label);
      const profile = documentOrganizationProfile(doc);
      if (profile?.site?.label) sites.add(profile.site.label);
    }
    return Array.from(sites).sort();
  }, [documents]);

  const allTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const doc of documents) {
      const topicLabels =
        doc.labels?.filter((l) => (l.label_type === "topic" || l.label_type === "custom") && l.confidence >= 0.5) ?? [];
      for (const l of topicLabels) topics.add(l.label);
      const profile = documentOrganizationProfile(doc);
      if (profile?.secondary_facets?.topic) {
        for (const t of profile.secondary_facets.topic) topics.add(t);
      }
    }
    return Array.from(topics).sort();
  }, [documents]);

  const allPopulations = useMemo(() => {
    const populations = new Set<string>();
    for (const doc of documents) {
      const popLabels = doc.labels?.filter((l) => l.label_type === "population" && l.confidence >= 0.5) ?? [];
      for (const l of popLabels) populations.add(l.label);
      const profile = documentOrganizationProfile(doc);
      if (profile?.secondary_facets?.population) {
        for (const p of profile.secondary_facets.population) populations.add(p);
      }
    }
    return Array.from(populations).sort();
  }, [documents]);

  const isAdminMode = mode === "admin" && canManageDocuments;
  const filterValue = filter.toLowerCase();
  const sourcePdfCount = useMemo(
    () =>
      documents.filter((document) => {
        const typeText = `${document.file_type} ${document.file_name}`.toLowerCase();
        return documentStatusMatchesFilter(document, statusFilter) && typeText.includes("pdf");
      }).length,
    [documents, statusFilter],
  );

  const filtered = documents
    .filter((document) => {
      if (!documentStatusMatchesFilter(document, statusFilter)) return false;
      if (mode === "source") {
        const typeText = `${document.file_type} ${document.file_name}`.toLowerCase();
        if (!typeText.includes("pdf")) return false;
      }

      // Filter by Type
      if (selectedType !== "all") {
        const typeLabel = document.labels?.find((l) => l.label_type === "document_type" && l.confidence >= 0.5)?.label;
        const profile = documentOrganizationProfile(document);
        const hasTypeMatch = typeLabel === selectedType || profile?.document_type?.label === selectedType;
        if (!hasTypeMatch) return false;
      }

      // Filter by Site
      if (selectedSite !== "all") {
        const siteLabels = document.labels?.filter((l) => l.label_type === "site" && l.confidence >= 0.5) ?? [];
        const profile = documentOrganizationProfile(document);
        const hasSiteMatch = siteLabels.some((l) => l.label === selectedSite) || profile?.site?.label === selectedSite;
        if (!hasSiteMatch) return false;
      }

      // Filter by Topic
      if (selectedTopic !== "all") {
        const topicLabels =
          document.labels?.filter(
            (l) => (l.label_type === "topic" || l.label_type === "custom") && l.confidence >= 0.5,
          ) ?? [];
        const profile = documentOrganizationProfile(document);
        const hasTopicMatch =
          topicLabels.some((l) => l.label === selectedTopic) ||
          profile?.secondary_facets?.topic?.includes(selectedTopic);
        if (!hasTopicMatch) return false;
      }

      // Filter by Population
      if (selectedPopulation !== "all") {
        const popLabels = document.labels?.filter((l) => l.label_type === "population" && l.confidence >= 0.5) ?? [];
        const profile = documentOrganizationProfile(document);
        const hasPopMatch =
          popLabels.some((l) => l.label === selectedPopulation) ||
          profile?.secondary_facets?.population?.includes(selectedPopulation);
        if (!hasPopMatch) return false;
      }

      // Filter by Needs Review
      if (showNeedsReviewOnly) {
        const profile = documentOrganizationProfile(document);
        if (profile?.review_status !== "needs_review") return false;
      }

      const labelText = tagSearchText(document);
      const summaryText = document.summary?.summary ?? "";
      const haystack = `${document.title} ${document.file_name} ${labelText} ${summaryText}`.toLowerCase();
      return haystack.includes(filterValue);
    })
    .sort((left, right) => {
      if (mode !== "recent") return 0;
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  const availableDocumentCount = mode === "source" ? sourcePdfCount : (pagination?.total ?? documents.length);
  const statusTitle =
    mode === "recent"
      ? `${availableDocumentCount.toLocaleString()} recent source${availableDocumentCount === 1 ? "" : "s"}`
      : mode === "source"
        ? `${availableDocumentCount.toLocaleString()} source PDF${availableDocumentCount === 1 ? "" : "s"}`
        : isAdminMode
          ? `${statusFilterLabel(statusFilter)}: ${filtered.length.toLocaleString()} shown`
          : `${availableDocumentCount.toLocaleString()} indexed source${availableDocumentCount === 1 ? "" : "s"}`;
  const statusHelper =
    availableDocumentCount === 0
      ? mode === "recent"
        ? "Recent source rows will appear here after indexing."
        : mode === "source"
          ? "Indexed PDF source rows will appear below."
          : "Indexed source rows will appear below."
      : mode === "recent"
        ? "Continue reading from the most recently updated sources."
        : mode === "source"
          ? "Open original PDF source documents."
          : "Search and filter to open indexed clinical sources.";

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "grid min-h-[4.5rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
          "sm:p-3.5",
        )}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          <FileText className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[color:var(--text-heading)]">{statusTitle}</p>
          <p className={cn("mt-0.5 line-clamp-2 text-xs font-medium leading-5", textMuted)}>{statusHelper}</p>
        </div>
        <span className="nums w-fit shrink-0 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 py-1 text-2xs font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
          {filtered.length.toLocaleString()} shown
        </span>
      </div>
      <label className="relative block">
        <Search className={fieldIcon} />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={mode === "source" ? "Find a source PDF" : "Find a document"}
          data-sheet-autofocus={mode !== "admin" ? "true" : undefined}
          className={fieldControlWithIcon}
        />
      </label>

      {/* Dynamic Browse Library Filters */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div>
          <label htmlFor="browse-filter-type" className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">Type</label>
          <select
            id="browse-filter-type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={cn(fieldControlPlain, "mt-1 h-10 text-xs font-semibold shadow-none sm:h-9")}
            aria-label="Filter by document type"
          >
            <option value="all">All Types</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="browse-filter-site" className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">Site</label>
          <select
            id="browse-filter-site"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className={cn(fieldControlPlain, "mt-1 h-10 text-xs font-semibold shadow-none sm:h-9")}
            aria-label="Filter by site"
          >
            <option value="all">All Sites</option>
            {allSites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="browse-filter-topic" className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">Topic</label>
          <select
            id="browse-filter-topic"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className={cn(fieldControlPlain, "mt-1 h-10 text-xs font-semibold shadow-none sm:h-9")}
            aria-label="Filter by topic"
          >
            <option value="all">All Topics</option>
            {allTopics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="browse-filter-population" className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">
            Population
          </label>
          <select
            id="browse-filter-population"
            value={selectedPopulation}
            onChange={(e) => setSelectedPopulation(e.target.value)}
            className={cn(fieldControlPlain, "mt-1 h-10 text-xs font-semibold shadow-none sm:h-9")}
            aria-label="Filter by population"
          >
            <option value="all">All Populations</option>
            {allPopulations.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin Queue Toggle */}
      {isAdminMode ? (
        <div className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            id="needs-review-filter"
            checked={showNeedsReviewOnly}
            onChange={(e) => setShowNeedsReviewOnly(e.target.checked)}
            className="rounded border-[color:var(--border)] text-[color:var(--primary)] focus:ring-[color:var(--primary)] h-4 w-4"
          />
          <label
            htmlFor="needs-review-filter"
            className="text-xs font-semibold text-[color:var(--text-soft)] cursor-pointer select-none"
          >
            Show &quot;Needs review&quot; queue only
          </label>
        </div>
      ) : null}
      {pagination && pagination.total > documents.length ? (
        <p className={cn("text-xs", textMuted)}>
          Showing {documents.length} of {pagination.total} documents. Load more to manage older files.
        </p>
      ) : null}
      {isAdminMode ? (
        <DocumentLabelReviewPanel documents={documents} canManage={canManageDocuments} onMutateLabel={onMutateLabel} />
      ) : null}
      {isAdminMode ? <DocumentTagQualityPanel documents={documents} /> : null}
      {isAdminMode ? <DocumentIndexRepairPanel documents={documents} /> : null}
      {isAdminMode && selectedDocumentIds.length ? (
        <div className={cn(panelSubtle, "space-y-3 p-3")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text)]">
                {selectedDocumentIds.length} selected document{selectedDocumentIds.length === 1 ? "" : "s"}
              </p>
              <p className={cn("text-xs", textMuted)}>Bulk actions apply only to explicitly selected documents.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canManageDocuments || bulkActionBusy}
                onClick={() => onBulkReindex("enrichment")}
                className={cn(floatingControl, "px-3 text-xs")}
              >
                {bulkActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Regenerate summaries
              </button>
              <button
                type="button"
                disabled={!canManageDocuments || bulkActionBusy}
                onClick={() => onBulkReindex("full")}
                className={cn(floatingControl, "px-3 text-xs")}
              >
                <RefreshCw className="h-4 w-4" />
                Full reindex
              </button>
              <button
                type="button"
                disabled={!canManageDocuments || bulkActionBusy}
                onClick={() => onBulkReindex("retry_failed")}
                className={cn(floatingControl, "px-3 text-xs")}
              >
                <RefreshCw className="h-4 w-4" />
                Retry failed
              </button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={collectionDraft}
              onChange={(event) => setCollectionDraft(event.target.value)}
              placeholder="Collection name for selected documents"
              aria-label="Collection name for selected documents"
              className={fieldControlPlain}
            />
            <button
              type="button"
              disabled={!canManageDocuments || bulkActionBusy || !collectionDraft.trim()}
              onClick={() => onBulkAssignCollection(collectionDraft)}
              className={cn(primaryControl, "justify-center")}
            >
              Assign collection
            </button>
          </div>
          <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text)]">
              Bulk metadata editor
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={metadataDraft.sourceStatus}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, sourceStatus: event.target.value }))}
                aria-label="Bulk edit source status"
                className={fieldControlPlain}
              >
                <option value="">Source status unchanged</option>
                <option value="current">Current</option>
                <option value="review_due">Review due</option>
                <option value="outdated">Outdated</option>
                <option value="unknown">Unknown</option>
              </select>
              <select
                value={metadataDraft.validationStatus}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, validationStatus: event.target.value }))
                }
                aria-label="Bulk edit validation status"
                className={fieldControlPlain}
              >
                <option value="">Validation unchanged</option>
                <option value="unverified">Unverified</option>
                <option value="locally_reviewed">Locally reviewed</option>
                <option value="approved">Approved</option>
              </select>
              <select
                value={metadataDraft.extractionQuality}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, extractionQuality: event.target.value }))
                }
                aria-label="Bulk edit extraction quality"
                className={fieldControlPlain}
              >
                <option value="">Extraction unchanged</option>
                <option value="good">Good</option>
                <option value="partial">Partial</option>
                <option value="poor">Poor</option>
                <option value="unknown">Unknown</option>
              </select>
              <input
                type="date"
                value={metadataDraft.reviewDate}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, reviewDate: event.target.value }))}
                className={fieldControlPlain}
                aria-label="Bulk review date"
              />
              <input
                type="date"
                value={metadataDraft.publicationDate}
                onChange={(event) =>
                  setMetadataDraft((current) => ({ ...current, publicationDate: event.target.value }))
                }
                className={fieldControlPlain}
                aria-label="Bulk publication date"
              />
              <input
                value={metadataDraft.jurisdiction}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, jurisdiction: event.target.value }))}
                placeholder="Jurisdiction/locality"
                aria-label="Bulk edit jurisdiction/locality"
                className={fieldControlPlain}
              />
              <input
                value={metadataDraft.sourceType}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, sourceType: event.target.value }))}
                placeholder="Source type"
                aria-label="Bulk edit source type"
                className={fieldControlPlain}
              />
              <input
                value={metadataDraft.category}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Category"
                aria-label="Bulk edit category"
                className={fieldControlPlain}
              />
            </div>
            <button
              type="button"
              disabled={!canManageDocuments || bulkActionBusy}
              onClick={() => {
                const metadata = Object.fromEntries(
                  Object.entries(metadataDraft).filter(([, value]) => String(value).trim()),
                );
                onBulkMetadataUpdate(metadata);
              }}
              className={cn(primaryControl, "mt-3 justify-center")}
            >
              Apply metadata to selected
            </button>
          </details>
          {bulkActionStatus ? <p className={cn("text-xs font-semibold", textMuted)}>{bulkActionStatus}</p> : null}
        </div>
      ) : null}
      <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={documents.length === 0 ? emptyStates.documentsNoneIndexed.title : emptyStates.documentsNoMatch.title}
            body={
              documents.length === 0
                ? "Upload a guideline to start indexing."
                : "Try another document title or file name."
            }
          />
        ) : (
          filtered.slice(0, 12).map((document) => {
            const selected = selectedDocumentIds.includes(document.id);
            return (
              <div key={document.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <Link
                    href={`/documents/${document.id}`}
                    className="flex min-h-[44px] min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                  >
                    <span className="truncate">{documentDisplayTitle(document)}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
                  </Link>
                  <DocumentOrganizationBadges document={document} compact className="mt-1" />
                  <p className={cn("mt-1 truncate text-xs", textMuted)}>
                    {document.page_count} pages · {document.chunk_count} chunks · {document.image_count} images
                  </p>
                  {document.summary?.summary && (
                    <p className={cn("mt-2 line-clamp-2 text-[13px] leading-5", textMuted)}>
                      <SafeBoldText text={document.summary.summary} />
                    </p>
                  )}
                  <DocumentTagCloud
                    labels={document.labels}
                    query={filter}
                    limit={5}
                    compact
                    className="mt-2"
                    onTagClick={onTagSearch}
                  />
                  <SourceProvenance metadata={document.metadata} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={document.status} />
                  <SourceStatusBadge metadata={document.metadata} />
                  {isAdminMode ? (
                    <DocumentManagementActions
                      document={document}
                      disabled={!canManageDocuments}
                      onRenamed={onDocumentRenamed}
                      onDeleted={onDocumentDeleted}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onToggleScope(document.id)}
                    className={cn(
                      "inline-flex min-h-[44px] items-center rounded-lg border px-3 text-xs font-semibold transition",
                      selected
                        ? "border-[color:var(--primary)]/35 bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {selected ? "In scope" : "Add scope"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {pagination?.hasMore ? (
        <button
          type="button"
          onClick={onLoadMoreDocuments}
          disabled={loadingMoreDocuments}
          className={cn(floatingControl, "w-full justify-center")}
        >
          {loadingMoreDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          Load more documents
        </button>
      ) : null}
    </div>
  );
}

type LibraryHealthTarget = "documents" | "setup" | "indexing" | "failures";
type DocumentDrawerMode = "recent" | "library" | "source" | "admin";
type DocumentDrawerStatusFilter = "all" | "indexed" | "indexing" | "failed";
type IndexingMonitorFilter = "all" | "active" | "failed";
type UploadIndexingTab = "setup" | "upload" | "jobs" | "quality";

function documentStatusMatchesFilter(document: ClinicalDocument, filter: DocumentDrawerStatusFilter) {
  if (filter === "all") return true;
  if (filter === "indexed") return document.status === "indexed";
  if (filter === "indexing") return document.status === "queued" || document.status === "processing";
  return document.status === "failed";
}

function statusFilterLabel(filter: DocumentDrawerStatusFilter) {
  if (filter === "indexed") return "Indexed documents";
  if (filter === "indexing") return "Indexing documents";
  if (filter === "failed") return "Failed documents";
  return "All documents";
}

function DrawerGroupLabel({ title }: { title: string }) {
  return (
    <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{title}</p>
  );
}

export function SettingsDialog({
  open,
  onClose,
  identity,
  theme,
  onToggleTheme,
  onSignOut,
  onOpenGuide,
}: {
  open: boolean;
  onClose: () => void;
  identity: SidebarIdentity;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
  onOpenGuide: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsEmailInputRef = useRef<HTMLInputElement | null>(null);
  const currentThemeLabel = theme === "dark" ? "Dark" : "Light";
  const auth = useAuthSession();
  const [settingsEmail, setSettingsEmail] = useState("");
  const [emailEntryOpen, setEmailEntryOpen] = useState(false);
  const [settingsEmailAttempted, setSettingsEmailAttempted] = useState(false);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const settingsAuthBusy = auth.status === "loading";
  const signedOutAccount = !identity.signedIn;

  async function submitSettingsEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsEmail.trim()) return;
    setAccountNotice(null);
    setSettingsEmailAttempted(true);
    await auth.signInWithEmail(settingsEmail.trim());
  }

  function openSettingsEmailEntry() {
    setEmailEntryOpen(true);
    setAccountNotice(null);
  }

  function chooseSettingsProvider(provider: string) {
    setAccountNotice(`${provider} sign-in is a placeholder for now. Continue with email to use this workspace.`);
  }

  useEffect(() => {
    if (!emailEntryOpen) return;
    const focusFrame = window.requestAnimationFrame(() => {
      settingsEmailInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [emailEntryOpen]);

  const settingSections = [
    {
      title: "Account",
      rows: [
        { icon: UserRound, label: "Profile", value: identity.displayName },
        { icon: Stethoscope, label: "Clinical role", value: "Consultant psychiatrist" },
      ],
    },
    {
      title: "Clinical defaults",
      rows: [
        { icon: Globe2, label: "Jurisdiction", value: "Western Australia", active: true },
        { icon: CircleUserRound, label: "Default population", value: "Adults" },
        { icon: SlidersHorizontal, label: "Answer style", value: "Conservative" },
      ],
    },
    {
      title: "App preferences",
      rows: [
        {
          icon: Palette,
          label: "Appearance",
          value: currentThemeLabel,
          onClick: onToggleTheme,
          actionLabel: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        },
        { icon: SettingsIcon, label: "Interface density", value: "Comfortable" },
      ],
    },
  ];
  const navItems = [
    { icon: SettingsIcon, label: "General" },
    { icon: Stethoscope, label: "Clinical defaults" },
    { icon: Sparkles, label: "Personalisation" },
    { icon: Bell, label: "Notifications" },
    { icon: LockKeyhole, label: "Security" },
    { icon: CircleUserRound, label: "Account", active: true },
    { icon: Keyboard, label: "Keyboard" },
    {
      icon: HelpCircle,
      label: "Help & About",
      onClick: () => {
        onClose();
        onOpenGuide();
      },
    },
  ];

  const closeButton = (
    <button
      ref={closeButtonRef}
      type="button"
      onClick={onClose}
      aria-label="Close settings"
      className="absolute right-2.5 top-[max(0.45rem,env(safe-area-inset-top))] z-10 grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:left-4 lg:right-auto lg:top-4 lg:h-10 lg:w-10"
    >
      <X className="h-4.5 w-4.5" />
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeLabel="Close settings"
      labelledBy="account-settings-title"
      initialFocusRef={closeButtonRef}
      mobilePlacement="fullscreen"
      contentClassName="w-full max-w-none border-[color:var(--border-lux)] bg-[color:var(--background)] font-sans shadow-none lg:max-w-[900px] lg:bg-[color:var(--surface-lux)] lg:shadow-[var(--shadow-lux)]"
      bodyClassName="p-0"
    >
      <div className="relative grid h-dvh max-h-dvh min-h-0 overflow-hidden lg:h-auto lg:max-h-[min(86dvh,820px)] lg:grid-cols-[250px_minmax(0,1fr)]">
        {closeButton}
        <aside className="hidden border-r border-[color:var(--border-lux)] bg-[color:var(--surface)]/72 px-4 pb-5 pt-16 lg:flex lg:flex-col">
          <nav aria-label="Settings sections" className="grid gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    active
                      ? "bg-[color:var(--surface-lux)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] ring-1 ring-[color:var(--clinical-accent)]/10"
                      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-lux)]/80 hover:text-[color:var(--text-heading)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="mx-auto min-h-0 w-full max-w-[460px] overflow-y-auto bg-[color:var(--background)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[max(2.45rem,calc(0.7rem+env(safe-area-inset-top)))] polished-scroll sm:px-5 lg:mx-0 lg:max-w-none lg:bg-transparent lg:px-7 lg:pb-7 lg:pt-6">
          <div className="mb-2 flex items-center justify-between gap-4 lg:mb-5">
            <div className="min-w-0">
              <h2
                id="account-settings-title"
                className="truncate text-[18px] font-semibold tracking-normal text-[color:var(--text-heading)] sm:text-xl lg:text-[1.45rem] lg:leading-8"
              >
                Account &amp; app
              </h2>
            </div>
            <span className="hidden min-h-7 shrink-0 items-center rounded-full border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-xs font-semibold leading-none text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] lg:inline-flex">
              Clinician account
            </span>
          </div>

          <section className="rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.06),var(--shadow-inset)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:p-4 lg:shadow-[var(--shadow-inset)]">
            <h3 className="mb-3 px-0.5 text-[15px] font-semibold leading-5 text-[color:var(--text-heading)]">
              Clinical Guide account
            </h3>
            <div className="flex items-center gap-3 lg:gap-3">
              <span
                className={cn(
                  "relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold leading-none ring-1 lg:h-12 lg:w-12",
                  signedOutAccount
                    ? "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)] ring-[color:var(--border)]"
                    : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] ring-[color:var(--clinical-accent)]/10",
                )}
              >
                {signedOutAccount ? <UserRound className="h-5 w-5" /> : identity.initials}
                {identity.signedIn ? (
                  <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-6 text-[color:var(--text-heading)]">
                  {identity.displayName}
                </p>
                <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  {signedOutAccount ? "Sign in or create an account" : "Consultant psychiatrist, Western Australia"}
                </p>
              </div>
              {signedOutAccount ? (
                <div className="hidden w-[220px] shrink-0 grid-cols-1 gap-2 lg:grid">
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(primaryControl, "min-h-10 whitespace-nowrap px-3 text-sm leading-none")}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(floatingControl, "min-h-10 whitespace-nowrap px-3 text-sm leading-none")}
                  >
                    Sign in
                  </button>
                </div>
              ) : (
                <div className="hidden shrink-0 items-center gap-2 lg:flex">
                  <SettingsChip label="Private" />
                  <SettingsChip label="No PHI" />
                </div>
              )}
            </div>

            {signedOutAccount ? (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(primaryControl, "min-h-10 whitespace-nowrap px-2.5 text-sm leading-none")}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={openSettingsEmailEntry}
                    className={cn(floatingControl, "min-h-10 whitespace-nowrap px-2.5 text-sm leading-none")}
                  >
                    Sign in
                  </button>
                </div>

                {emailEntryOpen ? (
                  <form
                    onSubmit={submitSettingsEmail}
                    className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]"
                  >
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-[color:var(--text-muted)]">
                        Email address
                      </span>
                      <div className="relative">
                        <Mail className={fieldIcon} />
                        <input
                          ref={settingsEmailInputRef}
                          type="email"
                          value={settingsEmail}
                          onChange={(event) => setSettingsEmail(event.target.value)}
                          placeholder="you@clinic.example"
                          className={fieldControlWithIcon}
                        />
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={settingsAuthBusy || !settingsEmail.trim() || !auth.isConfigured}
                      className={cn(primaryControl, "w-full")}
                    >
                      {settingsAuthBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Continue with email
                    </button>
                  </form>
                ) : null}

                <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-soft)]">
                  <span className="h-px flex-1 bg-[color:var(--border)]" />
                  <span>or continue with</span>
                  <span className="h-px flex-1 bg-[color:var(--border)]" />
                </div>

                <div className="grid gap-2">
                  <SettingsProviderRow provider="Apple" onClick={() => chooseSettingsProvider("Apple")} />
                  <SettingsProviderRow provider="Google" onClick={() => chooseSettingsProvider("Google")} />
                  <SettingsProviderRow provider="Microsoft" onClick={() => chooseSettingsProvider("Microsoft")} />
                  <SettingsProviderRow provider="email" onClick={openSettingsEmailEntry} />
                </div>

                <p className="flex items-start gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
                  Accounts save preferences and search history. Do not enter PHI.
                </p>

                {(accountNotice || !auth.isConfigured || (settingsEmailAttempted && auth.error)) && (
                  <p
                    role="alert"
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
                  >
                    {accountNotice ??
                      (settingsEmailAttempted ? auth.error : null) ??
                      "Supabase browser authentication is not configured for account sign-in."}
                  </p>
                )}
              </div>
            ) : (
              <SettingsClinicalContextStrip />
            )}
          </section>

          <div className={cn("hidden lg:mt-4 lg:grid-cols-3 lg:gap-3", signedOutAccount ? "lg:hidden" : "lg:grid")}>
            <SettingsSummaryTile icon={UserRound} label="Profile" value={identity.displayName} />
            <SettingsSummaryTile icon={Stethoscope} label="Clinical setup" value="WA, adults" emphasized />
            <SettingsSummaryTile icon={PanelTop} label="Default view" value="Ask" />
          </div>

          <section className="mt-3.5 grid gap-3 lg:mt-4 lg:rounded-xl lg:border lg:border-[color:var(--border-lux)] lg:bg-[color:var(--surface)] lg:px-5 lg:py-4 lg:shadow-[var(--shadow-inset)]">
            <div className="grid gap-3 lg:gap-4">
              {settingSections.map((section) => (
                <div key={section.title} className="min-w-0">
                  <h3 className="mb-1 px-1 text-[12px] font-semibold tracking-normal text-[color:var(--text-muted)] lg:mb-1.5 lg:text-[13px] lg:text-[color:var(--text-heading)]">
                    {section.title}
                  </h3>
                  <div className="overflow-hidden rounded-[1.1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[0_8px_22px_rgba(0,0,0,0.04),var(--shadow-inset)] dark:shadow-[0_12px_26px_rgba(0,0,0,0.24),var(--shadow-inset)] lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
                    {section.rows.map((row) => (
                      <SettingsRow key={`${section.title}-${row.label}`} {...row} />
                    ))}
                    {section.title === "Account" && identity.signedIn ? (
                      <SettingsRow
                        icon={LogOut}
                        label="Sign out"
                        value=""
                        onClick={() => {
                          onSignOut();
                          onClose();
                        }}
                        actionLabel="Sign out"
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <SettingsHelpFooter
              onClick={() => {
                onClose();
                onOpenGuide();
              }}
            />
          </section>
        </div>
      </div>
    </Sheet>
  );
}

function SettingsChip({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full border border-[color:var(--clinical-accent)]/18 bg-[color:var(--clinical-accent-soft)] px-2.5 text-[11px] font-semibold leading-none text-[color:var(--clinical-accent)] lg:min-h-7 lg:px-3 lg:text-xs">
      {label}
    </span>
  );
}

function SettingsProviderRow({
  provider,
  onClick,
}: {
  provider: "Apple" | "Google" | "Microsoft" | "email";
  onClick: () => void;
}) {
  const label = provider === "email" ? "Use email instead" : provider;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
    >
      {provider === "email" ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
          <Mail className="h-4 w-4" />
        </span>
      ) : (
        <SettingsProviderMark provider={provider} />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" />
    </button>
  );
}

function SettingsProviderMark({ provider }: { provider: "Apple" | "Google" | "Microsoft" }) {
  if (provider === "Microsoft") {
    return (
      <span
        className="grid h-7 w-7 shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)]"
        aria-hidden="true"
      >
        <span className="bg-[#f25022]" />
        <span className="bg-[#7fba00]" />
        <span className="bg-[#00a4ef]" />
        <span className="bg-[#ffb900]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-base font-bold leading-none shadow-[var(--shadow-inset)]",
        provider === "Apple" ? "text-[color:var(--text-heading)]" : "text-[#4285f4]",
      )}
    >
      {provider === "Apple" ? "A" : "G"}
    </span>
  );
}

function SettingsClinicalContextStrip() {
  return (
    <div className="mt-2.5 flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--clinical-accent)]/14 bg-[color:var(--clinical-accent-soft)]/60 px-3 text-[12px] font-semibold leading-none text-[color:var(--clinical-accent)] lg:hidden">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        Private<span className="hidden min-[360px]:inline"> workspace</span>{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> WA{" "}
        <span className="px-1 text-[color:var(--text-soft)]">·</span> No PHI
      </span>
    </div>
  );
}

function SettingsSummaryTile({
  icon: Icon,
  label,
  value,
  emphasized = false,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-2 shadow-[var(--shadow-inset)] lg:rounded-xl lg:p-3",
        emphasized
          ? "border-[color:var(--clinical-accent)]/26 bg-[color:var(--clinical-accent-soft)]/72"
          : "border-[color:var(--border-lux)] bg-[color:var(--surface)]",
      )}
    >
      <div className="flex min-w-0 flex-col items-center justify-center gap-1 text-center lg:min-h-[44px] lg:flex-row lg:justify-start lg:gap-2.5 lg:text-left">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-[var(--shadow-inset)] lg:rounded-lg",
            emphasized
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--primary-contrast)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)]",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold leading-3 text-[color:var(--text-muted)] lg:text-xs lg:leading-4">
            {label}
          </span>
          <span className="block truncate text-xs font-semibold leading-4 text-[color:var(--text-heading)] lg:text-[13px]">
            {value}
          </span>
        </span>
      </div>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  active = false,
  onClick,
  actionLabel,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full transition sm:h-8 sm:w-8 lg:rounded-lg lg:border lg:shadow-[var(--shadow-inset)]",
          active
            ? "bg-[color:var(--clinical-accent)] text-[color:var(--primary-contrast)] shadow-[0_7px_16px_color-mix(in_srgb,var(--clinical-accent)_24%,transparent)] lg:border-[color:var(--clinical-accent)]"
            : "bg-transparent text-[color:var(--text-muted)] lg:border-[color:var(--border)] lg:bg-[color:var(--surface-lux)]",
        )}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <span className="min-w-0 flex-1 min-[360px]:flex min-[360px]:items-center min-[360px]:justify-between min-[360px]:gap-3">
        <span className="block truncate text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{label}</span>
        {value ? (
          <span className="mt-0.5 block max-w-full truncate text-[13px] font-medium leading-5 text-[color:var(--text-muted)] min-[360px]:mt-0 min-[360px]:max-w-[50%] min-[360px]:text-right sm:max-w-[58%] sm:text-sm sm:text-[color:var(--text)] lg:max-w-[52%] lg:text-[13px]">
            {value}
          </span>
        ) : null}
      </span>
      <ChevronDown className="-rotate-90 h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)] lg:h-4 lg:w-4" />
    </>
  );

  const className =
    "flex min-h-[50px] w-full items-center gap-2.5 border-b border-[color:var(--border)]/70 px-3 py-1.5 text-left last:border-b-0 transition hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:min-h-[54px] sm:gap-3 sm:px-3.5 sm:py-2 lg:min-h-10 lg:gap-3 lg:px-0 lg:py-0 lg:hover:bg-[color:var(--surface-lux)]/55";
  const testId = `settings-row-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel ?? label}
        className={className}
        data-testid={testId}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      {content}
    </div>
  );
}

function SettingsHelpFooter({ onClick }: { onClick: () => void }) {
  return (
    <div className="px-1 pt-0.5 lg:hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-lux)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        data-testid="settings-row-guide-help"
      >
        <BookOpen className="h-4 w-4" />
        <span>Guide &amp; help</span>
        <ChevronDown className="-rotate-90 h-3.5 w-3.5 text-[color:var(--text-soft)]" />
      </button>
    </div>
  );
}

function ToolsHub({
  query,
  onQueryChange,
  desktopComposerSlotId,
  showDetailPanel,
}: {
  query: string;
  onQueryChange: (nextQuery: string) => void;
  desktopComposerSlotId?: string;
  showDetailPanel?: boolean;
}) {
  return (
    <ApplicationsLauncherWorkspace
      variant="dashboard-tools"
      query={query}
      onQueryChange={onQueryChange}
      desktopComposerSlotId={desktopComposerSlotId}
      showDetailPanel={showDetailPanel}
    />
  );
}

type MobileSectionFabItem = {
  label: string;
  description: string;
  icon: typeof FileText;
  href: (typeof navigationHashes)[number];
  count: number | null;
  empty?: boolean;
};

type MobileSectionFabTone = "neutral" | "ready" | "warning" | "empty";

type MobileSectionFabState = {
  statusLabel: string;
  statusTone: MobileSectionFabTone;
  nextStep: string;
  badgeLabel: string | null;
  badgeTone: MobileSectionFabTone;
};

function mobileSectionItemLabel(item: MobileSectionFabItem) {
  if (item.count === null) return item.label;
  return `${item.label}, ${item.count} item${item.count === 1 ? "" : "s"}`;
}

function fabToneClassName(tone: MobileSectionFabTone) {
  if (tone === "ready") {
    return "border-[color:var(--success)]/25 bg-[color:var(--success-soft)] text-[color:var(--success)]";
  }
  if (tone === "warning") {
    return "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  if (tone === "empty") {
    return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
  }
  return "border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]";
}

function buildMobileSectionFabState({
  hasAnswer,
  searchMode,
  sourceCount,
  quoteCount,
  weakEvidence,
  governanceWarningCount,
}: {
  hasAnswer: boolean;
  searchMode: AppModeId;
  sourceCount: number;
  quoteCount: number;
  weakEvidence: boolean;
  governanceWarningCount: number;
}): MobileSectionFabState {
  const modeSearch = appModeSearchConfig(searchMode);
  if (!hasAnswer) {
    if (modeSearch.resultKind === "tools") {
      return {
        statusLabel: "Tools",
        statusTone: "neutral",
        nextStep: "Launch a clinical tool",
        badgeLabel: null,
        badgeTone: "neutral",
      };
    }
    if (modeSearch.resultKind === "differentials") {
      return {
        statusLabel: "Diffs",
        statusTone: "neutral",
        nextStep: modeSearch.nextStep,
        badgeLabel: null,
        badgeTone: "neutral",
      };
    }
    return {
      statusLabel: modeSearch.resultKind === "documents" ? modeSearch.statusLabel : "No answer yet",
      statusTone: "empty",
      nextStep: modeSearch.nextStep,
      badgeLabel: modeSearch.badgeLabel,
      badgeTone: "empty",
    };
  }

  if (weakEvidence) {
    return {
      statusLabel: "Weak support",
      statusTone: "warning",
      nextStep: "Verify source before using",
      badgeLabel: "!",
      badgeTone: "warning",
    };
  }

  if (governanceWarningCount > 0) {
    return {
      statusLabel: "Needs source check",
      statusTone: "warning",
      nextStep: `${governanceWarningCount} source warning${governanceWarningCount === 1 ? "" : "s"}`,
      badgeLabel: "!",
      badgeTone: "warning",
    };
  }

  if (quoteCount > 0) {
    return {
      statusLabel: "Ready to verify",
      statusTone: "ready",
      nextStep: "Next: review exact quotes",
      badgeLabel: String(quoteCount),
      badgeTone: "ready",
    };
  }

  if (sourceCount > 0) {
    return {
      statusLabel: "Ready to verify",
      statusTone: "ready",
      nextStep: "Next: verify sources",
      badgeLabel: String(sourceCount),
      badgeTone: "ready",
    };
  }

  return {
    statusLabel: "Answer ready",
    statusTone: "neutral",
    nextStep: "Review answer structure",
    badgeLabel: null,
    badgeTone: "neutral",
  };
}

function MobileSectionFab({
  items,
  activeHash,
  state,
  hidden = false,
  onNavigate,
}: {
  items: readonly MobileSectionFabItem[];
  activeHash: string;
  state: MobileSectionFabState;
  hidden?: boolean;
  onNavigate: (href: MobileSectionFabItem["href"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelId = "mobile-section-fab-menu";
  const labelId = "mobile-section-fab-label";
  const activeItem = items.find((item) => item.href === activeHash) ?? items[0];
  const ActiveIcon = activeItem.icon;
  const activeItemLabel = mobileSectionItemLabel(activeItem);

  const closeMenu = useCallback((options: { restoreFocus?: boolean } = {}) => {
    setOpen(false);
    if (options.restoreFocus ?? true) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  }, []);
  const dismissMobileSectionMenu = useCallback(() => closeMenu(), [closeMenu]);

  useDismissableLayer({
    enabled: open,
    refs: [buttonRef, panelRef],
    restoreFocusRef: buttonRef,
    onDismiss: dismissMobileSectionMenu,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileSectionFabMediaQuery);
    const syncActivation = () => {
      const matches = mediaQuery.matches;
      setActive(matches);
      if (!matches) closeMenu({ restoreFocus: false });
    };

    const frame = window.requestAnimationFrame(syncActivation);
    mediaQuery.addEventListener("change", syncActivation);
    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener("change", syncActivation);
    };
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;
    const closeForRouteChange = () => closeMenu({ restoreFocus: false });
    window.addEventListener("hashchange", closeForRouteChange);
    return () => window.removeEventListener("hashchange", closeForRouteChange);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!hidden) return;
    const frame = window.requestAnimationFrame(() => closeMenu({ restoreFocus: false }));
    return () => window.cancelAnimationFrame(frame);
  }, [closeMenu, hidden]);

  if (hidden || !active) return null;

  return (
    <div data-testid="mobile-section-fab">
      {open ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-transparent"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        />
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        data-testid="mobile-section-fab-button"
        aria-label={open ? "Close answer section menu" : `Open answer section menu, current section ${activeItemLabel}`}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "fixed z-40 grid h-14 w-14 place-items-center rounded-full border border-[color:var(--command)] bg-[color:var(--command)] text-[color:var(--command-contrast)] shadow-[var(--shadow-elevated)] transition motion-safe:duration-150 hover:-translate-y-0.5 hover:bg-[color:var(--command-hover)] active:translate-y-px",
          open && "bg-[color:var(--command-hover)]",
        )}
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="h-6 w-6" /> : <ActiveIcon className="h-6 w-6" />}
        {(state.badgeLabel ?? (activeItem.count !== null ? String(activeItem.count) : null)) ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-0 top-0 grid min-h-5 min-w-5 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full border px-1 text-[10px] font-bold leading-4 shadow-[var(--shadow-tight)]",
              fabToneClassName(state.badgeTone),
            )}
          >
            {state.badgeLabel ?? activeItem.count}
          </span>
        ) : null}
      </button>

      <section
        ref={panelRef}
        id={panelId}
        data-testid="mobile-section-fab-menu"
        role="region"
        aria-labelledby={labelId}
        aria-hidden={!open}
        inert={!open}
        hidden={!open}
        className="fixed z-40 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-[color:var(--border-strong)]/20 backdrop-blur-md dark:ring-[color:var(--border-strong)]/10"
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          bottom: "calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.5rem)",
          maxHeight: "min(25rem, calc(100dvh - 7rem))",
          width: "min(20rem, calc(100vw - 1.5rem))",
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2.5 shadow-[var(--shadow-inset)]">
          <span
            aria-hidden="true"
            className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/70"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <p
                id={labelId}
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]"
              >
                Answer navigator
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[color:var(--text-heading)]">
                Current: {activeItem.label}
              </p>
            </div>
            <span
              data-testid="mobile-section-fab-status"
              className={cn("rounded-full border px-2 py-1 text-[11px] font-bold", fabToneClassName(state.statusTone))}
            >
              {state.statusLabel}
            </span>
          </div>
          <p
            data-testid="mobile-section-fab-next-step"
            className="mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
          >
            {state.nextStep}
          </p>
        </div>

        <div className="polished-scroll grid max-h-[min(17rem,calc(100dvh-14rem))] gap-1 overflow-y-auto overscroll-contain p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeHash === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-label={mobileSectionItemLabel(item)}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(item.href);
                  closeMenu();
                }}
                className={cn(
                  "relative grid min-h-[58px] grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-transparent py-1.5 pl-3 pr-2 text-sm font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                  item.empty && !active && "opacity-75",
                  active &&
                    "border-[color:var(--primary)]/25 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)] shadow-[var(--shadow-inset)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-2 left-1 top-2 w-1 rounded-full bg-transparent",
                    active && "bg-[color:var(--primary)]",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]",
                    item.empty && !active && "bg-[color:var(--surface-subtle)]",
                    active &&
                      "border-[color:var(--primary)]/25 bg-[color:var(--surface)] text-[color:var(--primary-strong)]",
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--text-soft)]">
                    {item.description}
                  </span>
                </span>
                {item.count !== null ? (
                  <span
                    className={cn(
                      "min-w-6 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-1.5 text-center text-[11px] font-bold leading-5 text-[color:var(--text)] shadow-[var(--shadow-inset)]",
                      item.empty && "text-[color:var(--text-muted)]",
                      active &&
                        "border-[color:var(--primary)]/20 bg-[color:var(--surface)] text-[color:var(--primary-strong)]",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function answerReferencesDocument(answer: RagAnswer | null, documentId: string) {
  if (!answer) return false;
  return (
    answer.citations.some((citation) => citation.document_id === documentId) ||
    answer.sources.some((source) => source.document_id === documentId) ||
    Boolean(answer.bestSource?.document_id === documentId) ||
    Boolean(answer.relatedDocuments?.some((document) => document.document_id === documentId)) ||
    Boolean(answer.visualEvidence?.some((image) => image.document_id === documentId))
  );
}

function applyRenamedDocumentToAnswer(answer: RagAnswer | null, document: ClinicalDocument) {
  if (!answer || !answerReferencesDocument(answer, document.id)) return answer;
  const renameCitation = <T extends { document_id: string; title: string }>(item: T): T =>
    item.document_id === document.id ? { ...item, title: document.title } : item;
  const renameRelated = (item: RelatedDocument): RelatedDocument =>
    item.document_id === document.id ? { ...item, title: document.title } : item;

  return {
    ...answer,
    citations: answer.citations.map(renameCitation),
    quoteCards: answer.quoteCards?.map(renameCitation),
    sources: answer.sources.map(renameCitation),
    visualEvidence: answer.visualEvidence?.map(renameCitation),
    bestSource: answer.bestSource ? renameCitation(answer.bestSource) : answer.bestSource,
    relatedDocuments: answer.relatedDocuments?.map(renameRelated),
    smartPanel: answer.smartPanel
      ? {
          ...answer.smartPanel,
          bestSource: answer.smartPanel.bestSource
            ? renameCitation(answer.smartPanel.bestSource)
            : answer.smartPanel.bestSource,
          relatedDocuments: answer.smartPanel.relatedDocuments?.map(renameRelated),
        }
      : answer.smartPanel,
  } satisfies RagAnswer;
}

function normalizedPollDelay(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.max(parsed, 3_000), setupRecheckPollMs);
}

function shorterPollDelay(current: number | null, next: unknown) {
  const normalized = normalizedPollDelay(next);
  if (!normalized) return current;
  return current === null ? normalized : Math.min(current, normalized);
}

function hasActiveIndexingWork(
  documents: ClinicalDocument[],
  jobs: IngestionJob[] = [],
  batches: ImportBatch[] = [],
  routeHint = false,
) {
  return (
    routeHint ||
    documents.some((document) => document.status === "queued" || document.status === "processing") ||
    jobs.some((job) => job.status === "pending" || job.status === "processing") ||
    batches.some((batch) => batch.status === "queued" || batch.status === "processing")
  );
}

function setupNeedsSlowRecheck(checks: SetupCheck[]) {
  return checks.some((check) => check.status !== "ready");
}

function mergeDocumentRefresh(current: ClinicalDocument[], updates: ClinicalDocument[]) {
  const currentById = new Map(current.map((document) => [document.id, document]));
  return updates.map((document) => {
    const existing = currentById.get(document.id);
    if (!existing) return document;
    return {
      ...existing,
      ...document,
      labels: document.labels ?? existing.labels,
      summary: document.summary ?? existing.summary,
    };
  });
}

export function ClinicalDashboard({
  initialSearchMode = "answer",
  initialQuery = "",
  focusSearch = false,
  autoRunSearch = false,
}: { initialSearchMode?: AppModeId; initialQuery?: string; focusSearch?: boolean; autoRunSearch?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const navSyncLockRef = useRef<number | null>(null);
  const autoRunSearchSignatureRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const nextWorkStatePollRef = useRef(0);
  const urlSearchBootstrappedRef = useRef(false);
  const urlDocumentSearchBootstrappedRef = useRef(false);
  const lastSyncedSearchParamsRef = useRef(searchParams.toString());
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [documentsPagination, setDocumentsPagination] = useState<DocumentPagination | null>(null);
  const indexedDocumentTotal = documentsPagination?.total ?? documents.length;
  const [dashboardDataLoading, setDashboardDataLoading] = useState(true);
  const [loadingMoreDocuments, setLoadingMoreDocuments] = useState(false);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [qualityItems, setQualityItems] = useState<IngestionQualityReviewItem[]>([]);
  const jobsRef = useRef(jobs);
  const batchesRef = useRef(batches);
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<AppModeId>(initialSearchMode);
  const [modeSearchSubmitted, setModeSearchSubmitted] = useState(false);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);
  const [searchRelevance, setSearchRelevance] = useState<EvidenceRelevance | null>(null);
  const [searchFacets, setSearchFacets] = useState<SearchFacets | null>(null);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const activeModeSearch = appModeSearchConfig(searchMode);
  const activeModeResultKind = appModeResultKind(searchMode);
  const requestQueryMode = appModeQueryMode(searchMode, queryMode);
  const requestedRun = searchParams.get("run") === "1";
  // Record matches come from the owner-scoped registry API (mock fixtures in
  // demo mode); ranking stays client-side so live-typing behaviour is
  // unchanged and the registry is fetched once per active mode.
  const registryRecords = useRegistryRecords(searchMode === "forms" ? "form" : "service", {
    enabled: searchMode === "services" || searchMode === "forms",
  });
  const serviceSearchMatches = useMemo(
    () => (searchMode === "services" ? rankServiceRecords(registryRecords.records, query) : []),
    [query, searchMode, registryRecords.records],
  );
  const formSearchMatches = useMemo(
    () => (searchMode === "forms" ? rankFormRecords(registryRecords.records, query) : []),
    [query, searchMode, registryRecords.records],
  );
  const recordSearchMatches = useMemo(
    () => (searchMode === "forms" ? formSearchMatches : searchMode === "services" ? serviceSearchMatches : []),
    [searchMode, formSearchMatches, serviceSearchMatches],
  );
  const recordSearchMode = searchMode === "forms" ? "forms" : "services";
  function clearDifferentialModeResultState() {
    setAnswer(null);
    setSources([]);
    setDocumentMatches([]);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setError(null);
    setAnswerProgress(null);
  }
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [searchScope, setSearchScope] = useState<SearchScopeSummary | null>(null);
  const [sourceGovernanceWarnings, setSourceGovernanceWarnings] = useState<SourceGovernanceWarning[]>([]);
  const [answerViewMode, setAnswerViewMode] = useState<AnswerViewMode>("high_yield");
  const [bulkActionStatus, setBulkActionStatus] = useState<string | null>(null);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answerProgress, setAnswerProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [setupChecks, setSetupChecks] = useState<SetupCheck[]>(fallbackSetupChecks);
  const [demoMode, setDemoMode] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [localProjectReady, setLocalProjectReady] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<AnswerFeedbackType | null>(null);
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "warning"; message: string } | null>(null);
  const [activeHash, setActiveHash] = useState("#search");
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [documentsDrawerOpen, setDocumentsDrawerOpen] = useState(false);
  const [documentsDrawerMode, setDocumentsDrawerMode] = useState<DocumentDrawerMode>("library");
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadMobileTab, setUploadMobileTab] = useState<UploadIndexingTab>("upload");
  const [documentDrawerStatusFilter, setDocumentDrawerStatusFilter] = useState<DocumentDrawerStatusFilter>("indexed");
  const [indexingMonitorFilter, setIndexingMonitorFilter] = useState<IndexingMonitorFilter>("all");
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [indexingActionId, setIndexingActionId] = useState<string | null>(null);
  const [indexingActive, setIndexingActive] = useState(false);
  const [nextRefreshDelayMs, setNextRefreshDelayMs] = useState<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const { status: authStatus, authorizationHeader, markSessionExpired } = auth;
  const supabaseEnvStatus = setupChecks.find((check) => check.id === "env")?.status;
  const browserAuthUnavailableDemoFallback = !auth.isConfigured && supabaseEnvStatus !== "ready";
  const localNoAuthMode = isLocalNoAuthMode();
  const explicitDemoMode = demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const clientDemoMode = explicitDemoMode || browserAuthUnavailableDemoFallback || localNoAuthMode;
  const uploadReadOnlyMode =
    demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || browserAuthUnavailableDemoFallback;
  const localDevCanAttemptPrivateApis = process.env.NODE_ENV !== "production" && hasReadyPublicSearchSetup(setupChecks);
  const canUsePrivateApis =
    localProjectReady && (localNoAuthMode || localDevCanAttemptPrivateApis || authStatus === "authenticated");
  const canRunSearch = explicitDemoMode || (hasReadyPublicSearchSetup(setupChecks) && canUsePrivateApis);
  const closeDashboardTransientSurfaces = useCallback(
    (except?: "guide" | "settings" | "accountSetup" | "mobileSidebar" | "documents" | "upload") => {
      if (except !== "guide") setGuideOpen(false);
      if (except !== "settings") setSettingsOpen(false);
      if (except !== "accountSetup") setAccountSetupOpen(false);
      if (except !== "mobileSidebar") setMobileSidebarOpen(false);
      if (except !== "documents") setDocumentsDrawerOpen(false);
      if (except !== "upload") setUploadDrawerOpen(false);
    },
    [],
  );
  const openGuide = useCallback(() => {
    closeDashboardTransientSurfaces("guide");
    setGuideOpen(true);
  }, [closeDashboardTransientSurfaces]);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const openSettings = useCallback(() => {
    closeDashboardTransientSurfaces("settings");
    setSettingsOpen(true);
  }, [closeDashboardTransientSurfaces]);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const sidebarIdentity = useMemo(() => deriveSidebarIdentity(auth.session?.user.email), [auth.session?.user.email]);
  const openAccountProfile = useCallback(() => {
    if (sidebarIdentity.signedIn) {
      closeDashboardTransientSurfaces("settings");
      setSettingsOpen(true);
      return;
    }
    closeDashboardTransientSurfaces("accountSetup");
    setAccountSetupOpen(true);
  }, [closeDashboardTransientSurfaces, sidebarIdentity.signedIn]);
  const closeAccountSetup = useCallback(() => setAccountSetupOpen(false), []);
  const prefetchApplications = useCallback(() => {
    router.prefetch("/?mode=tools");
    router.prefetch("/favourites");
    router.prefetch("/differentials");
  }, [router]);
  const openLibraryHealthTarget = useCallback(
    (target: LibraryHealthTarget) => {
      const targetId =
        target === "documents"
          ? "dashboard-documents-drawer"
          : target === "setup"
            ? "dashboard-setup-section"
            : "dashboard-indexing-section";

      if (target === "documents") {
        closeDashboardTransientSurfaces("documents");
        setDocumentDrawerStatusFilter("indexed");
        setDocumentsDrawerMode("admin");
        setDocumentsDrawerOpen(true);
      } else if (target === "indexing") {
        closeDashboardTransientSurfaces("upload");
        setUploadMobileTab("jobs");
        setIndexingMonitorFilter("active");
        setUploadDrawerOpen(true);
      } else if (target === "failures") {
        closeDashboardTransientSurfaces("upload");
        setUploadMobileTab("jobs");
        setIndexingMonitorFilter("failed");
        setUploadDrawerOpen(true);
      } else {
        closeDashboardTransientSurfaces("upload");
        setUploadMobileTab("setup");
        setIndexingMonitorFilter("all");
        setUploadDrawerOpen(true);
      }

      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    },
    [closeDashboardTransientSurfaces],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(prefetchApplications, 250);
    return () => window.clearTimeout(timeoutId);
  }, [prefetchApplications]);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(recentQueryStorageKey) ?? "[]");
        if (Array.isArray(stored) && !cancelled) {
          setRecentQueries(
            stored.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 5),
          );
        }
      } catch {
        if (!cancelled) setRecentQueries([]);
      }
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const rememberRecentQuery = useCallback((value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    setRecentQueries((current) => {
      const next = [trimmedValue, ...current.filter((item) => item.toLowerCase() !== trimmedValue.toLowerCase())].slice(
        0,
        5,
      );
      try {
        window.localStorage.setItem(recentQueryStorageKey, JSON.stringify(next));
      } catch {
        // Recent questions are a convenience only; ignore storage failures.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  const refresh = useCallback(
    async (options: RefreshOptions = {}) => {
      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current;
      }

      const promise = (async () => {
        const trackDashboardLoading = options.includeDashboardData ?? true;
        await Promise.resolve();
        if (trackDashboardLoading) setDashboardDataLoading(true);

        const includeSetup = options.includeSetup ?? true;
        const includeDashboardData = options.includeDashboardData ?? true;
        const includeDocumentMeta = options.includeDocumentMeta ?? true;
        let nextDemoMode = clientDemoMode;
        let routeIndexingActive = false;
        let routePollDelayMs: number | null = null;

        setApiUnavailable(false);

        const localIdentity = await readLocalProjectIdentity().catch(() => null);
        if (!localIdentity?.localServer?.safeLocalOrigin) {
          setLocalProjectReady(false);
          setApiUnavailable(true);
          setSetupWarning(unsafeLocalProjectMessage(localIdentity));
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
          setQualityItems([]);
          setIndexingActive(false);
          setNextRefreshDelayMs(null);
          return;
        }
        setLocalProjectReady(true);

        if (includeSetup) {
          const setupResponse = await fetch("/api/setup-status", { cache: "no-store" }).catch(() => null);

          if (!setupResponse) {
            setApiUnavailable(true);
            setSetupWarning("The local API is unavailable.");
            return;
          }

          if (setupResponse.ok) {
            const payload = (await setupResponse.json()) as SetupStatusPayload;
            setSetupChecks(payload.checks ?? fallbackSetupChecks);
            nextDemoMode = Boolean(payload.demoMode);
            routeIndexingActive = Boolean(payload.indexingActive);
            routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
            if (nextDemoMode) setDemoMode(true);
          } else {
            setApiUnavailable(true);
          }
        }

        if (!nextDemoMode && !canUsePrivateApis) {
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
          setQualityItems([]);
          setIndexingActive(routeIndexingActive);
          setNextRefreshDelayMs(routePollDelayMs);
          return;
        }

        if (!includeDashboardData) {
          setIndexingActive(routeIndexingActive);
          setNextRefreshDelayMs(routePollDelayMs);
          return;
        }

        const protectedHeaders = nextDemoMode ? undefined : authorizationHeader;
        const documentParams = new URLSearchParams({ limit: String(documentPageSize) });
        if (!includeDocumentMeta) {
          documentParams.set("includeMeta", "false");
        }

        const now = Date.now();
        const shouldRefreshWorkState = now >= nextWorkStatePollRef.current;
        if (shouldRefreshWorkState) nextWorkStatePollRef.current = now + indexingWorkDetailsPollMs;

        const [documentsResponse, jobsResponse, batchesResponse, qualityResponse] = await Promise.all([
          fetch(`/api/documents?${documentParams.toString()}`, { headers: protectedHeaders }),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/jobs", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/batches", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/quality", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
        ]);

        if (
          documentsResponse.status === 401 ||
          (jobsResponse !== null && jobsResponse.status === 401) ||
          (batchesResponse !== null && batchesResponse.status === 401) ||
          (qualityResponse !== null && qualityResponse.status === 401)
        ) {
          markSessionExpired();
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
          setQualityItems([]);
          setIndexingActive(false);
          setNextRefreshDelayMs(null);
          return;
        }

        let nextDocuments: ClinicalDocument[] = [];
        let nextJobs: IngestionJob[] = shouldRefreshWorkState ? [] : jobsRef.current;
        let nextBatches: ImportBatch[] = shouldRefreshWorkState ? [] : batchesRef.current;

        if (documentsResponse.ok) {
          const payload = (await documentsResponse.json()) as DocumentsPayload;
          nextDocuments = payload.documents ?? [];
          setDocuments((current) =>
            includeDocumentMeta ? nextDocuments : mergeDocumentRefresh(current, nextDocuments),
          );
          setDocumentsPagination(payload.pagination ?? null);
          routeIndexingActive ||= Boolean(payload.indexing?.active);
          routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.indexing?.pollAfterMs);
          if (payload.demoMode) setDemoMode(true);
          if (payload.setupRequired) setSetupWarning(payload.error ?? null);
        } else {
          setApiUnavailable(true);
        }

        if (shouldRefreshWorkState && jobsResponse && jobsResponse.ok) {
          const payload = (await jobsResponse.json()) as JobsPayload;
          nextJobs = payload.jobs ?? [];
          setJobs(nextJobs);
          routeIndexingActive ||= Boolean(payload.hasActiveJobs);
          routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
          if (payload.demoMode) setDemoMode(true);
          if (payload.setupRequired) setSetupWarning(payload.error ?? null);
        } else if (shouldRefreshWorkState) {
          setApiUnavailable(true);
        }

        if (shouldRefreshWorkState && batchesResponse && batchesResponse.ok) {
          const payload = (await batchesResponse.json()) as BatchesPayload;
          nextBatches = payload.batches ?? [];
          setBatches(nextBatches);
          routeIndexingActive ||= Boolean(payload.hasActiveBatches);
          routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
          if (payload.demoMode) setDemoMode(true);
        } else if (shouldRefreshWorkState) {
          setApiUnavailable(true);
        }

        if (shouldRefreshWorkState && qualityResponse && qualityResponse.ok) {
          const payload = (await qualityResponse.json()) as IngestionQualityPayload;
          setQualityItems(payload.items ?? []);
          if (payload.demoMode) setDemoMode(true);
        } else if (shouldRefreshWorkState) {
          setApiUnavailable(true);
        }

        const activeWork = hasActiveIndexingWork(nextDocuments, nextJobs, nextBatches, routeIndexingActive);
        setIndexingActive(activeWork);
        setNextRefreshDelayMs(routePollDelayMs ?? (activeWork ? activeIndexingPollFallbackMs : null));
      })();

      refreshInFlightRef.current = promise;
      try {
        return await promise;
      } finally {
        if ((options.includeDashboardData ?? true) === true) setDashboardDataLoading(false);
        if (refreshInFlightRef.current === promise) {
          refreshInFlightRef.current = null;
        }
      }
    },
    [authorizationHeader, canUsePrivateApis, clientDemoMode, markSessionExpired],
  );

  const loadMoreDocuments = useCallback(async () => {
    if (!documentsPagination?.hasMore || loadingMoreDocuments || !canUsePrivateApis) {
      return;
    }

    setLoadingMoreDocuments(true);
    try {
      const protectedHeaders = clientDemoMode ? undefined : authorizationHeader;
      const response = await fetch(
        `/api/documents?limit=${documentPageSize}&offset=${documentsPagination.nextOffset}`,
        { headers: protectedHeaders },
      );
      if (response.status === 401) {
        markSessionExpired();
        return;
      }
      if (!response.ok) {
        setApiUnavailable(true);
        return;
      }
      const payload = await response.json();
      const nextDocuments = (payload.documents ?? []) as ClinicalDocument[];
      setDocuments((current) => {
        const seen = new Set(current.map((document) => document.id));
        return [...current, ...nextDocuments.filter((document) => !seen.has(document.id))];
      });
      setDocumentsPagination(payload.pagination ?? null);
    } finally {
      setLoadingMoreDocuments(false);
    }
  }, [
    authorizationHeader,
    canUsePrivateApis,
    clientDemoMode,
    documentsPagination,
    loadingMoreDocuments,
    markSessionExpired,
  ]);

  const retryJob = useCallback(
    async (jobId: string) => {
      setIndexingActionId(jobId);
      try {
        const response = await fetch(`/api/ingestion/jobs/${jobId}/retry`, {
          method: "POST",
          headers: authorizationHeader,
        });
        if (response.status === 401) {
          markSessionExpired();
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Job retry could not be started.");
        }
        setActionNotice({
          tone: "success",
          message: "Ingestion job retry queued.",
        });
        await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
      } catch (error) {
        setActionNotice({
          tone: "warning",
          message: error instanceof Error ? error.message : "Job retry could not be started.",
        });
      } finally {
        setIndexingActionId(null);
      }
    },
    [authorizationHeader, markSessionExpired, refresh],
  );

  const reindexDocument = useCallback(
    async (documentId: string, mode: "full" | "enrichment" = "full") => {
      setIndexingActionId(documentId);
      try {
        const response = await fetch(`/api/documents/${documentId}/reindex`, {
          method: "POST",
          headers: {
            ...authorizationHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode }),
        });
        if (response.status === 401) {
          markSessionExpired();
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : mode === "enrichment"
                ? "Document enrichment could not be started."
                : "Document reindex could not be started.",
          );
        }
        setActionNotice({
          tone: "success",
          message: mode === "enrichment" ? "Document enrichment refreshed." : "Document reindex queued.",
        });
        await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
      } catch (error) {
        setActionNotice({
          tone: "warning",
          message: error instanceof Error ? error.message : "Document reindex could not be started.",
        });
      } finally {
        setIndexingActionId(null);
      }
    },
    [authorizationHeader, markSessionExpired, refresh],
  );
  const enrichDocument = useCallback(
    (documentId: string) => reindexDocument(documentId, "enrichment"),
    [reindexDocument],
  );

  const handleDocumentRenamed = useCallback((updatedDocument: ClinicalDocument) => {
    setDocuments((current) =>
      current.map((document) => (document.id === updatedDocument.id ? { ...document, ...updatedDocument } : document)),
    );
    setSources((current) =>
      current.map((source) =>
        source.document_id === updatedDocument.id ? { ...source, title: updatedDocument.title } : source,
      ),
    );
    setDocumentMatches((current) =>
      current.map((document) =>
        document.document_id === updatedDocument.id ? { ...document, title: updatedDocument.title } : document,
      ),
    );
    setAnswer((current) => applyRenamedDocumentToAnswer(current, updatedDocument));
  }, []);

  const handleDocumentLabelsUpdated = useCallback((documentId: string, labels: DocumentLabel[]) => {
    setDocuments((current) =>
      current.map((document) => (document.id === documentId ? { ...document, labels } : document)),
    );
    setDocumentMatches((current) =>
      current.map((document) => (document.document_id === documentId ? { ...document, labels } : document)),
    );
    setSources((current) =>
      current.map((source) => (source.document_id === documentId ? { ...source, document_labels: labels } : source)),
    );
  }, []);

  const handleDocumentLabelPatched = useCallback((documentId: string, label: DocumentLabel) => {
    function mergeLabel(labels: DocumentLabel[] | null | undefined) {
      const current = labels ?? [];
      let replaced = false;
      const next = current.map((item) => {
        if (item.id !== label.id) return item;
        replaced = true;
        return label;
      });
      return replaced ? next : [label, ...next];
    }

    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, labels: mergeLabel(document.labels) } : document,
      ),
    );
    setDocumentMatches((current) =>
      current.map((document) =>
        document.document_id === documentId ? { ...document, labels: mergeLabel(document.labels) } : document,
      ),
    );
    setSources((current) =>
      current.map((source) =>
        source.document_id === documentId ? { ...source, document_labels: mergeLabel(source.document_labels) } : source,
      ),
    );
  }, []);

  const mutateDocumentLabel = useCallback(
    async (documentId: string, method: "POST" | "PATCH", body: LabelReviewMutationBody) => {
      if (!canUsePrivateApis) return false;
      try {
        const response = await fetch(`/api/documents/${documentId}/labels`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(clientDemoMode ? {} : authorizationHeader),
          },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          markSessionExpired();
          return false;
        }
        if (!response.ok) {
          setActionNotice({
            tone: "warning",
            message: typeof payload?.error === "string" ? payload.error : "Label update failed.",
          });
          return false;
        }
        if (Array.isArray(payload.labels)) {
          handleDocumentLabelsUpdated(documentId, payload.labels as DocumentLabel[]);
        } else if (payload.label && typeof payload.label === "object") {
          handleDocumentLabelPatched(documentId, payload.label as DocumentLabel);
        }
        setActionNotice({ tone: "success", message: "Document label review updated." });
        return true;
      } catch {
        setActionNotice({ tone: "warning", message: "Label update failed." });
        return false;
      }
    },
    [
      authorizationHeader,
      canUsePrivateApis,
      clientDemoMode,
      handleDocumentLabelPatched,
      handleDocumentLabelsUpdated,
      markSessionExpired,
    ],
  );

  const handleDocumentDeleted = useCallback(
    (result: DocumentDeleteResult) => {
      setDocuments((current) => current.filter((document) => document.id !== result.documentId));
      setSelectedDocumentIds((current) => current.filter((documentId) => documentId !== result.documentId));
      setSources((current) => current.filter((source) => source.document_id !== result.documentId));
      setDocumentMatches((current) => current.filter((document) => document.document_id !== result.documentId));
      setAnswer((current) => (answerReferencesDocument(current, result.documentId) ? null : current));
      if (result.storageWarnings.length > 0) {
        setActionNotice({
          tone: "warning",
          message: `Document deleted. Storage cleanup needs review: ${result.storageWarnings.join("; ")}`,
        });
      } else {
        setActionNotice({ tone: "success", message: "Document deleted." });
      }
      void refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false }).catch(
        () => undefined,
      );
    },
    [refresh],
  );

  useEffect(() => {
    if (actionNotice?.tone !== "success") return undefined;
    const timer = window.setTimeout(() => setActionNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const activeIndexingWork = useMemo(
    () => hasActiveIndexingWork(documents, jobs, batches, indexingActive),
    [documents, jobs, batches, indexingActive],
  );
  const needsSetupRecheck = useMemo(() => setupNeedsSlowRecheck(setupChecks), [setupChecks]);

  useEffect(() => {
    refresh({ includeSetup: true, includeDashboardData: true, includeDocumentMeta: true }).catch(() => undefined);
  }, [authStatus, authorizationHeader, clientDemoMode, refresh]);

  useEffect(() => {
    const hasScheduledWork = activeIndexingWork || needsSetupRecheck;
    if (!shouldPollForUpdates(demoMode, document.visibilityState, hasScheduledWork)) {
      return;
    }

    const delay = activeIndexingWork ? (nextRefreshDelayMs ?? activeIndexingPollFallbackMs) : setupRecheckPollMs;
    const timeout = window.setTimeout(() => {
      if (!shouldPollForUpdates(demoMode, document.visibilityState, hasScheduledWork)) {
        return;
      }

      refresh({
        includeSetup: !activeIndexingWork,
        includeDashboardData: activeIndexingWork,
        includeDocumentMeta: false,
      }).catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [activeIndexingWork, demoMode, needsSetupRecheck, nextRefreshDelayMs, refresh]);

  useEffect(() => {
    const refreshVisibleDashboard = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      refresh({
        includeSetup: true,
        includeDashboardData: activeIndexingWork || canUsePrivateApis || clientDemoMode,
        includeDocumentMeta: false,
      }).catch(() => undefined);
    };

    document.addEventListener("visibilitychange", refreshVisibleDashboard);
    window.addEventListener("focus", refreshVisibleDashboard);
    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
      window.removeEventListener("focus", refreshVisibleDashboard);
    };
  }, [activeIndexingWork, canUsePrivateApis, clientDemoMode, refresh]);

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

  useEffect(() => {
    if (!focusSearch) return undefined;
    focusComposerInput();
    const timeout = window.setTimeout(focusComposerInput, 500);
    return () => window.clearTimeout(timeout);
  }, [focusSearch]);

  useEffect(() => {
    const searchParamString = searchParams.toString();
    if (lastSyncedSearchParamsRef.current === searchParamString) return;
    lastSyncedSearchParamsRef.current = searchParamString;
    if (searchParams.get("run") === "1") return;

    const mode = searchParams.get("mode");
    if (!isAppModeId(mode) || !isAppModeVisible(mode)) return;

    const nextQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
    const shouldFocusComposer = searchParams.get("focus") === "1";
    const hasUrlQuery = searchParams.has("q") || searchParams.has("query");
    const frame = window.requestAnimationFrame(() => {
      if (mode === "differentials") clearDifferentialModeResultState();
      setSearchMode(mode);
      if (hasUrlQuery) setQuery(nextQuery);
      setModeSearchSubmitted(false);
      setLoading(false);
      setError(null);
      setAnswerProgress(null);
      if (shouldFocusComposer) focusComposerInput();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchParams]);

  useEffect(() => {
    if (urlSearchBootstrappedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const searchText = params.get("q")?.trim();
    const shouldFocusComposer = params.get("focus") === "1";
    if (!isAppModeId(mode) || !isAppModeVisible(mode)) return;
    urlSearchBootstrappedRef.current = true;
    const targetMode = mode;
    const frame = window.requestAnimationFrame(() => {
      if (targetMode === "differentials") clearDifferentialModeResultState();
      setSearchMode(targetMode);
      if (searchText) setQuery(searchText);
      if (shouldFocusComposer) focusComposerInput();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (urlDocumentSearchBootstrappedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const searchText = params.get("q")?.trim();
    if (!searchText || !isAppModeId(mode) || !isAppModeVisible(mode)) return;
    if (mode === "prescribing") return;
    const modeSearch = appModeSearchConfig(mode);
    const shouldRun =
      params.get("run") === "1" ||
      modeSearch.kind === "documents" ||
      modeSearch.kind === "favourites" ||
      modeSearch.kind === "differentials";
    if (!shouldRun) return;
    const isRegistryOnlyMode = mode === "services" || mode === "forms";
    if (modeSearch.kind !== "tools" && modeSearch.kind !== "favourites" && !isRegistryOnlyMode && !canRunSearch) return;
    urlDocumentSearchBootstrappedRef.current = true;
    void executeSearch(searchText, mode, scopeFilters);
    // URL search intentionally runs once when the selected mode can execute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRunSearch]);

  useEffect(() => {
    const updateHash = () => {
      const nextHash = normalizeNavigationHash(window.location.hash || "#search");
      window.requestAnimationFrame(() => navigateMobileSection(nextHash, { updateHistory: false }));
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (navSyncLockRef.current !== null) {
        window.clearTimeout(navSyncLockRef.current);
      }
    };
  }, []);

  function searchNetworkFailure(label: string) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const localOrigin = typeof window !== "undefined" ? window.location.origin : "the local Clinical KB server";
    return makeSearchError(
      offline
        ? `${label} could not run because the browser is offline.`
        : `${label} could not reach Clinical KB at ${localOrigin}. The local server may still be starting or restarting; retry shortly or run npm run ensure.`,
      undefined,
      true,
    );
  }

  async function requestSourceLibrarySearch(
    queryText: string,
    mode: SourceLibrarySearchMode = "documents",
    filtersOverride?: SearchScopeFilters,
    queryModeOverride: ClinicalQueryMode = requestQueryMode,
  ) {
    const searchLabel = mode === "differentials" ? "Differentials search" : "Document search";
    let response: Response;
    try {
      response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({
          query: queryText,
          mode,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          filters: compactScopeFilters(filtersOverride ?? scopeFilters),
          queryMode: queryModeOverride,
          documentLimit: 30,
          topK: 20,
        }),
      });
    } catch {
      throw searchNetworkFailure(searchLabel);
    }

    if (response.status === 401) {
      markSessionExpired();
      throw makeSearchError("Search request was not authorized by the server.", 401, false);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : `${searchLabel} failed`;
      throw makeSearchError(message, response.status, isRetryableStatus(response.status));
    }
    const payload = await response.json();
    if (payload.demoMode) setDemoMode(true);

    return {
      kind: "documents" as const,
      query: queryText,
      sources: (payload.results ?? []) as SearchResult[],
      documentMatches: (payload.documentMatches ?? []) as DocumentMatch[],
      relevance: payload.relevance as EvidenceRelevance | undefined,
      facets: payload.facets as SearchFacets | undefined,
      scope: payload.scope as SearchScopeSummary | undefined,
      sourceGovernanceWarnings: payload.sourceGovernanceWarnings as SourceGovernanceWarning[] | undefined,
      demoMode: payload.demoMode,
    };
  }

  async function requestAnswer(
    queryText: string,
    filtersOverride: SearchScopeFilters = scopeFilters,
    queryModeOverride: ClinicalQueryMode = requestQueryMode,
    onProgress: (message: string) => void = setAnswerProgress,
  ) {
    let response: Response;
    try {
      response = await fetch("/api/answer/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({
          query: queryText,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          filters: compactScopeFilters(filtersOverride),
          queryMode: queryModeOverride,
        }),
      });
    } catch {
      throw searchNetworkFailure("Answer search");
    }

    if (response.status === 401) {
      markSessionExpired();
      throw makeSearchError("Search request was not authorized by the server.", 401, false);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Answer generation failed";
      throw makeSearchError(message, response.status, isRetryableStatus(response.status));
    }

    const payload = await readAnswerStream(response, onProgress);
    return {
      kind: "answer" as const,
      query: queryText,
      payload,
    };
  }

  async function runWithRetries<T>(
    operation: () => Promise<T>,
    onProgress: (message: string) => void = setAnswerProgress,
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= searchRetryCount; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt >= searchRetryCount) break;

        const message = progressForRetry(attempt + 1);
        onProgress(message);
        await sleep(searchRetryDelaysMs[attempt] ?? searchRetryDelaysMs[searchRetryDelaysMs.length - 1]);
      }
    }
    throw lastError;
  }

  function resultUsable(payload: SearchResultModePayload) {
    if (payload.kind === "documents") {
      return payload.sources.length > 0 || payload.documentMatches.length > 0;
    }
    return answerPayloadIsUsable(payload.payload);
  }

  // Audit M10: monotonically increasing token identifying the latest search.
  // Concurrent searches (URL-bootstrap auto-search racing a user submit) can
  // resolve out of order; only the latest request may commit answer/sources/
  // error/loading state, or a stale response would display one query's answer
  // under another query's composer text.
  const searchRequestSeqRef = useRef(0);

  function applySearchResult(payload: SearchResultModePayload) {
    if (payload.kind === "documents") {
      setDocumentMatches(payload.documentMatches);
      setSources(payload.sources);
      setSearchRelevance(payload.relevance ?? null);
      setSearchFacets(payload.facets ?? null);
      setSearchScope(payload.scope ?? null);
      setSourceGovernanceWarnings((payload.sourceGovernanceWarnings ?? []) as SourceGovernanceWarning[]);
      return;
    }

    const answerData = payload.payload;
    setAnswer(answerData);
    setSources(answerData.sources ?? []);
    setSearchRelevance(answerData.relevance ?? answerData.smartPanel?.relevance ?? null);
    setSearchScope(answerData.scope ?? null);
    setSourceGovernanceWarnings((answerData.sourceGovernanceWarnings ?? []) as SourceGovernanceWarning[]);
    setSearchFacets(null);
    setDocumentMatches(
      answerData.relatedDocuments?.map((document) => ({
        document_id: document.document_id,
        title: document.title,
        file_name: document.file_name,
        labels: document.labels,
        summarySnippet: document.summary,
        bestPages: document.best_pages,
        bestChunkIds: document.best_chunk_ids,
        imageCount: document.image_count,
        tableCount: document.table_count ?? 0,
        matchReason: document.match_reason,
        score: document.score,
      })) ?? [],
    );
    if (answerData.demoMode) setDemoMode(true);
  }

  async function executeSearch(searchText: string, targetMode: AppModeId = searchMode, filtersOverride = scopeFilters) {
    const trimmedQuery = searchText.trim();
    if (!trimmedQuery) return;
    const modeSearch = appModeSearchConfig(targetMode);
    const targetQueryMode = appModeQueryMode(targetMode, queryMode);
    const isDifferentialsMode = modeSearch.resultKind === "differentials";
    // Note: no automatic mode-default label scope for Services/Forms. Applying
    // one on every search routed resolveSearchScope's label path over the whole
    // library, whose single `document_labels.in(<all ids>)` request produces an
    // over-long PostgREST URL that fails on large corpora. Corpus search runs
    // unscoped (like Documents); users opt into label filters explicitly.
    const requestId = ++searchRequestSeqRef.current;

    setSearchMode(targetMode);
    setQuery(trimmedQuery);
    if (modeSearch.kind !== "tools") setModeSearchSubmitted(true);
    if (isDifferentialsMode) clearDifferentialModeResultState();

    if (modeSearch.kind === "tools") {
      setLoading(false);
      setAnswerProgress(null);
      setError(null);
      rememberRecentQuery(trimmedQuery);
      setActionNotice({ tone: "success", message: "Tools filtered from the composer." });
      return;
    }
    if (modeSearch.kind === "favourites") {
      setLoading(false);
      setAnswerProgress(null);
      setError(null);
      rememberRecentQuery(trimmedQuery);
      setActionNotice({ tone: "success", message: "Favourites filtered from the composer." });
      return;
    }
    if (modeSearch.kind === "services" || targetMode === "forms") {
      setAnswer(null);
      setSources([]);
      setDocumentMatches([]);
      setSearchRelevance(null);
      setSearchFacets(null);
      setSearchScope(null);
      setSourceGovernanceWarnings([]);
      setAnswerProgress(null);
      setLoading(false);
      setError(null);
      rememberRecentQuery(trimmedQuery);
      window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
      return;
    }
    if (!canRunSearch) {
      setError(errorCopy.searchSetupNotReady);
      return;
    }
    // M10 (diff-review hardening): progress updates emitted by this request's
    // in-flight machinery (retry messages, keyword fallback, stream progress)
    // must also be discarded once a newer search takes over, or a slow stale
    // request repaints the progress banner under the newer query.
    const onProgress = (message: string | null) => {
      if (requestId === searchRequestSeqRef.current) setAnswerProgress(message);
    };
    setLoading(true);
    setError(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    onProgress(modeSearch.progressLabel);
    rememberRecentQuery(trimmedQuery);

    const fallbackQuery = keywordQueryFromNaturalLanguage(trimmedQuery);
    const queryPlan =
      fallbackQuery && fallbackQuery !== trimmedQuery
        ? [
            { query: trimmedQuery, isKeyword: false },
            { query: fallbackQuery, isKeyword: true },
          ]
        : [{ query: trimmedQuery, isKeyword: false }];

    try {
      let successfulPayload: SearchResultModePayload | null = null;
      let lastError: SearchError | null = null;

      for (const entry of queryPlan) {
        if (entry.isKeyword) onProgress("Trying keyword-based search...");

        try {
          const payload =
            modeSearch.kind === "documents" || modeSearch.kind === "differentials"
              ? await runWithRetries(
                  () => requestSourceLibrarySearch(entry.query, modeSearch.kind, filtersOverride, targetQueryMode),
                  onProgress,
                )
              : await runWithRetries(
                  () => requestAnswer(entry.query, filtersOverride, targetQueryMode, onProgress),
                  onProgress,
                );

          if (!resultUsable(payload)) {
            lastError = makeSearchError("No usable results were found.", 404, false);
            if (!entry.isKeyword) {
              continue;
            }
            break;
          }

          successfulPayload = payload;
          break;
        } catch (requestError) {
          lastError = requestError as SearchError;
          if (queryPlan.length > 1 && !entry.isKeyword) {
            continue;
          }
          throw requestError;
        }
      }

      if (!successfulPayload) {
        if (lastError) throw lastError;
        throw new Error("Search did not return usable results.");
      }

      // M10: discard a stale response — a newer search owns the UI state.
      if (requestId === searchRequestSeqRef.current) applySearchResult(successfulPayload);
    } catch (requestError) {
      if (requestId === searchRequestSeqRef.current) {
        setError(requestError instanceof Error ? requestError.message : "Search failed");
      }
    } finally {
      if (requestId === searchRequestSeqRef.current) {
        setLoading(false);
        setAnswerProgress(null);
      }
    }
  }

  function setMedicationSearchQuery(searchText: string, updateUrl = true) {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) return;
    setSearchMode("prescribing");
    setQuery(trimmedSearchText);
    setModeSearchSubmitted(true);
    setLoading(false);
    setError(null);
    setAnswerProgress(null);
    rememberRecentQuery(trimmedSearchText);
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    if (updateUrl) router.replace(appModeHomeHref("prescribing", { query: trimmedSearchText }));
  }

  async function ask() {
    if (searchMode === "prescribing") {
      setMedicationSearchQuery(query);
      return;
    }
    if (searchMode === "documents") {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return;
      rememberRecentQuery(trimmedQuery);
      const params = new URLSearchParams({ mode: "documents", q: trimmedQuery });
      router.push(`/mockups/document-search-command?${params.toString()}`);
      return;
    }
    await executeSearch(query, searchMode, scopeFilters);
  }

  useEffect(() => {
    const trimmedQuery = query.trim();
    const canAutoRunMode = searchMode === "prescribing" || canRunSearch;
    if (!autoRunSearch || !trimmedQuery || !canAutoRunMode || loading) return;
    const signature = `${searchMode}:${trimmedQuery}`;
    if (autoRunSearchSignatureRef.current === signature) return;
    autoRunSearchSignatureRef.current = signature;
    void ask();
    // The signature ref gates this URL-triggered run so it only submits once per mode/query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunSearch, canRunSearch, loading, query, searchMode]);

  function pickRecentQuery(recentQuery: string) {
    if (searchMode === "prescribing") {
      setMedicationSearchQuery(recentQuery);
      return;
    }
    setQuery(recentQuery);
  }

  async function submitAnswerFeedback(feedbackType: AnswerFeedbackType) {
    if (!answer || pendingFeedback) return;
    if (clientDemoMode) {
      setActionNotice({ tone: "warning", message: "Answer review is available after signing in to a real library." });
      return;
    }

    setPendingFeedback(feedbackType);
    try {
      const sourceChunkIds = Array.from(new Set(sources.map((source) => source.id).filter(Boolean)));
      const citedChunkIds = Array.from(new Set(answer.citations.map((citation) => citation.chunk_id).filter(Boolean)));
      const sourceFiles = Array.from(
        new Set([
          ...sources.map((source) => source.file_name).filter(Boolean),
          ...answer.citations.map((citation) => citation.file_name).filter(Boolean),
        ]),
      );
      const response = await fetch("/api/eval-cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({
          query,
          feedbackType,
          rating: feedbackType === "verified" ? "good" : "needs_fixing",
          answer: answer.answer,
          queryMode,
          queryClass: answer.queryClass,
          filters: compactScopeFilters(scopeFilters),
          sourceChunkIds,
          citedChunkIds,
          sourceFiles,
          sourceGovernanceWarnings: sourceGovernanceWarnings.map((warning) => warning.message),
          unverifiedNumericTokens: answer.unverifiedNumericTokens ?? [],
        }),
      });

      if (response.status === 401) {
        markSessionExpired();
        setActionNotice({ tone: "warning", message: "Sign in again before saving answer review." });
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload.error === "string" ? payload.error : "Answer review could not be saved.");
      }
      setActionNotice({
        tone: "success",
        message:
          feedbackType === "verified"
            ? "Verified answer saved for eval coverage."
            : "Answer issue saved for eval coverage.",
      });
    } catch (feedbackError) {
      setActionNotice({
        tone: "warning",
        message: feedbackError instanceof Error ? feedbackError.message : "Answer review could not be saved.",
      });
    } finally {
      setPendingFeedback(null);
    }
  }

  function toggleDocumentScope(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId],
    );
  }

  function scopeOnlyDocument(documentId: string) {
    setSelectedDocumentIds([documentId]);
  }

  function answerFromDocument(documentId: string) {
    setSelectedDocumentIds([documentId]);
    setSearchMode("answer");
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function updateDocumentSearchUrl(searchText: string, mode: AppModeId = "documents") {
    window.history.replaceState(null, "", appModeHomeHref(mode, { query: searchText }));
  }

  async function runDocumentSearchShortcut(
    searchText: string,
    filtersOverride = scopeFilters,
    updateUrl = true,
    targetMode: AppModeId = "documents",
  ) {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) return;
    if (!canRunSearch) {
      setError(errorCopy.searchSetupNotReady);
      return;
    }

    setQuery(trimmedSearchText);
    setSearchMode(targetMode);
    setModeSearchSubmitted(true);
    setLoading(true);
    setError(null);
    const targetModeSearch = appModeSearchConfig(targetMode);
    const sourceLibraryMode = appModeSourceLibrarySearchMode(targetMode);
    setAnswerProgress(targetModeSearch.progressLabel);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    rememberRecentQuery(trimmedSearchText);
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    if (updateUrl) updateDocumentSearchUrl(trimmedSearchText, targetMode);

    try {
      const shortcutQueryMode = appModeQueryMode(targetMode, queryMode);
      const payload = await runWithRetries(() =>
        requestSourceLibrarySearch(trimmedSearchText, sourceLibraryMode, filtersOverride, shortcutQueryMode),
      );
      applySearchResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Document search failed");
    } finally {
      setLoading(false);
      setAnswerProgress(null);
    }
  }

  function handleTagSearch(tag: SmartDocumentTag | SmartDocumentTagFacet) {
    const searchText = tag.searchText || tag.label;
    const nextFilters: SearchScopeFilters = { ...scopeFilters };
    if (tag.group === "Site") nextFilters.sites = [searchText];
    if (tag.group === "Medication") nextFilters.medications = [tag.searchText || tag.label];
    if (tag.group === "Document type") nextFilters.documentTypes = [tag.searchText || tag.label];
    if (tag.group === "Topic") nextFilters.topics = [tag.searchText || tag.label];
    if (tag.group === "Service") nextFilters.services = [searchText];
    if (tag.group === "Setting") nextFilters.settings = [searchText];
    if (tag.group === "Population") nextFilters.populations = [searchText];
    if (tag.group === "Risk") nextFilters.risks = [searchText];
    if (tag.group === "Workflow") nextFilters.workflows = [searchText];
    if (tag.group === "Clinical action") nextFilters.clinicalActions = [searchText];
    if (tag.group === "Care phase") nextFilters.carePhases = [searchText];
    if (tag.group === "Document intent") nextFilters.documentIntents = [searchText];
    if (tag.group === "Content feature") nextFilters.contentFeatures = [searchText];
    setScopeFilters(nextFilters);
    const targetMode = appModeCanUseSourceLibraryShortcut(searchMode) ? searchMode : "documents";
    void runDocumentSearchShortcut(searchText, nextFilters, true, targetMode);
  }

  async function bulkReindexSelected(mode: "enrichment" | "full" | "retry_failed") {
    if (!selectedDocumentIds.length) return;
    setBulkActionBusy(true);
    setBulkActionStatus(null);
    try {
      const response = await fetch("/api/documents/bulk/reindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds, mode }),
      });
      if (response.status === 401) {
        markSessionExpired();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || errorCopy.bulkReindexFailed);
      setBulkActionStatus(
        `${payload.results?.filter((result: { ok: boolean }) => result.ok).length ?? 0} selected documents updated.`,
      );
      await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
    } catch (error) {
      setBulkActionStatus(error instanceof Error ? error.message : errorCopy.bulkReindexFailed);
    } finally {
      setBulkActionBusy(false);
    }
  }

  async function bulkAssignCollection(collection: string) {
    if (!selectedDocumentIds.length || !collection.trim()) return;
    await bulkUpdateMetadata({ collection: collection.trim() });
  }

  async function bulkUpdateMetadata(metadata: Record<string, unknown>) {
    if (!selectedDocumentIds.length || Object.keys(metadata).length === 0) return;
    setBulkActionBusy(true);
    setBulkActionStatus(null);
    try {
      const response = await fetch("/api/documents/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeader,
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds, metadata }),
      });
      if (response.status === 401) {
        markSessionExpired();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || errorCopy.bulkMetadataUpdateFailed);
      setBulkActionStatus(`${payload.updatedCount ?? 0} selected documents updated.`);
      await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
    } catch (error) {
      setBulkActionStatus(error instanceof Error ? error.message : errorCopy.bulkMetadataUpdateFailed);
    } finally {
      setBulkActionBusy(false);
    }
  }

  function selectSearchMode(mode: AppModeId) {
    if (mode === "differentials") clearDifferentialModeResultState();
    setQuery("");
    if (mode === "answer") {
      setAnswer(null);
      setSources([]);
    }
    setModeSearchSubmitted(false);
    setLoading(false);
    setError(null);
    setAnswerProgress(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setDocumentMatches([]);
    setSearchMode(mode);
    router.push(appModeHomeHref(mode));
  }

  function focusComposerInput() {
    window.requestAnimationFrame(() => {
      composerInputRef.current?.focus({ preventScroll: true });
      window.setTimeout(() => composerInputRef.current?.focus({ preventScroll: true }), 150);
    });
  }

  function startNewChat() {
    const href = appModeHomeHref("answer", { focus: true });
    setQuery("");
    setModeSearchSubmitted(false);
    setSearchMode("answer");
    setQueryMode("auto");
    setSelectedDocumentIds([]);
    setScopeFilters({});
    setAnswer(null);
    setSources([]);
    setDocumentMatches([]);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setError(null);
    setAnswerProgress(null);
    setAnswerViewMode("high_yield");
    router.replace(href);
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
    focusComposerInput();
  }

  function openDocumentsDrawer(mode: DocumentDrawerMode) {
    closeDashboardTransientSurfaces("documents");
    setSearchMode("documents");
    setDocumentDrawerStatusFilter("indexed");
    setDocumentsDrawerMode(mode);
    setDocumentsDrawerOpen(true);
    if (window.matchMedia("(min-width: 1024px)").matches) {
      window.requestAnimationFrame(() => {
        document.getElementById("dashboard-documents-drawer")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }

  function openRecentDocuments() {
    openDocumentsDrawer("recent");
  }

  function openSourceLibrary() {
    openDocumentsDrawer("library");
  }

  function openSourcePdfBrowser() {
    openDocumentsDrawer("source");
  }

  function openUploadDrawer() {
    if (!canUsePrivateApis) {
      openDocumentsDrawer("library");
      setActionNotice({
        tone: "warning",
        message: "Upload and indexing tools are admin-only. Use the source library to open indexed documents.",
      });
      return;
    }
    closeDashboardTransientSurfaces("upload");
    setSearchMode("documents");
    setDocumentsDrawerMode("admin");
    setUploadDrawerOpen(true);
    window.requestAnimationFrame(() => {
      const drawer = document.getElementById("dashboard-upload-drawer") as HTMLDetailsElement | null;
      drawer?.scrollIntoView({ block: "start", behavior: "smooth" });
      if (drawer && !drawer.open) {
        drawer.querySelector<HTMLElement>("summary")?.click();
      }
    });
  }

  function openEvidenceDrawer() {
    closeDashboardTransientSurfaces();
    const reviewTrigger = document.getElementById("answer-evidence-drawer-mobile-trigger") as HTMLButtonElement | null;
    if (reviewTrigger) {
      reviewTrigger.scrollIntoView({ block: "center", behavior: "smooth" });
      reviewTrigger.click();
      return;
    }

    const drawer = document.getElementById("answer-evidence-drawer") as HTMLDetailsElement | null;
    if (!drawer) {
      setActionNotice({
        tone: "warning",
        message: "Evidence appears after a source-backed answer is generated.",
      });
      return;
    }
    drawer.scrollIntoView({ block: "start", behavior: "smooth" });
    if (!drawer.open) {
      drawer.querySelector<HTMLElement>("summary")?.click();
    }
  }

  function navigateMobileSection(href: string, options: { updateHistory?: boolean } = {}) {
    const shouldUpdateHistory = options.updateHistory ?? true;
    const main = mainRef.current;
    if (!main) return;

    if (navSyncLockRef.current !== null) {
      window.clearTimeout(navSyncLockRef.current);
    }

    if (href === "#search") {
      setActiveHash(href);
      main.scrollTo({ top: 0, behavior: "auto" });
      if (shouldUpdateHistory) window.history.replaceState(null, "", href);
      navSyncLockRef.current = window.setTimeout(() => {
        navSyncLockRef.current = null;
      }, 350);
      return;
    }

    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    setActiveHash(href);
    const mainTop = main.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    main.scrollTo({
      top: main.scrollTop + targetTop - mainTop - 8,
      behavior: "auto",
    });
    if (shouldUpdateHistory) window.history.replaceState(null, "", href);
    navSyncLockRef.current = window.setTimeout(() => {
      navSyncLockRef.current = null;
    }, 350);
  }

  function syncActiveSectionFromScroll() {
    const main = mainRef.current;
    if (!main) return;
    if (main.scrollLeft !== 0) main.scrollLeft = 0;
    if (navSyncLockRef.current !== null) return;

    if (main.scrollTop < 120) {
      setActiveHash((current) => (current === "#search" ? current : "#search"));
      return;
    }

    const mainTop = main.getBoundingClientRect().top;
    const marker = mainTop + 96;
    const sections = ["#quotes", "#images", "#sources"];
    const current =
      sections
        .map((section) => {
          const target = document.querySelector<HTMLElement>(section);
          if (!target) return null;
          const rect = target.getBoundingClientRect();
          if (rect.top > marker + 220) return null;
          return { section, distance: Math.abs(rect.top - marker) };
        })
        .filter((item): item is { section: string; distance: number } => Boolean(item))
        .sort((a, b) => a.distance - b.distance)[0]?.section ?? "#search";
    setActiveHash((active) => (active === current ? active : current));
  }

  function scheduleActiveSectionSync() {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      syncActiveSectionFromScroll();
    });
  }

  async function copyText(action: string, text: string) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        copied = false;
      }
    }
    if (!copied) {
      setError(errorCopy.clipboardCopyFailed);
      return;
    }
    setCopiedAction(action);
    window.setTimeout(() => setCopiedAction((current) => (current === action ? null : current)), 1800);
  }

  const answerRenderModel = useMemo(
    () => (answer ? buildAnswerRenderModel(answer, { sources, includeDebugReasons: true }) : null),
    [answer, sources],
  );
  const visualEvidence = useMemo(() => answerRenderModel?.visualEvidence ?? [], [answerRenderModel]);
  const relatedDocuments = useMemo(() => answerRenderModel?.relatedDocuments ?? [], [answerRenderModel]);
  const currentRelevance = answer?.relevance ?? answer?.smartPanel?.relevance ?? searchRelevance;
  const weakEvidence = answerRenderModel
    ? answerRenderModel.trust === "unsupported" || answerRenderModel.trust === "low"
    : (currentRelevance ? isWeakRelevance(currentRelevance) : answer?.grounded !== true) ||
      answer?.retrievalDiagnostics?.gateStatus === "blocked";
  const safetyFindings = useMemo(() => extractSafetyFindings(answer), [answer]);
  const bestSource = answerRenderModel?.bestSource ?? null;
  const sourceSummary = answer?.evidenceSummary ?? answer?.smartPanel?.evidenceSummary;
  const answerGrounded =
    answer?.grounded === true &&
    answer.confidence !== "unsupported" &&
    currentRelevance?.isSourceBacked !== false &&
    answerRenderModel?.trust !== "unsupported";
  const sourceLookup = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const safeAnswerText = useMemo(() => sanitizeAnswerDisplayText(answer?.answer ?? ""), [answer?.answer]);
  const safeAnswerSections = useMemo(() => {
    return (answer?.answerSections ?? [])
      .map((section) => {
        const heading = sanitizeDisplayText(section.heading, { minLength: 1, minTokens: 1 });
        const body = sanitizeAnswerDisplayText(section.body, { minLength: 8, minTokens: 2 });
        if (!heading || !body) return null;

        const citationSources: SearchResult[] = [];
        const seenCitationIds = new Set<string>();
        for (const id of section.citation_chunk_ids) {
          if (seenCitationIds.has(id)) continue;
          const source = sourceLookup.get(id);
          if (!source) continue;
          seenCitationIds.add(id);
          citationSources.push(source);
        }

        return {
          ...section,
          heading,
          body,
          citationSources,
        };
      })
      .filter((section): section is AnswerSection & { citationSources: SearchResult[] } => section !== null);
  }, [answer?.answerSections, sourceLookup]);
  const answerEvidenceMapRows = useMemo(() => {
    if (!answerRenderModel?.allowedBlocks.includes("evidenceMap")) return [];
    return evidenceMapRowsFromRenderModel(answerRenderModel).slice(0, answerRenderModel.trust === "high" ? 8 : 6);
  }, [answerRenderModel]);

  const showSystemNotice = Boolean(setupWarning && !demoMode);
  const groupedGovernanceWarningCount = useMemo(
    () =>
      groupSourceGovernanceWarnings(frontendSourceGovernanceWarnings(sourceGovernanceWarnings)).reduce(
        (total, warning) => total + warning.count,
        0,
      ),
    [sourceGovernanceWarnings],
  );
  const mobileFabState = useMemo(
    () =>
      buildMobileSectionFabState({
        hasAnswer: Boolean(answer),
        searchMode,
        sourceCount: sources.length,
        quoteCount: answerRenderModel?.quoteCards.length ?? 0,
        weakEvidence,
        governanceWarningCount: groupedGovernanceWarningCount,
      }),
    [answer, answerRenderModel, groupedGovernanceWarningCount, searchMode, sources.length, weakEvidence],
  );
  const bottomNavItems = [
    {
      label: activeModeSearch.statusLabel,
      description:
        activeModeResultKind === "tools"
          ? query.trim()
            ? "Filtered tools"
            : "Browse tools"
          : activeModeResultKind === "favourites"
            ? query.trim()
              ? "Filtered favourites"
              : "Browse favourites"
            : activeModeResultKind === "answer"
              ? answer
                ? weakEvidence
                  ? "Read synthesis carefully"
                  : "Clinical synthesis"
                : activeModeSearch.nextStep
              : documentMatches.length
                ? "Document results"
                : activeModeSearch.readyTitle,
      icon:
        activeModeResultKind === "tools"
          ? Wrench
          : activeModeResultKind === "favourites"
            ? Heart
            : activeModeResultKind === "answer"
              ? Search
              : FileText,
      href: "#search",
      count:
        activeModeResultKind === "tools"
          ? applicationsLauncherItemCount
          : activeModeResultKind === "favourites"
            ? null
            : activeModeResultKind === "documents"
              ? documentMatches.length
              : null,
      empty: activeModeResultKind === "documents" && documentMatches.length === 0,
    },
    {
      label: "Quotes",
      description: answer
        ? answerRenderModel?.quoteCards.length
          ? "Exact source excerpts"
          : "No quotes yet"
        : "No quotes yet",
      icon: Quote,
      href: "#quotes",
      count: answer ? (answerRenderModel?.quoteCards.length ?? 0) : null,
      empty: !answer || (answerRenderModel?.quoteCards.length ?? 0) === 0,
    },
    {
      label: "Images",
      description: answer ? (visualEvidence.length ? "Tables and diagrams" : "No images yet") : "No images yet",
      icon: FileImage,
      href: "#images",
      count: answer ? visualEvidence.length : null,
      empty: !answer || visualEvidence.length === 0,
    },
    {
      label: "Sources",
      description: answer
        ? answerRenderModel?.reviewSources.length
          ? "Passages and documents"
          : "No sources yet"
        : "No sources yet",
      icon: FileText,
      href: "#sources",
      count: answer ? (answerRenderModel?.reviewSources.length ?? 0) : null,
      empty: !answer || (answerRenderModel?.reviewSources.length ?? 0) === 0,
    },
  ] as const;
  const renderSystemNotice = (className?: string) => (
    <UtilityDrawer
      icon={AlertCircle}
      title={demoMode ? "Demo mode" : "Setup required"}
      summary={
        demoMode ? "Synthetic data only; not clinical guidance." : "Configuration is needed before real uploads."
      }
      mobileSummary={demoMode ? "Synthetic data" : "Setup needed"}
      className={className}
    >
      <p className="text-[15px] leading-6 text-[color:var(--warning)]">
        {demoMode
          ? "Demo mode is active with three synthetic indexed documents, citations, source cards, image captions, and document links. Synthetic data only; not clinical guidance."
          : `Configure .env.local and run supabase/schema.sql before uploading or searching. ${setupWarning}`}
      </p>
    </UtilityDrawer>
  );
  const showAuthPanel = !clientDemoMode && !canUsePrivateApis;
  const showDegradedNotice = !isOnline || apiUnavailable;
  const hasMobileBottomSearch = searchMode !== "answer";
  const showDesktopHomeComposer =
    !loading &&
    !error &&
    ((activeModeResultKind === "answer" && !answer && !modeSearchSubmitted) ||
      (searchMode === "documents" &&
        activeModeResultKind === "documents" &&
        documentMatches.length === 0 &&
        !modeSearchSubmitted) ||
      (searchMode === "prescribing" && activeModeResultKind === "documents" && !modeSearchSubmitted) ||
      (activeModeResultKind === "differentials" && !modeSearchSubmitted) ||
      activeModeResultKind === "favourites" ||
      activeModeResultKind === "tools");
  const desktopHomeComposerSlotId = showDesktopHomeComposer ? modeHomeDesktopComposerSlotId : undefined;
  // Favourites and Tools are content-rich hubs: they share the centred hero but
  // stay top-aligned so their lists start in a stable position.
  const centeredModeHome =
    showDesktopHomeComposer && activeModeResultKind !== "tools" && activeModeResultKind !== "favourites";
  const renderDegradedNotice = () => (
    <UtilityDrawer
      icon={!isOnline ? WifiOff : AlertCircle}
      title={!isOnline ? "Offline" : "Service unavailable"}
      summary={
        !isOnline
          ? "Your browser is offline. Existing content may remain visible, but private search and uploads need network access."
          : "The local API did not respond. Check the app server and setup status before retrying."
      }
      mobileSummary={!isOnline ? "Offline" : "API unavailable"}
    >
      <p className="text-[15px] leading-6 text-[color:var(--warning)]">
        {!isOnline
          ? "Reconnect before uploading documents, refreshing source URLs, or generating answers."
          : "The app will preserve the current view. Retry after confirming the local server, Supabase, OpenAI, and worker setup."}
      </p>
    </UtilityDrawer>
  );
  const setupReadyCount = setupChecks.filter((check) => check.status === "ready").length;
  const setupCheckCount = setupChecks.length || fallbackSetupChecks.length;
  const activeUploadWork =
    jobs.filter((job) => job.status === "pending" || job.status === "processing").length +
    batches.filter((batch) => batch.status === "queued" || batch.status === "processing").length;
  const failedUploadWork =
    jobs.filter((job) => job.status === "failed").length + batches.filter((batch) => batch.status === "failed").length;
  const uploadTabs: Array<{
    id: UploadIndexingTab;
    label: string;
    summary: string;
    panelId: string;
    icon: typeof UploadCloud;
  }> = [
    {
      id: "setup",
      label: "Setup",
      summary: `${setupReadyCount}/${setupCheckCount} ready`,
      panelId: "dashboard-setup-section",
      icon: ListChecks,
    },
    {
      id: "upload",
      label: "Upload",
      summary: uploadReadOnlyMode || !canUsePrivateApis ? "Locked" : "Ready",
      panelId: "dashboard-upload-section",
      icon: UploadCloud,
    },
    {
      id: "jobs",
      label: "Jobs",
      summary: activeUploadWork
        ? `${activeUploadWork} active`
        : failedUploadWork
          ? `${failedUploadWork} failed`
          : "Idle",
      panelId: "dashboard-indexing-section",
      icon: RefreshCw,
    },
    {
      id: "quality",
      label: "Quality",
      summary: qualityItems.length ? `${qualityItems.length} review` : "Clear",
      panelId: "dashboard-quality-section",
      icon: ShieldAlert,
    },
  ];
  const handleUploadQueued = () => {
    setUploadMobileTab("jobs");
    void refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
  };
  const documentsDrawerIsAdmin = documentsDrawerMode === "admin" && canUsePrivateApis;
  const documentsDrawerTitle =
    documentsDrawerMode === "recent"
      ? "Recent documents"
      : documentsDrawerMode === "source"
        ? "Source PDFs"
        : documentsDrawerIsAdmin
          ? "Document admin"
          : "Source library";
  const documentsDrawerSummary = dashboardDataLoading
    ? "Loading indexed document status."
    : documentsDrawerMode === "recent"
      ? "Continue reading from recently updated sources."
      : documentsDrawerMode === "source"
        ? "Open original PDF source documents."
        : documentsDrawerIsAdmin
          ? `${indexedDocumentTotal.toLocaleString()} indexed documents available.`
          : "Search and open indexed clinical sources.";
  const documentsDrawerMobileSummary = dashboardDataLoading
    ? "Loading library"
    : documentsDrawerMode === "recent"
      ? "Recent sources"
      : documentsDrawerMode === "source"
        ? "PDF sources"
        : documentsDrawerIsAdmin
          ? "Admin"
          : "Library";
  const DocumentsDrawerIcon =
    documentsDrawerMode === "recent"
      ? Clock3
      : documentsDrawerMode === "source"
        ? ExternalLink
        : documentsDrawerIsAdmin
          ? UploadCloud
          : FolderOpen;
  const drawerGroupTitle = uploadDrawerOpen || documentsDrawerIsAdmin ? "Library and admin" : "Sources";

  return (
    <div
      className={cn(
        appBackdrop,
        "mobile-app-shell flex flex-col overflow-hidden text-[color:var(--text)] lg:grid lg:overflow-hidden",
        sidebarCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[20rem_minmax(0,1fr)]",
      )}
      style={
        {
          "--clinical-sidebar-width": sidebarCollapsed ? "5.25rem" : "20rem",
        } as CSSProperties
      }
    >
      <ClinicalDesktopSidebar
        collapsed={sidebarCollapsed}
        recentQueries={recentQueries}
        identity={sidebarIdentity}
        activeMode={searchMode}
        onCollapsedChange={setSidebarCollapsed}
        onNewChat={startNewChat}
        onPickRecent={pickRecentQuery}
        onOpenGuide={openGuide}
        onOpenSettings={openSettings}
        onOpenAccount={openAccountProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPrefetchApplications={prefetchApplications}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full">
        <MasterSearchHeader
          documents={documents}
          documentTotal={indexedDocumentTotal}
          query={query}
          searchMode={searchMode}
          loading={loading}
          selectedDocumentIds={selectedDocumentIds}
          queryMode={queryMode}
          scopeFilters={scopeFilters}
          realDataReady={canRunSearch}
          onQueryChange={setQuery}
          onSearchModeChange={selectSearchMode}
          onAsk={ask}
          onClearQuery={() => {
            setQuery("");
            setModeSearchSubmitted(false);
          }}
          onClearScope={() => setSelectedDocumentIds([])}
          onQueryModeChange={setQueryMode}
          onScopeFiltersChange={setScopeFilters}
          onToggleScope={toggleDocumentScope}
          onOpenUpload={openUploadDrawer}
          onOpenEvidence={openEvidenceDrawer}
          onOpenRecentDocuments={openRecentDocuments}
          onOpenLibrary={openSourceLibrary}
          onOpenSourcePdf={openSourcePdfBrowser}
          onNewChat={startNewChat}
          onOpenMobileSidebar={() => {
            closeDashboardTransientSurfaces("mobileSidebar");
            setMobileSidebarOpen(true);
          }}
          queryModeOptions={clinicalQueryModeOptions}
          queryInputRef={composerInputRef}
          queryInputAutoFocus={focusSearch}
          mobileSearchPlacement={hasMobileBottomSearch ? "bottom" : "default"}
          desktopHomeComposerSlotId={desktopHomeComposerSlotId}
          heroComposerFromTablet={Boolean(desktopHomeComposerSlotId)}
        />

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          onScroll={scheduleActiveSectionSync}
          className={cn(
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] focus:outline-none",
            searchMode === "answer"
              ? "mb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:mb-24"
              : hasMobileBottomSearch
                ? "mb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:mb-0"
                : "mb-0",
          )}
        >
          <h1 className="sr-only">Clinical Guide</h1>
          <div
            className={cn(
              "mx-auto max-w-7xl space-y-4 overflow-x-hidden px-3 py-4 sm:space-y-5 sm:px-4 sm:py-5 lg:px-8",
              searchMode === "answer"
                ? "pb-32 sm:pb-36 lg:pb-40"
                : hasMobileBottomSearch
                  ? "pb-32 sm:pb-10 lg:pb-12"
                  : "pb-8 sm:pb-10 lg:pb-12",
            )}
          >
            {actionNotice && (
              <div
                role="status"
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border p-3 text-sm font-medium motion-safe:animate-fade-up",
                  actionNotice.tone === "success" ? toneSuccess : toneWarning,
                )}
              >
                <span className="min-w-0">{actionNotice.message}</span>
                <button
                  type="button"
                  onClick={() => setActionNotice(null)}
                  aria-label="Dismiss notification"
                  className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-70 transition hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {showDegradedNotice && renderDegradedNotice()}
            {showAuthPanel && <AuthPanel />}
            {showSystemNotice && answer ? renderSystemNotice("hidden sm:block") : null}

            <section
              className={cn(
                "min-h-[calc(100dvh-11rem)]",
                centeredModeHome || (activeModeResultKind === "answer" && !answer && !loading)
                  ? "grid w-full place-items-center"
                  : activeModeResultKind === "tools" ||
                      activeModeResultKind === "favourites" ||
                      activeModeResultKind === "differentials"
                    ? "mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden"
                    : activeModeResultKind === "documents" || activeModeResultKind === "services"
                      ? "mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden"
                      : "mx-auto w-full max-w-3xl space-y-4 overflow-x-hidden",
              )}
            >
              <h2 data-testid="answer-section-heading" className="sr-only">
                {activeModeSearch.resultHeading}
              </h2>
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-3 text-sm font-medium text-[color:var(--danger)]"
                >
                  <AlertCircle className="mr-2 inline h-4 w-4" />
                  {error}
                </div>
              )}

              {loading && answerProgress && searchMode !== "prescribing" && (
                <div
                  role="status"
                  className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] px-3 text-sm font-medium text-[color:var(--text-heading)]"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[color:var(--primary)]" />
                  <span className="min-w-0 truncate">{answerProgress}</span>
                </div>
              )}

              {activeModeResultKind === "differentials" ? (
                <DifferentialsHome
                  query={query}
                  loading={loading}
                  documentMatches={documentMatches}
                  realDataReady={canRunSearch}
                  authUnavailable={!clientDemoMode && !canUsePrivateApis}
                  apiUnavailable={apiUnavailable}
                  setupWarning={setupWarning}
                  onQueryChange={setQuery}
                  desktopComposerSlotId={desktopHomeComposerSlotId}
                  onSuggestedSearch={(nextQuery) => {
                    setQuery(nextQuery);
                    focusComposerInput();
                  }}
                  onRunSearch={(nextQuery) => {
                    void executeSearch(nextQuery, "differentials", scopeFilters);
                  }}
                  onOpenPresentations={(nextQuery) => {
                    const queryParams = new URLSearchParams();
                    const normalizedQuery = nextQuery.trim();
                    if (normalizedQuery) queryParams.set("q", normalizedQuery);
                    router.push(`/differentials/presentations${queryParams.toString() ? `?${queryParams}` : ""}`);
                  }}
                  onOpenDiagnoses={(nextQuery) => {
                    const queryParams = new URLSearchParams();
                    const normalizedQuery = nextQuery.trim();
                    if (normalizedQuery) queryParams.set("q", normalizedQuery);
                    router.push(`/differentials/diagnoses${queryParams.toString() ? `?${queryParams}` : ""}`);
                  }}
                />
              ) : activeModeResultKind === "tools" ? (
                <ToolsHub
                  query={query}
                  onQueryChange={setQuery}
                  desktopComposerSlotId={desktopHomeComposerSlotId}
                  showDetailPanel={!requestedRun}
                />
              ) : activeModeResultKind === "favourites" ? (
                <FavouritesHub
                  query={query}
                  onClearQuery={() => {
                    setQuery("");
                    setModeSearchSubmitted(false);
                    router.replace(appModeHomeHref("favourites", { focus: true }));
                  }}
                  onAddFavourite={() =>
                    setActionNotice({ tone: "success", message: "Favourite creation is ready to connect." })
                  }
                  desktopComposerSlotId={desktopHomeComposerSlotId}
                />
              ) : activeModeResultKind === "documents" || activeModeResultKind === "services" ? (
                searchMode === "prescribing" ? (
                  <MedicationPrescribingWorkspace
                    query={query}
                    loading={false}
                    realDataReady
                    authUnavailable={false}
                    apiUnavailable={false}
                    setupWarning={null}
                    onSuggestedSearch={setMedicationSearchQuery}
                    showHome={!query.trim() && !modeSearchSubmitted}
                    desktopComposerSlotId={desktopHomeComposerSlotId}
                  />
                ) : (
                  <>
                    <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
                    <DocumentSearchResultsPanel
                      matches={documentMatches}
                      recordMatches={recordSearchMatches}
                      recordMode={recordSearchMode}
                      recordStatus={registryRecords.status}
                      showRecordMatches={searchMode === "services" || searchMode === "forms"}
                      query={query}
                      loading={loading}
                      documentCount={indexedDocumentTotal}
                      recentDocuments={documents}
                      realDataReady={canRunSearch}
                      authUnavailable={!clientDemoMode && !canUsePrivateApis}
                      apiUnavailable={apiUnavailable}
                      setupWarning={setupWarning}
                      facets={searchFacets}
                      onScopeDocument={scopeOnlyDocument}
                      onAnswerFromDocument={answerFromDocument}
                      onOpenRecentDocuments={openRecentDocuments}
                      onOpenLibrary={openSourceLibrary}
                      onOpenSourcePdf={openSourcePdfBrowser}
                      onTagSearch={handleTagSearch}
                      showHome={searchMode === "documents" && !modeSearchSubmitted}
                      desktopComposerSlotId={desktopHomeComposerSlotId}
                    />
                  </>
                )
              ) : loading && !answer ? (
                <AnswerSkeleton />
              ) : answer && answerRenderModel ? (
                stagedDashboardExtraction.answerSurface ? (
                  <StagedAnswerResultSurface
                    answer={answer}
                    query={query}
                    safeAnswerText={safeAnswerText}
                    bestSource={bestSource}
                    sourceGovernanceWarnings={sourceGovernanceWarnings}
                    sourceSummary={sourceSummary}
                    renderModel={answerRenderModel}
                    weakEvidence={weakEvidence}
                    answerViewMode={answerViewMode}
                    answerEvidenceMapRows={answerEvidenceMapRows}
                    onScopeDocument={scopeOnlyDocument}
                    answerGrounded={answerGrounded}
                    sources={answerRenderModel.reviewSources}
                    demoMode={demoMode}
                    safeAnswerSections={safeAnswerSections}
                    safetyFindings={safetyFindings}
                    copiedAnswer={copiedAction === "answer"}
                    pendingFeedback={pendingFeedback}
                    onCopyAnswer={() =>
                      copyText("answer", answerRenderModel.copyText || safeAnswerText || answer.answer)
                    }
                    onSubmitFeedback={submitAnswerFeedback}
                  />
                ) : null
              ) : (
                <AnswerEmptyState
                  onPickSample={setQuery}
                  onSearchDocuments={() => setSearchMode("documents")}
                  onUploadDocument={openUploadDrawer}
                  desktopComposerSlotId={desktopHomeComposerSlotId}
                />
              )}
            </section>

            {showSystemNotice && answer ? renderSystemNotice("sm:hidden") : null}

            {activeModeResultKind === "answer" && answer && (
              <RelatedDocumentsPanel
                documents={relatedDocuments}
                onScopeDocument={scopeOnlyDocument}
                onTagSearch={handleTagSearch}
              />
            )}
            {(documentsDrawerOpen || uploadDrawerOpen) && (
              <section id="sources" className="mx-auto grid w-full max-w-4xl gap-3 scroll-mt-4 sm:scroll-mt-6">
                <DrawerGroupLabel title={drawerGroupTitle} />
                {documentsDrawerOpen ? (
                  <UtilityDrawer
                    id="dashboard-documents-drawer"
                    icon={BookOpen}
                    title={documentsDrawerTitle}
                    summary={documentsDrawerSummary}
                    mobileSummary={documentsDrawerMobileSummary}
                    open={documentsDrawerOpen}
                    onOpenChange={setDocumentsDrawerOpen}
                    sheetBreakpoint="lg"
                    sheetHeaderLeading={
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                        <DocumentsDrawerIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    }
                    sheetTitleAccessory={
                      documentsDrawerIsAdmin ? (
                        <span className="nums hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-2xs font-bold text-[color:var(--text-muted)] sm:inline-flex">
                          {indexedDocumentTotal.toLocaleString()} indexed
                        </span>
                      ) : null
                    }
                    sheetDescription={documentsDrawerSummary}
                    sheetHeaderClassName="bg-[color:var(--surface-raised)] px-4 py-3 sm:px-5 sm:py-4"
                    sheetCloseButtonClassName="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                    sheetContentClassName="max-h-[min(82dvh,40rem)] sm:max-h-[min(88dvh,46rem)] sm:max-w-2xl lg:max-w-3xl"
                    sheetBodyClassName="bg-[color:var(--surface-subtle)] p-3 sm:p-4"
                    sheetChildrenClassName="space-y-3"
                  >
                    {documentsDrawerIsAdmin ? (
                      <LibraryHealthStrip
                        documents={documents}
                        jobs={jobs}
                        batches={batches}
                        checks={setupChecks}
                        loading={dashboardDataLoading}
                        onSelectTarget={openLibraryHealthTarget}
                      />
                    ) : null}
                    <DocumentDrawer
                      documents={documents}
                      pagination={documentsPagination}
                      loadingMoreDocuments={loadingMoreDocuments}
                      mode={documentsDrawerIsAdmin ? "admin" : documentsDrawerMode}
                      selectedDocumentIds={selectedDocumentIds}
                      statusFilter={documentDrawerStatusFilter}
                      onToggleScope={toggleDocumentScope}
                      onLoadMoreDocuments={loadMoreDocuments}
                      onDocumentRenamed={handleDocumentRenamed}
                      onDocumentDeleted={handleDocumentDeleted}
                      onBulkReindex={bulkReindexSelected}
                      onBulkAssignCollection={bulkAssignCollection}
                      onBulkMetadataUpdate={bulkUpdateMetadata}
                      bulkActionStatus={bulkActionStatus}
                      bulkActionBusy={bulkActionBusy}
                      canManageDocuments={canUsePrivateApis}
                      onTagSearch={handleTagSearch}
                      onMutateLabel={mutateDocumentLabel}
                    />
                  </UtilityDrawer>
                ) : null}

                {uploadDrawerOpen ? (
                  <UtilityDrawer
                    id="dashboard-upload-drawer"
                    icon={UploadCloud}
                    title="Upload and indexing"
                    summary="Real uploads require Supabase, OpenAI keys, schema setup, and the worker."
                    mobileSummary="Setup & uploads"
                    open={uploadDrawerOpen}
                    onOpenChange={setUploadDrawerOpen}
                  >
                    <LibraryHealthStrip
                      documents={documents}
                      jobs={jobs}
                      batches={batches}
                      checks={setupChecks}
                      loading={dashboardDataLoading}
                      onSelectTarget={openLibraryHealthTarget}
                    />
                    <div
                      role="tablist"
                      aria-label="Upload and indexing sections"
                      className="grid grid-cols-4 gap-2 lg:hidden"
                    >
                      {uploadTabs.map((tab) => {
                        const active = uploadMobileTab === tab.id;
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls={tab.panelId}
                            onClick={() => setUploadMobileTab(tab.id)}
                            className={cn(
                              "min-h-[56px] rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] active:translate-y-px",
                              active
                                ? "border-[color:var(--primary)] bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--glow-soft)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                            )}
                          >
                            <span className="flex items-center gap-1.5 text-xs font-bold">
                              <Icon className="h-3.5 w-3.5" />
                              {tab.label}
                            </span>
                            <span className="mt-1 block truncate text-[11px] font-semibold opacity-80">
                              {tab.summary}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div
                        id="dashboard-setup-section"
                        role="tabpanel"
                        aria-label="Setup"
                        className={cn(
                          "space-y-3 scroll-mt-4 lg:col-start-1 lg:row-start-1",
                          uploadMobileTab !== "setup" && "hidden lg:block",
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                          Developer setup status
                        </p>
                        <SetupChecklist checks={setupChecks} />
                        {showAuthPanel && <AuthPanel />}
                      </div>
                      <div
                        id="dashboard-upload-section"
                        role="tabpanel"
                        aria-label="Upload"
                        className={cn(
                          "space-y-3 scroll-mt-4 lg:col-start-1 lg:row-start-2",
                          uploadMobileTab !== "upload" && "hidden lg:block",
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                          Clinical upload
                        </p>
                        <UploadPanel
                          onUploaded={handleUploadQueued}
                          demoMode={uploadReadOnlyMode}
                          canUpload={canUsePrivateApis}
                          authorizationHeader={authorizationHeader}
                        />
                      </div>
                      <div
                        id="dashboard-indexing-section"
                        role="tabpanel"
                        aria-label="Jobs"
                        className={cn(
                          "space-y-3 scroll-mt-4 lg:col-start-2 lg:row-span-2 lg:row-start-1",
                          uploadMobileTab !== "jobs" && "hidden lg:block",
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                          Indexing progress
                        </p>
                        <IndexingMonitor
                          jobs={jobs}
                          batches={batches}
                          filter={indexingMonitorFilter}
                          actionId={indexingActionId}
                          onRetry={retryJob}
                          onReindex={reindexDocument}
                          onEnrich={enrichDocument}
                        />
                      </div>
                      <div
                        id="dashboard-quality-section"
                        role="tabpanel"
                        aria-label="Quality"
                        className={cn(
                          "space-y-3 scroll-mt-4 lg:col-span-2 lg:row-start-3",
                          uploadMobileTab !== "quality" && "hidden lg:block",
                        )}
                      >
                        <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                          Ingestion quality console
                        </p>
                        <IngestionQualityConsole
                          items={qualityItems}
                          actionId={indexingActionId}
                          onRetry={retryJob}
                          onReindex={reindexDocument}
                          onEnrich={enrichDocument}
                        />
                      </div>
                    </div>
                  </UtilityDrawer>
                ) : null}
              </section>
            )}

            {(documentsDrawerOpen || uploadDrawerOpen) && <GuideTrigger onOpen={openGuide} />}
          </div>
        </main>

        <MobileSectionFab
          items={bottomNavItems}
          activeHash={activeHash}
          state={mobileFabState}
          hidden
          onNavigate={navigateMobileSection}
        />
        <GuideDialog open={guideOpen} onClose={closeGuide} />
        <SettingsDialog
          open={settingsOpen}
          onClose={closeSettings}
          identity={sidebarIdentity}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSignOut={auth.signOut}
          onOpenGuide={openGuide}
        />
        <AccountSetupDialog open={accountSetupOpen} onClose={closeAccountSetup} />
        <ClinicalMobileSidebar
          open={mobileSidebarOpen}
          recentQueries={recentQueries}
          identity={sidebarIdentity}
          activeMode={searchMode}
          onOpenChange={setMobileSidebarOpen}
          onNewChat={startNewChat}
          onPickRecent={pickRecentQuery}
          onOpenGuide={openGuide}
          onOpenSettings={openSettings}
          onOpenAccount={openAccountProfile}
          theme={theme}
          onToggleTheme={toggleTheme}
          onPrefetchApplications={prefetchApplications}
        />
      </div>
    </div>
  );
}
