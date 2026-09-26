"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import {
  modeIconTile,
  modeIdentityIcon,
  modeInsetHairline,
  modeModuleSurface,
  modePressable,
  modeRowHeight,
} from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * Standard module 1, the grouped list: many rows in ONE bordered card, with
 * hairlines inset to the text — never one card per item (standard §4).
 *
 * The group may carry one header icon beside its eyebrow: the "dash of colour"
 * (standard §3), 16px in the mode colour on a 24px soft tile. It is decorative
 * (`aria-hidden`) and there is never an icon on a row. The tile carries
 * `data-mode-identity={mode}` itself, so the mode tokens resolve on it and
 * nothing else on the page is repainted.
 */
export function ModeGroupedList({
  eyebrow,
  headerIcon: HeaderIcon,
  mode,
  id,
  testId,
  className,
  children,
}: {
  readonly eyebrow?: string;
  readonly headerIcon?: LucideIcon;
  /** The mode identity the header icon is painted in, e.g. `on-call`. */
  readonly mode?: string;
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
              data-mode-identity={mode}
              data-testid={testId ? `${testId}-icon` : undefined}
              className={modeIconTile}
            >
              <HeaderIcon aria-hidden="true" strokeWidth={1.5} className={modeIdentityIcon} />
            </span>
          ) : null}
          <h2 id={headingId} className={eyebrowText}>
            {eyebrow}
          </h2>
        </div>
      ) : null}
      <ul role="list" className={modeModuleSurface}>
        {children}
      </ul>
    </section>
  );
}

/**
 * One row of a grouped list: 48px on one line, 52px on two, growing only when
 * text wraps. Title at 500, the secondary line at 13px muted. Both lines are
 * 20px with 4px above and below, so two lines fill 52px exactly.
 *
 * With `href` the whole row is a link and ends in a chevron ("All roles ›");
 * otherwise the row is not itself a control, so a trailing control never sits
 * inside a link.
 */
export function ModeRow({
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
  /** Extra muted lines under the subtitle (a state label, an updated line). */
  readonly meta?: ReactNode;
  readonly trailing?: ReactNode;
  readonly href?: string;
  readonly testId?: string;
  readonly className?: string;
}) {
  const twoLine = Boolean(subtitle) || Boolean(meta);
  const body = (
    <>
      <span className="grid min-w-0 flex-1 basis-40 gap-0.5 py-1">
        <span className={cn(modeNameText, "break-words text-base-minus leading-5 text-[color:var(--text-heading)]")}>
          {title}
        </span>
        {subtitle ? <span className={cn(modeSecondaryText, "break-words leading-5")}>{subtitle}</span> : null}
        {meta}
      </span>
      {trailing ? <span className="ml-auto flex shrink-0 items-center gap-1">{trailing}</span> : null}
      {href && !trailing ? (
        <ChevronRight aria-hidden="true" className="ml-auto size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      ) : null}
    </>
  );
  const rowClass = cn(
    modeInsetHairline,
    twoLine ? modeRowHeight.double : modeRowHeight.single,
    "flex min-w-0 flex-wrap items-center gap-x-3 pl-3 pr-1",
    className,
  );
  if (href) {
    return (
      <li className={cn(modeInsetHairline, "min-w-0")}>
        <Link
          href={href}
          data-testid={testId}
          className={cn(rowClass, modePressable, focusRing, "before:hidden pr-3 no-underline")}
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
