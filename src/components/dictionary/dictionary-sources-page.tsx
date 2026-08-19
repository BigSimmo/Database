import { ArrowUpRight, Check, Landmark, ScrollText, ShieldCheck, TriangleAlert } from "lucide-react";

import { InformationPageFooter, InformationPageShell } from "@/components/information-page-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/components/ui-primitives";
import { dictionaryEntries, dictionarySources } from "@/lib/dictionary-data";

/**
 * Governance page for the dictionary catalogue.
 *
 * It is a read-only reference surface: no page search, no local state, and no
 * client bundle. The source index is thirteen rows, so a filter field over it
 * was chrome the reader had to skip past to reach the list it filtered.
 */

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** `2026-08-18` -> `18 Aug 2026`. Formatted from the parts rather than through
    `Intl`, so a server render and a client hydration cannot disagree on locale. */
function formatAccessedOn(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function organisationCoverage() {
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
}

function StatTile({ label, value, hint, compact }: { label: string; value: string; hint?: string; compact?: boolean }) {
  return (
    <div className="bg-[color:var(--surface)] px-4 py-3">
      <dt className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">{label}</dt>
      {/* The hint lives inside the `<dd>`, not beside it: a `<div>` inside a
          `<dl>` may contain only `<dt>`/`<dd>`, and a sibling `<p>` there is a
          serious axe `definition-list` violation.
          `compact` is for the date: at `text-xl` it wrapped to two lines in a
          half-width phone tile and pulled the row out of alignment. */}
      <dd className="mt-1">
        <span
          className={cn(
            "nums block font-extrabold leading-tight text-[color:var(--text-heading)]",
            compact ? "text-base sm:text-lg" : "text-xl",
          )}
        >
          {value}
        </span>
        {hint ? <span className="mt-0.5 block text-xs leading-5 text-[color:var(--text-muted)]">{hint}</span> : null}
      </dd>
    </div>
  );
}



export function DictionarySourcesPage() {
  const coverage = organisationCoverage();
  const australianSources = dictionarySources.filter((source) => source.region === "Australia").length;
  const linkedEntryCount = dictionaryEntries.filter((entry) => entry.sourceRefs.length > 0).length;
  const checkedOn = formatAccessedOn(
    dictionarySources.reduce((latest, source) => (source.accessedOn > latest ? source.accessedOn : latest), ""),
  );

  return (
    <InformationPageShell width="bleed" gap={false} testId="dictionary-sources-main">
      <div className="mx-auto w-full max-w-[76rem] px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary governance
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Sources and review
          </h1>
          {/* The stat strip replaces the introductory paragraph: the same four
              facts, each one checkable, instead of a sentence describing them. */}
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-4">
            <StatTile label="Sources" value={String(dictionarySources.length)} hint="Direct authoritative documents" />
            <StatTile
              label="Australian"
              value={`${australianSources}/${dictionarySources.length}`}
              hint="Remainder international"
            />
            <StatTile label="Linked entries" value={String(linkedEntryCount)} hint="Every published entry" />
            <StatTile label="Sources checked" value={checkedOn} hint="Most recent access date" compact />
          </dl>
        </header>

        {/* One column, full width. A 20rem right rail carrying only organisation
            coverage left two thirds of the viewport empty beside a thirteen-row
            source index; coverage is now a section of its own, and the index
            splits into two columns where there is width for it. */}
        <div className="mt-8 grid gap-9">
          <section aria-labelledby="source-linked-heading">
            <SectionHeading id="source-linked-heading" step="1" title="What Source linked means" />
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:items-start">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--success)] text-[color:var(--success)]">
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                </span>
                <p className="text-sm leading-6 text-[color:var(--text)]">
                  A source-linked entry names the authoritative source published for its collection, so every definition
                  can be read next to the document it came from. The link is recorded at collection level: it has not
                  been verified sentence by sentence against that document, and no clinician has signed off an
                  individual entry.
                </p>
              </div>
              <div className="flex gap-3 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-4 py-3">
                <TriangleAlert
                  className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[color:var(--text)]">
                  <strong className="block text-[color:var(--text-heading)]">
                    It is not specialist clinical approval.
                  </strong>
                  Every entry remains approval pending. Read the linked source before relying on any definition
                  clinically — this is reference terminology, not patient-specific guidance.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="authority-heading">
            <SectionHeading id="authority-heading" step="2" title="Authority hierarchy" />
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {authorityTiers.map((tier, index) => (
                <li
                  key={tier.title}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-2xs font-extrabold text-[color:var(--clinical-accent)]">
                    {index + 1}
                  </span>
                  <h3 className="mt-2.5 text-sm font-extrabold text-[color:var(--text-heading)]">{tier.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{tier.description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="source-index-heading">
            <SectionHeading id="source-index-heading" step="3" title="Source index" />
            <ul className="mt-1 grid lg:grid-cols-2 lg:gap-x-8">
              {dictionarySources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group grid min-h-tap grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                        {source.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-[color:var(--text)]">{source.organisation}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[color:var(--text-muted)]">
                        <span className="rounded-md bg-[color:var(--surface-inset)] px-1.5 py-0.5 font-bold">
                          {source.region}
                        </span>
                        <span>Accessed {formatAccessedOn(source.accessedOn)}</span>
                      </span>
                    </span>
                    <ArrowUpRight
                      className="size-icon-sm shrink-0 text-[color:var(--clinical-accent)]"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Opens in a new tab</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="organisation-coverage-heading">
            <SectionHeading id="organisation-coverage-heading" step="4" title="Organisation coverage" />
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coverage.map((organisation) => (
                <li
                  key={organisation.organisation}
                  className="flex gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
                >
                  <Landmark
                    className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--clinical-accent)]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
                      {organisation.organisation}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">
                      <span className="nums">{organisation.entryCount}</span>{" "}
                      {organisation.entryCount === 1 ? "entry" : "entries"} ·{" "}
                      <span className="nums">{organisation.sourceCount}</span>{" "}
                      {organisation.sourceCount === 1 ? "source" : "sources"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section id="corrections" aria-labelledby="review-heading" className="scroll-mt-page-section">
            <SectionHeading id="review-heading" step="5" title="Review and corrections" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <article className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
                  <ShieldCheck className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  Review cadence
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                  Published entries carry a checked date and a scheduled review date. A source change, broken link or
                  material correction can trigger an earlier review. Source checks and specialist approval remain
                  separate states.
                </p>
              </article>
              <article className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
                  <ScrollText className="size-icon-sm text-[color:var(--clinical-accent)]" aria-hidden="true" />
                  Corrections
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                  Potential errors are triaged against the cited source, corrected with an audit trail, and returned to
                  the independent review queue when wording or scope changes. Do not include patient-identifying
                  information in a correction report.
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>
      <InformationPageFooter>
        Reference terminology · Not patient-specific guidance · Source checking is not specialist approval
      </InformationPageFooter>
    </InformationPageShell>
  );
}
