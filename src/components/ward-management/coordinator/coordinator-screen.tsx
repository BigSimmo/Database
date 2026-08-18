"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { ClinicalRail, WardModeNavigation } from "@/components/ward-management/ward-management-navigation";
import { movementById, wardMovements } from "@/components/ward-management/ward-movements";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import styles from "./coordinator.module.css";
import { FlowDiagram } from "./flow-diagram";
import { PressureStrip } from "./pressure-strip";
import { PriorityQueue } from "./priority-queue";

/**
 * Task 3 shell: five landmark regions, all present and stubbed with real synthetic volume
 * (`edPressure` returns 8 departments, `queueOrder` returns 41 open movements) so the layout is
 * judged against real volume rather than three placeholder rows. Task 4 built out the pressure
 * strip and the queue's department filter; Task 5 built the real `PriorityQueue`; Task 6 built
 * the real `FlowDiagram`. The explainable shortlist is built by a later task.
 */
export function CoordinatorScreen() {
  const [selectedMovementId, setSelectedMovementId] = useState<string | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const [selectedEdId, setSelectedEdId] = useState<string | undefined>(undefined);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);

  // `movementById` returns `undefined` for an id the fixture cannot resolve — the diagram
  // receiving `undefined` renders the network with nothing routed rather than a guessed
  // selection (Task 6 conservative-failure rule), so no fallback is threaded through here.
  const selectedMovement = selectedMovementId ? movementById(selectedMovementId) : undefined;

  const selectedEd = selectedEdId ? allEmergencyDepartments().find((ed) => ed.id === selectedEdId) : undefined;
  // A `selectedEdId` this lookup cannot name must not leave the queue silently filtered with no
  // notice and no Clear control (Task 4 review Minor 8) — fall back to "nothing selected" rather
  // than substituting a record or keeping a filter active that can't be described on screen.
  const activeEdId = selectedEd?.id;
  // A one-line filter, not a derivation: it keys on a field the model already carries
  // (`Movement.originEdId`), so it belongs here rather than in a ward-*.ts module.
  const filteredMovements = activeEdId
    ? wardMovements.filter((movement) => movement.originEdId === activeEdId)
    : wardMovements;
  const queue = queueOrder(filteredMovements, NOW_ANCHOR);

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
          <PressureStrip now={NOW_ANCHOR} selectedEdId={selectedEdId} onSelectEd={setSelectedEdId} />

          <div className={styles.regionGrid} data-testid="ward-coordinator-region-grid">
            <PriorityQueue
              movements={queue}
              now={NOW_ANCHOR}
              selectedId={selectedMovementId}
              onSelect={setSelectedMovementId}
              filterEdId={activeEdId}
              onClearFilter={() => setSelectedEdId(undefined)}
            />

            <section className={styles.diagramRegion} aria-label="Statewide flow">
              <header className={styles.regionHeader}>
                <h2>Statewide flow</h2>
                {selectedUnitId ? (
                  <button
                    type="button"
                    className={styles.clearSelectionButton}
                    onClick={() => setSelectedUnitId(undefined)}
                  >
                    Clear unit selection
                  </button>
                ) : null}
              </header>
              <FlowDiagram
                movement={selectedMovement}
                now={NOW_ANCHOR}
                selectedUnitId={selectedUnitId}
                onSelectUnit={(unitId) => setSelectedUnitId((current) => (current === unitId ? undefined : unitId))}
              />
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
