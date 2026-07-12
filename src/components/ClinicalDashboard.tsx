"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  CircleAlert,
  BookOpen,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  Heart,
  ListChecks,
  Loader2,
  Quote,
  RefreshCw,
  Search,
  ShieldAlert,
  Square,
  UploadCloud,
  WifiOff,
  Wrench,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DocumentDeleteResult } from "@/components/DocumentManagementActions";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import { isLocalNoAuthMode, publicUploadsEnabled } from "@/lib/client-env";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import {
  appBackdrop,
  answerSurface,
  cn,
  floatingControl,
  InlineNotice,
  primaryControl,
  textMuted,
  toneInfo,
} from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { CrossModeLinksSection } from "@/components/clinical-dashboard/cross-mode-links";
import { useEventCallback } from "@/components/clinical-dashboard/use-event-callback";
import { AuthPanel } from "@/components/clinical-dashboard/auth-panel";
import { buildMobileSectionFabState, MobileSectionFab, ToolsHub } from "@/components/clinical-dashboard/dashboard-nav";
import { SettingsDialog } from "@/components/clinical-dashboard/settings-dialog";
import { useSidebarCollapsed } from "@/components/clinical-dashboard/use-sidebar-collapsed";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import {
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
  hasReadyRequiredPublicSearchConfig,
  hasReadyPublicSearchSetup,
  type SetupCheck,
  type IngestionQualityReviewItem,
} from "@/components/clinical-dashboard/DocumentManagerPanel";
import { GuideDialog, GuideTrigger, UtilityDrawer } from "@/components/clinical-dashboard/dashboard-shell";
import { sanitizeAnswerDisplayText, sanitizeDisplayText } from "@/components/clinical-dashboard/display-text";
import {
  NaturalLanguageAnswer,
  ScopeAndGovernanceNotice,
  UserQuestionBubble,
} from "@/components/clinical-dashboard/answer-content";
import { AnswerEmptyState, AnswerSkeleton } from "@/components/clinical-dashboard/answer-status";
import { evidenceMapRowsFromRenderModel } from "@/components/clinical-dashboard/evidence-map-model";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import { answerRecovery, errorCopy } from "@/lib/ui-copy";
import {
  type DocumentDrawerMode,
  type DocumentDrawerStatusFilter,
  type DocumentPagination,
  type LabelReviewMutationBody,
  navigationHashes,
  recentQueryStorageKey,
} from "@/components/clinical-dashboard/dashboard-contracts";

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
const DocumentDrawer = dynamic(
  () => import("@/components/clinical-dashboard/document-admin").then((m) => m.DocumentDrawer),
  { ssr: false },
);

// Results surfaces load lazily: they only render after a submitted search/answer, so their chunk
// downloads behind the (multi-second) retrieval/answer request rather than bloating the initial
// answer-home bundle. The answer surface keeps the same skeleton as generation to avoid a flash.
const StagedAnswerResultSurface = dynamic(
  () => import("@/components/clinical-dashboard/answer-result-surface").then((m) => m.StagedAnswerResultSurface),
  { ssr: false, loading: () => <AnswerSkeleton /> },
);
const RelatedDocumentsPanel = dynamic(
  () => import("@/components/clinical-dashboard/document-results").then((m) => m.RelatedDocumentsPanel),
  { ssr: false },
);
const DocumentSearchResultsPanel = dynamic(
  () => import("@/components/clinical-dashboard/document-search-results").then((m) => m.DocumentSearchResultsPanel),
  { ssr: false },
);

import type { SearchFacets } from "@/components/clinical-dashboard/document-search-results";
import { isWeakRelevance } from "@/components/clinical-dashboard/relevance";
import {
  answerPayloadIsUsable,
  classifyAnswerError,
  createAnswerRequestWatchdog,
  isAnswerPayload,
  isRetryableError,
  isRetryableMessage,
  isRetryableStatus,
  keywordQueryFromNaturalLanguage,
  makeSearchError,
  progressForRetry,
  searchRetryCount,
  searchRetryDelaysMs,
  sleep,
  type AnswerErrorKind,
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
import { documentsSearchHref } from "@/lib/document-flow-routes";
import {
  readSearchNavigationContext,
  routedSubmissionContextChanged,
  searchNavigationContextSignature,
  searchSubmissionSignature,
  type SearchNavigationContext,
} from "@/lib/search-navigation-context";
import { rankFormRecords } from "@/lib/forms";
import { rankServiceRecords } from "@/lib/services";
import { useRegistryRecords } from "@/lib/use-registry-records";
import { buildAnswerFollowUpQuery, buildAnswerFollowUpSuggestions } from "@/lib/answer-follow-up";
import {
  clearPersistedAnswerThread,
  loadPersistedAnswerThread,
  maxStoredAnswerTurns,
  savePersistedAnswerThread,
} from "@/lib/answer-thread-storage";
import { buildAnswerRenderModel } from "@/lib/answer-render-policy";
import {
  frontendSourceGovernanceWarnings,
  groupSourceGovernanceWarnings,
  type SourceGovernanceWarning,
} from "@/lib/source-governance";
import { type SmartDocumentTag, type SmartDocumentTagFacet } from "@/lib/document-tags";
import type {
  ClinicalDocument,
  DocumentMatch,
  EvidenceRelevance,
  ImportBatch,
  IngestionJob,
  QuoteCard,
  RagAnswer,
  AnswerSection,
  RelatedDocument,
  SearchResult,
  SearchScopeSummary,
  ClinicalQueryMode,
  DocumentLabel,
} from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { differentialsMobileCompareAddonSlotId, modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { toolCatalogRecords } from "@/lib/tools-catalog";
import { createQuoteFollowUp, type AnswerViewMode, shouldPollForUpdates } from "@/lib/ward-output";

const documentPageSize = 150;
const activeIndexingPollFallbackMs = 5_000;
const setupRecheckPollMs = 60_000;
const indexingWorkDetailsPollMs = 15_000;
const stagedDashboardExtraction = {
  answerSurface: true,
} as const;
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
import type { AnswerFeedbackType } from "@/lib/answer-feedback";
export type { AnswerFeedbackType } from "@/lib/answer-feedback";
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

function hasNonProductionSupabaseApiKeyFallback(checks: SetupCheck[]) {
  return (
    process.env.NODE_ENV !== "production" &&
    checks.some(
      (check) =>
        check.id === "search" &&
        check.status !== "ready" &&
        /\b(?:unregistered|invalid)\s+api\s+key\b/i.test(check.detail),
    )
  );
}

function parseSseData(lines: string[]) {
  const data = lines.join("\n").trim();
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    throw makeSearchError("Answer stream returned malformed data.", 500, true);
  }
}

/** True when an error originates from an AbortController (user pressed Stop / component unmounted). */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function answerStreamProgressMessage(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function findSseSeparator(buffer: string) {
  const match = /\r?\n\r?\n/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

async function readAnswerStream(
  response: Response,
  onProgress: (message: string) => void,
  onToken?: (delta: string) => void,
  onRevising?: () => void,
  onActivity?: () => void,
): Promise<AnswerPayload> {
  if (!response.body) throw makeSearchError("Answer stream could not be opened.", undefined, true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
    if (event === "token") {
      const delta = data && typeof data === "object" ? (data as { delta?: unknown }).delta : null;
      if (typeof delta === "string" && delta) onToken?.(delta);
      return;
    }
    if (event === "revising") {
      onRevising?.();
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
      if (!isAnswerPayload(data)) {
        throw makeSearchError("Answer stream returned an invalid final payload.", 502, true);
      }
      return data;
    }

    return null;
  }

  while (true) {
    const { value, done } = await reader.read();
    // Any received bytes — progress events, token deltas, or server heartbeat
    // comments — count as liveness for the caller's stall watchdog.
    if (value && value.length > 0) onActivity?.();
    buffer += decoder.decode(value, { stream: !done });

    let separator = findSseSeparator(buffer);
    while (separator) {
      const block = buffer.slice(0, separator.index).trim();
      buffer = buffer.slice(separator.index + separator.length);
      const finalPayload = block ? processEvent(block) : null;
      if (finalPayload) {
        await reader.cancel().catch(() => undefined);
        return finalPayload;
      }
      separator = findSseSeparator(buffer);
    }

    if (done) break;
  }

  const finalPayload = buffer.trim() ? processEvent(buffer.trim()) : null;
  if (finalPayload) return finalPayload;
  throw makeSearchError("Answer stream ended before a final answer was received.", undefined, true);
}

// Provisional view shown while an answer streams in. The prose is content-preserving (the same
// text the final payload will carry); the caret conveys that generation is still in flight. On a
// quality-gate escalation the pipeline sends a `revising` signal and this switches to a neutral
// "revising for accuracy" state so a clinician never acts on soon-to-be-replaced text.
function StreamingAnswerPreview({ text, revising }: { text: string; revising: boolean }) {
  if (revising) {
    return (
      <div className={cn(answerSurface, "p-4")} data-testid="answer-streaming-revising" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Revising for accuracy…
        </div>
      </div>
    );
  }
  return (
    <div className={cn(answerSurface, "p-4")} data-testid="answer-streaming" aria-live="polite">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--text)]">
        {text}
        <span
          className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[color:var(--text-muted)] align-text-bottom"
          aria-hidden
        />
      </p>
    </div>
  );
}

function normalizeNavigationHash(hash: string) {
  return navigationHashes.includes(hash as (typeof navigationHashes)[number]) ? hash : "#search";
}
/**
 * A completed Q&A exchange kept on screen after a newer answer arrives, so
 * Answer mode reads as a conversation thread instead of replacing each result.
 */
type AnswerTurn = {
  id: string;
  query: string;
  answer: RagAnswer;
  sources: SearchResult[];
};

const maxVisiblePriorTurns = 10;

// Non-retryable so an aborted request does not immediately re-fetch against the
// already-aborted signal; the user re-submits to try again. Raised by the
// stall watchdog (see createAnswerRequestWatchdog): a live stream that keeps
// delivering progress/token/heartbeat bytes is never aborted, no matter how
// long a fast->strong escalation takes, so this now only appears when the
// stream genuinely went silent or hit the absolute ceiling.
function answerTimedOutError() {
  return makeSearchError("Answer generation timed out. Please try again.", 408, false);
}

/**
 * Renders a collapsible, read-only view of a previous answer-thread turn with its question, answer, sources, and source-review notice.
 *
 * @param turn - The previous question and answer turn to display
 * @param copied - Whether the turn's answer has been copied
 * @param collapsed - Whether the answer content is collapsed
 * @param onToggleCollapsed - Called when the answer visibility is toggled
 * @param onCopy - Called with the answer text when copying is requested
 */
function PriorAnswerTurnSurface({
  turn,
  copied,
  collapsed,
  onToggleCollapsed,
  onCopy,
}: {
  turn: AnswerTurn;
  copied: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCopy: (text: string) => void;
}) {
  const renderModel = useMemo(
    () => buildAnswerRenderModel(turn.answer, { sources: turn.sources }),
    [turn.answer, turn.sources],
  );
  const turnPreformatted = Boolean(turn.answer.preformatted && turn.answer.grounded);
  const safeText = useMemo(
    () => sanitizeAnswerDisplayText(turn.answer.answer, { preformatted: turnPreformatted }),
    [turn.answer.answer, turnPreformatted],
  );
  const sourceCount =
    renderModel.primarySources.length ||
    turn.sources.length ||
    turn.answer.sources?.length ||
    turn.answer.citations.length;
  const previewText = safeText || turn.answer.answer;
  const needsSourceReview =
    turn.answer.answerQualityTier === "source_only" ||
    turn.answer.grounded === false ||
    renderModel.trust === "low" ||
    renderModel.trust === "unsupported";

  return (
    <div
      // Historical conversation turns grow unbounded and most are collapsed and
      // scrolled off-screen; content-auto skips their layout/paint until near the
      // viewport. Safe here — the surface has no overflowing popovers, and the
      // expand toggle is only reachable once the turn is scrolled into view.
      className="content-auto min-w-0 space-y-4 sm:space-y-5"
      data-dashboard-stage="answer-thread-turn"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
        <UserQuestionBubble query={turn.query} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-xs font-semibold text-[color:var(--text-muted)] transition hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} aria-hidden="true" />
          {collapsed ? "Show previous answer" : "Hide previous answer"}
        </button>
        {collapsed ? (
          <p className={cn("line-clamp-2 text-sm leading-6", textMuted)}>{previewText}</p>
        ) : (
          <>
            <NaturalLanguageAnswer
              text={turn.answer.answer}
              preformatted={turnPreformatted}
              sourceCount={sourceCount}
              sourceOnly={turn.answer.answerQualityTier === "source_only"}
              bestSource={renderModel.bestSource}
              sources={renderModel.reviewSources}
              sourceLinks={renderModel.primarySources}
              copied={copied}
              onCopy={() => onCopy(renderModel.copyText || previewText)}
            />
            {needsSourceReview ? (
              <div
                role="note"
                data-testid="prior-answer-source-review"
                className="mt-2 flex items-start gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs text-[color:var(--text-muted)]"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" aria-hidden />
                <span>
                  <strong className="text-[color:var(--text-heading)]">Review source match.</strong> Verify cited
                  passages before relying on this previous answer.
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

type LibraryHealthTarget = "documents" | "setup" | "indexing" | "failures";
type IndexingMonitorFilter = "all" | "active" | "failed";
type UploadIndexingTab = "setup" | "upload" | "jobs" | "quality";

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

/**
 * Renders the clinical search dashboard, including document search, answer generation, conversation history, source management, and ingestion controls.
 *
 * @param initialSearchMode - The mode selected when the dashboard loads.
 * @param initialQuery - The initial search or composer query.
 * @param focusSearch - Whether to focus the search input on load.
 * @param autoRunSearch - Whether to automatically submit the initial query.
 */
export function ClinicalDashboard({
  initialSearchMode = "answer",
  initialQuery = "",
  focusSearch = false,
  autoRunSearch = false,
}: { initialSearchMode?: AppModeId; initialQuery?: string; focusSearch?: boolean; autoRunSearch?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialSearchNavigationContext] = useState(() => readSearchNavigationContext(searchParams));
  const mainRef = useRef<HTMLElement>(null);
  const [mainScrollRoot, setMainScrollRoot] = useState<HTMLElement | null>(null);
  const assignMainRef = useCallback((node: HTMLElement | null) => {
    mainRef.current = node;
    setMainScrollRoot(node);
  }, []);
  const phoneScrollHide = useScrollHideReporter();
  const reportPhoneScrollHideRef = useRef(phoneScrollHide.reportScroll);
  reportPhoneScrollHideRef.current = phoneScrollHide.reportScroll;
  const [bottomSearchScrollHidden, setBottomSearchScrollHidden] = useState(false);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const navSyncLockRef = useRef<number | null>(null);
  const autoRunSearchSignatureRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const nextWorkStatePollRef = useRef(0);
  const urlSearchBootstrappedRef = useRef(false);
  const urlDocumentSearchBootstrappedRef = useRef(false);
  const lastSyncedSearchParamsRef = useRef(searchParams.toString());
  const modeChangeFromUiRef = useRef(false);
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
  const answerThreadBootstrappedRef = useRef(false);
  const [answerThreadBootstrapped, setAnswerThreadBootstrapped] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<AppModeId>(initialSearchMode);
  const [modeSearchSubmitted, setModeSearchSubmitted] = useState(() =>
    Boolean(autoRunSearch && initialQuery.trim() && initialSearchMode !== "tools"),
  );
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  // Answer-mode conversation thread. `priorAnswerTurns` holds completed
  // exchanges displayed above the latest answer; `latestAnswerQuery` is the
  // question that produced the current `answer` (the composer `query` is a
  // draft that clears after each successful answer). The ref mirrors the
  // latest committed turn so async search completions can archive it without
  // reading stale closure state.
  const [priorAnswerTurns, setPriorAnswerTurns] = useState<AnswerTurn[]>([]);
  const [latestAnswerQuery, setLatestAnswerQuery] = useState<string | null>(null);
  const [collapsedTurnIds, setCollapsedTurnIds] = useState<Set<string>>(() => new Set());
  const [showEarlierTurns, setShowEarlierTurns] = useState(false);
  const threadRestoreScrolledRef = useRef(false);
  const restoredThreadFromStorageRef = useRef(false);
  const latestAnswerTurnRef = useRef<Omit<AnswerTurn, "id"> | null>(null);
  const answerTurnSeqRef = useRef(0);
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);
  const [searchRelevance, setSearchRelevance] = useState<EvidenceRelevance | null>(null);
  const [searchFacets, setSearchFacets] = useState<SearchFacets | null>(null);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>(initialSearchNavigationContext.queryMode);
  const activeModeSearch = appModeSearchConfig(searchMode);
  const activeModeResultKind = appModeResultKind(searchMode);
  const requestQueryMode = appModeQueryMode(searchMode, queryMode);
  const submittedUrlMode = searchParams.get("mode");
  const submittedUrlModeMatchesActive =
    !submittedUrlMode ||
    (isAppModeId(submittedUrlMode) && isAppModeVisible(submittedUrlMode) && submittedUrlMode === searchMode);
  const submittedUrlQuery =
    autoRunSearch && searchParams.get("run") === "1" && submittedUrlModeMatchesActive
      ? (searchParams.get("q") ?? searchParams.get("query") ?? "").trim()
      : "";
  const routedSearchContext = useMemo(() => readSearchNavigationContext(searchParams), [searchParams]);
  const routedSearchContextSignature = searchNavigationContextSignature(routedSearchContext);

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
  // The thread mirror ref must never outlive the answer it describes: every
  // reset path nulls `answer`, so clearing here covers them all (mode
  // switches, new chat, differentials/services clears) without each caller
  // having to remember the ref.
  useEffect(() => {
    if (!answerThreadBootstrappedRef.current) return;
    if (answer === null) latestAnswerTurnRef.current = null;
  }, [answer]);
  useEffect(() => {
    queueMicrotask(() => {
      const persisted = loadPersistedAnswerThread();
      if (persisted) {
        restoredThreadFromStorageRef.current = true;
        setPriorAnswerTurns(persisted.priorTurns);
        setLatestAnswerQuery(persisted.latestTurn?.query ?? null);
        if (persisted.latestTurn) {
          latestAnswerTurnRef.current = persisted.latestTurn;
          setAnswer(persisted.latestTurn.answer);
          setSources(persisted.latestTurn.sources);
          setModeSearchSubmitted(true);
          setQuery("");
          const restoredQuery = persisted.latestTurn.query.trim();
          if (restoredQuery) {
            autoRunSearchSignatureRef.current = `answer:${restoredQuery}`;
          }
        }
        answerTurnSeqRef.current = persisted.priorTurns.reduce((max, turn) => {
          const match = /^answer-turn-(\d+)$/.exec(turn.id);
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0);
        setCollapsedTurnIds(
          persisted.collapsedTurnIds.length
            ? new Set(persisted.collapsedTurnIds)
            : new Set(persisted.priorTurns.map((turn) => turn.id)),
        );
      }
      answerThreadBootstrappedRef.current = true;
      setAnswerThreadBootstrapped(true);
    });
  }, []);
  useEffect(() => {
    if (
      !answerThreadBootstrappedRef.current ||
      !answer ||
      !restoredThreadFromStorageRef.current ||
      threadRestoreScrolledRef.current
    ) {
      return;
    }
    threadRestoreScrolledRef.current = true;
    window.requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: mainRef.current?.scrollHeight ?? 0, behavior: "auto" });
    });
  }, [answer]);
  const resetAnswerThread = useCallback(() => {
    setPriorAnswerTurns([]);
    setLatestAnswerQuery(null);
    setCollapsedTurnIds(new Set());
    setShowEarlierTurns(false);
    clearPersistedAnswerThread();
  }, []);
  function toggleAnswerTurnCollapsed(turnId: string) {
    setCollapsedTurnIds((current) => {
      const next = new Set(current);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }
  // The query the current documentMatches were fetched for, so the
  // differentials results view can tell live-edited catalogue results apart
  // from evidence that belongs to a previously submitted search.
  const [differentialEvidenceQuery, setDifferentialEvidenceQuery] = useState<string | null>(null);
  const clearDifferentialModeResultState = useCallback(() => {
    resetAnswerThread();
    setAnswer(null);
    setSources([]);
    setDocumentMatches([]);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setError(null);
    setAnswerProgress(null);
    setDifferentialEvidenceQuery(null);
  }, [resetAnswerThread]);
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>(initialSearchNavigationContext.scopeFilters);
  const [searchScope, setSearchScope] = useState<SearchScopeSummary | null>(null);
  const [sourceGovernanceWarnings, setSourceGovernanceWarnings] = useState<SourceGovernanceWarning[]>([]);
  const [answerViewMode, setAnswerViewMode] = useState<AnswerViewMode>("high_yield");
  const [bulkActionStatus, setBulkActionStatus] = useState<string | null>(null);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answerProgress, setAnswerProgress] = useState<string | null>(null);
  // In-progress streamed answer prose (content-preserving — the final committed answer still comes
  // from the parsed `final` payload). null between searches; `{ text, revising }` while generating.
  // `revising` = the quality gates dropped a provisional answer and are re-generating, so a
  // "revising for accuracy" state shows instead of stale text.
  const [streamingAnswer, setStreamingAnswer] = useState<{ text: string; revising: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Companion state for `error`, used to pick the right recovery UI (retry vs.
  // a calm no-results panel) and to re-run the exact query that failed. Only read
  // while `error` is truthy, and set alongside every `setError(<message>)` so a
  // stale value can never leak into a later, unrelated error.
  const [errorKind, setErrorKind] = useState<AnswerErrorKind | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
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
  const [commandScopes, setCommandScopes] = useState<string[]>([]);
  const removeCommandScope = useCallback(
    (scopeId: string) => setCommandScopes((current) => current.filter((scope) => scope !== scopeId)),
    [],
  );
  const clearCommandScopes = useCallback(() => setCommandScopes([]), []);
  const searchCommandContextValue = useMemo(
    () => ({
      query,
      modeId: searchMode,
      commandScopes,
      onRemoveScope: removeCommandScope,
      onClearScopes: clearCommandScopes,
    }),
    [query, searchMode, commandScopes, removeCommandScope, clearCommandScopes],
  );
  const [indexingActionId, setIndexingActionId] = useState<string | null>(null);
  const [indexingActive, setIndexingActive] = useState(false);
  const [nextRefreshDelayMs, setNextRefreshDelayMs] = useState<number | null>(null);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const { status: authStatus, authorizationHeader, markSessionExpired } = auth;
  const prevAuthStatusRef = useRef(authStatus);
  useEffect(() => {
    const previous = prevAuthStatusRef.current;
    prevAuthStatusRef.current = authStatus;
    if ((authStatus === "signed_out" || authStatus === "expired") && previous === "authenticated") {
      resetAnswerThread();
      setAnswer(null);
      setSources([]);
      latestAnswerTurnRef.current = null;
    }
  }, [authStatus, resetAnswerThread]);
  const supabaseEnvStatus = setupChecks.find((check) => check.id === "env")?.status;
  const browserAuthUnavailableDemoFallback = !auth.isConfigured && supabaseEnvStatus !== "ready";
  const localNoAuthMode = isLocalNoAuthMode();
  const explicitDemoMode = demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const clientDemoMode = explicitDemoMode || browserAuthUnavailableDemoFallback || localNoAuthMode;
  const uploadReadOnlyMode =
    demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || browserAuthUnavailableDemoFallback;
  const localDevCanAttemptPrivateApis = process.env.NODE_ENV !== "production" && hasReadyPublicSearchSetup(setupChecks);
  const canUsePublicSearchApis = localProjectReady && hasReadyPublicSearchSetup(setupChecks);
  const canUseDegradedLocalSearchApis =
    process.env.NODE_ENV !== "production" && localProjectReady && hasReadyRequiredPublicSearchConfig(setupChecks);
  const canUseNonProductionDemoFallback = localProjectReady && hasNonProductionSupabaseApiKeyFallback(setupChecks);
  const canUsePrivateApis =
    localProjectReady && (localNoAuthMode || localDevCanAttemptPrivateApis || authStatus === "authenticated");
  const canUploadDocuments = canUsePrivateApis || (publicUploadsEnabled() && canUsePublicSearchApis);
  const canAttemptDeployedPublicSearch = isDeployedClinicalKb() && localProjectReady;
  const canRunSearch =
    explicitDemoMode ||
    canUsePublicSearchApis ||
    canUseDegradedLocalSearchApis ||
    canUseNonProductionDemoFallback ||
    canAttemptDeployedPublicSearch;
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
    if (!answerThreadBootstrapped) return;
    if (searchMode !== "answer") return;
    if (!answer && priorAnswerTurns.length === 0) {
      clearPersistedAnswerThread();
      return;
    }
    savePersistedAnswerThread({
      version: 1,
      priorTurns: priorAnswerTurns,
      latestTurn: latestAnswerTurnRef.current,
      collapsedTurnIds: [...collapsedTurnIds],
    });
  }, [searchMode, answer, priorAnswerTurns, collapsedTurnIds, latestAnswerQuery, answerThreadBootstrapped]);

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
            if (isDeployedClinicalKb()) {
              setSetupWarning("Setup status could not be loaded. You can still try search.");
            } else {
              setApiUnavailable(true);
              setSetupWarning("The local API is unavailable.");
              return;
            }
          } else if (setupResponse.ok) {
            const payload = (await setupResponse.json()) as SetupStatusPayload;
            setSetupChecks(payload.checks ?? fallbackSetupChecks);
            nextDemoMode = Boolean(payload.demoMode);
            routeIndexingActive = Boolean(payload.indexingActive);
            routePollDelayMs = shorterPollDelay(routePollDelayMs, payload.pollAfterMs);
            if (nextDemoMode) setDemoMode(true);
          } else if (isDeployedClinicalKb()) {
            setSetupWarning("Setup status could not be loaded. You can still try search.");
          } else {
            setApiUnavailable(true);
            return;
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

  // Abort any in-flight answer/library search if the dashboard unmounts.
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const searchParamString = searchParams.toString();
    if (lastSyncedSearchParamsRef.current === searchParamString) return;
    lastSyncedSearchParamsRef.current = searchParamString;
    const nextSearchContext = readSearchNavigationContext(new URLSearchParams(searchParamString));
    setQueryMode(nextSearchContext.queryMode);
    setScopeFilters(nextSearchContext.scopeFilters);
    if (searchParams.get("run") === "1") return;

    const mode = searchParams.get("mode");
    if (!isAppModeId(mode) || !isAppModeVisible(mode)) return;

    if (modeChangeFromUiRef.current) {
      modeChangeFromUiRef.current = false;
      return;
    }

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
  }, [searchParams, clearDifferentialModeResultState]);

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
      // run=1 URLs name the latest answered question; the composer stays empty
      // while an answer thread is active (including after localStorage restore).
      if (searchText && params.get("run") !== "1") setQuery(searchText);
      if (shouldFocusComposer) focusComposerInput();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [clearDifferentialModeResultState]);

  const executeSearchRef = useRef(executeSearch);
  executeSearchRef.current = executeSearch;
  const scopeFiltersRef = useRef(scopeFilters);
  scopeFiltersRef.current = scopeFilters;

  useEffect(() => {
    if (urlDocumentSearchBootstrappedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const searchText = params.get("q")?.trim();
    if (!searchText || !isAppModeId(mode) || !isAppModeVisible(mode)) return;
    if (mode === "prescribing") return;
    const modeSearch = appModeSearchConfig(mode);
    // Answer-mode run=1 URLs are submitted by the autoRunSearch effect after
    // localStorage thread restore completes; running here would archive a
    // restored latest turn into a duplicate prior turn on reload.
    if (modeSearch.resultKind === "answer") {
      if (!answerThreadBootstrapped) return;
      urlDocumentSearchBootstrappedRef.current = true;
      return;
    }
    const shouldRun =
      params.get("run") === "1" ||
      modeSearch.kind === "documents" ||
      modeSearch.kind === "forms" ||
      modeSearch.kind === "favourites" ||
      modeSearch.kind === "differentials";
    if (!shouldRun) return;
    const isRegistryOnlyMode = mode === "services" || mode === "forms";
    if (modeSearch.kind !== "tools" && modeSearch.kind !== "favourites" && !isRegistryOnlyMode && !canRunSearch) return;
    urlDocumentSearchBootstrappedRef.current = true;
    void executeSearchRef.current(searchText, mode, scopeFiltersRef.current);
    // URL search intentionally runs once when the selected mode can execute.
  }, [canRunSearch, answerThreadBootstrapped]);

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
    const origin = typeof window !== "undefined" ? window.location.origin : "Clinical KB";
    return makeSearchError(
      offline
        ? `${label} could not run because the browser is offline.`
        : isDeployedClinicalKb()
          ? `${label} could not reach Clinical KB at ${origin}. Check your connection and try again shortly.`
          : `${label} could not reach Clinical KB at ${origin}. The local server may still be starting or restarting; retry shortly or run npm run ensure.`,
      undefined,
      true,
    );
  }

  async function requestSourceLibrarySearch(
    queryText: string,
    mode: SourceLibrarySearchMode = "documents",
    filtersOverride?: SearchScopeFilters,
    queryModeOverride: ClinicalQueryMode = requestQueryMode,
    signal?: AbortSignal,
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
        signal,
      });
    } catch (error) {
      if (isAbortError(error)) throw error;
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
    signal?: AbortSignal,
    onStreamActivity?: () => void,
  ) {
    setStreamingAnswer(null);
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
        signal,
      });
    } catch (error) {
      if (answerTimedOutRef.current) throw answerTimedOutError();
      if (isAbortError(error)) throw error;
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

    let payload: AnswerPayload;
    try {
      payload = await readAnswerStream(
        response,
        onProgress,
        (delta) => setStreamingAnswer((prev) => ({ text: (prev?.text ?? "") + delta, revising: false })),
        () => setStreamingAnswer({ text: "", revising: true }),
        onStreamActivity,
      );
    } catch (error) {
      if (answerTimedOutRef.current) throw answerTimedOutError();
      if (isAbortError(error)) throw error;
      throw error;
    }
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
  // Aborts the in-flight answer/library search when the user presses Stop, a
  // newer search supersedes the prior one, or the component unmounts.
  const searchAbortRef = useRef<AbortController | null>(null);
  // Distinguishes a timeout-driven abort from an explicit user/supersede abort.
  const answerTimedOutRef = useRef(false);

  function stopSearch() {
    searchAbortRef.current?.abort();
  }

  function applySearchResult(payload: SearchResultModePayload, displayQuery?: string, archivePreviousAnswer = true) {
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
    // Archive the previous exchange before the new answer replaces it, so the
    // thread keeps every turn visible in the same window.
    const priorTurn = archivePreviousAnswer ? latestAnswerTurnRef.current : null;
    if (priorTurn) {
      const turnId = `answer-turn-${++answerTurnSeqRef.current}`;
      setPriorAnswerTurns((turns) => [...turns, { id: turnId, ...priorTurn }].slice(-maxStoredAnswerTurns));
      setCollapsedTurnIds((current) => new Set(current).add(turnId));
    }
    const committedQuery = displayQuery ?? payload.query;
    latestAnswerTurnRef.current = {
      query: committedQuery,
      answer: answerData,
      sources: answerData.sources ?? [],
    };
    setLatestAnswerQuery(committedQuery);
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

  async function executeSearch(
    searchText: string,
    targetMode: AppModeId = searchMode,
    filtersOverride = scopeFilters,
    queryModeOverride = queryMode,
    replaceExistingAnswer = false,
  ) {
    const trimmedQuery = searchText.trim();
    if (!trimmedQuery) return;
    const modeSearch = appModeSearchConfig(targetMode);
    const targetQueryMode = appModeQueryMode(targetMode, queryModeOverride);
    const isDifferentialsMode = modeSearch.resultKind === "differentials";
    // Note: no automatic mode-default label scope for Services/Forms. Applying
    // one on every search routed resolveSearchScope's label path over the whole
    // library, whose single `document_labels.in(<all ids>)` request produces an
    // over-long PostgREST URL that fails on large corpora. Corpus search runs
    // unscoped (like Documents); users opt into label filters explicitly.
    const requestId = ++searchRequestSeqRef.current;

    setSearchMode(targetMode);
    // Answer mode keeps the composer as the draft source until a successful
    // response clears it. Syncing query here on follow-ups used to fire the
    // URL-backed autoRunSearch effect before loading flipped true, which
    // duplicated the in-flight answer request and produced extra thread turns.
    if (modeSearch.resultKind !== "answer") {
      setQuery(trimmedQuery);
    }
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
    if (modeSearch.kind === "services" || modeSearch.kind === "forms") {
      resetAnswerThread();
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
      // requestId was already bumped above, so a superseded in-flight request's
      // finally block can no longer reset loading — reset it here or the answer
      // skeleton can stay on screen indefinitely.
      setLoading(false);
      setAnswerProgress(null);
      setError(errorCopy.searchSetupNotReady);
      setErrorKind(null);
      setLastFailedQuery(null);
      return;
    }
    // M10 (diff-review hardening): progress updates emitted by this request's
    // in-flight machinery (retry messages, keyword fallback, stream progress)
    // must also be discarded once a newer search takes over, or a slow stale
    // request repaints the progress banner under the newer query.
    const onProgress = (message: string | null) => {
      if (requestId === searchRequestSeqRef.current) setAnswerProgress(message);
    };
    // A newer search already invalidated any prior request via requestId; abort
    // its network work too so the server stops generating, then own the signal.
    searchAbortRef.current?.abort();
    const abortController = new AbortController();
    searchAbortRef.current = abortController;
    setLoading(true);
    setError(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    onProgress(modeSearch.progressLabel);
    rememberRecentQuery(trimmedQuery);

    // Answer-mode follow-ups: the API takes a single query string, so a short
    // ambiguous follow-up ("what about renal impairment?") is wrapped with the
    // previous turn's question before retrieval. The raw text the user typed
    // is what the thread displays (via displayQuery below).
    const isAnswerRequest = modeSearch.resultKind === "answer";
    const priorTurnQuery = isAnswerRequest && !replaceExistingAnswer ? latestAnswerTurnRef.current?.query : undefined;
    const isAnswerFollowUp = isAnswerRequest && Boolean(priorTurnQuery);
    const requestQuery = isAnswerRequest ? buildAnswerFollowUpQuery(priorTurnQuery, trimmedQuery) : trimmedQuery;

    const fallbackQuery = keywordQueryFromNaturalLanguage(requestQuery);
    const queryPlan =
      fallbackQuery && fallbackQuery !== requestQuery
        ? [
            { query: requestQuery, isKeyword: false },
            { query: fallbackQuery, isKeyword: true },
          ]
        : [{ query: requestQuery, isKeyword: false }];

    // Bound this search with a stall watchdog on the shared abort controller so
    // a hung stream recovers instead of spinning forever. Answer streams reset
    // the inactivity window on every received chunk, so a slow-but-live
    // generation (fast -> strong escalation) is not aborted mid-stream; plain
    // document searches never touch the watchdog and keep the flat window.
    answerTimedOutRef.current = false;
    const answerWatchdog = createAnswerRequestWatchdog(() => {
      answerTimedOutRef.current = true;
      abortController.abort();
    });

    try {
      let successfulPayload: SearchResultModePayload | null = null;
      let lastError: SearchError | null = null;
      // Differentials mode: the ranked catalogue results are the primary
      // content and load independently of this document-evidence search, so an
      // empty corpus result is applied (empty evidence) rather than surfaced
      // as an error that would hide the catalogue view.
      let emptyDifferentialsPayload: SearchResultModePayload | null = null;

      for (const entry of queryPlan) {
        if (entry.isKeyword) onProgress("Trying keyword-based search...");

        try {
          const payload =
            modeSearch.kind === "documents" || modeSearch.kind === "differentials"
              ? await runWithRetries(
                  () =>
                    requestSourceLibrarySearch(
                      entry.query,
                      modeSearch.kind,
                      filtersOverride,
                      targetQueryMode,
                      abortController.signal,
                    ),
                  onProgress,
                )
              : await runWithRetries(
                  () =>
                    requestAnswer(
                      entry.query,
                      filtersOverride,
                      targetQueryMode,
                      onProgress,
                      abortController.signal,
                      answerWatchdog.touch,
                    ),
                  onProgress,
                );

          if (!resultUsable(payload)) {
            if (modeSearch.kind === "differentials") emptyDifferentialsPayload = payload;
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

      if (!successfulPayload && emptyDifferentialsPayload) {
        successfulPayload = emptyDifferentialsPayload;
      }

      if (!successfulPayload) {
        if (lastError) throw lastError;
        throw new Error("Search did not return usable results.");
      }

      // M10: discard a stale response — a newer search owns the UI state.
      if (requestId === searchRequestSeqRef.current) {
        applySearchResult(successfulPayload, trimmedQuery, !replaceExistingAnswer);
        if (isDifferentialsMode) setDifferentialEvidenceQuery(trimmedQuery);
        if (successfulPayload.kind === "answer") {
          // Explicit composer submissions do not pass through the URL auto-run
          // effect. Seed their completed context so a later in-place route to
          // the same query with different intent/scope is recognized as a
          // replacement search instead of leaving the old answer on screen.
          autoRunSearchSignatureRef.current = searchSubmissionSignature(targetMode, trimmedQuery, {
            queryMode: targetQueryMode,
            scopeFilters: filtersOverride,
          });
          // The composer is a draft box in a conversation: clear it so the
          // user can type the next follow-up immediately.
          setQuery("");
          // Keep only the latest question in the URL; the full thread lives in
          // React state until refresh or New chat.
          modeChangeFromUiRef.current = true;
          window.history.replaceState(
            null,
            "",
            appModeHomeHref(targetMode, {
              query: trimmedQuery,
              run: true,
              queryMode: queryModeOverride,
              scopeFilters: filtersOverride,
            }),
          );
          if (isAnswerFollowUp) {
            window.requestAnimationFrame(() => {
              const main = mainRef.current;
              main?.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
            });
          }
        }
      }
    } catch (requestError) {
      if (requestId === searchRequestSeqRef.current && !isAbortError(requestError)) {
        setError(requestError instanceof Error ? requestError.message : "Search failed");
        setErrorKind(classifyAnswerError(requestError));
        setLastFailedQuery(trimmedQuery);
      }
    } finally {
      answerWatchdog.cancel();
      answerTimedOutRef.current = false;
      if (searchAbortRef.current === abortController) searchAbortRef.current = null;
      if (requestId === searchRequestSeqRef.current) {
        setLoading(false);
        setAnswerProgress(null);
      }
    }
  }

  function setMedicationSearchQuery(searchText: string, updateUrl = true) {
    modeChangeFromUiRef.current = true;
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
    if (updateUrl) {
      router.replace(appModeHomeHref("prescribing", { query: trimmedSearchText, queryMode, scopeFilters }));
    }
  }

  async function ask(searchText = query, contextOverride?: SearchNavigationContext, replaceExistingAnswer = false) {
    const trimmedQuery = searchText.trim();
    const effectiveQueryMode = contextOverride?.queryMode ?? queryMode;
    const effectiveScopeFilters = contextOverride?.scopeFilters ?? scopeFilters;
    if (searchMode === "documents" && trimmedQuery) {
      rememberRecentQuery(trimmedQuery);
      router.push(
        documentsSearchHref({
          query: trimmedQuery,
          focus: true,
          run: true,
          queryMode: effectiveQueryMode,
          scopeFilters: effectiveScopeFilters,
        }),
      );
      return;
    }
    if (searchMode === "prescribing") {
      setMedicationSearchQuery(searchText);
      return;
    }
    await executeSearch(searchText, searchMode, effectiveScopeFilters, effectiveQueryMode, replaceExistingAnswer);
  }
  const askRef = useRef(ask);
  askRef.current = ask;

  useEffect(() => {
    const trimmedQuery = query.trim();
    const submittedSearchText = searchMode === "answer" && submittedUrlQuery ? submittedUrlQuery : trimmedQuery;
    const canAutoRunMode = searchMode === "documents" || searchMode === "prescribing" || canRunSearch;
    if (!autoRunSearch || !submittedSearchText || !canAutoRunMode || loading) return;
    if (searchMode === "answer" && !answerThreadBootstrapped) return;
    const previousSignature = autoRunSearchSignatureRef.current;
    const signature = searchSubmissionSignature(searchMode, submittedSearchText, routedSearchContext);
    const routedContextChanged = routedSubmissionContextChanged(
      previousSignature,
      searchMode,
      submittedSearchText,
      routedSearchContext,
    );
    // Once an answer is on screen, composer edits are follow-up drafts and must
    // only run on explicit submit — not on every query keystroke while run=1
    // keeps autoRunSearch enabled from the URL.
    if (searchMode === "answer" && answer && !routedContextChanged) return;
    // After reload, the URL query matches the restored latest turn — do not
    // archive it again into a duplicate prior turn.
    if (searchMode === "answer" && latestAnswerQuery?.trim() === submittedSearchText && !routedContextChanged) {
      autoRunSearchSignatureRef.current = signature;
      return;
    }
    if (autoRunSearchSignatureRef.current === signature) return;
    autoRunSearchSignatureRef.current = signature;
    void askRef.current(submittedSearchText, routedSearchContext, routedContextChanged);
  }, [
    autoRunSearch,
    canRunSearch,
    loading,
    query,
    submittedUrlQuery,
    searchMode,
    answer,
    answerThreadBootstrapped,
    latestAnswerQuery,
    routedSearchContext,
    routedSearchContextSignature,
  ]);

  function pickRecentQuery(recentQuery: string) {
    if (searchMode === "prescribing") {
      setMedicationSearchQuery(recentQuery);
      return;
    }
    setQuery(recentQuery);
  }

  function crossModeSearch(mode: AppModeId, crossQuery: string) {
    modeChangeFromUiRef.current = true;
    if (mode === "differentials") clearDifferentialModeResultState();
    setCommandScopes([]);
    setQuery(crossQuery);
    setModeSearchSubmitted(false);
    setLoading(false);
    setError(null);
    setAnswerProgress(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setDocumentMatches([]);
    if (mode === "answer") {
      resetAnswerThread();
      setAnswer(null);
      setSources([]);
    }
    if (mode === "prescribing") {
      setMedicationSearchQuery(crossQuery);
    }
    setSearchMode(mode);
    router.push(appModeHomeHref(mode, { query: crossQuery, focus: true, run: true, queryMode, scopeFilters }));
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

  function updateDocumentSearchUrl(
    searchText: string,
    mode: AppModeId = "documents",
    filtersOverride: SearchScopeFilters = scopeFilters,
  ) {
    window.history.replaceState(
      null,
      "",
      appModeHomeHref(mode, { query: searchText, queryMode, scopeFilters: filtersOverride }),
    );
  }

  async function runDocumentSearchShortcut(
    searchText: string,
    filtersOverride = scopeFilters,
    updateUrl = true,
    targetMode: AppModeId = "documents",
  ) {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) return;
    if (targetMode === "documents") {
      setQuery(trimmedSearchText);
      setSearchMode("documents");
      setModeSearchSubmitted(true);
      setLoading(false);
      setError(null);
      setAnswerProgress(null);
      rememberRecentQuery(trimmedSearchText);
      window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
      if (updateUrl) {
        router.push(
          documentsSearchHref({
            query: trimmedSearchText,
            focus: true,
            run: true,
            queryMode,
            scopeFilters: filtersOverride,
          }),
        );
      }
      return;
    }
    if (!canRunSearch) {
      setError(errorCopy.searchSetupNotReady);
      setErrorKind(null);
      setLastFailedQuery(null);
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
    if (updateUrl) updateDocumentSearchUrl(trimmedSearchText, targetMode, filtersOverride);

    const requestId = ++searchRequestSeqRef.current;

    try {
      const shortcutQueryMode = appModeQueryMode(targetMode, queryMode);
      const payload = await runWithRetries(() =>
        requestSourceLibrarySearch(trimmedSearchText, sourceLibraryMode, filtersOverride, shortcutQueryMode),
      );
      if (requestId === searchRequestSeqRef.current) {
        applySearchResult(payload);
      }
    } catch (requestError) {
      if (requestId === searchRequestSeqRef.current) {
        setError(requestError instanceof Error ? requestError.message : "Document search failed");
        setErrorKind(null);
        setLastFailedQuery(null);
      }
    } finally {
      if (requestId === searchRequestSeqRef.current) {
        setLoading(false);
        setAnswerProgress(null);
      }
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
    modeChangeFromUiRef.current = true;
    if (mode === "differentials") clearDifferentialModeResultState();
    setQuery("");
    setCommandScopes([]);
    if (mode === "answer") {
      resetAnswerThread();
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
    router.push(appModeHomeHref(mode, { queryMode, scopeFilters }));
  }

  function focusComposerInput() {
    window.requestAnimationFrame(() => {
      composerInputRef.current?.focus({ preventScroll: true });
      window.setTimeout(() => composerInputRef.current?.focus({ preventScroll: true }), 150);
    });
  }

  function stageAnswerFollowUpDraft(draft: string) {
    setQuery(draft);
    focusComposerInput();
  }

  function handleFollowUpQuote(quote: QuoteCard) {
    stageAnswerFollowUpDraft(createQuoteFollowUp(quote));
  }

  function handlePickFollowUpSuggestion(suggestion: string) {
    void executeSearch(suggestion);
  }

  function startNewChat() {
    modeChangeFromUiRef.current = true;
    const href = appModeHomeHref("answer", { focus: true });
    setQuery("");
    setModeSearchSubmitted(false);
    setSearchMode("answer");
    setQueryMode("auto");
    setSelectedDocumentIds([]);
    setScopeFilters({});
    resetAnswerThread();
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

    setActionNotice({
      tone: "warning",
      message: "Evidence appears after a source-backed answer is generated.",
    });
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

  function handleMainScroll() {
    scheduleActiveSectionSync();
  }

  useEffect(() => {
    const main = mainScrollRoot;
    if (!main) return undefined;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        reportPhoneScrollHideRef.current(main.scrollTop);
      });
    };

    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [mainScrollRoot]);

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
      setErrorKind(null);
      setLastFailedQuery(null);
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
  const answerPreformatted = Boolean(answer?.preformatted && answer?.grounded);
  const safeAnswerText = useMemo(
    () => sanitizeAnswerDisplayText(answer?.answer ?? "", { preformatted: answerPreformatted }),
    [answer?.answer, answerPreformatted],
  );
  const answerFollowUpSuggestions = useMemo(() => {
    if (!answer || !latestAnswerQuery) return [];
    const priorQueries = [...priorAnswerTurns.map((turn) => turn.query), latestAnswerQuery];
    return buildAnswerFollowUpSuggestions(latestAnswerQuery, answer, priorQueries);
  }, [answer, latestAnswerQuery, priorAnswerTurns]);
  const hiddenPriorTurnCount = Math.max(0, priorAnswerTurns.length - maxVisiblePriorTurns);
  const visiblePriorTurns = useMemo(() => {
    if (showEarlierTurns || hiddenPriorTurnCount === 0) return priorAnswerTurns;
    return priorAnswerTurns.slice(-maxVisiblePriorTurns);
  }, [hiddenPriorTurnCount, priorAnswerTurns, showEarlierTurns]);
  const safeAnswerSections = useMemo(() => {
    return (answer?.answerSections ?? [])
      .map((section) => {
        const heading = sanitizeDisplayText(section.heading, { minLength: 1, minTokens: 1 });
        const body = sanitizeAnswerDisplayText(section.body, {
          minLength: 8,
          minTokens: 2,
          preformatted: answerPreformatted,
        });
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
  }, [answer?.answerSections, answerPreformatted, sourceLookup]);
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
          ? toolCatalogRecords.length
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
      icon={CircleAlert}
      title={demoMode ? "Demo mode" : "Setup required"}
      summary={
        demoMode ? "Synthetic data only; not clinical guidance." : "Configuration is needed before real uploads."
      }
      mobileSummary={demoMode ? "Synthetic data" : "Setup needed"}
      className={className}
    >
      <p className="text-base-minus leading-6 text-[color:var(--warning)]">
        {demoMode
          ? "Demo mode is active with three synthetic indexed documents, citations, source cards, image captions, and document links. Synthetic data only; not clinical guidance."
          : `Configure .env.local and run supabase/schema.sql before uploading or searching. ${setupWarning}`}
      </p>
    </UtilityDrawer>
  );
  const showAuthPanel = false;
  const showDegradedNotice = !isOnline || (apiUnavailable && !canRunSearch);
  const hasMobileBottomSearch = searchMode !== "answer";
  const submittedAnswerSearchActive =
    activeModeResultKind === "answer" && !answer && canRunSearch && (modeSearchSubmitted || Boolean(submittedUrlQuery));
  const showAnswerHome = activeModeResultKind === "answer" && !answer && !loading && !submittedAnswerSearchActive;
  const showAnswerPending =
    activeModeResultKind === "answer" && !answer && (loading || (submittedAnswerSearchActive && !error));
  const showDesktopHomeComposer =
    !error &&
    (activeModeResultKind === "tools" ||
      activeModeResultKind === "favourites" ||
      (!loading &&
        (showAnswerHome ||
          (searchMode === "documents" &&
            activeModeResultKind === "documents" &&
            documentMatches.length === 0 &&
            !modeSearchSubmitted) ||
          (searchMode === "prescribing" && activeModeResultKind === "documents" && !modeSearchSubmitted) ||
          (activeModeResultKind === "differentials" && !modeSearchSubmitted))));
  const desktopHomeComposerSlotId = showDesktopHomeComposer ? modeHomeDesktopComposerSlotId : undefined;
  // Favourites and Tools are content-rich hubs: they share the centred hero but
  // stay top-aligned so their lists start in a stable position.
  const centeredModeHome =
    showDesktopHomeComposer && activeModeResultKind !== "tools" && activeModeResultKind !== "favourites";
  // Short mode homes (centred homes plus the services/forms registry homes)
  // drop the large mobile bottom padding so phones don't get a scrollbar for
  // content that already fits. Result views keep the full clearance.
  const compactMobileModeHome =
    centeredModeHome ||
    ((searchMode === "services" || searchMode === "forms") && !modeSearchSubmitted && !query.trim() && !loading);
  // Submitted (non-answer) searches are result views, not mode homes: on phones
  // the bottom composer drops its chip row and hugs the screen edge so results
  // keep maximum vertical space. Mode homes keep the default chip-row layout.
  const compactMobileBottomSearch = hasMobileBottomSearch && modeSearchSubmitted;
  const differentialsCompareAddonActive =
    searchMode === "differentials" && modeSearchSubmitted && Boolean(query.trim());
  const renderDegradedNotice = () => (
    <UtilityDrawer
      icon={!isOnline ? WifiOff : CircleAlert}
      title={!isOnline ? "Offline" : "Service unavailable"}
      summary={
        !isOnline
          ? "Your browser is offline. Existing content may remain visible, but private search and uploads need network access."
          : isDeployedClinicalKb()
            ? "The app could not reach its API. Try again in a moment."
            : "The local API did not respond. Check the app server and setup status before retrying."
      }
      mobileSummary={!isOnline ? "Offline" : "API unavailable"}
    >
      <p className="text-base-minus leading-6 text-[color:var(--warning)]">
        {!isOnline
          ? "Reconnect before uploading documents, refreshing source URLs, or generating answers."
          : isDeployedClinicalKb()
            ? "The app will preserve the current view. If this keeps happening, check your connection and try again shortly."
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
      summary: uploadReadOnlyMode || !canUploadDocuments ? "Locked" : "Ready",
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

  // Stable-identity handlers for the React.memo children (StagedAnswerResultSurface,
  // DocumentSearchResultsPanel). These close over the draft `query` or call the
  // intentionally-unstable executeSearch, so plain useCallback can't isolate them
  // from per-keystroke re-renders — useEventCallback keeps identity fixed while
  // always invoking the latest closure. See use-event-callback.ts.
  const handleScopeDocument = useEventCallback(scopeOnlyDocument);
  const handleAnswerFromDocument = useEventCallback(answerFromDocument);
  const handleSubmitAnswerFeedback = useEventCallback(submitAnswerFeedback);
  const handleAnswerFollowUpQuote = useEventCallback(handleFollowUpQuote);
  const handleFollowUpSuggestionPick = useEventCallback(handlePickFollowUpSuggestion);
  const handleCrossModeSearch = useEventCallback(crossModeSearch);
  const handleDocumentTagSearch = useEventCallback(handleTagSearch);
  const handleOpenRecentDocuments = useEventCallback(openRecentDocuments);
  const handleOpenSourceLibrary = useEventCallback(openSourceLibrary);
  const handleOpenSourcePdfBrowser = useEventCallback(openSourcePdfBrowser);
  const handleCopyAnswer = useEventCallback(() => {
    copyText("answer", answerRenderModel?.copyText || safeAnswerText || answer?.answer || "");
  });
  // The answer thread's prior-query list, memoized so it isn't a fresh array on
  // every keystroke (it feeds two memoized surfaces below).
  const crossModeQueries = useMemo(
    () => [...priorAnswerTurns.map((turn) => turn.query), latestAnswerQuery],
    [priorAnswerTurns, latestAnswerQuery],
  );

  return (
    <div
      className={cn(
        appBackdrop,
        "mobile-app-shell flex flex-col overflow-hidden text-[color:var(--text)] md:grid md:grid-cols-[5.25rem_minmax(0,1fr)] md:overflow-hidden",
        "motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-safe:ease-out",
        sidebarCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[20rem_minmax(0,1fr)]",
      )}
      style={
        {
          "--clinical-sidebar-width": sidebarCollapsed ? "5.25rem" : "20rem",
          "--clinical-sidebar-width-md": "5.25rem",
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:h-full">
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
            if (!answer) setModeSearchSubmitted(false);
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
          recentQueries={recentQueries}
          commandScopes={commandScopes}
          onCommandScopesChange={setCommandScopes}
          onPickRecent={(recent) => {
            pickRecentQuery(recent);
            void ask();
          }}
          onCrossModeSearch={crossModeSearch}
          composerFollowUpSuggestions={searchMode === "answer" ? answerFollowUpSuggestions : undefined}
          onPickComposerFollowUpSuggestion={handlePickFollowUpSuggestion}
          composerFollowUpSuggestionsDisabled={loading}
          composerPlaceholder={searchMode === "answer" && latestAnswerQuery ? "Ask a follow-up..." : undefined}
          mobileSearchPlacement={hasMobileBottomSearch ? "bottom" : "default"}
          mobileBottomSearchVariant={compactMobileBottomSearch ? "compact" : "default"}
          mobileBottomSearchAddonSlotId={
            differentialsCompareAddonActive ? differentialsMobileCompareAddonSlotId : undefined
          }
          desktopHomeComposerSlotId={desktopHomeComposerSlotId}
          // Phone-only: the header sits above the internally scrolling <main>,
          // so hiding must collapse its layout space to hand it to content.
          hideOnScroll={{ strategy: "collapse", scrollHidden: phoneScrollHide.hidden }}
          onBottomComposerScrollHiddenChange={setBottomSearchScrollHidden}
        />

        <main
          id="main-content"
          ref={assignMainRef}
          tabIndex={-1}
          onScroll={handleMainScroll}
          className={cn(
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] focus:outline-none",
            searchMode === "answer"
              ? compactMobileModeHome
                ? "mb-0"
                : // Phone answer view: the "Ask a follow-up" dock is fixed to the
                  // bottom, so <main> reserves room for it. When that dock hides on
                  // scroll, reclaim the reserved strip too — otherwise the near-black
                  // shell background shows through as an empty band. (sm+ is inert:
                  // bottomSearchScrollHidden only ever goes true on phones.)
                  bottomSearchScrollHidden
                  ? "mb-0 sm:mb-24"
                  : answerFollowUpSuggestions.length > 0
                    ? "mb-[calc(18rem+env(safe-area-inset-bottom))] sm:mb-24"
                    : "mb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:mb-24"
              : hasMobileBottomSearch
                ? bottomSearchScrollHidden
                  ? "mb-0 sm:mb-0"
                  : compactMobileBottomSearch
                    ? differentialsCompareAddonActive
                      ? "mb-[calc(8.75rem+env(safe-area-inset-bottom))] sm:mb-0"
                      : "mb-[calc(5rem+env(safe-area-inset-bottom))] sm:mb-0"
                    : // Mode homes keep the composer in the hero (in-flow at every
                      // width), so phones need no bottom-dock clearance on them.
                      compactMobileModeHome || showDesktopHomeComposer
                      ? "mb-0"
                      : "mb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:mb-0"
                : "mb-0",
          )}
        >
          <h1 className="sr-only">Clinical Guide</h1>
          <SearchCommandProvider value={searchCommandContextValue}>
            <div
              className={cn(
                // overflow-x-CLIP, not -hidden: hidden makes this wrapper a scroll
                // container (overflow-y computes to auto), which clips the composer's
                // command dropdown mid-panel and shows a phantom inner scrollbar.
                "mx-auto max-w-7xl space-y-4 overflow-x-clip px-3 py-4 sm:space-y-5 sm:px-4 sm:py-5 lg:px-8",
                compactMobileModeHome && "max-sm:px-0",
                // Centred mode homes carry little content, so drop the large
                // mobile bottom padding (the fixed composer already has its own
                // reserved margin on <main>) to avoid a needless scrollbar.
                // sm+/lg values stay identical to the result-view treatment.
                searchMode === "answer"
                  ? compactMobileModeHome
                    ? "pb-4"
                    : "pb-32 sm:pb-36 lg:pb-40"
                  : hasMobileBottomSearch
                    ? compactMobileModeHome
                      ? "pb-4 sm:pb-10 lg:pb-12"
                      : compactMobileBottomSearch || showDesktopHomeComposer
                        ? "pb-8 sm:pb-10 lg:pb-12"
                        : "pb-32 sm:pb-10 lg:pb-12"
                    : "pb-8 sm:pb-10 lg:pb-12",
              )}
            >
              {actionNotice && (
                <InlineNotice tone={actionNotice.tone} onDismiss={() => setActionNotice(null)} animated>
                  {actionNotice.message}
                </InlineNotice>
              )}
              {showDegradedNotice && renderDegradedNotice()}
              {showSystemNotice && answer ? renderSystemNotice("hidden sm:block") : null}

              <section
                className={cn(
                  compactMobileModeHome
                    ? cn(
                        // Every breakpoint keeps a viewport-height floor so
                        // justify/place-items-center has free space to centre the
                        // home block instead of hugging the header.
                        "max-sm:flex max-sm:min-h-[calc(100dvh-12.5rem)] max-sm:flex-col sm:min-h-[calc(100dvh-11rem)]",
                        centeredModeHome && "max-sm:justify-center",
                      )
                    : "min-h-[calc(100dvh-12.5rem)] sm:min-h-[calc(100dvh-11rem)]",
                  centeredModeHome || showAnswerHome
                    ? // Phones centre the home block mid-screen, matching the
                      // standalone-route homes; the pop-up action surface picks
                      // its own up/down placement so it stays unclipped either way.
                      "grid w-full place-items-center max-sm:pt-2"
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
                {error && errorKind === "no-results" && activeModeResultKind === "answer" ? (
                  <div
                    role="status"
                    data-testid="answer-no-results"
                    className={cn("rounded-lg border p-4 text-sm", toneInfo)}
                  >
                    <div className="flex items-start gap-2">
                      <Search aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-[color:var(--text-heading)]">
                          {answerRecovery.noResults.heading}
                        </p>
                        <p className={textMuted}>{answerRecovery.noResults.body}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid="answer-no-results-rephrase"
                        onClick={() => focusComposerInput()}
                        className={cn(primaryControl, "text-xs")}
                      >
                        {answerRecovery.rephrase}
                      </button>
                      <button
                        type="button"
                        data-testid="answer-no-results-search-documents"
                        onClick={() => crossModeSearch("documents", (lastFailedQuery ?? query).trim())}
                        className={cn(floatingControl, "text-xs")}
                      >
                        <FileText aria-hidden="true" className="h-4 w-4" />
                        {answerRecovery.searchDocuments}
                      </button>
                    </div>
                  </div>
                ) : error ? (
                  <div
                    role="alert"
                    data-testid="answer-error"
                    className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-3 text-sm font-medium text-[color:var(--danger)]"
                  >
                    <div className="flex items-start gap-2">
                      <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">{error}</span>
                    </div>
                    {activeModeResultKind === "answer" && lastFailedQuery && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid="answer-error-retry"
                          onClick={() => {
                            const retryQuery = lastFailedQuery ?? query;
                            setError(null);
                            void ask(retryQuery);
                          }}
                          className={cn(floatingControl, "text-xs")}
                        >
                          <RefreshCw aria-hidden="true" className="h-4 w-4" />
                          {answerRecovery.retry}
                        </button>
                        <button
                          type="button"
                          data-testid="answer-error-search-documents"
                          onClick={() => crossModeSearch("documents", (lastFailedQuery ?? query).trim())}
                          className={cn(floatingControl, "text-xs")}
                        >
                          <FileText aria-hidden="true" className="h-4 w-4" />
                          {answerRecovery.searchDocuments}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {searchMode !== "prescribing" &&
                  (activeModeResultKind === "answer" && (loading || answer) ? (
                    // Answer result view keeps this status slot mounted through the
                    // whole loading→answer swap so its height never collapses and the
                    // answer below it doesn't jump up (CLS). The accent chrome only
                    // appears while a progress message is live; otherwise it's a
                    // height-reserved, visually empty spacer.
                    <div
                      role="status"
                      aria-live="polite"
                      className={cn(
                        "flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium",
                        loading && answerProgress
                          ? "border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] text-[color:var(--text-heading)]"
                          : "border border-transparent",
                      )}
                    >
                      {loading && answerProgress ? (
                        <>
                          <Loader2
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 animate-spin text-[color:var(--clinical-accent)]"
                          />
                          <span className="min-w-0 flex-1 truncate">{answerProgress}</span>
                          <button
                            type="button"
                            onClick={stopSearch}
                            data-testid="stop-answer"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                          >
                            <Square aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" />
                            Stop
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : loading && answerProgress ? (
                    <div
                      role="status"
                      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-medium text-[color:var(--text-heading)]"
                    >
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 animate-spin text-[color:var(--clinical-accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{answerProgress}</span>
                      <button
                        type="button"
                        onClick={stopSearch}
                        data-testid="stop-answer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                      >
                        <Square aria-hidden="true" className="h-3 w-3 shrink-0 fill-current" />
                        Stop
                      </button>
                    </div>
                  ) : null)}

                {activeModeResultKind === "differentials" ? (
                  <DifferentialsHome
                    query={query}
                    loading={loading}
                    searchSubmitted={modeSearchSubmitted}
                    evidenceQuery={differentialEvidenceQuery}
                    documentMatches={documentMatches}
                    realDataReady={canRunSearch}
                    authUnavailable={false}
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
                  <ToolsHub query={query} desktopComposerSlotId={desktopHomeComposerSlotId} />
                ) : activeModeResultKind === "favourites" ? (
                  <FavouritesHub
                    query={query}
                    onClearQuery={() => {
                      setQuery("");
                      setModeSearchSubmitted(false);
                      router.replace(appModeHomeHref("favourites", { focus: true, queryMode, scopeFilters }));
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
                      {searchMode === "documents" && modeSearchSubmitted && (
                        <CrossModeLinksSection queries={[query]} onModeSearch={crossModeSearch} />
                      )}
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
                        realDataReady={searchMode === "services" || searchMode === "forms" ? true : canRunSearch}
                        authUnavailable={false}
                        apiUnavailable={apiUnavailable}
                        setupWarning={setupWarning}
                        facets={searchFacets}
                        onScopeDocument={handleScopeDocument}
                        onAnswerFromDocument={handleAnswerFromDocument}
                        onOpenRecentDocuments={handleOpenRecentDocuments}
                        onOpenLibrary={handleOpenSourceLibrary}
                        onOpenSourcePdf={handleOpenSourcePdfBrowser}
                        onTagSearch={handleDocumentTagSearch}
                        showHome={searchMode === "documents" && !modeSearchSubmitted}
                        desktopComposerSlotId={desktopHomeComposerSlotId}
                      />
                    </>
                  )
                ) : showAnswerPending ? (
                  streamingAnswer && (streamingAnswer.text || streamingAnswer.revising) ? (
                    <StreamingAnswerPreview text={streamingAnswer.text} revising={streamingAnswer.revising} />
                  ) : (
                    <AnswerSkeleton />
                  )
                ) : answer && answerRenderModel ? (
                  stagedDashboardExtraction.answerSurface ? (
                    <>
                      {hiddenPriorTurnCount > 0 && !showEarlierTurns ? (
                        <button
                          type="button"
                          data-testid="answer-thread-show-earlier"
                          onClick={() => setShowEarlierTurns(true)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                        >
                          Show earlier messages ({hiddenPriorTurnCount})
                        </button>
                      ) : null}
                      {visiblePriorTurns.map((turn) => (
                        <PriorAnswerTurnSurface
                          key={turn.id}
                          turn={turn}
                          copied={copiedAction === turn.id}
                          collapsed={collapsedTurnIds.has(turn.id)}
                          onToggleCollapsed={() => toggleAnswerTurnCollapsed(turn.id)}
                          onCopy={(text) => copyText(turn.id, text)}
                        />
                      ))}
                      <StagedAnswerResultSurface
                        answer={answer}
                        query={latestAnswerQuery ?? query}
                        bestSource={bestSource}
                        sourceGovernanceWarnings={sourceGovernanceWarnings}
                        sourceSummary={sourceSummary}
                        renderModel={answerRenderModel}
                        weakEvidence={weakEvidence}
                        answerViewMode={answerViewMode}
                        answerEvidenceMapRows={answerEvidenceMapRows}
                        onScopeDocument={handleScopeDocument}
                        answerGrounded={answerGrounded}
                        sources={answerRenderModel.reviewSources}
                        demoMode={demoMode}
                        safeAnswerSections={safeAnswerSections}
                        safetyFindings={safetyFindings}
                        copiedAnswer={copiedAction === "answer"}
                        pendingFeedback={pendingFeedback}
                        onCopyAnswer={handleCopyAnswer}
                        onSubmitFeedback={handleSubmitAnswerFeedback}
                        onFollowUpQuote={handleAnswerFollowUpQuote}
                        followUpSuggestions={answerFollowUpSuggestions}
                        onPickFollowUpSuggestion={handleFollowUpSuggestionPick}
                        followUpSuggestionsDisabled={loading}
                        crossModeQueries={crossModeQueries}
                        onCrossModeSearch={handleCrossModeSearch}
                      />
                    </>
                  ) : null
                ) : showAnswerHome ? (
                  <AnswerEmptyState
                    onSearchDocuments={() => setSearchMode("documents")}
                    onUploadDocument={openUploadDrawer}
                    desktopComposerSlotId={desktopHomeComposerSlotId}
                    recentQueries={recentQueries}
                    onSelectRecent={(recentQuery) => {
                      setQuery(recentQuery);
                      void ask(recentQuery);
                    }}
                  />
                ) : null}
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
                                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--glow-soft)]"
                                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                              )}
                            >
                              <span className="flex items-center gap-1.5 text-xs font-bold">
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                              </span>
                              <span className="mt-1 block truncate text-2xs font-semibold opacity-80">
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
                            canUpload={canUploadDocuments}
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
          </SearchCommandProvider>
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

function DrawerGroupLabel({ title }: { title: string }) {
  return (
    <p className="px-1 pt-1 text-2xs font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{title}</p>
  );
}
