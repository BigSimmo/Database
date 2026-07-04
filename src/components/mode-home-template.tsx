import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

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

const pillToneClass: Record<NonNullable<ModeHomePill["tone"]>, string> = {
  // Semantic roles — genuine status pills only.
  danger: "bg-[color:var(--danger)]",
  info: "bg-[color:var(--info)]",
  success: "bg-[color:var(--success)]",
  neutral: "bg-[color:var(--text-soft)]",
  // Brand accent — featured emphasis, not a taxonomy colour.
  primary: "bg-[color:var(--clinical-accent)]",
  // Categorical scale — taxonomy/pathway dots, role-pure.
  purple: "bg-[color:var(--tone-purple)]",
  indigo: "bg-[color:var(--tone-indigo)]",
  rose: "bg-[color:var(--tone-rose)]",
  slate: "bg-[color:var(--tone-slate)]",
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
 * Answer home: full-height, centred content, bottom padding reserved for the
 * fixed mobile composer.
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
        // Phone: content is vertically centred (not bottom-anchored) so the page
        // no longer collapses all its slack into a void above the hero. The
        // standalone shell (#main-content) already reserves 9rem of bottom
        // padding for the fixed mobile composer, so this main only subtracts
        // that space from its min-height instead of re-adding the padding —
        // otherwise short homes scroll by exactly the duplicated reservation.
        // From sm up the composer moves into the hero, so the reserve drops away.
        "grid min-h-[calc(100dvh-13.75rem-env(safe-area-inset-bottom))] items-center justify-items-center bg-[color:var(--background)] px-4 pb-4 pt-[clamp(1.25rem,4vh,2.25rem)] text-[color:var(--text)] sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:pb-[clamp(1.75rem,5vh,3.25rem)] sm:pt-[clamp(1.75rem,5vh,3.25rem)] lg:px-8",
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
  actions,
  actionsLabel,
  desktopComposerSlotId,
  pillsTitle,
  pills,
  pillsAction,
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
        <div id={desktopComposerSlotId} className="mode-home-composer-slot hidden w-full sm:[&:not(:empty)]:block" />
      ) : null}

      {actions.length ? (
        <section
          aria-label={actionsLabel}
          className="grid w-full max-w-3xl overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] lg:max-w-none lg:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] lg:gap-5 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none"
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            const content = (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] lg:h-14 lg:w-14 lg:rounded-xl">
                  <ActionIcon className="h-5 w-5 lg:h-7 lg:w-7" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-balance text-[0.98rem] font-bold leading-5 text-[color:var(--text-heading)] [overflow-wrap:anywhere] lg:text-[1.05rem]">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:mt-1 lg:text-[0.9rem] lg:leading-6">
                    {action.description}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-accent)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden="true"
                />
              </>
            );
            const actionClassName = cn(
              "mode-home-action group grid min-h-[4rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 bg-[color:var(--surface)] px-4 py-2.5 text-left transition sm:min-h-[4.8rem] sm:py-3 hover:bg-[color:var(--surface-subtle)] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60 lg:min-h-[8.4rem] lg:grid-cols-[3.5rem_minmax(0,1fr)_1.5rem] lg:gap-4 lg:rounded-lg lg:border lg:border-[color:var(--border)] lg:px-6 lg:py-5 lg:shadow-[var(--shadow-card)]",
              index > 0 && "border-t border-[color:var(--border)] lg:border-t-[color:var(--border)]",
            );

            if (action.href) {
              return (
                <Link key={action.title} href={action.href} data-testid={action.testId} className={actionClassName}>
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={action.title}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                data-testid={action.testId}
                className={actionClassName}
              >
                {content}
              </button>
            );
          })}
        </section>
      ) : null}

      {pills?.length ? (
        <section className="grid w-full max-w-none self-stretch gap-3 border-t border-[color:var(--border)] pt-3 sm:gap-4 sm:pt-6">
          {pillsTitle || pillsAction ? (
            <div
              className={cn(
                "flex min-h-10 w-full items-center gap-3",
                pillsAction ? "justify-between text-left" : "justify-center text-center",
              )}
            >
              {pillsTitle ? (
                <h2 className="text-base font-bold text-[color:var(--text-heading)] sm:text-lg">{pillsTitle}</h2>
              ) : (
                <span />
              )}
              {pillsAction}
            </div>
          ) : null}
          <div className="-mx-1 flex w-full max-w-full gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
            {pills.map((pill) => {
              const PillIcon = pill.icon;
              const content = (
                <>
                  {PillIcon ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <PillIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className={cn("h-2.5 w-2.5 rounded-full", pillToneClass[pill.tone ?? "neutral"])} />
                  )}
                  {pill.label}
                </>
              );
              const pillClassName =
                "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
              return pill.href ? (
                <Link key={pill.label} href={pill.href} className={pillClassName}>
                  {content}
                </Link>
              ) : (
                <button key={pill.label} type="button" onClick={pill.onClick} className={pillClassName}>
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {footer ? <div className="w-full">{footer}</div> : null}
    </div>
  );
}
