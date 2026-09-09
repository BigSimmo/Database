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
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

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
 * 🔴 WHAT WAS CALLED "THE HARDEST RULE IN THIS TASK" IS WITHDRAWN (owner ruling R-2026-09-04-G).
 *
 * Spec D4 said this board records and shows and SUGGESTS NOTHING — no least-bad options, no
 * ranking of wards the patient does not fit, no near-miss computation. It was never an owner
 * ruling; it was inferred and then enforced. The owner has ruled the opposite: the board is to
 * match patients to beds, with the software never deciding and the final acceptance coming from
 * the users.
 *
 * As it stands this component computes no suggestion of its own, and `escalationBoard` computes
 * none either. That is a description of today's code, not a constraint on tomorrow's — and the
 * matching work is a design that has not been done yet rather than a door that is closed.
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
            recorded escalation, or a movement with nowhere eligible right now. It places nobody: a coordinator decides
            every placement, one at a time, and this board reports what they decided.
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
        <WardTable className={styles.table}>
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
        </WardTable>
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
        <WardTable className={styles.table}>
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
        </WardTable>
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
