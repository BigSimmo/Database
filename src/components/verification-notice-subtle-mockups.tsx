"use client";

import { CircleAlert, Info, TriangleAlert } from "lucide-react";

/**
 * Design-scratch study: subtler lockups for VerificationNotice caution states
 * (`ungrounded` / `stale_evidence`). Today the whole line paints `--warning`,
 * which reads as a banner rather than as standing provenance text.
 *
 * Approved clinician wording is pinned by COMPONENTS §1 / the live component —
 * these concepts explore presentation only. Wording changes need clinical
 * owner review and are not proposed here.
 */

const UNGROUNDED =
  "AI-generated, and the cited sources could not be shown to support every claim in it. Read the cited passages and confirm each clinical number, dose, timing and threshold there before acting on it.";

const READY =
  "AI-generated from the cited sources. Verify every clinical claim against the linked source before acting on it.";

type ConceptId = "baseline" | "icon-only" | "quiet-rule" | "words-only" | "label-prose" | "hairline" | "soft-mark";

const concepts: Array<{
  id: ConceptId;
  letter: string;
  name: string;
  idea: string;
  cost: string;
  recommended?: boolean;
}> = [
  {
    id: "baseline",
    letter: "A",
    name: "Today — full warning paint",
    idea: "TriangleAlert and the entire body use `--warning`. Highest salience; the line competes with the answer prose.",
    cost: "The caution role is unmistakable, but the lockup reads as chrome rather than as a footnote above the answer.",
  },
  {
    id: "icon-only",
    letter: "B",
    name: "Icon carries caution",
    idea: "Keep TriangleAlert on the warning role; drop the body back to `--text-muted`. Colour no longer floods the paragraph.",
    cost: "Salience lives in one 16px mark. Forced-colors / icon-suppressed modes need the wording alone to still carry the instruction.",
    recommended: true,
  },
  {
    id: "quiet-rule",
    letter: "C",
    name: "Quiet amber rule",
    idea: "A 2px left rule in `--warning` replaces the glyph. Body stays muted. Shape, not fill, marks caution.",
    cost: "No icon vocabulary from SPEC §5. The rule must survive print and forced-colors or the state collapses to neutral.",
  },
  {
    id: "words-only",
    letter: "D",
    name: "Words only",
    idea: "No icon, no rule, no tint — muted type only. Closest to the warning-line study’s “footnote, not furniture” brief.",
    cost: "Weakest caution signal of the set. May under-signal `ungrounded` relative to `ready`, which already uses the same muted register today.",
  },
  {
    id: "label-prose",
    letter: "E",
    name: "Label + muted prose",
    idea: "A short standing label (“Review source match”) in soft warning weight, then the approved wording in muted body. Matches the live product’s existing caution phrase.",
    cost: "Adds a second string beside system-owned wording. The label must stay short enough not to become a competing headline.",
  },
  {
    id: "hairline",
    letter: "F",
    name: "Hairline footnote",
    idea: "A top hairline separates the notice from the answer chrome; body is muted with a soft CircleAlert at text scale.",
    cost: "The divider adds vertical chrome. Soft amber on the mark is quieter than B but still keeps a caution channel.",
  },
  {
    id: "soft-mark",
    letter: "G",
    name: "Soft mark + soft weight",
    idea: "Info-sized TriangleAlert at 55% warning mix; first sentence medium weight in heading colour, instruction clause muted. Hierarchy without flooding amber.",
    cost: "Two tones + a diluted mark — more craft than the others. Diluted warning may fail contrast gates unless measured.",
  },
];

function SampleAnswer() {
  return (
    <div className="mt-4 space-y-2 border-t border-[color:var(--border)] pt-4">
      <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        Answer body (context)
      </p>
      <p className="text-sm leading-6 text-[color:var(--text)]">
        Sertraline starting dose in adults is typically 50 mg daily, with titration according to response and
        tolerability. Confirm the exact regimen, titration steps, and monitoring thresholds in the cited product
        information before prescribing.
      </p>
    </div>
  );
}

function ReadyReference() {
  return (
    <aside className="flex items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
      <Info aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0" />
      <p>{READY}</p>
    </aside>
  );
}

function Lockup({ concept }: { concept: ConceptId }) {
  if (concept === "baseline") {
    return (
      <aside className="flex items-start gap-2 text-xs leading-5 text-[color:var(--warning)] sm:text-sm sm:leading-6">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0" />
        <p>{UNGROUNDED}</p>
      </aside>
    );
  }

  if (concept === "icon-only") {
    return (
      <aside className="flex items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" />
        <p>{UNGROUNDED}</p>
      </aside>
    );
  }

  if (concept === "quiet-rule") {
    return (
      <aside className="border-l-2 border-[color:var(--warning)] pl-3 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
        <p>{UNGROUNDED}</p>
      </aside>
    );
  }

  if (concept === "words-only") {
    return (
      <aside className="text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
        <p>{UNGROUNDED}</p>
      </aside>
    );
  }

  if (concept === "label-prose") {
    return (
      <aside className="flex items-start gap-2 text-xs leading-5 sm:text-sm sm:leading-6">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)]" />
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--warning-text)]">
            Review source match
          </p>
          <p className="mt-0.5 text-[color:var(--text-muted)]">{UNGROUNDED}</p>
        </div>
      </aside>
    );
  }

  if (concept === "hairline") {
    return (
      <aside className="border-t border-[color:var(--border)] pt-3">
        <div className="flex items-start gap-2 text-xs leading-5 text-[color:var(--text-muted)] sm:text-sm sm:leading-6">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)] opacity-70"
          />
          <p>{UNGROUNDED}</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex items-start gap-2 text-xs leading-5 sm:text-sm sm:leading-6">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-icon-sm shrink-0 text-[color:var(--warning)] opacity-55"
      />
      <p>
        <span className="font-medium text-[color:var(--text-heading)]">
          AI-generated, and the cited sources could not be shown to support every claim in it.
        </span>{" "}
        <span className="text-[color:var(--text-muted)]">
          Read the cited passages and confirm each clinical number, dose, timing and threshold there before acting on
          it.
        </span>
      </p>
    </aside>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
      </div>
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:p-5">
        {children}
      </div>
    </div>
  );
}

export function VerificationNoticeSubtleMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[80rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            VerificationNotice — caution lockups
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Softer caution. Same words.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            The live `ungrounded` notice paints the whole line amber. These lockups keep the approved clinician wording
            and explore quieter presentation — so the caveat sits as provenance, not as a second banner above the
            answer.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[80rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-3 sm:px-5">
            <h2 className="text-base font-extrabold text-[color:var(--text-heading)]">Ready reference (neutral)</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              What a non-caution answer already looks like — muted body, Info mark. Caution options should feel closer
              to this than to a toast.
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <Frame label="Ready — Info + muted">
              <ReadyReference />
              <SampleAnswer />
            </Frame>
          </div>
        </section>

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
              </div>
              <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-muted)]">{c.idea}</p>
              <p className="mt-1 max-w-3xl text-2xs leading-4 text-[color:var(--text-soft)]">
                <span className="font-extrabold uppercase tracking-[0.1em]">Trade-off</span> — {c.cost}
              </p>
            </div>

            <div className="p-4 sm:p-5">
              <Frame label={`Ungrounded — ${c.letter}`}>
                <Lockup concept={c.id} />
                <SampleAnswer />
              </Frame>
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] px-4 py-5 sm:px-5">
          <h2 className="text-sm font-extrabold text-[color:var(--text-heading)]">Adoption notes</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-muted)]">
            <li>
              COMPONENTS §1 still requires caution states to wear the warning role — never danger red. B, C, E, F, and G
              keep a warning channel; D does not.
            </li>
            <li>
              Presentation-only change to `VerificationNotice` for caution states. Do not alter approved strings without
              clinical owner review.
            </li>
            <li>
              `tests/ui-v2-answer-safety.dom.test.tsx` pins that only caution states wear the warning role — update the
              assertion if caution moves from body colour to icon/rule colour only.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
