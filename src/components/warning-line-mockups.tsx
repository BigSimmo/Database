"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/components/ui-primitives";

// Design-scratch study, second pass. The first pass (/mockups/warning-consolidation)
// answered "one block instead of three" with bordered and tinted containers. This
// pass answers a narrower brief: words only — no icon, no border, no tint, no
// background — and one line wherever the width allows.
//
// The governance strings are pinned verbatim by tests/privacy-ui.test.ts:
// "Do not enter patient-identifiable information." and the "Privacy and data
// processing" link to /privacy. Concepts A-E honour both. Concept F deliberately
// shortens the obligation to show what a single phone line would actually cost,
// and is marked as requiring governance sign-off rather than quietly shipped.

const OBLIGATION = "Do not enter patient-identifiable information.";
const PRIVACY_LINK = "Privacy and data processing";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

// One shared link treatment: no underline at rest, so nothing draws the eye; it
// appears on hover/focus. Colour alone is not the affordance — the underline is.
const linkClass = cn(
  "rounded-sm underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current focus-visible:decoration-current",
  focusRing,
);

type ConceptId = "prose" | "middot" | "weight" | "minimal" | "paren" | "compressed";

const concepts: Array<{
  id: ConceptId;
  letter: string;
  name: string;
  idea: string;
  cost: string;
  lines: string;
  recommended?: boolean;
  governanceGated?: boolean;
}> = [
  {
    id: "prose",
    letter: "A",
    name: "Running prose",
    idea: "Three sentences, no separators, no emphasis. Reads as a footnote rather than as chrome.",
    lines: "2 lines desktop · 3 phone",
    cost: "Longest of the set. The obligation has no more weight than the caveat beside it.",
  },
  {
    id: "middot",
    letter: "B",
    name: "Middot clauses",
    idea: "Same content, telegraphic. Middots let the eye jump to the clause it wants instead of reading the sentence.",
    lines: "1 line desktop · 2 phone",
    cost: "Punctuation is ornament of a sort — it reads slightly more like UI chrome than A does.",
  },
  {
    id: "weight",
    letter: "C",
    name: "Weight-only hierarchy",
    idea: "A's exact words. The obligation alone takes the heading colour and medium weight; everything after it stays muted. Hierarchy with no ornament at all.",
    lines: "2 lines desktop · 3 phone",
    cost: "Needs the two tones to survive forced-colors mode, where the distinction may flatten. Two lines at desktop width, so it does not meet the single-line brief.",
  },
  {
    id: "minimal",
    letter: "D",
    name: "Obligation and verify only",
    idea: "Drops the scope claim entirely. What indexes the answer is visible on the answer itself; the pre-query line carries only what you must not do and what you must check.",
    lines: "1 line desktop · 2 phone",
    cost: "Loses the one line that told a first-time user what the tool searches.",
    recommended: true,
  },
  {
    id: "paren",
    letter: "E",
    name: "Parenthetical caveat",
    idea: "Subordinates the verification clause inside brackets so the obligation stays the only full-rank statement.",
    lines: "2 lines desktop · 3 phone",
    cost: "Brackets read as an aside, which is the opposite of what a safety caveat wants.",
  },
  {
    id: "compressed",
    letter: "F",
    name: "Compressed obligation",
    idea: "The only variant that fits one line on a 390px phone. Shortens the pinned APP-5 sentence to get there.",
    lines: "1 line desktop · 2 phone",
    cost: "Changes governance copy: needs clinical/privacy sign-off and a matching update to tests/privacy-ui.test.ts. Not a design decision.",
    governanceGated: true,
  },
];

const base = "block w-full text-2xs leading-4 text-[color:var(--text-muted)]";

function Notice({ concept }: { concept: ConceptId }) {
  if (concept === "prose") {
    return (
      <p className={base}>
        {OBLIGATION} Answers are AI-generated — verify against the cited source before clinical use.{" "}
        <Link href="/privacy" className={linkClass}>
          {PRIVACY_LINK}
        </Link>
      </p>
    );
  }

  if (concept === "middot") {
    return (
      <p className={base}>
        {OBLIGATION}
        <span className="mx-1.5 text-[color:var(--text-soft)]" aria-hidden>
          ·
        </span>
        AI-generated — verify against the cited source
        <span className="mx-1.5 text-[color:var(--text-soft)]" aria-hidden>
          ·
        </span>
        <Link href="/privacy" className={linkClass}>
          {PRIVACY_LINK}
        </Link>
      </p>
    );
  }

  if (concept === "weight") {
    return (
      <p className={base}>
        <span className="font-medium text-[color:var(--text-heading)]">{OBLIGATION}</span> Answers are AI-generated —
        verify against the cited source before clinical use.{" "}
        <Link href="/privacy" className={linkClass}>
          {PRIVACY_LINK}
        </Link>
      </p>
    );
  }

  if (concept === "minimal") {
    return (
      <p className={base}>
        <span className="font-medium text-[color:var(--text-heading)]">{OBLIGATION}</span> Verify answers against the
        cited source.{" "}
        <Link href="/privacy" className={linkClass}>
          {PRIVACY_LINK}
        </Link>
      </p>
    );
  }

  if (concept === "paren") {
    return (
      <p className={base}>
        <span className="font-medium text-[color:var(--text-heading)]">{OBLIGATION}</span> Answers are AI-generated
        (verify against the cited source before clinical use).{" "}
        <Link href="/privacy" className={linkClass}>
          {PRIVACY_LINK}
        </Link>
      </p>
    );
  }

  return (
    <p className={base}>
      <span className="font-medium text-[color:var(--text-heading)]">No patient-identifiable information.</span>{" "}
      AI-generated — verify against source.{" "}
      <Link href="/privacy" className={linkClass}>
        {PRIVACY_LINK}
      </Link>
    </p>
  );
}

function Composer({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-4 pr-2 shadow-[var(--shadow-inset)]",
        compact ? "min-h-12" : "min-h-14",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-soft)]">Ask a clinical question…</span>
      <span className="h-9 w-9 shrink-0 rounded-full border border-[color:var(--border)]" aria-hidden />
    </div>
  );
}

function Frame({
  label,
  width,
  phone,
  children,
}: {
  label: string;
  width: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[24rem]")}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{width}</span>
      </div>
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-4">
        <div className={cn("mx-auto grid gap-2", phone ? "max-w-[21rem]" : "max-w-[40rem]")}>{children}</div>
      </div>
    </div>
  );
}

export function WarningLineMockupsPage() {
  const [showToday, setShowToday] = useState(false);

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[80rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Answer home — notices, second pass
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            One quiet line. Words only.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            No icon, no border, no tint, no background — the notice should read as a footnote, not as furniture. Line
            counts below are measured from the rendered page, not asserted: three of the six hold a single line at
            desktop width, and none do on a 390px phone while the pinned APP-5 sentence stays verbatim.
          </p>
          <button
            type="button"
            onClick={() => setShowToday((v) => !v)}
            aria-pressed={showToday}
            className={cn(
              "mt-4 inline-flex min-h-9 items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-xs font-extrabold text-[color:var(--text-heading)]",
              focusRing,
            )}
          >
            {showToday ? "Hide today's stack" : "Show today's stack"}
          </button>
          {showToday ? (
            <div className="mt-4 max-w-[40rem] rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] p-4">
              <p className="mb-2 text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Today — three elements, three type sizes
              </p>
              <p className="text-2xs leading-4 text-[color:var(--text-muted)]">⚠ {OBLIGATION}</p>
              <p className="mt-1 text-2xs leading-4 text-[color:var(--text-muted)] underline">{PRIVACY_LINK}</p>
              <p className="mt-2 text-sm font-medium leading-5 text-[color:var(--clinical-accent)]">
                ✓ Searches indexed clinical sources • Clinical Guide library
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-[80rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {concepts.map((c) => (
          <section
            key={c.id}
            aria-labelledby={`${c.id}-title`}
            className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
          >
            <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-[color:var(--clinical-accent)]">{c.letter}</span>
                <h2 id={`${c.id}-title`} className="text-base font-extrabold text-[color:var(--text-heading)]">
                  {c.name}
                </h2>
                {c.recommended ? (
                  <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                    Recommended
                  </span>
                ) : null}
                {c.governanceGated ? (
                  <span className="rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--warning-text)]">
                    Needs governance sign-off
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">{c.idea}</p>
              <p className="mt-1 max-w-3xl text-2xs leading-4 text-[color:var(--text-soft)]">
                <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {c.cost}
              </p>
              <p className="mt-1 text-2xs font-semibold leading-4 text-[color:var(--text-muted)]">
                Measured: {c.lines}
              </p>
            </div>

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Frame label="Desktop hero" width="1440 px">
                <Composer />
                <div data-measure={`${c.id}-desktop`}>
                  <Notice concept={c.id} />
                </div>
              </Frame>
              <Frame label="Phone hero" width="390 px" phone>
                <Composer compact />
                <div data-measure={`${c.id}-phone`}>
                  <Notice concept={c.id} />
                </div>
              </Frame>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
