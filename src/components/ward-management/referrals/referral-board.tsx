"use client";

import { useState } from "react";
import Link from "next/link";

import { formatInstant, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Referral } from "@/components/ward-management/ward-model";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import {
  recentlyDecidedReferrals,
  referralQueueOrder,
  referralWaitLabel,
} from "@/components/ward-management/ward-referrals";

import { ReferralMatchView } from "./referral-match";
import styles from "./referrals.module.css";

/**
 * Urgency tier text carries its own direction, mirroring `priority-queue.tsx`'s
 * `TIER_QUALIFIER` exactly — a bare "Tier 1" badge on a board where every tier appears tells a
 * coordinator nothing about which end of the scale that is.
 */
const TIER_QUALIFIER: Record<Referral["urgency"], string> = {
  1: "most urgent",
  2: "urgent",
  3: "least urgent",
};

function decidedWaitLabel(referral: Referral): string {
  if (referral.decidedAt === undefined) return "No decision time recorded";
  return `${splitDuration(Math.max(0, referral.decidedAt - referral.raisedAt))} before decision`;
}

function outcomeLabel(referral: Referral): string {
  if (referral.state === "accepted") return "Accepted";
  if (referral.state === "declined") return "Declined";
  return "Queued";
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
 * LIVE, like `EscalationBoardPage` and `DischargeBoard`, never `HandoverPage`'s frozen snapshot:
 * reads `useWardFlow()` fresh on every render, so an ACCEPT_REFERRAL/DECLINE_REFERRAL dispatched
 * from the match view immediately moves that referral from "queued" to "recently decided" here.
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
        <h1 className="sr-only">Referral board</h1>

        <div className={styles.governanceBanner} data-testid="ward-referral-board-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This board is <strong>not a medical device</strong>. It never allocates, never ranks units by suitability,
            and never suggests which bed is best &mdash; every unit is listed in the network&apos;s own fixed order, and
            a coordinator decides.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Referral board</h2>
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
        <DecidedSection decided={decided} />

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
                    <td>
                      Tier {referral.urgency} · {TIER_QUALIFIER[referral.urgency]}
                    </td>
                    <td className={styles.waitBadge} data-testid={`ward-referral-board-wait-${referral.id}`}>
                      {referralWaitLabel(referral, now)}
                    </td>
                    <td>{referral.ageBand}</td>
                    <td>{referral.sex}</td>
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
                    <span data-tier={referral.urgency}>
                      Tier {referral.urgency} · {TIER_QUALIFIER[referral.urgency]}
                    </span>
                  </span>
                  <span className={styles.waitBadge} data-testid={`ward-referral-board-card-wait-${referral.id}`}>
                    {referralWaitLabel(referral, now)}
                  </span>
                  <span className={styles.cardService}>
                    {referral.ageBand} · {referral.sex} · {referral.homeRegion}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function DecidedSection({ decided }: { decided: Referral[] }) {
  return (
    <section className={styles.section} data-testid="ward-referral-board-decided">
      <h2 className={styles.sectionHeading}>Recently decided ({decided.length})</h2>
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
                  <th scope="col">Waited</th>
                  <th scope="col">Decided</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((referral) => (
                  <tr key={referral.id} data-testid={`ward-referral-board-decided-row-${referral.id}`}>
                    <td>{referral.id}</td>
                    <td>{outcomeLabel(referral)}</td>
                    <td>{decidedWaitLabel(referral)}</td>
                    <td>{referral.decidedAt !== undefined ? formatInstant(referral.decidedAt) : "Not recorded"}</td>
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
                  <p className={styles.cardService}>
                    {decidedWaitLabel(referral)} ·{" "}
                    {referral.decidedAt !== undefined ? formatInstant(referral.decidedAt) : "Not recorded"}
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
