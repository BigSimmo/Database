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
  Moon,
  Quote,
  Search,
  Sun,
  Target,
  UploadCloud,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  documentCitationHref,
  formatCompactCitationLabel,
  formatCitationLabel,
} from "@/lib/citations";
import { clearCachedSignedUrl, getCachedSignedUrl, setCachedSignedUrl } from "@/lib/signed-url-cache";
import { nextTheme, resolveThemePreference, type ResolvedTheme } from "@/lib/theme";
import type {
  ClinicalDocument,
  BestSourceRecommendation,
  IngestionJob,
  QuoteCard,
  RagAnswer,
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
  id: "env" | "schema" | "openai" | "worker";
  label: string;
  status: SetupCheckStatus;
  detail: string;
};

const textMuted = "text-[color:var(--text-muted)]";
const panel =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]";
const panelSubtle =
  "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";
const controlBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg text-sm font-semibold transition hover:shadow-[var(--shadow-tight)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-none";
const primaryControl =
  `${controlBase} bg-[color:var(--primary)] px-5 text-[color:var(--primary-contrast)] hover:bg-[color:var(--primary-strong)]`;
const secondaryControl =
  `${controlBase} border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-[color:var(--text)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]`;
const fieldLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]";
const shellChip =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition hover:shadow-[var(--shadow-tight)]";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNavigationHash(hash: string) {
  return navigationHashes.includes(hash as (typeof navigationHashes)[number])
    ? hash
    : "#search";
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
      className:
        "border-[color:var(--success)]/30 bg-[color:var(--success-soft)] text-[color:var(--success)]",
    };
  }
  if (status === "failed") {
    return {
      icon: AlertCircle,
      className:
        "border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    };
  }
  if (status === "processing") {
    return {
      icon: Loader2,
      className:
        "border-[color:var(--info)]/30 bg-[color:var(--info-soft)] text-[color:var(--info)]",
    };
  }
  return {
    icon: FileText,
    className:
      "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
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
  const className =
    strength === "strong"
      ? "border-[color:var(--success)]/30 bg-[color:var(--success-soft)] text-[color:var(--success)]"
      : strength === "limited"
        ? "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] text-[color:var(--warning)]"
        : "border-[color:var(--info)]/30 bg-[color:var(--info-soft)] text-[color:var(--info)]";

  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold", className)}>
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

  useEffect(() => {
    const cached = getCachedSignedUrl(endpoint);
    if (cached) return () => undefined;

    let active = true;
    fetch(endpoint)
      .then((response) => (response.ok ? response.json() : null))
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
  }, [attempt, endpoint]);

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
  hideDescriptionOnMobile = false,
  compactMobile = false,
}: {
  icon: typeof Search;
  title: string;
  description?: string;
  action?: ReactNode;
  hideDescriptionOnMobile?: boolean;
  compactMobile?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between", compactMobile ? "gap-2 sm:gap-3" : "gap-3")}>
      <div className={cn("flex min-w-0 items-start", compactMobile ? "gap-2 sm:gap-3" : "gap-3")}>
        <span className={cn(
          "mt-0.5 grid shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
          compactMobile ? "h-7 w-7 sm:h-9 sm:w-9" : "h-9 w-9",
        )}>
          <Icon className={cn(compactMobile ? "h-4 w-4 sm:h-4.5 sm:w-4.5" : "h-4.5 w-4.5")} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text)] sm:text-base">{title}</h2>
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

function MasterSearchHeader({
  documents,
  query,
  loading,
  selectedDocumentIds,
  hasAnswer,
  demoMode,
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
  theme: ResolvedTheme;
  onQueryChange: (query: string) => void;
  onAsk: () => void;
  onClearQuery: () => void;
  onClearScope: () => void;
  onToggleScope: (documentId: string) => void;
  onPickSample: (sample: string) => void;
  onToggleTheme: () => void;
}) {
  const canAsk = query.trim().length >= 2 && !loading;
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
        "sticky top-0 z-30 border-b border-white/10 bg-[color:var(--app-shell)] px-3 text-white shadow-[var(--shadow-soft)] lg:px-8",
        compactMobile ? "py-2 sm:py-3" : "py-2.5 sm:py-3",
      )}
      style={{ backgroundColor: "var(--app-shell)" }}
    >
      <div className={cn("mx-auto max-w-7xl", compactMobile ? "space-y-2 sm:space-y-3" : "space-y-3")}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "grid shrink-0 place-items-center rounded-lg bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-[var(--shadow-tight)]",
                compactMobile ? "h-9 w-9 sm:h-[44px] sm:w-[44px]" : "h-[44px] w-[44px]",
              )}
            >
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-base font-semibold tracking-tight">Clinical Guide</p>
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
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-white/15 bg-white/7 text-slate-100 transition hover:bg-white/12"
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
              : "sm:grid-cols-[minmax(0,1fr)_136px] lg:grid-cols-[minmax(0,1fr)_148px]",
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
                "w-full rounded-lg border border-white/15 bg-white/95 pl-12 pr-12 font-semibold text-slate-950 shadow-inner outline-none transition placeholder:text-slate-500 focus:border-[color:var(--focus)] focus:ring-4 focus:ring-teal-300/30 dark:bg-slate-950/95 dark:text-slate-50 dark:placeholder:text-slate-500",
                compactMobile ? "h-12 text-sm sm:h-14 sm:text-base" : "h-14 text-base",
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
            title={query.trim().length < 2 ? "Enter at least two characters to ask" : "Generate a source-backed answer"}
            className={cn(primaryControl, compactMobile ? "h-12 rounded-lg px-3 sm:h-14 sm:px-5" : "h-14 rounded-lg")}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="sm:hidden">Ask</span>
            <span className="hidden sm:inline">{query.trim().length < 2 ? "Ask" : "Answer"}</span>
          </button>
          {hasAnswer && (
            <details className="relative sm:hidden">
              <summary
                className="grid h-12 w-[44px] cursor-pointer list-none place-items-center rounded-lg border border-white/10 bg-white/7 text-slate-100 transition hover:bg-white/12"
                aria-label="Open document scope and prompt controls"
              >
                <Filter className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[calc(100vw-1.5rem)] max-w-sm rounded-lg border border-white/10 bg-[color:var(--app-shell)] p-2 shadow-[var(--shadow-soft)]">
                <div className="mb-2 flex min-h-8 items-center justify-between px-1 text-xs font-semibold text-slate-300">
                  <span>Scope & prompts</span>
                  {selectedDocumentIds.length > 0 && <span>{selectedDocumentIds.length} scoped</span>}
                </div>
                {renderScopeAndPromptRows()}
              </div>
            </details>
          )}
        </form>

        {!hasAnswer ? (
          <div>{renderScopeAndPromptRows()}</div>
        ) : (
          <details className="hidden rounded-lg border border-white/10 bg-white/5 sm:block">
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
            <div className="border-t border-white/10 p-2">
              {renderScopeAndPromptRows()}
            </div>
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
    <button type="button" onClick={onClick} aria-label={ariaLabel ?? label} className={cn(secondaryControl, "px-3 text-xs")}>
      {copied ? <ClipboardCheck className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      <span className="sm:hidden">{copied ? "Copied" : shortLabel ?? label}</span>
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
          className={cn(secondaryControl, "px-3 text-xs")}
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
        className={cn(secondaryControl, "px-3 text-xs")}
        aria-label={`Search only ${sourceTitle}`}
      >
        <Filter className="h-4 w-4" />
        <span className="sm:hidden">This doc</span>
        <span className="hidden sm:inline">Search this document</span>
      </button>
      {imageCount > 0 && (
        <span className="inline-flex min-h-[44px] items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)]">
          {imageCount} indexed image{imageCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function BestSourceJumpStrip({
  source,
  grounded,
}: {
  source: BestSourceRecommendation | null | undefined;
  grounded: boolean;
}) {
  if (!source) return null;

  const label = grounded ? "Top source" : "Closest source";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--primary)]/20 bg-[color:var(--surface)] px-2.5 py-2 shadow-[var(--shadow-tight)] sm:mt-4 sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)] sm:h-8 sm:w-8">
          <Target className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">{label}</p>
          <p className="truncate text-[13px] font-semibold text-[color:var(--text)] sm:text-sm">
            {formatCompactCitationLabel(source)}
          </p>
        </div>
      </div>
      <Link
        href={source.viewer_href}
        className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg bg-[color:var(--primary)] px-3 text-xs font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[color:var(--primary-strong)]"
        aria-label={`Open best source: ${formatCitationLabel(source)}`}
      >
        Open
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
    <article className="rounded-lg border border-[color:var(--primary)]/25 bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)] sm:h-9 sm:w-9">
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
        <div className="flex shrink-0 items-center gap-2">
          <StrengthBadge strength={source.source_strength} />
          <span className="inline-flex min-h-7 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-xs font-semibold text-[color:var(--text-muted)]">
            {score}% match
          </span>
        </div>
      </div>

      <p className="mt-2 line-clamp-3 text-[15px] font-medium leading-6 text-[color:var(--text)] sm:mt-3 sm:line-clamp-4">
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
  if (quotes.length === 0) return null;

  return (
    <section id="quotes" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
      <SectionHeading
        icon={Quote}
        title="Source quotes"
        description="Verbatim excerpts linked to the source PDF and page."
        hideDescriptionOnMobile
        compactMobile
        action={<CopyButton label="Copy exact quotes" shortLabel="Quotes" copied={copiedQuotes} onClick={onCopyQuotes} />}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {quotes.map((quote, index) => (
          <article
            key={`${quote.chunk_id}:${quote.quote}`}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-tight)] sm:p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-xs font-bold text-[color:var(--primary)] sm:h-8 sm:w-8">
                {index + 1}
              </span>
              <StrengthBadge strength={quote.source_strength} />
            </div>
            <blockquote className="text-[15px] font-medium leading-6 text-[color:var(--text)]">
              &ldquo;{quote.quote}&rdquo;
            </blockquote>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 sm:mt-4 sm:gap-3">
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
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
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
          <CopyButton
            label="Copy ward note"
            shortLabel="Ward note"
            copied={copiedWardNote}
            onClick={onCopyWardNote}
          />
          <p className={cn("text-[15px] leading-6", textMuted)}>
            Review before pasting into the medical record.
          </p>
          {sections.map((section) => (
            <article key={section.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
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
          action={<CopyButton label="Copy ward note" copied={copiedWardNote} onClick={onCopyWardNote} />}
        />
        <p className={cn("mt-3 text-[15px] leading-6", textMuted)}>
          Review before pasting into the medical record.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sections.map((section) => (
            <article key={section.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
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
  if (evidence.length === 0) return null;

  return (
    <section id="images" className="space-y-3 scroll-mt-4 sm:scroll-mt-6">
      <SectionHeading
        icon={FileImage}
        title="Source diagrams"
        description="Diagrams and images extracted from indexed source documents."
        hideDescriptionOnMobile
        compactMobile
      />
      <div className="grid gap-3 md:grid-cols-2">
        {evidence.map((item) => (
          <figure key={item.id} className={cn(panel, "overflow-hidden p-2.5 sm:p-3")}>
            <div className="rounded-lg bg-[color:var(--surface-inset)] p-2.5 sm:p-3">
              <SourceImage endpoint={item.signed_url_endpoint} caption={item.caption} />
            </div>
            <figcaption className="mt-2 text-[15px] leading-6 text-[color:var(--text)] sm:mt-3">{item.caption}</figcaption>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 text-xs sm:mt-3 sm:gap-3">
              <span className={cn("text-[15px] font-semibold leading-6 sm:hidden", textMuted)}>
                {formatCompactCitationLabel(item)}
              </span>
              <span className={cn("hidden text-xs font-semibold leading-5 sm:inline", textMuted)}>
                {item.title}, page {item.page_number ?? "n/a"}
              </span>
              <Link href={item.viewer_href} className={cn(secondaryControl, "min-h-[44px] px-4 text-xs")}>
                <ExternalLink className="h-4 w-4" />
                Open PDF
              </Link>
            </div>
          </figure>
        ))}
      </div>
    </section>
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
    return <EmptyState icon={FileText} title="No source passages yet" body="Ask a question to populate the source list." />;
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <article key={source.id} className={cn(panelSubtle, "p-3 sm:p-4")}>
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
          <p className={cn("mt-2 line-clamp-3 text-[15px] leading-6 sm:mt-3 sm:line-clamp-4", textMuted)}>{source.content}</p>
        </article>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4 text-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--text-muted)]">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[color:var(--text)]">{title}</p>
          <p className={cn("mt-1 leading-6", textMuted)}>{body}</p>
        </div>
      </div>
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
        <div className="mt-4 flex min-h-[60px] items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
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
    const haystack = `${document.title} ${document.file_name}`.toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Find a document"
          className="h-[44px] w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-9 pr-3 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-teal-300/20"
        />
      </label>
      <div className="divide-y divide-[color:var(--border)] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={documents.length === 0 ? "No indexed documents" : "No matching documents"}
            body={documents.length === 0 ? "Upload a guideline to start indexing." : "Try another document title or file name."}
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
                  <p className="mt-1 text-[15px] leading-6 text-[color:var(--warning)]">
                    Review date not provided.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={document.status} />
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
}: {
  onUploaded: () => void;
  demoMode: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoMode) {
      setStatus(
        "Demo mode is serving seeded documents. Configure .env.local, run supabase/schema.sql, and start npm run worker to upload real files.",
      );
      return;
    }

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus("Choose a PDF, DOCX, XLSX, or TXT file first.");
      return;
    }

    setUploading(true);
    setStatus("Uploading private document to Supabase Storage...");
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed");
      setStatus("Queued for local worker ingestion.");
      event.currentTarget.reset();
      onUploaded();
    } catch (error) {
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
          disabled={demoMode}
          className="h-[44px] w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-teal-300/20 disabled:bg-[color:var(--surface-subtle)] disabled:text-[color:var(--disabled)]"
        />
      </label>
      <label className="block">
        <span className={fieldLabel}>Guideline file required</span>
        <input
          ref={fileRef}
          name="file"
          type="file"
          accept=".pdf,.docx,.xlsx,.txt,application/pdf,text/plain"
          disabled={demoMode}
          className="block min-h-[44px] w-full cursor-pointer rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] px-3 py-2 text-sm text-[color:var(--text-muted)] file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-[color:var(--app-shell)] file:px-3 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:file:bg-slate-100 dark:file:text-slate-950"
        />
      </label>
      <button type="submit" disabled={uploading} className={cn(secondaryControl, "w-full")}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        Queue document
      </button>
      {(status || demoMode) && (
        <p
          className={cn(
            "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 text-xs font-medium leading-5",
            textMuted,
          )}
        >
          {status || "Demo mode is read-only. Configure Supabase, OpenAI, and the local worker before uploading private guideline files."}
        </p>
      )}
    </form>
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
    return "border-[color:var(--success)]/30 bg-[color:var(--success-soft)] text-[color:var(--success)]";
  }
  if (status === "needs_setup") {
    return "border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
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
          <div
            key={item.id}
            className="min-h-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
          >
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
        Setup status is read-only and never exposes secret values. Worker status is inferred from recent ingestion activity.
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
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className={cn("group", panel, className)}>
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-subtle)] text-[color:var(--primary)]">
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
      {open && <div className="border-t border-[color:var(--border)] p-4">{children}</div>}
    </details>
  );
}

export function ClinicalDashboard() {
  const mainRef = useRef<HTMLElement>(null);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [setupChecks, setSetupChecks] = useState<SetupCheck[]>(fallbackSetupChecks);
  const [demoMode, setDemoMode] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [activeHash, setActiveHash] = useState("#search");
  const { theme, toggleTheme } = useTheme();

  async function refresh() {
    const [documentsResponse, jobsResponse, setupResponse] = await Promise.all([
      fetch("/api/documents"),
      fetch("/api/jobs"),
      fetch("/api/setup-status"),
    ]);

    if (documentsResponse.ok) {
      const payload = await documentsResponse.json();
      setDocuments(payload.documents ?? []);
      if (payload.demoMode) setDemoMode(true);
      if (payload.setupRequired) setSetupWarning(payload.error);
    }

    if (jobsResponse.ok) {
      const payload = await jobsResponse.json();
      setJobs(payload.jobs ?? []);
      if (payload.demoMode) setDemoMode(true);
      if (payload.setupRequired) setSetupWarning(payload.error);
    }

    if (setupResponse.ok) {
      const payload = await setupResponse.json();
      setSetupChecks(payload.checks ?? fallbackSetupChecks);
      if (payload.demoMode) setDemoMode(true);
    }
  }

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
  }, [demoMode]);

  useEffect(() => {
    const updateHash = () => {
      const nextHash = normalizeNavigationHash(window.location.hash || "#search");
      setActiveHash(nextHash);
      window.requestAnimationFrame(() => navigateMobileSection(nextHash, { updateHistory: false }));
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  async function ask() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Answer generation failed");
      setAnswer(payload);
      setSources(payload.sources ?? []);
      if (payload.demoMode) setDemoMode(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Answer generation failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleDocumentScope(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
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

  function navigateMobileSection(
    href: string,
    options: { updateHistory?: boolean } = {},
  ) {
    const shouldUpdateHistory = options.updateHistory ?? true;
    setActiveHash(href);
    const main = mainRef.current;
    if (!main) return;

    if (href === "#search") {
      main.scrollTo({ top: 0, behavior: "auto" });
      if (shouldUpdateHistory) window.history.replaceState(null, "", href);
      return;
    }

    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    const mainTop = main.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    main.scrollTo({
      top: main.scrollTop + targetTop - mainTop - 8,
      behavior: "auto",
    });
    if (shouldUpdateHistory) window.history.replaceState(null, "", href);
  }

  function syncActiveSectionFromScroll() {
    const main = mainRef.current;
    if (!main) return;

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

  const visualEvidence = useMemo(
    () => answer?.visualEvidence ?? answer?.smartPanel?.visualEvidence ?? [],
    [answer],
  );
  const bestSource = answer?.bestSource ?? answer?.smartPanel?.bestSource ?? null;
  const sourceSummary = answer?.evidenceSummary ?? answer?.smartPanel?.evidenceSummary;
  const gaps = answer?.conflictsOrGaps ?? answer?.smartPanel?.conflictsOrGaps ?? [];
  const showSystemNotice = demoMode || setupWarning;
  const renderSystemNotice = (className?: string) => (
    <UtilityDrawer
      icon={AlertCircle}
      title={demoMode ? "Demo mode" : "Setup required"}
      summary={demoMode ? "Synthetic data only; not clinical guidance." : "Configuration is needed before real uploads."}
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[color:var(--background)] text-[color:var(--text)] lg:block lg:h-auto lg:min-h-screen lg:overflow-x-clip lg:overflow-y-visible">
      <MasterSearchHeader
        documents={documents}
        query={query}
        loading={loading}
        selectedDocumentIds={selectedDocumentIds}
        hasAnswer={Boolean(answer)}
        demoMode={demoMode}
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
        onScroll={syncActiveSectionFromScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-6 sm:space-y-5 sm:px-4 sm:py-5 sm:pb-8 lg:px-8">
        {showSystemNotice && (!answer ? renderSystemNotice() : renderSystemNotice("hidden sm:block"))}

        <section className={cn(panel, "overflow-hidden")}>
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 sm:p-5">
            <SectionHeading
              icon={Search}
              title="Answer"
              description="Sourced synthesis with quotes, PDFs, and indexed diagrams."
              hideDescriptionOnMobile
              compactMobile
              action={
                answer ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {bestSource && (
                      <Link
                        href={bestSource.viewer_href}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[color:var(--primary)]/30 bg-[color:var(--primary-soft)] px-3 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--surface)]"
                        aria-label={`Open best source: ${formatCitationLabel(bestSource)}`}
                      >
                        <Target className="h-3.5 w-3.5" />
                        Top source
                      </Link>
                    )}
                    {answer.grounded ? (
                      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[color:var(--success)]/30 bg-[color:var(--success-soft)] px-2.5 text-xs font-semibold text-[color:var(--success)]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Source-backed
                      </span>
                    ) : (
                      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-2.5 text-xs font-semibold text-[color:var(--warning)]">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Insufficient
                      </span>
                    )}
                  </div>
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

            {loading && !answer ? (
              <AnswerSkeleton />
            ) : answer ? (
              <div className="space-y-4 sm:space-y-5">
                <div className="rounded-lg border border-[color:var(--border)] border-l-4 border-l-[color:var(--primary)] bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-tight)] sm:p-4">
                  <p className="whitespace-pre-wrap text-[15px] font-medium leading-6 text-[color:var(--text)] sm:leading-7">
                    {answer.answer}
                  </p>
                  <BestSourceJumpStrip
                    source={bestSource}
                    grounded={answer.grounded && answer.confidence !== "unsupported"}
                  />
                </div>

                <BestSourceCard
                  source={bestSource}
                  grounded={answer.grounded && answer.confidence !== "unsupported"}
                  onScopeDocument={scopeOnlyDocument}
                />

                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    label="Copy answer with citations"
                    shortLabel="Copy"
                    copied={copiedAction === "answer"}
                    onClick={() => copyText("answer", formatAnswerForClipboard(answer))}
                  />
                  <CopyButton
                    label="Copy ward note"
                    shortLabel="Ward note"
                    copied={copiedAction === "ward-note"}
                    onClick={() => copyText("ward-note", formatWardNote(answer, demoMode))}
                  />
                </div>
                <p className={cn("text-[15px] leading-6", textMuted)}>
                  Review before pasting into the medical record.
                </p>

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
                  <p className={cn("text-[13px] font-semibold leading-5 sm:text-xs", textMuted)}>
                    {sourceSummary.document_count} documents · {sourceSummary.quote_count} exact quotes · {sourceSummary.image_count} indexed images
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

        <QuoteCards
          quotes={answer?.quoteCards ?? []}
          copiedQuotes={copiedAction === "quotes"}
          onCopyQuotes={() => copyText("quotes", formatQuotesForClipboard(answer?.quoteCards ?? []))}
          onFollowUp={followUpFromQuote}
          onScopeDocument={scopeOnlyDocument}
        />
        <VisualEvidenceStrip evidence={visualEvidence} />
        {answer && (
          <ClinicalOutputPanel
            answer={answer}
            copiedWardNote={copiedAction === "ward-note-panel"}
            onCopyWardNote={() => copyText("ward-note-panel", formatWardNote(answer, demoMode))}
          />
        )}

        <section id="sources" className="grid gap-3 scroll-mt-4 sm:scroll-mt-6">
          {answer?.answerSections?.length ? (
            <UtilityDrawer
              icon={ListChecks}
              title="Answer details"
              summary={`${answer.answerSections.length} sourced detail sections`}
              mobileSummary={`${answer.answerSections.length} details`}
            >
              <div className="grid gap-3 md:grid-cols-3">
                {answer.answerSections.map((section) => (
                  <article key={`${section.heading}:${section.citation_chunk_ids.join(",")}`} className={cn(panelSubtle, "p-4")}>
                    <h2 className="text-sm font-semibold text-[color:var(--text)]">{section.heading}</h2>
                    <p className={cn("mt-2 text-[15px] leading-6", textMuted)}>{section.body}</p>
                  </article>
                ))}
              </div>
            </UtilityDrawer>
          ) : null}

          <UtilityDrawer
            icon={FileText}
            title="Source passages"
            summary={sources.length ? `${sources.length} retrieved passages` : "Retrieved passages appear after a question."}
            mobileSummary={sources.length ? `${sources.length} passages` : "No passages yet"}
          >
            <SourceList sources={sources} onScopeDocument={scopeOnlyDocument} />
          </UtilityDrawer>

          <UtilityDrawer
            icon={BookOpen}
            title="Documents"
            summary={documents.length ? `${documents.length} indexed documents available` : "No indexed documents yet."}
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
                        {document.source_count} chunks · {document.quote_count} quotes · pages {document.pages.join(", ") || "n/a"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Filter} title="No retrieval details yet" body="Ask a question to inspect source coverage and gaps." />
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
                <SetupChecklist checks={setupChecks} />
                <UploadPanel onUploaded={refresh} demoMode={demoMode} />
              </div>
              <div className="space-y-3">
                {jobs.length === 0 ? (
                  <EmptyState icon={UploadCloud} title="No ingestion jobs" body="Queued uploads and worker progress appear here." />
                ) : (
                  jobs.slice(0, 6).map((job) => (
                    <div key={job.id} className={cn(panelSubtle, "p-3")}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-[color:var(--text)]">{job.stage}</p>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--surface-inset)]">
                        <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${job.progress}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </UtilityDrawer>
        </section>
        </div>
      </main>

      <nav className="z-30 grid shrink-0 select-none grid-cols-4 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-soft)] lg:hidden">
        {[
          ["Answer", Search, "#search"],
          ["Quotes", Quote, "#quotes"],
          ["Images", FileImage, "#images"],
          ["Sources", FileText, "#sources"],
        ].map(([label, Icon, href]) => (
          <a
            key={label as string}
            href={href as string}
            aria-current={activeHash === href ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigateMobileSection(href as string);
            }}
            className={cn(
              "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--primary)]",
              activeHash === href && "bg-[color:var(--primary-soft)] text-[color:var(--primary)]",
            )}
          >
            <Icon className="h-5 w-5" />
            {label as string}
          </a>
        ))}
      </nav>
    </div>
  );
}
