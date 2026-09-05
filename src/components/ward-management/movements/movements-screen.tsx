"use client";

import Link from "next/link";

import type { Instant } from "@/components/ward-management/ward-clock";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { isOpen, movementHealthService } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardBar, type WardBarSegment } from "@/components/ward-management/ward-bar";
import type { WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById } from "@/components/ward-management/ward-sites";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import {
  journeyStages,
  totalsReconciliation,
  transportCounts,
  transportLegs,
  type MovementLegState,
  type TransportLegRow,
} from "./movements-derivations";
import styles from "./movements.module.css";

/**
 * MERGE 03 — the patient movement board (`MovementsView`, a stage strip) and the coordinator's live
 * transport tracker (`LiveTracker`) fold into one screen. **They are the same patients at two points
 * of one journey**, and together this screen answers: where is each patient in their move, and what
 * is carrying them?
 *
 * ⚠️ **THE SCREEN COMPUTES NOTHING BEYOND PRESENTATION.** Every group, every leg and every count
 * comes from `journeyStages`, `transportLegs` or `transportCounts` (`movements-derivations.ts`) —
 * this file only reads real fields off the `Movement` each of those hands back (cohort, sex, legal
 * status, owner, origin department) to fill in a row, the same discipline `delays-screen.tsx`
 * follows for its own rows.
 *
 * ⚠️ **`LiveTracker` WAS THE ONLY SURFACE IN THE APP THAT EVER RENDERED THE TRANSPORT FACTS BELOW**
 * (provider, origin department, destination unit, time since the last stamp, the honest count of
 * open movements with no transport leg booked, and the "Review patient" link). All of them are
 * carried onto the transport panel here rather than silently dropped — the design lock names the
 * Delays merge's own 30-of-42 audit as exactly the failure mode this guards against.
 */
export function MovementsScreen() {
  const { movements, units, now } = useWardFlow();

  const stages = journeyStages(movements, now);

  // `transportLegs` takes whichever list the caller passes (the derivation's own comment says so
  // explicitly) — `LiveTracker`, the screen this replaces, scoped itself to OPEN movements only, so
  // this screen keeps that same scope rather than silently widening it to every movement ever
  // booked a vehicle.
  const openMovements = movements.filter(isOpen);
  const legs = transportLegs(openMovements, now);
  const reconciliation = totalsReconciliation(movements);
  const counts = transportCounts(legs);
  const withoutBookedTransport = openMovements.length - legs.length;

  return (
    <div className={styles.screen} data-testid="ward-movements-page">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        {/*
          🔴 **THE SYNTHETIC-DATA DISCLOSURE, ADDED 2026-09-06.** This screen shipped without
          one and showed invented figures under real Perth hospital names with nothing saying
          so. Twenty-four other ward screens carried it; the three that did not were the three
          the 2026-09-05 merges created.

          ⚠️ **IT IS OPT-IN PER SCREEN, WHICH IS WHY THEY MISSED IT.** There is no shared
          component and no layout providing it, so a new screen gets none by default and
          nothing reported the absence. `tests/ward-prototype-disclosure.test.ts` now walks
          every ward ROUTE and requires the tree it renders to disclose somewhere — a route is
          what a reader opens, and a component nothing routes to cannot disclose to anybody.
        */}
        <div className={styles.governanceBanner}>
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            Every patient journey, transport leg and department on this screen is invented. Nobody here is a real
            person, and nothing on it is a clinical record.
          </p>
        </div>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Movements</h1>
          <p className={styles.pageSubtitle}>
            Where each patient&rsquo;s move has got to, and what is carrying them there.
          </p>
        </header>

        <div className={styles.columns}>
          <div className={styles.primary}>
            <WardPanel title="Where each move has got to" count={`${movements.length} moves`}>
              {reconciliation ? <p className={styles.reconciliation}>{reconciliation}</p> : null}
              {stages.map((stage) => (
                <div key={stage.id} className={styles.stageBlock}>
                  {stage.movements.length > 0 ? (
                    <>
                      <WardGroupHeading title={stage.label} people={stage.movements.length} note={stage.blurb} />
                      <WardRecordList>
                        {stage.movements.map((movement) => (
                          <StageRow key={movement.id} movement={movement} now={now} />
                        ))}
                      </WardRecordList>
                    </>
                  ) : (
                    <div className={styles.emptyStage}>
                      <h3 className={styles.emptyStageTitle}>{stage.label}</h3>
                      <p className={styles.absent}>Nobody is at this stage right now. {stage.blurb}</p>
                    </div>
                  )}
                </div>
              ))}
              <p className={styles.foot}>
                <strong>Sorted by wait, longest first — except an expiring legal authority</strong>, which outranks
                everything.
              </p>
            </WardPanel>

            <WardPanel title="Who is being carried" count={`${legs.length} of ${openMovements.length} open moves`}>
              {legs.length === 0 ? (
                <p className={styles.absent}>
                  No open movement currently has a transport leg booked — nobody is being carried right now.
                </p>
              ) : (
                <WardRecordList>
                  {legs.map((leg) => (
                    <TransportRow key={leg.movement.id} leg={leg} units={units} />
                  ))}
                </WardRecordList>
              )}
              <p className={styles.foot}>
                {withoutBookedTransport === 0 ? (
                  <strong>Every open movement has a transport leg booked.</strong>
                ) : (
                  <>
                    <strong>
                      {withoutBookedTransport} of {openMovements.length} open movements
                    </strong>{" "}
                    have no transport leg booked yet, and are not listed above — there is nothing to say about a vehicle
                    that has not been arranged.
                  </>
                )}
              </p>
            </WardPanel>
          </div>

          <aside className={styles.secondary} aria-label="Movement details">
            {/* The count read `${legs.length} legs` until 2026-09-06 and became redundant that day:
                `WardBar` now RENDERS its caption rather than hiding it in the aria-label, and the caption
                beneath this header already reads "8 transport legs booked or moving". The caption is the
                one that stays — it is the only line saying what the RAIL is. Same removal as the Delays
                panel, for the same reason, and made at the call site rather than suppressed in the
                primitive: "render the caption only when it adds something" is not evaluable. */}
            <WardPanel title="Transport right now">
              {legs.length === 0 ? (
                <p className={styles.absent}>No transport leg is booked or moving right now.</p>
              ) : (
                <div className={styles.bar}>
                  <WardBar
                    segments={
                      [
                        { label: LEG_STATE_LABEL.Accepted, value: counts.Accepted, tone: "accent" },
                        { label: LEG_STATE_LABEL["En route"], value: counts["En route"], tone: "warning" },
                        { label: LEG_STATE_LABEL.Collected, value: counts.Collected, tone: "warning" },
                        { label: LEG_STATE_LABEL.Arrived, value: counts.Arrived, tone: "good" },
                        { label: LEG_STATE_LABEL.Cancelled, value: counts.Cancelled, tone: "danger" },
                      ] satisfies WardBarSegment[]
                    }
                    caption={`${legs.length} transport ${legs.length === 1 ? "leg" : "legs"} booked or moving`}
                  />
                </div>
              )}
            </WardPanel>

            <WardPanel title="Every stage, at a glance" count={`${movements.length} moves`}>
              <ul className={styles.glance}>
                {stages.map((stage) => (
                  <li key={stage.id} className={styles.glanceItem}>
                    <span>{stage.label}</span>
                    {stage.movements.length === 0 ? (
                      <span className={styles.glanceCountZero}>none</span>
                    ) : (
                      <span className={styles.glanceCount}>{stage.movements.length}</span>
                    )}
                  </li>
                ))}
              </ul>
            </WardPanel>
          </aside>
        </div>
      </main>
    </div>
  );
}

/**
 * One patient's row inside a stage group. The urgency tier IS the row's state word — the same
 * `urgencyTierLabel` spelling every other screen uses, never a bare "P1"/"P2"/"P3" badge — so a
 * tier-1 row is toned danger with the word right beside the colour, and every other row still
 * carries a word even though nothing about it is urgent.
 */
function StageRow({ movement, now }: { movement: Movement; now: Instant }) {
  const originEd = edById(movement.originEdId);
  const originLabel = originEd ? originEd.name : `No department matches "${movement.originEdId}"`;
  const healthService = movementHealthService(movement) ?? "Health service unknown";
  const level: WardChipLevel = movement.urgency === 1 ? "urgent" : "routine";

  /*
   * 🔴 **A CLOSED MOVEMENT WAS RENDERING AS A PERSON STILL WAITING FOR A BED, WITH A RUNNING
   * CLOCK, AND COUNTED IN THE STAGE TOTAL.**
   *
   * Found 2026-09-05 by Ward Builder Two, on the merged screen, by checking one number against
   * the record. `WF-008` sat under "Accepted, awaiting bed" reading "2h 30m in journey" and
   * climbing. Its record says `closure.outcome: "did_not_proceed"` twenty minutes before now,
   * reason *"Patient self-discharged from ED before transport was arranged"* — and **nothing
   * anywhere on the page said so.** Grepped the rendered DOM: no "closed", no "did not proceed",
   * no "self-discharged".
   *
   * ⚠️ **EVERY INDIVIDUAL DECISION WAS CORRECT, WHICH IS WHY IT PASSED EVERY GATE.**
   * `journeyStages` groups by `stage` with no `isOpen` filter, faithfully matching what the
   * pre-merge screen did; `transportLegs` runs on `movements.filter(isOpen)`, faithfully matching
   * what ITS pre-merge screen did. Both were preserved deliberately, with the reasoning written
   * down at the time — introducing a filter the folded screen never had would have been a
   * behaviour change rather than a fold.
   *
   * **THE DEFECT IS CREATED BY ADJACENCY.** Before the merge those two counts lived on two pages
   * nobody saw together, so neither was a claim about the other. The merge made them one page.
   * **Neither half changed and the combination started lying** — which is also why the page shows
   * "50 moves" at the top and "8 of 43 open moves" at the bottom with nothing accounting for the
   * difference.
   *
   * ⚠️ **THE OWNER RULED: MARK IT, DO NOT FILTER IT** (2026-09-05, shown the row, the record and
   * three options). Filtering would delete the useful fact — that a move was abandoned is exactly
   * what a board like this is for — and would silently shrink the count with nothing explaining
   * why.
   *
   * **NO CLINICAL WORDING IS INVENTED HERE.** `cancelled` is an existing `WardChipLevel`; "did not
   * proceed" is the recorded `closure.outcome` in words; the sentence shown is the recorded
   * `closure.reason` verbatim. The app's own phrase for this state, in `ed-screen.tsx` and
   * `officer-screen.tsx`, is "has already closed (reason)".
   */
  const closure = movement.closure;

  /*
   * The clock counted to `now` regardless of closure, so a movement that ended twenty minutes ago
   * kept accruing journey time forever. Frozen at `closure.at`: even a marked row showing a
   * still-running duration is a second false statement, and the duration is the figure a
   * coordinator reads first.
   */
  const clockEnd = closure ? closure.at : now;

  return (
    <WardRecordRow
      id={movement.id}
      tone={closure ? "neutral" : movement.urgency === 1 ? "danger" : "neutral"}
      states={
        closure
          ? [
              { level: "cancelled" as WardChipLevel, text: "Did not proceed" },
              { level, text: urgencyTierLabel(movement.urgency) },
            ]
          : [{ level, text: urgencyTierLabel(movement.urgency) }]
      }
      clock={{
        value: splitDuration(Math.max(clockEnd - movement.openedAt, 0)),
        sub: closure ? "in journey before it ended" : "in journey",
      }}
      attributes={[
        ...(closure ? [closure.reason] : []),
        movement.cohort,
        movement.sex,
        movement.legalStatus,
        movement.security === "Secure" ? "Needs a locked bed" : "An open bed suits",
        healthService,
        `From ${originLabel}`,
        `Owner: ${movement.owner}`,
      ]}
    />
  );
}

/**
 * What a coordinator READS for each transport state, decided in exactly one place.
 *
 * `leg.state` is `MovementLegState` (`movements-derivations.ts`), which is `transportLeg`'s own
 * union minus the one value this screen cannot produce — never re-derived here — so a row and the
 * `transportCounts` tally beside it can never disagree about which state a given leg is in. The
 * segment strip above reads its labels from this same map for the same reason.
 *
 * ⚠️ **`Accepted` STILL READS "Booked", DELIBERATELY.** The five-state collapse (Ward Lead,
 * 2026-09-05) was a ruling about the TYPE, not about the words on the board. This screen has always
 * called an accepted job "Booked" — the row's clock says "since booked" and `bookedAt` is the job's
 * `acceptedAt` — and the module's own comment defines "booked" as "a provider has accepted". Ward
 * vocabulary here is owner territory (pull-not-hold, discharged-not-released), so the collapse
 * changes no coordinator-facing word except by ADDING one: `Collected` was previously folded into
 * "En route" and had no word of its own.
 *
 * ⚠️ **THAT ADDITION MOVES A NUMBER A COORDINATOR MAY KNOW BY SIGHT.** In today's fixture the old
 * "En route" tile read 6; it now reads 0 with a "Collected" tile at 6, because those six patients
 * are in a vehicle that has already picked them up. The finer distinction is the point of the
 * collapse — it is what `transportLeg` knew all along and this screen was discarding.
 */
const LEG_STATE_LABEL: Record<MovementLegState, string> = {
  Accepted: "Booked",
  "En route": "En route",
  Collected: "Collected",
  Arrived: "Arrived",
  Cancelled: "Cancelled",
};

/**
 * `Collected` shares `enroute` with `En route`: both mean a vehicle is carrying this patient, and
 * `WARD_CHIP_LEVELS` is a closed six-value list hoisted so screens cannot invent a seventh spelling.
 * The two are told apart by their WORDS, which is what a chip is required to carry anyway — a level
 * is a tone, never the state itself.
 */
const LEG_STATE_LEVEL: Record<MovementLegState, WardChipLevel> = {
  Accepted: "accepted",
  "En route": "enroute",
  Collected: "enroute",
  Arrived: "routine",
  Cancelled: "cancelled",
};

function TransportRow({ leg, units }: { leg: TransportLegRow; units: Unit[] }) {
  const movement = leg.movement;
  const originEd = edById(movement.originEdId);
  const originLabel = originEd ? originEd.name : `No department matches "${movement.originEdId}"`;
  const destinationUnit = movement.acceptedUnitId
    ? units.find((unit) => unit.id === movement.acceptedUnitId)
    : undefined;
  const destinationLabel = movement.acceptedUnitId
    ? (destinationUnit?.name ?? `No unit matches "${movement.acceptedUnitId}"`)
    : "No accepted destination recorded";

  return (
    <WardRecordRow
      id={movement.id}
      tone={leg.state === "Cancelled" ? "danger" : leg.state === "Arrived" ? "good" : "neutral"}
      states={[{ level: LEG_STATE_LEVEL[leg.state], text: LEG_STATE_LABEL[leg.state] }]}
      clock={{ value: splitDuration(Math.max(leg.minutesSinceBooked, 0)), sub: "since booked" }}
      attributes={[`Provider: ${leg.provider}`, `From ${originLabel}`, `To ${destinationLabel}`]}
      actions={
        <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Review patient
        </Link>
      }
    />
  );
}
