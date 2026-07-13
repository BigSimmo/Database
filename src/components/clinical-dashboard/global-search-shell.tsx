"use client";

import dynamic from "next/dynamic";
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
import {
  clearLegacyRecentQueries,
  demoRecentQueryOwnerId,
  loadRecentQueries,
} from "@/components/clinical-dashboard/recent-query-storage";
import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import { SettingsDialog } from "@/components/clinical-dashboard/settings-dialog";
import {
  ClinicalDesktopSidebar,
  ClinicalMobileSidebar,
  deriveSidebarIdentity,
} from "@/components/clinical-dashboard/ClinicalSidebar";
import { GuideDialog } from "@/components/clinical-dashboard/dashboard-shell";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { useScrollHideReporter } from "@/components/clinical-dashboard/use-hide-on-scroll";
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
import { isLocalNoAuthMode } from "@/lib/client-env";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { readSearchNavigationContext, type SearchNavigationOptions } from "@/lib/search-navigation-context";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { useAuthSession } from "@/lib/supabase/client";
import type { ClinicalQueryMode } from "@/lib/types";

const ClinicalDashboard = dynamic(
  () => import("@/components/ClinicalDashboard").then((module) => module.ClinicalDashboard),
  { ssr: false, loading: () => <ModeHomeRouteLoading /> },
);

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
  const searchParams = useSearchParams();
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
  const isHomeRoute = pathname === "/";
  const isDocumentSearchMockupRoute = pathname.startsWith("/mockups/document-search");
  const shouldRenderDashboardSearch =
    hasSubmittedModeSearch &&
    resolvedSearchMode !== "services" &&
    resolvedSearchMode !== "forms" &&
    resolvedSearchMode !== "favourites" &&
    resolvedSearchMode !== "differentials" &&
    resolvedSearchMode !== "specifiers" &&
    !isDocumentSearchMockupRoute;
  const isMedicationDetailRoute = /^\/medications\/[^/]+$/.test(pathname);
  const shouldRenderClinicalDashboard = !isMedicationDetailRoute && (isHomeRoute || shouldRenderDashboardSearch);

  if (shouldRenderClinicalDashboard) {
    return (
      <ClinicalDashboard
        initialSearchMode={resolvedSearchMode}
        initialQuery={requestedQuery}
        focusSearch={searchParams.get("focus") === "1"}
        autoRunSearch={isHomeRoute ? hasSubmittedModeSearch : true}
      />
    );
  }

  return <GlobalStandaloneSearchShellClient {...props} />;
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
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
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
  const [bottomSearchScrollHidden, setBottomSearchScrollHidden] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const sidebarIdentity = useMemo(() => deriveSidebarIdentity(auth.session?.user.email), [auth.session?.user.email]);
  const hasSubmittedModeSearch = requestedRun && requestedQuery.length > 0;
  const isDocumentSearchMockupRoute = pathname.startsWith("/mockups/document-search");
  const isDocumentCommandSearchView = pathname === "/documents/search" && requestedQuery.length > 0;
  const useCompactBottomSearch = hasSubmittedModeSearch || isDocumentCommandSearchView;
  // Services, forms, and favourites own their submitted-search views on their
  // standalone routes; the shell must not swap them to the dashboard. On the
  // home route the dashboard always renders, so these exclusions only apply
  // to the standalone pages.
  const shouldRenderDashboardSearch =
    hasSubmittedModeSearch &&
    resolvedSearchMode !== "services" &&
    resolvedSearchMode !== "forms" &&
    resolvedSearchMode !== "favourites" &&
    resolvedSearchMode !== "differentials" &&
    resolvedSearchMode !== "specifiers" &&
    !isDocumentSearchMockupRoute;
  const isStandaloneModeHome =
    !hasSubmittedModeSearch &&
    !shouldRenderDashboardSearch &&
    ((searchMode === "services" && pathname === "/services") ||
      (searchMode === "forms" && pathname === "/forms") ||
      (searchMode === "favourites" && pathname === "/favourites") ||
      (searchMode === "differentials" && pathname === "/differentials") ||
      (searchMode === "specifiers" && pathname === "/specifiers") ||
      (searchMode === "tools" && pathname === "/tools"));
  const isDifferentialPresentationWorkflow = pathname.startsWith("/differentials/presentations");
  const shouldShowDesktopSidebar = !hideDesktopSidebar;
  const effectiveSidebarCollapsed = isDifferentialPresentationWorkflow ? true : sidebarCollapsed;
  const effectiveSidebarWidth = shouldShowDesktopSidebar ? (effectiveSidebarCollapsed ? "5.25rem" : "20rem") : "0px";
  const shouldShowSearchComposer = searchComposerVisible && !isDifferentialPresentationWorkflow;
  const reservesFloatingComposer = shouldShowSearchComposer && !isStandaloneModeHome;
  // Standalone mode homes portal the composer into the hero (in-flow at every
  // width), so phones need no bottom-dock clearance there.
  const mobileComposerReserve = !shouldShowSearchComposer
    ? "2rem"
    : isStandaloneModeHome
      ? "2rem"
      : searchMode === "answer"
        ? "calc(9rem + env(safe-area-inset-bottom))"
        : useCompactBottomSearch
          ? "calc(5.5rem + env(safe-area-inset-bottom))"
          : "calc(9rem + env(safe-area-inset-bottom))";

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
  const recentQueriesOwnerId =
    auth.session?.user.id ??
    (!auth.isConfigured || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || isLocalNoAuthMode()
      ? demoRecentQueryOwnerId
      : null);

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
    router.prefetch("/favourites");
    router.prefetch("/differentials");
    router.prefetch("/specifiers");
  }

  function openGuide() {
    setSettingsOpen(false);
    setAccountSetupOpen(false);
    setMobileMenuOpen(false);
    setGuideOpen(true);
  }

  function openSettings() {
    setGuideOpen(false);
    setAccountSetupOpen(false);
    setMobileMenuOpen(false);
    setSettingsOpen(true);
  }

  function openAccountProfile() {
    setGuideOpen(false);
    setMobileMenuOpen(false);
    if (sidebarIdentity.signedIn) {
      setAccountSetupOpen(false);
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen(false);
    setAccountSetupOpen(true);
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
    setQuery(crossQuery);
    setCommandScopes([]);
    setSearchMode(mode);
    setMobileMenuOpen(false);
    navigateToMode(mode, { query: crossQuery, focus: true, run: true });
  }

  function handleMainScroll(event: UIEvent<HTMLDivElement>) {
    phoneScrollHide.reportScroll(event.currentTarget.scrollTop);
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
      reportPhoneScrollHideRef.current(target.scrollTop);
    };

    main.addEventListener("scroll", onScrollCapture, { capture: true, passive: true });
    return () => main.removeEventListener("scroll", onScrollCapture, { capture: true });
  }, [mainElement, chromeVisible]);

  if (!chromeVisible) {
    return (
      <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]">
        <div id="main-content" tabIndex={-1} className="min-h-dvh min-w-0 overflow-x-hidden focus:outline-none">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-dvh max-sm:h-dvh max-sm:overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]",
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

      <div className="flex min-h-dvh min-w-0 flex-col max-sm:h-dvh max-sm:min-h-0 max-sm:overflow-hidden">
        <div className={mobileChromeVisible ? undefined : "hidden lg:block"}>
          <MasterSearchHeader
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
              pathname === "/differentials" && searchMode === "differentials" && requestedQuery ? "back" : "menu"
            }
            onMobileBack={() => {
              setQuery("");
              navigateToMode(searchMode, { focus: true });
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
            // Submitted searches that stay in the shell (services results) are
            // result views: compact the phone bottom composer so results keep
            // maximum screen space. Mode homes keep the chip-row layout.
            mobileBottomSearchVariant={useCompactBottomSearch ? "compact" : "default"}
            desktopSearchPlacement={desktopSearchPlacement === "hero" && isStandaloneModeHome ? "hero" : "default"}
            searchComposerVisible={shouldShowSearchComposer}
            desktopHomeComposerSlotId={isStandaloneModeHome ? modeHomeDesktopComposerSlotId : undefined}
            // Phone-only: #main-content owns vertical scroll, so hide-on-scroll
            // collapses the header/composer to hand space back to content.
            hideOnScroll={{ strategy: "collapse", scrollHidden: phoneScrollHide.hidden }}
            onBottomComposerScrollHiddenChange={setBottomSearchScrollHidden}
            queryInputAutoFocus={searchParams.get("focus") === "1"}
          />
        </div>

        <div
          id="main-content"
          ref={mainRefCallback}
          tabIndex={-1}
          onScroll={handleMainScroll}
          className={cn(
            // sm+ uses overflow-x-clip (not hidden): hidden forces overflow-y to
            // auto, which turns #main-content into the sticky scrollport while the
            // window does the actual scrolling — silently disabling every
            // position:sticky descendant (e.g. the document viewer rail).
            "min-w-0 focus:outline-none max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col max-sm:overflow-x-hidden max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:[-webkit-overflow-scrolling:touch] sm:min-h-[calc(100dvh-4rem)] sm:overflow-x-clip",
            !reservesFloatingComposer
              ? "max-sm:pb-[var(--mobile-composer-reserve)] sm:pb-8"
              : bottomSearchScrollHidden
                ? "max-sm:pb-8 sm:pb-8"
                : searchMode === "answer"
                  ? "max-sm:pb-[var(--mobile-composer-reserve)] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]"
                  : useCompactBottomSearch
                    ? "max-sm:pb-[var(--mobile-composer-reserve)] sm:pb-8"
                    : "max-sm:pb-[var(--mobile-composer-reserve)] sm:pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-8",
          )}
        >
          <div className="max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col">
            <ClientHydrationBoundary
              fallback={<div className="min-h-[calc(100dvh-4rem)] overflow-x-hidden" aria-hidden />}
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
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignOut={auth.signOut}
        onOpenGuide={openGuide}
      />
      <AccountSetupDialog open={accountSetupOpen} onClose={() => setAccountSetupOpen(false)} />
      <ClinicalMobileSidebar
        open={mobileMenuOpen}
        // The workflow header keeps its menu trigger past md, so the drawer
        // must stay available until the locked desktop rail takes over at lg.
        hiddenFrom={isDifferentialPresentationWorkflow ? "lg" : "md"}
        recentQueries={recentQueries}
        identity={sidebarIdentity}
        activeMode={searchMode}
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
