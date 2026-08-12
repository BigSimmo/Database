"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState, useDeferredValue } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, GitCompareArrows, ListChecks, Network, Search } from "lucide-react";

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
  ResultFilterFacetChips,
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import {
  formulationDomainsInUse,
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
  // Many-of-N. A mechanism carries 3.92 domains on average, so a radio set
  // claimed the reader could not hold Affect and Risk at once, which is false.
  const [domains, setDomains] = useState<ReadonlySet<string>>(() => new Set());
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const rankingReady = deferredQuery === query;
  const searchQuery = query.trim() ? deferredQuery : "";
  const results = useMemo(() => {
    // Cleared live query should restore the full browse catalogue immediately.
    if (!query.trim()) return searchFormulationMechanisms("", { domains });
    // Empty deferred while live query has text would score every mechanism —
    // treat that lag as "no results yet" instead of dumping the full catalogue.
    if (!deferredQuery.trim()) return [];
    return searchFormulationMechanisms(deferredQuery, { domains });
  }, [domains, deferredQuery, query]);
  const hasUniqueTopMatch = results.length > 0 && (results.length < 2 || results[0].score !== results[1].score);

  const toggleDomain = useCallback((value: string) => {
    setDomains((current) => {
      const next = new Set(current);
      if (!next.delete(value)) next.add(value);
      return next;
    });
  }, []);

  // "How many would I have if I ticked this as well" — the same predicate as the
  // filter, run with the candidate added. Under OR-within-group adding an option
  // WIDENS, so a count derived by narrowing the current subset would disagree
  // with what the click actually does. See docs/filter-contract.md section 3.
  const domainGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "domain",
        label: "Domain",
        selected: domains,
        options: formulationDomainsInUse.map((item) => {
          const withCandidate = searchFormulationMechanisms(searchQuery, {
            domains: new Set([...domains, item]),
          }).length;
          return {
            value: item,
            label: item,
            hint: String(withCandidate),
            // A zero here is a consequence of the current query, not a
            // permanently empty option — the derived list already removed
            // those. It stays visible and focusable as a dead end so a reader
            // who has narrowed to nothing can see which choice did it, rather
            // than being offered a tick that silently yields an empty list.
            // Never applied to an option already selected: that would make an
            // active constraint unremovable.
            disabled: withCandidate === 0 && !domains.has(item),
          };
        }),
        onToggle: toggleDomain,
      }),
    [domains, searchQuery, toggleDomain],
  );

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
            activeCount={domains.size}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        // The same control the sheet renders, so the two breakpoints cannot
        // drift. The preset row that used to sit here has moved below the band:
        // it replaced the query rather than narrowing it, which a control
        // labelled "Filter" must not do.
        filterControls={<ResultFilterFacetChips group={domainGroup} idPrefix={`${filterPanelId}-desktop`} />}
      />

      {/* Phone-only by construction: the trigger that opens it lives in the
          ribbon's `mobileControls` slot, which the band hides from `sm` up. One
          group now — the `pattern` group that used to sit above it called
          `router.push` and replaced the query, discarding the search and its
          results with no warning and no undo. Those presets are searches, so
          they render as searches below the band. */}
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId={filterPanelId}
        testId="formulation-filter-panel"
        title="Filter formulation mechanisms"
        groups={[domainGroup]}
        onClearAll={domains.size === 0 ? undefined : () => setDomains(new Set())}
        footerNote={`${results.length} showing`}
      />

      {/* Evicted from the filter sheet, and all five rather than the first four:
          the old `.slice(0, 4)` left one preset unreachable at every breakpoint.
          Framed as a new search, which is what picking one does. */}
      <AnswerSuggestionChips
        label="Try another pattern"
        labelPlacement="above"
        layout="scroll"
        testId="formulation-pattern-suggestions"
        suggestions={formulationSearchPresets.map((preset) => preset.label)}
        onPick={(label) => {
          const preset = formulationSearchPresets.find((item) => item.label === label);
          if (preset) router.push(presetHref(preset.query));
        }}
      />

      {results.length === 0 && rankingReady ? (
        <EmptySearchResults query={query} />
      ) : results.length === 0 ? null : (
        <section aria-label="Mechanism matches" className="grid gap-3">
          {results.map(({ mechanism }, index) => (
            <article
              key={mechanism.id}
              data-testid={index === 0 && hasUniqueTopMatch ? "formulation-top-match" : undefined}
              className={cn(
                formulationCard,
                "group overflow-hidden transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-inset)]",
                index === 0 &&
                  hasUniqueTopMatch &&
                  "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]/20 shadow-[var(--shadow-soft)] ring-1 ring-[color:var(--clinical-accent)]/10",
              )}
            >
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

              <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.5fr)_auto] sm:items-center sm:gap-4 sm:p-5">
                <div className="min-w-0">
                  <Link
                    href={`/formulation/${mechanism.id}`}
                    className="text-lg font-extrabold tracking-tight text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)] sm:text-xl"
                  >
                    {mechanism.name}
                  </Link>
                  <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {mechanism.summary}
                  </p>
                  <div className="mt-2.5">
                    <MechanismDomainChips values={mechanism.domains} limit={3} />
                  </div>
                </div>

                <div className="grid gap-1 border-t border-[color:var(--border)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <p className={eyebrowText}>Look for</p>
                  <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {mechanism.clinicalClues[0]}
                  </p>
                </div>

                <Link
                  href={`/formulation/${mechanism.id}`}
                  aria-label={`Open ${mechanism.name}`}
                  className={cn(
                    "inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:w-tap sm:px-0",
                    index === 0 && hasUniqueTopMatch
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-inset)] hover:bg-[color:var(--clinical-accent-strong)]"
                      : "border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text)] hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)]",
                  )}
                >
                  <span className="sm:sr-only">Open</span>
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden
                  />
                </Link>
              </div>
              <div className="grid border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)]/55 sm:grid-cols-2">
                <div className="px-4 py-2.5 sm:px-5 sm:py-3">
                  <p className={eyebrowText}>Patient language</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    “{mechanism.patientPhrases[0]}”
                  </p>
                </div>
                <div className="border-t border-[color:var(--border)] px-4 py-2.5 sm:border-l sm:border-t-0 sm:px-5 sm:py-3">
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
