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
  referralWaitLabel,
  referralPersonFacts,
  referralSexCell,
  acceptedAddressing,
  declinedAddressings,
  referralDecidedAt,
  referralDestinationLabel,
  referralState,
} from "@/components/ward-management/ward-referrals";

import { ReferralMatchView } from "./referral-match";
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
 * What the outcome actually was, beyond the bare word (review finding I3). Before this, a decided
 * row read only "RF-006 | Accepted | 1h before decision | 10:37" — it named no unit, gave no
 * reason, and the ONE screen that carried either (the match view's decided panel) was reachable
 * only in the moment straight after deciding a referral you had selected. A decline reason that
 * cannot be read back makes the fixed reason list — the entire mechanism by which this phase
 * justifies holding no free text — worthless on the board.
 *
 * Describes the record, never the person, and never asserts something the record does not hold:
 * a missing unit or reason reads as "Not recorded", never as a guess or an empty cell.
 */
function outcomeDetail(referral: Referral, units: Unit[]): string {
  const accepted = acceptedAddressing(referral);
  if (accepted) {
    // A ward acceptance names the bed; the other three are answered by a team, so the destination
    // itself is the whole answer and saying "Unit not recorded" there would invent a gap.
    if (accepted.destination.kind !== "psychiatric_ward") {
      return referralDestinationLabel(accepted.destination);
    }
    const unit = units.find((candidate) => candidate.id === accepted.acceptedUnitId);
    return unit ? unit.name : "Unit not recorded";
  }
  const declined = declinedAddressings(referral);
  if (declined.length > 0) {
    // EVERY refusal, not the first. Several destinations can decline while the referral stays
    // live (FD-24), and showing one would hide refusals that were actually given.
    return declined
      .map((addressing) => {
        const reason = addressing.declineReason;
        const label = reason ? (DECLINE_REASON_LABELS[reason] ?? reason) : "Reason not recorded";
        return `${referralDestinationLabel(addressing.destination)}: ${label}`;
      })
      .join(" · ");
  }
  return "Not recorded";
}

/**
 * Task 5 (Phase 7, "The front door", spec D9/D10): the coordinator's referral board — the screen
 * the whole phase exists to produce. Queued referrals first, ordered by urgency tier then by how
 * long each has waited (`referralQueueOrder`, `ward-referrals.ts`); recently decided referrals
 * below that, most recent decision first (`recentlyDecidedReferrals`). "Waiting since" is
 * rendered prominently on every queued row — the queue ranks by urgency, which is right, but
 * length of wait carries the moral weight and is otherwise buried.
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
                      match the cell rather than the cell moving to match the header. */}
                  <th scope="col">Waiting</th>
                  <th scope="col">Age band</th>
                  <th scope="col">Sex</th>
                  <th scope="col">Home region</th>
                </tr>
              </thead>
              <tbody>
                {queued.map((referral) => (
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
                    </td>
                    <td>{urgencyTierLabel(referral.urgency)}</td>
                    <td className={styles.waitBadge} data-testid={`ward-referral-board-wait-${referral.id}`}>
                      {referralWaitLabel(referral, now)}
                    </td>
                    <td>{referral.ageBand}</td>
                    <td>{referralSexCell(referral)}</td>
                    <td>{referral.homeRegion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cardList} data-testid="ward-referral-board-queued-cards">
            {queued.map((referral) => (
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
                    {referralWaitLabel(referral, now)}
                  </span>
                  <span className={styles.cardService}>{referralPersonFacts(referral).join(" · ")}</span>
                </button>
              </li>
            ))}
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
        An acceptance records which unit took this referral, and nothing more. No bed is held, no movement is created,
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
                      {outcomeDetail(referral, units)}
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
                    {outcomeDetail(referral, units)}
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
