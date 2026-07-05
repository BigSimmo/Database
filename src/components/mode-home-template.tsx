import Link from "next/link";
import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/components/ui-primitives";

export type ModeHomeAction = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  testId?: string;
};

export type ModeHomePill = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  tone?: "danger" | "info" | "success" | "neutral" | "primary" | "purple" | "indigo" | "rose" | "slate";
};

type ModeHomeTemplateProps = {
  testId?: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actions: ModeHomeAction[];
  actionsLabel: string;
  desktopComposerSlotId?: string;
  pillsTitle?: string;
  pills?: ModeHomePill[];
  pillsAction?: ReactNode;
  footer?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2;
};

export function ModeHomeHero({
  testId,
  title,
  subtitle,
  icon: Icon,
  headingLevel = 1,
  compact = false,
}: {
  testId?: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  headingLevel?: 1 | 2;
  /**
   * Mobile-only tightening used by ModeHomeTemplate so short mode homes fit a
   * phone viewport without scrolling. All sm+/lg values are identical to the
   * default treatment, so tablet and desktop render exactly the same.
   */
  compact?: boolean;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section
      className={cn("grid justify-items-center sm:gap-4", compact ? "gap-2" : "gap-3")}
      aria-labelledby={`${testId ?? "mode-home"}-title`}
    >
      <span
        className={cn(
          "mode-home-icon grid place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16 lg:h-[4.75rem] lg:w-[4.75rem] lg:rounded-[1.35rem]",
          compact ? "h-12 w-12" : "h-14 w-14",
        )}
      >
        <Icon className={cn("sm:h-8 sm:w-8 lg:h-10 lg:w-10", compact ? "h-6 w-6" : "h-7 w-7")} aria-hidden="true" />
      </span>
      <div className={cn("grid", compact ? "gap-1.5 sm:gap-2" : "gap-2")}>
        <Heading
          id={`${testId ?? "mode-home"}-title`}
          className={cn(
            "text-balance font-extrabold leading-[1.05] tracking-normal text-[color:var(--text-heading)] sm:text-[2.45rem] lg:text-[2.9rem]",
            compact ? "text-[1.6rem]" : "text-[1.85rem]",
          )}
        >
          {title}
        </Heading>
        <p
          className={cn(
            "mx-auto max-w-2xl text-pretty text-sm font-medium text-[color:var(--text-muted)] sm:text-base sm:leading-6 lg:text-[1.0625rem]",
            compact ? "leading-5" : "leading-6",
          )}
        >
          {subtitle}
        </p>
      </div>
    </section>
  );
}

/**
 * Standalone-route wrapper that mirrors the dashboard's vertically centred
 * mode homes: full-height, centred content, no fixed bottom composer reserve.
 */
export function ModeHomeMain({
  testId,
  children,
  className,
}: {
  testId?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      data-testid={testId}
      className={cn(
        "grid min-h-[calc(100dvh-4rem)] items-center justify-items-center bg-[color:var(--background)] px-4 pb-4 pt-[clamp(1.25rem,4vh,2.25rem)] text-[color:var(--text)] sm:px-6 sm:pb-[clamp(1.75rem,5vh,3.25rem)] sm:pt-[clamp(1.75rem,5vh,3.25rem)] lg:px-8",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function ModeHomeVerificationFooter({
  icon: Icon,
  label,
  body,
  verifiedCount,
  totalCount,
}: {
  icon: LucideIcon;
  label: string;
  body: string;
  verifiedCount?: number;
  totalCount?: number;
}) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:pt-1 sm:text-sm">
      <span className="inline-flex items-center gap-2 font-semibold text-[color:var(--clinical-accent)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <span aria-hidden="true">•</span>
      <span>{body}</span>
      {typeof verifiedCount === "number" && typeof totalCount === "number" ? (
        <span className="sr-only">
          {verifiedCount} of {totalCount} records are locally verified.
        </span>
      ) : null}
    </p>
  );
}

export function ModeHomeStatusNotice({
  icon: Icon,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mx-auto grid max-w-xl gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-left shadow-[var(--shadow-inset)] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="grid gap-1">
        <span className="text-sm font-bold text-[color:var(--text-heading)]">{title}</span>
        <span className="text-sm leading-5 text-[color:var(--text-muted)]">{body}</span>
      </span>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[color:var(--command)] px-3 text-sm font-semibold text-[color:var(--command-contrast)] hover:bg-[color:var(--command-hover)]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ModeHomeTemplate({
  testId,
  title,
  subtitle,
  icon,
  desktopComposerSlotId,
  footer,
  className,
  headingLevel = 1,
}: ModeHomeTemplateProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "mode-home-template mx-auto box-border flex w-full max-w-[64rem] flex-col items-center justify-center gap-3.5 px-0 text-center sm:gap-6 lg:gap-7",
        className,
      )}
    >
      <ModeHomeHero testId={testId} title={title} subtitle={subtitle} icon={icon} headingLevel={headingLevel} compact />

      {desktopComposerSlotId ? (
        <div id={desktopComposerSlotId} className="mode-home-composer-slot hidden w-full [&:not(:empty)]:block" />
      ) : null}

      {footer ? <div className="w-full">{footer}</div> : null}
    </div>
  );
}
