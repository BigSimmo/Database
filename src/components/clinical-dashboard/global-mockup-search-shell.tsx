"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ClinicalDashboard } from "@/components/clinical-dashboard";
import { recentQueryStorageKey, SettingsDialog } from "@/components/ClinicalDashboard";
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
import { cn } from "@/components/ui-primitives";
import {
  appModeHomeHref,
  isAppModeId,
  isAppModeVisible,
  visibleAppModeDefinitions,
  type AppModeId,
} from "@/lib/app-modes";
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

type GlobalMockupSearchShellProps = {
  children: ReactNode;
  initialMode?: AppModeId;
  availableModeIds?: readonly AppModeId[];
  desktopSearchPlacement?: "default" | "hero";
  /** Hide the shared search composer on routes that provide their own search surface. */
  searchComposerVisible?: boolean;
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
  const requestedRun = searchParams.get("run") === "1";
  const currentUrlHasQuery = searchParams.has("q") || searchParams.has("query");
  const requestedQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
  const requestedMode = searchParams.get("mode");
  const searchParamString = searchParams.toString();
  const [query, setQuery] = useState(requestedQuery);
  const previousUrlHadQueryRef = useRef(currentUrlHasQuery);
  const [searchMode, setSearchMode] = useState<AppModeId>(initialSearchMode);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuthSession();
  const sidebarIdentity = useMemo(() => deriveSidebarIdentity(auth.session?.user.email), [auth.session?.user.email]);
  const dashboardSearchMode =
    isAppModeId(requestedMode) &&
    isAppModeVisible(requestedMode) &&
    (!availableModeIds?.length || availableModeIds.includes(requestedMode))
      ? requestedMode
      : initialSearchMode;
  const shouldRenderDashboardSearch = requestedRun && requestedQuery.length > 0;
  const isFormsOnlyShell = availableModeIds?.length === 1 && availableModeIds[0] === "forms";
  const isStandaloneModeHome =
    !shouldRenderDashboardSearch &&
    ((searchMode === "services" && pathname === "/services") ||
      (searchMode === "forms" && pathname === "/forms") ||
      (searchMode === "favourites" && pathname === "/favourites") ||
      (searchMode === "differentials" && pathname === "/differentials"));
  const isDifferentialPresentationWorkflow = pathname.startsWith("/differentials/presentations");
  // True when on a sub-route of a mode home (e.g. /forms/transport-crisis-form,
  // /services/13yarn) rather than the mode home itself (/forms, /services).
  const isDetailPage =
    /^\/(forms|services|favourites)\/.+/.test(pathname) || /^\/differentials\/diagnoses\/.+/.test(pathname);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedMode = params.get("mode");
      const nextMode =
        isAppModeId(requestedMode) &&
        isAppModeVisible(requestedMode) &&
        (!availableModeIds?.length || availableModeIds.includes(requestedMode))
          ? requestedMode
          : initialSearchMode;
      setSearchMode(nextMode);

      const urlHasQuery = params.has("q") || params.has("query");
      const hadQueryBeforeThisSync = previousUrlHadQueryRef.current;
      previousUrlHadQueryRef.current = urlHasQuery;
      if (urlHasQuery) {
        // Sync the controlled query state from the URL query param.
        const requestedQuery = (params.get("q") ?? params.get("query"))?.trim();
        setQuery(requestedQuery ?? "");
      } else if (!isDetailPage || hadQueryBeforeThisSync) {
        // On no-query routes, clear any stale URL-derived query. Initial detail
        // page mounts still skip the deferred clear so programmatic fills are
        // not wiped by the WebKit requestAnimationFrame race.
        setQuery("");
      }

      if (params.get("focus") === "1") inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [availableModeIds, initialSearchMode, isDetailPage, pathname, searchParamString]);

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
    setMobileMenuOpen(false);
    setGuideOpen(true);
  }

  function openSettings() {
    setGuideOpen(false);
    setMobileMenuOpen(false);
    setSettingsOpen(true);
  }

  function navigateToMode(mode: AppModeId, options: { query?: string; run?: boolean; focus?: boolean } = {}) {
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
    setSearchMode(mode);
    setMobileMenuOpen(false);
    navigateToMode(mode);
  }

  function startNewChat() {
    setQuery("");
    setSearchMode(fallbackMode);
    setMobileMenuOpen(false);
    navigateToMode(fallbackMode, { focus: true });
  }

  function startNewAnswerChat() {
    setQuery("");
    setMobileMenuOpen(false);
    navigateToMode("answer", { focus: true });
  }

  function pickRecentQuery(recentQuery: string) {
    setMobileMenuOpen(false);
    navigateToMode("answer", { query: recentQuery, focus: true });
  }

  if (shouldRenderDashboardSearch && dashboardSearchMode === "forms" && isFormsOnlyShell) {
    return <FormsSearchResultsPage query={requestedQuery} focusSearch={searchParams.get("focus") === "1"} />;
  }

  if (shouldRenderDashboardSearch) {
    return (
      <ClinicalDashboard
        initialSearchMode={dashboardSearchMode}
        initialQuery={requestedQuery}
        focusSearch={searchParams.get("focus") === "1"}
        autoRunSearch
      />
    );
  }

  return (
    <div
      className={cn(
        "min-h-dvh bg-[color:var(--background)] text-[color:var(--text)] lg:grid",
        sidebarCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[20rem_minmax(0,1fr)]",
      )}
      style={
        {
          "--clinical-sidebar-width": sidebarCollapsed ? "5.25rem" : "20rem",
        } as CSSProperties
      }
    >
      <div className="hidden lg:block">
        <div className="sticky top-0 flex h-dvh min-h-0">
          <ClinicalDesktopSidebar
            collapsed={sidebarCollapsed}
            recentQueries={recentQueries}
            identity={sidebarIdentity}
            activeMode={searchMode}
            onCollapsedChange={setSidebarCollapsed}
            onNewChat={startNewAnswerChat}
            onPickRecent={pickRecentQuery}
            onOpenGuide={openGuide}
            onOpenSettings={openSettings}
            theme={theme}
            onToggleTheme={toggleTheme}
            onPrefetchApplications={prefetchApplications}
          />
        </div>
      </div>

      <div className="flex min-h-dvh min-w-0 flex-col">
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
          onClearQuery={() => setQuery("")}
          onClearScope={() => undefined}
          onQueryModeChange={setQueryMode}
          onScopeFiltersChange={setScopeFilters}
          onToggleScope={() => undefined}
          onOpenUpload={() => router.push(`${appModeHomeHref("documents", { focus: true })}#sources`)}
          onOpenEvidence={() => navigateToMode("answer", { focus: true })}
          onNewChat={startNewChat}
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
          headerVariant={isDifferentialPresentationWorkflow ? "workflow" : "default"}
          mobileSearchPlacement="bottom"
          desktopSearchPlacement={
            (desktopSearchPlacement === "hero" || isFormsOnlyShell) && isStandaloneModeHome ? "hero" : "default"
          }
          searchComposerVisible={searchComposerVisible && !isDifferentialPresentationWorkflow}
          workflowCopyText={
            isDifferentialPresentationWorkflow
              ? "Acute confusion / encephalopathy differential comparison. Stabilise ABCs, check BGL, sats, attention test, collateral, and review medications/substances before handoff."
              : undefined
          }
          desktopHomeComposerSlotId={isStandaloneModeHome ? modeHomeDesktopComposerSlotId : undefined}
        />

        <div
          id="main-content"
          className={cn(
            "min-h-[calc(100dvh-4rem)] min-w-0 overflow-x-hidden",
            !searchComposerVisible
              ? "pb-8"
              : searchMode === "answer"
                ? "pb-[calc(9rem+env(safe-area-inset-bottom))]"
                : "pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-8",
          )}
        >
          {children}
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
      <ClinicalMobileSidebar
        open={mobileMenuOpen}
        recentQueries={recentQueries}
        identity={sidebarIdentity}
        activeMode={searchMode}
        onOpenChange={setMobileMenuOpen}
        onNewChat={startNewAnswerChat}
        onPickRecent={pickRecentQuery}
        onOpenGuide={openGuide}
        onOpenSettings={openSettings}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPrefetchApplications={prefetchApplications}
      />
    </div>
  );
}
