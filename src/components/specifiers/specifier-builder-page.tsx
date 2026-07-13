"use client";

import Link from "next/link";
import { ArrowRight, Check, FileCheck2, ListChecks, RotateCcw, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import {
  SpecifierBreadcrumbs,
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierSubnav,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { normalizeSpecifierSelection, specifierFamilies, specifierRecords } from "@/lib/specifiers";

const diagnosisPresets = [
  "Major depressive disorder, recurrent",
  "Major depressive disorder, single episode",
  "Bipolar I disorder, current episode depressed",
  "Bipolar I disorder, current episode manic",
  "Bipolar II disorder, current episode depressed",
];

function wordingSegment(name: string) {
  if (name === "Mild severity") return "mild";
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function SpecifierBuilderPage({ initialSpecifiers = [] }: { initialSpecifiers?: string[] }) {
  const validInitial = normalizeSpecifierSelection(initialSpecifiers);
  const [diagnosis, setDiagnosis] = useState(diagnosisPresets[0]);
  const [selected, setSelected] = useState<string[]>(validInitial);
  const selectedRecords = useMemo(
    () => selected.map((slug) => specifierRecords.find((record) => record.slug === slug)).filter(Boolean),
    [selected],
  );
  const wording = [diagnosis, ...selectedRecords.map((record) => wordingSegment(record!.name))].join(", ");

  function toggle(slug: string) {
    setSelected((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      return normalizeSpecifierSelection([...current, slug]);
    });
  }

  return (
    <SpecifierPageShell>
      <div className="grid gap-3">
        <SpecifierBreadcrumbs current="Build wording" />
        <SpecifierSubnav active="builder" />
      </div>

      <header className="grid gap-2 border-b border-[color:var(--border)] pb-5">
        <p className={eyebrowText}>Structured diagnostic language</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
          Build the diagnosis in the right order
        </h1>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Start with the base diagnosis, then add episode features, course or onset, and one current severity or
          remission descriptor.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid gap-4">
          <section className={cn(specifierCard, "grid gap-3 p-4 sm:p-5")}>
            <div className="flex items-center gap-3">
              <span className="nums grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-extrabold text-[color:var(--clinical-accent-contrast)]">
                1
              </span>
              <div>
                <p className={eyebrowText}>Base diagnosis</p>
                <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">
                  Name the disorder and episode
                </h2>
              </div>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-[color:var(--text-muted)]">Diagnostic phrase</span>
              <select
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                className="min-h-12 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
              >
                {diagnosisPresets.map((item) => (
                  <option key={item} value={item}>
                    {item}
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
                <section key={family.id} className={cn(specifierCard, "overflow-hidden")}>
                  <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-4 py-3 sm:px-5">
                    <span className="nums grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                      {familyIndex + 2}
                    </span>
                    <div>
                      <p className={eyebrowText}>{singleChoice ? "Choose up to one" : "Choose when supported"}</p>
                      <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">{family.label}</h2>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2">
                    {records.map((record, index) => {
                      const checked = selected.includes(record.slug);
                      return (
                        <label
                          key={record.slug}
                          className={cn(
                            "group grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] px-4 py-3.5 transition hover:bg-[color:var(--surface-subtle)] sm:px-5",
                            index % 2 === 1 && "sm:border-l",
                            checked && "bg-[color:var(--clinical-accent-soft)]/55",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
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
                          <span>
                            <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">
                              {record.shortName}
                            </span>
                            <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                              {record.clinicalSignal}
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

        <aside className="grid content-start gap-4 xl:sticky xl:top-20">
          <section className="overflow-hidden rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3 border-b border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
                <FileCheck2 className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Working diagnosis</p>
                <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Structured wording</h2>
              </div>
            </div>
            <div className="grid gap-4 p-4">
              <p className="text-base font-extrabold leading-7 text-[color:var(--text-heading)]">{wording}</p>
              <div className="grid gap-2 border-t border-[color:var(--border)] pt-3">
                <p className={eyebrowText}>Applied specifiers</p>
                {selectedRecords.length ? (
                  <ul className="grid gap-2">
                    {selectedRecords.map((record) => (
                      <li
                        key={record!.slug}
                        className="flex items-center justify-between gap-2 text-sm font-semibold text-[color:var(--text-muted)]"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Tags className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
                          {record!.shortName}
                        </span>
                        <Link
                          href={`/specifiers/${record!.slug}`}
                          aria-label={`Review ${record!.shortName}`}
                          className="grid h-tap w-tap place-items-center rounded-md text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]"
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
