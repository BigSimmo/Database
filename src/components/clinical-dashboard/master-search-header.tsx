"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BookOpen,
  ChevronDown,
  CheckCircle2,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  Moon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import {
  cn,
  commandInput,
  floatingControl,
  premiumHeaderSurface,
  primaryControl,
  shellChip,
  eyebrowText,
} from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { type ResolvedTheme } from "@/lib/theme";
import type { ClinicalDocument, ClinicalQueryMode } from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { tagSearchText } from "@/lib/document-tags";

const mobileSheetMediaQuery = "(max-width: 639px)";

function splitFilterText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function filterText(values?: string[]) {
  return (values ?? []).join(", ");
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

export function MasterSearchHeader({
  documents,
  query,
  searchMode,
  loading,
  selectedDocumentIds,
  queryMode,
  scopeFilters,
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
  onScopeOpenChange,
  onOpenGuide,
  onToggleTheme,
  queryModeOptions,
}: {
  documents: ClinicalDocument[];
  query: string;
  searchMode: "answer" | "documents";
  loading: boolean;
  selectedDocumentIds: string[];
  queryMode: ClinicalQueryMode;
  scopeFilters: SearchScopeFilters;
  hasAnswer: boolean;
  demoMode: boolean;
  realDataReady: boolean;
  theme: ResolvedTheme;
  onQueryChange: (query: string) => void;
  onSearchModeChange: (mode: "answer" | "documents") => void;
  onAsk: () => void;
  onClearQuery: () => void;
  onClearScope: () => void;
  onQueryModeChange: (mode: ClinicalQueryMode) => void;
  onScopeFiltersChange: (filters: SearchScopeFilters) => void;
  onToggleScope: (documentId: string) => void;
  onScopeOpenChange?: (open: boolean) => void;
  onOpenGuide: () => void;
  onToggleTheme: () => void;
  queryModeOptions: Array<{ value: ClinicalQueryMode; label: string }>;
}) {
  const trimmedQuery = query.trim();
  const canAsk = trimmedQuery.length >= 1 && !loading && realDataReady;
  const compactMobile = hasAnswer;
  const [scopeFilter, setScopeFilter] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [usesScopeSheet, setUsesScopeSheet] = useState(false);
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
    ? Math.max(0, selectedDocuments.length ? documents.length - selectedDocumentIds.length : documents.length)
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
    const mediaQuery = window.matchMedia(mobileSheetMediaQuery);
    const sync = () => setUsesScopeSheet(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    onScopeOpenChange?.(scopeOpen || scopeSheetOpen);
  }, [onScopeOpenChange, scopeOpen, scopeSheetOpen]);

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

  function renderScopeRows() {
    return (
      <div className="grid gap-3">
        <section className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 sm:hidden">
          <div className="mb-2 flex min-h-7 items-center justify-between gap-2 px-0.5">
            <p className={eyebrowText}>Refine search</p>
            <span className="text-[11px] font-semibold text-[color:var(--text-soft)]">Mode, status, topics</span>
          </div>
          <div className="grid gap-2">
            <select
              value={queryMode}
              onChange={(event) => onQueryModeChange(event.target.value as ClinicalQueryMode)}
              aria-label="Clinical query mode"
              className="h-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
            >
              {queryModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={filterText(scopeFilters.medications)}
                onChange={(event) =>
                  onScopeFiltersChange({ ...scopeFilters, medications: splitFilterText(event.target.value) })
                }
                placeholder="Medication"
                className="h-10 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
              />
              <input
                value={filterText(scopeFilters.topics)}
                onChange={(event) =>
                  onScopeFiltersChange({ ...scopeFilters, topics: splitFilterText(event.target.value) })
                }
                placeholder="Topic"
                className="h-10 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
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
                className="h-10 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
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
                className="h-10 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
              >
                <option value="">Any locality</option>
                <option value="local">Local only</option>
                <option value="non_local">Non-local only</option>
              </select>
            </div>
            <input
              value={filterText(scopeFilters.collections)}
              onChange={(event) =>
                onScopeFiltersChange({ ...scopeFilters, collections: splitFilterText(event.target.value) })
              }
              placeholder={collectionOptions.length ? `Collection: ${collectionOptions[0]}` : "Collection"}
              className="h-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
            />
            <button
              type="button"
              onClick={() => onScopeFiltersChange({})}
              className={cn(floatingControl, "min-h-9 px-3 text-xs")}
            >
              Clear refine filters
            </button>
          </div>
        </section>
        <section className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
          <div className="mb-2 flex min-h-7 items-center justify-between gap-2 px-0.5">
            <p className={eyebrowText}>Document scope</p>
            <span className="nums shrink-0 text-[11px] font-semibold text-[color:var(--text-soft)]">
              {selectedDocumentIds.length ? `${selectedDocumentIds.length} selected` : `${documents.length} available`}
            </span>
          </div>
          <div className="space-y-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]" />
              <input
                ref={scopeFilterInputRef}
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value)}
                data-testid="document-scope-filter"
                aria-label="Filter document scope"
                placeholder="Filter documents by title or file"
                className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] pl-9 pr-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClearScope}
                className={cn(
                  shellChip,
                  selectedDocumentIds.length === 0
                    ? "border-[color:var(--primary)]/40 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                All documents
              </button>
              {scopeFilter ? (
                <span className="nums rounded-md bg-[color:var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)]">
                  {matchingDocuments.length} match{matchingDocuments.length === 1 ? "" : "es"}
                </span>
              ) : (
                <span className="rounded-md bg-[color:var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)]">
                  Recently updated first
                </span>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto pr-1 polished-scroll">
              <div className="grid gap-1.5">
                {requireScopeFilter && visibleScopeDocuments.length === 0 ? (
                  <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm font-medium text-[color:var(--text-muted)]">
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
                          ? "border-[color:var(--primary)]/40 bg-[color:var(--primary-soft)] text-[color:var(--primary-strong)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-md border",
                          selected
                            ? "border-[color:var(--primary)]/50 bg-[color:var(--primary-soft)] text-[color:var(--primary)]"
                            : "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]",
                        )}
                        aria-hidden
                      >
                        {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{documentScopeTitle(document)}</span>
                        <span className="nums block truncate text-[11px] font-medium text-[color:var(--text-soft)]">
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
                        <span className="rounded-md bg-[color:var(--primary-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--primary-strong)]">
                          In scope
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {!requireScopeFilter && visibleScopeDocuments.length === 0 ? (
                  <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 py-2 text-sm font-medium text-[color:var(--text-muted)]">
                    No documents match that filter. Clear the filter or search by file name.
                  </p>
                ) : null}
              </div>
            </div>
            {hiddenScopeMatchCount > 0 ? (
              <p className="nums px-1 text-xs font-medium text-[color:var(--text-soft)]">
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
        "sticky top-0 z-30 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 lg:px-8",
        premiumHeaderSurface,
        "sm:py-2.5",
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
              <ListChecks className="h-5 w-5" />
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
            <Link
              href="/tools"
              aria-label="Open clinical tools"
              title="Open clinical tools"
              className="group relative grid h-[44px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-lg border border-cyan-100/20 bg-cyan-100/[0.08] text-cyan-50 shadow-[inset_0_1px_0_rgb(255_255_255_/_12%),var(--shadow-tight)] transition hover:-translate-y-0.5 hover:border-cyan-100/35 hover:bg-cyan-100/[0.13] hover:text-white"
            >
              <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-transparent" />
              <Sparkles className="relative h-4.5 w-4.5" />
              <span className="sr-only">Clinical tools</span>
            </Link>
            <button
              type="button"
              onClick={onOpenGuide}
              className="hidden h-[44px] shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/7 px-3 text-xs font-semibold text-slate-100 shadow-[var(--shadow-tight)] transition hover:border-white/25 hover:bg-white/12 sm:inline-flex"
              aria-label="Open user guide"
            >
              <BookOpen className="h-4 w-4" />
              <span>Guide</span>
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

        <div className="grid gap-2 rounded-[var(--radius-lg)] border border-white/10 bg-white/6 p-1 shadow-[var(--shadow-inset)] sm:flex sm:flex-wrap sm:items-center sm:justify-between">
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
            <details className="group relative">
              <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-white/15 bg-white/7 px-3 text-xs font-semibold text-slate-100">
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                Refine
                <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 grid w-[min(42rem,calc(100vw-2rem))] gap-2 rounded-lg border border-white/15 bg-[color:var(--surface-glass)] p-3 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-3">
                <select
                  value={queryMode}
                  onChange={(event) => onQueryModeChange(event.target.value as ClinicalQueryMode)}
                  aria-label="Clinical query mode"
                  className="h-9 rounded-md border border-white/15 bg-white/95 px-2 text-xs font-semibold text-slate-950 outline-none dark:bg-slate-950/90 dark:text-slate-50"
                >
                  {queryModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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

        <form
          onSubmit={submit}
          className="grid grid-cols-[minmax(0,1fr)_52px_52px] gap-2 sm:grid-cols-[minmax(0,1fr)_136px_108px] lg:grid-cols-[minmax(0,1fr)_148px_116px]"
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
              placeholder="Ask a question"
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
                ? "Search setup not ready"
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
              "min-h-[44px] whitespace-nowrap rounded-[var(--radius-lg)] px-0 text-sm sm:px-5",
            )}
            aria-label={searchMode === "answer" ? "Generate source-backed answer" : "Find matching documents"}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only">{submitLabel}</span>
          </button>
          <>
            <button
              type="button"
              data-testid="scope-trigger"
              onClick={() => setScopeSheetOpen(true)}
              className="flex min-h-[44px] cursor-pointer list-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-lg)] border border-white/15 bg-white/7 px-0 text-sm font-semibold text-slate-100 shadow-[var(--shadow-tight)] transition motion-safe:duration-150 hover:border-white/25 hover:bg-white/12 sm:hidden"
              aria-label={usesScopeSheet ? "Open document scope" : "Open mobile document scope"}
              aria-expanded={scopeSheetOpen}
            >
              <Filter className="h-4 w-4" />
              <span className="sr-only">Scope</span>
              {selectedDocumentIds.length ? (
                <span className="rounded-md bg-teal-200/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-50">
                  {selectedDocumentIds.length}
                </span>
              ) : null}
            </button>

            <details
              ref={scopeDetailsRef}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setScopeOpen(open);
                if (open) window.setTimeout(() => scopeFilterInputRef.current?.focus(), 0);
              }}
              className="group relative hidden sm:block"
            >
              <summary
                ref={scopeSummaryRef}
                data-testid="scope-trigger"
                className="flex min-h-[44px] cursor-pointer list-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-lg)] border border-white/15 bg-white/7 px-0 text-sm font-semibold text-slate-100 shadow-[var(--shadow-tight)] transition motion-safe:duration-150 hover:border-white/25 hover:bg-white/12 sm:gap-2 sm:px-3 sm:text-xs"
                aria-label={usesScopeSheet ? "Open desktop document scope" : "Open document scope"}
                aria-expanded={scopeOpen}
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Scope</span>
                {selectedDocumentIds.length ? (
                  <span className="rounded-md bg-teal-200/15 px-1.5 py-0.5 text-[10px] font-bold text-teal-50">
                    {selectedDocumentIds.length}
                  </span>
                ) : null}
              </summary>
              <div
                data-testid={usesScopeSheet ? undefined : "scope-command-popover"}
                className="polished-scroll absolute right-0 top-[calc(100%+0.5rem)] z-40 max-h-[min(70dvh,28rem)] w-[28rem] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-2.5 pb-2.5 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl motion-safe:animate-pop-in"
              >
                <div className="mb-2 flex min-h-8 items-center justify-between px-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  <span>Document scope</span>
                  <span className="nums">{scopeSummary}</span>
                </div>
                {scopePreview ? (
                  <p className="mb-2 truncate px-1 text-xs text-[color:var(--text-soft)]">{scopePreview}</p>
                ) : null}
                {renderScopeRows()}
              </div>
            </details>

            <Sheet
              open={scopeSheetOpen}
              onClose={() => setScopeSheetOpen(false)}
              title="Document scope"
              description="Choose documents and filters for the next search."
              closeLabel="Close document scope"
              initialFocusRef={scopeFilterInputRef}
              contentClassName="sm:hidden"
            >
              <div
                data-testid={usesScopeSheet ? "scope-command-popover" : undefined}
                className="polished-scroll max-h-[min(70dvh,28rem)] overflow-y-auto overscroll-contain pr-1"
              >
                <div className="mb-2 flex min-h-8 items-center justify-between px-1 text-xs font-semibold text-[color:var(--text-muted)]">
                  <span>Document scope</span>
                  <span className="nums">{scopeSummary}</span>
                </div>
                {scopePreview ? (
                  <p className="mb-2 truncate px-1 text-xs text-[color:var(--text-soft)]">{scopePreview}</p>
                ) : null}
                {renderScopeRows()}
              </div>
            </Sheet>
          </>
        </form>
      </div>
    </header>
  );
}
