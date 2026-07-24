"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  DollarSign,
  ExternalLink,
  Phone,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, useDeferredValue } from "react";

import { cn } from "@/components/ui-primitives";
import { ModeHomeStatusNotice } from "@/components/mode-home-template";
import { SearchResultsLayout } from "@/components/clinical-dashboard/search-results-layout";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
  SearchResultsSkeleton,
} from "@/components/clinical-dashboard/search-results-header-band";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { appModeHomeHref } from "@/lib/app-modes";
import { recordMatchesCommandScopes } from "@/lib/search-command-surface";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { rankServiceRecords, type ServiceRecord, type ServiceStatusChip } from "@/lib/service-ranker";
import { canCompareServices, serviceNavigatorMetrics } from "@/lib/service-navigator-metrics";
import { useRegistryRecords } from "@/lib/use-registry-records";
import { sortResultItems } from "@/lib/result-sort";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { useResultSort } from "@/components/use-result-sort";

const defaultQuery = "13YARN crisis support aboriginal phone";

function text(value: string | null | undefined, fallback = "Confirm locally") {
  return value?.trim() ? value.trim() : fallback;
}

function chipTone(tone: ServiceStatusChip["tone"] | undefined | null) {
  if (tone === "danger")
    return "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  if (tone === "info") return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
  if (tone === "warning")
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  if (tone === "success")
    return "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
  return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
}

function serviceChipLabel(chip: ServiceStatusChip) {
  const label = text(chip.label, "Status");
  if (label.toLowerCase().includes("aboriginal and torres strait islander")) return "ATSI-specific";
  return label;
}

function Stepper() {
  return (
    <div className="hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-tight)] lg:grid lg:grid-cols-4 lg:gap-3">
      {[
        ["1", "Search", "Find services"],
        ["2", "Shortlist", "Pick best options"],
        ["3", "Compare", "Review side by side"],
        ["4", "Refer", "Send with confidence"],
      ].map(([number, title, body], index) => (
        <div key={number} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2">
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border text-sm font-bold",
              index === 0
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : "border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--text-soft)]",
            )}
          >
            {number}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm font-bold",
                index === 0 ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-heading)]",
              )}
            >
              {title}
            </span>
            <span className="block truncate text-2xs font-semibold text-[color:var(--text-soft)]">{body}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Chip({ chip }: { chip: ServiceStatusChip }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-2xs font-bold",
        chipTone(chip.tone),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {serviceChipLabel(chip)}
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-[66px] min-w-0 grid-cols-[1.8rem_minmax(0,1fr)] items-center gap-2 overflow-hidden border-l border-t border-[color:var(--border)] px-3 py-2",
        className,
      )}
    >
      <Icon className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden />
      <span className="min-w-0">
        <span className="block text-2xs font-semibold leading-4 text-[color:var(--text-soft)]">{label}</span>
        <span className="block truncate text-sm font-bold leading-5 text-[color:var(--text-heading)]">{value}</span>
        <span className="block truncate text-2xs font-medium leading-4 text-[color:var(--text-soft)]">{detail}</span>
      </span>
    </div>
  );
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
  const rank = index + 1;
  const tags = [...(service.catchments ?? []), ...(service.tags ?? [])].slice(0, 4);
  const showRelevanceCues = relevanceRank !== null && relevanceRank <= 2;

  return (
    <article
      data-testid={`service-search-result-${service.slug}`}
      className={cn(
        "rounded-lg border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]",
        showRelevanceCues
          ? "border-[color:var(--clinical-accent-border)] ring-1 ring-[color:var(--clinical-accent-border)]/35"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-sm font-bold text-[color:var(--clinical-accent-contrast)]">
          {rank}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-lg font-bold leading-tight text-[color:var(--text-heading)] max-sm:text-base">
              {service.title}
            </h3>
            {showRelevanceCues ? (
              <span className="rounded-full bg-[color:var(--clinical-accent)] px-2.5 py-1 text-2xs font-bold text-[color:var(--clinical-accent-contrast)]">
                Best fit
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(service.statusChips ?? []).slice(0, 3).map((chip) => (
              <Chip key={`${service.slug}-${chip.label}`} chip={chip} />
            ))}
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            {text(service.subtitle ?? service.bestUse, "Open the record for referral details.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggleSelected(service.slug)}
          className="grid min-h-tap min-w-tap place-items-center rounded-lg text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:h-9 sm:min-h-0 sm:w-9 sm:min-w-0"
          aria-label={selected ? `Remove ${service.title} from comparison` : `Add ${service.title} to comparison`}
          aria-pressed={selected}
        >
          <Bookmark
            className={cn(
              "h-5 w-5",
              selected && "fill-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]",
            )}
            aria-hidden
          />
        </button>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] md:grid-cols-4">
        <Metric
          icon={Phone}
          label="Route / contact"
          value={text(service.primaryContact?.value)}
          detail={text(service.primaryContact?.detail ?? service.route, "Referral route pending")}
          className="border-l-0 border-t-0"
        />
        <Metric
          icon={Users}
          label="Eligibility"
          value={text(service.eligibility, "Eligibility pending")}
          detail="See details"
          className="border-t-0"
        />
        <Metric
          icon={ShieldCheck}
          label="Confidence"
          value={text(service.verification?.confidence, "Unknown")}
          detail={text(service.source?.status, "Source pending")}
          className="border-l-0 md:border-l md:border-t-0"
        />
        <Metric
          icon={DollarSign}
          label="Cost"
          value={text(service.cost, "Cost pending")}
          detail={(service.cost ?? "").toLowerCase().includes("free") ? "No cost" : "Confirm fees"}
          className="md:border-t-0"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {tags.map((tag, tagIndex) => (
            <span
              key={`${service.slug}-${tag}`}
              className={cn(
                "rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-2xs font-semibold text-[color:var(--text-muted)]",
                tagIndex > 2 ? "max-sm:hidden" : "",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/services/${service.slug}`}
            aria-label={`Open ${service.title}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open
          </Link>
          <button
            type="button"
            onClick={() => onToggleSelected(service.slug)}
            className="inline-flex min-h-tap min-w-[94px] items-center justify-center gap-1.5 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:h-9 sm:min-h-0"
            aria-label={selected ? `Remove ${service.title} from comparison` : `Add ${service.title} to comparison`}
            aria-pressed={selected}
          >
            <Check className="h-4 w-4" aria-hidden />
            {selected ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    </article>
  );
}

function RightRail({
  matches,
  selected,
  onClearSelected,
  onToggleSelected,
}: {
  matches: ServiceRecord[];
  selected: ServiceRecord[];
  onClearSelected: () => void;
  onToggleSelected: (slug: string) => void;
}) {
  const [showChecklistDetails, setShowChecklistDetails] = useState(false);
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const counts = serviceNavigatorMetrics(matches);
  const comparisonAvailable = canCompareServices(selected);
  const checklistExpanded = showChecklistDetails && selected.length > 0;
  const confidenceExpanded = showConfidenceDetails && matches.length > 0;
  const comparisonExpanded = showComparison && comparisonAvailable;
  const confidenceTotal = counts.high + counts.medium + counts.low + counts.unknown;

  const rows: Array<[string, number, LucideIcon, string]> = [
    ["Meets", counts.meets, CircleCheck, "text-[color:var(--success)]"],
    ["Caution", counts.cautions, CircleAlert, "text-[color:var(--warning)]"],
    ["Does not meet", counts.rejects, CircleX, "text-[color:var(--danger)]"],
    ["Source verified", counts.verified, CircleCheck, "text-[color:var(--success)]"],
    ["Local confirmation", counts.localConfirmation, CircleAlert, "text-[color:var(--warning)]"],
  ];

  function clearSelectedServices() {
    setShowChecklistDetails(false);
    setShowComparison(false);
    onClearSelected();
  }

  function removeSelectedService(slug: string) {
    const remainingCount = selected.length - 1;
    if (remainingCount === 0) setShowChecklistDetails(false);
    if (remainingCount < 2) setShowComparison(false);
    onToggleSelected(slug);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[color:var(--text-heading)]">Referral decision</h3>
          <button
            className="inline-flex min-h-tap items-center text-xs font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
            type="button"
            onClick={clearSelectedServices}
            disabled={selected.length === 0}
            title={selected.length === 0 ? "No selected services to clear" : "Clear selected services"}
          >
            Clear
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-[color:var(--text-heading)]">Selected services ({selected.length})</p>
        <div className="mt-3 grid gap-2">
          {selected.map((service, index) => (
            <button
              key={service.slug}
              type="button"
              onClick={() => removeSelectedService(service.slug)}
              aria-label={`Remove ${service.title} from comparison`}
              className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-bold text-[color:var(--clinical-accent-contrast)]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">
                  {service.title}
                </span>
                <span className="block truncate text-2xs font-semibold text-[color:var(--text-soft)]">
                  {text(service.cost, "Cost pending")} - {text(service.source?.status, "Source pending")}
                </span>
              </span>
              <X className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[color:var(--text-heading)]">Checklist</h3>
          <span className="text-xs font-semibold text-[color:var(--text-soft)]">Edit via result controls</span>
        </div>
        <div className="mt-4 grid gap-3 text-sm font-semibold text-[color:var(--text-muted)]">
          {rows.map(([label, count, Icon, color]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <Icon className={cn("h-4 w-4", color)} aria-hidden />
                {label}
              </span>
              <span className="font-bold text-[color:var(--text-heading)]">{count}</span>
            </div>
          ))}
        </div>
        <button
          className="mt-4 inline-flex min-h-tap items-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
          type="button"
          onClick={() => setShowChecklistDetails((current) => !current)}
          disabled={selected.length === 0}
          aria-expanded={checklistExpanded}
          aria-controls={checklistExpanded ? "service-checklist-details" : undefined}
        >
          {checklistExpanded ? "Hide details" : "Review details"} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        {checklistExpanded ? (
          <div id="service-checklist-details" className="mt-3 grid gap-3 border-t border-[color:var(--border)] pt-3">
            {selected.map((service) => (
              <div key={service.slug}>
                <p className="text-xs font-bold text-[color:var(--text-heading)]">{service.title}</p>
                <ul className="mt-1 grid gap-1 text-xs font-medium text-[color:var(--text-muted)]">
                  {(service.criteria ?? []).map((criterion) => (
                    <li key={criterion.label}>• {criterion.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[color:var(--text-heading)]">Source confidence</h3>
          <button
            className="inline-flex min-h-tap items-center text-xs font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
            type="button"
            onClick={() => setShowConfidenceDetails((current) => !current)}
            disabled={matches.length === 0}
            aria-expanded={confidenceExpanded}
            aria-controls={confidenceExpanded ? "service-confidence-details" : undefined}
          >
            {confidenceExpanded ? "Hide details" : "View details"}
          </button>
        </div>
        <div
          className="mt-4 flex h-3 overflow-hidden rounded-full bg-[color:var(--surface-inset)]"
          role="img"
          aria-label={`Source confidence: ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.unknown} unknown`}
        >
          {confidenceTotal > 0 ? (
            <>
              {counts.high ? <span className="bg-[color:var(--success)]" style={{ flexGrow: counts.high }} /> : null}
              {counts.medium ? (
                <span className="bg-[color:var(--warning)]" style={{ flexGrow: counts.medium }} />
              ) : null}
              {counts.low ? <span className="bg-[color:var(--danger)]" style={{ flexGrow: counts.low }} /> : null}
              {counts.unknown ? (
                <span className="bg-[color:var(--border-strong)]" style={{ flexGrow: counts.unknown }} />
              ) : null}
            </>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-4 text-center text-xs font-semibold text-[color:var(--text-soft)]">
          <span>
            High
            <br />
            <b className="text-[color:var(--text-heading)]">{counts.high}</b>
          </span>
          <span>
            Medium
            <br />
            <b className="text-[color:var(--text-heading)]">{counts.medium}</b>
          </span>
          <span>
            Low
            <br />
            <b className="text-[color:var(--text-heading)]">{counts.low}</b>
          </span>
          <span>
            Unknown
            <br />
            <b className="text-[color:var(--text-heading)]">{counts.unknown}</b>
          </span>
        </div>
        {confidenceExpanded ? (
          <div id="service-confidence-details" className="mt-3 grid gap-2 border-t border-[color:var(--border)] pt-3">
            {matches.slice(0, 8).map((service) => (
              <div key={service.slug} className="flex items-start justify-between gap-3 text-xs">
                <span className="font-semibold text-[color:var(--text-heading)]">{service.title}</span>
                <span className="shrink-0 text-[color:var(--text-muted)]">
                  {service.verification?.confidence ?? "Unknown"}
                </span>
              </div>
            ))}
            {matches.length > 8 ? (
              <p className="text-xs font-medium text-[color:var(--text-soft)]">+{matches.length - 8} more results</p>
            ) : null}
          </div>
        ) : null}
      </section>
      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!comparisonAvailable}
        title={comparisonAvailable ? "Compare selected services" : "Select at least two services before comparing"}
        onClick={() => setShowComparison((current) => !current)}
        aria-expanded={comparisonExpanded}
        aria-controls={comparisonExpanded ? "selected-services-comparison" : undefined}
      >
        {comparisonExpanded ? "Hide comparison" : "Compare selected"} ({selected.length})
      </button>
      {comparisonExpanded ? (
        <section
          id="selected-services-comparison"
          aria-label="Selected service comparison"
          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]"
        >
          {selected.map((service) => (
            <article key={service.slug} className="rounded-lg border border-[color:var(--border)] p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-[color:var(--text-heading)]">{service.title}</h4>
                <Link
                  href={`/services/${service.slug}`}
                  className="inline-flex min-h-tap items-center text-xs font-bold text-[color:var(--clinical-accent)] sm:min-h-0"
                >
                  Open
                </Link>
              </div>
              <dl className="mt-2 grid gap-2 text-xs">
                {[
                  ["Contact", text(service.primaryContact?.value)],
                  ["Eligibility", text(service.eligibility, "Eligibility pending")],
                  ["Cost", text(service.cost, "Cost pending")],
                  ["Source", text(service.source?.status, "Source pending")],
                  ["Confidence", text(service.verification?.confidence, "Unknown")],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
                    <dt className="font-semibold text-[color:var(--text-soft)]">{label}</dt>
                    <dd className="font-medium text-[color:var(--text-muted)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function ServicesNavigatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortValue, setSortValue] = useResultSort();
  const command = useSearchCommand();
  const urlQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
  const initialQuery = urlQuery || defaultQuery;
  const [localQuery, setLocalQuery] = useState(() => ({ urlQuery, value: initialQuery }));
  const query = localQuery.urlQuery === urlQuery ? localQuery.value : initialQuery;
  const deferredQuery = useDeferredValue(query);
  const registry = useRegistryRecords("service");
  const registryLoading = registry.status === "loading";
  // Demo mode is served by the registry API as status "ready" with fixture
  // records, so unauthorized/error must not silently fall back to fixtures —
  // the home and detail pages surface the same conditions as notices.
  const registryBlocked = registry.status === "unauthorized" || registry.status === "error";
  const searchableRecords = useMemo(
    () => (registry.status === "ready" ? registry.records : []),
    [registry.records, registry.status],
  );
  const matches = useMemo(() => {
    const ranked = rankServiceRecords(searchableRecords, deferredQuery);
    return ranked.length ? ranked.map((match) => match.service) : deferredQuery.trim() ? [] : searchableRecords;
  }, [deferredQuery, searchableRecords]);
  const scopedMatches = useMemo(() => {
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return matches;
    return matches.filter((service) => recordMatchesCommandScopes(service, scopes, "services"));
  }, [command?.commandScopes, matches]);
  const displayedMatches = useMemo(
    () => sortResultItems(scopedMatches, sortValue, (service) => service.title),
    [scopedMatches, sortValue],
  );
  const relevanceRankMap = useMemo(() => {
    const map = new Map<string, number>();
    scopedMatches.forEach((service, index) => {
      map.set(service.slug, index + 1);
    });
    return map;
  }, [scopedMatches]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[] | null>(null);
  const effectiveSelectedSlugs = selectedSlugs ?? searchableRecords.slice(0, 2).map((service) => service.slug);
  const selected = searchableRecords.filter((service) => effectiveSelectedSlugs.includes(service.slug));

  function toggleSelected(slug: string) {
    setSelectedSlugs((current) => {
      const selected = current ?? effectiveSelectedSlugs;
      return selected.includes(slug) ? selected.filter((item) => item !== slug) : [slug, ...selected].slice(0, 5);
    });
  }

  function applyServiceQuery(nextQuery: string) {
    const trimmedQuery = nextQuery.trim();
    setLocalQuery({ urlQuery, value: trimmedQuery });
    if (trimmedQuery) {
      router.push(appModeHomeHref("services", { query: trimmedQuery, focus: true, run: true }));
    }
  }

  return (
    <SearchResultsLayout
      testId="services-navigator"
      canvasClassName="bg-[color:var(--background)] text-[color:var(--text)]"
      resultsLabel="Referral services"
      header={
        <>
          <div
            id={modeHomeDesktopComposerSlotId}
            className="mode-home-composer-slot hidden w-full min-w-0 [&:not(:empty)]:block"
          />
          <Stepper />
          <SearchResultsHeaderBand
            modeId="services"
            query={query}
            matchCount={displayedMatches.length}
            loading={registryLoading}
            sortValue={sortValue}
            onSortChange={setSortValue}
          />
        </>
      }
      sidebar={
        <RightRail
          key={selected.length === 0 ? "empty" : selected.length === 1 ? "single" : "multiple"}
          matches={displayedMatches}
          selected={selected}
          onClearSelected={() => setSelectedSlugs([])}
          onToggleSelected={toggleSelected}
        />
      }
    >
      {registryLoading ? (
        <SearchResultsSkeleton />
      ) : registryBlocked ? (
        registry.status === "unauthorized" ? (
          <ModeHomeStatusNotice
            icon={ShieldAlert}
            title="Session expired"
            body="Your session expired. Sign in again to search private service records and referral pathways."
            actionHref="/"
            actionLabel="Open account setup"
          />
        ) : (
          <ModeHomeStatusNotice
            icon={ShieldAlert}
            title="Could not load services"
            body="The services registry could not be loaded. Try again shortly."
          />
        )
      ) : query.trim() && displayedMatches.length === 0 ? (
        <SearchResultsEmptyState
          modeId="services"
          query={query}
          onClearScopes={command?.onClearScopes}
          onTryExample={(example) => applyServiceQuery(example)}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-tight)]">
            <div className="flex min-w-0 items-start justify-between gap-2 bg-[color:var(--surface-chrome)] p-3 sm:gap-3 sm:p-4">
              <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-3 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
                <span className="hidden h-12 w-12 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] sm:grid">
                  <span className="text-lg font-extrabold leading-none sm:text-xl">{displayedMatches.length}</span>
                </span>
                <div className="min-w-0">
                  <p className="hidden text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)] sm:block">
                    Referral matches
                  </p>
                  <h1 className="text-2xl-minus font-extrabold leading-tight tracking-tight text-[color:var(--text-heading)] sm:mt-0.5 sm:text-3xl">
                    {displayedMatches.length} referral {displayedMatches.length === 1 ? "match" : "matches"}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-[color:var(--text-muted)] max-sm:max-w-[14rem]">
                    <span className="sm:hidden">
                      {sortValue === "alpha"
                        ? "Sorted A–Z for quick known-service lookup."
                        : "Best fit for crisis, ATSI-specific phone referral."}
                    </span>
                    <span className="hidden sm:inline">
                      {sortValue === "alpha"
                        ? "Sorted A–Z for quick known-service lookup."
                        : "Ranked for crisis support, ATSI-specific access, and phone referral."}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="inline-flex min-h-10 w-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-tight)] transition hover:border-[color:var(--clinical-accent-border)] hover:bg-[color:var(--clinical-accent-soft)] sm:min-h-tap sm:w-auto sm:px-4"
                  type="button"
                  aria-label="Open service filters"
                  disabled
                  title="Advanced filters are not available yet"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Filters</span>
                </button>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-[color:var(--border)] px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-hidden">
                {["Best fit", "Crisis", "ATSI-specific", "Phone referral", "Free", "WA"].map((chip, index) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      applyServiceQuery(
                        index === 0
                          ? defaultQuery
                          : chip === "ATSI-specific"
                            ? "Aboriginal Torres Strait Islander"
                            : chip,
                      )
                    }
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-xs font-bold transition hover:-translate-y-px hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                      index > 2 ? "max-sm:hidden" : "",
                      index === 0
                        ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLocalQuery({ urlQuery, value: "" })}
                className="min-h-8 shrink-0 rounded-full px-2 text-xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)] hover:text-[color:var(--clinical-accent-hover)] max-sm:hidden"
              >
                Clear all
              </button>
            </div>
          </div>
          <div data-testid="service-search-results" className="grid gap-3">
            {displayedMatches.map((service, index) => (
              <ServiceCard
                key={service.slug}
                service={service}
                index={index}
                relevanceRank={sortValue === "alpha" ? null : (relevanceRankMap.get(service.slug) ?? null)}
                selected={effectiveSelectedSlugs.includes(service.slug)}
                onToggleSelected={toggleSelected}
              />
            ))}
          </div>
          <UniversalSearchAlsoMatches modeId="services" query={query} />
        </>
      )}
    </SearchResultsLayout>
  );
}
