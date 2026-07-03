"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

import { ModeHomeTemplate } from "@/components/mode-home-template";
import { cn } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";
import {
  acuteConfusionPresentationWorkflow,
  getDifferentialRecord,
  type DifferentialRecord,
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

const recentDifferentials: RecentDifferential[] = [
  { label: "Acute confusion", query: "acute confusion differential diagnosis", icon: BrainCircuit },
  { label: "Delirium", query: "delirium differential diagnosis", icon: FlaskConical },
  { label: "Substance withdrawal", query: "substance withdrawal differential diagnosis", icon: FlaskConical },
  { label: "QT risk", query: "QT prolongation differential diagnosis", icon: Activity },
  { label: "Capacity", query: "capacity assessment differential diagnosis", icon: Stethoscope },
];

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

function recordIcon(record: DifferentialRecord) {
  return candidateIconBySlug.find(([fragment]) => record.slug.includes(fragment))?.[1] ?? BrainCircuit;
}

function tagText(value: string) {
  const cleaned = value.replaceAll("/", " / ").replace(/\s+/g, " ").trim();
  if (/^[A-Z0-9&+ -]{2,6}$/.test(cleaned)) return cleaned;
  return cleaned.toLowerCase();
}

function buildDifferentialResults(): DifferentialResult[] {
  const workflow = acuteConfusionPresentationWorkflow;
  const candidateRows = workflow.candidates.flatMap((candidate, index) => {
    const record = getDifferentialRecord(candidate.slug);
    if (!record) return [];
    const Icon = recordIcon(record);
    const whyItFits = candidate.comparison["why-it-fits"] ?? record.clinicalHinge;
    const tags = [
      ...record.currentPresentation.slice(0, 2),
      ...(index < 2 ? ["fluctuating course"] : []),
      record.investigations[0],
    ]
      .filter(Boolean)
      .slice(0, 4)
      .map(tagText);

    return [
      {
        id: record.slug,
        title: record.title,
        subtitle: whyItFits,
        href: `/differentials/diagnoses/${record.slug}`,
        status: record.status,
        selected: candidate.selected,
        matchLabel: index < 1 ? "High match" : index < 5 ? "Moderate match" : "Lower match",
        tags,
        icon: Icon,
        safety: candidate.comparison["must-not-miss"] ?? whyItFits,
      },
    ];
  });

  return [
    {
      id: workflow.id,
      title: workflow.title,
      subtitle: "Acute presentation with fluctuating course, inattention, or disorientation.",
      href: routeWithQuery("/differentials/presentations", "acute confusion"),
      status: workflow.status,
      selected: true,
      matchLabel: "Best match",
      tags: ["acute onset", "fluctuating course", "inattention", "disorientation"],
      icon: BrainCircuit,
      safety: workflow.safetySnapshot.summary,
    },
    ...candidateRows,
  ].slice(0, 8);
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
          {isBest ? <Chip>+2</Chip> : null}
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
        {isBest ? <Chip>+2</Chip> : null}
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
        <Chip>+2</Chip>
      </div>
    </section>
  );
}

function SafetyCard() {
  const workflow = acuteConfusionPresentationWorkflow;

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
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
            {workflow.safetySnapshot.summary}
          </p>
          <Link
            href="/differentials/presentations?q=acute+confusion"
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

function LikelyPresentationCard({ best }: { best: DifferentialResult }) {
  const points = [
    "Acute onset with fluctuating attention or awareness.",
    "Post-operative or medical setting increases risk.",
    best.safety ?? acuteConfusionPresentationWorkflow.safetySnapshot.summary,
  ];

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
  const workflow = acuteConfusionPresentationWorkflow;
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
            {hasSourceEvidence ? workflow.sourceStatus.label : "Run source search"}
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
          ? workflow.sourceStatus.version
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
  sourceCount,
  evidenceState,
  loading,
  onRunSourceSearch,
}: {
  best: DifferentialResult;
  results: DifferentialResult[];
  sourceCount: number;
  evidenceState: DifferentialEvidenceState;
  loading: boolean;
  onRunSourceSearch: () => void;
}) {
  return (
    <aside className="hidden min-w-0 gap-3 lg:grid" aria-label="Differential interpretation">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
        Interpretation
        <Info className="h-4 w-4" aria-hidden />
      </h2>
      <BestAnswerCard best={best} />
      <SafetyCard />
      <LikelyPresentationCard best={best} />
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
  const results = useMemo(() => buildDifferentialResults(), []);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set([acuteConfusionPresentationWorkflow.id, "delirium", "substance-withdrawal"]),
  );
  const best = results[0];
  const selectedCount = selectedIds.size;
  const hasSourceEvidence = Boolean(documentMatches?.length);
  const evidenceState: DifferentialEvidenceState = hasSourceEvidence ? "source-backed" : "guided";
  // Count the sources that actually matched this search, never the whole
  // indexed library - the surrounding copy states these reflect real matches.
  const reviewedSourceCount = hasSourceEvidence ? (documentMatches?.length ?? 0) : 0;

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
      className="mx-auto grid w-full max-w-[86rem] gap-4 overflow-x-hidden px-3 pb-[calc(14rem+env(safe-area-inset-bottom))] sm:px-4 lg:px-0 lg:pb-0"
    >
      <p
        data-testid="differentials-demo-content-notice"
        className="flex items-start gap-2 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)]/50 px-3 py-2 text-xs font-semibold leading-5 text-[color:var(--warning)] sm:text-sm"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          The ranked diagnoses below are synthetic demonstration content, not clinically authored guidance. Source
          counts reflect real matches from your indexed library.
        </span>
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <section className="min-w-0 space-y-3" aria-label="Differential diagnosis results">
          <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-[color:var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5 text-[color:var(--warning)]">
                  <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                  Demonstration ranking
                </span>
                <span className="hidden sm:inline">
                  {hasSourceEvidence
                    ? "Source matches available. Review before use."
                    : "Run source search to validate against indexed local documents."}
                </span>
              </div>
              <h2 className="mt-3 text-base font-extrabold uppercase tracking-[0.09em] text-[color:var(--text-heading)]">
                Diagnosis pages <span className="text-[color:var(--text-muted)]">(ranked)</span>
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
            <BestAnswerCard best={best} selected={selectedIds.has(best.id)} onToggle={() => toggleSelected(best.id)} />
            <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
              {[
                { label: "All (8)", compact: "All" },
                { label: "Diagnosis (6)", compact: "Dx (6)" },
                { label: "Mimics (2)", compact: "Mimics" },
              ].map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={item.label}
                  className={cn(
                    "min-h-10 min-w-10 rounded-lg border px-2 text-xs font-bold min-[390px]:text-sm",
                    index === 0
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
                <strong className="text-[color:var(--text-heading)]">8 results</strong> ·{" "}
                {hasSourceEvidence ? "Ranked by relevance" : "Guided differential view"}
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
                  Showing guided local differential records. Source-library evidence has not been checked for this query
                  yet.
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
            {results.map((result, index) => (
              <div key={result.id}>
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

          <button
            type="button"
            className="hidden min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)] lg:inline-flex"
          >
            View all demonstration results ({results.length})
            <ChevronRight className="h-4 w-4 rotate-90" aria-hidden />
          </button>

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
          sourceCount={reviewedSourceCount}
          evidenceState={evidenceState}
          loading={loading}
          onRunSourceSearch={rerunSearch}
        />
      </div>

      <div className="fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
        <Link
          href={routeWithQuery("/differentials/presentations", query)}
          className="mx-auto flex min-h-14 max-w-[26rem] items-center justify-center gap-3 rounded-xl bg-[color:var(--clinical-accent)] px-4 text-sm font-extrabold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-elevated)]"
        >
          <GitCompareArrows className="h-5 w-5" aria-hidden />
          Compare selected ({selectedCount})
          <ChevronRight className="ml-auto h-5 w-5" aria-hidden />
        </Link>
      </div>

      <p className="pb-3 text-center text-xs font-medium text-[color:var(--text-muted)] lg:hidden">
        Clinical decision support only. Review before use.
      </p>
    </div>
  );
}

export function DifferentialsHome({
  query,
  loading,
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

  if (trimmedQuery) {
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
        subtitle="Compare demonstration differentials against matches from your indexed library."
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
        footer={
          <p className="mx-auto flex items-center justify-center gap-2 text-center text-xs font-medium text-[color:var(--text-muted)] sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
            Clinical decision support only. Review before use.
          </p>
        }
      />
    </div>
  );
}
