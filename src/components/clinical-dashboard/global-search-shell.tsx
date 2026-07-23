"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { ClinicalDashboard } from "@/components/ClinicalDashboard";
import { clearLegacyRecentQueries, demoRecentQueryOwnerId, loadRecentQueries } from "@/lib/recent-query-storage";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import { SettingsDialog } from "@/components/clinical-dashboard/settings-dialog";
import {
  ClinicalDesktopSidebar,
  ClinicalMobileSidebar,
  deriveSidebarIdentity,
} from "@/components/clinical-dashboard/ClinicalSidebar";
import { GuideDialog } from "@/components/clinical-dashboard/dashboard-shell";
import { landingModeForPreference, readAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { useFavouritesAccess } from "@/components/clinical-dashboard/use-favourites-access";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import {
  isDocumentViewerOwnedRoute,
  resolveMobileComposerReserve,
  resolveShellVisibleMobileComposerReserve,
} from "@/components/clinical-dashboard/mobile-composer-reserve";
import { readChromeCollapseBudget, useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";
import { useSidebarCollapsed } from "@/components/clinical-dashboard/use-sidebar-collapsed";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import { ClientHydrationBoundary } from "@/components/client-hydration-boundary";
import { cn } from "@/components/ui-primitives";
import {
  appModeHomeHref,
  isAppModeId,
  isAppModeVisible,
  visibleAppModeDefinitions,
  type AppModeId,
} from "@/lib/app-modes";
import { isLocalNoAuthMode, resolveClientDemoMode } from "@/lib/client-env";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { differentialsMobileCompareAddonSlotId, modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { readSearchNavigationContext, type SearchNavigationOptions } from "@/lib/search-navigation-context";
import { shouldRenderClinicalDashboard, shouldRenderDashboardSearch } from "@/lib/search-route-ownership";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { useAuthSession } from "@/lib/supabase/client";
import type { ClinicalQueryMode } from "@/lib/types";

const mockupQueryModeOptions: Array<{ value: ClinicalQueryMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "monitoring_schedule", label: "Monitoring" },
  { value: "dose_threshold_lookup", label: "Dose / thresholds" },
  { value: "contraindications_cautions", label: "Cautions" },
  { value: "escalation_criteria", label: "Escalation" },
  { value: "required_documentation", label: "Documentation" },
  { value: "compare_guidance", label: "Compare" },
];
// Re-apply focus shortly after the first frame to survive initial hydration remounts.
const focusHydrationRetryDelayMs = 300;

type GlobalSearchShellProps = {
  children: ReactNode;
  initialMode?: AppModeId;
  availableModeIds?: readonly AppModeId[];
  desktopSearchPlacement?: "default" | "hero";
  /** Hide the shared search composer on routes that provide their own search surface. */
  searchComposerVisible?: boolean;
  /** Keep the global header/search while allowing a route to use the full desktop canvas. */
  hideDesktopSidebar?: boolean;
  /** Render only the mockup content when a design board needs a clean canvas. */
  chromeVisible?: boolean;
  /** Hide the shared mobile header when a route owns its phone navigation. */
  mobileChromeVisible?: boolean;
};

export function GlobalSearchShell(props: GlobalSearchShellProps) {
  return (
    <Suspense
      fallback={
        // A neutral placeholder — do NOT render props.children here. The client
        // body below also renders {children} inside `#main-content`, and echoing
        // them in the fallback duplicated the page subtree (two `#main-content`
        // and two `data-testid` on medication/forms/services pages) whenever the
        // fallback and resolved content briefly coexisted. A route-agnostic mode-home
        // skeleton (the same one `loading.tsx` shows during navigation) reserves the
        // layout so the first frame reads as "loading" instead of a blank background.
        <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]">
          <ModeHomeRouteLoading />
        </div>
      }
    >
      <GlobalSearchShellClient {...props} />
    </Suspense>
  );
}

function GlobalSearchShellClient(props: GlobalSearchShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const landingPreferenceAppliedRef = useRef(false);
  useEffect(() => {
    if (landingPreferenceAppliedRef.current) return;
    landingPreferenceAppliedRef.current = true;
    if (pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") || params.get("q")?.trim() || params.get("query")?.trim() || params.get("run") === "1") {
      return;
    }
    const landingMode = landingModeForPreference(readAppPreferences().landing);
    if (landingMode) router.replace(`/?mode=${landingMode}`, { scroll: false });
  }, [pathname, router]);
  const initialMode = props.initialMode ?? "answer";
  const visibleShellModes = visibleAppModeDefinitions().filter(
    (mode) => !props.availableModeIds?.length || props.availableModeIds.includes(mode.id),
  );
  const fallbackMode = visibleShellModes[0]?.id ?? initialMode;
  const initialSearchMode =
    props.availableModeIds?.length && !props.availableModeIds.includes(initialMode) ? fallbackMode : initialMode;
  const requestedMode = searchParams.get("mode");
  const resolvedSearchMode =
    isAppModeId(requestedMode) &&
    isAppModeVisible(requestedMode) &&
    (!props.availableModeIds?.length || props.availableModeIds.includes(requestedMode))
      ? requestedMode
      : initialSearchMode;
  const requestedQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
  const hasSubmittedModeSearch = searchParams.get("run") === "1" && requestedQuery.length > 0;
  const rendersClinicalDashboard = shouldRenderClinicalDashboard({
    hasSubmittedSearch: hasSubmittedModeSearch,
    mode: resolvedSearchMode,
    pathname,
  });

  // Wrap both render paths so the patient-considerations profile is shared
  // between the prescribing workspace (ClinicalDashboard) and the medication
  // detail pages (standalone shell), backed by sessionStorage across navigation.
  return (
    <PatientProfileProvider>
      {rendersClinicalDashboard ? (
        <ClinicalDashboard
          initialSearchMode={resolvedSearchMode}
          initialQuery={requestedQuery}
          focusSearch={searchParams.get("focus") === "1"}
          autoRunSearch={pathname === "/" ? hasSubmittedModeSearch : true}
        />
      ) : (
        <GlobalStandaloneSearchShellClient {...props} />
      )}
    </PatientProfileProvider>
  );
}

function isInformationPage(pathname: string): boolean {
  // Services detail: /services/[slug]
  if (pathname.startsWith("/services/") && pathname !== "/services") return true;

  // Forms detail: /forms/[slug]
  if (pathname.startsWith("/forms/") && pathname !== "/forms") return true;

  // Medications detail: /medications/[slug]
  if (pathname.startsWith("/medications/") && pathname !== "/medications") return true;

  // Psychiatric specifier detail: /specifiers/[slug]
  if (
    pathname.startsWith("/specifiers/") &&
    pathname !== "/specifiers" &&
    pathname !== "/specifiers/builder" &&
    pathname !== "/specifiers/compare" &&
    pathname !== "/specifiers/map"
  )
    return true;

  // Clinical formulation detail: /formulation/[slug]
  if (
    pathname.startsWith("/formulation/") &&
    pathname !== "/formulation" &&
    pathname !== "/formulation/builder" &&
    pathname !== "/formulation/compare" &&
    pathname !== "/formulation/map"
  )
    return true;

  // Factsheets detail: /factsheets/[slug]
  if (pathname.startsWith("/factsheets/") && pathname !== "/factsheets" && pathname !== "/factsheets/search")
    return true;

  // Therapy compass detail: /therapy-compass/[slug]/brief or /therapy-compass/[slug]/sheet
  if (
    pathname.startsWith("/therapy-compass/") &&
    pathname !== "/therapy-compass" &&
    pathname !== "/therapy-compass/compare" &&
    pathname !== "/therapy-compass/pathways" &&
    pathname !== "/therapy-compass/recommend" &&
    pathname !== "/therapy-compass/review" &&
    pathname !== "/therapy-compass/search"
  )
    return true;

  // Differential diagnosis detail: /differentials/diagnoses/[slug] or /differentials/presentations/[slug]
  if (pathname.startsWith("/differentials/diagnoses/") || pathname.startsWith("/differentials/presentations/"))
    return true;

  // DSM-5 Diagnosis detail: /dsm/diagnoses/[slug] or /dsm/diagnoses/[slug]/differentials or /dsm/compare
  if (pathname.startsWith("/dsm/diagnoses/")) return true;

  // Document detail: /documents/[id] (excluding /documents/search)
  if (pathname.startsWith("/documents/") && pathname !== "/documents/search") return true;

  return false;
}

function isToolDetailWithFooterSearch(pathname: string): boolean {
  return (
    (pathname.startsWith("/services/") && pathname !== "/services") ||
    (pathname.startsWith("/forms/") && pathname !== "/forms") ||
    (pathname.startsWith("/medications/") && pathname !== "/medications")
  );
}

function GlobalStandaloneSearchShellClient({
  children,
  initialMode = "answer",
  availableModeIds,
  desktopSearchPlacement = "default",
  searchComposerVisible = true,
  hideDesktopSidebar = false,
  chromeVisible = true,
  mobileChromeVisible = true,
}: GlobalSearchShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mainElement, setMainElement] = useState<HTMLDivElement | null>(null);
  const phoneScrollHide = useScrollHideReporter();
  const reportPhoneScrollHideRef = useRef(phoneScrollHide.reportScroll);
  const [bottomComposerHidden, setBottomComposerHidden] = useState(false);
  useEffect(() => {
    reportPhoneScrollHideRef.current = phoneScrollHide.reportScroll;
  }, [phoneScrollHide.reportScroll]);
  const visibleShellModes = useMemo(() => {
    const modes = visibleAppModeDefinitions();
    if (!availableModeIds?.length) return modes;
    const allowedModeIds = new Set<AppModeId>(availableModeIds);
    return modes.filter((mode) => allowedModeIds.has(mode.id));
  }, [availableModeIds]);
  const fallbackMode = visibleShellModes[0]?.id ?? initialMode;
  const initialSearchMode =
    availableModeIds?.length && !availableModeIds.includes(initialMode) ? fallbackMode : initialMode;
  const requestedFocus = searchParams.get("focus") === "1";
  const requestedRun = searchParams.get("run") === "1";
  const currentUrlHasQuery = searchParams.has("q") || searchParams.has("query");
  const requestedQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
  const requestedMode = searchParams.get("mode");
  const searchParamString = searchParams.toString();
  // Mode resolved from the URL (?mode=), falling back to this shell's default when
  // the param is missing, unknown, or not offered here. Seeds the initial mode and
  // re-syncs it after a navigation.
  const resolvedSearchMode =
    isAppModeId(requestedMode) &&
    isAppModeVisible(requestedMode) &&
    (!availableModeIds?.length || availableModeIds.includes(requestedMode))
      ? requestedMode
      : initialSearchMode;
  const [query, setQuery] = useState(requestedQuery);
  // The search string we last synced into local state, so the effect below only
  // reacts to genuine navigations. Seeded with the current string so the initial
  // mount is a no-op — the state above is already derived from the URL.
  const lastSyncedSearchParamsRef = useRef(searchParamString);
  const [searchMode, setSearchMode] = useState<AppModeId>(resolvedSearchMode);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>(
    () => readSearchNavigationContext(searchParams).queryMode,
  );
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>(
    () => readSearchNavigationContext(searchParams).scopeFilters,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const sidebarIdentity = useMemo(() => deriveSidebarIdentity(auth.session?.user.email), [auth.session?.user.email]);
  const hasSubmittedModeSearch = requestedRun && requestedQuery.length > 0;
  const isDocumentCommandSearchView = pathname === "/documents/search" && requestedQuery.length > 0;
  const useCompactBottomSearch = hasSubmittedModeSearch || isDocumentCommandSearchView;
  const differentialsCompareAddonActive =
    pathname === "/differentials" && searchMode === "differentials" && hasSubmittedModeSearch;
  // Registry and local decision-support modes own their submitted-search views on their
  // standalone routes; the shell must not swap them to the dashboard. On the
  // home route the dashboard always renders, so these exclusions only apply
  // to the standalone pages.
  const rendersDashboardSearch = shouldRenderDashboardSearch({
    hasSubmittedSearch: hasSubmittedModeSearch,
    mode: resolvedSearchMode,
    pathname,
  });
  const isStandaloneModeHome =
    !hasSubmittedModeSearch &&
    !rendersDashboardSearch &&
    ((searchMode === "services" && pathname === "/services") ||
      (searchMode === "forms" && pathname === "/forms") ||
      (searchMode === "favourites" && pathname === "/favourites") ||
      (searchMode === "differentials" && pathname === "/differentials") ||
      (searchMode === "dsm" && pathname === "/dsm") ||
      (searchMode === "specifiers" && pathname === "/specifiers") ||
      (searchMode === "formulation" && pathname === "/formulation") ||
      (searchMode === "factsheets" && pathname === "/factsheets") ||
      (searchMode === "therapy-compass" && pathname === "/therapy-compass") ||
      (searchMode === "tools" && pathname === "/tools"));
  const isDifferentialPresentationWorkflow = pathname.startsWith("/differentials/presentations");
  const shouldShowDesktopSidebar = !hideDesktopSidebar;
  const effectiveSidebarCollapsed = isDifferentialPresentationWorkflow ? true : sidebarCollapsed;
  const effectiveSidebarWidth = shouldShowDesktopSidebar ? (effectiveSidebarCollapsed ? "5.25rem" : "20rem") : "0px";
  const isInfoPage = isInformationPage(pathname);
  const shouldShowSearchComposer =
    searchComposerVisible &&
    !isDifferentialPresentationWorkflow &&
    (!isInfoPage || isToolDetailWithFooterSearch(pathname));
  const reservesFloatingComposer = shouldShowSearchComposer && !isStandaloneModeHome;
  // Standalone mode homes keep the in-flow hero pill at every width (no phone
  // dock reserve). Document viewer routes own their own floating composer, so
  // the shell keeps only a small pad and lets DocumentViewer manage clearance.
  // Release the large bottom reserve only when the phone bottom composer is
  // actually hidden (MasterSearchHeader's bottomComposerHidden). Header-only
  // scroll-hide, pinned compare addons, open menus/sheets, and composer focus
  // keep the full reserve so content does not slide under a still-visible dock.
  // Safari's bottom safe-area inset includes its translucent browser toolbar.
  // Reusing that inset after the app composer hides recreates a toolbar-sized
  // blank band, so the hidden state intentionally keeps only a small content
  // pad. Interactive composer chrome still receives the full inset above.
  const mobileComposerReserve = resolveMobileComposerReserve(
    bottomComposerHidden,
    resolveShellVisibleMobileComposerReserve({
      shouldShowSearchComposer,
      documentViewerOwnedRoute: isDocumentViewerOwnedRoute(pathname),
      isStandaloneModeHome,
      searchMode,
      differentialsCompareAddonActive,
    }),
  );

  useEffect(() => {
    // Re-derive the mode and query from the URL, but only when the search string
    // actually changes (a real navigation). Reacting on every render — as the old
    // requestAnimationFrame sync effectively did — let a deferred frame land after
    // a programmatic/user fill and wipe the controlled input; on slow CI WebKit
    // that raced the forms-detail composer to empty (input focused-but-empty,
    // submit stuck disabled). Typing never changes the URL, so a URL-gated sync
    // cannot clobber in-progress input, and the initial mount is skipped entirely
    // because the state above is already seeded from the URL.
    if (lastSyncedSearchParamsRef.current === searchParamString) return;
    lastSyncedSearchParamsRef.current = searchParamString;
    setSearchMode(resolvedSearchMode);
    setQuery(currentUrlHasQuery ? requestedQuery : "");
    const nextSearchContext = readSearchNavigationContext(new URLSearchParams(searchParamString));
    setQueryMode(nextSearchContext.queryMode);
    setScopeFilters(nextSearchContext.scopeFilters);
  }, [currentUrlHasQuery, requestedQuery, resolvedSearchMode, searchParamString]);

  useEffect(() => {
    if (!requestedFocus) return undefined;
    const focusInput = () => {
      // The focus=1 hydration retry (rAF + 300ms) can land after a user/test opens
      // the app-mode menu. Re-focusing the composer then blurs the menu wrapper and
      // blur-dismiss closes it before a mode option can be chosen.
      // Guard both: open menu DOM (activeElement is often <body> mid-transition) and
      // any intentional focus already moved off the composer.
      if (document.getElementById("app-mode-menu")) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && active !== inputRef.current) {
        return;
      }
      inputRef.current?.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusInput);
    const timeout = window.setTimeout(focusInput, focusHydrationRetryDelayMs);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname, requestedFocus, searchParamString]);

  // Recent queries are owner-scoped session state (2026-07-13 audit, finding 4):
  // the legacy unscoped localStorage value could resurface another account's
  // clinical queries on a shared workstation, so it is deleted, never read.
  const clientDemoMode = resolveClientDemoMode({
    explicitDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
    authUnavailableFallback: !auth.isConfigured,
    localNoAuthMode: isLocalNoAuthMode(),
  });
  const { favouritesAccessible, accountSetupOpen, accountSetupIntent, openAccountSetup, closeAccountSetup } =
    useFavouritesAccess(auth.status === "authenticated", clientDemoMode);
  const recentQueriesOwnerId = auth.session?.user.id ?? (clientDemoMode ? demoRecentQueryOwnerId : null);

  useEffect(() => {
    clearLegacyRecentQueries();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setRecentQueries(loadRecentQueries(recentQueriesOwnerId));
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [recentQueriesOwnerId]);

  function prefetchApplications() {
    router.prefetch("/?mode=tools");
    if (favouritesAccessible) router.prefetch("/favourites");
    router.prefetch("/differentials");
    router.prefetch("/dsm");
    router.prefetch("/specifiers");
    router.prefetch("/formulation");
    router.prefetch("/factsheets");
  }

  function openGuide() {
    setSettingsOpen(false);
    closeAccountSetup();
    setMobileMenuOpen(false);
    setGuideOpen(true);
  }

  function openSettings() {
    setGuideOpen(false);
    closeAccountSetup();
    setMobileMenuOpen(false);
    setSettingsOpen(true);
  }

  function openAccountProfile() {
    setGuideOpen(false);
    setMobileMenuOpen(false);
    if (sidebarIdentity.signedIn) {
      closeAccountSetup();
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen(false);
    openAccountSetup("default");
  }

  function navigateToMode(mode: AppModeId, options: SearchNavigationOptions = {}) {
    const nextOptions = { queryMode, scopeFilters, ...options };
    if (mode === "documents" && options.query?.trim()) {
      router.push(documentsSearchHref(nextOptions));
      return;
    }
    router.push(appModeHomeHref(mode, nextOptions));
  }

  function submitSearch() {
    const trimmedQuery = query.trim();
    navigateToMode(searchMode, {
      query: trimmedQuery || undefined,
      run: Boolean(trimmedQuery),
      focus: true,
    });
  }

  function changeMode(mode: AppModeId) {
    if (mode === "favourites" && !favouritesAccessible) {
      setGuideOpen(false);
      setSettingsOpen(false);
      setMobileMenuOpen(false);
      openAccountSetup("favourites");
      return;
    }
    setQuery("");
    setCommandScopes([]);
    setSearchMode(mode);
    setMobileMenuOpen(false);
    navigateToMode(mode);
  }

  function startNewAnswerChat() {
    setQuery("");
    setMobileMenuOpen(false);
    setSearchMode("answer");
    setQueryMode("auto");
    setScopeFilters({});
    router.push(appModeHomeHref("answer", { focus: true }));
  }

  function pickRecentQuery(recentQuery: string) {
    setMobileMenuOpen(false);
    navigateToMode(searchMode, { query: recentQuery, focus: true, run: true });
  }

  function crossModeSearch(mode: AppModeId, crossQuery: string) {
    if (mode === "favourites" && !favouritesAccessible) {
      setGuideOpen(false);
      setSettingsOpen(false);
      setMobileMenuOpen(false);
      openAccountSetup("favourites");
      return;
    }
    setQuery(crossQuery);
    setCommandScopes([]);
    setSearchMode(mode);
    setMobileMenuOpen(false);
    navigateToMode(mode, { query: crossQuery, focus: true, run: true });
  }

  function handleMainScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    phoneScrollHide.reportScroll({
      offset: target.scrollTop,
      maxOffset: Math.max(0, target.scrollHeight - target.clientHeight),
      collapseBudget: readChromeCollapseBudget(target),
      source: target,
    });
  }

  const mainRefCallback = (node: HTMLDivElement | null) => {
    setMainElement(node);
  };

  // Page canvases can become nested scrollers when `overflow-x-hidden` pairs with
  // a flex height cap (overflow-y becomes auto per CSS). Capture descendant scroll
  // so the phone dock/header still hide while users scroll results.
  useEffect(() => {
    const main = mainElement;
    if (!main) return undefined;

    const onScrollCapture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !main.contains(target)) return;
      if (target.scrollHeight <= target.clientHeight + 1) return;
      reportPhoneScrollHideRef.current({
        offset: target.scrollTop,
        maxOffset: Math.max(0, target.scrollHeight - target.clientHeight),
        // Collapsing chrome releases layout into nested scrollers too (their
        // flex height cap grows with the shell), so the same budget applies.
        collapseBudget: readChromeCollapseBudget(main),
        source: target,
      });
    };

    main.addEventListener("scroll", onScrollCapture, { capture: true, passive: true });
    return () => main.removeEventListener("scroll", onScrollCapture, { capture: true });
  }, [mainElement, chromeVisible]);

  if (!chromeVisible) {
    return (
      <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]">
        <div
          id="main-content"
          tabIndex={-1}
          className="min-h-dvh min-w-0 overflow-x-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Phone shell height comes from inset-0 alone, never 100dvh: iOS Safari
        // re-resolves dvh lazily when its toolbar collapses/expands (especially
        // with body scrolling disabled like here), leaving a dead band between
        // the clipped shell and the toolbar. Fixed insets track the live
        // viewport through the whole transition, so content stays edge to edge.
        "sm:min-h-dvh max-sm:fixed max-sm:inset-0 max-sm:overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]",
        shouldShowDesktopSidebar && "md:grid md:grid-cols-[5.25rem_minmax(0,1fr)]",
        shouldShowDesktopSidebar &&
          "motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-safe:ease-out",
        shouldShowDesktopSidebar &&
          (effectiveSidebarCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[20rem_minmax(0,1fr)]"),
      )}
      style={
        {
          "--clinical-sidebar-width": effectiveSidebarWidth,
          "--clinical-sidebar-width-md": shouldShowDesktopSidebar ? "5.25rem" : "0px",
          "--mobile-composer-reserve": mobileComposerReserve,
        } as CSSProperties
      }
    >
      {shouldShowDesktopSidebar ? (
        <div className="hidden md:block">
          <div className="sticky top-0 flex h-dvh min-h-0">
            <ClinicalDesktopSidebar
              collapsed={effectiveSidebarCollapsed}
              collapseLocked={isDifferentialPresentationWorkflow}
              recentQueries={recentQueries}
              identity={sidebarIdentity}
              activeMode={searchMode}
              showAccountLibrary={favouritesAccessible}
              onCollapsedChange={setSidebarCollapsed}
              onNewChat={startNewAnswerChat}
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
      ) : null}

      <div className="flex min-w-0 flex-col max-sm:h-full max-sm:min-h-0 max-sm:overflow-hidden sm:min-h-dvh">
        <div className={mobileChromeVisible ? undefined : "hidden lg:block"}>
          <MasterSearchHeader
            demoMode={clientDemoMode}
            documents={[]}
            documentTotal={0}
            query={query}
            searchMode={searchMode}
            loading={false}
            selectedDocumentIds={[]}
            queryMode={queryMode}
            scopeFilters={scopeFilters}
            realDataReady
            onQueryChange={setQuery}
            onSearchModeChange={changeMode}
            canAccessFavourites={favouritesAccessible}
            onRequestAccountSetup={() => {
              setGuideOpen(false);
              setSettingsOpen(false);
              setMobileMenuOpen(false);
              openAccountSetup("favourites");
            }}
            onAsk={submitSearch}
            onClearQuery={() => {
              setQuery("");
              if (isStandaloneModeHome) navigateToMode(searchMode, { focus: true });
            }}
            onClearScope={() => undefined}
            onQueryModeChange={setQueryMode}
            onScopeFiltersChange={setScopeFilters}
            onToggleScope={() => undefined}
            onOpenUpload={() =>
              router.push(`${appModeHomeHref("documents", { focus: true, queryMode, scopeFilters })}#sources`)
            }
            onOpenEvidence={() => navigateToMode("answer", { focus: true })}
            onNewChat={startNewAnswerChat}
            onOpenMobileSidebar={() => setMobileMenuOpen(true)}
            mobileLeadingAction={
              isInfoPage
                ? "back"
                : pathname === "/differentials" && searchMode === "differentials" && requestedQuery
                  ? "back"
                  : "menu"
            }
            onMobileBack={() => {
              if (isInfoPage) {
                if (pathname.startsWith("/services/")) {
                  router.push("/services");
                } else if (pathname.startsWith("/forms/")) {
                  router.push("/forms");
                } else if (pathname.startsWith("/medications/")) {
                  router.push("/?mode=prescribing");
                } else if (pathname.startsWith("/differentials/")) {
                  router.push("/differentials");
                } else if (pathname.startsWith("/dsm/")) {
                  router.push("/dsm");
                } else if (pathname.startsWith("/specifiers/")) {
                  router.push("/specifiers");
                } else if (pathname.startsWith("/formulation/")) {
                  router.push("/formulation");
                } else if (pathname.startsWith("/therapy-compass/")) {
                  router.push("/therapy-compass");
                } else if (pathname.startsWith("/factsheets/")) {
                  router.push("/factsheets");
                } else if (pathname.startsWith("/documents/")) {
                  router.push("/documents/search");
                } else {
                  router.back();
                }
              } else {
                setQuery("");
                navigateToMode(searchMode, { focus: true });
              }
            }}
            queryModeOptions={mockupQueryModeOptions}
            queryInputRef={inputRef}
            recentQueries={recentQueries}
            commandScopes={commandScopes}
            onCommandScopesChange={setCommandScopes}
            onPickRecent={pickRecentQuery}
            onCrossModeSearch={crossModeSearch}
            headerVariant={isDifferentialPresentationWorkflow ? "workflow" : "default"}
            mobileSearchPlacement="bottom"
            // Every phone dock is the compact single-row pill so content keeps
            // maximum screen space (mode homes and result views alike).
            mobileBottomSearchVariant="compact"
            mobileBottomSearchAddonSlotId={
              differentialsCompareAddonActive ? differentialsMobileCompareAddonSlotId : undefined
            }
            desktopSearchPlacement={desktopSearchPlacement === "hero" && isStandaloneModeHome ? "hero" : "default"}
            searchComposerVisible={shouldShowSearchComposer}
            desktopHomeComposerSlotId={isStandaloneModeHome ? modeHomeDesktopComposerSlotId : undefined}
            // Standalone mode homes keep the in-flow hero pill at every width,
            // phones included — the composer sits in the middle of the hero and
            // scrolls with the content, matching the answer home rather than
            // docking to the bottom edge.
            heroComposerBreakpoint="all"
            // Phone-only: #main-content owns vertical scroll, so hide-on-scroll
            // collapses the header/composer to hand space back to content.
            hideOnScroll={{ strategy: "collapse", scrollHidden: phoneScrollHide.hidden }}
            onBottomComposerHiddenChange={setBottomComposerHidden}
            queryInputAutoFocus={searchParams.get("focus") === "1"}
          />
        </div>

        <div
          id="main-content"
          ref={mainRefCallback}
          tabIndex={-1}
          onScroll={handleMainScroll}
          data-bottom-composer-hidden={bottomComposerHidden ? "true" : undefined}
          className={cn(
            // sm+ uses overflow-x-clip (not hidden): hidden forces overflow-y to
            // auto, which turns #main-content into the sticky scrollport while the
            // window does the actual scrolling — silently disabling every
            // position:sticky descendant (e.g. the document viewer rail).
            // Phone: keep a block formatting scrollport (not a column flex). A
            // flex-1 child overflowed past a sibling spacer without extending
            // scrollHeight, which parked long pages under the visible dock.
            "min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] max-sm:min-h-0 max-sm:flex-1 max-sm:overflow-x-hidden max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:[-webkit-overflow-scrolling:touch] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:overflow-x-clip",
            // sm+: static desktop clearance; use var(--safe-area-bottom) so tests
            // can simulate insets without depending on env() in Chromium.
            !reservesFloatingComposer
              ? "sm:pb-8"
              : searchMode === "answer"
                ? "sm:pb-[calc(9rem+var(--safe-area-bottom))]"
                : useCompactBottomSearch
                  ? "sm:pb-8"
                  : "sm:pb-[calc(9rem+var(--safe-area-bottom))]",
          )}
        >
          {/*
            Phone dock clearance lives on this inner pad (not #main-content):
            padding on the scrollport itself is omitted from scrollHeight in some
            flex/overflow combinations. The inner block box includes padding in
            its height, so end-of-page content clears the visible dock.
          */}
          <div data-testid="mobile-composer-reserve-pad" className="max-sm:pb-[var(--mobile-composer-reserve)]">
            <ClientHydrationBoundary
              fallback={<div className="min-h-[calc(100dvh-var(--shell-header-h))] overflow-x-hidden" aria-hidden />}
            >
              <SearchCommandProvider value={searchCommandContextValue}>{children}</SearchCommandProvider>
            </ClientHydrationBoundary>
          </div>
        </div>
      </div>

      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        identity={sidebarIdentity}
        onSignOut={auth.signOut}
        onOpenGuide={openGuide}
      />
      <AccountSetupDialog open={accountSetupOpen} onClose={closeAccountSetup} intent={accountSetupIntent} />
      <ClinicalMobileSidebar
        open={mobileMenuOpen}
        // The workflow header keeps its menu trigger past md, so the drawer
        // must stay available until the locked desktop rail takes over at lg.
        hiddenFrom={isDifferentialPresentationWorkflow ? "lg" : "md"}
        recentQueries={recentQueries}
        identity={sidebarIdentity}
        activeMode={searchMode}
        showAccountLibrary={favouritesAccessible}
        onOpenChange={setMobileMenuOpen}
        onNewChat={startNewAnswerChat}
        onPickRecent={pickRecentQuery}
        onOpenGuide={openGuide}
        onOpenSettings={openSettings}
        onOpenAccount={openAccountProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPrefetchApplications={prefetchApplications}
      />
    </div>
  );
}
