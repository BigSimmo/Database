"use client";

import { clockState } from "@/components/ward-management/ward-clock";
import { elapsedLabel } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { operationalScore } from "@/components/ward-management/ward-priority";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import styles from "./coordinator.module.css";

type PriorityQueueProps = {
  movements: Movement[];
  selectedId: string | undefined;
  onSelect: (movementId: string) => void;
  filterEdId: string | undefined;
  onClearFilter: () => void;
};

/**
 * Urgency tier text carries its own direction on every row (Task 5 ruling 2). With 16 tier-1,
 * 13 tier-2 and 12 tier-3 open movements, long runs of the same bare "Tier 1" badge are the
 * normal case and tell a coordinator nothing about which end of the scale that is. Tier 1 is
 * the clinician's most urgent judgement; tier 3 the least. `queueOrder` never lets the
 * operational score below reorder across a tier boundary — the score only breaks ties inside
 * one tier.
 */
const TIER_QUALIFIER: Record<Movement["urgency"], string> = {
  1: "most urgent",
  2: "urgent",
  3: "least urgent",
};

/**
 * The seven fields this column must carry at a fixed 14rem width (Task 5 ruling 1): movement
 * id, tier badge, elapsed wait, cohort, security, origin department and the operational score.
 * The column stays fixed so Task 6's three-column network diagram keeps its space; the row
 * grows taller instead of the column growing wider — five short lines rather than one cramped
 * one. The origin department renders as `siteCode` (e.g. "RPH"), never `ed.name`, which runs to
 * 50 characters on this fixture and would blow out the column on its own.
 */
export function PriorityQueue({ movements, selectedId, onSelect, filterEdId, onClearFilter }: PriorityQueueProps) {
  // A one-line lookup keyed on a field the model already carries (`filterEdId`) — the same
  // reasoning `coordinator-screen.tsx` uses for its own ED lookup — not a derivation that
  // belongs in a ward-*.ts module. If the id it was given cannot be resolved, say so rather than
  // silently dropping the filter notice or naming the wrong department.
  const filterEd = filterEdId ? allEmergencyDepartments().find((ed) => ed.id === filterEdId) : undefined;

  return (
    <section className={styles.queueRegion} aria-label="Priority queue">
      <header className={styles.regionHeader}>
        <h2>Priority queue</h2>
        <span className={styles.regionCount}>{movements.length} open movements</span>
        {filterEdId ? (
          <p className={styles.filterNotice}>
            <span>
              {filterEd ? `Filtered to ${filterEd.siteCode} — ${filterEd.name}` : "Filtered — department unavailable"}
            </span>
            <button type="button" className={styles.clearSelectionButton} onClick={onClearFilter}>
              Clear filter
            </button>
          </p>
        ) : null}
      </header>
      <ul className={styles.queueList}>
        {movements.map((movement) => {
          const selected = movement.id === selectedId;
          // Same one-line lookup reasoning as `filterEd` above, keyed on
          // `Movement.originEdId`. An unresolved id renders as an explicit absence, never a
          // substituted department (Task 5 ruling 1).
          const originEd = allEmergencyDepartments().find((ed) => ed.id === movement.originEdId);
          const originLabel = originEd ? originEd.siteCode : "Unknown ED";
          const { score, factors } = operationalScore(movement, NOW_ANCHOR);
          // `clockState` (not the presence of a factor) is the source of truth for "is this
          // breached" — the factor list is scoped to Task 7's expandable shortlist, not this
          // row, but a breached statutory deadline is the one thing this row must never let a
          // coordinator miss, so it always renders here regardless of what Task 7 later shows.
          const legalBreached =
            movement.legalForm !== undefined && clockState(movement.legalForm.dueAt, NOW_ANCHOR) === "breached";
          const legalFactor = factors.find((factor) => factor.label === "Statutory timing");

          return (
            <li key={movement.id}>
              <button
                type="button"
                data-testid={`ward-queue-row-${movement.id}`}
                data-origin-ed={movement.originEdId}
                className={selected ? styles.queueRowSelected : styles.queueRow}
                aria-pressed={selected}
                onClick={() => onSelect(movement.id)}
              >
                <strong>{movement.id}</strong>
                <span className={styles.queueTier} data-tier={movement.urgency}>
                  Tier {movement.urgency} · {TIER_QUALIFIER[movement.urgency]}
                </span>
                <span>{elapsedLabel(movement, NOW_ANCHOR)}</span>
                <span>
                  {movement.cohort} · {movement.security} · {originLabel}
                </span>
                {/* Labelled "Operational" — this is how badly the movement is going
                    operationally, never a restatement of clinical severity, acuity or risk. */}
                <span className={styles.queueScore}>Operational {score}</span>
                {legalBreached ? (
                  <span className={styles.queueLegalBreach}>
                    {legalFactor ? legalFactor.detail : "Legal deadline breached"}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
