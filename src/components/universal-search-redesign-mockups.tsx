"use client";

import { ArrowRight, ChevronDown, ExternalLink, FileText, Filter, FolderOpen, Heart, Plus, Search, Send, SlidersHorizontal, Table2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

export type UniversalSearchRedesignVariant = "content-strip" | "toolbar-inline" | "header-embedded";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const variantMeta: Record<
  UniversalSearchRedesignVariant,
  {
    label: string;
    tagline: string;
    rationale: string;
    tradeoffs: string[];
    bestFor: string[];
  }
> = {
  "content-strip": {
    label: "A · Content-aligned strip",
    tagline: "Same width, radius, and surface as the page below",
    rationale:
      "Drop the floating pill. The universal search becomes a full-width control inside the page canvas — same max-width as tables and cards, rounded-lg corners, inset border shadow, and left alignment with the page title.",
    tradeoffs: ["Still a distinct row below the app header", "Needs a clear rule for pages that already have inline search"],
    bestFor: ["Document search command centre", "Referral / results pages", "Any data-heavy table view"],
  },
  "toolbar-inline": {
    label: "B · Toolbar inline",
    tagline: "Search lives in the filter / action row",
    rationale:
      "Merge search into the row that already holds filters, tabs, and view toggles. The field uses the same height and chip styling as neighbouring controls — no separate floating layer.",
    tradeoffs: ["Less prominent on home / empty states", "Toolbar can feel crowded on narrow screens"],
    bestFor: ["Favourites library", "Search command centre with filter pills", "Pages with existing filter bars"],
  },
  "header-embedded": {
    label: "C · Header embedded",
    tagline: "Compact search inside the app chrome",
    rationale:
      "Move universal search into the top header bar beside the mode pill and icon controls. One chrome layer, flat surface, rounded-lg field that expands on focus — matches universal-header-icon-control styling.",
    tradeoffs: ["Less typing room until expanded", "Header height must stay stable on mobile"],
    bestFor: ["Cross-page consistency", "Results hub with tab nav", "When vertical space is scarce"],
  },
};

type SearchProps = {
  query?: string;
  placeholder?: string;
  compact?: boolean;
};

function CurrentFloatingSearch({ query = "lithium", placeholder = "Search" }: SearchProps) {
  return (
    <form
      aria-label="Current universal search (floating pill)"
      className="mx-auto grid w-full max-w-2xl min-h-[3.8rem] grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-2 shadow-[0_1px_2px_rgb(16_24_40_/_4%),0_6px_16px_rgb(16_24_40_/_7%),0_20px_48px_rgb(16_24_40_/_12%)]"
    >
      <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-[color:var(--text-muted)]" aria-label="Actions">
        <Plus className="h-4 w-4" />
      </button>
      <span className="truncate px-1 text-base font-semibold text-[color:var(--text)]">{query || placeholder}</span>
      {query ? (
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)]" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-9" />
      )}
      <button
        type="submit"
        className="grid h-11 w-11 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

function ContentStripSearch({ query = "lithium", placeholder = "Search documents, forms, tasks…" }: SearchProps) {
  return (
    <form
      aria-label="Content-aligned strip search"
      className="grid w-full min-h-11 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-inset)] focus-within:border-[color:var(--clinical-accent)]"
    >
      <button
        type="button"
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
          focusRing,
        )}
        aria-label="Search actions"
      >
        <Plus className="h-4 w-4" />
      </button>
      <input
        readOnly
        value={query}
        placeholder={placeholder}
        aria-label="Search"
        className="min-w-0 bg-transparent text-sm font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
      />
      {query ? (
        <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]" aria-label="Clear">
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="submit"
        className={cn(
          "inline-flex h-9 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent-contrast)]",
          focusRing,
        )}
      >
        Search
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function ToolbarInlineSearch({ query = "lithium", compact }: SearchProps) {
  return (
    <form
      aria-label="Toolbar inline search"
      className={cn(
        "inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 shadow-[var(--shadow-inset)] focus-within:border-[color:var(--clinical-accent)]",
        compact ? "min-w-[12rem] flex-1" : "min-w-[16rem] flex-[1.4]",
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
      <input
        readOnly
        value={query}
        placeholder="Search"
        aria-label="Search"
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
      />
      {query ? (
        <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-[color:var(--text-muted)]" aria-label="Clear">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </form>
  );
}

function HeaderEmbeddedSearch({ query = "lithium", compact }: SearchProps) {
  return (
    <form
      aria-label="Header embedded search"
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 shadow-none transition-[width] focus-within:border-[color:var(--border-strong)] focus-within:bg-[color:var(--surface-subtle)]",
        compact ? "w-[10.5rem]" : "w-[17rem]",
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
      <input
        readOnly
        value={query}
        placeholder="Search"
        aria-label="Search"
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]"
      />
      <button
        type="submit"
        className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
        aria-label="Run search"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

function SearchForVariant({ variant, ...props }: SearchProps & { variant: UniversalSearchRedesignVariant | "current" }) {
  if (variant === "current") return <CurrentFloatingSearch {...props} />;
  if (variant === "content-strip") return <ContentStripSearch {...props} />;
  if (variant === "toolbar-inline") return <ToolbarInlineSearch {...props} />;
  return <HeaderEmbeddedSearch {...props} />;
}

function FilterChip({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-bold",
        active
          ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
          : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
      )}
    >
      {children}
      {!active ? <ChevronDown className="h-3.5 w-3.5 opacity-70" /> : null}
    </span>
  );
}

function MiniTableRow({ title, meta, relevance }: { title: string; meta: string; relevance: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3 py-3 last:border-b-0">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">{title}</span>
        <span className="block truncate text-xs font-medium text-[color:var(--text-muted)]">{meta}</span>
      </span>
      <span className="text-xs font-extrabold text-[color:var(--clinical-accent)]">{relevance}</span>
    </div>
  );
}

function PagePreview({
  variant,
  page,
}: {
  variant: UniversalSearchRedesignVariant | "current";
  page: "documents" | "favourites" | "results";
}) {
  const showFloatingCurrent = variant === "current";
  const showContentStrip = variant === "content-strip";
  const showToolbarInline = variant === "toolbar-inline";
  const showHeaderEmbedded = variant === "header-embedded";

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]">
      {/* App header chrome */}
      <div className="flex min-h-12 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-black text-[color:var(--clinical-accent-contrast)]">
            R
          </span>
          <span className="text-xs font-bold text-[color:var(--text-muted)]">Documents</span>
        </div>
        {showHeaderEmbedded ? (
          <div className="flex items-center gap-2">
            <HeaderEmbeddedSearch compact={page === "results"} />
            <span className="hidden h-9 w-9 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] sm:grid sm:place-items-center">
              <FolderOpen className="h-4 w-4 text-[color:var(--text-muted)]" />
            </span>
          </div>
        ) : (
          <span className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-bold text-[color:var(--text-muted)]">
            Mode · Documents
          </span>
        )}
      </div>

      {/* Current design: floating search band */}
      {showFloatingCurrent ? (
        <div className="border-b border-[color:var(--border)]/60 bg-[color:var(--background)] px-4 py-5">
          <CurrentFloatingSearch query={page === "favourites" ? "" : "lithium"} placeholder={page === "favourites" ? "Search commands" : "Search"} />
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-5">
        {/* Content strip: search above title, full width */}
        {showContentStrip ? (
          <div className="mb-4">
            <ContentStripSearch
              query={page === "favourites" ? "" : "lithium"}
              placeholder={page === "favourites" ? "Search favourites, sets, source notes" : "Search documents, forms, tasks…"}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-[color:var(--text-heading)]">
              {page === "documents" ? "Search command centre" : page === "favourites" ? "Favourites command library" : "Results"}
            </h2>
            {page === "favourites" ? (
              <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">Saved commands and quick actions for ward rounds.</p>
            ) : null}
          </div>
          {page !== "results" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--clinical-accent-border)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)]">
                + Create search
              </button>
              <button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-[color:var(--border)] px-3 text-xs font-extrabold text-[color:var(--text-muted)]">
                Export
              </button>
            </div>
          ) : null}
        </div>

        {/* Toolbar inline: search in filter row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {showToolbarInline ? (
            <ToolbarInlineSearch query={page === "favourites" ? "" : "lithium"} compact={page === "results"} />
          ) : null}
          {page === "documents" ? (
            <>
              <FilterChip active>Sources</FilterChip>
              <FilterChip>Tasks</FilterChip>
              <FilterChip>Quotes</FilterChip>
              <FilterChip>Images</FilterChip>
              <span className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 text-xs font-bold text-[color:var(--text-muted)]">
                <Table2 className="h-3.5 w-3.5" /> Table
              </span>
            </>
          ) : null}
          {page === "favourites" ? (
            <>
              <FilterChip active>All items</FilterChip>
              <FilterChip>Sets</FilterChip>
              <FilterChip>Recent</FilterChip>
              <span className="ml-auto inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[color:var(--clinical-accent)]">
                Share · Run
              </span>
            </>
          ) : null}
          {page === "results" ? (
            <>
              <span className="inline-flex min-h-9 items-center border-b-2 border-[color:var(--clinical-accent)] px-2 text-xs font-extrabold text-[color:var(--clinical-accent)]">
                Results
              </span>
              <span className="inline-flex min-h-9 items-center px-2 text-xs font-bold text-[color:var(--text-muted)]">Forms</span>
              <span className="inline-flex min-h-9 items-center px-2 text-xs font-bold text-[color:var(--text-muted)]">Documents</span>
              <span className="inline-flex min-h-9 items-center px-2 text-xs font-bold text-[color:var(--text-muted)]">Tasks</span>
            </>
          ) : null}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
          {page === "documents" ? (
            <>
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">
                <span>Document</span>
                <span className="hidden sm:block">Excerpt</span>
                <span>Status</span>
                <span>Relevance</span>
              </div>
              <MiniTableRow title="Clozapine prescribing and monitoring guidelines" meta="Current · p.12" relevance="88%" />
              <MiniTableRow title="Lithium monitoring quick reference" meta="Review due · p.4" relevance="76%" />
            </>
          ) : null}
          {page === "favourites" ? (
            <>
              <div className="flex items-center justify-between border-b border-[color:var(--border)] px-3 py-2">
                <span className="text-xs font-extrabold text-[color:var(--text-heading)]">Library table</span>
                <span className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 text-3xs font-bold text-[color:var(--text-muted)]">
                  <Filter className="h-3 w-3" /> Filter
                </span>
              </div>
              <MiniTableRow title="Ward round checklist" meta="Command · Ready" relevance="Open" />
              <MiniTableRow title="Medication review prompts" meta="Set · 6 items" relevance="Open" />
            </>
          ) : null}
          {page === "results" ? (
            <div className="divide-y divide-[color:var(--border)] p-2">
              {[
                { title: "Forms and Guides", meta: "Top match · 3 items", icon: FileText },
                { title: "Monitoring schedules", meta: "Related · 2 items", icon: Heart },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">{item.title}</span>
                    <span className="block text-xs font-medium text-[color:var(--text-muted)]">{item.meta}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[color:var(--clinical-accent)]">
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const pageLabels = {
  documents: "Document search",
  favourites: "Favourites library",
  results: "Results hub",
} as const;

export function UniversalSearchRedesignMockupsPage() {
  const [variant, setVariant] = useState<UniversalSearchRedesignVariant>("content-strip");
  const [page, setPage] = useState<keyof typeof pageLabels>("documents");
  const [compareCurrent, setCompareCurrent] = useState(true);

  const meta = variantMeta[variant];

  return (
    <div className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">Universal search redesign</p>
          <h1 className="mt-2 text-balance text-3xl font-extrabold text-[color:var(--text-heading)] sm:text-4xl">
            Three directions that blend with search pages
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            The current top pill floats above every page with heavy shadow and a different radius than cards, filters, and inline search fields.
            These mockups keep the same behaviour but restyle placement and chrome to match each page type.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(variantMeta) as UniversalSearchRedesignVariant[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setVariant(key)}
              className={cn(
                "inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-extrabold transition",
                focusRing,
                variant === key
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              {variantMeta[key].label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(pageLabels) as Array<keyof typeof pageLabels>).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPage(key)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md px-3 text-xs font-bold transition",
                  focusRing,
                  page === key
                    ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                )}
              >
                {pageLabels[key]}
              </button>
            ))}
          </div>
          <label className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-muted)]">
            <input
              type="checkbox"
              checked={compareCurrent}
              onChange={(event) => setCompareCurrent(event.target.checked)}
              className="h-4 w-4 accent-[color:var(--clinical-accent)]"
            />
            Compare with current floating pill
          </label>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className={cn("grid gap-6", compareCurrent ? "xl:grid-cols-2" : "")}>
            {compareCurrent ? (
              <div>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">Current</p>
                <PagePreview variant="current" page={page} />
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">{meta.label}</p>
              <PagePreview variant={variant} page={page} />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
              <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">{meta.tagline}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{meta.rationale}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">Best for</h3>
              <ul className="mt-2 space-y-1.5 text-sm font-medium text-[color:var(--text)]">
                {meta.bestFor.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-[color:var(--clinical-accent)]">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">Trade-offs</h3>
              <ul className="mt-2 space-y-1.5 text-sm font-medium text-[color:var(--text-muted)]">
                {meta.tradeoffs.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span>–</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--text-muted)]">Isolated control</h3>
              <div className="mt-3 space-y-3">
                <SearchForVariant variant="current" query="lithium" />
                <SearchForVariant variant={variant} query="lithium" />
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-5">
          <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Shared design rules (all directions)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Radius", body: "Use rounded-lg for the search field — same as cards, buttons, and inline filters. Retire the full pill on search pages." },
              { title: "Elevation", body: "Replace layered drop shadows with border + shadow-inset. Reserve elevation for menus and sheets only." },
              { title: "Submit affordance", body: "Prefer a labelled Search button or soft accent icon — not a heavy floating circle that duplicates the magnifier." },
              { title: "Width", body: "Match the content max-width or toolbar row. Avoid a narrow centred capsule when the page below is full-bleed." },
            ].map((rule) => (
              <article key={rule.title} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
                <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">{rule.title}</h3>
                <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">{rule.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
