"use client";

import { useRouter } from "next/navigation";
import { FileText, Heart, ListChecks, Pill, Search, Sparkles, Wrench } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { MasterSearchHeader } from "@/components/clinical-dashboard/master-search-header";
import { useTheme } from "@/components/clinical-dashboard/use-theme";
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
  prescribing: Pill,
  evidence: ListChecks,
  favourites: Heart,
  tools: Wrench,
};

export function GlobalMockupSearchShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<AppModeId>("answer");
  const [queryMode, setQueryMode] = useState<ClinicalQueryMode>("auto");
  const [scopeFilters, setScopeFilters] = useState<SearchScopeFilters>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedMode = params.get("mode");
      if (isAppModeId(requestedMode) && isAppModeVisible(requestedMode)) setSearchMode(requestedMode);

      const requestedQuery = params.get("q")?.trim();
      if (requestedQuery) setQuery(requestedQuery);

      if (params.get("focus") === "1") inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    setSearchMode(mode);
    setMobileMenuOpen(false);
    navigateToMode(mode, { focus: true });
  }

  function startNewChat() {
    setQuery("");
    setSearchMode("answer");
    setMobileMenuOpen(false);
    navigateToMode("answer", { focus: true });
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
        theme={theme}
        onQueryChange={setQuery}
        onSearchModeChange={changeMode}
        onAsk={submitSearch}
        onClearQuery={() => setQuery("")}
        onClearScope={() => undefined}
        onQueryModeChange={setQueryMode}
        onScopeFiltersChange={setScopeFilters}
        onToggleScope={() => undefined}
        onOpenUpload={() => router.push(`${appModeHomeHref("documents", { focus: true })}#sources`)}
        onOpenEvidence={() => navigateToMode("evidence", { focus: true })}
        onNewChat={startNewChat}
        onOpenMobileSidebar={() => setMobileMenuOpen(true)}
        onToggleTheme={toggleTheme}
        queryModeOptions={mockupQueryModeOptions}
        scopeVariant="placeholder"
        queryInputRef={inputRef}
        modeAlignment="center"
      />

      <div
        id="main-content"
        className="min-h-[calc(100dvh-4rem)] overflow-x-hidden pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
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
          {visibleAppModeDefinitions().map((mode) => {
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
