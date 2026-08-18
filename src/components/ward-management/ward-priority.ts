// src/components/ward-management/ward-priority.ts
import { clockState, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { PARALLEL_REFERRAL_CAP, type Movement } from "@/components/ward-management/ward-model";

export type ScoreFactor = { label: string; points: number; detail: string };

/**
 * The fixture carries two "nothing to see here" sentinels for `movement.blocker`: the 30
 * generated movements use the literal `"No blocker"`, while three hand-authored movements
 * (a status update mid-transport, a completed handover) instead read `"None — …"`. Both must
 * be recognised as "no blocker", or the "Active blocker" factor would render a false claim.
 */
function hasActiveBlocker(blocker: string): boolean {
  const trimmed = blocker.trim();
  if (trimmed.toLowerCase() === "no blocker") return false;
  if (trimmed.toLowerCase().startsWith("none")) return false;
  return trimmed.length > 0;
}

/**
 * How badly this movement is going — an operations question, not a clinical one.
 *
 * Deliberately blind to `movement.urgency`. Urgency is the clinician's judgement and orders the
 * queue on its own; folding it in here produced a number labelled "not clinical severity" that
 * partly was, which is why the previous score was deleted rather than migrated.
 */
export function operationalScore(movement: Movement, now: Instant): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];

  const waitedMinutes = Math.max(0, now - movement.openedAt);
  const waitPoints = Math.min(40, Math.floor(waitedMinutes / 15));
  if (waitPoints > 0) {
    factors.push({
      label: "Time waiting",
      points: waitPoints,
      detail: `${Math.floor(waitedMinutes / 60)}h ${waitedMinutes % 60}m since the placement request`,
    });
  }

  if (movement.legalForm) {
    const state = clockState(movement.legalForm.dueAt, now);
    const points = state === "breached" ? 30 : state === "critical" ? 20 : state === "due" ? 10 : 0;
    if (points > 0) {
      const remaining = minutesUntil(movement.legalForm.dueAt, now);
      factors.push({
        label: "Statutory timing",
        points,
        detail:
          remaining < 0
            ? `Form ${movement.legalForm.code} passed its deadline ${Math.abs(remaining)} min ago`
            : `Form ${movement.legalForm.code} due in ${remaining} min`,
      });
    }
  }

  if (movement.declines.length > 0) {
    const points = Math.min(15, movement.declines.length * 5);
    factors.push({
      label: "Destinations declined",
      points,
      detail: `${movement.declines.length} of ${PARALLEL_REFERRAL_CAP} parallel referrals declined`,
    });
  }

  if (hasActiveBlocker(movement.blocker)) {
    factors.push({ label: "Active blocker", points: 10, detail: movement.blocker });
  }

  if (movement.transport && !movement.transport.collectedAt && movement.transport.acceptedAt !== undefined) {
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
    .slice()
    .sort((a, b) => a.urgency - b.urgency || operationalScore(b, now).score - operationalScore(a, now).score);
}
