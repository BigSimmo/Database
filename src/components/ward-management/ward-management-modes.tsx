"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileClock,
  Fingerprint,
  Info,
  LockKeyhole,
  MapPin,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  movementStages,
  operationalPriorityScore,
  wardHospitalByCode,
  wardHospitals,
  wardPatients,
  wardRegions,
  type WardPatient,
  type WardRole,
} from "@/components/ward-management/synthetic-fixtures";
import { WardNetworkWorkspace } from "@/components/ward-management/ward-management-network";
import {
  ClinicalRail,
  WardModeNavigation,
  type WardMode,
} from "@/components/ward-management/ward-management-navigation";

import styles from "./ward-management-modes.module.css";

const roleLabels: Record<WardRole, string> = {
  flow: "Flow coordinator",
  ed: "ED mental health",
  ward: "Ward manager",
};

const roleFocusCopy: Record<WardRole, { title: string; detail: string }> = {
  flow: {
    title: "Statewide coordination focus",
    detail: "Review matches, cross-catchment escalation, holds and owned exceptions.",
  },
  ed: {
    title: "ED readiness focus",
    detail: "Prioritise referral, legal/form timing, handover and transport request readiness.",
  },
  ward: {
    title: "Ward capacity focus",
    detail: "Prioritise capacity freshness, suitability response, acceptance and time-limited holds.",
  },
};

const modeCopy: Record<WardMode, { title: string; description: string }> = {
  command: { title: "Ward Flow", description: "Statewide command view" },
  constellation: {
    title: "Operational constellation",
    description: "Statewide demand, capacity and selected movement routes",
  },
  network: {
    title: "Network diagram",
    description: "Services as nodes · movements as routes · fill shows bed pressure",
  },
  queue: { title: "Priority queue", description: "Human urgency first · operational score within tier" },
  capacity: { title: "Capacity", description: "Ward-confirmed state, capability and freshness" },
  movements: { title: "Movements", description: "Six-stage patient movement board" },
  exceptions: { title: "Action inbox", description: "Owned exceptions, deadlines and stale state" },
  transport: { title: "Transport", description: "Legal, document, booking and handover readiness" },
  governance: { title: "Governance", description: "AI assurance, audit and synthetic data boundary" },
};

const exceptions = [
  {
    patientId: "WF-198",
    title: "Destination review overdue",
    timing: "1h 12m overdue",
    owner: "Flow coordinator",
    action: "Escalate destination response",
    tone: "danger" as const,
  },
  {
    patientId: "WF-204",
    title: "Bed hold expires",
    timing: "18 min remaining",
    owner: "Ward manager",
    action: "Confirm handover or release hold",
    tone: "warning" as const,
  },
  {
    patientId: "WF-201",
    title: "Transport delayed",
    timing: "ETA +90 min",
    owner: "ED mental health",
    action: "Review provider and escalation",
    tone: "warning" as const,
  },
  {
    patientId: "WF-209",
    title: "Country transfer escalation",
    timing: "Provider response pending",
    owner: "WACHS MHPF",
    action: "Confirm metro destination pathway",
    tone: "neutral" as const,
  },
];

function toneClass(tone: "good" | "warning" | "danger" | "neutral") {
  if (tone === "good") return styles.statusGood;
  if (tone === "warning") return styles.statusWarning;
  if (tone === "danger") return styles.statusDanger;
  return styles.statusNeutral;
}

function ModeHeader({
  mode,
  role,
  onRoleChange,
}: {
  mode: WardMode;
  role: WardRole;
  onRoleChange: (role: WardRole) => void;
}) {
  const copy = modeCopy[mode];
  return (
    <header className={styles.modeHeader}>
      <div className={styles.modeIdentity}>
        <span>
          <strong>Clinical KB</strong>
          <small>Source-backed clinical search</small>
        </span>
        <div className={styles.modeTitle}>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </div>
      <label className={styles.roleSelect}>
        <UserRound aria-hidden="true" />
        <span className="sr-only">Current role</span>
        <select value={role} onChange={(event) => onRoleChange(event.target.value as WardRole)}>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
      <div className={styles.headerMeta}>
        <span className={styles.prototypeBadge}>Synthetic prototype</span>
        <span>Updated 10:42</span>
        <span>15 Aug 2026 · WA</span>
      </div>
    </header>
  );
}

function CompactQueue({
  patients,
  selected,
  onSelect,
}: {
  patients: WardPatient[];
  selected: WardPatient;
  onSelect: (patient: WardPatient) => void;
}) {
  return (
    <section className={`${styles.panel} ${styles.compactQueue}`} aria-label="Priority queue">
      <header className={styles.panelHeader}>
        <div>
          <h2>Priority queue</h2>
          <p>Tier first · AI orders within tier</p>
        </div>
        <span className={styles.statusNeutral}>{patients.length}</span>
      </header>
      <div className={styles.queueList}>
        {patients.slice(0, 9).map((patient, index) => (
          <button
            type="button"
            key={patient.id}
            onClick={() => onSelect(patient)}
            aria-pressed={selected.id === patient.id}
            className={selected.id === patient.id ? styles.queueRowSelected : styles.queueRow}
          >
            <span className={styles.rowTop}>
              <strong>
                {index + 1}. {patient.id}
              </strong>
              <span
                className={toneClass(patient.urgency === 1 ? "danger" : patient.urgency === 2 ? "warning" : "neutral")}
              >
                P{patient.urgency}
              </span>
              <span className={styles.score}>{patient.score}%</span>
            </span>
            <span className={styles.rowMeta}>
              {patient.elapsed} · {patient.cohort} {patient.setting} · {patient.catchment}
            </span>
            <span className={styles.rowMeta}>{patient.blocker}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function HospitalChip({
  hospital,
  selected,
  onSelect,
}: {
  hospital: (typeof wardHospitals)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={selected ? styles.hospitalChipSelected : styles.hospitalChip}
    >
      <strong>{hospital.code === "SCG" ? "SCGH" : hospital.name}</strong>
      <span className={styles.hospitalState}>
        <b>{hospital.available}</b> available · {hospital.held} held · {hospital.potential} potential
      </span>
      <span className={styles.hospitalState}>Confirmed {hospital.lastConfirmed}</span>
    </button>
  );
}

function NetworkCanvas({ selectedCode, onSelect }: { selectedCode: string; onSelect: (code: string) => void }) {
  return (
    <section className={styles.panel} aria-label="Statewide operational network">
      <header className={styles.panelHeader}>
        <div>
          <h2>Statewide mental health flow</h2>
          <p>Schematic service network · selective movement routes only</p>
        </div>
        <span className={styles.prototypeBadge}>Not geographic</span>
      </header>
      <div className={styles.networkCanvas}>
        {wardRegions.map((region) => {
          const hospitals = wardHospitals.filter((hospital) => hospital.region === region);
          const available = hospitals.reduce((total, hospital) => total + hospital.available, 0);
          return (
            <section className={styles.regionCluster} key={region} aria-labelledby={`constellation-${region}`}>
              <header>
                <span className={styles.regionTitle}>
                  <Building2 aria-hidden="true" />
                  <strong id={`constellation-${region}`}>{region}</strong>
                </span>
                <small>{available} available now</small>
              </header>
              <div className={styles.hospitalChipGrid}>
                {hospitals.map((hospital) => (
                  <HospitalChip
                    key={hospital.id}
                    hospital={hospital}
                    selected={selectedCode === hospital.code}
                    onSelect={() => onSelect(hospital.code)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <section className={styles.flowHub} aria-label="Statewide flow coordination hub">
          <div className={styles.routeSignal}>
            North / Country demand <ArrowRight aria-hidden="true" />
          </div>
          <div>
            <Route aria-hidden="true" />
            <strong>STATEWIDE FLOW</strong>
            <span>Coordinated visibility, escalation and placement</span>
          </div>
          <div className={styles.routeSignal}>
            <ArrowRight aria-hidden="true" /> Selected route to South
          </div>
        </section>
      </div>
    </section>
  );
}

function DecisionPanel({
  patient,
  role,
  selectedCode,
  onSelectCode,
}: {
  patient: WardPatient;
  role: WardRole;
  selectedCode: string;
  onSelectCode: (code: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const candidates = useMemo(
    () => [
      {
        hospital: wardHospitalByCode(patient.destinationCode),
        score: patient.score,
        reason: "Best eligible operational fit",
      },
      ...patient.alternatives.map((alternative) => ({
        hospital: wardHospitalByCode(alternative.hospitalCode),
        score: alternative.score,
        reason: alternative.reason,
      })),
    ],
    [patient],
  );
  const selected = candidates.find((candidate) => candidate.hospital.code === selectedCode) ?? candidates[0];

  return (
    <aside className={`${styles.panel} ${styles.decisionPanel}`} aria-label={`AI best-fit review for ${patient.id}`}>
      <header className={styles.decisionHeader}>
        <div>
          <span className={styles.aiBadge}>
            <Sparkles aria-hidden="true" /> AI best fit
          </span>
          <h2>{patient.id}</h2>
        </div>
        <span className={toneClass(patient.urgency === 1 ? "danger" : "warning")}>P{patient.urgency}</span>
      </header>

      <dl className={styles.patientFacts}>
        <div>
          <dt>Catchment</dt>
          <dd>{patient.catchment}</dd>
        </div>
        <div>
          <dt>Required setting</dt>
          <dd>
            {patient.cohort} · {patient.setting}
          </dd>
        </div>
        <div>
          <dt>Legal state</dt>
          <dd>{patient.voluntaryStatus}</dd>
        </div>
        <div>
          <dt>Wait / priority</dt>
          <dd>
            {patient.elapsed} · {operationalPriorityScore(patient)}
          </dd>
        </div>
      </dl>

      <div className={styles.candidateTable} aria-label="Explainable destination shortlist">
        {candidates.map((candidate, index) => (
          <button
            type="button"
            key={candidate.hospital.code}
            onClick={() => {
              onSelectCode(candidate.hospital.code);
              setConfirmed(false);
            }}
            aria-pressed={selected.hospital.code === candidate.hospital.code}
            className={
              selected.hospital.code === candidate.hospital.code ? styles.candidateRowSelected : styles.candidateRow
            }
          >
            <span className={styles.candidateRank}>{index + 1}</span>
            <span>
              <strong>{candidate.hospital.name}</strong>
              <small>{candidate.reason}</small>
            </span>
            <span className={styles.score}>{candidate.score}%</span>
          </button>
        ))}
      </div>

      <ul className={styles.reasonList}>
        {patient.recommendationReasons.slice(0, 4).map((reason) => (
          <li key={reason}>
            <CheckCircle2 aria-hidden="true" /> {reason}
          </li>
        ))}
      </ul>

      <div className={styles.buttonRow}>
        <button type="button" onClick={() => setConfirmed(true)} className={styles.primaryButton}>
          {confirmed ? <Check aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
          {confirmed
            ? "Match confirmed"
            : role === "ed"
              ? "Confirm ED readiness"
              : role === "ward"
                ? "Accept & hold bed"
                : "Review & confirm"}
        </button>
        <Link className={styles.secondaryButton} href={`/ward-management/patients/${patient.id}`}>
          Full record <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <p className={styles.microCopy}>AI proposes · authorised human confirms or overrides · no automatic allocation</p>
    </aside>
  );
}

function ConstellationView({ role }: { role: WardRole }) {
  const [selectedPatient, setSelectedPatient] = useState(wardPatients[0]);
  const [selectedCode, setSelectedCode] = useState(selectedPatient.destinationCode);
  const rolePatients = useMemo(() => {
    if (role === "flow") return wardPatients;
    if (role === "ed")
      return [...wardPatients].sort((a, b) => Number(b.owner.includes("ED")) - Number(a.owner.includes("ED")));
    return [...wardPatients].sort((a, b) => Number(b.owner.includes("Ward")) - Number(a.owner.includes("Ward")));
  }, [role]);

  function selectPatient(patient: WardPatient) {
    setSelectedPatient(patient);
    setSelectedCode(patient.destinationCode);
  }

  return (
    <div className={styles.constellationGrid} data-testid="ward-constellation">
      <CompactQueue patients={rolePatients} selected={selectedPatient} onSelect={selectPatient} />
      <NetworkCanvas selectedCode={selectedCode} onSelect={setSelectedCode} />
      <DecisionPanel patient={selectedPatient} role={role} selectedCode={selectedCode} onSelectCode={setSelectedCode} />
    </div>
  );
}

function QueueView({ role }: { role: WardRole }) {
  const [selected, setSelected] = useState(wardPatients[0]);
  const rolePatients = useMemo(() => {
    if (role === "flow") return wardPatients;
    if (role === "ed")
      return [...wardPatients].sort((a, b) => Number(b.owner.includes("ED")) - Number(a.owner.includes("ED")));
    return [...wardPatients].sort((a, b) => Number(b.owner.includes("Ward")) - Number(a.owner.includes("Ward")));
  }, [role]);
  return (
    <div className={styles.pageGrid} data-testid="ward-queue-view">
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Placement-ready movements</h2>
            <p>Human tier remains primary. Operational score explains ordering within tier.</p>
          </div>
          <span className={styles.prototypeBadge}>{wardPatients.length} synthetic records</span>
        </header>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Priority</th>
              <th>Wait</th>
              <th>Need</th>
              <th>Catchment</th>
              <th>Referral / blocker</th>
              <th>AI fit</th>
            </tr>
          </thead>
          <tbody>
            {rolePatients.map((patient) => (
              <tr key={patient.id} data-selected={selected.id === patient.id}>
                <td>
                  <button type="button" onClick={() => setSelected(patient)} className={styles.secondaryButton}>
                    {patient.id}
                  </button>
                </td>
                <td>P{patient.urgency}</td>
                <td>{patient.elapsed}</td>
                <td>
                  {patient.cohort} · {patient.setting}
                </td>
                <td>{patient.catchment}</td>
                <td>{patient.blocker}</td>
                <td className={styles.score}>{patient.score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <DecisionPanel
        patient={selected}
        role={role}
        selectedCode={selected.destinationCode}
        onSelectCode={() => undefined}
      />
    </div>
  );
}

function CapacityView() {
  const totals = {
    available: wardHospitals.reduce((sum, hospital) => sum + hospital.available, 0),
    held: wardHospitals.reduce((sum, hospital) => sum + hospital.held, 0),
    potential: wardHospitals.reduce((sum, hospital) => sum + hospital.potential, 0),
    blocked: wardHospitals.reduce((sum, hospital) => sum + hospital.blocked, 0),
    occupied: wardHospitals.reduce((sum, hospital) => sum + hospital.occupied, 0),
  };
  return (
    <section className={styles.panel} data-testid="ward-capacity-view">
      <header className={styles.panelHeader}>
        <div>
          <h2>Ward-confirmed capacity</h2>
          <p>Availability is not suitability. Every count includes a freshness signal.</p>
        </div>
        <span className={styles.prototypeBadge}>Synthetic counts</span>
      </header>
      <div className={styles.capacitySummary}>
        {Object.entries(totals).map(([label, value]) => (
          <article className={styles.summaryCard} key={label}>
            <span>{label.replace(/^./, (character) => character.toUpperCase())}</span>
            <strong>{value}</strong>
            <small>Across 16 synthetic services</small>
          </article>
        ))}
      </div>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Service</th>
            <th>Region</th>
            <th>Capability cue</th>
            <th>Five bed states</th>
            <th>Freshness</th>
          </tr>
        </thead>
        <tbody>
          {wardHospitals.map((hospital) => (
            <tr key={hospital.id}>
              <td>
                <strong>{hospital.name}</strong>
                <div className={styles.microCopy}>{hospital.beds} total beds</div>
              </td>
              <td>{hospital.region}</td>
              <td>Adult / older adult · open / secure review</td>
              <td>
                <div className={styles.bedStates}>
                  <span>
                    <strong>{hospital.available}</strong>Now
                  </span>
                  <span>
                    <strong>{hospital.held}</strong>Held
                  </span>
                  <span>
                    <strong>{hospital.potential}</strong>Potential
                  </span>
                  <span>
                    <strong>{hospital.blocked}</strong>Blocked
                  </span>
                  <span>
                    <strong>{hospital.occupied}</strong>Occupied
                  </span>
                </div>
              </td>
              <td>
                <span className={hospital.lastConfirmed < "10:28" ? styles.statusWarning : styles.statusGood}>
                  {hospital.lastConfirmed < "10:28" ? "Review soon" : "Current"} · {hospital.lastConfirmed}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.notice}>
        Potential capacity requires a named action and estimate. No departing-patient details are shown in this
        prototype.
      </p>
    </section>
  );
}

function MovementsView() {
  return (
    <section className={styles.panel} data-testid="ward-movements-view">
      <header className={styles.panelHeader}>
        <div>
          <h2>Patient movement board</h2>
          <p>Cross-catchment escalation remains a flag, not an extra stage.</p>
        </div>
        <span className={styles.prototypeBadge}>Shared record · role-owned actions</span>
      </header>
      <div className={styles.stageBoard}>
        {movementStages.map((stage) => (
          <section className={styles.stageColumn} key={stage.id} aria-labelledby={`movement-${stage.id}`}>
            <header>
              <h2 id={`movement-${stage.id}`}>{stage.label}</h2>
              <strong>{stage.count}</strong>
            </header>
            {wardPatients
              .filter((patient) => patient.stage === stage.id)
              .slice(0, 4)
              .map((patient) => (
                <Link className={styles.movementCard} href={`/ward-management/patients/${patient.id}`} key={patient.id}>
                  <span className={styles.rowTop}>
                    <strong>{patient.id}</strong>
                    <span className={toneClass(patient.urgency === 1 ? "danger" : "neutral")}>P{patient.urgency}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    {patient.elapsed} · {patient.catchment} · {patient.setting}
                  </span>
                  <span className={styles.rowMeta}>{patient.owner}</span>
                </Link>
              ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function ExceptionsView() {
  return (
    <div className={styles.pageGrid} data-testid="ward-exceptions-view">
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Action exceptions</h2>
            <p>Only items with an owner and required next action appear here.</p>
          </div>
          <span className={styles.statusDanger}>1 overdue</span>
        </header>
        <div className={styles.exceptionList}>
          {exceptions.map((item) => (
            <article className={styles.exceptionRow} key={`${item.patientId}-${item.title}`}>
              <CircleAlert aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.patientId} · {item.action}
                </small>
              </div>
              <div>
                <span className={toneClass(item.tone)}>{item.timing}</span>
                <small>{item.owner}</small>
              </div>
              <Link className={styles.secondaryButton} href={`/ward-management/patients/${item.patientId}`}>
                Open <ArrowRight aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <aside className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Exception rules</h2>
            <p>Actionable, owned and time-bounded</p>
          </div>
        </header>
        <ul className={styles.reasonList}>
          {[
            "Unanswered destination review",
            "Expiring legal timing",
            "Expiring bed hold",
            "Delayed transport",
            "Stale ward capacity state",
            "Newly available higher-fit destination",
          ].map((rule) => (
            <li key={rule}>
              <CheckCircle2 aria-hidden="true" /> {rule}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function TransportView() {
  const transportPatients = wardPatients.filter((patient) => patient.stage !== "arrived").slice(0, 8);
  return (
    <div className={styles.pageGrid} data-testid="ward-transport-view">
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Transport readiness</h2>
            <p>Metro and country pathways retain distinct documentation and escalation cues.</p>
          </div>
          <span className={styles.prototypeBadge}>No dispatch integration</span>
        </header>
        <div className={styles.transportList}>
          {transportPatients.map((patient) => {
            const delayed =
              patient.transport.toLowerCase().includes("delay") || patient.transport.toLowerCase().includes("pending");
            return (
              <article className={styles.transportRow} key={patient.id}>
                <Truck aria-hidden="true" />
                <div>
                  <strong>{patient.id}</strong>
                  <small>
                    {patient.catchment} · {patient.voluntaryStatus}
                  </small>
                </div>
                <div>
                  <span className={delayed ? styles.statusWarning : styles.statusGood}>{patient.transport}</span>
                  <small>{patient.legalDetail}</small>
                </div>
                <Link className={styles.secondaryButton} href={`/ward-management/patients/${patient.id}`}>
                  Review <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <aside className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Safe transfer chain</h2>
            <p>Visible prerequisites before a movement advances</p>
          </div>
        </header>
        <ul className={styles.reasonList}>
          <li>
            <FileCheck2 aria-hidden="true" /> Legal form and transport risk documentation ready
          </li>
          <li>
            <ShieldCheck aria-hidden="true" /> Receiving service and handover acceptance recorded
          </li>
          <li>
            <Truck aria-hidden="true" /> Provider, booking state and estimated time visible
          </li>
          <li>
            <MapPin aria-hidden="true" /> WACHS pathway and escalation ownership shown for country transfers
          </li>
        </ul>
        <p className={styles.notice}>
          Police transport is represented only as an escalation state; this prototype does not dispatch or track
          vehicles.
        </p>
      </aside>
    </div>
  );
}

function GovernanceView() {
  const sources = [
    ["WA Health System Flow Centre", "https://www.health.wa.gov.au/Improving-WA-Health/System-Flow-Centre"],
    [
      "Mental Health Act 2014 forms",
      "https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/",
    ],
    ["WA mental health patient transport", "https://www.health.wa.gov.au/Articles/J_M/Mental-health-patient-transport"],
    [
      "WA Health Artificial Intelligence Policy",
      "https://www.health.wa.gov.au/about-us/policy-frameworks/digital-health/mandatory-requirements/artificial-intelligence-policy",
    ],
  ];
  return (
    <div data-testid="ward-governance-view">
      <section className={styles.assuranceGrid}>
        <article className={styles.governanceCard}>
          <Sparkles aria-hidden="true" />
          <h2>Explainable proposal</h2>
          <p>
            Eligibility is checked before ranking. Positive reasons, exclusions, alternatives and calculation time
            remain inspectable.
          </p>
        </article>
        <article className={styles.governanceCard}>
          <UserRound aria-hidden="true" />
          <h2>Human authority</h2>
          <p>
            An authorised user confirms or overrides every destination. The system never changes the human urgency tier
            or allocates a bed.
          </p>
        </article>
        <article className={styles.governanceCard}>
          <LockKeyhole aria-hidden="true" />
          <h2>Minimum data</h2>
          <p>
            Synthetic ID and operational fields only. No name, MRN, DOB, address, diagnosis, narrative history or
            treatment details.
          </p>
        </article>
        <article className={styles.governanceCard}>
          <Scale aria-hidden="true" />
          <h2>Contestable outcome</h2>
          <p>Users can select an alternative, record an override reason and see which factor changed the ordering.</p>
        </article>
        <article className={styles.governanceCard}>
          <Fingerprint aria-hidden="true" />
          <h2>Immutable ownership</h2>
          <p>
            The production concept requires role-based access and an immutable audit of source updates, recommendations
            and decisions.
          </p>
        </article>
        <article className={styles.governanceCard}>
          <Info aria-hidden="true" />
          <h2>Prototype boundary</h2>
          <p>
            No live systems, cloud AI, transport provider, police, PAS, PSOLIS or bed-management integration is used
            here.
          </p>
        </article>
      </section>
      <div className={`${styles.pageGrid} ${styles.governanceLowerGrid}`}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2>Synthetic decision audit</h2>
              <p>Representative review trail for WF-204</p>
            </div>
          </header>
          <ol className={styles.auditList}>
            <li>
              <CheckCircle2 aria-hidden="true" /> 10:42 · operational shortlist recalculated after ward capacity
              confirmation
            </li>
            <li>
              <Clock3 aria-hidden="true" /> 10:40 · FSH capacity confirmed by ward manager
            </li>
            <li>
              <FileClock aria-hidden="true" /> 10:18 · destination review created by flow coordinator
            </li>
            <li>
              <CalendarDays aria-hidden="true" /> 09:55 · referral sent by ED mental health team
            </li>
          </ol>
        </section>
        <aside className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <h2>Public grounding</h2>
              <p>Wireframe context, not internal operational policy</p>
            </div>
          </header>
          <ul className={styles.sourceList}>
            {sources.map(([label, href]) => (
              <li key={href}>
                <CheckCircle2 aria-hidden="true" />
                <a href={href} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function RoleFocus({ role }: { role: WardRole }) {
  const focus = roleFocusCopy[role];
  return (
    <section className={styles.roleFocus} aria-live="polite">
      <strong>{focus.title}</strong>
      <span>{focus.detail}</span>
    </section>
  );
}

function ModeBody({ mode, role }: { mode: Exclude<WardMode, "command">; role: WardRole }) {
  if (mode === "constellation") return <ConstellationView role={role} />;
  if (mode === "network") return <WardNetworkWorkspace />;
  if (mode === "queue") return <QueueView role={role} />;
  if (mode === "capacity") return <CapacityView />;
  if (mode === "movements") return <MovementsView />;
  if (mode === "exceptions") return <ExceptionsView />;
  if (mode === "transport") return <TransportView />;
  return <GovernanceView />;
}

export function WardModeWorkspace({ mode }: { mode: Exclude<WardMode, "command"> }) {
  const [role, setRole] = useState<WardRole>("flow");
  return (
    <div className={styles.modeShell} data-testid={`ward-mode-${mode}`} data-role={role}>
      <ClinicalRail />
      <ModeHeader mode={mode} role={role} onRoleChange={setRole} />
      <WardModeNavigation active={mode} />
      <main id="main-content" className={styles.modeContent}>
        <RoleFocus role={role} />
        <ModeBody mode={mode} role={role} />
      </main>
    </div>
  );
}
