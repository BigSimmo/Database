"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  DollarSign,
  ExternalLink,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { SearchResultsLayout } from "@/components/clinical-dashboard/search-results-layout";
import {
  SearchResultsEmptyState,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";
import { useSearchCommand } from "@/components/clinical-dashboard/search-command-context";
import { appModeHomeHref } from "@/lib/app-modes";
import { recordMatchesCommandScopes } from "@/lib/search-command-surface";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";
import { rankServiceRecords, serviceRecords, type ServiceRecord, type ServiceStatusChip } from "@/lib/services";
import { useRegistryRecords } from "@/lib/use-registry-records";

const defaultQuery = "13YARN crisis support aboriginal phone";

function text(value: string | null | undefined, fallback = "Confirm locally") {
  return value?.trim() ? value.trim() : fallback;
}

function chipTone(tone: ServiceStatusChip["tone"] | undefined | null) {
  if (tone === "danger") return "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
  if (tone === "info") return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
  if (tone === "warning") return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  if (tone === "success") return "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]";
  return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
}

function serviceChipLabel(chip: ServiceStatusChip) {
  const label = text(chip.label, "Status");
  if (label.toLowerCase().includes("aboriginal and torres strait islander")) return "ATSI-specific";
  return label;
}

function metricCounts(records: ServiceRecord[]) {
  return records.reduce(
    (total, service) => {
      for (const criterion of service.criteria ?? []) {
        if (criterion.tone === "meet") total.meets += 1;
        if (criterion.tone === "caution") total.cautions += 1;
        if (criterion.tone === "reject") total.rejects += 1;
      }
      const confidence = service.verification?.confidence ?? "Unknown";
      if (confidence === "High") total.high += 1;
      else if (confidence === "Medium") total.medium += 1;
      else if (confidence === "Low") total.low += 1;
      else total.unknown += 1;
      if (service.verification?.locallyVerified || (service.source?.status ?? "").toLowerCase().includes("source")) {
        total.verified += 1;
      }
      if ((service.source?.status ?? "").toLowerCase().includes("confirmation")) total.localConfirmation += 1;
      return total;
    },
    { meets: 0, cautions: 0, rejects: 0, high: 0, medium: 0, low: 0, unknown: 0, verified: 0, localConfirmation: 0 },
  );
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
            <span className={cn("block text-sm font-bold", index === 0 ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-heading)]")}>
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
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold",
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
  selected,
  onToggleSelected,
}: {
  service: ServiceRecord;
  index: number;
  selected: boolean;
  onToggleSelected: (slug: string) => void;
}) {
  const rank = index + 1;
  const tags = [...(service.catchments ?? []), ...(service.tags ?? [])].slice(0, 4);

  return (
    <article
      data-testid={`service-search-result-${service.slug}`}
      className={cn(
        "rounded-lg border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]",
        rank <= 2
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
            <h3 className="min-w-0 text-lg font-bold leading-tight text-[color:var(--text-heading)] max-sm:text-base">{service.title}</h3>
            {rank <= 2 ? (
              <span className="rounded-full bg-[color:var(--clinical-accent)] px-2.5 py-1 text-2xs font-bold text-[color:var(--clinical-accent-contrast)]">Best fit</span>
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
          className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          aria-label={selected ? `Remove ${service.title} from selected services` : `Save ${service.title}`}
        >
          <Bookmark className={cn("h-5 w-5", selected && "fill-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]")} aria-hidden />
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
            className="inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
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
  const counts = metricCounts(matches);
  const rows: Array<[string, number, LucideIcon, string]> = [
    ["Meets", counts.meets, CircleCheck, "text-[color:var(--success)]"],
    ["Caution", counts.cautions, CircleAlert, "text-[color:var(--warning)]"],
    ["Does not meet", counts.rejects, CircleX, "text-[color:var(--danger)]"],
    ["Source verified", counts.verified, CircleCheck, "text-[color:var(--success)]"],
    ["Local confirmation", counts.localConfirmation, CircleAlert, "text-[color:var(--warning)]"],
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[color:var(--text-heading)]">Referral decision</h3>
          <button className="text-xs font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)]" type="button" onClick={onClearSelected}>
            Clear
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-[color:var(--text-heading)]">Selected services ({selected.length})</p>
        <div className="mt-3 grid gap-2">
          {selected.map((service, index) => (
            <button
              key={service.slug}
              type="button"
              onClick={() => onToggleSelected(service.slug)}
              className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left transition hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-xs font-bold text-[color:var(--clinical-accent-contrast)]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[color:var(--text-heading)]">{service.title}</span>
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
          <button className="text-xs font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)]" type="button">
            Edit
          </button>
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
        <button className="mt-4 inline-flex min-h-9 items-center gap-2 text-sm font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)]" type="button">
          Review details <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-tight)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[color:var(--text-heading)]">Source confidence</h3>
          <button className="text-xs font-bold text-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent-hover)]" type="button">
            View details
          </button>
        </div>
        <div className="mt-4 grid h-3 grid-cols-[3fr_3fr_1fr_1fr] overflow-hidden rounded-full bg-[color:var(--surface-inset)]">
          <span className="bg-[color:var(--success)]" />
          <span className="bg-[color:var(--warning)]" />
          <span className="bg-[color:var(--danger)]" />
          <span className="bg-[color:var(--border-strong)]" />
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
      </section>
      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--clinical-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        type="button"
      >
        Compare selected ({selected.length})
      </button>
    </div>
  );
}

export function ServicesNavigatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const command = useSearchCommand();
  const urlQuery = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
  const initialQuery = urlQuery || defaultQuery;
  const [localQuery, setLocalQuery] = useState(() => ({ urlQuery, value: initialQuery }));
  const query = localQuery.urlQuery === urlQuery ? localQuery.value : initialQuery;
  const registry = useRegistryRecords("service");
  const searchableRecords =
    registry.status === "ready" ? registry.records : registry.status === "loading" ? [] : serviceRecords;
  const matches = useMemo(() => {
    const ranked = rankServiceRecords(searchableRecords, query);
    return ranked.length ? ranked.map((match) => match.service) : query.trim() ? [] : searchableRecords;
  }, [query, searchableRecords]);
  const scopedMatches = useMemo(() => {
    const scopes = command?.commandScopes ?? [];
    if (!scopes.length) return matches;
    return matches.filter((service) => recordMatchesCommandScopes(service, scopes, "services"));
  }, [command?.commandScopes, matches]);
  const [selectedSlugs, setSelectedSlugs] = useState(() => serviceRecords.slice(0, 2).map((service) => service.slug));
  const selected = searchableRecords.filter((service) => selectedSlugs.includes(service.slug));

  function toggleSelected(slug: string) {
    setSelectedSlugs((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current].slice(0, 5),
    );
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
          <div className="xl:hidden">
            <SearchResultsHeaderBand modeId="services" query={query} matchCount={scopedMatches.length} />
          </div>
          <div className="hidden xl:block">
            <SearchResultsHeaderBand modeId="services" query={query} matchCount={scopedMatches.length} />
          </div>
        </>
      }
      sidebar={
        <RightRail
          matches={scopedMatches}
          selected={selected}
          onClearSelected={() => setSelectedSlugs([])}
          onToggleSelected={toggleSelected}
        />
      }
    >
      {query.trim() && scopedMatches.length === 0 ? (
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
                <span className="hidden h-12 w-12 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:grid">
                  <span className="text-lg font-extrabold leading-none sm:text-xl">{scopedMatches.length}</span>
                </span>
                <div className="min-w-0">
                  <p className="hidden text-3xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--clinical-accent)] sm:block">
                    Referral matches
                  </p>
                  <h1 className="text-[1.45rem] font-extrabold leading-tight tracking-tight text-[color:var(--text-heading)] sm:mt-0.5 sm:text-3xl">
                    {scopedMatches.length} referral {scopedMatches.length === 1 ? "match" : "matches"}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-[color:var(--text-muted)] max-sm:max-w-[14rem]">
                    <span className="sm:hidden">Best fit for crisis, ATSI-specific phone referral.</span>
                    <span className="hidden sm:inline">
                      Ranked for crisis support, ATSI-specific access, and phone referral.
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="inline-flex min-h-10 w-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-[#061740] shadow-sm transition hover:border-[#b8dedb] hover:bg-[#f8fcfc] sm:min-h-11 sm:w-auto sm:px-4"
                  type="button"
                  aria-label="Open service filters"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Filters</span>
                </button>
                <button
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#061740] shadow-sm transition hover:border-[#b8dedb] hover:bg-[#f8fcfc] sm:min-h-11 sm:px-4"
                  type="button"
                >
                  Sort <ChevronDown className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-[color:var(--border)] px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-hidden">
                {["Best fit", "Crisis", "ATSI-specific", "Phone referral", "Free", "WA"].map((chip, index) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => applyServiceQuery(index === 0 ? defaultQuery : chip)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-xs font-bold transition hover:-translate-y-px hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                      index > 2 ? "max-sm:hidden" : "",
                      index === 0
                        ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[0_5px_12px_rgba(0,122,120,0.16)]"
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
            {scopedMatches.map((service, index) => (
              <ServiceCard
                key={service.slug}
                service={service}
                index={index}
                selected={selectedSlugs.includes(service.slug)}
                onToggleSelected={toggleSelected}
              />
            ))}
          </div>
        </>
      )}
    </SearchResultsLayout>
  );
}
