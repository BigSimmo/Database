"use client";

import Link from "next/link";
import { ArrowRightLeft, Search, X } from "lucide-react";

import type { ComparePhoneLayout, CompareSlot, CompareStarterChip } from "@/components/compare/types";
import { usePhoneMedia } from "@/components/compare/use-phone-media";
import { cn } from "@/components/ui-primitives";

function slotBadgeClass(index: number) {
  if (index === 0) return "bg-[color:var(--clinical-accent)]";
  if (index === 1) return "bg-[color:var(--info)]";
  return "bg-[color:var(--text-muted)]";
}

function slotBorderAccent(index: number) {
  if (index === 0) return "border-l-[3px] border-l-[color:var(--clinical-accent)]";
  if (index === 1) return "border-l-[3px] border-l-[color:var(--info)]";
  return "border-l-[3px] border-l-[color:var(--border-strong)]";
}

/** Used only by the hybrid phone 2x2 grid — the default/compact-rail layouts below keep their own tile markup. */
function CompareSlotTile({
  slot,
  index,
  activeIndex,
  compact,
  onSelectSlot,
  onClearSlot,
}: {
  slot: CompareSlot;
  index: number;
  activeIndex?: number | null;
  compact?: boolean;
  onSelectSlot: (index: number) => void;
  onClearSlot?: (index: number) => void;
}) {
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => onSelectSlot(index)}
        aria-pressed={activeIndex === index}
        data-testid={compact ? "compare-slot-tile-compact" : "compare-slot-tile"}
        className={cn(
          "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg border bg-[color:var(--surface)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          compact ? "min-h-tap p-2.5" : "min-h-22 p-3",
          onClearSlot && slot.id ? "pr-12" : null,
          activeIndex === index ? "border-[color:var(--clinical-accent)]" : "border-[color:var(--border)]",
          slotBorderAccent(index),
        )}
      >
        <span
          className={cn(
            "grid place-items-center rounded-md font-extrabold text-[color:var(--command-contrast)]",
            compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
            slotBadgeClass(index),
          )}
        >
          {slot.label}
        </span>
        <span className="min-w-0">
          <strong className={cn("block truncate text-[color:var(--text-heading)]", compact ? "text-sm" : "text-base")}>
            {slot.title}
          </strong>
          {slot.subtitle ? (
            <span className="mt-0.5 block truncate text-xs leading-4 text-[color:var(--text-muted)]">
              {slot.subtitle}
            </span>
          ) : null}
        </span>
      </button>
      {onClearSlot && slot.id ? (
        <button
          type="button"
          aria-label={`Remove ${slot.title}`}
          onClick={() => onClearSlot(index)}
          className="absolute right-1 top-1 grid h-tap w-tap place-items-center rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
                  className="inline-flex min-h-10 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-3 text-xs font-bold"
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
            />
          ))}
        </div>
      ) : null}

      {!showPipSummary && !showHybridGrid ? (
        <div
          className={cn(
            compactRail
              ? "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : "grid items-stretch gap-2",
            !compactRail &&
              (pair ? "grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"),
          )}
        >
          {slots.map((slot, index) => (
            <div
              key={`${slot.label}-${index}`}
              className={
                pair ? "contents" : compactRail ? "min-w-[9.75rem] max-w-[11.5rem] shrink-0 snap-start" : undefined
              }
            >
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectSlot(index)}
                  aria-pressed={activeIndex === index}
                  data-testid={compactRail ? "compare-slot-tile-compact" : "compare-slot-tile"}
                  className={cn(
                    "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg border bg-[color:var(--surface-raised)] text-left shadow-[var(--e1)] transition hover:border-[color:var(--clinical-accent-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                    compactRail ? "min-h-16 p-2.5" : "min-h-22 p-3",
                    onClearSlot && slot.id ? "pr-12" : null,
                    activeIndex === index ? "border-[color:var(--clinical-accent)]" : "border-[color:var(--border)]",
                    index === 0
                      ? "border-l-[3px] border-l-[color:var(--clinical-accent)]"
                      : index === 1
                        ? "border-l-[3px] border-l-[color:var(--info)]"
                        : "border-l-[3px] border-l-[color:var(--border-strong)]",
                  )}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-md text-sm font-extrabold text-[color:var(--command-contrast)]",
                      compactRail ? "h-7 w-7" : "h-8 w-8",
                      index === 0
                        ? "bg-[color:var(--clinical-accent)]"
                        : index === 1
                          ? "bg-[color:var(--info)]"
                          : "bg-[color:var(--text-muted)]",
                    )}
                  >
                    {slot.label}
                  </span>
                  <span className="min-w-0">
                    <strong
                      className={cn(
                        "block truncate text-[color:var(--text-heading)]",
                        compactRail ? "text-sm" : "text-base",
                      )}
                    >
                      {slot.title}
                    </strong>
                    {slot.subtitle ? (
                      <span className="mt-0.5 block truncate text-2xs leading-4 text-[color:var(--text-muted)]">
                        {slot.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
                {onClearSlot && slot.id ? (
                  <button
                    type="button"
                    aria-label={`Remove ${slot.title}`}
                    onClick={() => onClearSlot(index)}
                    className="absolute right-1 top-1 grid h-tap w-tap place-items-center rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
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
