"use client";

import { Phone, Pin, PinOff, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { OnCallDialSheet, onCallMobileRoute } from "@/components/on-call/kit/dial-sheet";
import { toHandbookDial } from "@/components/on-call/kit/dial-row";
import {
  onCallCallDiscShape,
  onCallModeIcon,
  onCallModeIconTile,
  onCallModuleSurface,
  onCallPressable,
  onCallTapArea,
} from "@/components/on-call/kit/recipes";
import { OnCallStateLabel } from "@/components/on-call/kit/state-label";
import { onCallNameText, onCallNumberText, onCallSecondaryText } from "@/components/on-call/kit/type";
import { useOnCallYouCalledAt } from "@/components/on-call/kit/use-you-called";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { rememberOnCallYouCalled } from "@/lib/on-call/call-marks";
import { formatOnCallTime } from "@/lib/on-call/display-dates";
import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { ON_CALL_YOU_CALLED_ENABLED } from "@/lib/on-call/feature-flags";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import {
  resolveOnCallNumber,
  spokenOnCallNumber,
  type HandbookDial,
  type OnCallNumberFields,
} from "@/lib/on-call/number-resolver";
import {
  clearOnCallRecent,
  recordOnCallRecent,
  resolveOnCallUsual,
  setOnCallUsualPinned,
  type OnCallRecentItem,
} from "@/lib/on-call/recent-storage";

/** Four identical tiles, then "Show all" (v6 Now). */
const ON_CALL_USUAL_TILE_LIMIT = 4;

export type UsualTile =
  | {
      readonly kind: "handbook";
      readonly id: string;
      readonly title: string;
      readonly item: HandbookItem;
      readonly pinnable: boolean;
      readonly pinned: boolean;
    }
  | {
      readonly kind: "entry";
      readonly id: string;
      readonly title: string;
      readonly entry: OnCallEntry;
      readonly pinnable: boolean;
      readonly pinned: boolean;
    }
  | { readonly kind: "removed"; readonly id: string };

/**
 * "Your usual" as tiles, in this shift's frozen order.
 *
 *  - Every stored row goes through `resolveOnCallUsual` (review B2): a hospital
 *    row takes its title and number from the signed-in handbook at render and
 *    is hidden when the handbook no longer has it. A hospital row this device
 *    saw withdrawn shows the removed notice instead of a number.
 *  - The reader's own entries ticked "Call first on the home" that are not
 *    listed yet join at the end, in their own order: that is how a new
 *    reader's list starts.
 *  - An own entry must still exist to be shown; its digits are read from the
 *    live entry, never from storage.
 */
export function usualTiles({
  usual,
  handbookItems,
  removedIds,
  entries,
}: {
  readonly usual: readonly OnCallRecentItem[];
  readonly handbookItems: readonly HandbookItem[];
  readonly removedIds: ReadonlySet<string>;
  readonly entries: readonly OnCallEntry[];
}): UsualTile[] {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const resolved = new Map(resolveOnCallUsual(usual, handbookItems).map((row) => [row.item.id, row]));
  const tiles: UsualTile[] = [];
  const listed = new Set<string>();
  for (const item of usual) {
    const row = resolved.get(item.id);
    if (row?.handbook) {
      tiles.push({
        kind: "handbook",
        id: item.id,
        title: row.handbook.parsed.label,
        item: row.handbook,
        pinnable: true,
        pinned: item.pinned,
      });
    } else if (row) {
      const entry = entriesById.get(item.id);
      if (entry)
        tiles.push({ kind: "entry", id: item.id, title: entry.title, entry, pinnable: true, pinned: item.pinned });
    } else if (item.source === "handbook" && removedIds.has(item.id)) {
      tiles.push({ kind: "removed", id: item.id });
    }
    listed.add(item.id);
  }
  const callFirst = entries
    .filter((entry) => entry.tags.includes("call-first") && !listed.has(entry.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  for (const entry of callFirst) {
    tiles.push({ kind: "entry", id: entry.id, title: entry.title, entry, pinnable: false, pinned: false });
  }
  return tiles;
}

function recordCall(tile: Extract<UsualTile, { kind: "handbook" | "entry" }>): void {
  // A hospital row is remembered by id and kind only; its title stays in the
  // signed-in handbook (review B2).
  recordOnCallRecent(
    tile.kind === "handbook" ? { id: tile.id, source: "handbook" } : { id: tile.id, title: tile.title },
  );
  if (ON_CALL_YOU_CALLED_ENABLED) rememberOnCallYouCalled(tile.id);
}

function CallDisc({
  href,
  name,
  onCall,
}: {
  readonly href: string;
  readonly name: string;
  readonly onCall: () => void;
}) {
  return (
    <a href={href} onClick={onCall} aria-label={name} className={cn(onCallTapArea, focusRing, "rounded-full")}>
      <span aria-hidden="true" className={onCallCallDiscShape.neutral}>
        <Phone aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
      </span>
    </a>
  );
}

function PinToggle({ tile }: { readonly tile: Extract<UsualTile, { kind: "handbook" | "entry" }> }) {
  if (!tile.pinnable) return null;
  const Icon = tile.pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      aria-pressed={tile.pinned}
      aria-label={`${tile.pinned ? "Unpin" : "Pin"} ${tile.title}`}
      onClick={() => setOnCallUsualPinned(tile.id, !tile.pinned)}
      data-testid={`on-call-now-usual-${tile.id}-pin`}
      className={cn(onCallTapArea, focusRing, "-mr-2 -mt-3 rounded-md text-[color:var(--text-muted)]")}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
    </button>
  );
}

const tileSurface = cn(onCallModuleSurface, "grid min-h-24 min-w-0 content-between gap-1 py-3 pl-3 pr-1");

function DialTile({
  tile,
  hospitalName,
  now,
}: {
  readonly tile: Extract<UsualTile, { kind: "handbook" | "entry" }>;
  readonly hospitalName: string | null;
  readonly now: Date;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const calledAt = useOnCallYouCalledAt(tile.id);
  let dial: HandbookDial | null;
  let mobileDial: HandbookDial | null = null;
  let label: string | null = null;
  let withhold = false;
  if (tile.kind === "handbook") {
    dial = tile.item.dial.kind === "none" ? null : tile.item.dial;
    mobileDial = tile.item.mobileDial;
  } else {
    const resolved = resolveOnCallNumber(tile.entry.details as OnCallNumberFields, now);
    dial = toHandbookDial(resolved);
    // A personal number does not print on Now, as Contacts treats it; the
    // tile still dials it.
    withhold = tile.entry.isPersonal;
    label = resolved?.label ?? null;
  }
  const route = dial ? onCallMobileRoute(dial, mobileDial) : null;
  const viaMobile = Boolean(route && route !== dial);
  const onCall = () => recordCall(tile);
  const secondary: string[] = [];
  if (label && (withhold || label !== "Direct")) secondary.push(label);
  if (dial?.route === "hospital-phone") secondary.push("From a hospital phone");
  if (calledAt) secondary.push(`You called ${formatOnCallTime(calledAt)}`);

  return (
    <li className={tileSurface} data-testid={`on-call-now-usual-${tile.id}`}>
      <span className="flex min-w-0 items-start gap-1">
        <span
          className={cn(
            onCallNameText,
            "min-w-0 flex-1 break-words text-sm leading-5 text-[color:var(--text-heading)]",
          )}
        >
          {tile.title}
        </span>
        <PinToggle tile={tile} />
      </span>
      <span className="flex min-w-0 items-end gap-1">
        <span className="grid min-w-0 flex-1 gap-0.5">
          {dial && !withhold ? (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`${dial.display}. Dialling details for ${tile.title}`}
              onClick={() => setSheetOpen(true)}
              className={cn(
                focusRing,
                onCallPressable,
                onCallNumberText,
                "-ml-1 min-h-12 rounded-md px-1 text-left text-base-minus text-[color:var(--text)]",
              )}
            >
              <span className="break-words">{dial.display}</span>
            </button>
          ) : null}
          {!dial ? <OnCallStateLabel state={{ kind: "not-recorded" }} /> : null}
          {secondary.length > 0 ? (
            <span className={cn(onCallSecondaryText, "break-words")}>{secondary.join(" · ")}</span>
          ) : null}
        </span>
        {route?.tel ? (
          <CallDisc
            href={route.tel}
            onCall={onCall}
            name={
              withhold
                ? `Call ${tile.title}`
                : `Call ${tile.title}${viaMobile ? " from a mobile" : ""}, ${spokenOnCallNumber(route.display)}`
            }
          />
        ) : null}
      </span>
      {dial && !withhold ? (
        <OnCallDialSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={tile.title}
          hospitalName={tile.kind === "handbook" ? hospitalName : null}
          dial={dial}
          mobileDial={mobileDial}
          updatedAt={tile.kind === "handbook" ? tile.item.updatedAt : null}
          sources={tile.kind === "handbook" ? tile.item.sources : undefined}
          now={now}
          onCall={onCall}
          testId={`on-call-now-usual-${tile.id}-sheet`}
        />
      ) : null}
    </li>
  );
}

function TileOutlines({ count }: { readonly count: number }) {
  return (
    <ul aria-hidden="true" className={tilesGrid} data-testid="on-call-now-usual-outlines">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} data-skeleton-row="" className={tileSurface}>
          <span className="h-3 w-3/5 rounded-sm bg-[color:var(--surface-subtle)]" />
          <span className="h-3 w-2/5 rounded-sm bg-[color:var(--surface-subtle)]" />
        </li>
      ))}
    </ul>
  );
}

/** Two across on a phone; one column once text is enlarged (nothing is cut off). */
const tilesGrid = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2";

export function NowYourUsual({
  tiles,
  outlineCount,
  canClear,
  hospitalName,
  now,
}: {
  readonly tiles: readonly UsualTile[];
  /** Whether this device holds a list to clear (the call-first entries are not part of it). */
  readonly canClear: boolean;
  /** Held as static outlines while the hospital's numbers load; null once they have. */
  readonly outlineCount: number | null;
  readonly hospitalName: string | null;
  readonly now: Date;
}) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tiles : tiles.slice(0, ON_CALL_USUAL_TILE_LIMIT);
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-2" data-testid="on-call-home-recent">
      <div className="flex min-w-0 items-center gap-2 px-3">
        <span aria-hidden="true" data-mode-identity="on-call" className={onCallModeIconTile}>
          <Pin aria-hidden="true" strokeWidth={1.5} className={onCallModeIcon} />
        </span>
        <h2 id={headingId} className={cn(eyebrowText, "min-w-0 flex-1")}>
          Your usual
        </h2>
        {canClear && outlineCount === null ? (
          <button
            type="button"
            onClick={() => clearOnCallRecent()}
            data-testid="on-call-home-recent-clear"
            className={cn(
              focusRing,
              "-my-3 inline-flex min-h-12 items-center gap-1 rounded-md px-2 text-sm text-[color:var(--text-muted)]",
            )}
          >
            <Trash2 aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
            Clear
          </button>
        ) : null}
      </div>
      {outlineCount !== null ? (
        <TileOutlines count={Math.max(1, Math.min(outlineCount, ON_CALL_USUAL_TILE_LIMIT))} />
      ) : tiles.length === 0 ? (
        <p className={cn(onCallSecondaryText, "px-3")} data-testid="on-call-now-usual-empty">
          Numbers you call show here. To start the list, tick &quot;Call first on the home&quot; on your own entries.
        </p>
      ) : (
        <>
          <ul role="list" className={tilesGrid} data-testid="on-call-now-usual">
            {shown.map((tile) =>
              tile.kind === "removed" ? (
                <li key={tile.id} className={tileSurface} data-testid={`on-call-now-usual-${tile.id}`}>
                  <OnCallStateLabel state={{ kind: "removed" }} />
                </li>
              ) : (
                <DialTile key={tile.id} tile={tile} hospitalName={hospitalName} now={now} />
              ),
            )}
          </ul>
          {tiles.length > ON_CALL_USUAL_TILE_LIMIT ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              data-testid="on-call-now-usual-more"
              className={cn(
                focusRing,
                "inline-flex min-h-12 items-center justify-self-start rounded-md px-3 text-sm font-medium text-[color:var(--text-heading)]",
              )}
            >
              {expanded ? "Show fewer" : `Show all ${tiles.length}`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
