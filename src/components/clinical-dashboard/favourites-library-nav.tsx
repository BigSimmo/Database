"use client";

import {
  Folder,
  Heart,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { favouriteTabs } from "@/components/clinical-dashboard/favourites-prototype-data";
import { cn } from "@/components/ui-primitives";

export type FavouritesViewMode = "all" | "source-backed" | "pinned" | "recent";

export type FavouritesNavItem = {
  id: string;
  tabId: string;
  evidence: string;
  pinned?: boolean;
};

export type FavouritesNavSet = {
  id: string;
  title: string;
  count: number;
  meta?: string;
};

export type FavouritesNavProps = {
  sets: FavouritesNavSet[];
  items: FavouritesNavItem[];
  selectedSetId: string | null;
  selectedTypeId: string;
  viewMode: FavouritesViewMode;
  onSelectSet: (setId: string | null) => void;
  onSelectType: (typeId: string) => void;
  onSelectViewMode: (mode: FavouritesViewMode) => void;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const favouritesNavCollapsedKey = "clinical-kb-favourites-nav-collapsed";
const favouritesNavCollapsedEvent = "clinical-kb-favourites-nav-collapsed-change";

// Calm, single clinical accent for saved-set cards. Avoids decorative multi-hue
// gradients (and semantic colours like --warning) so the carousel stays quiet and
// scan-first, consistent with the card's own --clinical-accent selected/hover states.
const setAccentBar = "bg-[color:var(--clinical-accent)]";

function isSourceBacked(item: FavouritesNavItem): boolean {
  return Boolean(item.evidence && item.evidence !== "Run" && item.evidence !== "Saved query");
}

export function useFavouritesNavCollapsed() {
  const collapsed = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(favouritesNavCollapsedEvent, onStoreChange);
      return () => window.removeEventListener(favouritesNavCollapsedEvent, onStoreChange);
    },
    () => {
      try {
        return window.localStorage.getItem(favouritesNavCollapsedKey) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(favouritesNavCollapsedKey, next ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
    window.dispatchEvent(new Event(favouritesNavCollapsedEvent));
  }, []);
  return [collapsed, setCollapsed] as const;
}

type SidebarEntry = {
  id: string;
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

function buildSidebarSections({
  sets,
  items,
  selectedSetId,
  selectedTypeId,
  viewMode,
  onSelectSet,
  onSelectType,
  onSelectViewMode,
}: FavouritesNavProps): { id: string; title: string; entries: SidebarEntry[] }[] {
  const sourceBackedCount = items.filter(isSourceBacked).length;
  const pinnedCount = items.filter((item) => item.pinned).length;
  const allActive = !selectedSetId && viewMode === "all" && selectedTypeId === "all";

  return [
    {
      id: "sets",
      title: "Sets",
      entries: [
        {
          id: "all",
          icon: LayoutGrid,
          label: "All favourites",
          count: items.length,
          active: allActive,
          onClick: () => {
            onSelectViewMode("all");
            onSelectSet(null);
            onSelectType("all");
          },
        },
        ...sets.map((set) => ({
          id: set.id,
          icon: Folder,
          label: set.title,
          count: set.count,
          active: selectedSetId === set.id && viewMode === "all",
          onClick: () => {
            onSelectViewMode("all");
            onSelectSet(selectedSetId === set.id ? null : set.id);
          },
        })),
      ],
    },
    {
      id: "views",
      title: "Quick views",
      entries: [
        {
          id: "source-backed",
          icon: ShieldCheck,
          label: "Source-backed",
          count: sourceBackedCount,
          active: viewMode === "source-backed",
          onClick: () => {
            onSelectSet(null);
            onSelectViewMode(viewMode === "source-backed" ? "all" : "source-backed");
          },
        },
        {
          id: "pinned",
          icon: Pin,
          label: "Pinned",
          count: pinnedCount,
          active: viewMode === "pinned",
          onClick: () => {
            onSelectSet(null);
            onSelectViewMode(viewMode === "pinned" ? "all" : "pinned");
          },
        },
        {
          id: "recent",
          icon: Search,
          label: "Recently used",
          count: items.length,
          active: viewMode === "recent",
          onClick: () => {
            onSelectSet(null);
            onSelectViewMode(viewMode === "recent" ? "all" : "recent");
          },
        },
      ],
    },
    {
      id: "types",
      title: "By type",
      entries: favouriteTabs
        .filter((tab) => tab.id !== "all" && tab.id !== "sets")
        .map((tab) => ({
          id: tab.id,
          icon: tab.icon,
          label: tab.label,
          count: items.filter((item) => item.tabId === tab.id).length,
          active: selectedTypeId === tab.id && viewMode === "all",
          onClick: () => {
            onSelectViewMode("all");
            onSelectType(selectedTypeId === tab.id ? "all" : tab.id);
          },
        })),
    },
  ];
}

function SidebarRow({ entry }: { entry: SidebarEntry }) {
  const Icon = entry.icon;
  return (
    <button
      type="button"
      aria-pressed={entry.active}
      onClick={entry.onClick}
      className={cn(
        "flex min-h-tap w-full items-center gap-2.5 rounded-lg border px-2.5 text-left text-sm-minus font-semibold transition",
        entry.active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[inset_2px_0_0_var(--clinical-accent)]"
          : "border-transparent text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
        focusRing,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      <span className="nums shrink-0 text-2xs font-bold opacity-75">{entry.count}</span>
    </button>
  );
}

/**
 * Renders the favourites library navigation sidebar in expanded or compact mode.
 *
 * @param collapsed - Whether to display the compact sidebar layout.
 * @param onCollapsedChange - Called when the user requests a different sidebar layout.
 */
export function FavouritesSidebar({
  collapsed,
  onCollapsedChange,
  ...navProps
}: FavouritesNavProps & {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const sections = buildSidebarSections(navProps);

  if (collapsed) {
    return (
      <aside
        aria-label="Favourites library filters"
        data-testid="favourites-sidebar-compact"
        className="hidden min-w-0 border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] py-4 shadow-[var(--shadow-soft)] lg:flex lg:w-[5.25rem] lg:flex-col lg:items-center"
      >
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className={cn(
            "group mb-3 grid h-tap w-tap place-items-center rounded-lg border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]",
            focusRing,
          )}
          aria-label="Expand library sidebar"
          title="Expand library sidebar"
        >
          <Heart className="h-4 w-4 group-hover:hidden group-focus-visible:hidden" aria-hidden />
          <PanelLeftOpen className="hidden h-4 w-4 group-hover:block group-focus-visible:block" aria-hidden />
        </button>
        <nav
          aria-label="Favourites library"
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pb-2"
        >
          {sections.map((section, sectionIndex) => (
            <span key={section.id} className="contents">
              {sectionIndex > 0 ? <span className="my-1 h-px w-8 bg-[color:var(--border)]" aria-hidden /> : null}
              {section.entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={entry.active}
                    aria-label={entry.label}
                    title={entry.label}
                    onClick={entry.onClick}
                    className={cn(
                      "relative grid h-tap w-tap place-items-center rounded-lg border transition",
                      entry.active
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[inset_2px_0_0_var(--clinical-accent)]"
                        : "border-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]",
                      focusRing,
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="nums absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full border border-[color:var(--surface)] bg-[color:var(--command)] px-1 text-2xs font-bold leading-none text-[color:var(--command-contrast)]">
                      {entry.count}
                    </span>
                  </button>
                );
              })}
            </span>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Favourites library filters"
      data-testid="favourites-sidebar-expanded"
      className="hidden min-w-0 overflow-y-auto border-r border-[color:var(--border)] bg-[color:var(--surface-lux)] px-4 py-5 shadow-[var(--shadow-soft)] lg:block lg:w-[17.5rem]"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm-minus font-semibold text-[color:var(--text-heading)]">Library</h2>
        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          className={cn(
            "grid h-tap w-tap shrink-0 place-items-center rounded-lg border border-transparent text-[color:var(--text-muted)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]",
            focusRing,
          )}
          aria-label="Compact library sidebar"
          title="Compact library sidebar"
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <nav aria-label="Favourites sections" className="grid gap-5">
        {sections.map((section) => (
          <section key={section.id}>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              {section.title}
            </h3>
            <div className="grid gap-1">
              {section.entries.map((entry) => (
                <SidebarRow key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}

function SetBrowseCard({
  set,
  accentClass,
  active = false,
  onClick,
}: {
  set: FavouritesNavSet;
  accentClass: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative min-w-[8.75rem] max-w-[9.75rem] shrink-0 overflow-hidden rounded-xl border p-2.5 text-left shadow-[var(--shadow-tight)] transition hover:-translate-y-px hover:shadow-[var(--shadow-soft)] sm:min-w-[9.5rem] sm:max-w-[10.5rem]",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/40 ring-2 ring-[color:var(--clinical-accent)]/20"
          : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--clinical-accent-border)]",
        focusRing,
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1", accentClass)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg border",
            active
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
          )}
        >
          <Folder className="h-4 w-4" aria-hidden />
        </span>
        <span className="nums rounded-md border border-[color:var(--border)] bg-[color:var(--surface-wash)] px-2 py-0.5 text-2xs font-bold text-[color:var(--text-heading)]">
          {set.count}
        </span>
      </div>
      <p className="mt-2 truncate text-sm-minus font-bold text-[color:var(--text-heading)]">{set.title}</p>
    </button>
  );
}

/**
 * Surfaces the sidebar's primary quick views (All / Source-backed / Pinned /
 * Recently used) as a horizontally scrollable chip rail below `lg`, where the
 * full sidebar is hidden. Keeps small-screen navigation at parity with desktop.
 */
export function FavouritesMobileQuickViews({
  items,
  selectedSetId,
  selectedTypeId,
  viewMode,
  onSelectSet,
  onSelectType,
  onSelectViewMode,
}: Pick<
  FavouritesNavProps,
  "items" | "selectedSetId" | "selectedTypeId" | "viewMode" | "onSelectSet" | "onSelectType" | "onSelectViewMode"
>) {
  const sourceBackedCount = items.filter(isSourceBacked).length;
  const pinnedCount = items.filter((item) => item.pinned).length;
  const allActive = !selectedSetId && viewMode === "all" && selectedTypeId === "all";

  const chips: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      id: "all",
      icon: LayoutGrid,
      label: "All",
      count: items.length,
      active: allActive,
      onClick: () => {
        onSelectViewMode("all");
        onSelectSet(null);
        onSelectType("all");
      },
    },
    {
      id: "source-backed",
      icon: ShieldCheck,
      label: "Source-backed",
      count: sourceBackedCount,
      active: viewMode === "source-backed",
      onClick: () => {
        onSelectSet(null);
        onSelectViewMode(viewMode === "source-backed" ? "all" : "source-backed");
      },
    },
    {
      id: "pinned",
      icon: Pin,
      label: "Pinned",
      count: pinnedCount,
      active: viewMode === "pinned",
      onClick: () => {
        onSelectSet(null);
        onSelectViewMode(viewMode === "pinned" ? "all" : "pinned");
      },
    },
    {
      id: "recent",
      icon: Search,
      label: "Recently used",
      count: items.length,
      active: viewMode === "recent",
      onClick: () => {
        onSelectSet(null);
        onSelectViewMode(viewMode === "recent" ? "all" : "recent");
      },
    },
  ];

  return (
    <section className="min-w-0 max-w-full lg:hidden" data-testid="favourites-quick-views" aria-label="Quick views">
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
        <div className="flex w-max max-w-none gap-2 pr-1">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={chip.active}
                onClick={chip.onClick}
                className={cn(
                  "inline-flex h-tap shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm-minus font-semibold transition",
                  chip.active
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-tight)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                  focusRing,
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{chip.label}</span>
                <span
                  className={cn(
                    "nums rounded-full px-1.5 text-2xs font-bold leading-none",
                    chip.active
                      ? "bg-[color:var(--clinical-accent)]/12 text-[color:var(--clinical-accent)]"
                      : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FavouritesMobileBrowseRail({
  sets,
  selectedSetId,
  viewMode,
  onSelectSet,
  onSelectViewMode,
}: Pick<FavouritesNavProps, "sets" | "selectedSetId" | "viewMode" | "onSelectSet" | "onSelectViewMode">) {
  if (sets.length === 0) return null;

  return (
    <section className="min-w-0 max-w-full lg:hidden" data-testid="favourites-set-carousel" aria-label="Saved sets">
      <h2 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Browse sets
      </h2>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:thin] sm:-mx-6 sm:px-6">
        <div className="flex w-max max-w-none gap-2.5 pr-1">
          {sets.map((set) => (
            <SetBrowseCard
              key={set.id}
              set={set}
              accentClass={setAccentBar}
              active={selectedSetId === set.id && viewMode === "all"}
              onClick={() => {
                onSelectViewMode("all");
                onSelectSet(selectedSetId === set.id ? null : set.id);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
