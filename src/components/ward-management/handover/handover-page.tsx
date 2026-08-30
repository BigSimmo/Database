"use client";

import { useMemo } from "react";
import Link from "next/link";

import { formatInstant, splitDuration, formatSheetMoment } from "@/components/ward-management/ward-clock";
import {
  destinationUnit,
  elapsedLabel,
  handoverSnapshot,
  stageCopy,
  type HandoverSnapshot,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";

import styles from "./handover.module.css";

/**
 * Task 4 (spec item 1): the shift handover — four fixed sections, in this exact
 * product-owner-approved order, on their own page.
 *
 * THIS PAGE READS LIVE (owner decision OD-4, 2026-08-30). It froze its figures at mount until
 * that day, and the reversal has a reason worth keeping, because reversing a protection needs one.
 *
 * **What the freeze was protecting was real:** people in a handover must be discussing the same
 * numbers, and a screen that changed under them mid-sentence would be worse than no handover.
 * **What retired it is that paper already holds still.** Printing is what produces the stable
 * artefact, and it does so honestly, with a time on it — while a frozen screen beside a live
 * printed sheet is two numbers for one thing in one room, which is the failure this programme has
 * refused everywhere else. The owner's words when he asked for it: "There is no point of a stale
 * handover."
 *
 * So the snapshot is recomputed on every render from the live clock, `snapshot.takenAt` moves with
 * it, and the header states the moment in full — date as well as time — because a printed sheet
 * outlives the day it was taken on and a bare clock face on paper cannot say which day it means.
 *
 * This completes the pattern begun by WB-DB-11, which dropped the morning page's frozen view
 * earlier the same day. Both screens now behave the same way, which was the point.
 *
 * Every section renders an explicit "None" line when it has nothing to show — never a hidden
 * or skipped section. An absence is a fact worth handing over too.
 */
export function HandoverPage() {
  const { movements, units, now, dayZero } = useWardFlow();

  // Live. `useMemo` is a render-cost saving only — it recomputes whenever the clock or the data
  // moves, which is exactly what a `useState` initialiser refused to do and is why the freeze was
  // built out of one. Do not reintroduce a mount-only read here without reopening OD-4.
  const snapshot = useMemo(() => handoverSnapshot(movements, units, now), [movements, units, now]);

  return (
    <div className={styles.screen} data-testid="ward-handover-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-handover-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This handover is <strong>not a medical device</strong>. It is an operational summary that reads live and
            never assesses a patient&apos;s risk, acuity or treatment. It changes as the ward changes, so print it if
            you need a copy that holds still — the printed sheet carries the moment it was taken.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Shift handover</h1>
          <p className={styles.takenAt} data-testid="ward-handover-taken-at">
            Taken at {formatSheetMoment(snapshot.takenAt, dayZero)}
          </p>
          <button type="button" className={styles.printButton} onClick={() => window.print()}>
            Print
          </button>
        </header>

        <LongestWaitsSection snapshot={snapshot} />
        <HeldBedsSection snapshot={snapshot} />
        <InTransitSection snapshot={snapshot} units={units} />
        <PlacementGoneWrongSection snapshot={snapshot} />

        <p className={styles.crossLink}>
          This handover answers &quot;what do I need to hand over this shift?&quot; For &quot;what can I fill right now,
          across the network?&quot;, see the <Link href="/mockups/ward-flow/morning">morning bed state</Link>.
        </p>
      </main>
    </div>
  );
}

export function LongestWaitsSection({ snapshot }: { snapshot: HandoverSnapshot }) {
  return (
    <section className={styles.section} data-testid="ward-handover-longest-waits">
      <h2 className={styles.sectionHeading}>Longest waits</h2>
      {snapshot.longestWaits.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-longest-waits-empty">
          None — no open movement.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Movement</th>
              <th scope="col">Wait</th>
              <th scope="col">Stage</th>
              <th scope="col">Department</th>
              <th scope="col">Destination</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.longestWaits.map((entry, index) => (
              <tr key={entry.movement.id}>
                <td>{index + 1}</td>
                <td>{entry.movement.id}</td>
                <td>{elapsedLabel(entry.movement, snapshot.takenAt)}</td>
                <td>{stageCopy[entry.movement.stage].label}</td>
                <td>{departmentLabel(entry.movement)}</td>
                <td>{entry.unit?.name ?? "No destination chosen"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function HeldBedsSection({ snapshot }: { snapshot: HandoverSnapshot }) {
  return (
    <section className={styles.section} data-testid="ward-handover-held-beds">
      <h2 className={styles.sectionHeading}>Beds held</h2>
      {snapshot.heldBeds.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-held-beds-empty">
          None — no bed is currently held.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">Unit</th>
              <th scope="col">Hold</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.heldBeds.map((entry) => (
              <tr key={entry.movement.id}>
                <td>{entry.movement.id}</td>
                <td>{entry.unit?.name ?? "No unit recorded"}</td>
                <td>{holdLabel(entry.movement, entry.expired, snapshot.takenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function InTransitSection({ snapshot, units }: { snapshot: HandoverSnapshot; units: Unit[] }) {
  return (
    <section className={styles.section} data-testid="ward-handover-in-transit">
      <h2 className={styles.sectionHeading}>In transit</h2>
      {snapshot.inTransit.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-in-transit-empty">
          None — no movement currently has a transport job.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">Unit</th>
              <th scope="col">Leg</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.inTransit.map((entry) => {
              const unit = destinationUnit(entry.movement, units);
              return (
                <tr key={entry.movement.id}>
                  <td>{entry.movement.id}</td>
                  <td>{unit?.name ?? "No destination unit recorded"}</td>
                  <td>{entry.leg ?? "No transport leg recorded"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function PlacementGoneWrongSection({ snapshot }: { snapshot: HandoverSnapshot }) {
  return (
    <section className={styles.section} data-testid="ward-handover-placement-gone-wrong">
      <h2 className={styles.sectionHeading}>Placement gone wrong</h2>
      {snapshot.placementGoneWrong.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-handover-placement-gone-wrong-empty">
          None — nothing has escalated and nothing has been declined by every unit it was referred to.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col">Wait</th>
              <th scope="col">What happened</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.placementGoneWrong.map((entry) => (
              <tr key={entry.movement.id}>
                <td>{entry.movement.id}</td>
                <td>{elapsedLabel(entry.movement, snapshot.takenAt)}</td>
                <td>{goneWrongLabel(entry.movement, entry.kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Mirrors `officer-screen.tsx`'s own origin-department fallback exactly — a raw id is a real
 * fact about the record, never a fabricated substitute for one. */
function departmentLabel(movement: Movement) {
  const originEd = edById(movement.originEdId);
  return originEd
    ? `${originEd.name} (${originEd.siteCode})`
    : `No synthetic department matches "${movement.originEdId}"`;
}

/** "Expired" or "Expires in …" per spec — never `formatRemaining`'s "overdue"/"left" wording,
 * which this page must not use: a held bed lapsing is an operational fact, not a countdown
 * against a deadline this prototype is entitled to name. */
function holdLabel(movement: Movement, expired: boolean, takenAt: number) {
  const bedHeldUntil = movement.bedHeldUntil;
  if (bedHeldUntil === undefined) return "No hold time recorded";
  if (expired) return "Expired";
  return `Expires in ${splitDuration(bedHeldUntil - takenAt)}`;
}

/** Names exactly what the record holds — a recorded escalation, or a decline from every unit
 * this movement was ever referred to — and nothing the Mental Health Act does or does not
 * require. */
function goneWrongLabel(movement: Movement, kind: "escalated" | "declined_by_all") {
  if (kind === "escalated") {
    const contact = movement.escalation?.contact;
    return contact ? `Escalated — ${contact}` : "Escalated";
  }
  return `All ${movement.declines.length} referred unit${movement.declines.length === 1 ? "" : "s"} declined`;
}
