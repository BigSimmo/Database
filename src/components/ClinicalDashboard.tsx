"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
  FileImage,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Quote,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tag,
  Target,
  UploadCloud,
  WifiOff,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AccessibleTable } from "@/components/AccessibleTable";
import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { DocumentManagementActions, type DocumentDeleteResult } from "@/components/DocumentManagementActions";
import { documentCitationHref, formatCompactCitationLabel, formatCitationLabel } from "@/lib/citations";
import { extractSafetyFindings, formatSafetyFindingLabel } from "@/lib/clinical-safety";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { isLocalNoAuthMode } from "@/lib/env";
import { normalizeSourceMetadata, sourceStatusLabel, validationStatusLabel } from "@/lib/source-metadata";
import {
  appBackdrop,
  answerSurface,
  clinicalDivider,
  cn,
  commandInput,
  evidenceSurface,
  EmptyState,
  fieldControlPlain,
  fieldControlWithIcon,
  fieldIcon,
  floatingControl,
  glassPanel,
  iconTilePremium,
  fieldLabel,
  LoadingPanel,
  metadataPill,
  navPill,
  panel,
  panelSubtle,
  premiumHeaderSurface,
  primaryControl,
  raisedCard,
  sheetHandle,
  sheetSurface,
  shellChip,
  SourceProvenance,
  SourceStatusBadge,
  sourceCard,
  subtleStatusPill,
  textMuted,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import { AUTH_EMAIL_STORAGE_KEY, useAuthSession } from "@/lib/supabase/client";
import { nextTheme, resolveThemePreference, type ResolvedTheme } from "@/lib/theme";
import { SafeBoldText } from "@/components/SafeBoldText";
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
  parseAnswerDisplayContent,
  type AnswerDisplayLine,
  type AnswerDisplayTone,
  type ParsedAnswerDisplay,
} from "@/lib/answer-formatting";
import {
  clinicalProseUsefulness,
  sourceTextForClinicalProse,
  sourceTextForClinicalProsePreservingBreaks,
} from "@/lib/source-text-sanitizer";
import { groupSourceGovernanceWarnings, type SourceGovernanceWarning } from "@/lib/source-governance";
import { smartEvidenceTags } from "@/lib/evidence-tags";
import {
  buildSmartDocumentTagFacets,
  filterDocumentsBySmartTagFacets,
  reviewDocumentTagQuality,
  smartDocumentFacetGroups,
  tagSearchText,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
  type SmartDocumentTagGroup,
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
  ConflictOrGap,
  RelatedDocument,
  EvidenceSummary,
  SearchResult,
  SourceEvidenceRelevance,
  SearchScopeSummary,
  VisualEvidenceCard,
  ClinicalQueryMode,
} from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import {
  type AnswerEvidenceMapRow,
  type AnswerViewMode,
  buildAnswerEvidenceMap,
  buildClinicalOutputSections,
  buildHighYieldClinicalOutputSections,
  createQuoteFollowUp,
  formatQuotesForClipboard,
  shouldPollForUpdates,
} from "@/lib/ward-output";

const sampleQueries = [
  {
    label: "Monitoring overview",
    query: "What monitoring and escalation issues should I consider across these documents?",
  },
  {
    label: "Lithium safety-net",
    query: "What toxicity safety-net symptoms should be reviewed for lithium?",
  },
  {
    label: "Clozapine table",
    query: "What clozapine monitoring items are shown in the table image?",
  },
  {
    label: "Risk escalation",
    query: "When should acute risk be escalated for senior review?",
  },
] as const;

const navigationHashes = ["#search", "#quotes", "#images", "#sources"] as const;
const mobileSectionFabMediaQuery = "(max-width: 768px), ((max-width: 1023px) and (hover: none) and (pointer: coarse))";

const themeStorageKey = "clinical-kb-theme";
const themeChangeEvent = "clinical-kb-theme-change";
const authEmailChangeEvent = "clinical-kb-auth-email-change";
const documentPageSize = 150;
const activeIndexingPollFallbackMs = 5_000;
const setupRecheckPollMs = 60_000;
const indexingWorkDetailsPollMs = 15_000;

type SetupCheckStatus = "ready" | "needs_setup" | "unknown";
type SetupCheck = {
  id: "env" | "project" | "schema" | "search" | "openai" | "worker";
  label: string;
  status: SetupCheckStatus;
  detail: string;
};
type DocumentPagination = {
  limit: number;
  offset: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
};
type SearchMode = "answer" | "documents";
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

type SearchFacet = { value: string; count: number };
type SearchFacets = {
  status?: SearchFacet[];
  validation?: SearchFacet[];
  extractionQuality?: SearchFacet[];
  sections?: SearchFacet[];
  labels?: SearchFacet[];
  documentTypes?: SearchFacet[];
  evidence?: SearchFacet[];
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

function splitFilterText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function filterText(values?: string[]) {
  return (values ?? []).join(", ");
}

function compactScopeFilters(filters: SearchScopeFilters) {
  const next: SearchScopeFilters = {};
  if (filters.medications?.length) next.medications = filters.medications;
  if (filters.topics?.length) next.topics = filters.topics;
  if (filters.documentTypes?.length) next.documentTypes = filters.documentTypes;
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

function getThemeSnapshot(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveThemePreference(storedTheme, prefersDark);
}

function getServerThemeSnapshot(): ResolvedTheme {
  return "light";
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => onStoreChange();

  window.addEventListener("storage", notify);
  window.addEventListener(themeChangeEvent, notify);
  mediaQuery.addEventListener("change", notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(themeChangeEvent, notify);
    mediaQuery.removeEventListener("change", notify);
  };
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

function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggleTheme() {
    const resolved = nextTheme(theme);
    window.localStorage.setItem(themeStorageKey, resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return { theme, toggleTheme };
}

function statusTone(status: string) {
  if (status === "indexed" || status === "completed") {
    return {
      icon: CheckCircle2,
      className: toneSuccess,
    };
  }
  if (status === "failed") {
    return {
      icon: AlertCircle,
      className: toneDanger,
    };
  }
  if (status === "processing") {
    return {
      icon: Loader2,
      className: toneInfo,
    };
  }
  return {
    icon: FileText,
    className: toneNeutral,
  };
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold",
        tone.className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "processing" && "animate-spin")} />
      {status}
    </span>
  );
}

function StrengthBadge({ strength }: { strength?: string }) {
  const label = strength ?? "source";
  const className = strength === "strong" ? toneSuccess : strength === "limited" ? toneWarning : toneInfo;

  return (
    <span
      className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold", className)}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </span>
  );
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

function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
  testId,
  hideDescriptionOnMobile = false,
  compactMobile = false,
}: {
  icon: typeof Search;
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
  hideDescriptionOnMobile?: boolean;
  compactMobile?: boolean;
}) {
  const alignWhenCompact = compactMobile && hideDescriptionOnMobile ? "items-center sm:items-start" : "items-start";

  return (
    <div
      data-testid={testId}
      className={cn("flex flex-wrap justify-between", alignWhenCompact, compactMobile ? "gap-2 sm:gap-3" : "gap-3")}
    >
      <div className={cn("flex min-w-0", alignWhenCompact, compactMobile ? "gap-2 sm:gap-3" : "gap-3")}>
        <span
          data-section-heading-icon
          className={cn(
            "grid shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
            compactMobile ? "h-7 w-7 sm:h-9 sm:w-9" : "h-9 w-9",
          )}
        >
          <Icon className={cn(compactMobile ? "h-4 w-4 sm:h-4.5 sm:w-4.5" : "h-4.5 w-4.5")} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[color:var(--text-heading)] sm:text-base">{title}</h2>
          {description && (
            <p className={cn("mt-1 text-sm leading-6", textMuted, hideDescriptionOnMobile && "hidden sm:block")}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

function relevanceChipLabel(
  relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined,
  grounded = false,
) {
  if (!relevance) return grounded ? "Source-backed" : "No direct support";
  if (relevance.verdict === "direct") return "Source-backed";
  if (relevance.verdict === "partial") return "Partial support";
  if (relevance.verdict === "nearby") return "Nearby only";
  return "No direct support";
}

function relevanceChipClasses(
  relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined,
  grounded = false,
) {
  const verdict = relevance?.verdict ?? (grounded ? "direct" : "none");
  if (verdict === "direct") {
    return "border-[color:var(--success)]/20 bg-[color:var(--success-soft)]/45 text-[color:var(--success)]";
  }
  if (verdict === "partial") {
    return "border-[color:var(--primary)]/25 bg-[color:var(--primary-soft)]/45 text-[color:var(--primary)]";
  }
  return "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)]/45 text-[color:var(--warning)]";
}

function hasStrongRelevanceIcon(
  relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined,
  grounded = false,
) {
  const verdict = relevance?.verdict ?? (grounded ? "direct" : "none");
  return verdict === "direct" || verdict === "partial";
}

function isWeakRelevance(relevance: EvidenceRelevance | SourceEvidenceRelevance | null | undefined) {
  return !relevance?.isSourceBacked || relevance.verdict === "nearby" || relevance.verdict === "none";
}

function RelevanceBadge({
  relevance,
  grounded = false,
  testId,
}: {
  relevance?: EvidenceRelevance | SourceEvidenceRelevance | null;
  grounded?: boolean;
  testId?: string;
}) {
  const showStrongIcon = hasStrongRelevanceIcon(relevance, grounded);
  const label = relevanceChipLabel(relevance, grounded);
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold leading-none sm:min-h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs",
        relevanceChipClasses(relevance, grounded),
      )}
      aria-label={label}
      title={relevance?.supportReason ?? label}
    >
      {showStrongIcon ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </span>
  );
}

function QueryCoverageChips({
  relevance,
  limit = 4,
}: {
  relevance?: SourceEvidenceRelevance | EvidenceRelevance | null;
  limit?: number;
}) {
  if (!relevance) return null;
  const chips =
    "chips" in relevance && relevance.chips.length
      ? relevance.chips
      : [
          relevance.matchedTerms.length ? `matched: ${relevance.matchedTerms.slice(0, 3).join(", ")}` : "",
          relevance.missingTerms.length ? `missing: ${relevance.missingTerms.slice(0, 3).join(", ")}` : "",
          relevanceChipLabel(relevance),
        ].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.slice(0, limit).map((chip) => (
        <span key={chip} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
          {chip}
        </span>
      ))}
    </div>
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

function MasterSearchHeader({
  documents,
  query,
  searchMode,
  loading,
  selectedDocumentIds,
  queryMode,
  scopeFilters,
  batches,
  hasAnswer,
  demoMode,
  realDataReady,
  theme,
  onQueryChange,
  onSearchModeChange,
  onAsk,
  onClearQuery,
  onClearScope,
  onQueryModeChange,
  onScopeFiltersChange,
  onToggleScope,
  onOpenGuide,
  onToggleTheme,
}: {
  documents: ClinicalDocument[];
  query: string;
  searchMode: SearchMode;
  loading: boolean;
  selectedDocumentIds: string[];
  queryMode: ClinicalQueryMode;
  scopeFilters: SearchScopeFilters;
  batches: ImportBatch[];
  hasAnswer: boolean;
  demoMode: boolean;
  realDataReady: boolean;
  theme: ResolvedTheme;
  onQueryChange: (query: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onAsk: () => void;
  onClearQuery: () => void;
  onClearScope: () => void;
  onQueryModeChange: (mode: ClinicalQueryMode) => void;
  onScopeFiltersChange: (filters: SearchScopeFilters) => void;
  onToggleScope: (documentId: string) => void;
  onOpenGuide: () => void;
  onToggleTheme: () => void;
}) {
  const trimmedQuery = query.trim();
  const canAsk = trimmedQuery.length >= 1 && !loading && realDataReady;
  const compactMobile = hasAnswer;
  const [scopeFilter, setScopeFilter] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const scopeSummaryRef = useRef<HTMLElement | null>(null);
  const scopeFilterInputRef = useRef<HTMLInputElement | null>(null);
  const selectedDocuments = selectedDocumentIds
    .map((id) => documents.find((document) => document.id === id))
    .filter((document): document is ClinicalDocument => Boolean(document));
  const scopeSummary = selectedDocumentIds.length === 0 ? "All documents" : `${selectedDocumentIds.length} scoped`;
  const scopePreview = selectedDocuments
    .slice(0, 2)
    .map((document) => document?.title.replace(/^Synthetic /, ""))
    .filter(Boolean)
    .join(", ");
  const normalizedScopeFilter = scopeFilter.trim().toLowerCase();
  const recentlyUpdatedDocuments = [...documents].sort((a, b) => {
    const bTime = Date.parse(b.updated_at || b.created_at || "");
    const aTime = Date.parse(a.updated_at || a.created_at || "");
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
  const matchingDocuments = normalizedScopeFilter
    ? recentlyUpdatedDocuments.filter((document) =>
        [document.title, document.file_name, document.description, tagSearchText(document)]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedScopeFilter)),
      )
    : recentlyUpdatedDocuments;
  const largeScopeSet = documents.length > 12;
  const requireScopeFilter = largeScopeSet && !normalizedScopeFilter;
  const visibleScopeDocuments = [
    ...selectedDocuments,
    ...(requireScopeFilter ? [] : matchingDocuments.filter((document) => !selectedDocumentIds.includes(document.id))),
  ].slice(0, 12);
  const hiddenScopeMatchCount = requireScopeFilter
    ? Math.max(0, selectedDocuments.length ? documents.length - selectedDocuments.length : documents.length)
    : Math.max(0, matchingDocuments.length - visibleScopeDocuments.length);
  const submitLabel = searchMode === "answer" ? (trimmedQuery ? "Answer" : "Ask") : "Docs";
  const collectionOptions = useMemo(() => {
    const values = new Set<string>();
    for (const document of documents) {
      const metadata =
        document.metadata && typeof document.metadata === "object"
          ? (document.metadata as Record<string, unknown>)
          : {};
      const collection = metadata.collection;
      if (typeof collection === "string" && collection.trim()) values.add(collection.trim());
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const closeScope = useCallback((restoreFocus = false) => {
    const details = scopeDetailsRef.current;
    if (!details?.open) return;
    details.open = false;
    setScopeOpen(false);
    if (restoreFocus) scopeSummaryRef.current?.focus();
  }, []);

  useEffect(() => {
    const details = scopeDetailsRef.current;
    if (!scopeOpen || !details?.open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!scopeDetailsRef.current?.contains(target)) closeScope(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeScope(true);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeScope, scopeOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAsk();
  }

  function documentScopeTitle(document: ClinicalDocument) {
    return document.title.replace(/^Synthetic /, "").replace(/\.pdf$/i, "");
  }

  function documentScopeMeta(document: ClinicalDocument) {
    const title = documentScopeTitle(document).toLowerCase();
    const fileName = document.file_name;
    const fileBase = fileName.replace(/\.pdf$/i, "").toLowerCase();
    if (fileBase === title || fileBase.startsWith(title)) return `${document.page_count ?? "?"} pages`;
    return `${fileName} · ${document.page_count ?? "?"} pages`;
  }

  function renderScopeRows() {
    return (
      <div className="grid gap-3">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="mb-2 flex min-h-7 items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-300">Document scope</p>
            <span className="shrink-0 text-[11px] font-semibold text-slate-400">
              {selectedDocumentIds.length ? `${selectedDocumentIds.length} selected` : `${documents.length} available`}
            </span>
          </div>
          <div className="space-y-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={scopeFilterInputRef}
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value)}
                data-testid="document-scope-filter"
                aria-label="Filter document scope"
                placeholder="Filter documents by title or file"
                className="h-10 w-full rounded-lg border border-white/12 bg-white/8 pl-9 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-400 focus:border-teal-300/50 focus:ring-4 focus:ring-teal-300/15"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClearScope}
                className={cn(
                  shellChip,
                  selectedDocumentIds.length === 0
                    ? "border-teal-300/40 bg-teal-300/18 text-teal-50"
                    : "border-white/12 bg-white/6 text-slate-200 hover:bg-white/10",
                )}
              >
                All documents
              </button>
              {scopeFilter ? (
                <span className="rounded-md bg-white/8 px-2 py-1 text-[11px] font-semibold text-slate-300">
                  {matchingDocuments.length} match{matchingDocuments.length === 1 ? "" : "es"}
                </span>
              ) : (
                <span className="rounded-md bg-white/8 px-2 py-1 text-[11px] font-semibold text-slate-300">
                  Recently updated first
                </span>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto pr-1 polished-scroll">
              <div className="grid gap-1.5">
                {requireScopeFilter && visibleScopeDocuments.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-300">
                    Type to filter {documents.length} documents. Selected documents stay pinned here.
                  </p>
                ) : null}
                {visibleScopeDocuments.map((document) => {
                  const selected = selectedDocumentIds.includes(document.id);
                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => onToggleScope(document.id)}
                      title={document.title}
                      className={cn(
                        "grid min-h-[44px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition motion-safe:duration-150",
                        selected
                          ? "border-teal-300/40 bg-teal-300/18 text-teal-50"
                          : "border-white/10 bg-white/5 text-slate-200 hover:border-white/18 hover:bg-white/9",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-md border",
                          selected ? "border-teal-200/50 bg-teal-200/20" : "border-white/18 bg-white/5",
                        )}
                        aria-hidden
                      >
                        {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{documentScopeTitle(document)}</span>
                        <span className="block truncate text-[11px] font-medium text-slate-400">
                          {documentScopeMeta(document)}
                        </span>
                        <DocumentTagCloud
                          labels={document.labels}
                          query={scopeFilter}
                          limit={2}
                          compact
                          expandable={false}
                          className="mt-1"
                        />
                      </span>
                      {selected ? (
                        <span className="rounded-md bg-teal-200/15 px-2 py-1 text-[11px] font-bold text-teal-50">
                          In scope
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {!requireScopeFilter && visibleScopeDocuments.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-300">
                    No documents match that filter. Clear the filter or search by file name.
                  </p>
                ) : null}
              </div>
            </div>
            {hiddenScopeMatchCount > 0 ? (
              <p className="px-1 text-xs font-medium text-slate-400">
                {requireScopeFilter
                  ? `${documents.length} documents available. Type a title or file name to narrow the list.`
                  : `Showing ${visibleScopeDocuments.length} of ${matchingDocuments.length}. Keep typing to narrow the list.`}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <header
      id="search"
      className={cn(
        "sticky top-0 z-30 px-3 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 lg:px-8",
        premiumHeaderSurface,
        compactMobile ? "sm:py-2.5" : "sm:py-3",
      )}
      style={{ backgroundColor: "var(--app-shell)" }}
    >
      <div className="mx-auto max-w-7xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "grid shrink-0 place-items-center rounded-lg border border-white/20 bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] text-[color:var(--primary-contrast)] shadow-[var(--glow-soft)]",
                compactMobile ? "h-9 w-9 sm:h-[44px] sm:w-[44px]" : "h-[44px] w-[44px]",
              )}
            >
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-base font-semibold">Clinical Guide</h1>
                {demoMode && (
                  <span className="hidden shrink-0 rounded-md border border-amber-300/25 bg-amber-300/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-100 sm:inline-flex">
                    Demo data
                  </span>
                )}
              </div>
              <p className={cn("truncate text-xs font-medium text-slate-300", compactMobile && "hidden sm:block")}>
                {demoMode ? "Synthetic data only" : "Ask indexed guidelines"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {demoMode && (
              <span className="inline-flex rounded-md border border-amber-300/25 bg-amber-300/12 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-100 sm:hidden">
                Demo
              </span>
            )}
            <button
              type="button"
              onClick={onOpenGuide}
              className="hidden h-[44px] shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/7 px-3 text-xs font-semibold text-slate-100 shadow-[var(--shadow-tight)] transition hover:border-white/25 hover:bg-white/12 sm:inline-flex"
              aria-label="Open user guide"
            >
              <BookOpen className="h-4 w-4" />
              Guide
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-white/15 bg-white/7 text-slate-100 shadow-[var(--shadow-tight)] transition hover:border-white/25 hover:bg-white/12"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        <div className="grid gap-2 rounded-[var(--radius-lg)] border border-white/10 bg-white/6 p-1.5 shadow-[var(--shadow-inset)] sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div role="group" aria-label="Search mode" className="grid grid-cols-2 gap-1 sm:min-w-[14rem]">
            {[
              { mode: "answer" as const, label: "Answer", icon: Sparkles },
              { mode: "documents" as const, label: "Documents", icon: FileText },
            ].map((item) => {
              const active = searchMode === item.mode;
              const Icon = item.icon;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => onSearchModeChange(item.mode)}
                  className={cn(
                    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-semibold transition",
                    active
                      ? "bg-white text-slate-950 shadow-[var(--shadow-tight)]"
                      : "text-slate-200 hover:bg-white/10 hover:text-white",
                  )}
                  aria-pressed={active}
                  aria-label={item.mode === "answer" ? "Switch to answer mode" : "Switch to document search mode"}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <span className="hidden px-2 text-xs font-medium text-slate-300 lg:inline">
            {searchMode === "answer" ? "Synthesize cited clinical guidance" : "List matching source documents"}
          </span>
          <div className="ml-auto hidden min-w-0 items-center gap-2 sm:flex">
            <select
              value={queryMode}
              onChange={(event) => onQueryModeChange(event.target.value as ClinicalQueryMode)}
              aria-label="Clinical query mode"
              className="h-9 w-44 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
            >
              {clinicalQueryModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <details className="group relative">
              <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-white/15 bg-white/7 px-3 text-xs font-semibold text-slate-100">
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                Filters
                <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 grid w-[min(42rem,calc(100vw-2rem))] gap-2 rounded-lg border border-white/15 bg-[color:var(--surface-glass)] p-3 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-3">
                <input
                  value={filterText(scopeFilters.medications)}
                  onChange={(event) =>
                    onScopeFiltersChange({ ...scopeFilters, medications: splitFilterText(event.target.value) })
                  }
                  placeholder="Medication labels"
                  className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
                />
                <input
                  value={filterText(scopeFilters.topics)}
                  onChange={(event) =>
                    onScopeFiltersChange({ ...scopeFilters, topics: splitFilterText(event.target.value) })
                  }
                  placeholder="Topic labels"
                  className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
                />
                <input
                  value={filterText(scopeFilters.collections)}
                  onChange={(event) =>
                    onScopeFiltersChange({ ...scopeFilters, collections: splitFilterText(event.target.value) })
                  }
                  placeholder={collectionOptions.length ? `Collection: ${collectionOptions[0]}` : "Collection"}
                  className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
                />
                <select
                  value={scopeFilters.sourceStatuses?.[0] ?? ""}
                  onChange={(event) =>
                    onScopeFiltersChange({
                      ...scopeFilters,
                      sourceStatuses: event.target.value
                        ? [event.target.value as NonNullable<SearchScopeFilters["sourceStatuses"]>[number]]
                        : [],
                    })
                  }
                  className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
                >
                  <option value="">Any status</option>
                  <option value="current">Current</option>
                  <option value="review_due">Review due</option>
                  <option value="outdated">Outdated</option>
                  <option value="unknown">Unknown</option>
                </select>
                <select
                  value={scopeFilters.locality ?? ""}
                  onChange={(event) =>
                    onScopeFiltersChange({
                      ...scopeFilters,
                      locality: event.target.value ? (event.target.value as SearchScopeFilters["locality"]) : undefined,
                    })
                  }
                  className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
                >
                  <option value="">Any locality</option>
                  <option value="local">Local only</option>
                  <option value="non_local">Non-local only</option>
                </select>
                <button
                  type="button"
                  onClick={() => onScopeFiltersChange({})}
                  className="h-9 rounded-md border border-white/15 bg-white/7 px-2 text-xs font-semibold text-slate-100 hover:bg-white/12"
                >
                  Clear filters
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="hidden">
          <label className="min-w-0">
            <span className="sr-only">Clinical query mode</span>
            <select
              value={queryMode}
              onChange={(event) => onQueryModeChange(event.target.value as ClinicalQueryMode)}
              className="h-10 w-full rounded-lg border border-white/15 bg-white/95 px-3 text-sm font-semibold text-slate-950 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-300/20 dark:bg-slate-950/90 dark:text-slate-50"
            >
              {clinicalQueryModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <details className="group min-w-0">
            <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/7 px-3 text-xs font-semibold text-slate-100">
              <span className="inline-flex min-w-0 items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="truncate">Clinical filters</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
            </summary>
            <div className="mt-2 grid gap-2 rounded-lg border border-white/10 bg-white/6 p-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                value={filterText(scopeFilters.medications)}
                onChange={(event) =>
                  onScopeFiltersChange({ ...scopeFilters, medications: splitFilterText(event.target.value) })
                }
                placeholder="Medication labels"
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              />
              <input
                value={filterText(scopeFilters.topics)}
                onChange={(event) =>
                  onScopeFiltersChange({ ...scopeFilters, topics: splitFilterText(event.target.value) })
                }
                placeholder="Topic labels"
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              />
              <input
                value={filterText(scopeFilters.documentTypes)}
                onChange={(event) =>
                  onScopeFiltersChange({ ...scopeFilters, documentTypes: splitFilterText(event.target.value) })
                }
                placeholder="Document type labels"
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              />
              <select
                value={scopeFilters.sourceStatuses?.[0] ?? ""}
                onChange={(event) =>
                  onScopeFiltersChange({
                    ...scopeFilters,
                    sourceStatuses: event.target.value
                      ? [event.target.value as NonNullable<SearchScopeFilters["sourceStatuses"]>[number]]
                      : [],
                  })
                }
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              >
                <option value="">Any status</option>
                <option value="current">Current</option>
                <option value="review_due">Review due</option>
                <option value="outdated">Outdated</option>
                <option value="unknown">Unknown</option>
              </select>
              <select
                value={scopeFilters.locality ?? ""}
                onChange={(event) =>
                  onScopeFiltersChange({
                    ...scopeFilters,
                    locality: event.target.value ? (event.target.value as SearchScopeFilters["locality"]) : undefined,
                  })
                }
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              >
                <option value="">Any locality</option>
                <option value="local">Local only</option>
                <option value="non_local">Non-local only</option>
              </select>
              <select
                value={scopeFilters.importBatchIds?.[0] ?? ""}
                onChange={(event) =>
                  onScopeFiltersChange({
                    ...scopeFilters,
                    importBatchIds: event.target.value ? [event.target.value] : [],
                  })
                }
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              >
                <option value="">Any batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
              <input
                value={filterText(scopeFilters.collections)}
                onChange={(event) =>
                  onScopeFiltersChange({ ...scopeFilters, collections: splitFilterText(event.target.value) })
                }
                placeholder={collectionOptions.length ? `Collection: ${collectionOptions[0]}` : "Collection"}
                className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
              />
              <button
                type="button"
                onClick={() => onScopeFiltersChange({})}
                className="h-9 rounded-md border border-white/15 bg-white/7 px-2 text-xs font-semibold text-slate-100 hover:bg-white/12"
              >
                Clear filters
              </button>
            </div>
          </details>
        </div>

        <form
          onSubmit={submit}
          className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_136px_108px] lg:grid-cols-[minmax(0,1fr)_148px_116px]"
        >
          <label className="relative col-span-2 min-w-0 sm:col-span-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAsk();
              }}
              aria-label="Search indexed guidelines by question or keyword"
              placeholder="Ask a question or enter a keyword"
              className={commandInput}
            />
            {query && (
              <button
                type="button"
                onClick={onClearQuery}
                className="absolute right-2 top-1/2 grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                aria-label="Clear search question"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <button
            type="submit"
            disabled={!canAsk}
            title={
              !realDataReady
                ? "Search setup is not ready"
                : trimmedQuery.length < 1
                  ? searchMode === "answer"
                    ? "Enter a clinical question"
                    : "Enter a document search term"
                  : searchMode === "answer"
                    ? "Generate a source-backed answer"
                    : "Find matching documents"
            }
            className={cn(
              primaryControl,
              "min-h-[48px] rounded-[var(--radius-lg)] px-3 text-sm sm:min-h-[44px] sm:px-5 sm:text-sm",
            )}
            aria-label={searchMode === "answer" ? "Generate source-backed answer" : "Find matching documents"}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>{submitLabel}</span>
          </button>
          <details
            ref={scopeDetailsRef}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setScopeOpen(open);
              if (open) window.setTimeout(() => scopeFilterInputRef.current?.focus(), 0);
            }}
            className="group relative"
          >
            <summary
              ref={scopeSummaryRef}
              className="flex min-h-[48px] cursor-pointer list-none items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-white/15 bg-white/7 px-2 text-sm font-semibold text-slate-100 shadow-[var(--shadow-tight)] transition motion-safe:duration-150 hover:border-white/25 hover:bg-white/12 sm:min-h-[44px] sm:gap-2 sm:px-3 sm:text-xs"
              aria-label="Open document scope"
              aria-expanded={scopeOpen}
            >
              <Filter className="h-4 w-4" />
              <span>Scope</span>
              {selectedDocumentIds.length ? (
                <span className="rounded-md bg-teal-200/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-50">
                  {selectedDocumentIds.length}
                </span>
              ) : null}
            </summary>
            <div
              data-testid="scope-command-popover"
              className="mobile-popover-scroll polished-scroll fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] top-auto z-40 hidden max-h-[min(72dvh,34rem)] overflow-y-auto overscroll-contain rounded-[var(--radius-xl)] border border-white/15 bg-[color:var(--surface-glass)] p-3 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl transition motion-safe:duration-150 group-open:block dark:bg-[color:var(--app-shell-muted)] dark:text-white sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[28rem] sm:max-w-md sm:rounded-[var(--radius-lg)] sm:p-2.5"
            >
              <span className={cn(sheetHandle, "mb-3 bg-white/35 dark:bg-white/25")} aria-hidden />
              <div className="mb-2 flex min-h-8 items-center justify-between px-1 text-xs font-semibold text-[color:var(--text-muted)] dark:text-slate-300">
                <span>Document scope</span>
                <span>{scopeSummary}</span>
              </div>
              {scopePreview ? <p className="mb-2 truncate px-1 text-xs text-slate-300">{scopePreview}</p> : null}
              {renderScopeRows()}
            </div>
          </details>
        </form>
      </div>
    </header>
  );
}

function CopyButton({
  label,
  shortLabel,
  ariaLabel,
  copied,
  onClick,
}: {
  label: string;
  shortLabel?: string;
  ariaLabel?: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={cn(floatingControl, "px-3 text-xs")}
    >
      {copied ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      <span className="sm:hidden">{copied ? "Copied" : (shortLabel ?? label)}</span>
      <span className="hidden sm:inline">{copied ? "Copied" : label}</span>
    </button>
  );
}

function AnswerEmptyState({ onPickSample }: { onPickSample: (sample: string) => void }) {
  return (
    <div className="space-y-3">
      <EmptyState
        icon={Search}
        title="Ask indexed guidelines"
        body="The answer, quotes, source PDFs, and diagrams will appear here."
      />
      <section
        aria-label="Example questions"
        className={cn(
          "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 shadow-[var(--shadow-inset)]",
        )}
      >
        <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Examples</p>
          <span className={cn("text-[11px] font-semibold", textMuted)}>Quick start</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sample) => (
            <button
              key={sample.query}
              type="button"
              onClick={() => onPickSample(sample.query)}
              title={sample.query}
              aria-label={`Use sample question: ${sample.query}`}
              className={cn(
                floatingControl,
                "min-h-9 px-3 text-xs motion-safe:transition-colors motion-safe:duration-150",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {sample.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SourceActionRow({
  viewerHref,
  sourceTitle,
  documentId,
  onScopeDocument,
  onFollowUp,
  imageCount = 0,
  divider = true,
}: {
  viewerHref: string;
  sourceTitle: string;
  documentId: string;
  onScopeDocument: (documentId: string) => void;
  onFollowUp?: () => void;
  imageCount?: number;
  divider?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", divider && "border-t border-[color:var(--border)] pt-3")}>
      <Link href={viewerHref} className={cn(primaryControl, "min-h-[44px] px-4 text-xs")}>
        <FileText className="h-4 w-4" />
        Open page
      </Link>
      {onFollowUp && (
        <button
          type="button"
          onClick={onFollowUp}
          className={cn(floatingControl, "px-3 text-xs")}
          aria-label={`Ask a follow-up from ${sourceTitle}`}
        >
          <Search className="h-4 w-4" />
          <span className="sm:hidden">Follow-up</span>
          <span className="hidden sm:inline">Ask follow-up</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => onScopeDocument(documentId)}
        className={cn(floatingControl, "px-3 text-xs")}
        aria-label={`Search only ${sourceTitle}`}
      >
        <Filter className="h-4 w-4" />
        <span className="sm:hidden">Scope</span>
        <span className="hidden sm:inline">Use as scope</span>
      </button>
      {imageCount > 0 && (
        <span className={cn(metadataPill, "min-h-[44px] rounded-lg px-3")}>
          {imageCount} indexed image{imageCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function sourceResultHref(source: SearchResult) {
  return `/documents/${source.document_id}?page=${source.page_number ?? 1}&chunk=${source.id}`;
}

function logSourceOpen(query: string, source: SearchResult) {
  if (!query.trim()) return;
  void fetch("/api/search/interaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      documentId: source.document_id,
      chunkId: source.id,
      fileName: source.file_name,
      title: source.title,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

function SourcePassageLinks({
  heading,
  sources,
  compact = false,
}: {
  heading: string;
  sources: SearchResult[];
  compact?: boolean;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sources.slice(0, compact ? 2 : 3).map((source, index) => (
        <Link
          key={`${heading}:${source.id}:${index}`}
          href={sourceResultHref(source)}
          className={cn(
            compact ? metadataPill : floatingControl,
            "min-h-8 gap-1.5 px-2.5 text-[11px] sm:min-h-9 sm:px-3",
          )}
          title={`${source.title} · page ${source.page_number ?? "n/a"} · chunk ${source.chunk_index}`}
          aria-label={`Open source passage ${index + 1} for ${heading}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>p.{source.page_number ?? "n/a"}</span>
          <span className="hidden sm:inline">chunk {source.chunk_index}</span>
          {source.source_strength ? <span className="hidden sm:inline">· {source.source_strength}</span> : null}
        </Link>
      ))}
    </div>
  );
}

function SourceLinkedAnswer({
  sections,
  fallbackText,
  responseMode,
}: {
  sections: Array<AnswerSection & { citationSources: SearchResult[] }>;
  fallbackText: string;
  responseMode?: RagAnswer["responseMode"];
}) {
  const demoNotice = fallbackText.match(/Synthetic demo only:.*$/i)?.[0] ?? null;

  if (sections.length === 0) {
    return (
      <FormattedAnswerContent
        content={parseAnswerDisplayContent(fallbackText || "No usable answer text for this result.", responseMode)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => {
        const sectionContent = sectionBodyContent(section.body, responseMode);
        return (
          <article
            key={`${section.heading}:${section.citation_chunk_ids.join(",")}:${section.body.slice(0, 24)}`}
            className={cn("space-y-2.5 border-b border-[color:var(--border)] pb-3 last:border-b-0 last:pb-0")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn(metadataPill, "grid h-7 w-7 place-items-center px-0 text-[11px] font-bold")}>
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{section.heading}</h3>
                  <p className={cn("text-xs leading-5", textMuted)}>
                    {section.citationSources.length} source passage
                    {section.citationSources.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <SourcePassageLinks heading={section.heading} sources={section.citationSources} compact />
            </div>

            <FormattedAnswerContent content={sectionContent} />
          </article>
        );
      })}
      {demoNotice ? (
        <p className={cn("border-t border-[color:var(--border)] pt-3 text-[15px] font-medium leading-6", textMuted)}>
          {demoNotice}
        </p>
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
    .flatMap((line) =>
      line.split(/(?<=[.!?])\s+(?=(?:[A-Z]|\*\*|If\b|When\b|Do\b|Use\b|Monitor\b|Escalate\b|Document\b))/),
    )
    .map((fragment) =>
      fragment
        .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
        .replace(
          /^(?:\*\*)?(?:answer|summary|bottom line|direct answer|clinical point|key point|required actions?|monitoring(?:\/timing)?|thresholds?|dose detail|medication(?:\/dose details?)?|escalation(?:\/risk)?|risk|safety|documentation(?:\/forms)?|source gaps?)(?:\*\*)?:\s+/i,
          "",
        )
        .trim(),
    )
    .map((fragment) => clinicalProseUsefulness(fragment).text || fragment)
    .filter((fragment) => {
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

function NaturalLanguageAnswer({ text }: { text: string }) {
  const cleaned = primaryAnswerDisplayText(text);
  if (!cleaned) return null;

  return (
    <section
      data-testid="plain-answer-response"
      aria-label="Primary natural-language answer"
      className="relative overflow-hidden rounded-lg border border-[color:var(--primary)]/25 bg-[linear-gradient(180deg,var(--surface-highlight),transparent_72%),var(--surface-raised)] px-3 py-3 text-[15px] leading-7 text-[color:var(--text-heading)] shadow-[var(--shadow-tight)] ring-1 ring-[color:var(--primary)]/10 sm:px-4 sm:py-4"
    >
      <div className="mb-2 min-w-0">
        <h3 className="text-sm font-semibold text-[color:var(--text-heading)]">Answer</h3>
        <p className={cn("hidden text-xs leading-5 sm:block", textMuted)}>
          High-yield clinical response; structured details follow below.
        </p>
      </div>
      <p
        data-testid="plain-answer-prose"
        className="text-[15px] font-medium leading-7 text-[color:var(--text-heading)]"
      >
        <SafeBoldText text={cleaned} />
      </p>
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

function answerToneClasses(tone: AnswerDisplayTone) {
  if (tone === "risk" || tone === "gap") return toneDanger;
  if (tone === "monitoring" || tone === "medication") return toneWarning;
  if (tone === "action" || tone === "direct") return toneSuccess;
  if (tone === "comparison" || tone === "source") return toneInfo;
  return toneNeutral;
}

function AnswerSymbolTile({ line }: { line: AnswerDisplayLine }) {
  return (
    <span
      className={cn(
        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[11px] font-black leading-none shadow-[var(--shadow-inset)]",
        answerToneClasses(line.presentation.tone),
      )}
      aria-hidden="true"
    >
      {line.presentation.symbol}
    </span>
  );
}

function AnswerLineLabel({ line }: { line: AnswerDisplayLine }) {
  const label = line.displayLabel;
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center rounded-md border px-2 text-[11px] font-bold uppercase tracking-[0.04em]",
        answerToneClasses(line.presentation.tone),
      )}
    >
      {label}
    </span>
  );
}

function FormattedAnswerContent({ content }: { content: ParsedAnswerDisplay }) {
  if (content.type === "paragraph") {
    const line = content.lines[0];
    return (
      <div
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border p-3 text-[15px] leading-7 shadow-[var(--shadow-inset)]",
          line ? answerToneClasses(line.presentation.tone) : toneNeutral,
        )}
      >
        {line ? <AnswerSymbolTile line={line} /> : null}
        <p className="min-w-0 font-medium text-[color:var(--text-heading)]">
          {line ? <AnswerLineLabel line={line} /> : null}
          {line?.displayLabel ? " " : null}
          <SafeBoldText text={line?.text ?? "No usable answer text for this result."} />
        </p>
      </div>
    );
  }

  const listClasses =
    content.mode === "clinical_pathway" || content.mode === "evidence_gap" || content.mode === "document_lookup"
      ? "space-y-2.5"
      : content.mode === "comparison" || content.mode === "comparison_matrix"
        ? "grid gap-2.5 md:grid-cols-2"
        : content.mode === "threshold_table"
          ? "grid gap-2.5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
          : "space-y-2.5";

  return (
    <ul className={listClasses}>
      {content.lines.map((line) => (
        <li
          key={line.id}
          className={cn(
            "grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border p-3 text-[15px] leading-7 shadow-[var(--shadow-inset)]",
            answerToneClasses(line.presentation.tone),
          )}
        >
          <AnswerSymbolTile line={line} />
          <span className="min-w-0 font-medium text-[color:var(--text)]">
            <AnswerLineLabel line={line} />
            {line.displayLabel ? " " : null}
            <SafeBoldText text={line.text} />
          </span>
        </li>
      ))}
    </ul>
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
        description="Items are extracted only from retrieved source text. Verify the linked source before clinical use."
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
                aria-label={`Open source for ${formatSafetyFindingLabel(finding)}`}
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
                  aria-label={`Open closest source ${source.title}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="max-w-[12rem] truncate">{source.title}</span>
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
            <span className={subtleStatusPill}>
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
              Open page
              <ExternalLink className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onScopeDocument(bestSource.document_id)}
              className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
              aria-label={`Search only ${bestSource.title}`}
            >
              <Filter className="h-4 w-4" />
              Use as scope
            </button>
          </div>
        </article>
      ) : (
        <EmptyState
          icon={Target}
          title="No top source"
          body="No source was strong enough to recommend as the leading citation."
        />
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
        {supportLabel}. Open the source before using copied text or clinical drafts.
      </p>
    </aside>
  );
}

function evidenceDrawerSummary({
  answer,
  bestSource,
  sourceSummary,
  gaps,
}: {
  answer: RagAnswer;
  bestSource: BestSourceRecommendation | null;
  sourceSummary?: EvidenceSummary;
  gaps: ConflictOrGap[];
}) {
  const topSource = bestSource ? "1 top source" : "No top source";
  const status = bestSource
    ? sourceStatusLabel(normalizeSourceMetadata(bestSource.source_metadata)).toLowerCase()
    : (sourceSummary?.source_strength ?? "unknown").toLowerCase();
  const citationCount = answer.citations.length;
  const gapCount = gaps.length;

  return [
    topSource,
    status,
    `${citationCount} citation${citationCount === 1 ? "" : "s"}`,
    gapCount ? `${gapCount} gap${gapCount === 1 ? "" : "s"}` : "no gaps",
  ].join(" · ");
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
  const items = [
    { label: "Mode", value: modeLabel, icon: SlidersHorizontal },
    {
      label: "Support",
      value: support,
      icon: hasStrongRelevanceIcon(relevance ?? answer.relevance, answer.grounded) ? CheckCircle2 : AlertCircle,
    },
    { label: "Sources", value: String(sourceCount), icon: FileText },
    { label: "Confidence", value: answer.confidence, icon: Target },
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

function AnswerViewModeControl({
  value,
  onChange,
}: {
  value: AnswerViewMode;
  onChange: (mode: AnswerViewMode) => void;
}) {
  const modes: Array<{ value: AnswerViewMode; label: string; icon: typeof Search }> = [
    { value: "standard", label: "Standard", icon: ListChecks },
    { value: "high_yield", label: "High-yield", icon: Target },
    { value: "evidence_map", label: "Evidence map", icon: BookOpen },
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
            className={cn(
              "inline-flex min-h-9 min-w-0 flex-1 basis-[7rem] items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition sm:flex-none sm:basis-auto",
              active
                ? "bg-[color:var(--primary)] text-white shadow-sm"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EvidenceMapTable({ rows }: { rows: AnswerEvidenceMapRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No evidence map rows"
        body="This answer did not return structured answer sections or linked citations."
      />
    );
  }

  return (
    <div
      data-testid="answer-evidence-map"
      className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className={cn("caption-top px-3 py-2 text-left text-xs font-semibold", textMuted)}>
          Source support by answer section
        </caption>
        <thead>
          <tr className="bg-[color:var(--surface-subtle)]">
            {["Answer section", "Support", "Citations", "Source status", "Best linked passage"].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="border-b border-[color:var(--border)] px-3 py-2 align-top text-xs font-semibold text-[color:var(--text)]"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-[color:var(--border)]/70">
              <td className="max-w-56 px-3 py-2 align-top font-semibold text-[color:var(--text-heading)]">
                {row.section}
              </td>
              <td className="px-3 py-2 align-top">
                <span className={metadataPill}>{row.supportLevel}</span>
              </td>
              <td className="px-3 py-2 align-top text-[color:var(--text)]">{row.citationCount}</td>
              <td className={cn("max-w-56 px-3 py-2 align-top text-xs leading-5", textMuted)}>
                {row.sourceStatus}
              </td>
              <td className="min-w-72 px-3 py-2 align-top">
                <p className="text-[13px] font-semibold text-[color:var(--text)]">{row.bestSourceLabel}</p>
                <p className={cn("mt-1 line-clamp-3 text-xs leading-5", textMuted)}>
                  <SafeBoldText text={row.bestLinkedPassage} />
                </p>
                {row.href ? (
                  <Link
                    href={row.href}
                    className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[color:var(--border)] px-2 text-xs font-semibold text-[color:var(--primary)] hover:bg-[color:var(--primary-soft)]"
                  >
                    Open passage
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnswerSafetyNotice({ demoMode, weakEvidence = false }: { demoMode: boolean; weakEvidence?: boolean }) {
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
      {demoMode ? (
        <p className="mt-1 font-semibold text-amber-800 dark:text-amber-100">
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
  onFollowUp: (quote: QuoteCard) => void;
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
        <EmptyState
          icon={Quote}
          title="No exact quotes returned"
          body="This answer did not include separate quote cards. Use the answer citations and source passages to verify the source text."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {quotes.map((quote, index) => (
            <article key={`${quote.chunk_id}:${quote.quote}`} className={cn(sourceCard, "p-3 sm:p-4")}>
              <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                <span className={cn(iconTilePremium, "h-7 w-7 text-xs font-bold sm:h-8 sm:w-8")}>{index + 1}</span>
                <StrengthBadge strength={quote.source_strength} />
              </div>
              <blockquote className="text-[15px] font-medium leading-6 text-[color:var(--text)]">
                &ldquo;{quote.quote}&rdquo;
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
                  {quote.title}, page {quote.page_number ?? "n/a"}
                </span>
                <div className="w-full sm:w-auto">
                  <SourceActionRow
                    viewerHref={documentCitationHref(quote)}
                    sourceTitle={`quote ${index + 1} from ${quote.title}`}
                    documentId={quote.document_id}
                    onScopeDocument={onScopeDocument}
                    onFollowUp={() => onFollowUp(quote)}
                    divider={false}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
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
  const sections = viewMode === "high_yield" ? buildHighYieldClinicalOutputSections(answer) : buildClinicalOutputSections(answer);
  const rows = evidenceMapRows ?? buildAnswerEvidenceMap(answer);
  if (sections.length === 0 && (viewMode !== "evidence_map" || rows.length === 0)) return null;
  const leadSection = sections.find((section) => section.id === "bottom-line") ?? sections[0];
  const primaryAnswer = plainAnswerText(answer.answer);
  const detailSections = sections
    .filter((section) => section.id !== "verify-source")
    .filter((section) => (showLead ? section.id !== leadSection?.id : section.id !== "bottom-line"))
    .map((section) => ({
      ...section,
      items: showLead ? section.items : section.items.filter((item) => !isRedundantStructuredItem(item, primaryAnswer)),
    }))
    .filter((section) => section.items.length > 0 || Boolean(section.tables?.length));
  const orderedDetailSections = sortClinicalDetailSections(detailSections);
  const summaryItems = clinicalDetailSummaryItems(orderedDetailSections);
  const verifySection = sections.find((section) => section.id === "verify-source");
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
          ? "Dense source-backed structure for review before clinical use."
          : "Adaptive source-backed support below the concise answer.";

  const content = (
    <section data-testid="clinical-action-view" className={cn(panelSubtle, "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          icon={ListChecks}
          title={title}
          description={description}
          action={
            onViewModeChange ? <AnswerViewModeControl value={viewMode} onChange={onViewModeChange} /> : undefined
          }
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
                  <span className={cn(metadataPill, "min-h-7 shrink-0 px-2 text-[10px]")}>
                    {itemCount}
                  </span>
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
                          compact
                          expandOnMobile
                          clinicalOnly
                          dialogTitle={table.caption}
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
                        className="grid min-h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-[color:var(--border)]/70 bg-[color:var(--surface-raised)] px-3 py-2 shadow-[var(--shadow-inset)]"
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
      {verifySection ? (
        <div className={cn("mt-3 border-t border-[color:var(--border)] pt-3", textMuted)}>
          <div className="flex items-start gap-2.5">
            <Target className="mt-1 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em]">Verify source</p>
              <p className="mt-1 text-sm leading-6">
                <SafeBoldText text={verifySection.items[0] ?? "Open the cited source passage before clinical use."} />
              </p>
            </div>
          </div>
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

function SmartFollowUpChips({
  answer,
  bestSource,
  weakEvidence,
  onViewModeChange,
  onQueryModeChange,
  onLimitToLocalCurrent,
  onScopeDocument,
  onShowQuotes,
  onTryBroaderSearch,
}: {
  answer: RagAnswer;
  bestSource: BestSourceRecommendation | null;
  weakEvidence: boolean;
  onViewModeChange: (mode: AnswerViewMode) => void;
  onQueryModeChange: (mode: ClinicalQueryMode) => void;
  onLimitToLocalCurrent: () => void;
  onScopeDocument: (documentId: string) => void;
  onShowQuotes: () => void;
  onTryBroaderSearch: () => void;
}) {
  const hasThresholdEvidence =
    answer.responseMode === "threshold_table" ||
    answer.queryClass === "table_threshold" ||
    answer.queryClass === "medication_dose_risk";
  const hasComparisonEvidence =
    answer.responseMode === "comparison_matrix" ||
    answer.queryClass === "comparison" ||
    (answer.documentBreakdown?.length ?? 0) >= 2 ||
    (answer.sources?.length ?? 0) >= 2;
  const chips: Array<{ label: string; icon: typeof Search; onClick: () => void; hidden?: boolean }> = [
    {
      label: "Show thresholds only",
      icon: Target,
      hidden: !hasThresholdEvidence,
      onClick: () => {
        onQueryModeChange("dose_threshold_lookup");
        onViewModeChange("high_yield");
      },
    },
    {
      label: "Compare sources",
      icon: BookOpen,
      hidden: !hasComparisonEvidence,
      onClick: () => {
        onQueryModeChange("compare_guidance");
        onViewModeChange("evidence_map");
      },
    },
    {
      label: "Limit to local/current sources",
      icon: Filter,
      onClick: onLimitToLocalCurrent,
    },
    {
      label: "Search this document only",
      icon: FileText,
      hidden: !bestSource,
      onClick: () => {
        if (bestSource) onScopeDocument(bestSource.document_id);
      },
    },
    {
      label: "Show exact quotes",
      icon: Quote,
      hidden: !answer.quoteCards?.length,
      onClick: onShowQuotes,
    },
    {
      label: "Try broader search",
      icon: SlidersHorizontal,
      hidden: !weakEvidence,
      onClick: onTryBroaderSearch,
    },
  ];
  const visibleChips = chips.filter((chip) => !chip.hidden);
  if (visibleChips.length === 0) return null;

  return (
    <div
      data-testid="smart-follow-up-chips"
      className="flex flex-wrap gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2"
      aria-label="Smart follow-up refinements"
    >
      {visibleChips.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onClick}
            className={cn(floatingControl, "min-h-9 px-2.5 text-xs")}
          >
            <Icon className="h-3.5 w-3.5" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
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
          <article key={source.id} className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold text-[color:var(--text)]">{source.title}</p>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                  page {source.page_number ?? "n/a"} · chunk {source.chunk_index}
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
              <p className={cn("mt-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-1.5 text-xs leading-5", textMuted)}>
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
          summary="Collapsed because only nearby source support was found."
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
        description="Clinical tables, diagrams, and images extracted from indexed source documents."
        hideDescriptionOnMobile
        compactMobile
      />
      {evidence.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="No indexed images cited"
          body="This answer did not cite extracted diagrams or image captions."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {evidence.map((item) => {
            const tableMarkdown = item.accessibleTableMarkdown?.trim()
              ? item.accessibleTableMarkdown
              : looksLikeTableText(item.tableTextSnippet)
                ? item.tableTextSnippet
                : null;
            const hasStructuredTable = Boolean(tableMarkdown || item.tableRows?.length || item.tableColumns?.length);
            const tableCaption = [item.tableTitle, item.caption].filter(Boolean)[0] ?? "Clinical table";
            const displayLabels = smartEvidenceTags(
              item.labels,
              [[item.tableLabel, item.tableTitle].filter(Boolean).join(": "), item.caption, item.tableTextSnippet]
                .filter(Boolean)
                .join(" "),
            );
            return (
              <figure key={item.id} className={cn(sourceCard, "overflow-hidden p-2.5 sm:p-3")}>
                <div className="rounded-lg bg-[color:var(--surface-inset)] p-2.5 sm:p-3">
                  <SourceImage endpoint={item.signed_url_endpoint} caption={item.caption} />
                </div>
                <figcaption className="mt-2 space-y-1.5 text-[15px] leading-6 text-[color:var(--text)] sm:mt-3">
                  {item.tableTitle ? <p className="font-semibold">{item.tableTitle}</p> : null}
                  {!hasStructuredTable ? <p>{item.caption}</p> : null}
                  <AccessibleTable
                    caption={tableCaption}
                    markdown={tableMarkdown}
                    rows={item.tableRows}
                    columns={item.tableColumns}
                    compact
                    expandOnMobile
                    clinicalOnly
                    dialogTitle={tableCaption}
                  />
                  {!hasStructuredTable && item.tableTextSnippet ? (
                    <p className={cn("line-clamp-3 text-sm leading-6", textMuted)}>{item.tableTextSnippet}</p>
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
                  {!hasStructuredTable ? (
                    <>
                      <span className={cn("text-[15px] font-semibold leading-6 sm:hidden", textMuted)}>
                        {formatCompactCitationLabel(item)}
                      </span>
                      <span className={cn("hidden text-xs font-semibold leading-5 sm:inline", textMuted)}>
                        {item.title}, page {item.page_number ?? "n/a"}
                      </span>
                    </>
                  ) : null}
                  {!hasStructuredTable && item.image_type && (
                    <span className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
                      {item.image_type.replaceAll("_", " ")}
                    </span>
                  )}
                  {!hasStructuredTable ? <QueryCoverageChips relevance={item.relevance} limit={2} /> : null}
                  <Link href={item.viewer_href} className={cn(floatingControl, "min-h-[44px] px-4 text-xs")}>
                    <ExternalLink className="h-4 w-4" />
                    Open page
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
                  <span className="line-clamp-2">{document.title}</span>
                </Link>
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
          "min-h-8 cursor-pointer list-none gap-1.5 px-2.5 text-[11px] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
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

const documentFacetIcons: Record<SmartDocumentTagGroup, typeof Tag> = {
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
          <button type="button" onClick={onClear} className={cn(floatingControl, "min-h-8 px-2 text-[11px]")}>
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

function MatchExplanationChips({ source }: { source: SearchResult }) {
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

function DocumentSearchResultsPanel({
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

  if (loading) return <LoadingPanel label="Finding matching documents" />;

  if (apiUnavailable || !realDataReady || authUnavailable) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Document search unavailable"
        body={
          apiUnavailable
            ? "The local API is unavailable. Check the app server before searching documents."
            : authUnavailable
              ? "Sign in or enable local no-auth mode before listing private indexed documents."
              : setupWarning || "Complete the search setup before using Documents mode."
        }
      />
    );
  }

  if (matches.length === 0) {
    if (documentCount === 0) {
      return (
        <EmptyState
          icon={FileText}
          title="No indexed documents"
          body="Upload and index source documents before using Documents mode."
        />
      );
    }

    if (!trimmedQuery) {
      return (
        <EmptyState
          icon={FileText}
          title="Search documents"
          body="Enter a clinical topic, medication, workflow, or policy name to list matching source documents."
        />
      );
    }

    return (
      <EmptyState
        icon={FileText}
        title="No matching documents"
        body={`No indexed documents matched "${trimmedQuery}". Try a medication, acronym, policy name, or workflow term.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(metadataPill, "inline-flex min-h-8 w-fit max-w-full flex-wrap gap-x-1.5 leading-5")}>
          {matches.length} document match{matches.length === 1 ? "" : "es"} for &quot;{query.trim()}&quot;
        </div>
        {relevance ? <RelevanceBadge relevance={relevance} /> : null}
      </div>
      <SearchFacetDisclosure facets={facets} />
      <DocumentTagFacetRail
        groups={tagFacetGroups}
        activeKeys={activeFacetKeys}
        onToggle={toggleTagFacet}
        onClear={() => setActiveFacetState({ query, keys: [] })}
      />
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
        {visibleMatches.map((document) => (
          <article key={document.document_id} className={cn(sourceCard, "p-3 sm:p-4")}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <Link
                  href={`/documents/${document.document_id}?page=${document.bestPages[0] ?? 1}&chunk=${document.bestChunkIds[0] ?? ""}`}
                  className="inline-flex min-h-[44px] items-center text-base font-semibold text-[color:var(--text-heading)] transition hover:text-[color:var(--primary)]"
                >
                  <span className="line-clamp-2">{document.title}</span>
                </Link>
                <p className={cn("text-xs leading-5", textMuted)}>
                  {document.file_name} · pages {document.bestPages.join(", ") || "n/a"} · {document.tableCount} tables ·{" "}
                  {document.imageCount} images
                </p>
                <p className={cn("mt-1 text-xs leading-5", textMuted)}>{document.matchReason}</p>
                <div className="mt-2">
                  <QueryCoverageChips relevance={document.relevance} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RelevanceBadge relevance={document.relevance} />
                <Link
                  href={`/documents/${document.document_id}?page=${document.bestPages[0] ?? 1}&chunk=${document.bestChunkIds[0] ?? ""}`}
                  className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
                  aria-label={`Open ${document.title}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => onScopeDocument(document.document_id)}
                  className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
                  aria-label={`Scope search to ${document.title}`}
                >
                  <Filter className="h-4 w-4" />
                  Scope
                </button>
                <button
                  type="button"
                  onClick={() => onAnswerFromDocument(document.document_id)}
                  className={cn(primaryControl, "min-h-[44px] rounded-lg px-3 text-xs")}
                  aria-label={`Answer from ${document.title}`}
                >
                  <Sparkles className="h-4 w-4" />
                  Answer
                </button>
              </div>
            </div>
            {document.summarySnippet && (
              <p className={cn("mt-2 line-clamp-3 text-[15px] leading-6", textMuted)}>
                <SafeBoldText text={document.summarySnippet} />
              </p>
            )}
            <DocumentTagCloud
              labels={document.labels}
              query={query}
              limit={4}
              className="mt-3"
              onTagClick={onTagSearch}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

const displayJsonArtifactPattern =
  /"?(answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|conflictsOrGaps|quoteCards?|source_chunk_ids|chunk_id)"?\s*:\s*/i;

function normalizeDisplayText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

type DisplayTextSanitizeOptions = {
  minLength?: number;
  minTokens?: number;
};

function looksLikeDisplayArtifact(value: string) {
  const normalized = normalizeDisplayText(value);
  if (!normalized) return true;
  const quoteCount = (normalized.match(/"/g) ?? []).length;
  const colonCount = (normalized.match(/:/g) ?? []).length;
  if (normalized.startsWith("{") && normalized.endsWith("}") && displayJsonArtifactPattern.test(normalized))
    return true;
  if (/[{}\[\]]/.test(normalized) && quoteCount >= 4 && colonCount >= 2 && displayJsonArtifactPattern.test(normalized))
    return true;
  return false;
}

function sanitizeDisplayText(value: string, options: DisplayTextSanitizeOptions = {}) {
  const normalized = normalizeDisplayText(sourceTextForClinicalProse(value));
  if (!normalized) return "";
  const artifactStart = normalized.search(
    /\{\s*"(?:answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|source_chunk_ids|chunk_id|conflictsOrGaps|quoteCards?)\s*:/i,
  );
  const trimmed =
    artifactStart === -1 ? normalized : artifactStart === 0 ? "" : normalized.slice(0, artifactStart).trim();
  if (!trimmed) return "";
  const { minLength = 2, minTokens = 1 } = options;
  if (trimmed.length < minLength) return "";
  const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (tokenCount < minTokens) return "";
  if (!/[A-Za-z]{2,}/.test(trimmed)) return "";
  return looksLikeDisplayArtifact(trimmed) ? "" : trimmed;
}

function sanitizeAnswerDisplayText(value: string, options: DisplayTextSanitizeOptions = {}) {
  const normalized = sourceTextForClinicalProsePreservingBreaks(value).trim();
  if (!normalized) return "";
  const artifactStart = normalizeDisplayText(normalized).search(
    /\{\s*"(?:answer|heading|body|grounded|confidence|citations?|answerSections?|citation_chunk_ids|source_chunk_ids|chunk_id|conflictsOrGaps|quoteCards?)\s*:/i,
  );
  const trimmed =
    artifactStart === -1 ? normalized : artifactStart === 0 ? "" : normalized.slice(0, artifactStart).trim();
  if (!trimmed) return "";
  const { minLength = 2, minTokens = 1 } = options;
  if (trimmed.length < minLength) return "";
  const tokenCount = normalizeDisplayText(trimmed).split(/\s+/).filter(Boolean).length;
  if (tokenCount < minTokens) return "";
  if (!/[A-Za-z]{2,}/.test(trimmed)) return "";
  return looksLikeDisplayArtifact(trimmed) ? "" : trimmed;
}

function sectionBodyContent(body: string, responseMode?: RagAnswer["responseMode"]) {
  const normalized = sanitizeAnswerDisplayText(body, { minLength: 8, minTokens: 2 });
  if (!normalized) {
    return {
      ...parseAnswerDisplayContent("No usable section text available.", responseMode),
      safe: false,
    };
  }
  return { ...parseAnswerDisplayContent(normalized, responseMode), safe: true };
}

function SourceList({
  sources,
  query,
  onScopeDocument,
}: {
  sources: SearchResult[];
  query: string;
  onScopeDocument: (documentId: string) => void;
}) {
  if (sources.length === 0) {
    return (
      <EmptyState icon={FileText} title="No source passages yet" body="Ask a question to populate the source list." />
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <article key={source.id} className={cn(sourceCard, "overflow-hidden p-0")}>
          {(() => {
            const snippet = sanitizeDisplayText(source.content);
            const fallback = "No usable snippet text for this passage.";
            const sourceTitle = source.title.replace(/^Synthetic /, "").replace(/\.pdf$/i, "");
            const fileBase = source.file_name.replace(/\.pdf$/i, "").toLowerCase();
            const titleBase = sourceTitle.toLowerCase();
            const showFileName = fileBase !== titleBase && !fileBase.startsWith(titleBase);
            const sourceMeta = [
              showFileName ? source.file_name : null,
              `page ${source.page_number ?? "n/a"}`,
              `chunk ${source.chunk_index}`,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <>
                <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-4">
                  <div className="min-w-0">
                    <Link
                      href={sourceResultHref(source)}
                      onClick={() => logSourceOpen(query, source)}
                      className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
                    >
                      {sourceTitle}
                    </Link>
                    <p className={cn("mt-1 text-xs leading-5", textMuted)}>{sourceMeta}</p>
                    <SourceProvenance metadata={source.source_metadata} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <QueryCoverageChips relevance={source.relevance} />
                      <span className={metadataPill}>Page {source.page_number ?? "n/a"}</span>
                      <span className={metadataPill}>Chunk {source.chunk_index}</span>
                    </div>
                    <MatchExplanationChips source={source} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RelevanceBadge relevance={source.relevance} />
                    <SourceStatusBadge metadata={source.source_metadata} />
                    <StrengthBadge strength={source.source_strength} />
                    <Link
                      href={sourceResultHref(source)}
                      onClick={() => logSourceOpen(query, source)}
                      className={cn(floatingControl, "min-h-[44px] px-3 text-xs")}
                      aria-label={`Open source page for ${source.title}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open page
                    </Link>
                    <button
                      type="button"
                      onClick={() => onScopeDocument(source.document_id)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)]"
                      aria-label={`Scope search to ${source.title}`}
                    >
                      <Filter className="h-4 w-4" />
                      Use as scope
                    </button>
                  </div>
                </div>
                <blockquote className="border-t border-[color:var(--border)] bg-[color:var(--primary-soft)]/22 px-3 py-3 text-[15px] leading-7 text-[color:var(--text)] sm:px-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--primary)] ring-1 ring-[color:var(--primary)]/20">
                      <Quote className="h-4 w-4" />
                    </span>
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--primary)]">Excerpt</p>
                  </div>
                  <p className="border-l-4 border-[color:var(--primary)] pl-3">
                    {snippet ? <SafeBoldText text={snippet} /> : <span className="italic">{fallback}</span>}
                  </p>
                </blockquote>
                {source.table_facts?.length ? (
                  <div className="border-t border-[color:var(--border)] px-3 py-3 sm:px-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                      Structured table matches
                    </p>
                    <div className="mt-2 grid gap-2">
                      {source.table_facts.slice(0, 3).map((fact) => (
                        <div
                          key={fact.id}
                          className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs leading-5 text-[color:var(--text)]"
                        >
                          <span className="font-semibold">{fact.table_title ?? fact.row_label ?? "Table row"}</span>
                          {fact.threshold_value ? ` · ${fact.threshold_value}` : ""}
                          {fact.action ? ` · ${fact.action}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            );
          })()}
        </article>
      ))}
    </div>
  );
}

function AnswerSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading answer">
      <div className="space-y-3 rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)]/45 p-4">
        <div className="h-4 w-10/12 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[color:var(--surface-subtle)]" />
        <div className="h-4 w-8/12 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
        <div className={cn(sourceCard, "mt-4 flex min-h-[60px] items-center justify-between gap-3 p-3")}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--surface-subtle)]" />
            <div className="h-4 w-48 max-w-full animate-pulse rounded bg-[color:var(--surface-subtle)]" />
          </div>
          <div className="h-[44px] w-20 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-[44px] w-48 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
        <div className="h-[44px] w-40 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-lg bg-[color:var(--surface-subtle)]" />
        <div className="hidden h-28 animate-pulse rounded-lg bg-[color:var(--surface-subtle)] sm:block" />
      </div>
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
                    {[issue.examples.length ? `examples: ${issue.examples.join(", ")}` : "", issue.documentTitles.length ? `docs: ${issue.documentTitles.join(", ")}` : ""]
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
          <article key={item.document.id} className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">{item.document.title}</p>
              <span className={cn(metadataPill, "text-[11px]")}>index {Number.isFinite(item.score) ? item.score.toFixed(2) : "n/a"}</span>
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
  selectedDocumentIds,
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
  selectedDocumentIds: string[];
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
  const filtered = documents.filter((document) => {
    const labelText = tagSearchText(document);
    const summaryText = document.summary?.summary ?? "";
    const haystack = `${document.title} ${document.file_name} ${labelText} ${summaryText}`.toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className={fieldIcon} />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Find a document"
          className={fieldControlWithIcon}
        />
      </label>
      {pagination && pagination.total > documents.length ? (
        <p className={cn("text-xs", textMuted)}>
          Showing {documents.length} of {pagination.total} documents. Load more to manage older files.
        </p>
      ) : null}
      <DocumentTagQualityPanel documents={documents} />
      <DocumentIndexRepairPanel documents={documents} />
      {selectedDocumentIds.length ? (
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
            title={documents.length === 0 ? "No indexed documents" : "No matching documents"}
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
                    <span className="truncate">{document.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
                  </Link>
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
                  <DocumentManagementActions
                    document={document}
                    disabled={!canManageDocuments}
                    onRenamed={onDocumentRenamed}
                    onDeleted={onDocumentDeleted}
                  />
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

function UploadPanel({
  onUploaded,
  demoMode,
  canUpload,
  authorizationHeader,
}: {
  onUploaded: () => void;
  demoMode: boolean;
  canUpload: boolean;
  authorizationHeader: Record<string, string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "warning" | "error">("neutral");
  const [uploading, setUploading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoMode) {
      setStatusTone("warning");
      setStatus(
        "Demo mode is serving seeded documents. Configure .env.local, run supabase/schema.sql, and start npm run worker to upload real files.",
      );
      return;
    }
    if (!canUpload) {
      setStatusTone("warning");
      setStatus("Sign in before uploading private guideline files.");
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatusTone("warning");
      setStatus("Choose a PDF, DOCX, XLSX, or TXT file first.");
      return;
    }

    setUploading(true);
    setStatusTone("neutral");
    setStatus("Uploading private document to Supabase Storage...");
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/upload", { method: "POST", headers: authorizationHeader, body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      setStatusTone(payload.duplicate ? "warning" : "success");
      setStatus(payload.message ?? "Queued for local worker ingestion.");
      form.reset();
      onUploaded();
    } catch (error) {
      setStatusTone("error");
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className={fieldLabel}>Document title optional</span>
        <input
          name="title"
          placeholder="Use the file name if left blank"
          disabled={demoMode || !canUpload}
          className={cn(
            fieldControlPlain,
            "disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--disabled)]",
          )}
        />
      </label>
      <label className="block">
        <span className={fieldLabel}>Guideline file required</span>
        <input
          ref={fileRef}
          name="file"
          type="file"
          accept=".pdf,.docx,.xlsx,.txt,application/pdf,text/plain"
          disabled={demoMode || !canUpload}
          className="block min-h-[44px] w-full cursor-pointer rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] px-3 py-2 text-sm text-[color:var(--text-muted)] file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-[color:var(--app-shell)] file:px-3 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:file:bg-slate-100 dark:file:text-slate-950"
        />
      </label>
      <button type="submit" disabled={uploading || (!demoMode && !canUpload)} className={cn(floatingControl, "w-full")}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        Queue document
      </button>
      {(status || demoMode) && (
        <p
          role={statusTone === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border p-3 text-xs font-medium leading-5",
            statusTone === "success"
              ? toneSuccess
              : statusTone === "warning"
                ? toneWarning
                : statusTone === "error"
                  ? toneDanger
                  : "border-[color:var(--border)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
          )}
        >
          {status ||
            (demoMode
              ? "Demo mode is read-only. Configure Supabase, OpenAI, and the local worker before uploading private guideline files."
              : "Sign in before uploading private guideline files.")}
        </p>
      )}
    </form>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function IndexingMonitor({
  jobs,
  batches,
  actionId,
  onRetry,
  onReindex,
  onEnrich,
}: {
  jobs: IngestionJob[];
  batches: ImportBatch[];
  actionId: string | null;
  onRetry: (jobId: string) => void;
  onReindex: (documentId: string) => void;
  onEnrich: (documentId: string) => void;
}) {
  if (jobs.length === 0 && batches.length === 0) {
    return (
      <EmptyState icon={UploadCloud} title="No ingestion jobs" body="Queued uploads and worker progress appear here." />
    );
  }

  return (
    <div className="space-y-3">
      {batches.slice(0, 3).map((batch) => (
        <div key={batch.id} className={cn(panelSubtle, "p-3")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--text)]">{batch.name}</p>
              <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                {batch.total_files} files · {formatBytes(batch.total_bytes)} · {batch.queued_files} queued ·{" "}
                {batch.skipped_files} exact copies skipped · {batch.failed_files} failed
              </p>
            </div>
            <StatusBadge status={batch.status} />
          </div>
        </div>
      ))}

      <p className={cn("text-xs leading-5", textMuted)}>
        Keep `npm run worker` open while jobs are pending or processing. Failed jobs can be retried after fixing the
        cause.
      </p>

      {jobs.slice(0, 10).map((job) => {
        const documentTitle = job.documents?.title ?? job.documents?.file_name ?? "Document";
        const busy = actionId === job.id || actionId === job.document_id;
        return (
          <div key={job.id} className={cn(panelSubtle, "p-3")}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text)]">{documentTitle}</p>
                <p className={cn("mt-1 truncate text-xs", textMuted)}>{job.stage}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-inset)]">
              <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${job.progress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={cn("text-xs", textMuted)}>
                Attempt {job.attempt_count ?? 0}/{job.max_attempts ?? 3}
              </span>
              {job.status === "failed" && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  disabled={busy}
                  className={cn(floatingControl, "min-h-9 px-3 text-xs")}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => onReindex(job.document_id)}
                disabled={busy || job.status === "processing"}
                className={cn(floatingControl, "min-h-9 px-3 text-xs")}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reindex
              </button>
              <button
                type="button"
                onClick={() => onEnrich(job.document_id)}
                disabled={busy || job.status === "processing"}
                className={cn(floatingControl, "min-h-9 px-3 text-xs")}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Enrich
              </button>
            </div>
            {job.error_message && (
              <p className={cn("mt-2 line-clamp-2 text-xs leading-5", textMuted)}>{job.error_message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const fallbackSetupChecks: SetupCheck[] = [
  {
    id: "env",
    label: ".env.local configured",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "project",
    label: "Clinical KB Database target",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "schema",
    label: "supabase/schema.sql applied",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "search",
    label: "Search RPC and vector indexes",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "openai",
    label: "OpenAI API key available",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
  {
    id: "worker",
    label: "npm run worker running",
    status: "unknown",
    detail: "Setup status has not loaded yet.",
  },
];

const publicSearchSetupCheckIds = new Set<SetupCheck["id"]>(["env", "project", "schema", "search", "openai"]);

function hasReadyPublicSearchSetup(checks: SetupCheck[]) {
  return Array.from(publicSearchSetupCheckIds).every(
    (id) => checks.find((check) => check.id === id)?.status === "ready",
  );
}

function setupBadgeClasses(status: SetupCheckStatus) {
  if (status === "ready") {
    return toneSuccess;
  }
  if (status === "needs_setup") {
    return toneWarning;
  }
  return toneNeutral;
}

function setupBadgeLabel(status: SetupCheckStatus) {
  if (status === "ready") return "Ready";
  if (status === "needs_setup") return "Needs setup";
  return "Unknown";
}

function SetupChecklist({ checks }: { checks: SetupCheck[] }) {
  const items = checks.length > 0 ? checks : fallbackSetupChecks;

  return (
    <div className={cn(panelSubtle, "p-3")}>
      <p className="text-sm font-semibold text-[color:var(--text)]">First-run setup checklist</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className={cn(sourceCard, "min-h-10 px-3 py-2")}>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-semibold text-[color:var(--text)]">{item.label}</span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-bold",
                  setupBadgeClasses(item.status),
                )}
              >
                {setupBadgeLabel(item.status)}
              </span>
            </div>
            <p className={cn("mt-1 line-clamp-2 text-xs leading-5", textMuted)}>{item.detail}</p>
          </div>
        ))}
      </div>
      <p className={cn("mt-3 text-xs leading-5", textMuted)}>
        Setup status is read-only and never exposes secret values. Worker status is inferred from recent ingestion
        activity.
      </p>
    </div>
  );
}

function UtilityDrawer({
  title,
  icon: Icon,
  summary,
  mobileSummary,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  icon: typeof FileText;
  summary?: string;
  mobileSummary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn("group", panelSubtle, className)}
    >
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition motion-safe:duration-150 hover:bg-[color:var(--surface-subtle)]">
        <span className="flex min-w-0 items-center gap-3">
          <span className={iconTilePremium}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[color:var(--text)]">{title}</span>
            {(mobileSummary || summary) && (
              <span className={cn("mt-0.5 block truncate text-xs sm:hidden", textMuted)}>
                {mobileSummary ?? summary}
              </span>
            )}
            {summary && <span className={cn("mt-0.5 hidden truncate text-xs sm:block", textMuted)}>{summary}</span>}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition motion-safe:duration-150 group-open:rotate-180" />
      </summary>
      {open && <div className={cn(clinicalDivider, "p-4")}>{children}</div>}
    </details>
  );
}

function DrawerGroupLabel({ title }: { title: string }) {
  return (
    <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{title}</p>
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
  searchMode: SearchMode;
  sourceCount: number;
  quoteCount: number;
  weakEvidence: boolean;
  governanceWarningCount: number;
}): MobileSectionFabState {
  if (!hasAnswer) {
    return {
      statusLabel: searchMode === "documents" ? "Document search" : "No answer yet",
      statusTone: "empty",
      nextStep: searchMode === "documents" ? "Review matching documents" : "Ask a question first",
      badgeLabel: searchMode === "documents" ? null : "?",
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

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeMenu, open]);

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
          "fixed z-40 grid h-14 w-14 place-items-center rounded-full border border-[color:var(--primary)]/25 bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-[0_18px_38px_rgb(14_143_133_/_22%),var(--shadow-tight)] ring-1 ring-white/30 transition motion-safe:duration-150 hover:-translate-y-0.5 hover:bg-[color:var(--primary-strong)] active:translate-y-px dark:ring-white/10",
          open && "bg-[color:var(--primary-strong)] shadow-[0_14px_30px_rgb(14_143_133_/_20%),var(--shadow-tight)]",
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
        id={panelId}
        data-testid="mobile-section-fab-menu"
        role="region"
        aria-labelledby={labelId}
        aria-hidden={!open}
        inert={!open}
        hidden={!open}
        className="fixed z-40 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-white/25 backdrop-blur-md dark:ring-white/10"
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

const guideSections = [
  {
    title: "Ask and verify",
    body: "Ask a focused guideline question, then verify the answer against linked citations and source passages before clinical use.",
  },
  {
    title: "Top source and citations",
    body: "Use Top source, citation chips, and source cards to open the relevant document page and check the retrieved evidence.",
  },
  {
    title: "Scope",
    body: "Use document scope controls when a question should search only selected guidelines rather than every indexed source.",
  },
  {
    title: "Quotes, images, sources",
    body: "The bottom nav jumps to exact quotes, extracted diagrams, and source passages. Empty sections simply mean none were cited.",
  },
  {
    title: "Upload and indexing",
    body: "Real uploads require Supabase, OpenAI setup, the database schema, and the worker. Demo mode is synthetic only.",
  },
  {
    title: "Copying text",
    body: "Copied drafts are not final clinical notes. Keep the provenance footer and verify source material before using copied text.",
  },
] as const;

function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinical-kb-guide-title"
        className={cn(sheetSurface, "max-h-[min(84svh,42rem)] w-full overflow-y-auto sm:max-w-2xl")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[color:var(--border)] bg-[linear-gradient(180deg,var(--surface-highlight),transparent_72%),var(--surface-raised)] p-4 sm:p-5">
          <span className={cn(sheetHandle, "mb-4")} aria-hidden />
          <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className={cn(iconTilePremium, "h-10 w-10")}>
              <BookOpen className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 id="clinical-kb-guide-title" className="text-base font-semibold text-[color:var(--text-heading)]">
                Clinical KB guide
              </h2>
              <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
                Practical use notes for source-backed guideline search.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={cn(navPill, "h-[44px] w-[44px] px-0")}
            aria-label="Close guide"
          >
            <X className="h-4 w-4" />
          </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {guideSections.map((section) => (
            <article key={section.title} className={cn(sourceCard, "p-3")}>
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{section.title}</h3>
              <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GuideTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        data-testid="dashboard-guide-trigger"
        onClick={onOpen}
        className={cn(navPill, "px-3")}
        aria-label="Open user guide"
      >
        <BookOpen className="h-4 w-4" />
        Guide
      </button>
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

export function ClinicalDashboard() {
  const mainRef = useRef<HTMLElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const navSyncLockRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const nextWorkStatePollRef = useRef(0);
  const urlSearchBootstrappedRef = useRef(false);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [documentsPagination, setDocumentsPagination] = useState<DocumentPagination | null>(null);
  const [loadingMoreDocuments, setLoadingMoreDocuments] = useState(false);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const jobsRef = useRef(jobs);
  const batchesRef = useRef(batches);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("answer");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [documentMatches, setDocumentMatches] = useState<DocumentMatch[]>([]);
  const [searchRelevance, setSearchRelevance] = useState<EvidenceRelevance | null>(null);
  const [searchFacets, setSearchFacets] = useState<SearchFacets | null>(null);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [searchScope, setSearchScope] = useState<SearchScopeSummary | null>(null);
  const [sourceGovernanceWarnings, setSourceGovernanceWarnings] = useState<SourceGovernanceWarning[]>([]);
  const [answerViewMode, setAnswerViewMode] = useState<AnswerViewMode>("high_yield");
  const [evalStatus, setEvalStatus] = useState<string | null>(null);
  const [evalAction, setEvalAction] = useState<"good" | "needs_fixing" | null>(null);
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
  const [activeHash, setActiveHash] = useState("#search");
  const [guideOpen, setGuideOpen] = useState(false);
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
  const canUsePrivateApis = localProjectReady && (localNoAuthMode || authStatus === "authenticated");
  const canRunSearch = explicitDemoMode || (hasReadyPublicSearchSetup(setupChecks) && canUsePrivateApis);
  const openGuide = useCallback(() => setGuideOpen(true), []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

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

        const [documentsResponse, jobsResponse, batchesResponse] = await Promise.all([
          fetch(`/api/documents?${documentParams.toString()}`, { headers: protectedHeaders }),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/jobs", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
          shouldRefreshWorkState
            ? fetch("/api/ingestion/batches", { headers: protectedHeaders })
            : Promise.resolve(null as Response | null),
        ]);

        if (
          documentsResponse.status === 401 ||
          (jobsResponse !== null && jobsResponse.status === 401) ||
          (batchesResponse !== null && batchesResponse.status === 401)
        ) {
          markSessionExpired();
          setDocuments([]);
          setDocumentsPagination(null);
          setJobs([]);
          setBatches([]);
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

        const activeWork = hasActiveIndexingWork(nextDocuments, nextJobs, nextBatches, routeIndexingActive);
        setIndexingActive(activeWork);
        setNextRefreshDelayMs(routePollDelayMs ?? (activeWork ? activeIndexingPollFallbackMs : null));
      })();

      refreshInFlightRef.current = promise;
      try {
        return await promise;
      } finally {
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
        await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
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
        await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
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
        setError(`Document deleted, but storage cleanup needs review: ${result.storageWarnings.join("; ")}`);
      }
      void refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false }).catch(
        () => undefined,
      );
    },
    [refresh],
  );

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
    if (urlSearchBootstrappedRef.current || !canRunSearch) return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const searchText = params.get("q")?.trim();
    if (mode !== "documents" || !searchText) return;
    urlSearchBootstrappedRef.current = true;
    void runDocumentSearchShortcut(searchText, scopeFilters, false);
    // URL bootstrap intentionally runs once when search setup becomes available.
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

  async function requestDocuments(queryText: string, filtersOverride?: SearchScopeFilters) {
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
          mode: "documents",
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          filters: compactScopeFilters(filtersOverride ?? scopeFilters),
          queryMode,
          documentLimit: 30,
          topK: 20,
        }),
      });
    } catch {
      throw searchNetworkFailure("Document search");
    }

    if (response.status === 401) {
      markSessionExpired();
      throw makeSearchError("Search request was not authorized by the server.", 401, false);
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Document search failed";
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

  async function requestAnswer(queryText: string) {
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
          filters: compactScopeFilters(scopeFilters),
          queryMode,
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

    const payload = await readAnswerStream(response, setAnswerProgress);
    return {
      kind: "answer" as const,
      query: queryText,
      payload,
    };
  }

  async function runWithRetries<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= searchRetryCount; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt >= searchRetryCount) break;

        const message = progressForRetry(attempt + 1);
        setAnswerProgress(message);
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

  async function ask() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    if (!canRunSearch) {
      setError("Search setup is not ready.");
      return;
    }

    setLoading(true);
    setError(null);
    setEvalStatus(null);
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    setAnswerProgress(searchMode === "documents" ? "Finding matching documents." : "Searching indexed documents.");

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
        if (entry.isKeyword) setAnswerProgress("Trying keyword-based search...");

        try {
          const payload =
            searchMode === "documents"
              ? await runWithRetries(() => requestDocuments(entry.query))
              : await runWithRetries(() => requestAnswer(entry.query));

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

      applySearchResult(successfulPayload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Search failed");
    } finally {
      setLoading(false);
      setAnswerProgress(null);
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

  function updateDocumentSearchUrl(searchText: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "documents");
    params.set("q", searchText);
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }

  async function runDocumentSearchShortcut(searchText: string, filtersOverride = scopeFilters, updateUrl = true) {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) return;
    if (!canRunSearch) {
      setError("Search setup is not ready.");
      return;
    }

    setQuery(trimmedSearchText);
    setSearchMode("documents");
    setLoading(true);
    setError(null);
    setAnswerProgress("Finding matching documents.");
    setSearchRelevance(null);
    setSearchFacets(null);
    setSearchScope(null);
    setSourceGovernanceWarnings([]);
    setAnswerViewMode("high_yield");
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
    if (updateUrl) updateDocumentSearchUrl(trimmedSearchText);

    try {
      const payload = await runWithRetries(() => requestDocuments(trimmedSearchText, filtersOverride));
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
    if (tag.group === "Medication") nextFilters.medications = [tag.searchText || tag.label];
    if (tag.group === "Document type") nextFilters.documentTypes = [tag.searchText || tag.label];
    if (tag.group === "Topic") nextFilters.topics = [tag.searchText || tag.label];
    setScopeFilters(nextFilters);
    void runDocumentSearchShortcut(searchText, nextFilters);
  }

  async function saveAnswerEval(rating: "good" | "needs_fixing") {
    if (!answer || !query.trim()) return;
    setEvalAction(rating);
    setEvalStatus(null);
    try {
      const response = await fetch("/api/eval-cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({
          query,
          rating,
          answer: answer.answer,
          queryMode,
          queryClass: answer.queryClass,
          filters: compactScopeFilters(scopeFilters),
          sourceChunkIds: answer.sources?.map((source) => source.id).filter(Boolean) ?? [],
          citedChunkIds: answer.citations?.map((citation) => citation.chunk_id).filter(Boolean) ?? [],
          sourceFiles: answer.sources?.map((source) => source.file_name).filter(Boolean) ?? [],
        }),
      });
      if (response.status === 401) {
        markSessionExpired();
        setEvalStatus("Sign in before saving eval cases.");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Eval capture failed.");
      setEvalStatus(rating === "good" ? "Saved as a good eval case." : "Saved as needs fixing.");
    } catch (error) {
      setEvalStatus(error instanceof Error ? error.message : "Eval capture failed.");
    } finally {
      setEvalAction(null);
    }
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
      if (!response.ok) throw new Error(payload.error || "Bulk reindex failed.");
      setBulkActionStatus(
        `${payload.results?.filter((result: { ok: boolean }) => result.ok).length ?? 0} selected documents updated.`,
      );
      await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
    } catch (error) {
      setBulkActionStatus(error instanceof Error ? error.message : "Bulk reindex failed.");
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
      if (!response.ok) throw new Error(payload.error || "Bulk metadata update failed.");
      setBulkActionStatus(`${payload.updatedCount ?? 0} selected documents updated.`);
      await refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
    } catch (error) {
      setBulkActionStatus(error instanceof Error ? error.message : "Bulk metadata update failed.");
    } finally {
      setBulkActionBusy(false);
    }
  }

  function followUpFromQuote(quote: QuoteCard) {
    setQuery(createQuoteFollowUp(quote));
    setSelectedDocumentIds([quote.document_id]);
    window.requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
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
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopiedAction(action);
    window.setTimeout(() => setCopiedAction((current) => (current === action ? null : current)), 1800);
  }

  const visualEvidence = useMemo(() => answer?.visualEvidence ?? answer?.smartPanel?.visualEvidence ?? [], [answer]);
  const relatedDocuments = useMemo(
    () => answer?.relatedDocuments ?? answer?.smartPanel?.relatedDocuments ?? [],
    [answer],
  );
  const currentRelevance = answer?.relevance ?? answer?.smartPanel?.relevance ?? searchRelevance;
  const weakEvidence = isWeakRelevance(currentRelevance);
  const safetyFindings = useMemo(() => extractSafetyFindings(answer), [answer]);
  const bestSource = answer?.bestSource ?? answer?.smartPanel?.bestSource ?? null;
  const sourceSummary = answer?.evidenceSummary ?? answer?.smartPanel?.evidenceSummary;
  const gaps = answer?.conflictsOrGaps ?? answer?.smartPanel?.conflictsOrGaps ?? [];
  const answerGrounded =
    answer?.grounded === true && answer.confidence !== "unsupported" && currentRelevance?.isSourceBacked !== false;
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
  const answerEvidenceMapRows = useMemo(() => buildAnswerEvidenceMap(answer), [answer]);

  function limitToLocalCurrentSources() {
    setScopeFilters((current) => ({ ...current, locality: "local", sourceStatuses: ["current"] }));
    setAnswerViewMode("evidence_map");
  }

  function tryBroaderAnswerSearch() {
    setQueryMode("auto");
    setScopeFilters({});
    setSelectedDocumentIds([]);
    setAnswerViewMode("high_yield");
  }

  const showSystemNotice = demoMode || setupWarning;
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
        quoteCount: answer ? (answer.quoteCards ?? []).length : 0,
        weakEvidence,
        governanceWarningCount: groupedGovernanceWarningCount,
      }),
    [answer, groupedGovernanceWarningCount, searchMode, sources.length, weakEvidence],
  );
  const bottomNavItems = [
    {
      label: searchMode === "answer" ? "Answer" : "Docs",
      description:
        searchMode === "answer"
          ? answer
            ? weakEvidence
              ? "Read synthesis carefully"
              : "Clinical synthesis"
            : "Ask a question first"
          : documentMatches.length
            ? "Document results"
            : "Search documents",
      icon: searchMode === "answer" ? Search : FileText,
      href: "#search",
      count: searchMode === "documents" ? documentMatches.length : null,
      empty: searchMode === "documents" && documentMatches.length === 0,
    },
    {
      label: "Quotes",
      description: answer
        ? (answer.quoteCards ?? []).length
          ? "Exact source excerpts"
          : "No quotes yet"
        : "No quotes yet",
      icon: Quote,
      href: "#quotes",
      count: answer ? (answer.quoteCards ?? []).length : null,
      empty: !answer || (answer.quoteCards ?? []).length === 0,
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
      description: answer ? (sources.length ? "Passages and documents" : "No sources yet") : "No sources yet",
      icon: FileText,
      href: "#sources",
      count: answer ? sources.length : null,
      empty: !answer || sources.length === 0,
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

  return (
    <div
      className={cn(
        appBackdrop,
        "mobile-app-shell flex flex-col overflow-hidden text-[color:var(--text)] lg:block lg:h-auto lg:min-h-screen lg:overflow-x-clip lg:overflow-y-visible",
      )}
    >
      <MasterSearchHeader
        documents={documents}
        query={query}
        searchMode={searchMode}
        loading={loading}
        selectedDocumentIds={selectedDocumentIds}
        queryMode={queryMode}
        scopeFilters={scopeFilters}
        batches={batches}
        hasAnswer={Boolean(answer)}
        demoMode={demoMode}
        realDataReady={canRunSearch}
        theme={theme}
        onQueryChange={setQuery}
        onSearchModeChange={setSearchMode}
        onAsk={ask}
        onClearQuery={() => setQuery("")}
        onClearScope={() => setSelectedDocumentIds([])}
        onQueryModeChange={setQueryMode}
        onScopeFiltersChange={setScopeFilters}
        onToggleScope={toggleDocumentScope}
        onOpenGuide={openGuide}
        onToggleTheme={toggleTheme}
      />

      <main
        ref={mainRef}
        onScroll={scheduleActiveSectionSync}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-6 max-[768px]:!pb-28 sm:space-y-5 sm:px-4 sm:py-5 sm:pb-8 lg:px-8">
          {showDegradedNotice && renderDegradedNotice()}
          {showAuthPanel && <AuthPanel />}
          {showSystemNotice && (!answer ? renderSystemNotice() : renderSystemNotice("hidden sm:block"))}

          <section className={cn(panel, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border)] bg-[linear-gradient(180deg,var(--surface-highlight),transparent_75%),var(--surface-raised)] p-3 sm:p-5">
              <SectionHeading
                icon={searchMode === "answer" ? Search : FileText}
                title={searchMode === "answer" ? "Answer" : "Document matches"}
                description={
                  searchMode === "answer"
                    ? "Sourced synthesis with quotes, PDFs, and indexed diagrams."
                    : "Natural-language document search across indexed guideline titles, labels, summaries, and passages."
                }
                testId="answer-section-heading"
                hideDescriptionOnMobile
                compactMobile
              />
            </div>

            <div className="p-3 sm:p-5">
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-3 text-sm font-medium text-[color:var(--danger)]"
                >
                  <AlertCircle className="mr-2 inline h-4 w-4" />
                  {error}
                </div>
              )}

              {loading && answerProgress && (
                <div
                  role="status"
                  className="mb-4 flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] px-3 text-sm font-medium text-[color:var(--text-heading)]"
                >
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[color:var(--primary)]" />
                  <span className="min-w-0 truncate">{answerProgress}</span>
                </div>
              )}

              {searchMode === "documents" ? (
                <div className="space-y-3">
                  <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
                  <DocumentSearchResultsPanel
                    matches={documentMatches}
                    query={query}
                    loading={loading}
                    documentCount={documents.length}
                    realDataReady={canRunSearch}
                    authUnavailable={!clientDemoMode && !canUsePrivateApis}
                    apiUnavailable={apiUnavailable}
                    setupWarning={setupWarning}
                    relevance={searchRelevance}
                    facets={searchFacets}
                    onScopeDocument={scopeOnlyDocument}
                    onAnswerFromDocument={answerFromDocument}
                    onTagSearch={handleTagSearch}
                  />
                </div>
              ) : loading && !answer ? (
                <AnswerSkeleton />
              ) : answer ? (
                <div className="min-w-0 space-y-4 sm:space-y-5">
                  <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
                    <NaturalLanguageAnswer text={safeAnswerText || answer.answer} />
                    <AnswerInsightBar
                      answer={answer}
                      bestSource={bestSource}
                      relevance={currentRelevance}
                      queryMode={queryMode}
                      sourceGovernanceWarnings={sourceGovernanceWarnings}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2">
                      <span className={cn("text-xs font-semibold", textMuted)}>
                        Save this answer as an eval case for later regression testing.
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!canUsePrivateApis || Boolean(evalAction)}
                          onClick={() => saveAnswerEval("good")}
                          className={cn(floatingControl, "px-3 text-xs")}
                        >
                          {evalAction === "good" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Good eval
                        </button>
                        <button
                          type="button"
                          disabled={!canUsePrivateApis || Boolean(evalAction)}
                          onClick={() => saveAnswerEval("needs_fixing")}
                          className={cn(floatingControl, "px-3 text-xs")}
                        >
                          {evalAction === "needs_fixing" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          Needs fixing
                        </button>
                      </div>
                      {evalStatus ? (
                        <p className="basis-full text-xs font-semibold text-[color:var(--text-muted)]">{evalStatus}</p>
                      ) : null}
                    </div>

                    <ClinicalOutputPanel
                      answer={answer}
                      showLead={false}
                      viewMode={answerViewMode}
                      onViewModeChange={setAnswerViewMode}
                      evidenceMapRows={answerEvidenceMapRows}
                    />
                    <SmartFollowUpChips
                      answer={answer}
                      bestSource={bestSource}
                      weakEvidence={weakEvidence}
                      onViewModeChange={setAnswerViewMode}
                      onQueryModeChange={setQueryMode}
                      onLimitToLocalCurrent={limitToLocalCurrentSources}
                      onScopeDocument={scopeOnlyDocument}
                      onShowQuotes={() => navigateMobileSection("#quotes")}
                      onTryBroaderSearch={tryBroaderAnswerSearch}
                    />

                    <DrawerGroupLabel title="Review evidence" />

                    <UtilityDrawer
                      icon={Target}
                      title="Evidence & sources"
                      summary={evidenceDrawerSummary({ answer, bestSource, sourceSummary, gaps })}
                      mobileSummary="Evidence"
                    >
                      <div className="space-y-3">
                        <EvidenceSummaryCard
                          answer={answer}
                          bestSource={bestSource}
                          grounded={answerGrounded}
                          relevance={currentRelevance}
                          sourceSummary={sourceSummary}
                          weakEvidence={weakEvidence}
                          sources={sources}
                          gaps={gaps}
                          onScopeDocument={scopeOnlyDocument}
                          supporting
                        />
                        <ScopeAndGovernanceNotice scope={searchScope} warnings={sourceGovernanceWarnings} />
                        <AnswerSafetyNotice demoMode={demoMode} weakEvidence={weakEvidence} />
                        <EvidenceGapPanel relevance={currentRelevance} sources={sources} query={query} />
                        <WhyThisMatchedPanel sources={sources} />
                      </div>
                    </UtilityDrawer>

                    <details data-testid="raw-answer-narrative" className={cn("group", panelSubtle)}>
                      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn(iconTilePremium, "h-8 w-8")}>
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[color:var(--text)]">
                              Source narrative
                            </span>
                            <span className={cn("block truncate text-xs", textMuted)}>
                              Secondary source-linked answer text and section citations
                            </span>
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-[color:var(--border)] p-3 sm:p-4">
                        <SourceLinkedAnswer
                          sections={safeAnswerSections}
                          fallbackText={safeAnswerText}
                          responseMode={answer.responseMode}
                        />
                      </div>
                    </details>
                  </div>

                  <SafetyFindingsPanel findings={safetyFindings} />
                </div>
              ) : (
                <AnswerEmptyState onPickSample={setQuery} />
              )}
            </div>
          </section>

          {showSystemNotice && answer ? renderSystemNotice("sm:hidden") : null}

          {searchMode === "answer" && answer && (
            <QuoteCards
              quotes={answer.quoteCards ?? []}
              copiedQuotes={copiedAction === "quotes"}
              onCopyQuotes={() => copyText("quotes", formatQuotesForClipboard(answer.quoteCards ?? []))}
              onFollowUp={followUpFromQuote}
              onScopeDocument={scopeOnlyDocument}
            />
          )}
          {searchMode === "answer" && answer && (
            <VisualEvidenceStrip evidence={visualEvidence} collapsed={weakEvidence} />
          )}
          {searchMode === "answer" && answer && (
            <RelatedDocumentsPanel
              documents={relatedDocuments}
              onScopeDocument={scopeOnlyDocument}
              onTagSearch={handleTagSearch}
            />
          )}
          <section id="sources" className="grid gap-3 scroll-mt-4 sm:scroll-mt-6">
            <DrawerGroupLabel title="Review evidence" />
            <UtilityDrawer
              icon={FileText}
              title="Source passages"
              summary={
                sources.length ? `${sources.length} retrieved passages` : "Retrieved passages appear after a question."
              }
              mobileSummary={sources.length ? `${sources.length} passages` : "No passages yet"}
            >
              <SourceList sources={sources} query={query} onScopeDocument={scopeOnlyDocument} />
            </UtilityDrawer>

            <DrawerGroupLabel title="Workspace utilities" />
            <UtilityDrawer
              icon={BookOpen}
              title="Documents"
              summary={
                documents.length ? `${documents.length} indexed documents available` : "No indexed documents yet."
              }
              mobileSummary={documents.length ? `${documents.length} documents` : "No documents"}
            >
              <DocumentDrawer
                documents={documents}
                pagination={documentsPagination}
                loadingMoreDocuments={loadingMoreDocuments}
                selectedDocumentIds={selectedDocumentIds}
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

            <UtilityDrawer
              icon={UploadCloud}
              title="Upload and indexing"
              summary="Real uploads require Supabase, OpenAI keys, schema setup, and the worker."
              mobileSummary="Setup & uploads"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>
                    Developer setup status
                  </p>
                  <SetupChecklist checks={setupChecks} />
                  {showAuthPanel && <AuthPanel />}
                  <p className={cn("pt-1 text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>Clinical upload</p>
                  <UploadPanel
                    onUploaded={() => {
                      void refresh({ includeSetup: false, includeDashboardData: true, includeDocumentMeta: false });
                    }}
                    demoMode={uploadReadOnlyMode}
                    canUpload={canUsePrivateApis}
                    authorizationHeader={authorizationHeader}
                  />
                </div>
                <div className="space-y-3">
                  <p className={cn("text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>Indexing progress</p>
                  <IndexingMonitor
                    jobs={jobs}
                    batches={batches}
                    actionId={indexingActionId}
                    onRetry={retryJob}
                    onReindex={reindexDocument}
                    onEnrich={enrichDocument}
                  />
                </div>
              </div>
            </UtilityDrawer>
          </section>

          <GuideTrigger onOpen={openGuide} />
        </div>
      </main>

      <MobileSectionFab
        items={bottomNavItems}
        activeHash={activeHash}
        state={mobileFabState}
        hidden={guideOpen}
        onNavigate={navigateMobileSection}
      />
      <GuideDialog open={guideOpen} onClose={closeGuide} />
    </div>
  );
}
