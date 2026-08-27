"use client";

import Link from "next/link";
import { ArrowRightLeft, X } from "lucide-react";

import type { CompareSlot } from "@/components/compare/types";
import { cn } from "@/components/ui-primitives";

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
}: {
  slots: readonly CompareSlot[];
  layout?: "default" | "compact";
  activeIndex?: number | null;
  onSelectSlot: (index: number) => void;
  onClearSlot?: (index: number) => void;
  onSwap?: () => void;
  swapHref?: string;
  swapLabel?: string;
  changeLabel?: string;
  onChange?: () => void;
}) {
  const pair = slots.length === 2;
  const bothFilled = pair && Boolean(slots[0]?.id && slots[1]?.id);
  const compactRail = layout === "compact" && !pair;

  return (
    <div className={cn("grid gap-3", compactRail ? "mt-2" : "mt-4")}>
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
      {changeLabel && onChange ? (
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
