"use client";

import Link from "next/link";
import { ArrowRightLeft, Plus, Search, X } from "lucide-react";

import type { ComparePhoneLayout, CompareSlot, CompareStarterChip } from "@/components/compare/types";
import { usePhoneMedia } from "@/components/compare/use-phone-media";
import { cn } from "@/components/ui-primitives";

/** Shared A/B/C identity colours for compare surfaces — soft tint, never a solid block or edge strip. */
export function compareSlotBadgeClass(index: number, filled = true) {
  if (!filled)
    return "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]";
  if (index === 0)
    return "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
  if (index === 1) return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
  return "border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]";
}

function CompareSlotTile({
  slot,
  index,
  activeIndex,
  compact,
  onSelectSlot,
  onClearSlot,
  addHint = "Click to add",
}: {
  slot: CompareSlot;
  index: number;
  activeIndex?: number | null;
  /** Phone-rail / 2x2 density. A `compact` tile relaxes back to full size from `sm`. */
  compact?: boolean;
  onSelectSlot: (index: number) => void;
  onClearSlot?: (index: number) => void;
  /** Hint shown inside an empty slot, so a placeholder reads as an add target. */
  addHint?: string;
}) {
  const filled = Boolean(slot.id);
  return (
    <div className="relative h-full min-w-0">
      <button
        type="button"
        onClick={() => onSelectSlot(index)}
        aria-pressed={activeIndex === index}
        data-testid={compact ? "compare-slot-tile-compact" : "compare-slot-tile"}
        className={cn(
          "grid h-full w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl border text-left transition-colors hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          compact ? "min-h-16 p-2.5 sm:min-h-22 sm:p-3.5" : "min-h-22 p-3.5",
          // `sm:p-3.5` resets `pr-*`, so the clear-button gutter is restated there.
          onClearSlot && filled ? "pr-12 sm:pr-14" : null,
          filled
            ? "border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)]"
            : "border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)]",
          activeIndex === index ? "border-solid border-[color:var(--clinical-accent)]" : null,
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full border font-extrabold",
            compact ? "h-7 w-7 text-2xs sm:h-8 sm:w-8 sm:text-xs" : "h-8 w-8 text-xs",
            compareSlotBadgeClass(index, filled),
          )}
        >
          {slot.label}
        </span>
        <span className="min-w-0">
          <strong
            className={cn(
              "block truncate",
              compact ? "text-sm sm:text-base" : "text-base",
              filled ? "text-[color:var(--text-heading)]" : "font-semibold text-[color:var(--text-muted)]",
            )}
          >
            {slot.title}
          </strong>
          {filled ? (
            slot.subtitle ? (
              <span className="mt-0.5 block truncate text-xs leading-4 text-[color:var(--text-muted)]">
                {slot.subtitle}
              </span>
            ) : null
          ) : (
            // Without this, an empty placeholder reads as a filled card and the
            // surface offers no visible way to fill it (desktop has no dashed panel).
            <span className="mt-1 flex items-center gap-1 text-2xs font-bold leading-4 text-[color:var(--clinical-accent)]">
              <Plus className="size-icon-xs" aria-hidden="true" />
              {addHint}
            </span>
          )}
        </span>
      </button>
      {onClearSlot && filled ? (
        <button
          type="button"
          aria-label={`Remove ${slot.title}`}
          onClick={() => onClearSlot(index)}
          className="absolute right-1 top-1/2 grid h-tap w-tap -translate-y-1/2 place-items-center rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
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
  addHint,
}: {
  slots: readonly CompareSlot[];
  /** `compact` lays slots out in a horizontal snap-scroll phone rail; from `sm` it becomes a grid. */
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
  /** Hint shown inside an empty slot, e.g. "Click to add". */
  addHint?: string;
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
  // "Change ..." reads wrong before anything is chosen, so an empty strip offers
  // the action label instead. Both open the same picker.
  const pickerButtonLabel = filledCount === 0 && actionLabel ? actionLabel : changeLabel;

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
              compact
              onSelectSlot={onSelectSlot}
              onClearSlot={onClearSlot}
              addHint={addHint}
            />
          ))}
        </div>
      ) : null}

      {!showPipSummary && !showHybridGrid ? (
        <div
          className={cn(
            "items-stretch",
            compactRail
              ? // Phone: a snap rail. From `sm` it relaxes into the same grid the
                // default layout uses, so desktop never renders narrow, sideways
                // scrolling slot cards with no room for their titles.
                "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden"
              : "grid gap-2",
            !compactRail &&
              (pair
                ? // Stack the pair on phones — a 3-column split truncates both titles to a few characters.
                  "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"),
          )}
        >
          {slots.map((slot, index) => (
            <div
              key={`${slot.label}-${index}`}
              className={cn(
                pair && "contents",
                compactRail && "min-w-[9.75rem] max-w-[11.5rem] shrink-0 snap-start sm:min-w-0 sm:max-w-none",
              )}
            >
              <CompareSlotTile
                slot={slot}
                index={index}
                activeIndex={activeIndex}
                compact={compactRail}
                onSelectSlot={onSelectSlot}
                onClearSlot={onClearSlot}
                addHint={addHint}
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

      {pickerButtonLabel && onChange && !showPipSummary ? (
        <button
          type="button"
          onClick={onChange}
          data-testid="compare-slot-strip-picker-button"
          className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--e1)] transition-colors hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-auto sm:justify-self-start"
        >
          <Search className="size-icon-sm" aria-hidden="true" />
          {pickerButtonLabel}
        </button>
      ) : null}
    </div>
  );
}
