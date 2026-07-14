import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  GitCompareArrows,
  ListChecks,
  MessageSquareQuote,
  Route,
  ShieldAlert,
  Tags,
  Target,
} from "lucide-react";

import {
  DiagnosisChips,
  SectionHeading,
  SpecifierBreadcrumbs,
  SpecifierFamilyBadge,
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierSubnav,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { relatedSpecifiers, type SpecifierRecord } from "@/lib/specifiers";

function comparisonHref(left: string, right?: string) {
  const params = new URLSearchParams({ a: left });
  if (right) params.set("b", right);
  return `/specifiers/compare?${params.toString()}`;
}

function RecordFact({ icon: Icon, label, body }: { icon: typeof Tags; label: string; body: string }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 px-4 py-3.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span>
        <span className="block text-xs font-bold text-[color:var(--text-heading)]">{label}</span>
        <span className="mt-0.5 block text-xs font-medium leading-5 text-[color:var(--text-muted)]">{body}</span>
      </span>
    </div>
  );
}

function GuidanceSection({
  icon: Icon,
  title,
  items,
  tone = "default",
  open = false,
}: {
  icon: typeof Tags;
  title: string;
  items: string[];
  tone?: "default" | "success" | "warning";
  open?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-[color:var(--success)] bg-[color:var(--success-soft)]"
      : tone === "warning"
        ? "text-[color:var(--warning)] bg-[color:var(--warning-soft)]"
        : "text-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]";

  return (
    <details open={open} className="group border-b border-[color:var(--border)] last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)] sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneClass)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-extrabold text-[color:var(--text-heading)]">{title}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="px-4 pb-4 pl-[4.25rem] sm:px-5 sm:pb-5 sm:pl-[4.75rem]">
        <ul className="grid gap-2.5 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          {items.map((item) => (
            <li key={item} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--clinical-accent)]" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function SpecifierRecordPage({ record }: { record: SpecifierRecord }) {
  const related = relatedSpecifiers(record);
  const primaryRelated = related[0];

  return (
    <SpecifierPageShell>
      <div className="grid gap-3">
        <SpecifierBreadcrumbs current={record.shortName} />
        <SpecifierSubnav active="search" />
      </div>

      <section className="grid gap-5 border-b border-[color:var(--border)] pb-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid gap-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-start">
          <span className="grid h-14 w-14 place-items-center rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:h-16 sm:w-16">
            <Tags className="h-7 w-7" aria-hidden />
          </span>
          <div className="grid gap-2">
            <div>
              <p className={eyebrowText}>Psychiatric specifier</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
                {record.name}
              </h1>
            </div>
            <p className="max-w-3xl text-base font-medium leading-7 text-[color:var(--text-muted)]">{record.summary}</p>
            <div className="flex flex-wrap items-center gap-2">
              <SpecifierFamilyBadge record={record} />
              <DiagnosisChips values={record.appliesTo} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link
            href={comparisonHref(record.slug, primaryRelated?.slug)}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <GitCompareArrows className="h-4 w-4" aria-hidden />
            Compare
          </Link>
          <Link
            href={`/specifiers/builder?specifier=${record.slug}`}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <ListChecks className="h-4 w-4" aria-hidden />
            Build wording
          </Link>
        </div>
      </section>

      <section aria-labelledby="what-matters-now" className={cn(specifierCard, "overflow-hidden")}>
        <div className="border-b border-[color:var(--border)] px-4 py-2.5 sm:px-5">
          <p id="what-matters-now" className={eyebrowText}>
            What matters now
          </p>
        </div>
        <div className="grid divide-y divide-[color:var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <RecordFact icon={Tags} label="Applies to" body={record.appliesTo.slice(0, 2).join(" · ")} />
          <RecordFact icon={Target} label="Deciding signal" body={record.clinicalSignal} />
          <RecordFact icon={CircleHelp} label="Ask this" body={record.decisionQuestion} />
          <RecordFact icon={FileCheck2} label="Wording outcome" body={record.wording} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid min-w-0 gap-5">
          <SectionHeading
            eyebrow="Fit and exclusions"
            title="Make the specifier earn its place"
            body="Start with the deciding signal, then test chronology, competing explanations, and the effect on diagnostic wording."
          />

          <section className={cn(specifierCard, "overflow-hidden")}>
            <GuidanceSection icon={Check} title="When this fits" items={record.fit} tone="success" open />
            <GuidanceSection icon={ShieldAlert} title="When this may not fit" items={record.notFit} tone="warning" />
            <GuidanceSection icon={ListChecks} title="Focused checks" items={record.checks} />
            <GuidanceSection
              icon={MessageSquareQuote}
              title="Patient language"
              items={record.patientLanguage.map((item) => `“${item}”`)}
            />
          </section>

          <section className={cn(specifierCard, "grid gap-4 p-4 sm:p-5")}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Route className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className={eyebrowText}>Clinical implication</p>
                <h2 className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
                  How this changes the plan
                </h2>
              </div>
            </div>
            <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{record.treatmentLens}</p>
          </section>
        </div>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20">
          <section className={cn(specifierCard, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border)] px-4 py-3">
              <p className={eyebrowText}>Quick reference</p>
            </div>
            <dl className="divide-y divide-[color:var(--border)]">
              {[
                ["Focus", record.comparison.focus],
                ["Time course", record.comparison.timeCourse],
                ["Look for", record.comparison.lookFor],
                ["Avoid", record.comparison.caution],
              ].map(([label, body]) => (
                <div key={label} className="px-4 py-3">
                  <dt className="text-xs font-extrabold text-[color:var(--text-heading)]">{label}</dt>
                  <dd className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={cn(specifierCard, "p-4")}>
            <p className={eyebrowText}>Example wording</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--text-heading)]">{record.wording}</p>
            <Link
              href={`/specifiers/builder?specifier=${record.slug}`}
              className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]"
            >
              Use in builder
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>

          {related.length ? (
            <section className={cn(specifierCard, "overflow-hidden")}>
              <div className="border-b border-[color:var(--border)] px-4 py-3">
                <p className={eyebrowText}>Compare next</p>
              </div>
              <div className="divide-y divide-[color:var(--border)]">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={comparisonHref(record.slug, item.slug)}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-sm font-bold text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]"
                  >
                    {item.shortName}
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
