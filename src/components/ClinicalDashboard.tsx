"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  Globe2,
  HelpCircle,
  Heart,
  Keyboard,
  Layers,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  LockKeyhole,
  Mail,
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
  Table2,
  Tag,
  Target,
  UploadCloud,
  UserRound,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
import { documentCitationHref, formatCompactCitationLabel, formatCitationLabel } from "@/lib/citations";
import { extractSafetyFindings, formatSafetyFindingLabel } from "@/lib/clinical-safety";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { isLocalNoAuthMode } from "@/lib/env";
import { normalizeSourceMetadata, sourceStatusLabel, validationStatusLabel } from "@/lib/source-metadata";
import {
  appBackdrop,
  answerSurface,
  chatActionRow,
  chatAnswerText,
  chatMicroAction,
  codeText,
  clinicalDivider,
  clinicalNotesRow,
  cn,
  evidenceRow,
  evidenceSurface,
  EmptyState,
  fieldControlPlain,
  fieldControlWithIcon,
  fieldIcon,
  floatingControl,
  iconTilePremium,
  fieldLabel,
  metadataPill,
  panelSubtle,
  primaryControl,
  proseMeasure,
  raisedCard,
  SourceProvenance,
  SourceStatusBadge,
  sourceCard,
  sourceCapsule,
  statusDotMuted,
  statusDotReady,
  statusDotReview,
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
import { AUTH_EMAIL_STORAGE_KEY, useAuthSession } from "@/lib/supabase/client";
import { SafeBoldText } from "@/components/SafeBoldText";
import { Sheet } from "@/components/ui/sheet";
import { AnswerEmptyState, AnswerSkeleton, CopyButton } from "@/components/clinical-dashboard/answer-status";
import { useSidebarCollapsed } from "@/components/clinical-dashboard/use-sidebar-collapsed";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import { StatusBadge, StrengthBadge } from "@/components/clinical-dashboard/badges";
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
  compactSourceSnippet,
  sanitizeAnswerDisplayText,
  sanitizeDisplayText,
} from "@/components/clinical-dashboard/display-text";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { emptyStates, errorCopy } from "@/lib/ui-copy";
import { DifferentialsHome } from "@/components/clinical-dashboard/differentials-home";
import { FavouritesHub } from "@/components/clinical-dashboard/favourites-hub";
import { MedicationPrescribingWorkspace } from "@/components/clinical-dashboard/medication-prescribing-workspace";
import { ApplicationsLauncherWorkspace, applicationsLauncherItemCount } from "@/components/applications-launcher-page";
import {
  DocumentSearchResultsPanel,
  MatchExplanationChips,
  type SearchFacets,
} from "@/components/clinical-dashboard/document-search-results";
import {
  hasStrongRelevanceIcon,
  isWeakRelevance,
  QueryCoverageChips,
  relevanceChipLabel,
  RelevanceBadge,
} from "@/components/clinical-dashboard/relevance";
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
import { searchFormRecords } from "@/lib/forms";
import { searchServiceRecords } from "@/lib/services";
import { buildAnswerRenderModel, type AnswerRenderModel, type SourceLink } from "@/lib/answer-render-policy";
import { SourceActionRow, sourceResultHref } from "@/components/clinical-dashboard/source-actions";
import {
  clinicalProseUsefulness,
  normalizeExtractedGlyphs,
  sourceTextForCompactDisplay,
  sourceTextForVerbatimQuote,
} from "@/lib/source-text-sanitizer";
import { groupSourceGovernanceWarnings, type SourceGovernanceWarning } from "@/lib/source-governance";
import { smartEvidenceTags } from "@/lib/evidence-tags";
import {
  reviewDocumentTagQuality,
  tagSearchText,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
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
  AnswerSectionKind,
  ConflictOrGap,
  RelatedDocument,
  EvidenceSummary,
  SearchResult,
  SearchScopeSummary,
  VisualEvidenceCard,
  ClinicalQueryMode,
} from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import {
  type AnswerEvidenceMapRow,
  type AnswerViewMode,
  buildAnswerEvidenceMap,
  buildClinicalOutputSections,
  buildHighYieldClinicalOutputSections,
  shouldPollForUpdates,
} from "@/lib/ward-output";

const navigationHashes = ["#search", "#quotes", "#images", "#sources"] as const;
const mobileSectionFabMediaQuery = "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";
const sourcePreviewSheetMediaQuery = "(max-width: 1023px)";

function subscribeToMobilePreviewMedia(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(sourcePreviewSheetMediaQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobilePreviewSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(sourcePreviewSheetMediaQuery).matches;
}

function useMobilePreviewSheet() {
  return useSyncExternalStore(subscribeToMobilePreviewMedia, getMobilePreviewSnapshot, () => false);
}

const authEmailChangeEvent = "clinical-kb-auth-email-change";
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
type AnswerFeedbackType =
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

const clinicalQueryModeOptions: Array<{ value: ClinicalQueryMode; label: string }> = [
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

function getAuthEmailSnapshot() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(AUTH_EMAIL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerAuthEmailSnapshot() {
  return "";
}

function subscribeAuthEmail(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const notify = () => onStoreChange();

  window.addEventListener("storage", notify);
  window.addEventListener(authEmailChangeEvent, notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(authEmailChangeEvent, notify);
  };
}

function SourceImage({
  endpoint,
  caption,
  className = "max-h-52",
}: {
  endpoint: string;
  caption: string;
  className?: string;
}) {
  const [url, setUrl] = useState(() => getCachedSignedUrl(endpoint)?.url ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { authorizationHeader, markSessionExpired } = useAuthSession();

  useEffect(() => {
    const cached = getCachedSignedUrl(endpoint);
    if (cached) return () => undefined;

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
  }, [attempt, authorizationHeader, endpoint, markSessionExpired]);

  function retryImage() {
    clearCachedSignedUrl(endpoint);
    setUrl(null);
    setFailed(false);
    setAttempt((current) => current + 1);
  }

  function handleImageError() {
    clearCachedSignedUrl(endpoint);
    setFailed(true);
  }

  if (failed) {
    return (
      <div
        className={cn(
          className,
          "grid min-h-36 place-items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-4 text-center text-xs font-semibold text-[color:var(--warning)]",
        )}
      >
        <div>
          <AlertCircle className="mx-auto mb-2 h-5 w-5" />
          Image preview could not load.
          <button
            type="button"
            onClick={retryImage}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--surface)] px-3 text-[color:var(--warning)]"
          >
            Retry image
          </button>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          className,
          "grid min-h-36 place-items-center rounded-lg bg-[color:var(--surface-inset)] text-xs font-semibold text-[color:var(--text-muted)]",
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading image
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={caption}
      loading="lazy"
      decoding="async"
      onError={handleImageError}
      className={cn(className, "w-full rounded-lg object-contain")}
    />
  );
}

function ScopeAndGovernanceNotice({
  scope,
  warnings,
}: {
  scope: SearchScopeSummary | null;
  warnings: SourceGovernanceWarning[];
}) {
  const groupedWarnings = groupSourceGovernanceWarnings(warnings).slice(0, 4);
  const showScope =
    Boolean(scope && scope.activeFilterCount > 0) ||
    Boolean(scope?.warnings?.length) ||
    scope?.matchedDocumentCount === 0;
  if (!showScope && groupedWarnings.length === 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)] p-3 text-sm text-[color:var(--text)]">
      {showScope && scope ? (
        <p className="font-semibold">
          Scope: {scope.summary}
          {scope.queryMode && scope.queryMode !== "auto" ? ` · ${scope.queryMode.replaceAll("_", " ")}` : ""}
        </p>
      ) : null}
      {scope?.warnings?.length ? (
        <ul className="grid gap-1 text-xs font-semibold text-[color:var(--warning)]">
          {scope.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {groupedWarnings.length ? (
        <ul className="grid gap-1 text-xs font-semibold text-[color:var(--warning)]">
          {groupedWarnings.map((warning) => (
            <li key={warning.code}>
              {warning.message}
              {warning.titles.length ? (
                <details className="mt-1 font-medium text-[color:var(--text-muted)]">
                  <summary className="cursor-pointer">Sources affected</summary>
                  <span className="mt-1 block">{warning.titles.slice(0, 5).join(", ")}</span>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function plainAnswerText(value: string) {
  const useful = clinicalProseUsefulness(value);
  return sanitizeAnswerDisplayText(useful.text || value, { minLength: 8, minTokens: 2 })
    .replace(/(?:\s*\n\s*)?Synthetic demo only:.*$/i, "")
    .trim();
}

function primaryAnswerDisplayText(value: string) {
  const cleaned = plainAnswerText(value);
  const fragments = cleaned
    .split(/\r?\n+/)
    .flatMap((line: string) =>
      line.split(/(?<=[.!?])\s+(?=(?:[A-Z]|\*\*|If\b|When\b|Do\b|Use\b|Monitor\b|Escalate\b|Document\b))/),
    )
    .map((fragment: string) =>
      fragment
        .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
        .replace(
          /^(?:\*\*)?(?:answer|summary|bottom line|direct answer|clinical point|key point|required actions?|monitoring(?:\/timing)?|thresholds?|dose detail|medication(?:\/dose details?)?|escalation(?:\/risk)?|risk|safety|documentation(?:\/forms)?|source gaps?)(?:\*\*)?:\s+/i,
          "",
        )
        .trim(),
    )
    .map((fragment: string) => clinicalProseUsefulness(fragment).text || fragment)
    .filter((fragment: string) => {
      if (!fragment) return false;
      const useful = clinicalProseUsefulness(fragment);
      return useful.useful || fragment.split(/\s+/).length >= 8;
    });
  const uniqueFragments = Array.from(new Set(fragments));
  const selected = uniqueFragments.slice(0, 3).join(" ");
  const words = selected.split(/\s+/).filter(Boolean);
  if (words.length <= 85) return selected || cleaned;
  return `${words
    .slice(0, 85)
    .join(" ")
    .replace(/[;,:-]\s*$/, "")}...`;
}

function sourceCapsuleText({
  sourceCount,
  weakEvidence,
  grounded,
}: {
  sourceCount: number;
  weakEvidence: boolean;
  grounded: boolean;
}) {
  if (sourceCount <= 0) return "No direct source found";
  if (!grounded) return "Review nearby sources";
  if (weakEvidence) return "Review sources";
  return `Source-backed · ${sourceCount} source${sourceCount === 1 ? "" : "s"}`;
}

function sourceStatusDotClass(metadata: ReturnType<typeof normalizeSourceMetadata> | null | undefined) {
  if (!metadata) return statusDotMuted;
  if (metadata.document_status === "current") return statusDotReady;
  if (metadata.document_status === "review_due" || metadata.document_status === "outdated") return statusDotReview;
  return statusDotMuted;
}

type CapsulePreviewSource = {
  id: string;
  title: string;
  pageNumber: number | null;
  metadata: ReturnType<typeof normalizeSourceMetadata>;
  score: number;
  href: string;
  snippet?: string;
};

function capsulePreviewSources(
  bestSource: BestSourceRecommendation | null,
  sources: SearchResult[],
  sourceLinks: SourceLink[] = [],
) {
  const rows: CapsulePreviewSource[] = [];
  const seen = new Set<string>();
  const pushRow = (row: CapsulePreviewSource) => {
    const key = `${row.id}:${row.title}:${row.pageNumber ?? "n/a"}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  sourceLinks.slice(0, 5).forEach((source) => {
    pushRow({
      id: source.chunk_id,
      title: source.title || source.file_name || "Source",
      pageNumber: source.page_number,
      metadata: normalizeSourceMetadata(source.sourceMetadata),
      score: source.score ?? 0,
      href: source.href,
      snippet: source.snippet,
    });
  });

  if (bestSource) {
    pushRow({
      id: bestSource.chunk_id,
      title: bestSource.title || bestSource.file_name || "Source",
      pageNumber: bestSource.page_number,
      metadata: normalizeSourceMetadata(bestSource.source_metadata),
      score: bestSource.score,
      href: bestSource.viewer_href,
    });
  }

  sources.slice(0, 5).forEach((source) => {
    pushRow({
      id: source.id,
      title: source.title || source.file_name || "Source",
      pageNumber: source.page_number,
      metadata: normalizeSourceMetadata(source.source_metadata),
      score: source.hybrid_score ?? source.similarity ?? source.lexical_score ?? 0,
      href: sourceResultHref(source),
    });
  });

  return rows.slice(0, 3);
}

function SourcePreviewContent({
  previewSources,
  quoteText,
  copiedQuote,
  onCopyQuote,
}: {
  previewSources: CapsulePreviewSource[];
  quoteText?: string | null;
  copiedQuote: boolean;
  onCopyQuote: () => void;
}) {
  const primaryPreviewSource = previewSources[0] ?? null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Sources behind this answer
          </p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Preview first, then open the source document when needed.
          </p>
        </div>
        <span className={cn(metadataPill, "nums shrink-0")}>{previewSources.length} sources</span>
      </div>
      <div className="mt-3 grid gap-1.5" role="list" aria-label="Sources behind this answer">
        {previewSources.map((source, index) => (
          <Link
            key={`${source.id}:${index}`}
            href={source.href}
            data-testid="source-capsule-preview-row"
            className="grid min-h-[44px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 text-left transition hover:border-[color:var(--primary)]/45 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            role="listitem"
            aria-label={`Open source ${cleanDisplayTitle(source.title)}, page ${source.pageNumber ?? "not available"}`}
          >
            <span className={sourceStatusDotClass(source.metadata)} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                {cleanDisplayTitle(source.title)}
              </span>
              <span className={cn("block truncate text-xs", textMuted)}>
                <span className="font-mono tabular-nums">p.{source.pageNumber ?? "n/a"}</span> ·{" "}
                {sourceStatusLabel(source.metadata)}
              </span>
            </span>
            <span className={cn(subtleStatusPill, "nums min-h-6 px-1.5 text-[11px]")}>
              {Math.round(Math.max(0, Math.min(1, source.score)) * 100)}%
            </span>
          </Link>
        ))}
      </div>
      {quoteText ? (
        <blockquote className="mt-3 border-l-2 border-[color:var(--clinical-accent)]/35 pl-3 text-sm font-medium leading-6 text-[color:var(--text)]">
          &ldquo;{quoteText}&rdquo;
        </blockquote>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {primaryPreviewSource ? (
          <Link
            href={primaryPreviewSource.href}
            className={chatMicroAction}
            aria-label={`Open source page for ${primaryPreviewSource.title}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open source page
          </Link>
        ) : null}
        {quoteText ? (
          <button type="button" className={chatMicroAction} onClick={onCopyQuote}>
            <Copy className="h-3.5 w-3.5" />
            {copiedQuote ? "Copied quote" : "Copy quote"}
          </button>
        ) : null}
      </div>
    </>
  );
}

function NaturalLanguageAnswer({
  text,
  sourceCount,
  weakEvidence,
  grounded,
  sourceOnly,
  bestSource,
  sources,
  sourceLinks,
  copied,
  onCopy,
}: {
  text: string;
  sourceCount: number;
  weakEvidence: boolean;
  grounded: boolean;
  sourceOnly: boolean;
  bestSource: BestSourceRecommendation | null;
  sources: SearchResult[];
  sourceLinks: SourceLink[];
  copied: boolean;
  onCopy: () => void;
}) {
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [copiedSourceQuote, setCopiedSourceQuote] = useState(false);
  const sourceCapsuleRef = useRef<HTMLButtonElement>(null);
  const copySourceQuoteTimerRef = useRef<number | null>(null);
  const usePreviewSheet = useMobilePreviewSheet();
  useEffect(() => {
    return () => {
      if (copySourceQuoteTimerRef.current !== null) window.clearTimeout(copySourceQuoteTimerRef.current);
    };
  }, []);
  const cleaned = primaryAnswerDisplayText(text);
  if (!cleaned) return null;
  const capsuleText = sourceCapsuleText({ sourceCount, weakEvidence, grounded });
  const previewSources = capsulePreviewSources(bestSource, sources, sourceLinks);
  const quoteText = sourceLinks.find((source) => source.snippet)?.snippet || bestSource?.quote || bestSource?.snippet;
  const canOpenSourcePreview = previewSources.length > 0;
  async function copySourceQuote() {
    if (!quoteText) return;
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopiedSourceQuote(true);
      if (copySourceQuoteTimerRef.current !== null) window.clearTimeout(copySourceQuoteTimerRef.current);
      copySourceQuoteTimerRef.current = window.setTimeout(() => setCopiedSourceQuote(false), 1600);
    } catch {
      setCopiedSourceQuote(false);
    }
  }
  const sourceCapsuleButton = (
    <button
      type="button"
      ref={sourceCapsuleRef}
      className={cn(sourceCapsule, "w-fit")}
      aria-label="Open answer sources"
      aria-expanded={sourcePreviewOpen}
      onClick={() => {
        if (canOpenSourcePreview) setSourcePreviewOpen((current) => !current);
      }}
    >
      {sourceCount > 0 ? (
        <>
          <span className="sm:hidden">
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline">{capsuleText}</span>
        </>
      ) : (
        capsuleText
      )}
      {canOpenSourcePreview ? <ChevronDown className="h-3.5 w-3.5" /> : null}
    </button>
  );

  return (
    <section
      data-testid="plain-answer-response"
      aria-label="Primary natural-language answer"
      className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[color:var(--text-heading)]"
    >
      <span
        data-testid="answer-clinical-icon"
        className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent)]/25 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
        aria-hidden="true"
      >
        <ShieldCheck className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className={chatAnswerText}>
          <span data-testid="plain-answer-prose">
            <SafeBoldText text={cleaned} />
          </span>
        </p>
        {sourceOnly ? (
          <p
            data-testid="source-only-disclosure"
            role="note"
            className={cn(
              "rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1.5 text-xs leading-5",
              textMuted,
            )}
          >
            Source-only answer — assembled from your documents without the AI model, so it may be less complete. Verify
            it against the cited passages below.
          </p>
        ) : null}
        {sourceCapsuleButton}
        {sourcePreviewOpen && canOpenSourcePreview && !usePreviewSheet ? (
          <div
            data-testid="source-capsule-preview"
            className="max-h-[22rem] max-w-xl overflow-y-auto overscroll-contain rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-elevated)] motion-safe:animate-pop-in"
          >
            <SourcePreviewContent
              previewSources={previewSources}
              quoteText={quoteText}
              copiedQuote={copiedSourceQuote}
              onCopyQuote={copySourceQuote}
            />
          </div>
        ) : null}
        <Sheet
          open={sourcePreviewOpen && canOpenSourcePreview && usePreviewSheet}
          onClose={() => setSourcePreviewOpen(false)}
          title="Sources behind this answer"
          description="Preview sources first, then open the source document when needed."
          closeLabel="Close answer sources"
          contentClassName="sm:max-w-xl"
          returnFocusRef={sourceCapsuleRef}
          portal
        >
          <div data-testid="source-capsule-preview">
            <SourcePreviewContent
              previewSources={previewSources}
              quoteText={quoteText}
              copiedQuote={copiedSourceQuote}
              onCopyQuote={copySourceQuote}
            />
          </div>
        </Sheet>
        <div className={chatActionRow} aria-label="Answer actions">
          <button
            type="button"
            onClick={onCopy}
            className={chatMicroAction}
            aria-label="Copy answer with source status"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied with sources" : "Copy with sources"}
          </button>
        </div>
      </div>
    </section>
  );
}

function UserQuestionBubble({ query }: { query: string }) {
  const cleaned = query.trim();
  if (!cleaned) return null;

  return (
    <section className="flex justify-end px-1" aria-label="User question">
      <div
        data-testid="user-question-bubble"
        className="ml-auto max-w-[min(28rem,86%)] rounded-lg border border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2 text-right shadow-[var(--shadow-inset)] sm:max-w-[28rem]"
      >
        <p className="text-sm font-medium leading-6 text-[color:var(--text-heading)]">{cleaned}</p>
        <p className={cn("nums mt-0.5 text-[11px] leading-4", textMuted)}>9:14 AM</p>
      </div>
    </section>
  );
}

type KeyClinicalItem = {
  id: string;
  label?: string;
  detail: string;
};

function keyClinicalItemFromText(item: string): KeyClinicalItem | null {
  const cleaned = item.replace(/^[-*•]\s*/, "").trim();
  if (cleaned.length < 24) return null;
  const [labelCandidate, ...detailParts] = cleaned.split(/\s+(?:—|-)\s+/);
  const label = labelCandidate?.trim();
  const detail = detailParts.join(" — ").trim();
  const id = comparableAnswerText(cleaned);
  if (label && detail && label.length <= 64) return { id, label, detail };
  return { id, detail: cleaned };
}

function keyClinicalItemsFromSections(
  sections: Array<AnswerSection & { citationSources: SearchResult[] }>,
): KeyClinicalItem[] {
  const usefulKinds = new Set<AnswerSectionKind | undefined>([
    "required_actions",
    "monitoring_timing",
    "medication_dose",
    "thresholds",
    "escalation_risk",
    "contraindications_cautions",
    "comparison",
  ]);
  return sections
    .filter((section) => usefulKinds.has(section.kind))
    .flatMap((section) =>
      section.body
        .split(/\n+|(?<=\.)\s+(?=(?:Monitor|Check|Use|Avoid|Escalate|Withhold|Review|Document|Repeat|Consider)\b)/)
        .map((item) => keyClinicalItemFromText(item))
        .filter((item): item is KeyClinicalItem => Boolean(item)),
    )
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 5);
}

function keyClinicalItemsFromTable(item: VisualEvidenceCard | null): KeyClinicalItem[] {
  const rows = item?.tableRows?.filter((row) => row.some((cell) => cell.trim())) ?? [];
  if (rows.length < 2) return [];

  return rows
    .slice(0, 3)
    .map((row): KeyClinicalItem | null => {
      const [domain, baseline] = row.map((cell) => cell.trim()).filter(Boolean);
      if (!domain || !baseline) return null;
      const detail = baseline;
      return {
        id: comparableAnswerText([domain, detail].join(" ")),
        label: domain,
        detail,
      };
    })
    .filter((value): value is KeyClinicalItem => value !== null)
    .slice(0, 5);
}

function KeyClinicalItems({
  sections,
  table,
}: {
  sections: Array<AnswerSection & { citationSources: SearchResult[] }>;
  table: VisualEvidenceCard | null;
}) {
  const sectionItems = keyClinicalItemsFromSections(sections);
  const tableItems = keyClinicalItemsFromTable(table);
  const items = sectionItems.length >= 2 ? sectionItems : tableItems;
  if (items.length < 2) return null;

  return (
    <section aria-label="Key monitoring items" className="max-w-[68ch] space-y-2 px-1">
      <h3 className="text-sm font-semibold text-[color:var(--text-heading)] sm:text-[15px]">Key monitoring items</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-[1.55] text-[color:var(--text-heading)] marker:text-[color:var(--text-heading)] sm:text-[15px]">
        {items.map((item) => (
          <li key={item.id} className="pl-0.5">
            {item.label ? (
              <>
                <span className="font-semibold">{item.label}</span>
                <span className={textMuted}> — </span>
                <SafeBoldText text={item.detail} />
              </>
            ) : (
              <SafeBoldText text={item.detail} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function comparableAnswerText(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\.\.\.$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isRedundantStructuredItem(item: string, primaryAnswer: string) {
  const itemText = comparableAnswerText(item);
  const answerText = comparableAnswerText(primaryAnswer);
  if (!itemText || !answerText) return false;
  if (answerText.includes(itemText) || itemText.includes(answerText)) return true;
  if (itemText.length < 40) return false;
  const answerWords = new Set(answerText.split(" ").filter((word) => word.length > 3));
  const itemWords = itemText.split(" ").filter((word) => word.length > 3);
  if (itemWords.length < 6) return false;
  const sharedWords = itemWords.filter((word) => answerWords.has(word)).length;
  if (sharedWords / itemWords.length >= 0.82) return true;
  return answerText.includes(itemText.slice(0, Math.min(160, itemText.length)));
}

type ClinicalDetailSection = ReturnType<typeof buildClinicalOutputSections>[number];

function displayItemsForClinicalDetailSection(
  section: ClinicalDetailSection,
  primaryAnswer: string,
  showLead: boolean,
) {
  if (showLead) return section.items;
  const nonRedundantItems = section.items.filter((item) => !isRedundantStructuredItem(item, primaryAnswer));
  return nonRedundantItems.length > 0 || section.items.length === 0 ? nonRedundantItems : section.items;
}

const clinicalDetailPriority: Record<string, number> = {
  action: 10,
  escalation: 20,
  thresholds: 30,
  cautions: 40,
  monitoring: 50,
  medication: 60,
  documentation: 70,
  comparison: 80,
  "support-map": 90,
  "source-gap": 100,
};

function clinicalDetailContentCount(section: ClinicalDetailSection) {
  if (section.items.length > 0) return section.items.length;
  const tableRows =
    section.tables?.reduce((total, table) => total + (table.rows?.length ?? (table.markdown ? 1 : 0)), 0) ?? 0;
  return tableRows || section.tables?.length || 0;
}

function sortClinicalDetailSections(sections: ClinicalDetailSection[]) {
  return [...sections].sort((left, right) => {
    const leftPriority = clinicalDetailPriority[left.id] ?? 75;
    const rightPriority = clinicalDetailPriority[right.id] ?? 75;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.title.localeCompare(right.title);
  });
}

function clinicalDetailMeta(section: ClinicalDetailSection): {
  icon: typeof Search;
  eyebrow: string;
  toneClassName: string;
  accentClassName: string;
} {
  if (section.id === "thresholds") {
    return {
      icon: Target,
      eyebrow: "Thresholds",
      toneClassName: toneWarning,
      accentClassName: "bg-[color:var(--warning)]",
    };
  }
  if (section.id === "escalation" || section.id === "cautions" || section.id === "source-gap") {
    return {
      icon: ShieldAlert,
      eyebrow: section.id === "source-gap" ? "Source gap" : "Risk",
      toneClassName: toneDanger,
      accentClassName: "bg-[color:var(--danger)]",
    };
  }
  if (section.id === "monitoring" || section.id === "medication") {
    return {
      icon: ClipboardCheck,
      eyebrow: section.id === "monitoring" ? "Monitoring" : "Medication",
      toneClassName: toneWarning,
      accentClassName: "bg-[color:var(--warning)]",
    };
  }
  if (section.id === "support-map" || section.id === "comparison") {
    return {
      icon: BookOpen,
      eyebrow: section.id === "support-map" ? "Evidence support" : "Comparison",
      toneClassName: toneInfo,
      accentClassName: "bg-[color:var(--info)]",
    };
  }
  if (section.id === "documentation") {
    return {
      icon: FileText,
      eyebrow: "Documentation",
      toneClassName: toneNeutral,
      accentClassName: "bg-[color:var(--border-strong)]",
    };
  }
  return {
    icon: ListChecks,
    eyebrow: "Clinical action",
    toneClassName: toneSuccess,
    accentClassName: "bg-[color:var(--success)]",
  };
}

function clinicalDetailSummaryItems(sections: ClinicalDetailSection[]) {
  const countById = (ids: string[]) =>
    sections
      .filter((section) => ids.includes(section.id))
      .reduce((total, section) => total + clinicalDetailContentCount(section), 0);
  const tableCount = sections.reduce((total, section) => total + (section.tables?.length ?? 0), 0);
  const items = [
    { label: "Actions", value: countById(["action", "escalation", "documentation"]) },
    { label: "Monitoring", value: countById(["monitoring", "medication"]) },
    { label: "Tables", value: tableCount },
    { label: "Cautions", value: countById(["cautions", "source-gap"]) },
    { label: "Evidence", value: countById(["support-map", "comparison"]) },
  ];
  return items.filter((item) => item.value > 0);
}

type ClinicalNotesTabId = "safety" | "monitor";

type ClinicalNotesRow = {
  id: string;
  title: string;
  detail: string;
  sourceIndex: number;
  tone: "safe" | "warn";
};

const clinicalNotesTabMeta: Record<
  ClinicalNotesTabId,
  { label: string; icon: typeof ShieldCheck; sectionIds: string[] }
> = {
  safety: {
    label: "Safety",
    icon: ShieldCheck,
    sectionIds: ["escalation", "cautions", "source-gap", "thresholds"],
  },
  monitor: {
    label: "Monitor",
    icon: Activity,
    sectionIds: ["monitoring", "medication", "action"],
  },
};

function compactClinicalNoteText(value: string) {
  return normalizeExtractedGlyphs(value)
    .replace(/\*\*/g, "")
    .replace(/\s*\[\d+(?:,\s*\d+)*\]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripClinicalNoteLeadIn(value: string) {
  let text = compactClinicalNoteText(value);
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text
      .replace(/^(the\s+same\s+)?synthetic\s+source\s+says\s+/i, "")
      .replace(/^the\s+(indexed\s+)?source\s+says\s+/i, "")
      .replace(/^source\s+text\s+says\s+/i, "")
      .replace(/^according\s+to\s+[^,]+,\s*/i, "")
      .trim();
  }
  return text;
}

function titleCaseClinicalNote(value: string) {
  return value
    .replace(/\b\w[\w/-]*/g, (word) => {
      if (/[A-Z]{2,}|\/|\d/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOr\b/g, "or")
    .replace(/\bTo\b/g, "to");
}

function sentenceCaseClinicalNoteDetail(value: string) {
  const text = stripClinicalNoteLeadIn(value);
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function clinicalNoteHeuristicTitle(value: string) {
  const text = stripClinicalNoteLeadIn(value);
  const lower = text.toLowerCase();

  if (/\bbaseline checklist\b/.test(lower) && /\bconfirm indication\b/.test(lower)) return "Indication";
  if (/\b(vomiting|diarrhoea|diarrhea|dehydration|acute kidney injury|tremor|confusion|ataxia)\b/.test(lower)) {
    return "Toxicity review triggers";
  }
  if (
    /\b(escalate|urgent review|urgent|red flag|seizures?|severe constipation|chest pain|dyspnoea|tachycardia)\b/.test(
      lower,
    )
  ) {
    return "Escalation triggers";
  }
  if (/\blithium levels?\b/.test(lower) && /\b(5\s*(?:to|-|–)\s*7|dose change|stable|days?)\b/.test(lower)) {
    return "Lithium level timing";
  }
  if (/\b(lithium level|serum lithium|trough level)\b/.test(lower)) return "Lithium level check";
  if (/\b(fbc|anc)\b/.test(lower)) return "FBC/ANC monitoring";
  if (/\bmyocarditis\b/.test(lower)) return "Myocarditis screening";
  if (/\b(metabolic|weight|lipids?|glucose|hba1c|waist)\b/.test(lower)) return "Metabolic monitoring";
  if (/\b(constipation|bowel)\b/.test(lower)) return "Constipation prevention";
  if (/\b(shared-care|shared care|communication|handover)\b/.test(lower)) return "Shared-care communication";
  if (/\b(renal|kidney|creatinine|egfr)\b/.test(lower)) return "Renal function";
  if (/\b(thyroid|tsh)\b/.test(lower)) return "Thyroid monitoring";
  if (/\bcalcium\b/.test(lower)) return "Calcium monitoring";
  if (/\b(nsaid|ace inhibitor|diuretic|interacting medicine|medicine reconciliation)\b/.test(lower)) {
    return "Interacting medicines";
  }

  return null;
}

function clinicalNoteTitleFromItem(item: string, section: ClinicalDetailSection, index: number) {
  const text = stripClinicalNoteLeadIn(item);
  const heuristicTitle = clinicalNoteHeuristicTitle(text);
  if (heuristicTitle) return heuristicTitle;
  const colonIndex = text.indexOf(":");
  if (colonIndex > 8 && colonIndex < 54) {
    const title = text.slice(0, colonIndex).trim();
    const detailStart = text
      .slice(colonIndex + 1)
      .split(/[,;]/)[0]
      ?.trim();
    if (/\b(checklist|checkpoint|points?)\b/i.test(title) && detailStart) {
      return clinicalNoteTitleFromFragment(detailStart);
    }
    return title;
  }
  const dashIndex = text.search(/\s[-–]\s/);
  if (dashIndex > 8 && dashIndex < 54) return text.slice(0, dashIndex).trim();
  if (section.items.length === 1 && section.title.length <= 42) return section.title;
  const words = text
    .replace(/^(confirm|check|review|record|document)\s+/i, "")
    .split(" ")
    .filter(Boolean);
  return words.slice(0, Math.min(words.length, index === 0 ? 5 : 4)).join(" ") || section.title;
}

function clinicalNoteDetailFromItem(item: string, title: string) {
  const text = stripClinicalNoteLeadIn(item);
  const normalizedTitle = title.toLowerCase();
  const lowerText = text.toLowerCase();
  const colonIndex = text.indexOf(":");
  if (colonIndex > 8 && colonIndex < 64) {
    const beforeColon = text.slice(0, colonIndex);
    const afterColon = text.slice(colonIndex + 1).trim();
    if (/\b(checklist|checkpoint|points?)\b/i.test(beforeColon) && afterColon) {
      return sentenceCaseClinicalNoteDetail(afterColon);
    }
  }
  if (lowerText.startsWith(`${normalizedTitle}:`)) {
    return sentenceCaseClinicalNoteDetail(text.slice(title.length + 1).trim());
  }
  if (lowerText.startsWith(`${normalizedTitle} -`) || lowerText.startsWith(`${normalizedTitle} –`)) {
    return sentenceCaseClinicalNoteDetail(text.slice(title.length + 2).trim());
  }
  if (text === title) return "Review linked source context before using this note.";
  return sentenceCaseClinicalNoteDetail(text);
}

function clinicalNoteTitleFromFragment(fragment: string) {
  const text = stripClinicalNoteLeadIn(fragment)
    .replace(/^(and|or)\s+/i, "")
    .replace(/^(confirm|check|review|record|document)\s+/i, "")
    .replace(/[.;:,]+$/g, "");
  if (!text) return "Clinical note";
  return clinicalNoteHeuristicTitle(text) ?? titleCaseClinicalNote(text);
}

function splitClinicalNoteFragments(item: string, section: ClinicalDetailSection, title: string) {
  const detail = clinicalNoteDetailFromItem(item, title);
  const titleLooksGeneric = /\b(checkpoint|checklist|item|point|monitoring|safety)\b/i.test(title);
  const itemLooksGeneric = /\b(checkpoint|checklist|item|point|monitoring|safety)\b/i.test(
    stripClinicalNoteLeadIn(item),
  );
  if (!titleLooksGeneric && !itemLooksGeneric && section.items.length > 1) return null;

  const fragments = detail
    .replace(/\band\s+/gi, "")
    .split(/[,;]\s+/)
    .map((fragment) => compactClinicalNoteText(fragment).replace(/[.;:,]+$/g, ""))
    .filter((fragment) => fragment.length > 5);

  return fragments.length >= 3 ? fragments.slice(0, 5) : null;
}

function clinicalNoteToneForText(text: string, fallback: ClinicalNotesRow["tone"]) {
  if (/\b(toxicity|toxic|warning|caution|urgent|red flag|adverse|confusion|ataxia|tremor)\b/i.test(text)) {
    return "warn";
  }
  return fallback;
}

function clinicalNoteHasDistinctDetail(row: ClinicalNotesRow) {
  const title = compactClinicalNoteText(row.title).toLowerCase();
  const detail = compactClinicalNoteText(row.detail).toLowerCase();
  return Boolean(detail) && detail !== title;
}

function clinicalNoteDetailLabel(row: ClinicalNotesRow) {
  const text = `${row.title} ${row.detail}`.toLowerCase();
  if (/\b(timing|level|schedule|dose change|stable|days?)\b/.test(text)) return "Timing";
  if (/\b(escalation|escalate|urgent|toxicity|trigger|vomiting|confusion|ataxia|tremor)\b/.test(text)) {
    return "Escalate";
  }
  if (/\b(baseline|confirm|record|document|check|review)\b/.test(text)) return "Action";
  return "Note";
}

function ClinicalNoteDetailCard({ row }: { row: ClinicalNotesRow }) {
  const detail = sentenceCaseClinicalNoteDetail(row.detail);
  return (
    <div className="mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2 shadow-[var(--shadow-inset)]">
      <p className="text-[12px] leading-[1.5] text-[color:var(--text)]">
        <span className="mr-1.5 font-semibold text-[color:var(--text-muted)]">{clinicalNoteDetailLabel(row)}:</span>
        {detail}
      </p>
    </div>
  );
}

function clinicalNotesTableEvidenceCount(answer: RagAnswer) {
  return (answer.visualEvidence ?? answer.smartPanel?.visualEvidence ?? []).filter(
    (item) => item.accessibleTableMarkdown || item.tableRows?.length,
  ).length;
}

function clinicalNotesRowsForTab(sections: ClinicalDetailSection[], tab: ClinicalNotesTabId) {
  const meta = clinicalNotesTabMeta[tab];
  const rows: ClinicalNotesRow[] = [];
  let sourceIndex = 1;

  for (const section of sections) {
    const sectionText = `${section.title} ${section.items.join(" ")}`.toLowerCase();
    const hasMonitoringText =
      tab === "monitor" && /\b(monitor|screen|level|fbc|anc|metabolic|renal|thyroid|function)\b/i.test(sectionText);
    if (!meta.sectionIds.includes(section.id) && !hasMonitoringText) {
      continue;
    }
    const tone: ClinicalNotesRow["tone"] = section.id === "escalation" || section.id === "cautions" ? "warn" : "safe";

    for (const item of section.items.slice(0, 4)) {
      if (section.tables?.length && /\b(table|showing domains|table showing)\b/i.test(item)) continue;
      const title = clinicalNoteTitleFromItem(item, section, rows.length);
      const fragments = splitClinicalNoteFragments(item, section, title);
      if (fragments) {
        for (const fragment of fragments) {
          const fragmentTitle = clinicalNoteTitleFromFragment(fragment);
          rows.push({
            id: `${tab}:${section.id}:${rows.length}:${fragmentTitle}`,
            title: fragmentTitle,
            detail: fragment,
            sourceIndex: sourceIndex++,
            tone: clinicalNoteToneForText(fragment, tone),
          });
        }
      } else {
        rows.push({
          id: `${tab}:${section.id}:${rows.length}:${title}`,
          title,
          detail: clinicalNoteDetailFromItem(item, title),
          sourceIndex: sourceIndex++,
          tone: clinicalNoteToneForText(item, tone),
        });
      }
    }
  }

  return rows.slice(0, 6);
}

function clinicalNotesAvailableTabs(sections: ClinicalDetailSection[]) {
  return (Object.keys(clinicalNotesTabMeta) as ClinicalNotesTabId[])
    .map((id) => ({ id, ...clinicalNotesTabMeta[id], count: clinicalNotesRowsForTab(sections, id).length }))
    .filter((tab) => tab.count > 0);
}

function clinicalNotesDetailSectionsForAnswer(answer: RagAnswer, viewMode: AnswerViewMode) {
  const sections =
    viewMode === "high_yield" ? buildHighYieldClinicalOutputSections(answer) : buildClinicalOutputSections(answer);
  const primaryAnswer = plainAnswerText(answer.answer);
  return sortClinicalDetailSections(
    sections
      .filter((section) => section.id !== "verify-source" && section.id !== "bottom-line")
      .map((section) => ({
        ...section,
        items: displayItemsForClinicalDetailSection(section, primaryAnswer, false),
      }))
      .filter((section) => section.items.length > 0),
  );
}

function clinicalNotesDisplayCountForAnswer(answer: RagAnswer, viewMode: AnswerViewMode, fallback: number) {
  const tabs = clinicalNotesAvailableTabs(clinicalNotesDetailSectionsForAnswer(answer, viewMode));
  const largestTabCount = tabs.reduce((largest, tab) => Math.max(largest, tab.count), 0);
  return Math.max(1, largestTabCount || fallback);
}

function ClinicalNotesChecklistPanel({
  answer,
  viewMode,
  evidenceMapRows,
  bestSource,
  copied,
  onCopy,
  onOpenTables,
}: {
  answer: RagAnswer;
  viewMode: AnswerViewMode;
  evidenceMapRows: AnswerEvidenceMapRow[];
  bestSource: BestSourceRecommendation | null;
  copied: boolean;
  onCopy: () => void;
  onOpenTables?: () => void;
}) {
  const detailSections = clinicalNotesDetailSectionsForAnswer(answer, viewMode);
  const tabs = clinicalNotesAvailableTabs(detailSections);
  const [requestedTab, setRequestedTab] = useState<ClinicalNotesTabId>(tabs[0]?.id ?? "safety");
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : (tabs[0]?.id ?? "safety");
  const rows = clinicalNotesRowsForTab(detailSections, activeTab);
  const tableEvidenceCount = clinicalNotesTableEvidenceCount(answer);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const firstExpandableRow = rows.find(clinicalNoteHasDistinctDetail) ?? null;
  const activeRow = rows.find((row) => row.id === expandedRowId) ?? firstExpandableRow;
  const [added, setAdded] = useState(false);
  const warningCount = rows.filter((row) => row.tone === "warn").length;
  const toggles: Array<{
    id: ClinicalNotesTabId | "table";
    label: string;
    icon: typeof ShieldCheck;
    count?: number;
    popout?: boolean;
  }> = [
    ...tabs.map((tab) => ({ ...tab, popout: false })),
    ...(tableEvidenceCount > 0 && onOpenTables
      ? [{ id: "table" as const, label: "Table", icon: Table2, count: tableEvidenceCount, popout: true }]
      : []),
  ];

  if (!tabs.length || rows.length === 0) {
    return (
      <ClinicalOutputPanel answer={answer} showLead={false} viewMode={viewMode} evidenceMapRows={evidenceMapRows} />
    );
  }

  const ActiveIcon = clinicalNotesTabMeta[activeTab].icon;
  const showToggleBar = toggles.length > 1;

  return (
    <section data-testid="clinical-notes-checklist" className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showToggleBar ? (
        <div className="sticky top-0 z-10 -mx-3 -mt-2 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)]/98 px-3 py-1.5 backdrop-blur sm:static sm:mx-0 sm:mt-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-0">
          <div
            role="tablist"
            aria-label="Clinical notes categories"
            className="flex min-w-0 items-center gap-1 overflow-x-auto"
          >
            {toggles.map((tab) => {
              const Icon = tab.icon;
              const selected = !tab.popout && tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`${tab.label} (${tab.count})`}
                  data-testid={tab.popout ? "clinical-notes-table-popout-toggle" : undefined}
                  onClick={() => {
                    if (tab.popout) {
                      onOpenTables?.();
                      return;
                    }
                    setRequestedTab(tab.id as ClinicalNotesTabId);
                    setExpandedRowId(null);
                  }}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    selected
                      ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                      : "border-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.count ? <span className="nums text-[10px] opacity-70">{tab.count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex min-w-0 items-start gap-2.5 border-b border-[color:var(--border)] pb-3">
        <span
          className={cn(
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border shadow-[var(--shadow-inset)]",
            activeTab === "safety" ? toneWarning : toneSuccess,
          )}
          aria-hidden="true"
        >
          <ActiveIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-[1.35] text-[color:var(--text-heading)]">
            {activeTab === "safety" ? "Safety checklist" : "Monitoring checklist"}
          </h3>
          <p className={cn("mt-0.5 text-[12px] leading-[1.45]", textMuted)}>
            {activeTab === "safety"
              ? warningCount > 0
                ? `${warningCount} caution ${warningCount === 1 ? "item" : "items"} prioritised from the answer.`
                : "Key actions to start and continue safely."
              : "Monitoring and medication follow-up items."}
          </p>
        </div>
      </div>

      <div className="divide-y divide-[color:var(--border)]">
        {rows.map((row) => {
          const expanded = row.id === activeRow?.id;
          const hasDistinctDetail = clinicalNoteHasDistinctDetail(row);
          const RowIcon = row.tone === "warn" ? AlertCircle : CheckCircle2;
          return (
            <article key={row.id} data-testid="clinical-note-row" className="relative py-2">
              <button
                type="button"
                onClick={() => {
                  if (hasDistinctDetail) setExpandedRowId(expanded ? null : row.id);
                }}
                className="w-full min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                aria-expanded={hasDistinctDetail ? expanded : undefined}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border bg-[color:var(--surface)]",
                      row.tone === "warn"
                        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
                        : "border-[color:var(--primary)]/25 bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
                    )}
                    aria-hidden="true"
                  >
                    <RowIcon className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-[1.35] text-[color:var(--text-heading)]">
                        {row.title}
                      </span>
                      <span className="nums grid h-5 min-w-5 shrink-0 place-items-center rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-1 text-[10px] font-bold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
                        {row.sourceIndex}
                      </span>
                      {hasDistinctDetail ? (
                        <ChevronDown
                          className={cn(
                            "mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)] transition",
                            expanded && "rotate-180",
                          )}
                        />
                      ) : null}
                    </span>
                    {hasDistinctDetail ? (
                      <span className={cn("mt-0.5 line-clamp-1 text-[12px] leading-[1.45]", textMuted)}>
                        {row.detail}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
              {expanded && hasDistinctDetail ? <ClinicalNoteDetailCard row={row} /> : null}
            </article>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-3 mt-auto border-t border-[color:var(--border)] bg-[color:var(--surface-raised)]/98 px-2.5 py-1.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-2">
        <div className="grid grid-cols-3 divide-x divide-[color:var(--border)] bg-[color:var(--surface)]">
          {bestSource ? (
            <Link
              href={bestSource.viewer_href}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold text-[color:var(--primary)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Source
            </Link>
          ) : (
            <span className="inline-flex min-h-9 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold text-[color:var(--text-soft)]">
              <ExternalLink className="h-3.5 w-3.5" />
              Source
            </span>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold text-[color:var(--text)]"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => setAdded(true)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 px-2 text-[11px] font-semibold text-[color:var(--primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {added ? "Added" : "Add"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SafetyFindingsPanel({ findings }: { findings: ReturnType<typeof extractSafetyFindings> }) {
  if (findings.length === 0) return null;

  return (
    <section
      data-testid="safety-findings-panel"
      className={cn(
        evidenceSurface,
        "border-l-4 border-l-[color:var(--warning)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--warning-soft)_42%,transparent),transparent_62%),var(--surface-raised)] p-3 sm:p-4",
      )}
    >
      <SectionHeading
        icon={ShieldAlert}
        title="Safety-critical source findings"
        description="Items come from source text. Verify before clinical use."
        hideDescriptionOnMobile
        compactMobile
      />
      <div className="mt-3 grid gap-2 sm:mt-4">
        {findings.map((finding, index) => (
          <article
            key={`${finding.id}:${finding.href}:${index}`}
            className={cn(sourceCard, "bg-[color:var(--surface-glass)] p-3 backdrop-blur-md")}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="inline-flex min-h-7 items-center rounded-md bg-[color:var(--warning-soft)] px-2 text-xs font-bold text-[color:var(--warning)]">
                {finding.label}
              </span>
              <Link
                href={finding.href}
                className={cn(
                  raisedCard,
                  "inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold text-[color:var(--primary)]",
                )}
                aria-label={`Open source ${formatSafetyFindingLabel(finding)}`}
              >
                <ExternalLink className="h-4 w-4" />
                Source
              </Link>
            </div>
            <p className="mt-2 text-[15px] font-medium leading-6 text-[color:var(--text)]">{finding.text}</p>
            <p className={cn("mt-2 text-xs font-semibold leading-5", textMuted)}>
              {formatCitationLabel(finding.citation)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceGapPanel({
  relevance,
  sources,
  query,
}: {
  relevance?: EvidenceRelevance | null;
  sources: SearchResult[];
  query: string;
}) {
  if (!relevance || relevance.isSourceBacked) return null;
  const closestSources = sources.slice(0, 3);
  const found = relevance.matchedTerms.length
    ? relevance.matchedTerms.slice(0, 6).join(", ")
    : "Only weak neighboring passages were retrieved.";
  const missing = relevance.missingTerms.length
    ? relevance.missingTerms.slice(0, 6).join(", ")
    : "No direct indexed passage covered the full question.";

  return (
    <section
      data-testid="evidence-gap-panel"
      className={cn(
        evidenceSurface,
        "border-l-4 border-l-[color:var(--warning)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--warning-soft)_38%,transparent),transparent_64%),var(--surface-raised)] p-3 sm:p-4",
      )}
    >
      <SectionHeading
        icon={AlertCircle}
        title="Source gaps"
        description={relevance.supportReason}
        hideDescriptionOnMobile
        compactMobile
        action={<RelevanceBadge relevance={relevance} />}
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <article className={cn(sourceCard, "p-3")}>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">What was found</p>
          <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>{found}</p>
        </article>
        <article className={cn(sourceCard, "p-3")}>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            What was not found
          </p>
          <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>{missing}</p>
        </article>
        <article className={cn(sourceCard, "p-3 md:col-span-2")}>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Closest sources</p>
          {closestSources.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {closestSources.map((source) => (
                <Link
                  key={source.id}
                  href={sourceResultHref(source)}
                  className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
                  aria-label={`Open closest source ${cleanDisplayTitle(source.title)}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="max-w-[12rem] truncate">{cleanDisplayTitle(source.title)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>No nearby indexed sources were returned.</p>
          )}
        </article>
        <article className={cn(sourceCard, "p-3 md:col-span-2")}>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
            Suggested next search/upload
          </p>
          <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>
            Try a narrower query using the missing terms, scope to a likely document, or upload/index the guideline that
            directly covers &quot;{query.trim()}&quot;.
          </p>
        </article>
      </div>
    </section>
  );
}

function EvidenceCounts({
  answer,
  sourceSummary,
  sourceCount,
}: {
  answer: RagAnswer;
  sourceSummary?: EvidenceSummary;
  sourceCount: number;
}) {
  const counts = [
    {
      label: "Citations",
      value: answer.citations.length,
    },
    {
      label: "Quotes",
      value: answer.quoteCards?.length ?? sourceSummary?.quote_count ?? 0,
    },
    {
      label: "Images",
      value:
        answer.visualEvidence?.length ?? answer.smartPanel?.visualEvidence?.length ?? sourceSummary?.image_count ?? 0,
    },
    {
      label: "Passages",
      value: sourceCount || sourceSummary?.total_sources || 0,
    },
  ];

  return (
    <div data-testid="evidence-counts" className="grid grid-cols-2 gap-2">
      {counts.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5"
        >
          <p className="text-lg font-semibold leading-none text-[color:var(--text-heading)]">{item.value}</p>
          <p className={cn("mt-1 text-[11px] font-bold uppercase tracking-[0.08em]", textMuted)}>{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function AnswerSourceStatus({
  source,
  weakEvidence,
}: {
  source: BestSourceRecommendation | null | undefined;
  weakEvidence: boolean;
}) {
  const metadata = source?.source_metadata;
  return (
    <div
      data-testid="answer-source-status"
      className={cn(
        "rounded-lg border p-3",
        weakEvidence
          ? "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/45"
          : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[color:var(--text)]">Source status</p>
        <SourceStatusBadge metadata={metadata} />
      </div>
      <SourceProvenance metadata={metadata} />
      {weakEvidence ? (
        <p className="mt-2 text-xs font-semibold leading-5 text-[color:var(--warning)]">
          Evidence support is limited. Treat this as a source-finding result until the linked passage is verified.
        </p>
      ) : null}
    </div>
  );
}

function EvidenceSummaryCard({
  answer,
  bestSource,
  grounded,
  relevance,
  sourceSummary,
  weakEvidence,
  sources,
  gaps,
  onScopeDocument,
  compact = false,
  supporting = false,
}: {
  answer: RagAnswer;
  bestSource: BestSourceRecommendation | null;
  grounded: boolean;
  relevance?: EvidenceRelevance | null;
  sourceSummary?: EvidenceSummary;
  weakEvidence: boolean;
  sources: SearchResult[];
  gaps: ConflictOrGap[];
  onScopeDocument: (documentId: string) => void;
  compact?: boolean;
  supporting?: boolean;
}) {
  const sourceLabel = relevance && !relevance.isSourceBacked ? "Closest source" : "Top source";
  const supportLabel = relevanceChipLabel(relevance, grounded);
  const sourceStrength = bestSource?.source_strength ?? sourceSummary?.source_strength ?? "none";
  const gapMessage =
    gaps[0]?.message ??
    (!relevance?.isSourceBacked && relevance?.supportReason
      ? relevance.supportReason
      : (sourceSummary?.summary ?? null));

  return (
    <aside
      data-testid={supporting ? "evidence-support-panel" : compact ? "evidence-summary-card" : "evidence-rail"}
      aria-label={
        supporting ? "Answer evidence and sources" : compact ? "Answer evidence summary" : "Answer evidence rail"
      }
      className={cn(
        evidenceSurface,
        "space-y-3 p-3 sm:p-4",
        weakEvidence && "border-[color:var(--warning)]/30 border-l-[color:var(--warning)]",
        compact && !supporting && "xl:hidden",
        !compact && !supporting && "xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-heading)]">Evidence review</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            {weakEvidence
              ? "Verify before relying on this answer."
              : "Source status and retrieved evidence at a glance."}
          </p>
        </div>
        <RelevanceBadge relevance={relevance} grounded={grounded} />
      </div>

      <AnswerSourceStatus source={bestSource} weakEvidence={weakEvidence} />

      <EvidenceCounts answer={answer} sourceSummary={sourceSummary} sourceCount={sources.length} />

      {bestSource ? (
        <article className={cn(sourceCard, "p-3")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                {sourceLabel}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--text)]">
                {bestSource.title}
              </p>
              <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                page {bestSource.page_number ?? "n/a"} · {sourceStrength} support
              </p>
            </div>
            <span className={cn(subtleStatusPill, "nums")}>
              {Math.round(Math.max(0, Math.min(1, bestSource.score)) * 100)}% match
            </span>
          </div>
          <p className={cn("mt-3 line-clamp-3 text-[13px] font-medium leading-5", textMuted)}>
            &ldquo;{bestSource.snippet}&rdquo;
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={bestSource.viewer_href}
              className={cn(primaryControl, "min-h-[44px] px-3 text-xs")}
              aria-label={`Open ${sourceLabel.toLowerCase()}: ${formatCitationLabel(bestSource)}`}
            >
              Open source
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onScopeDocument(bestSource.document_id)}
              className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
              aria-label={`Search only ${bestSource.title}`}
            >
              <Filter className="h-4 w-4" />
              Add scope
            </button>
          </div>
        </article>
      ) : (
        <EmptyState icon={Target} title={emptyStates.topSource.title} body={emptyStates.topSource.body} />
      )}

      {gapMessage ? (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm leading-6",
            weakEvidence
              ? "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/45 text-[color:var(--warning)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
          )}
        >
          <p className="text-xs font-bold uppercase tracking-[0.08em]">Coverage note</p>
          <p className="mt-1 font-medium">{gapMessage}</p>
        </div>
      ) : null}

      <QueryCoverageChips relevance={relevance} limit={compact ? 3 : 5} />
      <p className={cn("text-xs leading-5", textMuted)}>
        {supportLabel}. Verify source before copying, including any clinical draft text.
      </p>
    </aside>
  );
}

function compactEvidenceSummary(
  answer: RagAnswer,
  sources: SearchResult[],
  sourceSummary?: EvidenceSummary,
  renderModel?: AnswerRenderModel,
) {
  const sourceCount =
    renderModel?.primarySources.length ??
    sourceSummary?.total_sources ??
    sources.length ??
    answer.sources?.length ??
    answer.citations.length;
  const quoteCount = renderModel?.quoteCards.length ?? answer.quoteCards?.length ?? sourceSummary?.quote_count ?? 0;
  const parts = [
    `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
    `${quoteCount} quote${quoteCount === 1 ? "" : "s"}`,
    "More",
  ];
  return parts.join(" · ");
}

type EvidenceTabName = "Tables" | "Sources" | "Images" | "Quotes" | "PDFs" | "Map";

function renderModelAllows(renderModel: AnswerRenderModel, block: AnswerRenderModel["allowedBlocks"][number]) {
  return renderModel.allowedBlocks.includes(block);
}

function evidenceTabOrder(_answer: RagAnswer, renderModel: AnswerRenderModel): EvidenceTabName[] {
  const order: EvidenceTabName[] = ["Sources", "Map", "Tables", "Quotes", "PDFs", "Images"];
  return order.filter((tab) => {
    if (tab === "Tables") {
      return (
        renderModelAllows(renderModel, "visualEvidence") &&
        renderModel.visualEvidence.some((item) => item.accessibleTableMarkdown || item.tableRows?.length)
      );
    }
    if (tab === "Sources") return renderModelAllows(renderModel, "reviewSources");
    if (tab === "Images") return renderModelAllows(renderModel, "visualEvidence");
    if (tab === "Quotes") return renderModelAllows(renderModel, "quoteCards");
    if (tab === "PDFs") return renderModelAllows(renderModel, "reviewSources");
    return renderModelAllows(renderModel, "evidenceMap");
  });
}

function evidenceTabCount({
  tab,
  sources,
  visualEvidence,
  answerEvidenceMapRows,
  pdfSources,
  renderModel,
}: {
  tab: EvidenceTabName;
  sources: SearchResult[];
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  pdfSources: RenderModelPdfSource[];
  renderModel: AnswerRenderModel;
}) {
  if (tab === "Tables") {
    return visualEvidence.filter((item) => item.accessibleTableMarkdown || item.tableRows?.length).length;
  }
  if (tab === "Sources") return sources.length || renderModel.primarySources.length;
  if (tab === "Images") return visualEvidence.length;
  if (tab === "Quotes") return renderModel.quoteCards.length;
  if (tab === "PDFs") return pdfSources.length;
  return answerEvidenceMapRows.length;
}

function clinicalNotesCount(answer: RagAnswer) {
  return buildHighYieldClinicalOutputSections(answer).filter((section) =>
    ["action", "escalation", "thresholds", "cautions", "monitoring", "medication", "source-gap"].includes(section.id),
  ).length;
}

function answerHasCentralTable(answer: RagAnswer) {
  return (
    answer.queryClass === "table_threshold" ||
    answer.responseMode === "threshold_table" ||
    Boolean(answer.visualEvidence?.some((item) => item.accessibleTableMarkdown || item.tableRows?.length))
  );
}

function primaryVisualTable(answer: RagAnswer) {
  return answer.visualEvidence?.find((item) => item.accessibleTableMarkdown || item.tableRows?.length) ?? null;
}

type RenderModelPdfSource = {
  document_id: string;
  title: string;
  file_name: string;
  page_number: number | null;
  chunk_id: string | null;
};

function uniquePdfSourcesForRenderModel(renderModel: AnswerRenderModel): RenderModelPdfSource[] {
  return renderModel.primarySources.map((source) => ({
    document_id: source.document_id,
    title: source.title,
    file_name: source.file_name,
    page_number: source.page_number,
    chunk_id: source.chunk_id,
  }));
}

function queryModeLabel(mode: ClinicalQueryMode) {
  return clinicalQueryModeOptions.find((option) => option.value === mode)?.label ?? mode.replaceAll("_", " ");
}

function AnswerInsightBar({
  answer,
  bestSource,
  relevance,
  queryMode,
  sourceGovernanceWarnings,
}: {
  answer: RagAnswer;
  bestSource: BestSourceRecommendation | null;
  relevance?: EvidenceRelevance | null;
  queryMode: ClinicalQueryMode;
  sourceGovernanceWarnings: SourceGovernanceWarning[];
}) {
  const metadata = normalizeSourceMetadata(
    bestSource?.source_metadata ?? answer.sources?.[0]?.source_metadata ?? answer.citations?.[0]?.source_metadata,
  );
  const modeLabel =
    answer.smartApiPlan?.displayMode?.replaceAll("_", " ") ??
    answer.responseMode?.replaceAll("_", " ") ??
    queryModeLabel(queryMode);
  const sourceCount = answer.evidenceSummary?.total_sources ?? answer.sources?.length ?? answer.citations.length;
  const support = relevanceChipLabel(relevance ?? answer.relevance, answer.grounded);
  const sourceStatus = sourceGovernanceWarnings.length
    ? `${sourceGovernanceWarnings.length} source status note${sourceGovernanceWarnings.length === 1 ? "" : "s"}`
    : sourceStatusLabel(metadata);
  const retrievalGate = answer.retrievalDiagnostics?.gateStatus;
  const items = [
    { label: "Mode", value: modeLabel, icon: SlidersHorizontal },
    {
      label: "Support",
      value: support,
      icon: hasStrongRelevanceIcon(relevance ?? answer.relevance, answer.grounded) ? CheckCircle2 : AlertCircle,
    },
    { label: "Sources", value: String(sourceCount), icon: FileText },
    { label: "Confidence", value: answer.confidence, icon: Target },
    {
      label: "Retrieval",
      value: retrievalGate ? `${retrievalGate} gate` : "Not logged",
      icon: retrievalGate === "blocked" ? ShieldAlert : CheckCircle2,
    },
    { label: "Status", value: `${sourceStatus} / ${validationStatusLabel(metadata)}`, icon: BookOpen },
  ];

  return (
    <div
      data-testid="answer-insight-bar"
      className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2 sm:flex sm:flex-wrap sm:items-center"
      aria-label="Answer evidence summary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <span
            key={item.label}
            className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)]"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-[color:var(--primary)]" />
            <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
              {item.label}
            </span>
            <span className="min-w-0 truncate">{item.value}</span>
          </span>
        );
      })}
    </div>
  );
}

function EvidenceVerificationStrip({
  answer,
  bestSource,
  sourceSummary,
  weakEvidence,
  governanceWarningCount,
}: {
  answer: RagAnswer;
  bestSource: BestSourceRecommendation | null;
  sourceSummary?: EvidenceSummary | null;
  weakEvidence: boolean;
  governanceWarningCount: number;
}) {
  const metadata = normalizeSourceMetadata(
    bestSource?.source_metadata ?? answer.sources?.[0]?.source_metadata ?? answer.citations?.[0]?.source_metadata,
  );
  const sourceCount = sourceSummary?.total_sources ?? answer.sources?.length ?? answer.citations.length;
  const citationCount = answer.citations.length;
  const gapCount = answer.conflictsOrGaps?.length ?? answer.smartPanel?.conflictsOrGaps?.length ?? 0;
  const retrievalGateBlocked = answer.retrievalDiagnostics?.gateStatus === "blocked";
  const checks = [
    {
      label: "Citations",
      value: citationCount ? `${citationCount} citation${citationCount === 1 ? "" : "s"}` : "None",
      ready: citationCount > 0,
    },
    {
      label: "Sources",
      value: `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
      ready: sourceCount > 0,
    },
    {
      label: "Source status",
      value: sourceStatusLabel(metadata),
      ready: metadata.document_status === "current" && !governanceWarningCount,
    },
    {
      label: "Retrieval gate",
      value: retrievalGateBlocked ? "Blocked for low signal" : answer.retrievalDiagnostics ? "Passed" : "Not available",
      ready: !retrievalGateBlocked,
    },
    {
      label: "Gaps",
      value: governanceWarningCount
        ? `${governanceWarningCount} status note${governanceWarningCount === 1 ? "" : "s"}`
        : gapCount
          ? `${gapCount} gap${gapCount === 1 ? "" : "s"}`
          : "None",
      ready: !weakEvidence && !gapCount && !governanceWarningCount,
    },
  ];

  return (
    <section
      data-testid="evidence-verification-strip"
      className="grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-[var(--shadow-inset)] sm:grid-cols-[minmax(0,1fr)_auto]"
      aria-label="Evidence verification progress"
    >
      <div className="grid gap-2 sm:grid-cols-4">
        {checks.map((check) => (
          <div
            key={check.label}
            className="min-w-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2"
          >
            <div className="flex items-center gap-1.5">
              {check.ready ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
              )}
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                {check.label}
              </p>
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-[color:var(--text)]">{check.value}</p>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2 sm:max-w-72">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
          Pinned source
        </span>
        {bestSource ? (
          <>
            <span className="min-w-0 truncate text-xs font-semibold text-[color:var(--text)]">{bestSource.title}</span>
            <SourceStatusBadge metadata={bestSource.source_metadata} showTitle={false} />
          </>
        ) : (
          <span className="text-xs font-semibold text-[color:var(--text-muted)]">No pinned source yet</span>
        )}
      </div>
    </section>
  );
}

const answerFeedbackOptions: Array<{
  type: AnswerFeedbackType;
  label: string;
  icon: typeof CheckCircle2;
  tone: "success" | "warning" | "danger" | "neutral";
}> = [
  { type: "verified", label: "Verified", icon: CheckCircle2, tone: "success" },
  { type: "needs_correction", label: "Needs correction", icon: AlertCircle, tone: "warning" },
  { type: "source_insufficient", label: "Source insufficient", icon: ShieldAlert, tone: "warning" },
  { type: "wrong_source", label: "Wrong source", icon: FileText, tone: "danger" },
  { type: "missing_source", label: "Missing source", icon: Search, tone: "warning" },
  { type: "unsupported_answer", label: "Unsupported answer", icon: ShieldAlert, tone: "danger" },
  { type: "numeric_error", label: "Numeric error", icon: Target, tone: "danger" },
  { type: "outdated_guidance", label: "Outdated guidance", icon: RefreshCw, tone: "warning" },
];

function feedbackToneClass(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return toneSuccess;
  if (tone === "warning") return toneWarning;
  if (tone === "danger") return toneDanger;
  return toneNeutral;
}

function AnswerFeedbackPanel({
  pending,
  onSubmit,
}: {
  pending: AnswerFeedbackType | null;
  onSubmit: (feedbackType: AnswerFeedbackType) => void;
}) {
  return (
    <section
      data-testid="answer-review-panel"
      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
      aria-label="Answer review"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">Answer review</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Capture misses for retrieval and RAG evals without changing the answer.
          </p>
        </div>
        {pending ? (
          <span className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {answerFeedbackOptions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              disabled={Boolean(pending)}
              onClick={() => onSubmit(item.type)}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                feedbackToneClass(item.tone),
              )}
            >
              {pending === item.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RenderModelSourceList({
  sources,
  query,
  onScopeDocument,
}: {
  sources: SourceLink[];
  query: string;
  onScopeDocument: (documentId: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <EmptyState icon={FileText} title={emptyStates.sourcePassages.title} body={emptyStates.sourcePassages.body} />
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source, index) => {
        const metadata = normalizeSourceMetadata(source.sourceMetadata);
        const snippet = compactSourceSnippet(source.snippet ?? "");
        const openLabel = `Open source ${index + 1}: ${cleanDisplayTitle(source.title)}${query ? ` for ${query}` : ""}`;
        return (
          <article key={`${source.id}:${source.href}`} className={cn(sourceCard, "overflow-hidden p-0")}>
            <Link
              href={source.href}
              className="block min-h-[44px] px-3 py-3 transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              aria-label={openLabel}
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                <span className={sourceStatusDotClass(metadata)} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text-heading)]">
                    {cleanDisplayTitle(source.title)}
                  </p>
                  <p className={cn("mt-1 text-xs", textMuted)}>
                    p.{source.page_number ?? "n/a"} · {sourceStatusLabel(metadata)} · {source.sourceStrength} support
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
              </div>
              {snippet ? <p className={cn("mt-2 line-clamp-2 text-sm leading-6", textMuted)}>{snippet}</p> : null}
            </Link>
            <div className={cn(tableMicroActionRow, "justify-start border-t px-3 py-2")}>
              <button type="button" onClick={() => onScopeDocument(source.document_id)} className={chatMicroAction}>
                <Filter className="h-3.5 w-3.5" />
                Scope document
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function VerificationWorkspace({
  renderModel,
  query,
  answerEvidenceMapRows,
  pendingFeedback,
  onSubmitFeedback,
  onScopeDocument,
}: {
  renderModel: AnswerRenderModel;
  query: string;
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  pendingFeedback: AnswerFeedbackType | null;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  const verificationSources = renderModel.primarySources.slice(0, renderModel.trust === "unsupported" ? 3 : 6);
  return (
    <section
      data-testid="answer-verification-workspace"
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]"
    >
      <div className="space-y-3">
        <AnswerFeedbackPanel pending={pendingFeedback} onSubmit={onSubmitFeedback} />
        <div className={cn(panelSubtle, "p-3")}>
          <p className="text-sm font-semibold text-[color:var(--text)]">Section support map</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Each answer section should resolve back to a linked cited passage before clinical use.
          </p>
          <div className="mt-3">
            <EvidenceMapTable rows={answerEvidenceMapRows} />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className={cn(panelSubtle, "p-3")}>
          <p className="text-sm font-semibold text-[color:var(--text)]">Cited source excerpts</p>
          <p className={cn("mt-1 text-xs leading-5", textMuted)}>
            Open the document to inspect the PDF page and highlighted indexed passage.
          </p>
        </div>
        <RenderModelSourceList sources={verificationSources} query={query} onScopeDocument={onScopeDocument} />
      </div>
    </section>
  );
}

function AnswerViewModeControl({
  value,
  onChange,
}: {
  value: AnswerViewMode;
  onChange: (mode: AnswerViewMode) => void;
}) {
  const modes: Array<{ value: AnswerViewMode; label: string; shortLabel: string; icon: typeof Search }> = [
    { value: "standard", label: "Standard", shortLabel: "All", icon: ListChecks },
    { value: "high_yield", label: "High-yield", shortLabel: "Key", icon: Target },
    { value: "evidence_map", label: "Evidence map", shortLabel: "Map", icon: BookOpen },
  ];

  return (
    <div
      data-testid="answer-view-mode-control"
      className="flex w-full max-w-full flex-wrap rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)] sm:w-auto sm:flex-nowrap"
      role="group"
      aria-label="Answer detail view"
    >
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            aria-pressed={active}
            aria-label={`Show ${mode.label.toLowerCase()} answer view`}
            title={mode.label}
            className={cn(
              "inline-flex min-h-9 min-w-0 flex-1 basis-[4.75rem] items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition sm:flex-none sm:basis-auto sm:px-2.5",
              active
                ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-sm"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate sm:hidden">{mode.shortLabel}</span>
            <span className="hidden truncate sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const simpleClinicalTableProps = {
  compact: false,
  expandOnMobile: true,
} as const;

function compactEvidenceCell(value: string | null | undefined, max = 140) {
  const text = value ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function evidenceMapRowsFromRenderModel(renderModel: AnswerRenderModel): AnswerEvidenceMapRow[] {
  return renderModel.evidenceRows.map((row, index) => ({
    id: row.id || `${row.source.chunk_id}:${index}`,
    section: row.section || "Source evidence",
    detail:
      sourceTextForCompactDisplay(row.quote || row.source.snippet || row.source.reason || "") ||
      cleanDisplayTitle(row.source.title),
    supportLevel: row.supportLevel || row.source.sourceStrength,
    citationCount: 1,
    sourceStatus:
      row.source.sourceStrength === "none" ? "Source requires review" : `${row.source.sourceStrength} source support`,
    bestSourceLabel: row.source.label,
    bestLinkedPassage: row.quote || row.source.snippet || row.source.reason,
    href: row.source.href,
  }));
}

function EvidenceMapTable({ rows }: { rows: AnswerEvidenceMapRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={BookOpen} title={emptyStates.evidenceMap.title} body={emptyStates.evidenceMap.body} />;
  }

  const tableRows = rows.map((row) => [
    compactEvidenceCell(row.section),
    row.supportLevel,
    String(row.citationCount),
    compactEvidenceCell(row.sourceStatus),
    compactEvidenceCell(row.bestSourceLabel, 72),
    row.bestLinkedPassage || "Open source passage.",
  ]);
  const linkedRows = rows.filter((row) => row.href);

  return (
    <div data-testid="answer-evidence-map" className="space-y-3">
      <AccessibleTable
        caption="Source support by answer section"
        columns={["Section", "Support level", "Citations", "Evidence status", "Top source", "Passage sample"]}
        rows={tableRows}
        dialogTitle="Source support by answer section"
        {...simpleClinicalTableProps}
      />
      {linkedRows.length ? (
        <div className="grid gap-2" aria-label="Evidence map source actions">
          {linkedRows.map((row) => (
            <Link
              key={`${row.id}:${row.href}`}
              href={row.href!}
              data-testid="evidence-map-open-source"
              className={cn(
                sourceCard,
                "grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm transition hover:border-[color:var(--primary)]/45 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              )}
              aria-label={`Open source for ${row.section}: ${row.bestSourceLabel}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[color:var(--text-heading)]">{row.section}</span>
                <span className={cn("block truncate text-xs", textMuted)}>{row.bestSourceLabel}</span>
              </span>
              <span className={cn(chatMicroAction, "pointer-events-none min-h-9 px-2 text-xs")}>
                Open source
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AnswerSafetyNotice({
  demoMode,
  weakEvidence = false,
  retrievalDiagnostics,
}: {
  demoMode: boolean;
  weakEvidence?: boolean;
  retrievalDiagnostics?: RagAnswer["retrievalDiagnostics"];
}) {
  const retrievalGateBlocked = retrievalDiagnostics?.gateStatus === "blocked";
  return (
    <div
      data-testid="answer-safety-notice"
      className={cn(
        "rounded-lg border p-3 text-sm leading-6",
        weakEvidence
          ? "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/45"
          : "border-[color:var(--border)] bg-[color:var(--surface)]",
      )}
    >
      <p className="font-semibold text-[color:var(--text)]">
        {weakEvidence
          ? "Weak source support; verify the linked source before relying on this answer."
          : "Draft only; verify source first before pasting into the medical record."}
      </p>
      {retrievalGateBlocked ? (
        <p className="mt-1 font-semibold text-[color:var(--warning)]">
          Retrieval confidence gate was triggered (low-confidence retrieval signal). Expand evidence details before
          using this result.
        </p>
      ) : null}
      {demoMode ? (
        <p className="mt-1 font-semibold text-[color:var(--warning)]">
          Synthetic demo only: this is not clinical guidance.
        </p>
      ) : null}
    </div>
  );
}

function QuoteCards({
  quotes,
  copiedQuotes,
  onCopyQuotes,
  onFollowUp,
  onScopeDocument,
}: {
  quotes: QuoteCard[];
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onFollowUp?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  return (
    <section id="quotes" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
      <SectionHeading
        icon={Quote}
        title="Source quotes"
        description="Verbatim excerpts linked to the source PDF and page."
        hideDescriptionOnMobile
        compactMobile
        action={
          quotes.length > 0 ? (
            <CopyButton label="Copy exact quotes" shortLabel="Quotes" copied={copiedQuotes} onClick={onCopyQuotes} />
          ) : null
        }
      />
      {quotes.length === 0 ? (
        <EmptyState icon={Quote} title={emptyStates.exactQuotes.title} body={emptyStates.exactQuotes.body} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {quotes.map((quote, index) => {
            const quoteText = sourceTextForVerbatimQuote(quote.quote);
            const quoteTitle = cleanDisplayTitle(quote.title);
            return (
              <article key={`${quote.chunk_id}:${quote.quote}`} className={cn(sourceCard, "p-3 sm:p-4")}>
                <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                  <span className={cn(iconTilePremium, codeText, "h-7 w-7 text-xs font-bold sm:h-8 sm:w-8")}>
                    {index + 1}
                  </span>
                  <StrengthBadge strength={quote.source_strength} />
                </div>
                <blockquote className={cn(proseMeasure, "text-[15px] font-medium leading-6 text-[color:var(--text)]")}>
                  &ldquo;{quoteText}&rdquo;
                </blockquote>
                <div
                  className={cn(
                    "mt-3 flex flex-wrap items-center justify-between gap-2 pt-3 sm:mt-4 sm:gap-3",
                    clinicalDivider,
                  )}
                >
                  <span className="max-w-full text-[15px] font-semibold leading-6 text-[color:var(--primary)] sm:hidden">
                    {formatCompactCitationLabel(quote)}
                  </span>
                  <span className="hidden max-w-full text-xs font-semibold leading-5 text-[color:var(--primary)] sm:inline">
                    {quoteTitle}, page {quote.page_number ?? "n/a"}
                  </span>
                  <div className="w-full sm:w-auto">
                    <SourceActionRow
                      viewerHref={documentCitationHref(quote)}
                      sourceTitle={`quote ${index + 1} from ${quoteTitle}`}
                      documentId={quote.document_id}
                      onScopeDocument={onScopeDocument}
                      onFollowUp={onFollowUp ? () => onFollowUp(quote) : undefined}
                      divider={false}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatQuoteCardsForClipboard(quotes: QuoteCard[]) {
  return quotes
    .map((quote, index) =>
      [
        // Clean the copied text the same way the card displays it, so clipboard
        // output never contains internal image-data blocks or glyph artifacts.
        `${index + 1}. "${sourceTextForVerbatimQuote(quote.quote)}"`,
        `Source: ${formatCitationLabel(quote)}`,
        `Link: ${documentCitationHref(quote)}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function ClinicalOutputPanel({
  answer,
  collapsed = false,
  showLead = true,
  viewMode = "standard",
  onViewModeChange,
  evidenceMapRows,
}: {
  answer: RagAnswer;
  collapsed?: boolean;
  showLead?: boolean;
  viewMode?: AnswerViewMode;
  onViewModeChange?: (mode: AnswerViewMode) => void;
  evidenceMapRows?: AnswerEvidenceMapRow[];
}) {
  const sections =
    viewMode === "high_yield" ? buildHighYieldClinicalOutputSections(answer) : buildClinicalOutputSections(answer);
  const rows = evidenceMapRows ?? buildAnswerEvidenceMap(answer);
  if (sections.length === 0 && (viewMode !== "evidence_map" || rows.length === 0)) return null;
  const leadSection = sections.find((section) => section.id === "bottom-line") ?? sections[0];
  const primaryAnswer = plainAnswerText(answer.answer);
  const detailSections = sections
    .filter((section) => section.id !== "verify-source")
    .filter((section) => (showLead ? section.id !== leadSection?.id : section.id !== "bottom-line"))
    .map((section) => ({
      ...section,
      items: displayItemsForClinicalDetailSection(section, primaryAnswer, showLead),
    }))
    .filter((section) => section.items.length > 0 || Boolean(section.tables?.length));
  const orderedDetailSections = sortClinicalDetailSections(detailSections);
  const summaryItems = clinicalDetailSummaryItems(orderedDetailSections);
  const title =
    viewMode === "evidence_map"
      ? "Evidence map"
      : viewMode === "high_yield"
        ? "High-yield clinical details"
        : showLead
          ? "Clinical answer"
          : "Structured clinical details";
  const description =
    viewMode === "evidence_map"
      ? "Mapped answer sections to linked source support and source status."
      : viewMode === "high_yield"
        ? "Actions, thresholds, cautions, escalation triggers, monitoring, and dose details."
        : showLead
          ? "Dense source-backed structure for review."
          : "Adaptive source-backed support below the concise answer.";

  const content = (
    <section data-testid="clinical-action-view" className={cn(panelSubtle, "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          icon={ListChecks}
          title={title}
          description={description}
          action={onViewModeChange ? <AnswerViewModeControl value={viewMode} onChange={onViewModeChange} /> : undefined}
          hideDescriptionOnMobile
          compactMobile
        />
      </div>
      {summaryItems.length ? (
        <div
          data-testid="clinical-detail-summary"
          className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
          aria-label="High-yield clinical detail summary"
        >
          {summaryItems.map((item) => (
            <span
              key={item.label}
              className={cn(
                subtleStatusPill,
                "min-h-12 min-w-0 justify-between gap-2 rounded-lg px-3 py-2 text-left sm:min-h-9",
              )}
            >
              <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.06em]">{item.label}</span>
              <span className="shrink-0 text-sm font-bold text-[color:var(--text-heading)]">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {showLead && leadSection ? (
        <div className="mt-3 rounded-md border border-[color:var(--primary)]/15 bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
          <div className="flex items-start gap-2.5">
            <span className={cn(iconTilePremium, "h-8 w-8 text-[color:var(--primary)]")}>
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--primary)]">
                {leadSection.title}
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-6 text-[color:var(--text-heading)]">
                <SafeBoldText text={leadSection.items[0] ?? "Review the source-backed answer and citations."} />
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {viewMode === "evidence_map" ? (
        <div className="mt-3">
          <EvidenceMapTable rows={rows} />
        </div>
      ) : orderedDetailSections.length ? (
        <div
          className={cn(
            "mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3",
            showLead && "border-t border-[color:var(--border)] pt-3",
          )}
        >
          {orderedDetailSections.map((section) => {
            const isWide = section.id === "thresholds" || Boolean(section.tables?.length);
            const itemCount = clinicalDetailContentCount(section);
            const meta = clinicalDetailMeta(section);
            const Icon = meta.icon;
            return (
              <article
                key={section.id}
                data-testid="clinical-detail-card"
                className={cn(
                  "min-w-0 rounded-lg border border-[color:var(--border)]/80 bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
                  isWide && "md:col-span-2 xl:col-span-3",
                )}
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                        meta.toneClassName,
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-soft)]">
                        {meta.eyebrow}
                      </p>
                      <h3 className="truncate text-sm font-semibold text-[color:var(--text-heading)]">
                        {section.title}
                      </h3>
                    </div>
                  </div>
                  <span className={cn(metadataPill, "min-h-7 shrink-0 px-2 text-[10px]")}>{itemCount}</span>
                </div>
                {section.tables?.length ? (
                  <div className="mt-3 grid gap-3">
                    {section.tables.map((table) => (
                      <div key={table.id} data-testid="clinical-detail-table" className="min-w-0 space-y-2">
                        <AccessibleTable
                          caption={table.caption}
                          markdown={table.markdown}
                          rows={table.rows}
                          columns={table.columns}
                          {...simpleClinicalTableProps}
                          clinicalOnly
                          dialogTitle={table.caption || "Clinical table"}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {section.items.length ? (
                  <ul className="mt-3 grid gap-2 text-[15px] leading-6 text-[color:var(--text)]">
                    {section.items.map((item, index) => (
                      <li
                        key={`${section.id}:${index}:${item.slice(0, 48)}`}
                        className="grid min-h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-[color:var(--border)]/70 bg-[color:var(--surface-raised)] px-3 py-2 shadow-[var(--shadow-inset)] sm:min-h-9"
                      >
                        <span
                          className={cn("mt-1 h-4 w-1 shrink-0 rounded-full", meta.accentClassName)}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 break-words">
                          <SafeBoldText text={item} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );

  if (collapsed) {
    return (
      <UtilityDrawer
        icon={ListChecks}
        title="Clinical answer"
        summary="Collapsed because direct source support was not found."
        mobileSummary="Clinical formats"
      >
        {content}
      </UtilityDrawer>
    );
  }

  return content;
}

function WhyThisMatchedPanel({ sources }: { sources: SearchResult[] }) {
  const visibleSources = sources.slice(0, 3);
  if (visibleSources.length === 0) return null;

  return (
    <details data-testid="why-this-matched" className={cn("group rounded-lg", panelSubtle)}>
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn(iconTilePremium, "h-8 w-8")}>
            <Search className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">Why this matched</span>
            <span className={cn("block truncate text-xs", textMuted)}>
              Match signals, source strength, and term coverage for top passages
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-2 border-t border-[color:var(--border)] p-3">
        {visibleSources.map((source) => (
          <article
            key={source.id}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-[color:var(--text)]">
                  {cleanDisplayTitle(source.title)}
                </p>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  <span className="font-mono tabular-nums">page {source.page_number ?? "n/a"}</span> ·{" "}
                  <span className="font-mono tabular-nums">chunk {source.chunk_index}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <RelevanceBadge relevance={source.relevance} />
                <StrengthBadge strength={source.source_strength} />
                <SourceStatusBadge metadata={source.source_metadata} />
              </div>
            </div>
            <MatchExplanationChips source={source} />
            {source.index_unit ? (
              <p
                className={cn(
                  "mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1.5 text-xs leading-5",
                  textMuted,
                )}
              >
                <span className="font-semibold text-[color:var(--text)]">
                  {source.index_unit.unit_type.replaceAll("_", " ")}:
                </span>{" "}
                {source.index_unit.title}
              </p>
            ) : null}
            <div className="mt-2">
              <QueryCoverageChips relevance={source.relevance} limit={5} />
            </div>
          </article>
        ))}
      </div>
    </details>
  );
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
  Tables: ListChecks,
  Sources: Layers,
  Images: FileImage,
  Quotes: Quote,
  PDFs: FileText,
  Map: BookOpen,
};

function MobileEvidenceSheetContent({
  answer,
  sources,
  renderModel,
  query,
  visualEvidence,
  answerEvidenceMapRows,
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
  query: string;
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  initialTab?: EvidenceTabName | null;
  pendingFeedback: AnswerFeedbackType | null;
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  const order = evidenceTabOrder(answer, renderModel);
  const pdfSources = uniquePdfSourcesForRenderModel(renderModel).slice(0, 6);
  const [selectedTab, setSelectedTab] = useState<EvidenceTabName | null>(() => initialTab ?? null);
  const activeTab = selectedTab && order.includes(selectedTab) ? selectedTab : order[0];
  const panelIdFor = (tab: EvidenceTabName) => `mobile-evidence-panel-${tab.toLowerCase()}`;

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
              pdfSources,
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
                  "inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition sm:min-h-10",
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
                  query={query}
                  visualEvidence={visualEvidence}
                  answerEvidenceMapRows={answerEvidenceMapRows}
                  pdfSources={pdfSources}
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
      <AnswerFeedbackPanel pending={pendingFeedback} onSubmit={onSubmitFeedback} />
    </div>
  );
}

function MobileEvidenceTabPanel({
  tab,
  renderModel,
  query,
  visualEvidence,
  answerEvidenceMapRows,
  pdfSources,
  copiedQuotes,
  onCopyQuotes,
  onFollowUpQuote,
  onScopeDocument,
}: {
  tab: EvidenceTabName;
  renderModel: AnswerRenderModel;
  query: string;
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  pdfSources: RenderModelPdfSource[];
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
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

  if (tab === "Sources") {
    return (
      <RenderModelSourceList
        sources={renderModel.primarySources.slice(0, 4)}
        query={query}
        onScopeDocument={onScopeDocument}
      />
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

  if (tab === "PDFs") {
    return pdfSources.length ? (
      <div className="grid gap-2">
        {pdfSources.map((source, index) => (
          <Link
            key={`${source.document_id}:${source.file_name}:${index}`}
            href={`/documents/${source.document_id}?page=${source.page_number ?? 1}&chunk=${"id" in source ? source.id : (source.chunk_id ?? "")}`}
            className={cn(sourceCard, "flex min-h-[52px] items-center justify-between gap-3 p-3")}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[color:var(--text)]">
                {cleanDisplayTitle(source.title)}
              </span>
              <span className={cn("block truncate text-xs", textMuted)}>
                {index === 0 ? "Main source" : "Supporting source"} · page {source.page_number ?? "n/a"}
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
          </Link>
        ))}
      </div>
    ) : (
      <EmptyState icon={FileText} title={emptyStates.pdfsUsed.title} body={emptyStates.pdfsUsed.body} />
    );
  }

  return <EvidenceMapTable rows={answerEvidenceMapRows} />;
}

function UnifiedEvidenceDrawerContent({
  answer,
  renderModel,
  query,
  visualEvidence,
  answerEvidenceMapRows,
  pendingFeedback,
  copiedQuotes,
  onCopyQuotes,
  onSubmitFeedback,
  onFollowUpQuote,
  onScopeDocument,
}: {
  answer: RagAnswer;
  renderModel: AnswerRenderModel;
  query: string;
  visualEvidence: VisualEvidenceCard[];
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  pendingFeedback: AnswerFeedbackType | null;
  copiedQuotes: boolean;
  onCopyQuotes: () => void;
  onSubmitFeedback: (feedbackType: AnswerFeedbackType) => void;
  onFollowUpQuote?: (quote: QuoteCard) => void;
  onScopeDocument: (documentId: string) => void;
}) {
  const order = evidenceTabOrder(answer, renderModel);
  const pdfSources = uniquePdfSourcesForRenderModel(renderModel).slice(0, 6);

  return (
    <div className="space-y-4">
      <VerificationWorkspace
        renderModel={renderModel}
        query={query}
        answerEvidenceMapRows={answerEvidenceMapRows}
        pendingFeedback={pendingFeedback}
        onSubmitFeedback={onSubmitFeedback}
        onScopeDocument={onScopeDocument}
      />

      <div className="flex flex-wrap gap-1.5" aria-label="Evidence sections">
        {order.map((item) => (
          <span key={item} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
            {item}
          </span>
        ))}
      </div>

      {order.map((section) => {
        if (section === "Tables") {
          return (
            <section key={section} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Tables</p>
              {visualEvidence.some((item) => item.accessibleTableMarkdown || item.tableRows?.length) ? (
                <div className="grid gap-2">
                  {visualEvidence
                    .filter((item) => item.accessibleTableMarkdown || item.tableRows?.length)
                    .slice(0, 3)
                    .map((item) => (
                      <div key={item.id} className={cn(tableCard, "p-3")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[color:var(--text-heading)]">
                            {compactClinicalTableCaption(item)}
                          </p>
                          <span className={cn(metadataPill, "text-[11px]")}>p.{item.page_number ?? "n/a"}</span>
                        </div>
                        <div className={cn(tableMicroActionRow, "mt-2 border-t-0 px-0")}>
                          <Link href={item.viewer_href} className={chatMicroAction}>
                            Expand
                          </Link>
                          <Link href={item.viewer_href} className={chatMicroAction}>
                            Source
                          </Link>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState icon={ListChecks} title={emptyStates.tablesUsed.title} body={emptyStates.tablesUsed.body} />
              )}
            </section>
          );
        }

        if (section === "Sources") {
          return (
            <section key={section} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Sources</p>
              <RenderModelSourceList
                sources={renderModel.primarySources.slice(0, 4)}
                query={query}
                onScopeDocument={onScopeDocument}
              />
            </section>
          );
        }

        if (section === "Images") {
          return (
            <section key={section} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Images</p>
              <UtilityDrawer
                icon={FileImage}
                title={`Images ${visualEvidence.length}`}
                summary="Open to view table images, PDF page crops, and figures."
                mobileSummary={`${visualEvidence.length} images`}
              >
                <VisualEvidenceStrip evidence={visualEvidence} embedded />
              </UtilityDrawer>
            </section>
          );
        }

        if (section === "Quotes") {
          return (
            <section key={section} className="space-y-2">
              <QuoteCards
                quotes={renderModel.quoteCards}
                copiedQuotes={copiedQuotes}
                onCopyQuotes={onCopyQuotes}
                onFollowUp={onFollowUpQuote}
                onScopeDocument={onScopeDocument}
              />
            </section>
          );
        }

        if (section === "PDFs") {
          return (
            <section key={section} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">PDFs used</p>
              {pdfSources.length ? (
                <div className="grid gap-2">
                  {pdfSources.map((source, index) => (
                    <Link
                      key={`${source.document_id}:${source.file_name}:${index}`}
                      href={`/documents/${source.document_id}?page=${source.page_number ?? 1}&chunk=${"id" in source ? source.id : (source.chunk_id ?? "")}`}
                      className={cn(sourceCard, "flex min-h-[52px] items-center justify-between gap-3 p-3")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[color:var(--text)]">
                          {cleanDisplayTitle(source.title)}
                        </span>
                        <span className={cn("block truncate text-xs", textMuted)}>
                          {index === 0 ? "Main source" : "Supporting source"} · page {source.page_number ?? "n/a"}
                        </span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText} title={emptyStates.pdfsUsed.title} body={emptyStates.pdfsUsed.body} />
              )}
            </section>
          );
        }

        return (
          <section key={section} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">Evidence map</p>
            <EvidenceMapTable rows={answerEvidenceMapRows} />
          </section>
        );
      })}
    </div>
  );
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
  currentRelevance,
  queryMode,
  sourceGovernanceWarnings,
  sourceSummary,
  renderModel,
  weakEvidence,
  groupedGovernanceWarningCount,
  answerViewMode,
  answerEvidenceMapRows,
  onScopeDocument,
  answerGrounded,
  sources,
  gaps,
  searchScope,
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
  currentRelevance: EvidenceRelevance | null | undefined;
  queryMode: ClinicalQueryMode;
  sourceGovernanceWarnings: SourceGovernanceWarning[];
  sourceSummary?: EvidenceSummary;
  renderModel: AnswerRenderModel;
  weakEvidence: boolean;
  groupedGovernanceWarningCount: number;
  answerViewMode: AnswerViewMode;
  answerEvidenceMapRows: AnswerEvidenceMapRow[];
  onScopeDocument: (documentId: string) => void;
  answerGrounded: boolean;
  sources: SearchResult[];
  gaps: ConflictOrGap[];
  searchScope: SearchScopeSummary | null;
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
  const [copiedQuotes, setCopiedQuotes] = useState(false);
  const copyQuotesTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copyQuotesTimerRef.current !== null) window.clearTimeout(copyQuotesTimerRef.current);
    };
  }, []);
  const openTableEvidence = useCallback(() => {
    setClinicalNotesOpen(false);
    setEvidenceInitialTab("Tables");
    setEvidenceOpen(true);
  }, [setClinicalNotesOpen, setEvidenceInitialTab, setEvidenceOpen]);
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

  return (
    <div className="min-w-0 space-y-4 motion-safe:animate-fade-up sm:space-y-5" data-dashboard-stage="answer-surface">
      <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
        <UserQuestionBubble query={query} />

        <div
          data-testid="table-specific-answer-layout"
          data-desktop-table-aside={centralTable ? "true" : "false"}
          className={cn(
            "space-y-3",
            centralTable &&
              "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.78fr)] lg:items-start lg:gap-4 lg:space-y-0",
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

            <KeyClinicalItems sections={safeAnswerSections} table={centralTable} />
          </div>

          {centralTable ? (
            <div className="min-w-0 lg:sticky lg:top-24">
              <InlineTableCard item={centralTable} />
            </div>
          ) : null}
        </div>

        {showClinicalNotes ? (
          <UtilityDrawer
            id="answer-clinical-notes-drawer"
            icon={ClipboardCheck}
            title="Clinical notes"
            summary="Monitoring, safety, escalation, or caution details when clinically useful."
            mobileSummary={`${clinicalNoteDisplayCount} note${clinicalNoteDisplayCount === 1 ? "" : "s"} · Source-backed`}
            className={clinicalNotesRow}
            open={clinicalNotesOpen}
            onOpenChange={(open) => {
              if (open) setEvidenceOpen(false);
              setClinicalNotesOpen(open);
            }}
            sheetHeaderLeading={
              <span className={cn(iconTilePremium, "h-8 w-8 rounded-lg text-[color:var(--primary)]")}>
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
            }
            sheetTitleAccessory={
              <span className="nums grid h-5 min-w-5 place-items-center rounded border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] px-1 text-[11px] font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
                {clinicalNoteDisplayCount}
              </span>
            }
            sheetDescriptionContent={
              <span className="inline-flex min-h-5 items-center gap-1.5 text-[11px] font-semibold text-[color:var(--primary)]">
                <ShieldCheck className="h-3 w-3" />
                Source-backed
              </span>
            }
            sheetHeaderActions={
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
            sheetDescription={null}
            sheetHeaderClassName="gap-2 p-2.5 sm:p-3"
            sheetTitleClassName="text-[15px] leading-5"
            sheetCloseButtonClassName="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            sheetChildrenClassName="flex min-h-0 flex-1 flex-col"
            sheetContentClassName="max-h-[92dvh] translate-y-0 bg-[color:var(--surface-raised)] motion-safe:animate-none sm:h-auto sm:max-h-[88dvh] sm:max-w-lg"
            sheetContentStyle={{ height: "80dvh" }}
            sheetBodyClassName="flex flex-col bg-[color:var(--surface-raised)] px-3 pb-0 pt-2 sm:p-3"
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
          </UtilityDrawer>
        ) : null}

        {showEvidenceDrawer ? (
          <UtilityDrawer
            id="answer-evidence-drawer"
            icon={Layers}
            title="Evidence"
            summary={compactEvidenceSummary(answer, sources, sourceSummary, renderModel)}
            mobileSummary={compactEvidenceSummary(answer, sources, sourceSummary, renderModel)}
            className={evidenceRow}
            open={evidenceOpen}
            onOpenChange={(open) => {
              if (open) setClinicalNotesOpen(false);
              setEvidenceOpen(open);
              if (!open) setEvidenceInitialTab(null);
            }}
          >
            <div className="sm:hidden">
              <MobileEvidenceSheetContent
                answer={answer}
                sources={sources}
                renderModel={renderModel}
                query={query}
                visualEvidence={renderModel.visualEvidence}
                answerEvidenceMapRows={answerEvidenceMapRows}
                initialTab={evidenceInitialTab}
                pendingFeedback={pendingFeedback}
                copiedQuotes={copiedQuotes}
                onCopyQuotes={copyQuotes}
                onSubmitFeedback={onSubmitFeedback}
                onScopeDocument={onScopeDocument}
              />
            </div>
            <div className="hidden space-y-3 sm:block">
              {renderModelAllows(renderModel, "sourceStatus") ? (
                <>
                  <AnswerInsightBar
                    answer={answer}
                    bestSource={bestSource}
                    relevance={currentRelevance}
                    queryMode={queryMode}
                    sourceGovernanceWarnings={sourceGovernanceWarnings}
                  />
                  <EvidenceVerificationStrip
                    answer={answer}
                    bestSource={bestSource}
                    sourceSummary={sourceSummary}
                    weakEvidence={weakEvidence}
                    governanceWarningCount={groupedGovernanceWarningCount}
                  />
                </>
              ) : null}
              {renderModelAllows(renderModel, "reviewSources") ? (
                <EvidenceSummaryCard
                  answer={answer}
                  bestSource={bestSource}
                  grounded={answerGrounded}
                  relevance={currentRelevance}
                  sourceSummary={sourceSummary}
                  weakEvidence={weakEvidence}
                  sources={sources}
                  gaps={gaps}
                  onScopeDocument={onScopeDocument}
                  supporting
                />
              ) : null}
              {renderModelAllows(renderModel, "warnings") ? (
                <>
                  <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
                  <AnswerSafetyNotice
                    demoMode={demoMode}
                    weakEvidence={weakEvidence}
                    retrievalDiagnostics={answer.retrievalDiagnostics}
                  />
                  <EvidenceGapPanel relevance={currentRelevance} sources={sources} query={query} />
                </>
              ) : null}
              {renderModelAllows(renderModel, "diagnostics") ? <WhyThisMatchedPanel sources={sources} /> : null}
              <UnifiedEvidenceDrawerContent
                answer={answer}
                renderModel={renderModel}
                query={query}
                visualEvidence={renderModel.visualEvidence}
                answerEvidenceMapRows={answerEvidenceMapRows}
                pendingFeedback={pendingFeedback}
                copiedQuotes={copiedQuotes}
                onCopyQuotes={copyQuotes}
                onSubmitFeedback={onSubmitFeedback}
                onScopeDocument={onScopeDocument}
              />
            </div>
          </UtilityDrawer>
        ) : null}
      </div>

      <SafetyFindingsPanel findings={safetyFindings} />
    </div>
  );
}

function AuthPanel() {
  const { status, error, isConfigured, signInWithEmail, signOut, session } = useAuthSession();
  const savedEmail = useSyncExternalStore(subscribeAuthEmail, getAuthEmailSnapshot, getServerAuthEmailSnapshot);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const email = draftEmail ?? savedEmail;
  const busy = status === "loading";
  const isExpired = status === "expired";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    await signInWithEmail(email.trim());
  }

  if (!isConfigured) {
    return (
      <div className={cn(panelSubtle, "p-3")}>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Real-data sign-in unavailable</p>
            <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
              Configure the Supabase public URL and publishable key before using private documents.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className={cn(panelSubtle, "p-3")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Signed in for private documents</p>
            <p className={cn("mt-1 text-xs leading-5", textMuted)}>{session?.user.email ?? "Authenticated session"}</p>
          </div>
          <button type="button" onClick={signOut} className={cn(floatingControl, "px-3 text-xs")}>
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn(panelSubtle, "space-y-3 p-3")}>
      <div className="flex items-start gap-3">
        <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--primary)]" />
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">
            {isExpired ? "Sign-in link expired" : "Sign in for private documents"}
          </p>
          <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
            {isExpired
              ? "Send a fresh link if this one failed or already timed out."
              : "Real-data search, upload, and source previews require a Supabase Auth session."}
          </p>
        </div>
      </div>
      <label className="block">
        <span className={fieldLabel}>Email address</span>
        <div className="relative">
          <Mail className={fieldIcon} />
          <input
            type="email"
            value={email}
            onChange={(event) => setDraftEmail(event.target.value)}
            placeholder="you@example.com"
            className={fieldControlWithIcon}
          />
        </div>
      </label>
      <button type="submit" disabled={busy || !email.trim()} className={cn(primaryControl, "w-full")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Send sign-in link
      </button>
      {error && (
        <p
          role="alert"
          className={cn(
            "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 text-xs",
            textMuted,
          )}
        >
          {error}
        </p>
      )}
    </form>
  );
}

const tagQualityTone: Record<SmartDocumentTagQualityIssueKind, string> = {
  noisy: toneDanger,
  duplicate: toneWarning,
  low_confidence: toneInfo,
  overused: toneNeutral,
};

function tagQualityLabel(kind: SmartDocumentTagQualityIssueKind) {
  if (kind === "low_confidence") return "low confidence";
  return kind;
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
  const modeLabel =
    mode === "recent"
      ? "Recent documents"
      : mode === "source"
        ? "Source PDFs"
        : mode === "admin"
          ? statusFilterLabel(statusFilter)
          : "Source library";
  const modeSummary =
    mode === "recent"
      ? "Recently updated indexed sources."
      : mode === "source"
        ? "PDF source documents ready to open."
        : mode === "admin"
          ? "Document maintenance and indexing tools."
          : "Search and open indexed clinical sources.";
  const filterValue = filter.toLowerCase();

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

  return (
    <div className="space-y-3">
      <div className={cn(panelSubtle, "flex flex-wrap items-center justify-between gap-2 p-3")}>
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">{modeLabel}</p>
          <p className={cn("text-xs", textMuted)}>
            {modeSummary} {filtered.length} matching document{filtered.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>
      <label className="relative block">
        <Search className={fieldIcon} />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={mode === "source" ? "Find a source PDF" : "Find a document"}
          className={fieldControlWithIcon}
        />
      </label>

      {/* Dynamic Browse Library Filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
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
          <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">Site</label>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
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
          <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">Topic</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
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
          <label className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-soft)]">
            Population
          </label>
          <select
            value={selectedPopulation}
            onChange={(e) => setSelectedPopulation(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] focus:border-[color:var(--primary)] focus:outline-none"
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
                className={fieldControlPlain}
              />
              <input
                value={metadataDraft.sourceType}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, sourceType: event.target.value }))}
                placeholder="Source type"
                className={fieldControlPlain}
              />
              <input
                value={metadataDraft.category}
                onChange={(event) => setMetadataDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="Category"
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
  const currentThemeLabel = theme === "dark" ? "Dark" : "Light";
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

        <div className="mx-auto min-h-0 w-full max-w-[460px] overflow-y-auto px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[max(2.45rem,calc(0.7rem+env(safe-area-inset-top)))] polished-scroll sm:px-5 lg:mx-0 lg:max-w-none lg:px-7 lg:pb-7 lg:pt-6">
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

          <section className="rounded-[1.35rem] border border-[color:var(--border-lux)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-lux)_96%,transparent_4%)_0%,color-mix(in_srgb,var(--surface-lux)_88%,var(--background))_100%)] p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.06),var(--shadow-inset)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32),var(--shadow-inset)] lg:rounded-xl lg:bg-[color:var(--surface)] lg:p-3.5 lg:shadow-[var(--shadow-inset)]">
            <div className="flex items-center gap-3 lg:gap-3">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-sm font-bold leading-none text-[color:var(--clinical-accent)] ring-1 ring-[color:var(--clinical-accent)]/10 lg:h-11 lg:w-11">
                {identity.initials}
                {identity.signedIn ? (
                  <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--success)]" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-[11px] font-semibold leading-4 text-[color:var(--clinical-accent)] lg:hidden">
                  Clinical context
                </p>
                <p className="truncate text-[15px] font-semibold leading-5 text-[color:var(--text-heading)] lg:text-[15px]">
                  {identity.displayName}
                </p>
                <p className="text-[12px] font-medium leading-4 text-[color:var(--text-muted)] lg:truncate lg:text-[13px] lg:leading-5">
                  Consultant psychiatrist, Western Australia
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 lg:flex">
                <SettingsChip label="Private" />
                <SettingsChip label="No PHI" />
              </div>
            </div>
            <SettingsClinicalContextStrip />
          </section>

          <div className="hidden lg:mt-4 lg:grid lg:grid-cols-3 lg:gap-3">
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
}: {
  query: string;
  onQueryChange: (nextQuery: string) => void;
  desktopComposerSlotId?: string;
}) {
  return (
    <ApplicationsLauncherWorkspace
      variant="dashboard-tools"
      query={query}
      onQueryChange={onQueryChange}
      desktopComposerSlotId={desktopComposerSlotId}
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
  const mainRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const navSyncLockRef = useRef<number | null>(null);
  const autoRunSearchSignatureRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const nextWorkStatePollRef = useRef(0);
  const urlSearchBootstrappedRef = useRef(false);
  const urlDocumentSearchBootstrappedRef = useRef(false);
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
  const serviceSearchMatches = useMemo(
    () => (searchMode === "services" ? searchServiceRecords(query) : []),
    [query, searchMode],
  );
  const formSearchMatches = useMemo(
    () => (searchMode === "forms" ? searchFormRecords(query) : []),
    [query, searchMode],
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
  const storedSessionExists =
    typeof window !== "undefined" &&
    Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  const localDevCanAttemptPrivateApis = process.env.NODE_ENV !== "production" && hasReadyPublicSearchSetup(setupChecks);
  const canUsePrivateApis =
    localProjectReady &&
    (localNoAuthMode ||
      localDevCanAttemptPrivateApis ||
      authStatus === "authenticated" ||
      (supabaseEnvStatus === "ready" && storedSessionExists));
  const canRunSearch = explicitDemoMode || (hasReadyPublicSearchSetup(setupChecks) && canUsePrivateApis);
  const closeDashboardTransientSurfaces = useCallback(
    (except?: "guide" | "settings" | "mobileSidebar" | "documents" | "upload") => {
      if (except !== "guide") setGuideOpen(false);
      if (except !== "settings") setSettingsOpen(false);
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
    if (modeSearch.kind !== "tools" && modeSearch.kind !== "favourites" && !canRunSearch) return;
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

    setSearchMode(targetMode);
    setQuery(trimmedQuery);
    if (modeSearch.kind !== "tools") setModeSearchSubmitted(true);
    if (isDifferentialsMode) clearDifferentialModeResultState();

    if (modeSearch.kind === "tools") {
      setError(null);
      rememberRecentQuery(trimmedQuery);
      setActionNotice({ tone: "success", message: "Tools filtered from the composer." });
      return;
    }
    if (modeSearch.kind === "favourites") {
      setError(null);
      rememberRecentQuery(trimmedQuery);
      setActionNotice({ tone: "success", message: "Favourites filtered from the composer." });
      return;
    }
    if (!canRunSearch) {
      setError(errorCopy.searchSetupNotReady);
      return;
    }
    const requestId = ++searchRequestSeqRef.current;
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
    await executeSearch(query, searchMode, scopeFilters);
  }

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!autoRunSearch || !trimmedQuery || !canRunSearch || loading) return;
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
    window.requestAnimationFrame(() => {
      document.getElementById("dashboard-documents-drawer")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
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
  const gaps = answer?.conflictsOrGaps ?? answer?.smartPanel?.conflictsOrGaps ?? [];
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
    () => groupSourceGovernanceWarnings(sourceGovernanceWarnings).reduce((total, warning) => total + warning.count, 0),
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
    : indexedDocumentTotal
      ? documentsDrawerMode === "recent"
        ? `${indexedDocumentTotal.toLocaleString()} indexed sources, sorted by recent updates`
        : documentsDrawerMode === "source"
          ? "Open original PDF source documents"
          : documentsDrawerIsAdmin
            ? `${indexedDocumentTotal.toLocaleString()} indexed documents available`
            : `${indexedDocumentTotal.toLocaleString()} indexed sources available`
      : "No indexed documents yet.";
  const documentsDrawerMobileSummary = dashboardDataLoading
    ? "Loading library"
    : documentsDrawerMode === "recent"
      ? "Recent sources"
      : documentsDrawerMode === "source"
        ? "PDF sources"
        : documentsDrawerIsAdmin
          ? "Admin"
          : "Library";
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
                    : activeModeResultKind === "documents"
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
                  documentCount={indexedDocumentTotal}
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
                <ToolsHub query={query} onQueryChange={setQuery} desktopComposerSlotId={desktopHomeComposerSlotId} />
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
              ) : activeModeResultKind === "documents" ? (
                searchMode === "prescribing" ? (
                  <MedicationPrescribingWorkspace
                    query={query}
                    loading={false}
                    realDataReady
                    authUnavailable={false}
                    apiUnavailable={false}
                    setupWarning={null}
                    onSuggestedSearch={setMedicationSearchQuery}
                    showHome={!modeSearchSubmitted}
                    desktopComposerSlotId={desktopHomeComposerSlotId}
                  />
                ) : (
                  <>
                    <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
                    <DocumentSearchResultsPanel
                      matches={documentMatches}
                      recordMatches={recordSearchMatches}
                      recordMode={recordSearchMode}
                      showRecordMatches={searchMode === "services" || searchMode === "forms"}
                      query={query}
                      loading={loading}
                      documentCount={indexedDocumentTotal}
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
                    currentRelevance={currentRelevance}
                    queryMode={queryMode}
                    sourceGovernanceWarnings={sourceGovernanceWarnings}
                    sourceSummary={sourceSummary}
                    renderModel={answerRenderModel}
                    weakEvidence={weakEvidence}
                    groupedGovernanceWarningCount={groupedGovernanceWarningCount}
                    answerViewMode={answerViewMode}
                    answerEvidenceMapRows={answerEvidenceMapRows}
                    onScopeDocument={scopeOnlyDocument}
                    answerGrounded={answerGrounded}
                    sources={answerRenderModel.reviewSources}
                    gaps={gaps}
                    searchScope={searchScope}
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
          theme={theme}
          onToggleTheme={toggleTheme}
          onPrefetchApplications={prefetchApplications}
        />
      </div>
    </div>
  );
}
