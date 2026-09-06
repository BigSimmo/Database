// tests/ward-movements-derivations.test.ts
//
// The merged Movements screen (MERGE 03) answers "where is each patient in their move, and what is
// carrying them" — `journeyStages` for the first half, `transportLegs`/`transportCounts` for the
// second. Design lock: docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md §5.
//
// Every test here walks the real `wardMovements` fixture unless the behaviour under test has zero
// occurrences in it (an empty stage, an expiring legal authority, a transport job nobody has
// accepted yet) — measured directly against the fixture on 2026-09-05, not assumed. Those three
// cases use a small, explicitly-labelled synthetic movement built from a real one via
// `structuredClone`, never a hand-typed literal that could drift from the real `Movement` shape.
import { describe, expect, it } from "vitest";

import {
  journeyStages,
  transportCounts,
  transportLegs,
  type MovementLegState,
  reconciliationSentence,
  totalsReconciliation,
} from "@/components/ward-management/movements/movements-derivations";
import { isOpen, transportLeg } from "@/components/ward-management/ward-derivations";
import {
  MOVEMENT_STAGES,
  TRANSPORT_PROVIDERS,
  type Movement,
  type MovementId,
} from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** A safe, independent copy of a real fixture movement — never a mutation of the shared
 *  `wardMovements` array, which every other test in this suite (and every other suite importing
 *  the same module) also reads. */
function cloneMovement(id: string): Movement {
  const found = wardMovements.find((movement) => movement.id === id);
  if (!found) throw new Error(`Fixture no longer carries ${id} — this test's setup needs updating.`);
  return structuredClone(found);
}

describe("journeyStages", () => {
  it("walks a non-empty population of movements across more than one stage, or every assertion below is vacuous", () => {
    expect(wardMovements.length, "the fixture is empty").toBeGreaterThan(0);
    const stagesUsed = new Set(wardMovements.map((movement) => movement.stage));
    expect(stagesUsed.size, "every movement sits at the same stage").toBeGreaterThan(1);
  });

  it("returns exactly one entry per MOVEMENT_STAGES member, in that order, each id appearing once", () => {
    const stages = journeyStages(wardMovements, NOW);
    expect(stages.map((stage) => stage.id)).toEqual(MOVEMENT_STAGES);
    expect(new Set(stages.map((stage) => stage.id)).size).toBe(MOVEMENT_STAGES.length);
  });

  it("counts every movement exactly once across the stages, so a heading count is people, never a double count", () => {
    const stages = journeyStages(wardMovements, NOW);
    const total = stages.reduce((sum, stage) => sum + stage.movements.length, 0);
    expect(total).toBe(wardMovements.length);
    for (const stage of stages) {
      const expected = wardMovements.filter((movement) => movement.stage === stage.id).length;
      expect(stage.movements.length, stage.id).toBe(expected);
    }
  });

  it("keeps an empty stage group rather than dropping it (design lock §5.2: absence is stated, never blank)", () => {
    const handoverReady = wardMovements.filter((movement) => movement.stage === "handover_ready");
    expect(
      handoverReady.length,
      "the fixture has no handover_ready movement to remove — this test would not prove the stage is ever actually empty",
    ).toBeGreaterThan(0);

    const withoutHandoverReady = wardMovements.filter((movement) => movement.stage !== "handover_ready");
    const stages = journeyStages(withoutHandoverReady, NOW);
    const group = stages.find((stage) => stage.id === "handover_ready");
    expect(group, "handover_ready is missing from the output entirely, not merely empty").toBeDefined();
    expect(group?.movements).toEqual([]);
    // Every other stage is untouched by removing only handover_ready movements.
    expect(stages.reduce((sum, stage) => sum + stage.movements.length, 0)).toBe(withoutHandoverReady.length);
  });

  it("sorts a stage longest-waiting first when nothing in it has an expiring legal authority", () => {
    // placement_requested carries no movement whose legalForm.dueAt reads "breached"/"critical" at
    // NOW_ANCHOR (measured directly: the only dueAt-bearing movements in this fixture, WF-004,
    // WF-006, WF-011, WF-014, are all "clear" or "due", and none is at placement_requested), so
    // this stage's order isolates the wait-only rule from the legal-authority exception.
    const stage = journeyStages(wardMovements, NOW).find((entry) => entry.id === "placement_requested");
    expect(stage?.movements.length, "no placement_requested movement in the fixture").toBeGreaterThan(1);
    const openedAts = stage!.movements.map((movement) => movement.openedAt);
    for (let i = 1; i < openedAts.length; i += 1) {
      expect(openedAts[i], `position ${i}`).toBeGreaterThanOrEqual(openedAts[i - 1]);
    }
  });

  it("puts an expiring legal authority ahead of a much longer wait (design lock §5.4)", () => {
    // WF-311 (pulled, openedAt -125) is the longest-waiting real movement in the "pulled" stage and
    // carries no legal form at all. The synthetic movement below clones WF-004 (a real "pulled"
    // movement that DOES carry a legalForm), overrides its dueAt to 30 minutes out — clockState
    // reads that as "critical" at NOW_ANCHOR — and gives it an openedAt far more recent than
    // WF-311's, so a plain wait-order sort would rank it last. Design lock §5.4 says it must rank
    // first anyway.
    const longestWaitNoUrgency = cloneMovement("WF-311");
    expect(longestWaitNoUrgency.legalForm?.dueAt, "WF-311 unexpectedly carries a legal deadline now").toBeUndefined();

    const urgent = cloneMovement("WF-004");
    urgent.id = "WF-004-SYNTH-CRITICAL";
    urgent.legalForm = { ...urgent.legalForm, code: urgent.legalForm?.code ?? "4C", dueAt: NOW + 30 };
    urgent.openedAt = NOW - 5;
    urgent.stage = "pulled";

    const others = wardMovements.filter((movement) => movement.stage === "pulled" && movement.id !== "WF-004");
    const stage = journeyStages([...others, urgent], NOW).find((entry) => entry.id === "pulled");
    expect(stage?.movements[0]?.id).toBe(urgent.id);
    // And WF-311, the real longest wait, is still second — the urgency exception does not disturb
    // the ordering of everyone it does not apply to.
    expect(stage?.movements[1]?.id).toBe("WF-311");
  });
});

describe("transportLegs", () => {
  // Measured directly against `wardMovements` on 2026-09-05, and RE-MEASURED against the
  // five-state union on the same date: every transport job in the fixture — hand-authored and
  // generated alike — already carries `acceptedAt`, so these three buckets are the true, complete
  // partition of the 14 movements that carry a transport record.
  //
  // ⚠️ THE SIX IDS BELOW WERE THE FOUR-STATE SHAPE'S `en_route` BUCKET AND ARE ALL `"Collected"`.
  // Under the collapse to `transportLeg`'s union (Ward Lead, 2026-09-05) the old `en_route` label
  // was covering two different facts — a vehicle on its way to the patient, and a vehicle already
  // carrying them — and every one of these six is the second. So `"En route"` is empty in this
  // fixture, the same way `"Cancelled"` is. Both are nonetheless states the reducer genuinely
  // produces (`TRANSPORT_EN_ROUTE` sets `enRouteAt` and leaves `collectedAt` unset;
  // `CANCEL_TRANSPORT` needs no prior acceptance), so each is proved separately with a synthetic
  // job below rather than left untested — an empty bucket nothing can ever fill would belong out
  // of the union altogether, which is exactly why `"Requested"` is not in it.
  const EXPECTED_ACCEPTED_IDS: MovementId[] = ["WF-005", "WF-015"];
  const EXPECTED_COLLECTED_IDS: MovementId[] = ["WF-006", "WF-014", "WF-306", "WF-313", "WF-320", "WF-327"];
  const EXPECTED_ARRIVED_IDS: MovementId[] = ["WF-007", "WF-300", "WF-307", "WF-314", "WF-321", "WF-328"];

  it("walks a non-empty population of movements carrying an accepted transport job, or every assertion below is vacuous", () => {
    const withTransport = wardMovements.filter((movement) => movement.transport !== undefined);
    expect(withTransport.length, "no movement in the fixture carries a transport job").toBeGreaterThan(0);
    expect(EXPECTED_ACCEPTED_IDS.length + EXPECTED_COLLECTED_IDS.length + EXPECTED_ARRIVED_IDS.length).toBe(
      withTransport.length,
    );
  });

  it("returns exactly one leg per movement whose transport job has actually been accepted", () => {
    const legs = transportLegs(wardMovements, NOW);
    const expectedIds = [...EXPECTED_ACCEPTED_IDS, ...EXPECTED_COLLECTED_IDS, ...EXPECTED_ARRIVED_IDS].sort();
    expect(legs.map((leg) => leg.movement.id).sort()).toEqual(expectedIds);
  });

  it("carries transportLeg's own leg name onto every row, matching a hand-checked bucketing", () => {
    const legs = transportLegs(wardMovements, NOW);
    const byId = new Map(legs.map((leg) => [leg.movement.id, leg]));
    for (const id of EXPECTED_ACCEPTED_IDS) expect(byId.get(id)?.state, id).toBe("Accepted");
    for (const id of EXPECTED_COLLECTED_IDS) expect(byId.get(id)?.state, id).toBe("Collected");
    for (const id of EXPECTED_ARRIVED_IDS) expect(byId.get(id)?.state, id).toBe("Arrived");
  });

  /**
   * ⚠️ NOT A RESTATEMENT OF THE BUCKETING ABOVE. That test would still pass if this module went
   * back to deciding the leg for itself and happened to agree on today's fixture — which is what it
   * used to do, and the agreement is why nobody noticed. This one asserts the two are the SAME
   * DECISION, by walking every row and comparing against `transportLeg` directly, so a
   * re-introduced private precedence chain fails here the moment the two differ on any input,
   * including one added to the fixture later.
   */
  it("never decides a leg for itself — every row's state is transportLeg's own answer for that job", () => {
    const legs = transportLegs(wardMovements, NOW);
    expect(legs.length, "no legs to compare — this check would be vacuous").toBeGreaterThan(0);
    for (const leg of legs) {
      expect(leg.state, leg.movement.id).toBe(transportLeg(leg.movement.transport));
    }
  });

  /**
   * ⚠️ THE ONE CASE WHERE `transportLegs`'s TWO EXCLUSION TESTS DISAGREE, and the reducer can
   * reach it: `BOOK_TRANSPORT` writes no timestamps, and `CANCEL_TRANSPORT` refuses only a closed
   * movement, an already-cancelled job, an arrived one and a collected one — never an unaccepted
   * one. So a job cancelled before anybody accepted it carries `cancelledAt` and no `acceptedAt`,
   * and `transportLeg` calls it `"Cancelled"`, not `"Requested"`. Only the `bookedAt` check keeps
   * it out, and there is still no honest instant to put in `bookedAt` for it.
   */
  it("excludes a job cancelled before anyone accepted it, which the Requested check alone would admit", () => {
    const cancelledUnaccepted = cloneMovement("WF-005");
    cancelledUnaccepted.id = "WF-005-SYNTH-CANCELLED-UNACCEPTED";
    cancelledUnaccepted.transport = {
      id: "TR-SYNTH-3",
      provider: "Ward escort",
      escortRequired: false,
      cancelledAt: NOW - 5,
    };

    // The premise: this really is the divergent shape, not a job the "Requested" check would catch.
    expect(transportLeg(cancelledUnaccepted.transport)).toBe("Cancelled");
    expect(cancelledUnaccepted.transport.acceptedAt).toBeUndefined();

    expect(transportLegs([cancelledUnaccepted], NOW)).toEqual([]);
  });

  it("sets bookedAt to the job's own acceptedAt, and minutesSinceBooked to now minus that, on every leg", () => {
    const legs = transportLegs(wardMovements, NOW);
    for (const leg of legs) {
      const acceptedAt = leg.movement.transport?.acceptedAt;
      expect(acceptedAt, leg.movement.id).toBeDefined();
      expect(leg.bookedAt, leg.movement.id).toBe(acceptedAt);
      expect(leg.minutesSinceBooked, leg.movement.id).toBe(NOW - (acceptedAt as number));
    }
  });

  it("carries the job's own provider onto the leg, unchanged", () => {
    const legs = transportLegs(wardMovements, NOW);
    for (const leg of legs) {
      expect(leg.provider, leg.movement.id).toBe(leg.movement.transport?.provider);
      expect(TRANSPORT_PROVIDERS, leg.movement.id).toContain(leg.provider);
    }
  });

  it("excludes a transport job nobody has accepted yet, rather than fabricating a bookedAt for it", () => {
    // `BOOK_TRANSPORT` (ward-flow-reducer.ts) can create exactly this shape — a job with no
    // timestamp at all — per tracker-derivations.ts's own comment. The fixture never carries one
    // today, so this is a synthetic clone rather than a real-population assertion.
    const requestedOnly = cloneMovement("WF-005");
    requestedOnly.id = "WF-005-SYNTH-REQUESTED";
    requestedOnly.transport = { id: "TR-SYNTH-1", provider: "Ward escort", escortRequired: false };

    const legs = transportLegs([requestedOnly], NOW);
    expect(legs).toEqual([]);

    // And it does not suppress its neighbours when mixed in with real, accepted jobs.
    const mixed = transportLegs([requestedOnly, ...wardMovements], NOW);
    expect(mixed.some((leg) => leg.movement.id === requestedOnly.id)).toBe(false);
    expect(mixed.length).toBe(transportLegs(wardMovements, NOW).length);
  });

  it("puts an expiring legal authority ahead of a much longer time since booking (design lock §5.4)", () => {
    // WF-005 (handover_ready) was accepted at 612, WF-015 (handover_ready) at 627 — WF-005 has
    // therefore been booked longer and a plain wait sort ranks it first. `urgent` clones WF-015
    // (the later, shorter-waiting booking) and gives it a critical legal deadline; design lock
    // §5.4 says it must outrank WF-005's longer wait anyway.
    const longAgoBooked = cloneMovement("WF-005"); // acceptedAt 612 — the longer-waiting real booking
    const urgent = cloneMovement("WF-015"); // acceptedAt 627 — shorter wait, made critical below
    urgent.id = "WF-015-SYNTH-CRITICAL";
    urgent.legalForm = { code: "4C", dueAt: NOW + 30 };

    const legs = transportLegs([longAgoBooked, urgent], NOW);
    expect(legs.map((leg) => leg.movement.id)).toEqual([urgent.id, longAgoBooked.id]);
  });
});

describe("transportCounts", () => {
  it("tallies exactly the legs it is given, with every producible state present even at zero", () => {
    const legs = transportLegs(wardMovements, NOW);
    const counts = transportCounts(legs);
    expect(Object.keys(counts).sort()).toEqual(["Accepted", "Arrived", "Cancelled", "Collected", "En route"]);
    expect(counts.Accepted + counts["En route"] + counts.Collected + counts.Arrived + counts.Cancelled).toBe(
      legs.length,
    );
  });

  /**
   * ⚠️ AN ABSENCE, ASSERTED, because it is the half of the collapse nothing else can fail on.
   * `transportLegs` drops every job with no `acceptedAt`, so `"Requested"` has no producer here —
   * and `WardBar` reads every segment INCLUDING its zeroes into the bar's accessible name, so a
   * `Requested` key would be spoken to a screen-reader user as a category this module can never
   * fill. `MovementLegState` excludes it with `Exclude`; put it back and this goes red.
   */
  it("has no Requested bucket, because no row on this screen can ever be in it", () => {
    const counts = transportCounts(transportLegs(wardMovements, NOW));
    expect(Object.keys(counts)).not.toContain("Requested");
  });

  it("matches an independent count of each state, and En route and Cancelled are honestly zero here", () => {
    const legs = transportLegs(wardMovements, NOW);
    const independent: Record<MovementLegState, number> = {
      Accepted: 0,
      "En route": 0,
      Collected: 0,
      Arrived: 0,
      Cancelled: 0,
    };
    for (const leg of legs) independent[leg.state] += 1;
    expect(transportCounts(legs)).toEqual(independent);
    expect(independent.Cancelled).toBe(0);
    expect(independent["En route"]).toBe(0);
  });

  /**
   * The other half of the honest-zero claim above: `"En route"` is empty in this fixture but is a
   * state the reducer genuinely produces — `TRANSPORT_EN_ROUTE` sets `enRouteAt` and leaves
   * `collectedAt` unset, which is the mandatory step before `PATIENT_COLLECTED`. Proved the same
   * way `"Cancelled"` already was, so neither empty bucket rests on nobody having checked.
   */
  it("counts an En route leg when one exists, rather than a bucket the module can never populate", () => {
    const enRoute = cloneMovement("WF-005");
    enRoute.id = "WF-005-SYNTH-EN-ROUTE";
    enRoute.transport = {
      id: "TR-SYNTH-4",
      provider: "Ambulance service",
      escortRequired: false,
      acceptedAt: NOW - 30,
      enRouteAt: NOW - 10,
    };
    const legs = transportLegs([enRoute], NOW);
    expect(legs).toHaveLength(1);
    expect(legs[0].state).toBe("En route");
    expect(transportCounts(legs)["En route"]).toBe(1);
  });

  it("counts a cancelled leg when one exists, rather than a bucket the module can never populate", () => {
    const cancelled = cloneMovement("WF-005");
    cancelled.id = "WF-005-SYNTH-CANCELLED";
    cancelled.transport = {
      id: "TR-SYNTH-2",
      provider: "Ambulance service",
      escortRequired: false,
      acceptedAt: NOW - 20,
      cancelledAt: NOW - 5,
    };
    const legs = transportLegs([cancelled], NOW);
    expect(legs).toHaveLength(1);
    expect(legs[0].state).toBe("Cancelled");
    expect(transportCounts(legs).Cancelled).toBe(1);
  });

  it("never recomputes from a movements list independently — it only reads the legs handed to it", () => {
    const legs = transportLegs(wardMovements, NOW);
    const totalBefore = Object.values(transportCounts(legs)).reduce((sum, count) => sum + count, 0);
    expect(totalBefore).toBe(legs.length);
    // A shorter, hand-picked slice must produce a proportionally smaller total, never the full-list
    // total — proving `transportCounts` has no hidden access to `wardMovements` of its own.
    const slice = legs.slice(0, 3);
    expect(slice.length, "fewer than 3 legs in the fixture — pick a smaller slice").toBeGreaterThan(0);
    const totalAfter = Object.values(transportCounts(slice)).reduce((sum, count) => sum + count, 0);
    expect(totalAfter).toBe(slice.length);
  });
});

/*
 * 🔴 **THE SENTENCE EXPLAINING WHY TWO TOTALS DIFFER MUST AGREE WITH THE TOTALS. Asserted against
 * the MODEL, not against a remembered string.**
 *
 * The board reads "50 moves in all, 43 still open — 6 have arrived and 1 did not proceed." Every
 * figure in it is computed, which is the whole point: a hand-written version would be true today
 * and become a false statement the first time the seed changed, with nothing to notice.
 *
 * ⚠️ **SO WHAT IS CHECKED IS ARITHMETIC OVER THE FIXTURE, NEVER THE WORDING.** A rewrite of the
 * sentence must not turn these red — the owner may reword it at any time — so each assertion pulls
 * its numbers out of the rendered string and compares them with the array the totals come from.
 * The population is floored, because a fixture where the totals already agreed would make every
 * check below vacuous by returning undefined.
 */
describe("the movements totals reconciliation", () => {
  const all = wardMovements;
  const open = all.filter(isOpen);
  const arrived = all.filter((movement) => movement.stage === "arrived");
  const abandoned = all.filter((movement) => movement.closure && movement.stage !== "arrived");

  it("has a difference to explain at all, or every check below is vacuous", () => {
    expect(
      all.length,
      "every movement in the fixture is open, so totalsReconciliation returns undefined and nothing " +
        "below discriminates. Re-seed or retire these checks — do not leave them passing.",
    ).not.toBe(open.length);
    expect(arrived.length + abandoned.length, "the two sides do not balance in the fixture itself").toBe(
      all.length - open.length,
    );
  });

  it("reconciles the two totals against the model, figure by figure", () => {
    const sentence = totalsReconciliation(all);
    expect(sentence, "no reconciliation sentence was produced for a fixture that needs one").toBeTruthy();

    const numbers = (sentence ?? "").match(/\d+/gu)?.map(Number) ?? [];
    expect(
      numbers,
      `the sentence carries ${numbers.length} figures; it should carry the total, the open count, and one ` +
        "per explained group",
    ).toHaveLength(4);

    const [total, stillOpen, arrivedShown, abandonedShown] = numbers;
    expect(total, "the stated total disagrees with the number of movements").toBe(all.length);
    expect(stillOpen, "the stated open count disagrees with isOpen over the fixture").toBe(open.length);
    expect(arrivedShown, "the stated arrived count disagrees with the model").toBe(arrived.length);
    expect(abandonedShown, "the stated did-not-proceed count disagrees with the model").toBe(abandoned.length);

    /*
     * And the identity, which is the claim the sentence actually makes: the explained groups must
     * account for the whole difference. This is the assertion that would catch a closed movement at
     * a stage the function does not enumerate — counted in the total, missing from the explanation.
     */
    expect(
      arrivedShown + abandonedShown,
      "the explained groups do not account for the difference between the two totals, so the sentence " +
        "explains less than it appears to",
    ).toBe(total - stillOpen);
  });

  it("says nothing when the totals already agree, rather than explaining a zero", () => {
    expect(totalsReconciliation(open as typeof all)).toBeUndefined();
  });

  it("TRACKS a changed population, so a figure hardcoded to today's value cannot pass", () => {
    /*
     * 🔴 **THE GAP THIS CLOSES, FOUND BY MUTATION AND NOT BY REVIEW.** The checks above compare the
     * sentence with the model, and a figure HARDCODED to the model's current value agrees with it —
     * so replacing `${abandoned.length}` with a literal `1` left them all GREEN. The guard could
     * not tell a derivation from a coincidence, because today they produce the same string.
     *
     * **A derivation is only a derivation if it MOVES.** So this calls the function on a different
     * population — one arrived movement removed — and requires the figures to follow. A literal
     * cannot follow, and neither can a stale cache.
     */
    const oneFewerArrived = all.filter((movement, index) => index !== all.findIndex((m) => m.stage === "arrived"));
    expect(
      oneFewerArrived.length,
      "the reduced population is the same size as the original, so this check cannot discriminate",
    ).toBe(all.length - 1);

    const reduced = totalsReconciliation(oneFewerArrived);
    const reducedNumbers = (reduced ?? "").match(/\d+/gu)?.map(Number) ?? [];
    expect(reduced, "no sentence was produced for the reduced population").toBeTruthy();

    expect(reducedNumbers[0], "the total did not follow the population").toBe(all.length - 1);
    expect(reducedNumbers[2], "the arrived figure did not follow the population — it may be a literal").toBe(
      arrived.length - 1,
    );

    /*
     * ⚠️ **AND THE SAME TEST FOR THE OTHER CLAUSE, because my first version of this check only moved
     * the ARRIVED population and the hardcode I was hunting was on the ABANDONED one — so it stayed
     * green through two attempts.** Each clause needs its own moving population; a tracking check
     * that moves one figure proves nothing about the others.
     *
     * Removing the only abandoned movement must make the clause DISAPPEAR, not read zero and not
     * read a stale one. A literal `1 did not proceed` survives every other assertion here and fails
     * this one.
     */
    const noneAbandoned = all.filter((movement) => !(movement.closure && movement.stage !== "arrived"));
    expect(
      noneAbandoned.length,
      "the fixture has no abandoned movement to remove, so this check cannot discriminate",
    ).toBe(all.length - abandoned.length);

    const withoutAbandoned = totalsReconciliation(noneAbandoned) ?? "";
    expect(
      withoutAbandoned,
      "with no abandoned movement in the population the sentence still claims one did not proceed. " +
        "That figure is not being derived — it is a literal, or a stale value.",
    ).not.toMatch(/did not proceed/u);

    /*
     * ⚠️ **AND REMOVING THE CLAUSE'S POPULATION IS STILL NOT ENOUGH — THIS IS THE FOURTH VERSION OF
     * THIS CHECK AND THE FIRST THAT BITES.** The literal I was hunting sits behind
     * `if (abandoned.length > 0)`, so a population with NONE hides it rather than exposing it: the
     * clause simply is not pushed, and a check for its absence passes on the literal too.
     *
     * **A tracking check has to move the operand UPWARDS as well as to zero.** The fixture holds
     * exactly one abandoned movement, so the population is synthesised with two — and a literal `1`
     * cannot say "2".
     *
     * The general lesson, which cost three attempts: **each figure needs its own population moved,
     * in a direction where a literal must be wrong.** Zero is not that direction when the clause is
     * conditional on being non-zero.
     */
    const abandonedOne = abandoned[0];
    expect(abandonedOne, "the fixture has no abandoned movement to duplicate").toBeDefined();
    // Annotated rather than bare: a template literal expression widens to `string`, which loses
    // the `WF-${string}` brand `MovementId` carries, so the array stops being `Movement[]`. The
    // annotation is what makes the template contextually typed. tsc caught this; the suite could
    // not — vitest runs no typecheck, so the file was green with the error in it.
    const duplicateId: MovementId = `${abandonedOne!.id}-DUPLICATE`;
    const twoAbandoned = [...all, { ...abandonedOne!, id: duplicateId }];

    const withTwo = totalsReconciliation(twoAbandoned) ?? "";
    const twoMatch = /(\d+) did not proceed/u.exec(withTwo);
    expect(twoMatch, "no did-not-proceed clause with a figure was produced").not.toBeNull();
    expect(
      Number(twoMatch![1]),
      "with two abandoned movements in the population the sentence still says a different number. " +
        "That figure is a literal, not a derivation — and every other assertion here passes on it.",
    ).toBe(abandoned.length + 1);
  });
});

/*
 * 🔴 **THE IMBALANCE BRANCH, NOW REACHABLE — AND IT WAS UNREACHABLE WHEN I ADDED IT.**
 *
 * Ward Builder Two proved the three sets partition the movement space exactly (all 14 stage x
 * closure combinations land in exactly one), so `accounted` was `total - open` by construction and
 * the comparison compared a quantity with itself. **No test over real `Movement` data could ever
 * have reached it** — a safeguard indistinguishable from one that does not work, and one a refactor
 * would have deleted unmissed.
 *
 * ⚠️ **AND WHAT IT DEFENDS AGAINST IS NOT WHAT MY COMMENT SAID.** Not a new stage — `abandoned`
 * enumerates no stages and catches every non-arrived one that will ever exist. It defends against a
 * future narrowing of `isOpen`, which would grow `total - open` past `arrived + abandoned`.
 *
 * Splitting the arithmetic out is what makes that testable without injected predicates.
 */
describe("the reconciliation sentence's imbalance branch", () => {
  it("states the sum plainly when the parts DO account for the difference", () => {
    expect(
      reconciliationSentence({ total: 50, open: 43, accounted: 7, parts: ["6 have arrived", "1 did not proceed"] }),
    ).toBe("50 moves in all, 43 still open — 6 have arrived and 1 did not proceed.");
  });

  it("refuses to print a sum that does not balance, and says how far short it is", () => {
    /*
     * The shape a narrowed `isOpen` would produce: fewer open movements than the explained groups
     * account for. Without this branch the sentence would still read as a complete explanation.
     */
    const sentence = reconciliationSentence({
      total: 50,
      open: 40,
      accounted: 7,
      parts: ["6 have arrived", "1 did not proceed"],
    });
    expect(sentence).toContain("not fully accounted for");
    expect(sentence, "the sentence must say how much it failed to explain, not merely that it did").toContain(
      "7 of 10 explained",
    );
    expect(sentence, "a sentence that cannot account for the difference must not also assert the parts").not.toContain(
      "6 have arrived and",
    );
  });
});
