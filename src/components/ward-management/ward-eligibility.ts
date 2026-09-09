import type { Instant } from "@/components/ward-management/ward-clock";
import {
  designationSummary,
  lockedBedsFree,
  openBedsFree,
  unitHasLockedBeds,
} from "@/components/ward-management/ward-bed-designation";
import type {
  LegalStatus,
  Movement,
  Referral,
  Sex,
  SexDesignation,
  Unit,
  WardAddressing,
  WardReferralDestination,
} from "@/components/ward-management/ward-model";

/**
 * ⚠️ **EVERY GATE NAME EITHER ELIGIBILITY FUNCTION CAN EMIT — the single source of truth, and it
 * exists because there wasn't one.**
 *
 * `GateResult.gate` was a bare `string` until 2026-09-02. Two things followed from that, and they
 * looked unrelated until they were traced:
 *
 *  - `GATE_LABELS` in `coordinator/shortlist-panel.tsx` was `Record<string, string>` with a
 *    `?? gate.gate` fallback, so it COULD NOT be exhaustive — there was no union to be exhaustive
 *    over. When `sex_designation` was added to the movement path, the coordinator's shortlist
 *    rendered the raw identifier `sex_designation` where every other row carries a sentence.
 *  - `tests/ui-ward-coordinator.spec.ts` hand-counted the gate rows in five places, because there
 *    was no list to take a length from.
 *
 * **A hand-listed label map with a silent fallback and a hand-written count beside a growing list
 * are the same defect**, and both are now derived from this array. Add a gate here and the label
 * map fails to compile until it is labelled; the spec's counts follow automatically.
 *
 * ⚠️ **Not every gate is emitted by both functions**, and that is deliberate rather than an
 * oversight to tidy: `age` and `legal_status` are referral-path questions, and the movement path
 * answers them earlier. **This array is the union of what CAN be emitted, never an assertion that
 * both paths emit all of it.** The two paths diverging is exactly how the `sex_designation` defect
 * happened, and that divergence is measured in `tests/ward-eligibility.test.ts`, not asserted here.
 */
export const ELIGIBILITY_GATES = [
  "age",
  "allocatable_bed",
  "authorisation",
  "capacity_freshness",
  "cohort",
  "forensic",
  "legal_status",
  "prior_decline",
  "security",
  "sex_designation",
  "sex_mix",
  "specialling",
] as const;

/** One gate's name. Derived from `ELIGIBILITY_GATES` so the two can never disagree. */
export type EligibilityGate = (typeof ELIGIBILITY_GATES)[number];

export type GateResult = { gate: EligibilityGate; pass: boolean; detail: string };
export type EligibilityVerdict = { eligible: boolean; gates: GateResult[] };

/**
 * The ward addressings of a referral, narrowed so their bed criteria are reachable.
 *
 * A TYPE PREDICATE inside the filter rather than a cast at each call site: `as WardAddressing`
 * would compile just as well and would go on compiling the day a referral is addressed only to a
 * community team, at which point the bed gates would answer a question nobody asked.
 */
export function wardAddressings(referral: Referral): WardAddressing[] {
  return referral.destinations.filter(
    (addressing): addressing is WardAddressing => addressing.destination.kind === "psychiatric_ward",
  );
}

/** The single ward addressing, or `undefined`. A referral may hold at most one — `RECEIVE_REFERRAL`
 *  refuses two destinations of the same kind, since asking one kind twice is asking twice. */
export function wardAddressing(referral: Referral): WardAddressing | undefined {
  return wardAddressings(referral)[0];
}

/**
 * Every status other than Voluntary carries a detention authority, so the receiving unit must
 * be authorised. This governs the DESTINATION only — detaining a referred patient in an
 * unauthorised emergency department is lawful and is the normal state while they wait.
 */
export function requiresAuthorisedDestination(status: LegalStatus | undefined) {
  return status !== "Voluntary";
}

function capacityIsFresh(unit: Unit, now: Instant) {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/** "a unit" vs "an older adult unit" — the only two cohort/security values start with a
 * vowel or a consonant, so this is a plain vowel check rather than a lookup table. */
function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export function eligibility(movement: Movement, unit: Unit, now: Instant): EligibilityVerdict {
  const authorisationNeeded = requiresAuthorisedDestination(movement.legalStatus);
  const declined = movement.declines.some((decline) => decline.unitId === unit.id);
  const fresh = capacityIsFresh(unit, now);
  const sameSexOccupants = unit.sexMix[movement.sex] ?? 0;
  const designationAccepts = sexDesignationAccepts(unit.sexDesignation, movement.sex);

  const gates: GateResult[] = [
    {
      gate: "authorisation",
      pass: !authorisationNeeded || unit.authorised,
      detail: authorisationNeeded
        ? unit.authorised
          ? "Authorised to receive an involuntary admission"
          : `${unit.name} is not authorised under the Mental Health Act`
        : "Voluntary admission needs no authorisation",
    },
    {
      gate: "cohort",
      pass: unit.cohort === movement.cohort,
      detail:
        unit.cohort === movement.cohort
          ? `${unit.cohort} unit matches ${article(movement.cohort)} ${movement.cohort.toLowerCase()} movement`
          : `${unit.cohort} unit does not match ${article(movement.cohort)} ${movement.cohort.toLowerCase()} movement`,
    },
    {
      gate: "security",
      /*
       * ⚠️ WAS `movement.security === "Open" || unit.security === "Secure"` UNTIL 2026-09-04.
       * That asked "is this ward of the right TYPE", and a mixed locked/open ward has no single
       * type — so a mixed ward recorded as Open hid every one of its locked beds from every
       * patient who needed one. `unitHasLockedBeds` replaces the whole-ward flag and fixes exactly
       * that, changing nothing else about the shape of the test.
       *
       * 🔴 THIS GATE ASKS ABOUT KIND, NEVER ABOUT CAPACITY, AND THE FIRST VERSION GOT THAT WRONG.
       * It read `movement.security === "Open" ? unit.allocatable.value > 0 : lockedBedsFree(unit) > 0`
       * — a freeness test inside a suitability gate. That duplicated `allocatable_bed` and broke
       * the leniency it deliberately carries: the movement path passes on raw `allocatable`, the
       * referral path on `min(allocatable, empty)`, and the guard that makes either safe is
       * `PATIENT_ARRIVED` refusing when `empty.value <= 0`, three events downstream in a different
       * case block. The symptom was the last-bed reducer test: a second acceptance failed HERE, on
       * capacity, instead of reaching the pull guard that answers `bed_pulled_for_earlier_referral`.
       * Two other sessions warned about precisely this before it was written.
       *
       * An Open movement passes wherever the ward has beds at all — a voluntary patient may be
       * nursed in a locked bed, so no kind of ward is unsuitable on this axis.
       *
       * ⚠️ KNOWN RESIDUAL, deliberately not closed here: a Secure movement passes a mixed ward
       * whose locked beds are all occupied while its open beds are free. The old code could not
       * have this problem because a wholly-Secure ward's free beds were necessarily locked ones.
       * Closing it means teaching the CAPACITY gates about bed kind, which is a change to a
       * protected surface and belongs to the matcher, not to this one. The detail sentence below
       * states the real locked-bed figures so the gap is visible to a coordinator rather than
       * silent. (Plan author's reasoning, 2026-09-04 — not an owner ruling.)
       */
      pass: movement.security === "Open" || unitHasLockedBeds(unit),
      detail: securityGateDetail(movement, unit),
    },
    {
      // The ward's own designation, which `referralEligibility` has gated on since Phase 7 and
      // this path did not. A Female Adult movement needing a Secure bed passed every gate above
      // at `fsh-adult-secure` — the network's Male-only Secure bed — and came back eligible.
      //
      // `sex_mix` below is NOT this rule and is deliberately untouched: it asks whether mixing
      // sexes is acceptable given who is ALREADY on the ward, and passes for either sex whenever
      // more than one bed is free (`sameSexOccupants > 0 || allocatable > 1`), which is why it
      // never caught this. Designation is a property of the BED; mix is a property of its
      // occupants. Both must hold, so both are gates.
      //
      // Shares `sexDesignationAccepts` with the referral path rather than restating the rule —
      // a second implementation is how the two paths would drift apart again — and the detail is
      // the referral gate's wording with "movement" for "referral", so a coordinator reading the
      // two screens is told the same thing in the same words.
      gate: "sex_designation",
      pass: designationAccepts,
      detail: designationAccepts
        ? unit.sexDesignation === "Undesignated"
          ? `${unit.name} is undesignated and accepts either sex`
          : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and accepts this movement's sex`
        : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and does not accept this movement's sex`,
    },
    {
      // D7, mirrored from `referralEligibility` below: a forensic bed is never offered as a
      // destination, unconditionally, regardless of which door the request came through. This
      // gate was previously absent from this function even though `unit.forensic` is the same
      // property on the same `Unit` both paths receive — nothing about a movement withholds this
      // fact, so there was no reason it could not be checked here too. Its absence let the
      // network's forensic bed (`brm-adult-secure`) show `eligible: true` on the movement path
      // for 18 of the 35 seeded Adult movements, while the referral path refused that same bed
      // outright for the same unit at the same instant.
      //
      // Placed immediately after `sex_designation`, mirroring `referralEligibility`'s order:
      // both gates test a fixed property of the BED itself, decided before the gates below that
      // test whether this particular movement's needs (security, sex mix, specialling) fit this
      // particular bed right now. Detail wording is identical to the referral gate's — this is
      // not a variant, it is the same rule read by both screens.
      gate: "forensic",
      pass: !unit.forensic,
      detail: unit.forensic
        ? `${unit.name} is a forensic bed and is never offered as a destination`
        : `${unit.name} is not a forensic bed`,
    },
    {
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || unit.allocatable.value > 1,
      detail:
        sameSexOccupants > 0
          ? `${sameSexOccupants} ${movement.sex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed",
    },
    {
      gate: "specialling",
      pass: !movement.specialling || unit.speciallingCapacity > 0,
      detail: movement.specialling
        ? `${unit.speciallingCapacity} specialling slots available`
        : "No specialling required",
    },
    {
      gate: "prior_decline",
      pass: !declined,
      detail: declined ? "Already declined this movement" : "No prior decline",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      /*
       * ⚠️ **THE LENIENT FIGURE, AND WHAT MAKES THAT SAFE IS NOT IN THIS FILE.** This passes on
       * `allocatable` alone, so a ward with three allocatable and no empty bed is eligible here —
       * and `PULL_PATIENT` bounds the same lenient figure, so the pull succeeds too. **Neither is
       * the guard.** The guard is `PATIENT_ARRIVED` in `ward-flow-reducer.ts`, which refuses on
       * `unit.empty.value <= 0` with `(no_bed)`, pinned by *"refuses an arrival once the unit's
       * physically empty beds are exhausted"* in `tests/ward-flow-reducer.test.ts`.
       *
       * **A pull is a reservation; an arrival is the physical act.** The leniency is what lets a
       * ward accept in principle today and receive tomorrow, which is the whole of the
       * `accepted_awaiting_bed` stage.
       *
       * ⚠️ **THE EDIT THAT BREAKS IT LOOKS LIKE A STRENGTHENING.** Hoisting the empty check here
       * "for symmetry" with `referralEligibility`'s gate of the same name would read as tightening
       * a loose rule and would delete accept-in-principle. If that looks right to you, go and read
       * the guard named above first — it is the reason this line is allowed to be lenient.
       */
      gate: "allocatable_bed",
      pass: unit.allocatable.value > 0,
      detail: `${unit.allocatable.value} allocatable`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}

/**
 * The sentence beside the `security` gate's verdict, on either path — shared by `eligibility()`'s
 * `securityGateDetail` wrapper below and `referralEligibility()`'s own gate further down, because
 * DECIDED (plan Global Constraints): the bed-kind rule is IDENTICAL on both paths, and a second
 * hand-written copy of this wording is exactly how the two would drift apart again.
 *
 * Always names the real figures, because a coordinator reading "does not meet the requirement"
 * needs to know whether the ward has no locked beds at all or simply none free right now — they
 * are different problems with different next actions (look elsewhere, versus wait or ask).
 */
function bedKindGateDetail(needsSecureBed: boolean, unit: Unit): string {
  const free = lockedBedsFree(unit);
  if (needsSecureBed) {
    if (free > 0) {
      return `${unit.name} has ${free} locked bed${free === 1 ? "" : "s"} free (${designationSummary(unit)})`;
    }
    return unitHasLockedBeds(unit)
      ? `${unit.name} has locked beds but no locked bed is free (${designationSummary(unit)})`
      : `${unit.name} has no locked beds (${designationSummary(unit)})`;
  }
  if (unit.allocatable.value <= 0) return `${unit.name} has no free bed`;
  return openBedsFree(unit) > 0
    ? `${unit.name} has ${openBedsFree(unit)} open bed${openBedsFree(unit) === 1 ? "" : "s"} free`
    : `${unit.name} has only locked beds free — open admission is possible but not usual`;
}

/** `eligibility()`'s `security` gate detail — see `bedKindGateDetail` above for the shared rule. */
function securityGateDetail(movement: Movement, unit: Unit): string {
  return bedKindGateDetail(movement.security === "Secure", unit);
}

/**
 * Whether `designation` may hold a person of `sex` — a CONSTRAINT on the bed, never an equality
 * check against the referral's sex (see `SexDesignation`'s own doc comment on `ward-model.ts`).
 * `"Undesignated"` — the seeded majority — accepts either sex; `"Female only"`/`"Male only"`
 * narrow acceptance to the one sex they name. Isolated as its own function (rather than inlined
 * into the gates that use it) so the accepts-shape is visible on its own, independent of any
 * gate's pass/detail plumbing.
 *
 * Read by BOTH paths' `sex_designation` gate — `eligibility()` above as well as
 * `referralEligibility()` below. It is declared between them and used by both, which is the
 * point: the movement path spent its life without this gate while the referral path had it, and
 * one shared rule is what stops that gap reopening. Changing the rule here changes it on both
 * screens, which is the only correct behaviour — a bed's designation does not depend on which
 * door the request came through.
 */
function sexDesignationAccepts(designation: SexDesignation, sex: Sex): boolean {
  if (designation === "Undesignated") return true;
  return designation === "Female only" ? sex === "Female" : sex === "Male";
}

/**
 * Phase 7 (spec "The front door", D9): the referral-side counterpart of `eligibility()`, for a
 * `Referral` (Task 1, `ward-model.ts`) rather than a `Movement`. Returns the exact same
 * `EligibilityVerdict`/`GateResult[]` shape, so the "why not here?" artefact — every unit, and
 * for each gate a human-readable reason — comes out for free rather than being built twice.
 *
 * Every gate below is an ACCEPTS-rule — "does this bed accept this referral" — never "does this
 * bed's value equal the referral's". `age` happens to be a plain equality and is still written
 * in the same accepts-shape as the other three, so a future change (an adult unit that will also
 * take a 17-year-old) lands in one place rather than needing a special case.
 *
 * `security`, `sex_mix` and `specialling` reuse `eligibility()`'s logic unchanged, mapped onto the
 * referral fields that carry the same fact (`ward.sex` for `sex_mix`, `ward.secureBedNeeded`
 * for `security`). `capacity_freshness` also reuses `eligibility()`'s logic unchanged. `allocatable_bed`
 * DIFFERS from `eligibility()`'s gate of the same name: it gates on `availableNow` —
 * `Math.min(unit.allocatable.value, unit.empty.value)` — never `unit.allocatable.value` alone,
 * because the two are only documented to agree "in practice" and are not enforced to (see
 * `availableNow`'s own comment below). `capacity_freshness` and `allocatable_bed` still read only
 * `unit.allocatable` and `unit.empty` — the ward's own confirmed figures — and nothing in this
 * function ever reads a `BedRelease`, a release state, a band or a confidence level; that is what
 * keeps referral matching independent of the bed-release model, which no ward clinician
 * has yet validated (spec D15).
 *
 * **Takes a `WardReferral`, not a `Referral`, and that is the point of the destination union.**
 * Every gate here reads a property of a BED -- capacity, sex mix, security, authorisation -- so the
 * question this function answers has no meaning for an ED, a medical ward or a community team. It
 * is not that calling it with one of those would give a wrong answer; it is that the criteria do
 * not exist on those arms, so the call cannot be written. A caller holding a plain `Referral` must
 * narrow on `destination.kind` first, which is exactly the check that used to be a screen's job to
 * remember.
 */
export function referralEligibility(
  referral: Referral,
  ward: WardReferralDestination,
  unit: Unit,
  now: Instant,
): EligibilityVerdict {
  const fresh = capacityIsFresh(unit, now);
  const sameSexOccupants = unit.sexMix[ward.sex] ?? 0;
  const designationAccepts = sexDesignationAccepts(unit.sexDesignation, ward.sex);
  // Same bed-kind rule as `eligibility()`'s `security` gate above, via the shared
  // `bedKindGateDetail`/this identical arithmetic — DECIDED (plan Global Constraints): bed kind
  // is a suitability question and does not change between "can this ward take them in principle"
  // and "can this person come now", so both paths ask it identically. `ward.secureBedNeeded` is
  // this path's counterpart of `movement.security === "Secure"`.
  const securityMet = ward.secureBedNeeded ? lockedBedsFree(unit) > 0 : unit.allocatable.value > 0;
  // See the `legal_status` gate's own comment below for why this is an accepts-rule, never an
  // equality: a referral that does not need an involuntary bed is accepted by ANY bed, including
  // an authorised one — `unit.authorised` is a capability a bed has, not a value to match against.
  const legalStatusMet = !ward.involuntaryBedNeeded || unit.authorised;
  // Spec D15 / plan Global Constraints: the bed the coordinator can actually place someone in
  // right now is `availableNow`, never `unit.allocatable.value` alone. The two are documented to
  // agree "in practice" on `Unit.allocatable`, but that is not enforced — `CONFIRM_CAPACITY` can
  // raise `allocatable.value` back above `empty.value` after arrivals have already consumed the
  // physically empty beds, and `PATIENT_ARRIVED` decrements `empty.value` while leaving
  // `allocatable.value` untouched. Computed inline from the unit's own two figures — never via
  // `capacityBreakdown` (`ward-bed-availability.ts`), which takes `BedRelease[]` and would couple
  // referral matching to the bed-release model no ward clinician has validated (see
  // this function's own doc comment above and the D15 contract test in
  // `ward-referral-matching.test.ts`).
  const availableNow = Math.min(unit.allocatable.value, unit.empty.value);

  const gates: GateResult[] = [
    {
      gate: "age",
      pass: unit.cohort === referral.ageBand,
      detail:
        unit.cohort === referral.ageBand
          ? `${unit.cohort} unit matches ${article(referral.ageBand)} ${referral.ageBand.toLowerCase()} referral`
          : `${unit.cohort} unit does not match ${article(referral.ageBand)} ${referral.ageBand.toLowerCase()} referral`,
    },
    {
      // D3 rule 2 / D5's fourth field: a referral that does NOT need an involuntary bed is
      // accepted by ANY bed; a referral that DOES need one is accepted only by a bed that can
      // hold someone involuntarily (`unit.authorised`). Written as an accepts-rule, never an
      // equality, for the same reason as `sex_designation` below — `unit.authorised ===
      // ward.involuntaryBedNeeded` would refuse an involuntary-bed referral from an
      // authorised unit whenever the referral itself happened not to need one, which is backwards:
      // an authorised unit's extra capability never disqualifies it. The detail describes the bed
      // or the requirement, never the person: it is not a legal determination about who was
      // referred, only whether this bed can hold someone involuntarily if the request calls for it.
      gate: "legal_status",
      pass: legalStatusMet,
      detail: ward.involuntaryBedNeeded
        ? legalStatusMet
          ? `${unit.name} is authorised under the Mental Health Act`
          : `${unit.name} is not authorised under the Mental Health Act`
        : "No authorised destination required",
    },
    {
      gate: "sex_designation",
      pass: designationAccepts,
      detail: designationAccepts
        ? unit.sexDesignation === "Undesignated"
          ? `${unit.name} is undesignated and accepts either sex`
          : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and accepts this referral's sex`
        : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and does not accept this referral's sex`,
    },
    {
      // D7: a forensic bed is described so the board can be honest about the network, and is
      // never offered — the gate fails for every referral, unconditionally, with a detail that
      // says so plainly rather than implying the person was assessed and found unsuitable.
      //
      // Task 8 finding C: this detail used to end "…is never offered through Phase 7 front-door
      // matching". "Phase 7" and "front-door matching" are this project's own build vocabulary
      // and mean nothing to a ward coordinator, who is the one reading it. A gate detail may say
      // only what is true of the BED, in words the reader already has.
      //
      // "as a destination", not "for a referral": this file's own `legal_status` gate already
      // uses "destination" for a bed being placed into, and the word "referral" here would put
      // the sentence's object back on the request — which the guard in
      // `tests/ward-referral-matching.test.ts` ("the forensic gate's detail names the bed and
      // never judges the person") refuses, correctly. That guard was left exactly as it was.
      gate: "forensic",
      pass: !unit.forensic,
      detail: unit.forensic
        ? `${unit.name} is a forensic bed and is never offered as a destination`
        : `${unit.name} is not a forensic bed`,
    },
    {
      gate: "security",
      pass: securityMet,
      detail: bedKindGateDetail(ward.secureBedNeeded, unit),
    },
    {
      // `availableNow`, not `unit.allocatable.value` alone — the same C2 correction fix round B
      // made to `allocatable_bed`, applied here where it was left behind (fix round C, F3 /
      // review finding I4). This gate's own detail already SAYS "needs more than one free bed",
      // and a free bed is `availableNow`: a ward that confirmed 3 allocatable beds and then took
      // two arrivals has `allocatable: 3, empty: 1`, so reading `allocatable` alone passed this
      // gate on a ward with exactly one free bed — placing a lone woman on a ward with no other
      // free bed, the precise outcome this gate exists to prevent, while the capacity board read
      // `availableNow` and correctly said 1. No new rule: this makes the code do what its own
      // user-visible sentence already promised.
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || availableNow > 1,
      detail:
        sameSexOccupants > 0
          ? `${sameSexOccupants} ${ward.sex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed",
    },
    {
      // A referral carries no specialling-need fact — unlike `Movement.specialling`, Task 1
      // fixed the referral's permitted-field list at three facts about the person and none of
      // them expresses this. Kept as its own gate (rather than dropped) so a coordinator reading
      // every gate on the referral's match view learns what the system does and does not know
      // about a referral, the same reason every gate is listed rather than only the failing ones.
      // The detail must describe the RECORD, never assert a fact about the person: "No
      // specialling required" would tell a coordinator something was checked and found absent,
      // when nothing was checked — nobody entered this fact and the record does not hold it. If a
      // future referral field ever carries this need, only this gate changes.
      gate: "specialling",
      pass: true,
      detail: "Specialling need is not recorded on a referral",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      // `availableNow`, not `unit.allocatable.value` alone — see the comment on `availableNow`'s
      // declaration above. The detail names both source figures so a coordinator (or a future
      // reader of this code) can see why they can diverge, without reading anything but the
      // unit's own two confirmed numbers.
      //
      // ⚠️ **THE MOVEMENT PATH'S GATE OF THIS NAME IS DELIBERATELY LOOSER, AND IT IS NOT A DRIFT.**
      // `eligibility()` above passes on `allocatable` alone because a movement is asking whether
      // the ward can accept in principle; a referral is asking whether this person can come now.
      // The safety of that looser gate rests on `PATIENT_ARRIVED` in `ward-flow-reducer.ts` — read
      // the comment at its site before assuming either gate is wrong.
      //
      // **One name, two pass conditions, on purpose.** Nobody had noticed until a 2026-09-04
      // census; the risk is the shared NAME inviting the assumption that they are one test.
      gate: "allocatable_bed",
      pass: availableNow > 0,
      // "ready" for the min, per the owner's 2026-09-04 one-word ruling. The two figures in
      // parentheses keep their own field names — they are DIFFERENT quantities and relabelling
      // either would put one number's name on another.
      detail: `${availableNow} ready (${unit.allocatable.value} allocatable, ${unit.empty.value} empty)`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}

/**
 * A binary, non-ordinal description of a verdict: eligible, or the specific gate that failed.
 * Eligibility gates are not commensurable (failing `authorisation` is a legal hard stop;
 * failing `capacity_freshness` is a staleness warning), so this deliberately never collapses
 * them into a "N of M passed" fraction — that shape reads as a score, and higher/lower
 * comparisons across two verdicts are not meaningful.
 *
 * Fix round C (F1, review finding C1): this lives HERE rather than in `ward-derivations.ts`,
 * where it was originally written, and `ward-derivations.ts` re-exports it so its six existing
 * call sites are untouched. It depends on nothing but `EligibilityVerdict`, which is declared in
 * this file. `ward-referrals.ts` reads it from here, and that is the whole point: taking it from
 * `ward-derivations.ts` instead pulled `ward-flow-reducer.ts`, `ward-flow-events.ts` and
 * `ward-movements.ts` into referral matching's transitive module graph, and all three name the
 * bed-release model at the top of the file — which turned the D15 contract test in
 * `tests/ward-referral-matching.test.ts` red (5 files and 0 offenders became 17 files and 4).
 * D15 is deliberately structural: no code path reachable from matching may read that model AT
 * ALL, not even one that happens to agree with `unit.allocatable` today.
 *
 * The prose above deliberately does not spell the release model's type name, and deliberately
 * does not put the word "import" beside it. That contract test splits a file on a crude
 * `/import\s+[\s\S]*?;/` before checking, so an explanatory comment CAN produce a false
 * positive — this one did, on its first draft. The guard is not the thing to relax.
 */
export function candidateReason(verdict: EligibilityVerdict) {
  if (verdict.eligible) return "Eligible now";
  const failed = verdict.gates.find((gate) => !gate.pass);
  return failed ? failed.detail : "Not eligible";
}
