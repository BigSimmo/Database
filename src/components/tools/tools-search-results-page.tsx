"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, ClipboardList, Search, ShieldCheck, Waves, type LucideIcon } from "lucide-react";
import {
  type MutableRefObject,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { useFavouritesAccess } from "@/components/clinical-dashboard/use-favourites-access";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { cardPadding, cardSelected, cardSurface, focusRing } from "@/components/card-recipes";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";
import { modeHomeComposerReservePendingValue } from "@/lib/mode-home-composer";
import { cn, controlBase, floatingControl, primaryControl } from "@/components/ui-primitives";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { normalizeSearchText } from "@/lib/catalog-search";
import { toolIdentity } from "@/lib/category-identity";
import { isLocalNoAuthMode, resolveClientDemoMode } from "@/lib/client-env";
import { useAuthSession } from "@/lib/supabase/client";
import {
  toolCatalogRecordsForSession,
  toolSearchText,
  type ToolCatalogArea,
  type ToolCatalogRecord,
} from "@/lib/tools-catalog";

// A partial second copy of the launcher's icon map used to live here: 8 of the
// 14 tools, with a `?? Grid2X2` fallback that silently gave `guidelines`,
// `care-plans`, `safety-plan`, `calculators`, `monitoring`, and `ward-management`
// a generic grid glyph on this page while the launcher showed them a real one.
// Identity now comes from `src/lib/category-identity.ts`, where the record is
// exhaustive by type, so the partial copy cannot come back.

const filterOptions = [
  { id: "all", label: "All tools" },
  { id: "assessment", label: "Assess" },
  { id: "reference", label: "Evidence" },
  { id: "care", label: "Treat" },
  { id: "coordination", label: "Coordinate" },
  { id: "saved", label: "Saved" },
] as const satisfies ReadonlyArray<{ id: "all" | ToolCatalogArea; label: string }>;

type FilterId = (typeof filterOptions)[number]["id"];
type DetailSectionId = "check-first" | "needed-input" | "output";

function subscribeNoop() {
  return () => undefined;
}

/**
 * The tile was hardcoded to `--type-source` for every tool, so the whole results
 * list read as one purple family while the launcher grouped the same tools into
 * five. It now takes the area accent, matching both the launcher and the filter
 * chips above the list.
 */
function ToolIcon({ tool, large = false }: { tool: ToolCatalogRecord; large?: boolean }) {
  const identity = toolIdentity(tool.id, tool.area);
  return <CategoryIconTile icon={identity.icon} accent={identity.accent} size={large ? "md" : "sm"} />;
}

function ToolChips({ tool }: { tool: ToolCatalogRecord }) {
  return (
    <span className="flex flex-wrap gap-1">
      {tool.sourceBacked ? (
        <Chip size="compact" appearance={{ kind: "status", tone: "success" }} icon={BadgeCheck}>
          Source-backed
        </Chip>
      ) : null}
      {tool.highYield ? (
        <Chip size="compact" appearance={{ kind: "status", tone: "info" }}>
          High yield
        </Chip>
      ) : null}
      {tool.safetyFirst ? (
        <Chip size="compact" appearance={{ kind: "status", tone: "warning" }} icon={ShieldCheck}>
          Safety-first
        </Chip>
      ) : null}
    </span>
  );
}

function ToolResultCard({
  tool,
  selected,
  onOpenDetails,
  detailsButtonRef,
}: {
  tool: ToolCatalogRecord;
  selected: boolean;
  onOpenDetails: (tool: ToolCatalogRecord, opener?: HTMLElement | null) => void;
  detailsButtonRef: MutableRefObject<HTMLElement | null>;
}) {
  const identity = toolIdentity(tool.id, tool.area);
  return (
    <article
      data-selected={selected || undefined}
      data-category-accent={identity.accent}
      className={cn(
        cardSurface,
        cardPadding.compact,
        "relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2.5 overflow-hidden sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
        selected && cardSelected,
      )}
    >
      {selected ? (
        // The selected rail takes the tool's own category accent rather than
        // the product blue, so it agrees with the tile beside it instead of
        // overriding it.
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[color:var(--cat-accent)]"
        />
      ) : null}
      <ToolIcon tool={tool} />
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-5 text-[color:var(--text-heading)]">{tool.title}</h2>
        <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-[color:var(--text-muted)]">{tool.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <ToolChips tool={tool} />
          <span className="hidden min-w-0 items-center gap-1.5 text-xs text-[color:var(--text-muted)] sm:inline-flex">
            <span className="font-semibold text-[color:var(--text)]">Best for</span>
            <span className="truncate">{tool.bestFor}</span>
          </span>
        </div>
      </div>
      <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:min-w-44 sm:shrink-0">
        <Link
          href={tool.href}
          aria-label={`Open ${tool.title}`}
          target={tool.external ? "_blank" : undefined}
          rel={tool.external ? "noreferrer" : undefined}
          className={cn(primaryControl, "w-full min-w-0 px-3 text-xs")}
        >
          Open
        </Link>
        <Button
          ref={(node) => {
            if (selected && node) detailsButtonRef.current = node;
          }}
          type="button"
          variant="secondary"
          size="sm"
          block
          aria-label={`View details for ${tool.title}`}
          trailingIcon={ChevronRight}
          onClick={(event) => onOpenDetails(tool, event.currentTarget)}
        >
          Details
        </Button>
      </div>
    </article>
  );
}

function DetailAccordion({
  tool,
  prefix,
  openSection,
  onToggle,
}: {
  tool: ToolCatalogRecord;
  prefix: string;
  openSection: DetailSectionId | null;
  onToggle: (section: DetailSectionId) => void;
}) {
  const sections: Array<{ id: DetailSectionId; label: string; icon: LucideIcon; content: ReactNode }> = [
    {
      id: "check-first",
      label: "Check first",
      icon: ShieldCheck,
      content: (
        <ul className="list-disc space-y-1 pl-4">
          {tool.checkFirst.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      id: "needed-input",
      label: "Needed input",
      icon: ClipboardList,
      content: (
        <ul className="list-disc space-y-1 pl-4">
          {tool.neededInput.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ),
    },
    { id: "output", label: "Output", icon: Waves, content: <p>{tool.output}</p> },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)]">
      {sections.map(({ id, label, icon: Icon, content }) => {
        const expanded = openSection === id;
        const panelId = `${prefix}-${id}`;
        return (
          <section key={id} className="border-t border-[color:var(--border)] first:border-t-0">
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onToggle(id)}
                className={cn(
                  "grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 text-left",
                  focusRing,
                )}
              >
                <Icon className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                <span className="text-sm font-extrabold text-[color:var(--text-heading)]">{label}</span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-[color:var(--decoration-soft)] transition-transform motion-reduce:transition-none",
                    expanded && "rotate-90",
                  )}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={panelId}
              hidden={!expanded}
              className="border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--text-muted)]"
            >
              {content}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DetailBody({
  tool,
  prefix,
  openSection,
  onToggle,
}: {
  tool: ToolCatalogRecord;
  prefix: string;
  openSection: DetailSectionId | null;
  onToggle: (section: DetailSectionId) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">Best for</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{tool.detail}</p>
      </section>
      <DetailAccordion tool={tool} prefix={prefix} openSection={openSection} onToggle={onToggle} />
    </div>
  );
}

function DetailActions({ tool }: { tool: ToolCatalogRecord }) {
  return (
    <div className="grid gap-2">
      <Link
        href={tool.href}
        className={cn(
          controlBase,
          "min-h-12 w-full rounded-xl bg-[color:var(--clinical-accent)] px-4 font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)] hover:bg-[color:var(--clinical-accent-hover)]",
        )}
      >
        {tool.actionLabel} {tool.title}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <Link
        href={tool.href}
        className={cn(
          controlBase,
          "min-h-10 w-full bg-transparent text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
        )}
      >
        View example
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function ToolsSearchResultsPage({
  initialQuery = "",
  desktopComposerSlotId,
  canAccessFavourites: canAccessFavouritesProp,
  testId = "tools-search-results-page",
}: {
  initialQuery?: string;
  desktopComposerSlotId?: string;
  /** Optional deterministic override; defaults to the current auth/demo session gate. */
  canAccessFavourites?: boolean;
  testId?: string;
}) {
  const auth = useAuthSession();
  const clientDemoMode = resolveClientDemoMode({
    explicitDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
    authUnavailableFallback: !auth.isConfigured,
    localNoAuthMode: isLocalNoAuthMode(),
  });
  const { favouritesAccessible } = useFavouritesAccess(auth.status === "authenticated", clientDemoMode);
  const canAccessFavourites = canAccessFavouritesProp ?? favouritesAccessible;
  const searchCommand = useSearchCommand();
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  // The route passes its submitted query so hard loads server-render the exact
  // result set. After hydration the shared composer owns the draft, including
  // an intentionally cleared value, until the next submitted navigation.
  const query = hydrated ? (searchCommand?.query ?? initialQuery) : initialQuery;
  const filterPanelId = useId();
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [phoneDetailOpen, setPhoneDetailOpen] = useState(false);
  const [openSection, setOpenSection] = useState<DetailSectionId | null>(null);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const desktopPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const closePhoneOverlaysOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setPhoneDetailOpen(false);
        setFilterOpen(false);
      }
    };

    desktopMedia.addEventListener("change", closePhoneOverlaysOnDesktop);
    return () => desktopMedia.removeEventListener("change", closePhoneOverlaysOnDesktop);
  }, []);

  const accessibleTools = useMemo(
    () =>
      toolCatalogRecordsForSession({
        authenticated: canAccessFavourites,
        demoMode: false,
      }),
    [canAccessFavourites],
  );
  const visibleFilterOptions = useMemo(
    () => (canAccessFavourites ? filterOptions : filterOptions.filter((option) => option.id !== "saved")),
    [canAccessFavourites],
  );
  const effectiveActiveFilter: FilterId = activeFilter === "saved" && !canAccessFavourites ? "all" : activeFilter;

  const queryMatchedTools = useMemo(() => {
    const normalized = normalizeSearchText(query);
    return accessibleTools.filter((tool) => !normalized || toolSearchText(tool).includes(normalized));
  }, [accessibleTools, query]);

  const filterCounts = useMemo<Record<FilterId, number>>(
    () => ({
      all: queryMatchedTools.length,
      assessment: queryMatchedTools.filter((tool) => tool.area === "assessment").length,
      reference: queryMatchedTools.filter((tool) => tool.area === "reference").length,
      care: queryMatchedTools.filter((tool) => tool.area === "care").length,
      coordination: queryMatchedTools.filter((tool) => tool.area === "coordination").length,
      saved: queryMatchedTools.filter((tool) => tool.area === "saved").length,
    }),
    [queryMatchedTools],
  );

  const filteredTools = useMemo(
    () =>
      effectiveActiveFilter === "all"
        ? queryMatchedTools
        : queryMatchedTools.filter((tool) => tool.area === effectiveActiveFilter),
    [effectiveActiveFilter, queryMatchedTools],
  );

  const filterControlOptions = useMemo(
    () =>
      visibleFilterOptions.map((option) => ({
        value: option.id,
        label: option.label,
        hint: String(filterCounts[option.id]),
        disabled: filterCounts[option.id] === 0 && effectiveActiveFilter !== option.id,
      })),
    [effectiveActiveFilter, filterCounts, visibleFilterOptions],
  );

  const selectedTool = filteredTools.find((tool) => tool.id === selectedId) ?? filteredTools[0] ?? null;

  function toggleDetailSection(section: DetailSectionId) {
    setOpenSection((current) => (current === section ? null : section));
  }

  function openTool(tool: ToolCatalogRecord, opener?: HTMLElement | null) {
    setSelectedId(tool.id);
    setOpenSection(null);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      detailReturnFocusRef.current = opener ?? null;
      setPhoneDetailOpen(true);
      return;
    }
    window.requestAnimationFrame(() => desktopPanelRef.current?.focus());
  }

  return (
    <main
      data-testid={testId}
      className="mx-auto w-full max-w-[90rem] overflow-x-hidden px-4 pb-12 pt-4 text-[color:var(--text)] sm:px-6 sm:pt-6 lg:px-8 lg:pt-8"
    >
      {desktopComposerSlotId ? (
        <DesktopComposerPortalSlot
          id={desktopComposerSlotId}
          data-testid="tools-results-home-composer"
          data-composer-reserve={modeHomeComposerReservePendingValue}
          className="mode-home-composer-slot mx-auto mb-4 block w-full max-w-3xl min-h-0 data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-phone)] sm:data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-wide)] [&:not(:empty)]:min-h-[var(--spacing-mode-home-composer-phone)] sm:[&:not(:empty)]:min-h-[var(--spacing-mode-home-composer-wide)] sm:mb-6"
        />
      ) : null}
      <section
        className={cn(
          "mx-auto grid max-w-6xl gap-5 lg:items-start",
          selectedTool ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "lg:grid-cols-1",
        )}
      >
        <div className="min-w-0">
          <SearchResultsHeaderBand
            modeId="tools"
            query={query.trim() || "All tools"}
            matchCount={filteredTools.length}
            headingLevel={1}
            filterLabel="Filter tools by category"
            mobileControls={
              <ResultFilterTrigger
                panelId={filterPanelId}
                testId="tools-search-filter-trigger-phone"
                open={filterOpen}
                activeCount={effectiveActiveFilter === "all" ? 0 : 1}
                onToggle={() => setFilterOpen((current) => !current)}
                title="Filter tools"
              />
            }
            mobileControlsPlacement="inline"
            filterControls={
              <SegmentedControl
                value={effectiveActiveFilter}
                onChange={setActiveFilter}
                options={filterControlOptions}
                label="Tool category"
              />
            }
          />
          <ResultFilterSheet
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            panelId={filterPanelId}
            testId="tools-search-filter-sheet"
            title="Filter tools"
            groups={[
              resultFilterGroup({
                id: "category",
                label: "Category",
                value: effectiveActiveFilter,
                options: filterControlOptions,
                onChange: setActiveFilter,
              }),
            ]}
            onClearAll={effectiveActiveFilter === "all" ? undefined : () => setActiveFilter("all")}
            summary={{ count: filteredTools.length, noun: filteredTools.length === 1 ? "tool" : "tools" }}
          />

          <section aria-label="Tool results" className="mt-3 grid gap-2.5">
            {filteredTools.length ? (
              filteredTools.map((tool) => (
                <ToolResultCard
                  key={tool.id}
                  tool={tool}
                  selected={tool.id === selectedTool?.id}
                  onOpenDetails={openTool}
                  detailsButtonRef={detailReturnFocusRef}
                />
              ))
            ) : (
              <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-lux)] px-4 py-10 text-center">
                <Search className="h-7 w-7 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">No tools match</h2>
                <p className="max-w-md text-sm text-[color:var(--text-muted)]">
                  Try another search or return to the full tools catalogue.
                </p>
                <Link href="/tools" className={floatingControl}>
                  Show all tools
                </Link>
              </div>
            )}
          </section>
          <UniversalSearchAlsoMatches modeId="tools" query={query} className="mt-4" />
        </div>

        {selectedTool ? (
          <aside
            ref={desktopPanelRef}
            tabIndex={-1}
            aria-labelledby="desktop-tool-detail-title"
            className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] shadow-[var(--e4)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--focus)] lg:block"
          >
            <div className="border-b border-[color:var(--border)] p-5">
              <div className="flex items-start gap-3">
                <ToolIcon tool={selectedTool} large />
                <div className="min-w-0">
                  <p className="mb-1 text-3xs font-extrabold uppercase tracking-wider text-[color:var(--clinical-accent)]">
                    Selected tool
                  </p>
                  <h2
                    id="desktop-tool-detail-title"
                    className="text-xl font-extrabold text-[color:var(--text-heading)]"
                  >
                    {selectedTool.title}
                  </h2>
                  <div className="mt-2">
                    <ToolChips tool={selectedTool} />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-4">
              <DetailBody
                tool={selectedTool}
                prefix="desktop-tool-detail"
                openSection={openSection}
                onToggle={toggleDetailSection}
              />
              <DetailActions tool={selectedTool} />
            </div>
          </aside>
        ) : null}
      </section>

      {selectedTool ? (
        <div className="lg:hidden">
          <Sheet
            open={phoneDetailOpen}
            onClose={() => setPhoneDetailOpen(false)}
            title={selectedTool.title}
            closeLabel={`Close ${selectedTool.title}`}
            headerLeading={<ToolIcon tool={selectedTool} />}
            descriptionContent={<ToolChips tool={selectedTool} />}
            titleClassName="text-xl font-extrabold"
            contentClassName="sm:max-w-[39rem]"
            bodyClassName="grid gap-4"
            portal={false}
            returnFocusRef={detailReturnFocusRef}
            testId="tools-search-detail-sheet"
            footer={<DetailActions tool={selectedTool} />}
          >
            <DetailBody
              tool={selectedTool}
              prefix="phone-tool-detail"
              openSection={openSection}
              onToggle={toggleDetailSection}
            />
          </Sheet>
        </div>
      ) : null}
    </main>
  );
}
