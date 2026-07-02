import Link from "next/link";
import { ArrowRight, ShieldCheck, type LucideIcon } from "lucide-react";

import { cn } from "@/components/ui-primitives";

export type CompactHomeAction = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

export type CompactHomePillTone = "danger" | "info" | "primary" | "success" | "neutral" | "purple";

export type CompactHomePill = {
  label: string;
  href: string;
  icon?: LucideIcon;
  tone?: CompactHomePillTone;
};

type CompactRecordHomePageProps = {
  testId: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tasksLabel: string;
  taskCards: CompactHomeAction[];
  quickLinksTitle: string;
  quickLinks: CompactHomePill[];
  verificationLabel: string;
  verificationBody: string;
  verifiedCount: number;
  totalCount: number;
  desktopComposerSlotId?: string;
};

const pillToneClass: Record<CompactHomePillTone | "teal", string> = {
  danger: "bg-[color:var(--danger)]",
  info: "bg-[color:var(--info)]",
  neutral: "bg-[color:var(--text-soft)]",
  primary: "bg-[color:var(--clinical-accent)]",
  purple: "bg-violet-600",
  success: "bg-[color:var(--success)]",
  teal: "bg-[color:var(--clinical-accent)]",
};

export function CompactRecordHomePage({
  testId,
  title,
  subtitle,
  icon: Icon,
  tasksLabel,
  taskCards,
  quickLinksTitle,
  quickLinks,
  verificationLabel,
  verificationBody,
  verifiedCount,
  totalCount,
  desktopComposerSlotId,
}: CompactRecordHomePageProps) {
  return (
    <main
      data-testid={testId}
      className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-[color:var(--background)] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[clamp(1.25rem,4vh,2.25rem)] text-[color:var(--text)] sm:px-6 sm:pt-[clamp(1.75rem,5vh,3.25rem)] lg:px-8 lg:pb-[clamp(1.75rem,5vh,3.25rem)]"
    >
      <div
        data-testid={`${testId}-template`}
        className="mx-auto flex w-full max-w-[58rem] flex-col items-center justify-center gap-5 text-center sm:gap-6 lg:gap-7"
      >
        <section className="grid justify-items-center gap-3 sm:gap-4" aria-labelledby={`${testId}-title`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16 lg:h-[4.75rem] lg:w-[4.75rem] lg:rounded-[1.35rem]">
            <Icon className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10" aria-hidden />
          </span>
          <div className="grid gap-2">
            <h1
              id={`${testId}-title`}
              className="text-balance text-[1.85rem] font-extrabold leading-[1.05] tracking-normal text-[color:var(--text-heading)] sm:text-[2.45rem] lg:text-[2.9rem]"
            >
              {title}
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base lg:text-[1.0625rem]">
              {subtitle}
            </p>
          </div>
        </section>

        {desktopComposerSlotId ? (
          <div id={desktopComposerSlotId} className="hidden min-h-14 w-full max-w-3xl lg:block" />
        ) : null}

        <section
          aria-label={tasksLabel}
          className="w-full max-w-3xl overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] lg:mt-14"
        >
          {taskCards.map((card, index) => {
            const CardIcon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className={cn(
                  "group grid min-h-[4.8rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 bg-[color:var(--surface)] px-4 py-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:min-h-[5.75rem] sm:grid-cols-[3rem_minmax(0,1fr)_1.5rem] sm:gap-4 sm:px-5 lg:px-6",
                  index > 0 && "border-t border-[color:var(--border)]",
                )}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-11 sm:w-11">
                  <CardIcon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.98rem] font-bold leading-5 text-[color:var(--text-heading)] sm:text-[1.05rem]">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-[0.9rem]">
                    {card.description}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-accent)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden
                />
              </Link>
            );
          })}
        </section>

        <section className="grid w-full max-w-3xl justify-items-center gap-3 pt-1 sm:gap-4">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)] sm:text-base">{quickLinksTitle}</h2>
          <div className="flex w-full max-w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible">
            {quickLinks.map((link) => {
              const LinkIcon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex min-h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-9"
                >
                  {LinkIcon ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                      <LinkIcon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : (
                    <span className={cn("h-2.5 w-2.5 rounded-full", pillToneClass[link.tone ?? "neutral"])} />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </div>
        </section>

        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-[color:var(--clinical-accent)]">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {verificationLabel}
          </span>
          <span aria-hidden="true">•</span>
          <span>{verificationBody}</span>
          <span className="sr-only">
            {verifiedCount} of {totalCount} records are locally verified.
          </span>
        </p>
      </div>
    </main>
  );
}
