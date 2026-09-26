"use client";

import { Phone } from "lucide-react";
import { useState, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { OnCallDialSheet, onCallMobileRoute } from "@/components/on-call/kit/dial-sheet";
import {
  onCallCallDiscShape,
  onCallDot,
  onCallInsetHairline,
  onCallPressable,
  onCallRowHeight,
  onCallTapArea,
} from "@/components/on-call/kit/recipes";
import { OnCallStateLabel, type OnCallRowState } from "@/components/on-call/kit/state-label";
import { onCallNameText, onCallNumberText, onCallSecondaryText } from "@/components/on-call/kit/type";
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
  /** Quiet red on the call disc and a 6px red dot: the pinned emergency number only. */
  readonly tone?: OnCallDialRowTone;
  /** Named in the dial sheet ("Synthetic Hospital"). */
  readonly hospitalName?: string | null;
  readonly trailingAction?: ReactNode;
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

/**
 * The one dial row (amendment 1.6). Everything a list of numbers needs, in one
 * place, so the four hub pages cannot drift apart:
 *
 * - The **call disc** is the `tel:` link, inside a 48px tap area, named with the
 *   digits spaced out ("Call Switchboard, 9 0 0 0, 0 0 0 0") so a screen reader
 *   reads a number, not "nine million".
 * - The **number text** is a button that opens the "Dial from a desk phone"
 *   sheet. It is 400 weight, tabular, and wraps rather than truncating.
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
  tone = "default",
  hospitalName,
  trailingAction,
  now,
  testId,
  className,
}: OnCallDialRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const calledAt = useOnCallYouCalledAt(id);
  const emergency = tone === "emergency";
  const hasNumber = Boolean(dial && dial.kind !== "none");
  const callRoute = dial ? onCallMobileRoute(dial, mobileDial) : null;
  const viaMobile = Boolean(callRoute && callRoute !== dial);

  const recordCall = () => {
    recordOnCallRecent({ id, title, source });
    if (ON_CALL_YOU_CALLED_ENABLED) rememberOnCallYouCalled(id);
  };

  const callName = callRoute
    ? `Call ${title}${viaMobile ? " from a mobile" : ""}, ${spokenOnCallNumber(callRoute.display)}`
    : "";

  return (
    <li
      data-testid={testId}
      className={cn(
        onCallInsetHairline,
        subtitle || hasNumber ? onCallRowHeight.double : onCallRowHeight.single,
        "flex min-w-0 items-center gap-x-2 pl-3 pr-1",
        className,
      )}
    >
      <span className="grid min-w-0 flex-1 gap-0.5 py-1.5">
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={!dial || dial.kind === "none"}
          onClick={() => setSheetOpen(true)}
          className={cn(
            focusRing,
            onCallPressable,
            "-mx-1 grid min-h-12 min-w-0 content-center gap-0.5 rounded-md px-1 text-left font-normal disabled:cursor-default",
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {emergency ? (
              <span
                aria-hidden="true"
                data-testid={`${testId}-emergency-dot`}
                className={cn(onCallDot, "bg-[color:var(--danger)]")}
              />
            ) : null}
            <span
              className={cn(onCallNameText, "min-w-0 break-words text-base-minus text-[color:var(--text-heading)]")}
            >
              {title}
            </span>
          </span>
          {subtitle ? <span className={cn(onCallSecondaryText, "break-words")}>{subtitle}</span> : null}
          {hasNumber && dial ? (
            <span className={cn(onCallNumberText, "break-words text-base-minus text-[color:var(--text)]")}>
              {numberLabel ? <span className="text-[color:var(--text-muted)]">{`${numberLabel} `}</span> : null}
              {dial.display}
            </span>
          ) : null}
        </button>
        {dial?.route === "hospital-phone" ? <span className={onCallSecondaryText}>From a hospital phone</span> : null}
        {state ? <OnCallStateLabel state={state} /> : null}
        {calledAt ? (
          <span
            className={cn(onCallSecondaryText, onCallNumberText)}
          >{`You called ${formatOnCallTime(calledAt)}`}</span>
        ) : null}
      </span>

      {callRoute?.tel ? (
        <a
          href={callRoute.tel}
          onClick={recordCall}
          aria-label={callName}
          className={cn(onCallTapArea, focusRing, "rounded-full")}
        >
          <span aria-hidden="true" className={emergency ? onCallCallDiscShape.emergency : onCallCallDiscShape.neutral}>
            <Phone aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
          </span>
        </a>
      ) : null}
      {trailingAction ? <span className="flex shrink-0 items-center">{trailingAction}</span> : null}

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
          now={now}
          onCall={recordCall}
          testId={`${testId}-sheet`}
        />
      ) : null}
    </li>
  );
}
