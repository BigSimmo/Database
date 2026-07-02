import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bookmark,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCopy,
  Clock3,
  FlaskConical,
  GitBranch,
  GitCompareArrows,
  MoreVertical,
  Plus,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";

import { DiagnosisMapPanel } from "@/components/differentials/diagnosis-map-panel";
import { cn } from "@/components/ui-primitives";
import type { DifferentialRecord, DifferentialSection } from "@/lib/differentials";

const sectionIcons: Record<DifferentialSection["tone"], typeof CheckCircle2> = {
  fit: CheckCircle2,
  warning: AlertTriangle,
  question: CircleHelp,
  action: Activity,
  test: FlaskConical,
  overlap: GitBranch,
};

const sectionTone: Record<DifferentialSection["tone"], string> = {
  fit: "border-[color:var(--success)]/20 bg-[color:var(--success-soft)] text-[color:var(--success)]",
  warning: "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  question: "border-[color:var(--info)]/25 bg-[color:var(--info-soft)] text-[color:var(--info)]",
  action:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  test: "border-[color:var(--info-border)] bg-[color:var(--info-soft)] text-[color:var(--info)]",
  overlap: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

const statusTone: Record<DifferentialRecord["status"], string> = {
  emergent: "border-[color:var(--danger)]/25 bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
  urgent: "border-[color:var(--warning)]/25 bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  routine: "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
};

const rowMeta: Record<DifferentialSection["tone"], { label: string; badge: string; badgeClassName: string }> = {
  fit: {
    label: "Key features",
    badge: "4 present",
    badgeClassName: "bg-[color:var(--success-soft)] text-[color:var(--success)]",
  },
  warning: {
    label: "High-risk causes",
    badge: "3 possible",
    badgeClassName: "bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
  },
  question: {
    label: "Helpful clues",
    badge: "2 positive",
    badgeClassName: "bg-[color:var(--info-soft)] text-[color:var(--info)]",
  },
  action: {
    label: "Priority steps",
    badge: "2 pending",
    badgeClassName: "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  },
  test: {
    label: "Core tests",
    badge: "6",
    badgeClassName: "bg-[color:var(--info-soft)] text-[color:var(--info)]",
  },
  overlap: {
    label: "Consider",
    badge: "8",
    badgeClassName: "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  },
};

function statusLabel(status: DifferentialRecord["status"]) {
  if (status === "emergent") return "Emergent";
  if (status === "urgent") return "Urgent";
  return "Routine";
}

/** Maps a related node's likelihood to its own severity tag, mirroring the record-status tones. */
function likelihoodTag(likelihood: DifferentialRecord["related"][number]["likelihood"]) {
  if (likelihood === "must-not-miss") return { label: "Emergent", className: statusTone.emergent };
  if (likelihood === "possible") return { label: "Urgent", className: statusTone.urgent };
  return { label: "Review", className: statusTone.routine };
}

function SectionRow({ section }: { section: DifferentialSection }) {
  const Icon = sectionIcons[section.tone];
  const meta = rowMeta[section.tone];
  return (
    <article className="group grid min-h-[4.25rem] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 last:border-b-0 sm:min-h-[4.75rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_5.5rem_2rem] sm:px-4 sm:py-3">
      <span
        className={cn("grid h-9 w-9 place-items-center rounded-lg border sm:h-10 sm:w-10", sectionTone[section.tone])}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-[color:var(--text-heading)] sm:text-base">{section.title}</h2>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
          {section.summary}
        </p>
      </div>
      <span className="hidden justify-self-end text-xs font-semibold text-[color:var(--text-muted)] sm:block">
        {meta.label}
      </span>
      <span
        className={cn(
          "justify-self-end rounded-md px-2 py-1 text-xs font-bold shadow-[var(--shadow-inset)]",
          meta.badgeClassName,
        )}
      >
        {meta.badge}
      </span>
      <ChevronDown
        className="hidden h-4 w-4 justify-self-end text-[color:var(--text-soft)] transition group-hover:translate-y-0.5 sm:block"
        aria-hidden
      />
    </article>
  );
}

function SafetySnapshot({ record }: { record: DifferentialRecord }) {
  const isDelirium = record.slug === "delirium";
  const facts = isDelirium
    ? [
        { label: "High risk", value: "Yes", icon: ShieldAlert },
        { label: "Onset", value: "Acute", icon: Clock3 },
        { label: "Course", value: "Fluctuating", icon: CheckCircle2 },
        { label: "Treatable", value: "Often", icon: Plus },
      ]
    : [
        { label: "High risk", value: record.status === "urgent" ? "Possible" : "Yes", icon: ShieldAlert },
        { label: "Onset", value: "Acute", icon: Clock3 },
        { label: "Course", value: "Variable", icon: CheckCircle2 },
        { label: "Treatable", value: "Often", icon: Plus },
      ];

  return (
    <section className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)]/50 p-3 shadow-[var(--shadow-inset)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[color:var(--danger)]/20 bg-[color:var(--surface)] text-[color:var(--danger)] sm:h-9 sm:w-9">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.04em] text-[color:var(--danger)]">
              Safety snapshot
            </h2>
            <span
              className={cn(
                "inline-flex min-h-6 items-center rounded-md border px-2 text-2xs font-extrabold uppercase",
                statusTone[record.status],
              )}
            >
              {statusLabel(record.status)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{record.safetySnapshot.summary}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 border-y border-[color:var(--danger)]/14 py-3">
            {facts.map((fact, index) => {
              const Icon = fact.icon;
              return (
                <div
                  key={fact.label}
                  className={cn("min-w-0", index > 0 && "border-l border-[color:var(--danger)]/14 pl-2 sm:pl-4")}
                >
                  <p className="grid gap-1 text-3xs font-bold leading-tight text-[color:var(--text-heading)] sm:flex sm:items-center sm:gap-2 sm:text-xs">
                    <Icon className="h-3.5 w-3.5 text-[color:var(--danger)] sm:h-4 sm:w-4" aria-hidden />
                    <span>{fact.label}</span>
                  </p>
                  <p className="mt-1 text-3xs font-semibold text-[color:var(--text-muted)] sm:text-xs">{fact.value}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[color:var(--text-heading)]">Immediate priorities</span>
            {record.safetySnapshot.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex min-h-7 items-center rounded-md bg-[color:var(--surface-subtle)] px-2.5 text-2xs font-semibold text-[color:var(--text-muted)]"
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

function RelatedDiagnoses({ record }: { record: DifferentialRecord }) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Related diagnoses
      </h2>
      <ul className="mt-3 grid gap-2">
        {record.related.slice(0, 4).map((node) => {
          const tag = likelihoodTag(node.likelihood);
          return (
            <li key={node.id} className="flex items-center justify-between gap-2 text-xs font-bold">
              <span className="min-w-0 truncate text-[color:var(--text-heading)]">{node.label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-1.5 py-0.5 text-3xs font-extrabold uppercase",
                  tag.className,
                )}
              >
                {tag.label}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="#related"
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--clinical-accent)]"
      >
        View all related ({record.related.length})
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}

function CurrentPresentation({ record }: { record: DifferentialRecord }) {
  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
        Current presentation
      </h2>
      <ul className="mt-3 grid gap-2 text-xs font-semibold text-[color:var(--text-muted)]">
        {record.currentPresentation.map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompareBasket({ record }: { record: DifferentialRecord }) {
  const items = [
    {
      id: "self",
      label: record.title,
      tag: { label: statusLabel(record.status), className: statusTone[record.status] },
    },
    ...record.related
      .slice(0, 2)
      .map((node) => ({ id: node.id, label: node.label, tag: likelihoodTag(node.likelihood) })),
  ];

  return (
    <section className="hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] lg:block">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
          Compare basket ({items.length})
        </h2>
        <button type="button" className="text-xs font-bold text-[color:var(--clinical-accent)]">
          Clear
        </button>
      </div>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 text-xs font-bold text-[color:var(--text-heading)]"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <BrainCircuit className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
              <span className="truncate">{item.label}</span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-md border px-1.5 py-0.5 text-3xs font-extrabold uppercase",
                item.tag.className,
              )}
            >
              {item.tag.label}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-4 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-soft)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Compare selected ({items.length})
      </button>
    </section>
  );
}

function FooterStatus() {
  return (
    <section className="grid gap-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-xs shadow-[var(--shadow-inset)] sm:grid-cols-3">
      {[
        ["Source status", "Source pending review", "Last updated: Today"],
        ["Review status", "Review before use", "Use clinical judgement and local protocols."],
        ["Version", "v1.0 | Local content only", "Data not provided for clinical use."],
      ].map(([title, line, detail]) => (
        <div
          key={title}
          className="min-w-0 sm:border-l sm:border-[color:var(--border)] sm:pl-4 first:sm:border-l-0 first:sm:pl-0"
        >
          <p className="font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{title}</p>
          <p className="mt-3 font-bold text-[color:var(--warning)]">{line}</p>
          <p className="mt-2 leading-5 text-[color:var(--text-muted)]">{detail}</p>
        </div>
      ))}
    </section>
  );
}

function TopActions() {
  return (
    <div className="hidden items-center gap-3 lg:flex">
      <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Add to compare
      </button>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] px-4 text-sm font-bold text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]">
        <ClipboardCopy className="h-4 w-4" aria-hidden />
        Copy after review
      </button>
      <button
        className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        aria-label="Save diagnosis"
      >
        <Bookmark className="h-4 w-4" aria-hidden />
      </button>
      <button
        className="grid h-11 w-11 place-items-center rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        aria-label="More actions"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function MobilePrimaryActions({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-2 shadow-[var(--shadow-soft)] lg:hidden">
      <button
        type="button"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[color:var(--clinical-accent)] px-3 text-sm font-bold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)]"
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden />
        Compare ({count})
      </button>
      <button
        type="button"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--clinical-accent)]"
      >
        <ClipboardCopy className="h-4 w-4" aria-hidden />
        Copy
      </button>
    </div>
  );
}

function IconForDiagnosis({ record }: { record: DifferentialRecord }) {
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-[color:var(--clinical-accent)]">
      {record.slug === "delirium" ? (
        <BrainCircuit className="h-12 w-12 stroke-[1.7]" aria-hidden />
      ) : (
        <Stethoscope className="h-12 w-12 stroke-[1.7]" aria-hidden />
      )}
    </span>
  );
}

function HeaderChrome() {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/differentials"
            aria-label="Back to differentials"
            className="grid h-10 w-10 place-items-center rounded-lg text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]"
          >
            <ChevronRight className="h-5 w-5 rotate-180" aria-hidden />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-lg border border-[color:var(--success)]/20 bg-[color:var(--success-soft)] px-3 py-2 text-xs font-bold text-[color:var(--success)] sm:inline-flex">
            Local only
          </span>
          <span className="hidden rounded-lg border border-[color:var(--warning)]/20 bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-bold text-[color:var(--warning)] sm:inline-flex">
            Source pending review
          </span>
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-[color:var(--text-heading)] hover:bg-[color:var(--surface-subtle)]"
            aria-label="New item"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

function Tabs() {
  return (
    <nav
      className="flex border-b border-[color:var(--border)] text-sm font-bold text-[color:var(--text-muted)]"
      aria-label="Diagnosis sections"
    >
      {["Overview", "Compare", "Map", "Related", "Source"].map((tab, index) => (
        <a
          key={tab}
          href={`#${tab.toLowerCase()}`}
          className={cn(
            "min-h-11 flex-1 px-2 py-3 text-center sm:flex-none sm:px-4",
            index === 0
              ? "border-b-2 border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
              : "hover:text-[color:var(--text-heading)]",
            tab === "Source" && "hidden sm:block",
          )}
        >
          {tab}
        </a>
      ))}
    </nav>
  );
}

export function DifferentialDetailPage({ record }: { record: DifferentialRecord }) {
  return (
    <main
      data-testid="differential-detail-page"
      className="min-h-dvh bg-[color:var(--background)] pb-24 text-[color:var(--text)] lg:pb-6"
    >
      <HeaderChrome />
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-3 sm:px-6 sm:py-4 lg:gap-5 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <nav aria-label="Differential breadcrumbs" className="mb-3 flex items-center gap-2 text-xs font-semibold">
              <Link href="/differentials" className="text-[color:var(--clinical-accent)]">
                Differentials
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
              <span className="text-[color:var(--text-muted)]">Diagnosis</span>
              <ChevronRight className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
              <span className="text-[color:var(--text-muted)]">{record.title}</span>
            </nav>
            <div className="flex items-start gap-3 sm:gap-4">
              <IconForDiagnosis record={record} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-extrabold leading-tight text-[color:var(--text-heading)] sm:text-4xl">
                    {record.title}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-extrabold uppercase",
                      statusTone[record.status],
                    )}
                  >
                    {statusLabel(record.status)}
                  </span>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] sm:mt-2 sm:text-base">
                  {record.subtitle}
                </p>
              </div>
            </div>
          </div>
          <TopActions />
        </div>

        <Tabs />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
          <section className="grid gap-4">
            <SafetySnapshot record={record} />
            <div className="h-44 lg:hidden" aria-hidden />
            <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
              {record.sections.map((section) => (
                <SectionRow key={section.id} section={section} />
              ))}
            </div>
            <div className="lg:hidden">
              <DiagnosisMapPanel record={record} />
            </div>
            <MobilePrimaryActions />
            <FooterStatus />
          </section>

          <aside className="grid content-start gap-4">
            <div className="hidden lg:block">
              <DiagnosisMapPanel record={record} />
            </div>
            <RelatedDiagnoses record={record} />
            <CurrentPresentation record={record} />
            <CompareBasket record={record} />
            <p className="hidden rounded-lg border border-transparent px-1 text-xs leading-5 text-[color:var(--text-muted)] lg:block">
              Clinical decision support only. Review before use.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
