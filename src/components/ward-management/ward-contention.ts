import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement, MovementId, Unit } from "@/components/ward-management/ward-model";

/**
 * ⚠️ **THE MISSING PRIMITIVE: OFFERING A BED TO ONE PATIENT REMOVES IT FROM ANOTHER'S OPTIONS.**
 *
 * Every function in this codebase that takes both movements and units iterates the movements
 * INDEPENDENTLY — measured, 2026-09-04, across 96 of the 97 files under `ward-management/`. Two
 * places do it with more than one patient in the same pass:
 *
 *   - `escalationBoard` (`ward-derivations.ts`) asks per movement whether ANY unit is eligible, so
 *     two patients whose only eligible ward is the SAME single-bed ward are both omitted from
 *     `nowhereEligible` — each, asked alone, has somewhere to go.
 *   - `QueueView`'s eligible-ward column (`ward-management-modes.tsx`) renders one ward name per
 *     patient row, and two rows can name the same ward's only bed. (It was headed "Top candidate"
 *     until 2026-09-04, over a comparison that never ran — see the note at its own site.)
 *
 * **Neither is wrong about the patient it was asked about. Both are wrong about the ward.**
 *
 * ⚠️ **THIS FUNCTION REPORTS. IT DOES NOT DECIDE, AND THE DIFFERENCE IS THE WHOLE DESIGN.**
 * It does not rank, score, weight or order patients — nothing in this project ranks a person — and
 * it does not resolve a contention or produce an arrangement. Who should get a contended bed
 * depends on an owner decision that has not been made, and building the resolver now would make
 * that decision by implementation. See `docs/ward-flow/brief-contention-model-2026-09-04.md`.
 *
 * **It is additive.** No existing function's behaviour changes, and no caller is wired up here.
 */

/**
 * ⚠️ **THE THREE KINDS ARE NOT THREE STRENGTHS OF THE SAME THING — THEY DIFFER IN WHETHER THE
 * WARD'S OWN NUMBER HAS ALREADY MOVED.**
 *
 * `PULL_PATIENT` decrements `unit.allocatable.value` as it fires, so a pulled movement's claim is
 * already subtracted from the figure the ward publishes. An acceptance and a live referral change
 * no figure at all: the ward still advertises the bed while one or three people are counting on it.
 */
export type ContentionClaimKind =
  /** Listed in `Movement.referredUnitIds` — a live referral, and up to `PARALLEL_REFERRAL_CAP` of them may name the same unit. */
  | "referred"
  /** `Movement.acceptedUnitId`, awaiting a bed. The ward has said yes and nothing has been reserved yet. */
  | "accepted"
  /** Accepted AND pulled: a reservation that has already reduced the unit's `allocatable` figure. */
  | "pulled";

export type ContentionClaim = {
  movementId: MovementId;
  kind: ContentionClaimKind;
  /**
   * Whether `Unit.allocatable.value` has ALREADY been reduced by this claim. Counting a reflected
   * claim again subtracts the same bed twice — the one arithmetic error this model exists to
   * avoid making.
   */
  reflectedInAllocatable: boolean;
};

export type UnitContention = {
  unitId: string;
  /** The ward's own confirmed figure, already net of every pull against it. */
  allocatable: number;
  /**
   * Physically empty beds. Reported ALONGSIDE `allocatable` and never merged with it: a pull is a
   * reservation and an arrival is the physical act, so the two figures diverge legitimately and a
   * model collapsing them would contradict the reducer's own pinned invariant (`PULL_PATIENT`
   * bounds `allocatable`, `PATIENT_ARRIVED` bounds `empty`).
   */
  empty: number;
  claims: ContentionClaim[];
  /** How many claims the ward's own `allocatable` figure cannot see — the accepted and the referred. */
  unreflectedClaims: number;
  /**
   * `allocatable - unreflectedClaims`.
   *
   * ⚠️ **NEGATIVE IS THE INTERESTING CASE AND IT IS NEVER CLAMPED.** A floor of zero would report
   * a ward with one bed and three referrals identically to a ward with exactly enough beds, which
   * is the confusion this whole model exists to end.
   */
  uncommittedAllocatable: number;
};

export type ContentionMap = {
  units: UnitContention[];
  now: Instant;
};

/**
 * ⚠️ **WHETHER THE WARD'S FIGURE HAS ALREADY ABSORBED THIS CLAIM — AND `stage` IS NOT THE ANSWER.**
 *
 * This was written as a set of stages (`pulled`, `handover_ready`, `moving`) and that was wrong in
 * the direction that invents scarcity. **`STEP_BACK_STAGE` moves a movement's stage BACKWARDS out
 * of `pulled` while deliberately leaving the bed held** — its own site says *"TOUCH NOTHING ELSE …
 * never write `acceptedUnitId`, `acceptedAt`, `pullExpiresAt` … or any `Unit.allocatable` field"*,
 * and `tests/ward-movement-step-back-reducer.test.ts` pins it as *"does not release the bed"*. A
 * stage-keyed model called that claim unreflected and **subtracted the same bed twice**, reporting a
 * ward as oversubscribed while it had room.
 *
 * **`pullExpiresAt` is exactly co-extensive with the reservation, and it is the only field that
 * is.** Two writers in the whole reducer: `PULL_PATIENT` sets it in the same object literal that
 * decrements `allocatable`, and the pull-release unwind clears it in the same literal that restores
 * `allocatable`. Nothing else writes it — step-back explicitly does not.
 *
 * ⚠️ **THE PRESENCE OF THE FIELD IS THE SIGNAL, NEVER ITS VALUE.** An expired `pullExpiresAt` does
 * NOT mean the bed came back: no event acts on expiry, and the only path that restores `allocatable`
 * clears the field as it goes. Adding `&& pullExpiresAt > now` here would re-create the double
 * subtraction for every lapsed pull.
 *
 * ⚠️ **AND IT IS A DISJUNCTION, BECAUSE THE MARKER ALONE WAS ALSO WRONG — measured, not reasoned.**
 * Of the 15 seeded movements standing at a pulled stage, **8 carry no `pullExpiresAt` at all**
 * (`WF-005`, `WF-006`, `WF-014`, `WF-015`, `WF-306`, `WF-313`, `WF-320`, `WF-327`) — hand-authored
 * states the reducer could not have produced, since `PULL_PATIENT` writes the field in the same
 * literal that decrements the bed. Keying on the marker alone silently reclassified all eight and
 * moved the fixture from 15 reserved claims to 7, taking three oversubscribed wards to five.
 * **Neither half of this rule can be removed:** the stage half carries the authored seed, the
 * marker half carries the stepped-back movement whose stage has moved on while its bed has not.
 * `tests/ward-contention.test.ts` has a case for each, and dropping either half takes one red.
 */
const PULLED_STAGES = new Set<Movement["stage"]>(["pulled", "handover_ready", "moving"]);

function reservationHeld(movement: Movement): boolean {
  return PULLED_STAGES.has(movement.stage) || movement.pullExpiresAt !== undefined;
}

/**
 * Per unit: which open movements currently hold a claim on its capacity, what kind of claim, and
 * how much of the unit's own figure is therefore already spoken for.
 *
 * ⚠️ **TAKES LIVE `movements` AND `units` AS PARAMETERS AND READS NO FIXTURE.**
 * `tests/ward-flow-single-source.test.ts` walks the TypeScript parser and refuses any
 * live-unit-taking function that reaches for `allUnits()` internally.
 *
 * Every unit given is returned, including the quiet ones — a ward with no claims is a real answer
 * and the caller should not have to distinguish "no contention" from "not walked".
 */
export function contention(movements: Movement[], units: Unit[], now: Instant): ContentionMap {
  const open = movements.filter(isOpen);

  const rows = units.map((unit) => {
    /*
     * ⚠️ **ONE CLAIM PER MOVEMENT PER UNIT, AND THE `continue` IS WHAT GUARANTEES IT — nothing
     * else does.** `ACCEPT_REFERRAL` clears `referredUnitIds`, so the reducer cannot produce a
     * movement that is both accepted at a unit and still referred to it; a hand-authored seed
     * movement can, and two claims from one patient would overstate a ward's pressure by exactly
     * the number of movements it has accepted.
     *
     * ⚠️ **THIS WAS A `Map` KEYED BY MOVEMENT ID, WITH A COMMENT SAYING THE KEY IS WHAT PREVENTS
     * THE DUPLICATE. THAT WAS FALSE.** Each movement is visited once per unit and the two branches
     * are mutually exclusive through the `continue`, so the key could never collide: replacing the
     * whole `Map` with a plain pushing array left all twelve tests GREEN. Machinery that cannot
     * change an outcome reads as a safeguard and is not one — the branch order and the `continue`
     * are the safeguard, and `tests/ward-contention.test.ts` proves it by going red when the two
     * branches are swapped.
     */
    const claims: ContentionClaim[] = [];

    for (const movement of open) {
      if (movement.acceptedUnitId === unit.id) {
        const pulled = reservationHeld(movement);
        claims.push({
          movementId: movement.id,
          kind: pulled ? "pulled" : "accepted",
          reflectedInAllocatable: pulled,
        });
        continue;
      }
      if (movement.referredUnitIds.includes(unit.id)) {
        claims.push({ movementId: movement.id, kind: "referred", reflectedInAllocatable: false });
      }
    }

    const unreflectedClaims = claims.filter((claim) => !claim.reflectedInAllocatable).length;

    return {
      unitId: unit.id,
      allocatable: unit.allocatable.value,
      empty: unit.empty.value,
      claims,
      unreflectedClaims,
      uncommittedAllocatable: unit.allocatable.value - unreflectedClaims,
    };
  });

  return { units: rows, now };
}

/**
 * Two open movements whose claims on the SAME unit cannot both be honoured.
 *
 * ⚠️ **`members` IS SORTED BY IDENTIFIER FOR DETERMINISM AND THE ORDER MEANS NOTHING.** It is a
 * lexicographic sort of two strings so that one pair has one representation and a test can assert
 * on it. **It is not a priority, a preference, or a queue position, and no caller may read it as
 * one** — nothing in this project ranks a person.
 */
export type ContentionPair = {
  unitId: string;
  members: readonly [ContentionPairMember, ContentionPairMember];
  /** The unit's own confirmed figure at the time of the walk — context, so a reader need not re-derive it. */
  allocatable: number;
  /** How many claims on that unit its `allocatable` figure cannot see. Always greater than `allocatable` here. */
  unreflectedClaims: number;
};

export type ContentionPairMember = {
  movementId: MovementId;
  claim: ContentionClaim;
};

/**
 * Which open movements are competing for the same unit — pairwise and symmetric, with no ordering
 * between the members of a pair and none between pairs.
 *
 * ⚠️ **IT PAIRS OVER CLAIMS, NEVER OVER THE THREE KINDS THAT EXIST TODAY.** The only property it
 * reads from a claim is `reflectedInAllocatable`. **That is deliberate and it is the reason this
 * function does not mention `kind` at all.** Do not add a `kind` test to it.
 *
 * **RULED 2026-09-04, and the question this shape was left open for is now CLOSED: showing a
 * suggestion holds nothing.** The owner: _"A ward has to manually accept the referral..... no
 * referral can be pulled unless the ward accepts in... then the bed is gone."_ So the ward's
 * acceptance IS the hold, it already exists, and **there is no fourth claim kind coming** — no
 * temporary hold, no expiry, no race between two shown arrangements.
 *
 * The kind-blindness stays anyway, because it costs nothing and it is the correct shape regardless.
 * **This paragraph is kept rather than deleted so the next person to have the idea finds the ruling
 * instead of the empty space where it was.**
 *
 * ⚠️ **IT REPORTS WHO IS COMPETING. IT DOES NOT DECIDE WHO WINS, RANK THE MEMBERS, OR ORDER THE
 * PAIRS.** Building an arrangement depends on an owner decision that has not been made, and the
 * pairwise relation is deliberately shape-independent: any resolver, of any shape, must know who is
 * competing for what before it can arrange anything, so this leans toward none of them.
 *
 * ⚠️ **A DEFINITION THE BRIEF DID NOT SETTLE, CHOSEN AND FLAGGED RATHER THAN ASSUMED.** "Two claims
 * on the same unit" is NOT sufficient to be competing: three movements pulled to a ward with three
 * beds each hold their own, and calling them a contention would be the same overclaiming word this
 * whole audit has been about — `fre-adult-open` is exactly that state in tonight's fixture.
 *
 * **So a pair requires all three:** both claims are UNREFLECTED (a reserved bed is already that
 * patient's — the pulled movement is not competing, it has won), they are on the same unit, and
 * that unit's unreflected claims EXCEED its `allocatable` figure. Under that rule
 * `sjgm-adult-open` — one bed, one pull already reflected, plus a referral and an acceptance that
 * are not — yields exactly one pair, which is the true answer.
 *
 * **Nothing is lost by the narrowing:** the raw "two claims on one unit" relation is already
 * derivable from `contention()`, whose rows carry every claim.
 *
 * ⚠️ **A UNIT WITH ONE UNREFLECTED CLAIM AND NO BEDS PRODUCES NO PAIR, AND THAT IS CORRECT.** It is
 * unsatisfiable rather than contended — one person waiting on a ward with nothing free, competing
 * with nobody. `contention()` already reports it as a negative `uncommittedAllocatable`
 * (`fsh-older-adult` tonight). A reader wanting both facts needs both functions, by design.
 */
export function contentionPairs(movements: Movement[], units: Unit[], now: Instant): ContentionPair[] {
  const pairs: ContentionPair[] = [];

  for (const row of contention(movements, units, now).units) {
    // The only claim property this function reads. Never `kind`.
    const competing = row.claims.filter((claim) => !claim.reflectedInAllocatable);
    /*
     * ⚠️ **THIS READ `competing.length < 2 || …` AND THE FIRST HALF COULD NOT FAIL.** Removing it
     * left all 25 tests green: a unit with nought or one competing claim yields nothing from the
     * loop below whatever the guard says. It was the second piece of inert machinery in this file
     * — the first was a `Map` whose comment claimed it prevented a duplicate — so it is deleted
     * rather than given a test, on the same reasoning. A guard that cannot change an outcome reads
     * as a safeguard and is not one.
     *
     * What remains IS load-bearing: without it, three movements pulled to a ward with three beds
     * would be reported as competing when each already holds their own.
     */
    if (competing.length <= row.allocatable) continue;

    for (let i = 0; i < competing.length; i += 1) {
      for (let j = i + 1; j < competing.length; j += 1) {
        const [first, second] = [competing[i], competing[j]].sort((a, b) =>
          a.movementId.localeCompare(b.movementId),
        ) as [ContentionClaim, ContentionClaim];
        pairs.push({
          unitId: row.unitId,
          members: [
            { movementId: first.movementId, claim: first },
            { movementId: second.movementId, claim: second },
          ],
          allocatable: row.allocatable,
          unreflectedClaims: row.unreflectedClaims,
        });
      }
    }
  }

  return pairs;
}
