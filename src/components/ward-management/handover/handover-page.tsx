"use client";

import { useState } from "react";
import Link from "next/link";

import { formatInstant, splitDuration } from "@/components/ward-management/ward-clock";
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

/** What this page freezes at open: the snapshot itself, plus the `units` array it was built
 * against — `inTransit` entries carry no `unit` of their own (see `HandoverSnapshot`'s own doc
 * comment in `ward-derivations.ts`), so resolving their destination later still needs a frozen
 * `units` reference, never the live one `useWardFlow()` keeps returning on every render. */
type FrozenHandover = { snapshot: HandoverSnapshot; units: Unit[] };

/**
 * Task 4 (spec item 1): the shift handover — four fixed sections, in this exact
 * product-owner-approved order, on their own page.
 *
 * THE FREEZE MUST BE REAL. `handoverSnapshot` is a pure derivation — called again on a later
 * `now` it would happily compute a different answer — so what makes this a *handover* rather
 * than just another live view is that `useWardFlow()` is read once, and the `useState`
 * initialiser below closes over that single read to build the frozen snapshot. A `useState`
 * initialiser runs exactly once, on the first render, and never again on any later re-render —
 * that is the whole mechanism. Nothing else in this component calls `handoverSnapshot` again,
 * and no section below reads `now` from `useWardFlow()` — only `frozen.snapshot.frozenAt`,
 * which cannot change for the lifetime of this mount. A handover that silently changed while a
 * coordinator was reading it would be worse than no handover at all.
 *
 * Every section renders an explicit "None" line when it has nothing to show — never a hidden
 * or skipped section. An absence is a fact worth handing over too.
 */
export function HandoverPage() {
  const { movements, units, now } = useWardFlow();

  const [frozen] = useState<FrozenHandover>(() => ({
    snapshot: handoverSnapshot(movements, units, now),
    units,
  }));

  const { snapshot } = frozen;

  return (
    <div className={styles.screen} data-testid="ward-handover-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <div className={styles.governanceBanner} data-testid="ward-handover-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This handover is <strong>not a medical device</strong>. It is a point-in-time operational summary, frozen
            the moment it was opened — it never assesses a patient&apos;s risk, acuity or treatment, and it never
            updates itself while you are reading it.
          </p>
        </div>

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Shift handover</h1>
          <p className={styles.frozenAt} data-testid="ward-handover-frozen-at">
            Frozen at {formatInstant(snapshot.frozenAt)}
          </p>
          <button type="button" className={styles.printButton} onClick={() => window.print()}>
            Print
          </button>
        </header>

        <LongestWaitsSection snapshot={snapshot} />
        <HeldBedsSection snapshot={snapshot} />
        <InTransitSection snapshot={snapshot} units={frozen.units} />
        <PlacementGoneWrongSection snapshot={snapshot} />

        <p className={styles.crossLink}>
          This handover answers &quot;what do I need to hand over this shift?&quot; For &quot;what can I fill right
          now, across the network?&quot;, see the <Link href="/mockups/ward-flow/morning">morning bed state</Link>.
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
                <td>{elapsedLabel(entry.movement, snapshot.frozenAt)}</td>
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
                <td>{holdLabel(entry.movement, entry.expired, snapshot.frozenAt)}</td>
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
                <td>{elapsedLabel(entry.movement, snapshot.frozenAt)}</td>
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
function holdLabel(movement: Movement, expired: boolean, frozenAt: number) {
  const bedHeldUntil = movement.bedHeldUntil;
  if (bedHeldUntil === undefined) return "No hold time recorded";
  if (expired) return "Expired";
  return `Expires in ${splitDuration(bedHeldUntil - frozenAt)}`;
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
