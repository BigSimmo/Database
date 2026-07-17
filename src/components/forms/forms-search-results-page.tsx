"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Loader2, Shield, ShieldAlert } from "lucide-react";
import { useMemo } from "react";

import { appModeHomeHref } from "@/lib/app-modes";
import { formCatalogDetails } from "@/lib/form-catalog";
import { rankFormRecords, type FormSearchMatch } from "@/lib/forms";
import type { ServiceChipTone } from "@/lib/services";
import { useRegistryRecords, type RegistryRequestStatus } from "@/lib/use-registry-records";
import {
  cn,
  pageContainer,
  searchFocusRing,
  searchPageCanvas,
  searchResultsSection,
  toneDanger,
  toneInfo,
  toneNeutral,
  toneSuccess,
  toneWarning,
} from "@/components/ui-primitives";
import {
  ResultSortControl,
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { recordMatchesCommandScopes } from "@/lib/search-command-surface";
import { sortResultItems, type ResultSortValue } from "@/lib/result-sort";
import { useResultSort } from "@/components/use-result-sort";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";

type FormsSearchResultsPageProps = {
  query: string;
};

const sourceSnippetCount = 278;
const taskCount = 8;
const pathwayCount = 12;

const refineFilters: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  enabled: boolean;
  danger?: boolean;
}[] = [
  { icon: Shield, title: "High risk only", subtitle: "Show high risk forms", enabled: false, danger: true },
  { icon: FileText, title: "Official forms", subtitle: "Limit to official forms", enabled: true },
  { icon: Workflow, title: "Pathway linked", subtitle: "Show pathway-linked", enabled: true },
  { icon: Search, title: "Source matches", subtitle: "Require source match", enabled: false },
];

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
    return trimmedQuery ? `Title or identifier match for "${trimmedQuery}"` : "Title or identifier match";
  }
  if (match.reasons.includes("record fields")) return "Match in form record details";
  return "Content match in the forms catalogue";
}

const resultsGridColumns = "md:grid-cols-[64px_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(88px,auto)]";

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
        <span>Status</span>
        <span>Matched because</span>
        <span className="text-right">Open</span>
      </div>
      <div>
        {matches.map((match) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-result-${form.slug}`}
              className={cn(
                "grid gap-4 border-b border-[color:var(--border)] px-5 py-4 transition last:border-b-0 hover:bg-[color:var(--surface-subtle)]/55 md:items-center",
                resultsGridColumns,
              )}
            >
              <div className="grid h-12 w-14 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <FileText className="h-5 w-5" aria-hidden />
              </div>
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
                        statusToneClass(chip.tone),
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
                  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] md:justify-self-end",
                  searchFocusRing,
                )}
              >
                Open
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          );
        })}
      </div>
      <div className="flex justify-center border-t border-[color:var(--border)] p-4">
        <Link
          href="/forms"
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
            searchFocusRing,
          )}
        >
          Browse all forms
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function MobileCards({ matches, query }: { matches: FormSearchMatch[]; query: string }) {
  return (
    <section data-testid="form-search-mobile-results" className={cn(searchResultsSection, "p-3")}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Best matches</h2>
        <span className="text-xs font-bold text-[color:var(--text-muted)]">
          {matches.length} {matches.length === 1 ? "form" : "forms"}
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        {matches.map((match) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-mobile-result-${form.slug}`}
              className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 shadow-[var(--shadow-tight)]"
            >
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <FileText className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm-minus font-extrabold leading-snug text-[color:var(--text-heading)]">
                    {form.title}
                  </h3>
                  <Link
                    href={`/forms/${form.slug}`}
                    aria-label={`Open ${form.title}`}
                    className={cn(
                      "inline-flex min-h-tap shrink-0 items-center gap-1 rounded-md border border-[color:var(--border)] px-2.5 text-2xs font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
                      searchFocusRing,
                    )}
                  >
                    Open
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(form.statusChips ?? []).slice(0, 2).map((chip, chipIndex) => {
                    const chipLabel = chip.label?.trim() || "Form";
                    return (
                      <span
                        key={`${chipLabel}-${chipIndex}`}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-2xs font-extrabold uppercase leading-none",
                          statusToneClass(chip.tone),
                        )}
                      >
                        {chipLabel}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs font-medium leading-snug text-[color:var(--text-muted)]">
                  {compactMatchReason(match, query)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <Link
        href="/forms"
        className={cn(
          "mx-auto mt-2 flex min-h-tap w-fit items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
          searchFocusRing,
        )}
      >
        Browse all forms
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function RegistryStatusNotice({ status }: { status: RegistryRequestStatus }) {
  if (status === "ready") return null;
  const notice =
    status === "loading"
      ? { icon: Loader2, spin: true, tone: "info", text: "Loading your forms registry..." }
      : status === "unauthorized"
        ? {
            icon: Shield,
            spin: false,
            tone: "warning",
            text: "Your session expired. Use the account control in the header to sign in again.",
          }
        : {
            icon: ShieldAlert,
            spin: false,
            tone: "danger",
            text: "Couldn't load the forms registry. Try again shortly.",
          };
  const Icon = notice.icon;
  const toneClass =
    notice.tone === "danger"
      ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/50 text-[color:var(--danger)]"
      : notice.tone === "warning"
        ? "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 text-[color:var(--warning)]"
        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]";
  return (
    <div
      data-testid="forms-registry-status-notice"
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${toneClass}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${notice.spin ? "animate-spin" : ""}`} aria-hidden />
      <span className="min-w-0 flex-1">{notice.text}</span>
    </div>
  );
}

export function FormsSearchResultsPage(props: FormsSearchResultsPageProps) {
  return <FormsSearchResultsPageContent key={props.query} {...props} />;
}

function FormsSearchResultsPageContent({ query }: FormsSearchResultsPageProps) {
  const router = useRouter();
  const [sortValue, setSortValue] = useResultSort();
  const command = useSearchCommand();
  const registry = useRegistryRecords("form");
  const registryReady = registry.status === "ready";
  const matches = useMemo(
    () => (registryReady ? rankFormRecords(registry.records, query) : []),
    [registryReady, registry.records, query],
  );
  const scopedMatches = useMemo(() => {
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return matches;
    return matches.filter((match) => recordMatchesCommandScopes(match.service, scopes, "forms"));
  }, [command?.commandScopes, matches]);
  const displayedMatches = useMemo(
    () => sortResultItems(scopedMatches, sortValue, (match) => match.service.title),
    [scopedMatches, sortValue],
  );

  return (
    <div className={cn("overflow-x-hidden", searchPageCanvas)}>
      <main className={cn(pageContainer, "grid gap-3 px-4 pt-3 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-6")}>
        <RegistryStatusNotice status={registry.status} />
        {registryReady ? (
          <>
            <div className="hidden md:block">
              <SearchResultsHeaderBand
                modeId="forms"
                query={query}
                matchCount={displayedMatches.length}
                sortValue={sortValue}
                onSortChange={setSortValue}
              />
            </div>
            <UniversalSearchAlsoMatches modeId="forms" query={query} />
            {query.trim() && displayedMatches.length === 0 ? (
              <SearchResultsEmptyState
                modeId="forms"
                query={query}
                onClearScopes={command?.onClearScopes}
                onTryExample={(example) =>
                  router.push(appModeHomeHref("forms", { query: example, focus: true, run: true }))
                }
              />
            ) : (
              <>
                <div className="flex justify-end md:hidden">
                  <ResultSortControl value={sortValue} onChange={setSortValue} />
                </div>
                <div className="hidden md:block">
                  <ResultsTable matches={displayedMatches} query={query} sortValue={sortValue} />
                </div>
                <div className="md:hidden">
                  <MobileCards matches={displayedMatches} query={query} />
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
