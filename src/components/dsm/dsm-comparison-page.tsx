import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";

import {
  type CompareCatalogItem,
  type CompareStarterChip,
  compareSlotBadgeBase,
  compareSlotBadgeClass,
} from "@/components/compare";
import { DsmCompareChrome } from "@/components/dsm/dsm-compare-chrome";
import { DsmPageHeader } from "@/components/dsm/dsm-page-header";
import { cn, codeText, eyebrowText, pageContainer } from "@/components/ui-primitives";
import { type DsmDiagnosis } from "@/lib/dsm";

const BADGE_LETTERS = ["A", "B", "C"] as const;

function diagnosisHeaderGridClass(count: number) {
  return count >= 3 ? "grid sm:grid-cols-3" : "grid sm:grid-cols-2";
}

function comparisonRowGridClass(count: number) {
  return count >= 3
    ? "grid border-b border-[color:var(--border)] last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
    : "grid border-b border-[color:var(--border)] last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]";
}

type ComparisonRow = {
  label: string;
  values: string[];
};

function comparisonRows(diagnoses: DsmDiagnosis[]): ComparisonRow[] {
  return [
    { label: "ICD-10 code", values: diagnoses.map((diagnosis) => diagnosis.icd_code) },
    { label: "Category", values: diagnoses.map((diagnosis) => diagnosis.category.label) },
    // These two rows read `criteria_display` directly rather than the old
    // key-feature fallback. 145 of the 146 records supply no criteria, so the
    // fallback made both rows restate the "Key features" row below under criteria
    // headings — the same content twice, the first time labelled as the
    // diagnostic standard. Nothing useful is lost: the key features are still the
    // row beneath, now as the only place they appear.
    {
      label: "Core threshold (DSM-5-TR criteria)",
      values: diagnoses.map(
        (diagnosis) => diagnosis.criteria_display[0]?.text ?? "Full criteria not included in this record",
      ),
    },
    {
      label: "Additional criteria",
      values: diagnoses.map(
        (diagnosis) =>
          diagnosis.criteria_display
            .slice(1, 4)
            .map((criterion) => `${criterion.label}. ${criterion.text}`)
            .join(" ") || "Full criteria not included in this record",
      ),
    },
    {
      label: "Key features",
      values: diagnoses.map(
        (diagnosis) =>
          diagnosis.key_features
            .slice(0, 3)
            .map((feature) => `${feature.label}. ${feature.text}`)
            .join(" ") || "Not supplied",
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
  const comparisonLabel = diagnoses.map((diagnosis) => diagnosis.title).join(" compared with ");
  const summaryById = new Map(catalog.map((item) => [item.id, item.snippet]));

  return (
    <div data-testid="dsm-comparison-page" className="min-h-full bg-[color:var(--background)] pb-8">
      <DsmPageHeader
        breadcrumb={false}
        eyebrow=""
        homeIcon={false}
        icon={false}
        title="Compare diagnoses"
        description="Side-by-side criteria and differential flags."
        className="[&>div]:py-3 [&>div]:sm:py-4"
      />

      <div className={cn(pageContainer, "space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8")}>
        <DsmCompareChrome selectedIds={chromeIds} items={catalog} starters={starters} />

        {diagnoses.length >= 2 ? (
          <>
            <section
              data-testid="dsm-comparison-ask-this"
              className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 text-center sm:px-6"
            >
              <div className="mx-auto flex max-w-4xl items-start justify-center gap-2.5">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                <div>
                  <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Ask this</p>
                  <p className="mt-1 text-base font-extrabold leading-6 text-[color:var(--text-heading)]">
                    Which diagnosis best fits duration, episodicity, and exclusions?
                  </p>
                </div>
              </div>
            </section>

            <section
              data-testid="dsm-comparison-unified"
              className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--e2)]"
              aria-label={comparisonLabel}
            >
              <div className={diagnosisHeaderGridClass(diagnoses.length)}>
                {diagnoses.map((diagnosis, index) => (
                  <div
                    key={diagnosis.slug}
                    className={cn(
                      "grid gap-3 px-4 py-4 sm:px-5",
                      index > 0 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(compareSlotBadgeBase, compareSlotBadgeClass(index), "h-7 w-7 text-xs")}>
                        {BADGE_LETTERS[index]}
                      </span>
                      <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{diagnosis.title}</h2>
                    </div>
                    <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                      {summaryById.get(diagnosis.slug) ??
                        diagnosis.key_features[0]?.text ??
                        "Review the complete diagnostic record."}
                    </p>
                    <Link
                      href={`/dsm/diagnoses/${diagnosis.slug}`}
                      className="inline-flex min-h-tap items-center gap-2 rounded-md px-1 text-sm font-bold text-[color:var(--clinical-accent)] hover:underline"
                    >
                      Open record
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                ))}
              </div>

              <div className="border-t border-[color:var(--border)]">
                {rows.map((row) => (
                  <div key={row.label} className={comparisonRowGridClass(diagnoses.length)}>
                    <div className="bg-[color:var(--surface-subtle)] px-4 py-3 text-xs font-extrabold text-[color:var(--text-heading)] sm:flex sm:items-center">
                      {row.label}
                    </div>
                    {row.values.map((value, index) => (
                      <div
                        key={`${row.label}-${diagnoses[index]?.slug}`}
                        className={cn(
                          "grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 px-4 py-3 text-sm font-medium leading-6 text-[color:var(--text-muted)]",
                          index > 0 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
                          row.label === "ICD-10 code" && codeText,
                        )}
                      >
                        <span className={cn(compareSlotBadgeBase, compareSlotBadgeClass(index), "h-7 w-7 text-2xs")}>
                          {BADGE_LETTERS[index]}
                        </span>
                        <span className="line-clamp-4" title={value}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div
                className={cn(
                  "grid border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
                  diagnosisHeaderGridClass(diagnoses.length),
                )}
              >
                {diagnoses.map((diagnosis, index) => (
                  <div
                    key={`${diagnosis.slug}-differentials`}
                    className={cn(
                      "p-4 sm:p-5",
                      index > 0 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
                    )}
                  >
                    <Link
                      href={`/dsm/diagnoses/${diagnosis.slug}/differentials`}
                      className="inline-flex min-h-tap items-center gap-2 rounded-md px-1 text-sm font-bold text-[color:var(--clinical-accent)] hover:underline"
                    >
                      Differential review
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <footer className="border-t border-[color:var(--border)] pt-4 text-center text-2xs font-medium leading-5 text-[color:var(--text-muted)]">
          Structured review aid — not a diagnostic score. Open each record for complete criteria.
        </footer>
      </div>
    </div>
  );
}
