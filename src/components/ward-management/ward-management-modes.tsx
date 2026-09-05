"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleSlash,
  Clock3,
  FileCheck2,
  FileClock,
  Fingerprint,
  History,
  Info,
  ListChecks,
  LockKeyhole,
  MapPin,
  Scale,
  ShieldCheck,
  Truck,
  Users,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  BED_RELEASE_BLOCKED_FIGURE_LABEL,
  buildActionInbox,
  candidateReason,
  changeAudit,
  destinationUnit,
  effectivenessNumbers,
  eligibleCandidatesAmong,
  elapsedLabel,
  isOpen,
  movementHealthService,
  movementTimeline,
  roleLabels,
  roleTaskLabel,
  MINIMUM_EFFECTIVENESS_SAMPLE,
  stageSummaries,
  transportLeg,
  unitCapacity,
  type ChangeAuditEntry,
  type EffectivenessMeasure,
  type InboxItem,
  type WardRole,
} from "@/components/ward-management/ward-derivations";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardNetworkWorkspace } from "@/components/ward-management/ward-management-network";
import { ClinicalRail, type WardMode } from "@/components/ward-management/ward-management-navigation";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import type { Movement } from "@/components/ward-management/ward-model";
import { DEMONSTRATION_DAY_LABEL, JURISDICTION_LABEL, siteByCode } from "@/components/ward-management/ward-sites";
import { WARD_NAV } from "@/components/ward-management/ward-nav";

import styles from "./ward-management-modes.module.css";
// Second-edition classes for the three views this file still owns (QueueView, ExceptionsView,
// GovernanceView) plus their exclusive sub-components (DecisionPanel, EffectivenessValue). See
// that file's own header comment for why it is a separate module rather than an edit to the
// selectors above: several of those are declared in selector lists shared with CapacityView,
// MovementsView, TransportView, ModeHeader and RoleFocus, which this task does not own.
import se from "./ward-modes-second-edition.module.css";

const roleFocusCopy: Record<WardRole, { title: string; detail: string }> = {
  flow: {
    title: "Statewide coordination focus",
    detail: "Review matches, cross-catchment escalation, pulls and owned exceptions.",
  },
  ed: {
    title: "ED readiness focus",
    detail: "Prioritise referral, legal/form timing, handover and transport request readiness.",
  },
  ward: {
    title: "Ward capacity focus",
    detail: "Prioritise capacity freshness, suitability response, acceptance and time-limited pulls.",
  },
};

const modeCopy: Record<WardMode, { title: string; description: string }> = {
  command: { title: "Ward Flow", description: "Statewide command view" },
  network: {
    title: "Network diagram",
    description: "Services as nodes · movements as routes · fill shows bed pressure",
  },
  queue: { title: "Priority queue", description: "Human urgency first · eligibility within tier" },
  capacity: { title: "Capacity", description: "Ward-confirmed state, capability and freshness" },
  movements: { title: "Movements", description: "Seven-stage patient movement board" },
  exceptions: { title: "Action inbox", description: "Owned exceptions, deadlines and stale state" },
  transport: { title: "Transport", description: "Legal, document, booking and handover readiness" },
  governance: { title: "Governance", description: "Assurance, audit and synthetic data boundary" },
};

/** Task 9: a short human label for each `ChangeAuditEntry` kind — never the raw union value on screen. */
export const auditKindLabels: Record<ChangeAuditEntry["kind"], string> = {
  urgency: "Urgency change",
  legal_status: "Legal status change",
  pull_released: "Pull released",
  transport_cancelled: "Transport cancelled",
  // Task 5 (ward-flow movement step-track plan, 2026-09-04). Kept as generic as the `detail`
  // field `changeAudit` currently produces for these two (`ward-derivations.ts`) — a
  // per-reason label needs `STEP_BACK_REASONS` to gain a `changeReasonLabels` entry first, which
  // is outside this build's scope. Widen both together, not this one alone.
  stage_corrected: "Stage corrected",
  acceptance_withdrawn: "Acceptance withdrawn",
};

/**
 * THE PANEL'S OWN SENTENCE ABOUT WHAT IT SHOWS, DERIVED FROM THE MAP ABOVE RATHER THAN RETYPED.
 *
 * 🔴 UNTIL 2026-09-04 BOTH SENTENCES NAMED FOUR KINDS AND THE MAP HELD SIX. `stage_corrected` and
 * `acceptance_withdrawn` were added the same day; the heading three hundred lines below still said
 * "Every urgency change, legal status change, pull release and transport cancellation", and the
 * empty state still said none of those four "has been recorded yet" — **a false statement of fact
 * about a patient's record on any movement whose stage had been corrected.**
 *
 * ⚠️ AND THE REASON IT HAPPENED IS THE GENERAL ONE. `auditKindLabels` is a TOTAL `Record` over the
 * union, so the compiler forced whoever added the two kinds to add their labels. Nothing forced the
 * paragraph. **The compiler is inside the definition of "the code" and the rendered sentence is
 * not** — which is why a heavily-guarded codebase keeps producing this class: every guard is on the
 * side the compiler can see. Deriving the sentence moves it to that side.
 *
 * The labels are used verbatim, only de-capitalised, so the sentence names the kinds in the same
 * words as the rows beneath it and a reader can match one to the other.
 */
const auditKindWords = Object.values(auditKindLabels).map((label) => label.charAt(0).toLowerCase() + label.slice(1));
const auditKindsAnd = `${auditKindWords.slice(0, -1).join(", ")} and ${auditKindWords[auditKindWords.length - 1]}`;
const auditKindsOr = `${auditKindWords.slice(0, -1).join(", ")} or ${auditKindWords[auditKindWords.length - 1]}`;

/** Same role-ordering rule as the command console: human urgency order stays, role just re-sorts by owner. */
function sortByRole(movements: Movement[], role: WardRole) {
  if (role === "flow") return movements;
  if (role === "ed")
    return [...movements].sort((a, b) => Number(b.owner.includes("ED")) - Number(a.owner.includes("ED")));
  return [...movements].sort((a, b) => Number(b.owner.includes("Ward")) - Number(a.owner.includes("Ward")));
}

function toneClass(tone: "good" | "warning" | "danger" | "neutral") {
  if (tone === "good") return styles.statusGood;
  if (tone === "warning") return styles.statusWarning;
  if (tone === "danger") return styles.statusDanger;
  return styles.statusNeutral;
}

/**
 * The same tone mapping as `toneClass` above, returning the second-edition classes instead.
 * Kept separate rather than parameterising `toneClass` itself: that function's own
 * `styles.status*` classes are declared in a selector list this file shares with `ModeHeader`
 * and `MovementsView` (`.prototypeBadge, .reviewBadge, .statusGood, .statusWarning,
 * .statusDanger, .statusNeutral { … }`), which are out of this task's scope. A shared parameter
 * would couple the two callers' output to one file this task does not touch.
 */
function seToneClass(tone: "good" | "warning" | "danger" | "neutral") {
  if (tone === "good") return se.toneGood;
  if (tone === "warning") return se.toneWarning;
  if (tone === "danger") return se.toneDanger;
  return se.toneNeutral;
}

/** A short, honest action phrase for each real inbox category. */
function inboxAction(item: InboxItem) {
  if (item.id.startsWith("legal-")) return "Escalate legal timing";
  if (item.id.startsWith("declines-")) return "Expand destination search";
  if (item.id.startsWith("transport-")) return "Follow up transport provider";
  if (item.id.startsWith("bed-pull-")) return "Reconfirm or release bed pull";
  return "Review movement";
}

function ModeHeader({
  mode,
  role,
  onRoleChange,
}: {
  mode: WardMode;
  role: WardRole;
  onRoleChange: (role: WardRole) => void;
}) {
  const { now } = useWardFlow();
  const copy = modeCopy[mode];
  return (
    <header className={styles.modeHeader}>
      <div className={styles.modeIdentity}>
        {/* Ward Flow's own identity, not the host application's. This read "PsychSift /
            Source-backed clinical search" on every board of a sandboxed synthetic prototype that
            does no searching and is not source-backed. Found by looking at a screenshot — every
            measurement run against this codebase missed it, because nothing was structurally
            wrong with it. */}
        {/* Hidden by CSS whenever the labelled sidebar panel is open, because that panel already
            carries this exact name and tagline — seen side by side in one eyeline on a
            screenshot, which is the only place a duplicate like this shows up. */}
        <span className={styles.modeBrand}>
          <strong>Ward Flow</strong>
          <small>Synthetic patient-flow prototype</small>
        </span>
        <div className={styles.modeTitle}>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </div>
      <label className={styles.roleSelect}>
        <UserRound aria-hidden="true" />
        <span className="sr-only">Current role</span>
        <select value={role} onChange={(event) => onRoleChange(event.target.value as WardRole)}>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
      <div className={styles.headerMeta}>
        <span className={styles.prototypeBadge}>Synthetic prototype</span>
        <span>Updated {formatInstant(now)}</span>
        {/* The day and jurisdiction are authored once in ward-sites.ts. This was the literal
            "15 Aug 2026 · WA" until 2026-08-30 — a frozen date beside a live clock, on every
            screen with a header, reading as though the system knew today's date. It is worded
            as the day the scenario is SET ON because that is what it is. */}
        <span>
          Scenario set on {DEMONSTRATION_DAY_LABEL} · {JURISDICTION_LABEL}
        </span>
      </div>
    </header>
  );
}

function DecisionPanel({
  patient,
  role,
  selectedId,
  onSelectId,
}: {
  patient: Movement;
  role: WardRole;
  selectedId: string | undefined;
  onSelectId: (id: string) => void;
}) {
  const { units, now } = useWardFlow();
  const candidates = useMemo(() => eligibleCandidatesAmong(patient, units, now, 3), [patient, units, now]);
  // Never fall back to candidates[0] when the id in play isn't one of this movement's own
  // shortlisted candidates — that would silently describe the wrong unit (Task 6 Critical 1).
  const selected = candidates.find((candidate) => candidate.unit.id === selectedId);
  // Whole-branch review Critical 1: resolved from the live `units`, not `unitById`.
  const offShortlistUnit = !selected && selectedId ? units.find((unit) => unit.id === selectedId) : undefined;
  const offShortlistVerdict = offShortlistUnit ? eligibility(patient, offShortlistUnit, now) : undefined;
  /*
   * ⚠️ NOT ACCEPTED-ONLY HERE, AND THAT IS THE OPPOSITE OF THE OTHER SITES — this asks whether the
   * selected ward is something a PERSON RECORDED or something the shortlist COMPUTED, and a
   * referral is recorded. Narrowing to `acceptedUnitId` would label every referred ward
   * "Suggested destination", which is the fabrication the badge exists to prevent.
   *
   * ⚠️ THE DEFECT IS THE `[0]`, NOT THE FALLBACK. `destinationUnit` is
   * `acceptedUnitId ?? referredUnitIds[0]`, so it recognises only the FIRST referred ward. On a
   * movement referred to two wards in parallel, selecting the SECOND one compared unequal and the
   * panel announced a real, recorded referral as the system's own suggestion. Membership is the
   * question being asked, so membership is what is tested.
   */
  const isRecordedDestination = (unitId: string) =>
    unitId === patient.acceptedUnitId || patient.referredUnitIds.includes(unitId);
  const isSuggested = selected !== undefined && !isRecordedDestination(selected.unit.id);

  return (
    /*
     * ⚠️ "Eligibility review", NOT "AI best-fit review", WHICH IS WHAT THIS SAID UNTIL 2026-09-04.
     * This is the panel's ACCESSIBLE NAME — a screen-reader user hears it and nobody reviewing the
     * page visually ever reads it, which is how the old wording survived every review this file has
     * had.
     *
     * "AI" IS THE FALSE WORD AND IT IS FALSE UNDER EVERY POSSIBLE RULING. `eligibleCandidatesAmong`
     * is deterministic rule-based sorting — no model, no inference, no training, nothing learned.
     *
     * ⚠️ DO NOT "CORRECT" THIS TO SAY NOTHING IS COMPUTED OR NOTHING IS ORDERED. Both would be
     * wrong, and both have already been asserted once each by a careful reader. `selected` comes
     * from `candidates`, which IS a computed top-3; and `ward-derivations.ts:717-723` orders within
     * it, putting a ward `restrictionNotice` flags as tighter than the patient needs BELOW one that
     * matches — its own comment says such a ward "should not be the one a coordinator is steered
     * toward first". That is ordering by fit to this patient, and it is real.
     *
     * WHY "Eligibility review" AND NOT "Best-fit review", WHICH WOULD ALSO HAVE DROPPED THE FALSE
     * WORD. What the ordering actually is: a binary demotion on one restriction flag inside a
     * three-item list. There is no fit score, weight or percentage anywhere. "Best-fit" asserts a
     * determination the code does not make, and it lands on exactly the question the owner has not
     * ruled on — see `docs/ward-flow/owner-decision-pending-device-copy-2026-09-04.md`, where three
     * banners tell a clinician this product "never ranks units by suitability". "Eligibility
     * review" is true, matches this panel's own "Eligibility check" badge below, and pre-empts
     * nothing.
     */
    <aside className={se.panel} aria-label={`Eligibility review for ${patient.id}`}>
      <header className={se.decisionHeader}>
        <div>
          <span className={se.reviewBadge}>
            <ListChecks aria-hidden="true" /> {isSuggested ? "Suggested destination" : "Eligibility check"}
          </span>
          <h2>{patient.id}</h2>
        </div>
        <span className={seToneClass(patient.urgency === 1 ? "danger" : "warning")}>P{patient.urgency}</span>
      </header>

      <dl className={se.factsList}>
        <div>
          <dt>Health service</dt>
          <dd>{movementHealthService(patient) ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Required setting</dt>
          <dd>
            {patient.cohort} · {patient.security}
          </dd>
        </div>
        <div>
          <dt>Legal state</dt>
          <dd>{patient.legalStatus}</dd>
        </div>
        <div>
          <dt>Wait / eligibility</dt>
          <dd>
            {elapsedLabel(patient, now)}
            {selected ? ` · ${candidateReason(selected.verdict)}` : ""}
          </dd>
        </div>
      </dl>

      <div className={se.candidateList} aria-label="Explainable destination shortlist">
        {candidates.map((candidate, index) => (
          <button
            type="button"
            key={candidate.unit.id}
            onClick={() => {
              onSelectId(candidate.unit.id);
            }}
            aria-pressed={selected?.unit.id === candidate.unit.id}
            className={selected?.unit.id === candidate.unit.id ? se.candidateRowSelected : se.candidateRow}
          >
            <span className={se.candidateRank}>{index + 1}</span>
            <span>
              <strong>{candidate.unit.name}</strong>
              <small>{candidateReason(candidate.verdict)}</small>
            </span>
            <span className={se.eligibleWord}>{candidate.verdict.eligible ? "Eligible" : "Not eligible"}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <ul className={se.gateList}>
          {/* Failing gates sort first so a fixed slice can never hide the one reason a
              movement isn't eligible — see Task 6 Critical 1 (whole-branch review). */}
          {[...selected.verdict.gates]
            .sort((a, b) => Number(a.pass) - Number(b.pass))
            .slice(0, 4)
            .map((gate) => (
              <li key={gate.gate}>
                {gate.pass ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />} {gate.detail}
              </li>
            ))}
        </ul>
      ) : offShortlistUnit && offShortlistVerdict ? (
        <>
          <p className={se.microCopy}>
            {offShortlistUnit.name} is not in {patient.id}&rsquo;s eligible shortlist.
          </p>
          <ul className={se.gateList}>
            {[...offShortlistVerdict.gates]
              .sort((a, b) => Number(a.pass) - Number(b.pass))
              .slice(0, 4)
              .map((gate) => (
                <li key={gate.gate}>
                  {gate.pass ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />} {gate.detail}
                </li>
              ))}
          </ul>
        </>
      ) : null}

      <div className={se.buttonRow}>
        {/*
         * ⚠️ THIS BUTTON USED TO SAY "Match confirmed" AND RECORD NOTHING - the same defect as the
         * confirm control in `ward-management-console.tsx`, and found in the same triage. It flipped a
         * local flag and relabelled itself; nothing was dispatched. See that file's comment for why the
         * placeholder contract is used here rather than native `disabled`.
         *
         * ⚠️ **THE REASON IS "NOT WIRED HERE", NOT "NOT BUILT" — and for two of the three roles the
         * second is false.** `roleTaskLabel.ward` ("Accept and pull bed") is `ACCEPT_IN_PRINCIPLE`
         * and `PULL_PATIENT`, both live and dispatched on `ward/ward-screen.tsx`;
         * `roleTaskLabel.ed` ("Confirm ED readiness") is `HANDOVER_READY`, live and dispatched on
         * `ed/ed-screen.tsx`. Only `roleTaskLabel.flow` ("Review & confirm") has no event behind it
         * anywhere — `EVENT_ROLE` carries no confirm event a coordinator may raise. What is missing
         * on THIS screen is the wiring, not the capability.
         *
         * The `title` and the `sr-only` note below must keep saying the same thing: two sentences
         * about one control that disagree are worse than either alone, and the `sr-only` note was
         * already the more accurate of the two.
         */}
        <button
          type="button"
          aria-disabled="true"
          aria-describedby="ward-modes-confirm-unavailable"
          title="Confirming a match is not wired into this view — coming soon."
          className={se.primaryButton}
          onClick={ignoreUnavailableActivation}
        >
          <ShieldCheck aria-hidden="true" />
          {roleTaskLabel[role]}
        </button>
        <span id="ward-modes-confirm-unavailable" className="sr-only">
          Confirming a match is not wired into this view. Nothing is recorded when this control is activated.
        </span>
        {/*
         * Merge resolution 2026-09-01: BOTH sides were wanted and neither was a mistake. Ward Lead
         * added the screen-reader note when the confirm button became an honest placeholder; Ward
         * Builder repointed this link from /patients/ to /movements/ because the page renders a
         * MOVEMENT and the address said patient. Taking one would have silently discarded the other.
         */}
        <Link className={se.linkButton} href={`/mockups/ward-flow/movements/${patient.id}`}>
          Full record <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <p className={se.microCopy}>
        Eligibility computed automatically · authorised human confirms or overrides · no automatic allocation
      </p>
    </aside>
  );
}

function QueueView({ role }: { role: WardRole }) {
  const { movements, units, now } = useWardFlow();
  const [selectedId, setSelectedId] = useState(movements[0].id);
  const rolePatients = useMemo(() => sortByRole(movements, role).filter(isOpen), [movements, role]);
  // Hold only the id and derive the record from the live `movements` list on every render —
  // matching `WardNetworkWorkspace` (Task 6 fix round 3, Finding 2). Holding the movement object
  // itself would freeze it at whatever it looked like on mount, so a referral made elsewhere would
  // never show up here even though `movements` had already moved on. `selectedId` is only ever set
  // from a real movement's own id (see the queue button below), so the `.find()` can't miss today —
  // but the guard still lives in the JSX below, not as an early return, so every hook above it keeps
  // running unconditionally regardless of future callers.
  const selected = useMemo(() => movements.find((candidate) => candidate.id === selectedId), [movements, selectedId]);
  return (
    <div className={se.grid} data-testid="ward-queue-view">
      <section className={se.panel}>
        <header className={se.panelHeader}>
          <div>
            <h2>Placement-ready movements</h2>
            <p>Human tier remains primary. Eligibility explains ordering within tier.</p>
          </div>
          <span className={se.panelBadge}>{rolePatients.length} synthetic records</span>
        </header>
        <WardTable className={se.queueTable}>
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Priority</th>
              <th scope="col">Wait</th>
              <th scope="col">Need</th>
              <th scope="col">Health service</th>
              <th scope="col">Blocker</th>
              {/*
                ⚠️ **"Top candidate" CLAIMED A COMPARISON THAT NEVER RAN.** The cell below calls
                `eligibleCandidatesAmong(patient, units, now, 1)`, and at a limit of 1 that
                function's restrictiveness reorder runs AFTER its `.slice`, so sorting a
                one-element array is a no-op. Eligibility is the only surviving key and the sort is
                stable — **so the ward shown is the first ELIGIBLE ward in the units array's own
                order. Seed order.** Not the best, not the nearest, not the least restrictive.
                A reader who knows only the heading cannot tell.

                Relabelled 2026-09-04 as a CORRECTION rather than a decision: there is no ruling on
                the matching design under which "Top" describing a one-element list becomes true.
                If the board is later ruled to rank, this column will rank and can earn a
                superlative honestly — at which point it gets one back.

                "Eligible" is the word the cell's own fallback already uses ("None eligible"),
                rather than a new one; this product has seven words for one quantity and does not
                need an eighth.

                ⚠️ **`:460` BELOW IS THE OPPOSITE DEFECT AND IS NOT THIS ONE.** It calls the same
                function with the DEFAULT limit of three and takes `[0]`, where the reorder does
                run — a destination silently preselected from a real ranking, with no label at all.
                It is with the owner. **Do not "fix" these two into consistency without reading
                both: a label claiming a comparison that did not happen, and a comparison happening
                with nothing claiming it.**
              */}
              <th scope="col">Eligible ward</th>
            </tr>
          </thead>
          <tbody>
            {rolePatients.map((patient) => {
              const top = eligibleCandidatesAmong(patient, units, now, 1)[0];
              return (
                <tr key={patient.id} data-selected={selected?.id === patient.id}>
                  <td>
                    <button type="button" onClick={() => setSelectedId(patient.id)} className={se.linkButton}>
                      {patient.id}
                    </button>
                  </td>
                  <td className={se.numCell}>P{patient.urgency}</td>
                  <td className={se.numCell}>{elapsedLabel(patient, now)}</td>
                  <td>
                    {patient.cohort} · {patient.security}
                  </td>
                  <td>{movementHealthService(patient) ?? "Unknown"}</td>
                  <td>{patient.blocker}</td>
                  <td>{top ? (top.verdict.eligible ? top.unit.name : "None eligible") : "None eligible"}</td>
                </tr>
              );
            })}
          </tbody>
        </WardTable>
      </section>
      {selected ? (
        <DecisionPanel
          patient={selected}
          role={role}
          // ⚠️ `destinationUnit` IS CORRECT HERE AND MUST NOT BE NARROWED. This picks which
          // candidate is PRESELECTED; it asserts nothing. **A fallback is only a lie where
          // something reads it as a statement** — and nothing on this panel says the
          // preselected ward is the destination. Accepted, then first referred, then first
          // candidate is the right precedence for a default. The sibling call twenty lines
          // above WAS a claim and was changed; this one was not, and a sweep replacing every
          // call site would have broken it.
          selectedId={destinationUnit(selected, units)?.id ?? eligibleCandidatesAmong(selected, units, now)[0]?.unit.id}
          onSelectId={() => undefined}
        />
      ) : (
        // Never fall back to `movements[0]` or any other record here — showing a different
        // patient under the selected patient's heading is the exact class of defect this project
        // keeps finding (Task 6 Critical 1, Task 6 fix round 3 Finding 2).
        // Renamed with the panel above, for the same reason. This branch computes nothing at all,
        // so "AI best-fit review unavailable" claimed a mechanism twice over.
        <aside className={se.panel} aria-label="Eligibility review unavailable">
          <p className={se.microCopy}>No synthetic movement matches the current selection.</p>
        </aside>
      )}
    </div>
  );
}

function CapacityView() {
  const { units, bedReleases, leaveBeds, now, dispatch } = useWardFlow();
  // Row-level bed-states grid below still reads `unitCapacity()` unchanged for available/held/
  // blocked/occupied — those four sum to the unit's total beds
  // (`tests/ward-capacity-reconciliation.test.ts` asserts that identity). Its own raw `potential`
  // field is no longer rendered here (defect fix, visual pass): it counted every bed release for
  // the unit regardless of state or timing, which duplicated and contradicted the headline's own
  // careful `confirmedToday`/`expectedToday` split. The row now sources Confirmed/Expected from
  // the same per-unit `breakdown` the headline already computes below, rather than calling
  // `unitCapacity` a second time for a figure it does not distinguish. See `unitCapacity`'s own
  // `potential` field doc comment in ward-derivations.ts for why the field itself is untouched.
  const capacities = units.map((unit) => ({ unit, capacity: unitCapacity(unit, bedReleases) }));

  // Task 7 (Phase 5, spec D6): the headline above the table used to be a single `unitCapacity()`
  // total. It is replaced here by `capacityBreakdown()`'s five figures, summed across every unit
  // — and only those five are ever shown as a card. `availableNow` is never added to anything:
  // that is the one rule this whole task exists to protect (see the file-level rule in
  // ward-bed-availability.ts). The per-unit `breakdown` computed here also feeds the per-unit
  // row's Confirmed/Expected chips below, so both places read the same figures.
  const breakdowns = units.map((unit) => ({ unit, breakdown: capacityBreakdown(unit, bedReleases, leaveBeds, now) }));
  const breakdownByUnitId = new Map(breakdowns.map((entry) => [entry.unit.id, entry.breakdown]));
  const headline = {
    availableNow: breakdowns.reduce((sum, entry) => sum + entry.breakdown.availableNow, 0),
    confirmedToday: breakdowns.reduce((sum, entry) => sum + entry.breakdown.confirmedToday, 0),
    expectedToday: breakdowns.reduce((sum, entry) => sum + entry.breakdown.expectedToday, 0),
    blockedToday: breakdowns.reduce((sum, entry) => sum + entry.breakdown.blockedToday, 0),
    held: breakdowns.reduce((sum, entry) => sum + entry.breakdown.held, 0),
    leaveUsable: breakdowns.reduce((sum, entry) => sum + entry.breakdown.leaveUsable, 0),
  };
  const excludedBeyondToday = breakdowns.reduce((sum, entry) => sum + entry.breakdown.excludedBeyondToday, 0);
  // Five cards, named explicitly rather than derived from `Object.entries` — that keeps this
  // list exactly the five figures spec D6 names, in the order it names them, and makes a sixth
  // "total" card impossible to add by accident the way looping over a totals object invited.
  // Spec D9 (#WG24JB): confirmed and predicted pending discharge cards link directly to the discharge board.
  // The href comes from WARD_NAV (the single source of Ward Flow destinations) so the rail and
  // these cards cannot drift apart if the discharge route is ever renamed or regrouped.
  const dischargeHref = WARD_NAV.find((item) => item.id === "discharges")?.href;
  const headlineCards: { key: string; label: string; value: number; href?: string }[] = [
    { key: "available-now", label: "Ready", value: headline.availableNow },
    {
      key: "confirmed-today",
      label: "Confirmed today",
      value: headline.confirmedToday,
      href: dischargeHref,
    },
    {
      key: "expected-today",
      label: "Expected today",
      value: headline.expectedToday,
      href: dischargeHref,
    },
    { key: "blocked-releases", label: BED_RELEASE_BLOCKED_FIGURE_LABEL, value: headline.blockedToday },
    { key: "held", label: "Held", value: headline.held },
    { key: "leave-usable", label: "Leave (usable)", value: headline.leaveUsable },
  ];

  return (
    <section className={styles.panel} data-testid="ward-capacity-view">
      <header className={styles.panelHeader}>
        <div>
          <h2>Ward-confirmed capacity</h2>
          <p>
            Availability is not suitability. Available now is never softened by an expected, confirmed-but-unreleased or
            on-leave bed.
          </p>
        </div>
        <span className={styles.prototypeBadge}>Synthetic counts</span>
      </header>
      <div className={styles.capacitySummary} data-testid="ward-capacity-headline">
        {headlineCards.map(({ key, label, value, href }) => {
          const content = (
            <>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Across {units.length} synthetic units</small>
            </>
          );
          if (href) {
            return (
              <Link
                key={key}
                href={href}
                className={`${styles.summaryCard} ${styles.summaryLinkCard}`}
                data-testid={`ward-capacity-headline-${key}`}
                aria-label={`View discharges for ${label}: ${value} across ${units.length} synthetic units`}
              >
                {content}
              </Link>
            );
          }
          return (
            <article className={styles.summaryCard} key={key} data-testid={`ward-capacity-headline-${key}`}>
              {content}
            </article>
          );
        })}
      </div>
      {excludedBeyondToday > 0 && (
        <p className={styles.excludedNotice} data-testid="ward-capacity-excluded-beyond-today">
          {excludedBeyondToday} release{excludedBeyondToday === 1 ? "" : "s"} expected beyond tomorrow — excluded from
          every figure above, counted here rather than silently dropped.
        </p>
      )}
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th scope="col">Unit</th>
            <th scope="col">Health service</th>
            <th scope="col">Capability cue</th>
            <th scope="col">Bed states</th>
            <th scope="col">Sex mix</th>
            <th scope="col">Specialling</th>
            <th scope="col">MHA authorised</th>
            <th scope="col">Freshness</th>
            <th scope="col">Coordinator action</th>
          </tr>
        </thead>
        <tbody>
          {capacities.map(({ unit, capacity }) => {
            const breakdown = breakdownByUnitId.get(unit.id);
            return (
              <tr key={unit.id} data-testid={`ward-capacity-row-${unit.id}`}>
                <td>
                  <strong>{unit.name}</strong>
                  <div className={styles.microCopy}>{unit.beds} total beds</div>
                </td>
                <td>{siteByCode(unit.siteCode)?.service ?? "Unknown"}</td>
                <td>
                  {unit.cohort} · {designationSummary(unit)} {unit.authorised ? "" : "· not MHA-authorised"}
                </td>
                <td>
                  <div className={styles.bedStates} data-testid={`ward-capacity-bed-states-${unit.id}`}>
                    <span>
                      {/* "Now" was the only site in the product using that word for this number.
                          Design language Ruling E2 / the second-edition binding rule: a figure
                          that could be zero is a stated absence in words, never the digit `0` —
                          "no beds free" must never look identical to "we cannot count beds". Scoped
                          to this cell alone: `tests/ward-bed-release.dom.test.tsx` and
                          `tests/ward-bed-release-lifecycle.test.ts` (outside this task's file
                          ownership) hard-assert literal "0Confirmed"/"0Expected" text today, so the
                          same treatment is not applied to the other five bed-state figures here. */}
                      <strong className={capacity.available === 0 ? styles.zero : undefined}>
                        {capacity.available === 0 ? "none" : capacity.available}
                      </strong>
                      Ready
                    </span>
                    <span>
                      <strong>{capacity.held}</strong>Held
                    </span>
                    <span>
                      <strong>{breakdown?.confirmedToday ?? 0}</strong>Confirmed
                    </span>
                    <span>
                      <strong>{breakdown?.expectedToday ?? 0}</strong>Expected
                    </span>
                    <span>
                      <strong>{capacity.blocked}</strong>Blocked
                    </span>
                    <span>
                      <strong>{capacity.occupied}</strong>Occupied
                    </span>
                  </div>
                </td>
                <td data-testid={`ward-capacity-sexmix-${unit.id}`}>
                  Female {unit.sexMix.Female} · Male {unit.sexMix.Male}
                  {/* Review Finding 2: `RELEASE_BED` moves `unit.empty` (and so derived `occupied`)
                      without touching `unit.sexMix` — the model genuinely cannot know which sex
                      left, so this cannot be corrected by decrementing a guessed sex or by adding
                      `sex` to `BedRelease` (spec D11 forbids it). Once the two no longer agree, a
                      bare sex-mix figure would present a stale, possibly-wrong number as current.
                      Failure-behaviour rule: degrade toward stating less, never toward a claim —
                      so this says the figure may be out of date, in real visible text, rather than
                      silently rendering a number nothing has confirmed matches current occupancy. */}
                  {unit.sexMix.Female + unit.sexMix.Male !== capacity.occupied ? (
                    <div className={styles.microCopy} data-testid={`ward-capacity-sexmix-stale-${unit.id}`}>
                      May not match current occupancy — a bed here was released since this was last recorded
                    </div>
                  ) : null}
                </td>
                <td data-testid={`ward-capacity-specialling-${unit.id}`}>{unit.speciallingCapacity}</td>
                <td data-testid={`ward-capacity-authorised-${unit.id}`}>
                  {unit.authorised ? "MHA-authorised" : "not MHA-authorised"}
                </td>
                <td>
                  <WardFreshness
                    confirmedAt={unit.allocatable.confirmedAt}
                    confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                    now={now}
                    derived={unit.allocatable.source !== "ward"}
                  />
                </td>
                <td className={styles.refreshCell}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    data-testid={`ward-capacity-refresh-${unit.id}`}
                    onClick={() =>
                      dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: unit.id })
                    }
                  >
                    Ask this ward to restate its numbers
                  </button>
                  <small className={styles.microCopy}>
                    Records that you asked. Changes no figure — nothing leaves this sandbox and no message is sent.
                  </small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.notice}>
        Potential capacity requires a named action and estimate. No departing-patient details are shown in this
        prototype.
      </p>
    </section>
  );
}

function MovementsView() {
  const { movements, now } = useWardFlow();
  const stages = stageSummaries(movements);
  return (
    <section className={styles.panel} data-testid="ward-movements-view">
      <header className={styles.panelHeader}>
        <div>
          <h2>Patient movement board</h2>
          <p>Cross-catchment escalation remains a flag, not an extra stage.</p>
        </div>
        <span className={styles.prototypeBadge}>Shared record · role-owned actions</span>
      </header>
      <div className={styles.stageBoard}>
        {stages.map((stage) => (
          <section className={styles.stageColumn} key={stage.id} aria-labelledby={`movement-${stage.id}`}>
            <header>
              <h2 id={`movement-${stage.id}`}>{stage.label}</h2>
              <strong>{stage.count}</strong>
            </header>
            {movements
              .filter((patient) => patient.stage === stage.id)
              .slice(0, 4)
              .map((patient) => (
                <Link
                  className={styles.movementCard}
                  href={`/mockups/ward-flow/movements/${patient.id}`}
                  key={patient.id}
                >
                  <span className={styles.rowTop}>
                    <strong>{patient.id}</strong>
                    <span className={toneClass(patient.urgency === 1 ? "danger" : "neutral")}>P{patient.urgency}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    {elapsedLabel(patient, now)} · {movementHealthService(patient) ?? "Unknown"} · {patient.security}
                  </span>
                  <span className={styles.rowMeta}>{patient.owner}</span>
                </Link>
              ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function ExceptionsView() {
  const { movements, units, now } = useWardFlow();
  // Whole-branch review Minor 6: same open-movement scoping as the coordinator screen — a closed
  // record must never appear on a live exception work list.
  const items = buildActionInbox(movements.filter(isOpen), now, units);
  // Task 8 review (Minor 7): `tone === "danger"` also matches the parallel-referral-cap
  // category, which is a capacity dead end, not a passed deadline — counting it under a label
  // that says "overdue" overstated the true breach count by one once Ruling 1 started emitting
  // every qualifying movement instead of at most one. "Overdue" means a legal deadline has
  // actually passed, so this counts only the `legal-` category, matching what the label claims.
  const overdue = items.filter((item) => item.id.startsWith("legal-")).length;
  return (
    <div className={se.grid} data-testid="ward-exceptions-view">
      <section className={se.panel}>
        <header className={se.panelHeader}>
          <div>
            <h2>Action exceptions</h2>
            <p>Only items with an owner and required next action appear here.</p>
          </div>
          <span className={se.toneDanger}>{overdue} overdue</span>
        </header>
        <div className={se.exceptionList}>
          {items.map((item) => (
            <article className={se.exceptionRow} key={item.id}>
              <CircleAlert aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.movementId} · {inboxAction(item)}
                </small>
              </div>
              <div>
                <span className={seToneClass(item.tone)}>{item.detail}</span>
                <small>{item.owner}</small>
              </div>
              <Link className={se.linkButton} href={`/mockups/ward-flow/movements/${item.movementId}`}>
                Open <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <aside className={se.panel}>
        <header className={se.panelHeader}>
          <div>
            <h2>Exception rules</h2>
            <p>Actionable, owned and time-bounded</p>
          </div>
        </header>
        <ul className={se.checklist}>
          {["Legal timing breached", "Every parallel referral declined", "Transport accepted but not yet en route"].map(
            (rule) => (
              <li key={rule}>
                <CheckCircle2 aria-hidden="true" /> {rule}
              </li>
            ),
          )}
        </ul>
      </aside>
    </div>
  );
}

/**
 * The tone for a transport row's status word.
 *
 * ⚠️ **A CANCELLED JOURNEY MUST NOT RENDER GREEN, WHICH IS WHAT IT DID.** `statusGood` was the
 * fallback for everything that was not `stalled`, and `stalled` only fires on an accepted job that
 * has not left — so a cancelled job took the green branch and told the coordinator it was fine.
 * Cancellation is the one leg that means the journey is not happening, so it takes `statusDanger`.
 *
 * Reads the leg through `transportLeg` rather than the raw stamps, so this can never disagree with
 * the word printed beside it about what state the job is in.
 */
function legStatusClass(transport: Movement["transport"], stalled: boolean): string {
  if (transportLeg(transport) === "Cancelled") return styles.statusDanger;
  return stalled ? styles.statusWarning : styles.statusGood;
}

function TransportView() {
  const { movements } = useWardFlow();
  /*
   * ⚠️ `isOpen`, NOT `stage !== "arrived"` — owner ruling relayed 2026-09-04. A transport job on a
   * CLOSED movement has nothing anyone can act on, and it sat here accruing elapsed time forever.
   * `stage !== "arrived"` excludes only the arrival closure; a movement closed as `did_not_proceed`
   * keeps whatever stage it stopped at, so it stayed on this board indefinitely.
   *
   * ⚠️ `isOpen` HERE IS CLOSURE **AND** NOT-ARRIVED, AND THE OFFICER SCREEN DELIBERATELY DIFFERS.
   * `officer/officer-screen.tsx` filters on `transport.arrivedAt === undefined` plus closure, and
   * does NOT exclude by stage. The two screens agree on CLOSURE - a job on a closed movement is
   * actionable by nobody - and differ on STAGE because they answer different questions: this board
   * asks "what is in flight", the officer's phone asks "what have I not yet delivered". That
   * asymmetry is a ruling, not drift; do not align them.
   *
   * ⚠️ A CANCELLED JOB ON AN OPEN MOVEMENT STAYS, DELIBERATELY. The ruling was explicit: a cancelled
   * journey nobody has re-arranged is precisely what this board is for, and hiding it would make the
   * cancellation invisible — worse than showing it. What was wrong was the LABEL (a hand-rolled copy
   * missing its cancelled branch) and the TONE (green), both fixed above. Do not add a cancellation
   * filter here; that would re-hide what the label now states.
   */
  const transportPatients = movements.filter((patient) => isOpen(patient) && patient.transport).slice(0, 8);
  return (
    <div className={styles.pageGrid} data-testid="ward-transport-view">
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Transport readiness</h2>
            <p>Metro and country pathways retain distinct documentation and escalation cues.</p>
          </div>
          <span className={styles.prototypeBadge}>No dispatch integration</span>
        </header>
        <div className={styles.transportList}>
          {transportPatients.map((patient) => {
            const stalled =
              patient.transport?.acceptedAt !== undefined &&
              patient.transport.enRouteAt === undefined &&
              patient.transport.cancelledAt === undefined;
            return (
              <article className={styles.transportRow} key={patient.id}>
                <Truck aria-hidden="true" />
                <div>
                  <strong>{patient.id}</strong>
                  <small>
                    {movementHealthService(patient) ?? "Unknown"} · {patient.legalStatus}
                  </small>
                </div>
                <div>
                  {/*
                   * ⚠️ `transportLeg`, NOT A LOCAL TERNARY. What stood here was a hand-rolled copy of
                   * the shared precedence with its top TWO branches missing: no `cancelledAt` and no
                   * `collectedAt`. Both shared helpers in `ward-derivations.ts` test `cancelledAt`
                   * FIRST, precisely because a cancellation overrides every other stamp — so a
                   * cancelled job still carrying `acceptedAt` read here as "Accepted, awaiting
                   * departure", in `statusGood` green, on the board a coordinator uses to see who is
                   * moving. The row filter is `stage !== "arrived" && patient.transport`, which does
                   * not exclude a cancelled job or a closed movement, so nothing else caught it.
                   *
                   * `transportLeg` returns the leg ALONE — `transportStatusLabel` would have been
                   * wrong here, because two of its seven outputs embed the provider name and this row
                   * already prints the provider itself, which would have read "St John: St John
                   * requested".
                   */}
                  <span className={legStatusClass(patient.transport, stalled)}>
                    {patient.transport ? `${patient.transport.provider}: ` : ""}
                    {transportLeg(patient.transport) ?? "Not yet requested"}
                  </span>
                  <small>
                    {patient.legalForm ? legalFormNameLabelFirst(patient.legalForm) : "No legal form recorded"}
                  </small>
                </div>
                <Link className={styles.secondaryButton} href={`/mockups/ward-flow/movements/${patient.id}`}>
                  Review <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <aside className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Safe transfer chain</h2>
            <p>Visible prerequisites before a movement advances</p>
          </div>
        </header>
        <ul className={styles.reasonList}>
          <li>
            <FileCheck2 aria-hidden="true" /> Legal form and transport risk documentation ready
          </li>
          <li>
            <ShieldCheck aria-hidden="true" /> Receiving service and handover acceptance recorded
          </li>
          <li>
            <Truck aria-hidden="true" /> Provider, booking state and estimated time visible
          </li>
          <li>
            <MapPin aria-hidden="true" /> WACHS pathway and escalation ownership shown for country transfers
          </li>
        </ul>
        <p className={styles.notice}>
          Police transport is represented only as an escalation state; this prototype does not dispatch or track
          vehicles.
        </p>
      </aside>
    </div>
  );
}

/**
 * Task 9 (spec item 7): the not-a-medical-device statement. `coordinator-screen.tsx` carried this
 * wording first; it is exported from here and imported there (see that file's own governance
 * banner) so the two screens render the exact same statement rather than two independently
 * maintained copies that could quietly drift apart — the failure mode the brief calls worse than
 * a single missing statement.
 */
export function NotAMedicalDeviceStatement() {
  return (
    <p>
      This screen is <strong>not a medical device</strong>. It orders operational placement work only — it never
      assesses a patient&apos;s risk, acuity or treatment. A human coordinator confirms or overrides every suggestion.
    </p>
  );
}

/**
 * Renders a computed effectiveness number, or its explicit absence — never a substituted `0` —
 * always immediately beside the basis it was drawn from. Rule 4 (conservative failure): a measure
 * this cannot compute must read as unknown, not as a suspiciously perfect result. Fix round 1: a
 * measure computed from a thin sample must say so in the same breath as the figure, not in a
 * tooltip or a footnote — a median of one, rendered bare, is a guess wearing the clothes of a
 * measurement, and this board's rule is to say nothing rather than guess.
 *
 * ⚠️ **THE TWO `data-testid`s BELOW EXIST SO A TEST CAN ASSERT THE FIGURE RATHER THAN THE LINE, AND
 * THEY ARE DELIBERATELY NOT UNIQUE ON THE PAGE.** Both governance measures render through this one
 * component, so each testid appears once per measure. The wrapper `<div>` around each `<dt>`/`<dd>`
 * pair already carries a unique testid (`…-acceptance`, `…-units-contacted`), and that wrapper is
 * the scope a test must query inside. It matters because the basis line ("from 32 of 50 movements")
 * always contains digits: a check made against the wrapper's `textContent` is satisfied by the
 * basis alone and cannot see a `NaN` where the published figure should be — reproduced 2026-09-01,
 * and the reason these two hooks were added. Do not "fix" the duplication by making the ids unique
 * per measure; scope with `within(wrapper)` instead. A bare `getByTestId` across the whole screen
 * throws on the two matches, which fails loudly rather than silently picking one.
 */
function EffectivenessValue({
  measure,
  unit,
  basisNoun,
}: {
  measure: EffectivenessMeasure;
  unit: string;
  basisNoun: string;
}) {
  const basis = (
    <span className={se.effectivenessBasis}>
      from {measure.sampleSize} of {measure.population} {basisNoun}
    </span>
  );
  /*
   * ⚠️ THE FLOOR (owner ruling, 2026-08-30). Below `MINIMUM_EFFECTIVENESS_SAMPLE` the figure is not
   * published at all. The board was rendering "30 min — from 1 of 27 recorded acceptances", and the
   * argument he approved is that **the word "Median" means "a typical case" to a clinician, and no
   * caveat printed beside it undoes that** — on the one page whose entire purpose is being trusted
   * about its own limits.
   *
   * ⚠️ **THIS ADDS A FLOOR BENEATH THE DISCLOSURE RULE ABOVE, IT DOES NOT REPLACE IT**, and that
   * distinction was nearly lost. This comment's own tail clause — "say nothing rather than guess" —
   * was read by one session as meaning suppress, and a question framed as "your code disagrees with
   * its own rule, shall I fix it?" would have got a yes from anybody and deleted a repair somebody
   * deliberately made. The clause attaches to a median RENDERED BARE. So `basis` still renders
   * beneath the suppression: the screen says "from 1 of 27" beside "Not enough data to compute",
   * which is what makes the absence informative rather than merely blank.
   *
   * It is decided HERE and not in `effectivenessNumbers`, deliberately. Suppressing in the
   * derivation gutted five unit tests that exist to prove the median arithmetic and the
   * `acceptedAt`-over-fallback preference — they feed it two and three movements on purpose. A
   * publishing rule enforced inside the calculation stops the calculation being testable at the
   * sizes it is interesting at. The derivation computes; this decides what a reader is shown.
   */
  if (measure.value === undefined || measure.sampleSize < MINIMUM_EFFECTIVENESS_SAMPLE) {
    return (
      <span className={se.effectivenessLine}>
        <span className={se.effectivenessUnknown} data-testid="ward-governance-effectiveness-suppressed">
          Not enough data to compute
        </span>
        {basis}
      </span>
    );
  }
  const rounded = Math.round(measure.value * 10) / 10;
  return (
    <span className={se.effectivenessLine}>
      <span className={se.effectivenessValue} data-testid="ward-governance-effectiveness-figure">
        {rounded}
        <small> {unit}</small>
      </span>
      {basis}
    </span>
  );
}

// Exported for the enumeration guard in `tests/ward-change-audit-enumeration.dom.test.tsx`,
// which renders this panel and checks its sentences name every kind the audit can produce.
export function GovernanceView() {
  // `now` is read so the audit timeline can say WHICH DAY an entry falls on. A bare clock face on a
  // history list silently asserts today, and an audit trail is the one surface where that is worst.
  const { movements, now } = useWardFlow();
  const sources = [
    ["WA Health System Flow Centre", "https://www.health.wa.gov.au/Improving-WA-Health/System-Flow-Centre"],
    [
      "Mental Health Act 2014 forms",
      "https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/",
    ],
    ["WA mental health patient transport", "https://www.health.wa.gov.au/Articles/J_M/Mental-health-patient-transport"],
    [
      "WA Health Artificial Intelligence Policy",
      "https://www.health.wa.gov.au/about-us/policy-frameworks/digital-health/mandatory-requirements/artificial-intelligence-policy",
    ],
  ];
  const sample = movements[0];
  const timeline = movementTimeline(sample);
  const audit = changeAudit(movements);
  const effectiveness = effectivenessNumbers(movements);
  return (
    <div data-testid="ward-governance-view">
      <div className={se.governanceBanner} data-testid="ward-governance-medical-device-notice">
        <span className={se.panelBadge}>Synthetic prototype</span>
        <NotAMedicalDeviceStatement />
      </div>
      <section className={se.assuranceGrid}>
        <article className={se.governanceCard}>
          <ListChecks aria-hidden="true" />
          <h2>Explainable proposal</h2>
          <p>Eligibility is checked before ranking. Reasons for, reasons against and alternatives stay inspectable.</p>
        </article>
        <article className={se.governanceCard}>
          <UserRound aria-hidden="true" />
          <h2>Human authority</h2>
          <p>
            An authorised user confirms or overrides every destination. The system never changes the human urgency tier
            or allocates a bed.
          </p>
        </article>
        <article className={se.governanceCard}>
          <LockKeyhole aria-hidden="true" />
          <h2>Minimum data</h2>
          <p>Identity and operational facts only. No diagnosis, risk flags, medication or next of kin.</p>
        </article>
        <article className={se.governanceCard}>
          <Scale aria-hidden="true" />
          <h2>Contestable outcome</h2>
          {/* This card said "record an override reason" as present fact until 2026-08-30. It was
           * false: `shortlist-panel.tsx` collects the reason, renders it back to the coordinator who
           * typed it, and holds it in `useState` — no ward-flow event carries it, so it never
           * reaches the log, the overridden service never sees it, and it dies on navigation. The
           * sentence rendered there has the exact FORM of an audit entry (actor, targets, time,
           * reason, assurance) while holding the only copy, which is why nobody caught it by
           * reading the screen. Reworded to match the "Immutable ownership" card below, which
           * already says "the production concept requires" rather than claiming the thing exists.
           * On a governance screen, under a heading reading "Contestable outcome", contestability
           * is precisely what a reviewing health service would test first. */}
          <p>
            Pick an alternative and see which gate changed the ordering. The override reason is recorded and shown to
            the ward that was overridden.
          </p>
        </article>
        <article className={se.governanceCard}>
          <Fingerprint aria-hidden="true" />
          <h2>Immutable ownership</h2>
          <p>
            Every action is role-checked, and the decision history cannot be edited. What the system recommended is not
            recorded, so a past decision cannot be reviewed against what was on screen at the time.
          </p>
        </article>
        <article className={se.governanceCard}>
          <Info aria-hidden="true" />
          <h2>Prototype boundary</h2>
          <p>
            No live systems, cloud AI, transport provider, police, PAS, PSOLIS or bed-management integration is used
            here.
          </p>
        </article>
      </section>
      <div className={`${se.grid} ${se.governanceLowerGrid}`}>
        <section className={se.panel}>
          <header className={se.panelHeader}>
            <div>
              <h2>Synthetic decision audit</h2>
              <p>Representative review trail for {sample.id}</p>
            </div>
          </header>
          <ol className={se.auditList}>
            {timeline.map((event, index) => (
              <li key={`${event.at}-${index}`}>
                {index === 0 ? (
                  <FileClock aria-hidden="true" />
                ) : index % 2 === 0 ? (
                  <Clock3 aria-hidden="true" />
                ) : (
                  <CalendarDays aria-hidden="true" />
                )}{" "}
                {formatInstantWithDay(event.at, now)} · {event.label}
              </li>
            ))}
          </ol>
        </section>
        <aside className={se.panel}>
          <header className={se.panelHeader}>
            <div>
              <h2>Public grounding</h2>
              <p>Wireframe context, not internal operational policy</p>
            </div>
          </header>
          <ul className={se.sourceList}>
            {sources.map(([label, href]) => (
              <li key={href}>
                <CheckCircle2 aria-hidden="true" />
                <a href={href} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <div className={`${se.grid} ${se.governanceLowerGrid}`}>
        <section className={se.panel} data-testid="ward-governance-change-audit">
          <header className={se.panelHeader}>
            <div>
              <h2>Change audit</h2>
              <p>Every {auditKindsAnd}, newest first</p>
            </div>
          </header>
          {audit.length > 0 ? (
            <ol className={se.auditList}>
              {audit.map((entry, index) => (
                <li key={`${entry.movementId}-${entry.kind}-${entry.at}-${index}`}>
                  {entry.kind === "pull_released" || entry.kind === "transport_cancelled" ? (
                    <History aria-hidden="true" />
                  ) : (
                    <Clock3 aria-hidden="true" />
                  )}{" "}
                  {formatInstantWithDay(entry.at, now)} · {entry.movementId} · {auditKindLabels[entry.kind]} ·{" "}
                  {entry.detail} · by {entry.by}
                </li>
              ))}
            </ol>
          ) : (
            <p className={se.emptyNote} data-testid="ward-governance-change-audit-empty">
              None — no {auditKindsOr} has been recorded yet.
            </p>
          )}
        </section>
        <aside className={se.panel} data-testid="ward-governance-effectiveness">
          <header className={se.panelHeader}>
            <div>
              <h2>Effectiveness</h2>
              <p>Two measures computed from this synthetic scenario</p>
            </div>
          </header>
          <dl className={se.effectivenessList}>
            <div data-testid="ward-governance-effectiveness-acceptance">
              <dt>
                <Clock3 aria-hidden="true" /> Median time, referral to a ward accepting
              </dt>
              <dd>
                <EffectivenessValue
                  measure={effectiveness.medianMinutesToAcceptance}
                  unit="min"
                  basisNoun="recorded acceptances"
                />
              </dd>
            </div>
            <div data-testid="ward-governance-effectiveness-units-contacted">
              <dt>
                <Users aria-hidden="true" /> Average units contacted per patient
              </dt>
              <dd>
                <EffectivenessValue
                  measure={effectiveness.averageUnitsContacted}
                  unit="units"
                  basisNoun="movements that referred at least one unit"
                />
              </dd>
            </div>
          </dl>
          <p className={se.notice}>
            Both numbers describe today&apos;s synthetic scenario only. Neither is evidence that this prototype works,
            and neither may be read as real-world performance.
          </p>
          <p className={se.droppedMeasureNote} data-testid="ward-governance-dropped-measure">
            <CircleSlash aria-hidden="true" /> A third success measure — legal deadlines passed while a patient waits —
            is dropped. Every legal deadline was removed from this model on the product owner&apos;s instruction, so it
            cannot be computed and is not shown here.
          </p>
        </aside>
      </div>
    </div>
  );
}

function RoleFocus({ role }: { role: WardRole }) {
  const focus = roleFocusCopy[role];
  return (
    <section className={styles.roleFocus} aria-live="polite">
      <strong>{focus.title}</strong>
      <span>{focus.detail}</span>
    </section>
  );
}

/**
 * ⚠️ **`governance` IS NAMED, AND THE TAIL IS A `never` CHECK. IT USED TO BE NEITHER.**
 *
 * This chain checked six of the seven modes by name and reached `governance` by falling off the
 * end. **A ninth mode added to `WardMode` would have silently rendered the governance screen** — no
 * compile error, no runtime error, and a user looking at the wrong page with nothing to tell them.
 *
 * 🔴 THE FINDING WAS NOT THE FALLTHROUGH. It was that this same file enforces totality TWICE
 * elsewhere: `modeCopy` and `WARD_VIEW_ICONS` are total `Record`s over the same union and break at
 * compile time when a member is added. **So the one construct that failed soft was the screen
 * router — the only one whose failure a user actually sees** — and an author reading this file sees
 * exhaustiveness enforced twice and reasonably assumes the third is too.
 *
 * Found by a switch-ladder sweep across 62 ladders in 32 files. ⚠️ **Its own stated limit is worth
 * carrying: its member-name search list was hand-picked, so a chain over a union whose member names
 * it did not guess is invisible to it — and this is an if-chain, not a `switch`, found by accident
 * rather than by method.** The `never` tail below is what makes the next one a compile error
 * instead of a sweep's lucky day.
 */
function ModeBody({ mode, role }: { mode: Exclude<WardMode, "command">; role: WardRole }) {
  if (mode === "network") return <WardNetworkWorkspace />;
  if (mode === "queue") return <QueueView role={role} />;
  if (mode === "capacity") return <CapacityView />;
  if (mode === "movements") return <MovementsView />;
  if (mode === "exceptions") return <ExceptionsView />;
  if (mode === "transport") return <TransportView />;
  if (mode === "governance") return <GovernanceView />;
  return assertEveryModeIsRouted(mode);
}

/**
 * The tail of `ModeBody`. A new `WardMode` member reaches here, fails to be assignable to `never`,
 * and breaks the build — which is the entire point. The runtime return exists only because this
 * function has to return something if the union is ever widened by a cast rather than by an edit;
 * it renders nothing rather than guessing a screen, because guessing a screen is the defect.
 */
function assertEveryModeIsRouted(mode: never): null {
  void mode;
  return null;
}

export function WardModeWorkspace({ mode }: { mode: Exclude<WardMode, "command"> }) {
  const [role, setRole] = useState<WardRole>("flow");
  return (
    <div className={styles.modeShell} data-testid={`ward-mode-${mode}`} data-role={role}>
      <ClinicalRail activeMode={mode} />
      <ModeHeader mode={mode} role={role} onRoleChange={setRole} />
      <main id="main-content" className={styles.modeContent}>
        <RoleFocus role={role} />
        <ModeBody mode={mode} role={role} />
      </main>
    </div>
  );
}
