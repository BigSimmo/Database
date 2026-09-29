"use client";

import { ArrowDownUp, Check, Folder, FolderPlus, PenLine } from "lucide-react";

import { UNSORTED_SET_NAME, type FavouriteSetChip } from "@/components/favourites/favourites-view-model";
import { ChoiceChip } from "@/components/ui/chip";
import { cn } from "@/components/ui-primitives";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function ChipLabel({ name, count }: { name: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {name}
      <span className="nums font-medium text-[color:var(--text-muted)]">{count}</span>
    </span>
  );
}

/**
 * One scrolling row of set chips. A chip narrows the list to that set; tapping
 * the chip that is already the only one chosen goes back to All.
 */
export function FavouritesSetChips({
  chips,
  totalCount,
  selectedSets,
  onSelect,
  onNewSet,
}: {
  chips: FavouriteSetChip[];
  totalCount: number;
  selectedSets: ReadonlySet<string>;
  onSelect: (name: string | null) => void;
  /** Omitted when the clinician cannot create sets (demo mode or every name used). */
  onNewSet?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by set"
      data-testid="favourites-set-chips"
      className="-mx-4 flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ChoiceChip
        pressed={selectedSets.size === 0}
        onPressedChange={() => onSelect(null)}
        ariaLabel={`All favourites, ${totalCount}`}
        className="shrink-0"
      >
        <ChipLabel name="All" count={totalCount} />
      </ChoiceChip>
      {chips.map((chip) => (
        <ChoiceChip
          key={chip.name}
          pressed={selectedSets.has(chip.name)}
          onPressedChange={() => onSelect(selectedSets.size === 1 && selectedSets.has(chip.name) ? null : chip.name)}
          ariaLabel={`${chip.name}, ${chip.count} ${chip.count === 1 ? "favourite" : "favourites"}`}
          icon={chip.name === UNSORTED_SET_NAME ? undefined : Folder}
          className="shrink-0"
        >
          <ChipLabel name={chip.name} count={chip.count} />
        </ChoiceChip>
      ))}
      {onNewSet ? (
        <button
          type="button"
          onClick={onNewSet}
          className={cn(
            "inline-flex min-h-tap shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)]",
            focusRing,
          )}
        >
          <FolderPlus className="size-icon-sm" aria-hidden="true" />
          New set
        </button>
      ) : null}
    </div>
  );
}

/** Shown when one set is chosen: its name and count, with Reorder and Rename. */
export function FavouritesSetBar({
  name,
  count,
  reordering,
  onToggleReorder,
  onRename,
}: {
  name: string;
  count: number;
  reordering: boolean;
  /** Omitted when the order cannot change (fewer than two saved items, or examples). */
  onToggleReorder?: () => void;
  /** Omitted for Unsorted and example sets. */
  onRename?: () => void;
}) {
  return (
    <section
      aria-label={`${name} set`}
      data-testid="favourites-set-bar"
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] py-2 pl-3 pr-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--clinical-accent)]">
        <Folder className="size-icon-md" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base-minus font-semibold text-[color:var(--text-heading)]">{name}</span>
        <span className="nums text-xs text-[color:var(--text-muted)]">
          {count} {count === 1 ? "item" : "items"}
          {name === UNSORTED_SET_NAME ? " not in a set" : ""}
        </span>
      </span>
      {onRename ? (
        <button
          type="button"
          onClick={onRename}
          aria-label={`Rename ${name}`}
          className={cn(
            "grid size-tap shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface)]",
            focusRing,
          )}
        >
          <PenLine className="size-icon-md" aria-hidden="true" />
        </button>
      ) : null}
      {onToggleReorder ? (
        <button
          type="button"
          onClick={onToggleReorder}
          aria-pressed={reordering}
          className={cn(
            "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold",
            reordering
              ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "bg-[color:var(--surface)] text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
            focusRing,
          )}
        >
          {reordering ? (
            <Check className="size-icon-sm" aria-hidden="true" />
          ) : (
            <ArrowDownUp className="size-icon-sm" aria-hidden="true" />
          )}
          {reordering ? "Done" : "Reorder"}
        </button>
      ) : null}
    </section>
  );
}
