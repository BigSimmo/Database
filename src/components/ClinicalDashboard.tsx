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
  Sparkles,
  Sun,
  Target,
  UploadCloud,
  WifiOff,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { documentCitationHref, formatCompactCitationLabel, formatCitationLabel } from "@/lib/citations";
import { extractSafetyFindings, formatSafetyFindingLabel } from "@/lib/clinical-safety";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
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
import { useAuthSession } from "@/lib/supabase/client";
import { nextTheme, resolveThemePreference, type ResolvedTheme } from "@/lib/theme";
import { SafeBoldText } from "@/components/SafeBoldText";
import type {
  ClinicalDocument,
  BestSourceRecommendation,
  ImportBatch,
  IngestionJob,
  QuoteCard,
  RagAnswer,
  RelatedDocument,
  SearchResult,
  VisualEvidenceCard,
} from "@/lib/types";
import {
  buildClinicalOutputSections,
  createQuoteFollowUp,
  formatAnswerForClipboard,
  formatQuotesForClipboard,
  formatWardNote,
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

type SetupCheckStatus = "ready" | "needs_setup" | "unknown";
type SetupCheck = {
  id: "env" | "project" | "schema" | "openai" | "worker";
  label: string;
  status: SetupCheckStatus;
  detail: string;
};

type AnswerPayload = RagAnswer & { demoMode?: boolean };

function answerStreamProgressMessage(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

async function readAnswerStream(response: Response, onProgress: (message: string) => void): Promise<AnswerPayload> {
  if (!response.body) throw new Error("Answer stream could not be opened.");

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
    const data = JSON.parse(dataLines.join("\n")) as unknown;
    if (event === "progress") {
      const message = answerStreamProgressMessage(data);
      if (message) onProgress(message);
      return;
    }
    if (event === "error") {
      const message = data && typeof data === "object" ? (data as { error?: unknown }).error : null;
      throw new Error(typeof message === "string" && message ? message : "Answer generation failed.");
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
  if (!finalPayload) throw new Error("Answer stream ended before a final answer was received.");
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

function AnswerHeaderActions({
  bestSource,
  grounded,
}: {
  bestSource: BestSourceRecommendation | null;
  grounded: boolean;
}) {
  return (
    <div
      data-testid="answer-header-actions"
      className="flex min-h-7 shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2"
    >
      {bestSource && (
        <Link
          data-testid="answer-top-source-chip"
          href={bestSource.viewer_href}
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[color:var(--primary)]/20 bg-[color:var(--primary-soft)]/45 px-2 text-[11px] font-semibold leading-none text-[color:var(--primary)] transition hover:border-[color:var(--primary)]/35 hover:bg-[color:var(--primary-soft)] sm:min-h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
          aria-label={`Open best source: ${formatCitationLabel(bestSource)}`}
        >
          <Target className="h-3.5 w-3.5" />
          <span className="sm:hidden">Top</span>
          <span className="hidden sm:inline">Top source</span>
        </Link>
      )}
      {grounded ? (
        <span
          data-testid="answer-grounding-chip"
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[color:var(--success)]/20 bg-[color:var(--success-soft)]/45 px-2 text-[11px] font-semibold leading-none text-[color:var(--success)] sm:min-h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
          aria-label="Source-backed answer"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="sm:hidden">Backed</span>
          <span className="hidden sm:inline">Source-backed</span>
        </span>
      ) : (
        <span
          data-testid="answer-grounding-chip"
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)]/45 px-2 text-[11px] font-semibold leading-none text-[color:var(--warning)] sm:min-h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
          aria-label="Insufficient source support"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="sm:hidden">Limited</span>
          <span className="hidden sm:inline">Insufficient</span>
        </span>
      )}
    </div>
  );
}

function MasterSearchHeader({
  documents,
  query,
  loading,
  selectedDocumentIds,
  hasAnswer,
  demoMode,
  realDataReady,
  theme,
  onQueryChange,
  onAsk,
  onClearQuery,
  onClearScope,
  onToggleScope,
  onPickSample,
  onToggleTheme,
}: {
  documents: ClinicalDocument[];
  query: string;
  loading: boolean;
  selectedDocumentIds: string[];
  hasAnswer: boolean;
  demoMode: boolean;
  realDataReady: boolean;
  theme: ResolvedTheme;
  onQueryChange: (query: string) => void;
  onAsk: () => void;
  onClearQuery: () => void;
  onClearScope: () => void;
  onToggleScope: (documentId: string) => void;
  onPickSample: (sample: string) => void;
  onToggleTheme: () => void;
}) {
  const canAsk = query.trim().length >= 2 && !loading && realDataReady;
  const compactMobile = hasAnswer;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAsk();
  }

  function renderScopeAndPromptRows() {
    return (
      <div className="space-y-2">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 polished-scroll lg:overflow-visible">
          <div className="flex min-w-max items-center gap-2 lg:min-w-0 lg:flex-wrap">
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
            {documents.map((document) => {
              const selected = selectedDocumentIds.includes(document.id);
              return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => onToggleScope(document.id)}
                  title={document.title}
                  className={cn(
                    shellChip,
                    "max-w-[13rem] sm:max-w-[15rem]",
                    selected
                      ? "border-teal-300/40 bg-teal-300/18 text-teal-50"
                      : "border-white/12 bg-white/6 text-slate-200 hover:bg-white/10",
                  )}
                >
                  <Filter className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{document.title.replace(/^Synthetic /, "")}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1 polished-scroll lg:overflow-visible">
          <div className="flex min-w-max items-center gap-2 lg:min-w-0 lg:flex-wrap">
            {sampleQueries.map((sample) => (
              <button
                key={sample.query}
                type="button"
                onClick={() => onPickSample(sample.query)}
                title={sample.query}
                aria-label={`Use sample question: ${sample.query}`}
                className={cn(
                  shellChip,
                  "border-white/10 bg-white/5 text-slate-300 hover:border-teal-300/35 hover:bg-white/10 hover:text-white",
                )}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <header
      id="search"
      className={cn(
        "sticky top-0 z-30 px-3 lg:px-8",
        premiumHeaderSurface,
        compactMobile ? "py-2 sm:py-3" : "py-2.5 sm:py-3",
      )}
      style={{ backgroundColor: "var(--app-shell)" }}
    >
      <div className={cn("mx-auto max-w-7xl", compactMobile ? "space-y-2 sm:space-y-3" : "space-y-3")}>
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
              onClick={onToggleTheme}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-white/15 bg-white/7 text-slate-100 shadow-[var(--shadow-tight)] transition hover:border-white/25 hover:bg-white/12"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        <form
          onSubmit={submit}
          className={cn(
            "grid gap-2",
            compactMobile
              ? "grid-cols-[minmax(0,1fr)_72px_44px] sm:grid-cols-[minmax(0,1fr)_148px]"
              : "grid-cols-[minmax(0,1fr)_72px_44px] sm:grid-cols-[minmax(0,1fr)_136px] lg:grid-cols-[minmax(0,1fr)_148px]",
          )}
        >
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAsk();
              }}
              aria-label="Ask a question across indexed guidelines"
              placeholder="Ask a guideline question"
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
                ? "Sign in before searching private documents"
                : query.trim().length < 2
                  ? "Enter at least two characters to ask"
                  : "Generate a source-backed answer"
            }
            className={cn(primaryControl, compactMobile ? "h-11 rounded-lg px-3 sm:px-5" : "h-11 rounded-lg")}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="sm:hidden">Ask</span>
            <span className="hidden sm:inline">{query.trim().length < 2 ? "Ask" : "Answer"}</span>
          </button>
          <details className="relative sm:hidden">
            <summary
              className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg border border-white/15 bg-white/7 text-slate-100 shadow-[var(--shadow-tight)] transition hover:border-white/25 hover:bg-white/12"
              aria-label="Open document scope and prompt controls"
            >
              <Filter className="h-4 w-4" />
            </summary>
            <div
              data-testid="mobile-scope-popover"
              className="mobile-popover-scroll polished-scroll absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto overscroll-contain rounded-lg border border-white/15 bg-[color:var(--surface-glass)] p-3 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl dark:bg-[color:var(--app-shell-muted)] dark:text-white"
            >
              <div className="mb-2 flex min-h-8 items-center justify-between px-1 text-xs font-semibold text-[color:var(--text-muted)] dark:text-slate-300">
                <span>Scope & prompts</span>
                {selectedDocumentIds.length > 0 && <span>{selectedDocumentIds.length} scoped</span>}
              </div>
              {renderScopeAndPromptRows()}
            </div>
          </details>
        </form>

        {!hasAnswer ? (
          <div className="hidden sm:block">{renderScopeAndPromptRows()}</div>
        ) : (
          <details className="hidden rounded-lg border border-white/10 bg-white/6 shadow-[var(--shadow-inset)] backdrop-blur-md sm:block">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-slate-100">
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Scope & prompts
                {selectedDocumentIds.length > 0 && (
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                    {selectedDocumentIds.length} scoped
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="border-t border-white/10 p-2">{renderScopeAndPromptRows()}</div>
          </details>
        )}
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
        Open PDF
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
        <span className="sm:hidden">This doc</span>
        <span className="hidden sm:inline">Search this document</span>
      </button>
      {imageCount > 0 && (
        <span className={cn(metadataPill, "min-h-[44px] rounded-lg px-3")}>
          {imageCount} indexed image{imageCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function VerificationActionStrip({
  source,
  grounded,
  citationCount,
  quoteCount,
}: {
  source: BestSourceRecommendation | null | undefined;
  grounded: boolean;
  citationCount: number;
  quoteCount: number;
}) {
  if (!source) return null;

  const label = grounded ? "Verify source" : "Closest source";
  const evidenceLabel = `${citationCount} citation${citationCount === 1 ? "" : "s"} · ${quoteCount} quote${
    quoteCount === 1 ? "" : "s"
  }`;

  return (
    <div
      data-testid="verify-source-strip"
      className={cn(evidenceSurface, "flex flex-wrap items-center justify-between gap-2 px-3 py-2.5")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn(iconTilePremium, "h-7 w-7 rounded-md")}>
          <Target className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
          <p className="truncate text-[13px] font-semibold text-[color:var(--text)]">
            {formatCompactCitationLabel(source)}
          </p>
        </div>
      </div>
      <span className={subtleStatusPill}>{evidenceLabel}</span>
      <SourceStatusBadge metadata={source.source_metadata} className="max-w-[8rem] truncate sm:max-w-none" />
      <Link
        href={source.viewer_href}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-3 text-xs font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[color:var(--primary-strong)]"
        aria-label={`Open best source: ${formatCitationLabel(source)}`}
      >
        Open source
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}

function BestSourceCard({
  source,
  grounded,
  onScopeDocument,
}: {
  source: BestSourceRecommendation | null | undefined;
  grounded: boolean;
  onScopeDocument: (documentId: string) => void;
}) {
  if (!source) return null;

  const label = grounded ? "Recommended source" : "Closest indexed source";
  const score = Math.max(0, Math.min(100, Math.round(source.score * 100)));

  return (
    <article className={cn(evidenceSurface, "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <span className={cn(iconTilePremium, "h-8 w-8 sm:h-9 sm:w-9")}>
            <Target className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[color:var(--text)] sm:text-sm">{label}</p>
            <p className="mt-1 truncate text-[15px] font-semibold leading-6 text-[color:var(--primary)] sm:hidden">
              {formatCompactCitationLabel(source)}
            </p>
            <p className="mt-1 hidden truncate text-xs font-semibold text-[color:var(--primary)] sm:block">
              {source.title}, page {source.page_number ?? "n/a"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StrengthBadge strength={source.source_strength} />
          <span className={subtleStatusPill}>{score}% match</span>
        </div>
      </div>

      <SourceProvenance metadata={source.source_metadata} />
      <p className={cn("mt-3 text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>Reason selected</p>
      <p className="mt-1 line-clamp-3 text-[15px] font-medium leading-6 text-[color:var(--text)] sm:line-clamp-4">
        &ldquo;{source.snippet}&rdquo;
      </p>

      <SourceActionRow
        viewerHref={source.viewer_href}
        sourceTitle={source.title}
        documentId={source.document_id}
        onScopeDocument={onScopeDocument}
        imageCount={source.image_count}
      />
    </article>
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
        {findings.map((finding) => (
          <article key={finding.id} className={cn(sourceCard, "bg-[color:var(--surface-glass)] p-3 backdrop-blur-md")}>
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

function CopyGovernanceStrip({
  copiedAnswer,
  copiedDraft,
  onCopyAnswer,
  onCopyDraft,
}: {
  copiedAnswer: boolean;
  copiedDraft: boolean;
  onCopyAnswer: () => void;
  onCopyDraft: () => void;
}) {
  return (
    <div
      data-testid="copy-governance-strip"
      className={cn(
        sourceCard,
        "flex flex-wrap items-center justify-between gap-2 bg-[color:var(--surface-glass)] px-3 py-2.5 backdrop-blur-md",
      )}
    >
      <p className={cn("min-w-0 flex-1 text-[13px] font-semibold leading-5 sm:text-sm", textMuted)}>
        Draft only; verify source first before pasting into the medical record.
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <CopyButton label="Copy answer with citations" shortLabel="Copy" copied={copiedAnswer} onClick={onCopyAnswer} />
        <CopyButton label="Copy clinical draft" shortLabel="Draft" copied={copiedDraft} onClick={onCopyDraft} />
      </div>
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
  copiedWardNote,
  onCopyWardNote,
}: {
  answer: RagAnswer;
  copiedWardNote: boolean;
  onCopyWardNote: () => void;
}) {
  const sections = buildClinicalOutputSections(answer);
  if (sections.length === 0) return null;

  return (
    <>
      <details className={cn("group sm:hidden", panelSubtle)}>
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn(iconTilePremium, "h-8 w-8")}>
              <ListChecks className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--text)]">Clinical formats</span>
              <span className={cn("block truncate text-xs", textMuted)}>{sections.length} practical formats</span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-[color:var(--border)] p-4">
          <CopyButton label="Copy clinical draft" shortLabel="Draft" copied={copiedWardNote} onClick={onCopyWardNote} />
          <p className={cn("text-[15px] leading-6", textMuted)}>
            Draft only; verify source first before pasting into the medical record.
          </p>
          {sections.map((section) => (
            <article key={section.id} className={cn(sourceCard, "p-3")}>
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{section.title}</h3>
              <ul className="mt-2 space-y-2 text-[15px] leading-6 text-[color:var(--text-muted)]">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </details>

      <section className={cn(panelSubtle, "hidden p-4 sm:block")}>
        <SectionHeading
          icon={ListChecks}
          title="Clinical formats"
          description="Practical formats generated only from retrieved answer text and quotes."
          action={<CopyButton label="Copy clinical draft" copied={copiedWardNote} onClick={onCopyWardNote} />}
        />
        <p className={cn("mt-3 text-[15px] leading-6", textMuted)}>
          Draft only; verify source first before pasting into the medical record.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sections.map((section) => (
            <article key={section.id} className={cn(sourceCard, "p-3")}>
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{section.title}</h3>
              <ul className="mt-2 space-y-2 text-[15px] leading-6 text-[color:var(--text-muted)]">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function VisualEvidenceStrip({ evidence }: { evidence: VisualEvidenceCard[] }) {
  return (
    <section id="images" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
      <SectionHeading
        icon={FileImage}
        title="Source diagrams"
        description="Diagrams and images extracted from indexed source documents."
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
          {evidence.map((item) => (
            <figure key={item.id} className={cn(sourceCard, "overflow-hidden p-2.5 sm:p-3")}>
              <div className="rounded-lg bg-[color:var(--surface-inset)] p-2.5 sm:p-3">
                <SourceImage endpoint={item.signed_url_endpoint} caption={item.caption} />
              </div>
              <figcaption className="mt-2 text-[15px] leading-6 text-[color:var(--text)] sm:mt-3">
                {item.caption}
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
                <Link href={item.viewer_href} className={cn(floatingControl, "min-h-[44px] px-4 text-xs")}>
                  <ExternalLink className="h-4 w-4" />
                  Open PDF
                </Link>
              </div>
            </figure>
          ))}
        </div>
      )}
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
                  {document.match_reason} · pages {document.best_pages.join(", ") || "n/a"} ·{" "}
                  {document.image_count} images
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
                  <span key={`${label.label_type}:${label.label}`} className={cn(metadataPill, "min-h-7 px-2 text-[11px]")}>
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

function SourceList({
  sources,
  onScopeDocument,
}: {
  sources: SearchResult[];
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
        <article key={source.id} className={cn(sourceCard, "p-3 sm:p-4")}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <Link
                href={`/documents/${source.document_id}?page=${source.page_number ?? 1}&chunk=${source.id}`}
                className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[color:var(--text)] transition hover:text-[color:var(--primary)]"
              >
                {source.title}
              </Link>
              <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                {source.file_name} · page {source.page_number ?? "n/a"} · chunk {source.chunk_index}
              </p>
              <SourceProvenance metadata={source.source_metadata} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SourceStatusBadge metadata={source.source_metadata} />
              <StrengthBadge strength={source.source_strength} />
              <button
                type="button"
                onClick={() => onScopeDocument(source.document_id)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)]"
              >
                <Filter className="h-4 w-4" />
                This document
              </button>
            </div>
          </div>
          <p className={cn("mt-2 line-clamp-3 text-[15px] leading-6 sm:mt-3 sm:line-clamp-4", textMuted)}>
            {source.content}
          </p>
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
  const [email, setEmail] = useState("");
  const busy = status === "loading";

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
            {status === "expired" ? "Session expired" : "Sign in for private documents"}
          </p>
          <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
            Real-data search, upload, and source previews require a Supabase Auth session.
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
            onChange={(event) => setEmail(event.target.value)}
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
  selectedDocumentIds,
  onToggleScope,
}: {
  documents: ClinicalDocument[];
  selectedDocumentIds: string[];
  onToggleScope: (documentId: string) => void;
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
          role="status"
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
    return <EmptyState icon={UploadCloud} title="No ingestion jobs" body="Queued uploads and worker progress appear here." />;
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
            {job.error_message && <p className={cn("mt-2 line-clamp-2 text-xs leading-5", textMuted)}>{job.error_message}</p>}
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
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
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
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition group-open:rotate-180" />
      </summary>
      {open && <div className={cn(clinicalDivider, "p-4")}>{children}</div>}
    </details>
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
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
      className="fixed inset-0 z-50 flex items-end bg-slate-950/70 px-3 py-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="clinical-kb-guide-title"
        className={cn(glassPanel, "max-h-[min(82svh,42rem)] w-full overflow-y-auto sm:max-w-2xl")}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] bg-[linear-gradient(180deg,var(--surface-highlight),transparent_72%),var(--surface-raised)] p-4 sm:p-5">
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

export function ClinicalDashboard() {
  const mainRef = useRef<HTMLElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const navSyncLockRef = useRef<number | null>(null);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [answerProgress, setAnswerProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [setupChecks, setSetupChecks] = useState<SetupCheck[]>(fallbackSetupChecks);
  const [demoMode, setDemoMode] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [activeHash, setActiveHash] = useState("#search");
  const [guideOpen, setGuideOpen] = useState(false);
  const [indexingActionId, setIndexingActionId] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const { status: authStatus, authorizationHeader, markSessionExpired } = auth;
  const supabaseEnvStatus = setupChecks.find((check) => check.id === "env")?.status;
  const browserAuthUnavailableDemoFallback = !auth.isConfigured && supabaseEnvStatus !== "ready";
  const clientDemoMode = demoMode || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || browserAuthUnavailableDemoFallback;
  const canUsePrivateApis = clientDemoMode || authStatus === "authenticated";
  const openGuide = useCallback(() => setGuideOpen(true), []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

  const refresh = useCallback(async () => {
    setApiUnavailable(false);
    const setupResponse = await fetch("/api/setup-status").catch(() => null);

    if (!setupResponse) {
      setApiUnavailable(true);
      setSetupWarning("The local API is unavailable.");
      return;
    }

    let nextDemoMode = clientDemoMode;
    if (setupResponse.ok) {
      const payload = await setupResponse.json();
      setSetupChecks(payload.checks ?? fallbackSetupChecks);
      nextDemoMode = Boolean(payload.demoMode);
      if (nextDemoMode) setDemoMode(true);
      if (!nextDemoMode && authStatus !== "authenticated") {
        setDocuments([]);
        setJobs([]);
        setBatches([]);
        return;
      }
    }

    const protectedHeaders = nextDemoMode ? undefined : authorizationHeader;
    const [documentsResponse, jobsResponse, batchesResponse] = await Promise.all([
      fetch("/api/documents", { headers: protectedHeaders }),
      fetch("/api/ingestion/jobs", { headers: protectedHeaders }),
      fetch("/api/ingestion/batches", { headers: protectedHeaders }),
    ]);

    if (documentsResponse.status === 401 || jobsResponse.status === 401 || batchesResponse.status === 401) {
      markSessionExpired();
      setDocuments([]);
      setJobs([]);
      setBatches([]);
      return;
    }

    if (documentsResponse.ok) {
      const payload = await documentsResponse.json();
      setDocuments(payload.documents ?? []);
      if (payload.demoMode) setDemoMode(true);
      if (payload.setupRequired) setSetupWarning(payload.error);
    } else {
      setApiUnavailable(true);
    }

    if (jobsResponse.ok) {
      const payload = await jobsResponse.json();
      setJobs(payload.jobs ?? []);
      if (payload.demoMode) setDemoMode(true);
      if (payload.setupRequired) setSetupWarning(payload.error);
    } else {
      setApiUnavailable(true);
    }

    if (batchesResponse.ok) {
      const payload = await batchesResponse.json();
      setBatches(payload.batches ?? []);
      if (payload.demoMode) setDemoMode(true);
    } else {
      setApiUnavailable(true);
    }
  }, [authStatus, authorizationHeader, clientDemoMode, markSessionExpired]);

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
        await refresh();
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
        await refresh();
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

  useEffect(() => {
    const tick = () => {
      if (shouldPollForUpdates(demoMode, document.visibilityState)) {
        refresh().catch(() => undefined);
      }
    };

    const initial = window.setTimeout(() => {
      refresh().catch(() => undefined);
    }, 0);
    const interval = window.setInterval(tick, 7000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [authStatus, authorizationHeader, clientDemoMode, demoMode, refresh]);

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

  async function ask() {
    if (query.trim().length < 2) return;
    if (!clientDemoMode && authStatus !== "authenticated") {
      setError("Sign in before searching private guideline documents.");
      return;
    }
    setLoading(true);
    setError(null);
    setAnswerProgress("Searching indexed documents.");

    try {
      const response = await fetch("/api/answer/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientDemoMode ? {} : authorizationHeader),
        },
        body: JSON.stringify({
          query,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        }),
      });
      if (response.status === 401) markSessionExpired();
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Answer generation failed");
      }
      const payload = await readAnswerStream(response, setAnswerProgress);
      setAnswer(payload);
      setSources(payload.sources ?? []);
      if (payload.demoMode) setDemoMode(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Answer generation failed");
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
  const safetyFindings = useMemo(() => extractSafetyFindings(answer), [answer]);
  const bestSource = answer?.bestSource ?? answer?.smartPanel?.bestSource ?? null;
  const sourceSummary = answer?.evidenceSummary ?? answer?.smartPanel?.evidenceSummary;
  const gaps = answer?.conflictsOrGaps ?? answer?.smartPanel?.conflictsOrGaps ?? [];
  const showSystemNotice = demoMode || setupWarning;
  const bottomNavItems = [
    { label: "Answer", icon: Search, href: "#search", count: null },
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
  const showAuthPanel = !clientDemoMode && authStatus !== "authenticated";
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
        loading={loading}
        selectedDocumentIds={selectedDocumentIds}
        hasAnswer={Boolean(answer)}
        demoMode={demoMode}
        realDataReady={canUsePrivateApis}
        theme={theme}
        onQueryChange={setQuery}
        onAsk={ask}
        onClearQuery={() => setQuery("")}
        onClearScope={() => setSelectedDocumentIds([])}
        onToggleScope={toggleDocumentScope}
        onPickSample={setQuery}
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
                icon={Search}
                title="Answer"
                description="Sourced synthesis with quotes, PDFs, and indexed diagrams."
                testId="answer-section-heading"
                hideDescriptionOnMobile
                compactMobile
                action={
                  answer ? (
                    <AnswerHeaderActions
                      bestSource={bestSource}
                      grounded={answer.grounded && answer.confidence !== "unsupported"}
                    />
                  ) : null
                }
              />
            </div>

            <div className="p-3 sm:p-5">
              {error && (
                <div className="mb-4 rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] p-3 text-sm font-medium text-[color:var(--danger)]">
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

              {loading && !answer ? (
                <AnswerSkeleton />
              ) : answer ? (
                <div className="space-y-4 sm:space-y-5">
                  <div className={cn(answerSurface, "p-3 sm:p-4")}>
                    <p className="whitespace-pre-wrap text-[15px] font-medium leading-7 text-[color:var(--text-heading)]">
                      <SafeBoldText text={answer.answer} />
                    </p>
                  </div>

                  <SafetyFindingsPanel findings={safetyFindings} />

                  <VerificationActionStrip
                    source={bestSource}
                    grounded={answer.grounded && answer.confidence !== "unsupported"}
                    citationCount={answer.citations.length}
                    quoteCount={answer.quoteCards?.length ?? 0}
                  />

                  <CopyGovernanceStrip
                    copiedAnswer={copiedAction === "answer"}
                    copiedDraft={copiedAction === "ward-note"}
                    onCopyAnswer={() => copyText("answer", formatAnswerForClipboard(answer))}
                    onCopyDraft={() => copyText("ward-note", formatWardNote(answer, demoMode))}
                  />

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

                  {sourceSummary && (
                    <p
                      className={cn(metadataPill, "inline-flex min-h-8 w-fit max-w-full flex-wrap gap-x-1.5 leading-5")}
                    >
                      {sourceSummary.document_count} documents · {sourceSummary.quote_count} exact quotes ·{" "}
                      {sourceSummary.image_count} indexed images
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={Search}
                  title="Ask indexed guidelines"
                  body="The answer, quotes, source PDFs, and diagrams will appear here."
                />
              )}
            </div>
          </section>

          {showSystemNotice && answer ? renderSystemNotice("sm:hidden") : null}

          {answer && (
            <QuoteCards
              quotes={answer.quoteCards ?? []}
              copiedQuotes={copiedAction === "quotes"}
              onCopyQuotes={() => copyText("quotes", formatQuotesForClipboard(answer.quoteCards ?? []))}
              onFollowUp={followUpFromQuote}
              onScopeDocument={scopeOnlyDocument}
            />
          )}
          {answer && <VisualEvidenceStrip evidence={visualEvidence} />}
          {answer && <RelatedDocumentsPanel documents={relatedDocuments} onScopeDocument={scopeOnlyDocument} />}
          {answer && (
            <ClinicalOutputPanel
              answer={answer}
              copiedWardNote={copiedAction === "ward-note-panel"}
              onCopyWardNote={() => copyText("ward-note-panel", formatWardNote(answer, demoMode))}
            />
          )}

          <section id="sources" className="grid gap-3 scroll-mt-4 sm:scroll-mt-6">
            {bestSource ? (
              <UtilityDrawer
                icon={Target}
                title="Top source detail"
                summary="Why the leading source was selected."
                mobileSummary="Top source"
              >
                <BestSourceCard
                  source={bestSource}
                  grounded={answer?.grounded === true && answer.confidence !== "unsupported"}
                  onScopeDocument={scopeOnlyDocument}
                />
              </UtilityDrawer>
            ) : null}

            {answer?.answerSections?.length ? (
              <UtilityDrawer
                icon={ListChecks}
                title="Answer details"
                summary={`${answer.answerSections.length} sourced detail sections`}
                mobileSummary={`${answer.answerSections.length} details`}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {answer.answerSections.map((section) => (
                    <article
                      key={`${section.heading}:${section.citation_chunk_ids.join(",")}`}
                      className={cn(panelSubtle, "p-4")}
                    >
                      <h2 className="text-sm font-semibold text-[color:var(--text)]">{section.heading}</h2>
                      <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>
                        <SafeBoldText text={section.body} />
                      </p>
                    </article>
                  ))}
                </div>
              </UtilityDrawer>
            ) : null}

            <UtilityDrawer
              icon={FileText}
              title="Source passages"
              summary={
                sources.length ? `${sources.length} retrieved passages` : "Retrieved passages appear after a question."
              }
              mobileSummary={sources.length ? `${sources.length} passages` : "No passages yet"}
            >
              <SourceList sources={sources} onScopeDocument={scopeOnlyDocument} />
            </UtilityDrawer>

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
                selectedDocumentIds={selectedDocumentIds}
                onToggleScope={toggleDocumentScope}
              />
            </UtilityDrawer>

            <UtilityDrawer
              icon={Filter}
              title="Retrieval details"
              summary="Retrieval diagnostics and gaps are available here when needed."
              mobileSummary="Diagnostics"
            >
              <div className="space-y-4 text-sm">
                {answer?.documentBreakdown?.length ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {answer.documentBreakdown.map((document) => (
                      <div key={document.document_id} className={cn(panelSubtle, "p-3")}>
                        <p className="font-semibold text-[color:var(--text)]">{document.title}</p>
                        <p className={cn("mt-1 text-xs leading-5", textMuted)}>
                          {document.source_count} chunks · {document.quote_count} quotes · pages{" "}
                          {document.pages.join(", ") || "n/a"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Filter}
                    title="No retrieval details yet"
                    body="Ask a question to inspect source coverage and gaps."
                  />
                )}
                {gaps.length > 0 && (
                  <div className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] p-3 text-[color:var(--warning)]">
                    <AlertCircle className="mr-2 inline h-4 w-4" />
                    {gaps[0].message}
                  </div>
                )}
              </div>
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
                  {!clientDemoMode && authStatus !== "authenticated" && <AuthPanel />}
                  <p className={cn("pt-1 text-xs font-bold uppercase tracking-[0.08em]", textMuted)}>Clinical upload</p>
                  <UploadPanel
                    onUploaded={refresh}
                    demoMode={clientDemoMode}
                    canUpload={authStatus === "authenticated"}
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
        className="z-30 grid shrink-0 select-none grid-cols-4 border-t border-white/30 bg-[color:var(--surface-glass)] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl dark:border-white/10 lg:hidden"
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
