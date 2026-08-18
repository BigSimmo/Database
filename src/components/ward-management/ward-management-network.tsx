"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Network, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  movementStages,
  wardHospitalByCode,
  wardHospitals,
  wardPatients,
  wardRegions,
  type WardHospital,
  type WardPatient,
} from "@/components/ward-management/synthetic-fixtures";

import styles from "./ward-management-network.module.css";

type BedStateKey = "available" | "held" | "potential" | "blocked";

const bedStateCopy: Record<BedStateKey, { label: string; detail: string }> = {
  available: { label: "Ready", detail: "Available now" },
  held: { label: "Held", detail: "Bed held" },
  potential: { label: "Potential", detail: "May become available" },
  blocked: { label: "Blocked", detail: "Not available" },
};

/** Left column carries North then Country; right column carries East then South. */
const columnRegions = {
  left: ["North", "Country"] as const,
  right: ["East", "South"] as const,
};

type Connector = { id: string; path: string; kind: "demand" | "route" };

function capabilityLabel(hospital: WardHospital) {
  const cohorts = hospital.cohorts.map((cohort) => (cohort === "Older adult" ? "Older" : cohort)).join("/");
  return `${hospital.settings.join(" / ")} · ${cohorts}`;
}

function candidatesFor(patient: WardPatient) {
  return [
    {
      hospital: wardHospitalByCode(patient.destinationCode),
      score: patient.score,
      etaLabel: patient.transport,
      rank: 1,
    },
    ...patient.alternatives.map((alternative, index) => ({
      hospital: wardHospitalByCode(alternative.hospitalCode),
      score: alternative.score,
      etaLabel: alternative.etaLabel ?? "Re-book required",
      rank: index + 2,
    })),
  ];
}

function catchmentFit(patient: WardPatient, hospital: WardHospital) {
  if (hospital.region === patient.catchment) return { label: "Best", tone: "good" as const };
  if (hospital.service === "WACHS" && patient.catchment === "Country") return { label: "Good", tone: "good" as const };
  return { label: "Escalation", tone: "warning" as const };
}

function settingFit(patient: WardPatient, hospital: WardHospital) {
  const setting = hospital.settings.includes(patient.setting);
  const cohort = hospital.cohorts.includes(patient.cohort);
  if (setting && cohort) return { label: "Exact match", tone: "good" as const };
  if (setting || cohort) return { label: "Partial match", tone: "warning" as const };
  return { label: "Not eligible", tone: "danger" as const };
}

function BedStateChips({ hospital, showTime }: { hospital: WardHospital; showTime?: boolean }) {
  return (
    <span className={styles.bedChips}>
      {(Object.keys(bedStateCopy) as BedStateKey[]).map((key) => (
        <span className={styles.bedChip} data-state={key} key={key} title={bedStateCopy[key].detail}>
          {hospital[key]}
        </span>
      ))}
      {showTime ? <span className={styles.bedTime}>{hospital.lastConfirmed}</span> : null}
    </span>
  );
}

function ServiceCard({
  hospital,
  routed,
  selected,
  onSelect,
  registerRef,
}: {
  hospital: WardHospital;
  routed: boolean;
  selected: boolean;
  onSelect: () => void;
  registerRef: (code: string, node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={(node) => registerRef(hospital.code, node)}
      onClick={onSelect}
      aria-pressed={selected}
      data-routed={routed ? "true" : undefined}
      data-testid={`ward-network-card-${hospital.code}`}
      className={styles.serviceCard}
      aria-label={`${hospital.name}. ${capabilityLabel(hospital)}. ${hospital.available} ready, ${hospital.held} held, ${hospital.potential} potential, ${hospital.blocked} blocked, of ${hospital.beds} beds. Confirmed ${hospital.lastConfirmed}.`}
    >
      <span className={styles.serviceName}>{hospital.name}</span>
      <span className={styles.serviceCapability}>{capabilityLabel(hospital)}</span>
      <BedStateChips hospital={hospital} showTime />
    </button>
  );
}

export function WardNetworkWorkspace() {
  const [selectedPatientId, setSelectedPatientId] = useState(wardPatients[0].id);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [factorsOpen, setFactorsOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(true);

  const patient = useMemo(
    () => wardPatients.find((candidate) => candidate.id === selectedPatientId) ?? wardPatients[0],
    [selectedPatientId],
  );
  const candidates = useMemo(() => candidatesFor(patient), [patient]);
  const routedCodes = useMemo(() => new Set(candidates.map((candidate) => candidate.hospital.code)), [candidates]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);
  const clusterRefs = useRef(new Map<string, HTMLElement | null>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const registerCard = useCallback((code: string, node: HTMLButtonElement | null) => {
    cardRefs.current.set(code, node);
  }, []);
  const registerCluster = useCallback((region: string, node: HTMLElement | null) => {
    clusterRefs.current.set(region, node);
  }, []);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const hub = hubRef.current;
    if (!canvas || !hub) return;
    const base = canvas.getBoundingClientRect();
    const hubBox = hub.getBoundingClientRect();
    const hubLeft = { x: hubBox.left - base.left, y: hubBox.top - base.top + hubBox.height / 2 };
    const hubRight = { x: hubBox.right - base.left, y: hubLeft.y };
    const next: Connector[] = [];

    /** Elbow: leave the source edge, run along a mid trunk, then enter the target edge. */
    const elbow = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const trunk = from.x + (to.x - from.x) / 2;
      return `M ${from.x} ${from.y} H ${trunk} V ${to.y} H ${to.x}`;
    };

    for (const region of wardRegions) {
      const node = clusterRefs.current.get(region);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const onLeft = (columnRegions.left as readonly string[]).includes(region);
      const from = { x: (onLeft ? box.right : box.left) - base.left, y: box.top - base.top + box.height / 2 };
      next.push({ id: `demand-${region}`, path: elbow(from, onLeft ? hubLeft : hubRight), kind: "demand" });
    }

    for (const candidate of candidates) {
      const node = cardRefs.current.get(candidate.hospital.code);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const onLeft = (columnRegions.left as readonly string[]).includes(candidate.hospital.region);
      const to = { x: (onLeft ? box.right : box.left) - base.left, y: box.top - base.top + box.height / 2 };
      next.push({
        id: `route-${candidate.hospital.code}`,
        path: elbow(onLeft ? hubLeft : hubRight, to),
        kind: "route",
      });
    }

    setConnectors(next);
  }, [candidates]);

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

  const detail = selectedCode ? wardHospitalByCode(selectedCode) : null;
  const openMovements = movementStages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div
      className={styles.networkPage}
      data-testid="ward-network-view"
      data-shortlist={shortlistOpen ? "open" : "collapsed"}
    >
      <section className={styles.pipeline} aria-label="Movement pipeline">
        {movementStages.map((stage, index) => (
          <span className={styles.pipelineStage} key={stage.id}>
            <span className={styles.pipelineLabel}>
              {index + 1} {stage.label}
            </span>
            <strong>{stage.count}</strong>
          </span>
        ))}
      </section>

      <div className={styles.networkGrid}>
        <section className={styles.queuePanel} aria-label="Priority queue">
          <header className={styles.panelHeader}>
            <h2>Priority queue</h2>
            <span className={styles.count}>{wardPatients.length}</span>
          </header>
          <div className={styles.queueList}>
            {wardPatients.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                onClick={() => {
                  setSelectedPatientId(candidate.id);
                  setSelectedCode(null);
                }}
                aria-pressed={candidate.id === patient.id}
                data-testid={`ward-network-queue-${candidate.id}`}
                className={styles.queueRow}
              >
                <span className={styles.queueTop}>
                  <strong>{candidate.id}</strong>
                  <span className={styles.elapsed}>{candidate.elapsed}</span>
                </span>
                <span className={styles.queueMeta}>
                  <span className={styles.tier} data-tier={candidate.urgency}>
                    {candidate.urgency}
                  </span>
                  {candidate.cohort} · {candidate.setting} ward
                </span>
                <span className={styles.queueMeta}>
                  {candidate.catchment} catchment · {candidate.voluntaryStatus}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.canvasPanel} aria-label="Operational constellation">
          <header className={styles.panelHeader}>
            <h2>
              <Network aria-hidden="true" /> Operational constellation
            </h2>
            <span className={styles.headerActions}>
              <span className={styles.schematicBadge}>
                <Info aria-hidden="true" /> Schematic, not geographic
              </span>
              <button
                type="button"
                className={styles.focusToggle}
                aria-expanded={shortlistOpen}
                onClick={() => setShortlistOpen((open) => !open)}
              >
                {shortlistOpen ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
                {shortlistOpen ? "Focus diagram" : "Show shortlist"}
              </button>
            </span>
          </header>

          <div className={styles.canvas} ref={canvasRef}>
            <svg className={styles.connectorLayer} aria-hidden="true">
              <defs>
                <marker id="ward-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.arrowHead} />
                </marker>
                <marker id="ward-arrow-route" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.arrowHeadRoute} />
                </marker>
              </defs>
              {connectors.map((connector) => (
                <path
                  key={connector.id}
                  d={connector.path}
                  className={connector.kind === "route" ? styles.connectorRoute : styles.connector}
                  markerEnd={connector.kind === "route" ? "url(#ward-arrow-route)" : "url(#ward-arrow)"}
                />
              ))}
            </svg>

            {(["left", "right"] as const).map((side) => (
              <div className={styles.column} data-side={side} key={side}>
                {columnRegions[side].map((region) => (
                  <section
                    className={styles.cluster}
                    key={region}
                    ref={(node) => registerCluster(region, node)}
                    aria-labelledby={`ward-network-${region}`}
                  >
                    <header className={styles.clusterHeader}>
                      <strong id={`ward-network-${region}`}>{region.toUpperCase()}</strong>
                      <span>
                        {wardHospitals
                          .filter((hospital) => hospital.region === region)
                          .reduce((sum, hospital) => sum + hospital.available, 0)}{" "}
                        ready
                      </span>
                    </header>
                    <div className={styles.clusterCards}>
                      {wardHospitals
                        .filter((hospital) => hospital.region === region)
                        .map((hospital) => (
                          <ServiceCard
                            key={hospital.id}
                            hospital={hospital}
                            routed={routedCodes.has(hospital.code)}
                            selected={detail?.code === hospital.code}
                            onSelect={() => setSelectedCode(detail?.code === hospital.code ? null : hospital.code)}
                            registerRef={registerCard}
                          />
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            ))}

            <div className={styles.hub} ref={hubRef}>
              <Network aria-hidden="true" />
              <strong>STATEWIDE FLOW</strong>
              <span>Coordinated visibility and placement</span>
              <span className={styles.hubMeta}>
                {patient.id} routing · {openMovements} open movements
              </span>
            </div>
          </div>

          <footer className={styles.legend}>
            <span className={styles.legendTitle}>Legend</span>
            {(Object.keys(bedStateCopy) as BedStateKey[]).map((key) => (
              <span className={styles.legendItem} key={key}>
                <i className={styles.legendSwatch} data-state={key} aria-hidden="true" />
                <b>{bedStateCopy[key].label}</b> {bedStateCopy[key].detail}
              </span>
            ))}
            <span className={styles.legendItem}>
              <i className={styles.legendRoute} aria-hidden="true" />
              <b>Shortlisted</b> Route for selected movement
            </span>
            <span className={styles.legendItem}>
              <i className={styles.legendDemand} aria-hidden="true" />
              <b>Demand</b> Catchment into statewide flow
            </span>
          </footer>
        </section>

        <aside className={styles.shortlistPanel} aria-label="Explainable shortlist" aria-live="polite">
          <header className={styles.panelHeader}>
            <h2>
              <Sparkles aria-hidden="true" /> Explainable shortlist · {patient.id}
            </h2>
          </header>
          <p className={styles.patientLine}>
            <span className={styles.tier} data-tier={patient.urgency}>
              {patient.urgency}
            </span>
            {patient.cohort} · {patient.setting} ward · {patient.catchment} catchment
          </p>
          <p className={styles.patientSubLine}>
            {patient.voluntaryStatus} · {patient.legalDetail}
          </p>
          <p className={styles.patientSubLine}>
            {patient.referralStatus} · waiting {patient.elapsed}
          </p>

          <div className={styles.tableScroll}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Comparison factor</span>
                  </th>
                  {candidates.map((candidate) => (
                    <th scope="col" key={candidate.hospital.code}>
                      {candidate.rank} {candidate.hospital.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Catchment fit</th>
                  {candidates.map((candidate) => {
                    const fit = catchmentFit(patient, candidate.hospital);
                    return (
                      <td key={candidate.hospital.code} data-tone={fit.tone}>
                        {fit.label}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th scope="row">Open/secure fit</th>
                  {candidates.map((candidate) => {
                    const fit = settingFit(patient, candidate.hospital);
                    return (
                      <td key={candidate.hospital.code} data-tone={fit.tone}>
                        {fit.label}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th scope="row">Current bed state</th>
                  {candidates.map((candidate) => (
                    <td key={candidate.hospital.code}>
                      <BedStateChips hospital={candidate.hospital} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Transport state</th>
                  {candidates.map((candidate) => (
                    <td
                      key={candidate.hospital.code}
                      data-tone={/delay/i.test(candidate.etaLabel) ? "warning" : "good"}
                    >
                      {candidate.etaLabel}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Operational score</th>
                  {candidates.map((candidate) => (
                    <td key={candidate.hospital.code}>
                      <strong>{candidate.score}</strong>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className={styles.tierNote}>
            <span className={styles.tier} data-tier={patient.urgency}>
              {patient.urgency}
            </span>
            <b>Urgency tier leads.</b> The operational score only orders movements inside a tier. It is not clinical
            severity.
          </p>

          <button
            type="button"
            className={styles.factorsToggle}
            aria-expanded={factorsOpen}
            onClick={() => setFactorsOpen((open) => !open)}
          >
            Scoring factors ({patient.recommendationReasons.length})
            <ChevronDown aria-hidden="true" data-open={factorsOpen ? "true" : undefined} />
          </button>
          {factorsOpen ? (
            <ul className={styles.factorList}>
              {patient.recommendationReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}

          <div className={styles.ownerBlock}>
            <span className={styles.ownerLabel}>Current owner</span>
            <strong>{patient.owner}</strong>
            <span>Next action: {patient.blocker}</span>
          </div>

          <Link className={styles.primaryLink} href={`/ward-management/patients/${patient.id}`}>
            Open movement workspace
          </Link>
          <p className={styles.assurance}>System suggests, you decide. No automatic allocation.</p>

          {detail ? (
            <section className={styles.detailBlock} aria-label="Selected service detail">
              <h3>{detail.name}</h3>
              <p>
                {detail.service} · {capabilityLabel(detail)} · confirmed {detail.lastConfirmed}
              </p>
              <BedStateChips hospital={detail} />
              <p className={styles.detailMeta}>
                {detail.occupied} occupied of {detail.beds} beds. Potential beds are a subset of occupied and are not
                allocatable yet.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
