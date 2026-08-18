"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, FileSearch, Landmark, Search, ShieldCheck } from "lucide-react";

import { InformationPageFooter, InformationPageShell } from "@/components/information-page-shell";
import { dictionaryEntries, dictionarySources } from "@/lib/dictionary-data";

const authorityTiers = [
  {
    title: "Australian public authorities",
    description:
      "Australian Government agencies, state health departments and public clinical services are preferred first.",
  },
  {
    title: "Australian professional and medicines sources",
    description:
      "National colleges, medicine regulators and independent Australian prescribing sources fill specialist gaps.",
  },
  {
    title: "International public authorities",
    description: "WHO, NICE, NHS and Royal College sources are used only where Australian coverage is insufficient.",
  },
] as const;

export function DictionarySourcesPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSources = useMemo(
    () =>
      dictionarySources.filter((source) =>
        `${source.title} ${source.organisation} ${source.region}`.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery],
  );
  const organisationCoverage = useMemo(() => {
    const organisations = new Map<string, { sourceCount: number; entrySlugs: Set<string> }>();
    for (const source of dictionarySources) {
      const current = organisations.get(source.organisation) ?? { sourceCount: 0, entrySlugs: new Set<string>() };
      current.sourceCount += 1;
      for (const entry of dictionaryEntries) {
        if (entry.sourceRefs.some((reference) => reference.sourceId === source.id)) current.entrySlugs.add(entry.slug);
      }
      organisations.set(source.organisation, current);
    }
    return [...organisations.entries()]
      .map(([organisation, coverage]) => ({
        organisation,
        sourceCount: coverage.sourceCount,
        entryCount: coverage.entrySlugs.size,
      }))
      .sort((left, right) => right.entryCount - left.entryCount || left.organisation.localeCompare(right.organisation));
  }, []);

  return (
    <InformationPageShell width="bleed" gap={false} testId="dictionary-sources-main">
      <div className="mx-auto w-full max-w-[76rem] px-4 py-6 sm:px-6 sm:py-8">
        <header className="max-w-3xl">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary governance
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Sources and review
          </h1>
          <p className="mt-3 text-base leading-7 text-[color:var(--text-muted)]">
            See what source checking means, which authorities support the catalogue, and when published wording is
            reviewed.
          </p>
        </header>

        <section
          aria-labelledby="source-linked-heading"
          className="mt-7 grid gap-4 border-y border-[color:var(--border)] py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
        >
          <div>
            <h2
              id="source-linked-heading"
              className="flex items-center gap-2 text-xl font-extrabold text-[color:var(--text-heading)]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--success)] text-[color:var(--success)]">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              </span>
              What Source linked means
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text)]">
              A source-linked entry names the authoritative source published for its collection, so every definition can
              be read next to the document it came from. The link is recorded at collection level: it has not been
              verified sentence by sentence against that document, and no clinician has signed off an individual entry.
            </p>
          </div>
          <div className="rounded-lg border border-[color:var(--warning)]/30 bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--text)]">
            <strong className="block text-[color:var(--text-heading)]">It is not specialist clinical approval.</strong>
            Every entry remains approval pending. Read the linked source before relying on any definition clinically.
            The dictionary is reference terminology, not patient-specific guidance.
          </div>
        </section>

        <section aria-labelledby="authority-heading" className="mt-8">
          <h2 id="authority-heading" className="text-xl font-extrabold text-[color:var(--text-heading)]">
            Authority hierarchy
          </h2>
          <div className="mt-3 grid border-y border-[color:var(--border)] lg:grid-cols-3">
            {authorityTiers.map((tier, index) => (
              <article
                key={tier.title}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-[color:var(--border)] py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:px-5 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-xs font-extrabold text-[color:var(--clinical-accent)]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">{tier.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{tier.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="source-index-heading" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="source-index-heading" className="text-xl font-extrabold text-[color:var(--text-heading)]">
                  Source index
                </h2>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {visibleSources.length} of {dictionarySources.length} direct authoritative sources
                </p>
              </div>
              <label className="flex min-h-tap w-full items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 sm:min-h-10 sm:w-80">
                <Search className="size-icon-sm text-[color:var(--decoration-soft)]" aria-hidden="true" />
                <span className="sr-only">Search sources</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search sources"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
                />
              </label>
            </div>
            <div className="mt-4 border-y border-[color:var(--border)]">
              {visibleSources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group grid min-h-[5.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] py-3 last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                >
                  <span className="min-w-0">
                    <strong className="block text-sm text-[color:var(--clinical-accent)] group-hover:underline">
                      {source.title}
                    </strong>
                    <span className="mt-1 block text-sm text-[color:var(--text)]">{source.organisation}</span>
                    <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                      {source.region} · Accessed {source.accessedOn}
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                </a>
              ))}
              {!visibleSources.length ? (
                <div className="grid justify-items-center py-10 text-center">
                  <FileSearch className="size-icon-lg text-[color:var(--decoration-soft)]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-bold text-[color:var(--text-heading)]">No matching sources</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-2 min-h-tap px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
                  >
                    Clear search
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="min-w-0 border-t border-[color:var(--border)] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
              <Landmark className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
              Organisation coverage
            </h2>
            <div className="mt-2 grid">
              {organisationCoverage.map((coverage) => (
                <div key={coverage.organisation} className="border-b border-[color:var(--border)] py-3">
                  <strong className="block text-sm text-[color:var(--text-heading)]">{coverage.organisation}</strong>
                  <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                    {coverage.entryCount} {coverage.entryCount === 1 ? "entry" : "entries"} · {coverage.sourceCount}{" "}
                    {coverage.sourceCount === 1 ? "source" : "sources"}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section
          id="corrections"
          aria-labelledby="review-heading"
          className="mt-9 grid gap-6 border-t border-[color:var(--border)] pt-7 lg:grid-cols-2"
        >
          <div>
            <h2
              id="review-heading"
              className="flex items-center gap-2 text-xl font-extrabold text-[color:var(--text-heading)]"
            >
              <ShieldCheck className="size-icon-md text-[color:var(--clinical-accent)]" aria-hidden="true" />
              Review cadence
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text)]">
              Published entries carry a checked date and a scheduled review date. A source change, broken link or
              material correction can trigger an earlier review. Source checks and specialist approval remain separate
              states.
            </p>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[color:var(--text-heading)]">Corrections</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text)]">
              Potential errors are triaged against the cited source, corrected with an audit trail, and returned to the
              independent review queue when wording or scope changes. Do not include patient-identifying information in
              a correction report.
            </p>
          </div>
        </section>
      </div>
      <InformationPageFooter>
        Reference terminology · Not patient-specific guidance · Source checking is not specialist approval
      </InformationPageFooter>
    </InformationPageShell>
  );
}
