"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { modeInsetHairline, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";

/*
 * A grouped-list row that opens something in place (`onClick`) or leaves the
 * app (`externalHref`, a new tab). The kit's `ModeRow` on main renders only an
 * in-app `next/link` or a static row: it has no `onClick` and no external link
 * (U1 report, R14). So this composes the same row from the kit's own recipes
 * and type, with the kit's 48/52px heights and inset hairline, and sits inside
 * a `ModeGroupedList` beside ordinary `ModeRow`s. In-app links still use
 * `ModeRow` itself. No icon on the row (standard §4).
 */
export function TeachingRow({
  title,
  subtitle,
  meta,
  onClick,
  externalHref,
  testId,
}: {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  /** Extra muted lines under the subtitle, such as a state label. */
  readonly meta?: ReactNode;
  readonly onClick?: () => void;
  readonly externalHref?: string | null;
  readonly testId?: string;
}) {
  const twoLine = Boolean(subtitle) || Boolean(meta);
  const height = twoLine ? modeRowHeight.double : modeRowHeight.single;
  const text = (
    <span className="grid min-w-0 flex-1 basis-40 gap-0.5 py-1">
      <span className={cn(modeNameText, "text-base-minus leading-5 break-words text-[color:var(--text-heading)]")}>
        {title}
      </span>
      {subtitle ? <span className={cn(modeSecondaryText, "leading-5 break-words")}>{subtitle}</span> : null}
      {meta}
    </span>
  );
  const control = cn(
    height,
    modePressable,
    focusRing,
    "flex w-full min-w-0 flex-wrap items-center gap-x-3 pr-2 pl-3 text-left no-underline",
  );
  const chevron = "ml-auto size-icon-md shrink-0 text-[color:var(--text-muted)]";

  if (externalHref) {
    return (
      <li className={cn(modeInsetHairline, "flex min-w-0 items-center pr-1")}>
        <a href={externalHref} target="_blank" rel="noreferrer" data-testid={testId} className={control}>
          {text}
          <ExternalLink aria-hidden="true" className={chevron} />
        </a>
      </li>
    );
  }
  if (onClick) {
    return (
      <li className={cn(modeInsetHairline, "flex min-w-0 items-center pr-1")}>
        <button type="button" onClick={onClick} data-testid={testId} className={control}>
          {text}
          <ChevronRight aria-hidden="true" className={chevron} />
        </button>
      </li>
    );
  }
  return (
    <li
      className={cn(modeInsetHairline, height, "flex min-w-0 flex-wrap items-center gap-x-3 pr-1 pl-3")}
      data-testid={testId}
    >
      {text}
    </li>
  );
}
