"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  ExternalLink,
  FlaskConical,
  GitCompareArrows,
  HeartPulse,
  Info,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { useDifferentialSearch } from "@/components/clinical-dashboard/use-differential-catalog";
import { useResultSort } from "@/components/use-result-sort";
import { cn } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import { differentialRouteWithQuery, differentialSelectedCompareHref } from "@/lib/differentials-navigation";
import { differentialsMobileCompareAddonSlotId } from "@/lib/mode-home-composer";
import {
  composeDifferentialSearchResults,
  defaultDifferentialRecentQueries,
  type DifferentialSearchResultItem,
} from "@/lib/differential-search-composition";
import type { DifferentialRecord } from "@/lib/differential-snapshot";
import type { DocumentMatch } from "@/lib/types";
import { sortResultItems } from "@/lib/result-sort";

type DifferentialAction = {
  label: string;
  description: string;
  query: string;
  icon: LucideIcon;
  target: "search" | "presentations" | "diagnoses";
};

type RecentDifferential = {
  label: string;
  query: string;
  icon: LucideIcon;
};

type DifferentialResult = {
  id: string;
  kind: "presentation" | "diagnosis";
  title: string;
  subtitle: string;
  href: string;
  status: DifferentialRecord["status"];
  selected: boolean;
  matchLabel: string;
  tags: string[];
  icon: LucideIcon;
  safety?: string;
};

type DifferentialEvidenceState = "source-backed" | "guided";

const primaryActions: DifferentialAction[] = [
  {
    label: "Search presentations",
    description: "By symptom or scenario.",
    query: "acute confusion differential diagnosis",
    icon: Search,
    target: "presentations",
  },
  {
    label: "Compare differentials",
    description: "Likely causes, side by side.",
    query: "delirium vs dementia differential diagnosis",
    icon: GitCompareArrows,
    target: "diagnoses",
  },
  {
    label: "Recent work",
    description: "Pick up where you left off.",
    query: "recent differential diagnosis work",
    icon: Clock3,
    target: "search",
  },
];

const recentDifferentials: RecentDifferential[] = defaultDifferentialRecentQueries.map((query) => ({
  label: query.replace(/\bdifferential diagnosis\b/i, "").trim() || query,
  query: query.includes("differential") ? query : `${query} differential diagnosis`,
  icon: BrainCircuit,
}));

const candidateIconBySlug: Array<[string, LucideIcon]> = [
  ["substance", FlaskConical],
  ["withdrawal", FlaskConical],
  ["post-ictal", Activity],
  ["wernicke", BrainCircuit],
  ["hepatic", Stethoscope],
  ["meningitis", ShieldAlert],
  ["thyroid", HeartPulse],
  ["delirium", BrainCircuit],
];

/**
 * Mobile/tablet floating compare action. Portals into the search composer's
 * addon slot so it stays anchored beside the active result controls, but
 * renders as a self-contained floating pill so it reads as a batch-selection
 * action rather than composer chrome.
 */
function DifferentialsMobileCompareBar({
  selectedCount,
  selectedIds,
  query,
}: {
  selectedCount: number;
  selectedIds: Set<string>;
  query: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const phoneMediaQuery = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setHost(phoneMediaQuery.matches ? document.getElementById(differentialsMobileCompareAddonSlotId) : null);
    };
    sync();
    phoneMediaQuery.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      phoneMediaQuery.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  if (!host) return null;

  const hasSelection = selectedCount > 0;

  return createPortal(
    <div aria-live="polite" className="differentials-mobile-compare-fab">
      {hasSelection ? (
        <Link
          href={differentialSelectedCompareHref(query, selectedIds)}
          data-testid="differentials-compare-selected-mobile"
          className="differentials-mobile-compare-fab__button"
        >
          <GitCompareArrows className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate">Compare selected</span>
          <span className="nums grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-contrast)]/20 px-1.5 text-xs font-extrabold">
            {selectedCount}
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent-contrast)]/15">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </span>
        </Link>
      ) : (
        <p
          data-testid="differentials-compare-selected-mobile"
          className="differentials-mobile-compare-fab__button differentials-mobile-compare-fab__button--empty"
        >
          <GitCompareArrows className="h-5 w-5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
          <span className="truncate">Tick results to compare</span>
        </p>
      )}
    </div>,
    host,
  );
}

function statusLabel(status: DifferentialRecord["status"]) {
  if (status === "emergent") return "Emergent";
  if (status === "urgent") return "High";
  return "Investigations";
}

function statusTone(status: DifferentialRecord["status"]) {
  if (status === "emergent") {
    return "border-transparent bg-[color:var(--danger-solid)] text-[color:var(--danger-solid-contrast)]";
  }
  if (status === "urgent") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  return "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]";
}

function resultIcon(kind: DifferentialResult["kind"], slug: string) {
  if (kind === "presentation") return BrainCircuit;
  return candidateIconBySlug.find(([fragment]) => slug.includes(fragment))?.[1] ?? Stethoscope;
}

function tagText(value: string) {
  const cleaned = value.replaceAll("/", " / ").replace(/\s+/g, " ").trim();
  if (/^[A-Z0-9&+ -]{2,6}$/.test(cleaned)) return cleaned;
  return cleaned.toLowerCase();
}

function toDifferentialResult(item: DifferentialSearchResultItem): DifferentialResult {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    href: item.href,
    status: item.status,
    selected: false,
    matchLabel: item.matchLabel,
    tags: item.tags.map(tagText),
    icon: resultIcon(item.kind, item.slug),
    safety: item.safety,
  };
}

function StatusBadge({ status, className }: { status: DifferentialRecord["status"]; className?: string }) {
  return (
    <span
      data-testid="differential-status-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-2xs font-extrabold uppercase leading-tight tracking-normal",
        statusTone(status),
        className,
      )}
    >
      {status === "emergent" ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--danger-solid-contrast)]/90" aria-hidden />
      ) : null}
      {statusLabel(status)}
    </span>
  );
}

type KindFilter = "all" | "presentation" | "diagnosis";

const resultTypeTabFocusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function ResultTypeTabs({
  activeFilter,
  onFilterChange,
  allCount,
  presentationCount,
  diagnosisCount,
}: {
  activeFilter: KindFilter;
  onFilterChange: (filter: KindFilter) => void;
  allCount: number;
  presentationCount: number;
  diagnosisCount: number;
}) {
  const tabs = [
    { id: "all" as const, label: "All", count: allCount },
    { id: "presentation" as const, label: "Presentations", count: presentationCount },
    { id: "diagnosis" as const, label: "Diagnoses", count: diagnosisCount },
  ];

  // Single-select filters over one results list — modeled as a toggle group
  // (role="group" + aria-pressed), not ARIA tabs (which would need tabpanels,
  // aria-controls, and roving tabindex for content that does not exist here).
  return (
    <div
      data-testid="differential-result-type-tabs"
      role="group"
      aria-label="Result type"
      className="polished-scroll flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-1 shadow-[var(--shadow-inset)]"
    >
      {tabs.map((tab) => {
        const active = activeFilter === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            aria-label={`${tab.label} (${tab.count})`}
            onClick={() => onFilterChange(tab.id)}
            className={cn(
              "inline-flex min-h-tap shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-bold min-[390px]:text-sm",
              resultTypeTabFocusRing,
              active
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "nums rounded-full px-1.5 text-2xs leading-tight",
                active
                  ? "bg-[color:var(--clinical-accent-contrast)]/15 text-[color:var(--clinical-accent-contrast)]"
                  : "bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MatchBadge({ label }: { label: string }) {
  // Match quality is a relevance signal, not a safety one — keep it in the
  // accent family so red stays reserved for the emergent status badges.
  const tone =
    label === "Best match" || label === "High match"
      ? "text-[color:var(--clinical-accent)]"
      : "text-[color:var(--text-muted)]";
  return (
    <span className={cn("inline-flex items-center gap-1 text-2xs font-extrabold", tone)}>
      {label === "Best match" ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {label}
    </span>
  );
}

function Chip({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 min-w-0 max-w-full items-center rounded-md bg-[color:var(--surface-subtle)] px-2 text-2xs font-bold leading-none text-[color:var(--text-muted)]",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function SelectionToggle({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? "Remove" : "Add"} ${label} ${selected ? "from" : "to"} comparison`}
      onClick={onClick}
      className={cn(
        "grid h-tap w-tap shrink-0 place-items-center rounded-md border text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        selected
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
          : "border-[color:var(--border-strong)] bg-[color:var(--surface)] text-transparent hover:text-[color:var(--text-soft)]",
      )}
    >
      <Check className="h-4 w-4" aria-hidden />
    </button>
  );
}

function DesktopResultRow({
  result,
  index,
  isBest,
  selected,
  onToggle,
}: {
  result: DifferentialResult;
  index: number;
  isBest: boolean;
  selected: boolean;
  onToggle?: () => void;
}) {
  const Icon = result.icon;

  return (
    <article
      className={cn(
        "group grid min-h-[5.75rem] grid-cols-[2.75rem_4.25rem_minmax(0,1fr)_9.75rem_2.75rem] items-center gap-3 rounded-lg border bg-[color:var(--surface)] px-3.5 py-3 shadow-[var(--shadow-inset)] transition",
        isBest
          ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/40 shadow-[var(--shadow-tight)]"
          : "border-[color:var(--border)] hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)]",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-md border text-sm font-extrabold",
          isBest
            ? "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
        )}
      >
        {index + 1}
      </span>
      <Link
        href={result.href}
        className={cn(
          "grid h-14 w-14 place-items-center rounded-lg border transition group-hover:border-[color:var(--clinical-accent-border)]",
          isBest
            ? "border-[color:var(--danger-border)] bg-[color:var(--surface)] text-[color:var(--danger)]"
            : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
        )}
        aria-label={`Open ${result.title}`}
      >
        <Icon className="h-7 w-7 stroke-[1.75]" aria-hidden />
      </Link>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={result.href}
            className="min-w-0 text-base font-extrabold leading-5 text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)]"
          >
            <span className="line-clamp-1">{result.title}</span>
          </Link>
          <StatusBadge status={result.status} />
        </div>
        <p className="mt-1 line-clamp-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
          {result.subtitle}
        </p>
        <div className="mt-2 flex max-w-full flex-wrap gap-1.5">
          {result.tags.slice(0, 4).map((tag) => (
            <Chip key={`${result.id}-${tag}`}>{tag}</Chip>
          ))}
          {result.tags.length > 4 ? <Chip>{`+${result.tags.length - 4}`}</Chip> : null}
        </div>
      </div>
      <div className="grid gap-1.5 border-l border-[color:var(--border)] pl-3">
        <MatchBadge label={result.matchLabel} />
        <Link
          href={result.href}
          className="inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-[color:var(--clinical-accent)]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open page
        </Link>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-[color:var(--clinical-accent)]"
          >
            <GitCompareArrows className="h-4 w-4" aria-hidden />
            {selected ? "Compared" : "Compare"}
          </button>
        ) : null}
      </div>
      {onToggle ? <SelectionToggle selected={selected} onClick={onToggle} label={result.title} /> : <span />}
    </article>
  );
}

function MobileResultCard({
  result,
  index,
  selected,
  onToggle,
}: {
  result: DifferentialResult;
  index: number;
  selected: boolean;
  onToggle?: () => void;
}) {
  return (
    <article
      data-testid="differential-mobile-result-card"
      className="grid gap-2 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-start gap-2.5">
        <span
          data-testid="differential-mobile-result-rank"
          className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-sm font-extrabold text-[color:var(--text-muted)]"
        >
          {index + 1}
        </span>
        <div className="min-w-0">
          <Link
            href={result.href}
            className="block min-w-0 text-sm font-extrabold leading-5 text-[color:var(--text-heading)]"
          >
            <span className="line-clamp-2">{result.title}</span>
          </Link>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            <StatusBadge status={result.status} />
            <MatchBadge label={result.matchLabel} />
          </div>
          {result.subtitle ? (
            <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-4 text-[color:var(--text-muted)]">
              {result.subtitle}
            </p>
          ) : null}
        </div>
        {onToggle ? <SelectionToggle selected={selected} onClick={onToggle} label={result.title} /> : <span />}
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
        {result.tags.slice(0, 2).map((tag) => (
          <Chip
            key={`${result.id}-${tag}`}
            className="max-w-full px-2.5 py-1 text-xs font-semibold leading-snug"
          >
            {tag}
          </Chip>
        ))}
        {result.tags.length > 2 ? (
          <Chip className="shrink-0 px-2.5 py-1 text-xs font-semibold leading-snug">{`+${result.tags.length - 2}`}</Chip>
        ) : null}
      </div>
    </article>
  );
}

function BestAnswerCard({
  best,
  selected,
  onToggle,
  compact = false,
}: {
  best: DifferentialResult;
  selected?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}) {
  const Icon = best.icon;
  const tagLimit = compact ? 3 : best.tags.length;
  const visibleTags = best.tags.slice(0, tagLimit);
  const hiddenTagCount = best.tags.length - visibleTags.length;

  // Use danger styling for emergent, accent styling for routine results
  const isEmergent = best.status === "emergent";
  const cardBorderColor = isEmergent ? "var(--danger-border)" : "var(--clinical-accent-border)";
  const cardBgColor = isEmergent ? "var(--danger-soft)" : "var(--clinical-accent-soft)";
  const iconBorderColor = isEmergent ? "var(--danger-border)" : "var(--clinical-accent-border)";
  const iconColor = isEmergent ? "var(--danger)" : "var(--clinical-accent)";

  return (
    <section
      className={cn("rounded-lg border shadow-[var(--shadow-inset)]", compact ? "p-3.5" : "p-4")}
      style={{
        borderColor: `color-mix(in srgb, ${cardBorderColor}, transparent)`,
        backgroundColor: `color-mix(in srgb, ${cardBgColor}, transparent 45%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-lg border bg-[color:var(--surface)]",
              compact ? "h-12 w-12" : "h-14 w-14",
            )}
            style={{
              borderColor: `color-mix(in srgb, ${iconBorderColor}, transparent)`,
              color: `color-mix(in srgb, ${iconColor}, transparent)`,
            }}
          >
            <Icon className={cn("stroke-[1.8]", compact ? "h-7 w-7" : "h-8 w-8")} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-2xs font-extrabold uppercase text-[color:var(--text-muted)]">Best answer</p>
            <h2 className={cn("mt-1 font-extrabold leading-6", compact ? "text-base" : "text-lg")}>
              <Link
                href={best.href}
                className="text-[color:var(--text-heading)] transition hover:text-[color:var(--clinical-accent)]"
              >
                <span className={cn(compact && "line-clamp-2")}>{best.title}</span>
              </Link>
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={best.status} />
              <Link
                href={best.href}
                className="inline-flex min-h-tap items-center gap-1 text-xs font-bold text-[color:var(--clinical-accent)]"
              >
                Open page
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        {onToggle ? <SelectionToggle selected={Boolean(selected)} onClick={onToggle} label={best.title} /> : null}
      </div>
      <p className={cn("text-sm font-medium leading-6 text-[color:var(--text-muted)]", compact ? "mt-2.5" : "mt-3")}>
        {best.subtitle}
      </p>
      <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-2.5" : "mt-3")}>
        {visibleTags.map((tag) => (
          <Chip key={tag}>{tag}</Chip>
        ))}
        {hiddenTagCount > 0 ? <Chip>{`+${hiddenTagCount}`}</Chip> : null}
      </div>
    </section>
  );
}

function SafetyCard({ safety, query }: { safety: string; query: string }) {
  return (
    <section className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/45 p-4 shadow-[var(--shadow-inset)]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[color:var(--danger-border)] bg-[color:var(--surface)] text-[color:var(--danger)]">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.05em] text-[color:var(--danger)]">
            Safety first
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">{safety}</p>
          <Link
            href={differentialRouteWithQuery("/differentials/presentations", query)}
            className="mt-2 inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-[color:var(--clinical-accent)]"
          >
            View presentation guide
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function LikelyPresentationCard({ lead }: { lead: DifferentialResult }) {
  const points = [lead.subtitle, ...lead.tags, lead.safety]
    .filter((point): point is string => Boolean(point?.trim()))
    .slice(0, 4);

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Likely presentation
      </h2>
      <ul className="mt-3 grid gap-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
        {points.map((point) => (
          <li key={point} className="grid grid-cols-[0.45rem_minmax(0,1fr)] gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--clinical-accent)]" aria-hidden />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UrgencyCard({ results }: { results: DifferentialResult[] }) {
  const urgentResults = results.filter((result) => result.status === "emergent").slice(0, 3);

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Highest urgency
      </h2>
      <div className="mt-3 grid gap-2">
        {urgentResults.map((result) => (
          <Link
            key={result.id}
            href={result.href}
            className="grid min-h-tap grid-cols-[5.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] px-2 text-sm font-bold text-[color:var(--text-heading)] transition hover:border-[color:var(--clinical-accent-border)] hover:text-[color:var(--clinical-accent)]"
          >
            <StatusBadge status={result.status} />
            <span className="truncate">{result.title}</span>
            <ChevronRight className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

function SourceStatusCard({
  sourceCount,
  evidenceState,
  loading,
  sourcesChecked,
  onRunSourceSearch,
}: {
  sourceCount: number;
  evidenceState: DifferentialEvidenceState;
  loading: boolean;
  sourcesChecked: boolean;
  onRunSourceSearch: () => void;
}) {
  const hasSourceEvidence = evidenceState === "source-backed";

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Source status
      </h2>
      <div className="mt-3 grid gap-2 text-sm font-bold">
        <p className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[color:var(--clinical-accent)]">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {hasSourceEvidence ? "Source-backed" : "Guided local differential"}
          </span>
          <span className="text-[color:var(--text-muted)]">
            {hasSourceEvidence
              ? `${sourceCount.toLocaleString()} sources`
              : sourcesChecked
                ? "0 matches"
                : "Evidence pending"}
          </span>
        </p>
        <p className="flex items-center justify-between gap-3 text-[color:var(--warning)]">
          <span className="inline-flex items-center gap-2">
            <CircleHelp className="h-4 w-4" aria-hidden />
            {hasSourceEvidence ? "Imported catalogue" : sourcesChecked ? "Sources checked" : "Run source search"}
          </span>
          <span className="text-[color:var(--text-muted)]">
            {hasSourceEvidence
              ? `${sourceCount.toLocaleString()} source${sourceCount === 1 ? "" : "s"}`
              : sourcesChecked
                ? "No matches"
                : "Not yet checked"}
          </span>
        </p>
      </div>
      <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
        {hasSourceEvidence
          ? "Catalogue matches are ranked from the imported, locally reviewed differentials library."
          : sourcesChecked
            ? "No indexed documents matched this query. Showing catalogue-only results."
            : "Showing reviewed local differential records. Run source search to validate against indexed documents."}
      </p>
      {!hasSourceEvidence && !sourcesChecked ? (
        <button
          type="button"
          onClick={onRunSourceSearch}
          disabled={loading}
          className="mt-3 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60"
        >
          <Search className="h-4 w-4" aria-hidden />
          {loading ? "Searching sources" : "Run source search"}
        </button>
      ) : null}
    </section>
  );
}

function InterpretationRail({
  best,
  results,
  query,
  sourceCount,
  evidenceState,
  loading,
  sourcesChecked,
  onRunSourceSearch,
}: {
  best: DifferentialResult;
  results: DifferentialResult[];
  query: string;
  sourceCount: number;
  evidenceState: DifferentialEvidenceState;
  loading: boolean;
  sourcesChecked: boolean;
  onRunSourceSearch: () => void;
}) {
  const safetyLead = results.find((result) => result.status === "emergent") ?? best;

  return (
    <aside className="hidden min-w-0 gap-3 lg:grid" aria-label="Differential interpretation">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        Interpretation
        <Info className="h-4 w-4" aria-hidden />
      </h2>
      <BestAnswerCard best={best} />
      {safetyLead.safety ? <SafetyCard safety={safetyLead.safety} query={query} /> : null}
      {best.kind === "presentation" ? <LikelyPresentationCard lead={best} /> : null}
      <UrgencyCard results={results} />
      <SourceStatusCard
        sourceCount={sourceCount}
        evidenceState={evidenceState}
        loading={loading}
        sourcesChecked={sourcesChecked}
        onRunSourceSearch={onRunSourceSearch}
      />
      <p className="px-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
        Clinical decision support only. Review before use. No patient data stored.
      </p>
    </aside>
  );
}

function SearchResultsView({
  query,
  loading,
  documentMatches,
  evidenceQuery,
  onRunSearch,
}: {
  query: string;
  loading: boolean;
  documentMatches?: DocumentMatch[];
  evidenceQuery?: string | null;
  onRunSearch?: (query: string) => void;
}) {
  const [sortValue, setSortValue] = useResultSort();
  const catalog = useDifferentialSearch(query);
  const results = useMemo(
    () =>
      composeDifferentialSearchResults(catalog.matches.diagnoses, catalog.matches.presentations).map(
        toDifferentialResult,
      ),
    [catalog.matches],
  );
  const [kindFilter, setKindFilter] = useState<"all" | "presentation" | "diagnosis">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // Selection, filter, and sort follow the ranked result set: seed the top two
  // for comparison and drop stale ids whenever a new query changes the results
  // (render-time sync, matching the repo's set-state-in-render pattern).
  const resultSignature = results.map((result) => result.id).join("|");
  const [lastResultSignature, setLastResultSignature] = useState("");
  if (lastResultSignature !== resultSignature) {
    setLastResultSignature(resultSignature);
    setKindFilter("all");
    setSelectedIds(
      new Set(
        results
          .filter((result) => result.kind === "diagnosis")
          .slice(0, 2)
          .map((result) => result.id),
      ),
    );
  }

  const presentationCount = results.filter((result) => result.kind === "presentation").length;
  const diagnosisCount = results.length - presentationCount;
  const visibleResults = useMemo(
    () =>
      sortResultItems(
        kindFilter === "all" ? results : results.filter((result) => result.kind === kindFilter),
        sortValue,
        (result) => result.title,
      ),
    [kindFilter, results, sortValue],
  );
  const best = results[0] ?? null;
  // Same lead the desktop interpretation rail uses for its safety card.
  const safetyLead = results.find((result) => result.status === "emergent") ?? best;
  const comparisonIds = useMemo(
    () =>
      new Set(
        results
          .filter((result) => result.kind === "diagnosis" && selectedIds.has(result.id))
          .map((result) => result.id),
      ),
    [results, selectedIds],
  );
  const selectedCount = comparisonIds.size;
  // Catalogue results follow composer edits live, but document evidence only
  // updates on an executed source search — treat evidence fetched for a
  // different query as pending so the two panels never claim to be in sync.
  const evidenceIsCurrent = (evidenceQuery ?? "").trim().toLowerCase() === query.trim().toLowerCase();
  const currentDocumentMatches = evidenceIsCurrent ? documentMatches : undefined;
  const hasSourceEvidence = Boolean(currentDocumentMatches?.length);
  // Distinguish between "not searched yet" (undefined) and "searched with zero results" (defined but empty)
  const sourcesChecked = evidenceIsCurrent && documentMatches !== undefined;
  const evidenceState: DifferentialEvidenceState = hasSourceEvidence ? "source-backed" : "guided";
  // Count the sources that actually matched this search, never the whole
  // indexed library - the surrounding copy states these reflect real matches.
  const reviewedSourceCount = hasSourceEvidence ? (currentDocumentMatches?.length ?? 0) : 0;
  const catalogLoading = catalog.status === "loading";
  const catalogFailed = catalog.status === "error" || catalog.status === "unauthorized";

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rerunSearch() {
    const trimmedQuery = query.trim();
    if (trimmedQuery && onRunSearch) onRunSearch(trimmedQuery);
  }

  return (
    <div
      data-testid="differentials-search-results"
      // overflow-x-clip (not hidden): hidden forces overflow-y to auto and turns
      // this results canvas into a nested phone scrollport, stealing scroll from
      // #main-content. The fixed compare FAB and shell hide-on-scroll both assume
      // #main-content owns vertical scroll.
      className="mx-auto grid w-full max-w-[86rem] min-w-0 gap-3 overflow-x-clip px-4 pb-[calc(12.5rem+env(safe-area-inset-bottom))] min-[390px]:gap-4 sm:px-4 lg:px-0 lg:pb-0"
    >
      {/* Query context lives here on every breakpoint — on phones this is the
          only place the submitted query is visible above the fold. */}
      <SearchResultsHeaderBand
        modeId="differentials"
        query={query}
        matchCount={results.length}
        loading={loading || catalogLoading}
        sortValue={sortValue}
        onSortChange={setSortValue}
      />
      <p
        data-testid="differentials-catalogue-notice"
        className="flex min-w-0 items-start gap-2 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)]/50 px-3 py-1.5 text-xs font-semibold leading-5 text-[color:var(--info)] sm:py-2 sm:text-sm"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 text-pretty">
          Ranked from your imported differentials catalogue. Source counts reflect real matches from your indexed
          library.
        </span>
      </p>
      {catalogLoading ? (
        <div className="grid gap-2" aria-hidden data-testid="differentials-results-loading">
          {[0, 1, 2].map((placeholder) => (
            <div
              key={placeholder}
              className="h-24 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
            />
          ))}
        </div>
      ) : !best ? (
        <section
          data-testid={catalogFailed ? "differentials-catalogue-error" : "differentials-empty-results"}
          role={catalogFailed ? "alert" : undefined}
          className={cn(
            "grid gap-3 rounded-lg border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]",
            catalogFailed ? "border-[color:var(--warning-border)]" : "border-[color:var(--border)]",
          )}
        >
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">
            {catalogFailed
              ? catalog.status === "unauthorized"
                ? "Sign in again to search the differentials catalogue"
                : "The differentials catalogue could not be searched"
              : `No catalogue matches for “${query}”`}
          </h2>
          <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            {catalogFailed
              ? "Retry the search shortly, or browse the catalogue pages directly."
              : hasSourceEvidence
                ? `No imported differential matched this search, but ${reviewedSourceCount.toLocaleString()} indexed source ${
                    reviewedSourceCount === 1 ? "match is" : "matches are"
                  } available in the library.`
                : "Try a symptom, presentation, or diagnosis name — or browse the catalogue directly."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={differentialRouteWithQuery("/differentials/presentations", query)}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)]"
            >
              Browse presentations
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={differentialRouteWithQuery("/differentials/diagnoses", query)}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)]"
            >
              Browse diagnoses
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={rerunSearch}
              disabled={loading}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] disabled:cursor-wait disabled:opacity-60"
            >
              <Search className="h-4 w-4" aria-hidden />
              {loading ? "Searching sources" : "Run source search"}
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
          <section className="min-w-0 space-y-3" aria-label="Differential diagnosis results">
            <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-[color:var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5 text-[color:var(--clinical-accent)]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Catalogue ranking
                  </span>
                  <span className="hidden sm:inline">
                    {sortValue === "alpha"
                      ? "Sorted A–Z. Best-match evidence remains marked."
                      : hasSourceEvidence
                        ? "Source matches available. Review before use."
                        : "Run source search to validate against indexed local documents."}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-extrabold uppercase tracking-[0.09em] text-[color:var(--text-heading)]">
                  Catalogue matches <span className="text-[color:var(--text-muted)]">(ranked)</span>
                </h2>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                {!hasSourceEvidence && !sourcesChecked ? (
                  <button
                    type="button"
                    onClick={rerunSearch}
                    disabled={loading}
                    className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent)] disabled:cursor-wait disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" aria-hidden />
                    {loading ? "Searching sources" : "Run source search"}
                  </button>
                ) : sourcesChecked && !hasSourceEvidence ? (
                  <p className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/40 px-3 text-sm font-semibold text-[color:var(--text-heading)]">
                    <Info className="h-4 w-4 text-[color:var(--warning)]" aria-hidden />
                    No source matches found
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 lg:hidden">
              <BestAnswerCard
                best={best}
                compact
                selected={selectedIds.has(best.id)}
                onToggle={best.kind === "diagnosis" ? () => toggleSelected(best.id) : undefined}
              />
              {safetyLead?.safety ? (
                <p className="flex items-start gap-2 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/40 px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" aria-hidden />
                  <span>
                    <span className="font-extrabold text-[color:var(--danger)]">Safety first: </span>
                    {safetyLead.safety}
                  </span>
                </p>
              ) : null}
              <ResultTypeTabs
                activeFilter={kindFilter}
                onFilterChange={setKindFilter}
                allCount={results.length}
                presentationCount={presentationCount}
                diagnosisCount={diagnosisCount}
              />
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-[color:var(--text-muted)]">
                <span className="min-w-0 truncate">
                  <strong className="text-[color:var(--text-heading)]">
                    {visibleResults.length} result{visibleResults.length === 1 ? "" : "s"}
                  </strong>{" "}
                  ·{" "}
                  {sortValue === "alpha"
                    ? "Sorted A–Z"
                    : hasSourceEvidence
                      ? "Ranked by relevance"
                      : "Catalogue ranking"}
                </span>
              </div>
              {!hasSourceEvidence && !sourcesChecked ? (
                <section
                  aria-label="Source status"
                  className="grid gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/40 px-3 py-2 text-xs min-[390px]:flex min-[390px]:items-center min-[390px]:justify-between min-[390px]:gap-2 min-[390px]:py-1.5 min-[390px]:pr-1.5"
                >
                  <p className="min-w-0 font-semibold leading-4 text-[color:var(--text-heading)]">
                    Sources not checked for this query yet.
                  </p>
                  <button
                    type="button"
                    onClick={rerunSearch}
                    disabled={loading}
                    className="inline-flex min-h-tap w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60 min-[390px]:w-auto"
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden />
                    {loading ? "Searching…" : "Run source search"}
                  </button>
                </section>
              ) : sourcesChecked && !hasSourceEvidence ? (
                <section
                  aria-label="Source status"
                  className="flex items-center gap-2 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)]/40 py-2 pl-3 pr-3 text-xs"
                >
                  <Info className="h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden />
                  <p className="min-w-0 font-semibold leading-4 text-[color:var(--text-heading)]">
                    No source matches found for this query.
                  </p>
                </section>
              ) : null}
            </div>

            <div className="grid gap-2">
              {visibleResults.map((result, displayIndex) => {
                // Best-match styling remains tied to relevance while the row
                // number follows the user's chosen presentation order.
                const isBest = result.kind === best.kind && result.id === best.id;
                // Phone list hides the best-answer duplicate, so ranks must
                // skip that row or the first visible card starts at 2/3.
                const mobileIndex = visibleResults
                  .slice(0, displayIndex)
                  .filter((candidate) => !(candidate.kind === best.kind && candidate.id === best.id)).length;
                return (
                  // The best answer is already featured above the phone list,
                  // so its ranked duplicate only renders from the desktop
                  // breakpoint (hiding the wrapper keeps the grid gap clean).
                  <div key={`${result.kind}-${result.id}`} className={cn(isBest && "max-lg:hidden")}>
                    <div className="hidden lg:block">
                      <DesktopResultRow
                        result={result}
                        index={displayIndex}
                        isBest={isBest}
                        selected={selectedIds.has(result.id)}
                        onToggle={result.kind === "diagnosis" ? () => toggleSelected(result.id) : undefined}
                      />
                    </div>
                    {!isBest ? (
                      <div className="lg:hidden">
                        <MobileResultCard
                          result={result}
                          index={mobileIndex}
                          selected={selectedIds.has(result.id)}
                          onToggle={result.kind === "diagnosis" ? () => toggleSelected(result.id) : undefined}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <Link
              href={differentialRouteWithQuery("/differentials/diagnoses", query)}
              className="hidden min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] lg:inline-flex"
            >
              View all catalogue matches ({results.length})
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>

            {selectedCount > 0 ? (
              <Link
                href={differentialSelectedCompareHref(query, comparisonIds)}
                className="hidden min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-base font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-elevated)] transition hover:bg-[color:var(--clinical-accent-hover)] lg:inline-flex"
              >
                <GitCompareArrows className="h-5 w-5" aria-hidden />
                Compare selected
                <span className="nums grid h-7 min-w-7 place-items-center rounded-full bg-[color:var(--clinical-accent-contrast)]/20 px-1.5 text-sm">
                  {selectedCount}
                </span>
                <ChevronRight className="ml-auto h-5 w-5" aria-hidden />
              </Link>
            ) : (
              <p className="hidden min-h-14 w-full items-center justify-center gap-3 rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-muted)] lg:inline-flex">
                <GitCompareArrows className="h-5 w-5 text-[color:var(--text-soft)]" aria-hidden />
                Tick results to compare them side by side
              </p>
            )}
          </section>

          <InterpretationRail
            best={best}
            results={results}
            query={query}
            sourceCount={reviewedSourceCount}
            evidenceState={evidenceState}
            loading={loading}
            sourcesChecked={sourcesChecked}
            onRunSourceSearch={rerunSearch}
          />
        </div>
      )}

      {best ? (
        <DifferentialsMobileCompareBar selectedCount={selectedCount} selectedIds={comparisonIds} query={query} />
      ) : null}

      <UniversalSearchAlsoMatches modeId="differentials" query={query} />

      <p className="pb-3 text-center text-xs font-medium text-[color:var(--text-muted)] lg:hidden">
        Clinical decision support only. Review before use.
      </p>
    </div>
  );
}

export function DifferentialsHome({
  query,
  loading,
  searchSubmitted,
  documentMatches,
  evidenceQuery,
  onQueryChange,
  onSuggestedSearch,
  onRunSearch,
  onOpenPresentations,
  onOpenDiagnoses,
  desktopComposerSlotId,
}: {
  query: string;
  loading: boolean;
  searchSubmitted?: boolean;
  documentMatches?: DocumentMatch[];
  evidenceQuery?: string | null;
  realDataReady?: boolean;
  authUnavailable?: boolean;
  apiUnavailable?: boolean;
  setupWarning?: string | null;
  onQueryChange?: (query: string) => void;
  onSuggestedSearch?: (query: string) => void;
  onRunSearch?: (query: string) => void;
  onOpenPresentations?: (query: string) => void;
  onOpenDiagnoses?: (query: string) => void;
  desktopComposerSlotId?: string;
}) {
  const router = useRouter();
  const trimmedQuery = query.trim();
  const hasEvidenceMatches = Boolean(documentMatches?.length);

  function runSearch(nextQuery = query) {
    const searchText = nextQuery.trim();
    if (!searchText) return;
    if (onRunSearch) {
      onRunSearch(searchText);
      return;
    }
    router.push(appModeHomeHref("differentials", { query: searchText, run: true, focus: true }));
  }

  function handleSuggestedSearch(nextQuery: string) {
    onQueryChange?.(nextQuery);
    if (onSuggestedSearch) {
      onSuggestedSearch(nextQuery);
      return;
    }
    router.push(appModeHomeHref("differentials", { query: nextQuery, run: true, focus: true }));
  }

  function handleAction(action: DifferentialAction) {
    if (action.target === "presentations") {
      if (onOpenPresentations) onOpenPresentations(action.query);
      else router.push(differentialRouteWithQuery("/differentials/presentations", action.query));
      return;
    }
    if (action.target === "diagnoses") {
      if (onOpenDiagnoses) onOpenDiagnoses(action.query);
      else router.push(differentialRouteWithQuery("/differentials/diagnoses", action.query));
      return;
    }
    runSearch(action.query);
  }

  // Only surface ranked results once an actual search has run (submitted,
  // loading, or evidence matches present) — not on every keystroke. The
  // catalogue results are the primary content, so a submitted search with
  // zero document evidence still shows the ranked catalogue view.
  if (trimmedQuery && (loading || searchSubmitted || hasEvidenceMatches)) {
    return (
      <SearchResultsView
        query={trimmedQuery}
        loading={loading}
        documentMatches={documentMatches}
        evidenceQuery={evidenceQuery}
        onRunSearch={runSearch}
      />
    );
  }

  return (
    <div data-testid="differentials-home" className="w-full">
      <ModeHomeTemplate
        testId="differentials-home-template"
        title="Differentials"
        subtitle="Match your catalogue against your indexed library."
        icon={BrainCircuit}
        headingLevel={1}
        desktopComposerSlotId={desktopComposerSlotId}
        actionsLabel="Differential actions"
        actions={primaryActions.map((action) => ({
          title: action.label,
          description: action.description,
          icon: action.icon,
          onClick: () => handleAction(action),
          disabled: loading,
        }))}
        pillsTitle={hasEvidenceMatches ? "Library matches" : "Recent work"}
        pillsAction={
          <button
            type="button"
            onClick={() => router.push("/differentials/presentations?q=recent+differential+review")}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-full px-2 text-xs font-bold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-sm"
          >
            View all
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        }
        pills={
          hasEvidenceMatches
            ? documentMatches?.slice(0, 4).map((match) => ({
                label: match.title,
                icon: FlaskConical,
                onClick: () => handleSuggestedSearch(match.title),
              }))
            : recentDifferentials.map((item) => ({
                label: item.label,
                icon: item.icon,
                onClick: () => handleSuggestedSearch(item.query),
              }))
        }
        footer={<ModeHomeVerificationFooter icon={ShieldCheck} label="Decision support" body="Review before use" />}
      />
    </div>
  );
}
