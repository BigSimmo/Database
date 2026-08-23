"use client";

import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";

import type { CompareSlot } from "@/components/compare/types";
import { cn } from "@/components/ui-primitives";

export function CompareSlotStrip({
  slots,
  activeIndex,
  onSelectSlot,
  onSwap,
  swapHref,
  changeLabel,
  onChange,
}: {
  slots: readonly CompareSlot[];
  activeIndex?: number | null;
  onSelectSlot: (index: number) => void;
  onSwap?: () => void;
  swapHref?: string;
  changeLabel?: string;
  onChange?: () => void;
}) {
  const pair = slots.length === 2;
  const bothFilled = pair && Boolean(slots[0]?.id && slots[1]?.id);

  return (
    <div className="mt-4 grid gap-3">
      <div
        className={cn(
          "grid items-stretch gap-2",
          pair ? "grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {slots.map((slot, index) => (
          <div key={`${slot.label}-${index}`} className={pair ? "contents" : undefined}>
            <button
              type="button"
              onClick={() => onSelectSlot(index)}
              aria-pressed={activeIndex === index}
              className={cn(
                "grid min-h-[5.5rem] min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-2 rounded-lg border bg-[color:var(--surface)] p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
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
                  "grid h-8 w-8 place-items-center rounded-md text-sm font-extrabold text-[color:var(--command-contrast)]",
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
                <strong className="block truncate text-base text-[color:var(--text-heading)]">{slot.title}</strong>
                {slot.subtitle ? (
                  <span className="mt-1 block text-xs leading-4 text-[color:var(--text-muted)]">{slot.subtitle}</span>
                ) : null}
              </span>
            </button>
            {pair && index === 0 ? (
              <div className="grid place-items-center">
                {bothFilled && swapHref ? (
                  <Link
                    href={swapHref}
                    className="grid h-tap w-tap place-items-center rounded-full text-[color:var(--text-muted)] hover:text-[color:var(--clinical-accent)]"
                    aria-label="Swap compared items"
                  >
                    <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
                  </Link>
                ) : bothFilled && onSwap ? (
                  <button
                    type="button"
                    onClick={onSwap}
                    aria-label="Swap compared items"
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
