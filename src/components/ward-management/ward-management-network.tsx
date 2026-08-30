"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Network, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  candidateReason,
  destinationUnit,
  eligibleCandidatesAmong,
  elapsedLabel,
  isOpen,
  movementHealthService,
  stageCopy,
  stageSummaries,
  transportStatusLabel,
  unitCapacity,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import { SYNTHETIC_TRAVEL_TIMES_NOTICE } from "@/components/ward-management/ward-distance";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import type {
  BedRelease,
  HealthService,
  LeaveBed,
  Movement,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  candidateAccepts,
  groupCandidatesByTravelBand,
  matchReason,
  referralCandidates,
  referralQueueOrder,
  referralWaitLabel,
  TRAVEL_BAND_GROUP_EMPTY_SENTENCE,
  travelBandGroupCounts,
  travelBandGroupCountsSentence,
  travelBandGroupLabel,
  type ReferralCandidate,
  type TravelBandGroup,
  type TravelBandGroupCounts,
} from "@/components/ward-management/ward-referrals";
import { siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./ward-management-network.module.css";

type BedStateKey = "available" | "held" | "confirmed" | "predicted" | "blocked";

// Review Finding 4: this used to be `"potential"`, sourced from `unitCapacity()`'s raw release
// count — every release for the unit regardless of state or timing, including one already
// `discharged` and one expected beyond tonight, both of which spec D5/D6 exclude from every count.
// Confirmed and Predicted are read from `capacityBreakdown()` instead, the same figures the
// capacity board and the ward screen already show, so this board can never disagree with them.
const bedStateCopy: Record<BedStateKey, { label: string; detail: string }> = {
  available: { label: "Ready", detail: "Available now" },
  held: { label: "Held", detail: "Bed held" },
  confirmed: { label: "Confirmed", detail: "Confirmed today" },
  predicted: { label: "Predicted", detail: "Predicted today" },
  blocked: { label: "Blocked", detail: "Not available" },
};

/**
 * Which side of the whole-network overview each health service's cluster sits on.
 *
 * The LEFT column is the one layout decision taken here, and it is roadmap 14's "country sites
 * present at all": the WA country service sits beside North Metro at the top of the picture rather
 * than below three metro clusters.
 *
 * Phase 8, Task 9 (spec D11, step 4). The RIGHT column is now DERIVED — everything else
 * `wardServiceOrder` knows about — where it used to be a hand-written copy of three of that list's
 * five entries. `wardServiceOrder` is already this screen's canonical service list (`measure()`
 * walks it to draw the demand trunks), so the copy was a second list that had to agree with it and
 * could drift. That drift has exactly one symptom: a service added to the model but not to the copy
 * renders no cluster, and every unit in it is simply not on the screen. **A unit missing from the
 * whole-network overview reads as "no such bed exists"**, which is the worst thing a bed-finding
 * screen can say, and it arrives through layout rather than through any claim about distance.
 *
 * Deriving one list from the other removes that particular way in. It is NOT by itself a proof that
 * every unit is drawn — `wardServiceOrder` is still hand-written, and a unit whose site is missing
 * from the site table would still vanish. The proof is the test: the overview's card set is pinned
 * to `allUnits()` in `tests/ward-network-referral-placement.dom.test.tsx`.
 *
 * Today's picture is unchanged: the filter yields East Metro, South Metro, Private, in that order.
 *
 * One property of the list this now depends on, written down rather than assumed: `wardServiceOrder`
 * is exported as a mutable `HealthService[]`, so a caller that reordered or spliced it in place
 * would silently move or drop a whole column here. Nothing mutates it today — this is a note for
 * whoever is tempted to, not a defect being reported. The order on screen is pinned against the
 * model in `tests/ward-network-referral-placement.dom.test.tsx`, so such a mutation fails a test
 * rather than quietly changing the picture.
 */
const LEFT_COLUMN_SERVICES: readonly HealthService[] = ["North Metro", "WACHS"];

const columnServices: { left: readonly HealthService[]; right: readonly HealthService[] } = {
  left: LEFT_COLUMN_SERVICES,
  right: wardServiceOrder.filter((service) => !LEFT_COLUMN_SERVICES.includes(service)),
};

/**
 * Phase 8, Task 8 (spec D11, step 3). What this screen says about the picture it is drawing, in the
 * place a coordinator reads it.
 *
 * It is here rather than in `ward-distance.ts` because it describes THIS LAYOUT, not the travel-band
 * data — the sentence about the data is `SYNTHETIC_TRAVEL_TIMES_NOTICE`, which is imported and
 * rendered beside it. The test imports this constant rather than retyping it, so there is still only
 * one spelling of it anywhere.
 *
 * Two claims, both of which have to be on the screen:
 *
 *  1. **It is not a map, and it is not called one.** Nobody has checked where any of these hospitals
 *     is. A picture is read as a map whatever its caption says, so this deliberately positions
 *     nothing: it is a stack of labelled bands, and a band is a lookup into an invented table.
 *  2. **It is LESS than this screen was meant to have, and the reason is the missing fact rather
 *     than a design preference.** Saying only the first would leave the shortfall looking like a
 *     choice somebody made, which would be the wrong thing to learn from it. The last sentence is
 *     the practical consequence and is checked before it is claimed: the bands are looked up per
 *     render through `unitTravelBand` and stored nowhere, so replacing `ward-travel-bands.ts`'s
 *     invented values with measured ones changes this arrangement and changes no code.
 *
 * No comparative proximity word, no distance figure, and nothing about how anyone travels.
 */
export const BAND_ARRANGEMENT_LIMITATION_NOTICE =
  "These groups are the travel bands this prototype invented for this person's home region. They are " +
  "not a map, and this arrangement is less than the roughly geographic layout this screen was meant " +
  "to have. The reason is a missing fact rather than a preference: nobody has checked where any of " +
  "these hospitals is. When real travel times are checked, this same arrangement becomes as " +
  "geographic as the checked data allows, with no change to how it is built.";

type Connector = { id: string; path: string; kind: "demand" | "route" };
type Candidate = { unit: Unit; rank: number; etaLabel: string; verdict: ReturnType<typeof eligibility> };

function capabilityLabel(unit: Unit) {
  const cohortLabel = unit.cohort === "Older adult" ? "Older" : unit.cohort;
  return `${unit.security} · ${cohortLabel}`;
}

function candidatesFor(patient: Movement, units: Unit[], now: Instant): Candidate[] {
  // Only the movement's actual recorded destination may show a real transport state — the
  // other two candidates are computed shortlist entries the movement was never referred to,
  // and must not inherit a transport job that belongs to a different unit (Task 6 Important 3).
  const recordedDestinationId = destinationUnit(patient, units)?.id;
  return eligibleCandidatesAmong(patient, units, now, 3).map((candidate, index) => ({
    unit: candidate.unit,
    verdict: candidate.verdict,
    rank: index + 1,
    etaLabel: candidate.unit.id === recordedDestinationId ? transportStatusLabel(patient.transport) : "Not yet booked",
  }));
}

/**
 * Compares the candidate unit's health service against the *origin ED's* health service —
 * this is NOT catchment. Catchment is where the patient lives, not where they presented, and
 * `Movement` has no catchment field (see the doc comment on `movementHealthService` and the
 * glossary's Catchment entry). Naming this `catchmentFit` previously collapsed exactly the
 * distinction Accepted ADR 3 exists to keep separate.
 *
 * The two labels are the fact this function computes and nothing more. They were "Best" and
 * "Escalation" until Phase 8 Task 6. "Best" was the defect: on screen it read as the system's
 * opinion about which bed this person should have, when all that was compared was two health
 * service names — the doc comment above already said so at length, and the label did not.
 * Phase 8 puts honest travel bands on this same screen, which would have made the superlative
 * look as though it had been checked too.
 *
 * THIS FUNCTION sorts, ranks and hides nothing: it answers one yes/no comparison about one
 * candidate and returns a label for it. That is a claim about this function alone, and it is
 * deliberately not a claim about the file. `candidatesFor` above orders the shortlist and cuts it
 * to three (`eligibleCandidatesAmong` sorts it twice), and the compare table renders a positional
 * rank beside each column heading. Those predate Phase 8, are a deliberate three-of-many
 * shortlist on this screen rather than a truncation bug, and are out of scope here — the point is
 * only that the LABEL must not stack a ranking claim of its own on top of them, which is exactly
 * what "Best" did. Neither label may ever carry a comparative word
 * (`tests/ward-management.test.ts` pins that, the same guard `tests/ward-travel-bands.test.ts`
 * holds over the band labels). The tones are unchanged — a colour is not a claim in the way a
 * word is.
 */
export function originServiceFit(patient: Movement, unit: Unit) {
  const unitService = siteByCode(unit.siteCode)?.service;
  if (unitService && unitService === movementHealthService(patient)) {
    return { label: "Same health service", tone: "good" as const };
  }
  return { label: "Different health service", tone: "warning" as const };
}

function settingFit(patient: Movement, unit: Unit, now: Instant) {
  const verdict = eligibility(patient, unit, now);
  const cohortOk = verdict.gates.find((gate) => gate.gate === "cohort")?.pass ?? false;
  const securityOk = verdict.gates.find((gate) => gate.gate === "security")?.pass ?? false;
  if (cohortOk && securityOk) return { label: "Exact match", tone: "good" as const };
  if (cohortOk || securityOk) return { label: "Partial match", tone: "warning" as const };
  return { label: "Not eligible", tone: "danger" as const };
}

function transportTone(etaLabel: string) {
  return /requested|awaiting|not yet/i.test(etaLabel) ? "warning" : "good";
}

// Review Finding 4: the "Confirmed"/"Predicted" chips read `capacityBreakdown()`, not
// `unitCapacity()`'s raw `potential` — see the `bedStateCopy` doc comment above. The four
// physical states (Ready/Held/Blocked, plus Occupied where shown) are untouched.
function bedStateValue(
  key: BedStateKey,
  capacity: ReturnType<typeof unitCapacity>,
  breakdown: ReturnType<typeof capacityBreakdown>,
): number {
  if (key === "confirmed") return breakdown.confirmedToday;
  if (key === "predicted") return breakdown.predictedToday;
  return capacity[key];
}

function BedStateChips({
  unit,
  bedReleases,
  leaveBeds,
  now,
  showTime,
}: {
  unit: Unit;
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  now: Instant;
  showTime?: boolean;
}) {
  const capacity = unitCapacity(unit, bedReleases);
  const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
  return (
    <span className={styles.bedChips}>
      {/* `data-label` below is read by nothing on screen. It exists so the print block in
          `ward-management-network.module.css` can put each chip's own word in front of its figure —
          on paper the five chips are told apart by colour alone, and colour is the one channel a
          printer may drop. Carried as an attribute rather than written into the CSS so
          `bedStateCopy` stays the single place these five words are spelled. */}
      {(Object.keys(bedStateCopy) as BedStateKey[]).map((key) => (
        <span
          className={styles.bedChip}
          data-state={key}
          data-label={bedStateCopy[key].label}
          key={key}
          title={bedStateCopy[key].detail}
        >
          {bedStateValue(key, capacity, breakdown)}
        </span>
      ))}
      {showTime ? <span className={styles.bedTime}>{formatInstant(unit.allocatable.confirmedAt)}</span> : null}
    </span>
  );
}

function ServiceCard({
  unit,
  bedReleases,
  leaveBeds,
  now,
  routed,
  selected,
  placement,
  onSelect,
  registerRef,
}: {
  unit: Unit;
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  now: Instant;
  routed: boolean;
  selected: boolean;
  /** Task 7: this unit's own verdict for the referral currently selected, or `undefined` when no
   *  referral is selected and the diagram is showing the movement view. NEVER recomputed here —
   *  the candidate arrives already paired with the verdict `referralCandidates` computed for it. */
  placement?: ReferralCandidate;
  onSelect: () => void;
  registerRef: (id: string, node: HTMLButtonElement | null) => void;
}) {
  const capacity = unitCapacity(unit, bedReleases);
  const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
  // One spelling for both outcomes, and it is the match view's own. `matchReason` answers "can
  // this bed take this person, and if not why" for an accepting bed too ("Eligible now"), so this
  // node and the coordinator's match view can never word the same verdict two different ways.
  const verdict = placement ? matchReason(placement) : null;
  return (
    <button
      type="button"
      ref={(node) => registerRef(unit.id, node)}
      onClick={onSelect}
      aria-pressed={selected}
      data-routed={routed ? "true" : undefined}
      data-testid={`ward-network-card-${unit.id}`}
      className={styles.serviceCard}
      aria-label={`${unit.name}. ${capabilityLabel(unit)}. ${capacity.available} ready, ${capacity.held} held, ${breakdown.confirmedToday} confirmed, ${breakdown.predictedToday} predicted, ${capacity.blocked} blocked, of ${unit.beds} beds. Confirmed ${formatInstant(unit.allocatable.confirmedAt)}.${verdict ? ` ${verdict}.` : ""}`}
    >
      <span className={styles.serviceName}>{unit.name}</span>
      <span className={styles.serviceCapability}>{capabilityLabel(unit)}</span>
      <BedStateChips unit={unit} bedReleases={bedReleases} leaveBeds={leaveBeds} now={now} showTime />
      {placement && verdict ? (
        <span
          className={styles.placementVerdict}
          data-accepts={candidateAccepts(placement) ? "true" : "false"}
          data-testid={`ward-network-verdict-${unit.id}`}
        >
          {verdict}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Phase 8, Task 8 (spec D11, step 3). One band group on the diagram: its heading, its two counts,
 * and the unit nodes in it.
 *
 * The SAME nodes the service-column layout draws — `ServiceCard`, with the same `data-testid` and
 * the same verdict — rearranged into bands. Nothing here computes anything about a unit: the
 * candidate carries the verdict `referralCandidates` produced once in the workspace below, and the
 * band is the group this candidate was put in rather than a second lookup per node. A band looked up
 * twice is a band that can disagree with itself, and the heading and its nodes would be the two
 * places.
 *
 * **It does not fold, and it deliberately no longer can.** This screen briefly used
 * `<details>`/`<summary>` here, mirroring the match view's band groups. The owner ruled that out on
 * 2026-08-29: the decision permitting a fold was taken about the bed LIST, where folding only
 * shortens a scroll, and on a picture a folded group makes wards disappear — far closer to the
 * metro/rural filter that was declined for hiding beds than to folding a list. So every group is
 * always open, and the match view's own collapse is unaffected. The two screens now behave
 * differently on purpose.
 *
 * What survives the ruling, because neither depended on it: the heading carries BOTH counts, and an
 * EMPTY group still renders with its heading and both counts rather than vanishing. "There is
 * nothing within an hour" is the answer a coordinator came for, and a group that disappears when it
 * is empty cannot give it.
 */
function NetworkBandGroup({
  group,
  counts,
  bedReleases,
  leaveBeds,
  now,
  selectedUnitId,
  onSelectUnit,
  registerRef,
}: {
  group: TravelBandGroup;
  counts: TravelBandGroupCounts;
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  now: Instant;
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  registerRef: (id: string, node: HTMLButtonElement | null) => void;
}) {
  const headingId = `ward-network-band-heading-${group.band}`;
  return (
    <section
      className={styles.bandGroup}
      data-testid={`ward-network-band-group-${group.band}`}
      aria-labelledby={headingId}
    >
      <header className={styles.bandHeader} data-testid={`ward-network-band-header-${group.band}`}>
        <span className={styles.bandLabel} id={headingId}>
          {travelBandGroupLabel(group.band)}
        </span>
        {/* Two present facts about the beds in this band, from `travelBandGroupCounts` — which counts
         *  the very candidates rendered below, so a heading cannot disagree with its own nodes.
         *  Neither figure counts what is missing. The sentence is the match view's own, shared so the
         *  two surfaces cannot word one fact two ways. */}
        <span className={styles.bandCounts} data-testid={`ward-network-band-counts-${group.band}`}>
          {travelBandGroupCountsSentence(counts)}
        </span>
      </header>
      {group.candidates.length === 0 ? (
        <p className={styles.bandEmpty} data-testid={`ward-network-band-empty-${group.band}`}>
          {TRAVEL_BAND_GROUP_EMPTY_SENTENCE}
        </p>
      ) : (
        <div className={styles.bandCards}>
          {group.candidates.map((candidate) => (
            <ServiceCard
              key={candidate.unit.id}
              unit={candidate.unit}
              bedReleases={bedReleases}
              leaveBeds={leaveBeds}
              now={now}
              /* The movement shortlist's route highlighting belongs to the movement view, which has
               * stood down by the time this renders — there is no route to be on. */
              routed={false}
              selected={selectedUnitId === candidate.unit.id}
              placement={candidate}
              onSelect={() => onSelectUnit(candidate.unit.id)}
              registerRef={registerRef}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Task 7 (spec D8-5). What the aside says while a referral is the diagram's subject: who is being
 * placed, and where the answers are.
 *
 * It deliberately carries NO tally and NO banner. "N of M units accept this referral right now"
 * and "no unit of this age band exists in this network" are the coordinator's match view's own
 * sentences, and the second must always be met before the first — repeating either here would be
 * a second surface answering one question, in wording that could drift from the original. The
 * verdicts themselves are on the unit nodes, where the beds are, from the one function the match
 * view uses.
 *
 * The referral's five facts and its wait, and nothing else: no band (that is step two), no
 * kilometre, no free text, no comparative word about any bed.
 */
function ReferralPlacementSummary({ referral, now }: { referral: Referral; now: Instant }) {
  return (
    <>
      <header className={styles.panelHeader}>
        <h2>
          <Sparkles aria-hidden="true" /> Referral placement · {referral.id}
        </h2>
      </header>
      <p className={styles.patientLine} data-tier={referral.urgency} data-testid="ward-network-placement-tier">
        {urgencyTierLabel(referral.urgency)}
      </p>
      <p className={styles.patientSubLine} data-testid="ward-network-placement-facts">
        {referral.ageBand} · {referral.sex} · {referral.homeRegion}
      </p>
      <p className={styles.patientSubLine}>Waiting {referralWaitLabel(referral, now)}</p>
      <p className={styles.placementNote} data-testid="ward-network-placement-note">
        Every unit in the network carries its own verdict for this referral on the diagram — and for each one that
        cannot take this person, the single reason why.
      </p>
    </>
  );
}

export function WardNetworkWorkspace() {
  const { movements, units, referrals, bedReleases, leaveBeds, now } = useWardFlow();
  const [selectedPatientId, setSelectedPatientId] = useState(movements[0].id);
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [factorsOpen, setFactorsOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(true);

  // `selectedPatientId` is only ever set from a real movement's own id (see the queue button
  // below), so this can't miss today — but every hook after this one must still run
  // unconditionally, so the guard lives in the JSX at the bottom, not as an early return here
  // (Task 6 Critical 3).
  const patient = useMemo(
    () => movements.find((candidate) => candidate.id === selectedPatientId),
    [movements, selectedPatientId],
  );
  const candidates = useMemo(() => (patient ? candidatesFor(patient, units, now) : []), [patient, units, now]);

  /*
   * Task 7 (spec D8-5). Referral selection sits ALONGSIDE the movement selection above: the
   * diagram answers "which of these beds can take this person" for either subject, and exactly one
   * of them is the subject at a time.
   *
   * The queue is `referralQueueOrder` — the coordinator board's own spelling, not a second one —
   * and the selected referral is resolved out of that list on every render rather than captured at
   * click time (Task 6 Finding 2: a record held as an object goes stale the moment a sibling
   * screen dispatches against it). A referral that leaves the queue therefore drops the selection
   * and the diagram falls back to the movement view, rather than going on answering for a decision
   * somebody has already taken.
   */
  const referralQueue = useMemo(() => referralQueueOrder(referrals), [referrals]);
  const selectedReferral = useMemo(
    () => referralQueue.find((referral) => referral.id === selectedReferralId) ?? null,
    [referralQueue, selectedReferralId],
  );

  /**
   * Phase 8, Task 8 (spec D11, step 3). Who the band arrangement is drawn for — and the ONE place
   * that is decided, so there is a single line to read and a single line to change.
   *
   * A referral, or nothing at all. **A movement can never be one**, and the missing `??` on the
   * right of this line is the whole point rather than an omission. A `Movement` carries an origin
   * emergency department — where the person presented — and no home region whatsoever (see
   * `movementHealthService`'s own doc comment, and Accepted ADR 3 on why presenting somewhere is
   * not living there). A band arrangement drawn from an origin would therefore be a proximity claim
   * with no fact behind it, which is precisely the defect this phase exists to close: WF-018, sitting
   * in SCGH's own emergency department, was once offered RPH first under a heading reading "Nearest
   * candidates", in an order that was only the array's order.
   *
   * So while a movement is the subject the diagram draws NO arrangement and the service-column
   * layout stands unchanged. That is a gap the spec left and this plan filled; the owner may prefer
   * something else, but the something else cannot be an arrangement without a home region.
   */
  const bandSubject: Referral | null = selectedReferral;

  /*
   * EVERY unit, each with its own verdict — `referralCandidates` never truncates, sorts or ranks,
   * and nothing here does either. This is deliberately not the movement path's three-of-many
   * shortlist: that shortlist is a decision taken on the movement screen and it is untouched
   * below. The verdicts are computed ONCE, here, and every node reads that one answer; a second
   * call per node would be a second computation of the same question.
   */
  const placements = useMemo(
    () => (bandSubject ? referralCandidates(bandSubject, units, now) : []),
    [bandSubject, units, now],
  );
  /*
   * Phase 8, Task 8 (spec D11, step 3). The same `placements` above, rearranged by how far each bed
   * is from where this person lives.
   *
   * `placements` — the ARRAY, not a map keyed by unit id, and not a second call to
   * `referralCandidates`. Two things follow from that and both are load-bearing. The grouping is a
   * pure rearrangement that preserves its caller's order, so passing the array in the network's own
   * fixed order is what makes each band's contents arrive in that same fixed order for free; and
   * every verdict shown under a heading is the very object the heading counted, so the two cannot
   * disagree. That is also why `travelBandGroupCounts` takes the GROUP rather than a referral and a
   * clock: `referralEligibility`'s capacity-freshness gate is time-dependent, so a count recomputed
   * against a second `now` could legitimately differ from the nodes beside it, and nothing would
   * look wrong in either place.
   *
   * Empty while a movement is the subject, which is what leaves the service-column layout standing
   * below — see the canvas.
   */
  const bandGroups = useMemo(
    () => (bandSubject ? groupCandidatesByTravelBand(bandSubject, placements) : []),
    [bandSubject, placements],
  );
  const bandGroupCounts = useMemo(() => bandGroups.map(travelBandGroupCounts), [bandGroups]);

  /* The movement shortlist's route lines and highlighted cards belong to the movement view, so
   * they stand down while a referral is the subject. `candidates` itself is untouched — nothing is
   * widened, narrowed or re-ordered, only which overlay the diagram is currently drawing. */
  const routeCandidates = useMemo(() => (selectedReferral ? [] : candidates), [selectedReferral, candidates]);
  const routedIds = useMemo(() => new Set(routeCandidates.map((candidate) => candidate.unit.id)), [routeCandidates]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);
  const clusterRefs = useRef(new Map<string, HTMLElement | null>());
  const cardRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const [connectors, setConnectors] = useState<Connector[]>([]);

  const registerCard = useCallback((id: string, node: HTMLButtonElement | null) => {
    cardRefs.current.set(id, node);
  }, []);
  const registerCluster = useCallback((service: string, node: HTMLElement | null) => {
    clusterRefs.current.set(service, node);
  }, []);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const hub = hubRef.current;
    /* Task 8: the hub and the service clusters are the movement view's own picture and unmount while
     * a referral is the subject, so this is now reachable in normal use rather than only on a
     * missing ref. Clearing is the whole point — returning early would leave the previous frame's
     * connector paths drawn across a layout they no longer describe. The functional update keeps the
     * same empty array when it is already empty, so a resize with no hub cannot loop. */
    if (!canvas || !hub) {
      setConnectors((current) => (current.length === 0 ? current : []));
      return;
    }
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

    for (const service of wardServiceOrder) {
      const node = clusterRefs.current.get(service);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const onLeft = (columnServices.left as readonly string[]).includes(service);
      const from = { x: (onLeft ? box.right : box.left) - base.left, y: box.top - base.top + box.height / 2 };
      next.push({ id: `demand-${service}`, path: elbow(from, onLeft ? hubLeft : hubRight), kind: "demand" });
    }

    for (const candidate of routeCandidates) {
      const node = cardRefs.current.get(candidate.unit.id);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const service = siteByCode(candidate.unit.siteCode)?.service;
      const onLeft = service ? (columnServices.left as readonly string[]).includes(service) : true;
      const to = { x: (onLeft ? box.right : box.left) - base.left, y: box.top - base.top + box.height / 2 };
      next.push({
        id: `route-${candidate.unit.id}`,
        path: elbow(onLeft ? hubLeft : hubRight, to),
        kind: "route",
      });
    }

    setConnectors(next);
  }, [routeCandidates]);

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

  // Whole-branch review Critical 1: resolved from the live `units`, not `unitById` — this feeds
  // `BedStateChips`/`unitCapacity` below, so the selected unit's own capacity figures must move
  // the instant its ward confirms new capacity, not only at first paint.
  const detail = selectedUnitId ? (units.find((unit) => unit.id === selectedUnitId) ?? null) : null;
  // Arrived and self-discharged movements have left the pathway (spec §7), so this must not
  // be the raw stage-count sum — that includes them and overstates live demand.
  const openMovements = movements.filter(isOpen).length;
  const primary = candidates[0];

  if (!patient) {
    return (
      <div className={styles.networkPage} data-testid="ward-network-view">
        <p className={styles.assurance}>No synthetic movement matches the current selection.</p>
      </div>
    );
  }

  return (
    <div
      className={styles.networkPage}
      data-testid="ward-network-view"
      data-shortlist={shortlistOpen ? "open" : "collapsed"}
    >
      <section className={styles.pipeline} aria-label="Movement pipeline">
        {stageSummaries(movements).map((stage, index) => (
          <span className={styles.pipelineStage} key={stage.id}>
            <span className={styles.pipelineLabel}>
              {index + 1} {stage.label}
            </span>
            <strong>{stage.count}</strong>
          </span>
        ))}
      </section>

      <div className={styles.networkGrid}>
        <div className={styles.queueColumn}>
          <section className={styles.queuePanel} aria-label="Priority queue">
            <header className={styles.panelHeader}>
              <h2>Priority queue</h2>
              <span className={styles.count}>{movements.length}</span>
            </header>
            <div className={styles.queueList}>
              {movements.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  onClick={() => {
                    setSelectedPatientId(candidate.id);
                    setSelectedReferralId(null);
                    setSelectedUnitId(null);
                  }}
                  aria-pressed={selectedReferral === null && candidate.id === patient.id}
                  data-testid={`ward-network-queue-${candidate.id}`}
                  className={styles.queueRow}
                >
                  <span className={styles.queueTop}>
                    <strong>{candidate.id}</strong>
                    <span className={styles.elapsed}>{elapsedLabel(candidate, now)}</span>
                  </span>
                  <span className={styles.queueMeta}>
                    <span
                      className={styles.tier}
                      data-tier={candidate.urgency}
                      data-label={urgencyTierLabel(candidate.urgency)}
                    >
                      {candidate.urgency}
                    </span>
                    {candidate.cohort} · {candidate.security} ward
                  </span>
                  <span className={styles.queueMeta}>
                    {movementHealthService(candidate) ?? "Unknown"} · {candidate.legalStatus}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/*
           * Task 7. The second subject the diagram can answer for. It sits beside the movement queue
           * rather than replacing it — a coordinator places both, and neither list is a shortlist of
           * the other. Selecting a referral here makes it the diagram's subject; selecting it again
           * hands the diagram back to the movement above, so every control does something.
           */}
          <section className={styles.queuePanel} aria-label="Referral queue">
            <header className={styles.panelHeader}>
              <h2>Referral queue</h2>
              <span className={styles.count}>{referralQueue.length}</span>
            </header>
            <div className={styles.queueList}>
              {referralQueue.map((referral) => (
                <button
                  type="button"
                  key={referral.id}
                  onClick={() => {
                    setSelectedReferralId((current) => (current === referral.id ? null : referral.id));
                    setSelectedUnitId(null);
                  }}
                  aria-pressed={selectedReferral?.id === referral.id}
                  data-testid={`ward-network-referral-${referral.id}`}
                  className={styles.queueRow}
                >
                  <span className={styles.queueTop}>
                    <strong>{referral.id}</strong>
                    <span className={styles.elapsed}>{referralWaitLabel(referral, now)}</span>
                  </span>
                  {/* `urgencyTierLabel`, never a bare digit: the referral board already spells a
                   *  referral's tier this way on every row, and a second spelling of one field is
                   *  this project's most expensive defect class. */}
                  <span className={styles.queueMeta} data-tier={referral.urgency}>
                    {urgencyTierLabel(referral.urgency)}
                  </span>
                  <span className={styles.queueMeta}>
                    {referral.ageBand} · {referral.sex} · {referral.homeRegion}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

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

          <div className={styles.canvas} ref={canvasRef} data-layout={bandSubject ? "bands" : "services"}>
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

            {/*
             * Phase 8, Task 8 (spec D11, step 3). Which picture the canvas is drawing, and the ONE
             * place that is decided.
             *
             * With a referral selected the diagram arranges every unit by how far it is from where
             * that person lives. With a MOVEMENT selected it draws no band arrangement at all and the
             * service-column layout stands exactly as it did: a movement carries no home region (it
             * carries an origin emergency department, which is where the person presented, not where
             * they live — see `movementHealthService`), so any arrangement here would be a proximity
             * claim with no fact behind it. That is the "Nearest candidates" defect this whole phase
             * exists to close, in a new coat: WF-018, sitting in SCGH's own emergency department, was
             * once offered RPH first under that heading, in an order that was only the array's order.
             *
             * There is no third branch and no fallback subject. Both pictures draw the same
             * `ServiceCard` nodes, so this is a rearrangement of one set of nodes and never two sets
             * — rendering both at once would put every unit on the screen twice.
             */}
            {bandSubject ? (
              <div className={styles.bandArrangement} data-testid="ward-network-band-arrangement">
                {/* What this picture is, and what it is not. Rendered above the groups, because a
                 *  reader who takes it for a map has already taken it for one by the time they reach
                 *  a footnote. */}
                <p className={styles.bandLimitation} data-testid="ward-network-band-limitation">
                  {BAND_ARRANGEMENT_LIMITATION_NOTICE}
                </p>
                {/* The one place this screen states that the travel times are invented. Imported,
                 *  never retyped, and rendered once — a band shown anywhere without this sentence on
                 *  the same screen is a defect. */}
                <p className={styles.syntheticNotice} data-testid="ward-network-synthetic-notice">
                  {SYNTHETIC_TRAVEL_TIMES_NOTICE}
                </p>
                {bandGroups.map((group, index) => (
                  <NetworkBandGroup
                    key={group.band}
                    group={group}
                    counts={bandGroupCounts[index]}
                    bedReleases={bedReleases}
                    leaveBeds={leaveBeds}
                    now={now}
                    selectedUnitId={detail?.id ?? null}
                    onSelectUnit={(unitId) => setSelectedUnitId(detail?.id === unitId ? null : unitId)}
                    registerRef={registerCard}
                  />
                ))}
              </div>
            ) : (
              <>
                {(["left", "right"] as const).map((side) => (
                  <div className={styles.column} data-side={side} key={side}>
                    {columnServices[side].map((service) => (
                      <section
                        className={styles.cluster}
                        key={service}
                        ref={(node) => registerCluster(service, node)}
                        aria-labelledby={`ward-network-${service}`}
                      >
                        <header className={styles.clusterHeader}>
                          <strong id={`ward-network-${service}`}>{service.toUpperCase()}</strong>
                          <span>
                            {units
                              .filter((unit) => siteByCode(unit.siteCode)?.service === service)
                              .reduce((sum, unit) => sum + unit.allocatable.value, 0)}{" "}
                            ready
                          </span>
                        </header>
                        <div className={styles.clusterCards}>
                          {units
                            .filter((unit) => siteByCode(unit.siteCode)?.service === service)
                            .map((unit) => (
                              <ServiceCard
                                key={unit.id}
                                unit={unit}
                                bedReleases={bedReleases}
                                leaveBeds={leaveBeds}
                                now={now}
                                routed={routedIds.has(unit.id)}
                                selected={detail?.id === unit.id}
                                onSelect={() => setSelectedUnitId(detail?.id === unit.id ? null : unit.id)}
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
              </>
            )}
          </div>

          <footer className={styles.legend}>
            <span className={styles.legendTitle}>Legend</span>
            {(Object.keys(bedStateCopy) as BedStateKey[]).map((key) => (
              <span className={styles.legendItem} key={key}>
                <i className={styles.legendSwatch} data-state={key} aria-hidden="true" />
                <b>{bedStateCopy[key].label}</b> {bedStateCopy[key].detail}
              </span>
            ))}
            {/* Task 8: both entries describe connector lines, and neither line is drawn while a
             *  referral is the subject — the band arrangement has no route and no demand trunk. A
             *  legend key for a line that is not on the canvas invites a reader to look for one.
             *  The bed-state entries above are unconditional because those chips are on every node in
             *  either picture. Gated on `bandSubject`, the same expression the canvas branches on —
             *  the legend describes the canvas, so one decision is read in one spelling rather than
             *  two that happen to agree today. */}
            {bandSubject ? null : (
              <>
                <span className={styles.legendItem}>
                  <i className={styles.legendRoute} aria-hidden="true" />
                  <b>Shortlisted</b> Route for selected movement
                </span>
                <span className={styles.legendItem}>
                  <i className={styles.legendDemand} aria-hidden="true" />
                  <b>Demand</b> Health service into statewide flow
                </span>
              </>
            )}
          </footer>
        </section>

        <aside
          className={styles.shortlistPanel}
          aria-label={selectedReferral ? "Referral placement" : "Explainable shortlist"}
          aria-live="polite"
        >
          {selectedReferral ? (
            <ReferralPlacementSummary referral={selectedReferral} now={now} />
          ) : (
            <>
              <header className={styles.panelHeader}>
                <h2>
                  <Sparkles aria-hidden="true" /> Explainable shortlist · {patient.id}
                </h2>
              </header>
              {/* `data-label` is read by nothing on screen — same job as the bed chips' own
                  `data-label` above. This badge is an 18px square whose tier is carried by its
                  fill colour and a bare digit, so on paper (where the fill is inked away and a
                  mono printer would flatten it regardless) "1" alone is indistinguishable from a
                  rank. The print block swaps in this label, and takes it from `urgencyTierLabel`
                  so the printed words are the same ones the coordinator's queue and the referral
                  board already use. */}
              <p className={styles.patientLine}>
                <span
                  className={styles.tier}
                  data-tier={patient.urgency}
                  data-label={urgencyTierLabel(patient.urgency)}
                >
                  {patient.urgency}
                </span>
                {patient.cohort} · {patient.security} ward · {movementHealthService(patient) ?? "Unknown"} service
              </p>
              <p className={styles.patientSubLine}>
                {patient.legalStatus} ·{" "}
                {patient.legalForm ? legalFormNameLabelFirst(patient.legalForm) : "No legal form recorded"}
              </p>
              <p className={styles.patientSubLine}>
                {stageCopy[patient.stage].label} · waiting {elapsedLabel(patient, now)}
              </p>

              <div className={styles.tableScroll}>
                <table className={styles.compareTable}>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Comparison factor</span>
                      </th>
                      {candidates.map((candidate) => (
                        <th scope="col" key={candidate.unit.id}>
                          {candidate.rank} {candidate.unit.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Same health service as origin</th>
                      {candidates.map((candidate) => {
                        const fit = originServiceFit(patient, candidate.unit);
                        return (
                          <td key={candidate.unit.id} data-tone={fit.tone}>
                            {fit.label}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <th scope="row">Open/secure fit</th>
                      {candidates.map((candidate) => {
                        const fit = settingFit(patient, candidate.unit, now);
                        return (
                          <td key={candidate.unit.id} data-tone={fit.tone}>
                            {fit.label}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <th scope="row">Current bed state</th>
                      {candidates.map((candidate) => (
                        <td key={candidate.unit.id}>
                          <BedStateChips
                            unit={candidate.unit}
                            bedReleases={bedReleases}
                            leaveBeds={leaveBeds}
                            now={now}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Transport state</th>
                      {candidates.map((candidate) => (
                        <td key={candidate.unit.id} data-tone={transportTone(candidate.etaLabel)}>
                          {candidate.etaLabel}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th scope="row">Eligibility</th>
                      {candidates.map((candidate) => (
                        <td key={candidate.unit.id} title={candidateReason(candidate.verdict)}>
                          <strong>{candidate.verdict.eligible ? "Eligible" : "Not eligible"}</strong>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className={styles.tierNote}>
                <span
                  className={styles.tier}
                  data-tier={patient.urgency}
                  data-label={urgencyTierLabel(patient.urgency)}
                >
                  {patient.urgency}
                </span>
                <b>Urgency tier leads.</b> Eligibility only orders candidates inside a tier. It is not clinical
                severity.
              </p>

              <button
                type="button"
                className={styles.factorsToggle}
                aria-expanded={factorsOpen}
                onClick={() => setFactorsOpen((open) => !open)}
              >
                Eligibility gates ({primary ? primary.verdict.gates.length : 0})
                <ChevronDown aria-hidden="true" data-open={factorsOpen ? "true" : undefined} />
              </button>
              {factorsOpen && primary ? (
                <ul className={styles.factorList}>
                  {primary.verdict.gates.map((gate) => (
                    <li key={gate.gate}>{gate.detail}</li>
                  ))}
                </ul>
              ) : null}

              <div className={styles.ownerBlock}>
                <span className={styles.ownerLabel}>Current owner</span>
                <strong>{patient.owner}</strong>
                <span>Next action: {patient.blocker}</span>
              </div>

              <Link className={styles.primaryLink} href={`/mockups/ward-flow/patients/${patient.id}`}>
                Open movement workspace
              </Link>
            </>
          )}

          {/* One spelling, outside the branch, because it is true of either subject. */}
          <p className={styles.assurance}>System suggests, you decide. No automatic allocation.</p>

          {detail ? (
            <section className={styles.detailBlock} aria-label="Selected service detail">
              <h3>{detail.name}</h3>
              <p>
                {siteByCode(detail.siteCode)?.service ?? "Unknown service"} · {capabilityLabel(detail)} · confirmed{" "}
                {formatInstant(detail.allocatable.confirmedAt)}
              </p>
              <BedStateChips unit={detail} bedReleases={bedReleases} leaveBeds={leaveBeds} now={now} />
              <p className={styles.detailMeta}>
                {unitCapacity(detail, bedReleases).occupied} occupied of {detail.beds} beds. Confirmed and predicted
                beds are not allocatable yet.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
