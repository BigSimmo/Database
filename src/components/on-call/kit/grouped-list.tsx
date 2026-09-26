"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import {
  onCallInsetHairline,
  onCallModeIcon,
  onCallModeIconTile,
  onCallModuleSurface,
  onCallPressable,
  onCallRowHeight,
} from "@/components/on-call/kit/recipes";
import { onCallNameText, onCallSecondaryText } from "@/components/on-call/kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * Standard module 1, the grouped list: many rows in ONE bordered card, with
 * hairlines inset to the text — never one card per item (standard §4).
 *
 * The group may carry one header icon beside its eyebrow: the "dash of colour"
 * (standard v12 §3), 16px in the mode colour on a 24px soft tile. It is
 * decorative (`aria-hidden`) and there is never an icon on a row. The tile
 * carries `data-mode-identity="on-call"` itself, so the mode tokens resolve on
 * it and nothing else on the page is repainted.
 */
export function OnCallGroupedList({
  eyebrow,
  headerIcon: HeaderIcon,
  id,
  testId,
  className,
  children,
}: {
  readonly eyebrow?: string;
  readonly headerIcon?: LucideIcon;
  /** The group's anchor, e.g. `on-call-group-hospital`. */
  readonly id?: string;
  readonly testId?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={eyebrow ? headingId : undefined}
      className={cn("grid min-w-0 gap-2 scroll-mt-32", className)}
      data-testid={testId}
    >
      {eyebrow ? (
        <div className="flex min-w-0 items-center gap-2 px-3">
          {HeaderIcon ? (
            <span
              aria-hidden="true"
              data-mode-identity="on-call"
              data-testid={testId ? `${testId}-icon` : undefined}
              className={onCallModeIconTile}
            >
              <HeaderIcon aria-hidden="true" strokeWidth={1.5} className={onCallModeIcon} />
            </span>
          ) : null}
          <h2 id={headingId} className={eyebrowText}>
            {eyebrow}
          </h2>
        </div>
      ) : null}
      <ul role="list" className={onCallModuleSurface}>
        {children}
      </ul>
    </section>
  );
}

/**
 * One row of a grouped list: 48px on one line, 52px on two, growing only when
 * text wraps. Title at 500, the secondary line at 13px muted.
 *
 * With `href` the whole row is a link and ends in a chevron ("All roles ›");
 * otherwise the row is not itself a control, so a trailing control never sits
 * inside a link.
 */
export function OnCallRow({
  title,
  subtitle,
  meta,
  trailing,
  href,
  testId,
  className,
}: {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  /** Extra muted lines under the subtitle (state, updated, "You called"). */
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
  readonly href?: string;
  readonly testId?: string;
  readonly className?: string;
}) {
  const twoLine = Boolean(subtitle) || Boolean(meta);
  const body = (
    <>
      <span className="grid min-w-0 flex-1 basis-40 gap-0.5 py-1.5">
        <span className={cn(onCallNameText, "break-words text-base-minus text-[color:var(--text-heading)]")}>
          {title}
        </span>
        {subtitle ? <span className={cn(onCallSecondaryText, "break-words")}>{subtitle}</span> : null}
        {meta}
      </span>
      {trailing ? <span className="ml-auto flex shrink-0 items-center gap-1">{trailing}</span> : null}
      {href && !trailing ? (
        <ChevronRight aria-hidden="true" className="ml-auto size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      ) : null}
    </>
  );
  const rowClass = cn(
    onCallInsetHairline,
    twoLine ? onCallRowHeight.double : onCallRowHeight.single,
    "flex min-w-0 flex-wrap items-center gap-x-3 pl-3 pr-1",
    className,
  );
  if (href) {
    return (
      <li className={cn(onCallInsetHairline, "min-w-0")}>
        <Link
          href={href}
          data-testid={testId}
          className={cn(rowClass, onCallPressable, focusRing, "before:hidden pr-3 no-underline")}
        >
          {body}
        </Link>
      </li>
    );
  }
  return (
    <li className={rowClass} data-testid={testId}>
      {body}
    </li>
  );
}
