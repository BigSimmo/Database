"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn, eyebrowText, iconTilePremium, textMuted } from "@/components/ui-primitives";

export type Crumb = {
  label: string;
  /** Omit on the final crumb — the current page is not a link to itself. */
  href?: string;
};

export type BreadcrumbProps = {
  items: Crumb[];
  className?: string;
};

/**
 * Internal navigation goes through `<Link>`, never a raw `<a href="/…">`
 * (docs/wiring-conventions.md). The trailing crumb is plain text carrying
 * `aria-current="page"`.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}:${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight aria-hidden="true" className="size-icon-xs shrink-0 text-[color:var(--text-soft)]" />
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate rounded-sm text-[color:var(--text-muted)] transition hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="truncate font-semibold text-[color:var(--text)]"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type PageHeaderProps = {
  title: string;
  /** Short kicker above the title — section, mode, or record kind. */
  eyebrow?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  breadcrumb?: Crumb[];
  /** Primary/secondary controls. One filled `--command` button, at most. */
  actions?: ReactNode;
  /** Status chips, counts, or provenance shown under the description. */
  meta?: ReactNode;
  className?: string;
};

/**
 * Page-level counterpart to `PanelHeading`: `PanelHeading` titles a panel inside a
 * page, `PageHeader` titles the page itself and owns the `<h1>`. A page should
 * carry exactly one.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  icon: Icon,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("min-w-0 space-y-3", className)}>
      {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className={iconTilePremium}>
              <Icon aria-hidden="true" className="size-icon-lg" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? <p className={eyebrowText}>{eyebrow}</p> : null}
            <h1 className="truncate text-xl font-semibold text-[color:var(--text-heading)]">{title}</h1>
            {description ? <p className={cn("mt-1 max-w-[68ch] text-sm leading-6", textMuted)}>{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-1.5">{meta}</div> : null}
    </header>
  );
}
