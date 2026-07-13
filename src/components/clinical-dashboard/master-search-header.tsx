"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import {
  Check,
  CircleCheck,
  ChevronDown,
  FileText,
  Filter,
  Globe2,
  Loader2,
  Menu,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ArrowLeft,
  X,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { PrivacyInputNotice } from "@/components/privacy-input-notice";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { useHideOnScroll } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import {
  ModeActionPopup,
  modeActionItemsFor,
  type ModeActionId,
  type ModeActionModeOption,
  type ModeActionPlacement,
  type ModeActionSetId,
} from "@/components/clinical-dashboard/mode-action-popup";
import {
  cn,
  chatComposerInput,
  chatComposerShellBase,
  chatSendButton,
  floatingControl,
  shellChip,
  eyebrowText,
} from "@/components/ui-primitives";
import { UniversalSearchCommandSurface } from "@/components/clinical-dashboard/universal-search-command-surface";
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
import { appModeIcons } from "@/lib/app-mode-icons";
import type { ClinicalDocument, ClinicalQueryMode } from "@/lib/types";
import { type SearchScopeFilters } from "@/lib/search-scope";
import { tagSearchText } from "@/lib/document-tags";

// Shared between the composer input's aria-describedby and the rendered
// PrivacyInputNotice id/testId so the wiring cannot drift apart.
const composerPrivacyWarningId = "answer-composer-privacy-warning";

const phoneSearchLayoutMediaQuery = "(max-width: 639px)";
const scopeSheetMediaQuery = "(max-width: 1023px)";
const desktopHomeComposerMediaQuery = "(min-width: 1024px)";
const modeHomeComposerMediaQuery = "(min-width: 0px)";
const defaultVisibleAppModeOptions = visibleAppModeDefinitions();

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
  composerPlaceholder,
  recentQueries = [],
  commandScopes = [],
  onCommandScopesChange,
  onPickRecent,
  onCrossModeSearch,
  composerFollowUpSuggestions,
  onPickComposerFollowUpSuggestion,
  composerFollowUpSuggestionsDisabled = false,
  headerVariant = "default",
  mobileSearchPlacement = "default",
  mobileBottomSearchVariant = "default",
  desktopSearchPlacement = "default",
  searchComposerVisible = true,
  desktopHomeComposerSlotId,
  mobileBottomSearchAddonSlotId,
  mobileLeadingAction = "menu",
  onMobileBack,
  hideOnScroll,
  onBottomComposerScrollHiddenChange,
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
  queryInputRef?: RefObject<HTMLInputElement | null>;
  queryInputAutoFocus?: boolean;
  /** Overrides the mode's default input placeholder (e.g. "Ask a follow-up..." mid-thread). */
  composerPlaceholder?: string;
  recentQueries?: string[];
  commandScopes?: string[];
  onCommandScopesChange?: (scopes: string[]) => void;
  onPickRecent?: (query: string) => void;
  onCrossModeSearch?: (modeId: AppModeId, query: string) => void;
  composerFollowUpSuggestions?: string[];
  onPickComposerFollowUpSuggestion?: (suggestion: string) => void;
  composerFollowUpSuggestionsDisabled?: boolean;
  headerVariant?: "default" | "workflow";
  mobileSearchPlacement?: "default" | "bottom";
  /** "compact" drops the phone footer chip row and hugs the bottom edge —
   *  used by search/result views so results keep maximum screen space.
   *  Mode homes keep the default chip-row layout. */
  mobileBottomSearchVariant?: "default" | "compact";
  desktopSearchPlacement?: "default" | "hero";
  searchComposerVisible?: boolean;
  /** Mode-home slot the composer portals into at every viewport width, so the
   *  search pill sits in the middle of the hero on phones as well as desktop
   *  instead of docking to the bottom edge. */
  desktopHomeComposerSlotId?: string;
  /** Phone-only slot rendered above the bottom search pill for page-specific dock addons. */
  mobileBottomSearchAddonSlotId?: string;
  mobileLeadingAction?: "menu" | "back";
  onMobileBack?: () => void;
  /** Phone-only hide-on-scroll for the universal header and bottom search dock.
   *  "overlay" translates the sticky header away (host scrolls the document,
   *  content already flows beneath); "collapse" also releases the header's
   *  layout space (host keeps the header above an internally scrolling element).
   *  The phone bottom search composer hides in sync on search-mode pages.
   *  Parent hosts with an internally scrolling element pass `scrollHidden` from
   *  `useScrollHideReporter` wired to that element's scroll events. */
  hideOnScroll?: {
    strategy: "overlay" | "collapse";
    /**
     * Overlay-only: apply the hide/reveal (and the out-of-flow absolute header)
     * at every breakpoint instead of phones only. The host must reserve
     * matching top padding on its scroll container.
     */
    allBreakpoints?: boolean;
    /** Parent-owned hidden state for hosts that report scroll via React `onScroll`. */
    scrollHidden?: boolean;
  };
  /** Fired when the phone bottom search dock enters or leaves the scroll-hidden state. */
  onBottomComposerScrollHiddenChange?: (hidden: boolean) => void;
}) {
  const visibleAppModeOptions = defaultVisibleAppModeOptions;
  const trimmedQuery = query.trim();
  const selectedSearch = appModeSearchConfig(searchMode);
  const selectedAppMode = appModeDefinition(searchMode);
  const selectedSearchable = isSearchableAppMode(searchMode);
  const isAnswerFooterComposer = searchMode === "answer";
  const isWorkflowHeader = headerVariant === "workflow";
  const isServicesMode = searchMode === "services";
  const isMobileBottomComposer = searchComposerVisible && mobileSearchPlacement === "bottom" && !isAnswerFooterComposer;
  const isHeroDesktopComposer = desktopSearchPlacement === "hero" && isMobileBottomComposer;
  const canRunLocalSearch =
    selectedSearch.kind === "documents" ||
    selectedSearch.kind === "forms" ||
    selectedSearch.kind === "services" ||
    selectedSearch.kind === "tools" ||
    selectedSearch.kind === "favourites" ||
    selectedSearch.kind === "specifiers";
  const canAsk = trimmedQuery.length >= 1 && !loading && selectedSearchable && (realDataReady || canRunLocalSearch);
  const indexedDocumentTotal = documentTotal ?? documents.length;
  const hasUnloadedDocuments = indexedDocumentTotal > documents.length;
  const loadedScopeSummary = hasUnloadedDocuments
    ? `${documents.length.toLocaleString()} loaded of ${indexedDocumentTotal.toLocaleString()}`
    : `${documents.length.toLocaleString()} available`;
  const [scopeFilter, setScopeFilter] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [scopeSheetFullscreen, setScopeSheetFullscreen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionMenuPlacement, setActionMenuPlacement] = useState<ModeActionPlacement>("up");
  const [commandDropdownOpen, setCommandDropdownOpen] = useState(false);
  const [commandListboxId, setCommandListboxId] = useState<string>();
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [usesScopeSheet, setUsesScopeSheet] = useState(false);
  const [usesPhoneSearchLayout, setUsesPhoneSearchLayout] = useState(false);
  const [desktopHomeComposerActive, setDesktopHomeComposerActive] = useState(false);
  // True once the hero portal is conclusively unavailable — the media query
  // does not match, or the slot never appeared after the retry budget. While a
  // slot id is present and this is false the inline composer stays suppressed
  // (no flash while the portal mounts); once it flips true the inline composer
  // renders, so the search can never vanish from the page at any width.
  const [desktopHomeComposerFallback, setDesktopHomeComposerFallback] = useState(false);
  // Phone-only hide-on-scroll: never hide while a header-owned surface is open
  // or while focus sits inside the header chrome (keyboard users must not tab
  // into invisible controls).
  const [headerChromeFocused, setHeaderChromeFocused] = useState(false);
  const [composerChromeFocused, setComposerChromeFocused] = useState(false);
  const internalScrollHidden = useHideOnScroll({
    disabled: !hideOnScroll || hideOnScroll.scrollHidden !== undefined,
  });
  const scrollHidden = hideOnScroll?.scrollHidden !== undefined ? hideOnScroll.scrollHidden : internalScrollHidden;
  const headerChromeHidden =
    scrollHidden && !modeMenuOpen && !actionMenuOpen && !scopeOpen && !scopeSheetOpen && !headerChromeFocused;
  // Mode homes portal the composer into the hero slot at every width, so the
  // phone bottom dock only exists when no hero slot is provided.
  const phoneBottomSearchDockActive =
    usesPhoneSearchLayout &&
    searchComposerVisible &&
    !desktopHomeComposerSlotId &&
    (isAnswerFooterComposer || mobileSearchPlacement === "bottom");
  const bottomComposerScrollHiddenActive = Boolean(hideOnScroll && phoneBottomSearchDockActive);
  const bottomComposerHidden =
    bottomComposerScrollHiddenActive &&
    scrollHidden &&
    !actionMenuOpen &&
    !commandDropdownOpen &&
    !scopeOpen &&
    !scopeSheetOpen &&
    !composerChromeFocused;

  useEffect(() => {
    onBottomComposerScrollHiddenChange?.(bottomComposerHidden);
  }, [bottomComposerHidden, onBottomComposerScrollHiddenChange]);

  useEffect(() => {
    if (!loading || !commandDropdownOpen) return undefined;
    const frame = window.requestAnimationFrame(() => setCommandDropdownOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [commandDropdownOpen, loading]);

  // Stable, header-owned element the composer is portaled into; we move it in and
  // out of the page-owned slot rather than portaling into the slot directly.
  const [desktopHomeComposerHost, setDesktopHomeComposerHost] = useState<HTMLDivElement | null>(null);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scopePopoverRef = useRef<HTMLDivElement | null>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
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
  const activeQuickFilterCount =
    (scopeFilters.sourceStatuses?.length ? 1 : 0) + (scopeFilters.locality ? 1 : 0) + activeLabelFilterCount;
  const submitLabel = trimmedQuery ? selectedSearch.submitBusyLabel : selectedSearch.submitIdleLabel;
  // One task-oriented placeholder per mode (PT-14): the follow-up composer must
  // not swap to brand copy that hides what the input actually does.
  const queryPlaceholder = composerPlaceholder ?? selectedSearch.placeholder;
  const SelectedAppModeIcon = appModeIcons[selectedAppMode.id];
  const actionMenuModeOptions = useMemo<ModeActionModeOption[]>(
    () =>
      visibleAppModeOptions.map((mode) => ({
        id: mode.id,
        label: mode.label,
        description: mode.id === "answer" ? "Source-backed mode" : mode.description,
        icon: appModeIcons[mode.id],
      })),
    [visibleAppModeOptions],
  );
  const actionMenuSetId: ModeActionSetId =
    searchMode === "prescribing"
      ? "prescribing"
      : searchMode === "forms"
        ? "forms"
        : searchMode === "services"
          ? "services"
          : searchMode === "documents"
            ? "documents"
            : searchMode === "favourites"
              ? "favourites"
              : searchMode === "differentials"
                ? "differentials"
                : searchMode === "specifiers"
                  ? "specifiers"
                  : searchMode === "tools"
                    ? "tools"
                    : "answer";
  const actionMenuItems = modeActionItemsFor(actionMenuSetId);
  const actionMenuTitle = selectedAppMode.label;
  const actionMenuSubtitle = searchMode === "answer" ? "Source-backed mode" : selectedAppMode.description;
  const actionMenuButtonLabel = `Open ${selectedAppMode.label.toLowerCase()} options`;
  const useMobileBackControl = mobileLeadingAction === "back";

  function currentUsesScopeSheet() {
    return window.matchMedia(scopeSheetMediaQuery).matches;
  }

  function currentUsesPhoneSearchLayout() {
    return window.matchMedia(phoneSearchLayoutMediaQuery).matches;
  }

  function openScopePicker() {
    setActionMenuOpen(false);
    setModeMenuOpen(false);
    const nextUsesScopeSheet = currentUsesScopeSheet();
    setScopeSheetFullscreen(currentUsesPhoneSearchLayout());
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
    if (actionId === "medication-escalation") {
      onQueryModeChange("escalation_criteria");
      onQueryChange(trimmedQuery || "acamprosate escalation criteria");
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
    if (actionId === "services-documents") {
      onSearchModeChange("documents");
      onQueryChange(trimmedQuery || "service referral guidance");
      return;
    }
    if (actionId === "forms-records") {
      onSearchModeChange("forms");
      onQueryChange("");
      return;
    }
    if (actionId === "forms-documents") {
      onSearchModeChange("documents");
      onQueryChange(trimmedQuery || "clinical form guidance");
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
    if (actionId === "specifiers-search") {
      onSearchModeChange("specifiers");
      return;
    }
    if (actionId === "specifiers-builder") {
      window.location.assign("/specifiers/builder");
      return;
    }
    if (actionId === "specifiers-compare") {
      window.location.assign("/specifiers/compare");
      return;
    }
    if (actionId === "specifiers-map") {
      window.location.assign("/specifiers/map");
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

  function selectAppModeById(modeId: string) {
    const mode = visibleAppModeOptions.find((option) => option.id === modeId);
    if (mode) selectAppMode(mode);
  }

  const selectedModeIndex = Math.max(
    0,
    visibleAppModeOptions.findIndex((mode) => mode.id === selectedAppMode.id),
  );

  // Both the hero-portal composer and the default composer bind the caller's
  // queryInputRef. During home <-> result transitions the two briefly coexist,
  // and React nulls a plain shared ref when the outgoing composer unmounts —
  // clobbering the surviving input's binding (quote follow-up focus broke).
  // A cleanup-function ref only clears the binding it still owns.
  const bindQueryInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      if (!element || !queryInputRef) return undefined;
      queryInputRef.current = element;
      return () => {
        if (queryInputRef.current === element) queryInputRef.current = null;
      };
    },
    [queryInputRef],
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

  const restoreActionMenuFocusRef = useRef(false);
  const closeScope = useCallback((restoreFocus = false) => {
    restoreActionMenuFocusRef.current = restoreFocus;
    setScopeOpen(false);
  }, []);

  useEffect(() => {
    if (scopeOpen || !restoreActionMenuFocusRef.current) return;
    restoreActionMenuFocusRef.current = false;
    window.requestAnimationFrame(() => {
      actionMenuTriggerRef.current?.focus({ preventScroll: true });
    });
  }, [scopeOpen]);

  const closeScopeSheet = useCallback(() => {
    setScopeSheetOpen(false);
    window.requestAnimationFrame(() => actionMenuTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const scopeMediaQuery = window.matchMedia(scopeSheetMediaQuery);
    const phoneMediaQuery = window.matchMedia(phoneSearchLayoutMediaQuery);
    const sync = () => {
      setUsesScopeSheet(scopeMediaQuery.matches);
      setUsesPhoneSearchLayout(phoneMediaQuery.matches);
    };
    sync();
    scopeMediaQuery.addEventListener("change", sync);
    phoneMediaQuery.addEventListener("change", sync);
    return () => {
      scopeMediaQuery.removeEventListener("change", sync);
      phoneMediaQuery.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    onScopeOpenChange?.(scopeOpen || scopeSheetOpen);
  }, [onScopeOpenChange, scopeOpen, scopeSheetOpen]);

  useEffect(() => {
    if (!desktopHomeComposerSlotId) {
      // No hero slot at this route: reset the portal state. Deferred to a
      // microtask (not requestAnimationFrame) so it stays off the synchronous
      // effect body without being frame-gated — headless CI can starve rAF.
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setDesktopHomeComposerActive(false);
        setDesktopHomeComposerFallback(false);
        setDesktopHomeComposerHost(null);
      });
      return () => {
        cancelled = true;
      };
    }

    // The composer is portaled into a stable host we own, and we move that host
    // in and out of the page-owned slot as it appears/disappears. The slot is
    // rendered by mode-home pages and unmounts on navigation; portaling directly
    // into it made React reconcile the portal against a container that another
    // part of the tree had already removed, throwing a null-parentNode error.
    // Because the host is stable, React's portal container never disappears.
    // The slot is used at every viewport width — phones included — so mode
    // homes keep the composer in the middle of the hero instead of docking it
    // to the bottom edge.
    const host = document.createElement("div");
    // Layout-transparent so the composer lays out as a direct child of the slot.
    host.style.display = "contents";

    const mediaQuery = window.matchMedia(
      desktopHomeComposerSlotId ? modeHomeComposerMediaQuery : desktopHomeComposerMediaQuery,
    );

    let retryTimeout: number | null = null;
    let portalRetryCount = 0;
    // Runs synchronously off the MutationObserver (which already coalesces
    // records into a microtask) rather than behind requestAnimationFrame.
    // Headless CI throttles/pauses rAF whenever the page is not actively
    // compositing, which stalled portal activation for seconds and made the
    // hero composer flake out of the mode-home slot. A microtask-driven sync
    // settles the portal on the same tick the slot mounts, no frame required.
    const syncTarget = () => {
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      const slot = mediaQuery.matches ? document.getElementById(desktopHomeComposerSlotId) : null;
      if (slot) {
        portalRetryCount = 0;
        if (host.parentNode !== slot) slot.appendChild(host);
        setDesktopHomeComposerHost(host);
        setDesktopHomeComposerActive(true);
        setDesktopHomeComposerFallback(false);
      } else {
        host.parentNode?.removeChild(host);
        setDesktopHomeComposerActive(false);
        if (mediaQuery.matches && portalRetryCount < 24) {
          portalRetryCount += 1;
          retryTimeout = window.setTimeout(syncTarget, Math.min(40 * portalRetryCount, 400));
        } else {
          // The composer belongs inline at this width, or the slot never
          // appeared within the retry budget: release the inline fallback so
          // the search cannot vanish. The MutationObserver keeps watching, so
          // a slot that shows up later still reclaims the portal.
          setDesktopHomeComposerFallback(true);
        }
      }
    };

    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    syncTarget();
    mediaQuery.addEventListener("change", syncTarget);
    return () => {
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
      observer.disconnect();
      mediaQuery.removeEventListener("change", syncTarget);
      host.parentNode?.removeChild(host);
      setDesktopHomeComposerActive(false);
      setDesktopHomeComposerFallback(false);
      setDesktopHomeComposerHost(null);
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
    refs: [scopePopoverRef, actionMenuTriggerRef],
    restoreFocusRef: actionMenuTriggerRef,
    onDismiss: dismissScope,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMenuOpen(false);
    setCommandDropdownOpen(false);
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
            <span className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              {field.label}
            </span>
            <input
              value={filterText(scopeFilters[field.key])}
              onChange={(event) => updateTextScopeFilter(field.key, event.target.value)}
              placeholder={field.placeholder}
              className="h-tap min-w-0 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--clinical-accent)] focus:ring-4 focus:ring-[color:var(--clinical-accent)]/20"
            />
          </label>
        ))}
      </div>
    );
  }

  function renderDocumentScopeSection() {
    return (
      <section className="min-w-0 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)]">
        <div className="mb-3 grid min-h-[4.25rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--clinical-accent-soft)_72%,var(--surface-lux)_28%)_0%,var(--surface-lux)_72%)] p-3 shadow-[var(--shadow-inset)]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[color:var(--text-heading)]">{scopeSummary}</p>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              {selectedDocumentIds.length
                ? "Only selected documents will be used for the next search."
                : "Search all indexed documents unless you pin specific sources."}
            </p>
          </div>
          <span className="nums shrink-0 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 py-1 text-2xs font-extrabold text-[color:var(--clinical-accent)]">
            {selectedDocumentIds.length ? `${selectedDocumentIds.length} picked` : loadedScopeSummary}
          </span>
        </div>
        <div className="grid gap-2.5">
          <label className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-soft)]"
            />
            <input
              ref={scopeFilterInputRef}
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              data-testid="document-scope-filter"
              aria-label="Filter document scope"
              placeholder="Filter documents by title or file"
              className="h-11 w-full rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] pl-9 pr-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--clinical-accent)] focus:ring-4 focus:ring-[color:var(--clinical-accent)]/20"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClearScope}
              className={cn(
                shellChip,
                selectedDocumentIds.length === 0
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              All documents
            </button>
            {scopeFilter ? (
              <span className="nums rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 py-1 text-2xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
                {matchingDocuments.length} match{matchingDocuments.length === 1 ? "" : "es"}
              </span>
            ) : (
              <span className="rounded-md border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 py-1 text-2xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
                Recently updated first
              </span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto pr-1 polished-scroll">
            <div className="grid gap-1.5">
              {requireScopeFilter && visibleScopeDocuments.length === 0 ? (
                <p className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 py-2 text-sm font-medium text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
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
                      "grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition motion-safe:duration-150",
                      selected
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] text-[color:var(--text)] hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded-md border",
                        selected
                          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                          : "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]",
                      )}
                      aria-hidden
                    >
                      {selected ? <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{documentScopeTitle(document)}</span>
                      <span className="nums block truncate text-2xs font-medium text-[color:var(--text-soft)]">
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
                      <span className="rounded-md bg-[color:var(--clinical-accent-soft)] px-2 py-1 text-2xs font-bold text-[color:var(--clinical-accent)]">
                        In scope
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {!requireScopeFilter && visibleScopeDocuments.length === 0 && documents.length > 0 ? (
                <p className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 py-2 text-sm font-medium text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
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
    );
  }

  function renderScopeRows() {
    return (
      <div className="grid gap-3">
        {renderDocumentScopeSection()}
        <details className="group min-w-0 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-soft)] sm:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[color:var(--text-heading)]">
            <span>Refine search</span>
            <span className="flex items-center gap-2">
              <span className="nums rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-1 text-2xs font-bold text-[color:var(--clinical-accent)]">
                {activeQuickFilterCount ? `${activeQuickFilterCount} active` : "Optional"}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-3.5 w-3.5 text-[color:var(--clinical-accent)] transition group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="grid gap-2.5 border-t border-[color:var(--border-lux)] p-3">
            <label className="grid gap-1">
              <span className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Search intent
              </span>
              <select
                value={queryMode}
                onChange={(event) => onQueryModeChange(event.target.value as ClinicalQueryMode)}
                aria-label="Clinical query mode"
                className="h-tap rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2.5 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--clinical-accent)] focus:ring-4 focus:ring-[color:var(--clinical-accent)]/20"
              >
                {queryModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                  Status
                </span>
                <select
                  value={scopeFilters.sourceStatuses?.[0] ?? ""}
                  aria-label="Source status filter"
                  onChange={(event) =>
                    onScopeFiltersChange({
                      ...scopeFilters,
                      sourceStatuses: event.target.value
                        ? [event.target.value as NonNullable<SearchScopeFilters["sourceStatuses"]>[number]]
                        : [],
                    })
                  }
                  className="h-tap min-w-0 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--clinical-accent)] focus:ring-4 focus:ring-[color:var(--clinical-accent)]/20"
                >
                  <option value="">Any status</option>
                  <option value="current">Current</option>
                  <option value="review_due">Review due</option>
                  <option value="outdated">Outdated</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                  Locality
                </span>
                <select
                  value={scopeFilters.locality ?? ""}
                  aria-label="Locality filter"
                  onChange={(event) =>
                    onScopeFiltersChange({
                      ...scopeFilters,
                      locality: event.target.value ? (event.target.value as SearchScopeFilters["locality"]) : undefined,
                    })
                  }
                  className="h-tap min-w-0 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--clinical-accent)] focus:ring-4 focus:ring-[color:var(--clinical-accent)]/20"
                >
                  <option value="">Any locality</option>
                  <option value="local">Local only</option>
                  <option value="non_local">Non-local only</option>
                </select>
              </label>
            </div>
            <details className="group rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-subtle)]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[color:var(--text-heading)]">
                <span>Advanced labels</span>
                <span className="flex items-center gap-2 text-2xs font-bold text-[color:var(--text-muted)]">
                  {activeLabelFilterCount ? `${activeLabelFilterCount} active` : "Medication, site, risk"}
                  <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="grid gap-2 border-t border-[color:var(--border-lux)] p-2.5">
                {renderLabelScopeFilterGrid(true)}
              </div>
            </details>
            {activeQuickFilterCount ? (
              <button
                type="button"
                onClick={() => onScopeFiltersChange({})}
                className={cn(floatingControl, "px-3 text-xs lg:min-h-9")}
              >
                Clear refine filters
              </button>
            ) : null}
          </div>
        </details>
        <details className="group hidden min-w-0 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5 sm:block">
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-0.5 lg:min-h-8">
            <span className={eyebrowText}>Label filters</span>
            <span className="flex items-center gap-2 text-2xs font-semibold text-[color:var(--text-soft)]">
              {activeLabelFilterCount ? `${activeLabelFilterCount} active` : "Medication, site, action, intent"}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="mt-2 grid gap-2 border-t border-[color:var(--border)] pt-2">
            {renderLabelScopeFilterGrid(false)}
            <button
              type="button"
              onClick={() => onScopeFiltersChange({})}
              className={cn(floatingControl, "w-fit px-3 text-xs lg:min-h-9")}
            >
              Clear refine filters
            </button>
          </div>
        </details>
      </div>
    );
  }

  function renderSearchComposer(placement: "default" | "desktop-home") {
    const isDesktopHomeComposer = placement === "desktop-home";
    const usesAnswerFooterStyle = isAnswerFooterComposer && !isDesktopHomeComposer;
    const usesMobileBottomStyle = isMobileBottomComposer && !isDesktopHomeComposer;
    const usesCompactMobileBottomStyle = usesMobileBottomStyle && mobileBottomSearchVariant === "compact";
    const usesBottomComposerPlacement = usesAnswerFooterStyle || (usesMobileBottomStyle && usesPhoneSearchLayout);
    // Sticky-top result composers (tablet+) share the footer chip layout so the
    // pill + chip row looks identical across homes, results, and the answer dock.
    const usesFooterChipLayout = usesBottomComposerPlacement || isDesktopHomeComposer || usesMobileBottomStyle;
    // Keep footer suggestion chips on tablet/desktop; phones reach the same actions via "+".
    const showFooterSearchChips = usesFooterChipLayout && !usesPhoneSearchLayout;
    const usesSendAffordance = searchMode === "answer" || usesFooterChipLayout;
    const usesModeIdentityAffordance = usesBottomComposerPlacement && !usesSendAffordance;
    const ModeIdentityIcon = appModeIcons[searchMode];
    const hasScopeFooterChip = searchMode === "answer" || searchMode === "documents" || searchMode === "forms";
    const usesPhoneFooterDock = usesBottomComposerPlacement && usesPhoneSearchLayout;
    const shouldHideBottomOnScroll = Boolean(hideOnScroll && usesPhoneFooterDock);
    // Phone submitted non-answer result docks reserve pill-only scroll
    // clearance (ClinicalDashboard <main> margins / global-search-shell
    // mobileComposerReserve), so an extra notice line would push the fixed
    // dock over the last result. Those flows already showed the notice on
    // their entry composer; answer docks keep it (their reserves were sized
    // for the old taller notice-above-pill stack).
    const showsComposerPrivacyNotice = searchMode === "answer" || !usesPhoneFooterDock;

    const commandSurfacePlacement = usesBottomComposerPlacement ? "bottom-dock" : "inline";

    return (
      <form
        onSubmit={submit}
        data-footer-variant={usesPhoneFooterDock ? (usesCompactMobileBottomStyle ? "compact" : "default") : undefined}
        data-footer-addon={usesPhoneFooterDock && mobileBottomSearchAddonSlotId ? "differentials-compare" : undefined}
        data-command-open={
          // Phones never show the command dropdown, so the dock scrim must not
          // grow for it — gate the open attribute to widths that can display it.
          usesBottomComposerPlacement && !usesPhoneSearchLayout && commandDropdownOpen ? "true" : undefined
        }
        data-scroll-hidden={shouldHideBottomOnScroll && bottomComposerHidden ? "true" : undefined}
        {...(shouldHideBottomOnScroll ? composerFocusProps : undefined)}
        className={cn(
          isDesktopHomeComposer
            ? "universal-home-search-edge mx-auto w-full"
            : usesAnswerFooterStyle
              ? "floating-composer-edge dashboard-composer-edge fixed bottom-0 z-40 mx-auto max-w-3xl lg:max-w-4xl"
              : usesMobileBottomStyle
                ? cn(
                    usesPhoneFooterDock
                      ? "document-mobile-search-edge universal-top-search-edge fixed z-40 w-full"
                      : cn(
                          "document-mobile-search-edge universal-top-search-edge fixed z-40 mx-auto max-w-3xl sm:z-20 sm:w-full sm:px-4 sm:py-3 lg:max-w-4xl",
                          isHeroDesktopComposer
                            ? "sm:hidden"
                            : "sm:sticky sm:top-[calc(4.75rem+env(safe-area-inset-top))]",
                        ),
                  )
                : "universal-top-search-edge sticky top-[calc(4.75rem+env(safe-area-inset-top))] z-20 mx-auto box-border w-full px-3 py-3 sm:px-4",
          usesBottomComposerPlacement && "answer-footer-search-edge",
          usesPhoneFooterDock && "answer-footer-search-dock",
          usesCompactMobileBottomStyle && "document-mobile-search-compact",
          showFooterSearchChips && "flex flex-col items-center gap-2.5",
          shouldHideBottomOnScroll &&
            "max-sm:transition-transform max-sm:duration-200 max-sm:ease-out motion-reduce:transition-none",
        )}
      >
        {usesBottomComposerPlacement ? <div className="answer-footer-search-backdrop" aria-hidden="true" /> : null}
        {usesPhoneFooterDock && mobileBottomSearchAddonSlotId ? (
          <div
            id={mobileBottomSearchAddonSlotId}
            className="differentials-mobile-search-addon relative z-10 w-full empty:hidden"
          />
        ) : null}
        {usesPhoneFooterDock &&
        searchMode === "answer" &&
        composerFollowUpSuggestions?.length &&
        onPickComposerFollowUpSuggestion ? (
          <AnswerFollowUpSuggestions
            suggestions={composerFollowUpSuggestions}
            onPick={onPickComposerFollowUpSuggestion}
            disabled={composerFollowUpSuggestionsDisabled}
            testId="answer-composer-follow-up-suggestions"
            layout="scroll"
            className="answer-suggestion-row-composer-followups relative z-10 w-full sm:hidden"
          />
        ) : null}
        <UniversalSearchCommandSurface
          modeId={searchMode}
          query={query}
          recentQueries={recentQueries}
          commandScopes={commandScopes}
          placement={commandSurfacePlacement}
          dropdownOpen={commandDropdownOpen}
          onDropdownOpenChange={setCommandDropdownOpen}
          onQueryChange={onQueryChange}
          onSearch={onAsk}
          onPickRecent={(recent) => {
            onQueryChange(recent);
            if (onPickRecent) {
              onPickRecent(recent);
              return;
            }
            onAsk();
          }}
          onCrossMode={(targetMode, crossQuery) => {
            if (onCrossModeSearch) {
              onCrossModeSearch(targetMode, crossQuery);
              return;
            }
            onQueryChange(crossQuery);
            onSearchModeChange(targetMode);
            onAsk();
          }}
          onRunModeAction={runModeAction}
          onCommandScopesChange={(scopes) => onCommandScopesChange?.(scopes)}
          onListboxIdReady={setCommandListboxId}
          onFocusSearchInput={() => queryInputRef?.current?.focus()}
        >
          <div
            data-menu-placement={actionMenuOpen ? actionMenuPlacement : undefined}
            className={cn(
              chatComposerShellBase,
              "answer-footer-search-pill relative z-10 w-full",
              actionMenuOpen && "answer-footer-search-pill-open",
              commandDropdownOpen && "answer-footer-search-pill-open",
            )}
          >
            <ModeActionPopup
              open={actionMenuOpen}
              title={actionMenuTitle}
              titleIcon={SelectedAppModeIcon}
              subtitle={actionMenuSubtitle}
              buttonLabel={actionMenuButtonLabel}
              items={actionMenuItems}
              modeOptions={actionMenuModeOptions}
              selectedModeId={selectedAppMode.id}
              onOpenChange={setActionMenuOpen}
              onBeforeOpen={() => {
                setUsesScopeSheet(currentUsesScopeSheet());
                setModeMenuOpen(false);
                setScopeOpen(false);
              }}
              onAction={runModeAction}
              onModeSelect={selectAppModeById}
              onPlacementChange={setActionMenuPlacement}
              triggerClassName="answer-footer-search-action"
              triggerRef={actionMenuTriggerRef}
              integrated={usesFooterChipLayout}
              integratedChipRow={showFooterSearchChips}
              useSheet={usesScopeSheet}
              dismissIgnoreRefs={[modeMenuRef]}
            />

            {/* The clear button is a flex sibling (not absolutely positioned): the
              unlayered .answer-footer-search-input padding beats a conditional
              pr-* utility, which let text run under an overlaid button. */}
            <label className="flex min-w-0 flex-1 items-center overflow-hidden">
              <input
                ref={bindQueryInputRef}
                data-testid="global-search-input"
                autoFocus={queryInputAutoFocus}
                value={query}
                enterKeyHint="search"
                inputMode="search"
                role="combobox"
                aria-expanded={commandDropdownOpen}
                aria-controls={commandDropdownOpen ? commandListboxId : undefined}
                aria-autocomplete="list"
                aria-describedby={showsComposerPrivacyNotice ? composerPrivacyWarningId : undefined}
                // React's onChange already fires on every input event; a duplicate
                // onInput called onQueryChange twice per keystroke, doubling the
                // controlled-state work on a large parent tree.
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAsk();
                }}
                aria-label={`Search indexed guidelines by question or keyword - ${selectedSearch.inputAriaLabel}`}
                placeholder={queryPlaceholder}
                className={cn(chatComposerInput, "w-full min-w-0", "answer-footer-search-input")}
              />
              {query && (
                <button
                  type="button"
                  onClick={onClearQuery}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]"
                  aria-label="Clear search question"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </label>
            <span className="answer-footer-search-divider" aria-hidden="true" />
            <button
              type="submit"
              disabled={!canAsk}
              title={
                !realDataReady && !canRunLocalSearch
                  ? "Search setup not ready"
                  : trimmedQuery.length < 1
                    ? selectedSearch.emptyTitle
                    : selectedSearch.readyTitle
              }
              className={cn(chatSendButton, "answer-footer-search-send")}
              aria-label={selectedSearch.submitAriaLabel}
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : usesSendAffordance ? (
                <Send aria-hidden="true" className="h-4 w-4" />
              ) : usesModeIdentityAffordance ? (
                <ModeIdentityIcon className="size-icon-lg" />
              ) : (
                <Search aria-hidden="true" className="size-icon-lg" />
              )}
              <span className="sr-only">{submitLabel}</span>
            </button>
          </div>
        </UniversalSearchCommandSurface>
        {/* Single site-wide APP-5 privacy line: every composer variant (home
            hero, answer dock, sticky search) renders exactly one compact
            notice below the pill; no other surface may duplicate it. Phone
            non-answer result docks skip it — see showsComposerPrivacyNotice. */}
        {showsComposerPrivacyNotice ? (
          <PrivacyInputNotice
            id={composerPrivacyWarningId}
            testId={composerPrivacyWarningId}
            className="mt-1.5 justify-center px-3 text-center"
          />
        ) : null}
        {/* Scope popover is a form sibling so the "+" menu's "Set scope" action can
            open it even when the footer chip row is not shown. */}
        {hasScopeFooterChip && !usesScopeSheet && scopeOpen ? (
          <div
            ref={scopePopoverRef}
            data-testid="scope-command-popover"
            className="polished-scroll absolute bottom-[calc(100%+0.75rem)] right-2 z-50 max-h-[min(70dvh,28rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-2.5 pb-2.5 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl motion-safe:animate-pop-in"
          >
            {scopePreview ? (
              <p className="truncate px-1 text-xs text-[color:var(--text-soft)]">{scopePreview}</p>
            ) : null}
            {renderScopeRows()}
          </div>
        ) : null}
        <Sheet
          open={usesScopeSheet && scopeSheetOpen}
          onClose={closeScopeSheet}
          title="Document scope"
          description="Choose documents and filters for the next search."
          closeLabel="Close document scope"
          initialFocusRef={scopeFilterInputRef}
          returnFocusRef={actionMenuTriggerRef}
          headerLeading={
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
              <Filter className="h-5 w-5" aria-hidden="true" />
            </span>
          }
          headerClassName="bg-[color:var(--surface-lux)] px-4 py-3 sm:px-5 sm:py-4"
          closeButtonClassName="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          contentClassName={cn(
            "bg-[color:var(--surface-lux)]",
            scopeSheetFullscreen ? "max-h-dvh" : "max-h-[min(84dvh,42rem)]",
            "sm:max-h-[min(88dvh,44rem)] sm:max-w-xl",
          )}
          bodyClassName={cn(
            "p-3 sm:p-4",
            scopeSheetFullscreen ? "bg-[color:var(--background)]" : "bg-[color:var(--surface-subtle)]",
          )}
          mobilePlacement={scopeSheetFullscreen ? "fullscreen" : "bottom"}
          portal={scopeSheetFullscreen}
        >
          <div
            data-testid={usesScopeSheet ? "scope-command-popover" : undefined}
            className={cn(
              "grid gap-3",
              usesScopeSheet && "polished-scroll max-h-[min(70dvh,28rem)] overflow-y-auto overscroll-contain pr-1",
            )}
          >
            {scopePreview ? (
              <p className="truncate px-1 text-xs text-[color:var(--text-soft)]">{scopePreview}</p>
            ) : null}
            {renderScopeRows()}
          </div>
        </Sheet>
      </form>
    );
  }

  const hideStrategy = hideOnScroll?.strategy;
  // Overlay hosts that opt into all breakpoints take the header fully out of
  // flow (absolute over the scrolling <main>, which reserves matching top
  // padding) so content frosts under the glass bar at every width.
  const overlayAllBreakpoints = hideStrategy === "overlay" && Boolean(hideOnScroll?.allBreakpoints);
  const chromeFocusProps = hideOnScroll
    ? {
        onFocusCapture: () => setHeaderChromeFocused(true),
        onBlurCapture: (event: ReactFocusEvent<HTMLElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeaderChromeFocused(false);
        },
      }
    : undefined;
  const composerFocusProps = hideOnScroll
    ? {
        onFocusCapture: () => setComposerChromeFocused(true),
        onBlurCapture: (event: ReactFocusEvent<HTMLElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setComposerChromeFocused(false);
        },
      }
    : undefined;

  const headerAndComposer = (
    <>
      <header
        id="search"
        data-scroll-hidden={hideStrategy === "overlay" && headerChromeHidden ? "true" : undefined}
        className={cn(
          // No backdrop-filter on the header itself: it would form a backdrop
          // root and starve the .edge-glass-header-backdrop scrim (the single
          // source of the bar's frost) of the real page behind it.
          "edge-glass-header universal-header z-30 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[color:var(--text)]",
          // Collapse hosts keep the header above an internally scrolling <main>, so
          // sticky is unnecessary on phones and fights the 0fr grid collapse by
          // pinning the bar inside the viewport. All-breakpoints overlay hosts take
          // the header out of flow entirely (absolute over the padded <main>) —
          // sticky would be inert there because the scroll container is <main>, not
          // an ancestor of the header. Legacy overlay hosts keep sticky (they ride
          // document scroll) and can translate away with zero layout shift.
          hideStrategy === "collapse"
            ? "max-sm:relative sm:sticky sm:top-0"
            : overlayAllBreakpoints
              ? "absolute inset-x-0 top-0"
              : "sticky top-0",
          // Overlay hide-on-scroll: a plain translate reveals the content already
          // flowing beneath it. No transform is applied while visible so the
          // fixed-position mobile mode menu keeps the viewport as its containing block.
          hideStrategy === "overlay" &&
            (overlayAllBreakpoints
              ? "transition-transform duration-200 ease-out motion-reduce:transition-none"
              : "max-sm:transition-transform max-sm:duration-200 max-sm:ease-out motion-reduce:transition-none"),
          hideStrategy === "overlay" &&
            headerChromeHidden &&
            (overlayAllBreakpoints ? "-translate-y-full" : "max-sm:-translate-y-full"),
        )}
        {...(hideStrategy === "overlay" ? chromeFocusProps : undefined)}
      >
        <div className="edge-glass-header-backdrop" aria-hidden="true" />
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
                // From md the desktop icon rail owns navigation, so the drawer
                // trigger is phone-only outside workflow headers.
                isWorkflowHeader ? "grid" : "grid md:hidden",
              )}
              aria-label={useMobileBackControl ? "Back to differentials home" : "Open Clinical Guide menu"}
            >
              {useMobileBackControl ? (
                <ArrowLeft aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
            {isServicesMode ? (
              <div className="hidden min-w-0 items-center gap-3 lg:flex">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-extrabold leading-5 text-[color:var(--text-heading)]">
                    Services Navigator
                  </span>
                  <span className="block truncate text-xs font-semibold text-[color:var(--text-muted)]">
                    Psychiatry referral directory
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          <div
            ref={modeMenuRef}
            className={cn("relative z-[60] min-w-0", isWorkflowHeader ? "justify-self-start" : "justify-self-center")}
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
                "universal-header-mode-button inline-grid h-12 w-[min(13rem,calc(100vw-11.5rem))] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-auto sm:min-w-[13rem] sm:pr-3",
                isWorkflowHeader && "h-11 w-[min(11rem,calc(100vw-11rem))] sm:w-[12rem] sm:min-w-0 lg:w-[12.5rem]",
              )}
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              aria-controls={modeMenuOpen ? "app-mode-menu" : undefined}
              aria-label={`Mode ${selectedAppMode.label}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]">
                <SelectedAppModeIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="hidden truncate text-2xs font-extrabold uppercase leading-3 tracking-[0.08em] text-[color:var(--text-muted)] sm:block">
                  Mode
                </span>
                <span className="block truncate text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
                  {selectedAppMode.label}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
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
                className="polished-scroll fixed left-[max(0.5rem,var(--safe-area-left))] right-[max(0.5rem,var(--safe-area-right))] top-[calc(4.25rem+env(safe-area-inset-top))] z-50 max-h-[min(20rem,calc(100dvh-5.5rem))] overflow-y-auto rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-1.5 text-[color:var(--text)] shadow-[var(--shadow-lux)] ring-1 ring-white/25 backdrop-blur-md dark:ring-white/10 sm:absolute sm:left-0 sm:right-auto sm:top-[calc(100%+0.5rem)] sm:w-[min(21rem,calc(100vw-2rem))]"
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
                        <span className="block truncate text-2xs font-medium text-[color:var(--text-soft)]">
                          {mode.description}
                        </span>
                      </span>
                      {active ? (
                        <Check aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="relative flex min-w-0 shrink-0 items-center justify-end gap-1.5 justify-self-end sm:gap-2">
            {isWorkflowHeader ? (
              <>
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
              </>
            ) : null}
            {!isWorkflowHeader ? (
              <button
                type="button"
                onClick={onNewChat}
                className="universal-header-icon-control inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] xl:w-auto xl:px-3 xl:text-xs xl:font-semibold xl:text-[color:var(--text)]"
                aria-label="Start a new chat"
                title="New chat"
              >
                <MessageSquarePlus aria-hidden="true" className="h-5 w-5 xl:h-4 xl:w-4" />
                <span className="hidden whitespace-nowrap xl:inline">New chat</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {searchComposerVisible ? (
        <>
          {(desktopHomeComposerActive && desktopHomeComposerHost) ||
          (desktopHomeComposerSlotId && !desktopHomeComposerFallback)
            ? null
            : renderSearchComposer("default")}
          {desktopHomeComposerActive && desktopHomeComposerHost
            ? createPortal(renderSearchComposer("desktop-home"), desktopHomeComposerHost)
            : null}
        </>
      ) : null}
    </>
  );

  if (hideStrategy === "collapse") {
    // Collapse hide-on-scroll (phones): the host renders the header above an
    // internally scrolling element, so hiding must also release the header's
    // layout space. A 1fr -> 0fr grid row animates the collapse without any
    // height measurement; the bottom-anchored inner track makes the chrome
    // slide up out of the viewport top. Fixed-position composers (answer
    // footer, mobile bottom search) escape the wrapper naturally because it
    // never carries a transform, and everything is inert from sm up.
    return (
      <div
        data-scroll-hidden={headerChromeHidden ? "true" : undefined}
        data-testid="universal-header-collapse"
        className={cn(
          "max-sm:grid max-sm:transition-[grid-template-rows] max-sm:duration-200 max-sm:ease-out motion-reduce:transition-none",
          headerChromeHidden ? "max-sm:[grid-template-rows:0fr]" : "max-sm:[grid-template-rows:1fr]",
        )}
        {...chromeFocusProps}
      >
        <div
          className={cn(
            "max-sm:flex max-sm:min-h-0 max-sm:flex-col max-sm:justify-end",
            // Clip only while hiding so the edge-glass-header gradient that
            // extends below the header keeps painting when the chrome is shown.
            headerChromeHidden && "max-sm:overflow-hidden",
          )}
        >
          {headerAndComposer}
        </div>
      </div>
    );
  }

  return headerAndComposer;
}
