"use client";

import { useState } from "react";

import { elapsedLabel, stageCopy, transportLeg } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import type { Movement, TransportJob, Unit } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";

import styles from "./officer.module.css";

/**
 * `TRANSPORT_ACCEPTED`'s own preconditions (`ward-flow-reducer.ts`), named here so the Accepted
 * button can never advertise an action the reducer would refuse — the same discipline
 * `ward-screen.tsx`'s `referralAnswerBlocked`/`holdBlockedReason` and `shortlist-panel.tsx`'s
 * `canRefer` already hold to. The two branches below are read straight off the reducer's own
 * `case "TRANSPORT_ACCEPTED"`, in the same order, so the two can never silently drift apart.
 */
/**
 * The four actions this screen dispatches, read back as THE WORDS ALREADY ON THE BUTTON.
 *
 * ⚠️ `Rejection.attempted` is the event's own type string verbatim (see `makeRejection` in
 * `ward-flow-reducer.ts`) — `PATIENT_COLLECTED`, not "Collected". Rendering it raw would put a
 * SCREAMING_CASE token in front of a clinician, which this repository has already had to repair
 * once on a clinical heading. Same shape and same reason as `WARD_ACTION_REJECTION_LABELS` in
 * `ward-screen.tsx`.
 *
 * 🔴 THIS MAP IS ALSO THE SCOPE FILTER, AND THAT IS DELIBERATE. A refusal whose `attempted` is not
 * one of these four is not this screen's business — and because an unknown key is dropped rather
 * than displayed, no event type added later can render as a raw token here by default. The filter
 * and the anti-token guarantee are the same line of code.
 *
 * ⚠️ IT FILTERS BY ACTION, NEVER BY THE JOBS VISIBLE ABOVE. The refusal this surface exists for
 * happens exactly when somebody else has closed the movement, which REMOVES it from the job list.
 * Scoping to what is on screen is the intuitive choice and would hide the motivating case.
 *
 * ⚠️ And `Rejection.movementId` holds a REFERRAL id for the referral events, so showing everything
 * would print referral ids under a movement label. These four are all movement-scoped.
 */
const OFFICER_ACTION_REJECTION_LABELS: Record<string, string> = {
  TRANSPORT_ACCEPTED: "Accepted",
  TRANSPORT_EN_ROUTE: "En route",
  PATIENT_COLLECTED: "Collected",
  PATIENT_ARRIVED: "Arrived",
};

/*
 * 🔴 EVERY PREDICATE BELOW MUST CHECK `movement.closure` FIRST, AND THAT CHECK WAS MISSING FROM ALL
 * FOUR UNTIL 2026-09-04.
 *
 * The four reducer cases these mirror — TRANSPORT_ACCEPTED, TRANSPORT_EN_ROUTE, PATIENT_COLLECTED,
 * PATIENT_ARRIVED — each reject a closed movement before anything else. These predicates mirrored
 * the stage and transport preconditions and omitted the closure one. So on a movement an ED user
 * had closed, the officer's button RENDERED ENABLED, the press produced a rejection, and the
 * movement came back byte-identical. A clinician pressed a button on a phone and nothing happened
 * and nothing said why.
 *
 * ⚠️ CLOSURE IS CHECKED FIRST HERE BECAUSE IT IS CHECKED FIRST THERE. Order is not cosmetic: a
 * closed movement also fails the stage guard, so putting closure second would show the clinician a
 * stage message for a movement that has ENDED — true, and the wrong reason.
 *
 * ⚠️ AND READ THIS BEFORE TRUSTING A COMMENT ON ONE OF THESE. Each of these functions carried a
 * comment saying it "mirrors `case X` exactly"; the arrival one went further and named the floor
 * guard on empty beds as its evidence of completeness. Every word of that was TRUE, and all four
 * omitted closure. A COMMENT THAT ENUMERATES WHAT IT COVERS READS AS AN INVENTORY, and `ed-screen.tsx`
 * then cited these four as the convention to hold to. The enumeration is what stopped anyone looking.
 *
 * `tests/ward-officer-blocked-reason-parity.test.ts` now DRIVES every movement each predicate
 * permits through the matching reducer case and asserts none is rejected. That is the check that
 * cannot be satisfied by a comment: it never reads either implementation.
 */
export function acceptedBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `${movement.id} has already closed (${movement.closure.reason}). Transport cannot be accepted for a movement that has ended.`;
  }
  if (movement.stage !== "handover_ready" || !movement.transport) {
    return `${movement.id} is ${stageCopy[movement.stage].label.toLowerCase()}, not ready for a transport handover.`;
  }
  if (movement.transport.acceptedAt !== undefined) {
    return `Transport for ${movement.id} was already accepted.`;
  }
  return undefined;
}

/** Mirrors `case "TRANSPORT_EN_ROUTE"`, closure guard first. See the block above the group. */
export function enRouteBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `${movement.id} has already closed (${movement.closure.reason}). Transport cannot be moved for a movement that has ended.`;
  }
  if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
    return `Transport for ${movement.id} cannot go en route before it has been accepted.`;
  }
  if (movement.transport.enRouteAt !== undefined) {
    return `Transport for ${movement.id} is already en route.`;
  }
  return undefined;
}

/** Mirrors `case "PATIENT_COLLECTED"`, closure guard first. The reducer carries no "already
 * collected" check of its own — collecting moves the stage to `moving`, so the stage guard already
 * covers a second attempt — and this stays a faithful mirror rather than adding a check the reducer
 * lacks. ⚠️ That sentence was true while the function omitted closure entirely; it describes one
 * deliberate omission and was silent about an accidental one. See the block above the group. */
export function collectedBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `${movement.id} has already closed (${movement.closure.reason}). A patient cannot be collected for a movement that has ended.`;
  }
  if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
    return `${movement.id} cannot be marked collected before transport is en route.`;
  }
  return undefined;
}

/**
 * Mirrors `case "PATIENT_ARRIVED"`, closure guard first, and including the floor guard on the
 * receiving unit's physically empty beds. ⚠️ THIS COMMENT ONCE SAID "exactly, including the floor
 * guard" WHILE THE FUNCTION OMITTED CLOSURE — naming the hardest precondition it did cover read as
 * proof it covered them all. `unit` is passed in already
 * resolved from the LIVE `units` array the provider hands back (never `unitById` from
 * `ward-sites.ts`, which reads the frozen fixture and would never see an earlier arrival that
 * already consumed the receiving unit's last empty bed).
 */
export function arrivedBlockedReason(movement: Movement, unit: Unit | undefined): string | undefined {
  if (movement.closure) {
    return `${movement.id} has already closed (${movement.closure.reason}). A patient cannot be marked arrived for a movement that has ended.`;
  }
  if (movement.stage !== "moving" || movement.transport?.collectedAt === undefined) {
    return `${movement.id} cannot be marked arrived before the patient has been collected.`;
  }
  if (!movement.acceptedUnitId) {
    return `${movement.id} has no accepted destination unit recorded.`;
  }
  if (!unit) {
    return `No synthetic unit matches the accepted destination id "${movement.acceptedUnitId}" for ${movement.id}.`;
  }
  if (unit.empty.value <= 0) {
    return `No physically empty bed remains at ${unit.name} for ${movement.id} to arrive into.`;
  }
  return undefined;
}

function formRequiredLabel(transport: TransportJob): string {
  // "recorded", not "required" — fix wave 1, item 2, found by the ward-wide scan that item added
  // rather than named in it. An absent `formRequired` means this transport record names no form;
  // it does not mean the Mental Health Act requires none, which is a claim this prototype is not
  // entitled to make in either direction.
  return transport.formRequired ?? "No transport form recorded";
}

/**
 * Task 9: the transport officer's phone. The model carries no officer identity —
 * `TransportJob` records a `provider` (an organisation), never a person — so this screen cannot
 * filter to "my jobs" without inventing an owner the data does not support. It shows every job
 * not yet arrived instead, and says so on screen (spec §7).
 *
 * Layout inherits Task 7's settled phone pattern rather than reinventing it: a scrollable list
 * of every open job (all fields always visible, per spec — "shows every job"), and the currently
 * selected job's four actions pinned to the literal viewport bottom via CSS
 * (`officer.module.css`, `@media (max-width: 48rem)`), the same `position: fixed` technique
 * `shortlist-panel.tsx`'s `.shortlistActionRow` uses. Only one job's action row can occupy the
 * viewport's bottom edge at a time, so — exactly like the coordinator's queue-plus-shortlist
 * pattern — one job is "active" and the rest are listed for picking up next. The active job's
 * card carries `data-testid="ward-officer-job-<id>"` and, being the one selected, contains
 * exactly its four action buttons and nothing else; every other job's card carries the same
 * testid prefix (so "shows every job" is provable by locator) but ends in a single "Work this
 * job" selector instead, which lives outside whichever card is currently active and so never
 * inflates that job's own button count.
 */
/**
 * THE JOBS THIS PHONE SCREEN SHOWS, and the predicate its governance sentence describes.
 *
 * Exported so a test can drive it. The sentence above the list claims to show "every transport job
 * not yet arrived on an open movement" — three conditions, and until 2026-09-04 the sentence named
 * only two of them while this predicate enforced all three. A job on a CLOSED movement dropped off
 * with no explanation, and the word "every" was in bold.
 *
 * ⚠️ THE FILTER WAS RIGHT AND THE SENTENCE WAS NOT UPDATED WHEN IT LANDED. That is the opposite
 * direction from the failure this project keeps finding: usually a change reaches the comments and
 * stops before the code. Here it reached the code and never touched the sentence at all.
 */
export function isOfficerJob(movement: Movement): boolean {
  return (
    movement.transport !== undefined && movement.transport.arrivedAt === undefined && movement.closure === undefined
  );
}

export function OfficerScreen() {
  const { movements, units, now, dispatch, rejections } = useWardFlow();

  // Every job not yet arrived — never filtered to an inferred "mine", per the model constraint
  // above. `movement.transport` guards existence; `arrivedAt` is the one stamp `PATIENT_ARRIVED`
  // writes, so its absence is exactly "not yet arrived" regardless of `movement.stage`.
  /*
   * CLOSURE IS ADDED HERE; THE STAGE QUESTION IS DELIBERATELY NOT.
   *
   * The comment above defends ignoring `movement.stage`, and that reasoning is sound: `arrivedAt`
   * is the one stamp `PATIENT_ARRIVED` writes, so its absence really is "not yet arrived". But it
   * says nothing about CLOSURE, which is a different fact. A transport job on a CLOSED movement is
   * not a job an officer can do - nobody is going anywhere - and by the filter's own logic it sat
   * here forever with its elapsed time counting up.
   *
   * `movement.closure === undefined`, NOT `isOpen(movement)`. `isOpen` is two conditions bolted
   * together - closure absent AND stage not "arrived" - and the second is exactly the stage
   * exclusion the comment above rejects for this screen. Using it here would smuggle that back in.
   *
   * THE TRANSPORT BOARD IN `ward-management-modes.tsx` DIFFERS ON STAGE, AND THAT IS CORRECT, NOT
   * DRIFT. The board asks "what is in flight" and excludes arrived; this phone screen asks "what
   * have I not yet delivered" and must keep showing a job until its own arrival stamp lands. The
   * two agree on closure and differ on stage, on purpose. Do not "fix" the asymmetry.
   */
  const jobs = movements.filter(isOfficerJob);

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // Defaults to the first job in the live list when nothing is selected yet, or when a
  // previously selected job has left the list (it arrived, on a different tap, while this job
  // card was not the one in focus). This is display orientation only, exactly like
  // `shortlist-panel.tsx`'s own `shortlist[0]?.unit` default — every dispatch below still reads
  // `selectedJob.id` off this same live, freshly filtered array, never a stale closure, so a
  // fallback selection can never change what an action actually targets.
  const selectedJob = jobs.find((job) => job.id === selectedId) ?? jobs[0];

  // Newest first: `rejections` is appended in raise order, and a driver wants what just failed.
  const officerRefusals = [...rejections]
    .reverse()
    .filter((rejection) => OFFICER_ACTION_REJECTION_LABELS[rejection.attempted] !== undefined);

  return (
    <div className={styles.screen} data-testid="ward-officer-screen">
      <ClinicalRail />
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Transport officer job list</h1>

        <div className={styles.governanceBanner} data-testid="ward-officer-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            No officer identity exists in this model &mdash; a transport job records an organisation such as &ldquo;St
            John WA&rdquo;, never a person. This screen therefore shows <strong>every</strong> transport job not yet
            arrived on an open movement, not a filtered list of &ldquo;your&rdquo; jobs. A job whose movement has been
            closed drops off, because the journey it belonged to has ended.
          </p>
        </div>

        {/*
         * 🔴 THE REFUSAL SURFACE. Until 2026-09-04 this screen read `rejections` NOWHERE — the only
         * ward screen with no channel to report a refusal — while coordinator, ED, ward, referrals
         * and morning-tour all had one. That is what turned a wrong gate into a phantom: a
         * clinician pressed a button, the reducer refused, the movement came back byte-identical,
         * and the phone said nothing at all.
         *
         * ⚠️ THIS IS DELIBERATELY NOT FILTERED TO THE JOBS VISIBLE ABOVE. The refusal this exists
         * for happens exactly when a movement has just been closed by somebody else and has
         * therefore LEFT the `jobs` list — filtering to the list would hide the one case that
         * motivated the surface. Scoping it to what is on screen is the intuitive choice and the
         * wrong one.
         *
         * Persistent, not a toast (spec §7.4, the same rule the coordinator's exceptions drawer
         * follows): it renders nothing until the first refusal, and then never goes silent.
         * Newest first, because `rejections` is appended in raise order and a driver wants what
         * just failed, not what failed first today.
         */}
        {officerRefusals.length > 0 ? (
          <section className={styles.refusals} aria-label="Refused actions" data-testid="ward-officer-refusals">
            <h2 className={styles.refusalsTitle}>
              {officerRefusals.length} refused action{officerRefusals.length === 1 ? "" : "s"}
            </h2>
            <ul className={styles.refusalsList}>
              {officerRefusals.map((rejection) => (
                <li key={rejection.id} className={styles.refusalsItem}>
                  <strong>{rejection.movementId}</strong> &mdash; {OFFICER_ACTION_REJECTION_LABELS[rejection.attempted]}{" "}
                  was refused: {rejection.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {jobs.length === 0 ? (
          <p className={styles.placeholder} data-testid="ward-officer-empty">
            No transport job is currently outstanding &mdash; every job on record has arrived.
          </p>
        ) : (
          <ul className={styles.jobList} data-testid="ward-officer-joblist">
            {jobs.map((movement) => {
              const transport = movement.transport;
              // Unreachable given the `jobs` filter above (it only keeps movements with a
              // transport job), but this is TypeScript narrowing without a non-null assertion,
              // not a fallback that hides real data: if it were ever wrong, this renders nothing
              // for the one row rather than throwing or guessing at a job.
              if (!transport) return null;

              const active = movement.id === selectedJob.id;
              const originEd = edById(movement.originEdId);
              const destinationUnit = movement.acceptedUnitId
                ? units.find((unit) => unit.id === movement.acceptedUnitId)
                : undefined;
              const destinationLabel = movement.acceptedUnitId
                ? (destinationUnit?.name ?? `No synthetic unit matches "${movement.acceptedUnitId}"`)
                : "No accepted destination recorded";

              const acceptedBlocked = acceptedBlockedReason(movement);
              const enRouteBlocked = enRouteBlockedReason(movement);
              const collectedBlocked = collectedBlockedReason(movement);
              const arrivedBlocked = arrivedBlockedReason(movement, destinationUnit);

              return (
                <li
                  key={movement.id}
                  data-testid={`ward-officer-job-${movement.id}`}
                  className={active ? styles.jobCardActive : styles.jobCard}
                >
                  <header className={styles.jobHeader}>
                    <strong>{movement.id}</strong>
                    <span className={styles.jobMeta}>
                      {transportLeg(transport)} &middot; {elapsedLabel(movement, now)}
                    </span>
                  </header>

                  <dl className={styles.jobDetails}>
                    <div className={styles.jobDetailRow}>
                      <dt>Origin department</dt>
                      <dd>
                        {originEd
                          ? `${originEd.name} (${originEd.siteCode})`
                          : `No synthetic department matches "${movement.originEdId}"`}
                      </dd>
                    </div>
                    <div className={styles.jobDetailRow}>
                      <dt>Destination unit</dt>
                      <dd>{destinationLabel}</dd>
                    </div>
                    <div className={styles.jobDetailRow}>
                      {/* Until 2026-08-24 this label asserted a legal requirement. Its VALUE was
                          corrected to "No transport form recorded" in the same change that left
                          the label behind — a field label is a claim too. This names the field the
                          record holds (`TransportJob.formRequired`) and asserts nothing about what
                          the Act demands. */}
                      <dt>Transport form</dt>
                      <dd>{formRequiredLabel(transport)}</dd>
                    </div>
                    <div className={styles.jobDetailRow}>
                      <dt>Escort required</dt>
                      <dd>{transport.escortRequired ? "Yes" : "No"}</dd>
                    </div>
                  </dl>

                  {active ? (
                    <>
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          data-testid={`ward-officer-accept-${movement.id}`}
                          aria-disabled={acceptedBlocked ? "true" : undefined}
                          aria-describedby={
                            acceptedBlocked ? `ward-officer-accept-unavailable-${movement.id}` : undefined
                          }
                          title={acceptedBlocked ?? undefined}
                          className={styles.actionButton}
                          onClick={
                            acceptedBlocked
                              ? ignoreUnavailableActivation
                              : () =>
                                  dispatch({
                                    type: "TRANSPORT_ACCEPTED",
                                    role: "officer",
                                    now,
                                    movementId: movement.id,
                                  })
                          }
                        >
                          Accepted
                        </button>
                        <button
                          type="button"
                          data-testid={`ward-officer-enroute-${movement.id}`}
                          aria-disabled={enRouteBlocked ? "true" : undefined}
                          aria-describedby={
                            enRouteBlocked ? `ward-officer-enroute-unavailable-${movement.id}` : undefined
                          }
                          title={enRouteBlocked ?? undefined}
                          className={styles.actionButton}
                          onClick={
                            enRouteBlocked
                              ? ignoreUnavailableActivation
                              : () =>
                                  dispatch({
                                    type: "TRANSPORT_EN_ROUTE",
                                    role: "officer",
                                    now,
                                    movementId: movement.id,
                                  })
                          }
                        >
                          En route
                        </button>
                        <button
                          type="button"
                          data-testid={`ward-officer-collect-${movement.id}`}
                          aria-disabled={collectedBlocked ? "true" : undefined}
                          aria-describedby={
                            collectedBlocked ? `ward-officer-collect-unavailable-${movement.id}` : undefined
                          }
                          title={collectedBlocked ?? undefined}
                          className={styles.actionButton}
                          onClick={
                            collectedBlocked
                              ? ignoreUnavailableActivation
                              : () =>
                                  dispatch({ type: "PATIENT_COLLECTED", role: "officer", now, movementId: movement.id })
                          }
                        >
                          Collected
                        </button>
                        <button
                          type="button"
                          data-testid={`ward-officer-arrive-${movement.id}`}
                          aria-disabled={arrivedBlocked ? "true" : undefined}
                          aria-describedby={
                            arrivedBlocked ? `ward-officer-arrive-unavailable-${movement.id}` : undefined
                          }
                          title={arrivedBlocked ?? undefined}
                          className={styles.actionButton}
                          onClick={
                            arrivedBlocked
                              ? ignoreUnavailableActivation
                              : () =>
                                  dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId: movement.id })
                          }
                        >
                          Arrived
                        </button>
                      </div>
                      {acceptedBlocked ? (
                        <span id={`ward-officer-accept-unavailable-${movement.id}`} className="sr-only">
                          {acceptedBlocked}
                        </span>
                      ) : null}
                      {enRouteBlocked ? (
                        <span id={`ward-officer-enroute-unavailable-${movement.id}`} className="sr-only">
                          {enRouteBlocked}
                        </span>
                      ) : null}
                      {collectedBlocked ? (
                        <span id={`ward-officer-collect-unavailable-${movement.id}`} className="sr-only">
                          {collectedBlocked}
                        </span>
                      ) : null}
                      {arrivedBlocked ? (
                        <span id={`ward-officer-arrive-unavailable-${movement.id}`} className="sr-only">
                          {arrivedBlocked}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid={`ward-officer-select-${movement.id}`}
                      className={styles.selectButton}
                      onClick={() => setSelectedId(movement.id)}
                    >
                      Work this job
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
