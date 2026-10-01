"use client";

import { Phone, Timer } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { focusRing } from "@/components/card-recipes";
import { OnCallGroupedList, OnCallRow } from "@/components/on-call/kit/grouped-list";
import { onCallCallDiscShape, onCallTapArea } from "@/components/on-call/kit/recipes";
import { onCallNumberText } from "@/components/on-call/kit/type";
import { cn } from "@/components/ui-primitives";
import { readOnCallYouCalled, rememberOnCallYouCalled, type OnCallYouCalled } from "@/lib/on-call/call-marks";
import {
  onCallCallMarksStorageKey,
  onCallDeviceStateChangedEvent,
  onCallDeviceStoreChangedEvent,
} from "@/lib/on-call/device-state-keys";
import { ON_CALL_YOU_CALLED_ENABLED } from "@/lib/on-call/feature-flags";
import { formatOnCallTime } from "@/lib/on-call/display-dates";
import { spokenOnCallNumber } from "@/lib/on-call/number-resolver";
import { onCallLadderStepMarkId, type OnCallNeedsYou } from "@/lib/on-call/now-rows";

function subscribeToMarks(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(onCallDeviceStoreChangedEvent, onChange);
  window.addEventListener(onCallDeviceStateChangedEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(onCallDeviceStoreChangedEvent, onChange);
    window.removeEventListener(onCallDeviceStateChangedEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function marksSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(onCallCallMarksStorageKey) ?? "";
  } catch {
    return "";
  }
}

/**
 * This shift's "You called" marks (ids and times only), re-read when a call is
 * recorded here, in another tab, or wiped at sign-out. Empty while the "You
 * called" line is switched off, so Needs you goes with it.
 */
export function useOnCallCallMarks(now: Date): readonly OnCallYouCalled[] {
  const raw = useSyncExternalStore(subscribeToMarks, marksSnapshot, () => "");
  return useMemo(() => (ON_CALL_YOU_CALLED_ENABLED && raw ? readOnCallYouCalled(now) : []), [raw, now]);
}

/** "6 min ago", "1 h 5 min ago": elapsed time only, never a deadline. */
function elapsed(calledAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(calledAt)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h ago` : `${hours} h ${rest} min ago`;
}

/**
 * "Needs you" (v6 Now): one row, only while a call to a rung of the reader's
 * own ladder is waiting. It says who was rung and when, names the next rung,
 * and rings it in one tap. The row itself opens the ladder in the Playbook.
 *
 * It keeps no record: the time comes from the 12-hour "You called" mark, which
 * is an id and a time only. A wait is shown only when the hospital recorded one; no overdue verdict is inferred.
 */
export function NowNeedsYou({
  needs,
  ladderHref,
  now: pageNow,
  live,
}: {
  readonly needs: OnCallNeedsYou | null;
  readonly ladderHref: string | null;
  readonly now: Date;
  /** False when the caller pinned the clock: the elapsed time then stays on that moment. */
  readonly live: boolean;
}) {
  // The page wakes only at period boundaries, so the "6 min ago" keeps its own
  // minute clock, and only while the row is showing.
  const [tick, setTick] = useState<Date | null>(null);
  const showing = needs !== null;
  useEffect(() => {
    if (!showing || !live) return;
    const timer = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [showing, live]);
  const now = live && tick && tick > pageNow ? tick : pageNow;
  if (!needs) return null;
  const { next } = needs;
  const tel = next.dial.tel;
  return (
    <OnCallGroupedList eyebrow="Needs you" headerIcon={Timer} testId="on-call-now-needs-you">
      <OnCallRow
        title={`Waiting on ${needs.waitingOn}`}
        subtitle={
          <span className={onCallNumberText}>
            {`Called ${formatOnCallTime(needs.calledAt)} · ${elapsed(needs.calledAt, now)}${needs.waitMinutes ? ` · Hospital-set wait: ${needs.waitMinutes} min` : ""} · next: ${next.whoToCall}, ${next.dial.display}`}
          </span>
        }
        href={ladderHref ?? undefined}
        trailing={
          tel ? (
            <a
              href={tel}
              onClick={() => rememberOnCallYouCalled(onCallLadderStepMarkId(needs.ladderId, next.order))}
              aria-label={`Call ${next.whoToCall}, the next rung, ${spokenOnCallNumber(next.dial.display)}`}
              data-testid="on-call-now-needs-you-call"
              className={cn(onCallTapArea, focusRing, "rounded-full")}
            >
              <span aria-hidden="true" className={onCallCallDiscShape.neutral}>
                <Phone aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
              </span>
            </a>
          ) : undefined
        }
        testId="on-call-now-needs-you-row"
      />
    </OnCallGroupedList>
  );
}
