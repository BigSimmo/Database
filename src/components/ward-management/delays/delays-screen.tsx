"use client";

import Link from "next/link";

import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardBar } from "@/components/ward-management/ward-bar";
import { WardFilters } from "@/components/ward-management/ward-controls";
import { dayOf, formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, stageCopy } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById } from "@/components/ward-management/ward-sites";
import { type DelayCause, SEVERE_CAUSES, delayGroups, waitingSplit } from "./delays-derivations";
import styles from "./delays.module.css";

/**
 * MERGE 01 — the priority queue, the exceptions inbox and the escalation board, as one screen
 * answering one question: **why is this person still waiting?**
 *
 * The three were lists of the same people. WF-009 stood on all three at once — as a long wait, as
 * "five wards have declined", and as a recorded escalation. Three rows, one man, one problem. Here
 * he is one row, under the highest-ranked cause, with the rest of what is true of him beside it.
 *
 * ⚠️ **THE SCREEN COMPUTES NOTHING.** Every figure comes from `delays-derivations.ts` or from
 * `ward-derivations.ts`, so what a coordinator reads here and what any other surface reads are the
 * same numbers by construction rather than by agreement.
 *
 * ⚠️ **THIS SCREEN HAS NO TABLE, AND THAT IS THE DESIGN RATHER THAN AN OMISSION.** Merge 01 in the
 * design lock specifies none — the word "table" does not appear in its section — and the shape is
 * right: this screen is a grouped list of PEOPLE, where each row's meaning comes from the group it
 * sits under. A table is for comparing rows down a column, which is the Capacity screen's job.
 *
 * ⚠️ I said the opposite here for several hours, and told Ward Lead I was blocked on `WardTable`
 * for a screen that never needed one. Corrected by reading the lock instead of repeating myself.
 * If a tabular region is ever wanted here, it uses the shared `WardTable` — never a div grid, which
 * is how two tables come to exist.
 */
/**
 * ⚠️ **`movements` IS OVERRIDABLE SO THIS SCREEN'S EMPTY STATE CAN BE RENDERED AT ALL.**
 *
 * Added 2026-09-06 with the crash fix below, and it is the reason the fix is provable rather than
 * merely present. This screen crashed whenever no movement was open, and no test could reach that
 * state: it read every movement from the provider, whose seed always has people waiting. **The
 * screen most exposed to the defect was the one whose failing state was unreachable**, so the
 * strongest guard available was a scan of the source for a guard's presence — which cannot tell a
 * correct guard from a wrong one.
 *
 * The prop follows `StatisticsWardScreen`, which takes `units` and `admissions` the same way and
 * for the same reason. Live behaviour is unchanged: absent the prop, the provider is the source, so
 * no route passes it and no screen resolves its data from anywhere new.
 */
export function DelaysScreen({ movements: movementsOverride }: { movements?: Movement[] } = {}) {
  const { movements: liveMovements, units, now } = useWardFlow();
  const movements = movementsOverride ?? liveMovements;
  const open = movements.filter(isOpen);
  const groups = delayGroups(movements, units, now);
  const split = waitingSplit(movements, now);
  const shown = groups.reduce((sum, group) => sum + group.movements.length, 0);
  /**
   * ⚠️ "TODAY" IS `dayOf`, NOT A DATE. An `Instant` is minutes against `NOW_ANCHOR` and carries no
   * calendar date at all, so there is nothing here to compare a date against and inventing one
   * would be fabricating a fact the model does not hold. `dayOf` is the model's own notion of which
   * demonstration day an instant falls on, and it is the only honest answer to "today".
   */
  const resolvedToday = movements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );

  return (
    /*
     * ⚠️ **THE SHELL WAS MISSING UNTIL 2026-09-05 AND NO TEST OF MINE COULD SEE IT.** This screen
     * shipped with no `ClinicalRail`, no `<main id="main-content">` and no `<h1>` — so a coordinator
     * who reached it could not get to any other board, and two landmarks every other Ward Flow route
     * guarantees were simply absent. `tests/ward-delays-screen.dom.test.tsx` renders this component
     * in isolation and asserts its panels, so it was green throughout: **a component test cannot see
     * a missing page shell, because the shell is exactly what it does not render.**
     * Found by a subagent wiring the route, when `ward-nav.test.ts` and `ward-landmarks.test.ts` —
     * which walk ROUTES rather than components — went red on all three at once.
     */
    <div className={styles.screen} data-testid="ward-delays-page">
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
            Every waiting patient, refusal and escalation on this screen is invented. Nobody here is a real person, and
            nothing on it is a clinical record.
          </p>
        </div>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Delays</h1>
          <p className={styles.pageSubtitle}>Why each waiting patient is still waiting, one row per person.</p>
        </header>

        {/* The panel count read `${open.length} people` until 2026-09-06 and became redundant that day:
                  `WardBar` now RENDERS its caption instead of hiding it in the aria-label, so the
                  same figure was appearing three times in four lines — panel title, panel count,
                  bar caption. The caption is the one that has to stay: it is the only line that
                  says what the RAIL is, which is the misreading the caption exists to prevent.
                  Removed here rather than suppressed in the primitive, because "render the caption
                  only when it adds something" is not a property any component can evaluate. */}
        {/*
         * 🔴 **THIS SCREEN CRASHED WHEN NOBODY WAS WAITING, WHICH IS THE BEST DAY IT CAN HAVE.**
         * Fixed 2026-09-06. `waitingSplit` returns its three bands all at zero whenever no movement
         * is open, and `WardBar` THROWS on an all-zero total — deliberately, because an empty rail
         * reads as a loading state. There was no guard here at all, so the page went blank. Every
         * other state this screen can be in is worse than an empty one, and the empty one was the
         * only state that killed it.
         *
         * ⚠️ **THE THROW IS NOT THE DEFECT AND MUST NOT BE SOFTENED.** `WardBar` cannot tell a
         * MEASURED zero from an UNKNOWN one — both arrive as the number 0 — and this call site can,
         * because it knows `waitingSplit` ran over the live movements. So the refusal is a contract
         * on callers, and the decision belongs here. Ward Lead's ruling, 2026-09-06:
         *
         *     a measured none  → a plain word. Nobody is waiting.
         *     a genuine unknown → the absence sentence, saying what is missing and why
         *
         * This is the first kind. The count RAN. So it is stated plainly and NOT dressed as an
         * absence — "nothing can say how many are waiting" would be false over a real figure.
         *
         * ⚠️ **THE TITLE WAS THE SAME DEFECT ONE LINE UP**: `How long the ${open.length} have waited`
         * reads "How long the 0 have waited" at zero, and "the 1 have waited" at one.
         */}
        <WardPanel
          title={
            open.length === 0
              ? "How long people have waited"
              : `How long the ${open.length} ${open.length === 1 ? "person has" : "people have"} waited`
          }
        >
          <div className={styles.bar}>
            {open.length === 0 ? (
              <p className={styles.absent} data-testid="ward-delays-nobody-waiting">
                Nobody is waiting in any emergency department right now. That is a measured count over every open
                movement, not a figure this screen could not produce.
              </p>
            ) : (
              <WardBar segments={split} caption={`${open.length} ${open.length === 1 ? "person" : "people"} waiting`} />
            )}
          </div>
          <p className={styles.foot}>
            <strong>This bar is the only thing on the screen showing everyone at once.</strong> The waiting time is
            counted from arrival in the department, not from when the referral was raised — a community referral can
            take days to arrive, and counting those days as an emergency wait pushes a genuinely urgent person down the
            list.
          </p>
        </WardPanel>

        <WardPanel title="Who is waiting, and on what" count={`${shown} of ${open.length} shown`}>
          <div className={styles.filters}>
            <WardFilters
              legend="Show"
              activeId="waiting"
              onChange={() => {}}
              options={[
                { id: "waiting", label: "People waiting", count: open.length },
                {
                  id: "locked",
                  label: "Needs a locked bed",
                  count: open.filter((movement) => movement.security === "Secure").length,
                },
                {
                  id: "escalated",
                  label: "Escalated",
                  count: open.filter((movement) => movement.escalation !== undefined).length,
                },
              ]}
            />
          </div>

          {groups.map((group) => (
            <div key={group.cause}>
              <WardGroupHeading
                title={group.title}
                people={group.movements.length}
                note={group.note === "" ? undefined : group.note}
                tone={isSevere(group.cause) ? "danger" : "neutral"}
              />
              <WardRecordList>
                {group.movements.map((movement) => (
                  <DelayRow key={movement.id} movement={movement} units={units} now={now} cause={group.cause} />
                ))}
              </WardRecordList>
            </div>
          ))}

          <p className={styles.foot}>
            <strong>Sorted by wait, longest first — except an expiring legal authority.</strong>{" "}
            <strong>Nothing on this screen decides anything.</strong> The two actions above are routes to the screen
            that holds each decision — releasing a lapsed bed pull happens on the ward holding the bed, and overriding a
            refusal happens on the coordinator screen, where the reason is recorded rather than the refusal being
            removed.
          </p>
        </WardPanel>

        <WardPanel title="Worth your attention">
          <ul className={styles.attention}>
            {groups
              .filter((group) => isSevere(group.cause))
              .flatMap((group) => group.movements.map((movement) => ({ group, movement })))
              .map(({ group, movement }) => (
                <li key={movement.id} className={styles.attentionItem}>
                  <span className={styles.attentionWho}>{movement.id}</span>
                  {group.title} — {splitDuration(Math.max(now - movement.openedAt, 0))} waiting.
                </li>
              ))}
          </ul>
        </WardPanel>

        <WardPanel title="Resolved today" count={`${resolvedToday.length}`}>
          <p className={styles.absent}>
            {resolvedToday.length === 0
              ? "Nobody who was on this screen this morning is in a bed yet."
              : `${resolvedToday.length === 1 ? "One person" : `${resolvedToday.length} people`} who were on this screen earlier are now placed.`}{" "}
            They are kept for the rest of the day so a shift handing over can see what moved, and then they go.
          </p>
        </WardPanel>

        {/*
        ⚠️ AN ABSENCE STATED, NOT A BLANK. The language's fifth rule: an empty panel explains why it
        is empty and what the emptiness means. A panel that is merely empty reads as a bug, and on
        this screen it would read as "nothing is wrong in that category" — the same failure an empty
        group heading makes, one level up.
      */}
        <WardPanel title="Delays with no named person" count="none">
          <p className={styles.absent}>
            Every delay recorded today belongs to somebody. A delay with no patient attached — a ward-wide closure, a
            transport outage — would appear here rather than being spread across the rows it affects.
          </p>
        </WardPanel>
      </main>
    </div>
  );
}

/**
 * ⚠️ `elapsedLabel` ALREADY ENDS IN THE WORD "waiting" (`formatElapsed`), so composing it with a
 * sub-label or a following word renders "7h 00m waiting waiting." and "7h 00m waiting / in ED".
 * Both shipped here and every test stayed green, because nothing asserts how a duration READS —
 * only that some duration is present. `splitDuration` is the bare figure; the word belongs to
 * whatever the figure sits beside.
 */

/**
 * The causes nothing routine resolves. Named once so the row and its heading cannot disagree.
 *
 * 🔴 **`legal_breached` WAS MISSING HERE FOR ABOUT AN HOUR AND THE OMISSION INVERTED THE SEVERITY.**
 * The audit split the old single `legal_expiring` cause into `legal_breached` (the authority has
 * ALREADY LAPSED) and `legal_expiring` (under an hour, not yet lapsed), and ranked breached first in
 * `ORDER`. This predicate was not updated with it — so **the worse case rendered as routine while
 * the lesser case rendered as danger**, and a lapsed authority was excluded from "Worth your
 * attention" entirely.
 *
 * ⚠️ **Nothing on screen was wrong, which is why no test caught it.** No movement in today's seed is
 * breached or critical, so `legal_breached` is an empty group and the inversion is latent — it fires
 * the first time a real deadline passes. **A defect that only appears once the data gets worse is
 * exactly the one a fixture cannot show you.**
 *
 * It happened because two agents worked in parallel: one added the cause, the other owned this file,
 * and neither could see the other. **The general shape: splitting an enum member is not a local
 * change — every predicate that names the old member by hand is a caller, and the compiler cannot
 * find them because a string union still typechecks.**
 *
 * ⚠️ **`bed_pull_expired` is DELIBERATELY not here, and that is a question rather than a decision.**
 * A lapsed bed hold is operationally serious and arguably belongs; promoting it would silently
 * change what "Worth your attention" shows, which is a product judgement nobody has made. Raised
 * with Ward Lead 2026-09-05.
 */
function isSevere(cause: DelayCause): boolean {
  return SEVERE_CAUSES.includes(cause);
}

/**
 * ⚠️ **THE ESCALATION FACTS TRAVEL, AND THAT IS THE WHOLE REASON THIS ROW HAS AN ANNOTATION.**
 * `movement.escalation` carries `at`, `triedUnitIds` and `contact`, and the escalation board was the
 * ONLY surface in the app that ever rendered them — checked rather than assumed: neither the
 * priority queue nor `buildActionInbox` reads `movement.escalation` at all. Folding that board in
 * without carrying these three would have deleted them from the product while every test stayed
 * green.
 *
 * Wards are named, never listed by id: an id is not a fact a coordinator can act on.
 */
function DelayRow({
  movement,
  units,
  now,
  cause,
}: {
  movement: Movement;
  units: Unit[];
  now: Instant;
  cause: DelayCause;
}) {
  const declines = movement.declines.length;
  /*
   * The ward actually holding the bed, looked up from this row's own `units` rather than named. A
   * missing lookup yields `undefined` and the link is simply not offered — never a link to a ward
   * this row cannot identify, and never a bare id shown as a ward name.
   */
  const pullHolder = units.find((unit) => unit.id === movement.acceptedUnitId);
  const escalation = movement.escalation;
  const triedUnits = (escalation?.triedUnitIds ?? [])
    .map((unitId) => units.find((unit) => unit.id === unitId))
    .filter((unit): unit is Unit => unit !== undefined);
  // Wards and departments are always named, never shown as an id (see the doc comment above this
  // function) — mirrors `escalation-board.tsx`'s own `departmentLabel` fallback exactly, rather
  // than inventing a second wording for the same missing-lookup case.
  const originEd = edById(movement.originEdId);
  const originLabel = originEd ? originEd.name : `No department matches "${movement.originEdId}"`;
  // `Movement.blocker` is a REQUIRED string and is never actually `""` in this model — a movement
  // with nothing holding it up carries one of `BLOCKERS_MEANING_NOTHING_IS_BLOCKING` ("No blocker",
  // "None — in transit", …) instead of an empty string (see that constant's own doc comment in
  // ward-model.ts, and `ward-priority.ts`'s private `hasActiveBlocker`, which exists to answer
  // exactly this question and is mirrored here rather than duplicated as an exported copy). Showing
  // "Blocked: No blocker" on every row would be the "typed prose is always an obstruction" trap
  // that comment warns about, in reverse — so "non-empty" is read as "names something actually
  // holding this movement up", matching this row's own annotation label.
  const blockerText = movement.blocker.trim();
  const activeBlocker =
    blockerText !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blockerText);

  const states: { level: "urgent" | "routine" | "stalled"; text: string }[] = [];
  if (declines > 0) states.push({ level: "urgent", text: `${declines} declined` });
  if (escalation !== undefined) states.push({ level: "stalled", text: "Escalated" });
  if (movement.flaggedUrgent) states.push({ level: "stalled", text: "Flagged urgent" });
  // A row is never toned without a word — WardRecordRow refuses that — and it is never wordless
  // either, because a row with no state at all reads as a row nobody has looked at.
  if (states.length === 0) states.push({ level: "routine", text: "Waiting" });

  return (
    <WardRecordRow
      id={movement.id}
      tone={isSevere(cause) ? "danger" : "neutral"}
      states={states}
      clock={{
        value: splitDuration(Math.max(now - movement.openedAt, 0)),
        sub: "in ED",
        urgent: cause === "legal_expiring",
      }}
      attributes={[
        movement.cohort,
        movement.sex,
        movement.legalStatus,
        movement.security === "Secure" ? "Needs a locked bed" : "An open bed suits",
        urgencyTierLabel(movement.urgency),
        stageCopy[movement.stage].label,
        `from ${originLabel}`,
        `Owner: ${movement.owner}`,
      ]}
      annotation={
        !activeBlocker && escalation === undefined ? undefined : (
          <>
            {!activeBlocker ? null : (
              <span className={styles.annotationLine} data-testid="delays-blocker">
                <strong>Blocked:</strong> {blockerText}
              </span>
            )}
            {escalation === undefined ? null : (
              <span className={styles.annotationLine} data-testid="delays-escalation">
                <strong>Escalated {formatAgo(now - escalation.at)}</strong> ({formatInstantWithDay(escalation.at, now)})
                to {escalation.contact}
                {triedUnits.length === 0 ? (
                  <span data-testid="delays-tried-none">{" · No units recorded"}</span>
                ) : (
                  <>
                    {" · tried "}
                    {triedUnits.map((unit, index) => (
                      <span key={unit.id} data-testid="delays-tried-unit">
                        {index > 0 ? ", " : ""}
                        {unit.name}
                      </span>
                    ))}
                  </>
                )}
              </span>
            )}
          </>
        )
      }
      actions={
        /*
         * 🔴 **THE LAPSED BED PULL GETS ITS NEXT STEP BACK — owner-approved 2026-09-06.** The
         * exceptions inbox MERGE 01 folded into this screen offered "reconfirm or release bed pull";
         * this screen named the problem and stopped, so a coordinator was told a bed reservation had
         * expired and offered nothing to do about it. **A bed then stays held for someone who may
         * never arrive.**
         *
         * ⚠️ **THESE ARE LINKS, NOT A THIRD DISPATCH SURFACE, AND THAT IS DELIBERATE.**
         * `RELEASE_PULL` already has two live controls — `coordinator/shortlist-panel.tsx` and
         * `ward/ward-screen.tsx` — each with the owner's four-reason picker
         * (`RELEASE_PULL_REASONS`). A third copy of that form would be a third place for the reason
         * list to drift from the other two. What was missing was never the control; it was the ROUTE
         * to it from where the problem is reported.
         *
         * ⚠️ **"Reconfirm" IS NOT OFFERED, BECAUSE NO SUCH EVENT EXISTS.** The whole model carries
         * exactly two pull events, `PULL_PATIENT` and `RELEASE_PULL`. The old inbox's label named
         * reconfirming as though it were an action; a control for it would do nothing, which is the
         * defect this project keeps finding. Releasing is the step that exists, so it is the step
         * offered.
         *
         * ⚠️ **AND THE "Override a refusal" BUTTON BESIDE IT WAS DEAD.** A plain `<button>` with no
         * `onClick`, no `aria-disabled`, and no note — it looked live and did nothing when pressed.
         * An override is not its own event: it is an `overrideReason` carried on `REFER_TO_UNITS`,
         * raised from the coordinator's shortlist panel. So it becomes a route too, rather than a
         * control that silently declines to act.
         */
        cause === "bed_pull_expired" || declines > 0 ? (
          <>
            {cause === "bed_pull_expired" && pullHolder ? (
              <Link
                className={styles.action}
                href={`/mockups/ward-flow/ward/${pullHolder.id}`}
                data-testid={`delays-release-pull-${movement.id}`}
              >
                Release the bed pull at {pullHolder.name}
              </Link>
            ) : null}
            {declines > 0 ? (
              <Link className={styles.action} href="/mockups/ward-flow" data-testid={`delays-override-${movement.id}`}>
                Override a refusal on the coordinator screen
              </Link>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

/** Minutes since something happened, in words. Never a clock face: this is an age, not a time. */
function formatAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
