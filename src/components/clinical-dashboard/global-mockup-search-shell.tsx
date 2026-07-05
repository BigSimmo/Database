"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ClinicalDashboard } from "@/components/clinical-dashboard";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { recentQueryStorageKey, SettingsDialog } from "@/components/ClinicalDashboard";
import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import {
  ClinicalDesktopSidebar,
  ClinicalMobileSidebar,
  deriveSidebarIdentity,
} from "@/components/clinical-dashboard/ClinicalSidebar";
import { GuideDialog } from "@/components/clinical-dashboard/dashboard-shell";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { useSidebarCollapsed } from "@/components/clinical-dashboard/use-sidebar-collapsed";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
import { FormsSearchResultsPage } from "@/components/forms/forms-search-results-page";
import { ClientHydrationBoundary } from "@/components/client-hydration-boundary";
import { cn } from "@/components/ui-primitives";
import {
  appModeHomeHref,
  isAppModeId,
  isAppModeVisible,
  visibleAppModeDefinitions,
  type AppModeId,
} from "@/lib/app-modes";
import { documentsSearchHref } from "@/lib/document-flow-routes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
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

type GlobalMockupSearchShellProps = {
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

export function GlobalMockupSearchShell(props: GlobalMockupSearchShellProps) {
  return (
    <Suspense
      fallback={
        // A neutral placeholder — do NOT render props.children here. The client
        // body below also renders {children} inside `#main-content`, and echoing
        // them in the fallback duplicated the page subtree (two `#main-content`
        // and two `data-testid` on medication/forms/services pages) whenever the
        // fallback and resolved content briefly coexisted.
        <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]">
          <div className="min-h-[calc(100dvh-4rem)] overflow-x-hidden pb-8" />
        </div>
      }
    >
      <GlobalMockupSearchShellClient {...props} />
    </Suspense>
  );
}

function GlobalMockupSearchShellClient({
  children,
  initialMode = "answer",
  availableModeIds,
  desktopSearchPlacement = "default",
  searchComposerVisible = true,
  hideDesktopSidebar = false,
  chromeVisible = true,
  mobileChromeVisible = true,
}: GlobalMockupSearchShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
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
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [commandScopes, setCommandScopes] = useState<string[]>([]);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const sidebarIdentity = useMemo(() => deriveSidebarIdentity(auth.session?.user.email), [auth.session?.user.email]);
  const hasSubmittedModeSearch = requestedRun && requestedQuery.length > 0;
  const isHomeRoute = pathname === "/";
  const isDocumentFlowRoute = pathname === "/documents/search" || pathname.startsWith("/documents/source");
  const isDocumentSearchMockupRoute = pathname.startsWith("/mockups/document-search") || isDocumentFlowRoute;
  const isDocumentCommandSearchView = pathname === "/documents/search" && requestedQuery.length > 0;
  const useCompactBottomSearch = hasSubmittedModeSearch || isDocumentCommandSearchView;
  const shouldRenderDashboardSearch =
    hasSubmittedModeSearch && resolvedSearchMode !== "services" && !isDocumentSearchMockupRoute;
  const isFormsOnlyShell = availableModeIds?.length === 1 && availableModeIds[0] === "forms";
  const shouldRenderFormsSearchResults =
    shouldRenderDashboardSearch && resolvedSearchMode === "forms" && isFormsOnlyShell;
  const isStandaloneModeHome =
    !hasSubmittedModeSearch &&
    !shouldRenderDashboardSearch &&
    ((searchMode === "services" && pathname === "/services") ||
      (searchMode === "forms" && pathname === "/forms") ||
      (searchMode === "favourites" && pathname === "/favourites") ||
      (searchMode === "differentials" && pathname === "/differentials"));
  const isDifferentialPresentationWorkflow = pathname.startsWith("/differentials/presentations");
  const shouldShowDesktopSidebar = !hideDesktopSidebar;
  const effectiveSidebarCollapsed = isDifferentialPresentationWorkflow ? true : sidebarCollapsed;
  const effectiveSidebarWidth = shouldShowDesktopSidebar ? (effectiveSidebarCollapsed ? "5.25rem" : "20rem") : "0px";
  const shouldShowSearchComposer = searchComposerVisible && !isDifferentialPresentationWorkflow;

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

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(recentQueryStorageKey) ?? "[]");
        if (Array.isArray(stored) && !cancelled) {
          setRecentQueries(
            stored.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 5),
          );
        }
      } catch {
        if (!cancelled) setRecentQueries([]);
      }
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  function prefetchApplications() {
    router.prefetch("/?mode=tools");
    router.prefetch("/favourites");
    router.prefetch("/differentials");
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

  function navigateToMode(mode: AppModeId, options: { query?: string; run?: boolean; focus?: boolean } = {}) {
    if (mode === "documents" && options.query?.trim()) {
      router.push(documentsSearchHref(options));
      return;
    }
    router.push(appModeHomeHref(mode, options));
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
    navigateToMode("answer", { focus: true });
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

  const isMedicationDetailRoute = /^\/medications\/[^/]+$/.test(pathname);
  const shouldRenderClinicalDashboard =
    !isMedicationDetailRoute &&
    (isHomeRoute || (shouldRenderDashboardSearch && !shouldRenderFormsSearchResults));

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
        "min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]",
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

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* max-sm:contents lets the header's own `sticky top-0` engage against
            the document scroll on phones (a plain wrapper div otherwise caps
            its sticking range at its own height), which the phone
            hide-on-scroll overlay relies on. */}
        <div className={mobileChromeVisible ? "max-sm:contents" : "hidden lg:block"}>
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
            onOpenUpload={() => router.push(`${appModeHomeHref("documents", { focus: true })}#sources`)}
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
            desktopSearchPlacement={
              (desktopSearchPlacement === "hero" || isFormsOnlyShell) && isStandaloneModeHome ? "hero" : "default"
            }
            searchComposerVisible={shouldShowSearchComposer}
            desktopHomeComposerSlotId={isStandaloneModeHome ? modeHomeDesktopComposerSlotId : undefined}
            heroComposerFromTablet={isStandaloneModeHome}
            // Phone-only: the document scrolls here and the header is sticky,
            // so a translate overlay hides it with zero layout shift.
            hideOnScroll={{ strategy: "overlay" }}
            queryInputAutoFocus={searchParams.get("focus") === "1"}
          />
        </div>

        <div
          id="main-content"
          tabIndex={-1}
          className={cn(
            // Phone: fill the space under the header exactly (the header is
            // taller than the 4rem the calc assumed, which forced a phantom
            // scrollbar on every standalone page). sm+ keeps the original calc.
            "min-w-0 overflow-x-hidden focus:outline-none max-sm:flex-1 sm:min-h-[calc(100dvh-4rem)]",
            !shouldShowSearchComposer
              ? "pb-8"
              : searchMode === "answer"
                ? "pb-[calc(9rem+env(safe-area-inset-bottom))]"
                : useCompactBottomSearch
                  ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-8"
                  : "pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-8",
          )}
        >
          <ClientHydrationBoundary
            fallback={<div className="min-h-[calc(100dvh-4rem)] overflow-x-hidden" aria-hidden />}
          >
            <SearchCommandProvider
              value={{
                query,
                modeId: searchMode,
                commandScopes,
                onRemoveScope: (scopeId) => setCommandScopes((current) => current.filter((scope) => scope !== scopeId)),
                onClearScopes: () => setCommandScopes([]),
              }}
            >
              {shouldRenderFormsSearchResults ? <FormsSearchResultsPage query={requestedQuery} /> : children}
            </SearchCommandProvider>
          </ClientHydrationBoundary>
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
