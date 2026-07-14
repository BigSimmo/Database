"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  GitCompareArrows,
  ListChecks,
  Search,
  ShieldCheck,
  Tags,
  Waypoints,
} from "lucide-react";

import { ModeHomeMain, ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import {
  CategoryTag,
  DiagnosisChips,
  ReviewStatusBadge,
  SpecifierBreadcrumbs,
  SpecifierFamilyBadge,
  SpecifierPageShell,
  SpecifierSafetyNote,
  SpecifierSubnav,
  specifierCard,
} from "@/components/specifiers/specifier-ui";
import { cn, eyebrowText } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { searchSpecifiers, specifierFamilies, specifierSearchPresets, type SpecifierFamily } from "@/lib/specifiers";
import { searchSpecifierCatalog, type SpecifierCatalogMatch } from "@/lib/specifiers-search-index";

// The curated set covers a small number of high-signal mood-episode specifiers.
// The full DSM-5-TR catalogue (~585 items) is surfaced additively beneath the
// curated matches so a search still reaches the broader taxonomy without displacing
// the richer curated cards.
const CATALOGUE_RESULT_LIMIT = 24;

const diagnosisOptions = [
  { value: "", label: "All diagnoses" },
  { value: "depressive", label: "Depressive" },
  { value: "bipolar", label: "Bipolar" },
  { value: "psychotic", label: "Psychotic" },
  { value: "mood", label: "Mood episodes" },
];

function presetHref(query: string) {
  return appModeHomeHref("specifiers", { query, run: true, focus: true });
}

function SpecifierPathwayStrip() {
  const steps = [
    { label: "Diagnosis", body: "Name the disorder" },
    { label: "Episode features", body: "Describe what is present now" },
    { label: "Course and onset", body: "Place the episode in time" },
    { label: "Severity or remission", body: "State current burden and recovery" },
  ];

  return (
    <section
      aria-labelledby="specifier-pathway-title"
      className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-left shadow-[var(--shadow-inset)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-2.5">
        <div>
          <p className={eyebrowText}>Specifier pathway</p>
          <h2 id="specifier-pathway-title" className="mt-0.5 text-sm font-extrabold text-[color:var(--text-heading)]">
            Build diagnostic wording in clinical order
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

function SpecifiersHome() {
  return (
    <ModeHomeMain testId="specifiers-home" className="justify-start sm:justify-center">
      <ModeHomeTemplate
        testId="specifiers"
        title="Refine the diagnosis with the right specifier"
        subtitle="Describe the presentation in ordinary clinical language, then check fit, exclusions, and diagnostic wording."
        icon={Tags}
        actionsLabel="Specifier workflows"
        desktopComposerSlotId={modeHomeDesktopComposerSlotId}
        actions={[
          {
            title: "Find a specifier",
            description: "Match a presentation or diagnosis.",
            icon: Search,
            href: "/specifiers?focus=1",
          },
          {
            title: "Build diagnostic wording",
            description: "Assemble a clear, ordered diagnosis.",
            icon: ListChecks,
            href: "/specifiers/builder",
          },
          {
            title: "Compare close calls",
            description: "See the deciding features side by side.",
            icon: GitCompareArrows,
            href: "/specifiers/compare",
          },
        ]}
        pillsTitle="Common clinical starts"
        pills={specifierSearchPresets.map((preset) => ({
          label: preset.label,
          href: presetHref(preset.query),
          icon: Tags,
        }))}
        pillsAction={
          <Link
            href="/specifiers/map"
            className="inline-flex min-h-tap items-center gap-1.5 rounded-md px-2 text-xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] lg:min-h-9"
          >
            Browse map
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
        footer={
          <div className="grid gap-3">
            <SpecifierPathwayStrip />
            <ModeHomeVerificationFooter
              icon={ShieldCheck}
              label="Diagnostic decision support"
              body="Review criteria and exclusions before documenting"
            />
          </div>
        }
      />
    </ModeHomeMain>
  );
}

function EmptySearchResults({ query }: { query: string }) {
  return (
    <div className={cn(specifierCard, "grid justify-items-center gap-3 px-5 py-12 text-center")}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]">
        <Search className="h-6 w-6" aria-hidden />
      </span>
      <div className="grid gap-1">
        <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">
          No strong match for &ldquo;{query}&rdquo;
        </h2>
        <p className="max-w-xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Try the episode pattern, timing, patient language, or the base diagnosis. For example: &ldquo;depressed but
          racing thoughts&rdquo; or &ldquo;returns every winter&rdquo;.
        </p>
      </div>
      <Link
        href="/specifiers"
        className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)]"
      >
        Clear search
      </Link>
    </div>
  );
}

function SpecifierCatalogueMatches({ matches }: { matches: SpecifierCatalogMatch[] }) {
  if (!matches.length) return null;

  return (
    <section aria-labelledby="catalogue-matches-title" className="grid gap-3">
      <header className="grid gap-1.5 border-t border-[color:var(--border)] pt-5">
        <p className={eyebrowText}>Full DSM-5-TR catalogue</p>
        <h2
          id="catalogue-matches-title"
          className="text-xl font-extrabold tracking-tight text-[color:var(--text-heading)]"
        >
          More across the specifier taxonomy
        </h2>
        <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
          Broader matches from the complete catalogue. Definitions are shown only where the source has been verified;
          the rest are marked pending clinician review.
        </p>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {matches.map(({ item }) => (
          <li key={item.slug}>
            <Link
              href={`/specifiers/${item.slug}`}
              className={cn(
                specifierCard,
                "group grid gap-2 p-4 transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-extrabold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                  {item.label}
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--clinical-accent)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden
                />
              </div>
              <p className="text-xs font-medium leading-5 text-[color:var(--text-muted)]">{item.disorder}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryTag categoryId={item.categoryId} name={item.category} />
                <ReviewStatusBadge status={item.src} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SpecifierResults({ query }: { query: string }) {
  const [family, setFamily] = useState<"all" | SpecifierFamily>("all");
  const [diagnosis, setDiagnosis] = useState("");
  const results = useMemo(() => searchSpecifiers(query, { family, diagnosis }), [diagnosis, family, query]);
  // The full-catalogue section is additive and diagnosis-specific, so it is NOT
  // de-duped against the curated cards: those are generic mood-only specifiers, and
  // a label-only match would wrongly hide the disorder-specific catalogue rows (e.g.
  // a curated "With catatonia" card must not remove schizophrenia/autism catatonia).
  // It still drives the shared count and empty-state so a catalog-only query never
  // shows "0 matches" with an empty-state banner above real results.
  const catalogueMatches = useMemo(() => searchSpecifierCatalog(query).slice(0, CATALOGUE_RESULT_LIMIT), [query]);
  const totalMatches = results.length + catalogueMatches.length;

  return (
    <SpecifierPageShell>
      <div className="grid gap-3">
        <SpecifierBreadcrumbs />
        <SpecifierSubnav active="search" />
      </div>

      <header className="grid gap-2 border-b border-[color:var(--border)] pb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1.5">
          <p className={eyebrowText}>Specifier search</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-3xl">
            Matches for &ldquo;{query}&rdquo;
          </h1>
          <p className="max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            Results ranked by text relevance: title, keywords, episode timing, and patient language. Open a result to
            check exclusions and wording.
          </p>
        </div>
        <p className="nums text-sm font-bold text-[color:var(--text-muted)]" aria-live="polite">
          {totalMatches} {totalMatches === 1 ? "match" : "matches"}
        </p>
      </header>

      <section
        aria-label="Filter specifier results"
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center"
      >
        <div className="polished-scroll flex gap-1 overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-1 shadow-[var(--shadow-inset)]">
          {specifierFamilies.map((option) => {
            const active = family === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFamily(option.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex min-h-tap shrink-0 items-center rounded-md px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-sm",
                  active
                    ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]",
                )}
              >
                <span className="sm:hidden">{option.shortLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
        <label className="grid gap-1">
          <span className="sr-only">Filter by diagnosis</span>
          <select
            value={diagnosis}
            onChange={(event) => setDiagnosis(event.target.value)}
            className="min-h-tap rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--text)] shadow-[var(--shadow-inset)] outline-none focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/20"
          >
            {diagnosisOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {totalMatches === 0 ? (
        <EmptySearchResults query={query} />
      ) : results.length > 0 ? (
        <section aria-label="Specifier matches" className="grid gap-3">
          {results.map(({ record }, index) => (
            <article
              key={record.slug}
              className={cn(
                specifierCard,
                "group overflow-hidden transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)]",
                index === 0 && "border-l-[3px] border-l-[color:var(--clinical-accent)]",
              )}
            >
              <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.62fr)_auto] sm:items-center sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/specifiers/${record.slug}`}
                      className="text-lg font-extrabold text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)] sm:text-xl"
                    >
                      {record.name}
                    </Link>
                    {index === 0 ? (
                      <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-[color:var(--success-soft)] px-2 text-2xs font-extrabold text-[color:var(--success)]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        Top match
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {record.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SpecifierFamilyBadge record={record} />
                    <DiagnosisChips values={record.appliesTo.slice(0, 2)} />
                  </div>
                </div>

                <div className="grid gap-2 border-t border-[color:var(--border)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <p className={eyebrowText}>Deciding signal</p>
                  <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                    {record.clinicalSignal}
                  </p>
                </div>

                <Link
                  href={`/specifiers/${record.slug}`}
                  aria-label={`Open ${record.name}`}
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
                  <p className={eyebrowText}>Ask this</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    {record.decisionQuestion}
                  </p>
                </div>
                <div className="border-t border-[color:var(--border)] px-4 py-3 sm:border-l sm:border-t-0 sm:px-5">
                  <p className={eyebrowText}>Typical language</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    &ldquo;{record.patientLanguage[0]}&rdquo;
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <SpecifierCatalogueMatches matches={catalogueMatches} />

      <SpecifierSafetyNote />
    </SpecifierPageShell>
  );
}

export function SpecifiersHomePage({ query = "", autoRunSearch = false }: { query?: string; autoRunSearch?: boolean }) {
  const trimmedQuery = query.trim();
  if (!autoRunSearch || !trimmedQuery) return <SpecifiersHome />;
  return <SpecifierResults query={trimmedQuery} />;
}
