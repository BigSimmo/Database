import Link from "next/link";
import { ChevronRight, GitCompareArrows, ListChecks, ShieldCheck, X } from "lucide-react";

import { idsCompareHref, type CompareCatalogItem, type CompareStarterChip } from "@/components/compare";
import { DsmCompareChrome } from "@/components/dsm/dsm-compare-chrome";
import { DsmCompareRemoveLink } from "@/components/dsm/dsm-compare-remove-link";
import { DsmPageHeader } from "@/components/dsm/dsm-page-header";
import { cn, codeText, metadataPill, pageContainer } from "@/components/ui-primitives";
import { dsmCriteria, type DsmDiagnosis } from "@/lib/dsm";

function compareHref(diagnoses: DsmDiagnosis[]) {
  return idsCompareHref(
    "/dsm/compare",
    diagnoses.map((diagnosis) => diagnosis.slug),
  );
}

function removeDiagnosisHref(diagnoses: DsmDiagnosis[], slug: string) {
  const remaining = diagnoses.filter((diagnosis) => diagnosis.slug !== slug);
  return remaining.length ? compareHref(remaining) : "/dsm/compare";
}

type ComparisonRow = {
  label: string;
  values: string[];
};

function comparisonRows(diagnoses: DsmDiagnosis[]): ComparisonRow[] {
  return [
    { label: "ICD-10 code", values: diagnoses.map((diagnosis) => diagnosis.icd_code) },
    { label: "Category", values: diagnoses.map((diagnosis) => diagnosis.category.label) },
    {
      label: "Core threshold",
      values: diagnoses.map((diagnosis) => dsmCriteria(diagnosis)[0]?.text ?? "Not supplied"),
    },
    {
      label: "Additional criteria",
      values: diagnoses.map(
        (diagnosis) =>
          dsmCriteria(diagnosis)
            .slice(1, 4)
            .map((criterion) => `${criterion.label}. ${criterion.text}`)
            .join(" ") || "No additional structured criteria supplied",
      ),
    },
    {
      label: "Key features",
      values: diagnoses.map(
        (diagnosis) =>
          diagnosis.key_features
            .slice(0, 3)
            .map((feature) => `${feature.label}. ${feature.text}`)
            .join(" ") || "Review the core criteria",
      ),
    },
    {
      label: "Common specifiers",
      values: diagnoses.map(
        (diagnosis) =>
          diagnosis.specifiers
            .slice(0, 4)
            .map((specifier) => specifier.name)
            .join("; ") || "No specifiers supplied",
      ),
    },
    {
      label: "Differential flags",
      values: diagnoses.map((diagnosis) => diagnosis.differentials.slice(0, 3).join("; ") || "None supplied"),
    },
    {
      label: "Severity specifier",
      values: diagnoses.map((diagnosis) => (diagnosis.severity_specifier_supported ? "Supported" : "Not listed")),
    },
  ];
}

export function DsmComparisonPage({
  diagnoses,
  selectedIds,
  catalog,
  starters,
}: {
  diagnoses: DsmDiagnosis[];
  selectedIds?: readonly (string | null)[];
  catalog: readonly CompareCatalogItem[];
  starters: readonly CompareStarterChip[];
}) {
  const rows = comparisonRows(diagnoses);
  const chromeIds = selectedIds ?? diagnoses.map((diagnosis) => diagnosis.slug);

  return (
    <div data-testid="dsm-comparison-page" className="min-h-full bg-[color:var(--background)] pb-8">
      <DsmPageHeader
        eyebrow="Diagnosis comparison"
        title="Compare DSM diagnoses"
        description="Review core criteria, course-defining features, specifiers, and differential flags side by side. This is a structured review aid, not a diagnostic score."
      />

      <div className={cn(pageContainer, "space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8")}>
        <DsmCompareChrome selectedIds={chromeIds} items={catalog} starters={starters} />

        {diagnoses.length > 0 ? (
          <section className="grid gap-2.5 md:grid-cols-3" aria-label="Selected diagnoses">
            {diagnoses.map((diagnosis, index) => (
              <article
                key={diagnosis.slug}
                className="relative rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3.5 shadow-[var(--shadow-inset)]"
              >
                <div className="flex items-start gap-3 pr-8">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-sm font-extrabold text-[color:var(--clinical-accent)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
                      {diagnosis.category.label}
                    </p>
                    <h2 className="mt-1 text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
                      {diagnosis.title}
                    </h2>
                    <span className={cn("mt-2 inline-flex", metadataPill, codeText)}>{diagnosis.icd_code}</span>
                  </div>
                </div>
                <DsmCompareRemoveLink
                  href={removeDiagnosisHref(diagnoses, diagnosis.slug)}
                  aria-label={`Remove ${diagnosis.title} from comparison`}
                  className="absolute right-2 top-2 grid h-tap w-tap place-items-center rounded-lg text-[color:var(--decoration-soft)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--danger)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </DsmCompareRemoveLink>
              </article>
            ))}
          </section>
        ) : null}

        {diagnoses.length >= 2 ? (
          <>
            <section className="hidden overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)] md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[54rem] border-collapse text-left">
                  <caption className="sr-only">DSM diagnosis comparison</caption>
                  <thead>
                    <tr className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
                      <th
                        scope="col"
                        className="w-44 px-4 py-3 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]"
                      >
                        Compare
                      </th>
                      {diagnoses.map((diagnosis) => (
                        <th
                          key={diagnosis.slug}
                          scope="col"
                          className="px-4 py-3 text-sm font-extrabold text-[color:var(--text-heading)]"
                        >
                          {diagnosis.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {rows.map((row) => (
                      <tr key={row.label} className="align-top hover:bg-[color:var(--surface-subtle)]/55">
                        <th
                          scope="row"
                          className="bg-[color:var(--surface-subtle)]/65 px-4 py-3 text-xs font-extrabold text-[color:var(--text-heading)]"
                        >
                          {row.label}
                        </th>
                        {row.values.map((value, index) => (
                          <td
                            key={`${row.label}-${diagnoses[index]?.slug}`}
                            className={cn(
                              "px-4 py-3 text-xs font-medium leading-5 text-[color:var(--text-muted)]",
                              row.label === "ICD-10 code" && codeText,
                            )}
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-3 md:hidden" aria-label="DSM diagnosis comparison cards">
              {rows.map((row) => (
                <article
                  key={row.label}
                  className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
                >
                  <h2 className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-xs font-extrabold uppercase tracking-label text-[color:var(--text-heading)]">
                    {row.label}
                  </h2>
                  <dl className="divide-y divide-[color:var(--border)]">
                    {row.values.map((value, index) => (
                      <div key={`${row.label}-${diagnoses[index]?.slug}`} className="grid gap-1 px-3 py-3">
                        <dt className="text-xs font-extrabold text-[color:var(--clinical-accent)]">
                          {diagnoses[index]?.title}
                        </dt>
                        <dd
                          className={cn(
                            "text-xs font-medium leading-5 text-[color:var(--text-muted)]",
                            row.label === "ICD-10 code" && codeText,
                          )}
                        >
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </section>

            <section className="grid gap-3 rounded-xl border border-[color:var(--info-border)] bg-[color:var(--info-soft)]/40 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--surface)] text-[color:var(--info)] shadow-[var(--shadow-inset)]">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">
                  Use the comparison to identify what still needs clarification
                </h2>
                <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  Review duration, episodicity, exclusions, substance or medication effects, medical causes, and
                  functional impact in the complete records.
                </p>
              </div>
              <Link
                href={`/dsm/diagnoses/${diagnoses[0].slug}/differentials`}
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)]"
              >
                Differential review
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </section>
          </>
        ) : null}

        <footer className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border)] pt-4 text-xs font-medium text-[color:var(--text-muted)]">
          <GitCompareArrows className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
          <span>Comparison is not ranked.</span>
          <span aria-hidden>•</span>
          <span>Open each diagnosis for complete criteria and documentation support.</span>
          <ListChecks className="ml-auto hidden h-4 w-4 text-[color:var(--decoration-soft)] sm:block" aria-hidden />
        </footer>
      </div>
    </div>
  );
}
