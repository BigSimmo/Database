"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ExternalLink, GitCompareArrows, ListChecks, ShieldCheck, X } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";

import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";
import { SearchResultsLayout } from "@/components/clinical-dashboard/search-results-layout";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  SearchResultsSkeleton,
} from "@/components/clinical-dashboard/search-results-header-band";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { ServiceGroupNav } from "@/components/services/service-group-nav";
import { Chip as DesignChip, type ChipStatusTone } from "@/components/ui/chip";
import { cn } from "@/components/ui-primitives";
import { useResultSort } from "@/components/use-result-sort";
import { compactBestUseTitle } from "@/lib/compact-best-use-title";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import {
  readServiceCoreGroup,
  serviceCoreGroupLabel,
  serviceCoreGroups,
  serviceMatchesCoreGroup,
  type ServiceCoreGroupId,
} from "@/lib/service-core-groups";
import { rankServiceRecords, type ServiceRecord, type ServiceStatusChip } from "@/lib/service-ranker";
import { sortResultItems } from "@/lib/result-sort";
import { useRegistryRecords } from "@/lib/use-registry-records";

const bestFitQuery = "13YARN crisis Aboriginal Torres Strait Islander phone";
const serviceQuickFilters = [
  { label: "Best fit", query: bestFitQuery },
  { label: "Crisis", query: "crisis" },
  { label: "Culturally safe", query: "Aboriginal Torres Strait Islander" },
  { label: "Phone referral", query: "phone referral" },
  { label: "Free", query: "free" },
  { label: "WA", query: "WA" },
] as const;

function displayText(value: string | null | undefined, fallback = "Confirm locally") {
  return value?.trim() ? value.trim() : fallback;
}

function compactText(value: string | null | undefined, maxLength: number, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? compactBestUseTitle(trimmed, maxLength) : fallback;
}

function chipTone(tone: ServiceStatusChip["tone"] | undefined | null): ChipStatusTone {
  if (tone === "danger" || tone === "info" || tone === "warning" || tone === "success") return tone;
  return "neutral";
}

function serviceChipLabel(chip: ServiceStatusChip) {
  const label = displayText(chip.label, "Status");
  return label.toLowerCase().includes("aboriginal and torres strait islander")
    ? "Aboriginal and Torres Strait Islander-specific"
    : label;
}

function ServiceCard({
  service,
  index,
  relevanceRank,
  selected,
  onToggleSelected,
}: {
  service: ServiceRecord;
  index: number;
  relevanceRank: number | null;
  selected: boolean;
  onToggleSelected: (slug: string) => void;
}) {
  const showBestFit = relevanceRank !== null && relevanceRank <= 2;
  const catchment = service.catchments?.slice(0, 2).join(" · ") || service.location;

  return (
    <article
      data-testid={`service-search-result-${service.slug}`}
      className={cn(
        "rounded-xl border bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] sm:p-4",
        selected || showBestFit
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent-border)]/35"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg border text-sm font-extrabold",
            selected
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
          )}
          aria-label={`Result ${index + 1}${selected ? ", shortlisted" : ""}`}
        >
          {selected ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-base font-bold leading-5 text-[color:var(--text-heading)] sm:text-lg">
              {service.title}
            </h2>
            {showBestFit ? (
              <span className="rounded-full bg-[color:var(--clinical-accent)] px-2 py-0.5 text-2xs font-bold text-[color:var(--clinical-accent-contrast)]">
                Best fit
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            {compactText(
              service.bestUse ?? service.subtitle,
              150,
              "Open the record to review service fit and referral details.",
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(service.statusChips ?? []).slice(0, 3).map((chip) => (
              <DesignChip
                key={`${service.slug}-${chip.label}`}
                size="compact"
                appearance={{ kind: "status", tone: chipTone(chip.tone) }}
                dot
              >
                {serviceChipLabel(chip)}
              </DesignChip>
            ))}
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-2xs font-semibold text-[color:var(--text-muted)] sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
          {service.verification?.confidence ?? "Unknown"} confidence
        </span>
      </div>

      <dl className="mt-3 grid min-w-0 grid-cols-1 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] sm:grid-cols-3">
        {[
          ["Catchment", compactText(catchment, 72, "Confirm locally")],
          ["Eligibility", compactText(service.eligibility, 86, "Review criteria")],
          ["Cost", compactText(service.cost, 72, "Confirm fees")],
        ].map(([label, value], itemIndex) => (
          <div
            key={label}
            className={cn(
              "min-w-0 px-3 py-2.5",
              itemIndex > 0 && "border-t border-[color:var(--border)] sm:border-l sm:border-t-0",
            )}
          >
            <dt className="text-2xs font-semibold text-[color:var(--text-muted)]">{label}</dt>
            <dd className="mt-0.5 line-clamp-2 text-xs font-bold leading-4 text-[color:var(--text-heading)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Link
          href={`/services/${service.slug}`}
          aria-label={`Review referral for ${service.title}`}
          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Review referral
        </Link>
        <button
          type="button"
          onClick={() => onToggleSelected(service.slug)}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${service.title} from shortlist` : `Add ${service.title} to shortlist`}
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10",
            selected
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] hover:bg-[color:var(--clinical-accent-hover)]",
          )}
        >
          {selected ? <Check className="h-4 w-4" aria-hidden /> : <ListChecks className="h-4 w-4" aria-hidden />}
          {selected ? "Shortlisted" : "Add to shortlist"}
        </button>
      </div>
    </article>
  );
}

function ComparisonPanel({
  services,
  onRemove,
  onClose,
}: {
  services: ServiceRecord[];
  onRemove: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <section
      data-testid="services-comparison"
      aria-labelledby="services-comparison-title"
      className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-3 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Step 3
          </p>
          <h2 id="services-comparison-title" className="mt-0.5 text-xl font-bold text-[color:var(--text-heading)]">
            Compare shortlisted services
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Check service fit and local details before choosing a referral route.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close service comparison"
          className="grid size-12 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:size-10"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <article
            key={service.slug}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold leading-5 text-[color:var(--text-heading)]">{service.title}</h3>
              <button
                type="button"
                onClick={() => onRemove(service.slug)}
                aria-label={`Remove ${service.title} from comparison`}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <dl className="mt-2 grid gap-2 text-xs">
              {[
                ["Best use", compactText(service.bestUse, 105, "Assess service fit")],
                ["Eligibility", compactText(service.eligibility, 105, "Confirm locally")],
                ["Referral", compactText(service.referral ?? service.route, 105, "Confirm route")],
                ["Cost", compactText(service.cost, 80, "Confirm fees")],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2">
                  <dt className="font-semibold text-[color:var(--text-muted)]">{label}</dt>
                  <dd className="font-medium text-[color:var(--text-heading)]">{value}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={`/services/${service.slug}`}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
            >
              Review referral
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ServicesNavigatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortValue, setSortValue] = useResultSort();
  const urlQuery = searchParams.get("q")?.trim() || searchParams.get("query")?.trim() || "";
  const activeGroup = readServiceCoreGroup(searchParams.get("group"));
  const [localQuery, setLocalQuery] = useState(() => ({ urlQuery, value: urlQuery }));
  const query = localQuery.urlQuery === urlQuery ? localQuery.value : urlQuery;
  const deferredQuery = useDeferredValue(query);
  const registry = useRegistryRecords("service");
  const registryLoading = registry.status === "loading";
  const registryReady = registry.status === "ready" || registry.status === "refetching";
  const registryBlocked = registry.status === "unauthorized" || registry.status === "error";
  const searchableRecords = useMemo(() => (registryReady ? registry.records : []), [registry.records, registryReady]);
  const rankedMatches = useMemo(() => {
    if (!query.trim()) return searchableRecords;
    const ranked = rankServiceRecords(searchableRecords, deferredQuery);
    if (ranked.length) return ranked.map((match) => match.service);
    return [];
  }, [deferredQuery, query, searchableRecords]);
  const groupedMatches = useMemo(
    () => rankedMatches.filter((service) => serviceMatchesCoreGroup(service, activeGroup)),
    [activeGroup, rankedMatches],
  );
  const displayedMatches = useMemo(
    () => sortResultItems(groupedMatches, sortValue, (service) => service.title),
    [groupedMatches, sortValue],
  );
  const relevanceRankMap = useMemo(() => {
    const map = new Map<string, number>();
    rankedMatches.forEach((service, index) => map.set(service.slug, index + 1));
    return map;
  }, [rankedMatches]);
  const groupCounts = useMemo(
    () =>
      Object.fromEntries(
        serviceCoreGroups.map((group) => [
          group.id,
          rankedMatches.filter((service) => serviceMatchesCoreGroup(service, group.id)).length,
        ]),
      ) as Record<ServiceCoreGroupId, number>,
    [rankedMatches],
  );
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const selected = searchableRecords.filter((service) => selectedSlugs.includes(service.slug));
  const [showComparison, setShowComparison] = useState(false);
  const activeQuickFilter = serviceQuickFilters.find(
    (filter) => filter.query.toLowerCase() === query.trim().toLowerCase(),
  );
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const heading = query || (activeGroup ? serviceCoreGroupLabel(activeGroup) : "Browse services");

  function updateParams(mutator: (params: URLSearchParams) => void, replace = false) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    params.set("run", "1");
    const href = `/services?${params.toString()}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  function toggleSelected(slug: string) {
    setSelectedSlugs((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(0, 5);
      if (next.length < 2) setShowComparison(false);
      return next;
    });
  }

  function applyServiceQuery(nextQuery: string) {
    const trimmedQuery = nextQuery.trim();
    setLocalQuery({ urlQuery, value: trimmedQuery });
    updateParams((params) => {
      params.delete("query");
      if (trimmedQuery) params.set("q", trimmedQuery);
      else params.delete("q");
    });
  }

  function clearServiceQuery() {
    setLocalQuery({ urlQuery, value: "" });
    updateParams((params) => {
      params.delete("q");
      params.delete("query");
      params.delete("focus");
    }, true);
  }

  function hrefForGroup(group: ServiceCoreGroupId | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("run", "1");
    if (group) params.set("group", group);
    else params.delete("group");
    return `/services?${params.toString()}`;
  }

  return (
    <SearchResultsLayout
      testId="services-navigator"
      canvasClassName="bg-[color:var(--background)] text-[color:var(--text)]"
      resultsLabel="Referral services"
      header={
        <>
          <DesktopComposerPortalSlot
            id={modeHomeDesktopComposerSlotId}
            className="mode-home-composer-slot hidden w-full min-w-0 [&:not(:empty)]:block"
          />

          {selected.length ? (
            <section
              data-testid="services-shortlist-bar"
              aria-label="Service shortlist"
              className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2 sm:px-4"
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)]">
                <ListChecks className="h-4 w-4" aria-hidden />
                {selected.length} shortlisted
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowComparison(true)}
                  disabled={selected.length < 2}
                  title={
                    selected.length < 2 ? "Shortlist at least two services to compare" : "Compare shortlisted services"
                  }
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10"
                >
                  <GitCompareArrows className="h-4 w-4" aria-hidden />
                  Compare
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlugs([]);
                    setShowComparison(false);
                  }}
                  className="inline-flex min-h-12 items-center rounded-lg px-3 text-xs font-bold text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-10"
                >
                  Clear
                </button>
              </span>
            </section>
          ) : null}

          <SearchResultsHeaderBand
            modeId="services"
            query={heading}
            matchCount={displayedMatches.length}
            headingLevel={1}
            status={
              registryBlocked
                ? registry.status === "unauthorized"
                  ? "unauthorized"
                  : "error"
                : registryLoading
                  ? "loading"
                  : registry.status === "refetching"
                    ? "refetching"
                    : "ready"
            }
            faultTitle={registry.status === "unauthorized" ? "Session expired" : "Could not load services"}
            faultBody={
              registry.status === "unauthorized"
                ? "Your session expired. Sign in again to search private service records and referral pathways."
                : "The services registry could not be loaded. Try again shortly."
            }
            onRetry={registry.status === "unauthorized" ? undefined : registry.refetch}
            faultAction={
              registry.status === "unauthorized" ? (
                <Link
                  href="/"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--text-muted)] sm:min-h-10"
                >
                  Open account setup
                </Link>
              ) : undefined
            }
            sortValue={sortValue}
            onSortChange={setSortValue}
            mobileControlsPlacement="inline"
            mobileControls={
              <ResultFilterTrigger
                panelId={filterPanelId}
                testId="service-filter-trigger-phone"
                title="Filter services"
                open={filterOpen}
                activeCount={activeQuickFilter ? 1 : 0}
                onToggle={() => setFilterOpen((current) => !current)}
              />
            }
            utilityControls={
              <span className="hidden sm:inline-flex">
                <ResultFilterTrigger
                  panelId={filterPanelId}
                  testId="service-filter-trigger-desktop"
                  title="Filter services"
                  open={filterOpen}
                  activeCount={activeQuickFilter ? 1 : 0}
                  onToggle={() => setFilterOpen((current) => !current)}
                />
              </span>
            }
          />

          <section className="grid gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)] sm:p-4">
            <ServiceGroupNav
              activeGroup={activeGroup}
              hrefForGroup={hrefForGroup}
              counts={{ ...groupCounts, all: rankedMatches.length }}
            />
          </section>

          <ResultFilterSheet
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            panelId={filterPanelId}
            testId="service-filter-panel"
            title="Filter services"
            description="Quick filters run a focused search within the selected service group."
            groups={[
              resultFilterGroup({
                id: "quick-filter",
                label: "Quick filters",
                value: activeQuickFilter?.query ?? "current",
                options: [
                  ...(activeQuickFilter
                    ? []
                    : [
                        {
                          value: "current" as const,
                          label: query.trim() ? "Current search" : serviceCoreGroupLabel(activeGroup),
                          disabled: true,
                        },
                      ]),
                  ...serviceQuickFilters.map((filter) => ({ value: filter.query, label: filter.label })),
                ],
                onChange: (value) => {
                  if (value === "current") return;
                  setFilterOpen(false);
                  applyServiceQuery(value);
                },
              }),
            ]}
            onClearAll={
              activeQuickFilter
                ? () => {
                    setFilterOpen(false);
                    clearServiceQuery();
                  }
                : undefined
            }
            footerNote={`${displayedMatches.length} showing`}
          />
        </>
      }
    >
      {registryLoading ? (
        <SearchResultsSkeleton />
      ) : registryBlocked ? null : query.trim() && deferredQuery !== query ? (
        <SearchResultsSkeleton />
      ) : query.trim() && deferredQuery === query && rankedMatches.length === 0 ? (
        <SearchResultsEmptyState
          modeId="services"
          query={query}
          onTryExample={(example) => applyServiceQuery(example)}
        />
      ) : deferredQuery === query && displayedMatches.length === 0 ? (
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 text-center">
          <h2 className="text-lg font-bold text-[color:var(--text-heading)]">No services in this group</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Try All services or remove the current quick filter.
          </p>
          <Link
            href={hrefForGroup(null)}
            className="mt-3 inline-flex min-h-12 items-center justify-center rounded-lg border border-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            Show all services
          </Link>
        </section>
      ) : (
        <>
          {showComparison && selected.length >= 2 ? (
            <ComparisonPanel services={selected} onRemove={toggleSelected} onClose={() => setShowComparison(false)} />
          ) : null}
          <div data-testid="service-search-results" className="grid gap-3">
            {displayedMatches.map((service, index) => (
              <ServiceCard
                key={service.slug}
                service={service}
                index={index}
                relevanceRank={sortValue === "alpha" ? null : (relevanceRankMap.get(service.slug) ?? null)}
                selected={selectedSlugs.includes(service.slug)}
                onToggleSelected={toggleSelected}
              />
            ))}
          </div>
          {query ? <UniversalSearchAlsoMatches modeId="services" query={query} /> : null}
        </>
      )}
    </SearchResultsLayout>
  );
}
