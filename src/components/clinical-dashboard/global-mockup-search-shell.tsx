"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrainCircuit, ClipboardList, FileText, Heart, Pill, Search, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Suspense, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ClinicalDashboard } from "@/components/clinical-dashboard";
import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { FormsSearchResultsPage } from "@/components/forms/forms-search-results-page";
import { Sheet } from "@/components/ui/sheet";
import { cn, sidebarItem } from "@/components/ui-primitives";
import {
  appModeDefinition,
  appModeHomeHref,
  isAppModeId,
  isAppModeVisible,
  visibleAppModeDefinitions,
  type AppModeId,
} from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import type { SearchScopeFilters } from "@/lib/search-scope";
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

const appModeIcons: Record<AppModeId, typeof Search> = {
  answer: Sparkles,
  documents: FileText,
  services: ShieldCheck,
  forms: ClipboardList,
  favourites: Heart,
  differentials: BrainCircuit,
  prescribing: Pill,
  tools: Wrench,
};

type GlobalMockupSearchShellProps = {
  children: ReactNode;
  initialMode?: AppModeId;
  availableModeIds?: readonly AppModeId[];
  desktopSearchPlacement?: "default" | "hero";
};

export function GlobalMockupSearchShell(props: GlobalMockupSearchShellProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]">
          <div id="main-content" className="min-h-[calc(100dvh-4rem)] overflow-x-hidden pb-8">
            {props.children}
          </div>
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
  const initialSearchMode = availableModeIds?.length && !availableModeIds.includes(initialMode) ? fallbackMode : initialMode;
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<AppModeId>(initialSearchMode);
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const requestedRun = searchParams.get("run") === "1";
  const requestedQuery = searchParams.get("q")?.trim() ?? "";
  const requestedMode = searchParams.get("mode");
  const searchParamString = searchParams.toString();
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

      const requestedQuery = params.get("q")?.trim();
      setQuery(requestedQuery ?? "");

      if (params.get("focus") === "1") inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [availableModeIds, initialSearchMode, pathname, searchParamString]);

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
      className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]"
      style={{ "--clinical-sidebar-width": "0rem" } as CSSProperties}
    >
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
        queryModeOptions={mockupQueryModeOptions}
        queryInputRef={inputRef}
        headerVariant={isDifferentialPresentationWorkflow ? "workflow" : "default"}
        modeAlignment={isDifferentialPresentationWorkflow ? "default" : "center"}
        mobileSearchPlacement="bottom"
        desktopSearchPlacement={
          desktopSearchPlacement === "hero" || (isFormsOnlyShell && isStandaloneModeHome) ? "hero" : "default"
        }
        searchComposerVisible={!isDifferentialPresentationWorkflow}
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
          "min-h-[calc(100dvh-4rem)] overflow-x-hidden",
          searchMode === "answer"
            ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-8",
        )}
      >
        {children}
      </div>

      <Sheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="Clinical Guide"
        description="Choose the search workspace."
        closeLabel="Close Clinical Guide menu"
        placement="left"
        contentClassName="max-w-[min(20rem,calc(100vw-1rem))]"
      >
        <nav aria-label="Clinical Guide workspaces" className="grid gap-1">
          {visibleShellModes.map((mode) => {
            const Icon = appModeIcons[mode.id];
            const active = mode.id === searchMode;
            const modeDefinition = appModeDefinition(mode.id);
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => changeMode(mode.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  sidebarItem,
                  "grid grid-cols-[2rem_minmax(0,1fr)] px-2.5 py-2 text-left",
                  active && "bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{modeDefinition.label}</span>
                  <span className="block truncate text-xs font-medium text-[color:var(--text-soft)]">
                    {modeDefinition.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </Sheet>
    </div>
  );
}
