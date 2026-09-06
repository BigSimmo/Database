"use client";

import {
  BookOpen,
  Check,
  ClipboardList,
  Clock,
  FileText,
  Heart,
  ListChecks,
  Scale,
  Shield,
  Sparkles,
  Target,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Shared vocabulary for the three Recommend-popup directions.
 * Design-scratch only: this directory 404s in production.
 *
 * Every string below is lifted from the real catalogue record for
 * `exposure-based-cbt-exposure-therapy` in `src/data/therapies-source.json`,
 * trimmed for a card or a panel but never invented. The completeness
 * numbers, the four warnings and the empty review checklist are the
 * record's own, so the popup is judged against the content it will
 * actually have to hold.
 * ------------------------------------------------------------------ */

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export const SCENARIO = "What therapy for anxiety in outpatient care?";

export type RankedMatch = {
  slug: string;
  rank: number;
  name: string;
  short: string;
  category: string;
  summary: string;
  whyMatched: string;
  avoidModify: string;
  bestFit: string;
  tags: string[];
  extraTags: number;
};

export const RANKED: RankedMatch[] = [
  {
    slug: "exposure-based-cbt-exposure-therapy",
    rank: 1,
    name: "Exposure-Based CBT / Exposure Therapy",
    short: "Exposure CBT",
    category: "OCD & Exposure Therapies",
    summary:
      "A behavioural treatment family, usually delivered within CBT, in which the patient deliberately approaches feared cues, sensations, memories or situations rather than avoiding them.",
    whyMatched: "Matches the described presentation. Fits the stated setting and time.",
    avoidModify: "Confirm the feared stimulus is suitable for exposure work and that avoidance is the main barrier.",
    bestFit: "Emergency/acute, Inpatient, Outpatient/community",
    tags: ["Anxiety", "Trauma", "Psychosis"],
    extraTags: 5,
  },
  {
    slug: "graded-exposure",
    rank: 2,
    name: "Graded Exposure",
    short: "Graded exposure",
    category: "OCD & Exposure Therapies",
    summary:
      "A specific exposure-based behavioural method, usually delivered within CBT, in which feared situations are approached in a planned hierarchy from easier to harder.",
    whyMatched: "Matches the described presentation. Fits the stated setting and time.",
    avoidModify: "Confirm the problem is truly avoidance-maintained.",
    bestFit: "Emergency/acute, Inpatient, Outpatient/community",
    tags: ["Anxiety", "Eating/body image", "Trauma"],
    extraTags: 4,
  },
  {
    slug: "psychoeducation",
    rank: 3,
    name: "Psychoeducation",
    short: "Psychoeducation",
    category: "Foundational & Engagement Therapies",
    summary:
      "A foundational cross-diagnostic psychological intervention, usually delivered as part of broader psychiatric care rather than as a stand-alone specialist treatment.",
    whyMatched: "Matches the described presentation. Deliverable inside the stated time.",
    avoidModify: "Check current mental state, cognitive capacity and language before relying on it alone.",
    bestFit: "Emergency/acute, Inpatient, Outpatient/community",
    tags: ["Anxiety", "Eating/body image", "Mood"],
    extraTags: 6,
  },
  {
    slug: "applied-relaxation",
    rank: 4,
    name: "Applied Relaxation",
    short: "Applied relaxation",
    category: "Standard Talking Therapies",
    summary:
      "A structured behavioural method training rapid relaxation that the patient applies in real anxiety-provoking situations rather than only at rest.",
    whyMatched: "Matches the described presentation. Suits outpatient delivery.",
    avoidModify: "Weak as a sole treatment where avoidance is the dominant maintaining factor.",
    bestFit: "Outpatient/community, Family/carer",
    tags: ["Anxiety", "Micro skill", "CBT"],
    extraTags: 3,
  },
  {
    slug: "behavioural-activation",
    rank: 5,
    name: "Behavioural Activation (BA)",
    short: "BA",
    category: "Standard Talking Therapies",
    summary:
      "A structured behavioural treatment that rebuilds contact with reinforcing activity, most often used for depression and for anxiety with marked withdrawal.",
    whyMatched: "Partial match. Indicated where withdrawal and inactivity dominate.",
    avoidModify: "Not the first choice where the maintaining mechanism is fear-driven avoidance.",
    bestFit: "Outpatient/community, Inpatient",
    tags: ["Mood", "Anxiety", "CBT"],
    extraTags: 4,
  },
  {
    slug: "acceptance-and-commitment-therapy",
    rank: 6,
    name: "Acceptance and Commitment Therapy (ACT)",
    short: "ACT",
    category: "Standard Talking Therapies",
    summary:
      "A contextual behavioural therapy that targets experiential avoidance and builds values-based action alongside acceptance and defusion skills.",
    whyMatched: "Partial match. Alternative where exposure is declined or poorly tolerated.",
    avoidModify: "Confirm the patient can work with an acceptance frame before substituting it for exposure.",
    bestFit: "Outpatient/community, Group",
    tags: ["Anxiety", "Mood", "Chronic pain"],
    extraTags: 5,
  },
];

export const TOP = RANKED[0];

/* -- The record behind the popup ---------------------------------------- */

export const RECORD = {
  mechanism:
    "Anxiety and related distress are often maintained by avoidance, escape, reassurance or safety behaviours. Treatment works by helping the patient stay in contact with feared stimuli long enough for new learning to occur and for the avoidance loop to weaken.",
  bestUsedFor:
    "Strongest uses are phobic disorders, panic disorder, social anxiety disorder, and exposure-based elements within broader CBT.",
  targetSymptoms:
    "Avoidance, escape behaviour, safety behaviours, conditioned fear, catastrophic expectancy, reassurance dependence and anxiety-driven life narrowing.",
  steps: [
    "Build a behavioural formulation linking trigger, fear prediction, avoidance, short-term relief and long-term maintenance.",
    "Identify the feared cues and what the patient predicts will happen.",
    "Build a graded exposure hierarchy.",
    "Begin structured exposure to feared situations, objects, memories or cues.",
    "Reduce escape, reassurance and safety behaviours so the old loop is not preserved.",
    "Repeat exposure until new learning is consolidated.",
    "Generalise to real-world situations.",
    "End with relapse-prevention planning around renewed avoidance.",
  ],
  cautions:
    "Confirm the feared stimulus is suitable for exposure work and that the main barrier is avoidance, not psychosis, delirium, unstable substance withdrawal, severe dissociation or another syndrome needing a different first-line treatment. Clarify whether the patient needs a more specific subtype such as ERP, interoceptive exposure or prolonged exposure.",
  pitfalls: [
    "Calling discussion about fear exposure without real approach behaviour.",
    "Building hierarchies that are too weak or too abstract.",
    "Letting reassurance or covert safety behaviours continue.",
    "Stopping once distress drops a little rather than consolidating new learning.",
  ],
  warnings: [
    "No explicit patient-facing explanation in uploaded record",
    "No explicit last reviewed date in therapy card",
    "Missing last reviewed date",
    "Not clinically reviewed",
  ],
  facts: [
    { icon: Users, label: "Population", value: "Avoidance-maintained anxiety, able to engage with a graded model" },
    { icon: Clock, label: "Time required", value: "NICE: 7 to 14 hours for panic, weekly, within 4 months" },
    { icon: Target, label: "Setting", value: "Emergency/acute, Inpatient, Outpatient/community, Family/carer" },
    { icon: Scale, label: "Complexity", value: "High. Micro-skill version available for a single session" },
  ],
  source: {
    title: "Single Therapies (uploaded source)",
    reference:
      "RANZCP PS #54 names cognitive and behavioural psychotherapy as a structured psychotherapy used by psychiatrists. NICE panic disorder guidance recommends CBT as the psychological treatment of choice.",
    evidence: "Source recorded, not appraised",
  },
  completeness: [
    { label: "Source", value: 100 },
    { label: "Index", value: 92 },
    { label: "Review", value: 57 },
  ],
  checklist: [
    "Clinical accuracy reviewed",
    "Source checked",
    "Evidence appraised",
    "Safety cautions checked",
    "Patient explanation checked",
    "Proofread",
    "Australian English checked",
  ],
};

/* -- Tab model shared by the three directions --------------------------- */

export type TabId = "overview" | "deliver" | "cautions" | "fit" | "sources" | "plan";

export const TAB_ICONS: Record<TabId, LucideIcon> = {
  overview: Sparkles,
  deliver: ListChecks,
  cautions: TriangleAlert,
  fit: Target,
  sources: BookOpen,
  plan: ClipboardList,
};

/** Short forms for a 400px panel, where "Fit for patient" costs the Sources tab its place. */
export const TAB_LABELS_SHORT: Record<TabId, string> = {
  overview: "Overview",
  deliver: "Deliver",
  cautions: "Cautions",
  fit: "Fit",
  sources: "Sources",
  plan: "Plan",
};

export const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  deliver: "Deliver",
  cautions: "Cautions",
  fit: "Fit for patient",
  sources: "Sources",
  plan: "Plan",
};

/* -- Small primitives --------------------------------------------------- */

export function Eyebrow({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning";
}) {
  return (
    <span
      className={cn(
        "text-3xs font-extrabold uppercase tracking-[0.12em]",
        tone === "accent"
          ? "text-[color:var(--clinical-accent)]"
          : tone === "warning"
            ? "text-[color:var(--warning-text)]"
            : "text-[color:var(--text-soft)]",
      )}
    >
      {children}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
      {children}
    </span>
  );
}

export function ReviewChip({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-3xs font-extrabold text-[color:var(--warning-text)]">
      <TriangleAlert aria-hidden="true" size={11} strokeWidth={2.2} />
      {compact ? "Needs review" : "Needs source review"}
    </span>
  );
}

export function RankChip({ rank }: { rank: number }) {
  return (
    <span className="nums inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1 text-3xs font-extrabold text-[color:var(--text-heading)]">
      {rank}
    </span>
  );
}

/** Advisory line that every direction has to carry somewhere. */
export function AdvisoryLine({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "m-0 flex items-start gap-1.5 text-3xs font-semibold leading-4 text-[color:var(--text-soft)]",
        className,
      )}
    >
      <Shield aria-hidden="true" size={12} strokeWidth={2} className="mt-px shrink-0" />
      Advisory only. Confirm fit, cautions and review status before clinical use.
    </p>
  );
}

/* -- Buttons ------------------------------------------------------------ */

export function GhostButton({
  icon: Icon,
  children,
  onClick,
  pressed,
  className,
  title,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={title}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold whitespace-nowrap transition",
        pressed
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-heading)] hover:border-[color:var(--border-strong)]",
        focusRing,
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" size={14} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function PrimaryButton({
  icon: Icon,
  children,
  onClick,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--text-heading)] bg-[color:var(--text-heading)] px-3.5 text-xs font-bold whitespace-nowrap text-[color:var(--surface)] transition hover:opacity-90",
        focusRing,
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" size={14} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

/* -- The ranked list the popup opens from ------------------------------- */

/**
 * A compact stand-in for the shipped `ResultCard`, drawn at the size the
 * frames need. It is deliberately a copy rather than an import: the study is
 * about what happens when a row is activated, and the production card would
 * bring its own navigation with it.
 */
export function RankedList({
  activeSlug,
  onOpen,
  dense = false,
}: {
  activeSlug: string | null;
  onOpen: (slug: string) => void;
  dense?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {RANKED.map((match) => {
        const active = match.slug === activeSlug;
        return (
          <button
            key={match.slug}
            type="button"
            onClick={() => onOpen(match.slug)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "group w-full rounded-xl border bg-[color:var(--surface)] p-3 text-left transition",
              active
                ? "border-[color:var(--clinical-accent-border)] shadow-[var(--e2)]"
                : "border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:shadow-[var(--e2)]",
              focusRing,
            )}
          >
            <div className="flex items-start gap-2.5">
              <RankChip rank={match.rank} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm-minus font-semibold leading-snug text-[color:var(--text-heading)]">
                    {match.name}
                  </span>
                  {match.rank === 1 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-1.5 py-0.5 text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--clinical-accent)]">
                      <Sparkles aria-hidden="true" size={10} strokeWidth={2.2} />
                      Best match
                    </span>
                  ) : null}
                </div>
                {dense ? null : (
                  <p className="m-0 mt-1 line-clamp-2 text-2xs leading-4 text-[color:var(--text-muted)]">
                    {match.summary}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <ReviewChip compact />
                  {match.tags.slice(0, dense ? 1 : 2).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** The Recommend page header and scenario box the list sits under. */
export function ScenarioHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mb-3">
      <h2
        className={cn(
          "m-0 font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]",
          compact ? "text-base" : "text-lg",
        )}
      >
        Recommend
      </h2>
      <p className="m-0 mt-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
        Rank catalogue therapies against a clinical scenario. Advisory only.
      </p>
      <div className="mt-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
        <Eyebrow>Clinical situation</Eyebrow>
        <p className="m-0 mt-1 text-2xs font-semibold text-[color:var(--text)]">{SCENARIO}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Tag>Outpatient</Tag>
          <Tag>15 minutes</Tag>
          <Tag>Trauma caution</Tag>
        </div>
      </div>
      <p className="m-0 mt-2.5 text-3xs font-bold text-[color:var(--text-soft)]">6 ranked matches</p>
    </div>
  );
}

/* -- Chrome and frames --------------------------------------------------- */

/** The universal app header each frame has to sit under, drawn to scale. */
export function TopBar({ phone = false }: { phone?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        phone ? "h-11" : "h-13",
      )}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--text-heading)] text-3xs font-black text-[color:var(--surface)]">
        PS
      </span>
      <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
        Therapy
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        {["Search", "Recommend", "Compare"].map((item) => (
          <span
            key={item}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-3xs font-bold",
              item === "Recommend"
                ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "text-[color:var(--text-soft)]",
              phone && item === "Compare" ? "hidden" : "",
            )}
          >
            {item}
          </span>
        ))}
      </span>
    </div>
  );
}

export function StudyPage({
  eyebrow,
  title,
  lede,
  points,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  points: Array<{ label: string; body: string }>;
  children: ReactNode;
}) {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[84rem] px-4 py-7 sm:px-6 lg:px-8">
          <Eyebrow tone="accent">{eyebrow}</Eyebrow>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            {lede}
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            {points.map((point) => (
              <div
                key={point.label}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3"
              >
                <dt className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  {point.label}
                </dt>
                <dd className="m-0 mt-1 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
                  {point.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <div className="mx-auto max-w-[84rem] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10">{children}</div>
      </div>
    </main>
  );
}

export function FrameBlock({
  label,
  size,
  note,
  children,
}: {
  label: string;
  size: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{size}</span>
      </div>
      {note ? (
        <p className="m-0 mb-3 max-w-3xl text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">{note}</p>
      ) : null}
      {children}
    </section>
  );
}

/** A desktop viewport the popup can be positioned inside rather than over. */
export function DesktopFrame({ children, tall = false }: { children: ReactNode; tall?: boolean }) {
  return (
    <div
      className={cn(
        "relative isolate w-full overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--background)] shadow-[var(--e2)]",
        tall ? "h-[46rem]" : "h-[41rem]",
      )}
    >
      {children}
    </div>
  );
}

export function PhoneFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0 w-[380px] max-w-full min-w-0">
      <figcaption className="mb-2.5">
        <Eyebrow>{caption}</Eyebrow>
      </figcaption>
      <div className="relative isolate flex h-[44rem] flex-col overflow-hidden rounded-[1.6rem] border border-[color:var(--border-lux)] bg-[color:var(--background)] shadow-[var(--e2)]">
        {children}
      </div>
    </figure>
  );
}

/* -- Content blocks reused by all three popups -------------------------- */

export function FactGrid({ columns = 2 }: { columns?: 1 | 2 }) {
  return (
    <dl className={cn("m-0 grid gap-2", columns === 2 ? "sm:grid-cols-2" : "")}>
      {RECORD.facts.map((fact) => (
        <div
          key={fact.label}
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5"
        >
          <dt className="flex items-center gap-1.5">
            <fact.icon aria-hidden="true" size={12} strokeWidth={2} className="text-[color:var(--text-soft)]" />
            <Eyebrow>{fact.label}</Eyebrow>
          </dt>
          <dd className="m-0 mt-1 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StepList() {
  return (
    <ol className="m-0 list-none space-y-2 p-0">
      {RECORD.steps.map((step, index) => (
        <li key={step} className="flex gap-2.5 text-2xs leading-5 text-[color:var(--text-muted)]">
          <span className="nums mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-3xs font-bold text-[color:var(--text-heading)]">
            {index + 1}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function CautionBlock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] p-3">
        <div className="flex items-center gap-1.5">
          <TriangleAlert aria-hidden="true" size={13} strokeWidth={2} className="text-[color:var(--warning-text)]" />
          <Eyebrow tone="warning">Before you start</Eyebrow>
        </div>
        <p className="m-0 mt-1.5 text-2xs leading-5 text-[color:var(--warning-text)]">{RECORD.cautions}</p>
      </div>
      <div>
        <Eyebrow>Common pitfalls</Eyebrow>
        <ul className="m-0 mt-1.5 list-disc space-y-1 pl-4 text-2xs leading-5 text-[color:var(--text-muted)]">
          {RECORD.pitfalls.map((pitfall) => (
            <li key={pitfall}>{pitfall}</li>
          ))}
        </ul>
      </div>
      <div>
        <Eyebrow>Record warnings (4)</Eyebrow>
        <ul className="m-0 mt-1.5 space-y-1">
          {RECORD.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]"
            >
              <TriangleAlert
                aria-hidden="true"
                size={11}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-[color:var(--warning-text)]"
              />
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SourceBlock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
        <div className="flex items-center gap-1.5">
          <FileText aria-hidden="true" size={13} strokeWidth={2} className="text-[color:var(--text-soft)]" />
          <span className="text-2xs font-bold text-[color:var(--text-heading)]">{RECORD.source.title}</span>
        </div>
        <p className="m-0 mt-1.5 text-2xs leading-5 text-[color:var(--text-muted)]">{RECORD.source.reference}</p>
        <p className="m-0 mt-2 text-3xs font-bold text-[color:var(--text-soft)]">Evidence: {RECORD.source.evidence}</p>
      </div>
      <div>
        <Eyebrow>Completeness</Eyebrow>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {RECORD.completeness.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1.5"
            >
              <div className="nums text-sm font-extrabold text-[color:var(--text-heading)]">{item.value}%</div>
              <div className="text-3xs font-bold text-[color:var(--text-soft)]">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Eyebrow>Review checklist (0 of 7 complete)</Eyebrow>
        <ul className="m-0 mt-1.5 grid gap-1 sm:grid-cols-2">
          {RECORD.checklist.map((item) => (
            <li key={item} className="flex items-center gap-1.5 text-2xs font-semibold text-[color:var(--text-muted)]">
              <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[0.2rem] border border-[color:var(--border-strong)]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function OverviewBlock() {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-2xs leading-5 text-[color:var(--text-muted)]">{TOP.summary}</p>
      <div>
        <Eyebrow tone="accent">How it works</Eyebrow>
        <p className="m-0 mt-1 text-2xs leading-5 text-[color:var(--text-muted)]">{RECORD.mechanism}</p>
      </div>
      <div>
        <Eyebrow tone="accent">Best used for</Eyebrow>
        <p className="m-0 mt-1 text-2xs leading-5 text-[color:var(--text-muted)]">{RECORD.bestUsedFor}</p>
      </div>
      <div>
        <Eyebrow tone="accent">Targets</Eyebrow>
        <p className="m-0 mt-1 text-2xs leading-5 text-[color:var(--text-muted)]">{RECORD.targetSymptoms}</p>
      </div>
    </div>
  );
}

/* -- Form controls the popups collect input with ------------------------ */

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]"
    >
      {children}
    </label>
  );
}

export function SegmentedField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <span className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {label}
      </span>
      <div role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={cn(
                "min-h-12 rounded-lg border px-2.5 text-2xs font-bold transition",
                selected
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
                focusRing,
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 text-2xs font-semibold transition",
        checked
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--text-heading)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-[0.25rem] border",
          checked
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
            : "border-[color:var(--border-strong)]",
        )}
      >
        {checked ? <Check aria-hidden="true" size={11} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0">{label}</span>
    </label>
  );
}

export function FavouriteButton({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      title={saved ? "Remove from favourites" : "Save to favourites"}
      className={cn(
        "grid size-tap shrink-0 place-items-center rounded-lg border transition",
        saved
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
        focusRing,
      )}
    >
      <Heart aria-hidden="true" size={16} strokeWidth={2} fill={saved ? "currentColor" : "none"} />
      <span className="sr-only">{saved ? "Saved to favourites" : "Save to favourites"}</span>
    </button>
  );
}
