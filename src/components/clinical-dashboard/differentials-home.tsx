"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BrainCircuit,
  Check,
  ChevronRight,
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

import {
  SearchResultsHeaderBand,
  type AppliedFilterChip,
} from "@/components/clinical-dashboard/search-results-header-band";
import {
  ResultFilterSheet,
  ResultFilterTrigger,
  type ResultFilterOption,
  resultFilterGroup,
} from "@/components/clinical-dashboard/result-filter-control";
import { UniversalSearchAlsoMatches } from "@/components/clinical-dashboard/universal-search-also-matches";
import { useDifferentialSearch } from "@/components/clinical-dashboard/use-differential-catalog";
import { useResultSort } from "@/components/use-result-sort";
import { Chip as DesignChip } from "@/components/ui/chip";
import { cn } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import {
  differentialIdsFromSearchParams,
  differentialRouteWithQuery,
  differentialSelectedCompareHref,
  syncDifferentialSelectionIdsToUrl,
} from "@/lib/differentials-navigation";
import { differentialsMobileCompareAddonSlotId } from "@/lib/mode-home-composer";
import {
  composeDifferentialSearchResults,
  type DifferentialSearchResultItem,
} from "@/lib/differential-search-composition";
import type { DifferentialRecord } from "@/lib/differential-snapshot";
import type { DocumentMatch } from "@/lib/types";
import { sortResultItems } from "@/lib/result-sort";

type DifferentialResult = {
  id: string;
  kind: "presentation" | "diagnosis";
  title: string;
  scopeLabel?: string;
  subtitle: string;
  href: string;
  status: DifferentialRecord["status"];
  selected: boolean;
  matchLabel: string;
  tags: string[];
  clinicalCues: string[];
  nextSteps: string[];
  icon: LucideIcon;
  safety?: string;
};

type DifferentialEvidenceState = "source-backed" | "guided";

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
 * Mobile/tablet compare action. Portals into the search composer's addon slot
 * so it sits above the search pill as dock chrome and hides/reveals with it.
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
          <GitCompareArrows className="h-5 w-5 shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
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

function clinicalCueTexts(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) =>
    value
      .split(/\s*\/\s*/)
      .map(tagText)
      .flatMap((cue) => {
        if (!cue) return [];
        const key = cue.toLocaleLowerCase("en-AU");
        if (seen.has(key)) return [];
        seen.add(key);
        return [cue];
      }),
  );
}

function toDifferentialResult(item: DifferentialSearchResultItem, query: string): DifferentialResult {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    scopeLabel: item.scopeLabel,
    subtitle: item.subtitle,
    // Presentation comparisons now own the shared mode bar. Preserve the
    // originating search query so its Search tab can return to these results.
    href: item.kind === "presentation" ? differentialRouteWithQuery(item.href, query) : item.href,
    status: item.status,
    selected: false,
    matchLabel: item.matchLabel,
    tags: item.tags.map(tagText),
    clinicalCues: clinicalCueTexts(item.clinicalCues),
    nextSteps: item.nextSteps,
    icon: resultIcon(item.kind, item.slug),
    safety: item.safety,
  };
}

function ResultTypeBadge({ kind }: { kind: DifferentialResult["kind"] }) {
  const Icon = kind === "presentation" ? BrainCircuit : Stethoscope;
  return (
    <span
      data-testid="differential-result-type-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-2xs font-extrabold leading-tight",
        kind === "presentation"
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)]",
      )}
    >
      <Icon className="size-icon-xs" aria-hidden />
      {kind === "presentation" ? "Presentation" : "Differential"}
    </span>
  );
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
type UrgencyFilter = "all" | DifferentialRecord["status"];

function MatchBadge({ label }: { label: string }) {
  // Match quality is a relevance signal, not a source-verification or safety
  // signal. Keep it in the accent family while red remains reserved for
  // emergent clinical status.
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

function Chip({ children }: { children: string }) {
  return (
    <DesignChip size="compact" appearance={{ kind: "information", tone: "quiet" }} wrap className="min-w-0 max-w-full">
      {children}
    </DesignChip>
  );
}

function SelectionCheckbox({ selected, onChange, label }: { selected: boolean; onChange: () => void; label: string }) {
  return (
    <label
      data-testid="differential-selection-target"
      className="group grid size-tap shrink-0 cursor-pointer place-items-center rounded-md"
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onChange}
        aria-label={`${selected ? "Remove" : "Add"} ${label} ${selected ? "from" : "to"} comparison`}
        className="peer sr-only"
      />
      <span
        data-testid="differential-selection-box"
        className={cn(
          "grid size-6 place-items-center rounded-sm border text-transparent transition group-hover:border-[color:var(--clinical-accent-border)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
          selected
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
            : "border-[color:var(--border-strong)] bg-[color:var(--surface)]",
        )}
        aria-hidden="true"
      >
        <Check aria-hidden="true" className="size-icon-sm stroke-[2.5]" />
      </span>
    </label>
  );
}

function DesktopResultRow({
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
  const Icon = result.icon;

  return (
    <article
      data-testid="differential-compact-result"
      className="group grid min-h-[5.75rem] grid-cols-[2.75rem_4.25rem_minmax(0,1fr)_7rem_var(--spacing-tap)] items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-3 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--clinical-accent-border)] hover:shadow-[var(--shadow-soft)]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-sm font-extrabold text-[color:var(--text-muted)]">
        {index + 1}
      </span>
      <span className="grid h-14 w-14 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] transition group-hover:border-[color:var(--clinical-accent-border)]">
        <Icon className="h-7 w-7 stroke-[1.75]" aria-hidden />
      </span>
      <div className="min-w-0">
        <Link
          href={result.href}
          className="block min-w-0 rounded-md text-base font-extrabold leading-5 text-[color:var(--text-heading)] hover:text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="line-clamp-1">{result.title}</span>
            <ResultTypeBadge kind={result.kind} />
            <StatusBadge status={result.status} />
          </div>
          {result.scopeLabel ? (
            <p className="mt-1 line-clamp-1 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
              {result.scopeLabel}
            </p>
          ) : null}
          <p className="mt-1 line-clamp-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
            {result.subtitle}
          </p>
        </Link>
        <p className="mt-2 text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Clinical cues
        </p>
        <div className="mt-1 flex max-w-full flex-wrap gap-1.5">
          {result.clinicalCues.slice(0, 4).map((tag, cueIndex) => (
            <Chip key={`${result.id}-cue-${cueIndex}-${tag}`}>{tag}</Chip>
          ))}
          {result.clinicalCues.length > 4 ? <Chip>{`+${result.clinicalCues.length - 4}`}</Chip> : null}
        </div>
      </div>
      <div className="grid min-h-10 place-items-center border-l border-[color:var(--border)] pl-3">
        <MatchBadge label={result.matchLabel} />
      </div>
      {onToggle ? <SelectionCheckbox selected={selected} onChange={onToggle} label={result.title} /> : <span />}
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
      className="grid gap-2.5 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          data-testid="differential-mobile-result-rank"
          aria-label={`Result ${index + 1}`}
          className="nums inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 text-xs font-extrabold text-[color:var(--text-muted)]"
        >
          {index + 1}
        </span>
        <Link
          href={result.href}
          className="block min-w-0 flex-1 rounded-md text-sm font-extrabold leading-5 text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          <span className="line-clamp-2">{result.title}</span>
        </Link>
        {onToggle ? (
          <SelectionCheckbox selected={selected} onChange={onToggle} label={result.title} />
        ) : (
          <ChevronRight className="mt-1 size-icon-md shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ResultTypeBadge kind={result.kind} />
        <StatusBadge status={result.status} />
        <MatchBadge label={result.matchLabel} />
      </div>
      {result.scopeLabel ? (
        <p className="text-xs font-semibold leading-5 text-[color:var(--text-heading)]">{result.scopeLabel}</p>
      ) : null}
      {result.subtitle ? (
        <p className="line-clamp-2 text-xs font-medium leading-4 text-[color:var(--text-muted)]">{result.subtitle}</p>
      ) : null}
      <div className="min-w-0">
        <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Clinical cues
        </p>
        <div className="mt-1 flex min-w-0 max-w-full flex-wrap gap-1.5">
          {result.clinicalCues.slice(0, 3).map((tag, cueIndex) => (
            <Chip key={`${result.id}-cue-${cueIndex}-${tag}`}>{tag}</Chip>
          ))}
        </div>
      </div>
    </article>
  );
}

function conciseCueText(cues: string[]) {
  return cues
    .map((cue) => cue.trim())
    .filter(Boolean)
    .reduce<string[]>((visible, cue) => {
      const normalizedCue = cue.toLowerCase();
      if (visible.some((existing) => existing.toLowerCase().includes(normalizedCue))) return visible;
      return [...visible.filter((existing) => !normalizedCue.includes(existing.toLowerCase())), cue];
    }, [])
    .join(" · ");
}

function BestMatchReasoningPanel({ result, compact }: { result: DifferentialResult; compact: boolean }) {
  const sections = [
    { label: "Why considered", value: result.subtitle, icon: Check },
    { label: "Look for", value: conciseCueText(result.clinicalCues), icon: Activity },
    { label: "Check next", value: result.nextSteps.join(" · "), icon: FlaskConical },
  ].filter((section) => section.value.trim());

  if (sections.length === 0) return null;

  return (
    <div
      data-testid="differential-best-match-panel"
      className={cn(
        "overflow-hidden rounded-lg border bg-[color:var(--surface)]/85",
        "border-[color:var(--clinical-accent-border)]",
        compact
          ? "divide-y divide-[color:var(--clinical-accent-border)]"
          : "grid divide-x divide-[color:var(--clinical-accent-border)]",
      )}
      style={!compact ? { gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` } : undefined}
    >
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.label} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 px-3 py-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <Icon className="size-icon-sm stroke-[2.25]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-extrabold uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
                {section.label}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">{section.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BestAnswerCard({
  best,
  selected,
  onToggle,
  compact = false,
  rank = 1,
}: {
  best: DifferentialResult;
  selected?: boolean;
  onToggle?: () => void;
  compact?: boolean;
  rank?: number;
}) {
  const Icon = best.icon;

  return (
    <section
      data-testid={compact ? "differential-best-answer" : "differential-best-match-card"}
      aria-label="Best differential match"
      className={cn(
        "grid items-start gap-x-2.5 gap-y-3 rounded-lg border shadow-[var(--e1)]",
        "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/45",
        compact
          ? "grid-cols-[minmax(0,1fr)_var(--spacing-tap)] p-3"
          : "grid-cols-[2.75rem_4.25rem_minmax(0,1fr)_7rem_var(--spacing-tap)] p-3.5",
      )}
    >
      {!compact ? (
        <span
          data-testid="differential-best-match-rank"
          className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] text-sm font-extrabold text-[color:var(--clinical-accent)]"
        >
          {rank}
        </span>
      ) : null}
      {!compact ? (
        <span
          className={cn(
            "grid h-14 w-14 place-items-center self-center rounded-lg border bg-[color:var(--surface)]",
            "border-[color:var(--clinical-accent-border)] text-[color:var(--clinical-accent)]",
          )}
        >
          <Icon className="h-7 w-7 stroke-[1.75]" aria-hidden />
        </span>
      ) : null}
      <Link
        href={best.href}
        className={cn(
          "block min-w-0 self-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
          compact && "self-start",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {compact ? (
            <span
              aria-label={`Result ${rank}`}
              className="nums inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-1.5 text-xs font-extrabold text-[color:var(--clinical-accent)]"
            >
              {rank}
            </span>
          ) : null}
          <h2
            className={cn(
              "min-w-0 font-extrabold leading-6 text-[color:var(--text-heading)]",
              compact ? "mr-auto flex-1 text-base" : "text-lg",
            )}
          >
            <span className={cn(compact && "line-clamp-2")}>{best.title}</span>
          </h2>
          <ResultTypeBadge kind={best.kind} />
          <StatusBadge status={best.status} />
        </div>
        {best.scopeLabel ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">{best.scopeLabel}</p>
        ) : null}
      </Link>
      {!compact ? (
        <div className="grid min-h-10 place-items-center self-center border-l border-[color:var(--clinical-accent-border)] pl-3">
          <MatchBadge label="Best match" />
        </div>
      ) : null}
      {onToggle ? (
        <SelectionCheckbox selected={Boolean(selected)} onChange={onToggle} label={best.title} />
      ) : compact ? (
        <ChevronRight className="mt-1 size-icon-md shrink-0 text-[color:var(--decoration-soft)]" aria-hidden />
      ) : (
        <span />
      )}
      {compact ? (
        <div className="col-span-2 flex items-center gap-1.5">
          <MatchBadge label="Best match" />
        </div>
      ) : null}
      <div className={cn(compact ? "col-span-2" : "col-start-3 col-end-6")}>
        <BestMatchReasoningPanel result={best} compact={compact} />
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
      <h2 className="text-xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
      <h2 className="text-xs font-extrabold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
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
            <ChevronRight className="h-4 w-4 text-[color:var(--decoration-soft)]" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

function SourceStatusBanner({
  sourceCount,
  evidenceState,
  loading,
  sourcesChecked,
  hasCatalogueResults,
  onRunSourceSearch,
}: {
  sourceCount: number;
  evidenceState: DifferentialEvidenceState;
  loading: boolean;
  sourcesChecked: boolean;
  hasCatalogueResults: boolean;
  onRunSourceSearch: () => void;
}) {
  const hasSourceEvidence = evidenceState === "source-backed";
  return (
    <section
      data-testid="differentials-source-status"
      aria-label="Source status"
      aria-live="polite"
      className={cn(
        "grid gap-2 rounded-lg border px-3 py-2.5 min-[390px]:grid-cols-[minmax(0,1fr)_auto] min-[390px]:items-center",
        hasSourceEvidence || sourcesChecked
          ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)]/40"
          : "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/40",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {loading ? (
          <Search className="mt-0.5 size-icon-md shrink-0 text-[color:var(--warning)]" aria-hidden />
        ) : hasSourceEvidence ? (
          <ShieldCheck className="mt-0.5 size-icon-md shrink-0 text-[color:var(--info)]" aria-hidden />
        ) : (
          <Info
            className={cn(
              "mt-0.5 size-icon-md shrink-0",
              sourcesChecked ? "text-[color:var(--info)]" : "text-[color:var(--warning)]",
            )}
            aria-hidden
          />
        )}
        <p className="min-w-0 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
          {loading
            ? "Checking indexed sources…"
            : hasSourceEvidence
              ? `${sourceCount.toLocaleString()} indexed source ${sourceCount === 1 ? "match" : "matches"}`
              : sourcesChecked
                ? hasCatalogueResults
                  ? "No indexed source matches — showing reviewed catalogue results"
                  : "No indexed source matches"
                : hasCatalogueResults
                  ? "Indexed sources have not been checked — showing reviewed catalogue results"
                  : "Indexed sources have not been checked"}
        </p>
      </div>
      {!loading && !hasSourceEvidence && !sourcesChecked ? (
        <button
          type="button"
          onClick={onRunSourceSearch}
          className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] min-[390px]:w-auto"
        >
          <Search className="h-4 w-4" aria-hidden />
          Check sources
        </button>
      ) : null}
    </section>
  );
}

function InterpretationRail({ best, results }: { best: DifferentialResult; results: DifferentialResult[] }) {
  return (
    <aside className="hidden min-w-0 gap-3 lg:grid" aria-label="Differential interpretation">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
        Interpretation
        <Info className="h-4 w-4" aria-hidden />
      </h2>
      {best.kind === "presentation" ? <LikelyPresentationCard lead={best} /> : null}
      <UrgencyCard results={results} />
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
      composeDifferentialSearchResults(catalog.matches.diagnoses, catalog.matches.presentations).map((item) =>
        toDifferentialResult(item, query),
      ),
    [catalog.matches, query],
  );
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const filterPanelId = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // Capture cold-load URL ids in state so a loading catalogue cannot wipe `ids`
  // via replaceState before the first result set hydrates selection.
  const [initialUrlIds] = useState(() =>
    typeof window === "undefined" ? [] : differentialIdsFromSearchParams(window.location.search),
  );
  const [urlHydrationPending, setUrlHydrationPending] = useState(() => initialUrlIds.length > 0);
  // Selection, filter, and sort follow the ranked result set: seed the top two
  // for comparison and drop stale ids whenever a new query changes the results
  // (render-time sync, matching the repo's set-state-in-render pattern).
  const resultSignature = results.map((result) => result.id).join("|");
  const [lastResultSignature, setLastResultSignature] = useState("");
  if (lastResultSignature !== resultSignature) {
    setLastResultSignature(resultSignature);
    setKindFilter("all");
    setUrgencyFilter("all");
    const diagnosisIds = results.filter((result) => result.kind === "diagnosis").map((result) => result.id);
    const diagnosisIdSet = new Set(diagnosisIds);
    // First result set may hydrate shareable URL ids; later query changes always
    // re-seed so a new scope never silently inherits the previous ticks.
    const urlIds = urlHydrationPending ? initialUrlIds.filter((id) => diagnosisIdSet.has(id)) : [];
    const nextIds = lastResultSignature === "" && urlIds.length > 0 ? urlIds : diagnosisIds.slice(0, 2);
    if (urlHydrationPending && lastResultSignature === "" && resultSignature !== "") {
      setUrlHydrationPending(false);
    }
    setSelectedIds(new Set(nextIds));
  }

  // Two independent lens dimensions (kind, clinical urgency) AND together. Each
  // option's count holds the OTHER dimension at its current value and answers
  // "how many would I have if I switched to this value instead" — the filter
  // contract's rule for a lens count (docs/filter-contract.md section 3).
  const matchesKind = (result: DifferentialResult, kind: KindFilter) => kind === "all" || result.kind === kind;
  const matchesUrgency = (result: DifferentialResult, urgency: UrgencyFilter) =>
    urgency === "all" || result.status === urgency;
  const kindFilterOptions = useMemo<ReadonlyArray<ResultFilterOption<KindFilter>>>(() => {
    const countFor = (kind: KindFilter) =>
      results.filter((result) => matchesKind(result, kind) && matchesUrgency(result, urgencyFilter)).length;
    return (["all", "presentation", "diagnosis"] as const).map((value) => ({
      value,
      label: value === "all" ? "All" : value === "presentation" ? "Presentations" : "Differentials",
      hint: String(countFor(value)),
    }));
  }, [results, urgencyFilter]);
  // Same three-tier scale the result badges already show (statusLabel), so the
  // filter reuses the exact wording a reader has already seen on the cards
  // instead of introducing a second vocabulary for the same field. Mirrors the
  // identical "Clinical urgency" lens on the differentials stream/browse pages
  // (differential-stream-workspace.tsx) so the two differentials surfaces agree.
  const urgencyFilterOptions = useMemo<ReadonlyArray<ResultFilterOption<UrgencyFilter>>>(() => {
    const countFor = (urgency: UrgencyFilter) =>
      results.filter((result) => matchesKind(result, kindFilter) && matchesUrgency(result, urgency)).length;
    return (["all", "emergent", "urgent", "routine"] as const).map((value) => ({
      value,
      label: value === "all" ? "All priorities" : statusLabel(value),
      hint: String(countFor(value)),
    }));
  }, [results, kindFilter]);
  const relevanceResults = useMemo(
    () => results.filter((result) => matchesKind(result, kindFilter) && matchesUrgency(result, urgencyFilter)),
    [kindFilter, urgencyFilter, results],
  );
  const visibleResults = useMemo(
    () => sortResultItems(relevanceResults, sortValue, (result) => result.title),
    [relevanceResults, sortValue],
  );
  const appliedFilters: AppliedFilterChip[] = [];
  if (kindFilter !== "all") {
    appliedFilters.push({
      id: "result-type",
      groupLabel: "Show",
      valueLabel: kindFilter === "presentation" ? "Presentations" : "Differentials",
      onRemove: () => setKindFilter("all"),
    });
  }
  if (urgencyFilter !== "all") {
    appliedFilters.push({
      id: "urgency",
      groupLabel: "Clinical urgency",
      valueLabel: statusLabel(urgencyFilter),
      onRemove: () => setUrgencyFilter("all"),
    });
  }
  const activeFilterCount = appliedFilters.length;
  const clearAllFilters = () => {
    setKindFilter("all");
    setUrgencyFilter("all");
  };
  // Only reached when both dimensions narrowed the same result set to zero, so
  // every branch below stays possible at runtime — computed as an if-chain
  // rather than a nested ternary so each `statusLabel` call sits behind an
  // explicit `urgencyFilter !== "all"` narrowing.
  function filteredEmptyHeading(): string {
    if (kindFilter !== "all" && urgencyFilter !== "all") {
      return `No ${kindFilter === "presentation" ? "presentations" : "differentials"} at ${statusLabel(urgencyFilter)} priority in this result set`;
    }
    if (kindFilter === "presentation") return "No presentations in this result set";
    if (kindFilter === "diagnosis") return "No differentials in this result set";
    if (urgencyFilter !== "all") return `No ${statusLabel(urgencyFilter)} results in this result set`;
    return "No results match your filters";
  }
  // Keep the feature card inside the active result type while preserving the
  // relevance winner when the visible list is presented alphabetically.
  const best = relevanceResults[0] ?? null;
  // Same lead the desktop interpretation rail uses for its safety card.
  const safetyLead = relevanceResults.find((result) => result.status === "emergent") ?? best;
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
  const comparisonIdsKey = Array.from(comparisonIds).join(",");

  // Publish selection into the URL so ModeNav Compare can forward the same ids.
  // Defer while the catalogue is still loading so a cold submitted-search load
  // does not delete bookmarked `ids` before matches arrive for hydration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (catalog.status === "loading") return;
    syncDifferentialSelectionIdsToUrl(comparisonIdsKey ? comparisonIdsKey.split(",") : []);
  }, [catalog.status, comparisonIdsKey]);
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
  // indexed library.
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
      className="mx-auto grid w-full max-w-[86rem] min-w-0 gap-3 overflow-x-clip px-4 pb-4 min-[390px]:gap-4 sm:px-4 lg:px-0 lg:pb-0"
    >
      {/* Query context lives here on every breakpoint — on phones this is the
          only place the submitted query is visible above the fold. */}
      <SearchResultsHeaderBand
        modeId="differentials"
        query={query}
        matchCount={visibleResults.length}
        status={
          catalogFailed
            ? catalog.status === "unauthorized"
              ? "unauthorized"
              : "error"
            : loading || catalogLoading
              ? "loading"
              : catalog.status === "refetching"
                ? "refetching"
                : "ready"
        }
        faultTitle={
          catalog.status === "unauthorized"
            ? "Sign in again to search the differentials catalogue"
            : "The differentials catalogue could not be searched"
        }
        faultBody={
          catalog.status === "unauthorized"
            ? "Sign in again to search, or browse the catalogue pages directly."
            : "Retry the search shortly, or browse the catalogue pages directly."
        }
        // The fault copy promises two recoveries, so both have to exist: rerun the
        // search, and the catalogue links that the removed error section used to
        // carry. Without these the failed view tells the reader to act and gives
        // them nothing to act with. Unauthorized omits Retry because a refetch
        // cannot mint a session — the body must not promise one either.
        // Retry the request that actually failed. `rerunSearch` only re-runs the
        // parent document-evidence search; the catalogue hook keys on query + auth
        // identity, neither of which changes when the reader asks to try again, so
        // routing Retry through it left the band permanently faulted.
        onRetry={catalog.status === "unauthorized" ? undefined : catalog.refetch}
        faultAction={
          <>
            <Link
              href={differentialRouteWithQuery("/differentials/presentations", query)}
              className="inline-flex min-h-tap items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10"
            >
              Browse presentations
            </Link>
            <Link
              href={differentialRouteWithQuery("/differentials/diagnoses", query)}
              className="inline-flex min-h-tap items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-extrabold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)] sm:min-h-10"
            >
              Browse differentials
            </Link>
          </>
        }
        sortValue={sortValue}
        onSortChange={setSortValue}
        appliedFilters={appliedFilters}
        onClearFilters={activeFilterCount > 0 ? clearAllFilters : undefined}
        filterLabel="Filter differential results"
        // A compact badged trigger, so it shares the count line.
        mobileControlsPlacement="inline"
        mobileControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="differential-filter-trigger-phone"
            title="Filter differentials"
            open={filterOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
        filterControls={
          <ResultFilterTrigger
            panelId={filterPanelId}
            testId="differential-filter-trigger-desktop"
            title="Filter differentials"
            open={filterOpen}
            activeCount={activeFilterCount}
            onToggle={() => setFilterOpen((current) => !current)}
          />
        }
      />
      <SourceStatusBanner
        sourceCount={reviewedSourceCount}
        evidenceState={evidenceState}
        loading={loading}
        sourcesChecked={sourcesChecked}
        hasCatalogueResults={!catalogFailed && results.length > 0}
        onRunSourceSearch={rerunSearch}
      />
      {/* Phone-only by construction: the trigger that opens it lives in the
          ribbon's `mobileControls` slot, which the band hides from `sm` up. */}
      <ResultFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        panelId={filterPanelId}
        testId="differential-filter-panel"
        title="Filter differentials"
        description="Narrow by result type, then by clinical urgency. Both narrow the same list together."
        groups={[
          resultFilterGroup({
            id: "result-type",
            label: "Show",
            value: kindFilter,
            options: kindFilterOptions,
            onChange: setKindFilter,
          }),
          resultFilterGroup({
            id: "urgency",
            label: "Clinical urgency",
            value: urgencyFilter,
            options: urgencyFilterOptions,
            onChange: setUrgencyFilter,
          }),
        ]}
        onClearAll={activeFilterCount > 0 ? clearAllFilters : undefined}
        summary={{
          count: visibleResults.length,
          noun: visibleResults.length === 1 ? "result" : "results",
        }}
      />
      {catalogLoading ? (
        <div className="grid gap-2" aria-hidden data-testid="differentials-results-loading">
          {[0, 1, 2].map((placeholder) => (
            <div
              key={placeholder}
              className="h-24 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
            />
          ))}
        </div>
      ) : /* A failed catalogue search is reported by the band's fault panel, which
              also owns the retry copy, so the whole body is suppressed here.
              `catalogFailed` must short-circuit BEFORE the `!best` test: `best` is
              `relevanceResults[0] ?? null`, and a faulted search with no results would
              otherwise fall through to the results grid, which dereferences
              `best.id` / `best.kind` unconditionally and throws — on exactly the
              state this component is meant to report truthfully. */
      catalogFailed ? null : results.length === 0 ? (
        <section
          data-testid="differentials-empty-results"
          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]"
        >
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">
            {`No catalogue matches for “${query}”`}
          </h2>
          <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            {hasSourceEvidence
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
              Browse differentials
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
      ) : !best ? (
        <section
          data-testid="differentials-filter-empty-results"
          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]"
        >
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">{filteredEmptyHeading()}</h2>
          <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            Other results still match this search. Clear filters to show them.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex min-h-tap w-fit items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            Show all results
          </button>
        </section>
      ) : (
        <div className="grid gap-3">
          {safetyLead?.safety ? (
            <p
              data-testid="differentials-safety-banner"
              className="flex items-start gap-1.5 rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/40 px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--text-heading)] sm:text-sm"
            >
              <ShieldAlert className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--danger)]" aria-hidden />
              <span>
                <span className="font-extrabold text-[color:var(--danger)]">Safety first: </span>
                {safetyLead.safety}
              </span>
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
            <section className="min-w-0 space-y-3" aria-label="Differential diagnosis results">
              <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold uppercase tracking-eyebrow text-[color:var(--text-heading)]">
                    Differential matches
                  </h2>
                  <p className="mt-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
                    {sortValue === "alpha"
                      ? "Sorted A–Z; the best relevance match remains marked."
                      : "Ranked by clinical title, aliases, cues, and catalogue relevance."}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 lg:hidden">
                <BestAnswerCard
                  best={best}
                  compact
                  selected={selectedIds.has(best.id)}
                  onToggle={best.kind === "diagnosis" ? () => toggleSelected(best.id) : undefined}
                />
              </div>

              <div className="grid gap-2">
                {visibleResults.map((result, displayIndex) => {
                  // Best-match styling remains tied to relevance while the row
                  // number follows the user's chosen presentation order.
                  const isBest = result.kind === best.kind && result.id === best.id;
                  // The featured card owns rank 1 on phones. Continue the
                  // remaining visible sequence at 2 without leaving a gap when
                  // the best match moves under A-Z presentation order.
                  const precedingNonBestResults = visibleResults
                    .slice(0, displayIndex)
                    .filter((candidate) => candidate.kind !== best.kind || candidate.id !== best.id);
                  const mobileIndex = precedingNonBestResults.length + 1;
                  return (
                    // The best answer is already featured above the phone list,
                    // so its ranked duplicate only renders from the desktop
                    // breakpoint (hiding the wrapper keeps the grid gap clean).
                    <div key={`${result.kind}-${result.id}`} className={cn(isBest && "max-lg:hidden")}>
                      <div className="hidden lg:block">
                        {isBest ? (
                          <BestAnswerCard
                            best={result}
                            rank={displayIndex + 1}
                            selected={selectedIds.has(result.id)}
                            onToggle={result.kind === "diagnosis" ? () => toggleSelected(result.id) : undefined}
                          />
                        ) : (
                          <DesktopResultRow
                            result={result}
                            index={displayIndex}
                            selected={selectedIds.has(result.id)}
                            onToggle={result.kind === "diagnosis" ? () => toggleSelected(result.id) : undefined}
                          />
                        )}
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
                  <GitCompareArrows className="h-5 w-5 text-[color:var(--decoration-soft)]" aria-hidden />
                  Tick results to compare them side by side
                </p>
              )}
            </section>

            <InterpretationRail best={best} results={results} />
          </div>
        </div>
      )}

      {best ? (
        <DifferentialsMobileCompareBar selectedCount={selectedCount} selectedIds={comparisonIds} query={query} />
      ) : null}

      <UniversalSearchAlsoMatches modeId="differentials" query={query} />
    </div>
  );
}

export function DifferentialsHome({
  query,
  loading,
  searchSubmitted,
  documentMatches,
  evidenceQuery,
  onRunSearch,
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

  // Empty unsubmitted visits 307 to `/?mode=differentials`. Returning null here
  // so a dashboard loading flash cannot resurrect the retired tile home.
  return null;
}
