"use client";

import { useEffect, useState } from "react";

import { ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { modeSecondaryText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";
import { appModeDefinition } from "@/lib/app-modes";
import { formatMyDayDue } from "@/lib/my-day/merge";
import type { MyDayItem, MyDaySourceMode } from "@/lib/my-day/model";

/*
 * The My Day row pieces shared by the page and the home card, kept apart from
 * the page so the home card's lazy chunk does not pull in the page shell and
 * the sign-in dialog.
 */

const TICK_MS = 60_000;

/** The reader's clock, re-read every minute so "Today · 14:30" stays honest and the day rolls over. */
export function useMyDayNow(nowProp?: Date): Date {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (nowProp) return;
    const timer = setInterval(() => setTick(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [nowProp]);
  return nowProp ?? tick;
}

export function modeLabel(mode: MyDaySourceMode): string {
  return appModeDefinition(mode).label;
}

/** One My Day row, shared by the page and the home card. */
export function MyDayItemRow({ item, now }: { readonly item: MyDayItem; readonly now: Date }) {
  const due = formatMyDayDue(item.due, now);
  // The state word is part of the link's own text, so it never relies on colour or a dot.
  const stateWord =
    item.severity === "overdue"
      ? item.mode === "my-work"
        ? "Date passed"
        : "Overdue"
      : item.severity === "soon"
        ? "Due soon"
        : "";
  const subtitle = [modeLabel(item.mode), stateWord, due].filter(Boolean).join(" · ");
  return (
    <ModeRow
      title={item.title}
      subtitle={subtitle}
      meta={
        item.detail ? <span className={cn(modeSecondaryText, "break-words leading-5")}>{item.detail}</span> : undefined
      }
      href={item.href}
      testId={`my-day-item-${item.id}`}
      trailing={
        stateWord ? (
          <span aria-hidden="true">
            <ModeStateLabel tone={item.severity === "overdue" ? "warning" : "muted"}>{stateWord}</ModeStateLabel>
          </span>
        ) : undefined
      }
    />
  );
}

export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
