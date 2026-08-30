import {
  S2015_CATCHMENT_ROWS,
  lookupCatchment,
  normaliseSuburbKey,
  type CatchmentAnswer,
} from "@/components/ward-management/ward-catchment";
import { minutesUntil, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import {
  HOME_REGIONS,
  REFERRAL_DESTINATION_KINDS,
  SEXES,
  type Cohort,
  type Referral,
  type ReferralDestinationKind,
  type Unit,
  type WardReferralDestination,
} from "@/components/ward-management/ward-model";
import { referralDestinationLabel } from "@/components/ward-management/ward-referrals";

/**
 * WHAT A REFERRING CLINICIAN IS SHOWN ABOUT EACH DESTINATION, AT THE MOMENT OF CHOOSING.
 *
 * Spec Part 7 ("What the referrer IS shown", `docs/ward-flow-referral-destination-spec.md`), owner
 * 2026-08-30: _"add all relevant catchment and referral info for the referrer to aid the process."_
 * The catchment work was designed to help a coordinator route; it helps the CLINICIAN, while they
 * choose, which is what this module serves.
 *
 * ## The rules this file exists to keep, each of which is a decision rather than a style
 *
 * **NOTHING HERE RANKS THE PATIENT, AND NOTHING HERE SCORES AN OPTION.** Every value below is a
 * sentence or a count of beds; there is no ordinal, no percentage, no star and no weight, and the
 * option type deliberately has no field one could be put in. A rule a clinician can read is a rule
 * they can argue with; a score is not — so the reasons are written as rules ("serves this patient's
 * suburb", "has a bed free that can hold someone involuntarily") and never as a verdict.
 *
 * **ORDER IS BY CATCHMENT, THEN BY NAME**, and by nothing else — `compareOptions` below. Ordering
 * by anything derived from the person is exactly the ranking this screen must not do. Worth saying
 * plainly: with today's three labels the catchment key never actually changes the order, because
 * the only option that can carry a catchment ("Community team") already sorts first by name. It is
 * written as two keys anyway so that the rule, not today's coincidence, is what a fourth
 * destination kind would be ordered by.
 *
 * **`referralEligibility` IS CALLED IN THE WARD ARM AND NOWHERE ELSE.** It takes the ward
 * DESTINATION deliberately (see its own doc comment), which is what makes "a community team cannot
 * be asked about bed security" a compiler fact rather than a screen remembering. This module
 * branches on `kind` and calls it only under `psychiatric_ward`; there is no convenience overload
 * taking a bare referral, and adding one would delete that guarantee for every caller at once.
 *
 * **THERE IS NO `medical_ward` OPTION**, because there is no such destination — owner, 2026-08-30:
 * "just route to ED which also includes medical ward". `ward-model.ts` records the deferral and its
 * reason where the arm would be. The emergency-department option says so on screen, so a clinician
 * looking for a medical ward is told where it went rather than left to conclude it was forgotten.
 *
 * **NO FIGURE, TIMEFRAME, THRESHOLD OR DURATION FROM THE MENTAL HEALTH ACT APPEARS HERE.** The only
 * numbers this module produces are counts of units read off the seeded network and elapsed waits
 * read off referrals that already exist.
 */

/**
 * What the catchment sources can say about one destination, for this patient's suburb.
 *
 * Three fields rather than one enum because the three questions are genuinely independent and a
 * single state would have to answer all of them at once: what does the clinician read, is this
 * option placed here by the table, and is choosing it a step outside what the table can settle.
 */
export type DestinationCatchment = {
  /** The sentence a clinician reads. Never a code, never blank, and never a default. */
  readonly sentence: string;
  /** True only when the source table places this patient's suburb with this destination. */
  readonly placedBySourceTable: boolean;
  /**
   * True when choosing this option means stepping outside what the catchment table can settle —
   * a contested suburb, or one the table does not carry. The option is GREYED on that, **never
   * removed and never disabled** (owner's rule): choosing one is allowed and is a deliberate act.
   *
   * False while no suburb has been chosen, because an unanswered question is not a deviation.
   */
  readonly outsideTheTable: boolean;
};

export type DestinationOption = {
  readonly kind: ReferralDestinationKind;
  readonly label: string;
  readonly catchment: DestinationCatchment;
  /** Figures that bear on the choice, read off the seeded network. Never a score. */
  readonly figures: readonly string[];
  /** Why this option is offered, as rules a clinician can disagree with. Never a rank. */
  readonly reasons: readonly string[];
  /**
   * Whether the catchment table itself points at this option. **A suggestion, never a selection**:
   * nothing on this screen is chosen for the clinician, and a contested suburb suggests nothing at
   * all (spec Part 5 — contested does not route).
   */
  readonly suggested: boolean;
};

export type DestinationOptionInputs = {
  /** The patient's suburb, or `null` while nobody has chosen one. */
  readonly suburb: string | null;
  /** The ward criteria, or `null` while the bed questions are unanswered. */
  readonly ward: WardReferralDestination | null;
  readonly ageBand: Cohort | null;
  readonly units: readonly Unit[];
  readonly referrals: readonly Referral[];
  readonly now: Instant;
};

/** Said in full rather than left blank: a blank catchment reads as "none", which is a claim. */
export const NO_SUBURB_SENTENCE = "No suburb chosen yet, so no catchment has been read.";

/**
 * Why a ward and an emergency department carry no catchment here.
 *
 * Only the 2015 document has an approved-hospital column and it is not seeded; every newer source
 * names follow-up clinics (spec Part 4, "the hospital column is not seeded at all"). So routing is
 * built on the clinic column, and admitting-hospital routing is left out entirely — **not built and
 * switched off**, which Part 5 refuses in as many words: "a decision hiding as dead code is still a
 * decision".
 */
export const NO_HOSPITAL_CATCHMENT_SENTENCE =
  "No catchment is recorded for this destination: the sources name a follow-up community clinic only, and the approved-hospital column is not seeded.";

/**
 * Every suburb the source table names, once each, in alphabetical order.
 *
 * DERIVED FROM THE EXPORTED ROWS, never a hand-written list. A hand-maintained option list is a
 * defect class this project has already shipped four times — most recently a picker that silently
 * omitted a value a widened union had added — and a written-down list of 532 suburbs could not
 * possibly be maintained by hand at all.
 */
export function suburbOptions(): readonly string[] {
  const seen = new Map<string, string>();
  for (const row of S2015_CATCHMENT_ROWS) {
    const key = normaliseSuburbKey(row.suburb);
    if (!seen.has(key)) seen.set(key, row.suburb);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** One reading of a contested suburb, attributed to the document and date that carries it — never
 *  collapsed to a winner, and never resolved by recency (spec Part 5). */
function attributedReading(answer: CatchmentAnswer): string {
  return `${answer.document.label} (${answer.document.date ?? "no date printed"}) says ${answer.clinics.join(" or ")}`;
}

function catchmentFor(kind: ReferralDestinationKind, suburb: string | null): DestinationCatchment {
  if (kind !== "community_team") {
    return { sentence: NO_HOSPITAL_CATCHMENT_SENTENCE, placedBySourceTable: false, outsideTheTable: false };
  }
  if (suburb === null) return { sentence: NO_SUBURB_SENTENCE, placedBySourceTable: false, outsideTheTable: false };

  const lookup = lookupCatchment(suburb);
  switch (lookup.state) {
    case "reviewed": {
      const teams = lookup.answers.flatMap((answer) => answer.clinics);
      return {
        sentence: `In catchment: the source table places ${lookup.suburb} with ${teams.join(" or ")}.`,
        placedBySourceTable: true,
        outsideTheTable: false,
      };
    }
    case "unreviewed": {
      // One source's answer, with nothing corroborating it and its neighbours contradicting it. It
      // routes — with its marker attached, so a clinician reads a provisional value AS provisional
      // rather than as fact (spec Part 5's `unreviewed` row).
      const teams = lookup.answers.flatMap((answer) => answer.clinics);
      return {
        sentence: `In catchment, not reviewed: the source table places ${lookup.suburb} with ${teams.join(" or ")}. ${lookup.note}`,
        placedBySourceTable: true,
        outsideTheTable: false,
      };
    }
    case "contested":
      // Both readings, each attributed. Picking one here would make the screen honest and the
      // behaviour dishonest, which is worse than either alone.
      return {
        sentence: `Contested: ${lookup.answers.map(attributedReading).join("; ")}. No answer is chosen here. ${lookup.note}`,
        placedBySourceTable: false,
        outsideTheTable: true,
      };
    case "unknown":
      return { sentence: lookup.note, placedBySourceTable: false, outsideTheTable: true };
  }
}

/**
 * The ward figures: how much of the network accepts this request right now.
 *
 * The probe is a QUESTION, not a person — constructed here, handed to one pure function, and
 * discarded. It is never stored, never rendered and never derived from anybody, exactly as
 * `ward-board-derivations.ts`'s own probe is. Every field the gates do not read is a neutral value.
 */
function wardFigures(inputs: DestinationOptionInputs, ward: WardReferralDestination, ageBand: Cohort): string[] {
  const probe: Referral = {
    id: "destination-picker-probe",
    destinations: [{ destination: ward, state: "queued" }],
    ageBand,
    homeRegion: HOME_REGIONS[0],
    source: "community",
    raisedAt: inputs.now,
    urgency: 2,
    originSiteCode: "",
    transportNeeded: false,
  };
  const verdicts = inputs.units.map((unit) => referralEligibility(probe, ward, unit, inputs.now));
  const accepting = verdicts.filter((verdict) => verdict.eligible).length;
  const noBed = verdicts.filter(
    (verdict) => verdict.gates.find((gate) => gate.gate === "allocatable_bed")?.pass === false,
  ).length;
  return [
    `${accepting} of ${inputs.units.length} units accept this referral right now.`,
    `${noBed} of ${inputs.units.length} units have no bed free right now.`,
  ];
}

/**
 * How long referrals to this kind of destination have ALREADY been waiting.
 *
 * **NOT AN ESTIMATED WAIT, AND NOT A PREDICTION.** Nothing in this prototype records how long a
 * destination takes to answer, so an "estimated wait" would be a metric invented on the spot and
 * then read as a measurement. What exists is the wait of the referrals queued right now, which is a
 * fact, and it is said as one.
 *
 * **A RAW DURATION, WITH NO BAND, NO COLOUR, NO ADJECTIVE AND NO TARGET** — the owner's standing
 * refusal on every clock in this prototype. "Long wait", an amber chip, "within target": each is a
 * threshold somebody invented, and on a screen where a clinician is choosing between services it
 * would read as clinical guidance. This picker is the third place in the prototype tempting enough
 * to name in that refusal, after the coordinator's waiting list and the follow-up list.
 *
 * Rendered through `splitDuration` rather than hours hand-rolled from a difference, so this screen
 * and every other clock in Ward Flow cannot drift apart — and so a fix to one is a fix to all.
 * `formatElapsed` would also have gone through it, and is not used only because it appends the word
 * "waiting" to a sentence that already carries it.
 */
function waitFigure(kind: ReferralDestinationKind, inputs: DestinationOptionInputs): string {
  const queued = inputs.referrals.filter((referral) =>
    referral.destinations.some((addressing) => addressing.destination.kind === kind && addressing.state === "queued"),
  );
  if (queued.length === 0) return "No referral to this kind of destination is waiting for an answer right now.";
  const longest = queued.reduce((oldest, referral) => (referral.raisedAt < oldest.raisedAt ? referral : oldest));
  const waited = splitDuration(Math.max(minutesUntil(inputs.now, longest.raisedAt), 0));
  return `${queued.length} referral(s) to this kind of destination are waiting for an answer now; the longest has waited ${waited}.`;
}

function reasonsFor(
  kind: ReferralDestinationKind,
  catchment: DestinationCatchment,
  inputs: DestinationOptionInputs,
  figures: readonly string[],
): string[] {
  switch (kind) {
    case "psychiatric_ward": {
      const reasons = ["Asks a ward for an inpatient bed."];
      if (inputs.ward === null || inputs.ageBand === null) {
        reasons.push("The age band and bed questions are not answered yet, so no unit has been checked.");
        return reasons;
      }
      // Read off the very sentence shown above it, never re-counted in parallel: two counts of one
      // fact are how a screen comes to disagree with itself.
      const noneAccept = figures.some((figure) => figure.startsWith("0 of "));
      if (noneAccept) {
        reasons.push(
          "No unit accepts this referral right now — it is still offered, because a ward with no free bed is still the right place to ask.",
        );
        return reasons;
      }
      if (inputs.ward.involuntaryBedNeeded) {
        reasons.push("Some units have a bed free that can hold someone involuntarily.");
      } else if (inputs.ward.secureBedNeeded) {
        reasons.push("Some units have a secure bed free.");
      } else {
        reasons.push("Some units have a bed free that accepts this request.");
      }
      return reasons;
    }
    case "emergency_department":
      return [
        "Asks for the person to be seen, rather than for a bed.",
        "This is also the route for a medical problem: there is no medical-ward destination, and an emergency department is where one is reached from.",
      ];
    case "community_team": {
      const reasons = ["Asks a team, rather than a bed, to take this person on."];
      if (catchment.placedBySourceTable) reasons.push("Serves this patient's suburb, per the source table.");
      else if (catchment.outsideTheTable) {
        reasons.push(
          "The catchment table cannot settle which team serves this suburb, so choosing this is a deliberate step outside it.",
        );
      } else reasons.push("Choose a suburb to see which team the source table names.");
      return reasons;
    }
  }
}

/**
 * The one spelling of a destination's name, taken from `referralDestinationLabel` rather than
 * written out again here — two components spelling one label separately is a defect this phase has
 * already paid for four times.
 *
 * That function takes a whole destination, which is right for its own callers (they hold one) and
 * awkward for this one (it holds a kind and, until the bed questions are answered, nothing else).
 * So the ward arm is filled from the clinician's own answers when they exist, and otherwise from a
 * neutral placeholder that reaches nothing but the `switch` on `kind` inside that function: no
 * label depends on the bed criteria, and this value is never dispatched, stored or rendered.
 */
function labelFor(kind: ReferralDestinationKind, ward: WardReferralDestination | null): string {
  if (kind !== "psychiatric_ward") return referralDestinationLabel({ kind });
  return referralDestinationLabel(ward ?? { kind, sex: SEXES[0], secureBedNeeded: false, involuntaryBedNeeded: false });
}

/**
 * Catchment first, then name. Two keys, both stated, and NEITHER OF THEM A PERFORMANCE FIGURE.
 *
 * The obvious third key is the wait — order the shortest wait first and the list becomes useful
 * immediately. It is refused, and the refusal is a distinction rather than a preference. Nothing
 * may rank a PERSON; whether a SERVICE may be ranked is a different question, and nobody has ruled
 * on it. **It must never be inferred from the first.** Showing a wait is a fact about a service;
 * ordering the list by it is the screen saying, in the only way a list can, that this ward is
 * better than that one — which turns a placement tool into performance monitoring of named
 * services, a different product with real consequences.
 *
 * That it feels obviously more useful is the signal to stop, not to proceed.
 *
 * See this module's own header for the honest note that today's three labels make the first key
 * inert, and for why it is written as two keys anyway.
 */
function compareOptions(a: DestinationOption, b: DestinationOption): number {
  if (a.catchment.placedBySourceTable !== b.catchment.placedBySourceTable) {
    return a.catchment.placedBySourceTable ? -1 : 1;
  }
  return a.label.localeCompare(b.label);
}

/** Every destination a referrer may choose, with what is known about each. Derived from
 *  `REFERRAL_DESTINATION_KINDS`, never a list written out here. */
export function destinationOptions(inputs: DestinationOptionInputs): DestinationOption[] {
  return REFERRAL_DESTINATION_KINDS.map((kind) => {
    const catchment = catchmentFor(kind, inputs.suburb);
    // The ward arm, and only the ward arm, is asked about beds. `referralEligibility` cannot be
    // called on the other two: the criteria it reads exist on no other arm.
    const bedFigures =
      kind === "psychiatric_ward" && inputs.ward !== null && inputs.ageBand !== null
        ? wardFigures(inputs, inputs.ward, inputs.ageBand)
        : [];
    const figures = [...bedFigures, waitFigure(kind, inputs)];
    return {
      kind,
      label: labelFor(kind, inputs.ward),
      catchment,
      figures,
      reasons: reasonsFor(kind, catchment, inputs, bedFigures),
      // A suggestion is never a selection, and a contested suburb suggests nothing.
      suggested: catchment.placedBySourceTable,
    };
  }).sort(compareOptions);
}
