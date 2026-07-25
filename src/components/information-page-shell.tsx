import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn, eyebrowText, pageContainer } from "@/components/ui-primitives";

/**
 * Shared outer chrome for mode information (detail/record) pages.
 *
 * Contract:
 * - Landmark is always `<main>` (use `as="div"` only when nested inside an existing main).
 * - Phone: `min-h-0` so the shell dock reserve is not double-counted.
 * - Tablet+: fills below the global header (`--shell-header-h`).
 * - Default width: `pageContainer` (`max-w-7xl`).
 * - `narrow`: patient-facing reading width (`max-w-[64rem]`).
 * - `bleed`: children own horizontal padding (full-bleed headers, factsheet action bars).
 *
 * Opt out (different product chrome): DocumentViewer, therapy-compass workspace,
 * differentials presentation workflow.
 */

export type InformationPageWidth = "default" | "narrow" | "bleed";

const shellPadding =
  "max-sm:min-h-0 bg-[color:var(--background)] px-3 py-4 pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-5 sm:py-6 sm:pb-10 lg:px-7";

const bleedPadding =
  "max-sm:min-h-0 bg-[color:var(--background)] text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))]";

export function InformationPageShell({
  children,
  className,
  testId,
  width = "default",
  gap = true,
  as = "main",
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
  width?: InformationPageWidth;
  /** When true (default), the inner container is a vertical grid with mode-home rhythm. */
  gap?: boolean;
  as?: "main" | "div";
}) {
  const Tag = as;
  const padded = width === "bleed" ? bleedPadding : shellPadding;

  if (width === "bleed") {
    return (
      <Tag data-testid={testId} className={cn(padded, className)}>
        {children}
      </Tag>
    );
  }

  const container = width === "narrow" ? "mx-auto w-full max-w-[64rem]" : pageContainer;

  return (
    <Tag data-testid={testId} className={cn(padded, className)}>
      <div className={cn(container, gap && "grid gap-5 sm:gap-6")}>{children}</div>
    </Tag>
  );
}

export type InformationPageCrumb = {
  label: string;
  href?: string;
};

/**
 * Back-link + optional trail. Prefer this over mode-local `router.push` icon buttons
 * so history-less deep links still land on the mode home.
 */
export function InformationPageBreadcrumbs({
  home,
  crumbs = [],
  current,
  className,
}: {
  home: { label: string; href: string };
  crumbs?: InformationPageCrumb[];
  current?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-h-tap items-center gap-1 text-xs font-semibold text-[color:var(--text-muted)]",
        className,
      )}
    >
      <Link
        href={home.href}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-md px-1.5 hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {home.label}
      </Link>
      {crumbs.map((crumb) => (
        <span key={`${crumb.label}-${crumb.href ?? "text"}`} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="truncate rounded-md px-1 hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="truncate">{crumb.label}</span>
          )}
        </span>
      ))}
      {current ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
          <span aria-current="page" className="truncate text-[color:var(--text)]">
            {current}
          </span>
        </>
      ) : null}
    </nav>
  );
}

/** Title stack used above record body content (eyebrow → h1 → subtitle → badges/actions). */
export function InformationPageHeader({
  eyebrow,
  title,
  subtitle,
  badges,
  actions,
  icon,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 max-w-4xl">
        {eyebrow ? <p className={eyebrowText}>{eyebrow}</p> : null}
        <div className={cn("flex min-w-0 items-start gap-3", eyebrow && "mt-1.5")}>
          {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-1.5 max-w-3xl text-pretty text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                {subtitle}
              </div>
            ) : null}
            {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Optional clinical decision-support / safety footer line. */
export function InformationPageFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer className={cn("text-center text-2xs font-medium leading-5 text-[color:var(--text-muted)]", className)}>
      {children}
    </footer>
  );
}
