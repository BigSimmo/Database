"use client";

import { Network } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import {
  destinationUnit,
  eligibleCandidates,
  unitCapacity,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import { PARALLEL_REFERRAL_CAP, type Movement } from "@/components/ward-management/ward-model";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { allUnits, siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./coordinator.module.css";

type FlowDiagramProps = {
  movement: Movement | undefined;
  now: Instant;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
};

type Point = { x: number; y: number };
type ConnectorKind = "demand" | "route";
type Connector = { id: string; path: string; kind: ConnectorKind };

/** Elbow: leave the source edge, run along a mid trunk, then enter the target edge. Same shape
 * as the Phase 1 network diagram's connector, kept identical rather than reinvented so the two
 * read as one visual language. */
function elbowPath(from: Point, to: Point) {
  const trunk = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} H ${trunk} V ${to.y} H ${to.x}`;
}

function capabilityLabel(unit: { security: string; cohort: string; beds: number }) {
  return `${unit.security} · ${unit.cohort} · ${unit.beds} beds`;
}

/**
 * The reshape the spec asks for: demand enters left from the eight emergency departments,
 * passes through a statewide-flow hub in the centre, and lands right on the 22 inpatient units,
 * grouped by health service. Departments are always shown (ordered worst-first by `edPressure`)
 * and always connected to the hub — that part of the network exists regardless of what a
 * coordinator has selected. Routes from the hub to specific units only appear once a movement is
 * selected, and only to that movement's own shortlist; with nothing selected, this renders the
 * network with nothing routed rather than a guessed selection (ruling: display less rather than
 * something plausible).
 *
 * Connector paths are computed from real DOM geometry (ruling 4), never from hard-coded
 * percentages — a percentage-based layout looks right at exactly one viewport width and is wrong
 * at every other. `measure` reads `getBoundingClientRect` on the canvas, the hub and every node,
 * and reruns on a `ResizeObserver` plus a window resize listener, so the diagram survives a
 * resize rather than only ever being screenshotted once.
 */
export function FlowDiagram({ movement, now, selectedUnitId, onSelectUnit }: FlowDiagramProps) {
  const pressure = useMemo(() => edPressure(now), [now]);
  const shortlist = useMemo(
    () => (movement ? eligibleCandidates(movement, now, PARALLEL_REFERRAL_CAP) : []),
    [movement, now],
  );
  const routedUnitIds = useMemo(() => new Set(shortlist.map((candidate) => candidate.unit.id)), [shortlist]);
  const originEdId = movement?.originEdId;
  // Consumed per the brief's interface list: the movement's actual recorded destination (from an
  // acceptance or a live referral), which is a real fact about the movement, distinct from the
  // freshly-computed eligibility shortlist above — a unit can be the recorded destination without
  // being top-3 eligible right now, or vice versa. Marked on its node as a fact, not a suggestion.
  const recordedDestinationId = movement ? destinationUnit(movement)?.id : undefined;

  // Grouped by health service in `wardServiceOrder`, one lookup per unit (22 units — cheap).
  // `siteByCode` returning `undefined` for a broken site code excludes that unit from every
  // group rather than guessing one — conservative failure, not a crash.
  const serviceGroups = useMemo(
    () =>
      wardServiceOrder
        .map((service) => ({
          service,
          units: allUnits().filter((unit) => siteByCode(unit.siteCode)?.service === service),
        }))
        .filter((group) => group.units.length > 0),
    [],
  );

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);
  const edRefs = useRef(new Map<string, HTMLElement | null>());
  const unitRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const registerEdNode = useCallback((id: string, node: HTMLElement | null) => {
    edRefs.current.set(id, node);
  }, []);
  const registerUnitNode = useCallback((id: string, node: HTMLButtonElement | null) => {
    unitRefs.current.set(id, node);
  }, []);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const hub = hubRef.current;
    if (!canvas || !hub) return;
    const base = canvas.getBoundingClientRect();
    const hubBox = hub.getBoundingClientRect();
    const hubLeft: Point = { x: hubBox.left - base.left, y: hubBox.top - base.top + hubBox.height / 2 };
    const hubRight: Point = { x: hubBox.right - base.left, y: hubLeft.y };
    const next: Connector[] = [];

    for (const row of pressure) {
      const node = edRefs.current.get(row.ed.id);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const from: Point = { x: box.right - base.left, y: box.top - base.top + box.height / 2 };
      next.push({ id: `demand-${row.ed.id}`, path: elbowPath(from, hubLeft), kind: "demand" });
    }

    for (const candidate of shortlist) {
      const node = unitRefs.current.get(candidate.unit.id);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const to: Point = { x: box.left - base.left, y: box.top - base.top + box.height / 2 };
      next.push({ id: `route-${candidate.unit.id}`, path: elbowPath(hubRight, to), kind: "route" });
    }

    setConnectors(next);
  }, [pressure, shortlist]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(canvas);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div className={styles.diagramCanvas} ref={canvasRef}>
      {/* `aria-hidden` + `pointer-events: none`: this layer is a rendering of the relationships
          the node buttons below already carry in their own attributes, never itself a target. */}
      <svg className={styles.diagramConnectors} aria-hidden="true">
        <defs>
          <marker
            id="ward-flow-diagram-arrow-demand"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowDemand} />
          </marker>
          <marker id="ward-flow-diagram-arrow-route" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowRoute} />
          </marker>
        </defs>
        {connectors.map((connector) => (
          <path
            key={connector.id}
            d={connector.path}
            className={connector.kind === "route" ? styles.diagramConnectorRoute : styles.diagramConnectorDemand}
            markerEnd={
              connector.kind === "route"
                ? "url(#ward-flow-diagram-arrow-route)"
                : "url(#ward-flow-diagram-arrow-demand)"
            }
          />
        ))}
      </svg>

      {/* The node container is `pointer-events: none`; only the interactive unit buttons below
          re-enable `pointer-events: auto`. Without this the full-canvas overlay swallows clicks
          on everything beneath it — the exact defect Phase 1's network diagram cost an hour on. */}
      <div className={styles.diagramNodes}>
        <div className={styles.diagramDepartmentsColumn}>
          <h3 className={styles.diagramColumnHeading}>Emergency departments</h3>
          <ul className={styles.diagramDepartmentsList}>
            {pressure.map((row) => {
              const isOrigin = originEdId === row.ed.id;
              return (
                <li key={row.ed.id}>
                  <div
                    ref={(node) => registerEdNode(row.ed.id, node)}
                    className={styles.diagramEdCard}
                    data-testid={`ward-diagram-ed-${row.ed.id}`}
                    data-origin={isOrigin ? "true" : undefined}
                  >
                    <span className={styles.diagramEdCode}>{row.ed.siteCode}</span>
                    <span className={styles.diagramEdName}>{row.ed.name}</span>
                    <span className={styles.diagramEdStats}>
                      {row.waiting === 0 ? "No patients waiting" : `${row.waiting} waiting`}
                    </span>
                    {isOrigin ? <span className={styles.diagramOriginBadge}>Origin</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.diagramHub} ref={hubRef}>
          <Network aria-hidden="true" />
          <strong>Statewide flow hub</strong>
          {movement ? (
            <span>
              Routing {movement.id} to {shortlist.length} shortlisted unit{shortlist.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span>Select a movement from the priority queue to route it</span>
          )}
        </div>

        <div className={styles.diagramUnitsColumn}>
          <h3 className={styles.diagramColumnHeading}>Inpatient units</h3>
          {serviceGroups.map((group) => (
            <section key={group.service} className={styles.diagramServiceGroup}>
              <h4 className={styles.diagramServiceHeading}>{group.service}</h4>
              <div className={styles.diagramUnitGrid}>
                {group.units.map((unit) => {
                  const capacity = unitCapacity(unit);
                  const routed = routedUnitIds.has(unit.id);
                  const selected = selectedUnitId === unit.id;
                  const isDestination = recordedDestinationId === unit.id;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      ref={(node) => registerUnitNode(unit.id, node)}
                      className={selected ? styles.diagramUnitSelected : styles.diagramUnit}
                      data-testid={`ward-diagram-unit-${unit.id}`}
                      data-routed={routed ? "true" : undefined}
                      data-destination={isDestination ? "true" : undefined}
                      aria-pressed={selected}
                      onClick={() => onSelectUnit(unit.id)}
                    >
                      {/* No `aria-label` here: it would override the accessible name computed
                          from this content and hide every figure below from a screen reader —
                          the exact defect Task 4 found on the pressure strip. Every figure is
                          plain visible text instead. */}
                      <span className={styles.diagramUnitName}>{unit.name}</span>
                      <span className={styles.diagramUnitCapability}>{capabilityLabel(unit)}</span>
                      <span className={styles.diagramBedRow}>
                        <span className={styles.diagramBedChip} data-state="available">
                          Ready {capacity.available}
                        </span>
                        <span className={styles.diagramBedChip} data-state="held">
                          Held {capacity.held}
                        </span>
                        <span className={styles.diagramBedChip} data-state="blocked">
                          Blocked {capacity.blocked}
                        </span>
                        <span className={styles.diagramBedChip} data-state="occupied">
                          Occupied {capacity.occupied}
                        </span>
                        {/* `potential` is drawn from bed releases, not from `unit.beds` — it is
                            never summed into the four states above. Dashed styling marks it as
                            the separate, forward-looking figure it is (ruling 3). */}
                        <span className={styles.diagramBedChip} data-state="potential">
                          Potential {capacity.potential}
                        </span>
                      </span>
                      {!unit.authorised ? (
                        <span className={styles.diagramUnauthorisedBadge}>Not authorised — MHA 2014</span>
                      ) : null}
                      {isDestination ? (
                        <span className={styles.diagramDestinationBadge}>Current recorded destination</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
