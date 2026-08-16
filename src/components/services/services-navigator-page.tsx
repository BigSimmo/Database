"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ExternalLink,
  GitCompareArrows,
  ListChecks,
  X,
} from "lucide-react";
import { useCallback, useDeferredValue, useId, useMemo, useRef, useState } from "react";

import { useAccountData } from "@/components/account-data-provider";
import { DesktopComposerPortalSlot } from "@/components/desktop-composer-portal-slot";
import { SearchResultsLayout } from "@/components/clinical-dashboard/search-results-layout";
import {
  type AppliedFilterChip,
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  SearchResultsSkeleton,
} from "@/components/clinical-dashboard/search-results-header-band";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  resultFilterFacetGroup,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Chip as DesignChip, type ChipStatusTone } from "@/components/ui/chip";
import { cn } from "@/components/ui-primitives";
import { useResultSort } from "@/components/use-result-sort";
import { compactBestUseTitle } from "@/lib/compact-best-use-title";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import {
  readServiceCoreGroupSelection,
  serviceCoreGroupLabel,
  serviceCoreGroups,
  serviceMatchesCoreGroupSelection,
  writeServiceCoreGroupSelectionToParams,
  type ServiceCoreGroupId,
} from "@/lib/service-core-groups";
import {
  deriveServiceFacetOptions,
  deriveSubstanceLensOptions,
  filterServicesByFacets,
  serviceFacetDimensionLabels,
  serviceFacetDimensions,
  serviceFacetOptionCount,
  serviceFacetSelectionFromParams,
  serviceFacetSelectionSize,
  serviceFacetValueLabel,
  serviceSubstanceLensOptionCount,
  serviceSubstanceLensValueLabel,
  writeServiceFacetSelectionToParams,
  type ServiceFacetDimension,
} from "@/lib/service-facets";
import { rankServiceRecords, type ServiceRecord, type ServiceStatusChip } from "@/lib/service-ranker";
import { sortResultItems } from "@/lib/result-sort";
import { useRegistryRecords } from "@/lib/use-registry-records";

type ServiceResultScope = "results" | "all";

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
  saved,
  savedStateReady,
  savedStateLoadFailed,
  savePending,
  onToggleSaved,
}: {
  service: ServiceRecord;
  index: number;
  relevanceRank: number | null;
  selected: boolean;
  onToggleSelected: (slug: string) => void;
  saved: boolean;
  // False until the account favourites read settles. Until then `saved` is
  // `false` for EVERY service — not because nothing is saved, but because
  // nothing has been read yet — so the control must not assert a state.
  savedStateReady: boolean;
  savedStateLoadFailed: boolean;
  savePending: boolean;
  onToggleSaved: (slug: string) => void;
}) {
  const showBestFit = relevanceRank !== null && relevanceRank <= 2;

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
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]">
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
        {/* Favourite, not shortlist: the bookmark persists to the account
            across sessions, while the shortlist below is this search's
            working set and is deliberately not persisted. Two different
            jobs, so they stay two different controls. */}
        {/* Native `disabled`, not aria-disabled: this is transient inertness
            while a request settles, which is exactly the case
            docs/wiring-conventions.md reserves `disabled` for. Without it the
            control asserts "not saved" for every service during the account
            read and a tap issues a redundant write against a service that is
            already saved. */}
        <button
          type="button"
          onClick={() => onToggleSaved(service.slug)}
          disabled={!savedStateReady || savedStateLoadFailed || savePending}
          aria-pressed={savedStateReady && !savedStateLoadFailed ? saved : undefined}
          title={
            savedStateLoadFailed
              ? "Saved services are unavailable. Retry from your favourites."
              : !savedStateReady
                ? "Loading your saved services…"
                : savePending
                  ? "Saving…"
                  : undefined
          }
          aria-label={
            savedStateLoadFailed
              ? `Saved state unavailable for ${service.title}`
              : savedStateReady
                ? saved
                  ? `Remove ${service.title} from favourites`
                  : `Save ${service.title} to favourites`
                : `Loading saved state for ${service.title}`
          }
          className={cn(
            "grid min-h-12 min-w-12 place-items-center rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:min-w-10",
            savedStateReady && !savedStateLoadFailed && saved
              ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] enabled:hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          {savedStateReady && !savedStateLoadFailed && saved ? (
            <BookmarkCheck className="h-4 w-4" aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {/* The Catchment/Eligibility/Cost strip that used to sit here is gone
          (direction B, ledger #163): three truncated fields per row turned a
          scan of 45 crisis services into a wall of clipped prose. The full,
          untruncated values are one tap away on the record via "Review
          referral", which is where a referral decision is actually made. */}
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

const referralStages = [
  { id: "search", label: "Search" },
  { id: "shortlist", label: "Shortlist" },
  { id: "compare", label: "Compare" },
  { id: "refer", label: "Refer" },
] as const;

type ReferralStageId = (typeof referralStages)[number]["id"];

/**
 * A compact progress rail, not the old four-card walkthrough. It sits directly
 * below the results heading because it describes the current search journey;
 * category and suggestion navigation no longer compete for this position.
 *
 * The accessible name stays distinct from `ServiceReferralFlow` on the service
 * record. "Refer" is reached there, but remains visible here so the whole path
 * is understandable before a reader starts a shortlist.
 */
function ServiceReferralProgress({ active }: { active: ReferralStageId }) {
  const activeIndex = referralStages.findIndex((stage) => stage.id === active);

  return (
    <nav
      aria-label="Referral progress"
      data-testid="service-referral-progress"
      className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 shadow-[var(--shadow-inset)] sm:px-4 sm:py-3"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Referral pathway
        </span>
        <span className="nums shrink-0 text-2xs font-semibold text-[color:var(--clinical-accent)]" aria-live="polite">
          Step {activeIndex + 1} of {referralStages.length}
        </span>
      </div>
      <ol className="mt-2 grid min-w-0 grid-cols-4 gap-1 sm:mt-2.5 sm:gap-2">
        {referralStages.map((stage, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          return (
            <li key={stage.id} className="relative flex min-w-0 flex-col items-center gap-1.5">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 top-3 h-px w-[calc(100%+0.25rem)] sm:w-[calc(100%+0.5rem)]",
                    isComplete || isActive ? "bg-[color:var(--clinical-accent-border)]" : "bg-[color:var(--border)]",
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-3xs font-black",
                  isActive
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : isComplete
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
                )}
              >
                {isComplete ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>
              <span
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "min-w-0 max-w-full truncate text-center text-2xs font-bold",
                  isActive
                    ? "text-[color:var(--clinical-accent)]"
                    : isComplete
                      ? "text-[color:var(--text)]"
                      : "text-[color:var(--text-muted)]",
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
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
  const categorySelection = useMemo(() => readServiceCoreGroupSelection(searchParams.get("group")), [searchParams]);
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
  // Facet selection lives in the URL, alongside `q`/`group`, so a filtered
  // services search stays shareable and survives navigating away and back —
  // see docs/filter-contract.md section 1 and PR C's own scope note.
  const facetSelection = useMemo(() => serviceFacetSelectionFromParams(searchParams), [searchParams]);
  const substanceLens = searchParams.get("substance") ?? "all";
  const resultScope: ServiceResultScope = searchParams.get("scope") === "all" ? "all" : "results";
  // The scope segment (section 4) lets a reader who has narrowed to zero
  // widen from the query-scoped set to the whole 219-item catalogue
  // without discarding the query. Gated on the UNFACETED result set so the
  // segment does not flicker away as facets are applied — narrowing with
  // facets only ever makes "catalogue > results" more true, never less.
  const showResultScope = searchableRecords.length > rankedMatches.length;
  const scopeBaseMatches = resultScope === "all" ? searchableRecords : rankedMatches;
  const facetBaseMatches = useMemo(
    () => scopeBaseMatches.filter((service) => serviceMatchesCoreGroupSelection(service, categorySelection)),
    [categorySelection, scopeBaseMatches],
  );
  const facetedMatches = useMemo(
    () => filterServicesByFacets(facetBaseMatches, facetSelection, substanceLens),
    [facetBaseMatches, facetSelection, substanceLens],
  );
  const displayedMatches = useMemo(
    () => sortResultItems(facetedMatches, sortValue, (service) => service.title),
    [facetedMatches, sortValue],
  );
  // Both scope segments show the current category/facet selection applied —
  // "counts on both" — differing only in whether the query scoping applies.
  const resultsScopedCount = useMemo(
    () =>
      filterServicesByFacets(
        rankedMatches.filter((service) => serviceMatchesCoreGroupSelection(service, categorySelection)),
        facetSelection,
        substanceLens,
      ).length,
    [categorySelection, facetSelection, rankedMatches, substanceLens],
  );
  const allScopedCount = useMemo(
    () =>
      filterServicesByFacets(
        searchableRecords.filter((service) => serviceMatchesCoreGroupSelection(service, categorySelection)),
        facetSelection,
        substanceLens,
      ).length,
    [categorySelection, facetSelection, searchableRecords, substanceLens],
  );
  const activeFilterCount =
    categorySelection.size + serviceFacetSelectionSize(facetSelection) + (substanceLens === "all" ? 0 : 1);
  const relevanceRankMap = useMemo(() => {
    const map = new Map<string, number>();
    rankedMatches.forEach((service, index) => map.set(service.slug, index + 1));
    return map;
  }, [rankedMatches]);
  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        serviceCoreGroups.map((group) => {
          const widened = new Set(categorySelection);
          widened.add(group.id);
          const categoryMatches = scopeBaseMatches.filter((service) =>
            serviceMatchesCoreGroupSelection(service, widened),
          );
          return [group.id, filterServicesByFacets(categoryMatches, facetSelection, substanceLens).length];
        }),
      ) as Record<ServiceCoreGroupId, number>,
    [categorySelection, facetSelection, scopeBaseMatches, substanceLens],
  );
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const selected = searchableRecords.filter((service) => selectedSlugs.includes(service.slug));
  const [showComparison, setShowComparison] = useState(false);
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const selectedCategory = categorySelection.size === 1 ? [...categorySelection][0] : null;
  const heading = query || (selectedCategory ? serviceCoreGroupLabel(selectedCategory) : "Browse services");
  const accountData = useAccountData();
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // The provider rolls back a failed mutation from its pre-request snapshot.
  // Serialize writes from this multi-row surface so one row's rollback cannot
  // erase another row's successful optimistic update.
  const savingSlugsRef = useRef(new Set<string>());
  const [savingSlugs, setSavingSlugs] = useState<ReadonlySet<string>>(() => new Set());
  // Derived during render rather than tracked in an effect: the stage is a
  // pure function of the shortlist state that already exists, and
  // tests/audit-content-services-regressions.test.ts pins this file as
  // effect-free.
  const referralStage: ReferralStageId = showComparison ? "compare" : selectedSlugs.length ? "shortlist" : "search";

  async function toggleSaved(slug: string) {
    // Belt as well as braces: the control is disabled until the read settles,
    // but a toggle computed from an unread library would invert the wrong
    // state, so refuse it here too rather than trusting the caller.
    if (!accountData.ready || accountData.loadError || savingSlugsRef.current.size > 0) return;
    const service = searchableRecords.find((record) => record.slug === slug);
    if (!service) return;
    savingSlugsRef.current.add(slug);
    setSavingSlugs(new Set(savingSlugsRef.current));
    const nowSaved = !accountData.isSaved("service", slug);
    try {
      if (!(await accountData.setFavourite("service", slug, nowSaved))) {
        setSaveNotice(
          accountData.isAuthenticated ? "Save failed. Try again." : "Sign in or create an account to save services.",
        );
        return;
      }
      setSaveNotice(nowSaved ? `${service.title} saved to favourites.` : `${service.title} removed from favourites.`);
    } catch {
      setSaveNotice("Save failed. Try again.");
    } finally {
      savingSlugsRef.current.delete(slug);
      setSavingSlugs(new Set(savingSlugsRef.current));
    }
  }

  function toggleSelected(slug: string) {
    setSelectedSlugs((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(0, 5);
      if (next.length < 2) setShowComparison(false);
      return next;
    });
  }

  const updateParams = useCallback(
    (mutator: (params: URLSearchParams) => void, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      mutator(params);
      params.set("run", "1");
      const href = `/services?${params.toString()}`;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [router, searchParams],
  );

  // Facet/lens/scope toggles replace (not push) — a reader ticking several
  // chips should not spam the back-button history the way submitting a new
  // search does.
  const toggleCategoryValue = useCallback(
    (value: ServiceCoreGroupId) => {
      updateParams((params) => {
        const next = new Set(readServiceCoreGroupSelection(params.get("group")));
        if (!next.delete(value)) next.add(value);
        writeServiceCoreGroupSelectionToParams(params, next);
      }, true);
    },
    [updateParams],
  );

  const toggleFacetValue = useCallback(
    (dimension: ServiceFacetDimension, value: string) => {
      updateParams((params) => {
        const current = serviceFacetSelectionFromParams(params);
        const next = new Set(current[dimension]);
        if (!next.delete(value)) next.add(value);
        writeServiceFacetSelectionToParams(params, { ...current, [dimension]: next });
      }, true);
    },
    [updateParams],
  );

  const setSubstanceLensValue = useCallback(
    (value: string) => {
      updateParams((params) => {
        if (value === "all") params.delete("substance");
        else params.set("substance", value);
      }, true);
    },
    [updateParams],
  );

  const setResultScopeValue = useCallback(
    (value: ServiceResultScope) => {
      updateParams((params) => {
        if (value === "all") params.set("scope", "all");
        else params.delete("scope");
      }, true);
    },
    [updateParams],
  );

  // Never touches `q`/`query` — docs/filter-contract.md section 6: clearing
  // filters and clearing a search are different intentions. `group` is now
  // the URL-backed Service category facet, so it is cleared with the rest of
  // the filter state rather than behaving as a separate navigation strip.
  const clearAllFilters = useCallback(() => {
    updateParams((params) => {
      params.delete("group");
      for (const dimension of serviceFacetDimensions) params.delete(dimension);
      params.delete("substance");
      params.delete("scope");
    }, true);
  }, [updateParams]);

  function applyServiceQuery(nextQuery: string) {
    const trimmedQuery = nextQuery.trim();
    setLocalQuery({ urlQuery, value: trimmedQuery });
    updateParams((params) => {
      params.delete("query");
      if (trimmedQuery) params.set("q", trimmedQuery);
      else params.delete("q");
    });
  }

  // `substance_flags` is an exact partition (measured 2026-08-12: all 219
  // services carry exactly one of general/aod) — a lens, not a facet. See
  // src/lib/service-facets.ts for the full measurement note.
  const categoryGroup = useMemo(
    () =>
      resultFilterFacetGroup({
        id: "service-category",
        label: "Service category",
        selected: categorySelection,
        options: serviceCoreGroups.map((group) => ({
          value: group.id,
          label: group.label,
          searchText: `${group.label} ${group.shortLabel}`,
          hint: String(categoryCounts[group.id]),
          disabled: categoryCounts[group.id] === 0 && !categorySelection.has(group.id),
        })),
        onToggle: toggleCategoryValue,
      }),
    [categoryCounts, categorySelection, toggleCategoryValue],
  );

  const substanceOptionValues = useMemo(() => deriveSubstanceLensOptions(searchableRecords), [searchableRecords]);
  const substanceGroup = useMemo(
    () =>
      resultFilterGroup({
        id: "substance",
        label: "Program type",
        value: substanceLens,
        options: [
          {
            value: "all",
            label: "All programs",
            hint: String(serviceSubstanceLensOptionCount(facetBaseMatches, facetSelection, "all")),
          },
          ...substanceOptionValues.map((value) => {
            const count = serviceSubstanceLensOptionCount(facetBaseMatches, facetSelection, value);
            return {
              value,
              label: serviceSubstanceLensValueLabel(value),
              hint: String(count),
              // Keep an active zero-count lens selectable so the reader can
              // recover, but do not offer a different lens that would empty
              // the current facet-constrained result set.
              disabled: count === 0 && substanceLens !== value,
            };
          }),
        ],
        onChange: setSubstanceLensValue,
      }),
    [facetBaseMatches, facetSelection, setSubstanceLensValue, substanceLens, substanceOptionValues],
  );

  // Keep the option lists and handlers stable while unrelated page state
  // changes (for example opening the sheet or updating the shortlist).
  const facetGroups = useMemo(
    () =>
      serviceFacetDimensions.map((dimension) =>
        resultFilterFacetGroup({
          id: dimension,
          label: serviceFacetDimensionLabels[dimension],
          selected: facetSelection[dimension],
          options: deriveServiceFacetOptions(searchableRecords, dimension).map((value) => {
            const withCandidate = serviceFacetOptionCount(
              facetBaseMatches,
              facetSelection,
              substanceLens,
              dimension,
              value,
            );
            return {
              value,
              label: serviceFacetValueLabel(dimension, value),
              hint: String(withCandidate),
              disabled: withCandidate === 0 && !facetSelection[dimension].has(value),
            };
          }),
          onToggle: (value) => toggleFacetValue(dimension, value),
        }),
      ),
    [facetBaseMatches, facetSelection, searchableRecords, substanceLens, toggleFacetValue],
  );

  const appliedFilters = useMemo<AppliedFilterChip[]>(() => {
    const chips: AppliedFilterChip[] = [];
    for (const group of serviceCoreGroups) {
      if (!categorySelection.has(group.id)) continue;
      chips.push({
        id: `service-category:${group.id}`,
        label: group.label,
        onRemove: () => toggleCategoryValue(group.id),
      });
    }
    if (substanceLens !== "all") {
      chips.push({
        id: `substance:${substanceLens}`,
        label: serviceSubstanceLensValueLabel(substanceLens),
        onRemove: () => setSubstanceLensValue("all"),
      });
    }
    for (const dimension of serviceFacetDimensions) {
      for (const value of facetSelection[dimension]) {
        chips.push({
          id: `${dimension}:${value}`,
          label: serviceFacetValueLabel(dimension, value),
          onRemove: () => toggleFacetValue(dimension, value),
        });
      }
    }
    return chips;
  }, [categorySelection, facetSelection, setSubstanceLensValue, substanceLens, toggleCategoryValue, toggleFacetValue]);

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
            appliedFilters={appliedFilters}
            onClearFilters={activeFilterCount > 0 ? clearAllFilters : undefined}
            mobileControlsPlacement="inline"
            mobileControls={
              <ResultFilterTrigger
                panelId={filterPanelId}
                testId="service-filter-trigger-phone"
                title="Filter services"
                open={filterOpen}
                activeCount={activeFilterCount}
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
                  activeCount={activeFilterCount}
                  onToggle={() => setFilterOpen((current) => !current)}
                />
              </span>
            }
          />

          {/* Progress, then the shortlist banner, then browse — the banner
              sits under the heading it qualifies rather than above it, and
              appears only once something is shortlisted. */}
          <ServiceReferralProgress active={referralStage} />

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

          {/* The bookmark control is otherwise silent, and a failed save must
              not read as a success. Visible rather than sr-only: "Sign in to
              save services" is the common outcome for a guest, and hiding it
              from sighted readers leaves the bookmark looking simply broken.
              The live region is always mounted so the announcement is not
              swallowed by the node appearing at the same time as its text. */}
          <p
            role="status"
            aria-live="polite"
            className={cn("text-xs font-semibold text-[color:var(--text-muted)]", saveNotice ? "min-h-5" : "sr-only")}
          >
            {saveNotice ?? ""}
          </p>

          <ResultFilterSheet
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            panelId={filterPanelId}
            testId="service-filter-panel"
            title="Filter services"
            description="Narrow the current search by service category, program and referral fit."
            groups={[categoryGroup, substanceGroup, ...facetGroups]}
            onClearAll={activeFilterCount > 0 ? clearAllFilters : undefined}
            footerNote={`${displayedMatches.length} showing`}
            chromeResetKey={`${deferredQuery}|${searchParams.get("group") ?? ""}|${resultScope}`}
            scopeControl={
              showResultScope ? (
                <SegmentedControl
                  label="Result scope"
                  value={resultScope}
                  onChange={setResultScopeValue}
                  options={[
                    { value: "results", label: "These results", hint: String(resultsScopedCount) },
                    { value: "all", label: "All items", hint: String(allScopedCount) },
                  ]}
                />
              ) : undefined
            }
          />
        </>
      }
    >
      {registryLoading ? (
        <SearchResultsSkeleton />
      ) : registryBlocked ? null : query.trim() && deferredQuery !== query ? (
        <SearchResultsSkeleton />
      ) : resultScope === "results" && query.trim() && deferredQuery === query && rankedMatches.length === 0 ? (
        // `rankedMatches` is query-only (see its definition above) and never
        // reflects the "All items" scope, which exists precisely to bypass a
        // query match of zero — see docs/filter-contract.md section 4. Gating
        // this branch on `resultScope === "results"` lets that scope fall
        // through to the facet-driven branches below instead of reporting a
        // dead end the reader already escaped via the scope segment.
        <SearchResultsEmptyState
          modeId="services"
          query={query}
          onTryExample={(example) => applyServiceQuery(example)}
        />
      ) : deferredQuery === query && displayedMatches.length === 0 ? (
        // `displayedMatches` is category- AND facet/lens-narrowed, so every
        // constraint can be relaxed from the same filter surface without
        // discarding the search query.
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 text-center">
          <h2 className="text-lg font-bold text-[color:var(--text-heading)]">No services match</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            {activeFilterCount > 0 ? "Adjust or clear your filters to see more services." : "Try a broader search."}
          </p>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="mt-3 inline-flex min-h-12 items-center justify-center rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              Clear filters
            </button>
          ) : null}
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
                saved={accountData.isSaved("service", service.slug)}
                savedStateReady={accountData.ready}
                savedStateLoadFailed={Boolean(accountData.loadError)}
                savePending={savingSlugs.size > 0}
                onToggleSaved={toggleSaved}
              />
            ))}
          </div>
          {query ? <UniversalSearchAlsoMatches modeId="services" query={query} /> : null}
        </>
      )}
    </SearchResultsLayout>
  );
}
