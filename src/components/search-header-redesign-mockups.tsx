"use client";

import {
  ArrowLeft,
  ChevronDown,
  FileText,
  LayoutList,
  MessageSquarePlus,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/components/ui-primitives";

/**
 * Four redesign directions for the shared search-results header chrome.
 *
 * The shipped phone stack currently layers: close · mode pill · new-chat,
 * a redundant "Search" chip, a bordered query card, Relevance/A–Z pills, then
 * Results/Forms tabs. These concepts collapse that stack, restore hierarchy,
 * and show desktop + phone in the same frame for each direction.
 */

type ConceptId = "ledger" | "mast" | "unified" | "focus";
type SortValue = "relevance" | "alpha";
type TabValue = "results" | "forms";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const QUERY = "1A";
const MATCH_COUNT = 10;
const MODE_LABEL = "Forms";

const concepts: Array<{
  id: ConceptId;
  number: string;
  name: string;
  thesis: string;
  fixes: string[];
}> = [
  {
    id: "ledger",
    number: "01",
    name: "Ledger strip",
    thesis:
      "Typography does the work. Drop the card, the magnifier tile, and the stacked pills — query, count, sort, and tabs share one quiet strip.",
    fixes: ["No nested card", "Count as tabular text", "Sort as underline segments"],
  },
  {
    id: "mast",
    number: "02",
    name: "Command mast",
    thesis:
      "Treat the results header as a clinical instrument bar: mode is a quiet label, utilities sit flush right, and the query is a single confident line.",
    fixes: ["Graphite command density", "Mode as text, not pill", "One control height"],
  },
  {
    id: "unified",
    number: "03",
    name: "Unified chrome",
    thesis:
      "Merge the universal top bar and the results context so mode, query, and count never compete as separate bands. Phone loses the redundant Search chip entirely.",
    fixes: ["One header owner", "No Search chip", "Tabs ride with sort"],
  },
  {
    id: "focus",
    number: "04",
    name: "Focus frame",
    thesis:
      "One accent gesture, everything else subdued. Phone parks refine behind a single control; desktop expands sort and category inline beside the query.",
    fixes: ["Single accent edge", "Phone refine disclosure", "Calm secondary row"],
  },
];

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

function ResultSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("space-y-2", compact ? "p-3" : "px-4 py-3")}>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-2.5 w-2/3 rounded-full bg-[color:var(--text-heading)]/12" />
            <span className="block h-2 w-1/3 rounded-full bg-[color:var(--border-strong)]/45" />
          </span>
          <span className="h-5 w-12 rounded-md bg-[color:var(--surface-subtle)]" />
        </div>
      ))}
    </div>
  );
}

function SortSegments({
  value,
  onChange,
  compact = false,
  underline = false,
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
  compact?: boolean;
  underline?: boolean;
}) {
  const options: Array<{ value: SortValue; label: string }> = [
    { value: "relevance", label: "Relevance" },
    { value: "alpha", label: "A–Z" },
  ];

  if (underline) {
    return (
      <div role="group" aria-label="Sort results" className="inline-flex items-center gap-3">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "relative min-h-9 text-xs font-semibold transition-colors",
                focusRing,
                selected
                  ? "text-[color:var(--text-heading)]"
                  : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
              )}
            >
              {option.label}
              {selected ? (
                <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-[color:var(--clinical-accent)]" />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Sort results"
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]",
        compact ? "min-h-tap" : "min-h-10",
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-3 text-xs font-semibold whitespace-nowrap",
              compact ? "min-h-tap" : "min-h-10",
              index > 0 && "border-l border-[color:var(--border)]",
              focusRing,
              selected
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryTabs({
  value,
  onChange,
  compact = false,
  tone = "underline",
}: {
  value: TabValue;
  onChange: (value: TabValue) => void;
  compact?: boolean;
  tone?: "underline" | "segment";
}) {
  const tabs: Array<{ value: TabValue; label: string; count?: number }> = [
    { value: "results", label: "Results" },
    { value: "forms", label: "Forms", count: MATCH_COUNT },
  ];

  if (tone === "segment") {
    return (
      <div
        role="tablist"
        aria-label="Result categories"
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-0.5",
          compact ? "min-h-tap" : "min-h-10",
        )}
      >
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[0.35rem] px-2.5 text-xs font-semibold",
                compact ? "min-h-[2.5rem]" : "min-h-9",
                focusRing,
                selected
                  ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
                  : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
              )}
            >
              {tab.label}
              {tab.count != null ? <span className="nums text-[color:var(--text-muted)]">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label="Result categories" className="flex items-end gap-5">
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative flex min-h-11 items-center gap-1.5 text-sm font-semibold",
              focusRing,
              selected
                ? "text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span className="nums text-xs font-semibold text-[color:var(--text-soft)]">{tab.count}</span>
            ) : null}
            {selected ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[color:var(--clinical-accent)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top bars                                                            */
/* ------------------------------------------------------------------ */

function ClassicTopBar({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        compact ? "h-12 px-2.5" : "h-14 px-4",
      )}
    >
      {compact ? (
        <span className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)]">
          <X className="h-4 w-4" aria-hidden />
        </span>
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
          KB
        </span>
      )}
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] font-semibold text-[color:var(--text)]",
          compact ? "h-9 flex-1 justify-center px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        <FileText className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
        {MODE_LABEL}
        <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
      </span>
      <span
        className={cn(
          "grid place-items-center rounded-full text-[color:var(--text-muted)]",
          compact ? "h-9 w-9" : "ml-auto h-10 w-10",
        )}
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden />
      </span>
      {!compact ? <span aria-hidden className="h-8 w-8 rounded-full bg-[color:var(--clinical-accent-soft)]" /> : null}
    </div>
  );
}

function QuietTopBar({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        compact ? "h-12 px-2.5" : "h-14 px-4",
      )}
    >
      {compact ? (
        <button
          type="button"
          onClick={() => undefined}
          aria-label="Close search"
          className={cn("grid h-9 w-9 place-items-center rounded-md text-[color:var(--text-muted)]", focusRing)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
          KB
        </span>
      )}
      <button
        type="button"
        onClick={() => undefined}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 font-semibold text-[color:var(--text-heading)]",
          compact ? "h-9 flex-1 text-sm" : "h-10 px-1 text-sm",
          focusRing,
        )}
      >
        {MODE_LABEL}
        <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--command)] font-semibold text-[color:var(--surface)]",
          compact ? "h-9 px-2.5 text-xs" : "ml-auto h-10 px-3 text-xs",
          focusRing,
        )}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
        {compact ? null : <span>New chat</span>}
        {compact ? <span className="sr-only">New chat</span> : null}
      </button>
      {!compact ? <span aria-hidden className="h-8 w-8 rounded-full bg-[color:var(--clinical-accent-soft)]" /> : null}
    </div>
  );
}

function UnifiedTopBar({
  compact,
  sort,
  onSort,
  tab,
  onTab,
}: {
  compact?: boolean;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  tab: TabValue;
  onTab: (value: TabValue) => void;
}) {
  if (compact) {
    return (
      <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="flex h-12 items-center gap-2 px-2.5">
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Close search"
            className={cn("grid h-9 w-9 place-items-center rounded-md text-[color:var(--text-muted)]", focusRing)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
              {QUERY}
            </p>
            <p className="nums truncate text-3xs font-medium text-[color:var(--text-soft)]">
              {MODE_LABEL} · {MATCH_COUNT} matches
            </p>
          </div>
          <button
            type="button"
            onClick={() => undefined}
            aria-label="New chat"
            className={cn("grid h-9 w-9 place-items-center rounded-md text-[color:var(--text-muted)]", focusRing)}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
          <CategoryTabs value={tab} onChange={onTab} compact tone="segment" />
          <SortSegments value={sort} onChange={onSort} compact />
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="flex h-14 items-center gap-3 px-4">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
          KB
        </span>
        <button
          type="button"
          onClick={() => undefined}
          className={cn(
            "inline-flex h-10 items-center gap-1 text-sm font-semibold text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          {MODE_LABEL}
          <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
        </button>
        <span className="h-5 w-px bg-[color:var(--border)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
            {QUERY}
          </p>
        </div>
        <p className="nums shrink-0 text-sm font-semibold text-[color:var(--text-muted)]">{MATCH_COUNT} matches</p>
        <SortSegments value={sort} onChange={onSort} />
        <CategoryTabs value={tab} onChange={onTab} tone="segment" />
        <button
          type="button"
          onClick={() => undefined}
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--command)] px-3 text-xs font-semibold text-[color:var(--surface)]",
            focusRing,
          )}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          New chat
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Concept headers                                                     */
/* ------------------------------------------------------------------ */

function LedgerHeader({
  compact,
  sort,
  onSort,
  tab,
  onTab,
}: {
  compact?: boolean;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  tab: TabValue;
  onTab: (value: TabValue) => void;
}) {
  return (
    <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div
        className={cn(
          "flex min-w-0 items-end justify-between gap-3",
          compact ? "flex-col items-stretch px-3 pt-3 pb-2" : "px-4 pt-4 pb-3",
        )}
      >
        <div className="min-w-0">
          <p className="text-3xs font-bold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            {MODE_LABEL} search
          </p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2.5">
            <h2 className="truncate text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-heading)]">
              {QUERY}
            </h2>
            <p className="nums shrink-0 text-sm font-medium text-[color:var(--text-muted)]">{MATCH_COUNT} matches</p>
          </div>
        </div>
        <SortSegments value={sort} onChange={onSort} compact={compact} underline />
      </div>
      <div className={cn("px-3", compact ? "pb-1" : "px-4 pb-0")}>
        <CategoryTabs value={tab} onChange={onTab} compact={compact} />
      </div>
    </div>
  );
}

function MastHeader({
  compact,
  sort,
  onSort,
  tab,
  onTab,
}: {
  compact?: boolean;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  tab: TabValue;
  onTab: (value: TabValue) => void;
}) {
  return (
    <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-chrome)]">
      <div
        className={cn(
          "flex items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
          compact ? "px-3 py-2.5" : "px-4 py-3",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--text-heading)] text-[color:var(--surface)]">
          <Search className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]">
            {QUERY}
          </p>
          <p className="nums text-3xs font-medium text-[color:var(--text-soft)]">{MATCH_COUNT} matches</p>
        </div>
        {!compact ? (
          <div className="flex items-center gap-2">
            <SortSegments value={sort} onChange={onSort} />
            <div
              role="group"
              aria-label="Results view"
              className="inline-flex min-h-10 overflow-hidden rounded-md border border-[color:var(--border)]"
            >
              <span className="grid min-h-10 min-w-10 place-items-center bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Table2 className="h-4 w-4" aria-hidden />
              </span>
              <span className="grid min-h-10 min-w-10 place-items-center border-l border-[color:var(--border)] text-[color:var(--text-muted)]">
                <LayoutList className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </div>
        ) : (
          <SortSegments value={sort} onChange={onSort} compact />
        )}
      </div>
      <div className={cn("bg-[color:var(--surface-chrome)]", compact ? "px-3 py-2" : "px-4 py-2")}>
        <CategoryTabs value={tab} onChange={onTab} compact={compact} tone="segment" />
      </div>
    </div>
  );
}

function FocusHeader({
  compact,
  sort,
  onSort,
  tab,
  onTab,
  refineOpen,
  onToggleRefine,
}: {
  compact?: boolean;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  tab: TabValue;
  onTab: (value: TabValue) => void;
  refineOpen: boolean;
  onToggleRefine: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div
        className={cn(
          "relative border-l-[3px] border-l-[color:var(--clinical-accent)]",
          compact ? "px-3 py-3" : "px-4 py-3.5",
        )}
      >
        <div className={cn("flex min-w-0 gap-3", compact ? "flex-col" : "items-center")}>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]">
              {QUERY}
            </h2>
            <p className="mt-0.5 nums text-xs font-medium text-[color:var(--text-muted)]">
              {MATCH_COUNT} matches in {MODE_LABEL}
            </p>
          </div>
          {compact ? (
            <button
              type="button"
              aria-expanded={refineOpen}
              onClick={onToggleRefine}
              className={cn(
                "inline-flex min-h-tap w-full items-center justify-between rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)]",
                focusRing,
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
                Refine · {sort === "relevance" ? "Relevance" : "A–Z"} · Forms
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-[color:var(--text-soft)] transition-transform",
                  refineOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <SortSegments value={sort} onChange={onSort} />
              <CategoryTabs value={tab} onChange={onTab} tone="segment" />
            </div>
          )}
        </div>
        {compact && refineOpen ? (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-[color:var(--border)] pt-2.5">
            <SortSegments value={sort} onChange={onSort} compact />
            <CategoryTabs value={tab} onChange={onTab} compact tone="segment" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

function ConceptScene({
  concept,
  compact,
  sort,
  onSort,
  tab,
  onTab,
  refineOpen,
  onToggleRefine,
}: {
  concept: ConceptId;
  compact?: boolean;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  tab: TabValue;
  onTab: (value: TabValue) => void;
  refineOpen: boolean;
  onToggleRefine: () => void;
}) {
  if (concept === "unified") {
    return (
      <>
        <UnifiedTopBar compact={compact} sort={sort} onSort={onSort} tab={tab} onTab={onTab} />
        <ResultSkeleton compact={compact} />
      </>
    );
  }

  const TopBar = concept === "ledger" || concept === "focus" ? QuietTopBar : ClassicTopBar;

  return (
    <>
      <TopBar compact={compact} />
      {concept === "ledger" ? (
        <LedgerHeader compact={compact} sort={sort} onSort={onSort} tab={tab} onTab={onTab} />
      ) : null}
      {concept === "mast" ? <MastHeader compact={compact} sort={sort} onSort={onSort} tab={tab} onTab={onTab} /> : null}
      {concept === "focus" ? (
        <FocusHeader
          compact={compact}
          sort={sort}
          onSort={onSort}
          tab={tab}
          onTab={onTab}
          refineOpen={refineOpen}
          onToggleRefine={onToggleRefine}
        />
      ) : null}
      <ResultSkeleton compact={compact} />
    </>
  );
}

function DualViewport({
  concept,
  sort,
  onSort,
  tab,
  onTab,
  refineOpen,
  onToggleRefine,
}: {
  concept: ConceptId;
  sort: SortValue;
  onSort: (value: SortValue) => void;
  tab: TabValue;
  onTab: (value: TabValue) => void;
  refineOpen: boolean;
  onToggleRefine: () => void;
}) {
  return (
    <div
      data-testid={`search-header-redesign-${concept}`}
      className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.7fr)]"
    >
      <figure className="min-w-0">
        <figcaption className="mb-2 flex items-center justify-between">
          <span className="text-3xs font-bold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Desktop</span>
          <span className="nums text-3xs font-semibold text-[color:var(--text-soft)]">1280 × 720</span>
        </figcaption>
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--background)] shadow-[var(--shadow-soft)]">
          <div className="flex h-[22rem] flex-col overflow-hidden">
            <ConceptScene
              concept={concept}
              sort={sort}
              onSort={onSort}
              tab={tab}
              onTab={onTab}
              refineOpen={refineOpen}
              onToggleRefine={onToggleRefine}
            />
          </div>
        </div>
      </figure>

      <figure className="min-w-0">
        <figcaption className="mb-2 flex items-center justify-between">
          <span className="text-3xs font-bold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Phone</span>
          <span className="nums text-3xs font-semibold text-[color:var(--text-soft)]">390 × 844</span>
        </figcaption>
        <div className="mx-auto w-full max-w-[23.75rem] overflow-hidden rounded-[1.35rem] border-[3px] border-[color:var(--text-heading)]/85 bg-[color:var(--background)] shadow-[var(--shadow-soft)]">
          <div className="flex h-[22rem] flex-col overflow-hidden">
            <div className="flex h-7 items-end justify-center bg-[color:var(--surface)] pb-1">
              <span className="h-1 w-16 rounded-full bg-[color:var(--text-heading)]/20" aria-hidden />
            </div>
            <ConceptScene
              concept={concept}
              compact
              sort={sort}
              onSort={onSort}
              tab={tab}
              onTab={onTab}
              refineOpen={refineOpen}
              onToggleRefine={onToggleRefine}
            />
          </div>
        </div>
      </figure>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function ConceptSection({ concept }: { concept: (typeof concepts)[number] }) {
  const [sort, setSort] = useState<SortValue>("relevance");
  const [tab, setTab] = useState<TabValue>("results");
  const [refineOpen, setRefineOpen] = useState(false);

  return (
    <section
      aria-labelledby={`search-header-${concept.id}-title`}
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div className="grid gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex min-w-0 gap-3">
          <span className="pt-0.5 text-xs font-bold tabular-nums text-[color:var(--clinical-accent)]">
            {concept.number}
          </span>
          <div className="min-w-0">
            <h2
              id={`search-header-${concept.id}-title`}
              className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]"
            >
              {concept.name}
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
              {concept.thesis}
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5 lg:justify-end">
          {concept.fixes.map((fix) => (
            <li
              key={fix}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-semibold text-[color:var(--text-muted)]"
            >
              {fix}
            </li>
          ))}
        </ul>
      </div>
      <div className="p-4 sm:p-5">
        <DualViewport
          concept={concept.id}
          sort={sort}
          onSort={setSort}
          tab={tab}
          onTab={setTab}
          refineOpen={refineOpen}
          onToggleRefine={() => setRefineOpen((open) => !open)}
        />
      </div>
    </section>
  );
}

export function SearchHeaderRedesignMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Search results header
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-semibold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Four quieter directions for every search page
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Each concept shows desktop and phone together. All four remove the redundant Search chip, stop stacking pill
            rows, and keep query → count → refine as a single reading order across Forms and the other search modes.
          </p>
          <p className="mt-3 max-w-3xl text-xs font-medium leading-5 text-[color:var(--text-soft)]">
            Current pain: close · mode pill · new chat, then a Search chip, then a bordered query card, then
            Relevance/A–Z pills, then Results/Forms tabs. Hierarchy dissolves into rounded chrome.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {concepts.map((concept) => (
          <ConceptSection key={concept.id} concept={concept} />
        ))}
      </div>
    </main>
  );
}
