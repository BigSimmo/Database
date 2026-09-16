"use client";

import { ChevronRight, Phone, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { OnCallEntryRow } from "@/components/on-call/on-call-entry-row";
import { OnCallPrivateFlag } from "@/components/on-call/on-call-private-flag";
import {
  ON_CALL_SECTION_HREFS,
  ON_CALL_SECTION_ICONS,
  ON_CALL_SECTION_TITLES,
} from "@/components/on-call/on-call-section-identity";
import { EmptyState } from "@/components/primitive-recipes/feedback";
import { SearchField } from "@/components/ui/text-field";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import {
  ON_CALL_SEARCH_RESULT_LIMIT,
  onCallSearchSummary,
  searchOnCallEntries,
  type OnCallSearchResult,
} from "@/lib/on-call/entry-search";
import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { onCallPrimaryNumber, onCallTelHref } from "@/lib/on-call/home-modules";

/**
 * One box across the whole of On Call.
 *
 * The mode is seven pages of the owner's own reference material, and until now
 * the only way to reach a number was to know which page held it. This is the
 * shortcut: type, and every section answers at once, each result still wearing
 * its section's glyph so the reader can see WHERE the answer came from before
 * they tap it.
 *
 * Deliberately quiet when idle. An empty box renders no list, no placeholder
 * rows and no "start typing" card — the home this sits on is a dashboard for
 * the shift, and furniture above its modules pushes them below the fold for a
 * reader who was not searching at all.
 *
 * The matching itself is `src/lib/on-call/entry-search.ts`; nothing in here
 * decides what a match is.
 */

/** Row shape shared by the dialable and the non-dialable case. */
function SearchResultRow({ result }: { result: OnCallSearchResult }) {
  const { entry } = result;
  // The same private treatment Contacts and the home use: a personal number is
  // withheld from the screen, not from the owner — they can still open the
  // entry to read it. See `on-call-home.tsx`, the Recent module, which sets
  // `number` to null on `entry.isPersonal` for exactly this reason. A search
  // box is the MOST over-shoulder-readable surface in the mode, so this is not
  // a nicety here.
  const number = entry.isPersonal ? null : onCallPrimaryNumber(entry);
  const telHref = onCallTelHref(number?.value);
  const summary = onCallSearchSummary(entry);

  return (
    <OnCallEntryRow
      title={entry.title}
      subtitle={summary ?? undefined}
      href={telHref ?? ON_CALL_SECTION_HREFS[entry.section]}
      testId={`on-call-search-row-${entry.slug}`}
      trailing={
        telHref && number ? (
          <span className="flex items-center gap-2">
            <span className="nums text-sm font-bold text-[color:var(--text-heading)]">{number.value}</span>
            {/* Decoration inside the link, never a control: the whole row
                already dials, and a button here would be a second target for
                one action. */}
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--command)] text-[color:var(--command-contrast)]"
            >
              <Phone aria-hidden="true" className="size-icon-sm" />
            </span>
          </span>
        ) : (
          <ChevronRight aria-hidden="true" className={cn("size-icon-sm shrink-0", textMuted)} />
        )
      }
    >
      {entry.isPersonal ? <OnCallPrivateFlag compact /> : null}
    </OnCallEntryRow>
  );
}

/** Results for one section, under that section's own name and glyph. */
function SearchResultGroup({ section, results }: { section: OnCallSection; results: readonly OnCallSearchResult[] }) {
  const Icon = ON_CALL_SECTION_ICONS[section];
  return (
    <section
      aria-label={ON_CALL_SECTION_TITLES[section]}
      data-testid={`on-call-search-group-${section}`}
      className="grid grid-cols-[minmax(0,1fr)] gap-2"
    >
      <h3 className={cn(eyebrowText, "flex items-center gap-1.5")}>
        <Icon aria-hidden="true" className="size-icon-xs" />
        {ON_CALL_SECTION_TITLES[section]}
      </h3>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {results.map((result) => (
          <SearchResultRow key={result.entry.id} result={result} />
        ))}
      </div>
    </section>
  );
}

/** Group in result order, so the best-matching section leads. */
function groupBySection(results: readonly OnCallSearchResult[]): Array<[OnCallSection, OnCallSearchResult[]]> {
  const groups = new Map<OnCallSection, OnCallSearchResult[]>();
  for (const result of results) {
    const existing = groups.get(result.section);
    if (existing) existing.push(result);
    else groups.set(result.section, [result]);
  }
  return [...groups.entries()];
}

export function OnCallSearchBox({ entries }: { entries: readonly OnCallEntry[] }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useMemo(() => searchOnCallEntries(entries, query), [entries, query]);
  const groups = useMemo(() => groupBySection(results), [results]);

  // The count goes to assistive technology only. Putting `aria-live` on the
  // visible list would re-read every row on every keystroke, which is the
  // opposite of useful; a short sentence off-screen says the one thing a
  // sighted reader can already see at a glance.
  const announcement =
    trimmed.length === 0
      ? ""
      : results.length === 0
        ? `Nothing matched “${trimmed}”.`
        : `${results.length} result${results.length === 1 ? "" : "s"} for “${trimmed}”.`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="on-call-search">
      <SearchField
        label="Search On Call"
        placeholder="Search numbers, wards, scenarios"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery("")}
        clearLabel="Clear the On Call search"
        autoComplete="off"
      />

      <p role="status" aria-live="polite" data-testid="on-call-search-status" className="sr-only">
        {announcement}
      </p>

      {trimmed.length > 0 && results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`Nothing matched “${trimmed}”`}
          body="Try a shorter word, a ward name, or part of the number."
          testId="on-call-search-empty"
          // Announced above already; a second live region would say it twice.
          live="off"
        />
      ) : null}

      {results.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="on-call-search-results">
          {groups.map(([section, sectionResults]) => (
            <SearchResultGroup key={section} section={section} results={sectionResults} />
          ))}
          {/* Honest about the cap rather than quietly showing a partial list as
              though it were the whole answer. */}
          {results.length === ON_CALL_SEARCH_RESULT_LIMIT ? (
            <p className={cn(textMuted, "text-xs")} data-testid="on-call-search-capped">
              Showing the first {ON_CALL_SEARCH_RESULT_LIMIT} matches. Add a word to narrow them.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
