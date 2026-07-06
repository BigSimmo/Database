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
  Filter,
  FlaskConical,
  GitCompareArrows,
  HeartPulse,
  Info,
  ListFilter,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { ModeHomeTemplate, ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";
import { useDifferentialSearch } from "@/components/clinical-dashboard/use-differential-catalog";
import { cn } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import { differentialsMobileCompareAddonSlotId } from "@/lib/mode-home-composer";
import {
  composeDifferentialSearchResults,
  differentialScenarioPresets,
  type DifferentialRecord,
  type DifferentialSearchResultItem,
} from "@/lib/differentials";
import type { DocumentMatch } from "@/lib/types";

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
    description: "Explore by symptoms or scenario",
    query: "acute confusion differential diagnosis",
    icon: Search,
    target: "presentations",
  },
  {
    label: "Compare differentials",
    description: "Compare likely causes side by side",
    query: "delirium vs dementia differential diagnosis",
    icon: GitCompareArrows,
    target: "diagnoses",
  },
  {
    label: "Recent work",
    description: "Continue where you left off",
    query: "recent differential diagnosis work",
    icon: Clock3,
    target: "search",
  },
];

const recentDifferentials: RecentDifferential[] = differentialScenarioPresets()
  .slice(0, 5)
  .map((preset) => ({
    label: preset.query.replace(/\bdifferential diagnosis\b/i, "").trim() || preset.query,
    query: preset.query.includes("differential") ? preset.query : `${preset.query} differential diagnosis`,
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

function routeWithQuery(path: string, query: string) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set("q", trimmedQuery);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function DifferentialsMobileCompareAddon({ selectedCount, query }: { selectedCount: number; query: string }) {
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

  return createPortal(
    <Link
      href={routeWithQuery("/differentials/presentations", query)}
      data-testid="differentials-compare-selected-mobile"
      className="mx-auto flex min-h-12 w-full max-w-[26rem] items-center justify-center gap-3 rounded-xl bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-elevated)] active:bg-[color:var(--clinical-accent-hover)]"
    >
      <GitCompareArrows className="h-5 w-5 shrink-0" aria-hidden />
      Compare selected ({selectedCount})
      <ChevronRight className="ml-auto h-5 w-5 shrink-0" aria-hidden />
    </Link>,
    host,
  );
}

function statusLabel(status: DifferentialRecord["status"]) {
  if (status === "emergent") return "Emergent";
  if (status === "urgent") return "High";
  return "Investigations";
}

function statusTone(status: DifferentialRecord["status"]) {
  if (status === "emergent")
    return "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]";
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
      className={cn(
        "inline-flex min-h-5 items-center rounded-md border px-1.5 text-3xs font-extrabold uppercase leading-none tracking-normal",
        statusTone(status),
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function MatchBadge({ label }: { label: string }) {
  const tone =
    label === "Best match"
      ? "text-[color:var(--danger)]"
      : label === "High match"
        ? "text-[color:var(--clinical-accent)]"
        : "text-[color:var(--warning)]";
  return <span className={cn("text-2xs font-extrabold", tone)}>{label}</span>;
}

function Chip({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-6 max-w-full items-center rounded-md bg-[color:var(--surface-subtle)] px-2 text-2xs font-bold leading-none text-[color:var(--text-muted)]">
      <span className="truncate">{children}</span>
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
        "grid h-10 w-10 shrink-0 place-items-center rounded-md border text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
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
  selected,
  onToggle,
}: {
  result: DifferentialResult;
  index: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = result.icon;
  const isBest = index === 0;

  return (
    <article
      className={cn(
        "group grid min-h-[5.75rem] grid-cols-[2.75rem_4.25rem_minmax(0,1fr)_9.75rem_2.5rem] items-center gap-3 rounded-lg border bg-[color:var(--surface)] px-3.5 py-3 shadow-[var(--shadow-inset)] transition",
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
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[color:var(--clinical-accent)]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open page
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[color:var(--clinical-accent)]"
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden />
          {selected ? "Compared" : "Compare"}
        </button>
      </div>
      <SelectionToggle selected={selected} onClick={onToggle} label={result.title} />
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
  onToggle: () => void;
}) {
  const Icon = result.icon;
  const isBest = index === 0;

  return (
    <article
      className={cn(
        "grid gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]",
        isBest && "border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/55",
      )}
    >
      <div className="grid grid-cols-[2rem_2.5rem_minmax(0,1fr)_2.5rem] items-start gap-2">
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md border text-sm font-extrabold",
            isBest
              ? "border-[color:var(--danger-border)] bg-[color:var(--surface)] text-[color:var(--danger)]"
              : "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
          )}
        >
          {index + 1}
        </span>
        <Link
          href={result.href}
          aria-label={`Open ${result.title}`}
          className="grid h-10 w-10 place-items-center rounded-md text-[color:var(--text-muted)]"
        >
          <Icon className="h-6 w-6 stroke-[1.75]" aria-hidden />
        </Link>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link
              href={result.href}
              className="inline-flex min-h-10 min-w-0 items-center text-sm font-extrabold leading-5 text-[color:var(--text-heading)]"
            >
              <span className="line-clamp-2">{result.title}</span>
            </Link>
            <StatusBadge status={result.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <MatchBadge label={result.matchLabel} />
          </div>
        </div>
        <SelectionToggle selected={selected} onClick={onToggle} label={result.title} />
      </div>
      {isBest ? (
        <p className="text-sm font-medium leading-6 text-[color:var(--text-muted)]">{result.subtitle}</p>
      ) : null}
      <div className="flex max-w-full flex-wrap gap-1.5">
        {result.tags.slice(0, isBest ? 4 : 2).map((tag) => (
          <Chip key={`${result.id}-${tag}`}>{tag}</Chip>
        ))}
        {result.tags.length > (isBest ? 4 : 2) ? <Chip>{`+${result.tags.length - (isBest ? 4 : 2)}`}</Chip> : null}
      </div>
    </article>
  );
}

function BestAnswerCard({
  best,
  selected,
  onToggle,
}: {
  best: DifferentialResult;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const Icon = best.icon;

  return (
    <section className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/55 p-4 shadow-[var(--shadow-inset)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--surface)] text-[color:var(--danger)]">
            <Icon className="h-8 w-8 stroke-[1.8]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-2xs font-extrabold uppercase text-[color:var(--text-muted)]">Best answer</p>
            <h2 className="mt-1 text-lg font-extrabold leading-6 text-[color:var(--text-heading)]">{best.title}</h2>
            <div className="mt-2">
              <StatusBadge status={best.status} />
            </div>
          </div>
        </div>
        {onToggle ? <SelectionToggle selected={Boolean(selected)} onClick={onToggle} label={best.title} /> : null}
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{best.subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {best.tags.map((tag) => (
          <Chip key={tag}>{tag}</Chip>
        ))}
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
            href={routeWithQuery("/differentials/presentations", query)}
            className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-bold text-[color:var(--clinical-accent)]"
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
        {urgentResults.map((result, index) => (
          <Link
            key={result.id}
            href={result.href}
            className="grid min-h-10 grid-cols-[5.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[color:var(--border)] px-2 text-sm font-bold text-[color:var(--text-heading)]"
          >
            <StatusBadge status={index === 0 ? "emergent" : result.status} />
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
  onRunSourceSearch,
}: {
  sourceCount: number;
  evidenceState: DifferentialEvidenceState;
  loading: boolean;
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
            {hasSourceEvidence ? `${sourceCount.toLocaleString()} sources` : "Evidence pending"}
          </span>
        </p>
        <p className="flex items-center justify-between gap-3 text-[color:var(--warning)]">
          <span className="inline-flex items-center gap-2">
            <CircleHelp className="h-4 w-4" aria-hidden />
            {hasSourceEvidence ? "Imported catalogue" : "Run source search"}
          </span>
          <span className="text-[color:var(--text-muted)]">
            {hasSourceEvidence
              ? `${sourceCount.toLocaleString()} source${sourceCount === 1 ? "" : "s"}`
              : "Not yet checked"}
          </span>
        </p>
      </div>
      <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
        {hasSourceEvidence
          ? "Catalogue matches are ranked from the imported, locally reviewed differentials library."
          : "Showing reviewed local differential records. Run source search to validate against indexed documents."}
      </p>
      {!hasSourceEvidence ? (
        <button
          type="button"
          onClick={onRunSourceSearch}
          disabled={loading}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)] transition hover:border-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60"
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
  onRunSourceSearch,
}: {
  best: DifferentialResult;
  results: DifferentialResult[];
  query: string;
  sourceCount: number;
  evidenceState: DifferentialEvidenceState;
  loading: boolean;
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
  onRunSearch,
}: {
  query: string;
  loading: boolean;
  documentMatches?: DocumentMatch[];
  onRunSearch?: (query: string) => void;
}) {
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
  // Selection and filter follow the ranked result set: seed the top two for
  // comparison and drop stale ids whenever a new query changes the results
  // (render-time sync, matching the repo's set-state-in-render pattern).
  const resultSignature = results.map((result) => result.id).join("|");
  const [lastResultSignature, setLastResultSignature] = useState(resultSignature);
  if (lastResultSignature !== resultSignature) {
    setLastResultSignature(resultSignature);
    setKindFilter("all");
    setSelectedIds(new Set(results.slice(0, 2).map((result) => result.id)));
  }

  const presentationCount = results.filter((result) => result.kind === "presentation").length;
  const diagnosisCount = results.length - presentationCount;
  const visibleResults = kindFilter === "all" ? results : results.filter((result) => result.kind === kindFilter);
  const best = results[0] ?? null;
  const selectedCount = selectedIds.size;
  const hasSourceEvidence = Boolean(documentMatches?.length);
  const evidenceState: DifferentialEvidenceState = hasSourceEvidence ? "source-backed" : "guided";
  // Count the sources that actually matched this search, never the whole
  // indexed library - the surrounding copy states these reflect real matches.
  const reviewedSourceCount = hasSourceEvidence ? (documentMatches?.length ?? 0) : 0;
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

  const kindFilterOptions = [
    { id: "all" as const, label: `All (${results.length})`, compact: "All" },
    {
      id: "presentation" as const,
      label: `Presentations (${presentationCount})`,
      compact: `Pres (${presentationCount})`,
    },
    { id: "diagnosis" as const, label: `Diagnoses (${diagnosisCount})`, compact: `Dx (${diagnosisCount})` },
  ];

  return (
    <div
      data-testid="differentials-search-results"
      className="mx-auto grid w-full max-w-[86rem] gap-4 overflow-x-hidden px-3 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-4 lg:px-0 lg:pb-0"
    >
      <div className="hidden lg:block">
        <SearchResultsHeaderBand
          modeId="differentials"
          query={query}
          matchCount={results.length}
          loading={loading || catalogLoading}
        />
      </div>
      <p
        data-testid="differentials-catalogue-notice"
        className="flex items-start gap-2 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-soft)]/50 px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--info)] sm:text-sm"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Ranked from your imported differentials catalogue. Source counts reflect real matches from your indexed
          library.
        </span>
      </p>
      {catalogFailed ? (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 px-3 py-2 text-sm font-semibold text-[color:var(--warning)]"
        >
          {catalog.status === "unauthorized"
            ? "Sign in again to search the differentials catalogue."
            : "The differentials catalogue could not be searched. Retry shortly or browse the catalogue pages below."}
        </p>
      ) : null}
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
          data-testid="differentials-empty-results"
          className="grid gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]"
        >
          <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">
            No catalogue matches for &ldquo;{query}&rdquo;
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
              href={routeWithQuery("/differentials/presentations", query)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)]"
            >
              Browse presentations
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={routeWithQuery("/differentials/diagnoses", query)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)]"
            >
              Browse diagnoses
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={rerunSearch}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] disabled:cursor-wait disabled:opacity-60"
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
                    {hasSourceEvidence
                      ? "Source matches available. Review before use."
                      : "Run source search to validate against indexed local documents."}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-extrabold uppercase tracking-[0.09em] text-[color:var(--text-heading)]">
                  Catalogue matches <span className="text-[color:var(--text-muted)]">(ranked)</span>
                </h2>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  onClick={rerunSearch}
                  disabled={loading}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
                >
                  {hasSourceEvidence ? (
                    <GitCompareArrows className="h-4 w-4" aria-hidden />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden />
                  )}
                  {hasSourceEvidence ? "Compare top 3" : "Run source search"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
                >
                  <Filter className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                  Filters
                </button>
              </div>
            </div>

            <div className="grid gap-2 lg:hidden">
              <BestAnswerCard
                best={best}
                selected={selectedIds.has(best.id)}
                onToggle={() => toggleSelected(best.id)}
              />
              <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
                {kindFilterOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={kindFilter === item.id}
                    onClick={() => setKindFilter(item.id)}
                    className={cn(
                      "min-h-10 min-w-10 rounded-lg border px-2 text-xs font-bold min-[390px]:text-sm",
                      kindFilter === item.id
                        ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                    )}
                  >
                    <span className="hidden min-[430px]:inline">{item.label}</span>
                    <span className="min-[430px]:hidden">{item.compact}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Filters"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-xs font-bold text-[color:var(--text-heading)] min-[390px]:text-sm"
                >
                  <ListFilter className="h-4 w-4" aria-hidden />
                  <span className="hidden min-[430px]:inline">Filters</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-[color:var(--text-muted)]">
                <span>
                  <strong className="text-[color:var(--text-heading)]">
                    {visibleResults.length} result{visibleResults.length === 1 ? "" : "s"}
                  </strong>{" "}
                  · {hasSourceEvidence ? "Ranked by relevance" : "Catalogue ranking"}
                </span>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold text-[color:var(--text-heading)]"
                >
                  Sort
                  <ChevronRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
                </button>
              </div>
              {!hasSourceEvidence ? (
                <section
                  aria-label="Source status"
                  className="grid gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/40 p-3 text-sm"
                >
                  <p className="font-semibold leading-5 text-[color:var(--text-heading)]">
                    Showing ranked catalogue records. Source-library evidence has not been checked for this query yet.
                  </p>
                  <button
                    type="button"
                    onClick={rerunSearch}
                    disabled={loading}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] px-3 text-sm font-extrabold text-[color:var(--clinical-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" aria-hidden />
                    {loading ? "Searching sources" : "Run source search"}
                  </button>
                </section>
              ) : null}
            </div>

            <div className="grid gap-2">
              {visibleResults.map((result, index) => (
                <div key={`${result.kind}-${result.id}`}>
                  <div className="hidden lg:block">
                    <DesktopResultRow
                      result={result}
                      index={index}
                      selected={selectedIds.has(result.id)}
                      onToggle={() => toggleSelected(result.id)}
                    />
                  </div>
                  <div className="lg:hidden">
                    <MobileResultCard
                      result={result}
                      index={index}
                      selected={selectedIds.has(result.id)}
                      onToggle={() => toggleSelected(result.id)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Link
              href={routeWithQuery("/differentials/diagnoses", query)}
              className="hidden min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] lg:inline-flex"
            >
              View all catalogue matches ({results.length})
              <ChevronRight className="h-4 w-4 rotate-90" aria-hidden />
            </Link>

            <Link
              href={routeWithQuery("/differentials/presentations", query)}
              className="hidden min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-base font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-elevated)] lg:inline-flex"
            >
              <GitCompareArrows className="h-5 w-5" aria-hidden />
              Compare selected ({selectedCount})
              <ChevronRight className="ml-auto h-5 w-5" aria-hidden />
            </Link>
          </section>

          <InterpretationRail
            best={best}
            results={results}
            query={query}
            sourceCount={reviewedSourceCount}
            evidenceState={evidenceState}
            loading={loading}
            onRunSourceSearch={rerunSearch}
          />
        </div>
      )}

      {best ? <DifferentialsMobileCompareAddon selectedCount={selectedCount} query={query} /> : null}

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
      else router.push(routeWithQuery("/differentials/presentations", action.query));
      return;
    }
    if (action.target === "diagnoses") {
      if (onOpenDiagnoses) onOpenDiagnoses(action.query);
      else router.push(routeWithQuery("/differentials/diagnoses", action.query));
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
        onRunSearch={runSearch}
      />
    );
  }

  return (
    <div data-testid="differentials-home" className="mx-auto w-full max-w-6xl overflow-x-hidden px-1">
      <ModeHomeTemplate
        testId="differentials-home-template"
        title="Differentials"
        subtitle="Search your imported differentials catalogue against matches from your indexed library."
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
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-[color:var(--clinical-accent)] transition hover:bg-[color:var(--clinical-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:px-3 sm:text-sm"
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
