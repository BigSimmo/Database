"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useId, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Lightbulb, MessageSquareQuote, Search, Target } from "lucide-react";

import {
  FormulationPageShell,
  FormulationSafetyNote,
  MechanismDomainChips,
  formulationCard,
} from "@/components/formulation/formulation-ui";
import {
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import { consolidatedModeSearchPath } from "@/lib/consolidated-mode-home-redirect";
import {
  formulationDomainsInUse,
  formulationDomainGroups,
  formulationSearchPresets,
  searchFormulationMechanisms,
} from "@/lib/formulation";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { readResultFilterValues, replaceResultFilterUrl, writeResultFilterValues } from "@/lib/result-filter-url";

function presetHref(query: string) {
  return appModeHomeHref("formulation", { query, run: true, focus: true });
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
        href={consolidatedModeSearchPath("formulation")}
        className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-semibold text-[color:var(--command-contrast)]"
      >
        Clear search
      </Link>
    </div>
  );
}

function FormulationResults({ query }: { query: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Many-of-N. A mechanism carries 3.92 domains on average, so a radio set
  // claimed the reader could not hold Affect and Risk at once, which is false.
  const domainValues = useMemo(() => new Set(formulationDomainsInUse), []);
  const domains = useMemo(
    () => new Set(readResultFilterValues(searchParams, "domain", domainValues)),
    [domainValues, searchParams],
  );
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const rankingReady = deferredQuery === query;
  // The one frame where the live query has text but the deferred one has not
  // caught up. `results` deliberately reports nothing there rather than scoring
  // the whole catalogue, so the counts must say the same thing — otherwise the
  // sheet shows "0 showing" beside nine non-zero counts, which is the exact
  // disagreement between a filter and its own predicate that this contract
  // exists to remove.
  const pendingRanking = Boolean(query.trim()) && !deferredQuery.trim();
  const searchQuery = query.trim() ? deferredQuery : "";
  const results = useMemo(() => {
    // Cleared live query should restore the full browse catalogue immediately.
    if (!query.trim()) return searchFormulationMechanisms("", { domains });
    // Empty deferred while live query has text would score every mechanism —
    // treat that lag as "no results yet" instead of dumping the full catalogue.
    if (!deferredQuery.trim()) return [];
    return searchFormulationMechanisms(deferredQuery, { domains, interpretNaturalLanguage: true });
  }, [domains, deferredQuery, query]);
  const hasUniqueTopMatch = results.length > 0 && (results.length < 2 || results[0].score !== results[1].score);

  const toggleDomain = useCallback(
    (value: string) => {
      replaceResultFilterUrl((params) => {
        const next = new Set(readResultFilterValues(params, "domain", domainValues));
        if (!next.delete(value)) next.add(value);
        writeResultFilterValues(params, "domain", next, domainValues);
      });
    },
    [domainValues],
  );

  // "How many would I have if I ticked this as well" — the same predicate as the
  // filter, run with the candidate added. Under OR-within-group adding an option
  // WIDENS, so a count derived by narrowing the current subset would disagree
  // with what the click actually does. See docs/filter-contract.md section 3.
  const domainGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "domain",
        label: "Domain",
        description: "Domains combine with OR. Sections organise the taxonomy without changing that predicate.",
        selected: domains,
        optionSections: formulationDomainGroups.map((section) => ({
          id: section.id,
          label: section.label,
          description: section.description,
          optionValues: section.domains.filter((domain) => domainValues.has(domain)),
        })),
        options: formulationDomainsInUse.map((item) => {
          const withCandidate = pendingRanking
            ? 0
            : searchFormulationMechanisms(searchQuery, {
                domains: new Set([...domains, item]),
                interpretNaturalLanguage: true,
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
            // active constraint unremovable — and never during the deferred
            // lag, where a zero means "not scored yet", not "nothing matches",
            // and would flash all nine options inert for a frame.
            disabled: !pendingRanking && withCandidate === 0 && !domains.has(item),
          };
        }),
        onToggle: toggleDomain,
      }),
    [domains, domainValues, pendingRanking, searchQuery, toggleDomain],
  );
  const appliedFilters: AppliedFilterChip[] = [...domains].map((domain) => ({
    id: `domain-${domain}`,
    groupLabel: "Domain",
    valueLabel: domain,
    onRemove: () => toggleDomain(domain),
  }));
  const clearDomains = () =>
    replaceResultFilterUrl((params) => {
      params.delete("domain");
    });

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
        appliedFilters={appliedFilters}
        onClearFilters={domains.size > 0 ? clearDomains : undefined}
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
        filterControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="formulation-filter-trigger-desktop"
            title="Filter formulation mechanisms"
            open={filterOpen}
            activeCount={domains.size}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
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
        onClearAll={domains.size === 0 ? undefined : clearDomains}
        summary={{ count: results.length, noun: results.length === 1 ? "mechanism" : "mechanisms" }}
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
        <section aria-label="Mechanism matches" className="grid gap-4 sm:gap-5">
          {results.map(({ mechanism }, index) => (
            <article
              key={mechanism.id}
              data-testid={index === 0 && hasUniqueTopMatch ? "formulation-top-match" : undefined}
              data-formulation-result-card
              className={cn(
                formulationCard,
                "group relative overflow-hidden rounded-xl border-[color:var(--border-strong)] shadow-[var(--e2)] transition hover:border-[color:var(--clinical-accent-border)] motion-reduce:transition-none",
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
                  className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] px-4 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-inset)] transition hover:bg-[color:var(--clinical-accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none sm:w-auto sm:min-w-44 sm:px-5"
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
}: {
  query?: string;
  /** Kept so existing callers can pass it; empty queries now browse the catalogue. */
  autoRunSearch?: boolean;
}) {
  return <FormulationResults query={query.trim()} />;
}
