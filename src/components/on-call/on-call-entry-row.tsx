"use client";

import type { LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cardInteractive, cardPadding, cardSurface } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";

export interface OnCallEntryRowProps {
  /** Row heading — a role, a scenario name, a place. Section-agnostic on purpose. */
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Metadata pills, freshness badge, section-specific detail — rendered below the heading. */
  children?: ReactNode;
  /**
   * When present, the WHOLE row is this link (e.g. a `tel:` number, so ringing
   * someone is a single tap). Mutually exclusive with `onClick`.
   */
  href?: string;
  /** Alternative to `href` for a row that opens something in place instead of navigating. */
  onClick?: () => void;
  testId?: string;
  anchorProps?: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;
}

/**
 * The shared row primitive every On Call section renders its entries through
 * (Task 9 contacts, Task 10's remaining five). The whole row is one tap
 * target of at least 48px (`min-h-tap`) — never a small control floating
 * inside a larger, inert card — because the page this shell exists for is
 * read one-handed, in a corridor, at 2am.
 *
 * Exactly one of `href`/`onClick` should be supplied for an interactive row;
 * supplying neither renders a static, non-interactive row (a plain
 * informational line — e.g. a contact with no dialable number on file).
 */
export function OnCallEntryRow({
  title,
  subtitle,
  icon: Icon,
  children,
  href,
  onClick,
  testId,
  anchorProps,
}: OnCallEntryRowProps) {
  const content = (
    <>
      {Icon ? (
        <span
          aria-hidden
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-[color:var(--text)]">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-[color:var(--text-muted)]">{subtitle}</span>
        ) : null}
        {children ? <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{children}</span> : null}
      </span>
    </>
  );

  const rowClassName = cn(cardInteractive, cardPadding.standard, "flex min-h-tap w-full items-start gap-3 text-left");

  if (href) {
    return (
      <a href={href} data-testid={testId} className={rowClassName} {...anchorProps}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-testid={testId} className={rowClassName}>
        {content}
      </button>
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn(cardSurface, cardPadding.standard, "flex min-h-tap w-full items-start gap-3")}
    >
      {content}
    </div>
  );
}
