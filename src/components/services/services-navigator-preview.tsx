"use client";

import Link from "next/link";
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
  Menu,
  Mic,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { searchServiceRecords, serviceRecords, type ServiceRecord, type ServiceStatusChip } from "@/lib/services";

const defaultQuery = "13YARN crisis support aboriginal phone";

function visibleText(value: string | null | undefined, fallback = "Confirm locally") {
  return value?.trim() ? value.trim() : fallback;
}

function chipToneClass(tone: ServiceStatusChip["tone"] | undefined | null) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-700";
  if (tone === "warning") return "border-orange-200 bg-orange-50 text-orange-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function criterionCounts(records: ServiceRecord[]) {
  return records.reduce(
    (totals, service) => {
      for (const criterion of service.criteria ?? []) {
        if (criterion.tone === "meet") totals.meets += 1;
        if (criterion.tone === "caution") totals.cautions += 1;
        if (criterion.tone === "reject") totals.rejects += 1;
      }
      return totals;
    },
    { meets: 0, cautions: 0, rejects: 0 },
  );
}

function confidenceCounts(records: ServiceRecord[]) {
  return records.reduce(
    (totals, service) => {
      const confidence = service.verification?.confidence ?? "Unknown";
      if (confidence === "High") totals.high += 1;
      else if (confidence === "Medium") totals.medium += 1;
      else if (confidence === "Low") totals.low += 1;
      else totals.unknown += 1;
      return totals;
    },
    { high: 0, medium: 0, low: 0, unknown: 0 },
  );
}

function ServiceBadge({ chip }: { chip: ServiceStatusChip }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold",
        chipToneClass(chip.tone),
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {visibleText(chip.label, "Status")}
    </span>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="grid min-h-[74px] min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 overflow-hidden border-t border-slate-200 px-3 py-2 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
      <span className="grid h-8 w-8 place-items-center rounded-full text-[#00669a]" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
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
  compact = false,
}: {
  service: ServiceRecord;
  index: number;
  selected: boolean;
  onToggleSelected: (slug: string) => void;
  compact?: boolean;
}) {
  const rank = index + 1;
  const highlighted = rank <= 2;
  const contact = visibleText(service.primaryContact?.value);
  const route = visibleText(service.primaryContact?.detail ?? service.route, "Referral route pending");
  const eligibility = visibleText(service.eligibility, "Eligibility pending");
  const cost = visibleText(service.cost, "Cost pending");
  const tags = [...(service.catchments ?? []), ...(service.tags ?? [])].slice(0, compact ? 3 : 5);

  return (
    <article
      className={cn(
        "rounded-lg border bg-white shadow-[0_10px_24px_rgba(15,23,42,0.045)] transition",
        highlighted ? "border-[#58a7ff] ring-1 ring-[#58a7ff]/35" : "border-slate-200",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#007a78] text-sm font-bold text-white">
          {rank}
        </span>
        <div className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("min-w-0 font-bold leading-tight text-[#071844]", compact ? "text-base" : "text-lg")}>
              {service.title}
            </h3>
            {!compact && highlighted ? (
              <span className="rounded-full bg-[#007a78] px-2.5 py-1 text-[11px] font-bold text-white">Best fit</span>
            ) : null}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 overflow-hidden">
            {(service.statusChips ?? []).slice(0, compact ? 3 : 4).map((chip) => (
              <ServiceBadge key={`${service.slug}-${chip.label}`} chip={chip} />
            ))}
          </div>
          <p
            className={cn(
              "mt-2 max-w-full font-medium text-slate-600",
              compact ? "text-xs leading-5" : "text-sm leading-6",
            )}
          >
            {visibleText(service.subtitle ?? service.bestUse, "Open the record for referral details.")}
          </p>
        </div>
        <button
          type="button"
          aria-label={selected ? `Remove ${service.title} from selected services` : `Save ${service.title}`}
          onClick={() => onToggleSelected(service.slug)}
          className="grid h-9 w-9 place-items-center rounded-lg text-[#061740] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007a78]"
        >
          <Bookmark className={cn("h-5 w-5", selected && "fill-[#007a78] text-[#007a78]")} />
        </button>
      </div>

      <div
        className={cn(
          "mt-3 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white",
          compact ? "grid grid-cols-2" : "grid sm:grid-cols-2 md:grid-cols-4",
        )}
      >
        <Metric icon={Phone} label="Route / contact" value={contact} detail={route} />
        <Metric icon={Users} label="Eligibility" value={eligibility} detail="See details" />
        <Metric
          icon={ShieldCheck}
          label="Confidence"
          value={visibleText(service.verification?.confidence, "Unknown")}
          detail={visibleText(service.source?.status, "Source pending")}
        />
        <Metric
          icon={DollarSign}
          label="Cost"
          value={cost}
          detail={cost.toLowerCase().includes("free") ? "No cost" : "Confirm fees"}
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
          {(service.tags?.length ?? 0) + (service.catchments?.length ?? 0) > tags.length ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              +1
            </span>
          ) : null}
        </div>
        <div className="flex min-h-9 shrink-0 items-center gap-2">
          <Link
            href={`/services/${service.slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#061740] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007a78]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Link>
          <button
            type="button"
            onClick={() => onToggleSelected(service.slug)}
            className="inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-lg bg-[#007a78] px-3 text-xs font-bold text-white shadow-[0_8px_18px_rgba(0,122,120,0.18)] hover:bg-[#006d6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007a78]"
          >
            <Check className="h-4 w-4" />
            {selected ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SearchBar({
  value,
  onChange,
  compact = false,
  showSubmit = true,
}: {
  value: string;
  onChange: (next: string) => void;
  compact?: boolean;
  showSubmit?: boolean;
}) {
  return (
    <form
      className={cn(
        "grid min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)] focus-within:border-[#007a78]",
        showSubmit ? "grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]" : "grid-cols-[auto_minmax(0,1fr)_auto_auto]",
        compact ? "min-h-11 px-3" : "min-h-14 px-4",
      )}
      onSubmit={(event) => event.preventDefault()}
    >
      <Search className="h-5 w-5 text-[#061740]" aria-hidden />
      <label
        className="sr-only"
        htmlFor={compact ? "mobile-services-preview-search" : "desktop-services-preview-search"}
      >
        Search services
      </label>
      <input
        id={compact ? "mobile-services-preview-search" : "desktop-services-preview-search"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search services..."
        className="min-w-0 bg-transparent text-sm font-semibold text-[#061740] outline-none placeholder:text-slate-400"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-50"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <Mic className="h-5 w-5 text-[#061740]" aria-hidden />
      {showSubmit ? (
        <button
          type="submit"
          className="grid h-10 w-10 place-items-center rounded-full bg-[#007a78] text-white shadow-[0_8px_18px_rgba(0,122,120,0.24)]"
          aria-label="Run services search"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      ) : null}
    </form>
  );
}

function Header() {
  return (
    <header className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-200 bg-white px-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#007a78] text-white shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-6 text-[#071844]">Services Navigator</p>
          <p className="truncate text-xs font-semibold text-slate-500">Psychiatry referral directory</p>
        </div>
        <span className="mx-4 hidden h-9 w-px bg-slate-200 sm:block" aria-hidden />
        <button
          className="hidden min-h-11 min-w-44 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left shadow-sm sm:flex"
          type="button"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase text-slate-500">Mode</span>
            <span className="block text-sm font-bold text-[#061740]">Services</span>
          </span>
          <ChevronDown className="h-4 w-4 text-[#061740]" />
        </button>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#061740] shadow-sm"
          type="button"
        >
          Local only
        </button>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#061740] shadow-sm"
          type="button"
        >
          <Bookmark className="h-4 w-4" />
          Saved
          <span>2</span>
        </button>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e3f4f5] text-sm font-bold text-[#061740]">
          AK
        </span>
      </div>
    </header>
  );
}

function Stepper() {
  const steps = [
    ["1", "Search", "Find services"],
    ["2", "Shortlist", "Pick best options"],
    ["3", "Compare", "Review side by side"],
    ["4", "Refer", "Send with confidence"],
  ];
  return (
    <div className="hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid lg:grid-cols-4 lg:gap-3">
      {steps.map(([number, title, body], index) => (
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

function DesktopRightRail({
  matches,
  selected,
  onToggleSelected,
}: {
  matches: ServiceRecord[];
  selected: ServiceRecord[];
  onToggleSelected: (slug: string) => void;
}) {
  const criteria = criterionCounts(matches);
  const confidence = confidenceCounts(matches);
  const localConfirmationCount = matches.filter((service) =>
    (service.source?.status ?? "").toLowerCase().includes("confirmation"),
  ).length;
  const verifiedCount = matches.filter(
    (service) =>
      service.verification?.locallyVerified || (service.source?.status ?? "").toLowerCase().includes("source"),
  ).length;
  const checklistRows: Array<[string, number, LucideIcon, string]> = [
    ["Meets", criteria.meets, CircleCheck, "text-emerald-600"],
    ["Caution", criteria.cautions, CircleAlert, "text-orange-500"],
    ["Does not meet", criteria.rejects, CircleX, "text-red-600"],
    ["Source verified", verifiedCount, CircleCheck, "text-emerald-600"],
    ["Local confirmation", localConfirmationCount, CircleAlert, "text-orange-500"],
  ];

  return (
    <aside className="hidden space-y-4 xl:block">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#071844]">Referral decision</h3>
          <button className="text-xs font-bold text-blue-600" type="button">
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
                  {visibleText(service.cost, "Cost pending")} · {visibleText(service.source?.status, "Source pending")}
                </span>
              </span>
              <X className="h-4 w-4 text-slate-500" />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#071844]">Checklist</h3>
          <button className="text-xs font-bold text-blue-600" type="button">
            Edit
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
          {checklistRows.map(([label, count, Icon, color]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <Icon className={cn("h-4 w-4", color)} />
                {label}
              </span>
              <span className="font-bold text-[#071844]">{count}</span>
            </div>
          ))}
        </div>
        <button className="mt-4 inline-flex min-h-9 items-center gap-2 text-sm font-bold text-blue-600" type="button">
          Review details
          <ArrowRight className="h-4 w-4" />
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
            <b className="text-[#071844]">{confidence.high}</b>
          </span>
          <span>
            Medium
            <br />
            <b className="text-[#071844]">{confidence.medium}</b>
          </span>
          <span>
            Low
            <br />
            <b className="text-[#071844]">{confidence.low}</b>
          </span>
          <span>
            Unknown
            <br />
            <b className="text-[#071844]">{confidence.unknown}</b>
          </span>
        </div>
      </section>

      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#007a78] text-sm font-bold text-white shadow-[0_12px_24px_rgba(0,122,120,0.18)]"
        type="button"
      >
        Compare selected ({selected.length})
      </button>
      <section className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <span>
          <span className="block text-sm font-bold text-[#007a78]">Next step</span>
          <span className="block text-sm leading-5 text-slate-600">Compare services side by side before referral.</span>
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#007a78] text-white">
          <ArrowRight className="h-5 w-5" />
        </span>
      </section>
    </aside>
  );
}

function PhonePreview({
  query,
  onQueryChange,
  matches,
  selectedSlugs,
  onToggleSelected,
}: {
  query: string;
  onQueryChange: (next: string) => void;
  matches: ServiceRecord[];
  selectedSlugs: string[];
  onToggleSelected: (slug: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[430px] rounded-[2.75rem] border-[10px] border-black bg-white shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
      <div className="relative overflow-hidden rounded-[2rem] bg-white">
        <div className="absolute left-1/2 top-0 z-10 h-7 w-36 -translate-x-1/2 rounded-b-2xl bg-black" aria-hidden />
        <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 pt-5">
          <Menu className="h-5 w-5 text-[#061740]" />
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#007a78] text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0 truncate text-sm font-bold text-[#071844]">Services Navigator</span>
          </div>
          <Bookmark className="h-5 w-5 text-[#061740]" />
        </div>
        <div className="max-h-[720px] overflow-hidden px-4 pb-28 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#071844]">{matches.length} referral matches</h2>
              <p className="mt-1 text-xs font-medium leading-4 text-slate-500">
                Best fit for crisis, ATSI-specific, phone referral.
              </p>
            </div>
            <button
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#061740]"
              type="button"
            >
              Sort
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Best fit", "Crisis", "ATSI-specific", "+3"].map((chip, index) => (
              <span
                key={chip}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  index > 2 ? "max-sm:hidden" : "",
                  index === 0 ? "border-[#007a78] bg-[#007a78] text-white" : "border-slate-200 bg-white text-slate-600",
                )}
              >
                {chip}
              </span>
            ))}
          </div>
          <button
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-[#061740]"
            type="button"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
          <div className="mt-3 grid gap-3">
            {matches.slice(0, 3).map((service, index) => (
              <ServiceCard
                key={service.slug}
                service={service}
                index={index}
                selected={selectedSlugs.includes(service.slug)}
                onToggleSelected={onToggleSelected}
                compact
              />
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-[78px] z-20 flex min-h-14 items-center justify-between rounded-t-2xl bg-[#007a78] px-5 text-sm font-bold text-white shadow-[0_-12px_24px_rgba(0,122,120,0.2)]">
          <span>{selectedSlugs.length} selected</span>
          <span>Compare</span>
          <ArrowRight className="h-5 w-5" />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur">
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
            <button
              className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-[#061740]"
              type="button"
              aria-label="Add"
            >
              <Plus className="h-5 w-5" />
            </button>
            <SearchBar value={query} onChange={onQueryChange} compact showSubmit={false} />
            <button
              className="grid h-11 w-11 place-items-center rounded-full bg-[#007a78] text-white"
              type="button"
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ServicesNavigatorPreview() {
  const [query, setQuery] = useState(defaultQuery);
  const matches = useMemo(() => {
    const ranked = searchServiceRecords(query);
    return ranked.length ? ranked.map((match) => match.service) : serviceRecords;
  }, [query]);
  const [selectedSlugs, setSelectedSlugs] = useState(() => serviceRecords.slice(0, 2).map((service) => service.slug));
  const selectedServices = serviceRecords.filter((service) => selectedSlugs.includes(service.slug));

  function toggleSelected(slug: string) {
    setSelectedSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      return [slug, ...current].slice(0, 5);
    });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8fbfd] text-[#061740]">
      <div className="mx-auto w-full max-w-[1800px] overflow-hidden border-x border-slate-200 bg-white shadow-sm">
        <Header />
        <div className="grid gap-6 bg-[#fbfdff] p-4 pb-28 lg:p-6 lg:pb-28 2xl:grid-cols-[minmax(0,1fr)_430px] 2xl:items-start">
          <section className="min-w-0 space-y-4">
            <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-4 md:grid">
              <SearchBar value={query} onChange={setQuery} />
              <button
                className="hidden min-h-14 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-[#061740] shadow-sm md:inline-flex"
                type="button"
              >
                <SlidersHorizontal className="h-5 w-5" />
                Filters
              </button>
            </div>
            <Stepper />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-[#071844] md:text-3xl">
                      {matches.length} referral matches
                    </h1>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      Best fit for crisis, ATSI-specific, phone referral.
                    </p>
                  </div>
                  <button
                    className="hidden min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-[#061740] shadow-sm sm:inline-flex sm:min-h-11 sm:px-4"
                    type="button"
                  >
                    Sort
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
                  {["Best fit", "Crisis", "ATSI-specific", "Phone referral", "Free", "WA"].map((chip, index) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setQuery(index === 0 ? defaultQuery : chip)}
                      className={cn(
                        "min-h-8 rounded-full border px-3 text-xs font-bold",
                        index > 2 ? "max-sm:hidden" : "",
                        index === 0
                          ? "border-[#007a78] bg-[#007a78] text-white"
                          : "border-slate-200 bg-white text-slate-600",
                      )}
                    >
                      {chip}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="min-h-8 px-2 text-xs font-bold text-blue-600"
                  >
                    Clear all
                  </button>
                </div>
                <div className="grid gap-3">
                  {matches.map((service, index) => (
                    <ServiceCard
                      key={service.slug}
                      service={service}
                      index={index}
                      selected={selectedSlugs.includes(service.slug)}
                      onToggleSelected={toggleSelected}
                    />
                  ))}
                </div>
              </div>
              <DesktopRightRail matches={matches} selected={selectedServices} onToggleSelected={toggleSelected} />
            </div>
          </section>
          <aside className="hidden 2xl:block">
            <PhonePreview
              query={query}
              onQueryChange={setQuery}
              matches={matches}
              selectedSlugs={selectedSlugs}
              onToggleSelected={toggleSelected}
            />
          </aside>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 overflow-hidden border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur 2xl:hidden">
        <div className="relative mx-auto h-11 max-w-3xl">
          <button
            className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-[#061740]"
            type="button"
            aria-label="Add service search action"
          >
            <Plus className="h-5 w-5" />
          </button>
          <form
            className="mx-12 flex h-11 min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 shadow-[0_8px_22px_rgba(15,23,42,0.07)]"
            onSubmit={(event) => event.preventDefault()}
          >
            <Search className="h-5 w-5 shrink-0 text-[#061740]" aria-hidden />
            <label className="sr-only" htmlFor="services-preview-bottom-search">
              Search services
            </label>
            <input
              id="services-preview-bottom-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#061740] outline-none placeholder:text-slate-400"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-50"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <Mic className="hidden h-4 w-4 shrink-0 text-[#061740] min-[430px]:block" aria-hidden />
          </form>
          <button
            className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-[#007a78] text-white"
            type="button"
            aria-label="Send service search"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </main>
  );
}
