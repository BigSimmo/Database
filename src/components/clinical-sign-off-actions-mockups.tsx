"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleDashed,
  Eye,
  FileText,
  Info,
  Lock,
  PenLine,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { MockupPageShell, ModuleLabel, PanelBar, PanelFrame } from "@/components/on-call-shift-cover-mockups";

/**
 * Clinical sign-off — the half of the queue that does not exist (2026-09-19).
 *
 * Design scratch. Nothing is wired; the record text below is invented, and no
 * real clinical guidance, sense draft or reviewer name appears in it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * The finding this study exists for
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The clinical sign-off queue already ships. `src/lib/developer-area/sign-off-queue.ts`
 * loads seven families and `sign-off-queue-page-content.tsx` renders them at
 * `/mockups/development/clinical-sign-off`, behind the administrator gate. Its
 * counts are pinned by `tests/sign-off-queue.test.ts`: 54 WA MHA form guidance
 * records, 12 formulation mechanisms, 232 differential records, 429 dictionary
 * items, 603 specifiers, 205 therapy records and 75 sources — **1,610 records
 * a clinician has to look at.**
 *
 * And both files say, in their own words, that nothing on them can do it:
 * *"It is read-only. Nothing here publishes, approves or unhides a record."*
 * *"It reads, and never signs."*
 *
 * That was the right call for the page that shipped — a read-only inventory is
 * a safe thing to build first. But it means the largest block of P1 work in the
 * whole outstanding-issues ledger is now visible, counted, and still has no
 * mechanism. The work cannot be done inside the app at all.
 *
 * So these four boards are about the ACTION, not the list:
 *
 *  A. One record signed, and the attestation that makes it a sign-off rather
 *     than a checkbox.
 *  B. 429 at once, without "approve all" — the only board here that is really
 *     hard, and the one worth arguing about.
 *  C. Six review vocabularies, one action on top of them.
 *  D. What signing actually unlocks, shown before it is signed.
 */

function Body({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--background)] p-4">{children}</div>;
}

/* ═══════════════════  board A — one record, signed  ═══════════════════ */

/**
 * The attestation, and why it is three fields rather than a button.
 *
 * `src/lib/form-catalog.ts` already encodes the rule this board draws: a form
 * guidance record counts as reviewed only when `status`, `reviewedBy` AND
 * `reviewedAt` are all present, and a partial attestation falls back to
 * `drafted`. That is a good rule hidden inside a loader, and putting it on
 * screen is most of the design: the reviewer can see that a name and a date
 * are part of the claim, not metadata attached afterwards.
 *
 * The three confirmations above it are per-family and come from the queue's
 * own `note` text, which already states what a reviewer is being asked to
 * check. They are ticked individually because "I checked the guidance against
 * the Act" and "I checked it against the current approved form" are different
 * acts, and a single button collapses them into a claim nobody made.
 */
function BoardOneRecord() {
  return (
    <PanelFrame
      caption="A · One record — what makes it a sign-off rather than a tick"
      note="The three-field rule already in form-catalog.ts, put on screen: status, who, and when — or it stays drafted."
      heightClass="h-[820px]"
    >
      <PanelBar crumb="Clinical sign-off · WA MHA forms" title="Form 1A — operational guidance" />
      <Body>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-2 py-1 text-2xs font-bold text-[color:var(--warning-text)]">
            <CircleDashed aria-hidden="true" className="size-icon-xs" />
            Drafted · not signed
          </span>
          <span className="nums text-2xs text-[color:var(--text-muted)]">Record 1 of 54 · 0 signed</span>
        </div>

        <ModuleLabel>The guidance as drafted</ModuleLabel>
        <div className="mb-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3">
          <p className="text-sm leading-6 text-[color:var(--text)]">
            Example operational text standing in for the drafted guidance on this form — who may complete it, the time
            limits that apply, and where the completed form goes. Invented placeholder content, not guidance.
          </p>
        </div>

        <ModuleLabel>Drafted from</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {[
            ["The Act text", "Section reference, as stored on the record"],
            ["The current approved form", "Version as published by the department"],
          ].map(([title, meta]) => (
            <span
              key={title}
              className="flex min-h-tap items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3"
            >
              <FileText aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{title}</span>
                <span className="block text-3xs text-[color:var(--text-muted)]">{meta}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
            </span>
          ))}
        </div>

        {/* Separate ticks, because these are separate acts. A single
            "approve" button would record a claim about both that the
            reviewer may only have made about one. */}
        <ModuleLabel>What you are confirming</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {[
            ["The guidance matches the Act as it stands today", true],
            ["The guidance matches the currently approved form", true],
            ["Nothing here reads as clinical advice rather than process", false],
          ].map(([label, checked]) => (
            <span
              key={String(label)}
              className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span
                className={`mt-px grid size-5 shrink-0 place-items-center rounded-sm border ${
                  checked
                    ? "border-[color:var(--command)] bg-[color:var(--command)] text-[color:var(--command-contrast)]"
                    : "border-[color:var(--border-strong)]"
                }`}
              >
                {checked ? <Check aria-hidden="true" className="size-icon-xs" /> : null}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-5 text-[color:var(--text-heading)]">{label}</span>
            </span>
          ))}
        </div>

        <ModuleLabel>Your attestation</ModuleLabel>
        <div className="mb-2 grid gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Reviewed by", "Dr A. Example"],
              ["Reviewed at", "19 Sep 2026"],
            ].map(([label, value]) => (
              <span
                key={label}
                className="grid min-h-tap content-center gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3"
              >
                <span className="text-3xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                  {label}
                </span>
                <span className="nums text-sm font-bold text-[color:var(--text-heading)]">{value}</span>
              </span>
            ))}
          </div>
          <p className="flex items-start gap-1.5 text-2xs leading-4 text-[color:var(--text-muted)]">
            <Info aria-hidden="true" className="mt-px size-icon-xs shrink-0" />
            <span>
              A status with no name or no date is not a sign-off. The loader already treats a partial attestation as
              still drafted — this is that rule, made visible instead of silent. Both fields are read from the signed-in
              session and are not editable here: an attestation you can type is not an attestation.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          {/* Inert while a confirmation is unticked — the third one above is
              — and visibly so rather than hidden, so the reason is readable.
              Board B states its gating rule; this one used to be drawn
              enabled beside an unticked box, which is the same bug. */}
          <span className="flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-3 text-sm font-bold text-[color:var(--text-soft)]">
            <PenLine aria-hidden="true" className="size-icon-sm" />
            Sign off — 1 confirmation left
          </span>
          <span className="flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]">
            <X aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
            Send back
          </span>
        </div>
        <p className="mt-2 text-2xs leading-4 text-[color:var(--text-muted)]">
          Sending back is not a lesser action and is not hidden behind a menu. A queue with only one exit is a queue
          that gets cleared rather than reviewed.
        </p>
      </Body>
    </PanelFrame>
  );
}

/* ═══════════════════  board B — many at once, safely  ═══════════════════ */

/**
 * The hard board — and it was disagreed with, so this is the revised version.
 *
 * **What a governance review said about the first draft, and it was right.**
 * The first version of this board let a clean sample GRANT approval to the
 * whole slice. Combined with board A (an attestation is a named person, a
 * date and three specific confirmations) and board C (one attestation shape
 * written into each family's own field), that meant 184 records would carry
 * `reviewer: Dr X` when four were read, with nothing on the record to tell an
 * examined record from an inferred one. That is a false attestation, and it
 * is disqualifying on its own.
 *
 * Three more objections that stuck:
 *
 *  - **The maths was never stated.** Four of 184 is a 2.2% sample; under a
 *    reject-on-any-failure rule a slice that is 5% wrong passes about four
 *    times in five. A sampling scheme with no stated tolerable defect rate is
 *    not a control, it is a number that fitted the panel.
 *  - **The homogeneity premise is false for generated text.** "Records made
 *    the same way fail the same way" is true of a mis-set machine. Generation
 *    errors are per-item and concentrate in the rare, unfamiliar,
 *    high-consequence tail — exactly what a uniform draw is least likely to
 *    touch.
 *  - **It contradicted a rule already written in the module it is about.**
 *    `sign-off-queue.ts` says of these records: "A named reviewer signs the
 *    sense off record by record; promotion into the published dictionary is a
 *    clinical decision, not a data migration."
 *
 * **So the rule is inverted.** A sample can now only ever DISQUALIFY a slice.
 * A clean sample means the slice has not been ruled out — never that it is
 * approved — and batch review can never set `publicationAllowed`. The draw is
 * risk-weighted rather than uniform: anything touching a dose, a threshold, a
 * controlled drug or the Act is read in full, not sampled.
 *
 * That leaves the honest answer on the board: triage is batchable, approval
 * is not.
 *
 */
function BoardBatch() {
  const sample: Array<{ term: string; verdict: "ok" | "unread" | "fail" }> = [
    { term: "Example sense A", verdict: "ok" },
    { term: "Example sense B", verdict: "ok" },
    { term: "Example sense C", verdict: "fail" },
    { term: "Example sense D", verdict: "unread" },
  ];
  return (
    <PanelFrame
      caption="B · 429 at once — sampling that can only reject"
      note="Revised after a governance review rejected the first draft. A clean sample never approves anything; it only fails to disqualify. Triage is batchable, approval is not."
      heightClass="h-[820px]"
    >
      <PanelBar crumb="Clinical sign-off · Dictionary" title="429 items — 333 sense drafts, 96 definition reviews" />
      <Body>
        <div className="mb-3 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-sm font-bold text-[color:var(--text-heading)]">Slice by how they were made</p>
          <p className="mt-0.5 text-xs leading-5 text-[color:var(--text-muted)]">
            Not &ldquo;the next fifty&rdquo;. A slice is one source or one generator run, so a failure inside it is
            evidence about the run. It is <strong className="font-bold">not</strong> evidence that the rest of the run
            is correct — generation errors concentrate in the rare, unfamiliar records a uniform draw is least likely to
            reach, which is why the draw is risk-weighted and why a clean sample approves nothing.
          </p>
          <div className="mt-2 grid gap-1.5">
            {[
              ["Generated from source A", "184 items", true],
              ["Generated from source B", "149 items", false],
              ["Hand-authored", "96 items", false],
            ].map(([label, count, active]) => (
              <span
                key={String(label)}
                className={`flex min-h-tap items-center gap-2.5 rounded-lg border px-3 ${
                  active
                    ? "border-[color:var(--command)] bg-[color:var(--surface-raised)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
                }`}
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--text-heading)]">{label}</span>
                <span className="nums shrink-0 text-xs font-bold text-[color:var(--text-muted)]">{count}</span>
                {active ? (
                  <span className="shrink-0 rounded-sm bg-[color:var(--command)] px-1.5 py-0.5 text-3xs font-bold uppercase tracking-kicker text-[color:var(--command-contrast)]">
                    Open
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <ModuleLabel action={<>Drawn once · cannot re-roll</>}>Risk-weighted sample — 4 of 184</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {sample.map((row) => (
            <span
              key={row.term}
              className={`flex items-center gap-2.5 rounded-lg border p-2.5 ${
                row.verdict === "fail"
                  ? "border-[color:var(--danger)] bg-[color:var(--danger-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-raised)]"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{row.term}</span>
                <span className="block text-3xs text-[color:var(--text-muted)]">
                  {row.verdict === "unread" ? "Not opened yet" : "Opened and read in full"}
                </span>
              </span>
              {row.verdict === "ok" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--success)] bg-[color:var(--success-soft)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--success-text)]">
                  <Check aria-hidden="true" className="size-icon-xs" />
                  Correct
                </span>
              ) : row.verdict === "fail" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--danger)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--danger-text)]">
                  <AlertTriangle aria-hidden="true" className="size-icon-xs" />
                  Wrong
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[color:var(--border-strong)] px-1.5 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
                  <Eye aria-hidden="true" className="size-icon-xs" />
                  Read it
                </span>
              )}
            </span>
          ))}
        </div>

        {/* The consequence, stated before it happens rather than in a toast
            afterwards. */}
        <div className="mb-3 rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] p-3">
          <p className="flex items-start gap-1.5 text-sm font-bold leading-5 text-[color:var(--danger-text)]">
            <AlertTriangle aria-hidden="true" className="mt-px size-icon-md shrink-0" />
            One of your four is wrong, so all 184 go back.
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--danger-text)]">
            Not &ldquo;fix that one and carry on&rdquo;. A randomly drawn record being wrong is evidence about the
            batch, not about the record. Source A is returned to whoever generated it, with your note attached.
          </p>
        </div>

        <div className="grid gap-2">
          <span className="flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--danger)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--danger-text)]">
            <Undo2 aria-hidden="true" className="size-icon-sm" />
            Return all 184 with a note
          </span>
          {/* There is deliberately no "sign off slice" control. A clean sample
              would mean the slice has not been disqualified — it would never
              mean the slice is approved, and a button here would quietly say
              otherwise. Records still go to board A one at a time. */}
          <span className="flex min-h-tap items-center justify-center gap-2 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] px-3 text-sm font-bold text-[color:var(--text-heading)]">
            <Lock aria-hidden="true" className="size-icon-sm text-[color:var(--text-muted)]" />
            Send the surviving 180 to one-by-one review
          </span>
        </div>
        <p className="mt-2 text-2xs leading-4 text-[color:var(--text-muted)]">
          There is no control here that signs 184 records, and that is the finding rather than an omission. Sampling can
          rule a batch OUT cheaply; nothing about a clean sample licenses an attestation on a record nobody read.
        </p>
      </Body>
    </PanelFrame>
  );
}

/* ═══════════  board C — six vocabularies, one action  ═══════════ */

type Family = { name: string; count: number; nativeState: string; where: string };

const FAMILIES: Family[] = [
  { name: "WA MHA forms", count: 54, nativeState: "drafted", where: "status + reviewedBy + reviewedAt" },
  { name: "Formulation", count: 12, nativeState: "clinical_review_required", where: "reviewStatus" },
  { name: "Differentials", count: 232, nativeState: "unverified", where: "derived, not stored" },
  { name: "Dictionary", count: 429, nativeState: "pending", where: "clinicalApproval.status" },
  { name: "Specifiers", count: 603, nativeState: "clinician-review-pending", where: "review.clinicianReviewStatus" },
  { name: "Therapy", count: 205, nativeState: "needs_review", where: "reviewStatus" },
  { name: "Sources", count: 75, nativeState: "unverified", where: "disposition + validationStatus" },
];

/**
 * Seven families, seven vocabularies, and why they should stay that way.
 *
 * The queue module makes a deliberate choice worth defending rather than
 * undoing: it keeps each family's `nativeStatus` verbatim instead of mapping
 * everything onto one shared enum. That is right. `needs_review` on a therapy
 * record and `drafted` on a form guidance record are not the same claim, and
 * flattening them would quietly assert an equivalence nobody checked.
 *
 * But "different states" does not require "different actions", and today
 * there is no action at all. So the proposal is narrow: leave every native
 * word exactly where it is, and add ONE attestation shape on top — who, when,
 * and what they confirmed — writing into each family's own field.
 *
 * The count column is the argument for doing it in this order. Specifiers and
 * dictionary are 1,032 of the 1,610 between them; forms and formulation are 66
 * and are the two with the cleanest existing fields to write into. Start where
 * the mechanism is provable, not where the backlog is biggest.
 */
function BoardVocabularies() {
  const total = FAMILIES.reduce((sum, family) => sum + family.count, 0);
  return (
    <PanelFrame
      caption="C · Seven vocabularies, one action"
      note="Keep every family's own words — flattening them would assert an equivalence nobody checked. Add one attestation shape on top."
      heightClass="h-[720px]"
    >
      <PanelBar crumb="Clinical sign-off" title="What is waiting, and in whose words" />
      <Body>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <span className="nums text-2xl-minus font-bold tracking-display text-[color:var(--text-heading)]">
            {total.toLocaleString("en-AU")}
          </span>
          <span className="text-xs text-[color:var(--text-muted)]">records waiting on a person</span>
        </div>

        <div className="mb-3 grid gap-1.5">
          {FAMILIES.map((family) => (
            <div
              key={family.name}
              className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <span className="nums w-12 shrink-0 text-right text-sm font-bold text-[color:var(--text-heading)]">
                {family.count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{family.name}</span>
                <span className="block truncate text-3xs text-[color:var(--text-muted)]">{family.where}</span>
              </span>
              {/* The family's OWN word, in a monospaced pill — never
                  translated into a shared status on the way to the screen. */}
              <span className="nums shrink-0 rounded-sm border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 py-0.5 text-3xs font-semibold text-[color:var(--text-muted)]">
                {family.nativeState}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-[color:var(--command)] px-2 py-1 text-3xs font-bold text-[color:var(--command-contrast)]">
                <PenLine aria-hidden="true" className="size-icon-xs" />
                Review
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-3">
          <p className="text-xs font-bold text-[color:var(--text-heading)]">Where to start, and it is not the top</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text)]">
            Forms and formulation are 66 records between them and already carry the cleanest fields to write into —
            forms even encodes the three-part rule. Prove the mechanism there. Specifiers and dictionary are 1,032 of
            the 1,610 and need board B&rsquo;s batch rule before anyone should touch them.
          </p>
        </div>
      </Body>
    </PanelFrame>
  );
}

/* ═══════════  board D — what signing unlocks  ═══════════ */

/**
 * The consequence, shown before the click rather than discovered after it.
 *
 * A dictionary sense draft carries `clinicalApproval` pending AND
 * `publicationAllowed: false`. Signing it does not merely change a label — it
 * is the thing that lets the content reach a reader. An approval whose effect
 * is invisible at the moment of approving is an approval nobody can reason
 * about, so this board puts the before and after side by side and names the
 * surfaces that change.
 *
 * The undo line matters as much. Sign-off must be reversible, and the record
 * of the reversal must survive: "unsigned on 20 Sep by Dr A. Example" is part
 * of the governance trail, not a cleanup of a mistake.
 */
function BoardConsequence() {
  return (
    <PanelFrame
      caption="D · What signing unlocks, shown before you sign"
      note="Signing a sense draft is what lets it reach a reader. An approval whose effect is invisible is one nobody can reason about."
      heightClass="h-[720px]"
    >
      <PanelBar crumb="Clinical sign-off · Dictionary" title="Before you sign this slice" />
      <Body>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            {
              heading: "Now",
              tone: "muted" as const,
              rows: [
                ["clinicalApproval", "pending"],
                ["publicationAllowed", "false"],
                ["Visible to a reader", "no"],
                ["Answerable from", "no"],
              ],
            },
            {
              heading: "After signing",
              tone: "accent" as const,
              rows: [
                ["clinicalApproval", "approved"],
                ["publicationAllowed", "true"],
                ["Visible to a reader", "yes"],
                ["Answerable from", "yes"],
              ],
            },
          ].map((column) => (
            <div
              key={column.heading}
              className={`rounded-lg border p-3 ${
                column.tone === "accent"
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-subtle)]"
              }`}
            >
              <p className="text-2xs font-bold uppercase tracking-kicker text-[color:var(--text-muted)]">
                {column.heading}
              </p>
              <dl className="mt-2 grid gap-1.5">
                {column.rows.map(([label, value]) => (
                  <div key={label} className="grid gap-0.5">
                    <dt className="text-3xs text-[color:var(--text-muted)]">{label}</dt>
                    <dd className="nums text-sm font-bold text-[color:var(--text-heading)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <ModuleLabel>Which surfaces change</ModuleLabel>
        <div className="mb-3 grid gap-1.5">
          {[
            ["The dictionary term page", "184 senses appear where a placeholder is today"],
            ["Search results", "these senses become matchable"],
            ["Generated answers", "these senses become quotable evidence"],
          ].map(([surface, effect]) => (
            <span
              key={surface}
              className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-2.5"
            >
              <ShieldCheck aria-hidden="true" className="mt-px size-icon-md shrink-0 text-[color:var(--text-muted)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[color:var(--text-heading)]">{surface}</span>
                <span className="block text-xs text-[color:var(--text-muted)]">{effect}</span>
              </span>
            </span>
          ))}
        </div>

        <div className="rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] p-3">
          <p className="flex items-start gap-1.5 text-xs leading-5 text-[color:var(--text)]">
            <Undo2 aria-hidden="true" className="mt-px size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
            <span>
              <strong className="font-bold">Signing is reversible, and the reversal is kept.</strong> Unsigning writes
              its own dated line rather than clearing the first one. A governance trail that can be tidied is not a
              trail.
            </span>
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[color:var(--text)]">
            <BadgeCheck aria-hidden="true" className="mt-px size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
            <span>
              Every signature carries the reviewer, the moment, and the three confirmations from board A — so a year
              from now the record says what was checked, not merely that somebody clicked.
            </span>
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[color:var(--text)]">
            <Lock aria-hidden="true" className="mt-px size-icon-sm shrink-0 text-[color:var(--text-muted)]" />
            <span>
              <strong className="font-bold">Only a record-by-record signature may set this flag.</strong> Nothing
              batched reaches it, because this is the flag that lets content become quotable evidence in a generated
              answer — and the grounded-evidence layers check that a quote is faithful to its source, never that the
              source is clinically right.
            </span>
          </p>
        </div>
      </Body>
    </PanelFrame>
  );
}

/* ══════════════════════════  the page  ══════════════════════════ */

export function ClinicalSignOffActionsMockups() {
  return (
    <MockupPageShell
      eyebrow="Clinical governance · study 4"
      title="The sign-off queue can see the work. Nothing can do it."
      summary="The queue already ships and lists 1,610 records across seven families — and both of its source files say plainly that it never signs. That was the right thing to build first, but it means the largest block of P1 work in the ledger is now counted and still has no mechanism. These four boards are about the action: what makes an attestation a sign-off rather than a tick, how to review 429 records without either a week of evenings or an approve-all button, how seven review vocabularies keep their own words under one shared action, and what signing actually unlocks."
      scratchNote="Design scratch. Nothing is wired, and every record, count and reviewer name in these boards is invented. Drawn at desk width in the app's own tokens, because this is sat-down work rather than corridor work."
    >
      <div className="flex flex-wrap gap-x-6 gap-y-10">
        <BoardOneRecord />
        <BoardBatch />
        <BoardVocabularies />
        <BoardConsequence />
      </div>
    </MockupPageShell>
  );
}
