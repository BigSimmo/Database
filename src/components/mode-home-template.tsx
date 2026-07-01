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
  tone?: "teal" | "danger" | "info" | "success" | "neutral" | "purple";
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
  purple: "bg-violet-600",
  success: "bg-[color:var(--success)]",
  teal: "bg-[color:var(--clinical-chat-teal)]",
};

export function ModeHomeTemplate({
  testId,
  title,
  subtitle,
  icon: Icon,
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
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <div
      data-testid={testId}
      className={cn(
        "mode-home-template mx-auto box-border flex w-full max-w-[64rem] flex-col items-center justify-center gap-5 px-0 text-center sm:gap-6 lg:gap-7",
        className,
      )}
    >
      <section className="grid justify-items-center gap-3 sm:gap-4" aria-labelledby={`${testId ?? "mode-home"}-title`}>
        <span className="mode-home-icon grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--clinical-chat-teal)]/18 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16 lg:h-[4.75rem] lg:w-[4.75rem] lg:rounded-[1.35rem]">
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

      {desktopComposerSlotId ? (
        <div id={desktopComposerSlotId} className="hidden w-full max-w-[52rem] lg:block" />
      ) : null}

      <section
        aria-label={actionsLabel}
        className="grid w-full max-w-3xl overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] sm:max-w-none sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none"
      >
        {actions.map((action, index) => {
          const ActionIcon = action.icon;
          const content = (
            <>
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/15 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-14 sm:w-14 sm:rounded-xl">
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
                className="h-4 w-4 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-chat-teal)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
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

      {pills?.length ? (
        <section className="grid w-full max-w-none self-stretch gap-4 border-t border-[color:var(--border)] pt-5 sm:pt-6">
          {pillsTitle || pillsAction ? (
            <div className="flex min-h-10 w-full items-center justify-between gap-3 text-left">
              {pillsTitle ? (
                <h3 className="text-base font-bold text-[color:var(--text-heading)] sm:text-lg">{pillsTitle}</h3>
              ) : (
                <span />
              )}
              {pillsAction}
            </div>
          ) : null}
          <div className="-mx-1 flex w-full max-w-full gap-3 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-[repeat(5,minmax(0,1fr))] sm:overflow-visible sm:px-0">
            {pills.map((pill) => {
              const PillIcon = pill.icon;
              const content = (
                <>
                  {PillIcon ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                      <PillIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className={cn("h-2.5 w-2.5 rounded-full", pillToneClass[pill.tone ?? "neutral"])} />
                  )}
                  {pill.label}
                </>
              );
              const pillClassName =
                "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-w-0 sm:px-3";
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
