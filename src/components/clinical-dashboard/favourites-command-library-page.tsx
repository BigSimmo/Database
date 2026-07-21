"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronsRight,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  Heart,
  MoreVertical,
  Pill,
  Pin,
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
  FavouritesMobileQuickViews,
  FavouritesSidebar,
  useFavouritesNavCollapsed,
  type FavouritesViewMode,
} from "@/components/clinical-dashboard/favourites-library-nav";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
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
import { canAccessFavouritesMode } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { useAuthSession } from "@/lib/supabase/client";
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

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

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

function favouriteCitationText(item: FavouriteItem): string {
  const evidenceLine = isSourceBacked(item) ? `Evidence: ${item.evidence}` : item.description;
  return `${item.title}\n${evidenceLine}\n${item.href}`;
}

async function copyFavouriteCitation(item: FavouriteItem): Promise<boolean> {
  const text = favouriteCitationText(item);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the local selection-based copy path.
    }
  }

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previouslyFocused?.focus({ preventScroll: true });
  }
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

function MiniIconTile({
  icon: Icon,
  active = false,
  className,
}: {
  icon: LucideIcon;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
        active
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
        className,
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
            "inline-flex min-h-tap max-w-full items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-2xs font-semibold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]/80",
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

function ContinueStrip({ item }: { item: FavouriteItem }) {
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
            <Link href={item.href} className={cn("min-w-0 flex-1 text-left", focusRing)}>
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
            </Link>
          </div>
          <Link
            href={item.href}
            aria-label={`Continue ${item.title}`}
            className={cn(
              "inline-flex min-h-tap w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] sm:min-h-9 sm:w-auto",
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `favourite-actions-${item.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const triggerId = `${menuId}-trigger`;

  useDismissableLayer({
    enabled: open,
    refs: [buttonRef, menuRef],
    onDismiss: () => setOpen(false),
    restoreFocusRef: buttonRef,
  });

  const actionLabel = item.action === "Copy" ? "Open" : item.action;

  function focusMenuItem(position: "first" | "last") {
    window.requestAnimationFrame(() => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      );
      const target = position === "first" ? items[0] : items.at(-1);
      target?.focus({ preventScroll: true });
    });
  }

  function openMenu(position: "first" | "last" = "first") {
    setOpen(true);
    setCopyStatus("idle");
    focusMenuItem(position);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const currentIndex = items.findIndex((candidate) => candidate === document.activeElement);

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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label={`More actions for ${item.title}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openMenu(event.key === "ArrowUp" ? "last" : "first");
        }}
        className={cn(
          "grid h-tap w-tap place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          focusRing,
        )}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-[var(--shadow-soft)]"
        >
          <Link
            href={item.href}
            role="menuitem"
            aria-label={`${actionLabel} ${item.title}`}
            className={cn(
              "flex min-h-tap w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
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
              "flex min-h-tap w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
            onClick={async () => {
              const copied = await copyFavouriteCitation(item);
              setCopyStatus(copied ? "copied" : "failed");
            }}
          >
            <Copy className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
            {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy citation"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            title="Coming soon"
            className="flex min-h-tap w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text-soft)]"
          >
            <Folder className="h-4 w-4" aria-hidden />
            Move to set
          </button>
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatus === "copied"
          ? `${item.title} citation copied`
          : copyStatus === "failed"
            ? "Unable to copy citation"
            : ""}
      </span>
    </div>
  );
}

function FavouriteMobileCard({ item }: { item: FavouriteItem }) {
  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-tight)]">
      <div className="min-w-0">
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

      <dl className="mt-3 grid gap-2 border-t border-[color:var(--border)] pt-3 text-2xs font-semibold">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5 text-[color:var(--text-muted)]">
            <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Set
          </dt>
          <dd className="min-w-0 truncate text-right text-[color:var(--text-heading)]">{item.set}</dd>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <dt className="text-[color:var(--text-muted)]">Last used</dt>
          <dd className="min-w-0 truncate text-right text-[color:var(--text-heading)]">{item.lastUsed}</dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2">
        <Link
          href={item.href}
          aria-label={`Open ${item.title}`}
          className={cn(
            "inline-flex h-tap min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-sm-minus font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
            focusRing,
          )}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
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

  // With the item workspace open (only at 2xl), the middle column narrows sharply.
  // Drop the leading icon and the secondary Evidence column there so titles keep
  // room instead of collapsing to a couple of characters.
  const compact = Boolean(selectedItemId);
  const rowIconClass = compact ? "hidden" : "hidden 2xl:grid";
  const evidenceHeadClass = cn("hidden px-3", compact ? "" : "w-[7rem] 2xl:table-cell");
  const evidenceCellClass = cn("hidden px-3 align-middle", compact ? "" : "2xl:table-cell");

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-wash)] px-3.5 py-2.5">
        <p className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]">
          <Heart className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
          <span className="nums font-bold text-[color:var(--text-heading)]">{tableRows.length}</span>
          {tableRows.length === 1 ? "item" : "items"}
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
              className="min-h-tap w-full appearance-none rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 pr-9 text-xs font-bold text-[color:var(--text-muted)] outline-none hover:bg-[color:var(--surface-subtle)] focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9"
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
        <table aria-label="Saved favourites" className="w-full min-w-[34rem] table-fixed border-collapse text-left">
          <thead>
            <tr className="h-9 border-b border-[color:var(--border)] bg-[color:var(--surface-wash)] text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              <th scope="col" className="min-w-[11rem] px-3.5">
                Item
              </th>
              <th scope="col" className="w-[6rem] px-3">
                Type
              </th>
              <th scope="col" className="w-[7rem] px-3">
                Set
              </th>
              <th scope="col" className={evidenceHeadClass}>
                Evidence
              </th>
              <th scope="col" className="w-[6.5rem] px-3">
                Last used
              </th>
              <th scope="col" className="w-[7.5rem] px-3 text-right">
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
                  className={cn(
                    "relative h-14 transition hover:bg-[color:var(--surface-subtle)]",
                    selected && "xl:bg-[color:var(--clinical-accent-soft)]/45 xl:shadow-[var(--shadow-rail-active)]",
                  )}
                >
                  <td className="px-3.5 align-middle">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      aria-pressed={selected}
                      className={cn(
                        "hidden min-w-0 max-w-full items-center gap-2.5 rounded-md text-left xl:flex",
                        focusRing,
                      )}
                    >
                      <MiniIconTile icon={item.icon} active={selected} className={rowIconClass} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {item.pinned ? (
                            <>
                              <Pin
                                className="h-3 w-3 shrink-0 -rotate-45 fill-current text-[color:var(--clinical-accent)]"
                                aria-hidden
                              />
                              <span className="sr-only">Pinned</span>
                            </>
                          ) : null}
                          <span className="line-clamp-1 min-w-0 text-sm-minus font-bold text-[color:var(--text-heading)]">
                            {item.title}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-2xs font-medium text-[color:var(--text-muted)]">
                          {item.description}
                        </span>
                      </span>
                    </button>
                    <Link
                      href={item.href}
                      className={cn("block min-w-0 max-w-full rounded-md text-left xl:hidden", focusRing)}
                    >
                      <span className="line-clamp-1 block text-sm-minus font-bold text-[color:var(--text-heading)]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-2xs font-medium text-[color:var(--text-muted)]">
                        {item.description}
                      </span>
                    </Link>
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
                  <td className={evidenceCellClass}>
                    {isSourceBacked(item) ? (
                      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="line-clamp-1">{item.evidence}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
                        <span className="line-clamp-1">{item.evidence}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 align-middle">
                    <span className="whitespace-nowrap text-2xs font-semibold text-[color:var(--text-heading)]">
                      {item.lastUsed}
                    </span>
                  </td>
                  <td className="px-3 align-middle" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={item.href}
                        aria-label={`Open ${item.title}`}
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
                {/* Compact (workspace open) always hides Evidence, so stay at 5 columns.
                    Otherwise Evidence appears only from 2xl, so span 5 below 2xl and 6 at 2xl+. */}
                {(compact
                  ? [{ colSpan: 5, className: "px-4 py-10 text-center" }]
                  : [
                      { colSpan: 5, className: "px-4 py-10 text-center 2xl:hidden" },
                      { colSpan: 6, className: "hidden px-4 py-10 text-center 2xl:table-cell" },
                    ]
                ).map(({ colSpan, className }) => (
                  <td key={`${compact ? "compact" : "full"}-${colSpan}`} colSpan={colSpan} className={className}>
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
          <FavouriteMobileCard key={item.id} item={item} />
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const Icon = item.icon;
  const actionLabel = item.action === "Copy" ? "Open" : item.action;

  return (
    <aside
      className="hidden min-w-0 border-l border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-6 xl:block"
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
              Evidence
            </h3>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              {isSourceBacked(item) ? (
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                  <p className="min-w-0 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {item.evidence}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                  No linked evidence source is saved for this item.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "notes" ? (
          <section>
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              Personal note
            </h3>
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
              <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                No personal note is saved for this item.
              </p>
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
              onClick={async () => {
                const copied = await copyFavouriteCitation(item);
                setCopyStatus(copied ? "copied" : "failed");
              }}
              className={cn(
                "inline-flex h-9 items-center justify-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
                focusRing,
              )}
            >
              <Copy className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
              {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy citation"}
            </button>
            <span className="sr-only" role="status" aria-live="polite">
              {copyStatus === "copied"
                ? `${item.title} citation copied`
                : copyStatus === "failed"
                  ? "Unable to copy citation"
                  : ""}
            </span>
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

export function FavouritesCommandLibraryPage({ query = "", demoMode }: { query?: string; demoMode: boolean }) {
  const router = useRouter();
  const command = useSearchCommand();
  const auth = useAuthSession();
  const favouritesAccessible = canAccessFavouritesMode({
    authenticated: auth.status === "authenticated",
    demoMode,
  });
  const authSettled = auth.status !== "loading";
  const [accountSetupDismissed, setAccountSetupDismissed] = useState(false);
  const accountSetupOpen = authSettled && !favouritesAccessible && !accountSetupDismissed;
  const [navCollapsed, setNavCollapsed] = useFavouritesNavCollapsed();
  const savedRegistryFavourites = useSavedRegistryFavourites();
  const items = useMemo(
    () => [...(demoMode ? prototypeFavouriteItems : []), ...savedRegistryFavourites].map(toCommandItem),
    [demoMode, savedRegistryFavourites],
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

  if (!favouritesAccessible) {
    return (
      <main
        data-testid="favourites-hub"
        className="min-h-0 overflow-x-clip bg-[color:var(--background)] pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-4rem)] sm:pb-32 md:pb-0"
      >
        <span data-testid="favourites-command-library" className="sr-only">
          Favourites command library
        </span>
        <div className="mx-auto grid min-w-0 max-w-[40rem] gap-4 px-4 py-8 sm:px-6">
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
                  Sign up to save favourites and access them across devices.
                </p>
              </div>
            </div>
          </header>
          <div
            role="status"
            className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 text-sm font-semibold text-[color:var(--text)]"
          >
            <p>
              {authSettled
                ? "Favourites are tied to your account. Sign in or create an account to continue."
                : "Checking your account…"}
            </p>
            {authSettled ? (
              <button
                type="button"
                data-testid="favourites-open-account-setup"
                onClick={() => setAccountSetupDismissed(false)}
                className="mt-3 inline-flex min-h-tap items-center justify-center rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                Sign up to save favourites
              </button>
            ) : null}
          </div>
        </div>
        <AccountSetupDialog
          open={accountSetupOpen}
          onClose={() => setAccountSetupDismissed(true)}
          intent="favourites"
        />
      </main>
    );
  }

  return (
    <main
      data-testid="favourites-hub"
      className="min-h-0 overflow-x-clip bg-[color:var(--background)] pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-4rem)] sm:pb-32 md:pb-0"
    >
      <span data-testid="favourites-command-library" className="sr-only">
        Favourites command library
      </span>
      <div
        className={cn(
          "grid min-h-0 min-w-0 overflow-x-clip sm:min-h-[calc(100dvh-4rem)]",
          navCollapsed ? "lg:grid-cols-[5.25rem_minmax(0,1fr)]" : "lg:grid-cols-[17.5rem_minmax(0,1fr)]",
          selectedItem &&
            (navCollapsed
              ? "xl:grid-cols-[5.25rem_minmax(0,1fr)_23rem]"
              : "xl:grid-cols-[17.5rem_minmax(0,1fr)_23rem]"),
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
          <div className="mx-auto grid min-w-0 max-w-[66rem] gap-3 2xl:max-w-[72rem]">
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

            {!demoMode && auth.status !== "authenticated" && auth.status !== "loading" ? (
              <p
                role="status"
                className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--text)]"
              >
                Sign in or create an account from Account settings to save favourites and access them across devices.
              </p>
            ) : null}

            <div
              id={modeHomeDesktopComposerSlotId}
              className="mode-home-composer-slot hidden w-full max-w-3xl [&:not(:empty)]:block"
            />

            <div className="hidden lg:block">
              <SearchResultsHeaderBand modeId="favourites" query={query} matchCount={scopedItems.length} />
            </div>

            <FavouritesMobileQuickViews
              items={items}
              selectedSetId={effectiveSelectedSetId}
              selectedTypeId={selectedTypeId}
              viewMode={viewMode}
              onSelectSet={setSelectedSetId}
              onSelectType={setSelectedTypeId}
              onSelectViewMode={setViewMode}
            />

            <FavouritesMobileBrowseRail
              sets={sets}
              selectedSetId={effectiveSelectedSetId}
              viewMode={viewMode}
              onSelectSet={setSelectedSetId}
              onSelectViewMode={setViewMode}
            />

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

            {showContinueStrip && continueItem ? <ContinueStrip item={continueItem} /> : null}

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
          </div>
        </div>
        {selectedItem ? (
          <ItemWorkspace key={selectedItem.id} item={selectedItem} onClose={() => setSelectedItemId(null)} />
        ) : null}
      </div>
    </main>
  );
}
