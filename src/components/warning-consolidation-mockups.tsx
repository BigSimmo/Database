"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  FileText,
  Info,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

// Design-scratch study: the answer-mode hero currently stacks three separate
// notices under the composer (privacy warning, /privacy link, scope footer) and
// carries no "verify before clinical use" line at all. Each concept below folds
// all four statements into ONE block with one voice, and adds the missing
// fourth statement at the bottom.
//
// Two strings are governance copy, not design copy, and are reproduced verbatim
// in every concept: "Do not enter patient-identifiable information." (APP-5 /
// PIA-5) and the "Privacy and data processing" link to /privacy. Both are pinned
// by tests/privacy-ui.test.ts — a concept that paraphrases either one is not a
// candidate, however tidy it looks.

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const OBLIGATION = "Do not enter patient-identifiable information.";
const PRIVACY_LINK = "Privacy and data processing";
const SCOPE = "Searches indexed clinical sources";
const LIBRARY = "Clinical Guide library";
// The new fourth statement. Matches the voice already used elsewhere in the app
// ("Clinical decision support only. Review before use.", "Confirm against
// source") rather than inventing a new register.
const VERIFY = "Answers are AI-generated — verify against the cited source before clinical use.";

type ConceptId = "bar" | "card" | "footnote";

const concepts: Array<{
  id: ConceptId;
  number: string;
  name: string;
  summary: string;
  strengths: string[];
  cost: string;
  recommended?: boolean;
}> = [
  {
    id: "bar",
    number: "01",
    name: "Assurance bar",
    summary:
      "One 24px row. Obligation and verify-before-use stay permanently visible; scope, library and the privacy link move behind a quiet Details disclosure.",
    strengths: ["Smallest footprint", "Fits the docked composer", "Nothing safety-critical is hidden"],
    cost: "Scope and the privacy link cost one tap, and the row grows to two lines on a narrow phone rather than clipping.",
  },
  {
    id: "card",
    number: "02",
    name: "Safety card",
    summary:
      "One bordered block, two tiers: the obligation on a warning-tinted top row, then everything descriptive on a quiet second row. One container, one voice, honest hierarchy.",
    strengths: ["Warning finally reads as the loudest line", "All four statements visible", "Single shield metaphor"],
    cost: "Tallest of the three — roughly 76px on a phone. Best where the hero has the room.",
    recommended: true,
  },
  {
    id: "footnote",
    number: "03",
    name: "Quiet footnote",
    summary:
      "A single centred grey line that reads as one sentence, with an inline expander for the full text. The calmest option and the closest to the current visual weight.",
    strengths: ["Least chrome of any option", "Reads as one statement", "Cheapest to adopt"],
    cost: "Lowest salience — the obligation is present but never emphasised. Weakest for a first-time user.",
  },
];

/* ------------------------------------------------------------------ */
/* Baseline: what ships today                                          */
/* ------------------------------------------------------------------ */

function CurrentStack() {
  return (
    <div className="grid gap-2">
      <p className="flex flex-wrap items-center justify-center gap-x-1 text-2xs leading-4 text-[color:var(--text-muted)]">
        <ShieldAlert className="h-3 w-3 shrink-0 text-[color:var(--warning)]" aria-hidden />
        <span>{OBLIGATION}</span>
      </p>
      <p className="text-center text-2xs leading-4">
        <Link
          href="/privacy"
          className={cn(
            "font-medium text-[color:var(--text-muted)] underline decoration-[color:var(--border-strong)] underline-offset-2",
            focusRing,
          )}
        >
          {PRIVACY_LINK}
        </Link>
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)] sm:text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-[color:var(--clinical-accent)]">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {SCOPE}
        </span>
        <span aria-hidden>•</span>
        <span>{LIBRARY}</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — Assurance bar                                                  */
/* ------------------------------------------------------------------ */

function AssuranceBar({ compact = false, instanceId }: { compact?: boolean; instanceId: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `${instanceId}-details`;

  return (
    <div className="grid w-full gap-1.5">
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1.5",
          compact && "gap-1.5 px-2",
        )}
      >
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 self-start text-[color:var(--warning)]" aria-hidden />
        {/* Deliberately not truncated: this row carries the two safety
            statements, and a clipped warning is worse than a two-line one. Only
            the Details disclosure is allowed to hide anything, and it hides only
            descriptive copy. */}
        <p className="min-w-0 flex-1 text-2xs font-semibold leading-4 text-[color:var(--text-heading)]">
          {compact ? "No patient-identifiable information" : OBLIGATION}
          <span className="mx-1.5 font-normal text-[color:var(--border-strong)]" aria-hidden>
            |
          </span>
          <span className="font-medium text-[color:var(--text-muted)]">
            {compact ? "verify before use" : "verify answers against the cited source"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "inline-flex min-h-8 shrink-0 items-center gap-1 self-start rounded-md px-1.5 text-2xs font-semibold text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-heading)]",
            focusRing,
          )}
        >
          <span className={cn(compact && "sr-only")}>Details</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", open && "rotate-180")}
            aria-hidden
          />
          <span className="sr-only">about sources and privacy</span>
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          className="grid gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2 text-2xs leading-4 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
        >
          <p className="flex items-start gap-1.5">
            <FileText className="mt-px h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
            <span>
              <span className="font-semibold text-[color:var(--text-heading)]">{SCOPE}</span> — {LIBRARY}.
            </span>
          </p>
          <p className="flex items-start gap-1.5">
            <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
            <span>{VERIFY}</span>
          </p>
          <p className="flex items-start gap-1.5">
            <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
            <span>
              {OBLIGATION}{" "}
              <Link
                href="/privacy"
                className={cn(
                  "whitespace-nowrap font-semibold text-[color:var(--clinical-accent)] underline decoration-[color:var(--border-strong)] underline-offset-2",
                  focusRing,
                )}
              >
                {PRIVACY_LINK}
              </Link>
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — Safety card                                                    */
/* ------------------------------------------------------------------ */

function SafetyCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
      {/* Tier 1 — the obligation. The only tinted, only bolded, only iconised
          row in the block, so the safety line is finally the loudest thing
          below the composer instead of the quietest. */}
      <div
        className={cn(
          "flex items-start gap-2 border-b border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2",
          compact && "px-2.5",
        )}
      >
        <ShieldAlert className="mt-px h-4 w-4 shrink-0 text-[color:var(--warning-text)]" aria-hidden />
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5 text-[color:var(--warning-text)]">{OBLIGATION}</p>
      </div>

      {/* Tier 2 — everything descriptive, in one grey voice. No second shield:
          the scope line is a capability claim, not an assurance badge. */}
      <div className={cn("grid gap-1 px-3 py-2", compact && "px-2.5")}>
        <p className="text-2xs leading-4 text-[color:var(--text-muted)]">
          <span className="font-semibold text-[color:var(--text-heading)]">{SCOPE}</span>
          <span className="mx-1.5 text-[color:var(--border-strong)]" aria-hidden>
            •
          </span>
          {LIBRARY}
        </p>
        <p className="text-2xs leading-4 text-[color:var(--text-muted)]">
          {VERIFY}{" "}
          <Link
            href="/privacy"
            className={cn(
              "whitespace-nowrap font-semibold text-[color:var(--clinical-accent)] underline decoration-[color:var(--border-strong)] underline-offset-2",
              focusRing,
            )}
          >
            {PRIVACY_LINK}
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — Quiet footnote                                                 */
/* ------------------------------------------------------------------ */

function QuietFootnote({ compact = false, instanceId }: { compact?: boolean; instanceId: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `${instanceId}-footnote`;

  return (
    <div className="grid w-full justify-items-center gap-1.5">
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-2xs leading-4 text-[color:var(--text-muted)]">
        <ShieldAlert className="h-3 w-3 shrink-0 text-[color:var(--warning)]" aria-hidden />
        <span className="font-semibold text-[color:var(--text-heading)]">No patient identifiers</span>
        <span className="text-[color:var(--border-strong)]" aria-hidden>
          ·
        </span>
        <span>{compact ? "indexed clinical sources" : "answers drawn from indexed clinical sources"}</span>
        <span className="text-[color:var(--border-strong)]" aria-hidden>
          ·
        </span>
        <span>verify before clinical use</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "inline-flex min-h-8 items-center gap-0.5 rounded-md px-1 font-semibold text-[color:var(--clinical-accent)] transition-colors hover:underline",
            focusRing,
          )}
        >
          {open ? "Less" : "Why"}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform motion-reduce:transition-none", open && "rotate-180")}
            aria-hidden
          />
          <span className="sr-only">— full privacy, source and verification notice</span>
        </button>
      </p>

      {open ? (
        <div
          id={panelId}
          className="grid w-full max-w-[34rem] gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-left text-2xs leading-4 text-[color:var(--text-muted)] shadow-[var(--shadow-inset)]"
        >
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" aria-hidden />
            <span className="font-semibold text-[color:var(--text-heading)]">{OBLIGATION}</span>
          </p>
          <p className="flex items-start gap-2">
            <FileText className="mt-px h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
            <span>
              {SCOPE} — {LIBRARY}.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
            <span>{VERIFY}</span>
          </p>
          <p className="pl-[1.375rem]">
            <Link
              href="/privacy"
              className={cn(
                "whitespace-nowrap font-semibold text-[color:var(--clinical-accent)] underline decoration-[color:var(--border-strong)] underline-offset-2",
                focusRing,
              )}
            >
              {PRIVACY_LINK}
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared preview scaffolding                                          */
/* ------------------------------------------------------------------ */

function ComposerPill({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-3 pr-2 shadow-[var(--shadow-inset)]",
        compact ? "min-h-12" : "min-h-14",
      )}
    >
      <Plus className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-soft)]">Ask a clinical question…</span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--text-muted)]">
        <Send className="h-4 w-4" aria-hidden />
      </span>
    </div>
  );
}

function Hero({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid justify-items-center gap-1.5">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Sparkles className="h-5 w-5" aria-hidden />
      </span>
      <p
        className={cn(
          "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
          compact ? "text-xl" : "text-2xl",
        )}
      >
        How can I help?
      </p>
      <p className="text-center text-xs text-[color:var(--text-muted)]">
        Ask a clinical question or search your documents.
      </p>
    </div>
  );
}

function PreviewFrame({
  label,
  width,
  phone = false,
  children,
}: {
  label: string;
  width: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[23.75rem]")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{width}</span>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 sm:p-4">
        <div className={cn("mx-auto grid gap-3", phone ? "max-w-[21rem]" : "max-w-[34rem]")}>{children}</div>
      </div>
    </div>
  );
}

function Treatment({ concept, compact, instanceId }: { concept: ConceptId; compact: boolean; instanceId: string }) {
  if (concept === "bar") return <AssuranceBar compact={compact} instanceId={instanceId} />;
  if (concept === "card") return <SafetyCard compact={compact} />;
  return <QuietFootnote compact={compact} instanceId={instanceId} />;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function WarningConsolidationMockupsPage() {
  const [showBaseline, setShowBaseline] = useState(true);

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
                Answer home — notices
              </p>
              <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
                Consolidating four safety statements into one block
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
                Today the hero stacks three notices in three type sizes, two colours and two opposing shield icons — and
                still never says the answers need checking. Each concept folds all four statements into a single block
                with one voice, and adds the missing verification line at the bottom.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBaseline((value) => !value)}
              aria-pressed={showBaseline}
              className={cn(
                "inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-extrabold text-[color:var(--text-heading)] transition-colors hover:bg-[color:var(--surface)]",
                focusRing,
              )}
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
              {showBaseline ? "Hide today's stack" : "Show today's stack"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Diagnosis */}
        <section
          aria-labelledby="diagnosis-title"
          className="grid gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
        >
          <div className="min-w-0">
            <h2 id="diagnosis-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
              What is wrong with the current stack
            </h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-[color:var(--text-muted)]">
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">Hierarchy is inverted.</span> The
                capability line (“{SCOPE}”) is accent-blue, semibold and 14px. The actual obligation is 11px muted grey.
                The loudest element is the least important one.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">Two shields, opposite meanings.</span>{" "}
                <span className="whitespace-nowrap">ShieldAlert</span> (amber, warning) and{" "}
                <span className="whitespace-nowrap">ShieldCheck</span> (blue, assurance) sit ~40px apart in the same
                column, so the metaphor cancels itself out.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">Three blocks, three voices.</span> A
                warning, a bare link and a badge line read as three unrelated pieces of chrome rather than one statement
                about how to use the tool.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">The link floats.</span> “{PRIVACY_LINK}
                ” wraps onto its own line with no lead-in, so it looks like navigation rather than the footnote to the
                warning above it.
              </li>
              <li>
                <span className="font-semibold text-[color:var(--text-heading)]">The gap.</span> Nothing on this screen
                says the answer is generated and must be checked — the point of the whole product. Other modes already
                carry “Clinical decision support only. Review before use.”; answer mode carries nothing.
              </li>
            </ul>
          </div>

          <div className="grid gap-3">
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3">
              <p className="mb-2 text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Governance copy — reproduced verbatim in every concept
              </p>
              <ul className="grid gap-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
                <li>
                  <span className="font-semibold text-[color:var(--text-heading)]">“{OBLIGATION}”</span> — APP-5 / PIA-5
                  wording, pinned by <code>tests/privacy-ui.test.ts</code>.
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--text-heading)]">“{PRIVACY_LINK}”</span> →{" "}
                  <code>/privacy</code>, pinned by the same test.
                </li>
              </ul>
              <p className="mt-2 text-2xs leading-4 text-[color:var(--text-soft)]">
                Both may be re-styled, re-positioned and re-grouped. Neither may be paraphrased or dropped.
              </p>
            </div>
            {showBaseline ? (
              <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-3">
                <p className="mb-2.5 text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  Today
                </p>
                <CurrentStack />
              </div>
            ) : null}
          </div>
        </section>

        {/* The new fourth statement */}
        <section
          aria-labelledby="addition-title"
          className="grid gap-3 rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] p-4 sm:p-5"
        >
          <h2 id="addition-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            The line added at the bottom
          </h2>
          <p className="max-w-3xl text-sm font-semibold leading-6 text-[color:var(--text-heading)]">“{VERIFY}”</p>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            It states the generation method and the required action in one sentence, and it is the natural anchor for
            the citation model the product already relies on. Register matches the app’s existing caveats (“Confirm
            against source”, “Review before use”) rather than opening a new one. It sits last in every concept: the
            obligation is what you must not do before typing; this is what you must do after reading.
          </p>
        </section>

        {/* Concepts */}
        {concepts.map((concept) => (
          <section
            key={concept.id}
            aria-labelledby={`${concept.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {concept.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`${concept.id}-title`} className="text-lg font-extrabold text-[color:var(--text-heading)]">
                      {concept.name}
                    </h2>
                    {concept.recommended ? (
                      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">{concept.summary}</p>
                  <p className="mt-1.5 max-w-3xl text-2xs font-medium leading-4 text-[color:var(--text-soft)]">
                    <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {concept.cost}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {concept.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-extrabold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <PreviewFrame label="Desktop hero" width="1440 px">
                <Hero />
                <ComposerPill />
                <Treatment concept={concept.id} compact={false} instanceId={`${concept.id}-desktop`} />
              </PreviewFrame>
              <PreviewFrame label="Phone hero" width="390 px" phone>
                <Hero compact />
                <ComposerPill compact />
                <Treatment concept={concept.id} compact instanceId={`${concept.id}-phone`} />
              </PreviewFrame>
            </div>
          </section>
        ))}

        {/* Recommendation */}
        <section
          aria-labelledby="recommendation-title"
          className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)] sm:p-5"
        >
          <h2 id="recommendation-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Recommendation
          </h2>
          <p className="max-w-4xl text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-semibold text-[color:var(--text-heading)]">
              Ship 02 on the hero and 01 on the dock.
            </span>{" "}
            They are the same content model at two densities, so they can share one component with a{" "}
            <code>density</code> prop. The hero is where a first-time user forms their model of what this tool is and
            what it is not, and it has the vertical room for the obligation to be visibly the loudest line. The docked
            composer on a submitted view has neither, and 01 keeps the obligation and the verify clause on screen while
            the descriptive half collapses.
          </p>
          <p className="max-w-4xl text-sm leading-6 text-[color:var(--text-muted)]">
            03 is the safest change to make — nearest to today’s visual weight, least likely to disturb the phone-chrome
            reserve maths — but it makes the obligation quieter still, which is the opposite of what the diagnosis above
            calls for.
          </p>
          <div className="mt-1 grid gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 text-2xs leading-4 text-[color:var(--text-muted)]">
            <p className="font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
              Before any of this ships
            </p>
            <p>
              The composer notice is the single site-wide APP-5 line and is rendered from{" "}
              <code>PrivacyInputNotice</code> on the answer, documents and calculators composers — consolidating here
              changes all of them. Wording sits under clinical governance, so the added verification sentence needs a
              governance sign-off, not just a design review, and <code>tests/privacy-ui.test.ts</code>,{" "}
              <code>tests/ui-accessibility.spec.ts</code> and the phone-chrome reserve coverage all assert against the
              current markup.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
