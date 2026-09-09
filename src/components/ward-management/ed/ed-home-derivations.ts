// src/components/ward-management/ed/ed-home-derivations.ts
import { minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  ED_ACCESS_TARGET_MINUTES,
  type EmergencyDepartment,
  type HealthService,
  type LegalStatus,
  type Movement,
} from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ THE POPULATION THIS SCREEN COUNTS IS MOVEMENTS, NEVER REFERRALS — RULED, NOT GUESSED.
 *
 * The ED hub (`ed-screen.tsx`, one department at a time) was found counting REFERRALS raised
 * from a department — each row one referral addressed to it — while this screen counted
 * MOVEMENTS: a person's own open journey from an emergency department toward a psychiatric bed
 * (`Movement.originEdId`, `Movement.openedAt`, `isOpen`). **Those are different populations and
 * they disagreed on the same day for the same department** — a movement can exist with no
 * referral yet raised, and a referral can exist for someone no movement has been opened for.
 *
 * **Owner ruling, 2026-09-04: the population is the patient physically present, awaiting a bed —
 * the movement-based set — and the ED hub is being told the same, so the two screens agree by
 * construction rather than by fixture.** The reason given is clinical: "waiting for a psychiatric
 * bed" describes a person in a department, not a piece of paperwork, and a patient can be waiting
 * before any referral exists — the worst case this screen exists to surface, not an edge case. A
 * referral-keyed view has no row to hang that on. So a movement is the unit.
 *
 * ⚠️ **The ruling's first draft went on to say referral state — including its absence — becomes
 * an attribute of that person's row. That clause was corrected the same day: see the note on
 * "NOBODY IS LOOKING FOR A BED" below, which is why this screen counts NOTHING about
 * `referredUnitIds` or `declines`.**
 *
 * Every count on this screen is captioned with that population explicitly, in words, on every
 * panel that carries one (see `ed-home.tsx`/`ed-service-bands.tsx` and
 * `tests/ward-ed-home.dom.test.tsx`'s population-wording assertions) — precisely so a reader who
 * clicks through to a department's own hub is never surprised by a different number with no
 * explanation.
 */
export const ED_HOME_POPULATION_NOTE =
  "Every number on this screen counts the patient physically present in the department, awaiting an inpatient bed — never a referral raised for them. That is the model's `Movement` record (an open journey from this department toward a bed), deliberately never a referral count: a patient can be waiting before any referral exists, and a referral-keyed view has no row for that — the very state a coordinator most needs to see. Ruled 2026-09-04 so both this screen and a department's own hub count the same population by construction.";

/**
 * "Detained under the Act" — the two legal statuses that place a person under the Mental Health
 * Act's authority right now. "Voluntary" carries none, and "Referred for psychiatric examination"
 * is a referral for assessment that has not yet resulted in detention (see `LegalStatus`'s own
 * doc comment in `ward-model.ts`) — so it stays out of this set even though it names a psychiatric
 * referral. A movement whose legal status is neither of these two is not counted as detained.
 */
const DETAINED_LEGAL_STATUSES: readonly LegalStatus[] = ["Detained awaiting examination", "Involuntary inpatient"];

export function isDetainedUnderTheAct(legalStatus: LegalStatus): boolean {
  return DETAINED_LEGAL_STATUSES.includes(legalStatus);
}

/**
 * ⚠️ THIS SCREEN DELIBERATELY DOES NOT COUNT "NOBODY IS LOOKING FOR A BED" — CORRECTED RULING,
 * 2026-09-04, AND IT IS A FINDING, NOT A STYLE CHOICE.
 *
 * A first draft of this screen counted `referredUnitIds.length === 0 && declines.length > 0` as
 * "declined by every ward, nobody now looking" — mirroring `handoverSnapshot`'s own
 * `declinedByAll` group in `ward-derivations.ts`. That predicate is real and correctly grounded
 * (WF-009 in `ward-movements.ts` is a genuine, hand-authored case of it), but the SAME shape of
 * claim was independently found broken one field over: `Movement.referralId`, read through
 * `referralForMovement`, is unset on every one of the twenty hand-seeded movements, so a screen
 * trusting its absence to mean "nobody has raised a referral" would report that for every patient
 * everywhere — a maximum-urgency claim, entirely fabricated, with every value honestly derived and
 * every test green.
 *
 * The ruling generalises rather than special-cases the one broken field: **an absence that could
 * mean "genuinely nobody is looking" OR "this record predates the field" OR "not yet actioned"
 * renders identically, and only the first is clinical.** This screen cannot tell those apart for
 * `referredUnitIds`/`declines` any more confidently than for `referralId` — most of
 * `routineMovements()`'s generated bulk never touches either field, so an aggregate "nobody
 * looking" figure here would be true for a handful of deliberately-authored fixture rows and
 * silent (not zero — MISSING) for everything else, which reads as "mostly fine" rather than
 * "not measured." **So: no figure, chip or banner anywhere on this screen claims that nobody is
 * looking for a bed, or counts a movement toward any total on that basis.** A movement's
 * `referredUnitIds` and `declines` are not read by this module at all. The owner has separately
 * been given this as a finding — whether the system CAN reliably say "nobody is looking for a
 * bed" is a data-gap question for him, not a design one this screen may answer in the meantime.
 */

/** Elapsed minutes since a movement opened, clamped at zero — a movement authored with a future
 *  `openedAt` must never surface as a negative wait. Mirrors `edPressure`'s own clamp exactly. */
export function elapsedOpenMinutes(movement: Pick<Movement, "openedAt">, now: Instant): number {
  return Math.max(0, minutesUntil(now, movement.openedAt));
}

export type EdSummary = {
  ed: EmergencyDepartment;
  service: HealthService;
  siteName: string;
  /** The open movements this summary was computed from, kept so a caller (the hero patient
   *  list, if one is ever added) never has to re-filter the network to get back to them. */
  open: Movement[];
  waiting: number;
  longestWaitMinutes: number;
  detained: number;
  pastAccessTarget: number;
  /** Both at once — detained under the Act AND past the department's own access target. A real,
   *  compounding constraint (an authorised bed is already the narrower search, and now urgent
   *  too), never an aggregate across unlike quantities: it shares its denominator (this
   *  department's own `waiting`) with every other patient-count tile on this screen. */
  detainedAndPastAccessTarget: number;
};

function healthServiceOf(ed: EmergencyDepartment): HealthService {
  const site = siteByCode(ed.siteCode);
  if (!site) throw new Error(`ed-home-derivations: no site found for code ${ed.siteCode}`);
  return site.service;
}

function siteNameOf(ed: EmergencyDepartment): string {
  const site = siteByCode(ed.siteCode);
  if (!site) throw new Error(`ed-home-derivations: no site found for code ${ed.siteCode}`);
  return site.name;
}

/**
 * One summary per real emergency department (`allEmergencyDepartments()` — the ED collection
 * itself, never a walk over hospitals, which would silently drop Joondalup and Peel, the two
 * sites with an ED and no inpatient ward). Every count is derived from `movements`; nothing here
 * is a literal.
 */
export function edHomeSummaries(movements: readonly Movement[], now: Instant): EdSummary[] {
  return allEmergencyDepartments().map((ed) => {
    const open = movements.filter((movement) => isOpen(movement) && movement.originEdId === ed.id);
    const elapsed = open.map((movement) => elapsedOpenMinutes(movement, now));
    return {
      ed,
      service: healthServiceOf(ed),
      siteName: siteNameOf(ed),
      open,
      waiting: open.length,
      longestWaitMinutes: elapsed.length ? Math.max(...elapsed) : 0,
      detained: open.filter((movement) => isDetainedUnderTheAct(movement.legalStatus)).length,
      pastAccessTarget: elapsed.filter((minutes) => minutes >= ED_ACCESS_TARGET_MINUTES).length,
      detainedAndPastAccessTarget: open.filter(
        (movement, index) => isDetainedUnderTheAct(movement.legalStatus) && elapsed[index] >= ED_ACCESS_TARGET_MINUTES,
      ).length,
    };
  });
}

/** The single longest-open movement network-wide, with the department it belongs to — never a
 *  per-department maximum, because the totals strip's "Longest single wait" names ONE patient at
 *  ONE department, not each department's own worst case. Computed inline by `edHomeTotals`,
 *  which is the only caller and needs `now` to do it. */
export type NetworkLongestWait = { movement: Movement; summary: EdSummary; waitMinutes: number };

export type EdHomeTotals = {
  waiting: number;
  detained: number;
  detainedAndPastAccessTarget: number;
  departmentsPastAccessTarget: EdSummary[];
  longestWait?: NetworkLongestWait;
};

export function edHomeTotals(summaries: readonly EdSummary[], now: Instant): EdHomeTotals {
  let longestWait: NetworkLongestWait | undefined;
  for (const summary of summaries) {
    for (const movement of summary.open) {
      const waitMinutes = elapsedOpenMinutes(movement, now);
      if (longestWait === undefined || waitMinutes > longestWait.waitMinutes) {
        longestWait = { movement, summary, waitMinutes };
      }
    }
  }
  return {
    waiting: summaries.reduce((sum, summary) => sum + summary.waiting, 0),
    detained: summaries.reduce((sum, summary) => sum + summary.detained, 0),
    detainedAndPastAccessTarget: summaries.reduce((sum, summary) => sum + summary.detainedAndPastAccessTarget, 0),
    departmentsPastAccessTarget: summaries.filter((summary) => summary.pastAccessTarget > 0),
    longestWait,
  };
}

/**
 * Worst first, per the approved design's own stated ranking rule, adjusted for the corrected
 * ruling above: a passed access-target breach outranks everything (the one legal/departmental
 * deadline this screen may state), then the number of patients detained under the Act — a real
 * severity signal that narrows which wards can even be asked — then raw volume. Never "declined
 * by every ward": that figure is not computed by this module at all (see the note above).
 * Returns `undefined` only when there are no departments at all, which never happens against the
 * real ED collection.
 */
export function worstEdSummary(summaries: readonly EdSummary[]): EdSummary | undefined {
  if (summaries.length === 0) return undefined;
  return [...summaries].sort(
    (a, b) =>
      Number(b.pastAccessTarget > 0) - Number(a.pastAccessTarget > 0) ||
      b.detained - a.detained ||
      b.waiting - a.waiting,
  )[0];
}

/**
 * East Metro, then North Metro, then South Metro — the approved design's own band order.
 * Deliberately NOT `wardServiceOrder` (`ward-derivations.ts`, North/East/South): that constant is
 * the app's general listing order and this screen's three-band layout was approved in a different
 * order. Restricted to the three services a real ED ever sits in; WACHS and Private carry none.
 */
export const ED_HOME_SERVICE_BAND_ORDER: readonly HealthService[] = ["East Metro", "North Metro", "South Metro"];

export type ServiceBand = { service: HealthService; departments: EdSummary[] };

export function groupByHealthService(summaries: readonly EdSummary[]): ServiceBand[] {
  return ED_HOME_SERVICE_BAND_ORDER.map((service) => ({
    service,
    departments: summaries.filter((summary) => summary.service === service),
  }));
}

/** `of 8 departments` / `of 1 department` — the population-naming rule Task 5 exists for, applied
 *  everywhere a figure states an "N of M" fraction so no two collide on a bare `of N`. */
export function ofPopulation(total: number, noun: string): string {
  return `of ${total} ${total === 1 ? noun : `${noun}s`}`;
}
