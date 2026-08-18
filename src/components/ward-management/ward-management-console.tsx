"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BedSingle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  Filter,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import {
  movementStages,
  operationalPriorityScore,
  wardHospitalByCode,
  wardHospitals,
  wardPatientById,
  wardPatients,
  wardRegions,
  type MovementStage,
  type WardPatient,
  type WardRole,
} from "@/components/ward-management/synthetic-fixtures";
import { ClinicalRail, WardModeNavigation } from "@/components/ward-management/ward-management-navigation";

import styles from "./ward-management.module.css";

const stageIcons = {
  placement_requested: FileCheck2,
  destination_review: Search,
  bed_held: CalendarDays,
  handover_ready: ShieldCheck,
  moving: Truck,
  arrived: CheckCircle2,
} satisfies Record<MovementStage, typeof Search>;

const roleLabels: Record<WardRole, string> = {
  flow: "Flow coordinator",
  ed: "ED mental health",
  ward: "Ward manager",
};

const actionInbox = [
  {
    id: "destination-overdue",
    tone: "danger",
    icon: CircleAlert,
    title: "Review overdue",
    detail: "WF-198 · 1h 12m",
    owner: "Flow coordinator",
  },
  {
    id: "hold-expiry",
    tone: "warning",
    icon: Clock3,
    title: "Hold expires",
    detail: "WF-204 · 11:00",
    owner: "Ward manager",
  },
  {
    id: "transport-delay",
    tone: "warning",
    icon: Truck,
    title: "Transport delayed",
    detail: "WF-201 · ETA +90m",
    owner: "ED mental health",
  },
] as const;

const roleQueueHint: Record<WardRole, string> = {
  flow: "Tier first · AI within tier",
  ed: "Readiness and referral tasks",
  ward: "Capacity and acceptance tasks",
};

const roleTaskLabel: Record<WardRole, string> = {
  flow: "Review & confirm",
  ed: "Confirm ED readiness",
  ward: "Accept and hold bed",
};

function stageLabel(stage: MovementStage) {
  return movementStages.find((item) => item.id === stage)?.label ?? stage;
}

function shortHospitalName(name: string) {
  return name.replace("Sir Charles Gairdner", "SCGH").replace("Fiona Stanley", "FSH").replace("Royal Perth", "RPH");
}

function QueueBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" }) {
  return <span className={tone === "danger" ? styles.queueBadgeDanger : styles.queueBadge}>{children}</span>;
}

function PatientQueueItem({
  patient,
  position,
  selected,
  onSelect,
}: {
  patient: WardPatient;
  position?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={selected ? styles.patientRowSelected : styles.patientRow}
      data-testid={`ward-patient-${patient.id}`}
    >
      <span className={styles.patientRowTop}>
        {position ? <span className={styles.queuePosition}>{position}</span> : null}
        <strong>{patient.id}</strong>
        <QueueBadge tone={patient.urgency === 1 ? "danger" : "neutral"}>P{patient.urgency}</QueueBadge>
        <span className={styles.elapsed}>{patient.elapsed}</span>
        <span className={styles.destinationCode}>{patient.destinationCode}</span>
      </span>
      <span className={styles.patientBadges}>
        <QueueBadge>{patient.cohort}</QueueBadge>
        <QueueBadge>{patient.setting}</QueueBadge>
        <QueueBadge>{patient.catchment}</QueueBadge>
        <strong>{patient.score}%</strong>
      </span>
      <span className={styles.patientMeta}>
        {patient.voluntaryStatus} <span aria-hidden="true">·</span> {patient.referralStatus}
      </span>
    </button>
  );
}

function CapacityLine({
  state,
  count,
  label,
}: {
  state: "available" | "held" | "potential" | "blocked" | "occupied";
  count: number;
  label: string;
}) {
  return (
    <span className={styles.capacityLine}>
      <span className={styles[`status-${state}`]} aria-hidden="true" />
      <strong>{count}</strong>
      <span>{label}</span>
    </span>
  );
}

function HospitalNode({
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
      className={selected ? styles.hospitalNodeSelected : styles.hospitalNode}
      data-testid={`ward-hospital-${hospital.code}`}
    >
      <span className={styles.hospitalHeading}>
        <span>
          <strong>{["SCGH", "RPH", "FSH"].includes(hospital.code) ? hospital.code : hospital.name}</strong>
          <small>{hospital.beds} beds</small>
        </span>
        <ArrowRight aria-hidden="true" />
      </span>
      <span className={styles.capacityGrid}>
        <CapacityLine state="available" count={hospital.available} label="Available" />
        <CapacityLine state="held" count={hospital.held} label="Held" />
        <CapacityLine state="potential" count={hospital.potential} label="Potential" />
        <CapacityLine state="blocked" count={hospital.blocked} label="Blocked" />
        <CapacityLine state="occupied" count={hospital.occupied} label="Occupied" />
      </span>
      <span className={styles.lastConfirmed}>Last confirmed&nbsp; {hospital.lastConfirmed}</span>
    </button>
  );
}

function QueuePanel({
  role,
  patients,
  selectedPatient,
  collapsed,
  onCollapse,
  onSelectPatient,
}: {
  role: WardRole;
  patients: WardPatient[];
  selectedPatient: WardPatient;
  collapsed: boolean;
  onCollapse: () => void;
  onSelectPatient: (patient: WardPatient) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  if (collapsed) {
    return (
      <aside className={styles.queueCollapsed} aria-label="Collapsed urgency queue">
        <button
          type="button"
          onClick={onCollapse}
          aria-expanded="false"
          aria-controls="ward-urgency-queue"
          className={styles.expandQueue}
        >
          <ChevronsRight aria-hidden="true" />
          <span className="sr-only">Expand urgency queue</span>
        </button>
        <strong className={styles.collapsedCount}>{patients.length}</strong>
        <div className={styles.priorityMarkers}>
          {patients.slice(0, 8).map((patient) => (
            <button
              type="button"
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              aria-label={`Select ${patient.id}, priority ${patient.urgency}, score ${patient.score}`}
              aria-pressed={patient.id === selectedPatient.id}
              className={patient.id === selectedPatient.id ? styles.priorityMarkerSelected : styles.priorityMarker}
            >
              P{patient.urgency}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside id="ward-urgency-queue" className={styles.queuePanel} aria-label="Urgency queue" tabIndex={-1}>
      <header className={styles.queueHeader}>
        <div>
          <h2>
            Urgency queue <span>{patients.length}</span>
          </h2>
          <p>{roleQueueHint[role]}</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-expanded="true"
          aria-controls="ward-urgency-queue"
          className={styles.collapseQueue}
        >
          <ChevronsLeft aria-hidden="true" />
          <span>Collapse queue</span>
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="ward-queue-filters"
          className={styles.filterButton}
        >
          <Filter aria-hidden="true" />
          <span>Filter & sort</span>
          <ChevronDown aria-hidden="true" />
        </button>
        {filtersOpen ? (
          <div id="ward-queue-filters" className={styles.filterSummary}>
            <span>Urgency tier</span>
            <span>Longest wait</span>
            <span>All catchments</span>
          </div>
        ) : null}
      </header>
      <div className={styles.queueScroll} tabIndex={0} aria-label="Scrollable patient priority list">
        <p className={styles.queueSectionLabel}>Pinned (top priority)</p>
        <PatientQueueItem
          patient={patients[0]}
          selected={selectedPatient.id === patients[0].id}
          onSelect={() => onSelectPatient(patients[0])}
        />
        <p className={styles.queueSectionLabel}>Other patients</p>
        {patients.slice(1).map((patient, index) => (
          <PatientQueueItem
            key={patient.id}
            patient={patient}
            position={index + 2}
            selected={selectedPatient.id === patient.id}
            onSelect={() => onSelectPatient(patient)}
          />
        ))}
      </div>
      <footer className={styles.queueFooter}>
        <span>
          1–{Math.min(8, patients.length)} of {patients.length}
        </span>
        <Link href="/ward-management/queue">
          Open full queue <ArrowRight aria-hidden="true" />
        </Link>
      </footer>
    </aside>
  );
}

function ActionInbox({ onOpen }: { onOpen: (item: (typeof actionInbox)[number] | null) => void }) {
  return (
    <section className={styles.actionInbox} aria-label="Action inbox">
      {actionInbox.map((item) => {
        const Icon = item.icon;
        return (
          <button type="button" key={item.id} onClick={() => onOpen(item)} className={styles.inboxItem}>
            <Icon aria-hidden="true" data-tone={item.tone} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
            <span>{item.owner}</span>
          </button>
        );
      })}
      <button type="button" onClick={() => onOpen(null)} className={styles.viewInbox}>
        View inbox <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}

function MovementPipeline({
  activeStage,
  onStageChange,
}: {
  activeStage: MovementStage;
  onStageChange: (stage: MovementStage) => void;
}) {
  return (
    <nav className={styles.movementPipeline} aria-label="Patient movement stages">
      {movementStages.map((stage, index) => {
        const Icon = stageIcons[stage.id];
        const active = stage.id === activeStage;
        return (
          <div className={styles.stageGroup} key={stage.id}>
            <button
              type="button"
              onClick={() => onStageChange(stage.id)}
              aria-current={active ? "step" : undefined}
              className={active ? styles.stageActive : styles.stage}
            >
              <Icon aria-hidden="true" />
              <span className={styles.stageNumber}>{index + 1}</span>
              <span>
                <strong>{stage.label}</strong>
                <b>{stage.count}</b>
              </span>
            </button>
            {index < movementStages.length - 1 ? <ArrowRight className={styles.stageArrow} aria-hidden="true" /> : null}
          </div>
        );
      })}
    </nav>
  );
}

function WardNetwork({
  selectedHospitalCode,
  onSelectHospital,
}: {
  selectedHospitalCode: string;
  onSelectHospital: (code: string) => void;
}) {
  return (
    <section className={styles.networkPanel} aria-labelledby="network-heading">
      <h2 id="network-heading" className="sr-only">
        WA psychiatry bed network
      </h2>
      <div className={styles.regionGrid}>
        {wardRegions.map((region) => {
          const hospitals = wardHospitals.filter((hospital) => hospital.region === region);
          const totalBeds = hospitals.reduce((sum, hospital) => sum + hospital.beds, 0);
          const totalAvailable = hospitals.reduce((sum, hospital) => sum + hospital.available, 0);
          return (
            <section className={styles.regionColumn} key={region} aria-labelledby={`region-${region}`}>
              <header className={styles.regionHeading}>
                <span className={styles.regionIcon}>
                  <Building2 aria-hidden="true" />
                </span>
                <span className={styles.networkLine} aria-hidden="true">
                  <ArrowRight aria-hidden="true" />
                </span>
                <h3 id={`region-${region}`}>{region}</h3>
                <p>
                  <strong>{totalBeds}</strong> beds <span>·</span> <b>{totalAvailable}</b> available
                </p>
              </header>
              <div className={styles.hospitalList}>
                {hospitals.map((hospital) => (
                  <HospitalNode
                    key={hospital.id}
                    hospital={hospital}
                    selected={selectedHospitalCode === hospital.code}
                    onSelect={() => onSelectHospital(hospital.code)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <footer className={styles.networkLegend}>
        <CapacityLine state="available" count={0} label="Available · ready for admission" />
        <CapacityLine state="held" count={0} label="Held · time-limited" />
        <CapacityLine state="potential" count={0} label="Potential · after action" />
        <CapacityLine state="blocked" count={0} label="Blocked · unavailable" />
        <CapacityLine state="occupied" count={0} label="Occupied · no bed" />
        <span className={styles.catchmentRule}>
          <CircleAlert aria-hidden="true" /> Local catchment first <span>·</span> statewide escalation when required
        </span>
      </footer>
    </section>
  );
}

function DecisionDock({
  patient,
  role,
  selectedHospitalCode,
  confirmed,
  onConfirm,
  onClose,
  onSelectHospital,
}: {
  patient: WardPatient;
  role: WardRole;
  selectedHospitalCode: string;
  confirmed: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onSelectHospital: (code: string) => void;
}) {
  const destination = wardHospitalByCode(selectedHospitalCode);
  const recommendationSelected =
    destination.code.startsWith(patient.destinationCode) || patient.destinationCode.startsWith(destination.code);
  return (
    <section className={styles.decisionDock} aria-label={`AI destination review for ${patient.id}`}>
      <button type="button" onClick={onClose} className={styles.closeDock} aria-label="Close patient decision panel">
        <X aria-hidden="true" />
      </button>
      <div className={styles.decisionIdentity}>
        <p>
          <strong>{patient.id}</strong>
          <span>·</span>
          {stageLabel(patient.stage)}
        </p>
        <span className={styles.aiLabel}>
          <Sparkles aria-hidden="true" /> AI best fit
        </span>
        <h3>
          {shortHospitalName(destination.name)}{" "}
          <span>
            {patient.cohort} {patient.setting}
          </span>{" "}
          <b>· {recommendationSelected ? patient.score : Math.max(patient.score - 8, 0)}%</b>
        </h3>
      </div>
      <div className={styles.matchReasons}>
        <span>
          <MapPin aria-hidden="true" /> {patient.catchment} catchment
        </span>
        <span>
          <UserRound aria-hidden="true" /> Exact {patient.cohort} {patient.setting} fit
        </span>
        <span>
          <BedSingle aria-hidden="true" /> {destination.available} beds available
        </span>
        <span>
          <Truck aria-hidden="true" /> {patient.transport}
        </span>
        <button type="button" onClick={() => document.getElementById("match-explanation")?.scrollIntoView()}>
          Why this match? <ChevronDown aria-hidden="true" />
        </button>
      </div>
      <div className={styles.prioritySummary}>
        <p>
          Priority <strong>{operationalPriorityScore(patient)}</strong>
          <span>·</span>Tier <strong>{patient.urgency}</strong>
        </p>
        <span>Alternatives</span>
        {patient.alternatives.slice(0, 2).map((alternative) => (
          <button
            type="button"
            key={alternative.hospitalCode}
            onClick={() => onSelectHospital(alternative.hospitalCode)}
          >
            {alternative.hospitalName} <strong>{alternative.score}%</strong>
          </button>
        ))}
      </div>
      <div className={styles.readiness}>
        <strong>Readiness</strong>
        <span>
          <CheckCircle2 aria-hidden="true" /> Forms ready
        </span>
        <span>
          <CheckCircle2 aria-hidden="true" /> Transport ready
        </span>
        <span>
          <CheckCircle2 aria-hidden="true" /> Confirmed {destination.lastConfirmed}
        </span>
        <span>
          <CheckCircle2 aria-hidden="true" /> {patient.blocker === "No blocker" ? "No blocker" : "Blocker visible"}
        </span>
      </div>
      <div className={styles.decisionActions}>
        <button type="button" onClick={onConfirm} className={confirmed ? styles.confirmedButton : styles.confirmButton}>
          {confirmed ? <Check aria-hidden="true" /> : null}
          {confirmed ? "Confirmed" : roleTaskLabel[role]}
        </button>
        <Link href={`/ward-management/patients/${patient.id}`}>
          Open full patient workspace <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <p className={styles.aiBoundary}>
        AI proposes <span>·</span> coordinator confirms <span>·</span> operational score, not clinical severity
      </p>
    </section>
  );
}

export function WardManagementConsole() {
  const [role, setRole] = useState<WardRole>("flow");
  const [selectedPatient, setSelectedPatient] = useState<WardPatient>(wardPatients[0]);
  const [selectedHospitalCode, setSelectedHospitalCode] = useState(wardPatients[0].destinationCode);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [activeStage, setActiveStage] = useState<MovementStage>("destination_review");
  const [decisionOpen, setDecisionOpen] = useState(true);
  const [confirmedPatientId, setConfirmedPatientId] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [selectedInboxItem, setSelectedInboxItem] = useState<(typeof actionInbox)[number] | null>(actionInbox[0]);

  const rolePatients = useMemo(() => {
    if (role === "flow") return wardPatients;
    if (role === "ed")
      return [...wardPatients].sort((a, b) => Number(b.owner.includes("ED")) - Number(a.owner.includes("ED")));
    return [...wardPatients].sort((a, b) => Number(b.owner.includes("Ward")) - Number(a.owner.includes("Ward")));
  }, [role]);

  function selectPatient(patient: WardPatient) {
    const rolePatient = rolePatients.find((candidate) => candidate.id === patient.id) ?? patient;
    setSelectedPatient(rolePatient);
    setSelectedHospitalCode(rolePatient.destinationCode);
    setActiveStage(rolePatient.stage);
    setDecisionOpen(true);
    setConfirmedPatientId(null);
  }

  function openInbox(item: (typeof actionInbox)[number] | null) {
    setSelectedInboxItem(item);
    setInboxOpen(true);
  }

  return (
    <div
      className={queueCollapsed ? styles.consoleCollapsed : styles.console}
      data-testid="ward-management-console"
      data-role={role}
    >
      <ClinicalRail />
      <header className={styles.commandHeader}>
        <div className={styles.productIdentity}>
          <span>
            <strong>Clinical KB</strong>
            <small>Source-backed clinical search</small>
          </span>
        </div>
        <div className={styles.pageIdentity}>
          <h1>Ward Flow</h1>
          <label>
            <UserRound aria-hidden="true" />
            <span className="sr-only">Current role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as WardRole)}>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          <span>
            <Clock3 aria-hidden="true" /> Updated 10:42
          </span>
          <span>
            <CalendarDays aria-hidden="true" /> 15 Aug 2026
          </span>
          <span>
            WA <MapPin aria-hidden="true" />
          </span>
        </div>
      </header>

      <QueuePanel
        role={role}
        patients={rolePatients}
        selectedPatient={selectedPatient}
        collapsed={queueCollapsed}
        onCollapse={() => setQueueCollapsed((collapsed) => !collapsed)}
        onSelectPatient={selectPatient}
      />

      <main id="main-content" className={styles.commandMain}>
        <WardModeNavigation active="command" />
        <ActionInbox onOpen={openInbox} />
        <MovementPipeline activeStage={activeStage} onStageChange={setActiveStage} />
        <WardNetwork
          selectedHospitalCode={selectedHospitalCode}
          onSelectHospital={(code) => {
            setSelectedHospitalCode(code);
            setDecisionOpen(true);
            setConfirmedPatientId(null);
          }}
        />
        {decisionOpen ? (
          <DecisionDock
            patient={selectedPatient}
            role={role}
            selectedHospitalCode={selectedHospitalCode}
            confirmed={confirmedPatientId === selectedPatient.id}
            onConfirm={() => setConfirmedPatientId(selectedPatient.id)}
            onClose={() => setDecisionOpen(false)}
            onSelectHospital={(code) => {
              setSelectedHospitalCode(code);
              setConfirmedPatientId(null);
            }}
          />
        ) : (
          <button type="button" onClick={() => setDecisionOpen(true)} className={styles.reopenDecision}>
            <Sparkles aria-hidden="true" /> Review AI match for {selectedPatient.id}
          </button>
        )}
        <span className="sr-only" aria-live="polite">
          {confirmedPatientId ? `Destination confirmed for ${confirmedPatientId}` : ""}
        </span>
      </main>

      <Sheet
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        title={selectedInboxItem ? selectedInboxItem.title : "Action inbox"}
        description={
          selectedInboxItem
            ? `${selectedInboxItem.detail}. Owned by ${selectedInboxItem.owner}.`
            : "Operational exceptions requiring an owned next action."
        }
        contentClassName={styles.inboxSheet}
      >
        <div className={styles.inboxSheetBody}>
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
          {selectedInboxItem ? (
            <>
              <h3>Required action</h3>
              <p>
                Open the matching patient movement, check the current blocker and timing, then record the next owned
                action.
              </p>
              <button
                type="button"
                onClick={() => {
                  const patientId = selectedInboxItem.detail.split(" · ")[0];
                  selectPatient(wardPatientById(patientId));
                  setInboxOpen(false);
                }}
              >
                Open patient movement <ArrowRight aria-hidden="true" />
              </button>
            </>
          ) : (
            actionInbox.map((item) => (
              <button type="button" key={item.id} onClick={() => setSelectedInboxItem(item)}>
                <strong>{item.title}</strong>
                <span>
                  {item.detail} · {item.owner}
                </span>
              </button>
            ))
          )}
        </div>
      </Sheet>
    </div>
  );
}

export function WardPatientWorkspace({ patientId }: { patientId: string }) {
  const patient = wardPatientById(patientId);
  const destination = wardHospitalByCode(patient.destinationCode);
  const [confirmed, setConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "legal" | "transport" | "timeline">("overview");
  const [activeStage, setActiveStage] = useState<MovementStage>(patient.stage);

  return (
    <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
      <ClinicalRail />
      <header className={styles.workspaceHeader}>
        <Link href="/ward-management" aria-label="Back to Ward Flow">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <div>
          <span>Ward Flow</span>
          <h1>{patient.id} movement workspace</h1>
        </div>
        <span className={styles.prototypeBadge}>Synthetic prototype</span>
      </header>
      <main id="main-content" className={styles.workspaceMain}>
        <section className={styles.workspaceSummary}>
          <div>
            <span className={styles.aiLabel}>
              <Sparkles aria-hidden="true" /> AI best fit
            </span>
            <h2>{destination.name}</h2>
            <p>
              {patient.catchment} catchment · {patient.cohort} {patient.setting} · {patient.score}% operational fit
            </p>
          </div>
          <div className={styles.workspaceScore}>
            <span>Operational priority</span>
            <strong>{operationalPriorityScore(patient)}</strong>
            <small>Tier {patient.urgency} leads</small>
          </div>
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className={confirmed ? styles.confirmedButton : styles.confirmButton}
          >
            {confirmed ? <Check aria-hidden="true" /> : null}
            {confirmed ? "Destination confirmed" : "Review & confirm"}
          </button>
        </section>

        <MovementPipeline activeStage={activeStage} onStageChange={setActiveStage} />

        <nav className={styles.workspaceTabs} aria-label="Patient movement sections">
          {(["overview", "legal", "transport", "timeline"] as const).map((section) => (
            <button
              type="button"
              key={section}
              onClick={() => setActiveSection(section)}
              aria-pressed={activeSection === section}
            >
              {section === "overview"
                ? "Overview"
                : section === "legal"
                  ? "Legal & forms"
                  : section === "transport"
                    ? "Transport"
                    : "Audit timeline"}
            </button>
          ))}
        </nav>

        <div className={styles.workspaceGrid}>
          <section>
            <h2>Movement facts</h2>
            <dl className={styles.factList}>
              <div>
                <dt>Current stage</dt>
                <dd>{stageLabel(patient.stage)}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{patient.owner}</dd>
              </div>
              <div>
                <dt>Referral</dt>
                <dd>{patient.referredTo}</dd>
              </div>
              <div>
                <dt>Response</dt>
                <dd>{patient.referralStatus}</dd>
              </div>
              <div>
                <dt>Catchment</dt>
                <dd>{patient.catchment}</dd>
              </div>
              <div>
                <dt>Setting</dt>
                <dd>
                  {patient.cohort} · {patient.setting}
                </dd>
              </div>
            </dl>
          </section>

          <section id="match-explanation">
            <h2>Why this match</h2>
            <ul className={styles.reasonList}>
              {patient.recommendationReasons.map((reason) => (
                <li key={reason}>
                  <CheckCircle2 aria-hidden="true" /> {reason}
                </li>
              ))}
            </ul>
            <h3>Alternatives</h3>
            {patient.alternatives.map((alternative) => (
              <div className={styles.alternativeRow} key={alternative.hospitalCode}>
                <span>
                  <strong>{alternative.hospitalName}</strong>
                  <small>{alternative.reason}</small>
                </span>
                <b>{alternative.score}%</b>
              </div>
            ))}
          </section>

          <section>
            <h2>Readiness</h2>
            <ul className={styles.readinessList}>
              <li>
                <FileCheck2 aria-hidden="true" />
                <span>
                  <strong>Legal status</strong>
                  {patient.voluntaryStatus}
                </span>
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Form readiness</strong>
                  {patient.legalDetail}
                </span>
              </li>
              <li>
                <Truck aria-hidden="true" />
                <span>
                  <strong>Transport</strong>
                  {patient.transport}
                </span>
              </li>
              <li>
                <CircleAlert aria-hidden="true" />
                <span>
                  <strong>Current blocker</strong>
                  {patient.blocker}
                </span>
              </li>
            </ul>
          </section>
        </div>

        {activeSection === "legal" ? (
          <section className={styles.contextPanel}>
            <h2>Legal and forms</h2>
            <p>{patient.voluntaryStatus}</p>
            <p>{patient.legalDetail}</p>
          </section>
        ) : null}
        {activeSection === "transport" ? (
          <section className={styles.contextPanel}>
            <h2>Transport chain</h2>
            <p>{patient.transport}</p>
            <p>
              Provider, ETA, risk documentation and legal-form readiness are visible here; dispatch and live vehicle
              tracking are not part of this prototype.
            </p>
          </section>
        ) : null}
        {activeSection === "timeline" ? (
          <section className={styles.contextPanel}>
            <h2>Synthetic audit timeline</h2>
            <ol className={styles.timeline}>
              <li>
                <time>10:40</time>
                <span>Ward capacity confirmed by ward manager</span>
              </li>
              <li>
                <time>10:18</time>
                <span>AI shortlist recalculated after availability update</span>
              </li>
              <li>
                <time>09:55</time>
                <span>Referral sent to {patient.destinationName}</span>
              </li>
              <li>
                <time>09:42</time>
                <span>Movement record created by ED mental health team</span>
              </li>
            </ol>
          </section>
        ) : null}

        <p className={styles.governanceNote}>
          Synthetic prototype only. AI proposes an explainable operational fit; an authorised human confirms every
          destination. This score is not clinical severity.
        </p>
        <span className="sr-only" aria-live="polite">
          {confirmed ? `Destination confirmed for ${patient.id}` : ""}
        </span>
      </main>
    </div>
  );
}
