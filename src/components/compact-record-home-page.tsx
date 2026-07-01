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

const pillToneClass: Record<CompactHomePillTone, string> = {
  danger: "bg-[color:var(--danger)]",
  info: "bg-[color:var(--info)]",
  primary: "bg-[color:var(--clinical-chat-teal)]",
  success: "bg-[color:var(--success)]",
  neutral: "bg-[color:var(--text-soft)]",
  purple: "bg-violet-600",
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
      className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8 lg:pb-12 lg:pt-11"
    >
      <div className="mx-auto grid w-full max-w-[58rem] justify-items-center gap-6 sm:gap-7">
        <section className="grid max-w-3xl justify-items-center gap-4 text-center sm:gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-[color:var(--clinical-chat-teal)]/22 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-[4.75rem] sm:w-[4.75rem]">
            <Icon className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden />
          </div>
          <div className="grid gap-2">
            <h1 className="text-balance text-[2rem] font-extrabold leading-[1.08] tracking-normal text-[color:var(--text-heading)] sm:text-[2.6rem] lg:text-[3rem]">
              {title}
            </h1>
            <p className="text-pretty text-base font-medium leading-7 text-[color:var(--text-muted)] sm:text-lg">
              {subtitle}
            </p>
          </div>
        </section>

        {desktopComposerSlotId ? <div id={desktopComposerSlotId} className="hidden w-full max-w-3xl lg:block" /> : null}

        <section
          aria-label={tasksLabel}
          className="w-full max-w-3xl overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]"
        >
          {taskCards.map((card) => {
            const CardIcon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group grid min-h-[5.5rem] grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] px-3.5 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5"
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)] sm:h-12 sm:w-12">
                  <CardIcon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-extrabold leading-5 text-[color:var(--text-heading)] sm:text-lg">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    {card.description}
                  </span>
                </span>
                <ArrowRight
                  className="h-5 w-5 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-chat-teal)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden
                />
              </Link>
            );
          })}
        </section>

        <section className="grid w-full max-w-3xl justify-items-center gap-3">
          <h2 className="text-center text-base font-extrabold text-[color:var(--text-heading)]">{quickLinksTitle}</h2>
          <div className="flex w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible">
            {quickLinks.map((task) => {
              const PillIcon = task.icon;
              return (
                <Link
                  key={task.label}
                  href={task.href}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-chat-teal)]/35 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  {PillIcon ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]">
                      <PillIcon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : (
                    <span
                      className={cn("h-2.5 w-2.5 rounded-full", pillToneClass[task.tone ?? "neutral"])}
                      aria-hidden
                    />
                  )}
                  {task.label}
                </Link>
              );
            })}
          </div>
        </section>

        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
          <span className="inline-flex items-center gap-2 font-extrabold text-[color:var(--clinical-chat-teal)]">
            <ShieldCheck className="h-5 w-5" aria-hidden />
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
