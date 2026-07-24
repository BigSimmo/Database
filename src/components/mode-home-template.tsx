import Link from "next/link";
import { type ReactNode } from "react";
import { type LucideIcon, ArrowRight } from "lucide-react";

import { cn, eyebrowText } from "@/components/ui-primitives";

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
  shortLabel?: string;
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
  danger: "bg-[color:var(--danger)]",
  info: "bg-[color:var(--info)]",
  neutral: "bg-[color:var(--text-soft)]",
  primary: "bg-[color:var(--clinical-accent)]",
  purple: "bg-[color:var(--tone-purple)]",
  indigo: "bg-[color:var(--tone-indigo)]",
  rose: "bg-[color:var(--tone-rose)]",
  slate: "bg-[color:var(--tone-slate)]",
  success: "bg-[color:var(--success)]",
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

  // Sizing is a single mobile-first system: the icon and gaps step up sm→lg,
  // and the display heading scales continuously via the fluid `text-hero` token
  // (globals.css) so it never jumps at a breakpoint. The compact-only mobile
  // tightening that short mode homes relied on is now the base treatment, so the
  // hero still fits a phone viewport without scrolling.
  return (
    <section
      className="grid justify-items-center gap-1.5 px-4 sm:gap-3 sm:px-0"
      aria-labelledby={`${testId ?? "mode-home"}-title`}
    >
      <span className="mode-home-icon grid h-tap w-tap place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-12 sm:w-12 lg:h-14 lg:w-14 lg:rounded-[1.15rem]">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" aria-hidden="true" />
      </span>
      <div className="grid gap-1 sm:gap-1.5">
        <Heading
          id={`${testId ?? "mode-home"}-title`}
          className="text-balance text-hero font-extrabold leading-[1.05] tracking-normal text-[color:var(--text-heading)]"
        >
          {title}
        </Heading>
        <p className="mx-auto max-w-2xl text-pretty text-sm font-medium leading-5 text-[color:var(--text-muted)] sm:text-base-minus sm:leading-5 lg:text-base lg:leading-6">
          {subtitle}
        </p>
      </div>
    </section>
  );
}

/**
 * Vertical alignment for standalone mode-home shells.
 *
 * Introduced as always-`justify-center` flex in 39d14a51 (edge-to-edge mobile
 * shell). That works for short empty homes, but centering a child taller than
 * the phone scrollport clips the top — unreachable at scrollTop 0.
 *
 * Prefer this prop over className `justify-*` overrides: `cn()` concatenates
 * and does not resolve Tailwind conflicts, so dual justify utilities are
 * non-deterministic. Alignment classes are applied last and any stray
 * `justify-*` tokens in `className` are stripped.
 */
export type ModeHomeMainAlign = "center" | "start" | "startOnPhone";

const MODE_HOME_MAIN_ALIGN_CLASS: Record<ModeHomeMainAlign, string> = {
  // Short empty homes — centre in the visible canvas.
  center: "justify-center pt-[clamp(1.25rem,4vh,2.25rem)] sm:pt-[clamp(1.75rem,5vh,3.25rem)]",
  // Tall results / content — keep the top reachable on every breakpoint.
  start: "justify-start pt-3 sm:pt-4",
  // Content-rich homes that still fit after sm — top-align on phone only.
  startOnPhone: "justify-start pt-3 sm:justify-center sm:pt-[clamp(1.75rem,5vh,3.25rem)]",
};

/** Strip bare and prefixed justify utilities (`sm:justify-center`, `max-sm:justify-start`, …). */
function withoutJustifyUtilities(className?: string) {
  if (!className) return undefined;
  const cleaned = className
    .replace(/(?:^|\s)(?:[\w-]+:)*justify-(?:normal|start|end|center|between|around|evenly|stretch)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

/**
 * Standalone-route wrapper that mirrors the dashboard mode homes. The shell
 * reserves composer clearance via --mobile-composer-reserve on #main-content.
 */
export function ModeHomeMain({
  testId,
  children,
  className,
  contentAlign = "center",
}: {
  testId?: string;
  children: ReactNode;
  className?: string;
  contentAlign?: ModeHomeMainAlign;
}) {
  return (
    <main
      data-testid={testId}
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col items-center bg-[color:var(--background)] px-0 pb-4 text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))] sm:px-6 sm:pb-[clamp(1.75rem,5vh,3.25rem)] lg:px-8",
        withoutJustifyUtilities(className),
        MODE_HOME_MAIN_ALIGN_CLASS[contentAlign],
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
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  /** Renders the action as a button (e.g. Retry) instead of a navigation link. */
  onAction?: () => void;
}) {
  const actionClass =
    "inline-flex min-h-tap items-center justify-center rounded-lg bg-[color:var(--command)] px-3 text-sm font-semibold text-[color:var(--command-contrast)] hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:min-h-9";
  return (
    <div className="mx-auto grid max-w-xl gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-left shadow-[var(--shadow-inset)] sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="grid gap-1">
        <span className="text-sm font-bold text-[color:var(--text-heading)]">{title}</span>
        <span className="text-sm leading-5 text-[color:var(--text-muted)]">{body}</span>
      </span>
      {onAction && actionLabel ? (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionLabel}
        </button>
      ) : actionHref && actionLabel ? (
        <Link href={actionHref} className={actionClass}>
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
        "mode-home-template mx-auto box-border flex w-full max-w-none flex-col items-center justify-center gap-3.5 px-0 text-center sm:max-w-[60rem] sm:gap-4 lg:gap-5",
        className,
      )}
    >
      <ModeHomeHero testId={testId} title={title} subtitle={subtitle} icon={icon} headingLevel={headingLevel} />

      {desktopComposerSlotId ? (
        <div
          id={desktopComposerSlotId}
          className="mode-home-composer-slot hidden w-full px-4 sm:px-0 [&:not(:empty)]:block"
        />
      ) : null}

      {actions?.length ? (
        <section
          aria-label={actionsLabel}
          className="grid w-full max-w-none overflow-hidden rounded-none border-y border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] lg:max-w-none lg:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] lg:gap-3 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none"
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            const content = (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-tap sm:w-tap sm:rounded-xl">
                  <ActionIcon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-balance text-base-minus font-bold leading-5 text-[color:var(--text-heading)] [overflow-wrap:anywhere]">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm-minus sm:leading-[1.3]">
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
              "mode-home-action group grid min-h-[4.4rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 bg-[color:var(--surface)] px-4 py-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60 sm:min-h-[4.4rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] sm:px-4 sm:py-3 lg:min-h-[4.75rem] lg:grid-cols-[2.75rem_minmax(0,1fr)_1rem] lg:gap-3 lg:rounded-lg lg:border lg:border-[color:var(--border)] lg:px-5 lg:py-3.5 lg:shadow-[var(--shadow-card)]",
              index > 0 && "border-t border-[color:var(--border)] lg:border-t-0",
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
        <section
          aria-label={pillsTitle ?? "Quick links"}
          className="grid w-full max-w-none self-stretch gap-2.5 border-t border-[color:var(--border)]/70 px-4 pt-5 sm:px-0 sm:pt-5"
        >
          {pillsTitle || pillsAction ? (
            <div className="flex min-h-8 w-full items-center justify-between gap-3">
              {pillsTitle ? <p className={cn(eyebrowText, "text-center sm:text-left")}>{pillsTitle}</p> : <span />}
              {pillsAction}
            </div>
          ) : null}
          <div className="answer-suggestion-row-scroll -mx-4 flex w-[calc(100%+2rem)] justify-start gap-2 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:w-full sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0 sm:gap-2.5">
            {pills.map((pill) => {
              const PillIcon = pill.icon;
              const displayLabel = pill.shortLabel ?? pill.label;
              const content = (
                <>
                  {PillIcon ? (
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <PillIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", pillToneClass[pill.tone ?? "neutral"])} />
                  )}
                  <span className="text-balance text-center">{displayLabel}</span>
                </>
              );
              const pillClassName =
                "inline-flex min-h-tap shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)]/35 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-sm lg:min-h-9";
              const pillA11y = pill.shortLabel ? { "aria-label": pill.label, title: pill.label } : {};
              return pill.href ? (
                <Link key={pill.label} href={pill.href} className={pillClassName} {...pillA11y}>
                  {content}
                </Link>
              ) : pill.onClick ? (
                <button key={pill.label} type="button" onClick={pill.onClick} className={pillClassName} {...pillA11y}>
                  {content}
                </button>
              ) : (
                <span key={pill.label} className={pillClassName} {...pillA11y}>
                  {content}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      {footer ? <div className="w-full px-4 sm:px-0">{footer}</div> : null}
    </div>
  );
}
