"use client";

import Link from "next/link";
import { ArrowRight, Check, FileCheck2, ListChecks, RotateCcw, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import {
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierWordingPathway,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import {
  normalizeSpecifierSelection,
  specifierAppliesToBuilderDiagnosis,
  specifierFamilies,
  specifierRecords,
  type SpecifierBuilderDiagnosis,
  type SpecifierFamily,
  type SpecifierRecord,
} from "@/lib/specifiers";

const diagnosisPresets: Array<{ id: SpecifierBuilderDiagnosis; label: string }> = [
  { id: "mdd-recurrent", label: "Major depressive disorder, recurrent" },
  { id: "mdd-single", label: "Major depressive disorder, single episode" },
  { id: "bipolar-i-depressed", label: "Bipolar I disorder, current episode depressed" },
  { id: "bipolar-i-manic", label: "Bipolar I disorder, current episode manic" },
  { id: "bipolar-ii-depressed", label: "Bipolar II disorder, current episode depressed" },
];

const specifierFamilyOrder: Record<SpecifierFamily, number> = {
  "episode-features": 0,
  "course-onset": 1,
  "severity-remission": 2,
};

function wordingSegment(record: SpecifierRecord) {
  if (record.slug === "mild-severity") return "mild";
  if (record.slug === "with-psychotic-features") return "severe with psychotic features";
  return record.name.charAt(0).toLowerCase() + record.name.slice(1);
}

export function SpecifierBuilderPage({ initialSpecifiers = [] }: { initialSpecifiers?: string[] }) {
  const validInitial = normalizeSpecifierSelection(initialSpecifiers);
  const initialDiagnosis =
    diagnosisPresets.find((preset) =>
      validInitial.every((slug) => {
        const record = specifierRecords.find((candidate) => candidate.slug === slug);
        return record ? specifierAppliesToBuilderDiagnosis(record, preset.id) : false;
      }),
    ) ?? diagnosisPresets[0];
  const [diagnosisId, setDiagnosisId] = useState<SpecifierBuilderDiagnosis>(initialDiagnosis.id);
  const [selected, setSelected] = useState<string[]>(validInitial);
  const diagnosis = diagnosisPresets.find((preset) => preset.id === diagnosisId) ?? initialDiagnosis;
  const selectedRecords = useMemo(
    () =>
      selected
        .map((slug) => specifierRecords.find((record) => record.slug === slug))
        .filter((record): record is SpecifierRecord => Boolean(record))
        .sort((left, right) => specifierFamilyOrder[left.family] - specifierFamilyOrder[right.family]),
    [selected],
  );
  const wording = [diagnosis.label, ...selectedRecords.map((record) => wordingSegment(record))].join(", ");

  function changeDiagnosis(nextDiagnosis: SpecifierBuilderDiagnosis) {
    setDiagnosisId(nextDiagnosis);
    setSelected((current) =>
      current.filter((slug) => {
        const record = specifierRecords.find((candidate) => candidate.slug === slug);
        return record ? specifierAppliesToBuilderDiagnosis(record, nextDiagnosis) : false;
      }),
    );
  }

  function toggle(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      return normalizeSpecifierSelection([...current, slug]);
    });
  }

  return (
    <SpecifierPageShell>
      <header className="min-w-0 border-b border-[color:var(--border)] pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight break-words text-[color:var(--text-heading)] sm:text-4xl">
          Build diagnostic wording
        </h1>
      </header>

      <SpecifierWordingPathway />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid min-w-0 gap-4">
          <section className={cn(specifierCard, "grid min-w-0 gap-3 p-4 sm:p-5")}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="nums grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-extrabold text-[color:var(--clinical-accent-contrast)]">
                1
              </span>
              <div className="min-w-0">
                <p className={eyebrowText}>Base diagnosis</p>
                <h2 className="text-lg font-extrabold break-words text-[color:var(--text-heading)]">
                  Name the disorder and episode
                </h2>
              </div>
            </div>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-bold text-[color:var(--text-muted)]">Diagnostic phrase</span>
              <select
                value={diagnosisId}
                onChange={(event) => changeDiagnosis(event.target.value as SpecifierBuilderDiagnosis)}
                className="min-h-12 w-full max-w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
              >
                {diagnosisPresets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {specifierFamilies
            .filter((family) => family.id !== "all")
            .map((family, familyIndex) => {
              const records = specifierRecords.filter((record) => record.family === family.id);
              const singleChoice = family.id === "severity-remission";
              return (
                <section key={family.id} className={cn(specifierCard, "min-w-0 overflow-hidden")}>
                  <div className="flex min-w-0 items-center gap-3 border-b border-[color:var(--border)] px-4 py-3 sm:px-5">
                    <span className="nums grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                      {familyIndex + 2}
                    </span>
                    <div className="min-w-0">
                      <p className={eyebrowText}>{singleChoice ? "Choose up to one" : "Choose when supported"}</p>
                      <h2 className="text-lg font-extrabold break-words text-[color:var(--text-heading)]">
                        {family.label}
                      </h2>
                    </div>
                  </div>
                  <div className="grid min-w-0 sm:grid-cols-2">
                    {records.map((record, index) => {
                      const checked = selected.includes(record.slug);
                      const compatible = specifierAppliesToBuilderDiagnosis(record, diagnosisId);
                      return (
                        <label
                          key={record.slug}
                          className={cn(
                            "group grid min-w-0 cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] px-4 py-3.5 transition hover:bg-[color:var(--surface-subtle)] sm:px-5",
                            index % 2 === 1 && "sm:border-l",
                            checked && "bg-[color:var(--clinical-accent-soft)]/55",
                            !compatible && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!compatible}
                            onChange={() => toggle(record.slug)}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "mt-0.5 grid h-7 w-7 place-items-center rounded-md border text-transparent transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
                              checked
                                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                                : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                            )}
                          >
                            <Check className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-extrabold break-words text-[color:var(--text-heading)]">
                              {record.shortName}
                            </span>
                            <span className="mt-1 block text-xs font-medium leading-5 break-words text-[color:var(--text-muted)]">
                              {compatible ? record.clinicalSignal : "Not applicable to the selected diagnosis."}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>

        <aside className="grid min-w-0 content-start gap-4 xl:sticky xl:top-20">
          <section className="min-w-0 overflow-hidden rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="flex min-w-0 items-center gap-3 border-b border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
                <FileCheck2 className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Working diagnosis</p>
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Structured wording</h2>
              </div>
            </div>
            <div className="grid min-w-0 gap-4 p-4">
              <p className="min-w-0 text-base font-extrabold leading-7 break-words text-[color:var(--text-heading)]">
                {wording}
              </p>
              <div className="grid min-w-0 gap-2 border-t border-[color:var(--border)] pt-3">
                <p className={eyebrowText}>Applied specifiers</p>
                {selectedRecords.length ? (
                  <ul className="grid min-w-0 gap-2">
                    {selectedRecords.map((record) => (
                      <li
                        key={record.slug}
                        className="flex min-w-0 items-center justify-between gap-2 text-sm font-semibold text-[color:var(--text-muted)]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2 break-words">
                          <Tags className="h-3.5 w-3.5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
                          {record.shortName}
                        </span>
                        <Link
                          href={`/specifiers/${record.slug}`}
                          aria-label={`Review ${record.shortName}`}
                          className="grid h-tap w-tap shrink-0 place-items-center rounded-md text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]"
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    No specifiers selected yet.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected([])}
                disabled={!selected.length}
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-muted)] disabled:opacity-45"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Clear specifiers
              </button>
            </div>
          </section>

          <section className={cn(specifierCard, "p-4")}>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
              <p className={eyebrowText}>Before documenting</p>
            </div>
            <ul className="mt-3 grid gap-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              <li>Confirm each specifier is valid for the base diagnosis.</li>
              <li>Check episode chronology and competing explanations.</li>
              <li>Use one internally consistent severity or remission descriptor.</li>
            </ul>
          </section>
        </aside>
      </div>

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
