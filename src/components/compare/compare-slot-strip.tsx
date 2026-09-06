"use client";

import Link from "next/link";
import { ArrowRightLeft, Plus, Search, X } from "lucide-react";

import { cardInteractive, cardSelected, focusRing } from "@/components/card-recipes";
import type { ComparePhoneLayout, CompareSlot, CompareStarterChip } from "@/components/compare/types";
import { usePhoneMedia } from "@/components/compare/use-phone-media";
import { cn } from "@/components/ui-primitives";

/**
 * Shared A/B/C identity colours for compare surfaces — soft tint, never a solid block or edge strip.
 *
 * Exported because the identity has to survive the trip from a selection tile to
 * wherever that slot shows up again: the formulation results table, and the
 * therapy comparison's column headers. A second local copy of these classes is
 * how a column stops matching the tile it came from.
 */
export function compareSlotBadgeClass(index: number, filled = true) {
  if (!filled)
    return "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]";
  if (index === 0)
    return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
  if (index === 1) return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
  return "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]";
}

/**
 * Everything about the letter token except its colours and its size.
 *
 * Exported alongside the colours so a caller outside this file draws the same
 * token rather than approximating it — a circle that is nearly the tile's circle
 * reads as a different thing, which defeats the point of carrying the letter.
 */
export const compareSlotBadgeBase =
  "grid shrink-0 place-items-center rounded-full border font-extrabold tabular-nums transition-colors";

/**
 * An empty slot must not look like a filled one that happens to be short. It is
 * an invitation, so it reads as an outline: dashed edge, flat fill, and a
 * trailing `+` sitting exactly where a filled tile's remove control sits, which
 * is what keeps the two states the same width and their text on the same line.
 */
const emptySlotSurface = cn(
  "rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] transition",
  "hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)]",
  focusRing,
);

/** Column template per slot count, so four slots never leave one orphan on its own row. */
function slotGridColumns(count: number) {
  if (count >= 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2";
}

/**
 * The one tile, used by every layout.
 *
 * It was previously two: a `CompareSlotTile` for the phone 2x2 grid and a
 * byte-similar copy inlined in the default/rail branch below. They had already
 * drifted — different surfaces, different shadows, different subtitle sizes —
 * which is the ordinary fate of a duplicated tile and the reason this one is
 * shared rather than copied.
 *
 * The filled surface comes from `card-recipes` rather than a hand-rolled class
 * string, so the tile carries the same radius, border and resting elevation as
 * every other card in the product and cannot drift from them on its own
 * (card-recipes.ts: one radius decision, one resting elevation, one selected
 * encoding).
 */
function CompareSlotTile({
  slot,
  index,
  activeIndex,
  density = "standard",
  onSelectSlot,
  onClearSlot,
}: {
  slot: CompareSlot;
  index: number;
  activeIndex?: number | null;
  density?: "standard" | "compact";
  onSelectSlot: (index: number) => void;
  onClearSlot?: (index: number) => void;
}) {
  const compact = density === "compact";
  const filled = Boolean(slot.id);
  const active = activeIndex === index;
  const clearable = Boolean(onClearSlot && slot.id);

  return (
    <div className="relative h-full min-w-0">
      <button
        type="button"
        onClick={() => onSelectSlot(index)}
        aria-pressed={active}
        data-testid={compact ? "compare-slot-tile-compact" : "compare-slot-tile"}
        data-slot-state={filled ? "filled" : "empty"}
        title={filled ? slot.title : undefined}
        className={cn(
          "grid h-full w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-stretch gap-2.5 text-left",
          filled ? cardInteractive : emptySlotSurface,
          compact ? "min-h-16 items-center p-2.5 pr-10" : "min-h-22 p-3.5 pr-12",
          active ? cardSelected : null,
        )}
      >
        <span
          className={cn(
            compareSlotBadgeBase,
            "self-start",
            compareSlotBadgeClass(index, filled),
            compact ? "h-6 w-6 text-2xs" : "h-7 w-7 text-xs",
          )}
        >
          {slot.label}
        </span>
        {/* Column, not a plain block: the subtitle is pushed to the bottom of the
            tile so the category line sits on one baseline across the row whether
            the name above it took one line or two. The tiles are already the same
            height (the grid stretches them), so nothing has to be reserved. */}
        <span className="flex min-w-0 flex-col">
          <strong
            className={cn(
              // Two lines, not one truncated line. "Acceptance and Commitment
              // Therapy (ACT)" in a quarter-width column has nothing left after
              // the ellipsis, and the reader cannot tell two long therapy names
              // apart from their first three words. No `block` beside the clamp:
              // `line-clamp-*` sets `display:-webkit-box`, and a `block` utility
              // next to it renders the clamp as no clamp at all.
              "text-sm font-semibold leading-snug",
              // Three lines on a phone, where a tile is ~170px wide and two lines
              // of "Cognitive Behavioural Therapy (CBT)" end at "Cognitive
              // Behavioural…", which is the half the candidates share.
              compact ? "line-clamp-3" : "line-clamp-2",
              filled ? "text-[color:var(--text-heading)]" : "text-[color:var(--text-muted)]",
            )}
          >
            {slot.title}
          </strong>
          {/* No subtitle at compact density. On a 390px phone the tile is about
              170px wide, and a category that reads the same on every tile bought
              two wrapped lines while pushing the therapy name into an ellipsis —
              it cost the one line that actually distinguishes the tiles. */}
          {filled && slot.subtitle && !compact ? (
            <span className="mt-auto line-clamp-2 pt-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
              {slot.subtitle}
            </span>
          ) : null}
        </span>
      </button>
      {clearable ? (
        <button
          type="button"
          aria-label={`Remove ${slot.title}`}
          onClick={() => onClearSlot?.(index)}
          className={cn(
            // Centred on the right edge rather than pinned to the corner: at the
            // corner its 48px tap area sat on top of the first line of the title,
            // so a tap meant to open the picker removed the therapy instead.
            "absolute right-0 top-1/2 grid h-tap w-tap -translate-y-1/2 place-items-center rounded-full",
            "text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-inset)] hover:text-[color:var(--danger)]",
            focusRing,
          )}
        >
          <X className="size-icon-md" aria-hidden="true" />
        </button>
      ) : filled ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--decoration-soft)]"
        >
          <Plus className="size-icon-md" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

export function CompareSlotStrip({
  slots,
  layout = "default",
  activeIndex,
  onSelectSlot,
  onClearSlot,
  onSwap,
  swapHref,
  swapLabel = "Swap compared items",
  changeLabel,
  onChange,
  phoneLayout = "default",
  actionLabel,
  minCount = 2,
  slotSummaryLabel,
  starters,
  onPrimaryAction,
}: {
  slots: readonly CompareSlot[];
  /** `compact` lays out slots in a horizontal snap-scroll phone rail instead of a vertical stack. */
  layout?: "default" | "compact";
  activeIndex?: number | null;
  onSelectSlot: (index: number) => void;
  onClearSlot?: (index: number) => void;
  onSwap?: () => void;
  swapHref?: string;
  swapLabel?: string;
  changeLabel?: string;
  onChange?: () => void;
  /** `hybrid` swaps the phone rendering for a compact pip summary / 2x2 grid instead of `layout`. */
  phoneLayout?: ComparePhoneLayout;
  actionLabel?: string;
  minCount?: number;
  slotSummaryLabel?: string;
  starters?: readonly CompareStarterChip[];
  onPrimaryAction?: () => void;
}) {
  const phone = usePhoneMedia();
  const pair = slots.length === 2;
  const bothFilled = pair && Boolean(slots[0]?.id && slots[1]?.id);
  const filledCount = slots.filter((slot) => slot.id).length;
  const hybridPhone = phoneLayout === "hybrid" && !pair && phone;
  const showPipSummary = hybridPhone && filledCount === 0;
  const showHybridGrid = hybridPhone && filledCount > 0;
  const showOneMoreHint = hybridPhone && filledCount === 1 && filledCount < minCount;
  const primaryAction = onPrimaryAction ?? onChange;
  const summaryLabel = slotSummaryLabel ?? `Up to ${slots.length} items`;
  const compactRail = layout === "compact" && !pair;

  return (
    <div className={cn("grid gap-3", compactRail ? "mt-2" : "mt-4")} data-testid="compare-slot-strip">
      {showPipSummary ? (
        <div
          data-testid="compare-slot-strip-pip-summary"
          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="therapy-compare-tray__pips" aria-hidden="true">
              {slots.map((slot) => (
                <span key={slot.label} className="therapy-compare-tray__pip" data-filled={slot.id ? "true" : undefined}>
                  {slot.id ? slot.label : ""}
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--text-heading)]">
              {summaryLabel}
            </span>
          </div>
          {actionLabel && primaryAction ? (
            <button
              type="button"
              onClick={primaryAction}
              className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-extrabold text-[color:var(--command-contrast)]"
            >
              <Search className="size-icon-sm" aria-hidden="true" />
              {actionLabel}
            </button>
          ) : null}
          {starters?.length ? (
            <div className="flex flex-wrap gap-2">
              {starters.map((chip) => (
                <Link
                  key={chip.id}
                  href={chip.href}
                  className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-3 text-xs font-bold"
                >
                  {chip.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showHybridGrid ? (
        <div data-testid="compare-slot-strip-hybrid-grid" className="grid grid-cols-2 items-stretch gap-2">
          {slots.map((slot, index) => (
            <CompareSlotTile
              key={`${slot.label}-${index}`}
              slot={slot}
              index={index}
              activeIndex={activeIndex}
              density="compact"
              onSelectSlot={onSelectSlot}
              onClearSlot={onClearSlot}
            />
          ))}
        </div>
      ) : null}

      {!showPipSummary && !showHybridGrid ? (
        <div
          className={cn(
            compactRail
              ? "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "grid items-stretch gap-2.5",
            !compactRail &&
              (pair
                ? // Stack the pair on phones — a 3-column split truncates both titles to a few characters.
                  "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]"
                : slotGridColumns(slots.length)),
          )}
        >
          {slots.map((slot, index) => (
            <div
              key={`${slot.label}-${index}`}
              className={
                pair ? "contents" : compactRail ? "min-w-[9.75rem] max-w-[11.5rem] shrink-0 snap-start" : undefined
              }
            >
              <CompareSlotTile
                slot={slot}
                index={index}
                activeIndex={activeIndex}
                density={compactRail ? "compact" : "standard"}
                onSelectSlot={onSelectSlot}
                onClearSlot={onClearSlot}
              />
              {pair && index === 0 ? (
                <div className="grid place-items-center">
                  {bothFilled && swapHref ? (
                    <Link
                      href={swapHref}
                      className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)]"
                      aria-label={swapLabel}
                    >
                      <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
                    </Link>
                  ) : bothFilled && onSwap ? (
                    <button
                      type="button"
                      onClick={onSwap}
                      aria-label={swapLabel}
                      className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)]"
                    >
                      <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                  ) : (
                    <ArrowRightLeft className="h-5 w-5 text-[color:var(--text-muted)]" aria-hidden="true" />
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {showOneMoreHint ? (
        <p
          role="status"
          data-testid="compare-slot-strip-one-more-hint"
          className="m-0 text-sm font-medium text-[color:var(--text-muted)]"
        >
          Add one more to compare.
        </p>
      ) : null}

      {changeLabel && onChange && !showPipSummary ? (
        <button
          type="button"
          onClick={onChange}
          className="inline-flex min-h-tap w-full items-center justify-center rounded-lg border border-[color:var(--border)] text-sm font-bold sm:hidden"
        >
          {changeLabel}
        </button>
      ) : null}
    </div>
  );
}
