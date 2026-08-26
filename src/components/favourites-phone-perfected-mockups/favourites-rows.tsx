"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  FolderInput,
  ListFilter,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCw,
  Search,
  Star,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn, EmptyState } from "@/components/ui-primitives";

import { focusRing } from "./favourites-phone-shell";
import { kindIdentity, setLabels, setOrder, type FavouriteRow, type FavouriteSetId } from "./fixtures";

/* ═══════════════════════════  the row  ═══════════════════════════ */

/**
 * One favourite, one line.
 *
 * The production phone card (`FavouriteMobileCard`,
 * favourites-command-library-page.tsx:591) measures 228px at 390px wide: a
 * two-line description, two chips, a two-row definition list, an Open button
 * and a kebab. Everything below the title moves onto a single metadata line or
 * into the actions sheet, and the row falls to 72px — seven fully above the
 * fold, where the shipped page puts the first one at y=1141 and shows none.
 *
 * The whole row opens the item; the trailing control opens its actions. They
 * are siblings rather than nested so a keyboard user gets two clean stops, and
 * both clear 44px.
 */
export function FavouriteListRow({
  row,
  showPinGlyph,
  onOpen,
  onOpenActions,
}: {
  row: FavouriteRow;
  /** Only when the list is ungrouped. Inside the Pinned group the glyph
   *  repeats the label above it, and a title that wraps to two lines leaves it
   *  stranded on a line of its own. */
  showPinGlyph: boolean;
  onOpen: (row: FavouriteRow) => void;
  onOpenActions: (row: FavouriteRow) => void;
}) {
  const identity = kindIdentity[row.kind];
  const Glyph = identity.icon;

  return (
    <li className="relative border-b border-[color:var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={cn("absolute inset-0 hover:bg-[color:var(--surface-subtle)]", focusRing)}
      >
        <span className="sr-only">Open {row.title}</span>
      </button>

      <div className="pointer-events-none relative flex min-h-18 items-center gap-3 px-3 py-3">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ background: identity.soft, borderColor: identity.border, color: identity.ink }}
        >
          <Glyph className="size-icon-md" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-sm-minus font-bold leading-5 text-[color:var(--text-heading)]">
            {row.title}
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
            {showPinGlyph && row.pinned ? (
              <Pin className="size-icon-xs shrink-0 text-[color:var(--clinical-accent)]" aria-label="Pinned" />
            ) : null}
            <span className="shrink-0" style={{ color: identity.ink }}>
              {identity.label}
            </span>
            <span aria-hidden className="text-[color:var(--decoration-soft)]">
              ·
            </span>
            <span className="truncate">{row.detail}</span>
            <span aria-hidden className="text-[color:var(--decoration-soft)]">
              ·
            </span>
            <span className="shrink-0 text-[color:var(--text-soft)]">{row.lastOpened}</span>
          </span>
        </span>

        <button
          type="button"
          aria-label={`Actions for ${row.title}`}
          aria-haspopup="dialog"
          onClick={() => onOpenActions(row)}
          className={cn(
            "pointer-events-auto relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--text-soft)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text-muted)]",
            focusRing,
          )}
        >
          <MoreHorizontal className="size-icon-md" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
      {children}
    </p>
  );
}

/**
 * Pinned rows lead every view under one label, then the rest follow.
 *
 * `pinnedAt` has been in the schema since `20260823090000_user_favourite_sets`
 * and in the `PATCH setPinned` contract, with no control anywhere in the app.
 * This is the control. It costs one 24px label, and when nothing is pinned the
 * label does not render, so an unpinned library pays nothing for it.
 */
export function FavouritesList({
  rows,
  showPinnedGroup,
  onOpen,
  onOpenActions,
}: {
  rows: readonly FavouriteRow[];
  showPinnedGroup: boolean;
  onOpen: (row: FavouriteRow) => void;
  onOpenActions: (row: FavouriteRow) => void;
}) {
  const pinned = showPinnedGroup ? rows.filter((row) => row.pinned) : [];
  const rest = showPinnedGroup ? rows.filter((row) => !row.pinned) : rows;

  return (
    <div className="bg-[color:var(--surface)]">
      {pinned.length > 0 ? (
        <>
          <GroupLabel>Pinned</GroupLabel>
          <ul>
            {pinned.map((row) => (
              <FavouriteListRow
                key={row.id}
                row={row}
                showPinGlyph={!showPinnedGroup}
                onOpen={onOpen}
                onOpenActions={onOpenActions}
              />
            ))}
          </ul>
        </>
      ) : null}

      {rest.length > 0 ? (
        <>
          {pinned.length > 0 ? <GroupLabel>Everything else</GroupLabel> : null}
          <ul>
            {rest.map((row) => (
              <FavouriteListRow
                key={row.id}
                row={row}
                showPinGlyph={!showPinnedGroup}
                onOpen={onOpen}
                onOpenActions={onOpenActions}
              />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════  states  ═══════════════════════════ */

/** One no-match state, rendered once. Three simultaneous live regions was the
 *  defect `#225` closed; the shape it settled on is one. */
export function NoMatchesState({ query, total }: { query: string; total: number }) {
  return (
    <div className="px-4 py-10">
      <EmptyState
        icon={Search}
        headingLevel={3}
        title={`No favourites match "${query}"`}
        body={`This searches your saved items only. Clear the search to see all ${total}, or search the whole library from any other mode.`}
        actions={
          <button
            type="button"
            onClick={() => undefined}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 text-sm-minus font-bold text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            Clear search
          </button>
        }
      />
    </div>
  );
}

/**
 * First run. The version worth building is the one that answers "what is this
 * page for" without a marketing lockup: name the four things that can be
 * saved, because a user who has saved nothing cannot infer them, and give one
 * route out.
 */
export function NothingSavedState() {
  return (
    <div className="px-4 py-8">
      <EmptyState
        icon={Star}
        headingLevel={3}
        title="Nothing saved yet"
        body="Tap the star on anything you want back quickly. It syncs to your account, so it follows you to any device you sign in on."
      />
      <ul className="mt-5 space-y-1.5">
        {(["service", "form", "differential", "therapy"] as const).map((kind) => {
          const identity = kindIdentity[kind];
          const Glyph = identity.icon;
          return (
            <li
              key={kind}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
            >
              <span
                aria-hidden
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border"
                style={{ background: identity.soft, borderColor: identity.border, color: identity.ink }}
              >
                <Glyph className="size-icon-sm" />
              </span>
              <span className="text-2xs font-bold text-[color:var(--text-heading)]">{identity.plural}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => undefined}
          className={cn(
            "inline-flex min-h-12 items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm-minus font-bold text-[color:var(--command-contrast)]",
            focusRing,
          )}
        >
          Browse services
          <ArrowRight className="size-icon-md" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Partial load. `foldSavedFavouritesStatus` can return `partial`, and the rule
 * the results band settled on (`#091`) is that a partial failure reports the
 * honest loaded count and an explicit retry — never a fabricated zero and
 * never a total that includes rows it could not fetch.
 */
export function PartialLoadNotice({ failed }: { failed: number }) {
  return (
    <div className="border-b border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2.5">
      <div className="flex gap-2.5">
        <CircleAlert className="mt-px size-icon-md shrink-0 text-[color:var(--warning-text)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-bold leading-4 text-[color:var(--warning-text)]">
            {failed} favourites could not be loaded
          </p>
          <p className="mt-0.5 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
            The count above is what actually loaded. Nothing has been removed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => undefined}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--surface)] px-2.5 text-2xs font-bold text-[color:var(--warning-text)]",
            focusRing,
          )}
        >
          <RotateCw className="size-icon-sm" aria-hidden />
          Retry
        </button>
      </div>
    </div>
  );
}

/** The gate. `canAccessFavouritesMode` is `demoMode || authenticated`, so this
 *  is the boundary of "for logged-in users" and worth drawing once. */
export function SignedOutGate() {
  return (
    <div className="px-4 py-10">
      <EmptyState
        icon={UserRoundCheck}
        headingLevel={3}
        title="Favourites are tied to your account"
        body="Sign in and your saved services, forms, differentials and therapies appear here on every device."
        actions={
          <button
            type="button"
            onClick={() => undefined}
            className={cn(
              "inline-flex min-h-12 items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm-minus font-bold text-[color:var(--command-contrast)]",
              focusRing,
            )}
          >
            Sign in
          </button>
        }
      />
    </div>
  );
}

/* ═══════════════════════════  sheet bodies  ═══════════════════════════ */

function SheetRow({
  icon: Glyph,
  label,
  hint,
  tone = "default",
  trailing,
  onClick,
}: {
  icon: typeof Pin;
  label: string;
  hint?: string;
  tone?: "default" | "danger";
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-h-12 items-center gap-3 rounded-lg px-3 text-left hover:bg-[color:var(--surface-subtle)]",
        focusRing,
      )}
    >
      <Glyph
        className={cn(
          "size-icon-md shrink-0",
          tone === "danger" ? "text-[color:var(--danger-text)]" : "text-[color:var(--text-soft)]",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm-minus font-bold",
            tone === "danger" ? "text-[color:var(--danger-text)]" : "text-[color:var(--text-heading)]",
          )}
        >
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block truncate text-2xs font-medium text-[color:var(--text-muted)]">{hint}</span>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}

/** Everything the production card carried inline, and the pin toggle the API
 *  has always supported. Four rows, each a full-width 48px target. */
export function ItemActionsSheetBody({ row, onClose }: { row: FavouriteRow; onClose: () => void }) {
  return (
    <div className="space-y-0.5 pb-1">
      <SheetRow
        icon={row.pinned ? PinOff : Pin}
        label={row.pinned ? "Unpin from the top" : "Pin to the top"}
        hint={row.pinned ? "Returns it to its set order" : "Keeps it first in every view"}
        onClick={onClose}
      />
      <SheetRow
        icon={FolderInput}
        label="Move to a set"
        hint={`Currently in ${setLabels[row.setId]}`}
        onClick={onClose}
      />
      <SheetRow icon={Copy} label="Copy link" onClick={onClose} />
      <SheetRow icon={Trash2} label="Remove from favourites" tone="danger" onClick={onClose} />
    </div>
  );
}

/**
 * Set management. The six names are a controlled vocabulary
 * (`favouriteSetNames`) with a database CHECK behind them, so this sheet is a
 * picker and not a text field — showing which are already in use and which are
 * still available is the whole job.
 */
export function SetsSheetBody({ counts, onClose }: { counts: Record<FavouriteSetId, number>; onClose: () => void }) {
  const controlled = setOrder.filter((id) => id !== "all" && id !== "unfiled");
  return (
    <div className="space-y-0.5 pb-1">
      {controlled.map((id) => {
        const count = counts[id];
        const inUse = count > 0;
        return (
          <SheetRow
            key={id}
            icon={inUse ? Check : ListFilter}
            label={setLabels[id]}
            hint={inUse ? `${count} saved` : "Not used yet"}
            onClick={onClose}
          />
        );
      })}
      <p className="px-3 pt-2 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
        Set names are limited to these six approved clinical workflows. Items you have not filed stay in Unfiled (
        {counts.unfiled}).
      </p>
    </div>
  );
}

/** The page-level sheet: sort, sets, and the destructive action, which belongs
 *  behind a sheet rather than on the header where it can be hit by accident. */
export function PageActionsSheetBody({
  sort,
  onSelectSort,
  onOpenSets,
}: {
  sort: "recent" | "title" | "set";
  onSelectSort: (value: "recent" | "title" | "set") => void;
  onOpenSets: () => void;
}) {
  const options: ReadonlyArray<{ value: "recent" | "title" | "set"; label: string; hint: string }> = [
    { value: "recent", label: "Recently opened", hint: "Default" },
    { value: "title", label: "Title, A to Z", hint: "" },
    { value: "set", label: "Grouped by set", hint: "" },
  ];
  return (
    <div className="space-y-0.5 pb-1">
      <p className="px-3 pb-1 pt-1 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
        Sort
      </p>
      {options.map((option) => (
        <SheetRow
          key={option.value}
          icon={Check}
          label={option.label}
          hint={option.hint || undefined}
          trailing={
            sort === option.value ? (
              <Check className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]" aria-label="Selected" />
            ) : undefined
          }
          onClick={() => onSelectSort(option.value)}
        />
      ))}
      <p className="px-3 pb-1 pt-3 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
        Library
      </p>
      <SheetRow icon={FolderInput} label="Manage sets" hint="Six approved workflows" onClick={onOpenSets} />
      <SheetRow icon={Trash2} label="Remove all favourites" tone="danger" onClick={onOpenSets} />
    </div>
  );
}
