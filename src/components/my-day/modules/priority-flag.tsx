"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { MODE_BADGE } from "@/components/my-day/mode-badge";
import { cn } from "@/components/ui-primitives";
import { appModeDefinition } from "@/lib/app-modes";
import { formatMyDayDue } from "@/lib/my-day/merge";
import type { MyDayItem } from "@/lib/my-day/model";

/**
 * The single most important thing right now: the first item of the already
 * sorted merged list, when it is overdue or due soon. It is a pointer, not a
 * move: the item stays in the list below, which remains the full record.
 * Renders nothing when the top item is only "info" (or there are no items).
 */
export function MyDayPriorityFlag({ items, now }: { readonly items: readonly MyDayItem[]; readonly now: Date }) {
  const item = items[0];
  if (!item || (item.severity !== "overdue" && item.severity !== "soon")) return null;
  const due = formatMyDayDue(item.due, now);
  const stateWord = item.severity === "overdue" ? (item.mode === "my-work" ? "Date passed" : "Overdue") : "Due soon";
  const second = [appModeDefinition(item.mode).label, [stateWord, due].filter(Boolean).join(" · ")].join(" · ");
  return (
    <Link
      href={item.href}
      aria-label={`Most important now: ${item.title}`}
      data-testid="my-day-module-priority"
      className={cn(
        focusRing,
        "flex min-h-12 items-center gap-3 rounded-md border border-[color:var(--success-border)] bg-[color:var(--success-soft)] p-3 no-underline",
      )}
    >
      <span
        aria-hidden="true"
        className="grid h-6 min-w-8 shrink-0 place-items-center rounded-sm px-1 text-3xs font-semibold tracking-wide text-[color:var(--success)]"
      >
        {MODE_BADGE[item.mode]}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="break-words text-base-minus font-semibold text-[color:var(--text-heading)]">{item.title}</span>
        <span className={cn(modeSecondaryText, "break-words")}>{second}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
    </Link>
  );
}
