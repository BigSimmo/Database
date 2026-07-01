import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Filter,
  FlaskConical,
  GitCompareArrows,
  MoreHorizontal,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { CopyAfterReviewButton } from "@/components/differentials/differential-presentation-actions";
import { cn } from "@/components/ui-primitives";
import {
  acuteConfusionPresentationWorkflow,
  getDifferentialRecord,
  type DifferentialComparisonCriterion,
  type DifferentialRecord,
  type DifferentialSection,
} from "@/lib/differentials";

type CandidateView = {
  record: DifferentialRecord;
  selected: boolean;
  comparison: Record<string, string>;
};

const criterionIcon: Record<DifferentialSection["tone"], LucideIcon> = {
  fit: CheckCircle2,
  warning: ShieldAlert,
  question: CircleHelp,
  action: Activity,
  test: FlaskConical,
  overlap: MoreHorizontal,
};

const criterionTone: Record<DifferentialSection["tone"], string> = {
  fit: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success)]",
  warning: "border-rose-200 bg-rose-50 text-rose-600",
  question: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  action:
    "border-[color:var(--clinical-chat-teal)]/24 bg-[color:var(--clinical-chat-teal-soft)] text-[color:var(--clinical-chat-teal)]",
  test: "border-blue-400/30 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200",
  overlap: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

const rowTone: Record<DifferentialSection["tone"], string> = {
  fit: "bg-[color:var(--surface)]",
  warning: "bg-rose-50/75",
  question: "bg-[color:var(--surface)]",
  action: "bg-[color:var(--clinical-chat-teal-soft)]/55",
  test: "bg-[color:var(--surface)]",
  overlap: "bg-[color:var(--surface)]",
};

function statusLabel(status: DifferentialRecord["status"]) {
  if (status === "emergent") return "Emergency";
  if (status === "urgent") return "Urgent";
  return "Routine";
}

function statusClassName(status: DifferentialRecord["status"]) {
  if (status === "emergent") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "urgent") {
    return "border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]";
  }
  return "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]";
}

function CandidateGlyph({
  record,
  className,
}: {
  record: DifferentialRecord;
  className?: string;
}) {
  if (record.slug.includes("substance")) return <FlaskConical className={className} aria-hidden />;
  if (record.slug.includes("post-ictal")) return <Activity className={className} aria-hidden />;
  if (record.slug.includes("hepatic")) return <Stethoscope className={className} aria-hidden />;
  if (record.slug.includes("meningitis")) return <ShieldAlert className={className} aria-hidden />;
  return <BrainCircuit className={className} aria-hidden />;
}

function comparisonCopy(candidates: CandidateView[]) {
  return [
    `${acuteConfusionPresentationWorkflow.title} comparison`,
    acuteConfusionPresentationWorkflow.safetySnapshot.summary,
    "",
    ...candidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => {
        const mustNotMiss = candidate.comparison["must-not-miss"] ?? "Review must-not-miss risks.";
        const action = candidate.comparison["immediate-action"] ?? "Review immediate action.";
        return `${candidate.record.title}: ${mustNotMiss} Immediate action: ${action}`;
      }),
  ].join("\n");
}

function getCandidates(): CandidateView[] {
  return acuteConfusionPresentationWorkflow.candidates.flatMap((candidate) => {
    const record = getDifferentialRecord(candidate.slug);
    if (!record) return [];
    return [
      {
        record,
        selected: candidate.selected,
        comparison: candidate.comparison,
      },
    ];
  });
}

function EmergencyBadge({ status }: { status: DifferentialRecord["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-md border px-2 text-[11px] font-extrabold uppercase leading-none",
        statusClassName(status),
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function Breadcrumbs() {
  return (
    <nav aria-label="Differential breadcrumbs" className="flex min-w-0 items-center gap-2 text-xs font-semibold">
      <Link href="/differentials" className="text-[color:var(--clinical-chat-teal)] hover:underline">
        Differentials
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      <Link href="/differentials/presentations" className="text-[color:var(--text-muted)] hover:underline">
        Presentation
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      <span className="truncate text-[color:var(--text-muted)]">Compare</span>
    </nav>
  );
}

function CriteriaLabel({ criterion }: { criterion: DifferentialComparisonCriterion }) {
  const Icon = criterionIcon[criterion.tone];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border", criterionTone[criterion.tone])}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">
        {criterion.title}
      </span>
    </span>
  );
}

function CandidateHeader({ candidate }: { candidate: CandidateView }) {
  return (
    <Link
      href={`/differentials/diagnoses/${candidate.record.slug}`}
      className="group grid min-h-[5.5rem] min-w-[8.75rem] content-start justify-items-center gap-2 px-2.5 py-3 text-center hover:bg-[color:var(--surface-subtle)]"
    >
      <CandidateGlyph
        record={candidate.record}
        className="h-6 w-6 text-[color:var(--text-muted)] group-hover:text-[color:var(--clinical-chat-teal)]"
      />
      <span className="max-w-[7.75rem] text-balance text-[13px] font-extrabold leading-4 text-[color:var(--text-heading)]">
        {candidate.record.title}
      </span>
      <EmergencyBadge status={candidate.record.status} />
    </Link>
  );
}

function DesktopComparisonTable({ candidates }: { candidates: CandidateView[] }) {
  const workflow = acuteConfusionPresentationWorkflow;
  return (
    <section className="hidden xl:block" aria-label="Desktop differential comparison table">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
          >
            <CheckCircle2 className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" aria-hidden />
            {workflow.selectedCount} of {workflow.totalCount} selected
            <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
          >
            <SlidersHorizontal className="h-4 w-4 text-[color:var(--clinical-chat-teal)]" aria-hidden />
            Edit columns
          </button>
        </div>
        <Link
          href="/differentials/diagnoses"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]"
        >
          More differentials
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div
        data-testid="differential-comparison-scroll"
        className="polished-scroll overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]"
      >
        <table className="min-w-[84rem] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[11.5rem] border-b border-r border-[color:var(--border)] bg-[color:var(--clinical-chat-table-header)] px-4 py-4 align-top text-xs font-extrabold uppercase text-[color:var(--text-muted)]">
                Criteria
                <span className="mt-2 block text-[11px] font-bold normal-case text-[color:var(--text-soft)]">
                  Reorder
                </span>
              </th>
              {candidates.map((candidate) => (
                <th
                  key={candidate.record.slug}
                  className={cn(
                    "w-[9rem] border-b border-r border-[color:var(--border)] bg-[color:var(--clinical-chat-table-header)] p-0 align-top",
                    !candidate.selected && "bg-[color:var(--surface-subtle)]/75",
                  )}
                >
                  <CandidateHeader candidate={candidate} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workflow.criteria.map((criterion) => (
              <tr key={criterion.id} className={rowTone[criterion.tone]}>
                <th className="sticky left-0 z-10 w-[11.5rem] border-b border-r border-[color:var(--border)] bg-inherit px-4 py-4 align-top">
                  <CriteriaLabel criterion={criterion} />
                </th>
                {candidates.map((candidate) => (
                  <td
                    key={`${candidate.record.slug}-${criterion.id}`}
                    className={cn(
                      "w-[9rem] border-b border-r border-[color:var(--border)] px-3.5 py-4 align-top text-[11px] font-semibold leading-[1.55] text-[color:var(--text-muted)]",
                      !candidate.selected && "text-[color:var(--text-muted)]",
                    )}
                  >
                    {candidate.comparison[criterion.id] ?? "Review locally."}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs font-medium text-[color:var(--text-muted)]">
        Scroll horizontally to review more candidate differentials. Clinical decision support only. Review before use.
      </p>
    </section>
  );
}

function SafetySnapshot() {
  const workflow = acuteConfusionPresentationWorkflow;
  return (
    <section
      className="rounded-lg border border-rose-200 bg-rose-50/85 p-4 shadow-[var(--shadow-inset)]"
      aria-label="Safety snapshot"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-200 bg-white text-rose-600">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold uppercase text-rose-700">Safety snapshot</h2>
            <EmergencyBadge status={workflow.status} />
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--text-heading)]">
            {workflow.safetySnapshot.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {workflow.safetySnapshot.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex min-h-7 items-center rounded-md border border-rose-200 bg-white px-2 text-xs font-bold text-rose-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectedDifferentialsPanel({ candidates }: { candidates: CandidateView[] }) {
  const selectedCandidates = candidates.filter((candidate) => candidate.selected);
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold uppercase text-[color:var(--text-muted)]">
          Selected differentials ({selectedCandidates.length} of {acuteConfusionPresentationWorkflow.totalCount})
        </h2>
        <span className="text-xs font-bold text-[color:var(--clinical-chat-teal)]">+2</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[color:var(--text-muted)]">
        {selectedCandidates.map((candidate) => {
          return (
            <CandidateGlyph key={candidate.record.slug} record={candidate.record} className="h-6 w-6 stroke-[1.7]" />
          );
        })}
      </div>
      <p className="mt-3 text-xs font-medium text-[color:var(--text-muted)]">
        Long press to reorder. Tap to remove.
      </p>
      <ul className="polished-scroll mt-3 max-h-[11rem] overflow-y-auto pr-1">
        {selectedCandidates.map((candidate) => (
          <li
            key={candidate.record.slug}
            className="flex min-h-9 items-center justify-between gap-2 border-t border-[color:var(--border)] py-2 text-sm font-bold text-[color:var(--text-heading)]"
          >
            <Link href={`/differentials/diagnoses/${candidate.record.slug}`} className="inline-flex min-w-0 items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden />
              <span className="truncate">{candidate.record.title}</span>
            </Link>
            <MoreHorizontal className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HighestUrgencyPanel({ candidates }: { candidates: CandidateView[] }) {
  const emergent = candidates.filter((candidate) => candidate.selected && candidate.record.status === "emergent");
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-sm font-extrabold uppercase text-[color:var(--text-muted)]">Highest urgency</h2>
      <p className="mt-1 text-xs font-medium text-[color:var(--text-soft)]">Based on current selection</p>
      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3">
        <EmergencyBadge status="emergent" />
        <ul className="mt-3 grid gap-1.5 text-sm font-semibold text-[color:var(--text-heading)]">
          {emergent.slice(0, 3).map((candidate) => (
            <li key={candidate.record.slug}>{candidate.record.title}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-[color:var(--text-muted)]">
          {acuteConfusionPresentationWorkflow.highestUrgencyNote}
        </p>
      </div>
    </section>
  );
}

function ReviewPanel() {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-sm font-extrabold uppercase text-[color:var(--text-muted)]">Review & handoff</h2>
      <ul className="mt-3 grid gap-2">
        {acuteConfusionPresentationWorkflow.reviewChecklist.map((item) => (
          <li key={item} className="flex gap-2 text-xs font-bold leading-5 text-[color:var(--text-heading)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href="/differentials/diagnoses/delirium"
        className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[color:var(--clinical-chat-teal)]"
      >
        View handoff template
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

function SourceStatusPanel() {
  const status = acuteConfusionPresentationWorkflow.sourceStatus;
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-sm font-extrabold uppercase text-[color:var(--text-muted)]">Source status</h2>
      <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--clinical-chat-amber)]">
        <CircleHelp className="h-4 w-4" aria-hidden />
        {status.label}
      </p>
      <p className="mt-2 text-xs font-semibold text-[color:var(--text-muted)]">{status.version}</p>
      <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)]">Last updated: {status.lastUpdated}</p>
      <Link
        href="/differentials/diagnoses/delirium"
        className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[color:var(--clinical-chat-teal)]"
      >
        View details
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

function MobileCandidateCard({
  candidate,
  index,
}: {
  candidate: CandidateView;
  index: number;
}) {
  return (
    <details
      className="group rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
      open={index === 0}
    >
      <summary className="grid min-h-14 cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[color:var(--clinical-chat-teal)]/35 bg-[color:var(--clinical-chat-teal-soft)] text-sm font-extrabold text-[color:var(--clinical-chat-teal)]">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <CandidateGlyph record={candidate.record} className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
            <span className="line-clamp-2 text-base font-extrabold leading-5 text-[color:var(--text-heading)]">
              {candidate.record.title}
            </span>
          </span>
        </span>
        <EmergencyBadge status={candidate.record.status} />
        <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)] transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-[color:var(--border)] px-3 pb-2">
        {acuteConfusionPresentationWorkflow.criteria.map((criterion) => {
          const Icon = criterionIcon[criterion.tone];
          return (
            <div key={criterion.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 border-b border-[color:var(--border)] py-3 last:border-b-0">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full border", criterionTone[criterion.tone])}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-[color:var(--text-heading)]">{criterion.title}</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                  {candidate.comparison[criterion.id] ?? "Review locally."}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function MobileComparison({ candidates }: { candidates: CandidateView[] }) {
  const selected = candidates.filter((candidate) => candidate.selected);
  return (
    <section className="grid gap-3 xl:hidden" aria-label="Mobile differential comparison">
      <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <BrainCircuit className="h-4 w-4 shrink-0 text-[color:var(--clinical-chat-teal)]" aria-hidden />
            {acuteConfusionPresentationWorkflow.selectedCount} of {acuteConfusionPresentationWorkflow.totalCount} selected
          </span>
          <ChevronDown className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden />
        </button>
        <button
          type="button"
          className="grid h-11 w-12 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
          aria-label="Filter differential columns"
        >
          <Filter className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <SafetySnapshot />
      <div className="grid gap-3">
        {selected.map((candidate, index) => (
          <MobileCandidateCard key={candidate.record.slug} candidate={candidate} index={index} />
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 rounded-t-xl border-t border-[color:var(--clinical-chat-teal)]/35 bg-[color:var(--clinical-chat-teal)] p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-elevated)]">
        <Link
          href="/differentials/presentations"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/5 px-2 text-xs font-extrabold text-white shadow-[var(--shadow-inset)] sm:text-sm"
        >
          <GitCompareArrows className="h-4 w-4" aria-hidden />
          Compare ({acuteConfusionPresentationWorkflow.selectedCount} selected)
        </Link>
        <CopyAfterReviewButton
          text={comparisonCopy(candidates)}
          className="min-h-12 bg-[color:var(--surface)] px-2 !text-xs !text-[color:var(--clinical-chat-teal)] hover:bg-[color:var(--surface-raised)] sm:!text-sm"
        />
      </div>
    </section>
  );
}

function MobileTabs() {
  return (
    <nav
      aria-label="Differential presentation sections"
      className="mb-4 grid grid-cols-4 border-b border-[color:var(--border)] text-center text-sm font-bold xl:hidden"
    >
      {["Overview", "Compare", "Map", "Related"].map((item) => {
        const active = item === "Compare";
        return (
          <Link
            key={item}
            href={active ? "/differentials/presentations" : "/differentials/diagnoses/delirium"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-h-11 border-b-2 px-1 py-3",
              active
                ? "border-[color:var(--clinical-chat-teal)] text-[color:var(--clinical-chat-teal)]"
                : "border-transparent text-[color:var(--text-muted)]",
            )}
          >
            {item}
          </Link>
        );
      })}
    </nav>
  );
}

export function DifferentialPresentationWorkflowPage({ query = "" }: { query?: string }) {
  const workflow = acuteConfusionPresentationWorkflow;
  const candidates = getCandidates();
  const selectedCandidates = candidates.filter((candidate) => candidate.selected);

  return (
    <main
      data-testid="differential-presentation-page"
      className="min-h-[calc(100dvh-4rem)] overflow-x-hidden bg-[color:var(--background)] px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-4 text-[color:var(--text)] sm:px-5 xl:px-7 xl:pb-8 xl:pt-6"
    >
      <div className="mx-auto grid w-full max-w-[94rem] gap-5 xl:grid-cols-[minmax(0,1fr)_23.5rem]">
        <div className="min-w-0">
          <div className="mb-4 hidden items-center gap-5 xl:flex">
            <Link
              href="/differentials"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Link>
            <div className="h-8 w-px bg-[color:var(--border)]" aria-hidden />
            <Breadcrumbs />
          </div>

          <div className="mb-4 grid gap-3 xl:hidden">
            <Link
              href="/differentials"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg text-sm font-bold text-[color:var(--clinical-chat-teal)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to differentials
            </Link>
            <Breadcrumbs />
          </div>

          <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="max-w-[58rem] text-2xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-3xl xl:whitespace-nowrap xl:text-[22px] xl:leading-[1.2]">
                  {workflow.title}
                </h1>
                <EmergencyBadge status={workflow.status} />
              </div>
              <p className="mt-2 max-w-[44rem] text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                {workflow.subtitle}
              </p>
              {query ? (
                <p className="mt-2 text-sm font-bold text-[color:var(--clinical-chat-teal)]">Query: {query}</p>
              ) : null}
            </div>
            <div className="hidden items-center gap-2 xl:flex">
              <Link
                href="/differentials/diagnoses"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--clinical-chat-teal)] shadow-[var(--shadow-inset)]"
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden />
                Switch differential
              </Link>
              <span className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-[color:var(--text-muted)]">
                {workflow.selectedCount} selected
              </span>
              <div className="inline-flex rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-inset)]">
                <button
                  type="button"
                  className="min-h-9 rounded-md border border-[color:var(--clinical-chat-teal)]/35 bg-[color:var(--clinical-chat-teal-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-chat-teal)]"
                >
                  Compact
                </button>
                <button type="button" className="min-h-9 rounded-md px-3 text-xs font-bold text-[color:var(--text-muted)]">
                  Detailed
                </button>
              </div>
            </div>
          </section>

          <MobileTabs />
          <DesktopComparisonTable candidates={candidates} />
          <MobileComparison candidates={candidates} />
        </div>

        <aside className="hidden min-w-0 gap-4 xl:grid" aria-label="Differential review sidebar">
          <SafetySnapshot />
          <SelectedDifferentialsPanel candidates={candidates} />
          <HighestUrgencyPanel candidates={candidates} />
          <ReviewPanel />
          <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
            <h2 className="text-sm font-extrabold uppercase text-[color:var(--text-muted)]">Copy after review</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">
              Create a concise comparison summary for documentation or handoff.
            </p>
            <CopyAfterReviewButton text={comparisonCopy(selectedCandidates)} className="mt-3 w-full" />
          </section>
          <SourceStatusPanel />
        </aside>
      </div>

      <div className="mx-auto mt-5 max-w-[94rem] xl:hidden">
        <p className="text-center text-xs font-medium text-[color:var(--text-muted)]">
          Clinical decision support only. Review before use.
        </p>
      </div>
    </main>
  );
}
