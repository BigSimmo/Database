"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { ClinicalRail, WardModeNavigation } from "@/components/ward-management/ward-management-navigation";
import { movementById, wardMovements } from "@/components/ward-management/ward-movements";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import styles from "./coordinator.module.css";
import { ExceptionDrawer } from "./exception-drawer";
import { FlowDiagram } from "./flow-diagram";
import { PressureStrip } from "./pressure-strip";
import { PriorityQueue } from "./priority-queue";
import { ShortlistPanel } from "./shortlist-panel";

/**
 * Task 3 shell: five landmark regions, all present and stubbed with real synthetic volume
 * (`edPressure` returns 8 departments, `queueOrder` returns 41 open movements) so the layout is
 * judged against real volume rather than three placeholder rows. Task 4 built out the pressure
 * strip and the queue's department filter; Task 5 built the real `PriorityQueue`; Task 6 built
 * the real `FlowDiagram`; Task 7 built the real `ShortlistPanel`; Task 8 built the real
 * `ExceptionDrawer` and the phone form.
 */

// Must match the `@media (max-width: 48rem)` breakpoint in coordinator.module.css that hides
// `.diagramRegion` and `.pressureStrip`. CSS already hides the diagram visually on first paint
// (server-rendered markup cannot know the viewport), but Task 8 review Minor 5 found the
// underlying `FlowDiagram` still MOUNTED underneath that `display: none` — its `useLayoutEffect`,
// `ResizeObserver` and window-resize `measure()` all kept running against a zero-size box. This
// query drives whether `FlowDiagram` mounts at all, so a phone stops paying for work nobody can
// see rather than merely hiding the result of it.
const PHONE_DIAGRAM_MEDIA_QUERY = "(max-width: 48rem)";

export function CoordinatorScreen() {
  const [selectedMovementId, setSelectedMovementId] = useState<string | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const [selectedEdId, setSelectedEdId] = useState<string | undefined>(undefined);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  // SSR and the first client paint must agree (matchMedia is unavailable on the server), so this
  // starts false — the same "assume desktop, correct after mount" convention
  // `usesPhoneSearchLayout` uses in master-search-header.tsx. `useLayoutEffect` (not `useEffect`)
  // keeps the window where `FlowDiagram` is needlessly mounted on a real phone as short as
  // possible — synchronously before the browser paints, rather than after.
  const [isPhoneDiagramLayout, setIsPhoneDiagramLayout] = useState(false);

  useLayoutEffect(() => {
    const phoneMedia = window.matchMedia(PHONE_DIAGRAM_MEDIA_QUERY);
    const sync = () => setIsPhoneDiagramLayout(phoneMedia.matches);
    sync();
    phoneMedia.addEventListener("change", sync);
    return () => phoneMedia.removeEventListener("change", sync);
  }, []);

  // Task 8 review Important 3: on a phone, the full explainable shortlist (candidates, all eight
  // eligibility gates, every decline, the score breakdown) is real, long content — exactly the
  // content Task 7 was built to never truncate — so it does not fit above the fold on a 390px
  // screen. Confirm still has to be reachable in one tap rather than a scroll a coordinator has
  // to go looking for. Scrolling the whole shortlist card into view would not be enough (it can
  // still put Confirm below the fold); this scrolls the Confirm control specifically into the
  // body's own scrollport whenever a phone selection changes, so the "one tap" the brief asks for
  // is the tap that picks the movement, not a second gesture to go find the button afterwards.
  const shortlistColumnRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!isPhoneDiagramLayout || !selectedMovementId) return;
    // A resize-driven viewport change (matchMedia's own "change" event, which is how
    // `isPhoneDiagramLayout` becomes true) can still be mid-reflow — `.main`'s grid rows and
    // `.screen`'s `100dvh` height had not always finished resolving to the NEW viewport yet at
    // the moment this ran synchronously, so a `scrollIntoView` call here could measure a
    // transiently oversized scroll container and land short. One `requestAnimationFrame` defers
    // the scroll to the next paint, after the browser has settled the resize.
    // A single rAF was still not always enough — measured a resize-driven correction landing
    // 256px short of the real target on some runs, meaning the browser's own reflow after a
    // viewport resize can still be mid-flight one frame later. Nesting a second rAF waits for a
    // full additional paint cycle, the same "double rAF" pattern used to guarantee a layout has
    // actually settled before measuring it.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const confirmButton = shortlistColumnRef.current?.querySelector('[data-testid="ward-shortlist-confirm"]');
        confirmButton?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [isPhoneDiagramLayout, selectedMovementId]);

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

  // The exception inbox is the coordinator's global work list, not a view scoped to whatever ED
  // filter the queue happens to have selected — a breached legal deadline at a filtered-out
  // department must not silently drop off the work list just because the queue is filtered.
  // `wardMovements` and `NOW_ANCHOR` are both constants, so this only ever needs to compute once
  // (same reasoning `ward-management-modes.tsx`'s own `buildActionInbox` call already uses).
  const actionInbox = useMemo(() => buildActionInbox(wardMovements, NOW_ANCHOR), []);

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
              {/* Task 8 review Minor 5: `.diagramRegion` is already hidden by CSS below 48rem;
                  this stops `FlowDiagram` from mounting there too, rather than only painting
                  over its (still-running) ResizeObserver and layout-effect work. */}
              {isPhoneDiagramLayout ? null : (
                <FlowDiagram
                  movement={selectedMovement}
                  now={NOW_ANCHOR}
                  selectedUnitId={selectedUnitId}
                  onSelectUnit={(unitId) => setSelectedUnitId((current) => (current === unitId ? undefined : unitId))}
                />
              )}
            </section>

            <div className={styles.shortlistColumn} ref={shortlistColumnRef}>
              <aside className={styles.shortlistRegion} aria-label="Explainable shortlist">
                <header className={styles.regionHeader}>
                  <h2>Explainable shortlist</h2>
                </header>
                <ShortlistPanel
                  movement={selectedMovement}
                  now={NOW_ANCHOR}
                  selectedUnitId={selectedUnitId}
                  onSelectUnit={(unitId) => setSelectedUnitId((current) => (current === unitId ? undefined : unitId))}
                />
              </aside>
            </div>
          </div>
        </div>

        <ExceptionDrawer
          items={actionInbox}
          open={exceptionsOpen}
          onToggle={() => setExceptionsOpen((open) => !open)}
          // Task 8 review Important 3: on a phone the open drawer's own panel is what stands
          // between a coordinator and Confirm — selecting an exception has done the drawer's
          // job (a movement is now chosen), so it closes itself in the same tap rather than
          // leaving a coordinator to scroll past it to reach the shortlist underneath.
          onSelectMovement={(movementId) => {
            setSelectedMovementId(movementId);
            setExceptionsOpen(false);
          }}
        />
      </div>
    </div>
  );
}
