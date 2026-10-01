"use client";

import { ChevronRight, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import {
  PhoneFooterLayerPortal,
  usePhoneFooterLayerScrollHidden,
} from "@/components/clinical-dashboard/phone-footer-layer-portal";
import { modeInsetHairline, modeModuleSurface, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { primaryControl } from "@/components/primitive-recipes/recipes";
import { Sheet } from "@/components/ui/sheet";
import { cn, ignoreUnavailableActivation } from "@/components/ui-primitives";

/**
 * One "New" for every Roster page. The host page owns its list of entries
 * (each runs a handler or follows a link); this component owns only the
 * button and the one bottom sheet that lists them.
 *
 * Phones: a violet pill, bottom right, moved into the frame's footer layer and
 * hidden with the footer scroll signal. It adds no page padding: its safe-area
 * and dock clearance sit inside its own fixed box. sm+: the same button renders
 * in place, so the host can put it in its page header.
 */

export type RosterNewEntry = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon: LucideIcon;
  readonly onSelect?: () => void;
  readonly href?: string;
  /** Shown but unavailable, with the reason said aloud and on screen. */
  readonly disabled?: { readonly reason: string };
};

const rowClass = cn(
  modeRowHeight.double,
  modePressable,
  focusRing,
  "flex w-full min-w-0 items-center gap-3 px-3 text-left",
);

function EntryBody({ entry, reasonId }: { readonly entry: RosterNewEntry; readonly reasonId: string }) {
  const Icon = entry.icon;
  const detail = entry.disabled?.reason ?? entry.description;
  return (
    <>
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      <span className="grid min-w-0 flex-1 gap-0.5 py-1">
        <span
          className={cn(
            modeNameText,
            "text-base-minus leading-5",
            entry.disabled ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-heading)]",
          )}
        >
          {entry.label}
        </span>
        {detail ? (
          <span id={entry.disabled ? reasonId : undefined} className={cn(modeSecondaryText, "leading-5")}>
            {detail}
          </span>
        ) : null}
      </span>
      {entry.disabled ? null : (
        <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      )}
    </>
  );
}

function EntryRow({
  entry,
  onChoose,
  testId,
}: {
  readonly entry: RosterNewEntry;
  readonly onChoose: (entry: RosterNewEntry) => void;
  readonly testId: string;
}) {
  const reasonId = useId();
  const rowTestId = `${testId}-entry-${entry.id}`;
  if (entry.disabled) {
    return (
      <li className={modeInsetHairline}>
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={reasonId}
          title={entry.disabled.reason}
          onClick={ignoreUnavailableActivation}
          data-testid={rowTestId}
          className={cn(rowClass, "cursor-not-allowed")}
        >
          <EntryBody entry={entry} reasonId={reasonId} />
        </button>
      </li>
    );
  }
  return (
    <li className={modeInsetHairline}>
      {entry.href ? (
        <Link href={entry.href} onClick={() => onChoose(entry)} data-testid={rowTestId} className={rowClass}>
          <EntryBody entry={entry} reasonId={reasonId} />
        </Link>
      ) : (
        <button type="button" onClick={() => onChoose(entry)} data-testid={rowTestId} className={rowClass}>
          <EntryBody entry={entry} reasonId={reasonId} />
        </button>
      )}
    </li>
  );
}

export function RosterNewButton({
  entries,
  label = "New",
  testId = "roster-new",
}: {
  readonly entries: readonly RosterNewEntry[];
  readonly label?: string;
  readonly testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const sheetId = useId();
  const scrollHidden = usePhoneFooterLayerScrollHidden() === true;
  const hidden = scrollHidden && !open;

  function choose(entry: RosterNewEntry) {
    setOpen(false);
    entry.onSelect?.();
  }

  return (
    <>
      <PhoneFooterLayerPortal>
        <div
          data-testid={`${testId}-layer`}
          data-scroll-hidden={hidden ? "true" : undefined}
          className={cn(
            // Phones: a fixed box in the footer layer, bottom right. Its own
            // padding clears the safe area or a visible search dock (whichever is
            // taller); the page itself gains no padding, so hidden means zero reserve.
            "phone-footer-layer pointer-events-none max-sm:bottom-0 max-sm:right-0 max-sm:z-[var(--z-chrome)] max-sm:pb-[calc(0.75rem+max(var(--safe-area-bottom),var(--mobile-composer-reserve,0rem)))] max-sm:pr-4",
            "max-sm:transition-[transform,opacity] motion-reduce:transition-none print:hidden",
            hidden
              ? "max-sm:pointer-events-none max-sm:translate-y-full max-sm:opacity-0 max-sm:duration-[var(--duration-slow)] max-sm:ease-[var(--ease-chrome-hide)]"
              : "max-sm:duration-[var(--duration-moderate)] max-sm:ease-[var(--ease-chrome-reveal)]",
            // sm+: in flow, wherever the host placed it.
            "sm:contents",
          )}
        >
          <button
            ref={opener}
            type="button"
            data-mode-identity="roster"
            data-testid={testId}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? sheetId : undefined}
            onClick={() => setOpen(true)}
            className={cn(
              primaryControl,
              "pointer-events-auto min-h-12 bg-[color:var(--mode-identity)] text-[color:var(--mode-identity-contrast)] hover:bg-[color:var(--mode-identity)] max-sm:rounded-full max-sm:px-5 max-sm:shadow-[var(--e4)]",
              hidden && "max-sm:pointer-events-none",
            )}
          >
            <Plus aria-hidden="true" className="size-icon-sm" />
            {label}
          </button>
        </div>
      </PhoneFooterLayerPortal>

      <Sheet
        id={sheetId}
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        mobilePlacement="bottom"
        returnFocusRef={opener}
        testId={`${testId}-sheet`}
      >
        <ul role="list" className={modeModuleSurface}>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onChoose={choose} testId={testId} />
          ))}
        </ul>
      </Sheet>
    </>
  );
}
