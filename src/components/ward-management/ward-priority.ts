// src/components/ward-management/ward-priority.ts
import { clockState, minutesUntil, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

export type ScoreFactor = { label: string; points: number; detail: string };

/**
 * The fixture carries exactly two "nothing to see here" shapes for `movement.blocker`: the
 * literal `"No blocker"` on generated movements, and `"None — …"` (an em dash separator) on
 * three hand-authored ones. Matching any value that merely starts with "None" is too wide — it
 * would also swallow a real blocker like "None of the secure units can take him" — so this only
 * recognises the exact sentinel, or "None" followed by end-of-string or a dash/colon separator.
 */
function hasActiveBlocker(blocker: string): boolean {
  const trimmed = blocker.trim();
  if (trimmed === "No blocker") return false;
  if (/^None(?:$|\s*[-–—:])/.test(trimmed)) return false;
  return trimmed.length > 0;
}

/**
 * How badly this movement is going — an operations question, not a clinical one.
 *
 * Deliberately blind to `movement.urgency`. Urgency is the clinician's judgement and orders the
 * queue on its own; folding it in here produced a number labelled "not clinical severity" that
 * partly was, which is why the previous score was deleted rather than migrated.
 *
 * Also deliberately blind to `movement.examination`. Whether a patient has been reviewed does not
 * score here at all: on the product owner's 2026-08-24 instruction, priority is urgency and
 * waiting time alone, and being unreviewed neither costs points nor blocks a bed request. The
 * examination record itself is untouched — it is still captured and still displayed; it simply has
 * no effect on the queue. Do not reintroduce it here in any weight, and do not substitute a proxy.
 */
export function operationalScore(movement: Movement, now: Instant): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];

  const waitedMinutes = Math.max(0, now - movement.openedAt);
  const waitPoints = Math.min(40, Math.floor(waitedMinutes / 15));
  if (waitPoints > 0) {
    factors.push({
      label: "Time waiting",
      points: waitPoints,
      detail: `${splitDuration(waitedMinutes)} since the placement request`,
    });
  }

  // DORMANT FOR 1A/3B ONLY as of the 2026-08-23 product-owner correction: neither code carries
  // a `dueAt` any longer (see `LegalForm`'s own doc comment in ward-model.ts), so this block can
  // no longer award "Statutory timing" points on their account, and a patient referred for (or
  // awaiting) examination has their priority ride on "Time waiting" above alone — exactly the
  // clinician's own rule, with no compensating bonus for carrying a legal form, which would be
  // an unsupported clinical claim of the same kind this correction removes. This block is NOT
  // fully dormant, though: the transport/transfer forms (4A/4C) are out of scope for this
  // correction, still carry a real `dueAt`, and still legitimately score here today (e.g.
  // WF-006, WF-014 in the fixture, each "due in ≤90 min" at `NOW_ANCHOR`). The 1A/3B branch is
  // kept live, not deleted, on the same precedent Task 6A set for a Form 3B: a real examination
  // timeframe may be supplied later and should return as a derivation, not a rewritten function.
  const legalForm = movement.legalForm;
  if (legalForm?.dueAt !== undefined) {
    const dueAt = legalForm.dueAt;
    const state = clockState(dueAt, now);
    const points = state === "breached" ? 30 : state === "critical" ? 20 : state === "due" ? 10 : 0;
    if (points > 0) {
      const remaining = minutesUntil(dueAt, now);
      factors.push({
        label: "Statutory timing",
        points,
        detail:
          remaining < 0
            ? `Form ${legalForm.code} passed its deadline ${Math.abs(remaining)} min ago`
            : `Form ${legalForm.code} due in ${remaining} min`,
      });
    }
  }

  if (movement.declines.length > 0) {
    const points = Math.min(15, movement.declines.length * 5);
    // `declines.length` is a cumulative historical count and `PARALLEL_REFERRAL_CAP` limits
    // simultaneous *live* referrals — they do not share a denominator (see the comment on
    // `buildActionInbox` in ward-derivations.ts), so state only the count, not a fraction.
    factors.push({
      label: "Destinations declined",
      points,
      detail: `${movement.declines.length} destination${movement.declines.length === 1 ? " has" : "s have"} declined`,
    });
  }

  if (hasActiveBlocker(movement.blocker)) {
    factors.push({ label: "Active blocker", points: 10, detail: movement.blocker });
  }

  if (
    movement.transport &&
    movement.transport.acceptedAt !== undefined &&
    movement.transport.enRouteAt === undefined &&
    movement.transport.collectedAt === undefined &&
    movement.transport.cancelledAt === undefined
  ) {
    factors.push({ label: "Transport delay", points: 5, detail: "Accepted but not yet collected" });
  }

  const score = Math.min(
    100,
    factors.reduce((sum, factor) => sum + factor.points, 0),
  );
  return { score, factors };
}

/** Urgency tier leads; the operational score only orders movements inside a tier. */
export function queueOrder(movements: Movement[], now: Instant): Movement[] {
  return movements
    .filter(isOpen)
    .sort((a, b) => a.urgency - b.urgency || operationalScore(b, now).score - operationalScore(a, now).score);
}
