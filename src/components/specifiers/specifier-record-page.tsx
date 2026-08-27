import Link from "next/link";
import {
  ArrowRight,
  Check,
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
  SpecifierFamilyBadge,
  SpecifierPageShell,
  SpecifierSafetyNote,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { compareRecordsHref, GuidanceSection, RecordFact } from "@/components/clinical-record-panels";
import { inPageActionRowClass, inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { SpecifierNavHeader } from "@/components/specifiers/specifier-nav-header";
import { cn, eyebrowText, primaryControl } from "@/components/ui-primitives";
import { relatedSpecifiers, type SpecifierRecord } from "@/lib/specifiers";

export function SpecifierRecordPage({ record }: { record: SpecifierRecord }) {
  const related = relatedSpecifiers(record);
  const primaryRelated = related[0];

  return (
    <>
      <SpecifierNavHeader
        title={record.shortName}
        actions={
          <div className="grid gap-2">
            <Link
              href={compareRecordsHref("/specifiers/compare", record.slug, primaryRelated?.slug)}
              className={inPageActionRowClass}
            >
              <GitCompareArrows className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Compare
            </Link>
            <Link href={`/specifiers/builder?specifier=${record.slug}`} className={inPageActionRowClass}>
              <ListChecks className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Build wording
            </Link>
          </div>
        }
      />
      <SpecifierPageShell>
        <section
          id="specifier-overview"
          className={cn(inPageAnchor, "grid gap-5 border-b border-[color:var(--border)] pb-5")}
        >
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
              <p className="max-w-3xl text-base font-medium leading-7 text-[color:var(--text-muted)]">
                {record.summary}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <SpecifierFamilyBadge record={record} />
                <DiagnosisChips values={record.appliesTo} />
              </div>
            </div>
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

            <section id="specifier-fit" className={cn(specifierCard, inPageAnchor, "overflow-hidden")}>
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

            <section id="specifier-wording" className={cn(specifierCard, inPageAnchor, "p-4")}>
              <p className={eyebrowText}>Example wording</p>
              <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--text-heading)]">{record.wording}</p>
              <Link href={`/specifiers/builder?specifier=${record.slug}`} className={cn(primaryControl, "mt-3 w-full")}>
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
                      href={compareRecordsHref("/specifiers/compare", record.slug, item.slug)}
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

        <SpecifierSafetyNote id="specifier-evidence" className={inPageAnchor} />
      </SpecifierPageShell>
    </>
  );
}
