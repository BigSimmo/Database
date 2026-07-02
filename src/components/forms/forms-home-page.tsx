import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Route,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
} from "lucide-react";

import { appModeHomeHref } from "@/lib/app-modes";
import { defaultFormSlug, formRecords } from "@/lib/forms";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

const taskCards = [
  {
    title: "Find a form",
    description: "Search by number, pathway, clock, or keyword.",
    icon: Search,
    href: appModeHomeHref("forms", { focus: true }),
  },
  {
    title: "Readiness checks",
    description: "Review maker, clock, copies, and source.",
    icon: ClipboardCheck,
    href: `/forms/${defaultFormSlug() ?? ""}`,
  },
  {
    title: "Browse pathways",
    description: "Before, current, parallel, and after forms.",
    icon: Route,
    href: appModeHomeHref("forms", {
      query: "forms pathway before current parallel after",
      focus: true,
      run: true,
    }),
  },
];

const commonTasks = [
  {
    label: "Transport",
    icon: Truck,
    href: appModeHomeHref("forms", { query: "transport forms", focus: true, run: true }),
  },
  {
    label: "Assessment",
    icon: UserRound,
    href: appModeHomeHref("forms", { query: "assessment forms", focus: true, run: true }),
  },
  {
    label: "Transfer",
    icon: ArrowLeftRight,
    href: appModeHomeHref("forms", { query: "transfer forms", focus: true, run: true }),
  },
  {
    label: "Treatment",
    icon: ShieldCheck,
    href: appModeHomeHref("forms", { query: "treatment forms", focus: true, run: true }),
  },
];

function verifiedCount() {
  return formRecords.filter((form) => form.verification?.locallyVerified).length;
}

export function FormsHomePage() {
  const locallyVerifiedCount = verifiedCount();

  return (
    <main
      data-testid="forms-home"
      className="min-h-[calc(100dvh-4rem)] bg-[color:var(--background)] px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-9 text-[color:var(--text)] sm:px-6 sm:pb-10 sm:pt-10 lg:grid lg:place-items-center lg:px-8 lg:py-10"
    >
      <div
        data-testid="forms-home-template"
        className="mx-auto grid w-full max-w-[78rem] justify-items-center gap-5 text-center sm:gap-6 lg:gap-7"
      >
        <section className="grid justify-items-center gap-3 sm:gap-4" aria-labelledby="forms-home-title">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-[5.25rem] sm:w-[5.25rem] lg:h-[6.25rem] lg:w-[6.25rem] lg:rounded-[1.35rem]">
            <FileText className="h-7 w-7 sm:h-10 sm:w-10 lg:h-12 lg:w-12" aria-hidden />
          </span>
          <div className="grid gap-2">
            <h1
              id="forms-home-title"
              className="text-balance text-[1.85rem] font-extrabold leading-[1.05] tracking-normal text-[color:var(--text-heading)] sm:text-[2.5rem] lg:text-[3.15rem]"
            >
              What do you need from forms?
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-lg lg:text-xl">
              Search, check, or follow a pathway.
            </p>
          </div>
        </section>

        <div id={modeHomeDesktopComposerSlotId} className="hidden h-20 w-full max-w-[54rem] lg:block" />

        <section
          aria-label="Forms tasks"
          className="grid w-full max-w-3xl overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-card)] md:max-w-none md:grid-cols-3 md:gap-5 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:shadow-none"
        >
          {taskCards.map((card, index) => {
            const CardIcon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className={[
                  "group grid min-h-[4.8rem] w-full grid-cols-[2.5rem_minmax(0,1fr)_1.25rem] items-center gap-3 bg-[color:var(--surface)] px-4 py-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:min-h-[5.75rem] sm:grid-cols-[3rem_minmax(0,1fr)_1.5rem] sm:gap-4 sm:px-5 md:min-h-[9.75rem] md:grid-cols-[4.5rem_minmax(0,1fr)_1.5rem] md:rounded-lg md:border md:border-[color:var(--border)] md:p-4 md:shadow-[var(--shadow-tight)] md:hover:-translate-y-0.5 md:hover:border-[color:var(--clinical-accent-border)] md:hover:shadow-[var(--shadow-elevated)] motion-reduce:md:hover:translate-y-0 lg:grid-cols-[5rem_minmax(0,1fr)_1.5rem] lg:px-5",
                  index > 0 ? "border-t border-[color:var(--border)] md:border-t-0" : "",
                ].join(" ")}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-11 sm:w-11 md:h-[4.5rem] md:w-[4.5rem] lg:h-20 lg:w-20">
                  <CardIcon className="h-5 w-5 md:h-9 md:w-9 lg:h-10 lg:w-10" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.98rem] font-bold leading-5 text-[color:var(--text-heading)] sm:text-[1.05rem] md:text-[1.08rem] md:leading-6 lg:text-xl">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-[0.9rem] md:mt-2 md:text-base md:leading-6">
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

        <section className="grid w-full max-w-[66rem] justify-items-center gap-4 pt-1">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)] sm:text-base">Common tasks</h2>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {commonTasks.map((task) => {
              const TaskIcon = task.icon;
              return (
                <Link
                  key={task.label}
                  href={task.href}
                  className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] shadow-[var(--shadow-tight)] transition hover:-translate-y-0.5 hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--surface-subtle)] hover:shadow-[var(--shadow-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:hover:translate-y-0 sm:min-h-14 sm:text-sm"
                >
                  <TaskIcon className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                  <span className="truncate">{task.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
          <span className="inline-flex items-center gap-2 font-semibold text-[color:var(--clinical-accent)]">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            Source verified
          </span>
          <span aria-hidden="true">•</span>
          <span>MHA 2014 forms</span>
          <span className="sr-only">
            {locallyVerifiedCount} of {formRecords.length} records are locally verified.
          </span>
        </p>
      </div>
    </main>
  );
}
