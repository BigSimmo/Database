"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useState, useDeferredValue } from "react";

import { appModeHomeHref } from "@/lib/app-modes";
import { formCatalogDetails, rankFormRecords, type FormSearchMatch } from "@/lib/form-ranker";
import { useRegistryRecords, type RegistryRequestStatus } from "@/lib/use-registry-records";
import {
  cn,
  codeText,
  pageContainer,
  searchFocusRing,
  searchPageCanvas,
  searchResultsSection,
  ToggleSwitch,
} from "@/components/ui-primitives";
import {
  ResultSortControl,
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { FormCodeBadge } from "@/components/forms/form-code-badge";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { recordMatchesCommandScopes } from "@/lib/search-command-surface";
import { sortResultItems, type ResultSortValue } from "@/lib/result-sort";
import { useResultSort } from "@/components/use-result-sort";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";

type FormsSearchResultsPageProps = {
  query: string;
};

const supportsPathwayClaims = false;

const refineFilters: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  enabled: boolean;
  danger?: boolean;
}[] = [
  { icon: Shield, title: "High risk only", subtitle: "Show high risk forms", enabled: false, danger: true },
  { icon: FileText, title: "Official forms", subtitle: "Limit to official forms", enabled: true },
  ...(supportsPathwayClaims
    ? [{ icon: Workflow, title: "Pathway linked", subtitle: "Show pathway-linked", enabled: true }]
    : []),
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
    return trimmedQuery ? `Title or content match for "${trimmedQuery}"` : "Title or content match";
  }
  if (match.reasons.includes("record fields")) return "Content match in record details";
  return "Content match in the forms catalogue";
}

function ResultTabs({ formsCount }: { formsCount: number }) {
  const tabs = [
    ["Results", null],
    ["Forms", formsCount],
  ] as const;

  return (
    <nav
      aria-label="Forms search sections"
      className="flex min-w-0 items-end gap-5 text-sm font-extrabold text-[color:var(--text)] sm:gap-7"
    >
      {tabs.map(([label, count], index) => (
        <button
          key={label}
          type="button"
          disabled={index !== 0}
          title={index !== 0 ? "Coming soon" : undefined}
          className={cn(
            "relative -mb-px flex min-h-12 items-center gap-2 whitespace-nowrap rounded-t-md",
            searchFocusRing,
            index === 0
              ? "text-[color:var(--clinical-accent)]"
              : "cursor-not-allowed text-[color:var(--text)] opacity-70",
          )}
        >
          {label}
          {count ? (
            <span className="rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-xs text-[color:var(--text)]">
              {count}
            </span>
          ) : null}
          {index === 0 ? (
            <span className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-[color:var(--clinical-accent)]" />
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function RefineFilterItem({
  icon: Icon,
  title,
  subtitle,
  enabled,
  danger,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  enabled: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          danger
            ? "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
            : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-[color:var(--text-muted)]">{subtitle}</p>
      </div>
      <ToggleSwitch enabled={enabled} aria-label={title} />
    </div>
  );
}

function RefineBar({ open, onToggle, panelId }: { open: boolean; onToggle: () => void; panelId: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-tap shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-extrabold transition",
        searchFocusRing,
        open
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      Refine
      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
    </button>
  );
}

function RefinePanel({ open, panelId }: { open: boolean; panelId: string }) {
  if (!open) return null;
  return (
    <section
      id={panelId}
      data-testid="form-search-refine-panel"
      aria-label="Refine results"
      className={cn(searchResultsSection, "p-4 lg:p-5")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Refine results</h2>
          <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">Filter controls are coming soon.</p>
        </div>
        <button
          type="button"
          disabled
          title="Coming soon"
          className={cn(
            "cursor-not-allowed rounded-md px-2 py-1 text-xs font-extrabold text-[color:var(--clinical-accent)] opacity-70",
            searchFocusRing,
          )}
        >
          Reset
        </button>
      </div>
      <div
        className="mt-3 grid gap-2 opacity-70 sm:grid-cols-2 xl:grid-cols-4"
        aria-disabled="true"
        title="Coming soon"
      >
        {refineFilters.map((filter) => (
          <RefineFilterItem key={filter.title} {...filter} />
        ))}
      </div>
    </section>
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
            "inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
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
          disabled
          title="Coming soon"
          className={cn(
            "inline-flex min-h-9 cursor-not-allowed items-center gap-3 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] opacity-70",
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
        {matches.map((match, index) => {
          const form = match.service;
          return (
            <article
              key={form.slug}
              data-testid={`form-search-mobile-result-${form.slug}`}
              className="grid grid-cols-[48px_minmax(0,1fr)] gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 shadow-[var(--shadow-tight)]"
            >
              <FormCodeBadge code={resultCode(match, index)} variant="sm" />
              <div className="min-w-0">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm-minus font-extrabold leading-snug text-[color:var(--text-heading)]">
                    {form.title}
                  </h3>
                  <Link
                    href={`/forms/${form.slug}`}
                    aria-label={`Open ${form.title}`}
                    className={cn(
                      "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-[color:var(--border)] px-2.5 text-2xs font-extrabold text-[color:var(--clinical-accent)] transition before:absolute before:-inset-2 before:rounded-lg before:content-[''] hover:bg-[color:var(--clinical-accent-soft)]",
                      searchFocusRing,
                    )}
                  >
                    Open
                    <ExternalLink className="h-3 w-3" aria-hidden />
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
                          tagToneClass(chipLabel),
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
        href={appModeHomeHref("forms", { query, focus: true, run: true })}
        className={cn(
          "mx-auto mt-2 flex min-h-tap w-fit items-center gap-2 rounded-md px-2 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)]",
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
        disabled
        title="Coming soon"
        className={cn(
          "mx-auto mt-1 flex min-h-8 cursor-not-allowed items-center gap-2 rounded-md px-2 text-sm-minus font-extrabold text-[color:var(--clinical-accent)] opacity-70",
          searchFocusRing,
        )}
      >
        <Workflow aria-hidden="true" className="h-4 w-4" />
        View full pathway
      </button>
    </section>
  );
}

function RegistryStatusNotice({ status }: { status: RegistryRequestStatus }) {
  if (status === "ready") return null;
  const notice =
    status === "loading"
      ? { icon: Loader2, spin: true, tone: "info", text: "Loading your forms registry...", action: null }
      : status === "unauthorized"
        ? {
            icon: Shield,
            spin: false,
            tone: "warning",
            text: "Your session expired. Sign in again to search your private forms registry.",
            action: { href: "/", label: "Open account setup" },
          }
        : {
            icon: ShieldAlert,
            spin: false,
            tone: "danger",
            text: "Couldn't load the forms registry. Try again shortly.",
            action: null,
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
      {notice.action ? (
        <Link
          href={notice.action.href}
          className="inline-flex min-h-tap items-center justify-center rounded-md bg-[color:var(--command)] px-3 text-xs font-bold text-[color:var(--command-contrast)] hover:bg-[color:var(--command-hover)]"
        >
          {notice.action.label}
        </Link>
      ) : null}
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
  const [refineOpen, setRefineOpen] = useState(false);
  const refinePanelId = useId();
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(
    () => (registryReady ? rankFormRecords(registry.records, deferredQuery) : []),
    [registryReady, registry.records, deferredQuery],
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
            {query.trim() && deferredQuery === query && displayedMatches.length === 0 ? (
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
                <div className="flex min-w-0 items-end gap-3 border-b border-[color:var(--border)]">
                  <div className="min-w-0 flex-1 overflow-x-auto">
                    <ResultTabs formsCount={displayedMatches.length} />
                  </div>
                  <div className="flex items-center gap-2 pb-1.5">
                    <ResultSortControl value={sortValue} onChange={setSortValue} className="md:hidden" />
                    {supportsPathwayClaims ? (
                      <RefineBar
                        open={refineOpen}
                        onToggle={() => setRefineOpen((open) => !open)}
                        panelId={refinePanelId}
                      />
                    ) : null}
                  </div>
                </div>
                {supportsPathwayClaims ? <RefinePanel open={refineOpen} panelId={refinePanelId} /> : null}
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
