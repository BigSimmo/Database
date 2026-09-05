import type { WardBarSegment } from "@/components/ward-management/ward-bar";
// ⚠️ CORRECTION 4. `Instant` is exported by ward-clock, not ward-model — the plan imported it from
// ward-model, which is a type error the test suite could never have caught, because vitest does not
// typecheck. All seven tests were green with this broken.
import { clockState, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { destinationNoLongerLawful, isOpen, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

export type DelayCause =
  // ⚠️ AUDIT GAP 3 CLOSED. This used to be one cause, `legal_expiring`, covering both
  // `clockState` "breached" (already passed) and "critical" (under an hour, not yet passed).
  // The old exceptions inbox kept these visibly separate — a breach reads as "Legal timing
  // breached" (`buildActionInbox`, ward-derivations.ts) and is a materially worse fact than a
  // clock still running. Merging them lost that distinction with no compensating signal, since a
  // `DelayGroup` carries no per-movement detail a caller could use to tell the two apart. Split
  // back into two causes; `legal_breached` outranks `legal_expiring` in `ORDER` below because a
  // passed deadline is worse than an approaching one.
  | "legal_breached"
  | "legal_expiring"
  | "no_eligible_bed"
  | "awaiting_ward_answer"
  // ⚠️ AUDIT GAP 1 CLOSED. The exceptions inbox's "Bed pull expired" category
  // (`buildActionInbox`, ward-derivations.ts) had no equivalent here: every `stage === "pulled"`
  // movement fell into `awaiting_bed_ready` regardless of whether the hold had lapsed, so an
  // expired reservation was indistinguishable from one still running. Condition mirrored exactly
  // from `buildActionInbox`'s `expiredBedPulls` filter. Ranked above `awaiting_bed_ready` — a
  // lapsed hold is worse than one still counting down.
  | "bed_pull_expired"
  | "awaiting_bed_ready"
  | "awaiting_transport"
  | "patient_or_family"
  | "awaiting_coordinator";

export type DelayGroup = { cause: DelayCause; title: string; note: string; movements: Movement[] };

const ORDER: { cause: DelayCause; title: string; note: string }[] = [
  {
    cause: "legal_breached",
    title: "Legal authority already expired",
    note: "nothing else on this page outranks it",
  },
  {
    cause: "legal_expiring",
    title: "Legal authority running out",
    note: "",
  },
  { cause: "no_eligible_bed", title: "No suitable bed anywhere in the network", note: "" },
  { cause: "awaiting_ward_answer", title: "Awaiting a ward's answer", note: "" },
  { cause: "bed_pull_expired", title: "Bed pull expired", note: "the hold lapsed before the bed was used" },
  { cause: "awaiting_bed_ready", title: "Awaiting the bed itself", note: "each has a named bed" },
  { cause: "awaiting_transport", title: "Awaiting transport", note: "" },
  { cause: "patient_or_family", title: "Patient or family factors", note: "" },
  { cause: "awaiting_coordinator", title: "Awaiting a decision from the coordinator", note: "that is you" },
];

/** Every cause, worst first — the ranking itself, so a caller can reason about position rather than
 *  hand-listing members. Derived from `ORDER`, never a second list. */
export const DELAY_CAUSE_ORDER: readonly DelayCause[] = ORDER.map((entry) => entry.cause);

/**
 * 🔴 **THE CAUSES NOTHING ROUTINE RESOLVES — HERE, BESIDE THE RANKING, BECAUSE THE TWO DISAGREED.**
 *
 * This lived as a hand-written predicate in `delays-screen.tsx`. When `legal_expiring` was split
 * into `legal_breached` + `legal_expiring`, the ranking gained the worse case and that predicate
 * did not — so **the lapsed authority rendered as routine and the merely-approaching one rendered as
 * danger.** The severity was inverted and nothing failed, because no movement in the seed is
 * breached, so the group is empty and the defect is latent.
 *
 * ⚠️ **A string union does not protect you here: every predicate naming members by hand still
 * typechecks after a split.** Keeping the band next to the order it must agree with is the fix;
 * `tests/ward-delays-derivations.test.ts` pins that severity is a contiguous PREFIX of the ranking,
 * so a new cause inserted above the band without being named here goes red.
 */
export const SEVERE_CAUSES: readonly DelayCause[] = ["legal_breached", "legal_expiring", "no_eligible_bed"];

/**
 * ⚠️ **ONE MOVEMENT, ONE CAUSE, FIRST MATCH WINS.** A patient routinely satisfies several of these
 * at once — that is the whole reason the three old screens listed the same people three times. The
 * row sits under the highest-ranked cause and the rest show as state words on the row.
 *
 * ⚠️ **The list is the owner's ruling that a fixed list of delay kinds EXISTS. Its exact membership
 * is a clinical question the owner has NOT ruled on** (design lock §7). Do not add a cause here
 * without asking him.
 *
 * ⚠️ **THREE CONDITIONS HERE DIFFER FROM THE PLAN THAT SPECIFIED THEM, because the plan's versions
 * do not hold against this codebase. Each is named where it is fixed.** They are recorded rather
 * than quietly corrected because two of the three would have emptied a group silently, and an empty
 * group is dropped from the screen — so the failure would have looked like "nothing is wrong in
 * that category" rather than like a defect.
 */
export function delayGroups(movements: Movement[], units: Unit[], now: Instant): DelayGroup[] {
  const causeOf = (movement: Movement): DelayCause => {
    // ⚠️ CORRECTION 1. The plan wrote `clockState(...) !== "ok"`. `ClockState` has no member "ok" —
    // it is "breached" | "critical" | "due" | "clear" — so that comparison is a type error, and had
    // it compiled it would have been true for every movement carrying a dueAt, putting the whole
    // fixture in this group.
    //
    // ⚠️ AND THE REPLACEMENT IS A JUDGEMENT, NOT A MEASUREMENT. "Running out" is read here as
    // breached or critical (already past, or under an hour). "due" — under three hours — is
    // deliberately excluded, because a top group that holds a third of the screen directs the eye
    // nowhere, which is the same failure as flagging every tile amber. The thresholds themselves
    // are `clockState`'s own and are not invented here, but WHICH of them count as "running out"
    // is the plan author's reading and the owner has not ruled on it.
    //
    // ⚠️ AUDIT GAP 3: breached and critical used to collapse into one cause here. They are now
    // two returns instead of one `||`, so a caller can rank and label a passed deadline
    // differently from an approaching one. As of this fixture, no seeded movement's legal form
    // is actually breached or critical (the four `dueAt` values in ward-movements.ts are all
    // "due" or "clear" against NOW_ANCHOR) — both branches are real and reachable, but neither
    // is exercised by today's data. See the test file for how that is proved rather than assumed.
    const legal = movement.legalForm?.dueAt;
    if (legal !== undefined) {
      const state = clockState(legal, now);
      if (state === "breached") return "legal_breached";
      if (state === "critical") return "legal_expiring";
    }

    if (destinationNoLongerLawful(movement, units) !== undefined) return "no_eligible_bed";

    // ⚠️ CORRECTION 2, AND IT IS THE ONE THAT MATTERED. The plan wrote
    // `shortlistCandidates(movement, units, now).length === 0`. That function returns EVERY ward
    // with an honest verdict on each and never a pre-filtered list — its own doc comment says so in
    // capitals — so its length is zero only when the network holds no wards at all. This group
    // would have been permanently empty, and an empty group is dropped, so the two people with
    // nowhere to go would simply not have appeared on the screen built to find them.
    if (movement.acceptedUnitId === undefined) {
      const candidates = shortlistCandidates(movement, units, now);
      if (!candidates.some((candidate) => candidate.availability === "eligible")) return "no_eligible_bed";
    }

    if (movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0) {
      return "awaiting_ward_answer";
    }
    if (movement.stage === "pulled") {
      // ⚠️ AUDIT GAP 1: condition mirrored exactly from `buildActionInbox`'s `expiredBedPulls`
      // filter (ward-derivations.ts) — `stage === "pulled" && pullExpiresAt !== undefined &&
      // pullExpiresAt < now`. Do not let this drift from that one independently; the two screens
      // must agree on which holds count as expired.
      if (movement.pullExpiresAt !== undefined && movement.pullExpiresAt < now) return "bed_pull_expired";
      return "awaiting_bed_ready";
    }
    if (movement.transport !== undefined) return "awaiting_transport";
    // ⚠️ CORRECTION 3. The plan wrote `movement.urgentFlag`. The field is `flaggedUrgent`
    // (ward-model.ts) and `urgentFlag` exists nowhere in this codebase, so the plan's line would
    // not have compiled.
    if (movement.flaggedUrgent) return "patient_or_family";
    return "awaiting_coordinator";
  };

  const open = movements.filter(isOpen);
  return ORDER.map((entry) => ({
    ...entry,
    movements: open.filter((movement) => causeOf(movement) === entry.cause),
  })).filter((group) => group.movements.length > 0);
}

/**
 * ⚠️ AUDIT GAP 2 CLOSED. `delayGroups` above answers "which cause" a movement's legal deadline
 * falls under — a category, not a number. The exceptions inbox it replaces rendered the actual
 * figure (`buildActionInbox`'s `formatRemaining(minutesUntil(dueAt, now))`, ward-derivations.ts),
 * and that number is lost once all a caller can see is which bucket a movement landed in. This
 * returns the raw minutes straight from `minutesUntil` — negative once the deadline has passed,
 * positive while time remains, `undefined` when the movement carries no legal deadline at all
 * (every Form 1A and 3B in this model, per the 2026-08-23 product-owner correction recorded on
 * `LegalForm` in ward-model.ts). Formatting (`formatRemaining`) is deliberately left to the
 * screen, per this task's instruction — this function hands over the fact, not its rendering.
 */
export function legalDeadlineMinutes(movement: Movement, now: Instant): number | undefined {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return undefined;
  return minutesUntil(dueAt, now);
}

/**
 * How long the whole waiting population has waited. One bar, one meaning.
 *
 * ⚠️ Counted from `openedAt`, which today equals arrival in the department because a journey can
 * only be raised where the patient already is. The owner ruled on 2026-09-04 that this clock starts
 * at ARRIVAL, not at referral. The moment a community team can raise a journey directly, `openedAt`
 * becomes a referral time and every figure here silently changes meaning — the fix is a separate
 * arrival instant, never a reinterpretation of `openedAt`, and it is not built yet.
 */
export function waitingSplit(movements: Movement[], now: Instant): WardBarSegment[] {
  const open = movements.filter(isOpen);
  const waited = (movement: Movement) => now - movement.openedAt;
  return [
    { label: "Under 4 hours", value: open.filter((movement) => waited(movement) < 4 * 60).length, tone: "good" },
    {
      label: "4 to 12 hours",
      value: open.filter((movement) => waited(movement) >= 4 * 60 && waited(movement) < 12 * 60).length,
      tone: "warning",
    },
    { label: "Over 12 hours", value: open.filter((movement) => waited(movement) >= 12 * 60).length, tone: "danger" },
  ];
}
