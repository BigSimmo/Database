"use client";

import Link from "next/link";
import { ArrowUpDown, ChevronDown, Filter, Folder, Heart, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { ModeHomeHero, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import {
  cn,
  floatingControl,
  glassOverlaySurface,
  iconTilePremium,
  panelSubtle,
  primaryControl,
} from "@/components/ui-primitives";
import { useSavedRegistryFavourites } from "@/components/clinical-dashboard/use-saved-registry-favourites";
import {
  favouriteItems,
  favouriteSets,
  favouriteTabs,
  type FavouriteItem,
  type FavouriteSet,
  type FavouriteTabId,
} from "@/components/clinical-dashboard/favourites-prototype-data";

function favouriteMatchesQuery(value: { title: string; meta?: string; set?: string; keywords: string }, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [value.title, value.meta, value.set, value.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function FavouritesHub({
  query,
  onClearQuery,
  desktopComposerSlotId,
  demoMode,
  headingLevel = 2,
}: {
  query: string;
  onClearQuery: () => void;
  desktopComposerSlotId?: string;
  demoMode: boolean;
  headingLevel?: 1 | 2;
}) {
  const savedRegistryFavourites = useSavedRegistryFavourites();
  const allFavouriteItems = useMemo(
    () => [...(demoMode ? favouriteItems : []), ...savedRegistryFavourites],
    [demoMode, savedRegistryFavourites],
  );
  const allFavouriteSets = useMemo(() => {
    const prototypeSets = demoMode ? favouriteSets : [];
    const savedSetTitles = new Set(prototypeSets.map((set) => set.title));
    const dynamicSets: FavouriteSet[] = Array.from(new Set(savedRegistryFavourites.map((item) => item.set)))
      .filter((title): title is string => Boolean(title) && !savedSetTitles.has(title))
      .map((title) => ({
        id: title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        title,
        count: savedRegistryFavourites.filter((item) => item.set === title).length,
        meta: "Saved from site activity",
        keywords: title.toLowerCase(),
      }));
    return [
      ...prototypeSets.map((set) => ({
        ...set,
        count: allFavouriteItems.filter((item) => item.set === set.title).length,
      })),
      ...dynamicSets,
    ].filter((set) => set.count > 0);
  }, [allFavouriteItems, demoMode, savedRegistryFavourites]);
  const [selectedTab, setSelectedTab] = useState<FavouriteTabId>("all");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRef = useRef<HTMLButtonElement | null>(null);
  const tabOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const normalizedQuery = query.trim();
  const selectedSet = selectedSetId ? allFavouriteSets.find((set) => set.id === selectedSetId) : null;
  const getTypeCount = (type: FavouriteTabId) => {
    if (type === "all") return allFavouriteItems.length + allFavouriteSets.length;
    if (type === "sets") return allFavouriteSets.length;
    return allFavouriteItems.filter((item) => item.type === type).length;
  };
  const tabItems =
    selectedTab === "all" || selectedTab === "sets"
      ? allFavouriteItems
      : allFavouriteItems.filter((item) => item.type === selectedTab);
  const visibleItems = tabItems
    .filter((item) => favouriteMatchesQuery(item, normalizedQuery))
    .filter((item) => !selectedSet || item.set === selectedSet.title);
  const visibleSets = allFavouriteSets.filter((set) => favouriteMatchesQuery(set, normalizedQuery));
  const showSets = selectedTab === "all" || selectedTab === "sets";
  const showItems = selectedTab !== "sets";
  const empty = (!showItems || visibleItems.length === 0) && (!showSets || visibleSets.length === 0);
  const selectedTabMeta = favouriteTabs.find((tab) => tab.id === selectedTab) ?? favouriteTabs[0];
  const selectedTabLabel = selectedTabMeta.label;
  const selectedTabCount = getTypeCount(selectedTab);
  const SelectedTabIcon = selectedTabMeta.icon;
  const itemCount = allFavouriteItems.length;
  const setCount = allFavouriteSets.length;
  const activeFilterCount = (normalizedQuery ? 1 : 0) + (selectedSet ? 1 : 0);
  const selectedTabIndex = Math.max(
    0,
    favouriteTabs.findIndex((tab) => tab.id === selectedTab),
  );

  function focusFavouriteTabOption(index: number) {
    const nextIndex = (index + favouriteTabs.length) % favouriteTabs.length;
    tabOptionRefs.current[nextIndex]?.focus();
  }

  function openFavouriteTabMenu(focusIndex: number) {
    setTabMenuOpen(true);
    window.requestAnimationFrame(() => focusFavouriteTabOption(focusIndex));
  }

  function handleFavouriteTabTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openFavouriteTabMenu(selectedTabIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openFavouriteTabMenu(selectedTabIndex - 1);
    }
  }

  function handleFavouriteTabOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusFavouriteTabOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusFavouriteTabOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusFavouriteTabOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusFavouriteTabOption(favouriteTabs.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setTabMenuOpen(false);
      window.requestAnimationFrame(() => tabButtonRef.current?.focus());
    }
  }

  useDismissableLayer({
    enabled: tabMenuOpen,
    refs: [tabMenuRef],
    restoreFocusRef: tabButtonRef,
    onDismiss: () => setTabMenuOpen(false),
  });

  return (
    <div data-testid="favourites-hub" className="mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden sm:space-y-5">
      <div className="mx-auto grid w-full max-w-5xl justify-items-center gap-3 pt-3 text-center sm:gap-4 sm:pt-5">
        <ModeHomeHero
          testId="favourites-home"
          title="Favourites"
          subtitle="Saved notes, sources, and sets."
          icon={Heart}
          headingLevel={headingLevel}
        />

        {desktopComposerSlotId ? (
          <div id={desktopComposerSlotId} className="mode-home-composer-slot hidden w-full [&:not(:empty)]:block" />
        ) : null}

        <div className="grid w-full max-w-md grid-cols-3 gap-2 text-left">
          {[
            { label: "Items", value: itemCount, icon: Heart },
            { label: "Sets", value: setCount, icon: Folder },
            { label: "Filters", value: activeFilterCount, icon: Filter },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3 py-2 shadow-[var(--shadow-inset)]"
              >
                <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  <Icon className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
                  <span className="truncate">{stat.label}</span>
                </div>
                <p className="nums mt-1 text-lg font-bold leading-none text-[color:var(--text-heading)]">
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-2 px-0.5 text-2xs font-semibold text-[color:var(--text-muted)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div ref={tabMenuRef} className="relative min-w-0">
            <button
              ref={tabButtonRef}
              type="button"
              onClick={() => setTabMenuOpen((open) => !open)}
              onKeyDown={handleFavouriteTabTriggerKeyDown}
              className="grid min-h-tap w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2.5 text-left shadow-[var(--shadow-tight)] transition hover:border-[color:var(--clinical-accent)]/30 hover:bg-[color:var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-56"
              aria-haspopup="listbox"
              aria-expanded={tabMenuOpen}
              aria-controls={tabMenuOpen ? "favourites-type-listbox" : undefined}
              aria-label="Choose favourite type"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <SelectedTabIcon className="h-3.5 w-3.5" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="text-2xs font-bold uppercase leading-none tracking-[0.08em] text-[color:var(--text-muted)]">
                  View
                </span>
                <span className="truncate text-xs font-bold leading-none text-[color:var(--text-heading)]">
                  {selectedTabLabel} · {selectedTabCount}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 text-[color:var(--text-soft)] transition-transform motion-reduce:transition-none",
                  tabMenuOpen && "rotate-180",
                )}
              />
            </button>

            {tabMenuOpen ? (
              <div
                id="favourites-type-listbox"
                role="listbox"
                aria-label="Favourite type"
                className={cn(
                  glassOverlaySurface,
                  "absolute left-0 top-[calc(100%+0.5rem)] z-40 grid w-[min(18rem,calc(100vw-1.5rem))] gap-2 overflow-hidden rounded-xl bg-[color:var(--surface-lux)] p-1.5 shadow-[var(--shadow-lux)]",
                )}
              >
                {favouriteTabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const selected = selectedTab === tab.id;
                  const count = getTypeCount(tab.id);
                  return (
                    <button
                      key={tab.id}
                      ref={(element) => {
                        tabOptionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onKeyDown={(event) => handleFavouriteTabOptionKeyDown(event, index)}
                      onClick={() => {
                        setSelectedTab(tab.id);
                        setTabMenuOpen(false);
                        window.requestAnimationFrame(() => tabButtonRef.current?.focus());
                      }}
                      className={cn(
                        "grid min-h-tap grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                        selected
                          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-md",
                          selected ? "bg-[color:var(--surface)]" : "bg-transparent",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-bold">{tab.label}</span>
                      <span
                        className={cn(
                          "nums rounded-full px-2 py-0.5 text-2xs font-bold",
                          selected
                            ? "bg-[color:var(--surface)] text-[color:var(--clinical-accent)]"
                            : "bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          {normalizedQuery ? (
            <button
              type="button"
              onClick={onClearQuery}
              className="inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 hover:bg-[color:var(--surface-subtle)]"
            >
              <span className="truncate">Filter: {normalizedQuery}</span>
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {selectedSet ? (
            <button
              type="button"
              onClick={() => setSelectedSetId(null)}
              className="inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-md border border-[color:var(--clinical-accent)]/20 bg-[color:var(--clinical-accent-soft)] px-2 font-bold text-[color:var(--clinical-accent)] hover:border-[color:var(--clinical-accent)]/35"
            >
              <span className="truncate">Set: {selectedSet.title}</span>
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            disabled
            aria-describedby="favourites-sort-unavailable"
            className={cn(
              floatingControl,
              "min-h-tap cursor-not-allowed px-3 text-xs opacity-60 hover:border-[color:var(--border-lux)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-inset)] sm:min-h-9 sm:px-2.5",
            )}
          >
            <ArrowUpDown aria-hidden="true" className="h-4 w-4" />
            Recent
          </button>
          <span id="favourites-sort-unavailable" className="sr-only">
            Additional sort options are coming soon.
          </span>
          <button
            type="button"
            disabled
            aria-describedby="favourites-add-unavailable"
            className={cn(
              primaryControl,
              "min-h-tap cursor-not-allowed justify-center px-3 text-xs opacity-60 hover:bg-[color:var(--command)] hover:shadow-[var(--shadow-tight)] active:translate-y-0 sm:min-h-9 sm:px-2.5",
            )}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Add favourite</span>
            <span className="sm:hidden">Add</span>
          </button>
          <span id="favourites-add-unavailable" className="sr-only">
            Adding favourites from this screen is coming soon.
          </span>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <p className="text-sm font-bold text-[color:var(--text-heading)]">Saved sets</p>
          <button
            type="button"
            onClick={() => setSelectedTab("sets")}
            className="text-xs font-bold text-[color:var(--clinical-accent)]"
          >
            View all
          </button>
        </div>
        <div className="grid gap-2">
          {visibleSets.slice(0, 3).map((set) => (
            <FavouriteSetRow
              key={set.id}
              favouriteSet={set}
              compact
              selected={selectedSetId === set.id}
              onSelect={() => {
                setSelectedSetId(set.id);
                if (selectedTab === "sets") setSelectedTab("all");
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className={cn(panelSubtle, "min-w-0 overflow-hidden p-4 sm:p-5")}>
          <div className="mb-3 flex min-h-10 items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3">
            <div>
              <p className="text-base font-bold text-[color:var(--text-heading)]">
                {selectedTab === "all"
                  ? "Recent favourites"
                  : selectedTab === "sets"
                    ? "Saved sets"
                    : `${selectedTabLabel} favourites`}
              </p>
              <p className="text-xs font-medium text-[color:var(--text-soft)]">
                {selectedTab === "sets" ? "Open a focused clinical set." : "Open, ask, copy, or organise saved items."}
              </p>
            </div>
            <span className="nums shrink-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-bold text-[color:var(--text-muted)]">
              {selectedTab === "sets" ? visibleSets.length : visibleItems.length}
            </span>
          </div>

          <div className="grid gap-1.5">
            {showSets && selectedTab === "sets"
              ? visibleSets.map((set) => (
                  <FavouriteSetRow
                    key={set.id}
                    favouriteSet={set}
                    selected={selectedSetId === set.id}
                    onSelect={() => {
                      setSelectedSetId(set.id);
                      setSelectedTab("all");
                    }}
                  />
                ))
              : null}

            {showItems
              ? visibleItems.map((item) => (
                  <FavouriteItemRow key={item.id} item={item} onBrowseSets={() => setSelectedTab("sets")} />
                ))
              : null}

            {empty ? (
              <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-5 text-center">
                <div>
                  <Search aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-[color:var(--text-soft)]" />
                  <p className="font-semibold text-[color:var(--text-heading)]">No favourites match</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                    Clear the composer text or choose another tab.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="hidden min-w-0 gap-4 lg:grid">
          <section className={cn(panelSubtle, "p-4")}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-[color:var(--border)] pb-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-[color:var(--text-heading)]">Saved sets</p>
                <p className="mt-0.5 text-xs font-medium text-[color:var(--text-soft)]">
                  Filter favourites by workflow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTab("sets")}
                className="shrink-0 text-xs font-bold text-[color:var(--clinical-accent)] hover:underline"
              >
                View all
              </button>
            </div>
            <div className="grid gap-1.5">
              {visibleSets.slice(0, 3).map((set) => (
                <FavouriteSetRow
                  key={set.id}
                  favouriteSet={set}
                  compact
                  selected={selectedSetId === set.id}
                  onSelect={() => {
                    setSelectedSetId(set.id);
                    if (selectedTab === "sets") setSelectedTab("all");
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              disabled
              aria-describedby="favourites-new-set-unavailable"
              className={cn(
                floatingControl,
                "mt-3 min-h-9 w-full cursor-not-allowed px-3 text-xs opacity-60 hover:border-[color:var(--border-lux)] hover:bg-[color:var(--surface-raised)] hover:shadow-[var(--shadow-inset)]",
              )}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              New set
            </button>
            <span id="favourites-new-set-unavailable" className="sr-only">
              Creating favourite sets is coming soon.
            </span>
          </section>
        </aside>
      </div>

      <ModeHomeVerificationFooter icon={ShieldCheck} label="Saved clinical work" body="Local library" />
    </div>
  );
}

function FavouriteItemRow({ item, onBrowseSets }: { item: FavouriteItem; onBrowseSets: () => void }) {
  const Icon = item.icon;
  return (
    <article className="grid min-h-[4.25rem] grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] py-2.5 last:border-b-0">
      <span className={iconTilePremium}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-bold text-[color:var(--text-heading)]">{item.title}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-[color:var(--text-muted)]">{item.meta}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-[color:var(--text-soft)]">{item.set}</span>
          <span className="nums rounded-md bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-2xs font-bold text-[color:var(--text-muted)]">
            {item.sourceMeta}
          </span>
        </div>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <Link href={item.href} className={cn(floatingControl, "min-h-9 px-2.5 text-xs")}>
          {item.primaryAction}
        </Link>
        <button type="button" onClick={onBrowseSets} className={cn(floatingControl, "min-h-9 px-2.5 text-xs")}>
          <Folder aria-hidden="true" className="h-3.5 w-3.5" />
          Browse sets
        </button>
      </div>
      <Link
        href={item.href}
        className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] sm:hidden"
        aria-label={`Open ${item.title}`}
      >
        <ChevronDown aria-hidden="true" className="-rotate-90 h-4 w-4" />
      </Link>
    </article>
  );
}

function FavouriteSetRow({
  favouriteSet,
  compact = false,
  selected = false,
  onSelect,
}: {
  favouriteSet: FavouriteSet;
  compact?: boolean;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        compact ? "min-h-[3.75rem]" : "min-h-[4.25rem]",
        selected && "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
      )}
    >
      <span className={iconTilePremium}>
        <Folder aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-bold",
            selected ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-heading)]",
          )}
        >
          {favouriteSet.title}
        </span>
        <span
          className={cn(
            "block truncate text-sm font-medium",
            selected ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
          )}
        >
          {favouriteSet.count} {favouriteSet.count === 1 ? "item" : "items"}
          {compact ? "" : ` · ${favouriteSet.meta}`}
        </span>
      </span>
      <ChevronDown aria-hidden="true" className="-rotate-90 h-4 w-4 text-[color:var(--text-soft)]" />
    </button>
  );
}
