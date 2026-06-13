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
  MessageSquareText,
  Moon,
  Quote,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  Target,
  UploadCloud,
  WifiOff,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AccessibleTable } from "@/components/AccessibleTable";
import { DocumentManagementActions, type DocumentDeleteResult } from "@/components/DocumentManagementActions";
import { documentCitationHref, formatCompactCitationLabel, formatCitationLabel } from "@/lib/citations";
import { extractSafetyFindings, formatSafetyFindingLabel } from "@/lib/clinical-safety";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { readLocalProjectIdentity, unsafeLocalProjectMessage } from "@/lib/local-project-identity";
import { isLocalNoAuthMode } from "@/lib/env";
import { normalizeSourceMetadata, sourceStatusLabel } from "@/lib/source-metadata";
import {
  appBackdrop,
  answerSurface,
  clinicalDivider,
  cn,
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
import { Sheet } from "@/components/ui/sheet";
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
import { sourceTextForDisplay, sourceTextForDisplayPreservingBreaks } from "@/lib/source-text-sanitizer";
import { smartEvidenceTags } from "@/lib/evidence-tags";
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
  VisualEvidenceCard,
} from "@/lib/types";
import {
  buildClinicalOutputSections,
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

type SearchResultModePayload =
  | {
      kind: "documents";
      query: string;
      demoMode?: boolean;
      sources: SearchResult[];
      documentMatches: DocumentMatch[];
      relevance?: EvidenceRelevance;
      facets?: SearchFacets;
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

function MasterSearchHeader({
  documents,
  query,
  searchMode,
  loading,
  selectedDocumentIds,
  hasAnswer,
  demoMode,
  realDataReady,
  theme,
  onQueryChange,
  onSearchModeChange,
  onAsk,
  onClearQuery,
  onClearScope,
  onToggleScope,
  onOpenGuide,
  onToggleTheme,
}: {
  documents: ClinicalDocument[];
  query: string;
  searchMode: SearchMode;
  loading: boolean;
  selectedDocumentIds: string[];
  hasAnswer: boolean;
  demoMode: boolean;
  realDataReady: boolean;
  theme: ResolvedTheme;
  onQueryChange: (query: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onAsk: () => void;
  onClearQuery: () => void;
  onClearScope: () => void;
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
        [document.title, document.file_name, document.description]
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
                        <span className="block truncate text-sm font-semibold">
                          {documentScopeTitle(document)}
                        </span>
                        <span className="block truncate text-[11px] font-medium text-slate-400">
                          {documentScopeMeta(document)}
                        </span>
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
        "sticky top-0 z-30 px-3 lg:px-8",
        premiumHeaderSurface,
        compactMobile ? "py-2 sm:py-2.5" : "py-2 sm:py-2.5",
      )}
      style={{ backgroundColor: "var(--app-shell)" }}
    >
      <div className="mx-auto max-w-7xl space-y-2">
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

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/6 p-1 shadow-[var(--shadow-inset)]">
          <div role="group" aria-label="Search mode" className="grid min-w-[13rem] grid-cols-2 gap-1">
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
                    "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition",
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
          <span className="hidden px-2 text-xs font-medium text-slate-300 sm:inline">
            {searchMode === "answer" ? "Synthesize cited clinical guidance" : "List matching source documents"}
          </span>
        </div>

        <form
          onSubmit={submit}
          className="grid grid-cols-[minmax(0,1fr)_72px_86px] gap-2 sm:grid-cols-[minmax(0,1fr)_136px_108px] lg:grid-cols-[minmax(0,1fr)_148px_116px]"
        >
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAsk();
              }}
              aria-label="Search indexed guidelines by question or keyword"
              placeholder="Ask a question or enter a keyword"
              className={cn(
                "w-full rounded-lg border border-white/20 bg-white/95 pl-12 pr-12 font-semibold text-slate-950 shadow-[0_16px_34px_rgb(0_0_0_/_14%),inset_0_1px_0_rgb(255_255_255_/_82%)] outline-none transition placeholder:text-slate-500 focus:border-[color:var(--focus)] focus:ring-4 focus:ring-teal-300/25 dark:bg-slate-950/90 dark:text-slate-50 dark:placeholder:text-slate-500",
                "h-11 text-sm sm:text-base",
              )}
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
            className={cn(primaryControl, compactMobile ? "h-11 rounded-lg px-3 sm:px-5" : "h-11 rounded-lg")}
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
            className="relative"
          >
            <summary
              ref={scopeSummaryRef}
              className="flex h-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/7 px-2 text-xs font-semibold text-slate-100 shadow-[var(--shadow-tight)] transition motion-safe:duration-150 hover:border-white/25 hover:bg-white/12 sm:gap-2 sm:px-3"
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
              className="mobile-popover-scroll polished-scroll absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto overscroll-contain rounded-lg border border-white/15 bg-[color:var(--surface-glass)] p-2.5 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl transition motion-safe:duration-150 dark:bg-[color:var(--app-shell-muted)] dark:text-white sm:w-[28rem]"
            >
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
  return sanitizeAnswerDisplayText(value, { minLength: 8, minTokens: 2 })
    .replace(/(?:\s*\n\s*)?Synthetic demo only:.*$/i, "")
    .trim();
}

function PlainAnswerResponse({ text }: { text: string }) {
  const cleaned = plainAnswerText(text);
  if (!cleaned) return null;
  const paragraphs = cleaned.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <section
      data-testid="plain-answer-response"
      aria-label="Answer response"
      className="relative overflow-hidden rounded-lg border border-[color:var(--border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface-raised)_88%,var(--warning-soft)),var(--surface)_68%)] px-3 py-3 text-[15px] leading-7 text-[color:var(--text-heading)] shadow-[var(--shadow-tight)] ring-1 ring-[color:var(--primary)]/8 sm:px-4"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--surface)] text-[color:var(--primary)] ring-1 ring-[color:var(--primary)]/20">
          <MessageSquareText className="h-4 w-4" />
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Response</p>
      </div>
      <div className="space-y-2 pl-0 font-medium sm:pl-8">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}:${paragraph.slice(0, 32)}`}>
            <SafeBoldText text={paragraph} />
          </p>
        ))}
      </div>
    </section>
  );
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
}: {
  answer: RagAnswer;
  collapsed?: boolean;
}) {
  const sections = buildClinicalOutputSections(answer);
  if (sections.length === 0) return null;
  const leadSection = sections.find((section) => section.id === "bottom-line") ?? sections[0];
  const detailSections = sections.filter((section) => section.id !== leadSection.id && section.id !== "verify-source");
  const verifySection = sections.find((section) => section.id === "verify-source");

  const content = (
    <section data-testid="clinical-action-view" className={cn(panelSubtle, "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading
          icon={ListChecks}
          title="Clinical answer"
          description="Dense source-backed structure for review before clinical use."
          hideDescriptionOnMobile
          compactMobile
        />
      </div>
      <div className="mt-3 rounded-lg border border-[color:var(--primary)]/20 bg-[linear-gradient(180deg,var(--surface-highlight),transparent_70%),var(--surface-raised)] p-3 shadow-[var(--shadow-inset)]">
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
      <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {detailSections.map((section) => {
          const isWide = section.id === "thresholds" || Boolean(section.tables?.length);
          return (
            <article key={section.id} className={cn(sourceCard, "p-3", isWide && "md:col-span-2 xl:col-span-3")}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[color:var(--text)]">{section.title}</h3>
                <span className={cn(metadataPill, "min-h-6 px-2 text-[10px]")}>{section.items.length}</span>
              </div>
              {section.tables?.length ? (
                <div className="mt-3 grid gap-3">
                  {section.tables.map((table) => (
                    <div key={table.id} className="space-y-1.5">
                      <AccessibleTable
                        caption={table.sourceLabel ? `${table.caption} · ${table.sourceLabel}` : table.caption}
                        markdown={table.markdown}
                        rows={table.rows}
                        columns={table.columns}
                        compact
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              {section.items.length ? (
                <ul className="mt-2 space-y-1.5 text-[15px] leading-6 text-[color:var(--text)]">
                  {section.items.map((item, index) => (
                    <li key={`${section.id}:${index}:${item.slice(0, 48)}`} className="grid grid-cols-[auto_1fr] gap-2">
                      <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[color:var(--primary)]" />
                      <span>
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
                  {[item.tableLabel, item.tableTitle].filter(Boolean).length > 0 && (
                    <p className="font-semibold">{[item.tableLabel, item.tableTitle].filter(Boolean).join(": ")}</p>
                  )}
                  <p>{item.caption}</p>
                  <AccessibleTable
                    caption={[item.tableLabel, item.tableTitle].filter(Boolean).join(": ") || item.caption}
                    markdown={tableMarkdown}
                    rows={item.tableRows}
                    columns={item.tableColumns}
                    compact
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
                  <span className={cn("text-[15px] font-semibold leading-6 sm:hidden", textMuted)}>
                    {formatCompactCitationLabel(item)}
                  </span>
                  <span className={cn("hidden text-xs font-semibold leading-5 sm:inline", textMuted)}>
                    {item.title}, page {item.page_number ?? "n/a"}
                  </span>
                  {item.image_type && (
                    <span className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
                      {item.image_type.replaceAll("_", " ")}
                    </span>
                  )}
                  <QueryCoverageChips relevance={item.relevance} limit={2} />
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
}: {
  documents: RelatedDocument[];
  onScopeDocument: (documentId: string) => void;
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
            {document.labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {document.labels.slice(0, 6).map((label) => (
                  <span
                    key={`${label.label_type}:${label.label}`}
                    className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}
                  >
                    {label.label}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </UtilityDrawer>
  );
}

function SearchFacetChips({ facets }: { facets?: SearchFacets | null }) {
  if (!facets) return null;
  const chips = [
    ...(facets.status ?? []).map((facet) => ({ ...facet, prefix: "status" })),
    ...(facets.documentTypes ?? []).map((facet) => ({ ...facet, prefix: "type" })),
    ...(facets.sections ?? []).map((facet) => ({ ...facet, prefix: "section" })),
    ...(facets.evidence ?? []).map((facet) => ({ ...facet, prefix: "evidence" })),
  ].slice(0, 14);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((facet) => (
        <span key={`${facet.prefix}:${facet.value}`} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
          {facet.prefix}: {facet.value} ({facet.count})
        </span>
      ))}
    </div>
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
}) {
  const trimmedQuery = query.trim();

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
      <SearchFacetChips facets={facets} />
      <div className="grid gap-3">
        {matches.map((document) => (
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
            {document.labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {document.labels.slice(0, 4).map((label) => (
                  <span
                    key={`${document.document_id}:${label.label_type}:${label.label}`}
                    className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}
                  >
                    {label.label}
                  </span>
                ))}
                {document.labels.length > 4 ? (
                  <span className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
                    +{document.labels.length - 4} more
                  </span>
                ) : null}
              </div>
            )}
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
  const normalized = normalizeDisplayText(sourceTextForDisplay(value));
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
  const normalized = sourceTextForDisplayPreservingBreaks(value).trim();
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
                    <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                      {sourceMeta}
                    </p>
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

function DocumentDrawer({
  documents,
  pagination,
  loadingMoreDocuments,
  selectedDocumentIds,
  onToggleScope,
  onLoadMoreDocuments,
  onDocumentRenamed,
  onDocumentDeleted,
  canManageDocuments,
}: {
  documents: ClinicalDocument[];
  pagination: DocumentPagination | null;
  loadingMoreDocuments: boolean;
  selectedDocumentIds: string[];
  onToggleScope: (documentId: string) => void;
  onLoadMoreDocuments: () => void;
  onDocumentRenamed: (document: ClinicalDocument) => void;
  onDocumentDeleted: (result: DocumentDeleteResult) => void;
  canManageDocuments: boolean;
}) {
  const [filter, setFilter] = useState("");
  const filtered = documents.filter((document) => {
    const labelText = document.labels?.map((label) => label.label).join(" ") ?? "";
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
                  {document.labels?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {document.labels.slice(0, 5).map((label) => (
                        <span
                          key={`${document.id}:${label.label_type}:${label.label}`}
                          className={cn(metadataPill, "min-h-6 px-2 text-[10px]")}
                        >
                          {label.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
    <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
      {title}
    </p>
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
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Clinical KB guide"
      description="Practical use notes for source-backed guideline search."
      closeLabel="Close guide"
      contentClassName="sm:max-w-2xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {guideSections.map((section) => (
          <article key={section.title} className={cn(sourceCard, "p-3")}>
            <h3 className="text-sm font-semibold text-[color:var(--text)]">{section.title}</h3>
            <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>{section.body}</p>
          </article>
        ))}
      </div>
    </Sheet>
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
  const clientDemoMode =
    demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || browserAuthUnavailableDemoFallback || localNoAuthMode;
  const uploadReadOnlyMode =
    demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || browserAuthUnavailableDemoFallback;
  const canUsePrivateApis = localProjectReady && (localNoAuthMode || authStatus === "authenticated");
  const canRunSearch = clientDemoMode || hasReadyPublicSearchSetup(setupChecks);
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

  async function requestDocuments(queryText: string) {
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
      return;
    }

    const answerData = payload.payload;
    setAnswer(answerData);
    setSources(answerData.sources ?? []);
    setSearchRelevance(answerData.relevance ?? answerData.smartPanel?.relevance ?? null);
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
    setSearchRelevance(null);
    setSearchFacets(null);
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

  const showSystemNotice = demoMode || setupWarning;
  const bottomNavItems = [
    {
      label: searchMode === "answer" ? "Answer" : "Docs",
      icon: searchMode === "answer" ? Search : FileText,
      href: "#search",
      count: searchMode === "documents" ? documentMatches.length : null,
    },
    { label: "Quotes", icon: Quote, href: "#quotes", count: answer ? (answer.quoteCards ?? []).length : null },
    { label: "Images", icon: FileImage, href: "#images", count: answer ? visualEvidence.length : null },
    { label: "Sources", icon: FileText, href: "#sources", count: answer ? sources.length : null },
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
        hasAnswer={Boolean(answer)}
        demoMode={demoMode}
        realDataReady={canRunSearch}
        theme={theme}
        onQueryChange={setQuery}
        onSearchModeChange={setSearchMode}
        onAsk={ask}
        onClearQuery={() => setQuery("")}
        onClearScope={() => setSelectedDocumentIds([])}
        onToggleScope={toggleDocumentScope}
        onOpenGuide={openGuide}
        onToggleTheme={toggleTheme}
      />

      <main
        ref={mainRef}
        onScroll={scheduleActiveSectionSync}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-6 sm:space-y-5 sm:px-4 sm:py-5 sm:pb-8 lg:px-8">
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
                />
              ) : loading && !answer ? (
                <AnswerSkeleton />
              ) : answer ? (
                <div className="min-w-0 space-y-4 sm:space-y-5">
                  <div className={cn(answerSurface, "space-y-3 p-2.5 sm:p-3")}>
                    <PlainAnswerResponse text={safeAnswerText || answer.answer} />

                    <ClinicalOutputPanel answer={answer} />

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
                        <AnswerSafetyNotice demoMode={demoMode} weakEvidence={weakEvidence} />
                        <EvidenceGapPanel relevance={currentRelevance} sources={sources} query={query} />
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

                  <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex min-w-max gap-2 pb-1 sm:min-w-0 sm:flex-wrap">
                      {answer.citations.map((citation) => (
                        <Link
                          key={citation.chunk_id}
                          href={documentCitationHref(citation)}
                          aria-label={`Open ${formatCitationLabel(citation)}`}
                          className="inline-flex min-h-[44px] items-center rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--surface)] px-3 py-2 text-[13px] font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary-soft)] sm:text-xs"
                        >
                          <span className="sm:hidden">{formatCompactCitationLabel(citation)}</span>
                          <span className="hidden sm:inline">{formatCitationLabel(citation)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
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
            <RelatedDocumentsPanel documents={relatedDocuments} onScopeDocument={scopeOnlyDocument} />
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
                canManageDocuments={canUsePrivateApis}
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

      <nav
        aria-label="Answer sections"
        className="pb-safe-2 z-30 grid shrink-0 select-none grid-cols-4 border-t border-white/30 bg-[color:var(--surface-glass)] px-2 pt-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl dark:border-white/10 lg:hidden"
      >
        {bottomNavItems.map(({ label, icon: Icon, href, count }) => (
          <a
            key={label}
            href={href}
            aria-label={count === null ? label : `${label}, ${count} item${count === 1 ? "" : "s"}`}
            aria-current={activeHash === href ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigateMobileSection(href);
            }}
            className={cn(
              navPill,
              "min-h-[48px] flex-col gap-1 border-transparent bg-transparent px-2 shadow-none backdrop-blur-0 hover:bg-[color:var(--surface-subtle)]",
              activeHash === href &&
                "border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)] text-[color:var(--primary)] shadow-[var(--glow-soft)]",
            )}
          >
            <span className="inline-flex h-5 items-center justify-center gap-1">
              <Icon className="h-5 w-5" />
              {count !== null && (
                <span className="min-w-4 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-glass)] px-1 text-center text-[10px] font-bold leading-4 text-[color:var(--text)] shadow-[var(--shadow-inset)]">
                  {count}
                </span>
              )}
            </span>
            {label}
          </a>
        ))}
      </nav>
      <GuideDialog open={guideOpen} onClose={closeGuide} />
    </div>
  );
}

