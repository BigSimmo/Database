"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { elapsedLabel } from "@/components/ward-management/ward-derivations";
import { ClinicalRail, WardModeNavigation } from "@/components/ward-management/ward-management-navigation";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import styles from "./coordinator.module.css";

/**
 * Task 3 shell: five landmark regions, all present and all stubbed with the
 * real synthetic counts (`edPressure` returns 8 departments, `queueOrder`
 * returns 41 open movements) so the layout is judged against real volume
 * rather than three placeholder rows. Each region's content is built out by
 * a later task inside this frame.
 */
export function CoordinatorScreen() {
  const [selectedMovementId, setSelectedMovementId] = useState<string | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);

  const pressure = edPressure(NOW_ANCHOR);
  const queue = queueOrder(wardMovements, NOW_ANCHOR);

  return (
    <div className={styles.screen} data-testid="ward-coordinator">
      <ClinicalRail />
      <div className={styles.main}>
        <h1 className="sr-only">Ward Flow coordinator</h1>
        <WardModeNavigation active="command" />

        <div className={styles.governanceBanner} data-testid="ward-coordinator-governance">
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <p>
            This screen is <strong>not a medical device</strong>. It orders operational placement work only — it never
            assesses a patient&apos;s risk, acuity or treatment. A human coordinator confirms or overrides every
            suggestion.
          </p>
        </div>

        <div className={styles.body}>
          <section className={styles.pressureStrip} aria-label="Emergency department pressure">
            <header className={styles.regionHeader}>
              <h2>Emergency department pressure</h2>
              <span className={styles.regionCount}>{pressure.length} departments</span>
            </header>
            <ul className={styles.pressureList}>
              {pressure.map((entry) => (
                <li key={entry.ed.id} className={styles.pressureChip}>
                  <strong>{entry.ed.name}</strong>
                  <span>
                    {entry.waiting} waiting · {entry.longestWaitMinutes} min longest wait
                  </span>
                  {entry.breaching > 0 ? (
                    <span className={styles.pressureBreach}>{entry.breaching} breaching</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <div className={styles.regionGrid} data-testid="ward-coordinator-region-grid">
            <section className={styles.queueRegion} aria-label="Priority queue">
              <header className={styles.regionHeader}>
                <h2>Priority queue</h2>
                <span className={styles.regionCount}>{queue.length} open movements</span>
              </header>
              <ul className={styles.queueList}>
                {queue.map((movement) => (
                  <li key={movement.id}>
                    <button
                      type="button"
                      className={movement.id === selectedMovementId ? styles.queueRowSelected : styles.queueRow}
                      aria-pressed={movement.id === selectedMovementId}
                      onClick={() => setSelectedMovementId(movement.id)}
                    >
                      <strong>{movement.id}</strong>
                      <span>Tier {movement.urgency}</span>
                      <span>{elapsedLabel(movement, NOW_ANCHOR)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.diagramRegion} aria-label="Statewide flow">
              <header className={styles.regionHeader}>
                <h2>Statewide flow</h2>
                {selectedUnitId ? (
                  // Task 6 renders the real network diagram and calls `setSelectedUnitId` from a
                  // unit node click; this button is the one interaction this stub owns itself —
                  // clearing a selection made elsewhere (e.g. from a shortlist row) without
                  // requiring the not-yet-built diagram to be present.
                  <button
                    type="button"
                    className={styles.clearSelectionButton}
                    onClick={() => setSelectedUnitId(undefined)}
                  >
                    Clear unit selection
                  </button>
                ) : null}
              </header>
              <p className={styles.placeholder}>
                {selectedUnitId
                  ? `Network diagram centred on unit ${selectedUnitId}. Built in a later task.`
                  : "Network diagram of the hospital network. Built in a later task."}
              </p>
            </section>

            <div className={styles.shortlistColumn}>
              <aside className={styles.shortlistRegion} aria-label="Explainable shortlist">
                <header className={styles.regionHeader}>
                  <h2>Explainable shortlist</h2>
                </header>
                <p className={styles.placeholder}>
                  {selectedMovementId
                    ? `Shortlist for ${selectedMovementId}. Built in a later task.`
                    : "Select a movement from the priority queue to see its explainable shortlist."}
                </p>
              </aside>
            </div>
          </div>
        </div>

        <div className={styles.exceptionsDrawer} data-open={exceptionsOpen}>
          <button
            type="button"
            className={styles.exceptionsToggle}
            aria-expanded={exceptionsOpen}
            onClick={() => setExceptionsOpen((open) => !open)}
          >
            {exceptionsOpen ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
            <span>Exceptions</span>
          </button>
          {exceptionsOpen ? <p className={styles.placeholder}>Exceptions inbox. Built in a later task.</p> : null}
        </div>
      </div>
    </div>
  );
}
