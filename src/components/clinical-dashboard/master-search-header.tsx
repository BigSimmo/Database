"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";

import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe2,
  Heart,
  ListChecks,
  Loader2,
  Menu,
  Mic,
  Moon,
  Pill,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
  Lock,
  Wrench,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import {
  ModeActionPopup,
  modeActionItemsFor,
  type ModeActionId,
  type ModeActionItem,
  type ModeActionSetId,
} from "@/components/clinical-dashboard/mode-action-popup";
import {
  cn,
  chatComposerIconButton,
  chatComposerInput,
  chatComposerShell,
  chatSendButton,
  floatingControl,
  shellChip,
  eyebrowText,
} from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import {
  appModeDefinition,
  appModeDefinitions,
  appModeSearchConfig,
  isSearchableAppMode,
  visibleAppModeDefinitions,
  type AppModeId,
} from "@/lib/app-modes";
import { type ResolvedTheme } from "@/lib/theme";
import type { ClinicalDocument, ClinicalQueryMode } from "@/lib/types";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { tagSearchText } from "@/lib/document-tags";

const mobileSheetMediaQuery = "(max-width: 639px)";

const visibleAppModeOptions = visibleAppModeDefinitions();
const appModeIcons: Record<AppModeId, typeof Search> = {
  answer: Sparkles,
  documents: FileText,
  prescribing: Pill,
  evidence: ListChecks,
  favourites: Heart,
  tools: Wrench,
};

const medicationModeActionItems: readonly ModeActionItem[] = [
  {
    id: "medication-dose",
    label: "Dose",
    description: "Check dosing and thresholds",
    icon: CalendarDays,
    primary: true,
  },
  { id: "medication-safety", label: "Safety", description: "Contraindications and cautions", icon: ShieldCheck },
  {
    id: "medication-monitoring",
    label: "Monitoring",
    shortLabel: "Monitor",
    description: "Baseline and ongoing checks",
    icon: Activity,
  },
  { id: "medication-access", label: "Access", description: "Documentation and eligibility", icon: Lock },
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

type HeaderIdentity = {
  displayName: string;
  initials: string;
  detail: string;
  signedIn: boolean;
};

export function MasterSearchHeader({
  documents,
  documentTotal,
  query,
  searchMode,
  loading,
  selectedDocumentIds,
  queryMode,
  scopeFilters,
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
  onOpenUpload,
  onOpenEvidence,
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenSourcePdf,
  onNewChat,
  onOpenMobileSidebar,
  onOpenSettings,
  identity,
  onToggleTheme,
  queryModeOptions,
  scopeVariant = "full",
  queryInputRef,
  queryInputAutoFocus = false,
  modeAlignment = "default",
}: {
  documents: ClinicalDocument[];
  documentTotal?: number;
  query: string;
  searchMode: AppModeId;
  loading: boolean;
  selectedDocumentIds: string[];
  queryMode: ClinicalQueryMode;
  scopeFilters: SearchScopeFilters;
  realDataReady: boolean;
  theme: ResolvedTheme;
  onQueryChange: (query: string) => void;
  onSearchModeChange: (mode: AppModeId) => void;
  onAsk: () => void;
  onClearQuery: () => void;
  onClearScope: () => void;
  onQueryModeChange: (mode: ClinicalQueryMode) => void;
  onScopeFiltersChange: (filters: SearchScopeFilters) => void;
  onToggleScope: (documentId: string) => void;
  onScopeOpenChange?: (open: boolean) => void;
  onOpenUpload?: () => void;
  onOpenEvidence?: () => void;
  onOpenRecentDocuments?: () => void;
  onOpenLibrary?: () => void;
  onOpenSourcePdf?: () => void;
  onNewChat?: () => void;
  onOpenMobileSidebar?: () => void;
  onOpenSettings: () => void;
  identity: HeaderIdentity;
  onToggleTheme: () => void;
  queryModeOptions: Array<{ value: ClinicalQueryMode; label: string }>;
  scopeVariant?: "full" | "placeholder";
  queryInputRef?: Ref<HTMLInputElement>;
  queryInputAutoFocus?: boolean;
  modeAlignment?: "default" | "center";
}) {
  const trimmedQuery = query.trim();
  const selectedSearch = appModeSearchConfig(searchMode);
  const selectedAppMode = appModeDefinition(searchMode);
  const selectedSearchable = isSearchableAppMode(searchMode);
  const scopeIsPlaceholder = scopeVariant === "placeholder";
  const canRunLocalSearch = selectedSearch.kind === "favourites" || selectedSearch.kind === "tools";
  const canAsk = trimmedQuery.length >= 1 && !loading && selectedSearchable && (realDataReady || canRunLocalSearch);
  const indexedDocumentTotal = documentTotal ?? documents.length;
  const hasUnloadedDocuments = indexedDocumentTotal > documents.length;
  const loadedScopeSummary = hasUnloadedDocuments
    ? `${documents.length.toLocaleString()} loaded of ${indexedDocumentTotal.toLocaleString()}`
    : `${documents.length.toLocaleString()} available`;
  const [scopeFilter, setScopeFilter] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [usesScopeSheet, setUsesScopeSheet] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
  const submitLabel = trimmedQuery ? selectedSearch.submitBusyLabel : selectedSearch.submitIdleLabel;
  const queryPlaceholder = selectedSearch.placeholder;
  const SelectedAppModeIcon = appModeIcons[selectedAppMode.id];
  const actionMenuSetId: ModeActionSetId =
    searchMode === "documents" || searchMode === "evidence" ? "documents" : searchMode === "tools" ? "tools" : "answer";
  const actionMenuItems =
    searchMode === "prescribing" ? medicationModeActionItems : modeActionItemsFor(actionMenuSetId);
  const actionMenuTitle = selectedAppMode.label;
  const actionMenuButtonLabel = `Open ${selectedAppMode.label.toLowerCase()} options`;

  function currentUsesScopeSheet() {
    return window.matchMedia(mobileSheetMediaQuery).matches;
  }

  function openScopePicker() {
    setActionMenuOpen(false);
    setModeMenuOpen(false);
    const nextUsesScopeSheet = currentUsesScopeSheet();
    setUsesScopeSheet(nextUsesScopeSheet);
    if (nextUsesScopeSheet) {
      setScopeSheetOpen(true);
    } else {
      setScopeOpen(true);
      onScopeOpenChange?.(true);
      window.requestAnimationFrame(() => scopeFilterInputRef.current?.focus());
    }
  }

  function runModeAction(actionId: ModeActionId) {
    if (actionId === "medication-dose") {
      const medicationQuery = trimmedQuery || "acamprosate renal dose";
      onQueryModeChange("dose_threshold_lookup");
      onQueryChange(medicationQuery);
      return;
    }
    if (actionId === "medication-safety") {
      onQueryModeChange("contraindications_cautions");
      onQueryChange(trimmedQuery || "acamprosate contraindications");
      return;
    }
    if (actionId === "medication-monitoring") {
      onQueryModeChange("monitoring_schedule");
      onQueryChange(trimmedQuery || "acamprosate monitoring");
      return;
    }
    if (actionId === "medication-access") {
      onQueryModeChange("required_documentation");
      onQueryChange(trimmedQuery || "acamprosate PBS access");
      return;
    }

    if (actionId === "documents-search" || actionId === "answer-documents") {
      onSearchModeChange("documents");
      return;
    }
    if (actionId === "documents-upload") {
      onOpenUpload?.();
      return;
    }
    if (actionId === "documents-scope") {
      openScopePicker();
      return;
    }
    if (actionId === "answer-evidence") {
      onOpenEvidence?.();
      return;
    }
    if (actionId === "documents-tables") {
      onSearchModeChange("documents");
      onQueryChange(trimmedQuery || "table evidence");
      return;
    }
    if (actionId === "documents-recent") {
      onSearchModeChange("documents");
      onOpenRecentDocuments?.();
      return;
    }
    if (actionId === "documents-status" || actionId === "documents-collections") {
      onSearchModeChange("documents");
      onOpenLibrary?.();
      return;
    }
    if (actionId === "documents-viewer") {
      onSearchModeChange("documents");
      onOpenSourcePdf?.();
      return;
    }
    if (actionId === "answer-new" || actionId === "tools-new") {
      onNewChat?.();
      return;
    }
    if (actionId === "answer-clinical" || actionId === "favourites-answer") {
      onSearchModeChange("answer");
      return;
    }
    if (actionId === "tools-browse" || actionId === "favourites-tools") {
      onSearchModeChange("tools");
      return;
    }
    if (actionId === "tools-favourites" || actionId === "favourites-browse") {
      onSearchModeChange("favourites");
    }
  }

  function selectAppMode(mode: (typeof appModeDefinitions)[number]) {
    setModeMenuOpen(false);
    if (isSearchableAppMode(mode.id)) {
      onSearchModeChange(mode.id);
      return;
    }
    if ("href" in mode && mode.href) window.location.assign(mode.href);
  }

  const selectedModeIndex = Math.max(
    0,
    visibleAppModeOptions.findIndex((mode) => mode.id === selectedAppMode.id),
  );

  function focusModeOption(index: number) {
    const nextIndex = (index + visibleAppModeOptions.length) % visibleAppModeOptions.length;
    modeOptionRefs.current[nextIndex]?.focus();
  }

  function openModeMenuWithFocus(index: number) {
    setActionMenuOpen(false);
    closeScope(false);
    setModeMenuOpen(true);
    window.requestAnimationFrame(() => focusModeOption(index));
  }

  function handleModeTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openModeMenuWithFocus(selectedModeIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openModeMenuWithFocus(selectedModeIndex - 1);
    }
  }

  function handleModeOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModeOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusModeOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusModeOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusModeOption(visibleAppModeOptions.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setModeMenuOpen(false);
      window.requestAnimationFrame(() => modeButtonRef.current?.focus());
    }
  }

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

  const closeScopeSheet = useCallback(() => {
    setScopeSheetOpen(false);
    window.requestAnimationFrame(() => scopeSummaryRef.current?.focus());
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

  const dismissModeMenu = useCallback(() => setModeMenuOpen(false), []);
  function dismissScope(reason: "outside" | "escape") {
    closeScope(reason === "escape");
  }

  useDismissableLayer({
    enabled: modeMenuOpen,
    refs: [modeMenuRef],
    restoreFocusRef: modeButtonRef,
    onDismiss: dismissModeMenu,
  });

  useDismissableLayer({
    enabled: scopeOpen,
    refs: [scopeDetailsRef],
    restoreFocusRef: scopeSummaryRef,
    onDismiss: dismissScope,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMenuOpen(false);
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
              {selectedDocumentIds.length ? `${selectedDocumentIds.length} selected` : loadedScopeSummary}
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
                    Type to filter {documents.length.toLocaleString()} loaded documents. Selected documents stay pinned
                    here.
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
                  ? `${loadedScopeSummary} documents. Type a title or file name to narrow the loaded list.`
                  : `Showing ${visibleScopeDocuments.length} of ${matchingDocuments.length}. Keep typing to narrow the list.`}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <header
        id="search"
        className="edge-glass-header sticky top-0 z-30 border-b border-[color:var(--border)] py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl"
      >
        <div className="relative mx-auto flex h-12 max-w-7xl items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:hidden"
            aria-label="Open Clinical Guide menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            ref={modeMenuRef}
            className={cn(
              "relative z-40 mx-auto sm:mx-0",
              modeAlignment === "center" && "absolute left-1/2 top-1/2 mx-0 -translate-x-1/2 -translate-y-1/2",
            )}
          >
            <button
              ref={modeButtonRef}
              type="button"
              onClick={() => {
                setActionMenuOpen(false);
                closeScope(false);
                setModeMenuOpen((open) => !open);
              }}
              onKeyDown={handleModeTriggerKeyDown}
              className="inline-grid h-11 min-w-[10rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-w-[14rem]"
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              aria-controls={modeMenuOpen ? "app-mode-menu" : undefined}
              aria-label={`Current app mode: ${selectedAppMode.label}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-chat-teal)] text-white shadow-[var(--shadow-tight)]">
                <SelectedAppModeIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  Mode
                </span>
                <span className="block truncate text-sm font-semibold text-[color:var(--text-heading)]">
                  {selectedAppMode.label}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[color:var(--text-soft)] transition-transform motion-reduce:transition-none",
                  modeMenuOpen && "rotate-180",
                )}
              />
            </button>

            {modeMenuOpen ? (
              <div
                id="app-mode-menu"
                role="menu"
                aria-label="Choose app mode"
                className="absolute left-1/2 top-[calc(100%+0.5rem)] z-50 w-[min(21rem,calc(100vw-4rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1.5 text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-white/25 backdrop-blur-md dark:ring-white/10 sm:left-0 sm:w-[min(21rem,calc(100vw-2rem))] sm:translate-x-0"
              >
                {visibleAppModeOptions.map((mode, index) => {
                  const Icon = appModeIcons[mode.id];
                  const active = mode.id === searchMode;
                  return (
                    <button
                      key={mode.id}
                      ref={(element) => {
                        modeOptionRefs.current[index] = element;
                      }}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      onKeyDown={(event) => handleModeOptionKeyDown(event, index)}
                      onClick={() => {
                        selectAppMode(mode);
                        window.requestAnimationFrame(() => modeButtonRef.current?.focus());
                      }}
                      className={cn(
                        "grid min-h-[3.25rem] w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                        active
                          ? "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-lg border shadow-[var(--shadow-inset)]",
                          active
                            ? "border-[color:var(--clinical-chat-teal)]/25 bg-[color:var(--surface)]"
                            : "border-[color:var(--border)] bg-[color:var(--surface-raised)]",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{mode.label}</span>
                        <span className="block truncate text-[11px] font-medium text-[color:var(--text-soft)]">
                          {mode.description}
                        </span>
                      </span>
                      {active ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {scopeIsPlaceholder ? (
              <button
                type="button"
                data-testid="scope-trigger"
                aria-disabled="true"
                aria-label="Document scope placeholder"
                title="Document scope"
                className="flex min-h-10 shrink-0 cursor-default items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
              >
                <Globe2 className="h-4 w-4" />
                <span className="hidden sm:inline">Scope</span>
              </button>
            ) : usesScopeSheet ? (
              <button
                type="button"
                ref={(element) => {
                  scopeSummaryRef.current = element;
                }}
                data-testid="scope-trigger"
                onClick={() => {
                  setActionMenuOpen(false);
                  setModeMenuOpen(false);
                  setScopeSheetOpen(true);
                }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                aria-label="Open document scope"
                aria-expanded={scopeSheetOpen}
                title="Document scope"
              >
                <Globe2 className="h-5 w-5" />
                {selectedDocumentIds.length ? (
                  <span className="absolute mt-7 rounded-md bg-[color:var(--clinical-chat-teal-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--clinical-chat-teal)]">
                    {selectedDocumentIds.length}
                  </span>
                ) : null}
              </button>
            ) : (
              <details
                ref={scopeDetailsRef}
                open={scopeOpen}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  if (open) {
                    setActionMenuOpen(false);
                    setModeMenuOpen(false);
                  }
                  setScopeOpen(open);
                  if (open) window.setTimeout(() => scopeFilterInputRef.current?.focus(), 0);
                }}
                className="group relative"
              >
                <summary
                  ref={(element) => {
                    scopeSummaryRef.current = element;
                  }}
                  data-testid="scope-trigger"
                  className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label="Open document scope"
                  aria-expanded={scopeOpen}
                >
                  <Globe2 className="h-4 w-4" />
                  <span>{selectedDocumentIds.length ? `${selectedDocumentIds.length} scoped` : "All sources"}</span>
                </summary>
                <div
                  data-testid="scope-command-popover"
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
            )}
            <button
              type="button"
              onClick={onNewChat}
              className="hidden min-h-10 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--surface-subtle)] sm:inline-flex"
              aria-label="Start a new chat"
            >
              <Plus className="h-4 w-4" />
              New chat
            </button>
            <button
              type="button"
              onClick={onNewChat}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:hidden"
              aria-label="Start a new chat"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] hover:text-[color:var(--text)] sm:grid"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              data-testid="header-account-settings"
              className="relative hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-xs font-bold text-[color:var(--clinical-chat-teal)] transition hover:bg-[color:var(--clinical-chat-teal-soft)]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:grid"
              aria-label={identity.signedIn ? `Open settings for ${identity.detail}` : "Open account settings"}
              title={identity.detail}
            >
              {identity.initials}
              {identity.signedIn ? (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--clinical-chat-ready)]" />
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <form
        onSubmit={submit}
        className={cn(
          chatComposerShell,
          "floating-composer-edge dashboard-composer-edge fixed z-40 mx-auto max-w-3xl lg:max-w-4xl",
        )}
      >
        <ModeActionPopup
          open={actionMenuOpen}
          title={actionMenuTitle}
          titleIcon={SelectedAppModeIcon}
          buttonLabel={actionMenuButtonLabel}
          items={actionMenuItems}
          onOpenChange={setActionMenuOpen}
          onBeforeOpen={() => {
            setUsesScopeSheet(currentUsesScopeSheet());
            setModeMenuOpen(false);
            closeScope(false);
          }}
          onAction={runModeAction}
        />

        <label className="relative flex min-w-0 flex-1 items-center overflow-hidden">
          <input
            ref={queryInputRef}
            data-testid="global-search-input"
            autoFocus={queryInputAutoFocus}
            value={query}
            onInput={(event) => onQueryChange(event.currentTarget.value)}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAsk();
            }}
            aria-label={`Search indexed guidelines by question or keyword - ${selectedSearch.inputAriaLabel}`}
            placeholder={queryPlaceholder}
            className={cn(chatComposerInput, "w-full min-w-0", query ? "pr-11" : null)}
          />
          {query && (
            <button
              type="button"
              onClick={onClearQuery}
              className="absolute right-0 top-1/2 grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
              aria-label="Clear search question"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <button type="button" className={chatComposerIconButton} aria-label="Voice input" title="Voice input">
          <Mic className="h-4.5 w-4.5" />
        </button>
        <button
          type="submit"
          disabled={!canAsk}
          title={
            !realDataReady
              ? "Search setup not ready"
              : trimmedQuery.length < 1
                ? selectedSearch.emptyTitle
                : selectedSearch.readyTitle
          }
          className={chatSendButton}
          aria-label={selectedSearch.submitAriaLabel}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="sr-only">{submitLabel}</span>
        </button>
        <Sheet
          open={usesScopeSheet && scopeSheetOpen}
          onClose={closeScopeSheet}
          title="Document scope"
          description="Choose documents and filters for the next search."
          closeLabel="Close document scope"
          initialFocusRef={scopeFilterInputRef}
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
      </form>
    </>
  );
}
