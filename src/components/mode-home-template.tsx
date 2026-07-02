import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowRight, ShieldCheck, type LucideIcon } from "lucide-react";

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
  tone?: "teal" | "primary" | "danger" | "info" | "success" | "neutral" | "purple";
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
  danger: "bg-[color:var(--danger)]",
  info: "bg-[color:var(--info)]",
  neutral: "bg-[color:var(--text-soft)]",
  primary: "bg-[color:var(--clinical-accent)]",
  purple: "bg-violet-600",
  success: "bg-[color:var(--success)]",
  teal: "bg-[color:var(--clinical-accent)]",
};

export function ModeHomeHero({
  testId,
  title,
  subtitle,
  icon: Icon,
  headingLevel = 1,
}: {
  testId?: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section className="grid justify-items-center gap-3 sm:gap-4" aria-labelledby={`${testId ?? "mode-home"}-title`}>
      <span className="mode-home-icon grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16 lg:h-[4.75rem] lg:w-[4.75rem] lg:rounded-[1.35rem]">
        <Icon className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10" aria-hidden="true" />
      </span>
      <div className="grid gap-2">
        <Heading
          id={`${testId ?? "mode-home"}-title`}
          className="text-balance text-[1.85rem] font-extrabold leading-[1.05] tracking-normal text-[color:var(--text-heading)] sm:text-[2.45rem] lg:text-[2.9rem]"
        >
          {title}
        </Heading>
        <p className="mx-auto max-w-2xl text-pretty text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base lg:text-[1.0625rem]">
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
        "grid min-h-[calc(100dvh-4rem)] place-items-center bg-[color:var(--background)] px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-[clamp(1.25rem,4vh,2.25rem)] text-[color:var(--text)] sm:px-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pt-[clamp(1.75rem,5vh,3.25rem)] lg:px-8 lg:pb-[clamp(1.75rem,5vh,3.25rem)]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function ModeHomeVerificationFooter({
  label,
  body,
  verifiedCount,
  totalCount,
}: {
  label: string;
  body: string;
  verifiedCount: number;
  totalCount: number;
}) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm">
      <span className="inline-flex items-center gap-2 font-semibold text-[color:var(--clinical-accent)]">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <span aria-hidden="true">•</span>
      <span>{body}</span>
      <span className="sr-only">
        {verifiedCount} of {totalCount} records are locally verified.
      </span>
    </p>
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
        "mode-home-template mx-auto box-border flex w-full max-w-[64rem] flex-col items-center justify-center gap-5 px-0 text-center sm:gap-6 lg:gap-7",
        className,
      )}
    >
      <ModeHomeHero testId={testId} title={title} subtitle={subtitle} icon={icon} headingLevel={headingLevel} />

      {desktopComposerSlotId ? (
        <div id={desktopComposerSlotId} className="hidden w-full max-w-[52rem] lg:block" />
      ) : null}

      {actions.length ? (
        <section
          aria-label={actionsLabel}
          className="grid w-full max-w-3xl overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] sm:max-w-none sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none"
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            const content = (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-14 sm:w-14 sm:rounded-xl">
                  <ActionIcon className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.98rem] font-bold leading-5 text-[color:var(--text-heading)] sm:text-[1.05rem]">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-[0.9rem] sm:leading-6">
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
              "mode-home-action group grid min-h-[4.8rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 bg-[color:var(--surface)] px-4 py-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60 sm:min-h-[8rem] sm:grid-cols-[3.5rem_minmax(0,1fr)_1.5rem] sm:gap-4 sm:rounded-lg sm:border sm:border-[color:var(--border)] sm:px-5 sm:py-5 sm:shadow-[var(--shadow-card)] lg:min-h-[8.4rem] lg:px-6",
              index > 0 && "border-t border-[color:var(--border)] sm:border-t-[color:var(--border)]",
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
        <section className="grid w-full max-w-none self-stretch gap-4 border-t border-[color:var(--border)] pt-5 sm:pt-6">
          {pillsTitle || pillsAction ? (
            <div
              className={cn(
                "flex min-h-10 w-full items-center gap-3",
                pillsAction ? "justify-between text-left" : "justify-center text-center",
              )}
            >
              {pillsTitle ? (
                <h3 className="text-base font-bold text-[color:var(--text-heading)] sm:text-lg">{pillsTitle}</h3>
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
