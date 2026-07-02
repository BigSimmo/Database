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
import { createPortal } from "react-dom";

import {
  Activity,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Copy,
  FileText,
  Filter,
  Globe2,
  Heart,
  Loader2,
  Menu,
  MessageSquarePlus,
  Pill,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  ArrowLeft,
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
  chatComposerInput,
  chatComposerShell,
  chatSendButton,
  floatingControl,
  shellChip,
  eyebrowText,
} from "@/components/ui-primitives";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { Sheet } from "@/components/ui/sheet";
import {
  appModeDefinition,
  appModeDefinitions,
  appModeSearchConfig,
  isSearchableAppMode,
  visibleAppModeDefinitions,
  type AppModeId,
} from "@/lib/app-modes";
import type { ClinicalDocument, ClinicalQueryMode } from "@/lib/types";
import { type SearchScopeFilters } from "@/lib/search-scope";
import { tagSearchText } from "@/lib/document-tags";

const mobileSheetMediaQuery = "(max-width: 639px)";
const desktopHomeComposerMediaQuery = "(min-width: 1024px)";
const defaultVisibleAppModeOptions = visibleAppModeDefinitions();
const appModeIcons: Record<AppModeId, typeof Search> = {
  answer: Sparkles,
  documents: FileText,
  services: ShieldCheck,
  forms: FileText,
  favourites: Heart,
  differentials: BrainCircuit,
  prescribing: Pill,
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

type TextScopeFilterKey =
  | "medications"
  | "topics"
  | "sites"
  | "documentTypes"
  | "services"
  | "settings"
  | "populations"
  | "risks"
  | "workflows"
  | "clinicalActions"
  | "carePhases"
  | "documentIntents"
  | "contentFeatures"
  | "collections";

const labelScopeFilterFields: Array<{ key: TextScopeFilterKey; label: string; placeholder: string }> = [
  { key: "medications", label: "Medication", placeholder: "Lithium, clozapine" },
  { key: "topics", label: "Topic", placeholder: "ECT, safety plan" },
  { key: "sites", label: "Site", placeholder: "FSH, RPBG, CAMHS" },
  { key: "documentTypes", label: "Type", placeholder: "Guideline, policy" },
  { key: "services", label: "Service", placeholder: "Mental health, pharmacy" },
  { key: "settings", label: "Setting", placeholder: "Inpatient, ED" },
  { key: "populations", label: "Population", placeholder: "Youth, older adult" },
  { key: "risks", label: "Risk", placeholder: "High-risk medication" },
  { key: "workflows", label: "Workflow", placeholder: "Referral, discharge" },
  { key: "clinicalActions", label: "Action", placeholder: "Assess, monitor" },
  { key: "carePhases", label: "Phase", placeholder: "Acute management" },
  { key: "documentIntents", label: "Intent", placeholder: "Decision support" },
  { key: "contentFeatures", label: "Feature", placeholder: "Contains table" },
  { key: "collections", label: "Collection", placeholder: "Local policy set" },
];

function documentScopeTitle(document: ClinicalDocument) {
  return cleanDisplayTitle(document.title);
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
  documentTotal,
  query,
  searchMode,
  loading,
  selectedDocumentIds,
  queryMode,
  scopeFilters,
  realDataReady,
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
  queryModeOptions,
  queryInputRef,
  queryInputAutoFocus = false,
  headerVariant = "default",
  mobileSearchPlacement = "default",
  desktopSearchPlacement = "default",
  searchComposerVisible = true,
  workflowCopyText,
  desktopHomeComposerSlotId,
  mobileLeadingAction = "menu",
  onMobileBack,
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
  queryModeOptions: Array<{ value: ClinicalQueryMode; label: string }>;
  queryInputRef?: Ref<HTMLInputElement>;
  queryInputAutoFocus?: boolean;
  headerVariant?: "default" | "workflow";
  mobileSearchPlacement?: "default" | "bottom";
  desktopSearchPlacement?: "default" | "hero";
  searchComposerVisible?: boolean;
  workflowCopyText?: string;
  desktopHomeComposerSlotId?: string;
  mobileLeadingAction?: "menu" | "back";
  onMobileBack?: () => void;
}) {
  const visibleAppModeOptions = defaultVisibleAppModeOptions;
  const trimmedQuery = query.trim();
  const selectedSearch = appModeSearchConfig(searchMode);
  const selectedAppMode = appModeDefinition(searchMode);
  const selectedSearchable = isSearchableAppMode(searchMode);
  const isAnswerFooterComposer = searchMode === "answer";
  const isWorkflowHeader = headerVariant === "workflow";
  const isMobileBottomComposer = searchComposerVisible && mobileSearchPlacement === "bottom" && !isAnswerFooterComposer;
  const isHeroDesktopComposer = desktopSearchPlacement === "hero" && isMobileBottomComposer;
  const canRunLocalSearch = selectedSearch.kind === "tools" || selectedSearch.kind === "favourites";
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
  const [usesPhoneSearchLayout, setUsesPhoneSearchLayout] = useState(false);
  const [desktopHomeComposerTarget, setDesktopHomeComposerTarget] = useState<HTMLElement | null>(null);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scopePopoverRef = useRef<HTMLDivElement | null>(null);
  const scopeSummaryRef = useRef<HTMLButtonElement | null>(null);
  const scopeFilterInputRef = useRef<HTMLInputElement | null>(null);
  const selectedDocumentIdSet = useMemo(() => new Set(selectedDocumentIds), [selectedDocumentIds]);
  const documentById = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const selectedDocuments = useMemo(
    () =>
      selectedDocumentIds
        .map((id) => documentById.get(id))
        .filter((document): document is ClinicalDocument => Boolean(document)),
    [documentById, selectedDocumentIds],
  );
  const scopeSummary = selectedDocumentIds.length === 0 ? "All documents" : `${selectedDocumentIds.length} scoped`;
  const footerScopeLabel = selectedDocumentIds.length === 0 ? "All sources" : `${selectedDocumentIds.length} scoped`;
  const scopePreview = useMemo(
    () =>
      selectedDocuments
        .slice(0, 2)
        .map((document) => document?.title.replace(/^Synthetic /, ""))
        .filter(Boolean)
        .join(", "),
    [selectedDocuments],
  );
  const normalizedScopeFilter = scopeFilter.trim().toLowerCase();
  const recentlyUpdatedDocuments = useMemo(
    () =>
      [...documents].sort((a, b) => {
        const bTime = Date.parse(b.updated_at || b.created_at || "");
        const aTime = Date.parse(a.updated_at || a.created_at || "");
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      }),
    [documents],
  );
  const documentSearchTextById = useMemo(
    () =>
      new Map(
        documents.map((document) => [
          document.id,
          [document.title, document.file_name, document.description, tagSearchText(document)]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [documents],
  );
  const matchingDocuments = useMemo(
    () =>
      normalizedScopeFilter
        ? recentlyUpdatedDocuments.filter((document) =>
            documentSearchTextById.get(document.id)?.includes(normalizedScopeFilter),
          )
        : recentlyUpdatedDocuments,
    [documentSearchTextById, normalizedScopeFilter, recentlyUpdatedDocuments],
  );
  const largeScopeSet = documents.length > 12;
  const requireScopeFilter = largeScopeSet && !normalizedScopeFilter;
  const visibleScopeDocuments = useMemo(
    () =>
      [
        ...selectedDocuments,
        ...(requireScopeFilter ? [] : matchingDocuments.filter((document) => !selectedDocumentIdSet.has(document.id))),
      ].slice(0, 12),
    [matchingDocuments, requireScopeFilter, selectedDocumentIdSet, selectedDocuments],
  );
  const hiddenScopeMatchCount = requireScopeFilter
    ? Math.max(0, selectedDocuments.length ? documents.length - selectedDocumentIds.length : documents.length)
    : Math.max(0, matchingDocuments.length - visibleScopeDocuments.length);
  const activeLabelFilterCount = labelScopeFilterFields.filter((field) => scopeFilters[field.key]?.length).length;
  const submitLabel = trimmedQuery ? selectedSearch.submitBusyLabel : selectedSearch.submitIdleLabel;
  const queryPlaceholder = isAnswerFooterComposer ? "Ask Clinical Guide" : selectedSearch.placeholder;
  const SelectedAppModeIcon = appModeIcons[selectedAppMode.id];
  const actionMenuSetId: ModeActionSetId =
    searchMode === "services"
      ? "services"
      : searchMode === "documents" || searchMode === "forms"
        ? "documents"
        : searchMode === "favourites"
          ? "favourites"
          : searchMode === "differentials"
            ? "differentials"
            : searchMode === "tools"
              ? "tools"
              : "answer";
  const actionMenuItems =
    searchMode === "prescribing" ? medicationModeActionItems : modeActionItemsFor(actionMenuSetId);
  const actionMenuTitle = selectedAppMode.label;
  const actionMenuButtonLabel = `Open ${selectedAppMode.label.toLowerCase()} options`;
  const isStandaloneModeHomeHeader = Boolean(desktopHomeComposerSlotId);
  const useMobileBackControl = mobileLeadingAction === "back";

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

    if (actionId === "documents-search") {
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
    if (actionId === "answer-quotes" || actionId === "answer-evidence-map") {
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
    if (actionId === "services-search") {
      onSearchModeChange("services");
      return;
    }
    if (actionId === "services-pathways") {
      onSearchModeChange("services");
      onQueryChange(trimmedQuery || "crisis support referral pathway");
      return;
    }
    if (actionId === "services-records") {
      onSearchModeChange("services");
      onQueryChange("");
      return;
    }
    if (actionId === "favourites-browse") {
      onSearchModeChange("favourites");
      onQueryChange("");
      return;
    }
    if (actionId === "favourites-sets") {
      onSearchModeChange("favourites");
      onQueryChange("set");
      return;
    }
    if (actionId === "answer-new" || actionId === "tools-new") {
      onNewChat?.();
      return;
    }
    if (actionId === "tools-browse") {
      onSearchModeChange("tools");
      return;
    }
    if (actionId === "differentials-build") {
      onSearchModeChange("differentials");
      onQueryChange(trimmedQuery || "acute confusion differential diagnosis");
      return;
    }
    if (actionId === "differentials-criteria") {
      onSearchModeChange("differentials");
      onQueryModeChange("compare_guidance");
      onQueryChange(trimmedQuery || "delirium vs dementia differential diagnosis");
      return;
    }
    if (actionId === "differentials-documents") {
      onSearchModeChange("documents");
      onQueryChange(trimmedQuery || "differential diagnosis");
      return;
    }
    if (actionId === "differentials-evidence") {
      onOpenEvidence?.();
      return;
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

  const closeScope = useCallback((restoreFocus = false) => {
    setScopeOpen(false);
    if (restoreFocus) scopeSummaryRef.current?.focus();
  }, []);

  const closeScopeSheet = useCallback(() => {
    setScopeSheetOpen(false);
    window.requestAnimationFrame(() => scopeSummaryRef.current?.focus());
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileSheetMediaQuery);
    const sync = () => {
      setUsesScopeSheet(mediaQuery.matches);
      setUsesPhoneSearchLayout(mediaQuery.matches);
    };
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    onScopeOpenChange?.(scopeOpen || scopeSheetOpen);
  }, [onScopeOpenChange, scopeOpen, scopeSheetOpen]);

  useEffect(() => {
    if (!desktopHomeComposerSlotId) {
      const frame = window.requestAnimationFrame(() => setDesktopHomeComposerTarget(null));
      return () => window.cancelAnimationFrame(frame);
    }

    const mediaQuery = window.matchMedia(desktopHomeComposerMediaQuery);
    let frame: number | null = null;
    let retryTimeout: number | null = null;
    const syncTarget = () => {
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      const target = mediaQuery.matches ? document.getElementById(desktopHomeComposerSlotId) : null;
      setDesktopHomeComposerTarget((current) => (current === target ? current : target));
      if (mediaQuery.matches && !target) {
        retryTimeout = window.setTimeout(syncTarget, 50);
      }
    };
    const scheduleSync = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncTarget);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleSync();
    mediaQuery.addEventListener("change", scheduleSync);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
      observer.disconnect();
      mediaQuery.removeEventListener("change", scheduleSync);
    };
  }, [desktopHomeComposerSlotId]);

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
    refs: [scopePopoverRef, scopeSummaryRef],
    restoreFocusRef: scopeSummaryRef,
    onDismiss: dismissScope,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMenuOpen(false);
    onAsk();
  }

  function updateTextScopeFilter(key: TextScopeFilterKey, value: string) {
    onScopeFiltersChange({ ...scopeFilters, [key]: splitFilterText(value) });
  }

  function renderLabelScopeFilterGrid(compact = false) {
    return (
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {labelScopeFilterFields.map((field) => (
          <label key={field.key} className="grid min-w-0 gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
              {field.label}
            </span>
            <input
              value={filterText(scopeFilters[field.key])}
              onChange={(event) => updateTextScopeFilter(field.key, event.target.value)}
              placeholder={field.placeholder}
              className="h-10 min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-2 text-xs font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25"
            />
          </label>
        ))}
      </div>
    );
  }

  function renderScopeRows() {
    return (
      <div className="grid gap-3">
        <section className="min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 sm:hidden">
          <div className="mb-2 flex min-h-7 items-center justify-between gap-2 px-0.5">
            <p className={eyebrowText}>Refine search</p>
            <span className="text-[11px] font-semibold text-[color:var(--text-soft)]">Mode, status, labels</span>
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
            {renderLabelScopeFilterGrid(true)}
            <button
              type="button"
              onClick={() => onScopeFiltersChange({})}
              className={cn(floatingControl, "min-h-9 px-3 text-xs")}
            >
              Clear refine filters
            </button>
          </div>
        </section>
        <details className="group hidden min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 sm:block">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 px-0.5">
            <span className={eyebrowText}>Label filters</span>
            <span className="flex items-center gap-2 text-[11px] font-semibold text-[color:var(--text-soft)]">
              {activeLabelFilterCount ? `${activeLabelFilterCount} active` : "Medication, site, action, intent"}
              <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="mt-2 grid gap-2 border-t border-[color:var(--border)] pt-2">
            {renderLabelScopeFilterGrid(false)}
            <button
              type="button"
              onClick={() => onScopeFiltersChange({})}
              className={cn(floatingControl, "min-h-9 w-fit px-3 text-xs")}
            >
              Clear refine filters
            </button>
          </div>
        </details>
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
                      title={cleanDisplayTitle(document.title)}
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

  function renderSearchComposer(placement: "default" | "desktop-home") {
    const isDesktopHomeComposer = placement === "desktop-home";
    const usesAnswerFooterStyle = isAnswerFooterComposer && !isDesktopHomeComposer;
    const usesMobileBottomStyle = isMobileBottomComposer && !isDesktopHomeComposer;
    const usesUniversalFooterStyle = usesAnswerFooterStyle || (usesMobileBottomStyle && usesPhoneSearchLayout);
    const usesSendAffordance = usesAnswerFooterStyle || (isStandaloneModeHomeHeader && searchMode === "differentials");
    const composerPlaceholder =
      usesMobileBottomStyle && searchMode === "differentials" ? "Search a presentation" : queryPlaceholder;

    return (
      <form
        onSubmit={submit}
        className={cn(
          isDesktopHomeComposer
            ? "mx-auto w-full max-w-2xl lg:max-w-3xl"
            : usesAnswerFooterStyle
              ? "floating-composer-edge dashboard-composer-edge fixed z-40 mx-auto max-w-3xl lg:max-w-4xl"
              : usesMobileBottomStyle
                ? cn(
                    "document-mobile-search-edge fixed z-40 mx-auto max-w-3xl sm:z-20 sm:w-full sm:px-4 sm:py-3 lg:max-w-4xl",
                    isHeroDesktopComposer
                      ? "forms-hero-search-edge sm:absolute"
                      : "sm:sticky sm:top-[calc(4.75rem+env(safe-area-inset-top))]",
                  )
                : "sticky top-[calc(4.75rem+env(safe-area-inset-top))] z-20 mx-auto w-full max-w-3xl px-3 py-3 sm:px-4 lg:max-w-4xl",
          usesUniversalFooterStyle && "answer-footer-search-edge flex flex-col items-center gap-2.5",
        )}
      >
        <div
          className={cn(
            usesUniversalFooterStyle
              ? cn(chatComposerShell, "answer-footer-search-pill relative w-full")
              : cn(
                  chatComposerShell,
                  "relative w-full",
                  isDesktopHomeComposer && "desktop-home-search-pill",
                  usesMobileBottomStyle && "document-mobile-search-pill",
                ),
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
              setScopeOpen(false);
            }}
            onAction={runModeAction}
            triggerClassName={usesUniversalFooterStyle ? "answer-footer-search-action" : undefined}
            integrated={usesUniversalFooterStyle}
          />

          {/* The clear button is a flex sibling (not absolutely positioned): the
              unlayered .answer-footer-search-input padding beats a conditional
              pr-* utility, which let text run under an overlaid button. */}
          <label className="flex min-w-0 flex-1 items-center overflow-hidden">
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
              placeholder={composerPlaceholder}
              className={cn(
                chatComposerInput,
                "w-full min-w-0",
                usesUniversalFooterStyle && "answer-footer-search-input",
                isDesktopHomeComposer && "desktop-home-search-input",
              )}
            />
            {query && (
              <button
                type="button"
                onClick={onClearQuery}
                className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
                aria-label="Clear search question"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          {usesUniversalFooterStyle ? <span className="answer-footer-search-divider" aria-hidden="true" /> : null}
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
            className={cn(chatSendButton, usesUniversalFooterStyle && "answer-footer-search-send")}
            aria-label={selectedSearch.submitAriaLabel}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : usesSendAffordance ? (
              <Send className="h-4 w-4" />
            ) : (
              <Search className="h-4.5 w-4.5" />
            )}
            <span className="sr-only">{submitLabel}</span>
          </button>
        </div>
        {usesUniversalFooterStyle ? (
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 px-2">
            <button
              type="button"
              onClick={() => onOpenEvidence?.()}
              className="answer-footer-search-chip"
              aria-label="Open evidence-backed answer sources"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="sm:hidden">Evidence</span>
              <span className="hidden sm:inline">Evidence-based</span>
            </button>
            <button
              type="button"
              ref={scopeSummaryRef}
              data-testid="scope-trigger"
              onClick={openScopePicker}
              className="answer-footer-search-chip"
              aria-expanded={usesScopeSheet ? scopeSheetOpen : scopeOpen}
              aria-label="Open source scope"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span className="sm:hidden">{selectedDocumentIds.length === 0 ? "Sources" : footerScopeLabel}</span>
              <span className="hidden sm:inline">{footerScopeLabel}</span>
            </button>
            {!usesScopeSheet && scopeOpen ? (
              <div
                ref={scopePopoverRef}
                data-testid="scope-command-popover"
                className="polished-scroll absolute bottom-[calc(100%+0.75rem)] right-2 z-50 max-h-[min(70dvh,28rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-2.5 pb-2.5 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl motion-safe:animate-pop-in"
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
            ) : null}
          </div>
        ) : null}
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
    );
  }

  return (
    <>
      <header
        id="search"
        className={cn(
          "edge-glass-header universal-header sticky top-0 z-30 border-b border-[color:var(--border)] py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text)] shadow-[var(--shadow-tight)] backdrop-blur-xl",
        )}
      >
        <div
          className={cn(
            "relative mx-auto grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3",
            isWorkflowHeader
              ? "max-w-none px-3 sm:px-5 lg:grid-cols-[auto_auto_minmax(0,1fr)] lg:gap-4 lg:px-6"
              : "max-w-7xl lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
          )}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={useMobileBackControl ? onMobileBack : onOpenMobileSidebar}
              className={cn(
                "universal-header-icon-control h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                isWorkflowHeader ? "grid" : "grid lg:hidden",
              )}
              aria-label={useMobileBackControl ? "Back to differentials home" : "Open Clinical Guide menu"}
            >
              {useMobileBackControl ? <ArrowLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div
            ref={modeMenuRef}
            className={cn("relative z-40 min-w-0", isWorkflowHeader ? "justify-self-start" : "justify-self-center")}
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
              className={cn(
                "universal-header-mode-button inline-grid h-12 w-[min(13rem,calc(100vw-11.5rem))] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-auto sm:min-w-[13rem] sm:pr-3",
                isWorkflowHeader && "h-11 w-[min(11rem,calc(100vw-11rem))] sm:w-[12rem] sm:min-w-0 lg:w-[12.5rem]",
              )}
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              aria-controls={modeMenuOpen ? "app-mode-menu" : undefined}
              aria-label={`Current app mode: ${selectedAppMode.label}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
                <SelectedAppModeIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="hidden truncate text-[10px] font-extrabold uppercase leading-3 tracking-[0.08em] text-[color:var(--text-soft)] sm:block">
                  Mode
                </span>
                <span className="block truncate text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
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
                          ? "border-l-2 border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-chrome)] text-[color:var(--text)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-lg border",
                          active
                            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
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
                      {active ? <Check className="h-4 w-4 text-[color:var(--clinical-accent)]" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative flex min-w-0 shrink-0 items-center justify-end gap-1.5 justify-self-end sm:gap-2">
            {isWorkflowHeader ? (
              <>
                <div className="hidden min-w-0 items-center gap-2 xl:flex">
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Local only
                  </span>
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
                    <Cloud className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                    Offline ready
                  </span>
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/45 px-3 text-xs font-extrabold text-[color:var(--warning)] shadow-[var(--shadow-inset)]">
                    <AlertCircle className="h-4 w-4" aria-hidden />
                    Source pending review
                  </span>
                </div>
                <button
                  type="button"
                  className="universal-header-icon-control grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label="Open language and region settings"
                  title="Language and region"
                >
                  <Globe2 className="h-5 w-5" aria-hidden />
                </button>
                <span className="hidden h-8 w-px bg-[color:var(--border)] sm:block" aria-hidden />
                <button
                  type="button"
                  onClick={onNewChat}
                  className="universal-header-icon-control grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  aria-label="Start a new comparison"
                  title="New comparison"
                >
                  <Plus className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (workflowCopyText) void navigator.clipboard?.writeText(workflowCopyText);
                  }}
                  className="hidden min-h-11 items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-extrabold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] xl:inline-flex"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy after review
                </button>
              </>
            ) : null}
            {!isWorkflowHeader ? (
              <button
                type="button"
                onClick={onNewChat}
                className="universal-header-icon-control inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] xl:w-auto xl:px-3 xl:text-xs xl:font-semibold xl:text-[color:var(--text)]"
                aria-label="Start a new chat"
                title="New chat"
              >
                <MessageSquarePlus className="h-5 w-5 xl:h-4 xl:w-4" />
                <span className="hidden whitespace-nowrap xl:inline">New chat</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {searchComposerVisible ? (
        <>
          {desktopHomeComposerTarget ? null : renderSearchComposer("default")}
          {desktopHomeComposerTarget
            ? createPortal(renderSearchComposer("desktop-home"), desktopHomeComposerTarget)
            : null}
        </>
      ) : null}
    </>
  );
}
