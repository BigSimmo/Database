"use client";

import Link from "next/link";
import { useMemo, useState, useDeferredValue } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  GitCompareArrows,
  ListChecks,
  Network,
  Search,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import {
  FormulationBreadcrumbs,
  FormulationPageShell,
  FormulationSafetyNote,
  FormulationSubnav,
  MechanismDomainChips,
  formulationCard,
} from "@/components/formulation/formulation-ui";
import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import {
  formulationDomains,
  formulationSearchPresets,
  formulationTemplates,
  searchFormulationMechanisms,
} from "@/lib/formulation";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";

function presetHref(query: string) {
  return appModeHomeHref("formulation", { query, run: true, focus: true });
}

function builderTemplateHref(templateId: string) {
  const params = new URLSearchParams({ template: templateId });
  return `/formulation/builder?${params.toString()}`;
}

function FormulationThreadStrip() {
  const steps = [
    { label: "Notice", body: "Presenting patterns and patient language" },
    { label: "Hypothesise", body: "Mechanisms that may explain the pattern" },
    { label: "Test", body: "Fit, alternatives, and disconfirming evidence" },
    { label: "Act", body: "Treatment leverage and review points" },
  ];

  return (
    <section
      aria-labelledby="formulation-thread-title"
      className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-inset)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-2.5">
        <div>
          <p className={eyebrowText}>Formulation thread</p>
          <h2 id="formulation-thread-title" className="mt-0.5 text-sm font-extrabold text-[color:var(--text-heading)]">
            Carry evidence through to an actionable hypothesis
          </h2>
        </div>
        <Waypoints className="h-5 w-5 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
      </div>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              "relative grid grid-cols-[2rem_minmax(0,1fr)] gap-2.5 px-4 py-3",
              index > 0 && "border-t border-[color:var(--border)] sm:border-t-0",
              index % 2 === 1 && "sm:border-l sm:border-[color:var(--border)]",
              index === 2 && "lg:border-l lg:border-[color:var(--border)]",
            )}
          >
            <span className="nums grid h-8 w-8 place-items-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-bold text-[color:var(--text-heading)]">{step.label}</span>
              <span className="mt-0.5 block text-xs font-medium leading-4 text-[color:var(--text-muted)]">
                {step.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FormulationHome() {
  return (
    <ModeHomeMain testId="formulation-home" contentAlign="startOnPhone">
      <ModeHomeTemplate
        testId="formulation"
        title="Formulation"
        subtitle="Build a formulation from the evidence."
        icon={Network}
        actionsLabel="Formulation workflows"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actions={[
          {
            title: "Search mechanisms",
            description: "Translate patient language into testable hypotheses.",
            icon: Search,
            href: "/formulation?focus=1",
          },
          {
            title: "Build a formulation",
            description: "Move from mechanisms to a structured draft.",
            icon: ListChecks,
            href: "/formulation/builder",
          },
          {
            title: "Compare mechanisms",
            description: "Clarify close alternatives side by side.",
            icon: GitCompareArrows,
            href: "/formulation/compare",
          },
        ]}
        pillsTitle="Frameworks"
        pills={formulationTemplates.slice(0, 5).map((template) => ({
          label: template.label,
          href: builderTemplateHref(template.id),
          icon: Network,
        }))}
        pillsAction={
          <Link
            href="/formulation/map"
            className="inline-flex min-h-tap items-center gap-1.5 rounded-md px-2 text-xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:min-h-9"
          >
            Mechanism map
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
        footer={
          <div className="grid gap-3">
            <FormulationThreadStrip />
            <ModeHomeVerificationFooter
              icon={ShieldCheck}
              label="Hypothesis-led decision support"
              body="Check fit, alternatives, risk, and context before using a draft"
            />
          </div>
        }
      />
    </ModeHomeMain>
  );
}

function EmptySearchResults({ query }: { query: string }) {
  return (
    <div className={cn(formulationCard, "grid justify-items-center gap-3 px-5 py-12 text-center")}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]">
        <Search className="h-6 w-6" aria-hidden />
      </span>
      <div className="grid gap-1">
        <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">No mechanism matched “{query}”</h2>
        <p className="max-w-xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Try a patient phrase, sequence, coping response, or clinical clue—for example “I keep going over it” or “I was
          not really there”.
        </p>
      </div>
      <Link
        href="/formulation"
        className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)]"
      >
        Clear search
      </Link>
    </div>
  );
}

function FormulationResults({ query }: { query: string }) {
  const [domain, setDomain] = useState("all");
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchFormulationMechanisms(deferredQuery, { domain }),
    [domain, deferredQuery],
  );

  return (
    <FormulationPageShell>
      <div className="grid gap-3">
        <FormulationBreadcrumbs />
        <FormulationSubnav active="search" />
      </div>

      <header className="grid gap-2 border-b border-[color:var(--border)] pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <p className={eyebrowText}>Mechanism search</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
            Mechanisms matching “{query}”
          </h1>
          <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            Matches use patient language, clinical clues, domains, symptoms, and formulation context. Open a mechanism
            to test fit and competing explanations.
          </p>
        </div>
        <p className="nums text-sm font-bold text-[color:var(--text-muted)]" aria-live="polite">
          {results.length} {results.length === 1 ? "match" : "matches"}
        </p>
      </header>

      <section
        aria-label="Filter mechanism results"
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center"
      >
        <div className="polished-scroll flex gap-2 overflow-x-auto">
          {formulationSearchPresets.slice(0, 4).map((preset) => (
            <Link
              key={preset.label}
              href={presetHref(preset.query)}
              className="inline-flex min-h-tap shrink-0 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text-muted)] hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)] lg:min-h-9"
            >
              {preset.label}
            </Link>
          ))}
        </div>
        <label className="grid gap-1">
          <span className="sr-only">Filter by formulation domain</span>
          <select
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            className="min-h-tap rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
          >
            <option value="all">All formulation domains</option>
            {formulationDomains.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </section>

      {results.length === 0 ? (
        <EmptySearchResults query={query} />
      ) : (
        <section aria-label="Mechanism matches" className="grid gap-3">
          {results.map(({ mechanism }, index) => (
            <article
              key={mechanism.id}
              className={cn(
                formulationCard,
                "group overflow-hidden transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)]",
                index === 0 && "border-l-[3px] border-l-[color:var(--clinical-accent)]",
              )}
            >
              <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.58fr)_auto] sm:items-center sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/formulation/${mechanism.id}`}
                      className="text-lg font-extrabold text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)] sm:text-xl"
                    >
                      {mechanism.name}
                    </Link>
                    {index === 0 ? (
                      <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-[color:var(--success-soft)] px-2 text-2xs font-extrabold text-[color:var(--success)]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        Closest text match
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {mechanism.summary}
                  </p>
                  <div className="mt-3">
                    <MechanismDomainChips values={mechanism.domains} limit={3} />
                  </div>
                </div>

                <div className="grid gap-2 border-t border-[color:var(--border)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <p className={eyebrowText}>Look for</p>
                  <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {mechanism.clinicalClues[0]}
                  </p>
                </div>

                <Link
                  href={`/formulation/${mechanism.id}`}
                  aria-label={`Open ${mechanism.name}`}
                  className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text)] transition hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-tap sm:px-0"
                >
                  <span className="sm:sr-only">Open</span>
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden
                  />
                </Link>
              </div>
              <div className="grid border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]/55 sm:grid-cols-2">
                <div className="px-4 py-3 sm:px-5">
                  <p className={eyebrowText}>Patient language</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    “{mechanism.patientPhrases[0]}”
                  </p>
                </div>
                <div className="border-t border-[color:var(--border)] px-4 py-3 sm:border-l sm:border-t-0 sm:px-5">
                  <p className={eyebrowText}>Formulation use</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    {mechanism.formulationUse}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <UniversalSearchAlsoMatches modeId="formulation" query={query} />

      <FormulationSafetyNote />
    </FormulationPageShell>
  );
}

export function FormulationHomePage({
  query = "",
  autoRunSearch = false,
}: {
  query?: string;
  autoRunSearch?: boolean;
}) {
  const trimmedQuery = query.trim();
  if (!autoRunSearch || !trimmedQuery) return <FormulationHome />;
  return <FormulationResults query={trimmedQuery} />;
}
