"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  FileImage,
  FileText,
  Funnel,
  Link2,
  ListChecks,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Pill,
  Route,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { DocumentTagCloud } from "@/components/DocumentTagCloud";
import { documentDisplayTitle } from "@/components/DocumentOrganizationBadges";
import { isDeployedClinicalKb } from "@/lib/deployed-app";
import { ModeHomeTemplate } from "@/components/mode-home-template";
import { Sheet } from "@/components/ui/sheet";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import { deriveDocumentSearchUnavailable } from "@/components/clinical-dashboard/document-search-unavailable-status";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { useResultSort } from "@/components/use-result-sort";
import {
  DocumentActionButton,
  DocumentActionLink,
  DocumentBadge,
  documentActionClass,
} from "@/components/clinical-dashboard/document-ui";
import { useSignedImageUrl } from "@/components/clinical-dashboard/use-signed-image-url";
import {
  cn,
  floatingControl,
  LoadingPanel,
  metadataPillDensity,
  Skeleton,
  sourceCard,
  textMuted,
} from "@/components/ui-primitives";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  buildSmartDocumentTagFacetIndex,
  filterDocumentsBySmartTagFacetIndex,
  projectSmartTagFacetGroups,
  smartDocumentFacetGroups,
  type SmartDocumentTag,
  type SmartDocumentTagFacet,
  type SmartDocumentTagGroup,
} from "@/lib/document-tags";
import type { ServiceSearchMatch } from "@/lib/services";
import type { FormSearchMatch } from "@/lib/forms";
import type { SearchScopeFilters } from "@/lib/search-scope";
import { removeScopeFilterValue, scopeFilterChips } from "@/lib/search-scope-filter-chips";
import type { ClinicalDocument, DocumentMatch, SearchScopeSummary } from "@/lib/types";
import type { RegistryRequestStatus } from "@/lib/use-registry-records";
import { sortResultItems } from "@/lib/result-sort";
import { documentRelevancePercent } from "./relevance-score";

type SearchFacet = { value: string; count: number };
type ResultTypeFilter = "all" | "tables" | "images" | "pdfs";

/** Initial DOM budget for document result cards; further rows reveal on demand. */
const DOCUMENT_RESULTS_INITIAL_WINDOW = 25;
const DOCUMENT_RESULTS_PAGE_SIZE = 25;
export type SearchFacets = {
  status?: SearchFacet[];
  validation?: SearchFacet[];
  extractionQuality?: SearchFacet[];
  sections?: SearchFacet[];
  labels?: SearchFacet[];
  sites?: SearchFacet[];
  documentTypes?: SearchFacet[];
  services?: SearchFacet[];
  settings?: SearchFacet[];
  populations?: SearchFacet[];
  risks?: SearchFacet[];
  clinicalActions?: SearchFacet[];
  carePhases?: SearchFacet[];
  documentIntents?: SearchFacet[];
  contentFeatures?: SearchFacet[];
  evidence?: SearchFacet[];
};

type SearchRecordMode = "services" | "forms";
type SearchRecordMatch = ServiceSearchMatch | FormSearchMatch;

const EMPTY_APPLIED_FILTERS: AppliedFilterChip[] = [];

const searchRecordConfig: Record<
  SearchRecordMode,
  {
    routePrefix: string;
    ariaLabel: string;
    heading: string;
    chip: string;
    recordLabel: string;
    testIdPrefix: string;
  }
> = {
  services: {
    routePrefix: "/services",
    ariaLabel: "Service record matches",
    heading: "Verified service records",
    chip: "Services mode",
    recordLabel: "service record",
    testIdPrefix: "service-search",
  },
  forms: {
    routePrefix: "/forms",
    ariaLabel: "Form record matches",
    heading: "Verified forms",
    chip: "Forms mode",
    recordLabel: "form record",
    testIdPrefix: "form-search",
  },
};

const documentFacetIcons: Record<SmartDocumentTagGroup, LucideIcon> = {
  Site: FileText,
  Medication: Pill,
  Risk: ShieldAlert,
  Workflow: ListChecks,
  Topic: Tag,
  Population: Users,
  Setting: FileText,
  Service: Route,
  "Document type": FileText,
  "Clinical action": ListChecks,
  "Care phase": Clock3,
  "Document intent": Sparkles,
  "Content feature": FileText,
  Manual: Sparkles,
};

const resultTypeIcons: Record<ResultTypeFilter, LucideIcon> = {
  all: BookOpen,
  tables: ListChecks,
  images: FileImage,
  pdfs: FileText,
};

/**
 * The single filtering surface for document results.
 *
 * It replaces two separate ones. Source type (All/Tables/Images/PDFs) used to be
 * a chip row inside the ribbon on desktop and a native `<select>` on phones,
 * while the smart-tag facets were a rail below it — and that rail was mounted
 * only when a facet was already selected, which nothing could do, so the facets
 * were unreachable in production. Both now live here, behind one trigger, so
 * "what is narrowing this list" has one answer and one place to undo it.
 *
 * Source type is single-select and the tag facets are multi-select (OR within a
 * group, AND across groups, per `filterDocumentsBySmartTagFacetIndex`), so the
 * two carry different affordances deliberately: `aria-pressed` toggles for the
 * facets, `role="radiogroup"` for the mutually exclusive source type.
 */
function DocumentFilterPanel({
  open,
  panelId,
  query,
  groups,
  activeKeys,
  resultTabs,
  activeResultType,
  onResultTypeChange,
  onToggle,
  onClear,
  resultCount,
  documentCount,
  onOpenLibrary,
  onDone,
}: {
  open: boolean;
  panelId: string;
  /** Result-set identity for transient sheet chrome. A new submit must not keep
      a prior "Find a filter…" needle or expand set over a different match list. */
  query: string;
  groups: Array<{ group: SmartDocumentTagGroup; facets: SmartDocumentTagFacet[] }>;
  activeKeys: string[];
  resultTabs: Array<{ key: ResultTypeFilter; label: string; count: number }>;
  activeResultType: ResultTypeFilter;
  onResultTypeChange: (value: ResultTypeFilter) => void;
  onToggle: (facet: SmartDocumentTagFacet) => void;
  onClear: () => void;
  resultCount: number;
  /** The whole indexed corpus, for the readout and for Browse. */
  documentCount: number;
  /** Reach rather than refinement — see the footer. */
  onOpenLibrary: () => void;
  onDone: () => void;
}) {
  const active = new Set(activeKeys);
  const showSourceType = resultTabs.length > 1;
  const searchId = useId();
  // Query-scope the find field and expand set the same way open state is scoped
  // above: the panel stays mounted while closed (`Sheet` returns null), so a
  // plain useState would otherwise leave "clozapine" typed into the find field
  // after the reader has already submitted a different search.
  const [chrome, setChrome] = useState<{
    query: string;
    needle: string;
    expanded: ReadonlySet<SmartDocumentTagGroup>;
    collapsed: ReadonlySet<SmartDocumentTagGroup>;
  }>(() => ({ query, needle: "", expanded: new Set(), collapsed: new Set() }));
  if (chrome.query !== query) {
    setChrome({ query, needle: "", expanded: new Set(), collapsed: new Set() });
  }
  // Prefer the scoped values even on the transitional render before the
  // setState above commits — otherwise a typed needle from the previous
  // query can flash into the find field for one frame.
  const needle = chrome.query === query ? chrome.needle : "";
  const expanded = chrome.query === query ? chrome.expanded : new Set<SmartDocumentTagGroup>();
  const collapsed = chrome.query === query ? chrome.collapsed : new Set<SmartDocumentTagGroup>();
  const setNeedle = (value: string) => setChrome((current) => ({ ...current, query, needle: value }));
  const setExpanded = (update: (current: ReadonlySet<SmartDocumentTagGroup>) => ReadonlySet<SmartDocumentTagGroup>) =>
    setChrome((current) => ({
      ...current,
      query,
      expanded: update(current.query === query ? current.expanded : new Set()),
    }));
  const setCollapsed = (update: (current: ReadonlySet<SmartDocumentTagGroup>) => ReadonlySet<SmartDocumentTagGroup>) =>
    setChrome((current) => ({
      ...current,
      query,
      collapsed: update(current.query === query ? current.collapsed : new Set()),
    }));
  const trimmedNeedle = needle.trim().toLowerCase();
  // Both the find-a-filter field and collapse-by-default are answers to *eleven*
  // groups in one phone column, and neither is worth its cost below that. A
  // sheet showing two groups that are both shut is a scroll saved that did not
  // exist and two taps added that did. Same threshold for both, so the sheet
  // never search-but-does-not-collapse or the reverse.
  const dense = groups.length > 3;
  const showNeedle = dense;
  // Only filter when the field is actually shown. Today `groups` maps
  // one-to-one from the facet index so density cannot change mid-query, but if
  // zero-count groups ever drop out the needle would keep filtering an
  // invisible, unclearable field — gate on `dense` so that cannot happen.
  const activeNeedle = showNeedle ? trimmedNeedle : "";

  const ordered = useMemo(() => {
    const selected = new Set(activeKeys);
    return smartDocumentFacetGroups
      .map((group) => groups.find((item) => item.group === group))
      .filter((item): item is { group: SmartDocumentTagGroup; facets: SmartDocumentTagFacet[] } => Boolean(item))
      .map(({ group, facets }) => ({
        group,
        facets: activeNeedle
          ? facets.filter(
              (facet) =>
                // A selected facet must stay reachable while searching: hiding it
                // because its label does not match the needle leaves an active
                // constraint the reader cannot untoggle without clearing the
                // field first (or abandoning the sheet for the shelf).
                selected.has(facet.key) ||
                facet.label.toLowerCase().includes(activeNeedle) ||
                facet.searchText.toLowerCase().includes(activeNeedle) ||
                group.toLowerCase().includes(activeNeedle),
            )
          : facets,
      }))
      .filter(({ facets }) => facets.length > 0);
  }, [groups, activeNeedle, activeKeys]);

  const matchedFacets = activeNeedle ? ordered.reduce((total, item) => total + item.facets.length, 0) : 0;

  if (groups.length === 0 && !showSourceType) return null;

  return (
    <Sheet
      open={open}
      onClose={onDone}
      title="Filter documents"
      portal
      id={panelId}
      testId="document-filter-panel"
      headerActions={
        activeKeys.length > 0 || activeResultType !== "all" ? (
          <button
            type="button"
            onClick={onClear}
            data-testid="document-filter-clear"
            className={cn(floatingControl, "min-h-tap px-2 text-2xs sm:min-h-8")}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null
      }
      footer={
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* The count is the point of the panel: it tells the reader whether the
                combination they have built still returns anything before they
                dismiss it. `aria-live` is deliberate — the number changes under
                them as they toggle, and the sheet covers the results it
                describes. The bare repeat of the number beside the button is gone;
                the button carries it, and the readout at the top carries the
                proportion. */}
            <span aria-live="polite" className="sr-only">
              {resultCount} document{resultCount === 1 ? "" : "s"} match the current filters
            </span>
            <button
              type="button"
              onClick={onDone}
              data-testid="document-filter-done"
              className={cn(
                "inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:min-h-12",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
              )}
            >
              Show {resultCount} document{resultCount === 1 ? "" : "s"}
            </button>
          </div>
          {/* Below a rule, and phrased as reach rather than refinement. Library
              spent the utility rail competing with Filter for the same edge while
              answering a different question — Filter narrows what this query
              returned, Library opens the whole corpus. Here it is the actual next
              step, and it keeps the in-context route that stopped it being
              deleted: the documents action menu clears the query. */}
          <button
            type="button"
            // Dismiss the sheet on the way out. Browsing the corpus is leaving
            // this surface, not another thing to do on it, and the Sources
            // drawer would otherwise open underneath a filter sheet that is
            // still covering the results both of them describe.
            onClick={() => {
              onDone();
              onOpenLibrary();
            }}
            data-testid="document-filter-browse-library"
            // `border-0 border-t`, not `border-t` alone. `cn` now runs through
            // tailwind-merge (ledger #218), which lifts half of this: the
            // competing arbitrary border COLOURS resolve last-wins instead of by
            // Tailwind's emission order. The width half is not lifted —
            // tailwind-merge scores bare `border` and `border-t` as different
            // groups, so `floatingControl`'s all-sides `border` still survives an
            // added `border-t` and the button would still be fully bordered.
            // Zeroing the box first is still what leaves only the separating rule.
            className={cn(
              floatingControl,
              "min-h-tap justify-start gap-2 rounded-lg border-0 border-t border-[color:var(--border)] bg-transparent px-1 text-xs sm:min-h-10",
            )}
          >
            <BookOpen aria-hidden="true" className="size-icon-md shrink-0" />
            <span>Browse all sources</span>
            {documentCount > 0 ? (
              <span className="nums ml-auto text-2xs text-[color:var(--text-muted)]">
                {documentCount.toLocaleString()}
              </span>
            ) : null}
          </button>
        </div>
      }
    >
      {/* The proportion, once, at the top. A meter rather than a second number:
          "12 of 2,014" is a ratio the reader is judging, not a figure they are
          reading off. It goes to `--warning` at zero so the state that needs
          explaining is the one that looks different. */}
      <div className="min-w-0">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--surface-inset)]"
          role="presentation"
          aria-hidden="true"
        >
          <span
            className={cn(
              "block h-full rounded-full",
              resultCount === 0 ? "bg-[color:var(--warning)]" : "bg-[color:var(--clinical-accent)]",
            )}
            style={{
              width:
                documentCount > 0
                  ? `${Math.max(resultCount === 0 ? 0 : 1.5, Math.min(100, (resultCount / documentCount) * 100))}%`
                  : "0%",
            }}
          />
        </div>
        <p className={cn("nums mt-1.5 text-xs font-semibold", resultCount === 0 ? "text-[color:var(--warning)]" : "")}>
          <span className={resultCount === 0 ? "" : "text-[color:var(--text-heading)]"}>{resultCount}</span>{" "}
          <span className={resultCount === 0 ? "" : textMuted}>
            of {documentCount > 0 ? documentCount.toLocaleString() : "—"} documents shown
          </span>
        </p>
      </div>

      {showNeedle ? (
        <div className="mt-3 min-w-0">
          <label htmlFor={searchId} className="sr-only">
            Find a filter
          </label>
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]">
            <Search aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--decoration-soft)]" />
            <input
              id={searchId}
              type="search"
              value={needle}
              onChange={(event) => setNeedle(event.target.value)}
              placeholder="Find a filter…"
              data-testid="document-filter-find"
              // `min-h-tap`, matching the facets and the disclosure headings.
              // This shipped at `min-h-10` — 40px, below the floor — in the same
              // commit that raised everything around it, so the one control added
              // to make a long filter list usable was the smallest target in the
              // sheet. The `sm:min-h-9` relaxation matches the facets exactly.
              className="min-h-tap min-w-0 flex-1 bg-transparent text-xs font-semibold text-[color:var(--text)] outline-none placeholder:font-medium placeholder:text-[color:var(--text-placeholder)] sm:min-h-9"
            />
            {needle ? (
              <button
                type="button"
                onClick={() => setNeedle("")}
                aria-label="Clear the filter search"
                className="grid min-h-tap min-w-tap place-items-center text-[color:var(--decoration-soft)] hover:text-[color:var(--text)] sm:min-h-8 sm:min-w-8"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <p aria-live="polite" className="sr-only">
            {activeNeedle ? `${matchedFacets} filter${matchedFacets === 1 ? "" : "s"} match “${needle.trim()}”` : ""}
          </p>
        </div>
      ) : null}

      {showSourceType ? (
        <section className="mt-4 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
              <BookOpen aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
              Source type
            </h3>
            {/* Stated, because the shape alone still has to be learned once.
                Source type replaces; the facets below accumulate. */}
            <span className="text-2xs font-semibold text-[color:var(--clinical-accent)]">one only</span>
          </div>
          {/* Radio semantics, not toggles: picking one source type replaces the
              last, so `aria-pressed` on four buttons would describe a state the
              filter cannot be in. Now it also LOOKS exclusive — a joined
              segmented control reads as one-of on sight, where four separate
              chips of the same size and radius as the additive facets below made
              the OR-within-group, AND-across-groups model something you had to
              discover by experiment. */}
          <div
            role="radiogroup"
            aria-label="Source type"
            className="mt-2 inline-flex max-w-full flex-wrap overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]"
          >
            {resultTabs.map((tab, index) => {
              const selected = tab.key === activeResultType;
              const Icon = resultTypeIcons[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onResultTypeChange(tab.key)}
                  className={cn(
                    "inline-flex min-h-tap max-w-full items-center gap-1.5 px-3 text-2xs font-semibold transition motion-reduce:transition-none sm:min-h-9 lg:min-h-8",
                    index > 0 && "border-l border-[color:var(--border)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    selected
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                  )}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  <span className="nums text-[color:var(--text-muted)]">{tab.count}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-2 grid gap-0 lg:grid-cols-2 lg:gap-x-5 xl:grid-cols-3">
        {ordered.map(({ group, facets }) => {
          const Icon = documentFacetIcons[group];
          const selectedCount = facets.filter((facet) => active.has(facet.key)).length;
          // A search expands what it matched. Otherwise selected groups open by
          // default, but an explicit collapse wins; without that third state the
          // disclosure button updates expanded while selectedCount > 0
          // immediately forces the panel open again.
          const isOpen =
            !dense || Boolean(activeNeedle) || (!collapsed.has(group) && (expanded.has(group) || selectedCount > 0));
          const groupPanelId = `${panelId}-${group.replace(/[^A-Za-z0-9_-]/g, "-")}`;
          return (
            <section key={group} className="min-w-0 border-t border-[color:var(--border)] py-1">
              <h3>
                {/* A heading is only a disclosure control where there is
                    something to disclose. Below the density threshold every
                    group is open and permanently so, and a button advertising a
                    collapse that never happens is a control that does nothing.

                    A live needle is the same situation and was missed: the
                    search forces `isOpen` true, so tapping the heading left
                    `aria-expanded="true"`, rotated nothing, and hid nothing —
                    while still writing the group into `collapsed`, so the
                    collapse ambushed the reader later, once the field was
                    cleared and the tap forgotten. While searching, the needle
                    owns what is open, so there is nothing here to disclose. */}
                {dense && !activeNeedle ? (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={groupPanelId}
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (isOpen) next.delete(group);
                        else next.add(group);
                        return next;
                      });
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (isOpen) next.add(group);
                        else next.delete(group);
                        return next;
                      });
                    }}
                    className={cn(
                      "flex min-h-tap w-full items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)] sm:min-h-10",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" />
                    <span className="truncate">{group}</span>
                    {/* The count is what makes a collapsed group honest: a closed
                        section that is silently narrowing the list is worse than
                        the scroll it saves. */}
                    {selectedCount > 0 ? (
                      <span className="nums ml-auto text-2xs font-semibold text-[color:var(--clinical-accent)]">
                        {selectedCount} selected
                      </span>
                    ) : null}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-icon-sm shrink-0 text-[color:var(--decoration-soft)] transition-transform motion-reduce:transition-none",
                        selectedCount > 0 ? "ml-1.5" : "ml-auto",
                        isOpen ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <span className="flex min-h-9 w-full items-center gap-1.5 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" />
                    <span className="truncate">{group}</span>
                    {selectedCount > 0 ? (
                      <span className="nums ml-auto text-2xs font-semibold text-[color:var(--clinical-accent)]">
                        {selectedCount} selected
                      </span>
                    ) : null}
                  </span>
                )}
              </h3>
              <div id={groupPanelId} hidden={!isOpen}>
                <div className="flex flex-wrap gap-2 pb-2.5 sm:gap-1.5">
                  {facets.map((facet) => {
                    const selected = active.has(facet.key);
                    // Zero-count unselected facets stay visible so the list does not
                    // jump, but they are disabled: selecting them would empty the set.
                    const deadEnd = !selected && facet.count === 0;
                    // Facet keys can contain spaces (e.g. "Medication:Mood stabilizer");
                    // HTML ids must not, or aria-describedby cannot resolve them.
                    const deadEndDescId = `facet-dead-end-${facet.key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
                    return (
                      <button
                        key={facet.key}
                        type="button"
                        // `aria-disabled` rather than `disabled`: a real disabled
                        // button leaves the tab order, so a keyboard or screen-reader
                        // user loses the row entirely and never learns why it went
                        // quiet — and a `title` on a disabled control is not reliably
                        // announced. Kept focusable and explained, with the click
                        // guarded instead. Matches the disabled-affordance pattern in
                        // docs/wiring-conventions.md.
                        onClick={() => {
                          if (deadEnd) return;
                          onToggle(facet);
                        }}
                        aria-pressed={selected}
                        aria-disabled={deadEnd || undefined}
                        aria-describedby={deadEnd ? deadEndDescId : undefined}
                        title={
                          deadEnd
                            ? `${facet.label} — no documents with the current filters`
                            : `Filter to ${facet.label}`
                        }
                        className={cn(
                          // 28px was the sheet's whole interactive surface on the
                          // device it exists for, packed at `gap-1.5` so a
                          // neighbouring mis-tap was likely. The floor is the tap
                          // token here too, relaxing to compact density from `sm`
                          // where a pointer is likely.
                          "inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-md border px-2.5 text-2xs font-semibold shadow-[var(--shadow-inset)] transition motion-reduce:transition-none sm:min-h-9 sm:gap-1 sm:px-2 lg:min-h-8",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                          // Three mutually exclusive branches, not a base plus an
                          // override: `cn` was a plain join, so two competing
                          // `border-[color:…]` utilities both reached the DOM and
                          // the winner was decided by stylesheet order rather than
                          // by intent. That constraint is lifted (ledger #218) —
                          // `cn` merges, and a later border colour now wins
                          // deterministically. The branches are kept as they are
                          // because collapsing them changes which utilities render;
                          // that is a visual change, not a dependency swap.
                          selected
                            ? "border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                            : deadEnd
                              ? // Not `opacity-50`. Transparency multiplies against
                                // an already-muted foreground and lands at 2.34:1 —
                                // the disabled state was least readable exactly when
                                // it most needed explaining. A real muted pair plus a
                                // dashed border measures 4.72:1 and reads as a
                                // different KIND of thing rather than a faded one,
                                // which also survives forced colors: border-style is
                                // preserved there and opacity is not.
                                "cursor-default border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]"
                              : "border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                        )}
                      >
                        {selected ? <Check aria-hidden="true" className="h-3 w-3 shrink-0" /> : null}
                        <span className="truncate">{facet.label}</span>
                        {deadEnd ? (
                          <span id={deadEndDescId} className="sr-only">
                            No documents match this with the current filters.
                          </span>
                        ) : null}
                        <span className="nums text-[color:var(--text-muted)]">{facet.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
        {activeNeedle && ordered.length === 0 ? (
          <p className="border-t border-[color:var(--border)] py-4 text-center text-xs font-semibold text-[color:var(--text-muted)]">
            No filter matches “{needle.trim()}”.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

/**
 * Opens the filter panel and reports how many filters are active.
 *
 * Rendered into both of the ribbon's page-control slots — `filterControls` (the
 * full-width row, `sm` and up) and `mobileControls` (the utility row, below
 * `sm`) — because the ribbon hides one or the other by breakpoint and only ever
 * shows one at a time.
 */
function DocumentFilterTrigger({
  panelId,
  testId,
  open,
  activeCount,
  onToggle,
}: {
  panelId: string;
  /** Distinct per slot: both copies are in the DOM, so a shared id would make
      every `getByTestId` lookup ambiguous under Playwright strict mode even
      though only one is ever displayed. */
  testId: string;
  open: boolean;
  activeCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open ? panelId : undefined}
      data-testid={testId}
      title="Filter documents"
      className={cn(
        // Written out rather than composed from `floatingControl`. `cn` is a plain
        // join, not tailwind-merge, so every contradictory utility reached the DOM
        // and stylesheet order — not intent — picked the winner. `text-sm`/`text-xs`
        // and the two `shadow-*` happened to resolve the way the override wanted;
        // `font-semibold` (600) and `--border-lux` never did. So the one control
        // sitting flush against the sort group rendered a heavier label and a
        // darker border than the group it is paired with, which is what made it
        // read as a different component. This is the band's own control idiom —
        // the same recipe `Save search` and `Retry` use — so the pairing is
        // structural instead of a race between two class lists.
        //
        // 10px leading, 11px trailing. Symmetric padding measures right and looks
        // wrong here: a filled pill reads flush to its own edge while a stroked
        // funnel reads inset from its box, so equal values put the badge visibly
        // closer to the border than the glyph is.
        "search-band-ghost inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-1.5 rounded-lg border pl-2.5 pr-[0.6875rem] transition-colors motion-reduce:transition-none sm:min-h-10 sm:min-w-10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        // Mutually exclusive branches, not a base plus an override, for the same
        // reason the facet states became branches in #1615: competing
        // `border-[color:…]`/`bg-[color:…]` utilities would both reach the DOM and
        // stylesheet order would decide which of them the reader actually sees.
        activeCount > 0
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
      )}
    >
      <Funnel aria-hidden="true" className="size-icon-md shrink-0" />
      {/* The label is the first thing to go when the line is tight — but only
          where the line is actually tight. This was a flat `max-[429px]:sr-only`,
          which assumed every width below 430px shares one line with the count and
          the query. Below 414px the band now gives the utilities their own row
          (see `search-results-header-band.tsx`), and on that row there is room for
          the wordmark several times over, so hiding it there spent nothing and
          bought nothing. 414–429px is the one band that is genuinely single-line
          and short of width; there a funnel carrying a badge is unambiguous. The
          accessible name is unchanged at every width either way. */}
      <span className="min-[414px]:max-[429px]:sr-only">Filter</span>
      {activeCount > 0 ? (
        // A tinted pill, not a solid disc: a saturated filled circle is the single
        // loudest signal on a bar that is otherwise hairlines and type, and it
        // reads as an alert rather than as a count.
        <span className="search-band-badge nums grid h-[1.0625rem] min-w-[1.0625rem] place-items-center rounded-full bg-[color:var(--search-band-badge-bg)] px-1 text-2xs font-bold text-[color:var(--clinical-accent)]">
          {activeCount}
        </span>
      ) : null}
      <span className="sr-only">
        {activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "No filters active"}
      </span>
    </button>
  );
}

function documentPageLabel(document: DocumentMatch) {
  const pages = document.bestPages.filter((page) => Number.isFinite(page));
  if (pages.length === 0) return "Page unavailable";
  if (pages.length === 1) return `Page ${pages[0]}`;

  const consecutive = pages.every((page, index) => index === 0 || page === pages[index - 1]! + 1);
  if (consecutive) return `Pages ${pages[0]}–${pages.at(-1)}`;
  return `Page ${pages[0]} +${pages.length - 1}`;
}

function resultTypeTabs(matches: DocumentMatch[]) {
  const tabs = [
    { key: "all" as const, label: "All", count: matches.length },
    { key: "tables" as const, label: "Tables", count: matches.filter((match) => match.tableCount > 0).length },
    { key: "images" as const, label: "Images", count: matches.filter((match) => match.imageCount > 0).length },
    {
      key: "pdfs" as const,
      label: "PDFs",
      count: matches.filter((match) => match.file_name.toLowerCase().endsWith(".pdf")).length,
    },
  ];

  return tabs.filter((tab) => tab.key === "all" || tab.count > 0);
}

function filterMatchesByResultType(matches: DocumentMatch[], filter: ResultTypeFilter) {
  if (filter === "tables") return matches.filter((match) => match.tableCount > 0);
  if (filter === "images") return matches.filter((match) => match.imageCount > 0);
  if (filter === "pdfs") return matches.filter((match) => match.file_name.toLowerCase().endsWith(".pdf"));
  return matches;
}

function relevanceTone(document: DocumentMatch) {
  const verdict = document.relevance?.verdict as string | undefined;
  const percent = documentRelevancePercent(document);
  if (verdict === "direct") {
    return { label: "High relevance", short: "High relevance", detail: `${percent}% match` };
  }
  if (verdict === "partial" || percent >= 75) {
    return { label: "Relevant", short: "Relevant", detail: `${percent}% related` };
  }
  return { label: "Related", short: "Related", detail: `${percent}% nearby` };
}

function documentOpenHref(document: DocumentMatch) {
  const params = new URLSearchParams();
  params.set("page", String(document.bestPages[0] ?? 1));
  const chunkId = document.bestChunkIds[0];
  if (chunkId) params.set("chunk", chunkId);
  return `/documents/${document.document_id}?${params.toString()}`;
}

const resultMenuItemClass =
  "flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-bold text-[color:var(--text)] transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]";

function DocumentPagePreview({ document, href }: { document: DocumentMatch; href: string }) {
  const pageNumber = document.bestPages[0] ?? 1;
  const lineWidths = [74, 88, 63, 79, 56];
  const coverEndpoint = document.coverImageId ? `/api/images/${document.coverImageId}/signed-url` : "";
  const { url: coverUrl, failed: coverFailed, markFailed } = useSignedImageUrl(coverEndpoint, Boolean(coverEndpoint));
  const [loadedCoverUrl, setLoadedCoverUrl] = useState<string | null>(null);
  const hasCoverUrl = Boolean(coverEndpoint && coverUrl && !coverFailed);
  const coverLoaded = Boolean(coverUrl && loadedCoverUrl === coverUrl);
  const showSkeleton = Boolean(coverEndpoint && !coverFailed && !coverLoaded);
  const showFallback = Boolean(!coverLoaded && (!coverEndpoint || coverFailed));

  return (
    <Link
      href={href}
      aria-label={`Preview page ${pageNumber} of ${document.title}`}
      data-testid="document-page-preview"
      className="group relative flex h-28 w-20 shrink-0 flex-col overflow-hidden rounded-lg border border-t-[3px] border-[color:var(--border-lux)] border-t-[color:var(--clinical-accent)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transform-none motion-reduce:transition-none sm:h-32 sm:w-24"
    >
      {hasCoverUrl ? (
        // Private signed covers stay unoptimized so bearer URLs never enter `/_next/image`.
        // eslint-disable-next-line @next/next/no-img-element -- signed private URL; avoid optimizer cache
        <img
          src={coverUrl!}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoadedCoverUrl(coverUrl)}
          onError={markFailed}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[var(--duration-deliberate)] motion-reduce:transition-none",
            coverLoaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {showSkeleton ? <Skeleton className="absolute inset-0 h-full w-full rounded-none" /> : null}
      {showFallback ? (
        <span className="relative flex h-full flex-col p-2 sm:p-2.5" aria-hidden="true">
          <span className="flex items-center justify-between text-[color:var(--clinical-accent)]">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="h-1.5 w-5 rounded-full bg-[color:var(--clinical-accent-soft)]" />
          </span>
          <span className="mt-3 space-y-1.5">
            {lineWidths.map((width, index) => (
              <span
                key={`${document.document_id}-preview-line-${index}`}
                className={cn(
                  "block h-1 rounded-full bg-[color:var(--border-strong)]",
                  index < 2 && "bg-[color:var(--clinical-accent)]",
                )}
                style={{ width: `${width}%` }}
              />
            ))}
          </span>
          <span className="mt-auto grid grid-cols-3 gap-1 opacity-80 transition group-hover:opacity-100">
            <span className="h-3 rounded-sm bg-[color:var(--clinical-accent-soft)]" />
            <span className="h-3 rounded-sm bg-[color:var(--surface-subtle)]" />
            <span className="h-3 rounded-sm bg-[color:var(--clinical-accent-soft)]" />
          </span>
        </span>
      ) : null}
      <span className="absolute bottom-1.5 right-1.5 rounded bg-[color:var(--surface-raised)]/95 px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]">
        {pageNumber}
      </span>
    </Link>
  );
}

type ResultCopyStatus = "idle" | "citation-copied" | "citation-failed" | "link-copied" | "link-failed";

function DocumentResultMoreMenu({
  document,
  openHref,
  onScopeDocument,
}: {
  document: DocumentMatch;
  openHref: string;
  onScopeDocument: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<ResultCopyStatus>("idle");
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const menuId = useId();

  const updateMenuPosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 8;
    const menuWidth = Math.min(272, window.innerWidth - viewportPadding * 2);
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? (document.imageCount > 0 ? 204 : 156);
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuWidth),
      window.innerWidth - viewportPadding - menuWidth,
    );
    const top =
      triggerRect.top - gap - menuHeight >= viewportPadding
        ? triggerRect.top - gap - menuHeight
        : Math.min(triggerRect.bottom + gap, window.innerHeight - viewportPadding - menuHeight);
    setMenuPosition({ left, top: Math.max(viewportPadding, top) });
  }, [document.imageCount]);

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node) || buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    }

    window.document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    updateMenuPosition();
    return () => {
      window.document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  function focusMenuItem(position: "first" | "last" = "first") {
    window.requestAnimationFrame(() => {
      updateMenuPosition();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const target = position === "first" ? items[0] : items.at(-1);
      target?.focus({ preventScroll: true });
    });
  }

  function openMenu(position: "first" | "last" = "first") {
    updateMenuPosition();
    setOpen(true);
    setCopyStatus("idle");
    focusMenuItem(position);
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const currentIndex = items.findIndex((item) => item === window.document.activeElement);

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp")
      nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex !== null && items[nextIndex]) {
      event.preventDefault();
      items[nextIndex].focus({ preventScroll: true });
    }
  }

  async function copyValue(value: string, action: "citation" | "link") {
    const restoreFocusTarget =
      window.document.activeElement instanceof HTMLElement && menuRef.current?.contains(window.document.activeElement)
        ? window.document.activeElement
        : null;
    try {
      await copyTextToClipboard(value);
      setCopyStatus(action === "citation" ? "citation-copied" : "link-copied");
    } catch {
      setCopyStatus(action === "citation" ? "citation-failed" : "link-failed");
    } finally {
      window.requestAnimationFrame(() => {
        if (restoreFocusTarget?.isConnected && menuRef.current?.contains(restoreFocusTarget)) {
          restoreFocusTarget.focus({ preventScroll: true });
        }
      });
    }
  }

  const citation = `${documentDisplayTitle(document)}. ${documentPageLabel(document)}.`;

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={`More actions for ${document.title}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openMenu(event.key === "ArrowUp" ? "last" : "first");
        }}
        className={cn(
          documentActionClass,
          "min-h-12 w-full min-w-0 rounded-br-xl px-2 !text-sm font-bold text-[color:var(--text-heading)]",
        )}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        More
      </button>
      {open && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              data-testid="document-result-more-menu"
              role="menu"
              aria-labelledby={triggerId}
              onKeyDown={handleMenuKeyDown}
              style={menuPosition}
              className="fixed z-80 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] py-1.5 shadow-[var(--shadow-lift)]"
            >
              <button
                type="button"
                role="menuitem"
                className={resultMenuItemClass}
                onClick={() => {
                  onScopeDocument();
                  setOpen(false);
                }}
              >
                <Target className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                Search only this source
              </button>
              <button
                type="button"
                role="menuitem"
                className={resultMenuItemClass}
                onClick={() => void copyValue(citation, "citation")}
              >
                <Copy className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                {copyStatus === "citation-copied"
                  ? "Citation copied"
                  : copyStatus === "citation-failed"
                    ? "Copy failed"
                    : "Copy citation"}
              </button>
              <button
                type="button"
                role="menuitem"
                className={resultMenuItemClass}
                onClick={() => void copyValue(new URL(openHref, window.location.origin).toString(), "link")}
              >
                <Link2 className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                {copyStatus === "link-copied"
                  ? "Link copied"
                  : copyStatus === "link-failed"
                    ? "Copy failed"
                    : "Copy link"}
              </button>
              {document.imageCount > 0 ? (
                <Link
                  href={`${openHref}#source-images`}
                  role="menuitem"
                  className={resultMenuItemClass}
                  onClick={() => setOpen(false)}
                >
                  <FileImage className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  View images ({document.imageCount})
                </Link>
              ) : null}
            </div>,
            window.document.body,
          )
        : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatus === "citation-copied"
          ? `${document.title} citation copied`
          : copyStatus === "link-copied"
            ? `${document.title} link copied`
            : copyStatus === "citation-failed" || copyStatus === "link-failed"
              ? "Unable to copy"
              : ""}
      </span>
    </div>
  );
}

function DocumentSearchHome({
  documentCount,
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenSourcePdf,
  desktopComposerSlotId,
}: {
  documentCount: number;
  onOpenRecentDocuments: () => void;
  onOpenLibrary: () => void;
  onOpenSourcePdf: () => void;
  desktopComposerSlotId?: string;
}) {
  const startItems = [
    {
      label: "Recent documents",
      description: "Pick up where you left off.",
      icon: Clock3,
      action: onOpenRecentDocuments,
    },
    {
      label: "Browse library",
      description: "Open any indexed source.",
      icon: BookOpen,
      action: onOpenLibrary,
    },
    {
      label: "Open a source PDF",
      description: "Original source files.",
      icon: ExternalLink,
      action: onOpenSourcePdf,
    },
  ];

  return (
    <ModeHomeTemplate
      testId="document-search-empty-state"
      title="Documents"
      subtitle="Open, browse, and continue reading your clinical sources."
      icon={FileText}
      headingLevel={2}
      desktopComposerSlotId={desktopComposerSlotId}
      actionsLabel="Start here"
      actions={startItems.map((item) => ({
        title: item.label,
        description: item.description,
        icon: item.icon,
        onClick: item.action,
      }))}
      footer={
        <div className="grid w-full gap-3">
          {documentCount > 0 ? (
            <p className="text-xs font-semibold text-[color:var(--text-muted)]" aria-live="polite">
              {documentCount.toLocaleString()} indexed source{documentCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

function SearchRecordResults({
  matches,
  query,
  mode,
}: {
  matches: SearchRecordMatch[];
  query: string;
  mode: SearchRecordMode;
}) {
  if (matches.length === 0) return null;
  const copy = searchRecordConfig[mode];
  const recordRoute = (slug: string) => `${copy.routePrefix}/${slug}`;
  return (
    <section
      data-testid={`${copy.testIdPrefix}-results`}
      aria-label={copy.ariaLabel}
      className="grid gap-3 rounded-lg border border-[color:var(--clinical-accent)]/20 bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-tight)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[color:var(--text-heading)]">{copy.heading}</h3>
            <p className={cn("text-sm leading-5", textMuted)}>
              {matches.length} structured {copy.recordLabel}
              {matches.length === 1 ? "" : "s"} matched
              {query.trim() ? ` "${query.trim()}"` : ""}.
            </p>
          </div>
        </div>
        <span className={metadataPillDensity.roomyCompact}>{copy.chip}</span>
      </div>

      <div className="grid gap-3">
        {matches.map(({ service, reasons }, index) => {
          const summaryCards = service.summaryCards?.slice(0, 3) ?? [];
          const chips = [
            ...(service.statusChips ?? []).map((chip) => chip.label).filter(Boolean),
            service.primaryContact?.value,
            service.source?.status,
          ].filter((value): value is string => Boolean(value?.trim()));

          return (
            <article
              key={service.slug}
              data-testid={`${copy.testIdPrefix}-result-${service.slug}`}
              className={cn(
                sourceCard,
                "content-auto",
                "grid gap-3 p-3 shadow-[var(--shadow-tight)] transition hover:border-[color:var(--clinical-accent-border)] sm:p-4",
                index === 0 && "ring-1 ring-[color:var(--clinical-accent)]/15",
              )}
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="text-2xs font-bold uppercase tracking-label text-[color:var(--text-muted)]">
                    {service.catalogueLabel ?? "Source-backed record"}
                  </p>
                  <Link
                    href={recordRoute(service.slug)}
                    className="mt-0.5 inline-flex min-h-tap items-center text-base font-semibold leading-6 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] sm:min-h-7"
                  >
                    <span className="line-clamp-2">{service.title}</span>
                  </Link>
                  <p className={cn("mt-1 line-clamp-2 text-sm leading-6", textMuted)}>
                    {service.subtitle ?? service.bestUse ?? service.route ?? "Open the source-backed record."}
                  </p>
                </div>
                <Link
                  href={recordRoute(service.slug)}
                  className={cn(
                    floatingControl,
                    "inline-flex min-h-tap w-full justify-center rounded-lg px-3 text-sm text-[color:var(--clinical-accent)] sm:w-auto",
                  )}
                  aria-label={`Open ${service.title}`}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open
                </Link>
              </div>

              {chips.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {chips.slice(0, 5).map((chip) => (
                    <span key={chip} className={metadataPillDensity.dense}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}

              {summaryCards.length ? (
                <dl className="grid gap-2 sm:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5"
                    >
                      <dt className="text-2xs font-bold uppercase tracking-label text-[color:var(--text-muted)]">
                        {card.label ?? card.id}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                        {card.title ?? "Check record"}
                      </dd>
                      {card.detail ? (
                        <dd className={cn("mt-0.5 text-xs leading-5", textMuted)}>{card.detail}</dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              ) : null}

              {reasons.length ? (
                <p className="text-xs font-medium text-[color:var(--text-muted)]">
                  Matched by {reasons.slice(0, 3).join(", ")}.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RecordRegistryNotice({ status, mode }: { status: RegistryRequestStatus; mode: SearchRecordMode }) {
  if (status === "ready" || status === "refetching") return null;
  const noun = mode === "forms" ? "forms" : "services";
  const config =
    status === "loading"
      ? { Icon: Loader2, spin: true, tone: "info" as const, text: `Loading your ${noun} registry...` }
      : status === "unauthorized"
        ? {
            Icon: Shield,
            spin: false,
            tone: "warning" as const,
            text: `Your session expired. Sign in again to search your private ${noun} registry.`,
          }
        : {
            Icon: ShieldAlert,
            spin: false,
            tone: "danger" as const,
            text: `Couldn't load the ${noun} registry. Try again shortly.`,
          };
  const toneClass =
    config.tone === "danger"
      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/50 text-[color:var(--danger)]"
      : config.tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 text-[color:var(--warning)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]";
  return (
    <p
      data-testid="dashboard-registry-status-notice"
      className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold", toneClass)}
    >
      <config.Icon className={cn("h-4 w-4 shrink-0", config.spin && "animate-spin")} aria-hidden />
      {config.text}
    </p>
  );
}

function DocumentSearchResultsPanelImpl({
  matches,
  recordMatches = [],
  recordMode = "services",
  recordStatus = "ready",
  showRecordMatches = false,
  query,
  loading,
  documentCount,
  realDataReady,
  authUnavailable,
  apiUnavailable,
  setupWarning,
  facets: _facets,
  searchScope = null,
  onScopeDocument,
  onAnswerFromDocument,
  onOpenRecentDocuments,
  onOpenLibrary,
  onOpenSourcePdf,
  onTagSearch,
  scopeFilters,
  onScopeFiltersChange,
  showHome = false,
  desktopComposerSlotId,
}: {
  matches: DocumentMatch[];
  recordMatches?: SearchRecordMatch[];
  recordMode?: SearchRecordMode;
  recordStatus?: RegistryRequestStatus;
  showRecordMatches?: boolean;
  query: string;
  loading: boolean;
  documentCount: number;
  recentDocuments?: ClinicalDocument[];
  realDataReady: boolean;
  authUnavailable: boolean;
  apiUnavailable: boolean;
  setupWarning: string | null;
  facets?: SearchFacets | null;
  searchScope?: SearchScopeSummary | null;
  onScopeDocument: (documentId: string) => void;
  onAnswerFromDocument: (documentId: string) => void;
  onOpenRecentDocuments: () => void;
  onOpenLibrary: () => void;
  onOpenSourcePdf: () => void;
  onTagSearch: (tag: SmartDocumentTag | SmartDocumentTagFacet) => void;
  /**
   * The scope filters the current results were requested with. Paired with
   * `searchScope.activeFilterCount` (the server's count of what it actually
   * applied) so the zero-result state only claims a filter when retrieval was
   * really scoped.
   */
  scopeFilters?: SearchScopeFilters | null;
  /**
   * Re-run the search with a relaxed server-side scope. Required to make the
   * scoped-to-zero state recoverable: those filters are applied before
   * retrieval, so no client-side control can undo them. Omit to hide that route.
   */
  onScopeFiltersChange?: (filters: SearchScopeFilters) => void;
  showHome?: boolean;
  desktopComposerSlotId?: string;
}) {
  void _facets;
  const [sortValue, setSortValue] = useResultSort();
  const trimmedQuery = query.trim();
  const [activeFacetState, setActiveFacetState] = useState<{ query: string; keys: string[] }>({ query: "", keys: [] });
  const [activeResultType, setActiveResultType] = useState<ResultTypeFilter>("all");
  const filterPanelId = useId();
  // Query-scope the open flag the same way facets are scoped: a new search must
  // not leave the panel covering a different result set (especially on phones).
  // Do not reset via useEffect+setState — react-hooks/set-state-in-effect fails CI.
  const [filterPanelState, setFilterPanelState] = useState<{ query: string; open: boolean }>({
    query: "",
    open: false,
  });
  const filterPanelOpen = filterPanelState.query === query && filterPanelState.open;
  const activeFacetKeys = useMemo(
    () => (activeFacetState.query === query ? activeFacetState.keys : []),
    [activeFacetState, query],
  );
  const tagFacetIndex = useMemo(() => buildSmartDocumentTagFacetIndex(matches, { query }), [matches, query]);
  // Counts must describe the set the reader is looking at. `tagFacetIndex.groups`
  // counts against the whole match set, so once a facet is selected the rest of
  // the panel reports numbers for a set that no longer exists — several of them
  // pointing at AND-combinations that return nothing.
  const tagFacetGroups = useMemo(
    () => projectSmartTagFacetGroups(tagFacetIndex, activeFacetKeys),
    [tagFacetIndex, activeFacetKeys],
  );
  const visibleMatches = useMemo(
    () => filterDocumentsBySmartTagFacetIndex(tagFacetIndex, activeFacetKeys),
    [tagFacetIndex, activeFacetKeys],
  );
  const resultTabs = useMemo(() => resultTypeTabs(visibleMatches), [visibleMatches]);
  const effectiveResultType = resultTabs.some((tab) => tab.key === activeResultType) ? activeResultType : "all";
  const displayedMatches = useMemo(
    () => filterMatchesByResultType(visibleMatches, effectiveResultType),
    [visibleMatches, effectiveResultType],
  );
  const sortedMatches = useMemo(
    () => sortResultItems(displayedMatches, sortValue, documentDisplayTitle),
    [displayedMatches, sortValue],
  );
  // Progressive reveal so large libraries do not mount every card on first paint.
  // Reset the window whenever the sorted result set identity changes (query/filter/sort).
  const resultsSignature = [
    trimmedQuery,
    sortValue,
    effectiveResultType,
    activeFacetKeys.join(","),
    sortedMatches.map((document) => document.document_id).join(","),
  ].join("\0");
  const [visibleCountState, setVisibleCountState] = useState({
    signature: resultsSignature,
    count: DOCUMENT_RESULTS_INITIAL_WINDOW,
  });
  if (visibleCountState.signature !== resultsSignature) {
    setVisibleCountState({ signature: resultsSignature, count: DOCUMENT_RESULTS_INITIAL_WINDOW });
  }
  const visibleCount = Math.min(visibleCountState.count, sortedMatches.length);
  const renderedMatches = sortedMatches.slice(0, visibleCount);
  const hasMoreMatches = visibleCount < sortedMatches.length;
  const recordMatchCount = recordMatches.length;
  const shouldShowHome = showHome || !trimmedQuery;

  // Stable per query so the applied-filter shelf can depend on it honestly
  // rather than suppressing the dependency check.
  const toggleTagFacet = useCallback(
    (facet: SmartDocumentTagFacet) => {
      setActiveFacetState((current) => {
        const keys = current.query === query ? current.keys : [];
        return {
          query,
          keys: keys.includes(facet.key) ? keys.filter((key) => key !== facet.key) : [...keys, facet.key],
        };
      });
    },
    [query],
  );

  const unavailable = deriveDocumentSearchUnavailable({
    apiUnavailable,
    authUnavailable,
    realDataReady,
    setupWarning,
    deployedClinicalKb: isDeployedClinicalKb(),
  });
  const unavailableMessage = unavailable?.message ?? null;
  // On the record path the band's fault panel now reports a failed registry, so
  // RecordRegistryNotice would repeat that verbatim two lines below — the same
  // double-reporting removed from the standalone services/forms pages. Loading
  // is still the notice's to own: the band only says "Searching…" there.
  const recordBandOwnsFault =
    showRecordMatches && (recordStatus === "error" || recordStatus === "not_found" || recordStatus === "unauthorized");
  const showResultsControls = matches.length > 0 && !loading;
  const activeFilterCount = activeFacetKeys.length + (effectiveResultType === "all" ? 0 : 1);
  // Both the source-type tabs and the tag facets are derived from the current
  // match set, so a query that yields one uniform kind of document has nothing
  // to offer. Advertising Filter there would open an empty panel.
  const hasFilters = resultTabs.length > 1 || tagFacetGroups.length > 0;
  const showFilterControl = showResultsControls && hasFilters;
  /* The registry is still answering. `loading` covers only the document search,
     so on the services and forms paths the zero-result body used to render
     "No matches for …" directly beneath a spine reading "Searching…" — the band
     derives its status from `recordStatus`, this branch did not. The band's
     clinical invariant is that a search in flight asserts nothing; the body has
     to hold to it too, or the page contradicts itself. Named here rather than
     inlined because a comment this long inside the ternary chain below gets
     reflowed into one line by Prettier on every run. */
  const recordSearchStillRunning = showRecordMatches && recordStatus === "loading";
  /* The in-context route to the whole corpus, for the render paths that have no
     other one. Shared rather than duplicated so a fourth path cannot be added
     without a Library route: the sheet footer needs `matches.length > 0`, and
     the zero-result empty state needs `recordMatchCount === 0`, which between
     them miss the services/forms record-match render entirely. */
  const browseLibraryControl = (
    <button
      type="button"
      onClick={onOpenLibrary}
      data-testid="document-results-browse-library"
      className={cn(floatingControl, "min-h-tap w-fit gap-2 px-3 text-xs sm:min-h-10")}
    >
      <BookOpen aria-hidden="true" className="size-icon-md shrink-0" />
      Browse all sources
      {documentCount > 0 ? (
        <span className="nums text-2xs text-[color:var(--text-muted)]">{documentCount.toLocaleString()}</span>
      ) : null}
    </button>
  );
  const renderFilterTrigger = (testId: string) =>
    showFilterControl ? (
      <DocumentFilterTrigger
        panelId={filterPanelId}
        testId={testId}
        open={filterPanelOpen}
        activeCount={activeFilterCount}
        onToggle={() =>
          setFilterPanelState((current) => ({
            query,
            open: current.query === query ? !current.open : true,
          }))
        }
      />
    ) : null;
  // The shelf's contents. Facet chips carry their group's own label so a bare
  // "Policy" is not ambiguous across ten groups, and the source-type chip joins
  // them because it narrows the same list by the same act.
  const appliedFilters = useMemo(() => {
    const selected = new Set(activeFacetKeys);
    const chips = tagFacetGroups.flatMap((group) =>
      group.facets
        .filter((facet) => selected.has(facet.key))
        .map((facet) => ({
          id: facet.key,
          label: facet.label,
          onRemove: () => toggleTagFacet(facet),
        })),
    );
    if (effectiveResultType !== "all") {
      const tab = resultTabs.find((entry) => entry.key === effectiveResultType);
      if (tab) {
        chips.push({
          id: `result-type-${tab.key}`,
          label: tab.label,
          onRemove: () => setActiveResultType("all"),
        });
      }
    }
    return chips;
  }, [tagFacetGroups, activeFacetKeys, effectiveResultType, resultTabs, toggleTagFacet]);
  const clearAllFilters = () => {
    setActiveFacetState({ query, keys: [] });
    setActiveResultType("all");
  };
  /* The scope filters the API applied BEFORE retrieval, as removable chips.
     Only used on the zero-result path: while matches exist the facet chips above
     describe what is narrowing the visible list, and stacking both would show a
     reader two filter shelves doing different jobs. At zero there is no match
     set to derive facets from, so without these the constraint that emptied the
     search is invisible — and unclearable, since `showResultsControls` gates the
     Filter trigger on `matches.length > 0`. */
  /* A retrieval layer errored, so no count from this search is trustworthy —
     including a non-zero one. The band owns that claim: it renders `matchCount`
     inside the only `role="status"` region on the page, and the zero-result
     state suppresses its own live region while filters are applied, so a
     degraded+scoped search announced a bare confident "0 documents" and nothing
     else. `partial` is the band's own word for it ("available sources returned
     an honest count, but at least one source failed") and is right for BOTH
     cases: at zero it stops the headline contradicting the panel below it, and
     above zero it is the only thing that says the list is a floor rather than
     the answer. (Raised by Devin review on PR #1640.) */
  const retrievalDegraded = Boolean(searchScope?.retrieval?.degraded);
  const activeScopeFilters = scopeFilters ?? null;
  const scopeEmptiedResults = matches.length === 0 && (searchScope?.activeFilterCount ?? 0) > 0;
  const scopeAppliedFilters = useMemo(() => {
    if (!scopeEmptiedResults || !activeScopeFilters || !onScopeFiltersChange) return EMPTY_APPLIED_FILTERS;
    return scopeFilterChips(activeScopeFilters).map((chip) => ({
      ...chip,
      onRemove: () => onScopeFiltersChange(removeScopeFilterValue(activeScopeFilters, chip.id)),
    }));
  }, [scopeEmptiedResults, activeScopeFilters, onScopeFiltersChange]);
  const showIdentityHeader =
    recordMatchCount > 0 ||
    matches.length > 0 ||
    (trimmedQuery && !shouldShowHome) ||
    loading ||
    (unavailableMessage && !shouldShowHome);

  return (
    <div data-testid="document-search-workspace" className="w-full space-y-2.5 sm:space-y-3">
      {showIdentityHeader ? (
        <SearchResultsHeaderBand
          modeId={showRecordMatches ? recordMode : "documents"}
          query={trimmedQuery}
          matchCount={recordMatchCount + sortedMatches.length}
          // Derive the fault from whichever source this ribbon is actually
          // counting. On the services/forms path the registry has its own status
          // and can be perfectly healthy while the unrelated document API is
          // down; letting that invalidate the ribbon would announce "Couldn't
          // search" and hide a valid recordMatchCount while SearchRecordResults
          // renders those very matches below.
          status={
            showRecordMatches
              ? recordStatus === "unauthorized"
                ? "unauthorized"
                : recordStatus === "error" || recordStatus === "not_found"
                  ? "error"
                  : recordStatus === "loading"
                    ? "loading"
                    : recordStatus === "refetching"
                      ? "refetching"
                      : "ready"
              : (unavailable?.status ?? (loading ? "loading" : retrievalDegraded ? "partial" : "ready"))
          }
          faultBody={showRecordMatches ? undefined : (unavailableMessage ?? undefined)}
          sortValue={sortValue}
          onSortChange={matches.length > 0 ? setSortValue : undefined}
          // Library has left the rail. It sat adjacent to Filter while answering
          // a different question — Filter narrows what this query returned,
          // Library opens the whole indexed corpus — and that proximity is what
          // made the old name ("Filter and browse sources") read as a second
          // filter; renaming treated the symptom. It also occupied the rail
          // space the pinned Filter needs, and was the reason the phone rail
          // could overflow at all: without it documents carries only Sort and
          // Filter.
          //
          // It is moved, not removed. The requirement the old comment here was
          // protecting still holds — the documents action menu routes through
          // `onSearchModeChange`, which calls `setQuery("")`, so reaching the
          // library that way discards the search being read. Both of its new
          // homes are in-context and preserve the query: the filter sheet's
          // footer, and the zero-result state, which are the two moments
          // browsing is actually the next step.
          appliedFilters={appliedFilters}
          onClearFilters={clearAllFilters}
          filterLabel="Filter documents"
          // The same trigger goes in both slots: the ribbon shows `mobileControls`
          // below `sm` and `filterControls` from `sm` up, never both at once.
          // The phone control here is a compact badged trigger, not a full-width
          // select, so it shares the count line rather than taking a row of its own.
          mobileControlsPlacement="inline"
          mobileControls={renderFilterTrigger("document-filter-trigger-phone")}
          filterControls={renderFilterTrigger("document-filter-trigger-wide")}
        />
      ) : null}

      {/* When the ribbon is shown it owns this message in its fault panel. This
          standalone alert remains for the routes that render no ribbon, so the
          message is never lost. */}
      {/* The ribbon only carries this message on the documents path; in record
          mode its fault comes from the registry, so the notice must still
          render or an auth/API/setup warning is reported nowhere. */}
      {unavailableMessage && (showRecordMatches || !showIdentityHeader) ? (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)]/45 p-4 text-sm font-semibold leading-6 text-[color:var(--warning)]"
        >
          {unavailableMessage}
        </div>
      ) : null}

      {showRecordMatches ? (
        <>
          {recordBandOwnsFault ? null : <RecordRegistryNotice status={recordStatus} mode={recordMode} />}
          <SearchRecordResults matches={recordMatches} query={query} mode={recordMode} />
        </>
      ) : null}

      {loading ? (
        <LoadingPanel label="Finding matching documents" />
      ) : matches.length === 0 ? (
        // A services or forms search that matched records but no documents.
        // This branch used to render `null`, which stranded the reader: moving
        // Library off the utility rail left three homes for it — the sheet
        // footer, the zero-result empty state, and the inline fallback below —
        // and this path reaches none of them, because the sheet needs
        // `matches.length > 0` and the empty state needs `recordMatchCount === 0`.
        // `docs/search-results-bar-decisions.md` requires an in-context route
        // precisely because the documents action menu calls `setQuery("")` and
        // discards the search the reader is looking at.
        recordMatchCount > 0 ? (
          browseLibraryControl
        ) : recordSearchStillRunning ? null : trimmedQuery && !shouldShowHome ? (
          <SearchResultsEmptyState
            modeId="documents"
            query={trimmedQuery}
            // The band above owns `h2` for this region, so the zero-result
            // state is `h3` — the level #1612 gave it, kept across the move to
            // the shared state. The inline filtered-to-zero state inside the
            // results grid stays a paragraph: the grid's heading is the band's.
            headingLevel={3}
            // Names the scope constraint and hands back a relaxed filter set, so
            // the state reads "No documents match the selected filter … remove
            // one to widen it" instead of "check the spelling" — the copy this
            // shared state already carries for filtered-to-zero, which the
            // documents path could not reach because it only ever passed
            // client-derived facet chips (always empty at zero matches).
            appliedFilters={scopeAppliedFilters}
            onClearFilters={
              scopeAppliedFilters.length > 0 && onScopeFiltersChange ? () => onScopeFiltersChange({}) : undefined
            }
            // A retrieval layer errored, so this zero is not evidence of absence.
            degraded={retrievalDegraded}
            onBrowseAll={onOpenLibrary}
            browseAllLabel={
              documentCount > 0 ? `Browse all ${documentCount.toLocaleString()} sources` : "Browse all sources"
            }
          />
        ) : (
          <DocumentSearchHome
            documentCount={documentCount}
            onOpenRecentDocuments={onOpenRecentDocuments}
            onOpenLibrary={onOpenLibrary}
            onOpenSourcePdf={onOpenSourcePdf}
            desktopComposerSlotId={desktopComposerSlotId}
          />
        )
      ) : (
        <>
          {/* Opened by the ribbon's Filter trigger. Previously this was gated on
              `activeFacetKeys.length > 0`, which nothing else could satisfy —
              the only writers of that state lived inside the gated subtree — so
              the facets were unreachable. The trigger is now the way in.
              Mounted unconditionally: `Sheet` returns null while closed and owns
              its own open/close transition, so gating the mount here would cut
              the dismiss animation off mid-flight. */}
          {showFilterControl ? (
            <DocumentFilterPanel
              open={filterPanelOpen}
              panelId={filterPanelId}
              query={query}
              groups={tagFacetGroups}
              activeKeys={activeFacetKeys}
              resultTabs={resultTabs}
              activeResultType={effectiveResultType}
              onResultTypeChange={setActiveResultType}
              onToggle={toggleTagFacet}
              onClear={clearAllFilters}
              resultCount={sortedMatches.length}
              documentCount={documentCount}
              onOpenLibrary={onOpenLibrary}
              onDone={() => setFilterPanelState({ query, open: false })}
            />
          ) : null}
          {showResultsControls && !hasFilters ? browseLibraryControl : null}
          {/* With the panel closed the active filters are otherwise invisible
              apart from the trigger's badge, so the reader needs the count to
              explain why the list is shorter than the ribbon's total. */}
          {activeFilterCount > 0 && !filterPanelOpen ? (
            <div className={cn(metadataPillDensity.roomyCompact, "w-fit max-w-full")}>
              {sortedMatches.length} result{sortedMatches.length === 1 ? "" : "s"} after filters
            </div>
          ) : null}
          <div className="grid gap-3 sm:gap-4">
            <div className="min-w-0 space-y-2.5 sm:space-y-3">
              {sortedMatches.length === 0 ? (
                // Facet toggles empty this list without a navigation. The shared
                // empty state leads with Remove / Clear all against the chips
                // that caused it (F11); the band's `role="status"` already
                // re-announced the zero count, so the empty state suppresses its
                // own live region on the filtered path to avoid a double polite
                // announcement for one interaction.
                <div data-testid="document-filter-empty-results">
                  <SearchResultsEmptyState
                    modeId="documents"
                    query={trimmedQuery}
                    appliedFilters={appliedFilters}
                    onClearFilters={clearAllFilters}
                    onBrowseAll={onOpenLibrary}
                    browseAllLabel={
                      documentCount > 0 ? `Browse all ${documentCount.toLocaleString()} sources` : "Browse all sources"
                    }
                  />
                </div>
              ) : null}
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                {renderedMatches.map((document, index) => {
                  const relevanceDisplay = relevanceTone(document);
                  const relevanceVariant = relevanceDisplay.short === "High relevance" ? "high" : "relevant";
                  const openHref = documentOpenHref(document);
                  return (
                    <article
                      key={document.document_id}
                      data-testid="document-result-card"
                      className={cn(
                        sourceCard,
                        "content-auto",
                        "relative overflow-visible p-0 shadow-[var(--shadow-tight)] transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-hover)] motion-reduce:transition-none",
                        index === 0 && "border-t-[3px] border-t-[color:var(--clinical-accent)]",
                      )}
                    >
                      <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3 p-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
                        <DocumentPagePreview document={document} href={openHref} />
                        <div className="min-w-0">
                          <h3 className="flex min-w-0 items-start gap-2">
                            <span
                              data-testid="document-result-rank"
                              className="nums mt-2 grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-1.5 text-sm font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
                              aria-hidden="true"
                            >
                              {index + 1}
                            </span>
                            <Link
                              href={openHref}
                              className="inline-flex min-h-12 min-w-0 items-center rounded-md text-base font-extrabold leading-5 text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-lg sm:leading-6"
                            >
                              <span className="sr-only">Result {index + 1}: </span>
                              <span className="line-clamp-2">{documentDisplayTitle(document)}</span>
                            </Link>
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-2.5">
                            {index === 0 ? (
                              <DocumentBadge
                                variant="best"
                                className="min-h-7 rounded-lg px-2.5 text-2xs [font-weight:700]"
                              >
                                Best match
                              </DocumentBadge>
                            ) : null}
                            <DocumentBadge
                              variant={relevanceVariant}
                              icon={Target}
                              className="min-h-7 rounded-lg px-2.5 text-2xs [font-weight:600]"
                            >
                              {relevanceDisplay.short}
                              <span className="sr-only">, {relevanceDisplay.detail}</span>
                            </DocumentBadge>
                            <DocumentBadge
                              variant="neutral"
                              icon={BookOpen}
                              className="min-h-7 rounded-lg px-2.5 text-2xs [font-weight:600]"
                            >
                              {documentPageLabel(document)}
                            </DocumentBadge>
                            {document.tableCount > 0 ? (
                              <DocumentBadge
                                variant="relevant"
                                icon={ListChecks}
                                className="min-h-7 rounded-lg px-2.5 text-2xs [font-weight:600]"
                              >
                                {document.tableCount} table{document.tableCount === 1 ? "" : "s"}
                              </DocumentBadge>
                            ) : null}
                            {document.imageCount > 0 ? (
                              <DocumentBadge
                                variant="relevant"
                                icon={FileImage}
                                className="min-h-7 rounded-lg px-2.5 text-2xs [font-weight:600]"
                              >
                                {document.imageCount} image{document.imageCount === 1 ? "" : "s"}
                              </DocumentBadge>
                            ) : null}
                          </div>
                          <DocumentTagCloud
                            labels={document.labels}
                            query={query}
                            limit={2}
                            compact
                            className="mt-2.5"
                            onTagClick={onTagSearch}
                          />
                        </div>
                      </div>
                      <div
                        data-testid="document-result-actions"
                        className="grid grid-cols-3 items-stretch divide-x divide-[color:var(--border)] rounded-b-xl border-t border-[color:var(--border)] bg-[color:var(--surface)]"
                      >
                        <DocumentActionLink
                          href={openHref}
                          icon={FileText}
                          className="min-h-12 min-w-0 rounded-bl-xl bg-[color:var(--clinical-accent-soft)] px-2 !text-sm !font-extrabold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-border)] [&_svg]:h-5 [&_svg]:w-5"
                          aria-label={`Open ${document.title}`}
                        >
                          Open
                        </DocumentActionLink>
                        <DocumentActionButton
                          onClick={() => onAnswerFromDocument(document.document_id)}
                          icon={MessageSquareText}
                          className="min-h-12 min-w-0 px-2 !text-sm font-bold text-[color:var(--text-heading)] [&_svg]:h-5 [&_svg]:w-5"
                          aria-label={`Ask about ${document.title}`}
                        >
                          Ask
                        </DocumentActionButton>
                        <DocumentResultMoreMenu
                          document={document}
                          openHref={openHref}
                          onScopeDocument={() => onScopeDocument(document.document_id)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
              {hasMoreMatches ? (
                <button
                  type="button"
                  className={cn(
                    floatingControl,
                    "min-h-tap w-full justify-center rounded-xl px-4 text-sm font-semibold",
                  )}
                  onClick={() =>
                    setVisibleCountState((current) => ({
                      signature: resultsSignature,
                      count: Math.min(current.count + DOCUMENT_RESULTS_PAGE_SIZE, sortedMatches.length),
                    }))
                  }
                  data-testid="document-search-show-more"
                >
                  Show more ({sortedMatches.length - visibleCount} remaining)
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}

      {trimmedQuery && !shouldShowHome ? <UniversalSearchAlsoMatches modeId="documents" query={trimmedQuery} /> : null}
    </div>
  );
}

// Memoized so this panel (and its result list) stops re-rendering on unrelated
// dashboard state changes. It still receives the live `query` prop for its
// header, so keystrokes in documents mode re-render it, but the expensive
// `matches` list only changes on submit; every other parent render is now
// suppressed once the parent's callbacks are stabilized.
export const DocumentSearchResultsPanel = memo(DocumentSearchResultsPanelImpl);
