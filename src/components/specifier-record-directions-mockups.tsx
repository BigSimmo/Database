"use client";

import { useState } from "react";
import { ArrowLeft, Check, ChevronDown, Copy, Info, MoreHorizontal, ShieldAlert, Tag } from "lucide-react";

import { cn } from "@/components/ui-primitives";

/**
 * Specifier record page — three redesign directions.
 *
 * Specimen: `/specifiers/multiple-episodes-currently-in-full-remission`
 * (Schizophrenia · Course & Status), the page in the review screenshot.
 *
 * All content is real: labels, group membership, sibling set and the ICD-11 line
 * are read from `data/specifiers-content.json`; the review states and the content
 * hash are the ones the live record renders. Nothing here invents a clinical
 * definition, because the catalogue does not have one to show — every generated
 * definition is withheld pending qualified clinician review, and a redesign that
 * quietly filled that hole would be the worst possible outcome for this page.
 *
 * Layout and chrome only. No production component is modified by this file.
 */

/* ------------------------------------------------------------------ */
/* Specimen                                                            */
/* ------------------------------------------------------------------ */

const SPECIMEN = {
  label: "Multiple episodes currently in full remission",
  disorder: "Schizophrenia",
  category: "Schizophrenia Spectrum",
  group: "Course & Status",
  icd11Code: "6A20",
  icd11Qualifiers: "positive, negative, depressive, manic, psychomotor, cognitive",
  contentHash: "66cbac4a",
  sourceFamily: "Best-effort DSM-derived clinical anchor pending manual verification",
} as const;

/** Course & Status is a 2 x 3 grid plus two specifiers that sit outside it. */
const COURSE_ROWS = ["First episode", "Multiple episodes"] as const;
const COURSE_COLUMNS = [
  { short: "Acute episode", full: "currently in acute episode" },
  { short: "Partial remission", full: "currently in partial remission" },
  { short: "Full remission", full: "currently in full remission" },
] as const;
const COURSE_OUTLIERS = ["Continuous", "Unspecified"] as const;

const SEVERITY = ["Mild", "Moderate", "Severe"] as const;
const FEATURES = ["With catatonia"] as const;

const COURSE_SIBLINGS = [
  ...COURSE_ROWS.flatMap((row) => COURSE_COLUMNS.map((column) => `${row} ${column.full}`)),
  ...COURSE_OUTLIERS,
];

const CURRENT_ROW: (typeof COURSE_ROWS)[number] = "Multiple episodes";
const CURRENT_COLUMN = 2;

/* ------------------------------------------------------------------ */
/* Study chrome                                                        */
/* ------------------------------------------------------------------ */

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const kicker = "text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]";

function DeviceFrame({
  label,
  widthLabel,
  phone = false,
  height = "h-[42rem]",
  children,
}: {
  label: string;
  widthLabel: string;
  phone?: boolean;
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone ? "mx-auto w-full max-w-[24rem]" : "overflow-x-auto")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={kicker}>{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{widthLabel}</span>
      </div>
      <div
        className={cn(
          "overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] shadow-[var(--shadow-lux)]",
          phone ? "rounded-[1.85rem]" : "min-w-[58rem] rounded-2xl",
        )}
      >
        {phone ? <PhoneStatusBar /> : null}
        <div className={cn("overflow-y-auto overscroll-contain", height)}>{children}</div>
      </div>
    </div>
  );
}

function PhoneStatusBar() {
  return (
    <div
      aria-hidden
      className="relative flex h-10 shrink-0 items-end justify-between px-5 pb-1.5 text-3xs font-semibold tabular-nums text-[color:var(--text-heading)]"
    >
      <span>09:41</span>
      <span className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-[color:var(--text-heading)]" />
      <span className="tracking-tight">100%</span>
    </div>
  );
}

/** The shared record-page top bar. Identical in all three directions on purpose. */
function RecordNavBar({ crumb }: { crumb: string }) {
  return (
    <div className="sticky top-0 z-10 flex min-h-12 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-glass)] px-3 backdrop-blur-xl">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]",
          "hover:bg-[color:var(--surface-subtle)]",
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--text-heading)]">{crumb}</span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </span>
    </div>
  );
}

function Chip({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-2xs font-bold",
        tone === "neutral" &&
          "border-[color:var(--border)] bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
        tone === "accent" &&
          "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
        tone === "warn" &&
          "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]",
      )}
    >
      {children}
    </span>
  );
}

/**
 * The verification caveat, said once. Production says the same thing in six
 * places (subtitle, "Review due" badge, Definition tile, Source status tile,
 * "Definition pending verification" card, and three sidebar rows).
 */
function VerificationStrip({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]">
      <div className={cn("flex items-start gap-2.5", compact ? "px-3 py-2.5" : "px-4 py-3")}>
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" aria-hidden />
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">
          No verified definition. Confirm this specifier against current DSM-5-TR or ICD-11 text before documenting.
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            "-my-1 -mr-1 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-2xs font-extrabold text-[color:var(--warning-text)]",
            focusRing,
          )}
        >
          Detail
          <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      {open ? (
        <dl className="grid gap-2 border-t border-[color:var(--warning-border)] px-4 py-3 text-2xs sm:grid-cols-3">
          {[
            ["Source", "Needs formal source review"],
            ["Clinician review", "Pending qualified review"],
            ["Record", `${SPECIMEN.contentHash} · ${SPECIMEN.sourceFamily}`],
          ].map(([term, detail]) => (
            <div key={term} className="min-w-0">
              <dt className="font-extrabold text-[color:var(--text-heading)]">{term}</dt>
              <dd className="mt-0.5 font-medium leading-4 text-[color:var(--text-muted)]">{detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — Course matrix                                                  */
/* ------------------------------------------------------------------ */

function CourseMatrix({ dense = false }: { dense?: boolean }) {
  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "grid gap-1.5",
          dense ? "grid-cols-[5.2rem_repeat(3,minmax(0,1fr))]" : "grid-cols-[9rem_repeat(3,minmax(0,1fr))]",
        )}
      >
        <span aria-hidden />
        {COURSE_COLUMNS.map((column) => (
          <span key={column.short} className={cn(kicker, "px-1 pb-0.5 leading-4")}>
            {dense ? column.short.replace(" episode", "").replace(" remission", "") : column.short}
          </span>
        ))}

        {COURSE_ROWS.map((row) => (
          <div key={row} className="contents">
            <span className="flex items-center pr-1 text-2xs font-extrabold leading-4 text-[color:var(--text-heading)]">
              {row}
            </span>
            {COURSE_COLUMNS.map((column, index) => {
              const isCurrent = row === CURRENT_ROW && index === CURRENT_COLUMN;
              return (
                <span
                  key={column.short}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-1 rounded-lg border px-2.5 text-2xs font-bold",
                    isCurrent
                      ? "border-2 border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
                  )}
                >
                  {isCurrent ? (
                    <>
                      <span>This record</span>
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </>
                  ) : (
                    <span className="truncate">Open</span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--border)] px-2.5 py-2">
        <span className="text-3xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
          Outside the grid
        </span>
        {COURSE_OUTLIERS.map((entry) => (
          <Chip key={entry}>{entry}</Chip>
        ))}
        <span className="text-3xs font-medium text-[color:var(--text-soft)]">no remission axis</span>
      </div>
    </div>
  );
}

function GroupStrip({ title, count, items }: { title: string; count: number; items: readonly string[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <span className="text-2xs font-extrabold text-[color:var(--text-heading)]">
        {title}
        <span className="ml-1 font-bold text-[color:var(--text-soft)]">{count}</span>
      </span>
      {items.map((entry) => (
        <Chip key={entry}>{entry}</Chip>
      ))}
    </div>
  );
}

function IcdLine() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-3 py-2.5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden />
      <p className="min-w-0 text-2xs font-semibold leading-5 text-[color:var(--text-heading)]">
        <span className="font-extrabold">ICD-11 {SPECIMEN.icd11Code}</span> — symptom qualifiers required:{" "}
        <span className="font-medium text-[color:var(--text-muted)]">{SPECIMEN.icd11Qualifiers}.</span>
      </p>
    </div>
  );
}

function CourseMatrixFrame({ phone = false }: { phone?: boolean }) {
  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <RecordNavBar crumb="Schizophrenia" />
      <div className={cn("grid gap-4", phone ? "px-3 py-4" : "mx-auto max-w-[54rem] px-6 py-6")}>
        <header className="grid gap-2">
          <p className={kicker}>
            {SPECIMEN.disorder} · {SPECIMEN.group}
          </p>
          <h1
            className={cn(
              "font-extrabold leading-tight text-[color:var(--text-heading)]",
              phone ? "text-xl" : "text-2xl-minus",
            )}
          >
            {SPECIMEN.label}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="accent">ICD-11 {SPECIMEN.icd11Code}</Chip>
            <Chip>{SPECIMEN.category}</Chip>
            <Chip>6 of 8 in group</Chip>
          </div>
        </header>

        <VerificationStrip compact={phone} />

        <section className="grid gap-2.5">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">
            Where it sits in Course &amp; Status
          </h2>
          <CourseMatrix dense={phone} />
        </section>

        <section className="grid gap-2">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">
            Other specifiers for {SPECIMEN.disorder}
          </h2>
          <GroupStrip title="Severity" count={SEVERITY.length} items={SEVERITY} />
          <GroupStrip title="Features" count={FEATURES.length} items={FEATURES} />
        </section>

        <IcdLine />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Clinical record card                                           */
/* ------------------------------------------------------------------ */

const RECORD_ROWS: Array<[string, string]> = [
  ["Diagnosis", SPECIMEN.disorder],
  ["Category", SPECIMEN.category],
  ["Specifier group", `${SPECIMEN.group} · 8 specifiers`],
  ["Episode pattern", "Multiple episodes"],
  ["Current state", "Full remission"],
  ["ICD-11 code", `${SPECIMEN.icd11Code} (Schizophrenia)`],
  ["Symptom qualifiers", SPECIMEN.icd11Qualifiers],
  ["Definition", "Withheld — no clinician-verified text"],
];

function ProvenanceDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[color:var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-2 px-4 text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]",
          focusRing,
        )}
      >
        Record provenance
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <dl className="grid gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 text-2xs">
          {[
            ["Source status", "Needs formal source review"],
            ["Clinician review", "Pending qualified review"],
            ["Source family", SPECIMEN.sourceFamily],
            ["Content hash", SPECIMEN.contentHash],
          ].map(([term, detail]) => (
            <div key={term} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3">
              <dt className="font-extrabold text-[color:var(--text-heading)]">{term}</dt>
              <dd className="min-w-0 font-medium leading-4 text-[color:var(--text-muted)]">{detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function RecordCardFrame({ phone = false }: { phone?: boolean }) {
  return (
    <div className="min-h-full bg-[color:var(--surface-inset)]">
      <RecordNavBar crumb="Schizophrenia" />
      <div className={cn("grid gap-3", phone ? "px-3 py-4" : "mx-auto max-w-[48rem] px-6 py-6")}>
        <article className="overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface)] shadow-[var(--shadow-card)]">
          <div className="grid gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className={kicker}>Specifier record</p>
              <span className="inline-flex min-h-6 items-center gap-1 rounded-md border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 text-2xs font-extrabold text-[color:var(--warning-text)]">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Unverified
              </span>
            </div>
            <h1
              className={cn(
                "font-extrabold leading-tight text-[color:var(--text-heading)]",
                phone ? "text-lg" : "text-xl",
              )}
            >
              {SPECIMEN.label}
            </h1>
          </div>

          <dl className="divide-y divide-[color:var(--border)]">
            {RECORD_ROWS.map(([term, detail]) => (
              <div
                key={term}
                className={cn(
                  "gap-1 px-4 py-2.5",
                  phone ? "grid" : "grid grid-cols-[11rem_minmax(0,1fr)] items-baseline gap-4",
                )}
              >
                <dt className="text-2xs font-extrabold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                  {term}
                </dt>
                <dd className="min-w-0 text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{detail}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-[color:var(--border)] px-4 py-3">
            <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-[color:var(--text-heading)]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" aria-hidden />
              Confirm against current DSM-5-TR or ICD-11 text before documenting.
            </p>
          </div>

          <ProvenanceDisclosure />
        </article>

        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            Other Course &amp; Status specifiers
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {COURSE_SIBLINGS.filter((entry) => entry !== SPECIMEN.label).map((entry) => (
              <li key={entry}>
                <span
                  className={cn(
                    "inline-flex min-h-8 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-2.5 text-2xs font-semibold text-[color:var(--text-muted)]",
                    "hover:border-[color:var(--clinical-accent)] hover:text-[color:var(--clinical-accent)]",
                  )}
                >
                  {entry}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Documentation line                                             */
/* ------------------------------------------------------------------ */

function DocumentationFrame({ phone = false }: { phone?: boolean }) {
  const [severity, setSeverity] = useState<string | null>(null);
  const [catatonia, setCatatonia] = useState(false);
  const [copied, setCopied] = useState(false);

  const wording = [
    SPECIMEN.disorder,
    "multiple episodes, currently in full remission",
    catatonia ? "with catatonia" : null,
    severity ? `current severity ${severity.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-full bg-[color:var(--background)]">
      <RecordNavBar crumb="Schizophrenia" />
      <div className={cn("grid gap-4", phone ? "px-3 py-4" : "mx-auto max-w-[50rem] px-6 py-6")}>
        <header className="grid gap-1.5">
          <p className={kicker}>
            {SPECIMEN.group} specifier · {SPECIMEN.disorder}
          </p>
          <h1
            className={cn(
              "font-extrabold leading-tight text-[color:var(--text-heading)]",
              phone ? "text-lg" : "text-xl",
            )}
          >
            {SPECIMEN.label}
          </h1>
        </header>

        <section className="overflow-hidden rounded-xl border-2 border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)]">
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)] px-4 py-2">
            <p className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--clinical-accent)]">
              Diagnostic wording
            </p>
            <button
              type="button"
              onClick={() => setCopied(true)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] px-2.5 text-2xs font-extrabold text-[color:var(--clinical-accent-contrast)]",
                focusRing,
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p
            className={cn(
              "px-4 py-4 font-bold leading-7 text-[color:var(--text-heading)]",
              phone ? "text-base-minus" : "text-lg",
            )}
          >
            {wording}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--border)] px-4 py-2.5">
            <span className={kicker}>Built from</span>
            <Chip>{SPECIMEN.disorder}</Chip>
            <Chip tone="accent">
              <Tag className="h-3 w-3" aria-hidden />
              This specifier
            </Chip>
            {catatonia ? <Chip>With catatonia</Chip> : null}
            {severity ? <Chip>{severity}</Chip> : null}
          </div>
        </section>

        <section className="grid gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            Add the other groups
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-extrabold text-[color:var(--text-heading)]">Severity</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-[color:var(--border)]">
              {["Not stated", ...SEVERITY].map((option) => {
                const active = option === "Not stated" ? severity === null : severity === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSeverity(option === "Not stated" ? null : option)}
                    aria-pressed={active}
                    className={cn(
                      "min-h-9 border-r border-[color:var(--border)] px-2.5 text-2xs font-bold last:border-r-0",
                      focusRing,
                      active && option === "Not stated"
                        ? "bg-[color:var(--surface-inset)] text-[color:var(--text-heading)]"
                        : active
                          ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                          : "bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCatatonia((value) => !value)}
              aria-pressed={catatonia}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-bold",
                focusRing,
                catatonia
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
              )}
            >
              <Check className={cn("h-3.5 w-3.5", !catatonia && "opacity-30")} aria-hidden />
              With catatonia
            </button>
          </div>
        </section>

        <VerificationStrip compact={phone} />

        <IcdLine />

        <section className="grid gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-2xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
            Swap the course specifier
          </h2>
          <ul className="grid gap-1">
            {COURSE_SIBLINGS.filter((entry) => entry !== SPECIMEN.label)
              .slice(0, phone ? 4 : 7)
              .map((entry) => (
                <li key={entry}>
                  <span className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2.5 text-2xs font-semibold text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--clinical-accent)]">
                    <span className="min-w-0 truncate">{entry}</span>
                    <span className="shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">Use</span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Study page                                                          */
/* ------------------------------------------------------------------ */

type DirectionId = "matrix" | "record" | "wording";

const directions: Array<{
  id: DirectionId;
  number: string;
  name: string;
  verdict: string;
  summary: string;
  strengths: string[];
  cost: string;
  recommended?: boolean;
}> = [
  {
    id: "matrix",
    number: "01",
    name: "Course matrix",
    verdict: "Recommended",
    summary:
      "The page stops describing the specifier and starts placing it. Course & Status is a two-by-three grid (episode pattern by current state) with the open record marked, and the two specifiers that sit outside that grid are shown as exactly that. Severity and Features become one-line strips, so all twelve specifiers for the diagnosis fit above the fold.",
    strengths: ["Whole specifier set visible", "No truncated sibling labels", "Caveat stated once"],
    cost: "Only works for groups with a real internal structure. Flat groups fall back to a chip strip.",
    recommended: true,
  },
  {
    id: "record",
    number: "02",
    name: "Clinical record card",
    verdict: "Densest",
    summary:
      "One bordered card read like a pathology report: term and value on hairline-separated rows, no icon tiles, no sidebar, no repeated cards. Provenance (source family, review state, content hash) collapses behind a disclosure instead of occupying a permanent right-hand column.",
    strengths: ["Fewest pixels per fact", "Same shape for every specifier", "Engineering fields out of the way"],
    cost: "Sibling specifiers are a chip wrap, so the group's structure is not visible.",
  },
  {
    id: "wording",
    number: "03",
    name: "Documentation line",
    verdict: "Task-led",
    summary:
      "Leads with the thing the specifier is for: the assembled diagnostic line, ready to copy, with severity and catatonia as live controls so the wording updates as you build it. The verification caveat sits directly under the copy control, where it can actually change what gets written.",
    strengths: ["Matches the real task", "Uses the existing builder logic", "Caveat at the point of action"],
    cost: "Assembled wording is composed from catalogue labels, not from verified DSM-5-TR text. Needs clinician sign-off before it ships.",
  },
];

const DEFECTS: Array<{ title: string; detail: string }> = [
  {
    title: "One fact, said six times",
    detail:
      "Subtitle, Review due badge, Definition tile, Source status tile, the whole At a glance card, and three sidebar rows all say the definition is unverified. Repetition does not make a caveat safer, it makes it wallpaper.",
  },
  {
    title: "Every tile repeats a badge",
    detail:
      "Applies to = the Schizophrenia chip. Specifier group = the Course & Status chip. Definition and Source status = the Review due chip. Four tiles, no new information.",
  },
  {
    title: "Two cards, three sentences, 560 px",
    detail:
      "At a glance and ICD-11 context each spend roughly 270 px on one short paragraph, with a large fixed gap between the title block and the body.",
  },
  {
    title: "Boilerplate section furniture",
    detail:
      "What this specifier records plus a two-line description of what a reference page is costs about 180 px and tells a clinician nothing.",
  },
  {
    title: "The useful content is the truncated content",
    detail:
      "More in this diagnosis is the only navigational content on the page and it is clipped mid-word in a 21 rem sidebar. Multiple episodes currently in acute episo…",
  },
  {
    title: "Structure is thrown away",
    detail:
      "Course & Status is a grid: three episode patterns by three current states. The page renders it as a flat list, so the one question a clinician is actually asking cannot be answered by looking.",
  },
  {
    title: "Provenance is in the clinical column",
    detail:
      "Content hash 66cbac4a is a build artefact. It belongs behind a disclosure, not in a sidebar a registrar reads on a ward round.",
  },
  {
    title: "Nothing supports the task",
    detail:
      "The reason to open this page is to write the specifier into a diagnosis line. There is no wording, no copy control, and no combination with severity or catatonia, even though /specifiers/builder already does this.",
  },
];

function DirectionPreview({ id }: { id: DirectionId }) {
  const Frame = id === "matrix" ? CourseMatrixFrame : id === "record" ? RecordCardFrame : DocumentationFrame;
  return (
    <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <DeviceFrame label="Desktop" widthLabel="1440 px">
        <Frame />
      </DeviceFrame>
      <DeviceFrame label="Phone" widthLabel="390 px" phone>
        <Frame phone />
      </DeviceFrame>
    </div>
  );
}

export function SpecifierRecordDirectionsMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] pb-16">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)]">
        <div className="mx-auto grid max-w-[92rem] gap-2 px-4 py-8 sm:px-6 lg:px-8">
          <p className={kicker}>Design study · specifier record page</p>
          <h1 className="text-2xl-minus font-extrabold text-[color:var(--text-heading)] sm:text-3xl-minus">
            Three directions for the specifier record page
          </h1>
          <p className="max-w-[68ch] text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            Specimen is <code>/specifiers/multiple-episodes-currently-in-full-remission</code> — the page in the review
            screenshot. All labels, group membership, sibling sets and the ICD-11 line are read from the live catalogue.
            No direction invents a clinical definition: the catalogue withholds every generated definition pending
            qualified clinician review, and that constraint is the design brief rather than a hole to paper over.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section
          aria-labelledby="defects-title"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5"
        >
          <h2 id="defects-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            What is wrong with the current page
          </h2>
          <p className="mt-1 max-w-[80ch] text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            The first screen and a half carries no clinical fact the title does not already give. The only genuinely new
            content on the page — the ICD-11 6A20 qualifier list — sits about 1,200 px down.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DEFECTS.map((defect) => (
              <li key={defect.title} className="rounded-xl border border-[color:var(--border)] p-3">
                <p className="text-2xs font-extrabold text-[color:var(--text-heading)]">{defect.title}</p>
                <p className="mt-1 text-2xs font-medium leading-4 text-[color:var(--text-muted)]">{defect.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {directions.map((direction) => (
          <section
            key={direction.id}
            id={direction.id}
            aria-labelledby={`${direction.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {direction.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id={`${direction.id}-title`}
                      className="text-lg font-extrabold text-[color:var(--text-heading)]"
                    >
                      {direction.name}
                    </h2>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide",
                        direction.recommended
                          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
                      )}
                    >
                      {direction.verdict}
                    </span>
                  </div>
                  <p className="mt-1 max-w-[80ch] text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {direction.summary}
                  </p>
                  <p className="mt-1.5 max-w-[80ch] text-2xs font-medium leading-4 text-[color:var(--text-soft)]">
                    <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {direction.cost}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {direction.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-extrabold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
            <DirectionPreview id={direction.id} />
          </section>
        ))}

        <section
          aria-labelledby="recommendation-title"
          className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5"
        >
          <h2 id="recommendation-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Recommendation
          </h2>
          <p className="max-w-[84ch] text-sm font-medium leading-6 text-[color:var(--text-muted)]">
            <span className="font-bold text-[color:var(--text-heading)]">Build 01 Course matrix</span>, and take two
            parts from the others: 02&apos;s provenance disclosure, which gets the content hash and source family out of
            the clinical column entirely, and 03&apos;s wording band, which can sit under the matrix once the assembled
            line has clinician sign-off. 01 is the right spine because this catalogue has no verified definitions to
            display — when a page has little content, the pixels should go to structure rather than to six restatements
            of the content it is missing.
          </p>
          <p className="max-w-[84ch] text-2xs font-medium leading-5 text-[color:var(--text-soft)]">
            Applies beyond this record. The same defects sit on every one of the 585 catalogue items, and the matrix
            only holds where a group has a real internal structure — Course &amp; Status here, remission and severity
            axes elsewhere. Flat groups degrade to 02&apos;s chip wrap, which is why that direction is worth keeping
            runnable rather than discarding.
          </p>
        </section>
      </div>
    </main>
  );
}
