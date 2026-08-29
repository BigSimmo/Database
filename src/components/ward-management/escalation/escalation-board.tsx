"use client";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  elapsedLabel,
  escalationBoard,
  stageCopy,
  type EscalationBoard,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Movement } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";

import styles from "./escalation.module.css";

/**
 * Task 5 (spec item 4): the escalation board — one place showing every patient whose placement
 * has gone wrong. Unlike the shift handover (`handover-page.tsx`), this page is deliberately
 * NOT frozen at open: a coordinator working this board wants the live picture — a fresh
 * escalation recorded a minute ago, a ward's confirmed capacity that just changed the
 * `nowhereEligible` count — so `escalationBoard` is called fresh on every render against
 * `useWardFlow()`'s live `movements`/`units`/`now`, with no `useState` freeze. Nothing here
 * mutates anything; both sections are read-only.
 *
 * THE HARDEST RULE IN THIS TASK: THE BOARD RECORDS AND SHOWS. IT SUGGESTS NOTHING (spec D4). No
 * "least-bad options", no ranking of wards the patient does not fit, no statement of what would
 * need to change. `escalationBoard` itself already enforces this in its own derivation — see
 * that function's doc comment in `ward-derivations.ts` — so nothing in this component may
 * compute a near-miss, a "closest" ward, or any suggestion of its own.
 */
export function EscalationBoardPage() {
  const { movements, units, now } = useWardFlow();
  const board = escalationBoard(movements, units, now);

  return (
    <div className={styles.screen} data-testid="ward-escalation-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-escalation-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This board is <strong>not a medical device</strong>. It records and shows what has already happened — a
            recorded escalation, or a movement with nowhere eligible right now — and nothing more. It never ranks a ward
            the patient does not fit, and it never states what would need to change for one to work.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Escalation board</h1>
          <p className={styles.pageSubtitle}>Every patient whose placement has gone wrong, right now.</p>
        </header>

        <EscalatedSection board={board} now={now} />
        <NowhereEligibleSection board={board} now={now} />
      </main>
    </div>
  );
}

export function EscalatedSection({ board, now }: { board: EscalationBoard; now: Instant }) {
  return (
    <section className={styles.section} data-testid="ward-escalation-escalated">
      <h2 className={styles.sectionHeading}>Escalated</h2>
      {board.escalated.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-escalation-escalated-empty">
          None — no open movement carries a recorded escalation.
        </p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Movement</th>
                <th scope="col">When</th>
                <th scope="col">Units tried</th>
                <th scope="col">Contact</th>
                <th scope="col">Wait</th>
              </tr>
            </thead>
            <tbody>
              {board.escalated.map((entry) => (
                <tr key={entry.movement.id}>
                  <td>{entry.movement.id}</td>
                  <td>
                    {entry.movement.escalation
                      ? formatInstantWithDay(entry.movement.escalation.at, now)
                      : "No time recorded"}
                  </td>
                  <td>{triedUnitsLabel(entry.triedUnits)}</td>
                  <td>{entry.movement.escalation?.contact ?? "No contact recorded"}</td>
                  <td>{elapsedLabel(entry.movement, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function NowhereEligibleSection({ board, now }: { board: EscalationBoard; now: Instant }) {
  return (
    <section className={styles.section} data-testid="ward-escalation-nowhere-eligible">
      <h2 className={styles.sectionHeading}>Nowhere eligible</h2>
      {board.nowhereEligible.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-escalation-nowhere-eligible-empty">
          None — every open movement has at least one eligible ward right now.
        </p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Movement</th>
                <th scope="col">Wait</th>
                <th scope="col">Stage</th>
                <th scope="col">Department</th>
              </tr>
            </thead>
            <tbody>
              {board.nowhereEligible.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.id}</td>
                  <td>{elapsedLabel(movement, now)}</td>
                  <td>{stageCopy[movement.stage].label}</td>
                  <td>{departmentLabel(movement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Every unit this movement's escalation record names as already tried — a record of what
 * happened, never a live candidate list. Mirrors `shortlist-panel.tsx`'s own decline-row
 * fallback: an id that does not resolve to a real `Unit` renders as an explicit absence, never a
 * substituted default. */
function triedUnitsLabel(triedUnits: { name: string }[]) {
  if (triedUnits.length === 0) return "No units recorded";
  return triedUnits.map((unit) => unit.name).join(", ");
}

/** Mirrors `handover-page.tsx`'s own origin-department fallback exactly — a raw id is a real
 * fact about the record, never a fabricated substitute for one. */
function departmentLabel(movement: Movement) {
  const originEd = edById(movement.originEdId);
  return originEd
    ? `${originEd.name} (${originEd.siteCode})`
    : `No synthetic department matches "${movement.originEdId}"`;
}
