"use client";

import Link from "next/link";
import { MessageSquareText, ShieldAlert, ShieldCheck } from "lucide-react";

import { cn } from "@/components/ui-primitives";

// Design-scratch: the concrete proposal, drawn as before/after of the whole
// answer-mode hero rather than of the notice alone — because the change moves
// information between two places. The scope badge is removed and the corpus
// name it carried moves into the subtitle that already exists.
//
// Pinned by tests/privacy-ui.test.ts and reproduced verbatim on both sides:
// "Do not enter patient-identifiable information." and the "Privacy and data
// processing" link to /privacy. The subtitle is ordinary product copy
// (src/lib/ui-copy.ts, answerEmptyState.subheading) and is not pinned.

const OBLIGATION = "Do not enter patient-identifiable information.";
const PRIVACY_LINK = "Privacy and data processing";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function Hero({ subtitle, phone }: { subtitle: React.ReactNode; phone?: boolean }) {
  return (
    <div className="grid justify-items-center gap-1.5">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <MessageSquareText className="h-5 w-5" aria-hidden />
      </span>
      <p
        className={cn(
          "font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]",
          phone ? "text-2xl" : "text-3xl",
        )}
      >
        How can I help?
      </p>
      <p className="text-center text-sm text-[color:var(--text-muted)]">{subtitle}</p>
    </div>
  );
}

function Composer({ phone }: { phone?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-4 pr-2 shadow-[var(--shadow-inset)]",
        phone ? "min-h-12" : "min-h-14",
      )}
    >
      <span className="text-lg text-[color:var(--text-soft)]" aria-hidden>
        +
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-soft)]">Ask a clinical question…</span>
      <span className="h-9 w-9 shrink-0 rounded-full border border-[color:var(--border)]" aria-hidden />
    </div>
  );
}

/** Today: three notices, three type sizes, two opposing shields. */
function BeforeFooter() {
  return (
    <div className="grid w-full justify-items-center gap-2">
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
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium leading-5 text-[color:var(--text-muted)]">
        <span className="inline-flex items-center gap-2 font-semibold text-[color:var(--clinical-accent)]">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Searches indexed clinical sources
        </span>
        <span aria-hidden>•</span>
        <span>Clinical Guide library</span>
      </p>
    </div>
  );
}

/** Proposed: one quiet line, words only. */
function AfterFooter() {
  return (
    <p className="block w-full text-center text-2xs leading-4 text-[color:var(--text-muted)]">
      <span className="font-medium text-[color:var(--text-heading)]">{OBLIGATION}</span> Verify answers against the
      cited source.{" "}
      <Link
        href="/privacy"
        className={cn(
          "rounded-sm underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current focus-visible:decoration-current",
          focusRing,
        )}
      >
        {PRIVACY_LINK}
      </Link>
    </p>
  );
}

function Panel({ side, phone, children }: { side: "before" | "after"; phone?: boolean; children: React.ReactNode }) {
  const isAfter = side === "after";
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[24.5rem]")}>
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className={cn(
            "text-3xs font-extrabold uppercase tracking-[0.12em]",
            isAfter ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
          )}
        >
          {isAfter ? "Proposed" : "Today"}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{phone ? "390 px" : "1440 px"}</span>
      </div>
      <div
        className={cn(
          "rounded-2xl border bg-[color:var(--surface-inset)] p-5",
          isAfter ? "border-[color:var(--clinical-accent-border)]" : "border-[color:var(--border)]",
        )}
      >
        <div className={cn("mx-auto grid gap-4", phone ? "max-w-[21rem]" : "max-w-[34rem]")}>{children}</div>
      </div>
    </div>
  );
}

const changes: Array<{ what: string; why: string; pinned?: boolean }> = [
  {
    what: "Remove the “Searches indexed clinical sources · Clinical Guide library” badge",
    why: "Accent-blue, semibold, 14px — the loudest element on the screen, and a capability claim rather than a safety statement. Pre-query it can only assert; post-query the real sources appear as citations.",
  },
  {
    what: "Remove the ShieldCheck",
    why: "A shield-and-tick reads as “verified”. The comment above this component in answer-status.tsx warns that pre-query copy must not assert every indexed source is verified/current (PT-06) — the wording obeys that, the icon undoes it. It also sat ~40px from a ShieldAlert meaning the opposite.",
  },
  {
    what: "Move “Clinical Guide library” into the subtitle",
    why: "The one genuinely useful fact in the badge — that this searches a curated clinical corpus, not the open web. The subtitle already exists, so the fact keeps a home without a second voice. Ordinary product copy, not pinned by any test.",
  },
  {
    what: "Remove the ShieldAlert from the privacy line",
    why: "With the competing shield gone, the amber icon is the only ornament left on a line that now carries weight-based hierarchy instead.",
  },
  {
    what: "Join the privacy link to the same line",
    why: "It previously wrapped alone with no lead-in, reading as navigation rather than as the footnote to the warning above it.",
  },
  {
    what: "Add “Verify answers against the cited source.”",
    why: "The statement the screen never made. Every other clinical mode carries an equivalent; answer mode — the only one that synthesises prose — carried none. This is new clinical-safety copy and needs governance sign-off.",
    pinned: true,
  },
];

export function AnswerHomeProposalMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[80rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Answer home — proposed change
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Drop the scope badge. Keep the corpus name. One quiet line.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Three stacked notices in three type sizes with two opposing shields become one line of text, and the only
            fact worth keeping from the badge moves into the subtitle that was already there.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[80rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section aria-labelledby="phone-title" className="grid gap-4">
          <h2 id="phone-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Phone — the surface in the screenshot
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel side="before" phone>
              <Hero phone subtitle="Ask a clinical question or search your documents." />
              <Composer phone />
              <BeforeFooter />
            </Panel>
            <Panel side="after" phone>
              <Hero
                phone
                subtitle={
                  <>
                    Ask a clinical question or search your{" "}
                    <span className="font-semibold text-[color:var(--text-heading)]">Clinical Guide library</span>.
                  </>
                }
              />
              <Composer phone />
              <AfterFooter />
            </Panel>
          </div>
        </section>

        <section aria-labelledby="desktop-title" className="grid gap-4">
          <h2 id="desktop-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Desktop
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel side="before">
              <Hero subtitle="Ask a clinical question or search your documents." />
              <Composer />
              <BeforeFooter />
            </Panel>
            <Panel side="after">
              <Hero
                subtitle={
                  <>
                    Ask a clinical question or search your{" "}
                    <span className="font-semibold text-[color:var(--text-heading)]">Clinical Guide library</span>.
                  </>
                }
              />
              <Composer />
              <AfterFooter />
            </Panel>
          </div>
        </section>

        <section
          aria-labelledby="changes-title"
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
        >
          <h2 id="changes-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            What changed, and why
          </h2>
          <ol className="mt-3 grid gap-3">
            {changes.map((c, i) => (
              <li key={c.what} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                <span className="text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--text-heading)]">
                    {c.what}
                    {c.pinned ? (
                      <span className="ml-2 rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--warning-text)]">
                        Needs governance sign-off
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-[color:var(--text-muted)]">{c.why}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-[color:var(--border)] pt-3 text-2xs leading-4 text-[color:var(--text-soft)]">
            Unchanged and reproduced verbatim on both sides: “{OBLIGATION}” and the “{PRIVACY_LINK}” link to{" "}
            <code>/privacy</code> — APP-5 / PIA-5 copy pinned by <code>tests/privacy-ui.test.ts</code>. Adoption edits{" "}
            <code>PrivacyInputNotice</code>, the single site-wide notice rendered on the answer, documents and
            calculators composers, so all three move together and the change needs a full clinical governance preflight.
          </p>
        </section>
      </div>
    </main>
  );
}
