"use client";

import { useState } from "react";
import Link from "next/link";

import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  DECLINE_REASON_LABELS,
  recentlyDecidedReferrals,
  referralQueueOrder,
  referralPersonFacts,
  referralSexCell,
  acceptedAddressing,
  cancelledAddressings,
  declinedAddressings,
  referralAddressingStateLabel,
  referralDecidedAt,
  referralDestinationLabel,
  referralState,
} from "@/components/ward-management/ward-referrals";

import { ReferralMatchView } from "./referral-match";
import { referralWaitLine } from "./referral-wait";
import styles from "./referrals.module.css";

/*
 * Urgency tier text carries its own direction — a bare "Tier 1" badge on a board where every
 * tier appears tells a coordinator nothing about which end of the scale that is. This file used
 * to hold its own copy of the wording, described in its comment as mirroring
 * `priority-queue.tsx` "exactly"; both copies are now `urgencyTierLabel` (`ward-priority.ts`),
 * so the claim is enforced by there being one spelling rather than by two files agreeing.
 */

function decidedWaitLabel(referral: Referral): string {
  const decidedAt = referralDecidedAt(referral);
  if (decidedAt === undefined) return "No decision time recorded";
  return `${splitDuration(Math.max(0, decidedAt - referral.raisedAt))} before decision`;
}

function outcomeLabel(referral: Referral): string {
  const state = referralState(referral);
  if (state === "accepted") return "Accepted";
  if (state === "declined") return "Declined";
  return "Queued";
}

/**
 * Every refusal recorded against this referral, one entry each, as "<destination>: <reason>".
 *
 * EVERY refusal, not the first. Several destinations can decline while the referral stays live
 * (FD-24), and showing one would hide refusals that were actually given.
 *
 * A refusal the record holds with no reason reads "Reason not recorded" rather than trailing off
 * after the colon: the record says a destination refused and does not say why, and the cell says
 * exactly that rather than inventing a reason or implying none was ever asked for.
 */
function refusalLines(referral: Referral): string[] {
  return declinedAddressings(referral).map((addressing) => {
    const reason = addressing.declineReason;
    const label = reason ? (DECLINE_REASON_LABELS[reason] ?? reason) : "Reason not recorded";
    return `${referralDestinationLabel(addressing.destination)}: ${label}`;
  });
}

/**
 * Every destination CANCELLED by this referral's own acceptance elsewhere (FD-22), one entry
 * each, as "<destination>: <state sentence>" — the same shape as `refusalLines` above, so the two
 * lists read as siblings rather than as two different conventions.
 *
 * Owner ruling, 2026-09-01: "'Refused' and 'cancelled because somewhere else said yes' are shown
 * differently... Nobody refused that patient and the record must not imply anyone did." The
 * sentence itself comes from `referralAddressingStateLabel` (`ward-referrals.ts`) — the one home
 * for that wording — never respelled here, which is exactly what keeps a cancelled destination
 * from ever being read as this service's own refusal.
 */
function cancelledLines(referral: Referral): string[] {
  return cancelledAddressings(referral).map(
    (addressing) => `${referralDestinationLabel(addressing.destination)}: ${referralAddressingStateLabel(addressing)}`,
  );
}

/**
 * What the outcome actually was, beyond the bare word (review finding I3). Before this, a decided
 * row read only "RF-006 | Accepted | 1h before decision | 10:37" — it named no unit, gave no
 * reason, and the ONE screen that carried either (the match view's decided panel) was reachable
 * only in the moment straight after deciding a referral you had selected. A decline reason that
 * cannot be read back makes the fixed reason list — the entire mechanism by which this phase
 * justifies holding no free text — worthless on the board.
 *
 * Describes the record, never the person, and never asserts something the record does not hold:
 * a missing unit or reason reads as "Not recorded", never as a guess or an empty cell.
 *
 * ⚠️ **AN ACCEPTANCE DOES NOT ERASE A REFUSAL.** Owner ruling, 2026-09-01: "keep the refusals
 * visible on the board." This function used to RETURN on the accepted branch and never reach the
 * declined one, so the moment any destination said yes, every refusal recorded against that
 * referral — and the reason the refusing clinician gave — disappeared from the only screen that
 * ever showed them. A ward accepted, and an emergency department's documented refusal was erased.
 * A refusal is a clinical decision with a stated reason, and it does not stop being true because
 * a different ward accepted; it is also the record a coordinator needs when an acceptance later
 * falls through.
 *
 * ⚠️ **THE HALVES ARE RETURNED SEPARATELY, NEVER CONCATENATED.** A coordinator scanning this
 * column must not read a refusal — or a cancellation — as the answer, so `outcome` is what
 * happened, `alsoRefused` is what was actually refused, and `alsoCancelled` is what was closed out
 * automatically by the acceptance itself, each kept visibly apart by `OutcomeDetail` below.
 * `alsoRefused` is empty when nothing has accepted — there the refusals ARE the outcome, and
 * repeating them under a second heading would invent a distinction the record does not make.
 * `alsoCancelled` follows the same rule: a cancellation only ever exists beside an acceptance
 * (FD-22 writes `state: "cancelled"` only inside `ACCEPT_REFERRAL`), so it is never the outcome on
 * its own.
 *
 * ⚠️ **`alsoRefused` AND `alsoCancelled` MUST NEVER MERGE.** Owner ruling, 2026-09-01: a refusal
 * is a service saying no; a cancellation is nobody saying anything, closed out automatically by a
 * different acceptance. Folding a cancelled destination into `alsoRefused` — or wording it so it
 * reads like one — resurrects the exact defect this ruling exists to prevent: a service that never
 * refused this patient appearing to have done so.
 */
type DecidedDetail = {
  /** The outcome itself: the accepting unit, the accepting destination, or — when nothing has
   *  accepted — every refusal. Never empty; "Not recorded" when the record holds neither. */
  outcome: string;
  /** The refusals recorded against a referral that was accepted somewhere else. Empty otherwise. */
  alsoRefused: string[];
  /** The destinations cancelled by this referral's own acceptance elsewhere (FD-22). Empty unless
   *  something has accepted — see `cancelledAddressings`'s own doc comment. */
  alsoCancelled: string[];
};

function outcomeDetail(referral: Referral, units: Unit[]): DecidedDetail {
  const refusals = refusalLines(referral);
  const cancelled = cancelledLines(referral);
  const accepted = acceptedAddressing(referral);
  if (accepted) {
    // A ward acceptance names the bed; the other three are answered by a team, so the destination
    // itself is the whole answer and saying "Unit not recorded" there would invent a gap.
    if (accepted.destination.kind !== "psychiatric_ward") {
      return {
        outcome: referralDestinationLabel(accepted.destination),
        alsoRefused: refusals,
        alsoCancelled: cancelled,
      };
    }
    const unit = units.find((candidate) => candidate.id === accepted.acceptedUnitId);
    return { outcome: unit ? unit.name : "Unit not recorded", alsoRefused: refusals, alsoCancelled: cancelled };
  }
  if (refusals.length > 0) {
    return { outcome: refusals.join(" · "), alsoRefused: [], alsoCancelled: [] };
  }
  return { outcome: "Not recorded", alsoRefused: [], alsoCancelled: [] };
}

/** The words that mark the refusals as NOT the outcome. Spelled once, so the table and the card
 *  cannot drift apart — two components spelling one label separately is the defect class this
 *  phase has already paid for four times. */
const ALSO_REFUSED_LEAD = "Also refused";

/** The words that mark a cancellation as NOT a refusal — the other half of the same discipline
 *  `ALSO_REFUSED_LEAD` holds to, and the reason this is its own constant rather than a reuse of
 *  that one: the two must read as different categories, not as one relabelled. */
const ALSO_CANCELLED_LEAD = "Also cancelled";

/**
 * The word that marks a refusal shown on a STILL-QUEUED referral. `ALSO_REFUSED_LEAD` above is
 * safe with no lead of its own only because the decided section always shows it beside an
 * "Outcome" cell that already reads "Declined" — the neighbouring column supplies the word. A
 * queued referral carries no such column and never will, so without its own lead this text reads
 * as a bare "<destination>: <reason>" with nothing naming it a refusal, and a tired reader can
 * take it either as a routing note about the referral or — worse — as the settled answer, which
 * stops a coordinator from working a referral that is still live and waiting on other
 * destinations. Deliberately NOT `ALSO_REFUSED_LEAD`: nothing else has answered yet, so "also" is
 * false here — this is the only answer given so far, not an addition to one. Spelled once, used
 * by both the table row and the phone card, exactly as `ALSO_REFUSED_LEAD` is.
 */
const QUEUED_REFUSED_LEAD = "Already refused";

/**
 * The detail cell's parts, rendered so a coordinator cannot mistake one for another: the outcome
 * first, at the cell's own weight, then the refusals, then the cancellations, each quieter and led
 * by a word that says what it is. Never joined into one run — "Bunbury adult ward · Emergency
 * department: Belongs to another service" reads as two outcomes, which is the new defect a
 * straight concatenation would have created. The lead word carries the distinction in TEXT, so
 * nothing here depends on the quieter colour being noticed as quieter.
 */
function OutcomeDetail({
  referral,
  units,
  refusalsTestId,
  cancelledTestId,
}: {
  referral: Referral;
  units: Unit[];
  refusalsTestId: string;
  cancelledTestId: string;
}) {
  const detail = outcomeDetail(referral, units);
  return (
    <>
      <span className={styles.outcomeDetailPrimary}>{detail.outcome}</span>
      {detail.alsoRefused.length > 0 ? (
        <span className={styles.outcomeDetailRefusals} data-testid={refusalsTestId}>
          {`${ALSO_REFUSED_LEAD} — ${detail.alsoRefused.join(" · ")}`}
        </span>
      ) : null}
      {detail.alsoCancelled.length > 0 ? (
        <span className={styles.outcomeDetailRefusals} data-testid={cancelledTestId}>
          {`${ALSO_CANCELLED_LEAD} — ${detail.alsoCancelled.join(" · ")}`}
        </span>
      ) : null}
    </>
  );
}

/**
 * Task 5 (Phase 7, "The front door", spec D9/D10): the coordinator's referral board — the screen
 * the whole phase exists to produce. Queued referrals first, ordered by urgency tier then by how
 * long each has waited (`referralQueueOrder`, `ward-referrals.ts`); recently decided referrals
 * below that, most recent decision first (`recentlyDecidedReferrals`). The referral clock is
 * rendered prominently on every queued row — the queue ranks by urgency, which is right, but
 * length of wait carries the moral weight and is otherwise buried.
 *
 * ⚠️ **THAT CLOCK IS `referralWaitLine`, NEVER `referralWaitLabel`** (`./referral-wait.ts`, which
 * carries the reasoning). The label form counts from `raisedAt` to `now` and never stops, so it
 * goes on printing a wait for somebody who was triaged into a department hours ago. `P9-D7` stops
 * the referral clock at triage, and a stopped span is worded as one rather than as a live wait.
 *
 * Selecting a queued referral opens the match view (`ReferralMatchView`) below the board, keyed
 * on the referral's own id so switching selection always starts that view's local state fresh.
 * A decided referral is informational only here — its own match decision already happened, so
 * this board renders no selection control for it.
 *
 * LIVE, like `EscalationBoardPage`, `DischargeBoard` and — since owner decision OD-4 — the shift
 * handover as well: reads `useWardFlow()` fresh on every render, so an
 * ACCEPT_REFERRAL/DECLINE_REFERRAL dispatched from the match view immediately moves that referral
 * from "queued" to "recently decided" here. Every screen in this feature now reads live; there is
 * no frozen one left to contrast against, `HandoverPage` having been the last (`123b0c139`, which
 * recomputes it every render and renames `frozenAt` to `takenAt`).
 *
 * That sentence previously named `HandoverPage`'s frozen snapshot as the counter-example, and had
 * been false since the day that page changed — which is the failure mode worth naming here rather
 * than just correcting. A comment that points at a SIBLING as an example decays when the sibling
 * moves, so nothing in this file can ever fail to catch it, and a reader is not merely misinformed:
 * they are shown a pattern to copy that looks safe because it cites a real precedent. State the
 * property this file has; cite a neighbour only with the commit that fixes what it is being cited for.
 */
export function ReferralBoard() {
  const { referrals, units, now, dispatch, rejections } = useWardFlow();
  const [selectedReferralId, setSelectedReferralId] = useState<string | undefined>(undefined);

  const queued = referralQueueOrder(referrals);
  const decided = recentlyDecidedReferrals(referrals);
  const selectedReferral = selectedReferralId
    ? referrals.find((referral) => referral.id === selectedReferralId)
    : undefined;

  return (
    <div className={styles.screen} data-testid="ward-referral-board-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-referral-board-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This board is <strong>not a medical device</strong>. It never allocates, never ranks units by suitability,
            and never suggests which bed is best &mdash; every unit is listed in the network&apos;s own fixed order, and
            a coordinator decides.
          </p>
        </div>

        <header className={styles.pageHeader}>
          {/*
           * Review finding M6: this screen used to carry an `sr-only` <h1> at the top of <main>
           * AND this visible heading with identical text, so a screen-reader user heard the same
           * phrase twice at two levels. The VISIBLE heading is the <h1> — one heading, seen and
           * heard alike, and the landmark contract (exactly one <h1> per route,
           * `tests/ward-landmarks.test.ts`) is satisfied by the heading a sighted user reads
           * rather than by a duplicate nobody can see.
           */}
          <h1 className={styles.pageTitle}>Referral board</h1>
          <p className={styles.pageSubtitle}>Queued referrals first, then recently decided.</p>
          {/*
           * Task 6. The intake form's ONLY entry point, and deliberately so: it is an action taken
           * from this queue rather than a section of the app, which is the reason recorded against
           * `WARD_REFERRAL_INTAKE_HREF` in `WARD_NAV_INTENTIONALLY_UNLISTED` (ward-nav.ts). A real
           * `<Link>`, never a `router.push` from a click handler — the same rule
           * `ward-role-switcher.tsx` states for its own destinations, and what keeps the
           * destination visible to a middle-click, a hover preview and the reachability scan.
           */}
          <Link className={styles.headerAction} href={WARD_REFERRAL_INTAKE_HREF} data-testid="ward-referral-board-new">
            New referral
          </Link>
        </header>

        <QueuedSection queued={queued} now={now} selectedId={selectedReferralId} onSelect={setSelectedReferralId} />
        <DecidedSection decided={decided} units={units} now={now} />

        {selectedReferral ? (
          <ReferralMatchView
            key={selectedReferral.id}
            referral={selectedReferral}
            units={units}
            now={now}
            dispatch={dispatch}
            rejections={rejections}
          />
        ) : null}
      </main>
    </div>
  );
}

function QueuedSection({
  queued,
  now,
  selectedId,
  onSelect,
}: {
  queued: Referral[];
  now: Instant;
  selectedId: string | undefined;
  onSelect: (referralId: string) => void;
}) {
  return (
    <section className={styles.section} data-testid="ward-referral-board-queued">
      <h2 className={styles.sectionHeading}>Queued ({queued.length})</h2>
      {queued.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-referral-board-queued-empty">
          None — no referral is currently queued.
        </p>
      ) : (
        <>
          <div className={styles.tableScroll} data-testid="ward-referral-board-queued-table">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Referral</th>
                  <th scope="col">Tier</th>
                  {/* M5 note is on the card below. M9: the cell holds an ELAPSED duration
                      ("40m waiting"), not a clock time — "Waiting since" promised "09:10". The
                      elapsed form is the more useful one on a queue, so the header moves to
                      match the cell rather than the cell moving to match the header.
                      ⚠️ 2026-08-30: "Waiting" had itself become the wrong word for half of what
                      this cell can now print. `referralWaitLine` stops the clock at triage
                      (`P9-D7`), so a row may read "3h 30m referral to triage" — a span that ended,
                      under a header asserting somebody is still waiting. The header now names what
                      BOTH forms measure FROM, and each cell says for itself whether it is still
                      running. */}
                  <th scope="col">Since referral</th>
                  <th scope="col">Age band</th>
                  <th scope="col">Sex</th>
                  <th scope="col">Home region</th>
                </tr>
              </thead>
              <tbody>
                {queued.map((referral) => {
                  /*
                   * Owner ruling, 2026-09-01: "a refusal shows on the board as soon as it is
                   * given" — `referralState()` reads "queued" while ANY destination is still
                   * undecided, so a referral two services have already refused sat here showing
                   * NOTHING until the last one answered. `refusalLines()` is reused as-is (never
                   * a second filter, never `cancelledAddressings`): a queued referral can never
                   * hold a `cancelled` destination — that only happens as a side effect of an
                   * acceptance, which makes `referralState()` non-queued — so this stays closed
                   * to the cancelled/refused mix-up the decided section had to guard against.
                   */
                  const refusals = refusalLines(referral);
                  return (
                    <tr
                      key={referral.id}
                      className={referral.id === selectedId ? styles.selectedRow : undefined}
                      data-testid={`ward-referral-board-row-${referral.id}`}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.rowSelectButton}
                          data-testid={`ward-referral-board-select-${referral.id}`}
                          aria-pressed={referral.id === selectedId}
                          onClick={() => onSelect(referral.id)}
                        >
                          {referral.id}
                        </button>
                        {/* Sibling of the button, never inside it: a `<button>` accepts phrasing
                            content only (M5), and this cell's select button carries no test of
                            its own for that yet — the queued card's does. Rendered only when
                            there is a refusal to show, so a referral with no answers yet looks
                            exactly as this cell always has. */}
                        {refusals.length > 0 ? (
                          <span
                            className={styles.outcomeDetailRefusals}
                            data-testid={`ward-referral-board-refusals-${referral.id}`}
                          >
                            {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                          </span>
                        ) : null}
                      </td>
                      <td>{urgencyTierLabel(referral.urgency)}</td>
                      <td className={styles.waitBadge} data-testid={`ward-referral-board-wait-${referral.id}`}>
                        {referralWaitLine(referral, now)}
                      </td>
                      <td>{referral.ageBand}</td>
                      <td>{referralSexCell(referral)}</td>
                      <td>{referral.homeRegion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className={styles.cardList} data-testid="ward-referral-board-queued-cards">
            {queued.map((referral) => {
              const refusals = refusalLines(referral);
              return (
                <li key={referral.id} className={styles.card}>
                  <button
                    type="button"
                    className={referral.id === selectedId ? styles.cardSelectButtonSelected : styles.cardSelectButton}
                    data-testid={`ward-referral-board-card-select-${referral.id}`}
                    aria-pressed={referral.id === selectedId}
                    onClick={() => onSelect(referral.id)}
                  >
                    {/* M5: `<span>`, not `<div>`/`<p>` — a `<button>`'s content model is phrasing
                        content, and no sibling ward screen puts flow content inside one (the
                        discharge board's cards carry no button at all). `.cardTop` already sets
                        `display: flex` and `.cardService` now sets `display: block`, so the layout
                        is identical. */}
                    <span className={styles.cardTop}>
                      <span className={styles.cardUnit}>{referral.id}</span>
                      <span data-tier={referral.urgency}>{urgencyTierLabel(referral.urgency)}</span>
                    </span>
                    <span className={styles.waitBadge} data-testid={`ward-referral-board-card-wait-${referral.id}`}>
                      {referralWaitLine(referral, now)}
                    </span>
                    <span className={styles.cardService}>{referralPersonFacts(referral).join(" · ")}</span>
                  </button>
                  {/* Same ruling as the table row above (owner ruling, 2026-09-01) — rendered as
                      a `<span>`, phrasing content only, and as a SIBLING of the button rather
                      than inside it. Nothing renders here when there is no refusal yet, so the
                      common case — every seeded referral today — looks exactly as it always has. */}
                  {refusals.length > 0 ? (
                    <span
                      className={styles.outcomeDetailRefusals}
                      data-testid={`ward-referral-board-card-refusals-${referral.id}`}
                    >
                      {`${QUEUED_REFUSED_LEAD} — ${refusals.join(" · ")}`}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function DecidedSection({ decided, units, now }: { decided: Referral[]; units: Unit[]; now: Instant }) {
  return (
    <section className={styles.section} data-testid="ward-referral-board-decided">
      <h2 className={styles.sectionHeading}>Recently decided ({decided.length})</h2>
      {/*
       * Spec D14, and the spec's own Risks section: "An accepted referral goes nowhere (D14).
       * Deliberate, and the board must say so rather than implying a handover happened." That
       * sentence was unwritten until review finding I3 — the board showed "Accepted" and nothing
       * else, and a colleague shown the prototype could reasonably conclude a transfer had been
       * arranged. `ACCEPT_REFERRAL` creates no `Movement`, holds no bed and reaches nothing
       * downstream (`ward-flow-reducer.ts`, pinned by `tests/ward-referral-reducer.test.ts`), so
       * the board now says exactly that, in the place the outcome is read.
       */}
      <p className={styles.decidedNote} data-testid="ward-referral-board-decided-note">
        An acceptance records which unit took this referral, and nothing more. No bed is pulled, no movement is created,
        and no transfer is arranged from this board.
      </p>
      {decided.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-referral-board-decided-empty">
          None — no referral has been decided yet.
        </p>
      ) : (
        <>
          <div className={styles.tableScroll} data-testid="ward-referral-board-decided-table">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Referral</th>
                  <th scope="col">Outcome</th>
                  {/* Review finding I3: the accepting unit, or the decline reason — the record's
                      own detail, not merely the word for it. */}
                  <th scope="col">Detail</th>
                  <th scope="col">Waited</th>
                  <th scope="col">Decided</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((referral) => (
                  <tr key={referral.id} data-testid={`ward-referral-board-decided-row-${referral.id}`}>
                    <td>{referral.id}</td>
                    <td>{outcomeLabel(referral)}</td>
                    <td data-testid={`ward-referral-board-decided-detail-${referral.id}`}>
                      <OutcomeDetail
                        referral={referral}
                        units={units}
                        refusalsTestId={`ward-referral-board-decided-refusals-${referral.id}`}
                        cancelledTestId={`ward-referral-board-decided-cancelled-${referral.id}`}
                      />
                    </td>
                    <td>{decidedWaitLabel(referral)}</td>
                    <td>
                      {referralDecidedAt(referral) !== undefined
                        ? formatInstantWithDay(referralDecidedAt(referral)!, now)
                        : "Not recorded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cardList} data-testid="ward-referral-board-decided-cards">
            {decided.map((referral) => (
              <li
                key={referral.id}
                className={styles.card}
                data-testid={`ward-referral-board-decided-card-${referral.id}`}
              >
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <span className={styles.cardUnit}>{referral.id}</span>
                    <span>{outcomeLabel(referral)}</span>
                  </div>
                  {/* `…-decided-detail-card-<id>`, NOT `…-decided-card-detail-<id>`: the phone
                      order test scans `[data-testid^='ward-referral-board-decided-card-']` to
                      find the card elements themselves, so any new id under that prefix silently
                      doubles its result set. It did — this testid was the other way round for one
                      run and turned that test red with 10 matches where 5 were expected. */}
                  <p
                    className={styles.cardDetail}
                    data-testid={`ward-referral-board-decided-detail-card-${referral.id}`}
                  >
                    <OutcomeDetail
                      referral={referral}
                      units={units}
                      refusalsTestId={`ward-referral-board-decided-refusals-card-${referral.id}`}
                      cancelledTestId={`ward-referral-board-decided-cancelled-card-${referral.id}`}
                    />
                  </p>
                  <p className={styles.cardService}>
                    {decidedWaitLabel(referral)} ·{" "}
                    {referralDecidedAt(referral) !== undefined
                      ? formatInstantWithDay(referralDecidedAt(referral)!, now)
                      : "Not recorded"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
