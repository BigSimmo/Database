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
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "warning") return "border-orange-200 bg-orange-50 text-orange-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
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
    <div className="hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid lg:grid-cols-4 lg:gap-3">
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
              index === 0 ? "border-[#007a78] bg-[#007a78] text-white" : "border-slate-300 bg-white text-slate-500",
            )}
          >
            {number}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-sm font-bold", index === 0 ? "text-[#007a78]" : "text-[#061740]")}>
              {title}
            </span>
            <span className="block truncate text-xs font-semibold text-slate-500">{body}</span>
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
        "grid min-h-[66px] min-w-0 grid-cols-[1.8rem_minmax(0,1fr)] items-center gap-2 overflow-hidden border-l border-t border-slate-200 px-3 py-2",
        className,
      )}
    >
      <Icon className="h-5 w-5 text-[#00669a]" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold leading-4 text-slate-500">{label}</span>
        <span className="block truncate text-sm font-bold leading-5 text-[#061740]">{value}</span>
        <span className="block truncate text-[11px] font-medium leading-4 text-slate-500">{detail}</span>
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
        "rounded-lg border bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)]",
        rank <= 2 ? "border-[#58a7ff] ring-1 ring-[#58a7ff]/35" : "border-slate-200",
      )}
    >
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#007a78] text-sm font-bold text-white">
          {rank}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-lg font-bold leading-tight text-[#071844] max-sm:text-base">{service.title}</h3>
            {rank <= 2 ? (
              <span className="rounded-full bg-[#007a78] px-2.5 py-1 text-[11px] font-bold text-white">Best fit</span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(service.statusChips ?? []).slice(0, 3).map((chip) => (
              <Chip key={`${service.slug}-${chip.label}`} chip={chip} />
            ))}
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
            {text(service.subtitle ?? service.bestUse, "Open the record for referral details.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggleSelected(service.slug)}
          className="grid h-9 w-9 place-items-center rounded-lg text-[#061740] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007a78]"
          aria-label={selected ? `Remove ${service.title} from selected services` : `Save ${service.title}`}
        >
          <Bookmark className={cn("h-5 w-5", selected && "fill-[#007a78] text-[#007a78]")} aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-4">
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
                "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600",
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
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#061740] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007a78]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Open
          </Link>
          <button
            type="button"
            onClick={() => onToggleSelected(service.slug)}
            className="inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-lg bg-[#007a78] px-3 text-xs font-bold text-white shadow-[0_8px_18px_rgba(0,122,120,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007a78]"
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
    ["Meets", counts.meets, CircleCheck, "text-emerald-600"],
    ["Caution", counts.cautions, CircleAlert, "text-orange-500"],
    ["Does not meet", counts.rejects, CircleX, "text-red-600"],
    ["Source verified", counts.verified, CircleCheck, "text-emerald-600"],
    ["Local confirmation", counts.localConfirmation, CircleAlert, "text-orange-500"],
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#071844]">Referral decision</h3>
          <button className="text-xs font-bold text-blue-600" type="button" onClick={onClearSelected}>
            Clear
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-[#071844]">Selected services ({selected.length})</p>
        <div className="mt-3 grid gap-2">
          {selected.map((service, index) => (
            <button
              key={service.slug}
              type="button"
              onClick={() => onToggleSelected(service.slug)}
              className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#007a78] text-xs font-bold text-white">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[#071844]">{service.title}</span>
                <span className="block truncate text-[11px] font-semibold text-slate-500">
                  {text(service.cost, "Cost pending")} - {text(service.source?.status, "Source pending")}
                </span>
              </span>
              <X className="h-4 w-4 text-slate-500" aria-hidden />
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#071844]">Checklist</h3>
          <button className="text-xs font-bold text-blue-600" type="button">
            Edit
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
          {rows.map(([label, count, Icon, color]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <Icon className={cn("h-4 w-4", color)} aria-hidden />
                {label}
              </span>
              <span className="font-bold text-[#071844]">{count}</span>
            </div>
          ))}
        </div>
        <button className="mt-4 inline-flex min-h-9 items-center gap-2 text-sm font-bold text-blue-600" type="button">
          Review details <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#071844]">Source confidence</h3>
          <button className="text-xs font-bold text-blue-600" type="button">
            View details
          </button>
        </div>
        <div className="mt-4 grid h-3 grid-cols-[3fr_3fr_1fr_1fr] overflow-hidden rounded-full bg-slate-100">
          <span className="bg-emerald-600" />
          <span className="bg-orange-500" />
          <span className="bg-red-600" />
          <span className="bg-slate-300" />
        </div>
        <div className="mt-3 grid grid-cols-4 text-center text-xs font-semibold text-slate-500">
          <span>
            High
            <br />
            <b className="text-[#071844]">{counts.high}</b>
          </span>
          <span>
            Medium
            <br />
            <b className="text-[#071844]">{counts.medium}</b>
          </span>
          <span>
            Low
            <br />
            <b className="text-[#071844]">{counts.low}</b>
          </span>
          <span>
            Unknown
            <br />
            <b className="text-[#071844]">{counts.unknown}</b>
          </span>
        </div>
      </section>
      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#007a78] text-sm font-bold text-white shadow-[0_12px_24px_rgba(0,122,120,0.18)]"
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
  const searchableRecords = registry.status === "ready" ? registry.records : serviceRecords;
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
      canvasClassName="bg-[#f8fbfd] text-[#061740]"
      resultsLabel="Referral services"
      header={
        <>
          <div
            id={modeHomeDesktopComposerSlotId}
            className="mode-home-composer-slot hidden w-full min-w-0 sm:[&:not(:empty)]:block"
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
          <div className="overflow-hidden rounded-lg border border-[#d7e7f0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex min-w-0 items-start justify-between gap-2 bg-[linear-gradient(90deg,#f3fbfb_0%,#ffffff_62%)] p-3 sm:gap-3 sm:p-4">
              <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-3 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
                <span className="hidden h-12 w-12 place-items-center rounded-lg border border-[#b8dedb] bg-[#e6f6f4] text-[#007a78] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:grid">
                  <span className="text-lg font-extrabold leading-none sm:text-xl">{scopedMatches.length}</span>
                </span>
                <div className="min-w-0">
                  <p className="hidden text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#007a78] sm:block">
                    Referral matches
                  </p>
                  <h1 className="text-[1.45rem] font-extrabold leading-tight tracking-tight text-[#071844] sm:mt-0.5 sm:text-3xl">
                    {scopedMatches.length} referral {scopedMatches.length === 1 ? "match" : "matches"}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-slate-600 max-sm:max-w-[14rem]">
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
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-hidden">
                {["Best fit", "Crisis", "ATSI-specific", "Phone referral", "Free", "WA"].map((chip, index) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => applyServiceQuery(index === 0 ? defaultQuery : chip)}
                    className={cn(
                      "min-h-8 rounded-full border px-3 text-xs font-bold transition hover:-translate-y-px hover:shadow-sm",
                      index > 2 ? "max-sm:hidden" : "",
                      index === 0
                        ? "border-[#007a78] bg-[#007a78] text-white shadow-[0_5px_12px_rgba(0,122,120,0.16)]"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLocalQuery({ urlQuery, value: "" })}
                className="min-h-8 shrink-0 rounded-full px-2 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700 max-sm:hidden"
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
