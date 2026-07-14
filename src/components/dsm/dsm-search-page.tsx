"use client";

import Link from "next/link";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  GitCompareArrows,
  ListFilter,
  SearchX,
  X,
} from "lucide-react";

import { DsmPageHeader } from "@/components/dsm/dsm-page-header";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { cn, codeText, metadataPill, pageContainer, searchFocusRing } from "@/components/ui-primitives";
import type { DsmCategory, DsmDiagnosisSummary } from "@/lib/dsm";

function categoryHref(query: string, category?: string, ids: string[] = []) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (ids.length) params.set("ids", ids.join(","));
  const suffix = params.toString();
  return suffix ? `/dsm/search?${suffix}` : "/dsm/search";
}

function compareHref(slugs: string[]) {
  const params = new URLSearchParams({ ids: slugs.join(",") });
  return `/dsm/compare?${params.toString()}`;
}

// Compact category filter: a single trigger that opens an anchored menu of
// category links, replacing the multi-row pill wall so results sit higher on the
// page. Each option is a real navigation link (server-driven filtering), styled as
// a menuitemradio so the active category reads as the checked option.
function CategoryFilterDropdown({
  query,
  categories,
  activeCategory,
  totalCount,
  selected,
}: {
  query: string;
  categories: DsmCategory[];
  activeCategory?: DsmCategory;
  totalCount: number;
  selected: string[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const menuId = useId();

  const options = useMemo(
    () => [
      { key: undefined as string | undefined, label: "All categories", count: totalCount },
      ...categories.map((item) => ({ key: item.key, label: item.label, count: item.diagnosis_count })),
    ],
    [categories, totalCount],
  );
  const activeIndex = activeCategory ? options.findIndex((option) => option.key === activeCategory.key) : 0;

  useDismissableLayer({
    enabled: open,
    refs: [rootRef],
    restoreFocusRef: triggerRef,
    onDismiss: () => setOpen(false),
  });

  function focusOption(index: number) {
    const total = options.length;
    const next = ((index % total) + total) % total;
    optionRefs.current[next]?.focus();
  }

  // Single source of truth for initial focus: whoever opens the menu picks the
  // option to land on and schedules the one focus call. A parallel open-effect
  // that also focused the active item would race this and clobber ArrowUp's
  // reverse-entry onto the last option.
  function openMenu(focusIndex: number) {
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(focusIndex));
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(Math.max(0, activeIndex));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  }

  function handleOptionKeyDown(event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  // Close when focus leaves the widget entirely (e.g. Tab off the last option),
  // so the menu never lingers open over the results. Keep it open while focus
  // moves between the trigger and its options, and don't prevent the focus move.
  function handleRootBlur(event: ReactFocusEvent<HTMLDivElement>) {
    if (!open) return;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && rootRef.current?.contains(nextTarget)) return;
    setOpen(false);
  }

  const activeLabel = activeCategory ? activeCategory.label : "All categories";
  const activeCount = activeCategory ? activeCategory.diagnosis_count : totalCount;

  return (
    <div ref={rootRef} onBlur={handleRootBlur} className="relative w-full sm:w-auto">
      <button
        type="button"
        ref={triggerRef}
        data-testid="dsm-category-filter"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => (open ? setOpen(false) : openMenu(Math.max(0, activeIndex)))}
        className={cn(
          "inline-flex min-h-tap w-full items-center gap-2 rounded-lg border px-3 text-xs font-bold transition sm:w-auto sm:min-w-[15rem]",
          searchFocusRing,
          open || activeCategory
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]",
        )}
      >
        <ListFilter className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
        <span className="shrink-0 text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
          Category
        </span>
        <span className="min-w-0 flex-1 truncate text-left font-extrabold text-[color:var(--text-heading)]">
          {activeLabel}
        </span>
        <span className="shrink-0 rounded-md bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs font-bold tabular-nums text-[color:var(--text-muted)]">
          {activeCount}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Filter by category"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-40 max-h-[min(22rem,60vh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-1.5 shadow-[var(--shadow-elevated)]"
        >
          {options.map((option, index) => {
            const isActive = index === activeIndex;
            return (
              <Link
                key={option.key ?? "all"}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                href={categoryHref(query, option.key, selected)}
                role="menuitemradio"
                aria-checked={isActive}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-xs font-bold transition",
                  searchFocusRing,
                  isActive
                    ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                )}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center text-[color:var(--clinical-accent)]">
                  {isActive ? <Check className="h-4 w-4" aria-hidden /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="shrink-0 rounded-md bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs font-bold tabular-nums text-[color:var(--text-soft)]">
                  {option.count}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function DsmSearchPage({
  query,
  category,
  categories,
  results,
  totalCount,
  initialIds = [],
}: {
  query: string;
  category?: string;
  categories: DsmCategory[];
  results: DsmDiagnosisSummary[];
  totalCount: number;
  initialIds?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialIds.slice(0, 3));
  const activeCategory = categories.find((item) => item.key === category);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const canCompare = selected.length >= 2;

  function toggleDiagnosis(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= 3) return [...current.slice(1), slug];
      return [...current, slug];
    });
  }

  const description = query
    ? `${results.length} ${results.length === 1 ? "match" : "matches"} for “${query}”${
        activeCategory ? ` in ${activeCategory.label}` : ""
      }.`
    : `${results.length} of ${totalCount} diagnoses${activeCategory ? ` in ${activeCategory.label}` : ""}.`;

  return (
    <div data-testid="dsm-search-page" className="min-h-full bg-[color:var(--background)]">
      <DsmPageHeader
        eyebrow="Diagnosis catalogue"
        title={query ? `Search results for “${query}”` : "Search diagnoses"}
        description={description}
        actions={
          canCompare ? (
            <Link
              href={compareHref(selected)}
              data-testid="dsm-search-compare"
              className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-xs font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]"
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden />
              Compare {selected.length}
            </Link>
          ) : null
        }
      />

      <div className={cn(pageContainer, "space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8")}>
        <section aria-label="Filter by category" className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <CategoryFilterDropdown
            query={query}
            categories={categories}
            activeCategory={activeCategory}
            totalCount={totalCount}
            selected={selected}
          />
          {activeCategory ? (
            <Link
              href={categoryHref(query, undefined, selected)}
              className={cn(
                "inline-flex min-h-tap items-center gap-1 rounded-lg px-2 text-xs font-bold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
                searchFocusRing,
              )}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filter
            </Link>
          ) : null}
        </section>

        {results.length ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <section
              aria-label="DSM diagnosis results"
              className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)] sm:text-lg">
                  {query ? "Matching diagnoses" : "Diagnosis catalogue"}
                </h2>
                <span className="shrink-0 text-xs font-bold tabular-nums text-[color:var(--text-muted)]">
                  {results.length} {results.length === 1 ? "result" : "results"}
                </span>
              </div>
              <div className="hidden grid-cols-[2.5rem_minmax(14rem,1fr)_10rem_7rem_1.25rem] gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-2.5 text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)] lg:grid">
                <span>Select</span>
                <span>Diagnosis</span>
                <span>Category</span>
                <span>ICD-10</span>
                <span />
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {results.map((result) => {
                  const isSelected = selectedSet.has(result.slug);
                  return (
                    <article
                      key={result.slug}
                      data-testid="dsm-search-result"
                      className={cn(
                        "group grid grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-start gap-3 px-3 py-3.5 transition sm:px-4 lg:grid-cols-[2.5rem_minmax(14rem,1fr)_10rem_7rem_1.25rem] lg:items-center",
                        isSelected
                          ? "bg-[color:var(--clinical-accent-soft)]/55"
                          : "hover:bg-[color:var(--surface-subtle)]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDiagnosis(result.slug)}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? "Remove" : "Add"} ${result.title} ${
                          isSelected ? "from" : "to"
                        } comparison`}
                        className={cn(
                          "grid h-tap w-tap place-items-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                          isSelected
                            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                            : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-soft)] hover:border-[color:var(--clinical-accent)]",
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : (
                          <GitCompareArrows className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                      <Link href={`/dsm/diagnoses/${result.slug}`} className="min-w-0 focus-visible:outline-none">
                        <h2 className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)] sm:text-base-minus">
                          {result.title}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                          {result.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
                          <span className={metadataPill}>{result.category.label}</span>
                          <span className={cn(metadataPill, codeText)}>{result.icd_code}</span>
                        </div>
                      </Link>
                      <span className="hidden text-xs font-semibold leading-5 text-[color:var(--text-muted)] lg:block">
                        {result.category.label}
                      </span>
                      <span
                        className={cn("hidden text-xs font-bold text-[color:var(--text-heading)] lg:block", codeText)}
                      >
                        {result.icd_code}
                      </span>
                      <Link
                        href={`/dsm/diagnoses/${result.slug}`}
                        aria-label={`Open ${result.title}`}
                        className="grid h-tap w-tap -translate-y-0.5 place-items-center rounded-lg text-[color:var(--text-soft)] transition group-hover:text-[color:var(--clinical-accent)] lg:translate-y-0"
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="grid gap-3 lg:sticky lg:top-20" aria-label="Comparison selection">
              <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
                  <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Compare diagnoses</h2>
                </div>
                <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  Select two or three records. Selecting a fourth replaces the earliest selection.
                </p>
                {selected.length ? (
                  <ol className="mt-3 grid gap-2">
                    {selected.map((slug, index) => {
                      const item = results.find((result) => result.slug === slug);
                      return (
                        <li
                          key={slug}
                          className="flex items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-2.5 py-2 text-xs font-bold text-[color:var(--text-heading)]"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-2xs text-[color:var(--clinical-accent)]">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate">{item?.title ?? slug}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-[color:var(--border-strong)] px-3 py-2.5 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    Choose diagnoses from the result list.
                  </p>
                )}
                {canCompare ? (
                  <Link
                    href={compareHref(selected)}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]"
                  >
                    Compare selected
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </section>
              <p className="flex items-start gap-2 px-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                Reference content only. Confirm criteria, exclusions, and clinical context before use.
              </p>
            </aside>
          </div>
        ) : (
          <section className="grid justify-items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-12 text-center shadow-[var(--shadow-inset)]">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]">
              <SearchX className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">No diagnosis matches</h2>
              <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">
                Try a diagnosis name, ICD code, symptom phrase, or a broader category.
              </p>
            </div>
            <Link
              href="/dsm/search"
              className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
            >
              Browse all diagnoses
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
