"use client";

import { Folder, Pin, Trash2, X } from "lucide-react";

import { FavouriteRow, type FavouriteRowMode } from "@/components/favourites/favourite-row";
import type { FavouriteGroup, FavouriteItem, FavouritesView } from "@/components/favourites/favourites-view-model";
import { cn } from "@/components/ui-primitives";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export type FavouritesListHandlers = {
  onOpen: (item: FavouriteItem) => void;
  onSelectForWorkspace: (item: FavouriteItem) => void;
  onShowActions: (item: FavouriteItem) => void;
  onTogglePin: (item: FavouriteItem) => void;
  onMove: (item: FavouriteItem) => void;
  onRemove: (item: FavouriteItem) => void;
  onToggleSelected: (item: FavouriteItem) => void;
};

/** The one list: grouped by day, type or nothing, one row per favourite. */
export function FavouritesList({
  groups,
  view,
  now,
  showSet,
  mode,
  selectedIds,
  workspaceItemId,
  openSwipeId,
  onOpenSwipeChange,
  canMutate,
  handlers,
  reorder,
}: {
  groups: FavouriteGroup[];
  view: FavouritesView;
  now: number;
  showSet: boolean;
  mode: FavouriteRowMode;
  selectedIds: ReadonlySet<string>;
  workspaceItemId: string | null;
  openSwipeId: string | null;
  onOpenSwipeChange: (id: string | null) => void;
  canMutate: (item: FavouriteItem) => boolean;
  handlers: FavouritesListHandlers;
  reorder?: { pending: boolean; onMove: (item: FavouriteItem, direction: -1 | 1) => void };
}) {
  return (
    <div className="grid gap-4" data-testid="favourites-list">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={group.label ? `favourites-group-${group.id}` : undefined}
          aria-label={group.label ? undefined : "Favourites"}
          className="grid gap-2"
        >
          {group.label ? (
            <h3
              id={`favourites-group-${group.id}`}
              className="flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]"
            >
              {group.label}
              {view === "type" ? (
                <span className="nums font-medium normal-case tracking-normal">{group.items.length}</span>
              ) : null}
            </h3>
          ) : null}
          <ul className="divide-y divide-[color:var(--border)] overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--e1)]">
            {group.items.map((item, index) => (
              <FavouriteRow
                key={item.id}
                item={item}
                view={view}
                now={now}
                showSet={showSet}
                mode={mode}
                selected={selectedIds.has(item.id)}
                workspaceSelected={workspaceItemId === item.id}
                swipeOpen={openSwipeId === item.id}
                onSwipeOpenChange={(open) => onOpenSwipeChange(open ? item.id : null)}
                canMutate={canMutate(item)}
                {...handlers}
                reorder={
                  reorder
                    ? {
                        canMoveUp: index > 0,
                        canMoveDown: index < group.items.length - 1,
                        pending: reorder.pending,
                        onMove: reorder.onMove,
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Floating bar for Select mode: pin, move or remove everything ticked. */
export function FavouritesSelectBar({
  count,
  onPin,
  onMove,
  onRemove,
  onDone,
}: {
  count: number;
  onPin: () => void;
  onMove: () => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const none = count === 0;
  const action = cn(
    "inline-flex min-h-tap items-center gap-1.5 rounded-xl px-3 text-sm font-semibold disabled:text-[color:var(--disabled)]",
    focusRing,
  );
  return (
    <div
      role="toolbar"
      aria-label="Selected favourites"
      data-testid="favourites-select-bar"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[var(--z-chrome)] mx-auto flex max-w-lg items-center gap-1.5 rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-2 shadow-[var(--e4)]"
    >
      <button
        type="button"
        onClick={onDone}
        aria-label="Leave select mode"
        className={cn(
          "grid size-tap shrink-0 place-items-center rounded-xl text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          focusRing,
        )}
      >
        <X className="size-icon-md" aria-hidden="true" />
      </button>
      <span className="nums min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-heading)]">
        {none ? "Tap to select" : `${count} selected`}
      </span>
      <button
        type="button"
        disabled={none}
        onClick={onPin}
        className={cn(action, "bg-[color:var(--surface-inset)] text-[color:var(--text-heading)]")}
      >
        <Pin className="size-icon-sm" aria-hidden="true" />
        Pin
      </button>
      <button
        type="button"
        disabled={none}
        onClick={onMove}
        className={cn(action, "bg-[color:var(--surface-inset)] text-[color:var(--text-heading)]")}
      >
        <Folder className="size-icon-sm" aria-hidden="true" />
        Move
      </button>
      <button
        type="button"
        disabled={none}
        onClick={onRemove}
        aria-label={none ? "Remove selected" : `Remove ${count} selected`}
        className={cn(action, "bg-[color:var(--danger-soft)] text-[color:var(--danger)]")}
      >
        <Trash2 className="size-icon-sm" aria-hidden="true" />
      </button>
    </div>
  );
}
