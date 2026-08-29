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
import { useRouter } from "next/navigation";

import {
  Check,
  CircleCheck,
  ChevronDown,
  FileText,
  Filter,
  Loader2,
  Layers3,
  Menu,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { PrivacyInputNotice } from "@/components/privacy-input-notice";
import { restoreFocusUnlessMoved, useDismissableLayer } from "@/components/use-dismissable-layer";
import { useHideOnScroll } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { useEventCallback } from "@/components/clinical-dashboard/use-event-callback";
import { useLastAppMode } from "@/components/clinical-dashboard/use-last-app-mode";
import { BrandMark } from "@/components/clinical-dashboard/brand";
import { PhoneFooterLayerPortal } from "@/components/clinical-dashboard/phone-footer-layer-portal";
import { AnswerFollowUpSuggestions } from "@/components/clinical-dashboard/answer-follow-up-suggestions";
import { SearchPinsMenu } from "@/components/clinical-dashboard/search-pins-menu";
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
  fieldControlPlain,
  fieldControlWithIcon,
  floatingControl,
  glassOverlaySurface,
  shellChip,
  eyebrowText,
} from "@/components/ui-primitives";
import { UniversalSearchCommandSurface } from "@/components/clinical-dashboard/universal-search-command-surface";
import { cleanDisplayTitle } from "@/components/clinical-dashboard/display-text";
import { Sheet } from "@/components/ui/sheet";
import {
  appModeDefinition,
  appModeDefinitions,
  appModeSelectionHref,
  appModeSearchConfig,
  factsheetsTopicsHref,
  isSearchableAppMode,
  visibleAppModeDefinitionsForSession,
  type AppModeId,
} from "@/lib/app-modes";
import { appModeIcons } from "@/lib/app-mode-icons";
import {
  desktopComposerSlotReadyAttr,
  isDesktopComposerSlotReady,
  phoneHeaderCollapseAddonSlotId,
  setModeHomeComposerReservePending,
  type PhoneDockAddonKind,
} from "@/lib/mode-home-composer";
import { resolveScrollBehavior } from "@/lib/scroll-behavior";
import type { CommandSurfacePlacement } from "@/lib/search-command-surface";
import { useCommandDropdownDisplayableByPlacement } from "@/components/clinical-dashboard/use-command-dropdown-displayable";
import type { ClinicalDocument, ClinicalQueryMode } from "@/lib/types";
import { type SearchScopeFilters } from "@/lib/search-scope";
import { tagSearchText } from "@/lib/document-tags";

// Shared between the composer input's aria-describedby and the rendered
// PrivacyInputNotice id/testId so the wiring cannot drift apart.
const composerPrivacyWarningId = "answer-composer-privacy-warning";

const phoneSearchLayoutMediaQuery = "(max-width: 639px)";
const scopeSheetMediaQuery = "(max-width: 1023px)";
const desktopPageComposerMediaQuery = "(min-width: 640px)";
const modeHomeComposerMediaQuery = "(min-width: 0px)";
const modeHomeComposerSmUpMediaQuery = "(min-width: 640px)";

const phoneModeGroups = [
  {
    id: "find",
    label: "Find",
    hint: "Answers, sources, services",
    modeIds: ["answer", "documents", "services", "forms", "favourites"],
  },
  {
    id: "diagnose",
    label: "Diagnose",
    hint: "Criteria, clues, formulation",
    modeIds: ["differentials", "dsm", "specifiers", "formulation"],
  },
  {
    id: "care",
    label: "Care",
    hint: "Medication, calculators, reference, therapy",
    modeIds: ["prescribing", "calculators", "tools", "therapy-compass", "factsheets", "dictionary"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  modeIds: readonly AppModeId[];
}>;

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
  demoMode,
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
  onOpenEvidence,
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenDocumentAdmin,
  canManageDocuments = false,
  onOpenSourcePdf,
  onNewChat,
  onOpenMobileSidebar,
  queryModeOptions,
  queryInputRef,
  queryInputAutoFocus = false,
  composerPlaceholder,
  recentQueries = [],
  onPickRecent,
  onCrossModeSearch,
  composerFollowUpSuggestions,
  onPickComposerFollowUpSuggestion,
  composerFollowUpSuggestionsDisabled = false,
  sharedHomeIdentity = false,
  mobileSearchPlacement = "default",
  mobileBottomSearchVariant = "default",
  mobileHomeComposerPlacement = "hero",
  desktopSearchPlacement = "default",
  searchComposerVisible = true,
  showPhoneSuggestionTickerOnHome = false,
  desktopHomeComposerSlotId,
  desktopPageComposerSlotId,
  heroComposerBreakpoint = "all",
  mobileBottomSearchAddonSlotId,
  mobileBottomSearchAddonKind,
  hideOnScroll,
  onBottomComposerHiddenChange,
  showDesktopNewChat = true,
  canAccessFavourites = false,
  onRequestAccountSetup,
}: {
  demoMode: boolean;
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
  onAsk: (query?: string) => void;
  onClearQuery: () => void;
  onClearScope: () => void;
  onQueryModeChange: (mode: ClinicalQueryMode) => void;
  onScopeFiltersChange: (filters: SearchScopeFilters) => void;
  onToggleScope: (documentId: string) => void;
  onScopeOpenChange?: (open: boolean) => void;
  onOpenEvidence?: () => void;
  onOpenRecentDocuments?: () => void;
  onOpenLibrary?: () => void;
  /** Opens the administrator document/indexing surface. Paired with `canManageDocuments`. */
  onOpenDocumentAdmin?: () => void;
  /** Gates the administrator-only rows in the mode action list. Defaults to hidden. */
  canManageDocuments?: boolean;
  onOpenSourcePdf?: () => void;
  onNewChat?: () => void;
  onOpenMobileSidebar?: () => void;
  queryModeOptions: Array<{ value: ClinicalQueryMode; label: string }>;
  queryInputRef?: RefObject<HTMLInputElement | null>;
  queryInputAutoFocus?: boolean;
  /** Overrides the mode's default input placeholder (e.g. "Ask a follow-up..." mid-thread). */
  composerPlaceholder?: string;
  recentQueries?: string[];
  onPickRecent?: (query: string) => void;
  onCrossModeSearch?: (modeId: AppModeId, query: string) => void;
  composerFollowUpSuggestions?: string[];
  onPickComposerFollowUpSuggestion?: (suggestion: string) => void;
  composerFollowUpSuggestionsDisabled?: boolean;
  /** Keep the product identity stable while `/` retargets between modes. */
  sharedHomeIdentity?: boolean;
  mobileSearchPlacement?: "default" | "bottom";
  /** "compact" drops the phone footer chip row and hugs the bottom edge so
   *  content keeps maximum screen space. Every phone dock uses it now; the
   *  "default" value remains for hosts that need the taller legacy dock. */
  mobileBottomSearchVariant?: "default" | "compact";
  /** Which placement the home hero vs footer uses on phones. Tools uses "footer"
   *  so its search pill sits in the bottom dock like a submitted search while
   *  retaining the home privacy notice. */
  mobileHomeComposerPlacement?: "hero" | "footer";
  /** Show the compact phone suggestion ticker only for standalone-mode homes. */
  showPhoneSuggestionTickerOnHome?: boolean;
  desktopSearchPlacement?: "default" | "hero";
  searchComposerVisible?: boolean;
  /** Mode-home slot the composer portals into so the search pill sits in the
   *  middle of the hero instead of docking to the bottom edge. Which widths the
   *  hero owns is controlled by `heroComposerBreakpoint`. */
  desktopHomeComposerSlotId?: string;
  /** Normal-flow page slot used by submitted/search views from tablet widths up.
   * Phones keep the bottom dock. */
  desktopPageComposerSlotId?: string;
  /** Widths where the mode-home hero slot hosts the composer. "all" keeps the
   *  hero pill on phones too (the answer home); "sm-up" reserves the hero for
   *  sm+ widths and hands phones the compact bottom dock instead. */
  heroComposerBreakpoint?: "all" | "sm-up";
  /** Mobile/tablet slot rendered above the search pill for page-specific composer addons. */
  mobileBottomSearchAddonSlotId?: string;
  /** Which page-owned action occupies the dock addon slot. One at a time. */
  mobileBottomSearchAddonKind?: PhoneDockAddonKind;
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
     * Phone-only motion for collapse-strategy hosts. "collapse" releases the
     * row's layout height; "overlay" keeps the complete phone stack stable and
     * translates it over page content. Defaults to "collapse".
     */
    phoneMotion?: "collapse" | "overlay";
    /**
     * Overlay-only: apply the hide/reveal (and the out-of-flow absolute header)
     * at every breakpoint instead of phones only. The host must reserve
     * matching top padding on its scroll container.
     */
    allBreakpoints?: boolean;
    /**
     * Collapse-only: how the chrome hides above the phone breakpoint. Omitting
     * it keeps the hide/reveal phone-only.
     *
     * "collapse" releases the top bar's layout row at every width — for hosts
     * whose scrollport is an internal element at every width (ClinicalDashboard's
     * `<main>`), where the released strip goes straight to the content.
     *
     * "sticky" pins an outer stack to the viewport top above phones and still
     * collapses only the top-bar row inside that stack — for hosts that hand
     * scrolling back to the document (GlobalSearchShell). Tablet and desktop
     * result search portal into page flow, leaving the stack to own only the
     * top bar.
     */
    wide?: "collapse" | "sticky";
    /** Parent-owned hidden state for hosts that report scroll via React `onScroll`. */
    scrollHidden?: boolean;
  };
  /** Notify hosts when the phone bottom composer is actually hidden (not merely scrolled). */
  onBottomComposerHiddenChange?: (hidden: boolean) => void;
  /** Keep the phone new-chat action, but hide its desktop copy when a visible sidebar already owns the action. */
  showDesktopNewChat?: boolean;
  /**
   * Favourites are account-scoped. When false, omit Favourites from the mode menu
   * and route favourites actions to account setup instead of switching mode.
   * Defaults to false (fail closed) so guests never see Favourites unless the host
   * explicitly grants access from the current session / demo mode.
   */
  canAccessFavourites?: boolean;
  /** Invoked when the user tries to open Favourites without access. */
  onRequestAccountSetup?: () => void;
}) {
  // Hosts pass the precomputed session decision in canAccessFavourites (auth || demo).
  // Do not OR demoMode again here — that would reopen Favourites when props diverge.
  const router = useRouter();
  const [, setLastAppMode] = useLastAppMode();
  const visibleAppModeOptions = visibleAppModeDefinitionsForSession({
    authenticated: canAccessFavourites,
    demoMode: false,
  });
  const trimmedQuery = query.trim();
  const selectedSearch = appModeSearchConfig(searchMode);
  // The trigger names the route the user is viewing. Session filtering still
  // keeps gated modes out of the selectable menu below.
  const selectedAppMode = appModeDefinition(searchMode);
  const selectedSearchable = isSearchableAppMode(searchMode);
  const isAnswerFooterComposer = searchMode === "answer";
  const isServicesMode = searchMode === "services";
  const isMobileBottomComposer = searchComposerVisible && mobileSearchPlacement === "bottom" && !isAnswerFooterComposer;
  const isHeroDesktopComposer = desktopSearchPlacement === "hero" && isMobileBottomComposer;
  // Documents search is API-backed (`requestSourceLibrarySearch`) and
  // `ClinicalDashboard.executeSearch` rejects it when `!canRunSearch`. Only
  // catalogue / namespaced modes whose submit path never hits that gate stay
  // enabled while live data is not ready.
  const canRunLocalSearch =
    selectedSearch.kind === "forms" ||
    selectedSearch.kind === "services" ||
    selectedSearch.kind === "therapies" ||
    selectedSearch.kind === "tools" ||
    selectedSearch.kind === "calculators" ||
    selectedSearch.kind === "favourites" ||
    selectedSearch.kind === "specifiers" ||
    selectedSearch.kind === "formulation" ||
    selectedSearch.kind === "dsm";
  const searchSetupNotReady = !realDataReady && !canRunLocalSearch;
  const canAsk = trimmedQuery.length >= 1 && !loading && selectedSearchable && !searchSetupNotReady;
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
  const [commandActiveItemId, setCommandActiveItemId] = useState<string | null>(null);
  const commandDropdownDisplayableByPlacement = useCommandDropdownDisplayableByPlacement();
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  // Which menuitemradio should receive initial focus when the mode menu opens
  // (keyboard ArrowOpen or the active mode on tap). Shared by the desktop
  // popover and the phone bottom sheet.
  const [modeMenuFocusIndex, setModeMenuFocusIndex] = useState(0);
  const [usesScopeSheet, setUsesScopeSheet] = useState(false);
  // SSR and the first client hydration paint must agree (phone matchMedia is
  // unavailable on the server). Sync from matchMedia after mount; Mode open
  // paths also refresh from the live query so the first tap still picks Sheet.
  const [usesPhoneSearchLayout, setUsesPhoneSearchLayout] = useState(false);
  const [desktopComposerPortalActive, setDesktopComposerPortalActive] = useState(false);
  const [desktopComposerPortalFallback, setDesktopComposerPortalFallback] = useState(false);
  // SSR and first paint assume a declared home slot is media-eligible so the
  // header composer stays suppressed while ModeHomeTemplate reserves hero
  // geometry. The portal effect clears this when the home media query does not
  // match (e.g. future `sm-up` hero + phone dock), so we never blank search
  // for the 8s fallback window on a viewport that never hosts the hero slot.
  const [homeComposerMediaEligible, setHomeComposerMediaEligible] = useState(() => Boolean(desktopHomeComposerSlotId));
  // Phone-only hide-on-scroll: never hide while a header-owned surface is open
  // or while focus sits inside the header chrome (keyboard users must not tab
  // into invisible controls).
  const [headerChromeFocused, setHeaderChromeFocused] = useState(false);
  const [composerChromeFocused, setComposerChromeFocused] = useState(false);
  const [phoneHeaderCollapseAddonHost, setPhoneHeaderCollapseAddonHost] = useState<HTMLDivElement | null>(null);
  const setPhoneHeaderCollapseAddonRef = useCallback((node: HTMLDivElement | null) => {
    setPhoneHeaderCollapseAddonHost(node);
  }, []);
  const internalScrollHidden = useHideOnScroll({
    disabled: !hideOnScroll || hideOnScroll.scrollHidden !== undefined,
  });
  const scrollHidden = hideOnScroll?.scrollHidden !== undefined ? hideOnScroll.scrollHidden : internalScrollHidden;
  const headerCollapseOwnsPhoneAddonFocus = hideOnScroll?.strategy === "collapse";
  // Mode homes portal the composer into the hero slot. With "all" the hero owns
  // every width (the answer home keeps its in-flow pill on phones); "sm-up"
  // hero hosts hand phones the bottom dock instead.
  const heroComposerOwnsPhones = Boolean(desktopHomeComposerSlotId) && heroComposerBreakpoint === "all";
  const phoneBottomSearchDockActive =
    usesPhoneSearchLayout &&
    searchComposerVisible &&
    !heroComposerOwnsPhones &&
    (isAnswerFooterComposer || mobileSearchPlacement === "bottom");
  const hideOnScrollEnabled = Boolean(hideOnScroll);
  // Focus-capture pins can survive dock teardown when React skips blur (portal
  // swap, hero reclaim, breakpoint change). Ignore latched focus unless that
  // surface is still the active hide/reveal owner, then clear the latch async
  // (repo pattern — avoids react-hooks/set-state-in-effect).
  const composerFocusPinsChrome = composerChromeFocused && phoneBottomSearchDockActive && hideOnScrollEnabled;
  const headerFocusPinsChrome = headerChromeFocused && hideOnScrollEnabled;
  // Header and composer share one scroll signal, so any active surface or
  // focus inside either edge pins both edges. This preserves keyboard focus
  // safety without letting the unfocused header disappear above a still-
  // focused composer (or vice versa).
  const sharedChromePinned =
    modeMenuOpen ||
    actionMenuOpen ||
    commandDropdownOpen ||
    scopeOpen ||
    scopeSheetOpen ||
    headerFocusPinsChrome ||
    composerFocusPinsChrome;
  const headerChromeHidden = scrollHidden && !sharedChromePinned;
  // Compare addon chrome lives inside the phone dock; hide/reveal with it so
  // the search pill and Compare selected bar reclaim space together.
  const bottomComposerScrollHiddenActive = Boolean(hideOnScroll && phoneBottomSearchDockActive);
  const bottomComposerHidden = bottomComposerScrollHiddenActive && scrollHidden && !sharedChromePinned;

  useEffect(() => {
    if (phoneBottomSearchDockActive && hideOnScrollEnabled) return;
    queueMicrotask(() => {
      if (!phoneBottomSearchDockActive || !hideOnScrollEnabled) setComposerChromeFocused(false);
      if (!hideOnScrollEnabled) setHeaderChromeFocused(false);
    });
  }, [phoneBottomSearchDockActive, hideOnScrollEnabled]);

  useEffect(() => {
    const addonHost = phoneHeaderCollapseAddonHost;
    const clearHeaderFocus = () => setHeaderChromeFocused(false);
    if (!addonHost || !hideOnScrollEnabled || !headerCollapseOwnsPhoneAddonFocus) {
      queueMicrotask(clearHeaderFocus);
      return undefined;
    }

    // React portal focus events follow the source React tree, not the portal
    // host's synthetic-event ancestry. Listen at the real DOM host so focused
    // page-owned controls pin the same collapse track as the universal bar.
    const hostContainsActiveElement = () => {
      const activeElement = document.activeElement;
      return activeElement instanceof Node && addonHost.contains(activeElement);
    };
    const clearIfFocusLeftHost = () => {
      if (!hostContainsActiveElement()) setHeaderChromeFocused(false);
    };
    const handleFocusIn = () => setHeaderChromeFocused(true);
    const handleFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (!(nextTarget instanceof Node) || !addonHost.contains(nextTarget)) {
        setHeaderChromeFocused(false);
      }
    };
    queueMicrotask(() => setHeaderChromeFocused(hostContainsActiveElement()));
    const observer = new MutationObserver(clearIfFocusLeftHost);
    observer.observe(addonHost, { childList: true, subtree: true });

    addonHost.addEventListener("focusin", handleFocusIn);
    addonHost.addEventListener("focusout", handleFocusOut);
    return () => {
      addonHost.removeEventListener("focusin", handleFocusIn);
      addonHost.removeEventListener("focusout", handleFocusOut);
      observer.disconnect();
      queueMicrotask(clearHeaderFocus);
    };
  }, [headerCollapseOwnsPhoneAddonFocus, hideOnScrollEnabled, phoneHeaderCollapseAddonHost]);

  useEffect(() => {
    onBottomComposerHiddenChange?.(bottomComposerHidden);
  }, [bottomComposerHidden, onBottomComposerHiddenChange]);

  useEffect(() => {
    if (!loading || !commandDropdownOpen) return undefined;
    const frame = window.requestAnimationFrame(() => setCommandDropdownOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [commandDropdownOpen, loading]);

  // Stable, header-owned element the composer is portaled into; we move it in and
  // out of the page-owned slot rather than portaling into the slot directly.
  const [desktopComposerPortalHost, setDesktopComposerPortalHost] = useState<HTMLDivElement | null>(null);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const phoneModeMenuListRef = useRef<HTMLDivElement | null>(null);
  const modeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingModeSelectionFocusRef = useRef<AppModeId | null>(null);
  const prefetchedModeHrefsRef = useRef(new Set<string>());
  const scopePopoverRef = useRef<HTMLDivElement | null>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuSheetReturnFocusRef = useRef<HTMLElement | null>(null);
  const scopeFilterInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const selectedDocumentIdSet = useMemo(() => new Set(selectedDocumentIds), [selectedDocumentIds]);
  const documentById = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const selectedDocuments = useMemo(
    () =>
      selectedDocumentIds
        .map((id) => documentById.get(id))
        .filter((document): document is ClinicalDocument => Boolean(document)),
    [documentById, selectedDocumentIds],
  );

  useEffect(() => {
    const pendingMode = pendingModeSelectionFocusRef.current;
    if (modeMenuOpen || pendingMode === null || pendingMode !== searchMode) return undefined;

    let settledFrame: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => {
        if (pendingModeSelectionFocusRef.current !== searchMode) return;
        // Phone Sheet may still mount #app-mode-menu during exit animation.
        // Leave pending armed so a later searchMode tick (or same-mode retry)
        // can finish restore instead of giving up on a no-op.
        if (document.getElementById("app-mode-menu")) return;
        restoreFocusUnlessMoved(modeButtonRef.current);
        pendingModeSelectionFocusRef.current = null;
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (settledFrame !== null) window.cancelAnimationFrame(settledFrame);
    };
  }, [modeMenuOpen, searchMode]);
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
                : searchMode === "dsm"
                  ? "dsm"
                  : searchMode === "specifiers"
                    ? "specifiers"
                    : searchMode === "formulation"
                      ? "formulation"
                      : searchMode === "tools"
                        ? "tools"
                        : searchMode === "calculators"
                          ? "calculators"
                          : searchMode === "factsheets"
                            ? "factsheets"
                            : searchMode === "dictionary"
                              ? "dictionary"
                              : "answer";
  const actionMenuItems = modeActionItemsFor(actionMenuSetId, { canManageDocuments });
  const actionMenuButtonLabel = `Open ${selectedAppMode.label.toLowerCase()} options`;

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
    if (actionId === "documents-admin") {
      onSearchModeChange("documents");
      onOpenDocumentAdmin?.();
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
    if (actionId === "factsheets-search") {
      onSearchModeChange("factsheets");
      return;
    }
    if (actionId === "factsheets-browse") {
      router.push(factsheetsTopicsHref);
      return;
    }
    if (actionId === "dictionary-search") {
      router.push(`/dictionary/search${trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : ""}`);
      return;
    }
    if (actionId === "dictionary-topics") {
      router.push("/dictionary/topics");
      return;
    }
    if (actionId === "dictionary-compare") {
      router.push("/dictionary/compare");
      return;
    }
    if (actionId === "dictionary-sources") {
      router.push("/dictionary/sources");
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
      if (!canAccessFavourites) {
        onRequestAccountSetup?.();
        return;
      }
      onSearchModeChange("favourites");
      onQueryChange("");
      return;
    }
    if (actionId === "favourites-sets") {
      if (!canAccessFavourites) {
        onRequestAccountSetup?.();
        return;
      }
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
    if (actionId === "calculators-browse") {
      router.push("/calculators");
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
    if (actionId === "dsm-search") {
      onSearchModeChange("dsm");
      return;
    }
    if (actionId === "dsm-compare") {
      router.push("/dsm/compare");
      return;
    }
    if (actionId === "dsm-criteria") {
      onSearchModeChange("dsm");
      onQueryChange(trimmedQuery || "major depressive disorder");
      return;
    }
    if (actionId === "specifiers-search") {
      onSearchModeChange("specifiers");
      return;
    }
    if (actionId === "specifiers-builder") {
      router.push("/specifiers/builder");
      return;
    }
    if (actionId === "specifiers-compare") {
      router.push("/specifiers/compare");
      return;
    }
    if (actionId === "specifiers-map") {
      router.push("/specifiers/map");
      return;
    }
    if (actionId === "formulation-search") {
      onSearchModeChange("formulation");
      return;
    }
    if (actionId === "formulation-builder") {
      router.push("/formulation/builder");
      return;
    }
    if (actionId === "formulation-compare") {
      router.push("/formulation/compare");
      return;
    }
    if (actionId === "formulation-map") {
      router.push("/formulation/map");
      return;
    }
  }

  function selectAppMode(mode: (typeof appModeDefinitions)[number]) {
    setModeMenuOpen(false);
    if (mode.id === "tools" && "href" in mode && mode.href) {
      // Tools is a browse-first directory: selecting it opens the canonical
      // all-tools page instead of retargeting the shared-home composer.
      // Persist the selection here rather than via onSearchModeChange: that
      // callback owns shared-home navigation and would race this canonical push.
      setLastAppMode(mode.id);
      pendingModeSelectionFocusRef.current = mode.id;
      router.push(mode.href);
      if (mode.id === searchMode) {
        const restoreSameModeFocus = () => {
          if (pendingModeSelectionFocusRef.current !== mode.id) return;
          if (document.getElementById("app-mode-menu")) {
            window.setTimeout(restoreSameModeFocus, 50);
            return;
          }
          restoreFocusUnlessMoved(modeButtonRef.current);
          pendingModeSelectionFocusRef.current = null;
        };
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(restoreSameModeFocus);
        });
      }
      return;
    }
    if (isSearchableAppMode(mode.id)) {
      // Wait until the URL-owned mode prop settles before returning focus. The
      // trigger's accessible name changes with that prop; focusing in the click
      // frame races the shared-home URL sync and can fall through to <body>.
      //
      // Same-mode reselect is different: shared-home replaceState keeps an
      // identical URL, so searchMode never changes and the pending-focus effect
      // gets only the menu-close tick — which can race phone Sheet teardown.
      if (mode.id === searchMode) {
        pendingModeSelectionFocusRef.current = mode.id;
        onSearchModeChange(mode.id);
        const restoreSameModeFocus = () => {
          if (pendingModeSelectionFocusRef.current !== mode.id) return;
          if (document.getElementById("app-mode-menu")) {
            window.setTimeout(restoreSameModeFocus, 50);
            return;
          }
          restoreFocusUnlessMoved(modeButtonRef.current);
          pendingModeSelectionFocusRef.current = null;
        };
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(restoreSameModeFocus);
        });
        return;
      }
      pendingModeSelectionFocusRef.current = mode.id;
      onSearchModeChange(mode.id);
      return;
    }
    if ("href" in mode && mode.href) router.push(mode.href);
  }

  function selectAppModeById(modeId: string) {
    const mode = visibleAppModeOptions.find((option) => option.id === modeId);
    if (mode) selectAppMode(mode);
  }

  const selectedModeIndex = Math.max(
    0,
    visibleAppModeOptions.findIndex((mode) => mode.id === selectedAppMode.id),
  );

  useEffect(() => {
    if (!modeMenuOpen || !usesPhoneSearchLayout) return undefined;

    let settledFrame: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => {
        const menu = phoneModeMenuListRef.current;
        const target = modeOptionRefs.current[modeMenuFocusIndex];
        const scrollBody = menu?.parentElement;
        if (!menu || !target || !scrollBody) return;

        const bodyRect = scrollBody.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (targetRect.top >= bodyRect.top && targetRect.bottom <= bodyRect.bottom) return;

        // Keep positioning inside the fixed sheet body. scrollIntoView would
        // also visit document ancestors and can move the page behind the modal.
        const targetCenter = targetRect.top + targetRect.height / 2;
        const bodyCenter = bodyRect.top + bodyRect.height / 2;
        scrollBody.scrollTop += targetCenter - bodyCenter;
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (settledFrame !== null) window.cancelAnimationFrame(settledFrame);
    };
  }, [modeMenuFocusIndex, modeMenuOpen, usesPhoneSearchLayout]);

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
    setModeMenuFocusIndex(nextIndex);
    modeOptionRefs.current[nextIndex]?.focus();
  }

  function closeModeSurfaces() {
    setActionMenuOpen(false);
    setCommandDropdownOpen(false);
    closeScope(false);
    setScopeSheetOpen(false);
  }

  // Mode options are buttons (not Links), so Next cannot discover destinations.
  // Prefetch only the mode the user is about to choose — the highlighted option
  // on open, then whichever option receives focus/pointer while scanning.
  //
  // Most picks return to the shared home. Tools is browse-first and opens its
  // canonical all-results directory, so warm that route instead.
  function prefetchModeSelection(modeId: AppModeId) {
    if (modeId === searchMode) return;
    const href = modeId === "tools" ? "/tools" : appModeSelectionHref(modeId);
    if (prefetchedModeHrefsRef.current.has(href)) return;
    prefetchedModeHrefsRef.current.add(href);
    router.prefetch(href, {
      // Next's client cache can invalidate a prefetched RSC payload while this
      // long-lived shared header remains mounted. Let the next pointer/focus
      // intent warm it again instead of permanently treating the stale entry as
      // prefetched for the rest of the session.
      onInvalidate: () => {
        prefetchedModeHrefsRef.current.delete(href);
      },
      // Next 16.2.12's public guide documents onInvalidate as the only optional
      // field, while its bundled AppRouterInstance type incorrectly exposes the
      // internal required `kind`. Keep the public API shape without importing a
      // private router enum.
    } as Parameters<typeof router.prefetch>[1]);
  }

  function openModeMenuWithFocus(index: number) {
    closeModeSurfaces();
    const nextIndex = (index + visibleAppModeOptions.length) % visibleAppModeOptions.length;
    const highlighted = visibleAppModeOptions[nextIndex];
    if (highlighted) prefetchModeSelection(highlighted.id);
    const phoneLayout = currentUsesPhoneSearchLayout();
    setUsesPhoneSearchLayout(phoneLayout);
    setModeMenuFocusIndex(nextIndex);
    setModeMenuOpen(true);
    // Phone sheet owns initial focus via data-sheet-autofocus; desktop still
    // needs an rAF focus into the absolute menu after it mounts.
    if (!phoneLayout) {
      window.requestAnimationFrame(() => focusModeOption(nextIndex));
    }
  }

  function toggleModeMenu() {
    closeModeSurfaces();
    if (modeMenuOpen) {
      setModeMenuOpen(false);
      return;
    }
    const highlighted = visibleAppModeOptions[selectedModeIndex];
    if (highlighted) prefetchModeSelection(highlighted.id);
    setUsesPhoneSearchLayout(currentUsesPhoneSearchLayout());
    setModeMenuFocusIndex(selectedModeIndex);
    setModeMenuOpen(true);
  }

  function handleModeTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openModeMenuWithFocus(selectedModeIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openModeMenuWithFocus(selectedModeIndex - 1);
    } else if (event.key === "Tab" && modeMenuOpen && !usesPhoneSearchLayout) {
      // Desktop: Tab/Shift+Tab is leaving the trigger — close without trapping (APG
      // menu-button pattern; arrow keys are the entry into the menu). WebKit's
      // sequential focus navigation may never deliver a wrapper-escaping focusout
      // (links are excluded from its Tab order, and backward navigation can wrap
      // into the open menu), so keydown is the reliable dismiss signal; the wrapper
      // onBlur remains the net for pointer and programmatic focus moves.
      setModeMenuOpen(false);
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
      // Phone Sheet owns Escape + return-focus; handling here races its cleanup.
      if (usesPhoneSearchLayout) return;
      event.preventDefault();
      setModeMenuOpen(false);
      window.requestAnimationFrame(() => modeButtonRef.current?.focus());
    } else if (event.key === "Tab") {
      // Desktop: let focus leave the absolute menu and close it. Phone sheet
      // traps Tab itself — closing here would fight the dialog focus cycle.
      if (!usesPhoneSearchLayout) {
        setModeMenuOpen(false);
      }
    }
  }

  function renderModeMenuOption(mode: (typeof visibleAppModeOptions)[number], index: number) {
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
        aria-label={`${mode.label}. ${mode.description}`}
        tabIndex={active ? 0 : -1}
        data-sheet-autofocus={usesPhoneSearchLayout && index === modeMenuFocusIndex ? "true" : undefined}
        onFocus={() => prefetchModeSelection(mode.id)}
        onPointerEnter={() => prefetchModeSelection(mode.id)}
        onKeyDown={(event) => handleModeOptionKeyDown(event, index)}
        onClick={() => selectAppMode(mode)}
        className={cn(
          "relative grid w-full items-center text-left transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none",
          usesPhoneSearchLayout
            ? "min-h-14 grid-cols-[2.5rem_minmax(0,1fr)_1.5rem] gap-2.5 rounded-xl px-2 py-2"
            : "min-h-[3.25rem] grid-cols-[2rem_minmax(0,1fr)_auto] gap-2 rounded-md px-2.5 py-2",
          active
            ? usesPhoneSearchLayout
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--text)] shadow-[var(--shadow-inset)] ring-1 ring-inset ring-[color:var(--clinical-accent-border)]"
              : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--text)]"
            : "text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
        )}
      >
        {active && !usesPhoneSearchLayout ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
          />
        ) : null}
        <span
          data-mode-icon={usesPhoneSearchLayout ? mode.id : undefined}
          className={cn(
            "grid place-items-center border transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none",
            usesPhoneSearchLayout ? "h-10 w-10 rounded-xl" : "h-8 w-8 rounded-lg",
            active
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
          )}
        >
          <Icon
            aria-hidden="true"
            className={usesPhoneSearchLayout ? "size-icon-lg" : "size-icon-md"}
            strokeWidth={usesPhoneSearchLayout ? 1.8 : 2}
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-[var(--tracking-display)] text-[color:var(--text-heading)]">
            {mode.label}
          </span>
          {usesPhoneSearchLayout ? (
            <span className="mt-0.5 line-clamp-2 text-xs font-medium leading-4 text-[color:var(--text-muted)]">
              {mode.description}
            </span>
          ) : null}
        </span>
        {active && usesPhoneSearchLayout ? (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--surface)] shadow-[var(--e2)]">
            <Check aria-hidden="true" className="size-icon-sm" strokeWidth={2.5} />
          </span>
        ) : active ? (
          <Check
            aria-hidden="true"
            className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
            strokeWidth={2.5}
          />
        ) : (
          <span aria-hidden="true" className={usesPhoneSearchLayout ? "h-6 w-6" : "size-icon-md"} />
        )}
      </button>
    );
  }

  function renderModeMenuOptions() {
    return visibleAppModeOptions.map((mode, index) => renderModeMenuOption(mode, index));
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
      restoreFocusUnlessMoved(actionMenuTriggerRef.current);
    });
  }, [scopeOpen]);

  const closeScopeSheet = useCallback(() => {
    setScopeSheetOpen(false);
    window.requestAnimationFrame(() => {
      restoreFocusUnlessMoved(actionMenuTriggerRef.current);
    });
  }, []);
  const handleFocusSearchInput = useEventCallback(() => {
    queryInputRef?.current?.focus();
  });
  const retargetActionMenuSheetFocusToSearchInput = useEventCallback(() => {
    const target = queryInputRef?.current ?? null;
    actionMenuSheetReturnFocusRef.current = target;
    if (!currentUsesScopeSheet()) {
      window.requestAnimationFrame(() => {
        restoreFocusUnlessMoved(target);
      });
    }
  });
  const handleActionMenuCurrentSearch = useEventCallback(() => {
    retargetActionMenuSheetFocusToSearchInput();
    setActionMenuOpen(false);
  });
  const handleActionMenuGlobalSearch = useEventCallback(() => {
    retargetActionMenuSheetFocusToSearchInput();
    setActionMenuOpen(false);
    setCommandDropdownOpen(true);
  });

  const phoneLayoutGateRef = useRef<boolean | null>(null);
  useEffect(() => {
    const scopeMediaQuery = window.matchMedia(scopeSheetMediaQuery);
    const phoneMediaQuery = window.matchMedia(phoneSearchLayoutMediaQuery);
    const sync = () => {
      setUsesScopeSheet(scopeMediaQuery.matches);
      const nextPhoneLayout = phoneMediaQuery.matches;
      // Crossing the phone gate while open would swap Sheet ↔ absolute menu
      // under the user's finger/keyboard; close instead of mutating surface.
      if (phoneLayoutGateRef.current !== null && phoneLayoutGateRef.current !== nextPhoneLayout) {
        setModeMenuOpen(false);
      }
      phoneLayoutGateRef.current = nextPhoneLayout;
      setUsesPhoneSearchLayout(nextPhoneLayout);
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
    // A mode-home hero always takes precedence over the generic desktop page
    // slot. Hosts normally pass only one, but this keeps ownership deterministic
    // during route transitions where both slots can briefly coexist.
    const composerSlotId = desktopHomeComposerSlotId ?? desktopPageComposerSlotId;
    const composerSlotKind = desktopHomeComposerSlotId ? "home" : "page";

    if (!composerSlotId || !searchComposerVisible) {
      // No page-owned slot at this route, or the shell suppressed the composer:
      // reset the portal state and collapse any SSR mode-home reserve band.
      // Deferred to a microtask (not requestAnimationFrame) so it stays off the
      // synchronous effect body without being frame-gated — headless CI can starve rAF.
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        if (composerSlotId) {
          setModeHomeComposerReservePending(document.getElementById(composerSlotId), false);
        }
        setDesktopComposerPortalActive(false);
        setDesktopComposerPortalHost(null);
        setDesktopComposerPortalFallback(false);
        setHomeComposerMediaEligible(false);
      });
      return () => {
        cancelled = true;
      };
    }

    // The composer is portaled into a stable host we own, and we move that host
    // in and out of the page-owned slot as it appears/disappears. The slot is
    // rendered by page content and unmounts on navigation; portaling directly
    // into it made React reconcile the portal against a container that another
    // part of the tree had already removed, throwing a null-parentNode error.
    // Because the host is stable, React's portal container never disappears.
    // Hero slots retain their existing all/sm-up ownership. Generic page slots
    // start at sm so tablets and desktops share normal-flow search behaviour,
    // while phone docks remain unchanged.
    const host = document.createElement("div");
    // Layout-transparent so the composer lays out as a direct child of the slot.
    host.style.display = "contents";

    const mediaQuery = window.matchMedia(
      composerSlotKind === "home"
        ? heroComposerBreakpoint === "sm-up"
          ? modeHomeComposerSmUpMediaQuery
          : modeHomeComposerMediaQuery
        : desktopPageComposerMediaQuery,
    );

    let retryTimeout: number | null = null;
    let portalFailureStartedAt: number | null = null;
    const portalFallbackDelayMs = 8_000;
    // Runs synchronously off the MutationObserver (which already coalesces
    // records into a microtask) rather than behind requestAnimationFrame.
    // Headless CI throttles/pauses rAF whenever the page is not actively
    // compositing, which stalled portal activation for seconds and made the
    // hero composer flake out of the mode-home slot. A microtask-driven sync
    // settles the portal on the same tick the slot mounts, no frame required.
    //
    // Ready-gate: page-owned slots mark `data-composer-slot-ready` only after
    // their React segment hydrates. Adopting the slot before that injects a
    // display:contents host into still-unhydrated RSC HTML (React #418).
    const syncTarget = () => {
      if (composerSlotKind === "home") {
        setHomeComposerMediaEligible(mediaQuery.matches);
      }
      const homeSlot = composerSlotKind === "home" ? document.getElementById(composerSlotId) : null;
      const slot = mediaQuery.matches ? (homeSlot ?? document.getElementById(composerSlotId)) : null;
      if (slot && isDesktopComposerSlotReady(slot)) {
        if (retryTimeout !== null) {
          window.clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        portalFailureStartedAt = null;
        if (host.parentNode !== slot) slot.appendChild(host);
        // Portal host keeps height via `:not(:empty)`; drop the pending marker.
        setModeHomeComposerReservePending(slot, false);
        setDesktopComposerPortalHost(host);
        setDesktopComposerPortalActive(true);
        setDesktopComposerPortalFallback(false);
      } else {
        host.parentNode?.removeChild(host);
        setDesktopComposerPortalActive(false);
        if (!mediaQuery.matches) {
          if (retryTimeout !== null) {
            window.clearTimeout(retryTimeout);
            retryTimeout = null;
          }
          portalFailureStartedAt = null;
          setDesktopComposerPortalFallback(false);
          // Viewport never hosts this hero slot — collapse the SSR reserve band.
          setModeHomeComposerReservePending(document.getElementById(composerSlotId), false);
          return;
        }
        const now = window.performance.now();
        portalFailureStartedAt ??= now;
        const fallbackDelayRemaining = portalFallbackDelayMs - (now - portalFailureStartedAt);
        if (fallbackDelayRemaining > 0) {
          // Body mutations may arrive continuously while a route hydrates. They
          // must not consume the retry budget or reset its deadline; only one
          // elapsed-time poll is scheduled at once.
          if (retryTimeout === null) {
            retryTimeout = window.setTimeout(
              () => {
                retryTimeout = null;
                syncTarget();
              },
              Math.min(200, fallbackDelayRemaining),
            );
          }
          // Keep the SSR pending reserve while we retry adoption.
          setModeHomeComposerReservePending(document.getElementById(composerSlotId), true);
        } else {
          // A missing/unhydrated page slot must not remove search forever. Home
          // routes suppress the header fallback during the bounded retry window
          // because ModeHomeTemplate already reserves the settled hero geometry;
          // only surface the fallback after portal adoption has genuinely failed.
          // Collapse the empty hero band once the header fallback takes over.
          setModeHomeComposerReservePending(document.getElementById(composerSlotId), false);
          setDesktopComposerPortalFallback(true);
        }
      }
    };

    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [desktopComposerSlotReadyAttr],
    });
    syncTarget();
    mediaQuery.addEventListener("change", syncTarget);
    return () => {
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
      observer.disconnect();
      mediaQuery.removeEventListener("change", syncTarget);
      host.parentNode?.removeChild(host);
      if (composerSlotId) {
        setModeHomeComposerReservePending(document.getElementById(composerSlotId), false);
      }
      setDesktopComposerPortalActive(false);
      setDesktopComposerPortalHost(null);
      setDesktopComposerPortalFallback(false);
    };
  }, [desktopHomeComposerSlotId, desktopPageComposerSlotId, heroComposerBreakpoint, searchComposerVisible]);

  const dismissModeMenu = useCallback(() => setModeMenuOpen(false), []);
  function dismissScope(reason: "outside" | "escape") {
    closeScope(reason === "escape");
  }

  useDismissableLayer({
    // Phone Mode uses Sheet (backdrop / Escape / focus trap). Keep the
    // dismissable-layer contract on the desktop absolute menu only.
    enabled: modeMenuOpen && !usesPhoneSearchLayout,
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
            <span className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
              {field.label}
            </span>
            <input
              value={filterText(scopeFilters[field.key])}
              onChange={(event) => updateTextScopeFilter(field.key, event.target.value)}
              placeholder={field.placeholder}
              className={cn(
                fieldControlPlain,
                "min-w-0 text-xs font-semibold border-[color:var(--border-lux)] bg-[color:var(--surface-lux)]",
              )}
            />
          </label>
        ))}
      </div>
    );
  }

  function renderDocumentScopeSection() {
    return (
      <section className="min-w-0 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--e2)]">
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
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--decoration-soft)]"
            />
            <input
              ref={scopeFilterInputRef}
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              data-testid="document-scope-filter"
              aria-label="Filter document scope"
              placeholder="Filter documents by title or file"
              className={cn(
                fieldControlWithIcon,
                "font-semibold border-[color:var(--border-lux)] bg-[color:var(--surface-lux)]",
              )}
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
                      "grid min-h-tap w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition motion-safe:duration-[var(--duration-quick)]",
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
                      <span className="nums block truncate text-2xs font-medium text-[color:var(--text-muted)]">
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
            <p className="nums px-1 text-xs font-medium text-[color:var(--text-muted)]">
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
        <details className="group min-w-0 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--e2)] sm:hidden">
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
              <span className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                Search intent
              </span>
              <select
                value={queryMode}
                onChange={(event) => onQueryModeChange(event.target.value as ClinicalQueryMode)}
                aria-label="Clinical query mode"
                className={cn(
                  fieldControlPlain,
                  "text-sm font-semibold border-[color:var(--border-lux)] bg-[color:var(--surface-lux)]",
                )}
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
                <span className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
                  className={cn(
                    fieldControlPlain,
                    "min-w-0 text-sm font-semibold border-[color:var(--border-lux)] bg-[color:var(--surface-lux)]",
                  )}
                >
                  <option value="">Any status</option>
                  <option value="current">Current</option>
                  <option value="review_due">Review due</option>
                  <option value="outdated">Outdated</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
                  className={cn(
                    fieldControlPlain,
                    "min-w-0 text-sm font-semibold border-[color:var(--border-lux)] bg-[color:var(--surface-lux)]",
                  )}
                >
                  <option value="">Any locality</option>
                  <option value="local">Local only</option>
                  <option value="non_local">Non-local only</option>
                </select>
              </label>
            </div>
            <details className="group rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-subtle)]">
              <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[color:var(--text-heading)]">
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
            <span className="flex items-center gap-2 text-2xs font-semibold text-[color:var(--text-muted)]">
              {activeLabelFilterCount ? `${activeLabelFilterCount} active` : "Medication, site, action, intent"}
              <ChevronDown
                aria-hidden="true"
                className="h-3.5 w-3.5 text-[color:var(--decoration-soft)] transition group-open:rotate-180"
              />
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

  const hideStrategy = hideOnScroll?.strategy;
  const phoneMotion = hideOnScroll?.phoneMotion ?? "collapse";
  const phoneOverlayMotion = hideStrategy === "collapse" && phoneMotion === "overlay";
  // Outer-scope mirror of `renderSearchComposer`'s local `usesPhoneFooterDock`
  // for the "default" placement, where `isDesktopHomeComposer` is false. Needed
  // at the stack render site to decide whether the composer must portal out of
  // the transformed overlay layer; keep the two in step.
  const usesPhoneBottomDock = usesPhoneSearchLayout && (isAnswerFooterComposer || isMobileBottomComposer);
  // Overlay hosts that opt into all breakpoints take the header fully out of
  // flow (absolute over the scrolling <main>, which reserves matching top
  // padding) so content frosts under the glass bar at every width.
  const overlayAllBreakpoints = hideStrategy === "overlay" && Boolean(hideOnScroll?.allBreakpoints);
  const wideCollapseBehaviour = hideStrategy === "collapse" ? hideOnScroll?.wide : undefined;
  // Collapse hosts whose scrollport is internal at every width release the
  // header row at every width too; hosts that hand scrolling back to the
  // document above the phone breakpoint stick and translate there instead.
  const collapsesAtEveryWidth = wideCollapseBehaviour === "collapse";
  const sticksAbovePhones = wideCollapseBehaviour === "sticky";

  function renderSearchComposer(placement: "default" | "desktop-home" | "desktop-page") {
    const isDesktopHomeComposer = placement === "desktop-home";
    const isDesktopPageComposer = placement === "desktop-page";
    const isDefaultComposer = placement === "default";
    const isPageDesktopComposerPending =
      isDefaultComposer && Boolean(desktopPageComposerSlotId) && !desktopComposerPortalFallback;
    const usesAnswerFooterStyle = isAnswerFooterComposer && !isDesktopHomeComposer;
    const usesMobileBottomStyle = isMobileBottomComposer && !isDesktopHomeComposer;
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
    const showsAnswerFollowUpRow = Boolean(
      usesPhoneFooterDock &&
      searchMode === "answer" &&
      composerFollowUpSuggestions?.length &&
      onPickComposerFollowUpSuggestion,
    );
    // Every phone dock is the compact single-row pill; the answer dock only
    // keeps the taller default treatment while its follow-up chip row renders
    // above the pill (the compact scrim would be too short for it).
    const usesCompactMobileBottomStyle =
      (usesMobileBottomStyle && mobileBottomSearchVariant === "compact") ||
      (usesAnswerFooterStyle && usesPhoneFooterDock && !showsAnswerFollowUpRow);
    // Differentials compare addon is dock chrome (search pill + Compare bar).
    // Hide/reveal the whole dock together; do not pin for the addon slot.
    const shouldHideBottomOnScroll = Boolean(hideOnScroll && usesPhoneFooterDock);
    // Phones show the APP-5 notice on the home hero (the answer mode
    // home's in-flow composer) and footer mode homes (e.g. tools); result
    // bottom docks omit it so content keeps maximum screen space.
    // `mobileHomeComposerPlacement === "footer"` alone is not enough: it is set
    // for every /tools-prefixed route, so the home slot must also be present to
    // distinguish the tools home from a tools result dock.
    // Tablet/desktop composers keep the site-wide notice everywhere.
    const showsComposerPrivacyNotice = usesPhoneSearchLayout
      ? isDesktopHomeComposer || (mobileHomeComposerPlacement === "footer" && Boolean(desktopHomeComposerSlotId))
      : true;

    const commandSurfacePlacement: CommandSurfacePlacement = usesBottomComposerPlacement ? "bottom-dock" : "inline";
    const commandDropdownDisplayable = commandDropdownDisplayableByPlacement[commandSurfacePlacement];
    // Search sits outside the collapsing top-bar row. Sticky hosts pin an outer
    // top-bar stack; result composers portal into page flow at sm+, so this
    // relative fallback only covers the brief pre-portal default placement (a
    // second sticky + top offset would overlay page controls). Collapse-
    // everywhere hosts have no outer stack, so their non-portaled composer
    // keeps its own sticky and drops the top-bar clearance while the bar is
    // hidden.
    const stickySearchOwnedByOuterStack = sticksAbovePhones;
    const stickySearchClearsTopBar = !(hideStrategy === "collapse" && headerChromeHidden);
    const stickySearchTopClass = stickySearchClearsTopBar
      ? "top-[calc(4.75rem+env(safe-area-inset-top))] sm:top-[calc(4.75rem+env(safe-area-inset-top))]"
      : "top-0 sm:top-0";
    const stickySearchPositionClass = cn("sm:sticky", stickySearchTopClass);

    return (
      <form
        role="search"
        aria-label="Search"
        onSubmit={submit}
        data-composer-placement={placement}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (touchStartY.current === null) return;
          // Ignore swipes that originate inside a scrollable container
          if (e.target instanceof Element && e.target.closest(".overflow-y-auto, .overflow-auto, .overflow-x-auto")) {
            touchStartY.current = null;
            return;
          }
          const currentY = e.touches[0].clientY;
          const diff = currentY - touchStartY.current;
          if (diff > 50) {
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            touchStartY.current = null;
          }
        }}
        data-footer-variant={usesPhoneFooterDock ? (usesCompactMobileBottomStyle ? "compact" : "default") : undefined}
        data-footer-addon={
          usesPhoneFooterDock && mobileBottomSearchAddonSlotId
            ? (mobileBottomSearchAddonKind ?? "differentials-compare")
            : undefined
        }
        data-command-open={
          // Phones never show the command dropdown, so the dock scrim must not
          // grow for it — gate the open attribute to widths that can display it.
          usesBottomComposerPlacement && commandDropdownDisplayable && commandDropdownOpen ? "true" : undefined
        }
        data-scroll-hidden={shouldHideBottomOnScroll && bottomComposerHidden ? "true" : undefined}
        {...(shouldHideBottomOnScroll ? composerFocusProps : undefined)}
        className={cn(
          isDesktopHomeComposer
            ? "universal-home-search-edge mx-auto w-full"
            : isDesktopPageComposer
              ? "document-mobile-search-edge universal-top-search-edge relative z-20 mx-auto w-full max-w-3xl px-4 py-3 lg:max-w-4xl"
              : usesAnswerFooterStyle
                ? "phone-footer-layer floating-composer-edge dashboard-composer-edge bottom-0 z-40 mx-auto max-w-3xl sm:fixed lg:max-w-4xl"
                : usesMobileBottomStyle
                  ? cn(
                      usesPhoneFooterDock
                        ? "phone-footer-layer document-mobile-search-edge universal-top-search-edge z-40 w-full sm:fixed"
                        : cn(
                            "document-mobile-search-edge universal-top-search-edge z-40 mx-auto max-w-3xl sm:z-20 sm:w-full sm:px-4 sm:py-3 lg:max-w-4xl",
                            // Sticky-stack hosts pin the top bar; result search
                            // portals out at sm+. Never leave a fixed/sticky
                            // default composer in that stack — it overlays page
                            // controls (Services decision rail).
                            stickySearchOwnedByOuterStack
                              ? "relative"
                              : cn("fixed", isHeroDesktopComposer ? "sm:hidden" : stickySearchPositionClass),
                            stickySearchOwnedByOuterStack && isHeroDesktopComposer && "sm:hidden",
                          ),
                    )
                  : cn(
                      "universal-top-search-edge mx-auto box-border w-full px-3 py-3 sm:px-4",
                      stickySearchOwnedByOuterStack ? "relative z-20" : cn("sticky z-20", stickySearchTopClass),
                    ),
          isPageDesktopComposerPending && "sm:hidden",
          usesBottomComposerPlacement && "answer-footer-search-edge",
          usesPhoneFooterDock && "answer-footer-search-dock",
          usesCompactMobileBottomStyle && "document-mobile-search-compact",
          showFooterSearchChips && "flex flex-col items-center gap-2.5",
          shouldHideBottomOnScroll &&
            cn(
              "max-sm:transition-[transform,opacity] motion-reduce:transition-none",
              bottomComposerHidden
                ? "max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
                : "max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]",
            ),
        )}
      >
        {usesBottomComposerPlacement ? <div className="answer-footer-search-backdrop" aria-hidden="true" /> : null}
        {usesMobileBottomStyle && mobileBottomSearchAddonSlotId ? (
          <div
            id={mobileBottomSearchAddonSlotId}
            className="differentials-mobile-search-addon relative z-10 w-full empty:hidden"
          />
        ) : null}
        {showsAnswerFollowUpRow && composerFollowUpSuggestions?.length && onPickComposerFollowUpSuggestion ? (
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
          demoMode={demoMode}
          canAccessFavourites={canAccessFavourites}
          modeId={searchMode}
          query={query}
          recentQueries={recentQueries}
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
            if (targetMode === "favourites" && !canAccessFavourites) {
              onRequestAccountSetup?.();
              return;
            }
            if (onCrossModeSearch) {
              onCrossModeSearch(targetMode, crossQuery);
              return;
            }
            onQueryChange(crossQuery);
            onSearchModeChange(targetMode);
            onAsk();
          }}
          onRunModeAction={runModeAction}
          onListboxIdReady={setCommandListboxId}
          onActiveItemIdChange={setCommandActiveItemId}
          onFocusSearchInput={handleFocusSearchInput}
          showPhoneSuggestionTicker={showPhoneSuggestionTickerOnHome}
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
              title="Pins and search"
              titleIcon={Layers3}
              subtitle="Open a pin or choose where this search runs."
              buttonLabel={actionMenuButtonLabel}
              items={actionMenuItems}
              onOpenChange={setActionMenuOpen}
              onBeforeOpen={() => {
                actionMenuSheetReturnFocusRef.current = null;
                setUsesScopeSheet(currentUsesScopeSheet());
                setCommandDropdownOpen(false);
                setModeMenuOpen(false);
                setScopeOpen(false);
                setScopeSheetOpen(false);
              }}
              onAction={runModeAction}
              onPlacementChange={setActionMenuPlacement}
              triggerClassName="answer-footer-search-action"
              triggerRef={actionMenuTriggerRef}
              integrated={usesFooterChipLayout}
              integratedChipRow={showFooterSearchChips}
              useSheet={usesScopeSheet}
              sheetReturnFocusRef={actionMenuSheetReturnFocusRef}
              dismissIgnoreRefs={[modeMenuRef]}
              customBody={
                <SearchPinsMenu
                  key={actionMenuOpen ? "pins-menu-open" : "pins-menu-closed"}
                  currentModeId={selectedAppMode.id}
                  modeOptions={actionMenuModeOptions}
                  actions={actionMenuItems}
                  globalSearchAvailable={commandDropdownDisplayable}
                  onClose={() => setActionMenuOpen(false)}
                  onCurrentSearch={handleActionMenuCurrentSearch}
                  onGlobalSearch={handleActionMenuGlobalSearch}
                  onModeSelect={(modeId) => {
                    setActionMenuOpen(false);
                    selectAppModeById(modeId);
                  }}
                  onAction={(actionId) => {
                    setActionMenuOpen(false);
                    runModeAction(actionId);
                  }}
                />
              }
            />

            {/* The clear button is a flex sibling (not absolutely positioned): the
              unlayered .answer-footer-search-input padding beats a conditional
              pr-* utility, which let text run under an overlaid button. */}
            <div className="flex min-w-0 flex-1 items-center overflow-hidden">
              <input
                type="search"
                ref={bindQueryInputRef}
                data-testid="global-search-input"
                autoFocus={queryInputAutoFocus}
                disabled={searchSetupNotReady}
                title={searchSetupNotReady ? "Search setup not ready" : undefined}
                onFocus={(e) => {
                  e.target.scrollIntoView({ block: "nearest", behavior: resolveScrollBehavior() });
                }}
                value={query}
                enterKeyHint="search"
                inputMode="search"
                role="combobox"
                aria-expanded={commandDropdownOpen}
                aria-controls={commandDropdownOpen ? commandListboxId : undefined}
                aria-autocomplete="list"
                aria-activedescendant={commandDropdownOpen ? (commandActiveItemId ?? undefined) : undefined}
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
                  className="grid min-h-tap min-w-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] sm:h-12 sm:w-12"
                  aria-label="Clear search question"
                >
                  <X aria-hidden="true" className="size-icon-md" />
                </button>
              )}
            </div>
            <span className="answer-footer-search-divider" aria-hidden="true" />
            <button
              type="submit"
              disabled={!canAsk}
              title={
                searchSetupNotReady
                  ? "Search setup not ready"
                  : trimmedQuery.length < 1
                    ? selectedSearch.emptyTitle
                    : selectedSearch.readyTitle
              }
              className={cn(chatSendButton, "answer-footer-search-send")}
              aria-label={selectedSearch.submitAriaLabel}
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="size-icon-lg animate-spin" />
              ) : usesSendAffordance ? (
                <Send aria-hidden="true" className="size-icon-lg" />
              ) : usesModeIdentityAffordance ? (
                <ModeIdentityIcon className="size-icon-lg" />
              ) : (
                <Search aria-hidden="true" className="size-icon-lg" />
              )}
              <span className="sr-only">{submitLabel}</span>
            </button>
          </div>
        </UniversalSearchCommandSurface>
        {/* Single site-wide APP-5 privacy line: every tablet/desktop composer
            variant renders exactly one compact notice below the pill; no other
            surface may duplicate it. Phones show it only on the home hero —
            see showsComposerPrivacyNotice. */}
        {showsComposerPrivacyNotice ? (
          <div role="group" aria-label="Search privacy notice">
            <PrivacyInputNotice
              id={composerPrivacyWarningId}
              testId={composerPrivacyWarningId}
              className="mt-1.5 justify-center px-3 text-center"
              returnMode={searchMode === "answer" ? undefined : searchMode}
            />
          </div>
        ) : null}
        {/* Scope popover is a form sibling so the "+" menu's "Set scope" action can
            open it even when the footer chip row is not shown. */}
        {hasScopeFooterChip && !usesScopeSheet && scopeOpen ? (
          <div
            ref={scopePopoverRef}
            data-testid="scope-command-popover"
            className="polished-scroll absolute bottom-[calc(100%+0.75rem)] right-2 z-[95] max-h-[min(70dvh,28rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-2.5 pb-2.5 text-[color:var(--text)] shadow-[var(--shadow-elevated)] backdrop-blur-xl motion-safe:animate-pop-in"
          >
            {scopePreview ? (
              <p className="truncate px-1 text-xs text-[color:var(--text-muted)]">{scopePreview}</p>
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
          closeButtonClassName="grid h-tap w-tap shrink-0 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
              <p className="truncate px-1 text-xs text-[color:var(--text-muted)]">{scopePreview}</p>
            ) : null}
            {renderScopeRows()}
          </div>
        </Sheet>
      </form>
    );
  }

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

  // Top bar only (mode / new chat / menu). The search composer is intentionally
  // NOT part of this node: on tablet/desktop hide-on-scroll must reclaim the top
  // bar without taking the search field with it. Phone bottom docks are fixed and
  // escape any collapse wrapper; hero composers portal out of this tree.
  const topBar = (
    <header
      id="search"
      data-scroll-hidden={hideStrategy === "overlay" && headerChromeHidden ? "true" : undefined}
      className={cn(
        // No backdrop-filter on the header itself: it would form a backdrop
        // root and starve the .edge-glass-header-backdrop scrim (the single
        // source of the bar's frost) of the real page behind it.
        // Collapse hosts own the OS top inset via `chrome-safe-area-top`, so
        // this bar only needs its aesthetic 0.5rem pad. On phones that spacer
        // releases with hidden chrome; wider sticky hosts keep it pinned.
        // Overlay hosts still paint the inset themselves (answer mode keeps an
        // equivalent reserve on <main>).
        "edge-glass-header universal-header z-30 py-2 text-[color:var(--text)]",
        hideStrategy === "collapse" ? "pt-2" : "pt-[max(0.5rem,var(--safe-area-top))]",
        // Collapse hosts keep the top bar above an internally scrolling <main>,
        // so sticky is unnecessary wherever the row collapses and fights the
        // 0fr grid by pinning the bar inside the viewport. Sticky hosts pin an
        // outer stack (top bar + search) instead; this <header> stays relative
        // inside that stack. All-breakpoints overlay hosts take the bar out of
        // flow entirely (absolute over the padded <main>). Legacy overlay hosts
        // keep sticky (they ride document scroll) and translate away with no
        // layout shift.
        hideStrategy === "collapse"
          ? sticksAbovePhones || collapsesAtEveryWidth
            ? "relative"
            : "max-sm:relative sm:sticky sm:top-0"
          : overlayAllBreakpoints
            ? "phone-overlay-header sm:absolute sm:inset-x-0 sm:top-0"
            : "sticky top-0",
        // Overlay hide-on-scroll: a plain translate reveals the content already
        // flowing beneath it. No transform is applied while visible so the
        // fixed-position mobile mode menu keeps the viewport as its containing block.
        hideStrategy === "overlay" &&
          (overlayAllBreakpoints
            ? cn(
                "transition-transform motion-reduce:transition-none",
                headerChromeHidden
                  ? "duration-[var(--duration-slow)] ease-[var(--ease-chrome-hide)]"
                  : "duration-[var(--duration-moderate)] ease-[var(--ease-chrome-reveal)]",
              )
            : cn(
                "max-sm:transition-transform motion-reduce:transition-none",
                headerChromeHidden
                  ? "max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
                  : "max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]",
              )),
        hideStrategy === "overlay" &&
          headerChromeHidden &&
          (overlayAllBreakpoints ? "-translate-y-full" : "max-sm:-translate-y-full"),
      )}
      {...(hideStrategy === "overlay" ? chromeFocusProps : undefined)}
    >
      <div className="edge-glass-header-backdrop" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-14 max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="universal-header-icon-control grid h-tap w-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] md:hidden"
            aria-label="Open Clinical Guide menu"
          >
            <Menu aria-hidden="true" className="size-icon-lg" />
          </button>
          {sharedHomeIdentity ? (
            <div data-testid="shared-home-brand" className="hidden min-w-0 items-center gap-3 lg:flex">
              <BrandMark className="h-10 w-10" />
              <span className="min-w-0">
                {/* The name leads and the strapline supports, which is a weight and a
                    colour apart, not just a size. The wordmark takes the display
                    tracking the rest of the interface's headings use — at 18px/800 the
                    untracked default reads loose. The strapline drops from 600 to 500:
                    at 600 it sat almost level with the name and the two lines competed.
                    The colour stays --text-muted and the size stays 12px, both measured
                    rather than chosen — on this surface --text-soft composites to
                    #8894a6 and gives 3.07:1 against the header, under the 4.5:1 floor,
                    and 11px made the block bottom-light for no gain. Tracking stays on
                    the ladder's zero step; positive tracking belongs to uppercase
                    labels, and this is a sentence. */}
                <span className="block truncate text-lg font-extrabold leading-5 tracking-[var(--tracking-display)] text-[color:var(--text-heading)]">
                  PsychSift
                </span>
                <span className="block truncate text-xs font-medium text-[color:var(--text-muted)]">
                  From question to source
                </span>
              </span>
            </div>
          ) : isServicesMode ? (
            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)]">
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
          onBlur={(event) => {
            // Phone Mode menu is portaled into Sheet; blur-leave on this wrapper
            // would close the sheet as soon as focus moved into the dialog.
            if (usesPhoneSearchLayout) return;
            const nextFocusedElement = event.relatedTarget;
            if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) return;
            setModeMenuOpen(false);
          }}
          className="relative z-[60] min-w-0 justify-self-center"
        >
          <button
            ref={modeButtonRef}
            type="button"
            onClick={toggleModeMenu}
            onKeyDown={handleModeTriggerKeyDown}
            className={cn(
              "universal-header-mode-button inline-grid h-12 w-[min(13rem,calc(100vw-9rem))] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-auto sm:min-w-[13rem] sm:pr-3",
            )}
            aria-haspopup={usesPhoneSearchLayout ? "dialog" : "menu"}
            aria-expanded={modeMenuOpen}
            aria-controls={modeMenuOpen ? "app-mode-menu" : undefined}
            aria-label={`Mode ${selectedAppMode.label}`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)]">
              {/* 16px in the 32px pill, not the 14px metadata step: this is a
                  primary control, and 2.25 keeps its absolute stroke in line
                  with the larger glyphs beside it. */}
              <SelectedAppModeIcon aria-hidden="true" className="size-icon-md" strokeWidth={2.25} />
            </span>
            <span className="min-w-0">
              <span className="hidden truncate text-2xs font-extrabold uppercase leading-3 tracking-eyebrow text-[color:var(--text-muted)] sm:block">
                Mode
              </span>
              <span className="block truncate text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
                {selectedAppMode.label}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-icon-md text-[color:var(--decoration-soft)] transition-transform motion-reduce:transition-none",
                modeMenuOpen && "rotate-180",
              )}
            />
          </button>

          {!usesPhoneSearchLayout && modeMenuOpen ? (
            <div
              id="app-mode-menu"
              role="menu"
              aria-label="Choose app mode"
              className={cn(
                glassOverlaySurface,
                "polished-scroll absolute left-0 top-[calc(100%+0.5rem)] z-[60] max-h-[min(20rem,calc(100dvh-5.5rem))] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto rounded-lg bg-[color:var(--surface-lux)] p-1.5 text-[color:var(--text)] shadow-[var(--shadow-lux)]",
              )}
            >
              {renderModeMenuOptions()}
            </div>
          ) : null}
        </div>

        <div className="relative flex min-w-0 shrink-0 items-center justify-end gap-1.5 justify-self-end sm:gap-2">
          <button
            type="button"
            onClick={onNewChat}
            className={cn(
              "universal-header-icon-control inline-flex h-tap w-tap shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] xl:w-auto xl:px-3 xl:text-xs xl:font-semibold xl:text-[color:var(--text)]",
              !showDesktopNewChat && "md:hidden",
            )}
            aria-label="Start a new chat"
            title="New chat"
          >
            <MessageSquarePlus aria-hidden="true" className="size-icon-lg xl:size-icon-md" />
            <span className="hidden whitespace-nowrap xl:inline">New chat</span>
          </button>
        </div>
      </div>

      {/* Portaled outside the 3-column header grid so a non-portal regression
            cannot steal a grid track and shove trailing actions onto a new row. */}
      {usesPhoneSearchLayout ? (
        <Sheet
          open={modeMenuOpen}
          onClose={dismissModeMenu}
          title="Choose mode"
          descriptionContent={
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs leading-5 text-[color:var(--text-muted)]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <SelectedAppModeIcon aria-hidden="true" className="size-icon-xs" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 truncate">
                Currently{" "}
                <span className="font-semibold text-[color:var(--text-heading)]">{selectedAppMode.label}</span>
              </span>
            </span>
          }
          closeLabel="Close mode menu"
          returnFocusRef={modeButtonRef}
          portal
          mobilePlacement="bottom"
          mobileSize="content"
          mobileHeaderSafeArea="padding"
          testId="app-mode-menu-sheet"
          contentClassName="max-h-[calc(100dvh-0.75rem)] rounded-t-3xl bg-[color:var(--surface-lux)] sm:max-w-md sm:rounded-2xl"
          bodyClassName="bg-[color:var(--surface-lux)] px-2.5 pb-2 pt-0.5"
          headerClassName="bg-[color:var(--surface-lux)] px-4 pb-3 pt-1.5"
          titleClassName="tracking-[var(--tracking-display)]"
          closeButtonClassName="grid size-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition-colors duration-[var(--duration-fast)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border motion-reduce:transition-none"
        >
          <div ref={phoneModeMenuListRef} id="app-mode-menu" role="menu" aria-label="Choose app mode">
            {phoneModeGroups.map((group) => {
              const groupModes = group.modeIds.flatMap((modeId) => {
                const mode = visibleAppModeOptions.find((candidate) => candidate.id === modeId);
                return mode ? [mode] : [];
              });
              if (groupModes.length === 0) return null;
              const headingId = `app-mode-group-${group.id}`;
              return (
                <section
                  key={group.id}
                  role="group"
                  aria-labelledby={headingId}
                  data-mode-group={group.id}
                  className="pt-3 first:pt-1"
                >
                  <div className="sticky top-0 z-[5] -mx-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)]/96 px-3 py-1.5 backdrop-blur-md">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h3
                        id={headingId}
                        className="shrink-0 text-2xs font-black uppercase tracking-kicker text-[color:var(--text-muted)]"
                      >
                        {group.label}
                      </h3>
                      <p className="min-w-0 truncate text-2xs font-medium text-[color:var(--text-muted)]">
                        {group.hint}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1.5 grid gap-1">
                    {groupModes.map((mode) =>
                      renderModeMenuOption(
                        mode,
                        visibleAppModeOptions.findIndex((candidate) => candidate.id === mode.id),
                      ),
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </Sheet>
      ) : null}
    </header>
  );

  const portalPlacement = desktopHomeComposerSlotId ? "desktop-home" : "desktop-page";
  const homePortalPending =
    Boolean(desktopHomeComposerSlotId) && homeComposerMediaEligible && !desktopComposerPortalFallback;
  const portalPending = homePortalPending;
  const searchComposer = searchComposerVisible ? (
    <>
      {/* ModeHomeTemplate and desktop page slots reserve their settled geometry
          in SSR, so a temporary header fallback would make the stack grow and
          shift all main content when the portal attaches (CLS 0.118 on desktop
          /documents/search). Mode home routes suppress the header fallback entirely
          because the hero slot in the page body reserves geometry during SSR;
          generic page slots keep the phone fallback rendered during SSR and
          unknown media state while applying sm:hidden so the desktop fallback
          never renders over the reserved page slot. A failed adoption restores
          the header fallback after the bounded retry window above. */}
      {desktopComposerPortalActive && desktopComposerPortalHost
        ? null
        : portalPending
          ? null
          : renderSearchComposer("default")}
      {desktopComposerPortalActive && desktopComposerPortalHost
        ? createPortal(renderSearchComposer(portalPlacement), desktopComposerPortalHost)
        : null}
    </>
  ) : null;

  if (hideStrategy === "collapse") {
    // Collapse hide-on-scroll applies to the TOP BAR only (mode / new chat). The
    // search composer stays a sibling so tablet/desktop keep a usable search
    // field while the top bar hides. A 1fr -> 0fr grid row animates the collapse
    // without height measurement; the bottom-anchored inner track slides the
    // top bar up out of the viewport. Phone footer layers escape its geometry:
    // viewport-fixed in browser tabs, shell-absolute in standalone; hero
    // composers portal out.
    //
    // Above the phone breakpoint a `wide: "sticky"` host scrolls the document,
    // so an outer sticky stack pins its chrome below the wide safe-area spacer.
    // Tablet and desktop result search portal into page flow, so the stack
    // contains only the top bar there. The host
    // ancestor uses `display: contents`, allowing this semantic sticky owner to
    // travel against the browser viewport and become static in standalone.
    const collapsingTopBar = (
      <div
        data-scroll-hidden={headerChromeHidden ? "true" : undefined}
        // `data-scroll-hidden` is `scrollHidden && !sharedChromePinned`, so its absence has
        // two causes a test cannot separate: this header's own scroll signal never arrived,
        // or it did and a pin held the chrome open. Publishing the raw signal makes that
        // observable. Nothing styles this attribute; it exists so a failing assertion can
        // name its cause. The page-owned document composer is NOT a proxy for it —
        // DocumentViewer runs its own reporters (use-document-viewer-chrome-scroll) while
        // this header is driven by the shell's separate one (global-search-shell.tsx
        // `chromeScrollHide`), and the two can legitimately disagree, notably where an
        // inner scroller moves but `window.scrollY` does not, which the shell's
        // document-only feed cannot see.
        data-scroll-signal={scrollHidden ? "hidden" : "visible"}
        data-phone-motion={phoneMotion}
        data-testid="universal-header-collapse"
        className={cn(
          "motion-reduce:transition-none",
          collapsesAtEveryWidth || sticksAbovePhones
            ? cn(
                phoneOverlayMotion
                  ? "sm:grid sm:transition-[grid-template-rows]"
                  : "grid transition-[grid-template-rows]",
                headerChromeHidden
                  ? phoneOverlayMotion
                    ? "sm:duration-[var(--duration-slow)] sm:ease-[var(--ease-chrome-hide)]"
                    : "duration-[var(--duration-slow)] ease-[var(--ease-chrome-hide)]"
                  : phoneOverlayMotion
                    ? "sm:duration-[var(--duration-moderate)] sm:ease-[var(--ease-chrome-reveal)]"
                    : "duration-[var(--duration-moderate)] ease-[var(--ease-chrome-reveal)]",
                headerChromeHidden
                  ? phoneOverlayMotion
                    ? "sm:[grid-template-rows:0fr]"
                    : "[grid-template-rows:0fr]"
                  : phoneOverlayMotion
                    ? "sm:[grid-template-rows:1fr]"
                    : "[grid-template-rows:1fr]",
              )
            : cn(
                "max-sm:grid max-sm:transition-[grid-template-rows]",
                headerChromeHidden
                  ? "max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
                  : "max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]",
                headerChromeHidden ? "max-sm:[grid-template-rows:0fr]" : "max-sm:[grid-template-rows:1fr]",
              ),
        )}
        {...chromeFocusProps}
      >
        <div
          className={cn(
            "w-full min-w-0 max-w-full max-sm:flex max-sm:min-h-0 max-sm:flex-col max-sm:justify-end",
            (collapsesAtEveryWidth || sticksAbovePhones) && "sm:flex sm:min-h-0 sm:flex-col sm:justify-end",
            // Clip only while hiding so the edge-glass-header gradient that
            // extends below the header keeps painting when the chrome is shown.
            !phoneOverlayMotion && headerChromeHidden && "max-sm:overflow-hidden",
            (collapsesAtEveryWidth || sticksAbovePhones) && headerChromeHidden && "sm:overflow-hidden",
          )}
        >
          {topBar}
          <div
            ref={setPhoneHeaderCollapseAddonRef}
            id={phoneHeaderCollapseAddonSlotId}
            data-testid="header-collapse-addon"
            className="w-full min-w-0 max-w-full empty:hidden"
          />
        </div>
      </div>
    );

    const chromeSafeAreaTop = (
      <div
        aria-hidden="true"
        data-testid="chrome-safe-area-top"
        className={cn(
          // Visible phone chrome owns the OS inset. Hidden phone chrome must
          // release it so the scroll surface reaches the physical viewport
          // edge instead of leaving an opaque status-bar band. Match the
          // header row's timing to avoid a one-frame gap during hide/reveal.
          // sm+ keeps its pinned inset because sticky top-bar chrome is a
          // separate wide-layout contract from page-flow search.
          //
          // Paint the header's own surface, not the page background. While the
          // spacer is visible it is the top of the header, so `--background`
          // drew a page-coloured status-bar band above a `--surface` bar on
          // every collapse-strategy mode — the seam answer mode never had,
          // because its overlay header pads the inset itself and paints
          // straight through. Opaque on purpose: the spacer must keep hiding
          // scrolled content at the sm+ pinned inset.
          "relative z-40 shrink-0 bg-[color:var(--surface)] motion-reduce:transition-none sm:h-[var(--safe-area-top)]",
          phoneOverlayMotion
            ? "max-sm:h-[var(--safe-area-top)]"
            : cn(
                "max-sm:transition-[height]",
                headerChromeHidden
                  ? "max-sm:h-0 max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
                  : "max-sm:h-[var(--safe-area-top)] max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]",
              ),
          sticksAbovePhones && "sm:sticky sm:top-0",
        )}
      />
    );

    if (sticksAbovePhones) {
      return (
        <div
          data-phone-motion={phoneMotion}
          data-scroll-hidden={phoneOverlayMotion && headerChromeHidden ? "true" : undefined}
          className={cn(
            "phone-sticky-header-stack sm:contents",
            phoneOverlayMotion &&
              "phone-overlay-header max-sm:transition-[transform,translate,opacity] motion-reduce:max-sm:transition-none",
            phoneOverlayMotion &&
              (headerChromeHidden
                ? "max-sm:pointer-events-none max-sm:-translate-y-full max-sm:opacity-0 max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
                : "max-sm:opacity-100 max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]"),
          )}
        >
          {chromeSafeAreaTop}
          <div className="sm:sticky sm:top-[var(--safe-area-top)] sm:z-30">
            {collapsingTopBar}
            {/*
              The overlay hide translates this stack, and a non-none `transform`
              makes an element a containing block for `position: fixed`
              descendants. A phone bottom dock left in this subtree therefore
              resolves `bottom: 0` against the ~72px header instead of the
              viewport, landing near the top of the screen. Portal it to the
              frame footer host on phones — the mechanism invariant 21 already
              requires of every phone footer — while `sm+` keeps it inline in
              this sticky stack; result composers have already portaled into
              page flow at tablet and desktop widths.
            */}
            {phoneOverlayMotion && usesPhoneBottomDock ? (
              <PhoneFooterLayerPortal>{searchComposer}</PhoneFooterLayerPortal>
            ) : (
              searchComposer
            )}
          </div>
        </div>
      );
    }

    // `collapsesAtEveryWidth` hosts (ClinicalDashboard's non-answer modes) take
    // the same phone overlay treatment as the sticky stack above: the phone
    // stack leaves flow and translates, so hiding costs the scroller no layout.
    // The wide layout is untouched — `sm:contents` still hands the top bar and
    // composer to the host's own column, and the collapse grid keeps its `sm:`
    // 1fr -> 0fr release.
    return (
      <div
        data-phone-motion={phoneMotion}
        data-scroll-hidden={phoneOverlayMotion && headerChromeHidden ? "true" : undefined}
        className={cn(
          "phone-sticky-header-stack sm:contents",
          phoneOverlayMotion &&
            "phone-overlay-header max-sm:transition-[transform,translate,opacity] motion-reduce:max-sm:transition-none",
          phoneOverlayMotion &&
            (headerChromeHidden
              ? "max-sm:pointer-events-none max-sm:-translate-y-full max-sm:opacity-0 max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
              : "max-sm:opacity-100 max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]"),
        )}
      >
        {chromeSafeAreaTop}
        {collapsingTopBar}
        {/*
          Same containing-block trap as the sticky stack: the hidden state's
          transform would make this element the containing block for a fixed
          phone dock, resolving its `bottom: 0` against the header instead of
          the viewport. Portal the dock to the frame footer host on phones;
          `sm+` keeps it inline for the host's own column.
        */}
        {phoneOverlayMotion && usesPhoneBottomDock ? (
          <PhoneFooterLayerPortal>{searchComposer}</PhoneFooterLayerPortal>
        ) : (
          searchComposer
        )}
      </div>
    );
  }

  return (
    <>
      {topBar}
      {searchComposer}
    </>
  );
}
