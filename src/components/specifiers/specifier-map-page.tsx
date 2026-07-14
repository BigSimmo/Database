"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, GitCompareArrows, Tags, Waypoints } from "lucide-react";
import { useState } from "react";

import {
  DiagnosisChips,
  SpecifierBreadcrumbs,
  SpecifierFamilyBadge,
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierSubnav,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { findSpecifier, specifierFamilies, specifierRecords } from "@/lib/specifiers";

export function SpecifierMapPage({ initialSlug }: { initialSlug?: string }) {
  // Derive valid initial slug from props
  const validInitialSlug = findSpecifier(initialSlug ?? "")?.slug ?? specifierRecords[0].slug;

  // Track selected slug with derived initial state pattern (useState with function)
  const [state, setState] = useState({ selectedSlug: validInitialSlug, lastInitialSlug: initialSlug });

  // Derive state: if initialSlug prop changed, reset to new initial; otherwise keep current selection
  const selectedSlug = state.lastInitialSlug !== initialSlug ? validInitialSlug : state.selectedSlug;

  // Update state if derived slug differs from stored state
  if (selectedSlug !== state.selectedSlug || state.lastInitialSlug !== initialSlug) {
    setState({ selectedSlug, lastInitialSlug: initialSlug });
  }

  const selected = findSpecifier(selectedSlug) ?? specifierRecords[0];

  const setSelectedSlug = (slug: string) => {
    setState({ selectedSlug: slug, lastInitialSlug: initialSlug });
  };

  return (
    <SpecifierPageShell>
      <div className="grid gap-3">
        <SpecifierBreadcrumbs current="Map" />
        <SpecifierSubnav active="map" />
      </div>

      <header className="grid gap-2 border-b border-[color:var(--border)] pb-5">
        <p className={eyebrowText}>Diagnostic architecture</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
          Specifier map
        </h1>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Browse by the job each specifier performs. The sequence keeps diagnostic wording clear without implying that
          every diagnosis uses every category.
        </p>
      </header>

      <section
        aria-label="Specifier wording pathway"
        className="grid gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3 sm:grid-cols-[minmax(9rem,0.8fr)_auto_minmax(9rem,1fr)_auto_minmax(9rem,1fr)_auto_minmax(9rem,1fr)] sm:items-center"
      >
        {["Base diagnosis", "Episode features", "Course and onset", "Severity or remission"].map((label, index) => (
          <div key={label} className="contents">
            <div className="flex min-h-12 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-extrabold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]">
              <span className="nums grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs text-[color:var(--clinical-accent-contrast)]">
                {index + 1}
              </span>
              {label}
            </div>
            {index < 3 ? (
              <ArrowRight
                className="hidden h-4 w-4 justify-self-center text-[color:var(--clinical-accent)] sm:block"
                aria-hidden
              />
            ) : null}
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid min-w-0 gap-4 lg:grid-cols-3" aria-label="Specifier families">
          {specifierFamilies
            .filter((family) => family.id !== "all")
            .map((family) => {
              const records = specifierRecords.filter((record) => record.family === family.id);
              return (
                <div key={family.id} className={cn(specifierCard, "overflow-hidden")}>
                  <div className="flex items-center gap-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3">
                    <Waypoints className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden />
                    <div>
                      <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">{family.label}</h2>
                      <p className="nums mt-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
                        {records.length} options
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-[color:var(--border)]">
                    {records.map((record) => {
                      const active = selected.slug === record.slug;
                      return (
                        <button
                          key={record.slug}
                          type="button"
                          onClick={() => setSelectedSlug(record.slug)}
                          aria-pressed={active}
                          className={cn(
                            "group flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left transition focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
                            active
                              ? "bg-[color:var(--clinical-accent-soft)]"
                              : "bg-[color:var(--surface)] hover:bg-[color:var(--surface-subtle)]",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                              active
                                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--clinical-accent)]",
                            )}
                          >
                            <Tags className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">
                              {record.shortName}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-xs font-medium leading-4 text-[color:var(--text-muted)]">
                              {record.clinicalSignal}
                            </span>
                          </span>
                          {active ? (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </section>

        <aside className="grid content-start gap-4 xl:sticky xl:top-20">
          <section className="overflow-hidden rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="border-b border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-3">
              <p className={cn(eyebrowText, "!text-[color:var(--clinical-accent)]")}>Selected specifier</p>
              <h2 className="mt-1 text-xl font-extrabold text-[color:var(--text-heading)]">{selected.shortName}</h2>
            </div>
            <div className="grid gap-4 p-4">
              <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{selected.summary}</p>
              <SpecifierFamilyBadge record={selected} />
              <DiagnosisChips values={selected.appliesTo} />
              <div className="border-t border-[color:var(--border)] pt-3">
                <p className={eyebrowText}>Deciding question</p>
                <p className="mt-1.5 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
                  {selected.decisionQuestion}
                </p>
              </div>
              <div className="grid gap-2">
                <Link
                  href={`/specifiers/${selected.slug}`}
                  className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg bg-[color:var(--command)] px-3 text-sm font-bold text-[color:var(--command-contrast)]"
                >
                  Open full guide
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href={`/specifiers/compare?a=${selected.slug}`}
                  className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)]"
                >
                  <GitCompareArrows className="h-4 w-4" aria-hidden />
                  Compare
                </Link>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}
