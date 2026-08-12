"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useDeferredValue } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  GitCompareArrows,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Network,
  Search,
  Target,
} from "lucide-react";

import {
  FormulationPageShell,
  FormulationSafetyNote,
  MechanismDomainChips,
  formulationCard,
} from "@/components/formulation/formulation-ui";
import { ClinicalPathwayStrip } from "@/components/clinical-record-panels";
import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
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
  return (
    <ClinicalPathwayStrip
      id="formulation-thread"
      eyebrow="Formulation thread"
      title="Carry evidence through to an actionable hypothesis"
      steps={[
        { label: "Notice", body: "Presenting patterns and patient language" },
        { label: "Hypothesise", body: "Mechanisms that may explain the pattern" },
        { label: "Test", body: "Fit, alternatives, and disconfirming evidence" },
        { label: "Act", body: "Treatment leverage and review points" },
      ]}
    />
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
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--surface-subtle)] text-[color:var(--decoration-soft)]">
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
  const router = useRouter();
  const [domain, setDomain] = useState("all");
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const rankingReady = deferredQuery === query;
  const results = useMemo(() => {
    // Cleared live query should restore the full browse catalogue immediately.
    if (!query.trim()) return searchFormulationMechanisms("", { domain });
    // Empty deferred while live query has text would score every mechanism —
    // treat that lag as "no results yet" instead of dumping the full catalogue.
    if (!deferredQuery.trim()) return [];
    return searchFormulationMechanisms(deferredQuery, { domain });
  }, [domain, deferredQuery, query]);
  const hasUniqueTopMatch = results.length > 0 && (results.length < 2 || results[0].score !== results[1].score);

  return (
    <FormulationPageShell>
      <SearchResultsHeaderBand
        modeId="formulation"
        query={query}
        matchCount={results.length}
        // This is `useDeferredValue` lag over static data, not a network request:
        // the previous count is still on screen and still correct, so it stays
        // visible with a pulse rather than collapsing to a skeleton. Safe here
        // precisely because nothing identity-scoped is being held across the gap.
        status={rankingReady ? "ready" : "refetching"}
        headingLevel={1}
        filterLabel="Filter formulation mechanisms"
        // One compact badged trigger replaces the two-column grid of selects, so
        // the band collapses to one line here too.
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="formulation-filter-trigger-phone"
            title="Filter formulation mechanisms"
            open={filterOpen}
            activeCount={domain === "all" ? 0 : 1}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        filterControls={
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
            <div className="polished-scroll flex gap-1.5 overflow-x-auto">
              {formulationSearchPresets.slice(0, 4).map((preset) => (
                <Link
                  key={preset.label}
                  href={presetHref(preset.query)}
                  className="inline-flex min-h-tap shrink-0 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-semibold text-[color:var(--text-muted)] hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)] sm:min-h-10"
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
                className="min-h-tap rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20 sm:min-h-10"
              >
                <option value="all">All formulation domains</option>
                {formulationDomains.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      {/* Phone-only by construction: the trigger that opens it lives in the
          ribbon's `mobileControls` slot, which the band hides from `sm` up. Two
          groups here, which is the whole reason this stopped being a select —
          two dimensions used to mean two side-by-side controls in a 320px line. */}
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId={filterPanelId}
        testId="formulation-filter-panel"
        title="Filter formulation mechanisms"
        groups={[
          resultFilterGroup({
            id: "pattern",
            label: "Pattern",
            // A pattern runs a new search rather than narrowing this one, so the
            // selected entry is always the placeholder naming where you are.
            value: "current",
            options: [
              { value: "current", label: "Current search", disabled: true },
              ...formulationSearchPresets.slice(0, 4).map((preset) => ({
                value: preset.query,
                label: preset.label,
              })),
            ],
            onChange: (value) => {
              if (value === "current") return;
              setFilterOpen(false);
              router.push(presetHref(value));
            },
          }),
          resultFilterGroup({
            id: "domain",
            label: "Domain",
            value: domain,
            options: [
              { value: "all", label: "All domains" },
              ...formulationDomains.map((item) => ({ value: item, label: item })),
            ],
            onChange: setDomain,
          }),
        ]}
        onClearAll={domain === "all" ? undefined : () => setDomain("all")}
        footerNote={`${results.length} showing`}
      />

      {results.length === 0 && rankingReady ? (
        <EmptySearchResults query={query} />
      ) : results.length === 0 ? null : (
        <section aria-label="Mechanism matches" className="grid gap-4 sm:gap-5">
          {results.map(({ mechanism }, index) => (
            <article
              key={mechanism.id}
              data-testid={index === 0 && hasUniqueTopMatch ? "formulation-top-match" : undefined}
              data-formulation-result-card
              className={cn(
                formulationCard,
                "group relative overflow-hidden rounded-xl border-[color:var(--border-strong)] shadow-[var(--shadow-soft)] transition hover:border-[color:var(--clinical-accent-border)] motion-reduce:transition-none",
                index === 0 &&
                  hasUniqueTopMatch &&
                  "border-[color:var(--clinical-accent)] ring-1 ring-[color:var(--clinical-accent)]/10",
              )}
            >
              <div
                aria-hidden
                data-formulation-card-accent
                className={cn(
                  "h-1 w-full bg-[color:var(--clinical-accent-border)]",
                  index === 0 && hasUniqueTopMatch && "bg-[color:var(--clinical-accent)]",
                )}
              />
              {index === 0 && hasUniqueTopMatch ? (
                <div className="flex items-center gap-2 border-b border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)] sm:px-5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-inset)]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>Top match for your search</span>
                  <span className="ml-auto hidden font-semibold text-[color:var(--text-muted)] sm:inline">
                    Review fit and alternatives
                  </span>
                </div>
              ) : null}

              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)] lg:items-start">
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-2xl">
                    <Link
                      href={`/formulation/${mechanism.id}`}
                      className="transition hover:text-[color:var(--clinical-accent)] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none"
                    >
                      {mechanism.name}
                    </Link>
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {mechanism.summary}
                  </p>
                  <div className="mt-3">
                    <MechanismDomainChips values={mechanism.domains} limit={3} />
                  </div>
                </div>

                <div className="rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/55 p-3.5 shadow-[var(--shadow-inset)]">
                  <div className="flex items-center gap-2 text-[color:var(--clinical-accent)]">
                    <Target className="h-4 w-4 shrink-0" aria-hidden />
                    <p className={eyebrowText}>Look for</p>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {mechanism.clinicalClues[0]}
                  </p>
                </div>
              </div>
              <div
                data-formulation-card-details
                className="grid gap-px border-y border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-2"
              >
                <div className="flex items-start gap-3 bg-[color:var(--surface-subtle)] px-4 py-3.5 sm:px-5 sm:py-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--info-soft)] text-[color:var(--info)]">
                    <MessageSquareQuote className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className={eyebrowText}>Patient language</p>
                    <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                      “{mechanism.patientPhrases[0]}”
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-[color:var(--surface-subtle)] px-4 py-3.5 sm:px-5 sm:py-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                    <Lightbulb className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className={eyebrowText}>Formulation use</p>
                    <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                      {mechanism.formulationUse}
                    </p>
                  </div>
                </div>
              </div>
              <div
                data-formulation-card-action
                className="flex bg-[color:var(--surface-raised)] px-4 py-3.5 sm:justify-end sm:px-5 sm:py-4"
              >
                <Link
                  href={`/formulation/${mechanism.id}`}
                  aria-label={`Open ${mechanism.name}`}
                  className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--clinical-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none sm:w-auto sm:min-w-44 sm:px-5"
                >
                  Open mechanism
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden
                  />
                </Link>
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
