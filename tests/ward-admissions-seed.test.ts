import { describe, expect, it } from "vitest";

import {
  LEAVING_DESTINATIONS,
  STAY_BANDS,
  bedIsOccupied,
  isPastExpectedDischarge,
  stayBand,
  type Admission,
  type StayBandId,
} from "@/components/ward-management/ward-admissions";
import {
  TENTATIVE_DIAGNOSIS_BLOCKS,
  isTentativeDiagnosisBlock,
} from "@/components/ward-management/ward-diagnosis";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { OUT_OF_AREA_BANDS, travelBand } from "@/components/ward-management/ward-distance";
import { HOME_REGIONS, SEXES, type Sex, type Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * The seeded people occupying beds across the network.
 *
 * Two features are derived FROM this fixture — the ward board and the out-of-area ledger — so a
 * fixture that quietly makes one of their rules VACUOUS is worse than no fixture at all: every
 * downstream test then passes because the case it was written for is not in the data, and nothing
 * anywhere goes red. That is a named recurring defect in this project, which is why the second
 * half of this file is coverage rather than integrity: each of those tests asserts that a
 * particular case EXISTS, and `some(...)` is the correct shape for exactly that claim and for
 * nothing else here. The integrity half never uses it — those are properties of the whole set.
 *
 * `now` is the fixture's own anchor. Every instant in the seed is authored against it, so reading
 * the wall clock here would make band boundaries and overdue dates drift between runs.
 */
const NOW = WARD_ADMISSIONS_ANCHOR;

/**
 * The roles a discharge may be confirmed by, written out HERE rather than imported from the seed.
 *
 * Importing the seed's own list would make the assertion below a check that cannot fail: the
 * fixture would be measured against the thing the fixture is built from, and a personal name added
 * to both would sail through. These two strings are quoted from `Admission.dischargeDateSetBy`'s
 * own doc comment — the only place this vocabulary is written down, since the field is typed
 * `string | null` with no fixed runtime array of its own. If the seed ever needs a third role, this
 * copy is edited deliberately in the same change; that visible edit IS the guard.
 */
const CONFIRMING_ROLES = ["Flow coordinator", "Nurse unit manager"];

const units: Unit[] = allUnits();
const unitById = new Map<string, Unit>(units.map((unit) => [unit.id, unit]));

/** The unit a seeded admission names, or `undefined` — never a fallback to a different unit. */
function unitFor(admission: Admission): Unit | undefined {
  return unitById.get(admission.unitId);
}

/**
 * Whether this admission's bed is out of area FOR THIS PERSON — the band from their home region to
 * their unit's own site, looked up through `ward-distance.ts` and never computed here. `false` for
 * a pair the synthetic table does not record: an unrecorded pair is a gap, never "unknown means
 * far", and the ledger counts those separately (see the not-banded coverage test below).
 */
function isOutOfArea(admission: Admission): boolean {
  const unit = unitFor(admission);
  if (unit === undefined) return false;
  const band = travelBand(admission.homeRegion, unit.siteCode);
  return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
}

/**
 * Deliberately computed HERE rather than imported from `ward-board-derivations`.
 *
 * This assertion is a claim about the FIXTURE — that the people it seeds into each unit add up to
 * what `ward-sites.ts` already records — so it must not depend on the board layer that happens to
 * expose the same sum. Importing `derivedSexMix` dragged `ward-board-derivations` in, and with it
 * `capacityBreakdown`, which is a forbidden identifier inside the sister phase's matching firewall.
 * That made the seed unusable there: cherry-picking it took a test file whose import could not
 * resolve, so the whole file silently never loaded — including this file's anchor-drift guard,
 * which everyone then believed was protecting a copied constant it had never once run against.
 *
 * The counting rule is `bedIsOccupied`, not `state === "occupied"`: a PULLED admission holds a bed
 * before anyone has arrived, and a unit's recorded `sexMix` counts the beds that are gone.
 */
function seededSexMix(unitId: string): Record<Sex, number> {
  const here = wardAdmissions.filter((admission) => admission.unitId === unitId && bedIsOccupied(admission));
  return {
    Female: here.filter((admission) => admission.sex === "Female").length,
    Male: here.filter((admission) => admission.sex === "Male").length,
  };
}

describe("the seeded admissions are a fixture that can fail", () => {
  // Every assertion below iterates the seed or the network. Either coming back empty would make
  // the whole file pass by scanning nothing — the "check that cannot fail" shape this repository
  // has shipped before.
  it("has admissions to check and units to check them against", () => {
    expect(wardAdmissions.length).toBeGreaterThan(0);
    expect(units.length).toBeGreaterThan(0);
  });
});

describe("seeded admissions — integrity", () => {
  it("never puts more bed-occupying admissions on a unit than it has beds", () => {
    const overfilled = units
      .map((unit) => ({
        unitId: unit.id,
        beds: unit.beds,
        occupying: wardAdmissions.filter((admission) => admission.unitId === unit.id && bedIsOccupied(admission))
          .length,
      }))
      .filter((row) => row.occupying > row.beds);
    expect(overfilled).toEqual([]);
  });

  it("names only units that exist in the network", () => {
    const unknown = wardAdmissions
      .filter((admission) => unitFor(admission) === undefined)
      .map((admission) => `${admission.id}: ${admission.unitId}`);
    expect(unknown).toEqual([]);
  });

  it("draws every home region and every blocker from its own fixed list", () => {
    const badRegions = wardAdmissions
      .filter((admission) => !(HOME_REGIONS as readonly string[]).includes(admission.homeRegion))
      .map((admission) => `${admission.id}: ${admission.homeRegion}`);
    expect(badRegions).toEqual([]);

    const badBlockers = wardAdmissions
      .filter(
        (admission) =>
          admission.blockReason !== null &&
          !(BED_RELEASE_BLOCKERS as readonly string[]).includes(admission.blockReason),
      )
      .map((admission) => `${admission.id}: ${admission.blockReason}`);
    expect(badBlockers).toEqual([]);
  });

  it("gives every admission a unique id", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const admission of wardAdmissions) {
      if (seen.has(admission.id)) duplicates.push(admission.id);
      seen.add(admission.id);
    }
    expect(duplicates).toEqual([]);
    expect(seen.size).toBe(wardAdmissions.length);
  });

  /**
   * Lifecycle coherence, over the WHOLE set rather than a sampled example. A fixture that
   * violates its own lifecycle makes every downstream test meaningless: a `"pulled"` record
   * carrying an `arrivedAt` would be counted as a stay by `daysInBed`, and a `"left"` record with
   * no destination would silently drop out of every statewide-release figure.
   */
  it("keeps every admission coherent with its own state", () => {
    const incoherent: string[] = [];
    for (const admission of wardAdmissions) {
      const { id, state, pulledAt, arrivedAt, leftAt, leavingDestination } = admission;
      if (state === "waitlisted" && (pulledAt !== null || arrivedAt !== null)) {
        incoherent.push(`${id}: waitlisted but already pulled or arrived`);
      }
      if (state === "pulled" && (pulledAt === null || arrivedAt !== null)) {
        incoherent.push(`${id}: pulled without a pull instant, or already arrived`);
      }
      if (state === "occupied" && (pulledAt === null || arrivedAt === null)) {
        incoherent.push(`${id}: occupied without both a pull and an arrival`);
      }
      if (state === "left" && (leftAt === null || leavingDestination === null)) {
        incoherent.push(`${id}: left without a leaving instant and a destination`);
      }
      if (state !== "left" && (leftAt !== null || leavingDestination !== null)) {
        incoherent.push(`${id}: still here but carrying a departure`);
      }
    }
    expect(incoherent).toEqual([]);
  });

  /**
   * The confirmation pair, over the WHOLE set. Two things it holds:
   *
   *   - Both fields are DECLARED on every record, `null` where nothing was confirmed. An absent
   *     field reads back as `undefined`, which passes a `!== null` test as though a ward had
   *     confirmed something — so a builder that forgets the pair would otherwise seed phantom
   *     confirmations into every downstream count.
   *   - The instant and the role travel TOGETHER. A confirmation with no role recorded cannot be
   *     acted on, and a role left behind on a discharge nobody confirmed is a decision attributed
   *     to a ward that never made it; neither is caught by checking the two fields separately.
   */
  it("declares both confirmation fields on every admission, and keeps the instant and the role together", () => {
    const wrong: string[] = [];
    for (const admission of wardAdmissions) {
      const at = admission.dischargeConfirmedAt;
      const by = admission.dischargeConfirmedBy;
      if (at !== null && typeof at !== "number") wrong.push(`${admission.id}: dischargeConfirmedAt is not declared`);
      if (by !== null && typeof by !== "string") wrong.push(`${admission.id}: dischargeConfirmedBy is not declared`);
      if ((at === null) !== (by === null)) wrong.push(`${admission.id}: confirmed instant and role disagree`);
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The consistency test the whole fixture is shaped around, and the hardest constraint in it.
   *
   * `Unit.sexMix` is a hand-maintained count that nothing derives and nothing can check. This
   * asserts the people actually in the beds agree with it, unit by unit and for BOTH sexes — which
   * is what later lets the hand-maintained number be replaced by the derived one without any
   * ward's figures moving. A mismatch here means the fixture disagrees with what the network
   * already claims about itself.
   */
  it("derives a sex mix that matches every unit's recorded sexMix exactly", () => {
    const mismatched = units
      .map((unit) => ({
        unitId: unit.id,
        recorded: unit.sexMix,
        derived: seededSexMix(unit.id),
      }))
      .filter((row) => SEXES.some((sex) => row.derived[sex] !== row.recorded[sex]));
    expect(mismatched).toEqual([]);
  });
});

describe("seeded admissions — coverage (a rule with no case is an untestable rule)", () => {
  it("represents all four stay bands", () => {
    const present = new Set<StayBandId>();
    for (const admission of wardAdmissions) {
      const band = stayBand(admission, NOW);
      if (band !== null) present.add(band.id);
    }
    expect([...STAY_BANDS].map((band) => band.id).filter((id) => !present.has(id))).toEqual([]);
  });

  it("contains a bed given away to somebody who has not arrived", () => {
    expect(
      wardAdmissions.some(
        (admission) => admission.state === "pulled" && admission.pulledAt !== null && admission.arrivedAt === null,
      ),
    ).toBe(true);
  });

  it("contains somebody still in a bed past the ward's own expected date", () => {
    expect(
      wardAdmissions.some((admission) => admission.state === "occupied" && isPastExpectedDischarge(admission, NOW)),
    ).toBe(true);
  });

  it("contains a bed that is blocked from being released", () => {
    expect(wardAdmissions.some((admission) => admission.blockReason !== null)).toBe(true);
  });

  /**
   * A discharge the ward has actually DECIDED on, not merely planned a date for. Without a seeded
   * case, the `"confirmed"` stage of the derived bed-release view has no data behind it anywhere
   * in this fixture, and every downstream board test would pass while showing a stage no seeded
   * ward ever reaches. The confirming value must be a ROLE — the same bar `dischargeDateSetBy`
   * holds — so a personal name creeping in fails here rather than reaching a screen.
   */
  it("contains a discharge the ward has confirmed, recorded against a role", () => {
    // `typeof === "number"`, not `!== null`: a record that never declared the field at all reads
    // back as `undefined`, which is `!== null` and would count as a confirmation nobody made. The
    // integrity test above is what makes a missing field fail rather than pass quietly here.
    const confirmed = wardAdmissions.filter((admission) => typeof admission.dischargeConfirmedAt === "number");
    expect(confirmed.length).toBeGreaterThan(0);
    for (const admission of confirmed) {
      expect(admission.dischargeConfirmedBy, `${admission.id} confirmed by nobody`).not.toBeNull();
      expect(CONFIRMING_ROLES, `${admission.id} confirmed by a non-role`).toContain(admission.dischargeConfirmedBy);
      // A confirmed discharge still needs the ward's own date: the derived release has nowhere
      // else to get a real `expectedAt` from, and one must never be fabricated.
      expect(admission.expectedDischargeAt, `${admission.id} confirmed with no expected date`).not.toBeNull();
    }
  });

  /**
   * CONFIRMED **AND** BLOCKED — the single most important seeded case for the bed model, and the
   * one the three-stage rework exists for: a stuck confirmed discharge must still count as
   * confirmed, because blocked is a cross-cut and never a bucket subtracted from a stage. A
   * derivation that quietly sorted blocked releases out of the confirmed count would pass every
   * fixture-driven test in this repository if this case were missing from the seed.
   */
  it("contains a discharge that is confirmed AND blocked at the same time", () => {
    expect(
      wardAdmissions.some(
        (admission) => typeof admission.dischargeConfirmedAt === "number" && admission.blockReason !== null,
      ),
    ).toBe(true);
  });

  /**
   * THE FIELD ADDED ON 2026-08-29 BY OWNER RULING, checked over the WHOLE set rather than by
   * finding one good example.
   *
   * Two things, and the first is the one that matters. **Chosen, never typed**: every seeded value
   * is either `null` or a member of `TENTATIVE_DIAGNOSIS_BLOCKS`. A fixture is the easiest place in
   * this codebase for a free-text string to enter a typed union — a hand-edited line, a paraphrase
   * of a heading, a four-character code — and `isTentativeDiagnosisBlock` run over every record is
   * what makes that impossible rather than discouraged.
   *
   * **`typeof === "string"`, not `!== null`**: a record that never declared the field reads back as
   * `undefined`, which is `!== null`, and would then be handed to the membership check as a
   * non-string. The same trap the confirmation-pair test above documents.
   */
  it("gives every admission a declared block or nothing — never a value outside the eleven", () => {
    const wrong: string[] = [];
    for (const admission of wardAdmissions) {
      const value = admission.tentativeDiagnosis;
      if (value === null) continue;
      if (typeof value !== "string") {
        wrong.push(`${admission.id}: tentativeDiagnosis is not declared`);
        continue;
      }
      if (!isTentativeDiagnosisBlock(value)) wrong.push(`${admission.id}: "${value}" is not a declared block`);
    }
    expect(wrong).toEqual([]);
  });

  /**
   * COVERAGE, and both halves of it are load-bearing.
   *
   * A block declared in the vocabulary but never seeded is a rendering path with no data behind it:
   * every screen test showing diagnoses would pass without ever drawing that block. And a fixture
   * where everybody carried a value would leave the "none recorded" branch — the ordinary state —
   * with no seeded case at all, which is the branch a reader is most likely to see wrong.
   */
  it("seeds all eleven blocks somewhere, and leaves some people with none recorded", () => {
    const seeded = new Set(
      wardAdmissions.map((admission) => admission.tentativeDiagnosis).filter((value) => value !== null),
    );
    const missing = TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => block.code).filter((code) => !seeded.has(code));
    expect(missing, "these blocks are declared but never seeded").toEqual([]);

    const unrecorded = wardAdmissions.filter((admission) => admission.tentativeDiagnosis === null);
    expect(unrecorded.length, "no seeded person is missing a tentative diagnosis").toBeGreaterThan(0);
    // And not everybody — a fixture where nobody had one would satisfy the line above while
    // leaving every rendered block untested.
    expect(unrecorded.length).toBeLessThan(wardAdmissions.length);
  });

  /**
   * The cohort claim the pools were authored for, asserted where it is checkable without inventing
   * a clinical rule: the youth ward and the older-adult wards must not draw from one adult pool.
   * Stated as a difference between two seeded sets rather than as a list of "correct" blocks —
   * which block belongs on which ward is the owner's judgement, not this test's.
   */
  it("gives the youth ward a different set of blocks from the older-adult wards", () => {
    const blocksOn = (predicate: (unitId: string) => boolean) =>
      new Set(
        wardAdmissions
          .filter((admission) => predicate(admission.unitId) && admission.tentativeDiagnosis !== null)
          .map((admission) => admission.tentativeDiagnosis),
      );

    const youth = blocksOn((unitId) => unitId.endsWith("-youth"));
    const olderAdult = blocksOn((unitId) => unitId.endsWith("-older-adult"));

    // Non-vacuity: both cohorts really have seeded people carrying blocks.
    expect(youth.size, "the youth ward seeds no tentative diagnosis at all").toBeGreaterThan(0);
    expect(olderAdult.size, "no older-adult ward seeds a tentative diagnosis").toBeGreaterThan(0);
    expect([...youth].sort()).not.toEqual([...olderAdult].sort());
  });

  it("contains somebody with no expected discharge date at all", () => {
    expect(wardAdmissions.some((admission) => bedIsOccupied(admission) && admission.expectedDischargeAt === null)).toBe(
      true,
    );
  });

  it("contains an admission that has ended, carrying both a leaving instant and a destination", () => {
    expect(
      wardAdmissions.some(
        (admission) => admission.state === "left" && admission.leftAt !== null && admission.leavingDestination !== null,
      ),
    ).toBe(true);
  });

  /**
   * The one destination that does NOT return a bed to the state. Without a seeded case the netting
   * rule — a transfer frees the sending ward's bed and gives the network nothing — can only ever be
   * exercised by a hand-built unit-test record, and a statewide figure that quietly counted it
   * would pass every test in the repository.
   */
  it("contains a departure to another psychiatric ward, the one that is not a statewide release", () => {
    const notARelease = LEAVING_DESTINATIONS.filter((destination) => !destination.countsAsStatewideRelease);
    expect(notARelease).toHaveLength(1);
    const [transfer] = notARelease;
    expect(
      wardAdmissions.some((admission) => admission.state === "left" && admission.leavingDestination === transfer.id),
    ).toBe(true);
  });
});

describe("seeded admissions — what the out-of-area ledger needs", () => {
  it("contains somebody occupying a bed a long way from home", () => {
    expect(wardAdmissions.some((admission) => bedIsOccupied(admission) && isOutOfArea(admission))).toBe(true);
  });

  /**
   * The ledger counts unbanded pairs SEPARATELY rather than folding them into either side. That
   * split is untestable in seeded data unless the seed actually contains a pair the synthetic
   * travel table does not record.
   */
  it("contains somebody whose travel band cannot be resolved at all", () => {
    expect(
      wardAdmissions.some((admission) => {
        const unit = unitFor(admission);
        return (
          unit !== undefined &&
          bedIsOccupied(admission) &&
          travelBand(admission.homeRegion, unit.siteCode) === undefined
        );
      }),
    ).toBe(true);
  });

  it("contains somebody who has left an out-of-area bed", () => {
    expect(wardAdmissions.some((admission) => admission.state === "left" && isOutOfArea(admission))).toBe(true);
  });
});

/**
 * The one guard the implementer could not write for itself.
 *
 * `WARD_ADMISSIONS_ANCHOR` is a SECOND COPY of `NOW_ANCHOR`, and it exists only because
 * `tests/ward-flow-single-source.test.ts` restricts reads of `NOW_ANCHOR` under `src/` to three
 * allowlisted files — adding the seed to that allowlist would have meant editing an existing test
 * file, which the implementer was forbidden to do while another session shared this worktree.
 *
 * A duplicated constant that can drift is this repository's most reliable way to ship a silent
 * failure: if `NOW_ANCHOR` moves and this copy does not, EVERY seeded stay length shifts, every
 * stay band silently re-buckets, and every test above still passes because they all read the same
 * stale copy. Nothing would go red.
 *
 * That restriction does not apply to `tests/`, and every other ward test imports `NOW_ANCHOR`
 * directly — so the drift is catchable here, from outside `src`, at the cost of one assertion and
 * no edit to any existing file. If the seed is ever added to that allowlist, delete
 * `WARD_ADMISSIONS_ANCHOR` and this block together.
 */
describe("seeded admissions — the duplicated anchor", () => {
  it("holds exactly the value of NOW_ANCHOR, so seeded stay lengths cannot silently drift", () => {
    expect(WARD_ADMISSIONS_ANCHOR).toBe(NOW_ANCHOR);
  });
});
