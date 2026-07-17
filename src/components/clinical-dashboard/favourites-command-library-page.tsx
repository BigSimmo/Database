"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronsRight,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Folder,
  Heart,
  MoreVertical,
  Pill,
  Quote,
  Search,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  FavouritesMobileBrowseRail,
  FavouritesSidebar,
  useFavouritesNavCollapsed,
  type FavouritesViewMode,
} from "@/components/clinical-dashboard/favourites-library-nav";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { cn } from "@/components/ui-primitives";
import {
  favouriteItems as prototypeFavouriteItems,
  favouriteSets as prototypeFavouriteSets,
  favouriteTabs,
  type FavouriteItem as PrototypeFavouriteItem,
} from "@/components/clinical-dashboard/favourites-prototype-data";
import { useSavedRegistryFavourites } from "@/components/clinical-dashboard/use-saved-registry-favourites";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { favouriteMatchesCommandScopes } from "@/lib/search-command-surface";
import { appModeIcons } from "@/lib/app-mode-icons";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";

type FavouriteType =
  "Medication" | "Document" | "Table" | "Saved search" | "Source" | "Service" | "Form" | "Differential";
type ViewMode = FavouritesViewMode;
type SortMode = "last-used" | "title" | "type";

type FavouriteItem = {
  id: string;
  title: string;
  description: string;
  type: FavouriteType;
  tabId: string;
  set: string;
  evidence: string;
  lastUsed: string;
  action: string;
  href: string;
  icon: LucideIcon;
  pinned?: boolean;
};

type FavouriteSet = {
  id: string;
  title: string;
  count: number;
  meta?: string;
};

type SourceRecord = {
  title: string;
  type: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const sourceRecords: SourceRecord[] = [
  { title: "NICE CKS - Alcohol dependence", type: "Guideline" },
  { title: "BNF - Acamprosate", type: "BNF" },
  { title: "Medsafe - Acamprosate data sheet", type: "Datasheet" },
];

const typeStyles: Record<FavouriteType, string> = {
  Medication:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  Document:
    "border-[color:var(--type-document-border)] bg-[color:var(--type-document-soft)] text-[color:var(--type-document)]",
  Table: "border-[color:var(--type-table-border)] bg-[color:var(--type-table-soft)] text-[color:var(--type-table)]",
  "Saved search":
    "border-[color:var(--type-search-border)] bg-[color:var(--type-search-soft)] text-[color:var(--type-search)]",
  Source: "border-[color:var(--type-source-border)] bg-[color:var(--type-source-soft)] text-[color:var(--type-source)]",
  Service:
    "border-[color:var(--type-service-border)] bg-[color:var(--type-service-soft)] text-[color:var(--type-service)]",
  Form: "border-[color:var(--type-form-border)] bg-[color:var(--type-form-soft)] text-[color:var(--type-form)]",
  Differential:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
};

const lastUsedByItemId: Record<string, string> = {
  "acamprosate-renal-screen": "Today 08:44",
  "lithium-monitoring-guideline": "Today 08:20",
  "clozapine-monitoring-table": "Yesterday 16:12",
  "renal-dose-search": "Today 07:55",
  "qt-prolongation-quote": "Mon 11:03",
};

const pinnedItemIds = new Set(["acamprosate-renal-screen", "lithium-monitoring-guideline"]);

const typeByPrototypeType: Record<PrototypeFavouriteItem["type"], FavouriteType> = {
  medications: "Medication",
  documents: "Document",
  sources: "Source",
  services: "Service",
  forms: "Form",
  differentials: "Differential",
};

const fallbackIconByType: Record<PrototypeFavouriteItem["type"], LucideIcon> = {
  medications: Pill,
  documents: FileText,
  sources: Quote,
  services: appModeIcons.services,
  forms: appModeIcons.forms,
  differentials: appModeIcons.differentials,
};

function lastUsedScore(lastUsed: string): number {
  const lower = lastUsed.toLowerCase();
  if (lower.startsWith("today")) {
    const timeMatch = lastUsed.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) return 100_000 + Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
    return 100_000;
  }
  if (lower.startsWith("yesterday")) return 50_000;
  if (lower.startsWith("mon")) return 10_000;
  return 1_000;
}

function isSourceBacked(item: FavouriteItem): boolean {
  return Boolean(item.evidence && item.evidence !== "Run" && item.evidence !== "Saved query");
}

function toCommandItem(item: PrototypeFavouriteItem): FavouriteItem {
  const type =
    item.type === "sources" && item.primaryAction === "Run"
      ? "Saved search"
      : (typeByPrototypeType[item.type] ?? "Source");
  return {
    id: item.id,
    title: item.title,
    description: item.meta,
    type,
    tabId: item.type,
    set: item.set || (item.type === "services" ? "Saved services" : item.type === "forms" ? "Saved forms" : "Unsorted"),
    evidence: item.sourceMeta,
    lastUsed: lastUsedByItemId[item.id] ?? "Saved",
    action: item.primaryAction,
    href: item.href,
    icon: item.icon ?? fallbackIconByType[item.type],
    pinned: pinnedItemIds.has(item.id),
  };
}

function buildFavouriteSets(items: FavouriteItem[]): FavouriteSet[] {
  const presetSets = prototypeFavouriteSets.map((set) => ({
    id: set.id,
    title: set.title,
    count: items.filter((item) => item.set === set.title).length,
    meta: set.meta,
  }));
  const knownTitles = new Set(presetSets.map((set) => set.title));
  const dynamicSets = Array.from(new Set(items.map((item) => item.set)))
    .filter((title) => title && !knownTitles.has(title))
    .map((title) => ({
      id: title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      title,
      count: items.filter((item) => item.set === title).length,
    }));
  return [...presetSets, ...dynamicSets].filter((set) => set.count > 0);
}

function getMostRecentlyUsedItem(items: FavouriteItem[]): FavouriteItem | null {
  if (items.length === 0) return null;
  return [...items].sort((first, second) => lastUsedScore(second.lastUsed) - lastUsedScore(first.lastUsed))[0] ?? null;
}

function filterAndSortItems(
  items: FavouriteItem[],
  {
    searchTerm,
    selectedTypeId,
    selectedSet,
    viewMode,
    sortMode,
  }: {
    searchTerm: string;
    selectedTypeId: string;
    selectedSet: FavouriteSet | null;
    viewMode: ViewMode;
    sortMode: SortMode;
  },
): FavouriteItem[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const effectiveSort: SortMode = viewMode === "recent" ? "last-used" : sortMode;

  return items
    .filter((item) => selectedTypeId === "all" || item.tabId === selectedTypeId)
    .filter((item) => !selectedSet || item.set === selectedSet.title)
    .filter((item) => {
      if (viewMode === "source-backed") return isSourceBacked(item);
      if (viewMode === "pinned") return item.pinned === true;
      return true;
    })
    .filter((item) =>
      normalizedSearch
        ? [item.title, item.description, item.type, item.set, item.evidence].some((field) =>
            field.toLowerCase().includes(normalizedSearch),
          )
        : true,
    )
    .sort((first, second) => {
      if (effectiveSort === "title") return first.title.localeCompare(second.title);
      if (effectiveSort === "type")
        return first.type.localeCompare(second.type) || first.title.localeCompare(second.title);
      return lastUsedScore(second.lastUsed) - lastUsedScore(first.lastUsed);
    });
}

function MiniIconTile({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

function SmallChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-2xs font-semibold leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ActiveFilterChips({
  searchTerm,
  selectedTypeId,
  selectedSet,
  viewMode,
  onClearSearch,
  onClearType,
  onClearSet,
  onClearViewMode,
}: {
  searchTerm: string;
  selectedTypeId: string;
  selectedSet: FavouriteSet | null;
  viewMode: ViewMode;
  onClearSearch: () => void;
  onClearType: () => void;
  onClearSet: () => void;
  onClearViewMode: () => void;
}) {
  const typeLabel = favouriteTabs.find((tab) => tab.id === selectedTypeId)?.label;
  const chips: { key: string; label: string; onClear: () => void }[] = [];

  if (searchTerm.trim()) chips.push({ key: "search", label: `Search: ${searchTerm.trim()}`, onClear: onClearSearch });
  if (selectedSet) chips.push({ key: "set", label: selectedSet.title, onClear: onClearSet });
  if (selectedTypeId !== "all" && typeLabel) chips.push({ key: "type", label: typeLabel, onClear: onClearType });
  if (viewMode === "source-backed") chips.push({ key: "view", label: "Source-backed", onClear: onClearViewMode });
  if (viewMode === "pinned") chips.push({ key: "view", label: "Pinned", onClear: onClearViewMode });
  if (viewMode === "recent") chips.push({ key: "view", label: "Recently used", onClear: onClearViewMode });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="favourites-active-filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className={cn(
            "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-2xs font-semibold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]/80",
            focusRing,
          )}
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Clear filter</span>
        </button>
      ))}
    </div>
  );
}

function ContinueStrip({ item, onSelect }: { item: FavouriteItem; onSelect: (id: string) => void }) {
  const Icon = item.icon;
  return (
    <section
      className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]"
      data-testid="favourites-continue-strip"
    >
      <div className="grid min-h-[3.25rem] grid-cols-[3px_minmax(0,1fr)]">
        <span className="bg-[color:var(--success)]" aria-hidden />
        <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-start gap-3 sm:flex-1">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn("min-w-0 flex-1 text-left", focusRing)}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--success)]">
                  Continue
                </p>
                <p className="min-w-0 text-sm-minus font-bold leading-snug text-[color:var(--text-heading)]">
                  {item.title}
                </p>
              </div>
              <p className="mt-0.5 text-2xs font-medium leading-snug text-[color:var(--text-muted)]">
                {item.set} · last opened {item.lastUsed}
              </p>
            </button>
          </div>
          <Link
            href={item.href}
            className={cn(
              "inline-flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] sm:w-auto",
              focusRing,
            )}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Continue
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Renders a menu of actions for a favourite item.
 *
 * @param item - The favourite item associated with the available actions
 */
function RowActionsMenu({ item }: { item: FavouriteItem }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissableLayer({
    enabled: open,
    refs: [buttonRef, menuRef],
    onDismiss: () => setOpen(false),
    restoreFocusRef: buttonRef,
  });

  const actionLabel = item.action === "Copy" ? "Open" : item.action;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${item.title}`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "grid h-11 w-11 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          focusRing,
        )}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-[var(--shadow-soft)]"
        >
          <Link
            href={item.href}
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
            {actionLabel}
          </Link>
          <button
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
            onClick={() => setOpen(false)}
          >
            <Copy className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
            Copy citation
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            title="Coming soon"
            className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text-soft)]"
          >
            <Folder className="h-4 w-4" aria-hidden />
            Move to set
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FavouriteMobileCard({
  item,
  selected,
  onSelect,
}: {
  item: FavouriteItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <article
      data-testid={`favourite-mobile-card-${item.id}`}
      className={cn(
        "relative min-w-0 max-w-full rounded-lg border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-tight)]",
        selected
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/35 shadow-[inset_3px_0_0_var(--clinical-accent)]"
          : "border-[color:var(--border)]",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-pressed={selected}
        aria-label={`Select ${item.title}`}
        className={cn("absolute inset-0 cursor-pointer rounded-lg", focusRing)}
      />

      <div className="pointer-events-none relative min-w-0">
        <h3 className="line-clamp-2 text-sm-minus font-bold leading-5 text-[color:var(--text-heading)]">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
          {item.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SmallChip className={typeStyles[item.type]}>{item.type}</SmallChip>
          {isSourceBacked(item) ? (
            <SmallChip className="border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]">
              Source-backed
            </SmallChip>
          ) : null}
        </div>
      </div>

      <dl className="pointer-events-none relative mt-3 grid gap-2 border-t border-[color:var(--border)] pt-3 text-2xs font-semibold">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5 text-[color:var(--text-muted)]">
            <Folder className="h-3.5 w-3.5" aria-hidden />
            Set
          </dt>
          <dd className="min-w-0 truncate text-right text-[color:var(--text-heading)]">{item.set}</dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="text-[color:var(--text-muted)]">Last used</dt>
          <dd className="min-w-0 truncate text-right text-[color:var(--text-heading)]">{item.lastUsed}</dd>
        </div>
      </dl>

      <div className="relative z-[1] mt-3 grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
        <Link
          href={item.href}
          className={cn(
            "inline-flex h-tap min-w-0 items-center justify-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-sm-minus font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
            focusRing,
          )}
        >
          Open
        </Link>
        <RowActionsMenu item={item} />
      </div>
    </article>
  );
}

function FavouritesTable({
  items,
  searchTerm,
  selectedTypeId,
  selectedSet,
  viewMode,
  sortMode,
  selectedItemId,
  commandScopes = [],
  onSortModeChange,
  onSelectItem,
}: {
  items: FavouriteItem[];
  searchTerm: string;
  selectedTypeId: string;
  selectedSet: FavouriteSet | null;
  viewMode: ViewMode;
  sortMode: SortMode;
  selectedItemId: string | null;
  commandScopes?: string[];
  onSortModeChange: (value: SortMode) => void;
  onSelectItem: (id: string) => void;
}) {
  const tableRows = useMemo(() => {
    const rows = filterAndSortItems(items, {
      searchTerm,
      selectedTypeId,
      selectedSet,
      viewMode,
      sortMode,
    });
    if (!commandScopes.length) return rows;
    return rows.filter((item) => favouriteMatchesCommandScopes(item, commandScopes));
  }, [commandScopes, items, searchTerm, selectedSet, selectedTypeId, viewMode, sortMode]);

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 py-2.5">
        <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
          {tableRows.length} {tableRows.length === 1 ? "item" : "items"}
          {tableRows.length !== items.length ? ` of ${items.length}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-[9.5rem]">
            <span className="sr-only">Sort favourites</span>
            <select
              value={viewMode === "recent" ? "last-used" : sortMode}
              disabled={viewMode === "recent"}
              title={viewMode === "recent" ? "Recently used view is always sorted by last used" : undefined}
              onChange={(event) => onSortModeChange(event.target.value as SortMode)}
              className="h-9 w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 pr-9 text-xs font-bold text-[color:var(--text-muted)] outline-none hover:bg-[color:var(--surface-subtle)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="last-used">Sort: Last used</option>
              <option value="title">Sort: Title</option>
              <option value="type">Sort: Type</option>
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--text-soft)]"
            />
          </label>
        </div>
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table aria-label="Saved favourites" className="min-w-[36rem] w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-[color:var(--border)] bg-[color:var(--surface)] text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              <th scope="col" className="min-w-[12rem] px-3">
                Item
              </th>
              <th scope="col" className="min-w-[6.5rem] px-3">
                Type
              </th>
              <th scope="col" className="min-w-[7rem] px-3">
                Set
              </th>
              <th scope="col" className="hidden min-w-[7rem] px-3 lg:table-cell">
                Evidence
              </th>
              <th scope="col" className="min-w-[6rem] px-3">
                Last used
              </th>
              <th scope="col" className="min-w-[7.5rem] px-3 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {tableRows.map((item) => {
              const selected = selectedItemId === item.id;
              return (
                <tr
                  key={item.id}
                  data-testid={`favourite-row-${item.id}`}
                  onClick={() => onSelectItem(item.id)}
                  className={cn(
                    "relative h-14 cursor-pointer transition hover:bg-[color:var(--surface-subtle)]",
                    selected &&
                      "bg-[color:var(--clinical-accent-soft)]/45 shadow-[inset_3px_0_0_var(--clinical-accent)]",
                  )}
                >
                  <td className="px-3 align-middle">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      aria-pressed={selected}
                      className={cn("min-w-0 max-w-full rounded-md text-left", focusRing)}
                    >
                      <span className="line-clamp-1 block text-sm-minus font-bold text-[color:var(--text-heading)]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-2xs font-medium text-[color:var(--text-muted)]">
                        {item.description}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 align-middle">
                    <SmallChip className={typeStyles[item.type]}>{item.type}</SmallChip>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
                      <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-1">{item.set}</span>
                    </span>
                  </td>
                  <td className="hidden px-3 align-middle lg:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="line-clamp-1">{item.evidence}</span>
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="text-2xs font-semibold text-[color:var(--text-heading)]">{item.lastUsed}</span>
                  </td>
                  <td className="px-3 align-middle" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={item.href}
                        className={cn(
                          "inline-flex h-9 min-w-16 items-center justify-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-2xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                          focusRing,
                        )}
                      >
                        Open
                      </Link>
                      <RowActionsMenu item={item} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {tableRows.length === 0 ? (
              <tr>
                {/* The Evidence column is hidden below lg, so span 5 there and 6 at lg+. */}
                {[
                  { colSpan: 5, className: "px-4 py-10 text-center lg:hidden" },
                  { colSpan: 6, className: "hidden px-4 py-10 text-center lg:table-cell" },
                ].map(({ colSpan, className }) => (
                  <td key={colSpan} colSpan={colSpan} className={className}>
                    <Search className="mx-auto mb-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden />
                    <p className="font-bold text-[color:var(--text-heading)]">No favourites match</p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--text-muted)]">
                      Clear filters or search to show saved clinical work.
                    </p>
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid min-w-0 gap-3 bg-[color:var(--surface-wash)] p-3 sm:hidden">
        {tableRows.map((item) => (
          <FavouriteMobileCard
            key={item.id}
            item={item}
            selected={selectedItemId === item.id}
            onSelect={onSelectItem}
          />
        ))}
        {tableRows.length === 0 ? (
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-8 text-center">
            <Search className="mx-auto mb-2 h-5 w-5 text-[color:var(--text-soft)]" aria-hidden />
            <p className="font-bold text-[color:var(--text-heading)]">No favourites match</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-muted)]">
              Clear filters or search to show saved clinical work.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ItemWorkspace({ item, onClose }: { item: FavouriteItem; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"summary" | "evidence" | "notes">("summary");
  const Icon = item.icon;
  const actionLabel = item.action === "Copy" ? "Open" : item.action;

  return (
    <aside
      className="hidden min-w-0 border-l border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-6 2xl:block"
      data-testid="favourites-item-workspace"
    >
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3">
        <h2 className="text-sm-minus font-semibold text-[color:var(--text-heading)]">Item workspace</h2>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
            focusRing,
          )}
          aria-label="Collapse item workspace"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-start gap-3">
          <MiniIconTile icon={Icon} active />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg-minus font-bold leading-tight text-[color:var(--text-heading)]">{item.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SmallChip className={typeStyles[item.type]}>{item.type}</SmallChip>
              {isSourceBacked(item) ? (
                <SmallChip className="border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]">
                  Source-backed
                </SmallChip>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
          Saved in <Folder className="h-4 w-4" aria-hidden />{" "}
          <span className="text-[color:var(--text-heading)]">{item.set}</span>
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 border-b border-[color:var(--border)]">
        {[
          ["summary", "Summary"],
          ["evidence", "Evidence"],
          ["notes", "Notes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as "summary" | "evidence" | "notes")}
            className={cn(
              "min-h-10 border-b-2 text-sm-minus font-semibold transition",
              activeTab === id
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
              focusRing,
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5">
        {activeTab === "summary" ? (
          <section className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/45 p-3">
            <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)]">
              Next action
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{item.description}</p>
            <p className="mt-1 text-2xs font-medium text-[color:var(--text-muted)]">Saved action: {actionLabel}</p>
            <Link
              href={item.href}
              className={cn(
                "mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]",
                focusRing,
              )}
            >
              {actionLabel}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-2 text-2xs font-medium text-[color:var(--text-muted)]">Last opened {item.lastUsed}</p>
          </section>
        ) : null}

        {activeTab === "evidence" ? (
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Sources (3)
            </h3>
            <div className="grid gap-2">
              {sourceRecords.map((source, index) => (
                <div
                  key={source.title}
                  className="grid min-h-11 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5"
                >
                  <span className="nums grid h-5 w-5 place-items-center rounded bg-[color:var(--surface-subtle)] text-2xs font-semibold text-[color:var(--text-muted)]">
                    {index + 1}
                  </span>
                  <span className="truncate text-2xs font-semibold text-[color:var(--text-heading)]">
                    {source.title}
                  </span>
                  <SmallChip className="border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
                    {source.type}
                  </SmallChip>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "notes" ? (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                Personal note
              </h3>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 text-2xs font-bold text-[color:var(--clinical-accent)]",
                  focusRing,
                )}
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden />
                Edit
              </button>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                Useful for older patients with fluctuating eGFR. Check adherence section on page 4.
              </p>
              <span className="mt-3 block text-2xs font-medium text-[color:var(--text-muted)]">
                Updated 11 May 2024
              </span>
            </div>
          </section>
        ) : null}

        <section className="border-t border-[color:var(--border)] pt-4">
          <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            More
          </h3>
          <div className="grid gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex h-9 items-center justify-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
                focusRing,
              )}
            >
              <Copy className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
              Copy citation
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex h-9 cursor-not-allowed items-center justify-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-soft)]"
            >
              <Folder className="h-4 w-4" aria-hidden />
              Move to set
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className={cn(
                "inline-flex h-9 cursor-not-allowed items-center justify-start gap-2 rounded-lg border border-[color:var(--danger-border)] bg-transparent px-3 text-sm font-bold text-[color:var(--danger)]",
                focusRing,
              )}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove favourite
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function FavouritesCommandLibraryPage({ query = "" }: { query?: string }) {
  const router = useRouter();
  const command = useSearchCommand();
  const [navCollapsed, setNavCollapsed] = useFavouritesNavCollapsed();
  const savedRegistryFavourites = useSavedRegistryFavourites();
  const items = useMemo(
    () => [...prototypeFavouriteItems, ...savedRegistryFavourites].map(toCommandItem),
    [savedRegistryFavourites],
  );
  const sets = useMemo(() => buildFavouriteSets(items), [items]);
  const [selectedTypeId, setSelectedTypeId] = useState("all");
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("last-used");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const effectiveSelectedSetId = selectedSetId && sets.some((set) => set.id === selectedSetId) ? selectedSetId : null;
  const selectedSet = effectiveSelectedSetId ? (sets.find((set) => set.id === effectiveSelectedSetId) ?? null) : null;

  const filteredItems = useMemo(
    () =>
      filterAndSortItems(items, {
        searchTerm: query,
        selectedTypeId,
        selectedSet,
        viewMode,
        sortMode,
      }),
    [items, query, selectedTypeId, selectedSet, viewMode, sortMode],
  );
  const scopedItems = useMemo(() => {
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return filteredItems;
    return filteredItems.filter((item) => favouriteMatchesCommandScopes(item, scopes));
  }, [command?.commandScopes, filteredItems]);

  const continueItem = useMemo(() => getMostRecentlyUsedItem(items), [items]);
  const showContinueStrip =
    continueItem !== null && scopedItems.some((item) => item.id === continueItem.id) && scopedItems.length > 0;

  const selectedItem = selectedItemId ? (items.find((item) => item.id === selectedItemId) ?? null) : null;

  function clearSearch() {
    router.push("/favourites");
  }

  return (
    <main
      data-testid="favourites-hub"
      className="min-h-[calc(100dvh-4rem)] overflow-x-hidden bg-[color:var(--background)] pb-[calc(6rem+env(safe-area-inset-bottom))] text-[color:var(--text)] sm:pb-32 md:pb-0"
    >
      <span data-testid="favourites-command-library" className="sr-only">
        Favourites command library
      </span>
      <div
        className={cn(
          "grid min-h-[calc(100dvh-4rem)] min-w-0 overflow-x-hidden",
          navCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[17.5rem_minmax(0,1fr)]",
          selectedItem &&
            (navCollapsed
              ? "2xl:grid-cols-[5.25rem_minmax(0,1fr)_23rem]"
              : "2xl:grid-cols-[17.5rem_minmax(0,1fr)_23rem]"),
        )}
      >
        <FavouritesSidebar
          sets={sets}
          items={items}
          selectedSetId={effectiveSelectedSetId}
          selectedTypeId={selectedTypeId}
          viewMode={viewMode}
          collapsed={navCollapsed}
          onCollapsedChange={setNavCollapsed}
          onSelectSet={setSelectedSetId}
          onSelectType={setSelectedTypeId}
          onSelectViewMode={setViewMode}
        />
        <div className="min-w-0 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-7">
          <div className="mx-auto grid min-w-0 max-w-[66rem] gap-3">
            <header>
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                  <Heart className="size-icon-lg" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-balance text-2xl-minus font-bold leading-tight tracking-tight text-[color:var(--text-heading)] sm:text-2xl">
                    Favourites command library
                  </h1>
                  <p className="mt-1 text-pretty text-sm-minus font-medium leading-6 text-[color:var(--text-muted)]">
                    Your saved clinical knowledge, sets and searches - action-ready and source-backed.
                  </p>
                </div>
              </div>
            </header>

            <div
              id={modeHomeDesktopComposerSlotId}
              className="mode-home-composer-slot hidden w-full max-w-3xl [&:not(:empty)]:block"
            />

            <div className="hidden lg:block">
              <SearchResultsHeaderBand modeId="favourites" query={query} matchCount={scopedItems.length} />
            </div>
            <ActiveFilterChips
              searchTerm={query}
              selectedTypeId={selectedTypeId}
              selectedSet={selectedSet}
              viewMode={viewMode}
              onClearSearch={clearSearch}
              onClearType={() => setSelectedTypeId("all")}
              onClearSet={() => setSelectedSetId(null)}
              onClearViewMode={() => setViewMode("all")}
            />

            {showContinueStrip && continueItem ? (
              <ContinueStrip item={continueItem} onSelect={setSelectedItemId} />
            ) : null}

            {query.trim() && scopedItems.length === 0 ? (
              <SearchResultsEmptyState modeId="favourites" query={query} onClearScopes={command?.onClearScopes} />
            ) : (
              <FavouritesTable
                items={items}
                searchTerm={query}
                selectedTypeId={selectedTypeId}
                selectedSet={selectedSet}
                viewMode={viewMode}
                sortMode={sortMode}
                selectedItemId={selectedItemId}
                commandScopes={command?.commandScopes}
                onSortModeChange={setSortMode}
                onSelectItem={setSelectedItemId}
              />
            )}

            <UniversalSearchAlsoMatches modeId="favourites" query={query} />

            <FavouritesMobileBrowseRail
              sets={sets}
              selectedSetId={effectiveSelectedSetId}
              viewMode={viewMode}
              onSelectSet={setSelectedSetId}
              onSelectViewMode={setViewMode}
            />
          </div>
        </div>
        {selectedItem ? <ItemWorkspace item={selectedItem} onClose={() => setSelectedItemId(null)} /> : null}
      </div>
    </main>
  );
}
