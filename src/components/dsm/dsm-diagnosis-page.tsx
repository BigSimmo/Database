import Link from "next/link";
import type { ComponentType } from "react";
import {
  BookOpenCheck,
  ChevronRight,
  Search,
  ClipboardList,
  GitCompareArrows,
  Gauge,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Signpost,
  SlidersHorizontal,
} from "lucide-react";

import { DsmDiagnosisNavHeader } from "@/components/dsm/dsm-diagnosis-nav-header";
import { DsmPageHeader } from "@/components/dsm/dsm-page-header";
import { InformationPageShell } from "@/components/information-page-shell";
import { inPageActionRowClass, inPageAnchor } from "@/components/in-page-nav/in-page-nav-classes";
import { cn, codeText, metadataPill, pageContainer } from "@/components/ui-primitives";
import { dsmCriteria, resolveDsmDifferential, type DsmDiagnosis, type DsmLabeledText } from "@/lib/dsm";

/**
 * Explicit singular and plural rather than appending "s", because the one that
 * matters here is irregular: "1 criterion" / "4 criteria".
 *
 * The zero branch is unreachable in the shipped catalogue — criteria, specifiers
 * and differentials are each populated on all 146 records — but the JSON is a
 * vendored upstream snapshot, so a re-export could introduce one and "0 criteria"
 * would read as a rendering fault rather than as a fact about the record.
 */
function countLabel(count: number, singular: string, plural: string) {
  if (count === 0) return "None in this record";
  return `${count} ${count === 1 ? singular : plural}`;
}

/** One label/value pair in the at-a-glance row. Non-interactive by design. */
function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]">
      <dt className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1.5 text-xs font-semibold leading-5 text-[color:var(--text-heading)] sm:text-sm-minus">
        {value}
      </dd>
    </div>
  );
}

function CriteriaRow({ criterion, index }: { criterion: DsmLabeledText; index: number }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] px-3 py-3.5 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        {criterion.label || index + 1}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Core criterion {criterion.label || index + 1}
        </p>
        <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-heading)]">{criterion.text}</p>
      </div>
    </li>
  );
}

export function DsmDiagnosisPage({ diagnosis }: { diagnosis: DsmDiagnosis }) {
  const criteria = dsmCriteria(diagnosis);
  const compareHref = `/dsm/compare?ids=${encodeURIComponent(diagnosis.slug)}`;

  // "4 criteria, A-D" / "1 criterion, A". Twelve records carry a single criterion,
  // so the range is appended only when there are at least two to span — otherwise
  // it would read "A-A". Labels fall back to the ordinal the list rows already use.
  const criteriaCountLabel = countLabel(criteria.length, "criterion", "criteria");
  const firstCriterionLabel = criteria[0]?.label || "1";
  const lastCriterionLabel = criteria.at(-1)?.label || String(criteria.length);
  const criteriaSummary =
    criteria.length > 1
      ? `${criteriaCountLabel}, ${firstCriterionLabel}\u2013${lastCriterionLabel}`
      : criteria.length === 1
        ? `${criteriaCountLabel}, ${firstCriterionLabel}`
        : criteriaCountLabel;

  return (
    <>
      <DsmDiagnosisNavHeader
        title={diagnosis.title}
        actions={
          <div className="grid gap-2">
            <Link href="/dsm/search" className={inPageActionRowClass}>
              <Search className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Search diagnoses
            </Link>
            <Link href={compareHref} className={inPageActionRowClass}>
              <GitCompareArrows className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Compare
            </Link>
            <Link href={`/dsm/diagnoses/${diagnosis.slug}/differentials`} className={inPageActionRowClass}>
              <Signpost className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
              Review all considerations
            </Link>
          </div>
        }
      />
      <InformationPageShell testId="dsm-diagnosis-page" width="bleed" className="pb-8">
        <DsmPageHeader
          eyebrow="Diagnosis information"
          title={diagnosis.title}
          description="Core diagnostic criteria, specifiers, differential considerations, and documentation support in one open, scan-friendly view."
          code={diagnosis.icd_code}
          category={diagnosis.category.label}
          breadcrumb={false}
        />

        <div className={cn(pageContainer, "space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8")}>
          {/*
            The shape of the record, not its content. This row previously rendered
            `criteria.slice(0, 4)` verbatim, which the `#criteria` panel below already
            lists in full — so every diagnosis stated its criteria twice, the second
            time truncated. It also rendered `min(criteria.length, 4)` cards, and only
            86 of 146 records carry four or more criteria, so the row was a ragged one
            to four tiles rather than a stable strip.

            Every field read here is populated on all 146 records, so this is always
            exactly four tiles. `icd_code` and the category are deliberately absent:
            the page header already carries both as chips, and repeating them would be
            the same defect in a new place.
          */}
          <section aria-label="At a glance" className="grid gap-2.5">
            <dl className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              <SummaryTile icon={ListChecks} label="Criteria" value={criteriaSummary} />
              <SummaryTile
                icon={SlidersHorizontal}
                label="Specifiers"
                value={countLabel(diagnosis.specifiers.length, "specifier", "specifiers")}
              />
              <SummaryTile
                icon={GitCompareArrows}
                label="Differentials"
                value={countLabel(diagnosis.differentials.length, "consideration", "considerations")}
              />
              <SummaryTile
                icon={Gauge}
                label="Severity specifier"
                value={diagnosis.severity_specifier_supported ? "Supported" : "Not listed"}
              />
            </dl>
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
            <div className="grid min-w-0 gap-4">
              <section
                id="criteria"
                aria-labelledby="criteria-title"
                className={cn(
                  inPageAnchor,
                  "overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]",
                )}
              >
                <div className="flex items-start gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3 sm:px-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                    <ListChecks className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 id="criteria-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
                      Core diagnostic criteria
                    </h2>
                    <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                      All criteria are shown. No expand controls or hidden sections.
                    </p>
                  </div>
                </div>
                {criteria.length ? (
                  <ol>
                    {criteria.map((criterion, index) => (
                      <CriteriaRow key={`${criterion.label}-${criterion.text}`} criterion={criterion} index={index} />
                    ))}
                  </ol>
                ) : (
                  <p className="px-4 py-5 text-sm font-medium text-[color:var(--text-muted)]">
                    No structured criteria were included in the supplied record.
                  </p>
                )}
              </section>

              {diagnosis.key_features.length > 0 && diagnosis.criteria_display.length > 0 ? (
                <section
                  id="key-features"
                  aria-labelledby="key-features-title"
                  className={cn(
                    inPageAnchor,
                    "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Signpost className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
                    <h2 id="key-features-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
                      Key features
                    </h2>
                  </div>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {diagnosis.key_features.map((feature) => (
                      <li
                        key={`${feature.label}-${feature.text}`}
                        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-sm font-medium leading-6 text-[color:var(--text-heading)]"
                      >
                        <strong className="mr-1.5 text-[color:var(--clinical-accent)]">{feature.label}.</strong>
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section
                id="specifiers"
                aria-labelledby="specifiers-title"
                className={cn(
                  inPageAnchor,
                  "overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
                )}
              >
                <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
                  <SlidersHorizontal className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
                  <h2 id="specifiers-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
                    Specifiers
                  </h2>
                  <span className="ml-auto text-xs font-bold text-[color:var(--text-muted)]">
                    {diagnosis.specifiers.length}
                  </span>
                </div>
                {diagnosis.specifiers.length ? (
                  <dl className="divide-y divide-[color:var(--border)]">
                    {diagnosis.specifiers.map((specifier) => (
                      <div
                        key={`${specifier.name}-${specifier.description}`}
                        className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4"
                      >
                        <dt className="text-sm font-extrabold text-[color:var(--text-heading)]">{specifier.name}</dt>
                        <dd className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                          {specifier.description || "No additional description supplied."}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="px-4 py-5 text-sm font-medium text-[color:var(--text-muted)]">
                    No specifiers were included in the supplied record.
                  </p>
                )}
              </section>

              <section
                id="documentation"
                aria-labelledby="documentation-title"
                className={cn(
                  inPageAnchor,
                  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
                  <h2 id="documentation-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
                    Documentation support
                  </h2>
                </div>
                <p className="mt-2 rounded-lg border-l-[3px] border-l-[color:var(--clinical-accent)] bg-[color:var(--surface-subtle)] px-3 py-3 text-sm font-medium leading-6 text-[color:var(--text-heading)] sm:px-4">
                  {diagnosis.documentation_template}
                </p>
                <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  Adapt this supplied template to the assessment. It is not a substitute for diagnostic reasoning or
                  local documentation requirements.
                </p>
              </section>
            </div>

            <aside className="grid gap-3 lg:sticky lg:top-20" aria-label="Diagnosis reference summary">
              <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2.5">
                  <GitCompareArrows className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                  <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">
                    Differential considerations
                  </h2>
                </div>
                <ul className="divide-y divide-[color:var(--border)]">
                  {diagnosis.differentials.slice(0, 6).map((differential) => {
                    const match = resolveDsmDifferential(differential);
                    return (
                      <li key={differential} className="px-3 py-2.5">
                        {match ? (
                          <Link
                            href={`/dsm/diagnoses/${match.slug}`}
                            className="group flex items-start justify-between gap-2 text-xs font-semibold leading-5 text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)]"
                          >
                            <span>{differential}</span>
                            <ChevronRight
                              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--decoration-soft)] group-hover:text-[color:var(--clinical-accent)]"
                              aria-hidden
                            />
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold leading-5 text-[color:var(--text-heading)]">
                            {differential}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-[color:var(--border)] p-2.5">
                  <Link
                    href={`/dsm/diagnoses/${diagnosis.slug}/differentials`}
                    className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)]"
                  >
                    Review all considerations
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </section>

              <section
                id="record-summary"
                className={cn(
                  inPageAnchor,
                  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                  <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Record summary</h2>
                </div>
                <dl className="mt-3 grid gap-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[color:var(--text-muted)]">ICD-10</dt>
                    <dd className={cn("font-extrabold text-[color:var(--text-heading)]", codeText)}>
                      {diagnosis.icd_code}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[color:var(--text-muted)]">Criteria</dt>
                    <dd className="font-extrabold text-[color:var(--text-heading)]">{criteria.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[color:var(--text-muted)]">Specifiers</dt>
                    <dd className="font-extrabold text-[color:var(--text-heading)]">{diagnosis.specifiers.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-[color:var(--text-muted)]">Severity specifier</dt>
                    <dd className="font-extrabold text-[color:var(--text-heading)]">
                      {diagnosis.severity_specifier_supported ? "Supported" : "Not listed"}
                    </dd>
                  </div>
                </dl>
              </section>

              <p className="flex items-start gap-2 rounded-xl border border-[color:var(--info-border)] bg-[color:var(--info-soft)]/45 p-3 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden />
                Clinical reference aid only. Confirm the full assessment, exclusions, cultural context, and current
                diagnostic standard.
              </p>

              <Link
                href="/dsm/search"
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
              >
                <BookOpenCheck className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                Browse diagnoses
              </Link>
            </aside>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-4">
            <span className={metadataPill}>DSM-5 Diagnosis</span>
            <span className={cn(metadataPill, codeText)}>{diagnosis.record_id}</span>
            <span className={metadataPill}>Supplied local catalogue</span>
          </div>
        </div>
      </InformationPageShell>
    </>
  );
}
