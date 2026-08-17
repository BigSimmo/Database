import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Breadcrumb, PageHeader, type Crumb } from "@/components/ui/page-header";
import { cn, pageContainer } from "@/components/ui-primitives";

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
 * Opt out (different product chrome): DocumentViewer and differentials
 * presentation workflow.
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
 * Contextual back-link + optional trail. History-less deep links still land on
 * the mode home through the crumb's fallback href.
 *
 * Now a projection onto the DS `Breadcrumb` rather than a second implementation
 * of one. The semantics it already shipped are the ones that survive: a crumb
 * with an `href` is a link, the trailing crumb without one carries
 * `aria-current="page"`, and the home crumb keeps its back-arrow — that arrow is
 * the whole reason this wrapper exists, so it moved into `Crumb.icon` rather than
 * being dropped in the name of convergence.
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
  const items: Crumb[] = [
    { label: home.label, href: home.href, icon: ArrowLeft, behavior: "history-back" },
    ...crumbs,
    ...(current ? [{ label: current }] : []),
  ];

  return <Breadcrumb items={items} className={cn("min-h-tap", className)} />;
}

/**
 * Title stack used above record body content (eyebrow → h1 → subtitle →
 * badges/actions). A projection onto `PageHeader`, which owns the `<h1>`: the
 * prop names stay because they are the vocabulary the record pages speak, and
 * `subtitle`/`badges` are `description`/`meta` under different names.
 */
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
  /**
   * A page title is a string. It was `ReactNode` while this component owned its
   * own `<h1>`; `PageHeader` takes a string so the title cannot smuggle block
   * content into a heading.
   */
  title: string;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  /**
   * Narrowed from `ReactNode` to the icon component `PageHeader` takes, so the
   * leading tile is rendered by the one component that owns that treatment
   * rather than by whatever node a caller happened to pass.
   */
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <PageHeader
      title={title}
      eyebrow={eyebrow}
      description={subtitle}
      icon={icon}
      actions={actions}
      meta={badges}
      className={className}
    />
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
