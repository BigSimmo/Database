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
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { clockState, formatInstant } from "@/components/ward-management/ward-clock";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  buildActionInbox,
  candidateReason,
  destinationUnit,
  eligibleCandidates,
  elapsedLabel,
  movementHealthService,
  movementStageSummary,
  movementTimeline,
  roleLabels,
  roleTaskLabel,
  stageCopy,
  transportStatusLabel,
  unitCapacity,
  unitSiteCode,
  wardServiceOrder,
  type InboxItem,
  type WardRole,
} from "@/components/ward-management/ward-derivations";
import {
  MOVEMENT_STAGES,
  type Movement,
  type MovementStage,
  type TransportJob,
  type Unit,
} from "@/components/ward-management/ward-model";
import { movementById, wardMovements } from "@/components/ward-management/ward-movements";
import { ClinicalRail, WardModeNavigation } from "@/components/ward-management/ward-management-navigation";
import { NOW_ANCHOR, allUnits, siteByCode, unitById } from "@/components/ward-management/ward-sites";

import styles from "./ward-management.module.css";

const stageIcons = {
  placement_requested: FileCheck2,
  destination_review: Search,
  accepted_awaiting_bed: BedSingle,
  bed_held: CalendarDays,
  handover_ready: ShieldCheck,
  moving: Truck,
  arrived: CheckCircle2,
} satisfies Record<MovementStage, LucideIcon>;

const roleQueueHint: Record<WardRole, string> = {
  flow: "Tier first · eligibility within tier",
  ed: "Readiness and referral tasks",
  ward: "Capacity and acceptance tasks",
};

function QueueBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "danger" }) {
  return <span className={tone === "danger" ? styles.queueBadgeDanger : styles.queueBadge}>{children}</span>;
}

function PatientQueueItem({
  patient,
  position,
  selected,
  onSelect,
}: {
  patient: Movement;
  position?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const destination = destinationUnit(patient);
  const service = movementHealthService(patient);
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
        <span className={styles.elapsed}>{elapsedLabel(patient, NOW_ANCHOR)}</span>
        <span className={styles.destinationCode}>{destination ? unitSiteCode(destination) : "No destination"}</span>
      </span>
      <span className={styles.patientBadges}>
        <QueueBadge>{patient.cohort}</QueueBadge>
        <QueueBadge>{patient.security}</QueueBadge>
        <QueueBadge>{service ?? "Unknown service"}</QueueBadge>
      </span>
      <span className={styles.patientMeta}>
        {patient.legalStatus} <span aria-hidden="true">·</span> {stageCopy[patient.stage].label}
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

function HospitalNode({ unit, selected, onSelect }: { unit: Unit; selected: boolean; onSelect: () => void }) {
  const capacity = unitCapacity(unit);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={selected ? styles.hospitalNodeSelected : styles.hospitalNode}
      data-testid={`ward-unit-${unit.id}`}
    >
      <span className={styles.hospitalHeading}>
        <span>
          <strong>{unit.name}</strong>
          <small>{unit.beds} beds</small>
        </span>
        <ArrowRight aria-hidden="true" />
      </span>
      <span className={styles.capacityGrid}>
        <CapacityLine state="available" count={capacity.available} label="Available" />
        <CapacityLine state="held" count={capacity.held} label="Held" />
        <CapacityLine state="potential" count={capacity.potential} label="Potential" />
        <CapacityLine state="blocked" count={capacity.blocked} label="Blocked" />
        <CapacityLine state="occupied" count={capacity.occupied} label="Occupied" />
      </span>
      <span className={styles.lastConfirmed}>Last confirmed&nbsp; {formatInstant(unit.allocatable.confirmedAt)}</span>
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
  patients: Movement[];
  selectedPatient: Movement;
  collapsed: boolean;
  onCollapse: () => void;
  onSelectPatient: (patient: Movement) => void;
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
              aria-label={`Select ${patient.id}, priority ${patient.urgency}`}
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
            <span>All health services</span>
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

function ActionInbox({ items, onOpen }: { items: InboxItem[]; onOpen: (item: InboxItem | null) => void }) {
  return (
    <section className={styles.actionInbox} aria-label="Action inbox">
      {items.map((item) => {
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
      {movementStageSummary.map((stage, index) => {
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
            {index < movementStageSummary.length - 1 ? (
              <ArrowRight className={styles.stageArrow} aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function WardNetwork({
  selectedUnitId,
  onSelectUnit,
}: {
  selectedUnitId: string | undefined;
  onSelectUnit: (id: string) => void;
}) {
  return (
    <section className={styles.networkPanel} aria-labelledby="network-heading">
      <h2 id="network-heading" className="sr-only">
        WA psychiatry bed network
      </h2>
      <div className={styles.regionGrid}>
        {wardServiceOrder.map((service) => {
          const units = allUnits().filter((unit) => siteByCode(unit.siteCode)?.service === service);
          const totalBeds = units.reduce((sum, unit) => sum + unit.beds, 0);
          const totalAvailable = units.reduce((sum, unit) => sum + unit.allocatable.value, 0);
          return (
            <section className={styles.regionColumn} key={service} aria-labelledby={`network-service-${service}`}>
              <header className={styles.regionHeading}>
                <span className={styles.regionIcon}>
                  <Building2 aria-hidden="true" />
                </span>
                <span className={styles.networkLine} aria-hidden="true">
                  <ArrowRight aria-hidden="true" />
                </span>
                <h3 id={`network-service-${service}`}>{service}</h3>
                <p>
                  <strong>{totalBeds}</strong> beds <span>·</span> <b>{totalAvailable}</b> available
                </p>
              </header>
              <div className={styles.hospitalList}>
                {units.map((unit) => (
                  <HospitalNode
                    key={unit.id}
                    unit={unit}
                    selected={selectedUnitId === unit.id}
                    onSelect={() => onSelectUnit(unit.id)}
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
          <CircleAlert aria-hidden="true" /> Local health service first <span>·</span> statewide escalation when
          required
        </span>
      </footer>
    </section>
  );
}

/** A transport job only counts as ready once it has actually moved, not merely been
 * requested or accepted — "requested"/"accepted, awaiting departure"/"cancelled" all still
 * need a coordinator's attention, the same as no transport job at all. */
function transportReady(transport: TransportJob | undefined) {
  return (
    transport !== undefined &&
    (transport.enRouteAt !== undefined || transport.collectedAt !== undefined || transport.arrivedAt !== undefined)
  );
}

function DecisionDock({
  patient,
  role,
  selectedUnitId,
  confirmed,
  onConfirm,
  onClose,
  onSelectUnit,
}: {
  patient: Movement;
  role: WardRole;
  selectedUnitId: string | undefined;
  confirmed: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onSelectUnit: (id: string) => void;
}) {
  const recordedDestination = destinationUnit(patient);
  const displayedUnit = selectedUnitId ? unitById(selectedUnitId) : undefined;
  // The picker may be pre-seeded (or the coordinator may be previewing) a unit that is not yet
  // the movement's recorded destination. That is a legitimate affordance, but it must never be
  // presented as the destination unlabelled — see Task 6 Critical 2.
  const isSuggested = displayedUnit !== undefined && displayedUnit.id !== recordedDestination?.id;
  const verdict = displayedUnit ? eligibility(patient, displayedUnit, NOW_ANCHOR) : undefined;
  const candidates = useMemo(() => eligibleCandidates(patient, NOW_ANCHOR), [patient]);
  const alternatives = candidates.filter((candidate) => candidate.unit.id !== displayedUnit?.id).slice(0, 2);

  return (
    <section className={styles.decisionDock} aria-label={`AI destination review for ${patient.id}`}>
      <button type="button" onClick={onClose} className={styles.closeDock} aria-label="Close patient decision panel">
        <X aria-hidden="true" />
      </button>
      <div className={styles.decisionIdentity}>
        <p>
          <strong>{patient.id}</strong>
          <span>·</span>
          {stageCopy[patient.stage].label}
        </p>
        <span className={styles.aiLabel}>
          <Sparkles aria-hidden="true" /> {isSuggested ? "Suggested destination" : "Eligibility check"}
        </span>
        <h3>
          {displayedUnit ? displayedUnit.name : "No destination selected"}{" "}
          <span>
            {patient.cohort} {patient.security}
          </span>
        </h3>
        {isSuggested ? (
          <p className={styles.governanceNote}>
            Not yet referred to this unit —{" "}
            {verdict?.eligible ? "showing an eligible candidate." : "this candidate is not currently eligible."}
          </p>
        ) : null}
      </div>
      <div className={styles.matchReasons}>
        <span>
          <MapPin aria-hidden="true" /> {movementHealthService(patient) ?? "Unknown service"}
        </span>
        <span>
          <UserRound aria-hidden="true" /> Exact {patient.cohort} {patient.security} fit
        </span>
        {displayedUnit ? (
          <span>
            <BedSingle aria-hidden="true" /> {displayedUnit.allocatable.value} beds available
          </span>
        ) : null}
        <span>
          <Truck aria-hidden="true" /> {transportStatusLabel(patient.transport)}
        </span>
        <button type="button" onClick={() => document.getElementById("match-explanation")?.scrollIntoView()}>
          Why this match? <ChevronDown aria-hidden="true" />
        </button>
      </div>
      <div className={styles.prioritySummary}>
        <p>
          {verdict ? (
            <>
              <strong>{candidateReason(verdict)}</strong>
              <span>·</span>
            </>
          ) : null}
          Tier <strong>{patient.urgency}</strong>
        </p>
        <span>Alternatives</span>
        {alternatives.map((candidate) => (
          <button type="button" key={candidate.unit.id} onClick={() => onSelectUnit(candidate.unit.id)}>
            {candidate.unit.name} <strong>{candidate.verdict.eligible ? "Eligible" : "Not eligible"}</strong>
          </button>
        ))}
      </div>
      <div className={styles.readiness}>
        <strong>Readiness</strong>
        <span>
          {!patient.legalForm || clockState(patient.legalForm.dueAt, NOW_ANCHOR) !== "breached" ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <CircleAlert aria-hidden="true" />
          )}{" "}
          {patient.legalForm ? `${patient.legalForm.label} (${patient.legalForm.code})` : "No legal form required"}
        </span>
        <span>
          {transportReady(patient.transport) ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{" "}
          {transportStatusLabel(patient.transport)}
        </span>
        {displayedUnit ? (
          <span>
            <CheckCircle2 aria-hidden="true" /> Confirmed {formatInstant(displayedUnit.allocatable.confirmedAt)}
          </span>
        ) : null}
        <span>
          <CircleAlert aria-hidden="true" /> {patient.blocker}
        </span>
      </div>
      <div className={styles.decisionActions}>
        <button
          type="button"
          onClick={onConfirm}
          className={confirmed ? styles.confirmedButton : styles.confirmButton}
          disabled={!displayedUnit}
        >
          {confirmed ? <Check aria-hidden="true" /> : null}
          {confirmed ? "Confirmed" : roleTaskLabel[role]}
        </button>
        <Link href={`/ward-management/patients/${patient.id}`}>
          Open full patient workspace <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <p className={styles.aiBoundary}>
        Eligibility checked automatically <span>·</span> coordinator confirms <span>·</span> not clinical severity
      </p>
    </section>
  );
}

export function WardManagementConsole() {
  const [role, setRole] = useState<WardRole>("flow");
  const [selectedPatient, setSelectedPatient] = useState<Movement>(wardMovements[0]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(
    destinationUnit(wardMovements[0])?.id ?? eligibleCandidates(wardMovements[0], NOW_ANCHOR)[0]?.unit.id,
  );
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [activeStage, setActiveStage] = useState<MovementStage>(wardMovements[0].stage);
  const [decisionOpen, setDecisionOpen] = useState(true);
  const [confirmedPatientId, setConfirmedPatientId] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const actionInbox = useMemo(() => buildActionInbox(wardMovements, NOW_ANCHOR), []);
  const [selectedInboxItem, setSelectedInboxItem] = useState<InboxItem | null>(actionInbox[0] ?? null);

  const rolePatients = useMemo(() => {
    if (role === "flow") return wardMovements;
    if (role === "ed")
      return [...wardMovements].sort((a, b) => Number(b.owner.includes("ED")) - Number(a.owner.includes("ED")));
    return [...wardMovements].sort((a, b) => Number(b.owner.includes("Ward")) - Number(a.owner.includes("Ward")));
  }, [role]);

  function selectPatient(patient: Movement) {
    const rolePatient = rolePatients.find((candidate) => candidate.id === patient.id) ?? patient;
    setSelectedPatient(rolePatient);
    setSelectedUnitId(destinationUnit(rolePatient)?.id ?? eligibleCandidates(rolePatient, NOW_ANCHOR)[0]?.unit.id);
    setActiveStage(rolePatient.stage);
    setDecisionOpen(true);
    setConfirmedPatientId(null);
  }

  function openInbox(item: InboxItem | null) {
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
            <Clock3 aria-hidden="true" /> Updated {formatInstant(NOW_ANCHOR)}
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
        <ActionInbox items={actionInbox} onOpen={openInbox} />
        <MovementPipeline activeStage={activeStage} onStageChange={setActiveStage} />
        <WardNetwork
          selectedUnitId={selectedUnitId}
          onSelectUnit={(id) => {
            setSelectedUnitId(id);
            setDecisionOpen(true);
            setConfirmedPatientId(null);
          }}
        />
        {decisionOpen ? (
          <DecisionDock
            patient={selectedPatient}
            role={role}
            selectedUnitId={selectedUnitId}
            confirmed={confirmedPatientId === selectedPatient.id}
            onConfirm={() => setConfirmedPatientId(selectedPatient.id)}
            onClose={() => setDecisionOpen(false)}
            onSelectUnit={(id) => {
              setSelectedUnitId(id);
              setConfirmedPatientId(null);
            }}
          />
        ) : (
          <button type="button" onClick={() => setDecisionOpen(true)} className={styles.reopenDecision}>
            <Sparkles aria-hidden="true" /> Review destination for {selectedPatient.id}
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
                  const target = movementById(selectedInboxItem.movementId);
                  if (target) selectPatient(target);
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
  const patient = movementById(patientId);
  const [confirmed, setConfirmed] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "legal" | "transport" | "timeline">("overview");
  const [activeStage, setActiveStage] = useState<MovementStage>(patient?.stage ?? MOVEMENT_STAGES[0]);

  if (!patient) {
    return (
      <div className={styles.patientWorkspace} data-testid="ward-patient-workspace">
        <ClinicalRail />
        <header className={styles.workspaceHeader}>
          <Link href="/ward-management" aria-label="Back to Ward Flow">
            <ArrowLeft aria-hidden="true" />
          </Link>
          <div>
            <span>Ward Flow</span>
            <h1>Movement not found</h1>
          </div>
          <span className={styles.prototypeBadge}>Synthetic prototype</span>
        </header>
        <main id="main-content" className={styles.workspaceMain}>
          <p className={styles.governanceNote}>
            No synthetic movement matches &ldquo;{patientId}&rdquo;. It may have arrived and closed, or the id is
            incorrect.
          </p>
        </main>
      </div>
    );
  }

  // This workspace shows the movement's own record only — it never falls back to a
  // suggested/top-eligible unit, so `destination` here is always the real recorded destination
  // or nothing.
  const destination = destinationUnit(patient);
  const verdict = destination ? eligibility(patient, destination, NOW_ANCHOR) : undefined;
  const candidates = eligibleCandidates(patient, NOW_ANCHOR).filter(
    (candidate) => candidate.unit.id !== destination?.id,
  );
  const timeline = movementTimeline(patient);

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
              <Sparkles aria-hidden="true" /> Eligibility check
            </span>
            <h2>{destination ? destination.name : "No destination selected"}</h2>
            <p>
              {movementHealthService(patient) ?? "Unknown service"} · {patient.cohort} {patient.security}
            </p>
          </div>
          <div className={styles.workspaceScore}>
            <span>Eligibility</span>
            <strong>{verdict ? candidateReason(verdict) : "—"}</strong>
            <small>Tier {patient.urgency} leads</small>
          </div>
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className={confirmed ? styles.confirmedButton : styles.confirmButton}
            disabled={!destination}
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
                <dd>{stageCopy[patient.stage].label}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{patient.owner}</dd>
              </div>
              <div>
                <dt>Referral</dt>
                <dd>{destination ? destination.name : `${patient.referredUnitIds.length} referred`}</dd>
              </div>
              <div>
                <dt>Response</dt>
                <dd>{patient.blocker}</dd>
              </div>
              <div>
                <dt>Health service</dt>
                <dd>{movementHealthService(patient) ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Setting</dt>
                <dd>
                  {patient.cohort} · {patient.security}
                </dd>
              </div>
            </dl>
          </section>

          <section id="match-explanation">
            <h2>Why this match</h2>
            {verdict ? (
              <ul className={styles.reasonList}>
                {verdict.gates.map((gate) => (
                  <li key={gate.gate}>
                    {gate.pass ? <CheckCircle2 aria-hidden="true" /> : <CircleAlert aria-hidden="true" />} {gate.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Select a destination to see eligibility checks.</p>
            )}
            <h3>Alternatives</h3>
            {candidates.map((candidate) => (
              <div className={styles.alternativeRow} key={candidate.unit.id}>
                <span>
                  <strong>{candidate.unit.name}</strong>
                  <small>{candidateReason(candidate.verdict)}</small>
                </span>
                <b>{candidate.verdict.eligible ? "Eligible" : "Not eligible"}</b>
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
                  {patient.legalStatus}
                </span>
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Form readiness</strong>
                  {patient.legalForm
                    ? `${patient.legalForm.label} (${patient.legalForm.code}) · due ${formatInstant(patient.legalForm.dueAt)}`
                    : "No legal form required"}
                </span>
              </li>
              <li>
                <Truck aria-hidden="true" />
                <span>
                  <strong>Transport</strong>
                  {transportStatusLabel(patient.transport)}
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
            <p>{patient.legalStatus}</p>
            <p>
              {patient.legalForm
                ? `${patient.legalForm.label} (${patient.legalForm.code}) · due ${formatInstant(patient.legalForm.dueAt)}`
                : "No Mental Health Act transport form required"}
            </p>
          </section>
        ) : null}
        {activeSection === "transport" ? (
          <section className={styles.contextPanel}>
            <h2>Transport chain</h2>
            <p>{transportStatusLabel(patient.transport)}</p>
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
              {timeline.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <time>{formatInstant(event.at)}</time>
                  <span>{event.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <p className={styles.governanceNote}>
          Synthetic prototype only. Eligibility is checked automatically; an authorised human confirms every
          destination. This is not clinical severity.
        </p>
        <span className="sr-only" aria-live="polite">
          {confirmed ? `Destination confirmed for ${patient.id}` : ""}
        </span>
      </main>
    </div>
  );
}
