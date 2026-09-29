"use client";

import Link from "next/link";
import { ArrowRight, Pin } from "lucide-react";
import { useRef, type MouseEvent, type PointerEvent } from "react";

import { FavouriteExampleTag } from "@/components/clinical-dashboard/favourite-example-tag";
import { FavouriteTypeTile } from "@/components/favourites/favourite-type-tile";
import {
  continueWhenLabel,
  QUICK_LAUNCH_LIMIT,
  type FavouriteItem,
} from "@/components/favourites/favourites-view-model";
import { cn } from "@/components/ui-primitives";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** "Continue where you left off": the last favourite opened, one tap away. */
export function FavouritesContinueCard({
  item,
  now,
  onOpen,
}: {
  item: FavouriteItem;
  now: number;
  onOpen: (item: FavouriteItem) => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={() => onOpen(item)}
      aria-label={`Continue ${item.title}`}
      data-testid="favourites-continue-strip"
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] py-3 pl-4 pr-3 transition hover:border-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--clinical-accent-strong)]">
          Continue where you left off
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="line-clamp-2 min-w-0 text-base-minus font-semibold leading-snug text-[color:var(--text-heading)]">
            {item.title}
          </span>
          {item.example ? <FavouriteExampleTag /> : null}
        </span>
        <span className="truncate text-xs text-[color:var(--text-muted)]">
          {item.type} · opened {item.openedAt !== null ? continueWhenLabel(item.openedAt, now) : "recently"}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-tap shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
      >
        <ArrowRight className="size-icon-lg" aria-hidden="true" />
      </span>
    </Link>
  );
}

function QuickLaunchTile({
  item,
  onOpen,
  onShowActions,
}: {
  item: FavouriteItem;
  onOpen: (item: FavouriteItem) => void;
  onShowActions: (item: FavouriteItem) => void;
}) {
  // Press and hold opens the actions, the way a phone home screen does. The
  // click that follows a long press must not also open the item.
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  function cancel() {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  }

  return (
    <Link
      href={item.href}
      onPointerDown={(event: PointerEvent<HTMLAnchorElement>) => {
        if (event.button > 0) return;
        firedRef.current = false;
        cancel();
        hold.current = {
          x: event.clientX,
          y: event.clientY,
          timer: setTimeout(() => {
            hold.current = null;
            firedRef.current = true;
            onShowActions(item);
          }, 500),
        };
      }}
      onPointerMove={(event) => {
        if (hold.current && Math.abs(event.clientX - hold.current.x) + Math.abs(event.clientY - hold.current.y) > 10) {
          cancel();
        }
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(event) => {
        event.preventDefault();
        cancel();
        onShowActions(item);
      }}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (firedRef.current) {
          event.preventDefault();
          firedRef.current = false;
          return;
        }
        onOpen(item);
      }}
      className={cn(
        "flex min-h-24 min-w-0 select-none flex-col justify-between gap-2.5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e1)] transition [-webkit-touch-callout:none] hover:border-[color:var(--border-strong)] active:bg-[color:var(--surface-subtle)]",
        focusRing,
      )}
    >
      <FavouriteTypeTile item={item} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-3 text-sm font-semibold leading-snug text-[color:var(--text-heading)]">
          {item.title}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-xs text-[color:var(--text-muted)]">{item.type}</span>
          {item.example ? <FavouriteExampleTag /> : null}
        </span>
      </span>
    </Link>
  );
}

/** Up to four pinned favourites as large tiles in thumb reach. */
export function FavouritesQuickLaunch({
  items,
  hasPinnableItems,
  onOpen,
  onShowActions,
}: {
  items: FavouriteItem[];
  /** Whether any favourite could be pinned, so the empty state can say how. */
  hasPinnableItems: boolean;
  onOpen: (item: FavouriteItem) => void;
  onShowActions: (item: FavouriteItem) => void;
}) {
  if (items.length === 0 && !hasPinnableItems) return null;
  return (
    <section
      aria-labelledby="favourites-quick-launch-heading"
      data-testid="favourites-quick-launch"
      className="grid gap-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="favourites-quick-launch-heading"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-label text-[color:var(--text-muted)]"
        >
          <Pin className="size-icon-sm -rotate-45" aria-hidden="true" />
          Quick launch
        </h2>
        <span className="nums text-xs text-[color:var(--text-muted)]">
          {items.length} of {QUICK_LAUNCH_LIMIT}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          Pin up to four favourites here for one-tap access. Swipe a row left, or use its menu, and choose Pin.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {items.map((item) => (
            <QuickLaunchTile key={item.id} item={item} onOpen={onOpen} onShowActions={onShowActions} />
          ))}
        </div>
      )}
    </section>
  );
}
