"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, ExternalLink, ShieldCheck, Workflow } from "lucide-react";
import { useCallback, useDeferredValue, useId, useMemo, useState } from "react";

import { appModeHomeHref } from "@/lib/app-modes";
import { formCatalogDetails, rankFormRecords, type FormSearchMatch } from "@/lib/form-ranker";
import {
  deriveFormCategories,
  filterFormMatches,
  formAvailabilityFilterLabels,
  formAvailabilityFilterValues,
  formFilterCandidateCount,
  formFilterSelectionFromParams,
  formFilterSelectionSize,
  formMatchRisk,
  formRiskFilterLabels,
  formRiskFilterValues,
  writeFormFilterSelection,
  type FormFilterSelection,
  type FormRiskFilter,
} from "@/lib/form-filters";
import { useRegistryRecords } from "@/lib/use-registry-records";
import {
  cn,
  codeText,
  eyebrowText,
  ignoreUnavailableActivation,
  pageContainer,
  panelSubtle,
  searchFocusRing,
  searchPageCanvas,
  searchResultsSection,
} from "@/components/ui-primitives";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { FormCodeBadge } from "@/components/forms/form-code-badge";
import { sortResultItems, type ResultSortValue } from "@/lib/result-sort";
import { replaceResultFilterUrl } from "@/lib/result-filter-url";
import { useResultSort } from "@/components/use-result-sort";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";

type FormsSearchResultsPageProps = {
  query: string;
};

const supportsPathwayClaims = false;

function resultCode(match: FormSearchMatch, index: number) {
  return formCatalogDetails(match.service)?.form ?? String(index + 1);
}

function tagToneClass(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("crisis") || normalized.includes("risk") || normalized.includes("safety")) {
    return "bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  }
  if (normalized.includes("transport") || normalized.includes("transfer") || normalized.includes("handover")) {
    return "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
  }
  if (normalized.includes("legal") || normalized.includes("detention") || normalized.includes("capacity")) {
    return "bg-[color:var(--info-soft)] text-[color:var(--info)]";
  }
  return "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
}

function compactMatchReason(match: FormSearchMatch, query: string) {
  const trimmedQuery = query.trim();
  if (match.reasons.includes("title")) {
    return trimmedQuery ? `Title or content match for "${trimmedQuery}"` : "Title or content match";
  }
  if (match.reasons.includes("record fields")) return "Content match in record details";
  return "Content match in the forms catalogue";
}

// Risk is the only badge a phone result card carries, so it must never out-rank
// itself: high is solid danger, medium is a bordered wash, low stays neutral.
const riskBadgeToneClass: Record<FormRiskFilter, string> = {
  high: "bg-[color:var(--danger-solid)] text-[color:var(--danger-solid-contrast)]",
  medium: "border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  low: "border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

// The catalogue generates a `purpose` for every form, but most are boilerplate
// that only restates the title ("Official form source: Transfer Order. Review
// the source snippets and approved form before use."). Rendering one of those
// under every card is the same non-information as the old "Content match in
// record details" line, just longer — so only show a purpose that says
// something the title does not. See fallbackDetails() in form-catalog.ts.
const generatedPurposePatterns = [
  /^official form source:/i,
  /^the official register lists this form/i,
  /^use the current approved form .+ to record /i,
];

function editorialPurpose(record: FormSearchMatch["service"]): string {
  const purpose = record.subtitle?.trim() ?? "";
  if (!purpose) return "";
  return generatedPurposePatterns.some((pattern) => pattern.test(purpose)) ? "" : purpose;
}

const uncategorisedFormsLabel = "Other forms";

type CodedFormMatch = { match: FormSearchMatch; code: string };
type FormResultGroup = { category: string; items: CodedFormMatch[] };

/**
 * Group phone results under their statutory category so the category is stated
 * once per group instead of repeated as a chip on every card.
 *
 * Items arrive already sorted (relevance or A–Z), and groups are emitted in
 * order of first appearance — so the active sort still decides which group leads
 * and the top-ranked form stays in the top group.
 */
function groupMatchesByCategory(items: CodedFormMatch[]): FormResultGroup[] {
  const groups: FormResultGroup[] = [];
  const byCategory = new Map<string, FormResultGroup>();
  for (const item of items) {
    const category = formCatalogDetails(item.match.service)?.category?.trim() || uncategorisedFormsLabel;
    let group = byCategory.get(category);
    if (!group) {
      group = { category, items: [] };
      byCategory.set(category, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * "1A", "form 1a", "1A attachment" — a clinician who types a form code is naming
 * one specific form, not running a text search. Normalise the same way
 * form-catalog's own normalizeCode does (lowercase, collapse whitespace) and
 * additionally drop a leading "form " so the typed prefix still resolves.
 */
function normalizeFormCodeQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^form /, "");
}

function findExactFormCodeMatch(items: CodedFormMatch[], query: string): CodedFormMatch | null {
  const normalizedQuery = normalizeFormCodeQuery(query);
  if (!normalizedQuery) return null;
  return (
    items.find((item) => {
      const code = formCatalogDetails(item.match.service)?.form;
      return code ? normalizeFormCodeQuery(code) === normalizedQuery : false;
    }) ?? null
  );
}

const resultsGridColumns = "md:grid-cols-[72px_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(88px,auto)]";

function ResultsTable({
  matches,
  query,
  sortValue,
}: {
  matches: FormSearchMatch[];
  query: string;
  sortValue: ResultSortValue;
}) {
  return (
    <section
      data-testid="form-search-results"
      aria-label="Form record matches"
      className={cn("overflow-hidden", searchResultsSection)}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-5 pb-3">
        <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">Best matches</h2>
        <span className="text-sm font-semibold text-[color:var(--text-muted)]">
          {matches.length} {matches.length === 1 ? "form" : "forms"} ·{" "}
          {sortValue === "alpha" ? "sorted A–Z" : "ranked by relevance"}
        </span>
      </div>
      <div
        className={cn(
          "grid gap-4 border-b border-[color:var(--border)] px-5 py-3 text-2xs font-bold uppercase tracking-wide text-[color:var(--text-muted)]",
          resultsGridColumns,
        )}
      >
        <span>Form</span>
        <span>Title</span>
        <span>Tags</span>
        <span>Matched because</span>
        <span className="text-right">Open</span>
      </div>
      <div>
        {matches.map((match, index) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-result-${form.slug}`}
              className={cn(
                "group relative grid gap-4 border-b border-[color:var(--border)] px-5 py-4 transition-colors last:border-b-0 hover:bg-[color:var(--surface-subtle)]/60 md:items-center",
                "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-[color:var(--clinical-accent)] before:opacity-0 before:transition-opacity before:content-[''] hover:before:opacity-100",
                resultsGridColumns,
              )}
            >
              <FormCodeBadge code={resultCode(match, index)} />
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold leading-snug text-[color:var(--text-heading)]">{form.title}</h3>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {(form.statusChips ?? []).slice(0, 2).map((chip, chipIndex) => {
                  const chipLabel = chip.label?.trim() || "Form";
                  return (
                    <span
                      key={`${chipLabel}-${chipIndex}`}
                      className={cn(
                        "rounded-full px-2 py-1 text-2xs font-extrabold uppercase",
                        tagToneClass(chipLabel),
                      )}
                    >
                      {chipLabel}
                    </span>
                  );
                })}
              </div>
              <p className="min-w-0 text-sm font-medium leading-relaxed text-[color:var(--text-muted)]">
                {compactMatchReason(match, query)}
              </p>
              <Link
                href={`/forms/${form.slug}`}
                aria-label={`Open ${form.title}`}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] group-hover:border-[color:var(--clinical-accent-border)] group-hover:bg-[color:var(--clinical-accent-soft)] md:justify-self-end",
                  searchFocusRing,
                )}
              >
                Open
                <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </article>
          );
        })}
      </div>
      <div className="flex justify-center border-t border-[color:var(--border)] p-4">
        <Link
          href={appModeHomeHref("forms", { query, focus: true, run: true })}
          className={cn(
            "inline-flex min-h-tap items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
            searchFocusRing,
          )}
        >
          View all forms ({matches.length})
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function PathwayPanel() {
  return (
    <section className={cn(searchResultsSection, "p-5")}>
      <h2 className="text-lg font-extrabold text-[color:var(--text-heading)]">
        Related pathway{" "}
        <span className="ml-2 text-sm font-medium text-[color:var(--text-muted)]">( PSOLIS Transport Pathway )</span>
      </h2>
      <div className="mt-5 grid grid-cols-[1fr_24px_1fr_24px_1.4fr_24px_1fr] items-center gap-3">
        <PathwayNode label="Before" code="1A" title="Referral for examination" />
        <ChevronRight aria-hidden="true" className="h-5 w-5 text-[color:var(--text-muted)]" />
        <PathwayNode label="Current" code="4A" title="Transport order" active />
        <ChevronRight aria-hidden="true" className="h-5 w-5 text-[color:var(--text-muted)]" />
        <PathwayNode
          label="Parallel"
          code="3A"
          title="Detention to enable examination"
          secondaryCode="4B"
          secondaryTitle="Extension of Transport Order"
        />
        <ChevronRight aria-hidden="true" className="h-5 w-5 text-[color:var(--text-muted)]" />
        <PathwayNode label="After" code="" title="Examination at destination" />
      </div>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          aria-disabled="true"
          onClick={ignoreUnavailableActivation}
          title="Coming soon"
          className={cn(
            "inline-flex min-h-tap cursor-not-allowed items-center gap-3 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] opacity-70",
            searchFocusRing,
          )}
        >
          <Workflow aria-hidden="true" className="h-5 w-5" />
          View full pathway
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function PathwayNode({
  label,
  code,
  title,
  active,
  secondaryCode,
  secondaryTitle,
}: {
  label: string;
  code: string;
  title: string;
  active?: boolean;
  secondaryCode?: string;
  secondaryTitle?: string;
}) {
  return (
    <div>
      <p className="mb-3 text-2xs font-bold uppercase text-[color:var(--text-muted)]">{label}</p>
      <div
        className={cn(
          "min-h-[112px] rounded-lg border p-4",
          active
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
            : "border-[color:var(--border)] bg-[color:var(--surface)]",
        )}
      >
        {code ? (
          <p className={cn("text-2xl font-extrabold text-[color:var(--clinical-accent)]", codeText)}>{code}</p>
        ) : null}
        <p className="mt-2 text-sm font-extrabold leading-snug text-[color:var(--text-heading)]">{title}</p>
        {active ? (
          <span className="mt-3 inline-flex rounded-full bg-[color:var(--clinical-accent-soft)] px-3 py-1 text-2xs font-extrabold text-[color:var(--clinical-accent)]">
            You are here
          </span>
        ) : null}
        {secondaryCode && secondaryTitle ? (
          <div className="mt-3 grid gap-2 text-sm">
            <p>
              <span className="mr-2 text-xl font-extrabold text-[color:var(--clinical-accent)]">{secondaryCode}</span>
              <span className="text-xs font-medium text-[color:var(--text-muted)]">{secondaryTitle}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VerifiedFooter() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-5 text-xs text-[color:var(--text-muted)] lg:py-6 lg:text-sm">
      <span className="inline-flex items-center gap-2 font-extrabold text-[color:var(--clinical-accent)]">
        <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        Source verified
      </span>
      <span>·</span>
      <span>Official source</span>
      <span>·</span>
      <span>Aligned to MHA 2014</span>
    </div>
  );
}

const metaChipClass = "rounded-md px-2 py-1 text-3xs font-extrabold uppercase leading-none";

/**
 * When the query IS a form code there is one answer, not N ranked candidates.
 * Lead with that form, its purpose and its open action; everything else drops
 * to "Also references <code>" below.
 */
function MobileExactMatchHero({ match, code }: CodedFormMatch) {
  const form = match.service;
  const details = formCatalogDetails(form);
  const risk = formMatchRisk(match);
  const purpose = editorialPurpose(form);
  // Derive availability label from the actual availability field rather than
  // positional statusChips indexing to avoid fragility.
  const availabilityLabel = details?.availability
    ? details.availability === "downloadable"
      ? "Official PDF"
      : details.availability === "unavailable"
        ? "Currently unavailable"
        : "Contact OCP"
    : undefined;
  return (
    <section
      aria-label="Exact form code match"
      data-testid="form-search-mobile-exact-match"
      className="overflow-hidden rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] shadow-[var(--e1)] forced-colors:border"
    >
      <p
        className={cn(
          "flex items-center gap-1.5 border-b border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2",
          "text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]",
        )}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Exact form code match
      </p>
      <div className="flex gap-3 p-3">
        <FormCodeBadge code={code} variant="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base-minus font-extrabold leading-snug text-[color:var(--text-heading)]">{form.title}</h3>
          {purpose ? (
            <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{purpose}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {risk ? (
              <span className={cn(metaChipClass, riskBadgeToneClass[risk])}>
                {risk}
                <span className="sr-only"> risk</span>
              </span>
            ) : null}
            {details?.category ? (
              <span className={cn(metaChipClass, "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]")}>
                {details.category}
              </span>
            ) : null}
            {availabilityLabel ? (
              <span className={cn(metaChipClass, "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]")}>
                {availabilityLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <Link
          href={`/forms/${form.slug}`}
          className={cn(
            "flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-4",
            "text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)] transition",
            "hover:bg-[color:var(--clinical-accent-hover)] forced-colors:border",
            searchFocusRing,
          )}
        >
          Open Form {code}
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function MobileResultCard({ match, code }: CodedFormMatch) {
  const form = match.service;
  const risk = formMatchRisk(match);
  // `subtitle` is the catalogue's `purpose` — what the form is actually for.
  // It replaces the old "Content match in record details" line, which said the
  // same thing on every card. Boilerplate purposes are dropped entirely rather
  // than swapped for different filler.
  const purpose = editorialPurpose(form);
  return (
    <Link
      href={`/forms/${form.slug}`}
      data-testid={`form-search-mobile-result-${form.slug}`}
      className={cn(
        // The whole card is the target, so no per-card Open button.
        "flex items-center gap-3 p-3 transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)]",
        panelSubtle,
        searchFocusRing,
      )}
    >
      <FormCodeBadge code={code} variant="sm" />
      <span className="min-w-0 flex-1">
        <h4 className="text-sm-minus font-extrabold leading-snug text-[color:var(--text-heading)]">{form.title}</h4>
        {/* No `block` on the clamp below: it would override the
            `display: -webkit-box` that line-clamp needs, and the purpose would
            then render at full length. */}
        {purpose ? (
          <span className="mt-0.5 line-clamp-2 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">
            {purpose}
          </span>
        ) : null}
      </span>
      {risk ? (
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-3xs font-extrabold uppercase leading-none",
            riskBadgeToneClass[risk],
          )}
        >
          {risk}
          {/* Visually the level alone is enough beside the risk colour; assistive
              tech still gets the full "high risk" phrasing. */}
          <span className="sr-only"> risk</span>
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
    </Link>
  );
}

function MobileCards({ matches, query }: { matches: FormSearchMatch[]; query: string }) {
  const coded = matches.map((match, index) => ({ match, code: resultCode(match, index) }));
  const exactMatch = findExactFormCodeMatch(coded, query);
  const remaining = exactMatch ? coded.filter((item) => item !== exactMatch) : coded;
  const groups = groupMatchesByCategory(remaining);
  return (
    // Cards sit directly on the page canvas: no enclosing results panel, so a
    // bordered card is never nested inside another bordered surface.
    <section data-testid="form-search-mobile-results" aria-label="Form record matches" className="grid gap-3">
      {exactMatch ? <MobileExactMatchHero match={exactMatch.match} code={exactMatch.code} /> : null}
      {remaining.length > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">
              {exactMatch ? `Also references ${exactMatch.code}` : "Best matches"}
            </h2>
            <span className="text-xs font-bold text-[color:var(--text-muted)]">
              {remaining.length} {remaining.length === 1 ? "form" : "forms"}
            </span>
          </div>
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category} className="grid gap-2">
              <div className="flex items-center gap-2 px-1">
                <h3 className={eyebrowText}>{group.category}</h3>
                <span aria-hidden className="h-px flex-1 bg-[color:var(--border)]" />
                <span className="text-2xs font-bold text-[color:var(--text-muted)]">{group.items.length}</span>
              </div>
              {group.items.map((item) => (
                <MobileResultCard key={item.match.service.slug} match={item.match} code={item.code} />
              ))}
            </section>
          ))}
        </>
      ) : null}
      <Link
        href={appModeHomeHref("forms", { query, focus: true, run: true })}
        className={cn(
          "mx-auto flex min-h-tap w-fit items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
          searchFocusRing,
        )}
      >
        View all forms ({matches.length})
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function MobilePathway() {
  return (
    <section className={cn(searchResultsSection, "p-3")}>
      <h2 className="text-sm-minus font-extrabold text-[color:var(--text-heading)]">
        Related pathway <span className="font-medium text-[color:var(--text-muted)]">( PSOLIS Transport )</span>
      </h2>
      <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
        {[
          ["1A", "Referral"],
          ["4A", "Transport order"],
          ["3A/4B", "Parallel"],
          ["", "Destination Examination"],
        ].map(([code, label], index) => (
          <div key={`${code}-${label}`} className="flex items-center gap-1">
            <div
              className={cn(
                "min-w-[64px] rounded-md border p-1.5 text-center",
                index === 1
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)]",
              )}
            >
              {code ? (
                <p className={cn("text-sm font-extrabold leading-none text-[color:var(--clinical-accent)]", codeText)}>
                  {code}
                </p>
              ) : null}
              <p className="mt-0.5 text-2xs font-bold leading-4 text-[color:var(--text-muted)]">{label}</p>
              {index === 1 ? (
                <p className="mt-0.5 rounded-full bg-[color:var(--clinical-accent-soft)] px-1 py-0.5 text-2xs font-extrabold leading-4 text-[color:var(--clinical-accent)]">
                  You are here
                </p>
              ) : null}
            </div>
            {index < 3 ? (
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" />
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-disabled="true"
        onClick={ignoreUnavailableActivation}
        title="Coming soon"
        className={cn(
          "mx-auto mt-1 flex min-h-tap cursor-not-allowed items-center gap-2 rounded-md px-2 text-sm-minus font-extrabold text-[color:var(--clinical-accent)] opacity-70",
          searchFocusRing,
        )}
      >
        <Workflow aria-hidden="true" className="h-4 w-4" />
        View full pathway
      </button>
    </section>
  );
}

export function FormsSearchResultsPage(props: FormsSearchResultsPageProps) {
  // No key={query} remount: query is a pure prop (favourites already documents this).
  return <FormsSearchResultsPageContent {...props} />;
}

function FormsSearchResultsPageContent({ query }: FormsSearchResultsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortValue, setSortValue] = useResultSort();
  const registry = useRegistryRecords("form");
  const registryReady = registry.status === "ready" || registry.status === "refetching";
  const [filterOpen, setFilterOpen] = useState(false);
  const filterPanelId = useId();
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(() => {
    if (!registryReady) return [];
    // Cleared query: no form matches (page usually remounts, but keep lag-safe).
    if (!query.trim()) return [];
    // Deferred empty while live has text: wait — do not rank as empty-query "all forms".
    if (!deferredQuery.trim()) return [];
    return rankFormRecords(registry.records, deferredQuery, registry.records.length, [], true);
  }, [registryReady, registry.records, deferredQuery, query]);
  const categoryOptions = useMemo(() => deriveFormCategories(matches), [matches]);
  const filterSelection = useMemo(
    () => formFilterSelectionFromParams(searchParams, categoryOptions),
    [categoryOptions, searchParams],
  );
  const filteredMatches = useMemo(() => filterFormMatches(matches, filterSelection), [filterSelection, matches]);
  const displayedMatches = useMemo(
    () => sortResultItems(filteredMatches, sortValue, (match) => match.service.title),
    [filteredMatches, sortValue],
  );
  const activeFilterCount = formFilterSelectionSize(filterSelection);

  const updateFilterSelection = useCallback((next: FormFilterSelection) => {
    replaceResultFilterUrl((params) => writeFormFilterSelection(params, next));
  }, []);

  const toggleFilter = useCallback(
    (dimension: keyof FormFilterSelection, value: string) => {
      replaceResultFilterUrl((params) => {
        const current = formFilterSelectionFromParams(params, categoryOptions);
        const nextValues = new Set(current[dimension] as ReadonlySet<string>);
        if (!nextValues.delete(value)) nextValues.add(value);
        writeFormFilterSelection(params, { ...current, [dimension]: nextValues });
      });
    },
    [categoryOptions],
  );

  const clearFilters = useCallback(() => {
    updateFilterSelection({ categories: new Set(), risks: new Set(), availability: new Set() });
  }, [updateFilterSelection]);

  const filterGroups = useMemo(
    () => [
      resultFilterFacetGroup({
        id: "category",
        label: "Category",
        description: "Statutory and clinical form families.",
        selected: filterSelection.categories,
        options: categoryOptions.map((category) => {
          const count = formFilterCandidateCount(matches, filterSelection, "categories", category);
          return {
            value: category,
            label: category,
            hint: String(count),
            disabled: count === 0 && !filterSelection.categories.has(category),
          };
        }),
        onToggle: (value) => toggleFilter("categories", value),
      }),
      resultFilterFacetGroup({
        id: "risk",
        label: "Clinical risk",
        description: "Risk classification recorded in the form catalogue.",
        selected: filterSelection.risks,
        options: formRiskFilterValues.map((risk) => {
          const count = formFilterCandidateCount(matches, filterSelection, "risks", risk);
          return {
            value: risk,
            label: formRiskFilterLabels[risk],
            hint: String(count),
            disabled: count === 0 && !filterSelection.risks.has(risk),
          };
        }),
        onToggle: (value) => toggleFilter("risks", value),
      }),
      resultFilterFacetGroup({
        id: "availability",
        label: "Availability",
        description: "How the catalogue record can be obtained.",
        selected: filterSelection.availability,
        options: formAvailabilityFilterValues.map((availability) => {
          const count = formFilterCandidateCount(matches, filterSelection, "availability", availability);
          return {
            value: availability,
            label: formAvailabilityFilterLabels[availability],
            hint: String(count),
            disabled: count === 0 && !filterSelection.availability.has(availability),
          };
        }),
        onToggle: (value) => toggleFilter("availability", value),
      }),
    ],
    [categoryOptions, filterSelection, matches, toggleFilter],
  );

  const appliedFilters = useMemo<AppliedFilterChip[]>(
    () => [
      ...[...filterSelection.categories].map((category) => ({
        id: `category-${category}`,
        groupLabel: "Category",
        valueLabel: category,
        onRemove: () => toggleFilter("categories", category),
      })),
      ...[...filterSelection.risks].map((risk) => ({
        id: `risk-${risk}`,
        groupLabel: "Risk",
        valueLabel: formRiskFilterLabels[risk],
        onRemove: () => toggleFilter("risks", risk),
      })),
      ...[...filterSelection.availability].map((availability) => ({
        id: `availability-${availability}`,
        groupLabel: "Availability",
        valueLabel: formAvailabilityFilterLabels[availability],
        onRemove: () => toggleFilter("availability", availability),
      })),
    ],
    [filterSelection, toggleFilter],
  );

  const renderFilterTrigger = (testId: string) => (
    <ResultFilterTrigger
      panelId={filterPanelId}
      testId={testId}
      title="Filter form results"
      open={filterOpen}
      activeCount={activeFilterCount}
      onToggle={() => setFilterOpen((current) => !current)}
    />
  );

  return (
    <div className={cn("overflow-x-hidden", searchPageCanvas)}>
      <main className={cn(pageContainer, "grid gap-3 px-4 pt-3 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-6")}>
        {/* The band is mounted in every registry state, not only when ready. It
            previously unmounted on failure, which left the page with no header at
            all and pushed the whole burden of reporting onto a separate notice. */}
        <SearchResultsHeaderBand
          modeId="forms"
          query={query}
          matchCount={displayedMatches.length}
          status={
            registry.status === "unauthorized"
              ? "unauthorized"
              : registry.status === "ready"
                ? "ready"
                : registry.status === "refetching"
                  ? "refetching"
                  : registry.status === "loading"
                    ? "loading"
                    : "error"
          }
          faultTitle={registry.status === "unauthorized" ? "Session expired" : "Could not load forms"}
          faultBody={
            registry.status === "unauthorized"
              ? "Your session expired. Sign in again to search your private forms registry."
              : "Couldn’t load the forms registry. Try again shortly."
          }
          onRetry={registry.status === "unauthorized" ? undefined : registry.refetch}
          faultAction={
            registry.status === "unauthorized" ? (
              <Link
                href="/"
                className="inline-flex min-h-tap items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
              >
                Open account setup
              </Link>
            ) : undefined
          }
          sortValue={sortValue}
          onSortChange={setSortValue}
          appliedFilters={appliedFilters}
          onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
          filterLabel="Filter form results"
          mobileControlsPlacement="inline"
          mobileControls={renderFilterTrigger("form-filter-trigger-phone")}
          filterControls={renderFilterTrigger("form-filter-trigger-wide")}
        />
        <ResultFilterSheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          panelId={filterPanelId}
          testId="form-filter-panel"
          title="Filter form results"
          description="Narrow by form family, recorded clinical risk, and access route."
          groups={filterGroups}
          onClearAll={activeFilterCount > 0 ? clearFilters : undefined}
          summary={{ count: displayedMatches.length, noun: displayedMatches.length === 1 ? "form" : "forms" }}
          chromeResetKey={query}
        />
        {registryReady ? (
          <>
            {query.trim() && deferredQuery === query && displayedMatches.length === 0 ? (
              <SearchResultsEmptyState
                modeId="forms"
                query={query}
                appliedFilters={appliedFilters}
                onClearFilters={activeFilterCount > 0 ? clearFilters : undefined}
                onTryExample={(example) =>
                  router.push(appModeHomeHref("forms", { query: example, focus: true, run: true }))
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <ResultsTable matches={displayedMatches} query={query} sortValue={sortValue} />
                </div>
                <div className="md:hidden">
                  <MobileCards matches={displayedMatches} query={query} />
                </div>
              </>
            )}
            <UniversalSearchAlsoMatches modeId="forms" query={query} />
          </>
        ) : null}
        <div className="hidden lg:block">{supportsPathwayClaims ? <PathwayPanel /> : null}</div>
        <div className="lg:hidden">{supportsPathwayClaims ? <MobilePathway /> : null}</div>
        {registryReady && supportsPathwayClaims ? <VerifiedFooter /> : null}
      </main>
    </div>
  );
}
