"use client";

import { Network } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";
import {
  candidateReason,
  eligibleCandidates,
  unitCapacity,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import { PARALLEL_REFERRAL_CAP, type Movement, type Unit } from "@/components/ward-management/ward-model";
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
type ShortlistCandidate = ReturnType<typeof eligibleCandidates>[number];
type Connector =
  { id: string; path: string; kind: "demand" } | { id: string; path: string; kind: "route"; eligible: boolean };

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
 * The hub's one-line status. Must be true for every movement, not just the ones with a clean
 * eligible shortlist -- review Critical 1 found "Routing WF-009 to 3 shortlisted units" displayed
 * for a movement whose three nearest candidates were all ineligible (two already declined it, the
 * third fails the security gate), which reads as three viable routes where zero exist. This names
 * the actual eligible count, and is honest about a shortlist that is nearest-only, not viable,
 * when eligibility is zero or partial.
 */
function hubStatusText(movement: Movement | undefined, shortlist: ShortlistCandidate[]) {
  if (!movement) return "Select a movement from the priority queue to route it";
  if (shortlist.length === 0) return `${movement.id} — no destinations found for this cohort`;
  const eligibleCount = shortlist.filter((candidate) => candidate.verdict.eligible).length;
  if (eligibleCount === shortlist.length) {
    return `${movement.id} — ${eligibleCount} eligible destination${eligibleCount === 1 ? "" : "s"}`;
  }
  if (eligibleCount === 0) {
    return `${movement.id} — no eligible destination; ${shortlist.length} nearest, all excluded`;
  }
  return `${movement.id} — ${eligibleCount} eligible of ${shortlist.length} nearest`;
}

/**
 * The reshape the spec asks for: demand enters left from the eight emergency departments,
 * passes through a statewide-flow hub in the centre, and lands right on the 22 inpatient units,
 * grouped by health service. Departments are always shown (ordered worst-first by `edPressure`)
 * and always connected to the hub -- that part of the network exists regardless of what a
 * coordinator has selected. Routes from the hub to specific units only appear once a movement is
 * selected, and only to that movement's own nearest-3 shortlist; with nothing selected, this
 * renders the network with nothing routed rather than a guessed selection (ruling: display less
 * rather than something plausible).
 *
 * `eligibleCandidates` sorts eligible-first but never filters -- it can and does return units
 * that fail a gate (already declined the movement, wrong security tier, stale capacity, ...).
 * Every shortlisted node therefore carries its own verdict (`data-eligible`, plus
 * `candidateReason` rendered as real text) and an ineligible route is drawn visually distinct
 * from an eligible one, so neither the arrow nor the node can read as an endorsement the data
 * does not support.
 *
 * Connector paths are computed from real DOM geometry (ruling 4), never from hard-coded
 * percentages -- a percentage-based layout looks right at exactly one viewport width and is wrong
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
  const shortlistByUnitId = useMemo(
    () => new Map(shortlist.map((candidate) => [candidate.unit.id, candidate])),
    [shortlist],
  );
  const originEdId = movement?.originEdId;

  // Grouped by health service in `wardServiceOrder`, one lookup per unit (22 units -- cheap).
  // `siteByCode` returning `undefined` for a broken site code excludes that unit from every
  // group rather than guessing one -- conservative failure, not a crash. `unplacedUnits` below
  // catches exactly that case so the unit still renders (as an explicit anomaly) rather than
  // silently vanishing from the board (review Minor 6).
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
  const unplacedUnits = useMemo(() => {
    const grouped = new Set(serviceGroups.flatMap((group) => group.units.map((unit) => unit.id)));
    return allUnits().filter((unit) => !grouped.has(unit.id));
  }, [serviceGroups]);

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
      next.push({
        id: `route-${candidate.unit.id}`,
        path: elbowPath(hubRight, to),
        kind: "route",
        eligible: candidate.verdict.eligible,
      });
    }

    setConnectors(next);
  }, [pressure, shortlist]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // The window resize listener is the fallback path -- it must attach unconditionally.
  // `ResizeObserver` is the finer-grained signal (canvas-only size changes that a window resize
  // wouldn't cause, e.g. a sidebar toggling), so it is added separately when available rather
  // than gating the window listener behind the same `if` (review Minor 7 -- the previous single
  // guard skipped the resize listener too whenever `ResizeObserver` was undefined, leaving no
  // resize handling at all in that environment).
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [measure]);

  return (
    // The diagram can carry substantially more content (22 units) than the region grid's own
    // squeeze-to-fit sizing gives it room for at moderate viewport heights -- the outer grid's
    // `auto` row is compressed to fit `.body`'s available space, which at 1280x900 left this
    // region 208px tall for ~1080px of content (Controller finding 8). `.diagramScroll` owns its
    // own bounded, independently-scrolling box (`min-height` floor + `overflow-y: auto`) so the
    // diagram is always a usable panel rather than a letterbox, without needing the canvas itself
    // to scroll -- see the note on `.diagramScroll` in the CSS for why that distinction matters
    // for the connector overlay.
    <div className={styles.diagramScroll}>
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
            <marker
              id="ward-flow-diagram-arrow-route-eligible"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowRouteEligible} />
            </marker>
            <marker
              id="ward-flow-diagram-arrow-route-ineligible"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowRouteIneligible} />
            </marker>
          </defs>
          {connectors.map((connector) => {
            const isRoute = connector.kind === "route";
            const routeClass = isRoute
              ? connector.eligible
                ? styles.diagramConnectorRouteEligible
                : styles.diagramConnectorRouteIneligible
              : styles.diagramConnectorDemand;
            const marker = !isRoute
              ? "url(#ward-flow-diagram-arrow-demand)"
              : connector.eligible
                ? "url(#ward-flow-diagram-arrow-route-eligible)"
                : "url(#ward-flow-diagram-arrow-route-ineligible)";
            return (
              <path
                key={connector.id}
                d={connector.path}
                className={routeClass}
                data-connector-kind={connector.kind}
                data-eligible={isRoute ? String(connector.eligible) : undefined}
                markerEnd={marker}
              />
            );
          })}
        </svg>

        {/* The node container is `pointer-events: none`; only the interactive unit buttons below
            re-enable `pointer-events: auto`. Without this the full-canvas overlay swallows clicks
            on everything beneath it -- the exact defect Phase 1's network diagram cost an hour
            on. */}
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
            <span>{hubStatusText(movement, shortlist)}</span>
          </div>

          <div className={styles.diagramUnitsColumn}>
            <h3 className={styles.diagramColumnHeading}>Inpatient units</h3>
            {serviceGroups.map((group) => (
              <section key={group.service} className={styles.diagramServiceGroup}>
                <h4 className={styles.diagramServiceHeading}>{group.service}</h4>
                <div className={styles.diagramUnitGrid}>
                  {group.units.map((unit) => (
                    <UnitNode
                      key={unit.id}
                      unit={unit}
                      movement={movement}
                      candidate={shortlistByUnitId.get(unit.id)}
                      selected={selectedUnitId === unit.id}
                      onSelectUnit={onSelectUnit}
                      registerUnitNode={registerUnitNode}
                    />
                  ))}
                </div>
              </section>
            ))}
            {unplacedUnits.length > 0 ? (
              <section className={styles.diagramServiceGroup} aria-label="Units with an unresolved health service">
                <h4 className={styles.diagramServiceHeading}>Unresolved health service</h4>
                <div className={styles.diagramUnitGrid}>
                  {unplacedUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className={styles.diagramUnplacedUnit}
                      data-testid={`ward-diagram-unit-${unit.id}`}
                    >
                      <span className={styles.diagramUnitName}>{unit.name}</span>
                      <span className={styles.diagramUnitCapability}>{capabilityLabel(unit)}</span>
                      <span className={styles.diagramEdStats}>
                        Could not resolve this unit&apos;s health service &mdash; not placed in a group above.
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitNode({
  unit,
  movement,
  candidate,
  selected,
  onSelectUnit,
  registerUnitNode,
}: {
  unit: Unit;
  movement: Movement | undefined;
  candidate: ShortlistCandidate | undefined;
  selected: boolean;
  onSelectUnit: (unitId: string) => void;
  registerUnitNode: (id: string, node: HTMLButtonElement | null) => void;
}) {
  const capacity = unitCapacity(unit);
  const routed = candidate !== undefined;
  // `destinationUnit(movement)` (`acceptedUnitId ?? referredUnitIds[0]`) conflates two different
  // facts into one badge and only ever looks at the first referral (review Important 2) -- WF-017
  // showed "Current recorded destination" on BTY when BTY is only an outstanding referral (no
  // acceptance), and WF-013's second parallel referral was invisible because only index 0 was
  // checked. Checked directly here instead: an accepted destination and an outstanding referral
  // are different facts a coordinator acts on differently, and every unit in `referredUnitIds` --
  // not only the first -- gets its own badge on its own node.
  const isAccepted = movement?.acceptedUnitId === unit.id;
  const isReferred = !isAccepted && (movement?.referredUnitIds.includes(unit.id) ?? false);

  return (
    <button
      type="button"
      ref={(node) => registerUnitNode(unit.id, node)}
      className={selected ? styles.diagramUnitSelected : styles.diagramUnit}
      data-testid={`ward-diagram-unit-${unit.id}`}
      data-routed={routed ? "true" : undefined}
      data-eligible={candidate ? String(candidate.verdict.eligible) : undefined}
      data-accepted={isAccepted ? "true" : undefined}
      data-referred={isReferred ? "true" : undefined}
      aria-pressed={selected}
      onClick={() => onSelectUnit(unit.id)}
    >
      {/* No `aria-label` here: it would override the accessible name computed from this content
          and hide every figure below from a screen reader -- the exact defect Task 4 found on the
          pressure strip. Every figure, including the routed/eligibility state, is plain visible
          text instead (review Important 5 -- routed state was previously conveyed only by an
          outline colour plus an `aria-hidden` connector, invisible to a screen reader). */}
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
        {/* `potential` is drawn from bed releases, not from `unit.beds` -- it is never summed
            into the four states above. Dashed styling marks it as the separate, forward-looking
            figure it is (ruling 3). */}
        <span className={styles.diagramBedChip} data-state="potential">
          Potential {capacity.potential}
        </span>
      </span>
      {!unit.authorised ? (
        <span className={styles.diagramUnauthorisedBadge}>Not authorised &mdash; MHA 2014</span>
      ) : null}
      {candidate ? (
        <span className={candidate.verdict.eligible ? styles.diagramEligibleBadge : styles.diagramIneligibleBadge}>
          {candidateReason(candidate.verdict)}
        </span>
      ) : null}
      {isAccepted ? <span className={styles.diagramAcceptedBadge}>Accepted destination</span> : null}
      {isReferred ? <span className={styles.diagramReferredBadge}>Outstanding referral</span> : null}
    </button>
  );
}
