"use client";

import { Phone } from "lucide-react";
import { useState, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { OnCallDialSheet, onCallCallRoute } from "@/components/on-call/kit/dial-sheet";
import {
  modeCallDiscShape,
  modeDot,
  modeInsetHairline,
  modePressable,
  modeRowHeight,
  modeTapArea,
} from "@/components/mode-kit/recipes";
import { OnCallStateLabel, type OnCallRowState } from "@/components/on-call/kit/state-label";
import { modeNameText, modeNumberText, modeSecondaryText } from "@/components/mode-kit/type";
import { useOnCallYouCalledAt } from "@/components/on-call/kit/use-you-called";
import { cn } from "@/components/ui-primitives";
import { rememberOnCallYouCalled } from "@/lib/on-call/call-marks";
import { formatOnCallTime } from "@/lib/on-call/display-dates";
import { ON_CALL_YOU_CALLED_ENABLED } from "@/lib/on-call/feature-flags";
import {
  onCallDialableNumber,
  resolveHandbookPhone,
  spokenOnCallNumber,
  type HandbookDial,
  type OnCallNumberLabel,
  type ResolvedOnCallNumber,
} from "@/lib/on-call/number-resolver";
import { recordOnCallRecent, type OnCallRecentSource } from "@/lib/on-call/recent-storage";

export type OnCallDialRowTone = "default" | "emergency";

export type OnCallDialRowProps = {
  readonly id: string;
  readonly source: OnCallRecentSource;
  readonly title: string;
  readonly subtitle?: string;
  readonly dial: HandbookDial | null;
  /** The "From a mobile:" route recorded beside a short code (handbook `mobileDial`). */
  readonly mobileDial?: HandbookDial | null;
  readonly numberLabel?: OnCallNumberLabel;
  readonly state?: OnCallRowState | null;
  readonly updatedAt?: string | null;
  readonly sources?: readonly { readonly label: string; readonly url: string }[];
  readonly reviewedAt?: string | null;
  readonly lastConfirmedAt?: string | null;
  /** Quiet red on the call disc and a 6px red dot: the pinned emergency number only. */
  readonly tone?: OnCallDialRowTone;
  /** Named in the dial sheet ("Synthetic Hospital"). */
  readonly hospitalName?: string | null;
  readonly trailingAction?: ReactNode;
  /** This phone is a hospital phone (the reader's switch): a bare extension rings its own digits. */
  readonly hospitalPhone?: boolean;
  /** The "I'm on a hospital phone" switch, shown in the dial sheet under a bare extension. */
  readonly hospitalPhoneSwitch?: ReactNode;
  readonly now?: Date;
  readonly testId: string;
  readonly className?: string;
};

/**
 * A personal entry's resolved number, as the same dial the handbook rows use,
 * so a reader's own numbers and the hospital's draw through one row.
 */
export function toHandbookDial(resolved: ResolvedOnCallNumber | null): HandbookDial | null {
  if (!resolved?.value) return null;
  // A pager is paged, not rung from a desk: never "From a hospital phone", never
  // "Copy extension". It shows as typed, beside its "Pager" label (review S5).
  if (resolved.label === "Pager") {
    return { kind: "text", display: resolved.value, tel: null, copy: null, route: null };
  }
  const dial = resolveHandbookPhone(resolved.value);
  if (resolved.tel && !dial.tel) {
    return {
      kind: "direct",
      display: dial.display || resolved.value,
      tel: resolved.tel,
      copy: onCallDialableNumber(resolved.value) ?? resolved.value,
      route: "any-phone",
    };
  }
  return dial;
}

/** The label is dropped when the number already says what it is ("ext 4455"), so it never reads "Ext ext". */
function visibleNumberLabel(label: OnCallNumberLabel | undefined, dial: HandbookDial | null): string | null {
  if (!label || !dial || dial.kind === "none") return null;
  if (label === "Ext" && /^ext\b/i.test(dial.display)) return null;
  return label === "Ext" ? "ext" : label;
}

/**
 * The one dial row (amendment 1.6). Everything a list of numbers needs, in one
 * place, so the four hub pages cannot drift apart:
 *
 * - The **call disc** is the `tel:` link, inside a 48px tap area, named with the
 *   digits spaced out ("Call Switchboard, 9 0 0 0, 0 0 0 0") so a screen reader
 *   reads a number, not "nine million".
 * - The **number text** sits in a fixed right-hand column beside the disc, so
 *   digits line up down a list (standard §2), and is a button that opens the
 *   "Dial from a desk phone" sheet. It is 400 weight, tabular, and wraps rather
 *   than truncating.
 * - The row is **48px** with a title alone and **52px** with one secondary
 *   line (subtitle, number label, "From a hospital phone", state, "You
 *   called"), matching `OnCallModuleSkeleton`. Nothing in it carries vertical
 *   padding; a test fails if any does (review B1).
 * - A desk-only number (an extension or short code) gets **no call disc** and
 *   says "From a hospital phone". If a mobile route is recorded beside it, that
 *   route is the row's only call link.
 * - A tap on the call link records "Your usual" and the "You called 02:14" mark.
 *
 * The row is a list item and is never a link itself, so no control sits inside
 * another control.
 */
export function OnCallDialRow({
  id,
  source,
  title,
  subtitle,
  dial,
  mobileDial,
  numberLabel,
  state,
  updatedAt,
  sources,
  reviewedAt,
  lastConfirmedAt,
  tone = "default",
  hospitalName,
  trailingAction,
  hospitalPhone = false,
  hospitalPhoneSwitch,
  now,
  testId,
  className,
}: OnCallDialRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const calledAt = useOnCallYouCalledAt(id);
  const emergency = tone === "emergency";
  const hasNumber = Boolean(dial && dial.kind !== "none");
  const callRoute = dial ? onCallCallRoute(dial, mobileDial, hospitalPhone) : null;
  const viaMobile = Boolean(mobileDial && callRoute === mobileDial);

  const recordCall = () => {
    // A hospital row is remembered by id and kind only; its title stays in the
    // signed-in handbook (review B2).
    recordOnCallRecent(source === "handbook" ? { id, source } : { id, title, source });
    if (ON_CALL_YOU_CALLED_ENABLED) rememberOnCallYouCalled(id);
  };

  const callName = callRoute
    ? `Call ${title}${viaMobile ? " from a mobile" : ""}${emergency ? ", emergency" : ""}, ${spokenOnCallNumber(callRoute.display)}`
    : "";

  // Everything under the title shares ONE secondary line, so a row is 48px
  // with a title alone and 52px with a second line — the heights the skeleton
  // reserves. It grows only when that line wraps.
  const secondary: ReactNode[] = [];
  if (subtitle) secondary.push(<span key="subtitle">{subtitle}</span>);
  const label = visibleNumberLabel(numberLabel, dial);
  if (label) secondary.push(<span key="label">{label}</span>);
  if (dial?.route === "hospital-phone") secondary.push(<span key="route">From a hospital phone</span>);
  if (state) secondary.push(<OnCallStateLabel key="state" state={state} />);
  if (calledAt) {
    secondary.push(<span key="called" className={modeNumberText}>{`You called ${formatOnCallTime(calledAt)}`}</span>);
  }

  return (
    <li
      data-testid={testId}
      className={cn(
        modeInsetHairline,
        secondary.length > 0 ? modeRowHeight.double : modeRowHeight.single,
        // No vertical padding here or in either column: the 48px controls on
        // the right set the floor, and the row's min height sets 48/52.
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 pl-3 pr-1",
        className,
      )}
    >
      <span data-dial-row-title="" className="grid min-w-0 content-center gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          {emergency ? (
            <span
              aria-hidden="true"
              data-testid={`${testId}-emergency-dot`}
              className={cn(modeDot, "bg-[color:var(--danger)]")}
            />
          ) : null}
          <span className={cn(modeNameText, "min-w-0 break-words text-base-minus text-[color:var(--text-heading)]")}>
            {title}
          </span>
        </span>
        {secondary.length > 0 ? (
          <span className={cn(modeSecondaryText, "flex min-w-0 flex-wrap items-center gap-x-1.5 break-words")}>
            {secondary.flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    <span key={`dot-${index}`} aria-hidden="true">
                      ·
                    </span>,
                    part,
                  ],
            )}
          </span>
        ) : null}
      </span>

      {hasNumber && dial ? (
        <span className="flex shrink-0 items-center">
          {/* The number column: a fixed width, right-aligned, so digits line up
              down a list (standard §2). The number text opens the desk-phone
              sheet; it wraps rather than truncating. */}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${dial.display}. Dialling details for ${title}`}
            onClick={() => setSheetOpen(true)}
            data-dial-row-number=""
            className={cn(
              focusRing,
              modePressable,
              modeNumberText,
              "grid min-h-12 w-30 content-center justify-items-end rounded-md px-1 text-right text-base-minus text-[color:var(--text)]",
            )}
          >
            <span className="break-words">{dial.display}</span>
          </button>
          {callRoute?.tel ? (
            <a
              href={callRoute.tel}
              onClick={recordCall}
              aria-label={callName}
              className={cn(modeTapArea, focusRing, "rounded-full")}
            >
              <span aria-hidden="true" className={emergency ? modeCallDiscShape.emergency : modeCallDiscShape.neutral}>
                <Phone aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
              </span>
            </a>
          ) : (
            // Holds the disc's place, so a desk-only number stays in line.
            <span aria-hidden="true" data-dial-row-disc-spacer="" className="w-12 shrink-0" />
          )}
          {trailingAction ? <span className="flex shrink-0 items-center">{trailingAction}</span> : null}
        </span>
      ) : trailingAction ? (
        <span className="flex shrink-0 items-center">{trailingAction}</span>
      ) : null}

      {dial && dial.kind !== "none" ? (
        <OnCallDialSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={title}
          hospitalName={hospitalName}
          dial={dial}
          mobileDial={mobileDial}
          updatedAt={updatedAt}
          sources={sources}
          reviewedAt={reviewedAt}
          lastConfirmedAt={lastConfirmedAt}
          now={now}
          onCall={recordCall}
          hospitalPhone={hospitalPhone}
          hospitalPhoneSwitch={hospitalPhoneSwitch}
          testId={`${testId}-sheet`}
        />
      ) : null}
    </li>
  );
}
