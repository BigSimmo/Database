"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsRight,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  Heart,
  MoreVertical,
  Pill,
  Pin,
  Quote,
  Search,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import {
  favouriteSetNames,
  type AccountFavourite,
  type AccountFavouriteSet,
  type FavouriteContentType,
  type FavouriteSetName,
  useOptionalAccountData,
} from "@/components/account-data-provider";
import { AccountSetupDialog } from "@/components/clinical-dashboard/account-setup-dialog";
import { useDismissableLayer } from "@/components/use-dismissable-layer";
import { cn, EmptyState } from "@/components/ui-primitives";
import { Chip, type ChipAppearance } from "@/components/ui/chip";
import {
  favouriteItems as prototypeFavouriteItems,
  favouriteSets as prototypeFavouriteSets,
  favouriteTabs,
  type FavouriteItem as PrototypeFavouriteItem,
} from "@/components/clinical-dashboard/favourites-prototype-data";
import { useSavedRegistryFavourites } from "@/components/clinical-dashboard/use-saved-registry-favourites";
import {
  formatLastOpened,
  lastOpenedScore,
  loadFavouriteLastOpened,
  loadFavouritePinnedIds,
  recordFavouriteOpened,
  subscribeFavouritesStorage,
} from "@/components/favourites/favourites-storage";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { appModeIcons } from "@/lib/app-mode-icons";
import { canAccessFavouritesMode } from "@/lib/app-modes";
import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";
import { modeHomeComposerReservePendingValue, modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { sharedHomePresentation } from "@/lib/ui-copy";
import { useAuthSession } from "@/lib/supabase/client";

type FavouriteType =
  "Medication" | "Document" | "Table" | "Saved search" | "Source" | "Service" | "Form" | "Differential" | "Therapy";
// Previously imported from `favourites-library-nav`, which this redesign
// retired along with the sidebar and the two phone rails it exported.
type ViewMode = "all" | "recent";
type SortMode = "manual" | "last-used" | "title" | "type";

export type FavouriteItem = {
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
  contentType?: FavouriteContentType;
  contentKey?: string;
  setId?: string | null;
  sortOrder?: number;
};

type FavouriteSet = {
  id: string;
  title: string;
  count: number;
  meta?: string;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

// How many rows the Recent card shows before "View all" takes over. Small on
// purpose: this is a glance surface sitting above the real table, not a second
// copy of it.
const recentPreviewLimit = 3;

function subscribeNoop() {
  return () => {};
}

const typeAppearance: Record<FavouriteType, ChipAppearance> = {
  Medication: { kind: "information", tone: "accent" },
  Document: { kind: "category", tone: "document" },
  Table: { kind: "category", tone: "table" },
  "Saved search": { kind: "category", tone: "search" },
  Source: { kind: "category", tone: "source" },
  Service: { kind: "category", tone: "service" },
  Form: { kind: "category", tone: "form" },
  Differential: { kind: "information", tone: "accent" },
  Therapy: { kind: "information", tone: "accent" },
};

const lastUsedByItemId: Record<string, string> = {
  "acamprosate-renal-screen": "Today 08:44",
  "lithium-monitoring-guideline": "Today 08:20",
  "clozapine-monitoring-table": "Yesterday 16:12",
  "renal-dose-search": "Today 07:55",
  "qt-prolongation-quote": "Mon 11:03",
};

const typeByPrototypeType: Record<PrototypeFavouriteItem["type"], FavouriteType> = {
  medications: "Medication",
  documents: "Document",
  sources: "Source",
  services: "Service",
  forms: "Form",
  differentials: "Differential",
  therapies: "Therapy",
};

const fallbackIconByType: Record<PrototypeFavouriteItem["type"], LucideIcon> = {
  medications: Pill,
  documents: FileText,
  sources: Quote,
  services: appModeIcons.services,
  forms: appModeIcons.forms,
  differentials: appModeIcons.differentials,
  therapies: appModeIcons["therapy-compass"],
};

function lastUsedScore(lastUsed: string): number {
  return lastOpenedScore(lastUsed);
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

function toCommandItem(
  item: PrototypeFavouriteItem,
  lastOpenedMap: Record<string, number>,
  pinnedIds: ReadonlySet<string>,
  favouriteMetadata: ReadonlyMap<string, AccountFavourite>,
  setById: ReadonlyMap<string, AccountFavouriteSet>,
  demoMode: boolean = false,
): FavouriteItem {
  const type =
    item.type === "sources" && item.primaryAction === "Run"
      ? "Saved search"
      : (typeByPrototypeType[item.type] ?? "Source");
  const contentType =
    item.type === "services"
      ? "service"
      : item.type === "forms"
        ? "form"
        : item.type === "differentials"
          ? "differential"
          : item.type === "therapies"
            ? "therapy"
            : undefined;
  const contentKey = contentType ? item.id.slice(item.id.indexOf(":") + 1) : undefined;
  const metadata = contentType && contentKey ? favouriteMetadata.get(`${contentType}:${contentKey}`) : undefined;
  const persistedOpened = metadata?.lastOpenedAt ? Date.parse(metadata.lastOpenedAt) : Number.NaN;
  const localOpened = lastOpenedMap[item.id];
  const openedAt = Number.isFinite(persistedOpened) ? Math.max(persistedOpened, localOpened ?? 0) : localOpened;
  return {
    id: item.id,
    title: item.title,
    description: item.meta,
    type,
    tabId: item.type,
    set:
      (metadata?.setId ? setById.get(metadata.setId)?.name : undefined) ||
      item.set ||
      (item.type === "services" ? "Saved services" : item.type === "forms" ? "Saved forms" : "Unsorted"),
    evidence: item.sourceMeta,
    lastUsed:
      openedAt !== undefined
        ? formatLastOpened(openedAt)
        : demoMode && lastUsedByItemId[item.id]
          ? lastUsedByItemId[item.id]
          : "Saved",
    action: item.primaryAction,
    href: item.href,
    icon: item.icon ?? fallbackIconByType[item.type],
    pinned: Boolean(metadata?.pinnedAt) || pinnedIds.has(item.id),
    contentType,
    contentKey,
    setId: metadata?.setId ?? null,
    sortOrder: metadata?.sortOrder ?? 0,
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
  const withOpened = items.filter((item) => lastUsedScore(item.lastUsed) > 1000);
  if (withOpened.length === 0) return null;
  return (
    [...withOpened].sort((first, second) => lastUsedScore(second.lastUsed) - lastUsedScore(first.lastUsed))[0] ?? null
  );
}

function filterAndSortItems(
  items: FavouriteItem[],
  {
    searchTerm,
    selectedTypeIds,
    selectedSetTitles,
    pinnedOnly,
    sourceBackedOnly,
    viewMode,
    sortMode,
  }: {
    searchTerm: string;
    selectedTypeIds: ReadonlySet<string>;
    selectedSetTitles: ReadonlySet<string>;
    pinnedOnly: boolean;
    sourceBackedOnly: boolean;
    viewMode: ViewMode;
    sortMode: SortMode;
  },
): FavouriteItem[] {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const effectiveSort: SortMode = viewMode === "recent" ? "last-used" : sortMode;

  return items
    .filter((item) => viewMode !== "recent" || lastUsedScore(item.lastUsed) > 1000)
    .filter((item) => selectedTypeIds.size === 0 || selectedTypeIds.has(item.tabId))
    .filter((item) => selectedSetTitles.size === 0 || selectedSetTitles.has(item.set))
    .filter((item) => !pinnedOnly || item.pinned === true)
    .filter((item) => !sourceBackedOnly || isSourceBacked(item))
    .filter((item) =>
      normalizedSearch
        ? [item.title, item.description, item.type, item.set, item.evidence].some((field) =>
            field.toLowerCase().includes(normalizedSearch),
          )
        : true,
    )
    .sort((first, second) => {
      if (effectiveSort === "manual")
        return (first.sortOrder ?? 0) - (second.sortOrder ?? 0) || first.title.localeCompare(second.title);
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

function SmallChip({ children, appearance }: { children: React.ReactNode; appearance: ChipAppearance }) {
  return (
    <Chip size="compact" appearance={appearance}>
      {children}
    </Chip>
  );
}

function ContinueStrip({ item, onOpen }: { item: FavouriteItem; onOpen: (item: FavouriteItem) => void }) {
  const Icon = item.icon;
  return (
    <section
      className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--e1)]"
      data-testid="favourites-continue-strip"
    >
      <div className="grid min-h-[3.25rem] grid-cols-[3px_minmax(0,1fr)]">
        <span className="bg-[color:var(--success)]" aria-hidden />
        <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
          <div className="flex min-w-0 items-start gap-3 sm:flex-1">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            <Link href={item.href} onClick={() => onOpen(item)} className={cn("min-w-0 flex-1 text-left", focusRing)}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--success)]">
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
            onClick={() => onOpen(item)}
            aria-label={`Continue ${item.title}`}
            className={cn(
              "inline-flex min-h-tap w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--command-hover)] sm:min-h-9 sm:w-auto",
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
export function RowActionsMenu({
  item,
  sets,
  onMove,
  onRemove,
  onOpen,
}: {
  item: FavouriteItem;
  sets: AccountFavouriteSet[];
  onMove: (item: FavouriteItem, setId: string | null) => Promise<boolean>;
  onRemove: (item: FavouriteItem) => Promise<boolean>;
  onOpen: (item: FavouriteItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [actionPending, setActionPending] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
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
        menuRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), select:not([disabled])") ?? [],
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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
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
          role="dialog"
          aria-label={`Actions for ${item.title}`}
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-[var(--shadow-soft)]"
        >
          <Link
            href={item.href}
            aria-label={`${actionLabel} ${item.title}`}
            className={cn(
              "flex min-h-tap w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
              focusRing,
            )}
            onClick={() => {
              onOpen(item);
              setOpen(false);
            }}
          >
            <ExternalLink className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
            {actionLabel}
          </Link>
          <button
            type="button"
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
          {item.contentType && item.contentKey ? (
            <>
              <label className="grid gap-1 border-t border-[color:var(--border)] px-3 py-2 text-2xs font-semibold text-[color:var(--text-muted)]">
                Move to set
                <select
                  aria-label={`Move ${item.title} to set`}
                  value={item.setId ?? ""}
                  disabled={actionPending}
                  onChange={async (event) => {
                    setActionPending(true);
                    try {
                      const moved = await onMove(item, event.target.value || null);
                      setActionStatus(moved ? `${item.title} moved` : `Could not move ${item.title}`);
                      if (moved) setOpen(false);
                    } catch {
                      setActionStatus(`Could not move ${item.title}`);
                    } finally {
                      setActionPending(false);
                    }
                  }}
                  className="min-h-9 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-sm text-[color:var(--text)]"
                >
                  <option value="">Unsorted</option>
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={actionPending}
                className={cn(
                  "flex min-h-tap w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)] disabled:opacity-60",
                  focusRing,
                )}
                onClick={async () => {
                  setActionPending(true);
                  try {
                    const removed = await onRemove(item);
                    setActionStatus(removed ? `${item.title} removed` : `Could not remove ${item.title}`);
                    if (removed) setOpen(false);
                  } catch {
                    setActionStatus(`Could not remove ${item.title}`);
                  } finally {
                    setActionPending(false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {actionPending ? "Updating…" : "Remove favourite"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copyStatus === "copied"
          ? `${item.title} citation copied`
          : copyStatus === "failed"
            ? "Unable to copy citation"
            : ""}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {actionStatus}
      </span>
    </div>
  );
}

function FavouriteMobileCard({
  item,
  sets,
  onMove,
  onRemove,
  onOpen,
}: {
  item: FavouriteItem;
  sets: AccountFavouriteSet[];
  onMove: (item: FavouriteItem, setId: string | null) => Promise<boolean>;
  onRemove: (item: FavouriteItem) => Promise<boolean>;
  onOpen: (item: FavouriteItem) => void;
}) {
  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e1)]">
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm-minus font-bold leading-5 text-[color:var(--text-heading)]">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
          {item.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SmallChip appearance={typeAppearance[item.type]}>{item.type}</SmallChip>
          {isSourceBacked(item) ? (
            <SmallChip appearance={{ kind: "status", tone: "success" }}>Source-backed</SmallChip>
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
          onClick={() => onOpen(item)}
          aria-label={`Open ${item.title}`}
          className={cn(
            "inline-flex h-tap min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-sm-minus font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
            focusRing,
          )}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open
        </Link>
        <RowActionsMenu item={item} sets={sets} onMove={onMove} onRemove={onRemove} onOpen={onOpen} />
      </div>
    </article>
  );
}

// One empty state, rendered by whichever of the table / mobile-card layouts the
// breakpoint is showing. Filters and the search term change without a navigation,
// so the shared primitive's polite announcement is the right default here.
function FavouritesEmptyMatches() {
  return (
    <EmptyState
      icon={Search}
      title="No favourites match"
      body="Clear filters or search to show saved clinical work."
      testId="favourites-empty-matches"
      live="polite"
    />
  );
}

/**
 * The empty-query dashboard band. Both cards read from the same derived data
 * the table does — no separate store — so they cannot drift from it.
 */
function FavouritesDashboardBand({
  recentItems,
  sets,
  onSelectSet,
  onShowRecent,
  onOpen,
}: {
  recentItems: FavouriteItem[];
  sets: FavouriteSet[];
  onSelectSet: (id: string) => void;
  onShowRecent: () => void;
  onOpen: (item: FavouriteItem) => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      <section
        data-testid="favourites-recent-card"
        aria-labelledby="favourites-recent-heading"
        className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-3.5 py-2.5">
          <h2
            id="favourites-recent-heading"
            className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]"
          >
            <Clock className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
            Recent
          </h2>
          <button
            type="button"
            onClick={onShowRecent}
            className={cn(
              "inline-flex min-h-tap items-center rounded-lg px-2 text-xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)] sm:min-h-9",
              focusRing,
            )}
          >
            View all
          </button>
        </div>
        {recentItems.length === 0 ? (
          <p className="px-3.5 py-4 text-xs font-medium text-[color:var(--text-muted)]">
            Recently opened favourites will appear here as you use them.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {recentItems.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
                <Chip size="compact" appearance={typeAppearance[item.type]}>
                  {item.type}
                </Chip>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">{item.title}</span>
                  <span className="truncate text-2xs font-medium text-[color:var(--text-muted)]">
                    {item.set} · {item.lastUsed}
                  </span>
                </span>
                <Link
                  href={item.href}
                  onClick={() => onOpen(item)}
                  aria-label={`Open ${item.title}`}
                  className={cn(
                    "inline-flex min-h-tap shrink-0 items-center rounded-lg border border-[color:var(--border)] px-2.5 text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] sm:min-h-9",
                    focusRing,
                  )}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        data-testid="favourites-sets-card"
        aria-labelledby="favourites-sets-heading"
        className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-3.5 py-2.5">
          <h2
            id="favourites-sets-heading"
            className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
            Your sets
          </h2>
        </div>
        {sets.length === 0 ? (
          <p className="px-3.5 py-4 text-xs font-medium text-[color:var(--text-muted)]">
            Saved items group into sets as you add them.
          </p>
        ) : (
          <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {sets.map((set) => (
              <li key={set.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectSet(set.id)}
                  className={cn(
                    "flex min-h-tap w-full min-w-0 flex-col items-start gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-left hover:bg-[color:var(--surface)]",
                    focusRing,
                  )}
                >
                  <span className="flex min-w-0 max-w-full items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
                    <span className="truncate text-xs font-bold text-[color:var(--text-heading)]">{set.title}</span>
                  </span>
                  <span className="nums text-2xs font-medium text-[color:var(--text-muted)]">
                    {set.count} {set.count === 1 ? "item" : "items"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FavouritesTable({
  items,
  rows: tableRows,
  searchTerm,
  viewMode,
  sortMode,
  selectedItemId,
  sets,
  onSortModeChange,
  onSelectItem,
  onMove,
  onRemove,
  onOpen,
}: {
  items: FavouriteItem[];
  // The filtered/sorted rows are computed once by the page and passed in.
  // They used to be derived here as well, from the same inputs, so the band's
  // match count and the table's own count were two independent answers to one
  // question — the redundant half of the "dual search" ledger #164 names.
  rows: FavouriteItem[];
  searchTerm: string;
  viewMode: ViewMode;
  sortMode: SortMode;
  selectedItemId: string | null;
  sets: AccountFavouriteSet[];
  onSortModeChange: (value: SortMode) => void;
  onSelectItem: (id: string) => void;
  onMove: (item: FavouriteItem, setId: string | null) => Promise<boolean>;
  onRemove: (item: FavouriteItem) => Promise<boolean>;
  onOpen: (item: FavouriteItem) => void;
}) {
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
        <p className="inline-flex min-w-0 items-center gap-1.5 text-2xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]">
          {searchTerm.trim() ? (
            <>
              <Search className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
              <span className="nums font-bold text-[color:var(--text-heading)]">{tableRows.length}</span>
              {tableRows.length === 1 ? "match for" : "matches for"}
              <span className="truncate font-bold normal-case text-[color:var(--text-heading)]">
                “{searchTerm.trim()}”
              </span>
            </>
          ) : (
            <>
              <Heart className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
              <span className="nums font-bold text-[color:var(--text-heading)]">{tableRows.length}</span>
              {tableRows.length === 1 ? "item" : "items"}
              {tableRows.length !== items.length ? ` of ${items.length}` : ""}
            </>
          )}
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
              <option value="manual">Sort: Manual order</option>
              <option value="last-used">Sort: Last used</option>
              <option value="title">Sort: Title</option>
              <option value="type">Sort: Type</option>
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--decoration-soft)]"
            />
          </label>
        </div>
      </div>

      <div className={tableRows.length === 0 ? "hidden" : "hidden overflow-x-auto sm:block"}>
        <table aria-label="Saved favourites" className="w-full min-w-[34rem] table-fixed border-collapse text-left">
          <thead>
            <tr className="h-9 border-b border-[color:var(--border)] bg-[color:var(--surface-wash)] text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
                      onClick={() => onOpen(item)}
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
                    <SmallChip appearance={typeAppearance[item.type]}>{item.type}</SmallChip>
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
                        onClick={() => onOpen(item)}
                        aria-label={`Open ${item.title}`}
                        className={cn(
                          "inline-flex h-9 min-w-16 items-center justify-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-2xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                          focusRing,
                        )}
                      >
                        Open
                      </Link>
                      <RowActionsMenu item={item} sets={sets} onMove={onMove} onRemove={onRemove} onOpen={onOpen} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className={
          tableRows.length === 0 ? "hidden" : "grid min-w-0 gap-3 bg-[color:var(--surface-wash)] p-3 sm:hidden"
        }
      >
        {tableRows.map((item) => (
          <FavouriteMobileCard
            key={item.id}
            item={item}
            sets={sets}
            onMove={onMove}
            onRemove={onRemove}
            onOpen={onOpen}
          />
        ))}
      </div>

      {tableRows.length === 0 ? (
        <div className="bg-[color:var(--surface-wash)] p-3 sm:p-4">
          <FavouritesEmptyMatches />
        </div>
      ) : null}
    </section>
  );
}

function ItemWorkspace({
  item,
  sets,
  onClose,
  onMove,
  onRemove,
  onReorder,
  onOpen,
}: {
  item: FavouriteItem;
  sets: AccountFavouriteSet[];
  onClose: () => void;
  onMove: (item: FavouriteItem, setId: string | null) => Promise<boolean>;
  onRemove: (item: FavouriteItem) => Promise<boolean>;
  onReorder: (item: FavouriteItem, direction: -1 | 1) => Promise<boolean>;
  onOpen: (item: FavouriteItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "evidence" | "notes">("summary");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationStatus, setMutationStatus] = useState("");
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
              <SmallChip appearance={typeAppearance[item.type]}>{item.type}</SmallChip>
              {isSourceBacked(item) ? (
                <SmallChip appearance={{ kind: "status", tone: "success" }}>Source-backed</SmallChip>
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
            <p className="text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              Next action
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{item.description}</p>
            <p className="mt-1 text-2xs font-medium text-[color:var(--text-muted)]">Saved action: {actionLabel}</p>
            <Link
              href={item.href}
              onClick={() => onOpen(item)}
              className={cn(
                "mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--command-hover)]",
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
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
            <h3 className="mb-2 text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
          <h3 className="mb-2 text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
            {item.contentType && item.contentKey ? (
              <>
                <label className="grid gap-1 text-2xs font-semibold text-[color:var(--text-muted)]">
                  Move to set
                  <select
                    value={item.setId ?? ""}
                    disabled={mutationPending}
                    onChange={async (event) => {
                      setMutationPending(true);
                      try {
                        const moved = await onMove(item, event.target.value || null);
                        setMutationStatus(moved ? "Favourite moved." : "Favourite could not be moved.");
                      } catch {
                        setMutationStatus("Favourite could not be moved.");
                      } finally {
                        setMutationPending(false);
                      }
                    }}
                    className="min-h-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)]"
                  >
                    <option value="">Unsorted</option>
                    {sets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([-1, 1] as const).map((direction) => {
                    const DirectionIcon = direction === -1 ? ArrowUp : ArrowDown;
                    return (
                      <button
                        key={direction}
                        type="button"
                        disabled={mutationPending}
                        onClick={async () => {
                          setMutationPending(true);
                          try {
                            const reordered = await onReorder(item, direction);
                            setMutationStatus(
                              reordered ? "Favourite order updated." : "Favourite order could not be updated.",
                            );
                          } catch {
                            setMutationStatus("Favourite order could not be updated.");
                          } finally {
                            setMutationPending(false);
                          }
                        }}
                        className={cn(
                          "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)] disabled:opacity-60",
                          focusRing,
                        )}
                      >
                        <DirectionIcon className="h-4 w-4" aria-hidden />
                        {direction === -1 ? "Move up" : "Move down"}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={mutationPending}
                  onClick={async () => {
                    setMutationPending(true);
                    try {
                      const removed = await onRemove(item);
                      setMutationStatus(removed ? "Favourite removed." : "Favourite could not be removed.");
                      if (removed) onClose();
                    } catch {
                      setMutationStatus("Favourite could not be removed.");
                    } finally {
                      setMutationPending(false);
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-9 items-center justify-start gap-2 rounded-lg border border-[color:var(--danger-border)] bg-transparent px-3 text-sm font-bold text-[color:var(--danger)] disabled:opacity-60",
                    focusRing,
                  )}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {mutationPending ? "Updating…" : "Remove favourite"}
                </button>
                <p role="status" aria-live="polite" className="text-xs font-semibold text-[color:var(--text-muted)]">
                  {mutationStatus}
                </p>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </aside>
  );
}

export function FavouritesCommandLibraryPage({ query = "", demoMode }: { query?: string; demoMode: boolean }) {
  const router = useRouter();
  const auth = useAuthSession();
  const accountData = useOptionalAccountData();
  const searchCommand = useSearchCommand();
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  // The route's submitted `?q=` server-renders the exact list on a hard load;
  // after hydration the shared composer's live draft owns it. That is what
  // makes the typed query filter this page in place — no navigation, no second
  // input, and no ModeHome to bounce through (ledger #164). The composer is
  // still the one and only composer on the route, so the one-composer contract
  // in docs/search-chrome-behaviour.md is untouched.
  const activeQuery = hydrated ? (searchCommand?.query ?? query) : query;
  const favouritesAccessible = canAccessFavouritesMode({
    authenticated: auth.status === "authenticated",
    demoMode,
  });
  const authSettled = auth.status !== "loading";
  const [accountSetupDismissed, setAccountSetupDismissed] = useState(false);
  const accountSetupOpen = authSettled && !favouritesAccessible && !accountSetupDismissed;
  const {
    items: savedRegistryFavourites,
    status: favouritesHookStatus,
    refetch: refetchFavouritesRegistry,
  } = useSavedRegistryFavourites();
  const lastOpenedMap = useSyncExternalStore(
    subscribeFavouritesStorage,
    loadFavouriteLastOpened,
    () => ({}) as Record<string, number>,
  );
  const pinnedIds = useSyncExternalStore(subscribeFavouritesStorage, loadFavouritePinnedIds, () => new Set<string>());
  const favouriteMetadata = useMemo(
    () =>
      new Map(
        (accountData?.favouriteItems ?? []).map((item) => [`${item.contentType}:${item.contentKey}`, item] as const),
      ),
    [accountData?.favouriteItems],
  );
  const setById = useMemo(
    () => new Map((accountData?.favouriteSets ?? []).map((set) => [set.id, set] as const)),
    [accountData?.favouriteSets],
  );
  const items = useMemo(
    () =>
      [...(demoMode ? prototypeFavouriteItems : []), ...savedRegistryFavourites].map((item) =>
        toCommandItem(item, lastOpenedMap, pinnedIds, favouriteMetadata, setById, demoMode),
      ),
    [demoMode, savedRegistryFavourites, lastOpenedMap, pinnedIds, favouriteMetadata, setById],
  );
  // Demo prototypes live outside the hook. If they are the only items while a
  // registry/account read failed, keep their honest nonzero count but mark it
  // partial so it cannot be mistaken for the complete saved library.
  const favouritesRegistryStatus =
    items.length > 0 &&
    (favouritesHookStatus === "partial" || favouritesHookStatus === "error" || favouritesHookStatus === "unauthorized")
      ? "partial"
      : items.length > 0
        ? "ready"
        : favouritesHookStatus;
  const sets = useMemo(() => buildFavouriteSets(items), [items]);
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTypeIds, setSelectedTypeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedSetIds, setSelectedSetIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sourceBackedOnly, setSourceBackedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemSnapshot, setSelectedItemSnapshot] = useState<FavouriteItem | null>(null);
  const [newSetName, setNewSetName] = useState<FavouriteSetName>(favouriteSetNames[0]);
  const [setMutationPending, setSetMutationPending] = useState(false);
  const [setMutationStatus, setSetMutationStatus] = useState("");

  const effectiveSelectedSetIds = useMemo(
    () => new Set([...selectedSetIds].filter((id) => sets.some((set) => set.id === id))),
    [selectedSetIds, sets],
  );
  const selectedSetTitles = useMemo(
    () => new Set(sets.filter((set) => effectiveSelectedSetIds.has(set.id)).map((set) => set.title)),
    [effectiveSelectedSetIds, sets],
  );

  // Single source of truth for "what is in the list right now". The band's
  // match count, the Continue gate, the empty-state branch and the table all
  // read this one value.
  const filteredItems = useMemo(
    () =>
      filterAndSortItems(items, {
        searchTerm: activeQuery,
        selectedTypeIds,
        selectedSetTitles,
        pinnedOnly,
        sourceBackedOnly,
        viewMode,
        sortMode,
      }),
    [items, activeQuery, selectedTypeIds, selectedSetTitles, pinnedOnly, sourceBackedOnly, viewMode, sortMode],
  );
  const continueItem = useMemo(() => getMostRecentlyUsedItem(items), [items]);
  const showContinueStrip =
    continueItem !== null && filteredItems.some((item) => item.id === continueItem.id) && filteredItems.length > 0;
  const recentItems = useMemo(
    () =>
      items
        .filter((item) => lastOpenedScore(item.lastUsed) > 1000)
        .sort((first, second) => lastOpenedScore(second.lastUsed) - lastOpenedScore(first.lastUsed))
        .slice(0, recentPreviewLimit),
    [items],
  );
  const searching = activeQuery.trim().length > 0;

  const selectedItem = selectedItemId
    ? (items.find((item) => item.id === selectedItemId) ??
      (selectedItemSnapshot?.id === selectedItemId ? selectedItemSnapshot : null))
    : null;

  const availableSetNames = favouriteSetNames.filter(
    (name) => !(accountData?.favouriteSets ?? []).some((set) => set.name === name),
  );
  const effectiveNewSetName = availableSetNames.includes(newSetName) ? newSetName : availableSetNames[0];

  function clearSearch() {
    router.push("/favourites");
  }

  function clearAllFilters() {
    setSelectedSetIds(new Set());
    setSelectedTypeIds(new Set());
    setPinnedOnly(false);
    setSourceBackedOnly(false);
  }

  async function handleRemove(item: FavouriteItem) {
    if (!item.contentType || !item.contentKey) return false;
    return accountData?.setFavourite(item.contentType, item.contentKey, false) ?? false;
  }

  async function handleMove(item: FavouriteItem, setId: string | null) {
    if (!item.contentType || !item.contentKey) return false;
    return accountData?.moveFavourite(item.contentType, item.contentKey, setId) ?? false;
  }

  async function handleReorder(item: FavouriteItem, direction: -1 | 1) {
    if (!item.contentType || !item.contentKey) return false;
    return accountData?.reorderFavourite(item.contentType, item.contentKey, direction === -1 ? "up" : "down") ?? false;
  }

  function handleOpen(item: FavouriteItem) {
    recordFavouriteOpened(item.id);
    if (item.contentType && item.contentKey) {
      void accountData?.recordFavouriteOpen(item.contentType, item.contentKey);
    }
  }

  const toggleSet = (id: string) => {
    const next = new Set(effectiveSelectedSetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSetIds(next);
  };
  const toggleType = (id: string) => {
    const next = new Set(selectedTypeIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTypeIds(next);
  };
  const countWith = ({
    typeIds = selectedTypeIds,
    setIds = effectiveSelectedSetIds,
    pinned = pinnedOnly,
    sourceBacked = sourceBackedOnly,
  }: {
    typeIds?: ReadonlySet<string>;
    setIds?: ReadonlySet<string>;
    pinned?: boolean;
    sourceBacked?: boolean;
  }) => {
    const setTitles = new Set(sets.filter((set) => setIds.has(set.id)).map((set) => set.title));
    return filterAndSortItems(items, {
      searchTerm: activeQuery,
      selectedTypeIds: typeIds,
      selectedSetTitles: setTitles,
      pinnedOnly: pinned,
      sourceBackedOnly: sourceBacked,
      viewMode,
      sortMode,
    }).length;
  };
  const setOptions = sets.map((set) => {
    const projected = effectiveSelectedSetIds.has(set.id)
      ? effectiveSelectedSetIds
      : new Set([...effectiveSelectedSetIds, set.id]);
    const count = countWith({ setIds: projected });
    return {
      value: set.id,
      label: set.title,
      hint: String(count),
      disabled: !effectiveSelectedSetIds.has(set.id) && count === 0,
    };
  });
  const typeOptions = favouriteTabs
    .filter((tab) => tab.id !== "all" && tab.id !== "sets")
    .map((tab) => {
      const projected = selectedTypeIds.has(tab.id) ? selectedTypeIds : new Set([...selectedTypeIds, tab.id]);
      const count = countWith({ typeIds: projected });
      return {
        value: tab.id,
        label: tab.label,
        hint: String(count),
        disabled: !selectedTypeIds.has(tab.id) && count === 0,
      };
    })
    .filter((option) => items.some((item) => item.tabId === option.value) || selectedTypeIds.has(option.value));
  const pinnedCount = countWith({ pinned: true });
  const sourceBackedCount = countWith({ sourceBacked: true });
  const activeFilterCount =
    effectiveSelectedSetIds.size + selectedTypeIds.size + Number(pinnedOnly) + Number(sourceBackedOnly);
  const filterGroups = [
    resultFilterFacetGroup({
      id: "set",
      label: "Set",
      selected: effectiveSelectedSetIds,
      options: setOptions,
      onToggle: toggleSet,
    }),
    resultFilterFacetGroup({
      id: "type",
      label: "Type",
      selected: selectedTypeIds,
      options: typeOptions,
      onToggle: toggleType,
    }),
    resultFilterFacetGroup({
      id: "pinned",
      label: "Pinned",
      selected: new Set(pinnedOnly ? ["pinned"] : []),
      options: [
        {
          value: "pinned",
          label: "Pinned only",
          hint: String(pinnedCount),
          disabled: !pinnedOnly && pinnedCount === 0,
        },
      ],
      onToggle: () => setPinnedOnly((current) => !current),
    }),
    resultFilterFacetGroup({
      id: "source",
      label: "Source support",
      selected: new Set(sourceBackedOnly ? ["source-backed"] : []),
      options: [
        {
          value: "source-backed",
          label: "Source-backed only",
          hint: String(sourceBackedCount),
          disabled: !sourceBackedOnly && sourceBackedCount === 0,
        },
      ],
      onToggle: () => setSourceBackedOnly((current) => !current),
    }),
  ];
  const appliedFilters = [
    ...[...effectiveSelectedSetIds].map((id) => ({
      id: `set-${id}`,
      groupLabel: "Set",
      valueLabel: sets.find((set) => set.id === id)?.title ?? id,
      onRemove: () => toggleSet(id),
    })),
    ...[...selectedTypeIds].map((id) => ({
      id: `type-${id}`,
      groupLabel: "Type",
      valueLabel: favouriteTabs.find((tab) => tab.id === id)?.label ?? id,
      onRemove: () => toggleType(id),
    })),
    ...(pinnedOnly
      ? [{ id: "pinned", groupLabel: "Status", valueLabel: "Pinned", onRemove: () => setPinnedOnly(false) }]
      : []),
    ...(sourceBackedOnly
      ? [
          {
            id: "source-backed",
            groupLabel: "Support",
            valueLabel: "Source-backed",
            onRemove: () => setSourceBackedOnly(false),
          },
        ]
      : []),
  ];

  if (!favouritesAccessible) {
    return (
      <main
        data-testid="favourites-hub"
        className="min-h-0 overflow-x-clip bg-[color:var(--background)] pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:pb-32 md:pb-0"
      >
        <div className="mx-auto grid min-w-0 max-w-[40rem] gap-4 px-4 py-8 sm:px-6">
          <header data-testid="favourites-command-library" className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <h1 className="text-balance text-2xl-minus font-bold leading-tight tracking-tight text-[color:var(--text-heading)] sm:text-2xl">
              {sharedHomePresentation.favourites.title}
            </h1>
            <p className="text-pretty text-sm-minus font-medium leading-6 text-[color:var(--text-muted)]">
              Sign up to save favourites and access them across devices.
            </p>
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
                className="mt-3 inline-flex min-h-tap items-center justify-center rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)] transition hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
      className="min-h-0 overflow-x-clip bg-[color:var(--background)] pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:pb-32 md:pb-0"
    >
      <div
        className={cn(
          "grid min-h-0 min-w-0 overflow-x-clip sm:min-h-[calc(100dvh-var(--shell-header-h))]",
          // The left library rail is gone — sets, quick views and types are one
          // chip rail now (ledger #164), so the workspace is a single column
          // that only splits when the item workspace opens.
          selectedItem && "xl:grid-cols-[minmax(0,1fr)_23rem]",
        )}
      >
        <div className="min-w-0 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-7">
          <div className="mx-auto grid min-w-0 max-w-[66rem] gap-3 2xl:max-w-[72rem]">
            {/* The marketing lockup is retired (ledger #164): an icon tile, a
                "command library" title and a sentence explaining the page to
                someone already standing on it cost the fold about 90px and
                said nothing the nav had not. The count is the only thing worth
                saying here, and it is not a heading. */}
            <header data-testid="favourites-command-library" className="flex min-w-0 flex-wrap items-baseline gap-x-3">
              <h1 className="text-balance text-2xl-minus font-bold leading-tight tracking-tight text-[color:var(--text-heading)] sm:text-2xl">
                {sharedHomePresentation.favourites.title}
              </h1>
              <p className="nums text-sm font-medium text-[color:var(--text-muted)]">
                {items.length} {items.length === 1 ? "item" : "items"}
              </p>
            </header>

            {!demoMode && auth.status === "authenticated" ? (
              <section
                aria-label="Manage favourite sets"
                className="flex flex-wrap items-end gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <label className="grid min-w-[12rem] flex-1 gap-1 text-2xs font-semibold text-[color:var(--text-muted)]">
                  New controlled set
                  <select
                    value={effectiveNewSetName ?? ""}
                    disabled={setMutationPending || availableSetNames.length === 0}
                    onChange={(event) => setNewSetName(event.target.value as FavouriteSetName)}
                    className="min-h-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)]"
                  >
                    {availableSetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={setMutationPending || availableSetNames.length === 0}
                  onClick={async () => {
                    const name = effectiveNewSetName;
                    if (!name) return;
                    setSetMutationPending(true);
                    try {
                      const created = await accountData?.createFavouriteSet(name);
                      setSetMutationStatus(
                        created ? `${created.name} set created.` : "Favourite set could not be created.",
                      );
                      if (created) {
                        const remaining = availableSetNames.filter((candidate) => candidate !== name);
                        if (remaining[0]) setNewSetName(remaining[0]);
                      }
                    } catch {
                      setSetMutationStatus("Favourite set could not be created.");
                    } finally {
                      setSetMutationPending(false);
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent-contrast)] disabled:opacity-60",
                    focusRing,
                  )}
                >
                  <FolderPlus className="h-4 w-4" aria-hidden />
                  {setMutationPending ? "Creating…" : "Create set"}
                </button>
                <p
                  role="status"
                  aria-live="polite"
                  className="w-full text-xs font-semibold text-[color:var(--text-muted)]"
                >
                  {setMutationStatus || accountData?.error || "Set names are limited to approved clinical workflows."}
                </p>
              </section>
            ) : null}

            {!demoMode && auth.status !== "authenticated" && auth.status !== "loading" ? (
              <p
                role="status"
                className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--text)]"
              >
                Sign in or create an account from Account settings to save favourites and access them across devices.
              </p>
            ) : null}

            <DesktopComposerPortalSlot
              id={modeHomeDesktopComposerSlotId}
              data-composer-reserve={modeHomeComposerReservePendingValue}
              className="mode-home-composer-slot block w-full max-w-3xl min-h-0 data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-phone)] sm:data-[composer-reserve=pending]:min-h-[var(--spacing-mode-home-composer-wide)] [&:not(:empty)]:min-h-[var(--spacing-mode-home-composer-phone)] sm:[&:not(:empty)]:min-h-[var(--spacing-mode-home-composer-wide)]"
            />

            <SearchResultsHeaderBand
              modeId="favourites"
              query={activeQuery}
              matchCount={filteredItems.length}
              // Without this a failed registry read renders as "0 matches", which
              // reads as "you have no saved favourites" rather than "we could not
              // load them". `partial` keeps unaffected items (local
              // differentials, etc.) visible without presenting their nonzero
              // count as the complete library.
              status={favouritesRegistryStatus}
              onRetry={
                favouritesRegistryStatus === "error" || favouritesRegistryStatus === "partial"
                  ? refetchFavouritesRegistry
                  : undefined
              }
              filterLabel="Active favourites filters"
              mobileControlsPlacement="inline"
              mobileControls={
                <ResultFilterTrigger
                  panelId={filterPanelId}
                  testId="favourites-filter-trigger-phone"
                  title="Filter favourites"
                  open={filterOpen}
                  activeCount={activeFilterCount}
                  onToggle={() => setFilterOpen((current) => !current)}
                />
              }
              filterControls={
                <ResultFilterTrigger
                  panelId={filterPanelId}
                  testId="favourites-filter-trigger-desktop"
                  title="Filter favourites"
                  open={filterOpen}
                  activeCount={activeFilterCount}
                  onToggle={() => setFilterOpen((current) => !current)}
                />
              }
              utilityControls={
                <button
                  type="button"
                  aria-pressed={viewMode === "recent"}
                  onClick={() => setViewMode((current) => (current === "recent" ? "all" : "recent"))}
                  className={cn(
                    "search-band-ghost inline-flex min-h-tap items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold sm:min-h-10",
                    viewMode === "recent"
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                    focusRing,
                  )}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Recently used
                </button>
              }
              appliedFilters={appliedFilters}
              onClearFilters={activeFilterCount > 0 ? clearAllFilters : undefined}
            />

            <ResultFilterSheet
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              panelId={filterPanelId}
              testId="favourites-filter-panel"
              title="Filter favourites"
              description="Combine sets, item types, pinned status and source support. Recently used remains a view choice."
              chromeResetKey={[
                activeQuery,
                Array.from(effectiveSelectedSetIds).sort().join(","),
                Array.from(selectedTypeIds).sort().join(","),
                String(pinnedOnly),
                String(sourceBackedOnly),
              ].join("|")}
              groups={filterGroups}
              onClearAll={activeFilterCount > 0 ? clearAllFilters : undefined}
              summary={{ count: filteredItems.length, noun: filteredItems.length === 1 ? "favourite" : "favourites" }}
            />

            {showContinueStrip && continueItem ? <ContinueStrip item={continueItem} onOpen={handleOpen} /> : null}

            {/* Empty query is a dashboard; a typed query is a filtered table.
                Typing does not swap surfaces or navigate — the dashboard band
                demotes to a collapsed disclosure and the table filters in
                place beneath it (ledger #164). */}
            {items.length > 0 && !searching ? (
              <FavouritesDashboardBand
                recentItems={recentItems}
                sets={sets}
                onSelectSet={(id) => setSelectedSetIds(new Set([id]))}
                onShowRecent={() => setViewMode("recent")}
                onOpen={handleOpen}
              />
            ) : null}

            {/* Only a successful read can say "no matches". While loading or
                faulted an empty list means we could not look, not that the
                library is empty; the band's fault panel reports that. */}
            {searching && filteredItems.length === 0 && favouritesRegistryStatus === "ready" ? (
              <SearchResultsEmptyState
                modeId="favourites"
                query={activeQuery}
                appliedFilters={appliedFilters}
                onClearFilters={activeFilterCount > 0 ? clearAllFilters : undefined}
                onClearSearch={clearSearch}
              />
            ) : (
              <FavouritesTable
                items={items}
                rows={filteredItems}
                searchTerm={activeQuery}
                viewMode={viewMode}
                sortMode={sortMode}
                selectedItemId={selectedItemId}
                sets={accountData?.favouriteSets ?? []}
                onSortModeChange={setSortMode}
                onSelectItem={(id) => {
                  if (id) {
                    const item = items.find((candidate) => candidate.id === id);
                    setSelectedItemSnapshot(item ?? null);
                    if (item) handleOpen(item);
                  }
                  setSelectedItemId(id);
                }}
                onMove={handleMove}
                onRemove={handleRemove}
                onOpen={handleOpen}
              />
            )}

            {items.length > 0 && searching ? (
              <details
                data-testid="favourites-recent-disclosure"
                className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
              >
                <summary
                  className={cn(
                    "flex min-h-tap cursor-pointer list-none items-center gap-1.5 px-3.5 text-2xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]",
                    focusRing,
                  )}
                >
                  <Clock className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
                  Recent
                </summary>
                <ul className="divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
                  {recentItems.map((item) => (
                    <li key={item.id} className="flex min-w-0 items-center gap-2.5 px-3.5 py-2.5">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold text-[color:var(--text-heading)]">
                          {item.title}
                        </span>
                        <span className="truncate text-2xs font-medium text-[color:var(--text-muted)]">
                          {item.set} · {item.lastUsed}
                        </span>
                      </span>
                      <Link
                        href={item.href}
                        onClick={() => handleOpen(item)}
                        aria-label={`Open ${item.title}`}
                        className={cn(
                          "inline-flex min-h-tap shrink-0 items-center rounded-lg border border-[color:var(--border)] px-2.5 text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] sm:min-h-9",
                          focusRing,
                        )}
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <UniversalSearchAlsoMatches modeId="favourites" query={activeQuery} />
          </div>
        </div>
        {selectedItem ? (
          <ItemWorkspace
            key={selectedItem.id}
            item={selectedItem}
            sets={accountData?.favouriteSets ?? []}
            onClose={() => {
              setSelectedItemId(null);
              setSelectedItemSnapshot(null);
            }}
            onMove={handleMove}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onOpen={handleOpen}
          />
        ) : null}
      </div>
    </main>
  );
}
