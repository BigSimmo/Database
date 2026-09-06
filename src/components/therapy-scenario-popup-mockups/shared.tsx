"use client";

import { useMemo } from "react";
import { Check, Shield, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

import { CATALOGUE, CONSTRAINT_KEYS, TOTAL_RECORDS } from "./catalogue-data";

/* ------------------------------------------------------------------ *
 * Shared vocabulary for the three Recommend *scenario* popup directions.
 * Design-scratch only: this directory 404s in production.
 *
 * The subject is the clinical-situation control at the top of
 * /therapy-compass/recommend — the textarea plus the four chip groups —
 * lifted out of the page and into a popup. The results list is not the
 * subject; it appears only as the thing the popup is aiming at.
 *
 * Constraint keys, labels, groups and the inference rules below are copied
 * from `src/components/therapy-compass/data/select.ts` so the chips behave
 * exactly as they do in the shipped control.
 * ------------------------------------------------------------------ */

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export type GroupId = "setting" | "time" | "support" | "cautions";

export const CONSTRAINT_GROUPS: Array<{ id: GroupId; label: string; help: string }> = [
  { id: "setting", label: "Setting", help: "Where the work will happen" },
  { id: "time", label: "Time", help: "How long you have in front of the patient" },
  { id: "support", label: "Support", help: "What you want to leave the patient with" },
  { id: "cautions", label: "Cautions", help: "What the therapy must not make worse" },
];

export type Constraint = { key: string; label: string; group: GroupId };

/** Verbatim from RECOMMEND_CONSTRAINTS, in the shipped order. */
export const CONSTRAINTS: Constraint[] = [
  { key: "outpatient", label: "Outpatient", group: "setting" },
  { key: "inpatient", label: "Inpatient", group: "setting" },
  { key: "5min", label: "5 minutes", group: "time" },
  { key: "15min", label: "15 minutes", group: "time" },
  { key: "handout", label: "Handout", group: "support" },
  { key: "grounding", label: "Grounding", group: "support" },
  { key: "skills", label: "Skills", group: "support" },
  { key: "psychoeducation", label: "Psychoeducation", group: "support" },
  { key: "trauma", label: "Trauma caution", group: "cautions" },
  { key: "avoid-mania", label: "Avoid mania", group: "cautions" },
];

export function constraintsIn(group: GroupId): Constraint[] {
  return CONSTRAINTS.filter((constraint) => constraint.group === group);
}

export function labelFor(key: string): string {
  return CONSTRAINTS.find((constraint) => constraint.key === key)?.label ?? key;
}

/** Verbatim from `inferRecommendConstraints` — the accent-chip behaviour. */
export function inferConstraints(query: string): string[] {
  const q = query.toLowerCase();
  const inferred: string[] = [];
  if (/\boutpatient\b|\bcommunity\b|\bambulatory\b|\bclinic\b/.test(q)) inferred.push("outpatient");
  if (/\binpatient\b|\bward\b|\badmission\b|\bin-?patient\b/.test(q)) inferred.push("inpatient");
  if (/\b5\s*-?\s*min|\bfive[-\s]?minute|\bmicro[-\s]?session\b/.test(q)) inferred.push("5min");
  if (/\b15\s*-?\s*min|\bfifteen[-\s]?minute/.test(q)) inferred.push("15min");
  if (/\bhandout\b|\bsheet\b|\bleaflet\b/.test(q)) inferred.push("handout");
  if (/\bground(?:ing)?\b/.test(q)) inferred.push("grounding");
  if (/\bskills?\b/.test(q)) inferred.push("skills");
  if (/\bpsychoeduc/.test(q)) inferred.push("psychoeducation");
  if (/\btrauma\b|\bptsd\b/.test(q)) inferred.push("trauma");
  if (/\bmania\b|\bmanic\b|\bhypomania\b|\bbipolar\b/.test(q)) inferred.push("avoid-mania");
  return inferred;
}

/* -- The live counter --------------------------------------------------- */

const KEY_INDEX = new Map<string, number>(CONSTRAINT_KEYS.map((key, index) => [key, index]));

export type Narrowing = {
  /** Records left after every active chip is applied. */
  count: number;
  total: number;
  /** The first few surviving record names, for the preview strip. */
  names: string[];
  /** Chips that are active but exclude nothing — every record already matches. */
  inertKeys: string[];
  /** Chips that would take the result to zero if added to the current set. */
  emptyingKeys: string[];
};

/**
 * Exact for the chip set, because the masks are the shipped predicates' own
 * verdicts. Free-text relevance is deliberately not modelled: the popup shows
 * "records still in scope", not a predicted ranking.
 */
export function narrowing(activeKeys: string[]): Narrowing {
  const bits = activeKeys.map((key) => KEY_INDEX.get(key)).filter((i): i is number => i != null);
  const mask = bits.reduce((acc, index) => acc | (1 << index), 0);
  const surviving = CATALOGUE.filter(([, , recordMask]) => (recordMask & mask) === mask);

  const inertKeys = activeKeys.filter((key) => {
    const index = KEY_INDEX.get(key);
    if (index == null) return false;
    const bit = 1 << index;
    return CATALOGUE.every(([, , recordMask]) => (recordMask & bit) === bit);
  });

  const emptyingKeys = CONSTRAINTS.map((constraint) => constraint.key)
    .filter((key) => !activeKeys.includes(key))
    .filter((key) => {
      const index = KEY_INDEX.get(key);
      if (index == null) return false;
      const next = mask | (1 << index);
      return !CATALOGUE.some(([, , recordMask]) => (recordMask & next) === next);
    });

  return {
    count: surviving.length,
    total: TOTAL_RECORDS,
    names: surviving.slice(0, 6).map(([name]) => name),
    inertKeys,
    emptyingKeys,
  };
}

export function useNarrowing(activeKeys: string[]): Narrowing {
  const signature = activeKeys.slice().sort().join("|");
  return useMemo(() => narrowing(signature ? signature.split("|") : []), [signature]);
}

/* -- Worked example the frames start from -------------------------------- */

export const EXAMPLE_SITUATION =
  "28-year-old with panic attacks and agoraphobic avoidance, outpatient clinic, 15 minutes today, no trauma work yet";

export const PLACEHOLDER =
  "e.g. 28-year-old with panic attacks in outpatient clinic, 15 minutes available, no trauma work yet";

/* -- Primitives ---------------------------------------------------------- */

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

/**
 * The chip, in the shipped control's three states: off, chosen, and inferred
 * from the typed situation. Inferred keeps the accent treatment the live
 * control uses, because "the machine guessed this and you may override it" is
 * the one thing a reader must be able to see at a glance.
 */
export function Chip({
  label,
  active,
  inferred,
  disabled,
  onToggle,
}: {
  label: string;
  active: boolean;
  inferred?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      title={
        disabled
          ? `${label} would leave no records in scope`
          : inferred
            ? `${label} — inferred from the situation`
            : undefined
      }
      className={cn(
        "inline-flex min-h-12 items-center gap-1.5 rounded-full border px-3 text-2xs font-bold transition",
        active && inferred
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : active
            ? "border-[color:var(--text-heading)] bg-[color:var(--text-heading)] text-[color:var(--surface)]"
            : disabled
              ? "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)] opacity-60"
              : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
        focusRing,
      )}
    >
      {active ? <Check aria-hidden="true" size={12} strokeWidth={3} /> : null}
      {label}
      {inferred && active ? <Sparkles aria-hidden="true" size={11} strokeWidth={2.2} /> : null}
    </button>
  );
}

export function PrimaryButton({
  icon: Icon,
  children,
  onClick,
  className,
  disabled,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--text-heading)] bg-[color:var(--text-heading)] px-3.5 text-xs font-bold whitespace-nowrap text-[color:var(--surface)] transition hover:opacity-90",
        disabled ? "opacity-50" : "",
        focusRing,
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" size={14} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
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
        "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-bold whitespace-nowrap text-[color:var(--text-heading)] transition hover:border-[color:var(--border-strong)]",
        focusRing,
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" size={14} strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function SituationField({
  id,
  value,
  onChange,
  rows = 3,
  label = "Clinical situation",
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  label?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[color:var(--text-heading)]">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={PLACEHOLDER}
        className={cn(
          "mt-1.5 w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 text-2xs leading-5 text-[color:var(--text)] placeholder:text-[color:var(--text-soft)]",
          focusRing,
        )}
      />
    </div>
  );
}

/** "Matches 34 of 205 records" plus the honest caveats behind that number. */
export function ScopeReadout({ result, compact = false }: { result: Narrowing; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="m-0 flex items-baseline gap-1.5">
        <span className="nums text-lg font-extrabold leading-none text-[color:var(--text-heading)]">
          {result.count}
        </span>
        <span className="text-2xs font-bold text-[color:var(--text-soft)]">of {result.total} records in scope</span>
      </p>
      {compact ? null : (
        <p className="m-0 mt-1 truncate text-3xs font-semibold text-[color:var(--text-soft)]">
          {result.names.length ? result.names.slice(0, 3).join(" · ") : "Nothing matches this combination"}
        </p>
      )}
    </div>
  );
}

/**
 * The one thing the shipped control cannot tell you: a chip that is on but
 * excludes nothing. Three of the ten do exactly that against today's
 * catalogue, and a reader has no way to know it.
 */
export function InertChipNotice({ result }: { result: Narrowing }) {
  if (!result.inertKeys.length) return null;
  return (
    <p className="m-0 flex items-start gap-1.5 text-3xs font-semibold leading-4 text-[color:var(--text-soft)]">
      <TriangleAlert aria-hidden="true" size={12} strokeWidth={2} className="mt-px shrink-0" />
      <span>
        {result.inertKeys.map(labelFor).join(", ")} {result.inertKeys.length === 1 ? "matches" : "match"} every record,
        so {result.inertKeys.length === 1 ? "it narrows" : "they narrow"} nothing.
      </span>
    </p>
  );
}

export function AdvisoryLine({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "m-0 flex items-start gap-1.5 text-3xs font-semibold leading-4 text-[color:var(--text-soft)]",
        className,
      )}
    >
      <Shield aria-hidden="true" size={12} strokeWidth={2} className="mt-px shrink-0" />
      Ranking is source-grounded and advisory. Confirm fit and review status before clinical use.
    </p>
  );
}

/* -- Chrome and frames --------------------------------------------------- */

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

/**
 * The Recommend page as it stands behind the popup: the heading, the summary
 * of the scenario currently in force, and the ranked rows it produced. This is
 * context, not the subject — it is drawn plainly so it cannot be mistaken for
 * one of the three proposals.
 */
export function RecommendPageBehind({
  situation,
  activeKeys,
  count,
  onOpen,
  phone = false,
}: {
  situation: string;
  activeKeys: string[];
  count: number;
  onOpen: () => void;
  phone?: boolean;
}) {
  const rows = narrowing(activeKeys).names;

  return (
    <div className={cn("mx-auto", phone ? "" : "max-w-[44rem]")}>
      <h2
        className={cn(
          "m-0 font-semibold tracking-[-0.02em] text-[color:var(--text-heading)]",
          phone ? "text-base" : "text-lg",
        )}
      >
        Recommend
      </h2>
      <p className="m-0 mt-0.5 text-2xs font-semibold text-[color:var(--text-muted)]">
        Rank catalogue therapies against a clinical scenario. Advisory only.
      </p>

      {/* The trigger: the scenario summary is the control, and tapping it reopens the popup. */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "mt-3 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-left transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--e2)]",
          focusRing,
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <Eyebrow>Clinical situation</Eyebrow>
            <span className="mt-1 block truncate text-2xs font-semibold text-[color:var(--text)]">
              {situation || "No situation set"}
            </span>
          </span>
          <span className="shrink-0 rounded-lg border border-[color:var(--border)] px-2 py-1 text-3xs font-bold text-[color:var(--text-muted)]">
            Edit
          </span>
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {activeKeys.length ? (
            activeKeys.map((key) => (
              <span
                key={key}
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]"
              >
                {labelFor(key)}
              </span>
            ))
          ) : (
            <span className="text-3xs font-bold text-[color:var(--text-soft)]">No constraints</span>
          )}
        </span>
      </button>

      <p className="m-0 mt-3 text-3xs font-bold text-[color:var(--text-soft)]">
        {count} record{count === 1 ? "" : "s"} in scope
      </p>
      {/*
        Deliberately unnumbered. These are the records the constraints leave in
        scope, in catalogue order — relevance ranking is not modelled in this
        study, and a 1..6 column would claim an ordering the fixture cannot
        support.
      */}
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.slice(0, phone ? 4 : 5).map((name) => (
          <div
            key={name}
            className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--decoration-soft)]" />
            <span className="min-w-0 truncate text-2xs font-semibold text-[color:var(--text-heading)]">{name}</span>
          </div>
        ))}
      </div>
      <p className="m-0 mt-2 text-3xs font-semibold text-[color:var(--text-soft)]">
        In scope, catalogue order. Relevance ranking is not modelled here.
      </p>
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
