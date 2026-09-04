import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import type { Movement, MovementId } from "@/components/ward-management/ward-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { movementById, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allEmergencyDepartments, siteByCode, unitById } from "@/components/ward-management/ward-sites";

/**
 * FOUR SENTENCES THIS PAGE PRINTED ABOUT PATIENTS THAT WERE NOT TRUE, AND WHY NOTHING CAUGHT THEM.
 *
 * On 2026-09-04 a reader went through ten rendered movement pages line by line — 1731 lines of
 * on-screen text — after the redesign, after `tsc`, after 400-odd unit tests and after a cold read
 * of the component. Every one of the following was live on the page at that moment:
 *
 *   WF-300  arrived and handed over, and the facts panel said the patient was in the emergency
 *           department she had left
 *   WF-008  "Bound for FRE Adult Open, North Metro" — Fremantle is South Metro; North Metro is
 *           where she came from
 *   WF-013  "Bound for" a ward chosen arbitrarily from two OPEN referrals, on a page that also
 *           said "Referrals still open · 2" and "No ward has accepted this patient"
 *   WF-009  "This patient's legal status has not changed since the movement opened", beside its
 *           own timeline showing an inpatient order 320 minutes after it opened
 *
 * ⚠️ THE EXISTING DOM TESTS PASS BEFORE AND AFTER EVERY ONE OF THOSE FIXES. 59 of them, over this
 * same component, none discriminating. They assert that things are rendered; none asserts that
 * what is rendered is true of the record beside it. That is the gap this file exists to close, and
 * it is why every assertion here is a property over the WHOLE fixture rather than a sentence
 * pinned to an id — a per-id assertion would go green the moment somebody edited that movement,
 * without anybody deciding it should.
 *
 * ⚠️ EACH PROPERTY CARRIES ITS OWN POPULATION FLOOR, AND THE FLOOR IS THE DENOMINATOR. The thing
 * being counted up is "movements that exercise this branch", which only grows; never "violations
 * found", which this work drives to zero and which would therefore fail exactly when it succeeded.
 * If a branch stops being exercised at all, its floor goes red and says so, because a property
 * nothing exercises is not a passing property.
 */

const MOVEMENTS: Movement[] = wardMovements;

/** Render one movement's page and return its whole visible text, whitespace-collapsed. */
function pageTextFor(id: MovementId): string {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={id} />
    </WardFlowProvider>,
  );
  const text = screen.getByTestId("ward-patient-workspace").textContent ?? "";
  cleanup();
  return text.replace(/\s+/gu, " ");
}

/** The health service that owns a unit's site — the DESTINATION's service, never the origin's. */
function serviceOfUnit(unitId: string): string | undefined {
  const unit = unitById(unitId);
  return unit ? siteByCode(unit.siteCode)?.service : undefined;
}

/** The health service that owns the ED a movement started in. */
function serviceOfOrigin(movement: Movement): string | undefined {
  const ed = allEmergencyDepartments().find((candidate) => candidate.id === movement.originEdId);
  return ed ? siteByCode(ed.siteCode)?.service : undefined;
}

const isOpen = (movement: Movement) => movement.closure === undefined && movement.stage !== "arrived";

describe("the movement page does not print sentences the record contradicts", () => {
  afterEach(cleanup);

  it("walks a fixture large enough for these properties to mean anything", () => {
    // The denominator for everything below. If the fixture is empty or the import broke, every
    // property underneath passes vacuously — this is the only assertion here that can say so.
    expect(MOVEMENTS.length).toBeGreaterThan(30);
    expect(MOVEMENTS.filter(isOpen).length).toBeGreaterThan(5);
    expect(MOVEMENTS.filter((movement) => !isOpen(movement)).length).toBeGreaterThan(3);
  });

  it("never says a movement is bound anywhere until a ward has accepted it", () => {
    /*
     * `destinationUnit` is `acceptedUnitId ?? referredUnitIds[0]` — a fallback that is right for
     * the board and the network, which want a provisional destination to lay out, and wrong here,
     * where "bound for" is the sentence a coordinator reads to decide whether a bed exists. The
     * console carried a comment saying it never falls back; the comment was true of the console
     * and false of the helper it called.
     */
    const unaccepted = MOVEMENTS.filter((movement) => movement.acceptedUnitId === undefined);
    const withOpenReferralsButNoAcceptance = unaccepted.filter((movement) => movement.referredUnitIds.length > 0);

    // POPULATION FLOOR — the exact shape that produced the defect must still be in the fixture,
    // or this assertion is about nothing.
    expect(
      withOpenReferralsButNoAcceptance.length,
      "no movement has open referrals and no acceptance, so the fallback this guards against cannot fire",
    ).toBeGreaterThan(0);

    const offenders = unaccepted
      .map((movement) => ({ id: movement.id, text: pageTextFor(movement.id) }))
      .filter(({ text }) => /Bound for|Was bound for/u.test(text))
      .map(({ id }) => id);

    expect(offenders, `these movements have no accepted ward and the page still says where they are bound`).toEqual([]);
  });

  it("prints the destination's own health service beside the destination, never the origin's", () => {
    /*
     * ⚠️ THIS ONE WAS RIGHT MOST OF THE TIME, WHICH IS WHAT MADE IT SURVIVE. The masthead printed
     * `movementHealthService(movement)` — the ORIGIN ED's service, per that function's own doc
     * comment — immediately after the destination ward's name. It only diverges when origin and
     * destination sit in different services, which is exactly the transfer that matters most.
     */
    const accepted = MOVEMENTS.filter((movement) => movement.acceptedUnitId !== undefined);
    const crossService = accepted.filter((movement) => {
      const destination = serviceOfUnit(movement.acceptedUnitId as string);
      const origin = serviceOfOrigin(movement);
      return destination !== undefined && origin !== undefined && destination !== origin;
    });

    // POPULATION FLOOR — a fixture where origin and destination never differ cannot detect this
    // defect at all, and would report a clean sweep.
    expect(
      crossService.length,
      "no accepted movement crosses a service boundary, so origin-for-destination is undetectable here",
    ).toBeGreaterThan(0);

    const wrong: string[] = [];
    for (const movement of crossService) {
      const destinationUnitName = unitById(movement.acceptedUnitId as string)?.name;
      const destinationService = serviceOfUnit(movement.acceptedUnitId as string);
      const originService = serviceOfOrigin(movement);
      const text = pageTextFor(movement.id);
      if (destinationUnitName === undefined) continue;
      if (text.includes(`${destinationUnitName}, ${originService}`)) {
        wrong.push(`${movement.id}: "${destinationUnitName}, ${originService}" — that is the ORIGIN's service`);
      }
      if (!text.includes(`${destinationUnitName}, ${destinationService}`)) {
        wrong.push(`${movement.id}: never names ${destinationUnitName} with its own service ${destinationService}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("says a legal status is unrecorded, never that it is unchanged", () => {
    /*
     * `statusChanges` being empty supports "no change has been RECORDED". The page said "has not
     * changed", which is a claim about the world. WF-009 refutes it on its own page: an
     * examination with an inpatient-order outcome, and a legal status of "Involuntary inpatient".
     * This is the three-state discipline `transportNeed` already keeps — needed / not needed /
     * not recorded — collapsed to two for legal status.
     */
    const unrecorded = MOVEMENTS.filter((movement) => movement.statusChanges.length === 0);
    expect(
      unrecorded.length,
      "every movement records a status change, so the empty branch never renders",
    ).toBeGreaterThan(0);

    /*
     * 🔴 THE FIRST VERSION OF THIS ASSERTION PINNED THE OLD WORDING, NOT THE PROPERTY. It grepped
     * for "has not changed|and unchanged since", so rephrasing the false claim as "Recorded, and
     * it has stayed the same since this movement opened" would have restored the defect on 49 of
     * 50 pages and left this test GREEN. An adversarial review named that mutation as the one most
     * likely to actually happen, because it is the most natural rephrasing.
     *
     * A positive requirement is what survives a rephrasing: the page must SAY the word that makes
     * the sentence honest. Any rewording that drops "recorded" from the legal-status region loses
     * the distinction between "no change happened" and "no change was written down", which is the
     * whole point of the fix. The negative is kept as a family rather than two literals.
     */
    const claimsStability = /(has not changed|unchanged|stayed the same|no change (has )?occurred|remains? the same)/iu;
    const offenders: string[] = [];
    for (const movement of unrecorded) {
      const text = pageTextFor(movement.id);
      if (claimsStability.test(text)) {
        offenders.push(`${movement.id}: asserts the status did not change, which the record cannot support`);
      }
      if (!/No change to it has been recorded|None recorded since the movement opened/u.test(text)) {
        offenders.push(`${movement.id}: says nothing about the change being UNRECORDED rather than absent`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never reports an absence of information it is displaying three inches away", () => {
    /*
     * `blockerReadinessState` returned early on a closed movement and collapsed five distinct
     * facts into two. WF-007 rendered "Nothing was recorded as holding this up" on the same page
     * as "None — handover complete", which IS a record.
     */
    /*
     * ⚠️ "No blocker" IS THE DEFAULT, NOT A RECORD, and my first version of this assertion flagged
     * four movements carrying it. Saying "nothing was recorded" beside a field reading "No blocker"
     * is not a contradiction — both mean the same absence. The property is about a blocker value
     * that carries INFORMATION: an active one, or one of the "None — ..." sentinels the reducer
     * writes to say WHY nothing is blocking. Narrowed rather than deleted, because the four
     * false-positive movements are exactly the ones that would make this look like a passing sweep
     * if the predicate were loosened the other way.
     */
    const carriesInformation = (movement: Movement) => {
      const blocker = movement.blocker.trim();
      return blocker !== "" && blocker !== "No blocker";
    };
    const closedWithARecordedBlocker = MOVEMENTS.filter(
      (movement) => !isOpen(movement) && carriesInformation(movement),
    );

    /*
     * 🔴 THE FLOOR I FIRST WROTE HERE COUNTED THE WRONG SET, AND AN ADVERSARIAL REVIEW MEASURED IT.
     * `closedWithARecordedBlocker` is 3, so the floor passed — but two of those three carry an
     * ACTIVE blocker and return at the first branch of `blockerReadinessState`, so they can never
     * reach the sentence under test. **Exactly one movement discriminates.** Edit that one and the
     * floor still reads 3 while the property goes untestable, silently — which is the failure this
     * whole file exists to prevent, reproduced inside it.
     *
     * The floor now counts the DISCRIMINATING set: closed movements whose blocker is one of the
     * "None — ..." sentinels, i.e. the ones that reach the guarded fallthrough at all.
     */
    const reachesTheFallthrough = closedWithARecordedBlocker.filter((movement) =>
      movement.blocker.trim().startsWith("None"),
    );
    expect(
      reachesTheFallthrough.length,
      "no closed movement reaches the sentence under test — the property is untestable on this fixture, " +
        `regardless of the ${closedWithARecordedBlocker.length} that merely carry a blocker`,
    ).toBeGreaterThan(0);

    /*
     * 🔴 AND THE ASSERTION PINNED ONE LITERAL. Rewording the fallthrough to "No blocker was
     * recorded before this movement closed." would have restored the defect and left this GREEN.
     * A family, plus a positive requirement that the recorded value is actually stated.
     */
    const claimsNothingRecorded = /(Nothing was recorded as holding|No blocker was recorded|nothing was recorded)/iu;
    const offenders: string[] = [];
    for (const movement of closedWithARecordedBlocker) {
      const text = pageTextFor(movement.id);
      if (claimsNothingRecorded.test(text) && text.includes(movement.blocker.trim())) {
        offenders.push(`${movement.id}: claims nothing was recorded while displaying "${movement.blocker.trim()}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not label a recorded origin department as where the patient is now", () => {
    /*
     * WF-300 is the case: closure "Handover complete at RPH Older Adult", step 7 of 7, and a facts
     * row headed "Where the patient is" rendering `originEd.name` with no arrival branch. The row
     * also contradicted its own panel — "The record's own fields, plainly labelled. Nothing here
     * is derived" — because where a patient IS is derived from the stage, the closure and whether
     * anybody recorded an arrival.
     *
     * The label is what is asserted, not a branch, because the fix was to stop claiming a
     * derivation in a panel that promises none.
     */
    const arrived = MOVEMENTS.filter((movement) => !isOpen(movement));
    expect(arrived.length, "no closed movement in the fixture, so the arrived case never renders").toBeGreaterThan(0);

    /*
     * 🔴 THE FIRST VERSION CHECKED ONLY FOR THE ABSENCE OF THE OLD LABEL. Relabelling the row
     * "Patient location" while still rendering the origin unconditionally would have restored the
     * defect on every closed page and left this GREEN — and so would deleting the row entirely.
     * Both are pinned now: the row must exist, name the origin plainly, and no label on the page
     * may claim to state where the patient IS.
     */
    const claimsPresence = /(Where the patient is|Patient location|Current location|Located at)/u;
    const offenders: string[] = [];
    for (const movement of arrived) {
      const text = pageTextFor(movement.id);
      if (claimsPresence.test(text)) {
        offenders.push(`${movement.id}: a label claims to state where the patient is now`);
      }
      if (!text.includes("Origin department")) {
        offenders.push(`${movement.id}: the origin row is gone — deleting it also removed the false claim`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not call for attention in the present tense on a movement that is over", () => {
    /*
     * A closed movement carrying `flaggedUrgent: true` rendered a red "Flagged urgent" chip — the
     * loudest thing on the page, in the present tense, about a movement nobody can act on. Same
     * class as the "Bound for" and "Current stage" present tenses already repaired here, and it
     * outlived them because the chip is TRUE about the record while being FALSE about the present.
     *
     * 🔴 REACHABILITY IS WHY THIS IS A TEST AND NOT AN ARGUMENT. `FLAG_MOVEMENT_URGENT` refuses a
     * closed movement, and reading that guard alone says the state cannot exist. It says nothing
     * about the other order — flag while open, then close — which nothing refuses, and every
     * closing case builds its result with a spread that carries the flag through. A separate
     * committed probe drives exactly that sequence.
     *
     * ⚠️ THE FIXTURE MAY NOT CONTAIN THE STATE, and this test says so rather than passing quietly:
     * the floor below is on movements that EXERCISE the branch, and it reports zero as a skip with
     * a message, not as a pass. A property nothing exercises is not a passing property — but nor is
     * it a failure of the page, so it must not read as one.
     */
    const closedAndFlagged = MOVEMENTS.filter((movement) => !isOpen(movement) && movement.flaggedUrgent);
    const openAndFlagged = MOVEMENTS.filter((movement) => isOpen(movement) && movement.flaggedUrgent);

    // The positive control: the present-tense chip must still appear where it IS true, or a page
    // that simply never renders the chip at all would satisfy the negative below.
    expect(
      openAndFlagged.length,
      "no open movement is flagged urgent, so this cannot tell a correct suppression from a missing chip",
    ).toBeGreaterThan(0);
    for (const movement of openAndFlagged) {
      expect(pageTextFor(movement.id), `${movement.id} is open and flagged and must say so`).toContain(
        "Flagged urgent",
      );
    }

    const offenders = closedAndFlagged
      .map((movement) => ({ id: movement.id, text: pageTextFor(movement.id) }))
      .filter(({ text }) => /(^|[^s] )Flagged urgent/u.test(text) && !text.includes("Was flagged urgent"))
      .map(({ id }) => id);
    expect(offenders, "these movements are over and the page still calls for attention in the present tense").toEqual(
      [],
    );
  });

  it("quotes back the id that was actually requested, and says what is wrong with it", () => {
    /*
     * `MovementId` is the template literal `` `WF-${string}` ``, so the bare string "WF-" is
     * assignable to it — and the route used exactly that as a sentinel for "not a movement id",
     * which the not-found sentence then quoted. `/movements/PT-004` rendered "No synthetic
     * movement matches “WF-”": an id the user never typed. Well-typed, so `tsc` was silent.
     *
     * ⚠️ WHAT THIS ASSERTION CANNOT SEE, SAID PLAINLY RATHER THAN LEFT TO BE ASSUMED: it renders
     * the COMPONENT, so it proves the component quotes what it is handed. The defect was in the
     * ROUTE — an async server component that chose what to hand it — and nothing here executes
     * that file. A mutation reinstating the sentinel in `[movementId]/page.tsx` would leave this
     * test green. The route is covered only by a production build and by an end-to-end run, and
     * the ward E2E specs are excluded from `verify:ui` twice over, so in practice it is covered by
     * somebody opening the URL. That gap is real and is recorded rather than papered over.
     */
    expect(movementById("WF-999" as MovementId), "WF-999 must not exist for this to test anything").toBeUndefined();

    const text = pageTextFor("WF-999" as MovementId);
    expect(text).toContain("WF-999");
    expect(text).not.toMatch(/matches “WF-”|matches "WF-"/u);
  });
});
