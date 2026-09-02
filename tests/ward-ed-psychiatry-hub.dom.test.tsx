import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as the sibling dom suites (ward-ed-screen.dom.test.tsx, ward-screen.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen, edReferralClockLines } from "@/components/ward-management/ed/ed-screen";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  COHORTS,
  HOME_REGIONS,
  REFERRAL_PURPOSES,
  REFERRAL_SOURCES,
  SEXES,
  URGENCY_LEVELS,
  type Referral,
  type ReferralPurpose,
} from "@/components/ward-management/ward-model";
import { referrals as seededReferrals } from "@/components/ward-management/ward-movements";
import {
  DECLINE_REASON_LABELS,
  edAnsweredReferralsFor,
  edReferralsFor,
  referralClocks,
} from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * THE ED PSYCHIATRY HUB — the inbox, the outbox, and the producer that makes an ED destination
 * possible at all.
 *
 * ## Why this file exists rather than more assertions in `ward-referral-ed-destination.test.ts`
 *
 * ⚠️ **That file hand-builds its destinations with a local helper, so it proves the TYPE is
 * expressive and nothing whatever about the system.** It was green on a branch where no fixture and
 * no code path in `src/` could construct an emergency-department destination — the arm existed, and
 * the application could not produce one. Reading the fixtures said so; `npm run typecheck` said so
 * too, in three errors, the moment the arm gained `edId` and `purpose`.
 *
 * **So every assertion here runs against something the APPLICATION built:** either a referral that
 * came out of `wardFlowReducer` through its own `RECEIVE_REFERRAL` write path, or one raised by
 * driving the real intake form's real controls. Nothing below asserts about an object literal.
 *
 * ## The three flows, and which of them has a producer today
 *
 * `REFERRAL_PURPOSES` has three members and the spec fixes each to a referrer:
 *
 *   community → ED           `bed`                  ← the intake form, every source it offers
 *   ED psychiatry → itself   `psychiatric_review`    ← `FD-16`'s self-addressed inbox
 *   ward → ED                `medical_assessment`
 *
 * **Only the first has a producer in `src/` today**, and that is a reported gap rather than
 * something this suite papers over: `RECEIVE_REFERRAL` is the one event that creates a `Referral`
 * and its `EVENT_ROLE` entry is `["community"]`, so neither ED psychiatry nor a ward can raise one.
 * The selector tests below therefore drive the reducer directly — which is still the application's
 * own write path, with real ids and real addressing states — and the DOM tests drive the form.
 */

/** Reads the live referral list back out of the provider, so a DOM test can assert what actually
 *  reached the reducer instead of what the form appeared to do. */
function ReferralProbe() {
  const { referrals } = useWardFlow();
  const last = referrals.at(-1);
  const ed = last?.destinations.find((addressing) => addressing.destination.kind === "emergency_department");
  const destination = ed?.destination.kind === "emergency_department" ? ed.destination : undefined;
  return (
    <p data-testid="referral-probe">
      {referrals.length}|{last?.id ?? "none"}|{destination?.edId ?? "no-edId"}|{destination?.purpose ?? "no-purpose"}
    </p>
  );
}

/**
 * ⚠️ `id` is the LAST referral in state, which is a seeded one until something is raised — the seed
 * ships eight. So "nothing was sent" is `count`, never `id === "none"`: an assertion written the
 * second way reads `RF-008` and fails while the form behaved correctly, which is how this helper
 * was written the first time.
 */
function probeParts(): { count: number; id: string; edId: string; purpose: string } {
  const [count, id, edId, purpose] = screen.getByTestId("referral-probe").textContent!.split("|");
  return { count: Number(count), id, edId, purpose };
}

/** How many referrals a freshly seeded state already holds — read from the fixture, never written
 *  out, so growing the seed does not silently turn "one was raised" into a wrong number here. */
const SEEDED_REFERRALS = seededReferrals.length;

/**
 * The one department with a seeded psychiatry inbox, and the one referral in it.
 *
 * ⚠️ **NAMED ONCE, SO THE CANARY AND THE RENDERING TEST CANNOT DRIFT APART.** They are two halves of
 * one claim — "this row is in the seed" and "this row is on the screen" — and a rendering test
 * pointed at a department the canary is not watching would go green on an empty hub the moment the
 * fixture moved, which is the failure the canary exists to catch.
 */
const HUB_WITH_A_SEEDED_INBOX = "rph-ed";
const REFERRAL_ON_THE_HUB = "RF-009";

/**
 * The intake form and one department's hub inside ONE provider, so a referral raised on the form is
 * the very referral the hub is then asked about. Two providers would be two reducers, and the hub
 * would be reading a state the form never wrote to — a test that passes by never connecting.
 */
function renderIntakeAndHub(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
      <EdScreen edId={edId} />
      <ReferralProbe />
    </WardFlowProvider>,
  );
}

function renderHub(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={edId} />
    </WardFlowProvider>,
  );
}

/**
 * ⚠️ **A HARNESS STANDING IN FOR A PRODUCER THAT DOES NOT EXIST YET, AND LABELLED AS ONE.**
 *
 * `FD-16`'s self-addressed referral is raised by ED psychiatry, and no screen can raise one today:
 * `RECEIVE_REFERRAL` is the only event that creates a `Referral` and its `EVENT_ROLE` entry is
 * `["community"]`, so neither ED psychiatry nor a ward is permitted to. That is a reported gap.
 *
 * This button substitutes the missing CONTROL and nothing else — it goes through the provider's own
 * `dispatch`, the real reducer, and the real role check, so the referral the hub then renders is a
 * referral the live system produced. **What it must never be read as** is evidence that the inbox
 * can be filled through the product: it cannot, and the tests that use it say so.
 */
function RaiseSelfAddressedReferral({ edId }: { edId: string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="harness-raise-review"
      onClick={() =>
        dispatch({
          type: "RECEIVE_REFERRAL",
          // The role the event permits. ED psychiatry is NOT permitted to raise this, which is
          // exactly the gap this harness exists because of.
          role: "community",
          now,
          ageBand: "Adult",
          destinations: [{ kind: "emergency_department", edId, purpose: "psychiatric_review" }],
          homeRegion: "Perth Metropolitan",
          suburb: { kind: "named", name: "Armadale" },
          source: "community",
          urgency: 2,
          originSiteCode: "RPH",
          transportNeeded: false,
        })
      }
    >
      raise
    </button>
  );
}

function renderHubWithHarness(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={edId} />
      <RaiseSelfAddressedReferral edId={edId} />
      <ReferralProbe />
    </WardFlowProvider>,
  );
}

/**
 * Reads the ED addressing of the LAST referral straight back out of the provider — its state, who
 * decided, and the reason recorded — so a decline test asserts what actually reached the reducer
 * rather than what the screen appeared to do.
 *
 * ⚠️ **`decidedBy` IS THE WHOLE POINT OF THE CHANGE AND SO IT IS READ, NOT INFERRED.** A decline
 * dispatched as `"ward"` or `"coordinator"` would also compile, would also flip the state to
 * `declined`, and would write another team's name onto a decision ED psychiatry made. A test
 * asserting only the state would pass on exactly that defect.
 */
function DeclineProbe() {
  const { referrals, rejections } = useWardFlow();
  const last = referrals.at(-1);
  const ed = last?.destinations.find((addressing) => addressing.destination.kind === "emergency_department");
  return (
    <p data-testid="decline-probe">
      {ed?.state ?? "no-addressing"}|{ed?.decidedBy ?? "no-decidedBy"}|{ed?.declineReason ?? "no-reason"}|
      {rejections.length}
    </p>
  );
}

function declineParts(): { state: string; decidedBy: string; reason: string; rejections: number } {
  const [state, decidedBy, reason, rejections] = screen.getByTestId("decline-probe").textContent!.split("|");
  return { state, decidedBy, reason, rejections: Number(rejections) };
}

/**
 * ⚠️ **A HARNESS STANDING IN FOR A DISPATCHER THAT CANNOT BE REFUSED TODAY, AND LABELLED AS ONE.**
 *
 * No path from the ED hub can currently produce a `DECLINE_REFERRAL` rejection — `ed-screen.tsx`'s
 * own `declineRejection` comment lists the reducer's six refusal branches and why each is closed
 * from that screen. So the refusal surface has no live producer, and without one the row SCOPING
 * could be weakened to `declineRejection !== undefined` with nothing going red.
 *
 * This button supplies the missing producer and nothing else. The refusal it provokes is entirely
 * real: it dispatches as `"ed"` against a `psychiatric_ward` destination, which the reducer's
 * `answerableBy` map refuses outright, so the `Rejection` is the reducer's own with the reducer's
 * own wording. It is aimed at the WARD arm deliberately — the ED arm is left `queued`, so the row
 * stays on screen for the refusal to be rendered against.
 *
 * **What it must never be read as** is evidence that a clinician can reach this state today.
 */
function RefuseDeclineHarness({ edId }: { edId: string }) {
  const { referrals, dispatch, now } = useWardFlow();
  return (
    <>
      {edReferralsFor(referrals, edId, "psychiatric_review").map(({ referral }) => (
        <button
          key={referral.id}
          type="button"
          data-testid={`harness-refuse-decline-${referral.id}`}
          onClick={() =>
            dispatch({
              type: "DECLINE_REFERRAL",
              role: "ed",
              now,
              referralId: referral.id,
              destinationKind: "psychiatric_ward",
              reason: "belongs_to_another_service",
            })
          }
        >
          refuse
        </button>
      ))}
    </>
  );
}

function renderHubWithDeclineHarness(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={edId} />
      <RaiseSelfAddressedReferral edId={edId} />
      <RefuseDeclineHarness edId={edId} />
      <ReferralProbe />
      <DeclineProbe />
    </WardFlowProvider>,
  );
}

/**
 * ⚠️ **THE ONLY PATH IN THIS SUITE THAT PRODUCES A REAL `cancelled` ED ADDRESSING.** Fix round 1
 * (review finding I2): `answeredAddressingLabel`'s `cancelled` branch had no test, and `cancelled`
 * is reachable in production — `ward-flow-reducer.ts`'s `ACCEPT_REFERRAL` case (~`:2297`) cancels
 * every sibling destination still `queued` the moment ONE destination accepts (`FD-22`), and this
 * department's own review arm is one of those siblings whenever the SAME referral also carries a
 * ward (or community) arm.
 *
 * Raises ONE referral with BOTH a `psychiatric_ward` destination and this department's own ED
 * review destination, then accepts the WARD destination — nothing here ever dispatches
 * `DECLINE_REFERRAL` against the ED arm, and nothing here is `"ed"` answering its own destination.
 * The ED arm's `cancelled` state is a pure, automatic CONSEQUENCE of the ward's acceptance, which
 * is exactly the case `answeredAddressingLabel`'s `cancelled` branch exists to word correctly —
 * "nobody here refused anything" is only true if nothing here dispatched a refusal.
 *
 * The accepting unit is searched for eligibility, never hard-coded — the same discipline
 * `tests/ward-referral-screens.dom.test.tsx`'s own `RaiseRefuseThenAcceptHarness` uses and for the
 * same reason: a hard-coded unit id would fail this test as "the reducer refused the acceptance"
 * the day the seeded network's bed counts change, rather than as a real defect here.
 */
function RaiseWardAndReviewThenAcceptWardHarness({ edId }: { edId: string }) {
  const { referrals, units, now, dispatch } = useWardFlow();
  const last = referrals.at(-1);
  const wardArm = last?.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  const wardDestination = wardArm?.destination.kind === "psychiatric_ward" ? wardArm.destination : undefined;
  const acceptingUnit =
    last && wardDestination
      ? units.find((unit) => referralEligibility(last, wardDestination, unit, now).eligible)
      : undefined;

  return (
    <>
      <button
        type="button"
        data-testid="harness-raise-ward-and-review"
        onClick={() =>
          dispatch({
            type: "RECEIVE_REFERRAL",
            role: "community",
            now,
            ageBand: "Adult",
            destinations: [
              { kind: "psychiatric_ward", sex: "Female", secureBedNeeded: false, involuntaryBedNeeded: false },
              { kind: "emergency_department", edId, purpose: "psychiatric_review" },
            ],
            homeRegion: "Perth Metropolitan",
            suburb: { kind: "named", name: "Armadale" },
            source: "community",
            urgency: 2,
            originSiteCode: "RPH",
            transportNeeded: false,
          })
        }
      >
        raise ward+review
      </button>
      <button
        type="button"
        data-testid="harness-accept-ward"
        onClick={() =>
          last &&
          acceptingUnit &&
          dispatch({
            type: "ACCEPT_REFERRAL",
            role: "ward",
            now,
            referralId: last.id,
            destinationKind: "psychiatric_ward",
            unitId: acceptingUnit.id,
          })
        }
      >
        accept ward
      </button>
      {/* Non-vacuity, readable from the test: did the eligibility search actually find a unit to
       *  accept into? An absent unit means "accept ward" silently does nothing, and a test that
       *  then asserted "the ED arm is cancelled" would be asserting about a click that never
       *  dispatched anything. */}
      <span data-testid="harness-accepting-unit">{acceptingUnit?.id ?? "no-unit"}</span>
    </>
  );
}

function renderHubWithWardAcceptanceHarness(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={edId} />
      <RaiseWardAndReviewThenAcceptWardHarness edId={edId} />
      <ReferralProbe />
      <DeclineProbe />
    </WardFlowProvider>,
  );
}

function selectAnswer(field: string, value: string) {
  fireEvent.change(screen.getByTestId(`ward-referral-intake-${field}`), { target: { value } });
}

function chooseNeed(field: string, answer: "yes" | "no") {
  fireEvent.click(screen.getByTestId(`ward-referral-intake-${field}-${answer}`));
}

/** Answers the ten always-applicable questions, addressing the referral to an emergency
 *  department and to nothing else. Deliberately does NOT answer which department. */
function answerEverythingButTheDepartment() {
  selectAnswer("ageBand", COHORTS[0]);
  selectAnswer("sex", SEXES[0]);
  selectAnswer("homeRegion", HOME_REGIONS[0]);
  // 2026-08-30: the suburb became a required answer when `Referral` gained a place to put it.
  // A real name from the catchment table, because the reducer resolves it rather than
  // measuring its length.
  selectAnswer("suburb", "Armadale");
  selectAnswer("source", REFERRAL_SOURCES[0]);
  selectAnswer("urgency", String(URGENCY_LEVELS[0]));
  selectAnswer("originSiteCode", wardSites[0].code);
  chooseNeed("secureBedNeeded", "no");
  chooseNeed("involuntaryBedNeeded", "no");
  chooseNeed("transportNeeded", "no");
  fireEvent.click(screen.getByTestId("ward-referral-intake-destination-emergency_department"));
}

const submitButton = () => screen.getByTestId("ward-referral-intake-submit");

/**
 * Raises one referral through the reducer's own `RECEIVE_REFERRAL` path, addressed to ONE emergency
 * department for ONE purpose, and hands back the referral the reducer created.
 *
 * Asserts the reducer accepted it. A refused event leaves `state.referrals` untouched, and a test
 * that then asserted "this is not in the inbox" would be asserting about a referral that was never
 * created — passing for the wrong reason, which is the failure mode this whole file is about.
 */
function raiseEdReferral(
  edId: string,
  purpose: ReferralPurpose,
): { state: ReturnType<typeof seedWardFlowState>; referral: Referral } {
  let state = seedWardFlowState();
  const before = state.referrals.length;
  state = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    destinations: [{ kind: "emergency_department", edId, purpose }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
  });
  expect(state.rejections, `the reducer refused a ${purpose} referral to ${edId}`).toEqual([]);
  expect(state.referrals.length, "RECEIVE_REFERRAL created no referral").toBe(before + 1);
  return { state, referral: state.referrals.at(-1)! };
}

/** Every referral in `state`, so several can be raised into one state and then selected over. */
function raiseAll(entries: readonly { edId: string; purpose: ReferralPurpose }[]): Referral[] {
  let state = seedWardFlowState();
  const created: Referral[] = [];
  for (const entry of entries) {
    const before = state.referrals.length;
    state = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: entry.edId, purpose: entry.purpose }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
    });
    expect(state.rejections, `the reducer refused ${entry.purpose} → ${entry.edId}`).toEqual([]);
    expect(state.referrals.length, "RECEIVE_REFERRAL created no referral").toBe(before + 1);
    created.push(state.referrals.at(-1)!);
  }
  return created;
}

describe("the ED psychiatry inbox selector", () => {
  const departments = allEmergencyDepartments();

  it("has more than one department, or 'which one' is not a question this can test", () => {
    // The canary, kept from the sibling model suite for the same reason: with a single department
    // every `edId` assertion below passes against a selector that ignores `edId` entirely.
    expect(departments.length).toBeGreaterThan(1);
  });

  it("has three purposes and they are the three this hub reasons about", () => {
    // Non-vacuity for the purpose axis itself. If `REFERRAL_PURPOSES` lost a member, the guard
    // below would be comparing two flows that no longer both exist.
    expect([...REFERRAL_PURPOSES]).toEqual(["bed", "psychiatric_review", "medical_assessment"]);
  });

  /**
   * ⚠️ **THE `FD-18` GUARD, AND THE FORM OF IT THAT SURVIVED THE 2026-08-30 CORRECTION.**
   *
   * The original guard asserted that no action is ever rendered on a ward→ED medical notification.
   * That is now FORBIDDEN: every referral is declinable, and the reducer already implements the
   * newer ruling. What survives is that the two flows must not be CONFLATED — and naming will not
   * hold them apart, because both are addressed to the same department by parties at the same
   * hospital and agree on every field but one.
   *
   * So the guard is about selection: the review request is IN this inbox and the medical
   * notification is OUT of it, while `edId` is identical on both.
   */
  it("⚠️ separates the self-addressed review from the ward's medical notification at the SAME department", () => {
    const department = departments[0];
    const [bed, review, medical] = raiseAll([
      { edId: department.id, purpose: "bed" },
      { edId: department.id, purpose: "psychiatric_review" },
      { edId: department.id, purpose: "medical_assessment" },
    ]);

    // Non-vacuity, first: these three really are three distinct referrals that really do carry an
    // ED destination at this department. A selector returning nothing would otherwise "pass" every
    // exclusion below while inspecting nothing at all.
    const all = [bed, review, medical];
    expect(new Set(all.map((referral) => referral.id)).size, "the three flows collapsed to fewer referrals").toBe(3);
    for (const referral of all) {
      const addressing = referral.destinations.find(
        (candidate) => candidate.destination.kind === "emergency_department",
      );
      expect(addressing, `${referral.id} carries no emergency-department destination`).toBeDefined();
      expect(addressing!.destination).toMatchObject({ edId: department.id });
    }

    const inbox = edReferralsFor(all, department.id, "psychiatric_review");

    expect(
      inbox.map((entry) => entry.referral.id),
      "the inbox must hold the self-addressed review request and nothing else",
    ).toEqual([review.id]);
    expect(
      inbox.map((entry) => entry.referral.id),
      "the ward's medical notification reached the psychiatry inbox — the conflation FD-18 exists to prevent",
    ).not.toContain(medical.id);
    expect(
      inbox.map((entry) => entry.referral.id),
      "a request to this department for a BED reached the psychiatry inbox",
    ).not.toContain(bed.id);
  });

  it("does not take another department's review request", () => {
    const [mine, theirs] = raiseAll([
      { edId: departments[0].id, purpose: "psychiatric_review" },
      { edId: departments[1].id, purpose: "psychiatric_review" },
    ]);

    const inbox = edReferralsFor([mine, theirs], departments[0].id, "psychiatric_review");

    expect(inbox.map((entry) => entry.referral.id)).toEqual([mine.id]);
    expect(
      inbox.map((entry) => entry.referral.id),
      "a review request addressed to a different hospital appeared in this department's inbox",
    ).not.toContain(theirs.id);
  });

  it("carries the purpose through, so a row can state what it is FOR", () => {
    const { referral } = raiseEdReferral(departments[0].id, "psychiatric_review");
    const [entry] = edReferralsFor([referral], departments[0].id, "psychiatric_review");
    expect(entry, "the selector returned nothing to state a purpose about").toBeDefined();
    expect(entry.destination.purpose).toBe("psychiatric_review");
  });

  it("drops an addressing this department has already answered", () => {
    const { state, referral } = raiseEdReferral(departments[0].id, "psychiatric_review");
    expect(
      edReferralsFor([referral], departments[0].id, "psychiatric_review"),
      "the referral was not in the inbox even before it was answered",
    ).toHaveLength(1);

    const answered = wardFlowReducer(state, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      referralId: referral.id,
      destinationKind: "emergency_department",
      reason: "no_suitable_bed",
    });
    expect(answered.rejections, "the reducer refused the decline this test needs").toEqual([]);

    // Asserted as "this referral is gone" rather than "the inbox is empty", since 2026-08-30: the
    // seed now carries `RF-009`, a real psychiatric-review referral to this department, and it is
    // supposed to still be there. An emptiness check would have started failing for the right
    // reason — data arriving — while reading as though the drop had broken.
    const remaining = edReferralsFor(answered.referrals, departments[0].id, "psychiatric_review");
    expect(remaining.map((entry) => entry.referral.id)).not.toContain(referral.id);
  });
});

describe("the intake form's emergency-department destination", () => {
  const departments = allEmergencyDepartments();

  it("asks WHICH department only once one is chosen", () => {
    renderIntakeAndHub(departments[0].id);

    expect(
      screen.queryByTestId("ward-referral-intake-edId"),
      "the department picker was on a form with no emergency-department destination chosen",
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-referral-intake-destination-emergency_department"));

    expect(screen.getByTestId("ward-referral-intake-edId")).toBeInTheDocument();
  });

  it("pre-chooses no department, and offers every one in the network", () => {
    renderIntakeAndHub(departments[0].id);
    fireEvent.click(screen.getByTestId("ward-referral-intake-destination-emergency_department"));

    const picker = screen.getByTestId("ward-referral-intake-edId") as HTMLSelectElement;
    // A first-department default is the single most dangerous default on this form: the reducer
    // membership-checks five fields on RECEIVE_REFERRAL and `edId` is not one of them, so a
    // department nobody chose would queue at a real hospital rather than bounce.
    expect(picker.value, "a department was pre-chosen for the clinician").not.toBe(departments[0].id);
    const offered = Array.from(picker.options)
      .map((option) => option.value)
      .filter((value) => departments.some((department) => department.id === value));
    expect(offered, "the picker is hand-listed rather than derived from the network").toEqual(
      departments.map((department) => department.id),
    );
  });

  it("⚠️ will not send while the department is unanswered, and names it in the note", () => {
    renderIntakeAndHub(departments[0].id);
    const before = probeParts().count;
    answerEverythingButTheDepartment();

    expect(
      submitButton(),
      "Send became available with an emergency department chosen and no department named",
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-referral-intake-unavailable").textContent).toContain("Emergency department");

    fireEvent.click(submitButton());
    expect(probeParts().count, "a referral was queued with no department named").toBe(before);
  });

  it("⚠️ sends a REAL department and the purpose its flow implies — not a stub", () => {
    renderIntakeAndHub(departments[0].id);
    const before = probeParts().count;
    answerEverythingButTheDepartment();

    const chosen = departments[1];
    selectAnswer("edId", chosen.id);
    expect(submitButton()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submitButton());

    const probe = probeParts();
    expect(probe.count, "the form sent nothing").toBe(before + 1);
    // The assertions the whole file is for: what reached the reducer is a department that resolves
    // against the real network, and a purpose, and neither is a placeholder.
    expect(probe.edId, "the referral carries no edId at all").not.toBe("no-edId");
    expect(probe.edId, "the referral carries an empty-string edId — a stub that compiles and sends").not.toBe("");
    expect(probe.edId).toBe(chosen.id);
    expect(departments.map((department) => department.id)).toContain(probe.edId);
    // `bed`, because this form is the community front door and cannot honestly mean anything else.
    // A picker offering the purpose is a clinician able to choose `psychiatric_review` and post
    // themselves into another team's worklist.
    expect(probe.purpose).toBe("bed");
  });

  it("forgets which department when the destination is un-ticked", () => {
    renderIntakeAndHub(departments[0].id);
    answerEverythingButTheDepartment();
    selectAnswer("edId", departments[1].id);
    expect(submitButton()).not.toHaveAttribute("aria-disabled");

    // Un-tick and re-tick: an answer about a destination the clinician removed must not survive to
    // be sent by a later tick they never connected it to.
    fireEvent.click(screen.getByTestId("ward-referral-intake-destination-emergency_department"));
    fireEvent.click(screen.getByTestId("ward-referral-intake-destination-emergency_department"));

    expect(
      (screen.getByTestId("ward-referral-intake-edId") as HTMLSelectElement).value,
      "the previous department survived an un-tick and was ready to send again",
    ).not.toBe(departments[1].id);
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
  });
});

describe("the hub's two lists", () => {
  const departments = allEmergencyDepartments();

  /** A department the seed leaves with no accepted onward move, so the empty state is real. */
  const QUIET_ED = "jhc-ed";
  /** A department whose open patients include SOME, but not all, already accepted onward. */
  const BUSY_ED = "peel-ed";

  it("keeps a bed request to this department OUT of its psychiatry inbox — end to end", () => {
    const department = departments[0];
    renderIntakeAndHub(department.id);
    const before = probeParts().count;

    // Raised through the real form, addressed to this very department.
    answerEverythingButTheDepartment();
    selectAnswer("edId", department.id);
    fireEvent.click(submitButton());

    // Non-vacuity: the referral really was created, and really does name this department.
    const probe = probeParts();
    expect(probe.count, "the form sent nothing, so the exclusion below proves nothing").toBe(before + 1);
    expect(probe.edId).toBe(department.id);
    expect(probe.purpose).toBe("bed");

    // And it is not in the psychiatry inbox, because it asks for a bed.
    //
    // ⚠️ This used to assert the inbox was EMPTY, which was true only because no seeded referral
    // addressed an emergency department at all — the exclusion and the absence of any data were
    // indistinguishable, so the test could not tell "the bed request was filtered out" from "this
    // screen never shows anything". `RF-009` now sits in that inbox legitimately, and the assertion
    // is the one the test was always about: THIS referral is not there.
    expect(screen.queryByTestId(`ward-ed-inbox-row-${probe.id}`)).not.toBeInTheDocument();
    const inboxRows = screen.getAllByTestId(/^ward-ed-inbox-row-/);
    expect(inboxRows.length, "the inbox is empty, so the exclusion below is vacuous again").toBeGreaterThan(0);
    for (const row of inboxRows) {
      expect(row.getAttribute("data-testid")).not.toBe(`ward-ed-inbox-row-${probe.id}`);
    }
  });

  it("says the inbox is empty rather than showing nothing at all", () => {
    renderHub(QUIET_ED);
    const inbox = screen.getByTestId("ward-ed-inbox");
    expect(within(inbox).getByTestId("ward-ed-inbox-empty")).toBeInTheDocument();
    expect(within(inbox).queryAllByRole("listitem")).toEqual([]);
  });

  /**
   * The count above a list must read the SAME array as the list — the `queueStageSummaries`
   * pattern. Asserted against the rendered rows rather than against a number this test computes
   * separately, so the two cannot agree by both being wrong in the same way.
   */
  it("counts the outbox with the array it renders", () => {
    renderHub(BUSY_ED);
    const outbox = screen.getByTestId("ward-ed-outbox");
    const rows = within(outbox).getAllByRole("listitem");

    // Non-vacuity: this department really does have somebody still to be moved. A heading reading
    // "0 patients" over an empty list would otherwise satisfy the equality below.
    expect(rows.length, `${BUSY_ED} has nothing in its outbox, so this proves nothing`).toBeGreaterThan(0);
    expect(within(outbox).getByRole("heading").textContent).toContain(
      `${rows.length} patient${rows.length === 1 ? "" : "s"}`,
    );
  });

  it("is a strict subset of the department's patients — not a second copy of that list", () => {
    renderHub(BUSY_ED);
    const outboxRows = within(screen.getByTestId("ward-ed-outbox")).getAllByRole("listitem");
    const patientRows = screen.getAllByTestId(/^ward-ed-patient-/);

    expect(outboxRows.length).toBeGreaterThan(0);
    expect(
      outboxRows.length,
      "every open patient is in the outbox, so it is not distinguishing 'referred onward' from 'here'",
    ).toBeLessThan(patientRows.length);
  });

  /**
   * ⚠️ **THE OUTBOX KEPT ITS ABSENCE WHEN THE INBOX LOST ITS OWN, AND THAT IS THE POINT.**
   *
   * This replaced an assertion that NEITHER list showed an elapsed figure. That assertion was
   * correct while `Referral` held no triage instant; `Referral.triagedAt` (2026-08-30) made it
   * false for the inbox, and the inbox now carries two real clocks.
   *
   * It stays true for the outbox for a completely different reason, which is why the two halves
   * were split rather than loosened together: **an outbox row is a `Movement`, not a `Referral`.**
   * `triagedAt` is a referral fact and nothing joins the two records, so the referral clocks are
   * not merely unnecessary here — they are unavailable. What a move being owed is counted from is
   * `Movement.acceptedAt`, which the seed's hand-authored movements deliberately do not carry.
   *
   * So the danger on this list is a SUBSTITUTION: `openedAt` is in scope, is never absent, and
   * would render a believable figure answering "how long in the department" under a label reading
   * "waiting to move". A wrong clock looks wrong; a wrong length of stay looks plausible.
   */
  it("never invents a move clock on the outbox, whose rows are movements rather than referrals", () => {
    renderHub(BUSY_ED);
    const outbox = screen.getByTestId("ward-ed-outbox");

    // Non-vacuity: an empty outbox would satisfy every absence below.
    expect(
      within(outbox).getAllByRole("listitem").length,
      `${BUSY_ED} has an empty outbox, so this proves nothing`,
    ).toBeGreaterThan(0);

    const text = outbox.textContent ?? "";
    // ⚠️ Deliberately WIDER than the `\d+h \d+m` shape this assertion inherited. Substituting
    // `openedAt` here was tried as a mutation and this list's stays are all under an hour, so it
    // rendered "45m since accepted" and slipped straight through the hour-scale pattern — a guard
    // that only catches the long version of a defect the fixture cannot currently produce.
    expect(text, "the outbox renders an elapsed figure from an instant it does not hold").not.toMatch(
      /\b\d+\s*[hmd]\b/,
    );
    expect(text, 'the outbox renders a "time since" figure').not.toMatch(/\bago\b/i);
    expect(text).toContain("Acceptance time not recorded");

    // And the referral vocabulary never leaks across onto a movement row.
    expect(text.toLowerCase(), "a referral clock term reached a movement row").not.toContain("since referral");
    expect(text.toLowerCase(), "a referral clock term reached a movement row").not.toContain("in department");
  });
});

/**
 * THE INBOX'S DECLINE CONTROL — WIRED 2026-09-01, AND THE THREE ARTEFACTS THAT SAID IT COULD NOT BE.
 *
 * ⚠️ **THESE TESTS REPLACE ASSERTIONS THAT WERE CORRECT WHEN THEY WERE WRITTEN, AND THEY ARE
 * REWRITTEN RATHER THAN DELETED.** They pinned an inert control, its `aria-describedby`, and a
 * sentence on screen reading "Declining is not yet recordable from this screen: an ED psychiatry
 * team is not one of the roles permitted to answer a referral". Every clause of that had since been
 * falsified: `EVENT_ROLE.DECLINE_REFERRAL` is `["ward", "coordinator", "ed"]`, and the reducer's
 * `DECLINE_REFERRAL` branch writes `decidedBy: WARD_FLOW_ROLE_LABELS[event.role]`, which for `"ed"`
 * is "ED mental health". A deleted test is indistinguishable from a test that never existed, so the
 * same three claims are asserted in their new form below.
 */
describe("the inbox's decline control", () => {
  /**
   * ⚠️ **THE THIRD STALE ARTEFACT WAS USER-FACING TEXT, WHICH IS WHY ITS ABSENCE IS ASSERTED ON THE
   * RENDERED SCREEN** rather than by grepping the source. A clinician read that sentence, and it
   * told them the system could not record something it can record.
   *
   * Non-vacuous by construction: the row is proved present first, so this cannot pass by rendering
   * an empty inbox.
   */
  it("no longer tells a clinician that declining is not recordable from this screen", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const { id, count } = probeParts();
    expect(count, "the harness raised nothing, so there is no row and no rendered prose").toBe(SEEDED_REFERRALS + 1);
    expect(screen.getByTestId(`ward-ed-inbox-row-${id}`)).toBeInTheDocument();

    const inbox = screen.getByTestId("ward-ed-inbox");
    const text = inbox.textContent ?? "";
    expect(text, "the false unavailability prose is still on screen").not.toContain("Declining is not yet recordable");
    expect(text, "the false claim about permitted roles is still on screen").not.toContain(
      "not one of the roles permitted to answer a referral",
    );
  });

  it("renders the control WIRED — a real toggle, with neither disabled attribute", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const { id, count } = probeParts();
    expect(count, "the harness raised nothing, so there is no row to carry a control").toBe(SEEDED_REFERRALS + 1);

    const decline = screen.getByTestId(`ward-ed-inbox-decline-${id}`);
    // ⚠️ **NO ASSERTION ON THE BUTTON'S WORDING.** One stood here and was removed on 2026-09-01:
    // `tests/ward-referral-control-labels.dom.test.tsx` records that the owner surveyed 30 plain
    // ward button labels, chose to pin exactly TWO, and that the rest are "DECLINED, not deferred"
    // (`docs/ward-flow-remaining-work.md`). Pinning a nineteenth here credited him with a decision
    // he expressly declined to make.
    // Wired means wired: neither attribute, and `require-button-wiring` fails on the pair anyway.
    expect(decline, "the control is still advertising itself as unavailable").not.toHaveAttribute("aria-disabled");
    expect(decline).not.toHaveAttribute("disabled");
    // A disclosure, so it says whether its panel is open — the shape the four patient-section
    // controls already use.
    expect(decline).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(decline);
    expect(decline).toHaveAttribute("aria-expanded", "true");
  });

  /**
   * ⚠️ **THE LIST IS DERIVED, AND FOUR OF THE SIX MODEL REASONS ANSWER A QUESTION THIS SCREEN DOES
   * NOT ASK.** This inbox asks a psychiatry team to SEE somebody; "No suitable bed" filed against
   * it reads on the record as a bed refusal that never happened.
   *
   * Asserted as "the bed-shaped four are absent AND the survivors are present", never as a count:
   * a count passes while the wrong four are excluded.
   */
  it("offers only the reasons that fit a review request, by their labels rather than their codes", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    const { id } = probeParts();
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-${id}`));

    const options = Array.from(screen.getByTestId(`ward-ed-inbox-decline-reason-${id}`).querySelectorAll("option")).map(
      (option) => ({ value: option.getAttribute("value"), label: option.textContent }),
    );

    expect(options.map((option) => option.value)).toContain("belongs_to_another_service");
    expect(options.map((option) => option.value)).toContain("referred_elsewhere");
    for (const bedShaped of [
      "no_suitable_bed",
      "secure_bed_unavailable",
      "age_band_not_provided_here",
      "sex_designation_unavailable",
    ]) {
      expect(
        options.map((option) => option.value),
        `${bedShaped} answers a bed request, and this screen never makes one`,
      ).not.toContain(bedShaped);
    }
    // Never a raw enum value in front of a clinician.
    expect(options.map((option) => option.label)).toContain(DECLINE_REASON_LABELS.belongs_to_another_service);
    expect(options.map((option) => option.label)).toContain(DECLINE_REASON_LABELS.referred_elsewhere);
    expect(
      options.map((option) => option.label),
      "a raw enum code reached a clinician's screen",
    ).not.toContain("belongs_to_another_service");
  });

  /**
   * ⚠️ **NOTHING IS PRE-SELECTED, AND THE CONFIRM IS UNAVAILABLE UNTIL A REASON IS CHOSEN.**
   * A pre-selected reason is the one a clinician who meant something else records by pressing
   * confirm — an invented clinical fact.
   *
   * ⚠️ **THIS USED TO SAY `referral-match.tsx` MAY SAFELY SEED `REFERRAL_DECLINE_REASONS[0]`
   * BECAUSE ALL SIX OF ITS REASONS ANSWER THE BED QUESTION. There are now seven, and that screen
   * no longer seeds anything** — the owner ruled on 2026-09-02 that a ward must state why it is
   * refusing a patient. Both screens start unchosen now.
   */
  it("pre-selects no reason, and refuses to record a decline until one is chosen", () => {
    renderHubWithDeclineHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    const { id } = probeParts();
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-${id}`));

    const select = screen.getByTestId(`ward-ed-inbox-decline-reason-${id}`) as HTMLSelectElement;
    expect(select.value, "a reason nobody chose was pre-selected").toBe("");

    const confirm = screen.getByTestId(`ward-ed-inbox-decline-confirm-${id}`);
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    // The repo convention: never the native attribute, which removes the tab stop the stated
    // reason is announced from — and never both, which is the shape `require-button-wiring` fails.
    expect(confirm).not.toHaveAttribute("disabled");
    expect(screen.getByText(/None is chosen for you/).id).toBe(confirm.getAttribute("aria-describedby"));

    // And pressing it records nothing at all — not a decline, and not a rejection either.
    fireEvent.click(confirm);
    const after = declineParts();
    expect(after.state, "a decline was recorded with no reason").toBe("queued");
    expect(after.rejections, "a reasonless decline reached the reducer and was refused there").toBe(0);
  });

  /**
   * ⚠️ **END-TO-END PROOF 1 — AN ED DECLINING ITS OWN DESTINATION IS ACCEPTED, AND THE RECORD SAYS
   * WHO DECIDED.**
   *
   * `decidedBy` is asserted, not merely the state. Dispatching as `"ward"` or `"coordinator"` would
   * also flip this addressing to `declined` and would write "Ward manager" or "Flow coordinator"
   * against a decision ED psychiatry made — the exact false entry that field exists to prevent, and
   * a state-only assertion goes green on it.
   */
  it("⚠️ records an ED decline of its own destination, as ED mental health", () => {
    renderHubWithDeclineHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    const { id, count } = probeParts();
    expect(count, "the harness raised nothing, so there is nothing to decline").toBe(SEEDED_REFERRALS + 1);
    expect(declineParts().state, "the row was not queued before the decline").toBe("queued");

    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-${id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-inbox-decline-reason-${id}`), {
      target: { value: "belongs_to_another_service" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-confirm-${id}`));

    const after = declineParts();
    expect(after.state, "the reducer did not accept the ED's decline").toBe("declined");
    expect(after.decidedBy, "the record names the wrong team for this decision").toBe("ED mental health");
    expect(after.reason).toBe("belongs_to_another_service");
    expect(after.rejections, "the reducer refused a decline this screen is permitted to make").toBe(0);

    // And the answered row leaves the inbox, which is the only success signal on screen. The
    // refusal paragraph is a child of that same `<li>`, so asserting its absence separately would
    // be asserting something this line already entails — the refusal is proved reachable, and
    // proved scoped, by its own test below instead.
    expect(screen.queryByTestId(`ward-ed-inbox-row-${id}`)).not.toBeInTheDocument();
  });

  /**
   * ⚠️ **AN ED MAY NOT DECLINE A WARD BED, AND THIS SUITE IS NOT THAT RULE'S HOME.**
   *
   * The rule lives in `tests/ward-referral-decision-scope.test.ts`, which states it in BOTH
   * directions against the reducer — an ED refused a `psychiatric_ward` destination, and a ward
   * refused an `emergency_department` one — and additionally asserts the untouched addressing stays
   * `queued`. A reducer-level copy stood here until 2026-09-01 and was removed as duplicate: it
   * rendered nothing, so its own docblock's claim to be "the suite that renders the screen
   * dispatching as `ed`" was false of it.
   *
   * What this suite owes, and what the test below actually does, is the half that file cannot
   * reach: the same refusal arriving at the ED hub, through the real provider, and being shown
   * against the right row.
   */
  it("⚠️ shows a reducer refusal on the row it belongs to, and on no other row", () => {
    renderHubWithDeclineHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const ids = screen
      .getAllByTestId(/^ward-ed-inbox-row-/)
      .map((row) => row.getAttribute("data-testid")!.replace("ward-ed-inbox-row-", ""));
    expect(ids.length, "three rows are needed: one to decline, one refused, one untouched").toBe(3);
    const [declined, refused, untouched] = ids;

    // A real decline first, because the screen deliberately surfaces nothing until it has itself
    // dispatched — a rejection already in state belongs to somebody else. This is the token.
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-${declined}`));
    fireEvent.change(screen.getByTestId(`ward-ed-inbox-decline-reason-${declined}`), {
      target: { value: "referred_elsewhere" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-confirm-${declined}`));
    expect(screen.queryByTestId(`ward-ed-inbox-row-${declined}`)).not.toBeInTheDocument();

    // Now a genuine reducer refusal naming a row that is still on screen.
    fireEvent.click(screen.getByTestId(`harness-refuse-decline-${refused}`));

    const alert = screen.getByTestId(`ward-ed-inbox-decline-rejection-${refused}`);
    expect(alert).toHaveAttribute("role", "alert");
    // The reducer's own words, not a message this screen invented — and they name the scope guard
    // that makes the ED's new permission narrow rather than merely wider.
    expect(alert.textContent).toContain("Decline not recorded:");
    expect(alert.textContent).toContain("may only answer emergency department destinations");

    // ⚠️ **THE ASSERTION THE WHOLE TEST EXISTS FOR.** Weakening the row guard from
    // `declineRejection?.referralId === referral.id` to `declineRejection !== undefined` renders
    // this refusal against every row in the list, and only this line notices.
    expect(
      screen.queryByTestId(`ward-ed-inbox-decline-rejection-${untouched}`),
      "a refusal about another referral was displayed against this row",
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(`ward-ed-inbox-row-${untouched}`)).toBeInTheDocument();
  });
});

describe("an inbox row, once one exists", () => {
  it("⚠️ states its PURPOSE in words — the property that replaced the withdrawn FD-18 guard", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const { id, count } = probeParts();
    expect(count, "the harness raised nothing").toBe(SEEDED_REFERRALS + 1);

    // Since every referral is declinable, what a row is FOR is the only thing telling the three ED
    // flows apart. A declinable row with no stated purpose is indistinguishable from a bed request.
    const purpose = screen.getByTestId(`ward-ed-inbox-purpose-${id}`);
    expect(purpose.textContent).toBe("For psychiatric review");
    // The machine-readable half, so a later refactor cannot keep the words and lose the fact.
    expect(screen.getByTestId(`ward-ed-inbox-row-${id}`)).toHaveAttribute("data-purpose", "psychiatric_review");
  });

  it("counts the inbox with the array it renders", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const inbox = screen.getByTestId("ward-ed-inbox");
    const rows = within(inbox).getAllByRole("listitem");
    expect(rows.length, "the harness raised nothing").toBe(2);
    expect(within(inbox).getByRole("heading").textContent).toContain("2 referrals");
  });

  /**
   * ⚠️ **THIS REVERSES THIS FILE'S OWN "shows no elapsed figure" ASSERTION, WHICH WAS CORRECT.**
   * It held while `Referral` recorded no instant that could stop the referral clock. `triagedAt`
   * landed on 2026-08-30, so the absence — and the prose stating it — became false.
   *
   * The row the harness raises is the only shape this inbox can hold today: a referral raised
   * through `RECEIVE_REFERRAL`, which has no field for a triage time. So the department clock's
   * ABSENT branch is the one the application reaches here, and it is the branch most easily got
   * wrong — `P9-D7` is explicit that `undefined` is not zero, because "0m in department" reads as
   * "just triaged", the opposite of the truth for somebody who is not there at all.
   */
  it("⚠️ carries both clocks, and says the department clock does not exist yet rather than printing a zero", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const { id, count } = probeParts();
    expect(count, "the harness raised nothing, so there is no row to carry a clock").toBe(SEEDED_REFERRALS + 1);

    const department = screen.getByTestId(`ward-ed-inbox-department-clock-${id}`);
    expect(department.textContent).toContain("Not in department yet");
    expect(department.textContent, "a number was printed for somebody who is not in the department").not.toMatch(/\d/);
    expect(department.textContent, "an em dash reads as a duration that is nil, not as an absent clock").not.toContain(
      "—",
    );

    // The referral clock is running, and is worded as a wait somebody is still serving.
    const referral = screen.getByTestId(`ward-ed-inbox-referral-clock-${id}`);
    expect(referral.textContent).toContain("Since referral");
    expect(referral.textContent).toContain("waiting");
    expect(screen.getByTestId(`ward-ed-inbox-row-${id}`)).toHaveAttribute("data-since-referral-running", "true");

    // ⚠️ And nowhere on the list does a triage time get worded as an arrival. A patient arrives,
    // waits, and is triaged some time later; triage is a proxy and is only honest while labelled
    // as one. The same guard `REFERRAL_CLOCK_TERMS` carries in the model, applied to the screen.
    const inbox = screen.getByTestId("ward-ed-inbox").textContent ?? "";
    expect(inbox.toLowerCase(), "the inbox words a triage time as an arrival").not.toContain("arriv");
    expect(inbox, "the false absence prose survived beside a real figure").not.toContain("Not recorded");
  });
});

/**
 * OWNER RULING 7, 2026-09-01 — "A clinician can see a referral they refused." A decline vanishes
 * from the inbox the moment it is recorded, because that list is a worklist; this section is
 * where the same clinician finds it again, with the reason, and nothing to check a mistake against
 * otherwise.
 *
 * `edAnsweredReferralsFor` is tested directly here first, the same way `edReferralsFor` is tested
 * above it in this file — against referrals the reducer actually produced, never a hand-built
 * object literal — and then through the rendered screen, where the new section's own `data-testid`
 * prefix (`ward-ed-answered-*`) is what has to be right.
 */
describe("the ED psychiatry answered selector", () => {
  const departments = allEmergencyDepartments();

  it("picks up an addressing once this department has answered it, and it has left the inbox", () => {
    const { state, referral } = raiseEdReferral(departments[0].id, "psychiatric_review");
    expect(
      edAnsweredReferralsFor([referral], departments[0].id, "psychiatric_review"),
      "a referral was already 'answered' before this test answered it",
    ).toHaveLength(0);

    const decided = wardFlowReducer(state, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      referralId: referral.id,
      destinationKind: "emergency_department",
      reason: "no_suitable_bed",
    });
    expect(decided.rejections, "the reducer refused the decline this test needs").toEqual([]);

    const answered = edAnsweredReferralsFor(decided.referrals, departments[0].id, "psychiatric_review");
    const entry = answered.find((candidate) => candidate.referral.id === referral.id);
    expect(entry, "the declined referral did not reach the answered selector").toBeDefined();
    expect(entry!.addressing.state).toBe("declined");
    expect(entry!.addressing.declineReason).toBe("no_suitable_bed");

    // The two selectors must partition the same addressing, never both hold it: a row that is
    // both "still waiting" and "already answered" is the exact confusion a worklist exists to
    // prevent.
    expect(
      edReferralsFor(decided.referrals, departments[0].id, "psychiatric_review").map((e) => e.referral.id),
      "a declined referral is still being offered as though it were queued",
    ).not.toContain(referral.id);
  });

  /**
   * ⚠️ **THE ANSWERED-LIST FORM OF THE `FD-18` GUARD.** The inbox selector keeps a ward's medical
   * notification and a bed request out of the psychiatry review inbox by matching BOTH `edId` and
   * `purpose`; this selector must do the identical narrowing once all three have been answered, or
   * a clinician's "what did I just decide" list would show somebody else's decision.
   */
  it("⚠️ separates this department's answered review from its own answered medical notification, its own answered bed request, and another department's answered review", () => {
    const [deptA, deptB] = departments;
    // ⚠️ **ONE SHARED STATE ACROSS ALL FOUR, NOT `raiseEdReferral` FOUR TIMES.** That helper seeds a
    // FRESH state per call, so two independent calls both raise "the next referral after the seed"
    // and get the SAME id — which silently turned this into a test of one referral against itself.
    // One running state is what gives each of the four its own distinct id, the same discipline
    // `raiseAll` above uses.
    let state = seedWardFlowState();
    function raise(edId: string, purpose: ReferralPurpose): Referral {
      const before = state.referrals.length;
      state = wardFlowReducer(state, {
        type: "RECEIVE_REFERRAL",
        role: "community",
        now: NOW_ANCHOR,
        ageBand: "Adult",
        destinations: [{ kind: "emergency_department", edId, purpose }],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        urgency: 2,
        originSiteCode: "RPH",
        transportNeeded: false,
      });
      expect(state.rejections, `RECEIVE_REFERRAL refused ${purpose} -> ${edId}`).toEqual([]);
      expect(state.referrals.length, "RECEIVE_REFERRAL created no referral").toBe(before + 1);
      return state.referrals.at(-1)!;
    }
    function decline(referral: Referral) {
      state = wardFlowReducer(state, {
        type: "DECLINE_REFERRAL",
        role: "coordinator",
        now: NOW_ANCHOR + 5,
        referralId: referral.id,
        destinationKind: "emergency_department",
        reason: "no_suitable_bed",
      });
    }

    const bed = raise(deptA.id, "bed");
    const review = raise(deptA.id, "psychiatric_review");
    const medical = raise(deptA.id, "medical_assessment");
    const otherReview = raise(deptB.id, "psychiatric_review");
    for (const referral of [bed, review, medical, otherReview]) decline(referral);
    expect(state.rejections, "a decline this test needs was refused").toEqual([]);

    // Non-vacuity: four distinct referrals, or every exclusion below passes for the wrong reason.
    expect(
      new Set([bed.id, review.id, medical.id, otherReview.id]).size,
      "the four flows collapsed to fewer referrals",
    ).toBe(4);

    const answered = edAnsweredReferralsFor(state.referrals, deptA.id, "psychiatric_review");

    expect(
      answered.map((entry) => entry.referral.id),
      "the answered self-addressed review must be the one thing this list holds",
    ).toEqual([review.id]);
    expect(
      answered.map((entry) => entry.referral.id),
      "this department's answered medical notification reached the answered review list",
    ).not.toContain(medical.id);
    expect(
      answered.map((entry) => entry.referral.id),
      "this department's answered BED request reached the answered review list",
    ).not.toContain(bed.id);
    expect(
      answered.map((entry) => entry.referral.id),
      "another department's answered review reached this department's answered list",
    ).not.toContain(otherReview.id);
  });
});

describe("the recently answered section", () => {
  /**
   * ⚠️ **THE WHOLE POINT OF OWNER RULING 7, END TO END.** A clinician declines a referral, the row
   * leaves the inbox — unchanged behaviour, `edReferralsFor`'s own contract — and now, unlike
   * before this task, it did not just vanish: it is on screen with the reason, in words a
   * clinician reads rather than an enum code.
   */
  it("⚠️ a declined referral leaves the inbox AND appears here, with its reason shown", () => {
    renderHubWithDeclineHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    const { id } = probeParts();

    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-${id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-inbox-decline-reason-${id}`), {
      target: { value: "belongs_to_another_service" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-confirm-${id}`));

    // Gone from the worklist — `edReferralsFor`'s own contract, unchanged by this task.
    expect(
      screen.queryByTestId(`ward-ed-inbox-row-${id}`),
      "the declined referral is still sitting in the worklist, as though nobody had answered it",
    ).not.toBeInTheDocument();

    // ⚠️ **THE ASSERTION THIS TASK EXISTS FOR.** `queryByTestId` (never `getByTestId`) so a missing
    // row fails THIS line with a message naming the clinical harm, rather than surfacing as
    // Testing Library's own "unable to find an element" a few lines further down — which reports a
    // missing element and says nothing about who is affected or why it matters.
    const row = screen.queryByTestId(`ward-ed-answered-row-${id}`);
    expect(
      row,
      "a clinician who just declined this referral cannot find it again anywhere on screen — no record, no undo, nothing to check their decision against. This is the exact gap owner ruling 7 (2026-09-01) was raised to close.",
    ).not.toBeNull();

    // ⚠️ **ORDERED BEFORE THE EXACT-SENTENCE CHECK BELOW, DELIBERATELY.** Fix round 1 (review
    // finding I3): the two assertions here are both load-bearing, but they catch DIFFERENT
    // defects, and Vitest stops a test at its first failing `expect` — so whichever assertion
    // runs first is the only one a given mutation can be observed to trip. This one is the
    // narrower, higher-severity defect (an internal enum code reaching a clinician's screen
    // because `DECLINE_REASON_LABELS[...] ?? addressing.declineReason`'s fallback fired), so it
    // runs first: a mutation that drops the label lookup produces a string that fails BOTH checks,
    // and this ordering is what lets this test prove THIS one is what caught it.
    expect(
      row!.textContent,
      "the label lookup missed and a raw enum code reached a clinician's screen instead of words",
    ).not.toContain("belongs_to_another_service");

    // The general shape check: not just "no raw enum", but the exact sentence a clinician reads.
    // Builds its expected value from the same `DECLINE_REASON_LABELS` constant the production
    // code reads — so it pins the SENTENCE SHAPE and the lookup, not the label text's own content
    // (that content is a different test's job: `tests/ward-referral-model.test.ts` sweeps
    // `DECLINE_REASON_LABELS`' values for a digit and pins its key set against
    // `REFERRAL_DECLINE_REASONS`). This assertion catches the branch reading the wrong field, or
    // returning a vague placeholder like "Not proceeding." instead of the reason — the second
    // mutation in this task's fix round proves it, in `task-1-report.md`.
    expect(
      screen.getByTestId(`ward-ed-answered-state-${id}`).textContent,
      "the answered row exists but does not say WHY it was declined — a clinician can find the row and still have nothing to check their own reasoning against",
    ).toBe(`Declined — ${DECLINE_REASON_LABELS.belongs_to_another_service}.`);
  });

  it("says nothing has been answered yet, rather than showing nothing at all", () => {
    renderHub("jhc-ed");
    const section = screen.getByTestId("ward-ed-answered");
    expect(within(section).getByTestId("ward-ed-answered-empty")).toBeInTheDocument();
    expect(within(section).queryAllByRole("listitem")).toEqual([]);
  });

  /**
   * ⚠️ **A REGRESSION GUARD FOR THE TRAP THIS TASK'S OWN BRIEF NAMED.** Two assertions elsewhere in
   * this file —
   *   "⚠️ records an ED decline of its own destination, as ED mental health" (asserts
   *     `ward-ed-inbox-row-<id>` is gone, its own comment calling that "the only success signal on
   *     screen"), and
   *   "⚠️ shows a reducer refusal on the row it belongs to, and on no other row" (the same
   *     assertion for a different referral) —
   * both depend on the answered section using a DIFFERENT `data-testid` prefix than the inbox.
   * `getAllByTestId(/^ward-ed-inbox-row-/)` elsewhere in this file would also silently start
   * matching this section's rows if the prefixes collided. This test does not re-run those two —
   * they already run, unmodified, every time this file does — it instead pins the property they
   * both rely on: the answered section's row testid is never `ward-ed-inbox-row-*`.
   */
  it("⚠️ never renders an answered row under the inbox's own testid prefix", () => {
    renderHubWithDeclineHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));
    const { id } = probeParts();

    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-${id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-inbox-decline-reason-${id}`), {
      target: { value: "belongs_to_another_service" },
    });
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-confirm-${id}`));

    // Non-vacuity: the answered section really is populated, or the guard below passes on an
    // empty list and proves nothing about a prefix collision at all.
    expect(
      screen.getByTestId(`ward-ed-answered-row-${id}`),
      "nothing answered rendered, so the prefix guard below would pass on an empty list and prove nothing",
    ).toBeInTheDocument();

    /*
     * ⚠️ **FIX ROUND 1 (review finding I1).** The two lines this replaced were, respectively, a
     * tautology and a duplicate:
     *
     *   expect(screen.getByTestId(`ward-ed-answered-row-${id}`).getAttribute("data-testid"))
     *     .not.toMatch(/^ward-ed-inbox-row-/)
     *
     * `getByTestId` found that element BY the `ward-ed-answered-row-` prefix, so its own
     * `data-testid` attribute cannot possibly start with `ward-ed-inbox-row-` — the assertion
     * passes by construction and no code change could ever turn it red. The second line
     * (`queryByTestId(ward-ed-inbox-row-<id>)).not.toBeInTheDocument()`) is the exact assertion
     * the test above already makes for the same id.
     *
     * The guard with teeth is the inbox's own prefix pattern, queried directly, while the answered
     * section is known (by the assertion above) to hold a row for this referral: if the answered
     * section had reused `ward-ed-inbox-row-*`, THIS line would find it.
     */
    expect(
      screen.queryAllByTestId(/^ward-ed-inbox-row-/),
      "an element matching the inbox's own testid prefix exists while the answered section holds a row for this referral — the two lists have collided",
    ).toHaveLength(0);
  });
});

/**
 * FIX ROUND 1 (review finding I2). `answeredAddressingLabel`'s `cancelled` branch shipped with
 * this task's own report flagging that nothing exercised the sibling `accepted` branch — true, and
 * a red herring: `accepted` truly is unreachable here (the only `ACCEPT_REFERRAL` dispatch
 * anywhere in `src` is hard-coded to `psychiatric_ward`). `cancelled` is a different story. It is
 * reachable in production whenever a referral with an ED review arm ALSO carries a ward or
 * community arm and one of THOSE is accepted first (`FD-22`) — and the wording is the entire point
 * of the ruling: a cancelled addressing must never read as though this department refused the
 * patient, because nobody here looked at it at all.
 */
describe("a cancelled ED addressing — reachable in production, and worded apart from a refusal", () => {
  it("⚠️ words CANCELLED apart from DECLINED — nobody here refused anything", () => {
    renderHubWithWardAcceptanceHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-ward-and-review"));
    const { id } = probeParts();

    // Non-vacuity, twice over: an eligible unit was actually found (or "accept ward" below does
    // nothing), and the ED arm is genuinely queued, in the inbox, before the ward answers anything.
    expect(
      screen.getByTestId("harness-accepting-unit").textContent,
      "no unit in the seeded network is eligible for this referral, so accepting the ward destination below would silently do nothing and the ED arm would never be cancelled",
    ).not.toBe("no-unit");
    expect(screen.getByTestId(`ward-ed-inbox-row-${id}`)).toBeInTheDocument();
    expect(declineParts().state, "the ED arm was not queued before the ward answered anything").toBe("queued");

    fireEvent.click(screen.getByTestId("harness-accept-ward"));

    // The reducer's own record, read straight from state: this is what makes the DOM assertions
    // below a proof about a REAL `cancelled` addressing, not merely about what this screen chose
    // to render regardless of what actually happened.
    expect(
      declineParts().state,
      "the ward's acceptance did not cancel the ED sibling (FD-22) — there is nothing real for this test to word",
    ).toBe("cancelled");
    // `cancelled` carries no `decidedBy` — nobody decided it, it is a consequence, not an act (see
    // `ReferralAddressing`'s own doc comment).
    expect(declineParts().decidedBy).toBe("no-decidedBy");

    // Left the worklist, same as a decline would.
    expect(screen.queryByTestId(`ward-ed-inbox-row-${id}`)).not.toBeInTheDocument();

    // ⚠️ **THE ASSERTION THIS TEST EXISTS FOR.** A cancelled addressing worded as a refusal — or
    // with any vague placeholder like "Not proceeding." or "Closed." — would tell a clinician this
    // department made a decision it never made. The exact sentence, not merely "doesn't say
    // Declined", because a vague placeholder would also pass a weaker check while still failing
    // the ruling.
    expect(
      screen.getByTestId(`ward-ed-answered-state-${id}`).textContent,
      "a CANCELLED addressing — nobody here refused anything, another destination accepted first — was not worded with the exact sentence that says so",
    ).toBe("Cancelled — this referral was accepted somewhere else.");
    // And never any wording that reads as a refusal by this department.
    expect(
      screen.getByTestId(`ward-ed-answered-row-${id}`).textContent,
      "a cancelled addressing rendered wording that reads as this department's own refusal",
    ).not.toContain("Declined");
  });
});

/**
 * THE WORDS, ASSERTED WITHOUT A SCREEN — including the branch no screen can reach.
 *
 * ⚠️ **ONE BRANCH OF THE THREE STILL HAS NO REACHABLE CALLER, AND IT IS NO LONGER THE SAME ONE.**
 * Until `RF-009` was seeded, `triagedAt` was authored only on referrals addressed to psychiatric
 * wards, so the department clock's PRESENT branch could not be reached from this hub at all. It can
 * now, and it is asserted on the rendered screen further down this file. What remains unreachable is
 * the STOPPED referral clock: stopping requires `triagedAt >= raisedAt`, no seeded ED-addressed
 * referral has that, and `RECEIVE_REFERRAL` — the only event that creates a `Referral` — has no
 * `triagedAt` field for a screen to supply one. That is a reported gap, and it is why these
 * assertions are made against the hub's own formatting function as well as against rendered rows:
 * a branch nothing reaches is a branch nothing checks, and this one decides the wording of the two
 * lies the model's own doc comments name (a zero for an absent clock, a stopped span worded as a
 * live wait).
 *
 * The clock values below are hand-written and are NOT a referral fixture: they are the three
 * outputs `referralClocks` is already proven to produce in `tests/ward-referral-clocks.test.ts`,
 * fed to the function under test here, which is presentation and nothing else.
 */
describe("the words the hub puts on the two clocks", () => {
  it("words a stopped referral clock differently from a running one", () => {
    const running = edReferralClockLines({ sinceReferral: 20, sinceReferralRunning: true, inDepartment: 185 });
    const stopped = edReferralClockLines({ sinceReferral: 180, sinceReferralRunning: false, inDepartment: 120 });

    expect(running.referral.term).toBe("Since referral");
    expect(running.referral.value).toBe("20m waiting");
    expect(stopped.referral.term).toBe("Referral to triage");
    expect(stopped.referral.value).toBe("3h 00m, stopped at triage");
    expect(stopped.referral.value, "a span that ended reads as a wait still being served").not.toContain("waiting");
  });

  it("labels the department clock as running from triage, and never as an arrival", () => {
    const lines = edReferralClockLines({ sinceReferral: 20, sinceReferralRunning: true, inDepartment: 185 });

    expect(lines.department.term).toBe("In department");
    // `splitDuration`, never hours hand-rolled from minutes — the defect that kept `25h 30m` alive
    // on eleven surfaces was two screens each doing that conversion themselves.
    expect(lines.department.value).toBe("3h 05m since triage");
    for (const line of [lines.department, lines.referral]) {
      expect(`${line.term} ${line.value}`.toLowerCase(), "a clock line says arrived").not.toContain("arriv");
    }
  });

  it("says nothing numeric for somebody who is not in the department yet", () => {
    const lines = edReferralClockLines({ sinceReferral: 40, sinceReferralRunning: true, inDepartment: undefined });

    expect(lines.department.value).toBe("Not in department yet");
    expect(lines.department.value, "a zero for an absent clock reads as just triaged").not.toMatch(/\d/);
    expect(lines.department.value).not.toBe("—");
  });

  /**
   * ⚠️ **RF-005 IS REAL, AND ITS 165-MINUTE GAP IS THE WHOLE ARGUMENT FOR TWO CLOCKS.** It is
   * addressed to a psychiatric ward, so it is not on this hub and never was; that half is unchanged
   * and still worth asserting, because the brief this work came from believed the gap was the only
   * claim being made.
   *
   * ⚠️ **WHAT THIS TEST USED TO SAY, AND WHY IT NO LONGER SAYS IT.** It used to pin a FINDING — that
   * no seeded referral was addressed to an emergency department at all, so this hub's inbox was
   * empty on the seed and could show nothing. That was true when it was written, and it was pinned
   * with an assertion that would fail on the day it stopped being true rather than with a comment
   * nobody would re-read. **The day came:** `RF-009` is seeded, addressed to `rph-ed` for
   * `psychiatric_review`, and this file went red naming its own staleness. The finding is discharged
   * here, and what stands in its place is the assertion the finding was a stand-in for all along:
   * the hub RENDERS that row, with both clocks, in `tests/ward-ed-psychiatry-hub.dom.test.tsx`'s
   * sibling test below.
   *
   * The canary survives the discharge, inverted: the inbox must NOT be empty. A future fixture
   * change that removes the only ED-addressed referral would otherwise return this screen to
   * asserting nothing, silently and greenly.
   */
  it("⚠️ pins RF-005's 165-minute gap as real, and the seeded ED inbox as non-empty", () => {
    const rf005 = seededReferrals.find((referral) => referral.id === "RF-005");
    expect(rf005, "RF-005 left the fixture; the two-clock argument now has no worked example").toBeDefined();

    const clocks = referralClocks(rf005!, NOW_ANCHOR);
    expect(clocks.inDepartment).toBe(185);
    expect(clocks.sinceReferral).toBe(20);
    expect(clocks.inDepartment! - clocks.sinceReferral, "the gap the two clocks exist to show").toBe(165);

    // RF-005 is addressed to a psychiatric ward, so no ED hub can show it. Unchanged, and still the
    // reason the worked example above cannot simply be read off this screen.
    expect(
      allEmergencyDepartments().some((department) =>
        edReferralsFor(seededReferrals, department.id, "psychiatric_review").some(
          (entry) => entry.referral.id === "RF-005",
        ),
      ),
      "RF-005 is now addressed to an emergency department; it is a ward referral and the hub must not hold it",
    ).toBe(false);

    // ⚠️ THE CANARY, INVERTED. The ED psychiatry inbox is what this whole file is about, and an
    // empty one passes every rendering assertion in it by having nothing to render. This fails the
    // day the seed stops addressing an emergency department, instead of letting the screen quietly
    // go back to proving nothing.
    const inbox = edReferralsFor(seededReferrals, HUB_WITH_A_SEEDED_INBOX, "psychiatric_review");
    expect(
      inbox.map((entry) => entry.referral.id),
      `${HUB_WITH_A_SEEDED_INBOX} has no seeded psychiatry inbox any more. Every rendering assertion ` +
        `about this hub now passes by having no row to check — restore an ED-addressed referral, or ` +
        `move these assertions to whatever produces one.`,
    ).toContain(REFERRAL_ON_THE_HUB);
  });

  /**
   * ⚠️ **THE ROW THE FINDING ABOVE WAS STANDING IN FOR — RENDERED, NOT MERELY SEEDED.**
   *
   * `RF-009` was triaged 210 minutes BEFORE anyone referred it to psychiatry: somebody had been in
   * the department three and a half hours before mental health was called. **That gap is the entire
   * argument for showing two clocks rather than one** — a referral-only clock would print "35m" and
   * make this look like a fresh request, and a triage-only clock would print "4h 05m" and make
   * mental health look slow for four hours it could not act on. Neither number alone is the truth,
   * and the truth is the distance between them.
   *
   * So it is asserted ON THE SCREEN, in the words a clinician reads, and not through the fixture or
   * the pure formatter — both of which were already green while this hub rendered nothing at all.
   *
   * ⚠️ **NO HARNESS.** Every other inbox test here raises a referral through `RaiseSelfAddressedReferral`
   * because no product screen can. This one needs none: the row is in the seed, so it is on the hub
   * the moment the hub renders, which is the first time that has been true.
   */
  it("⚠️ renders RF-009's two clocks on the hub, so the 210-minute gap is legible on screen", () => {
    renderHub(HUB_WITH_A_SEEDED_INBOX);

    const row = screen.getByTestId(`ward-ed-inbox-row-${REFERRAL_ON_THE_HUB}`);

    // Both figures from ONE `now` — the machine-readable copies of what the two lines below word.
    expect(row).toHaveAttribute("data-minutes-in-department", "245");
    expect(row).toHaveAttribute("data-minutes-since-referral", "35");
    expect(row).toHaveAttribute("data-since-referral-running", "true");
    expect(245 - 35, "the gap this row exists to show, and the reason one clock is not enough").toBe(210);

    // ⚠️ The department clock: a REAL figure, on the branch this hub could not reach until RF-009
    // was seeded. `splitDuration(245)` — never hours hand-rolled from minutes.
    const department = within(screen.getByTestId(`ward-ed-inbox-department-clock-${REFERRAL_ON_THE_HUB}`));
    expect(department.getByRole("term").textContent).toBe("In department");
    expect(department.getByRole("definition").textContent).toBe("4h 05m since triage");

    // ⚠️ The referral clock: running, and worded as a wait somebody is still serving — because it
    // is. Triage came BEFORE the referral here, so there is nothing left to stop this clock.
    const referral = within(screen.getByTestId(`ward-ed-inbox-referral-clock-${REFERRAL_ON_THE_HUB}`));
    expect(referral.getByRole("term").textContent).toBe("Since referral");
    expect(referral.getByRole("definition").textContent).toBe("35m waiting");

    // ⚠️ And the department clock is never worded as an arrival. A patient arrives, waits, and is
    // triaged some time later; on a night like this one that gap is not small. `triagedAt` is the
    // closest instant the model records, so it is a proxy and is only honest while labelled as one.
    const inbox = screen.getByTestId("ward-ed-inbox").textContent ?? "";
    expect(inbox.toLowerCase(), "the inbox words a triage time as an arrival").not.toContain("arriv");
  });
});

/**
 * ⚠️ MEDICAL CLEARANCE IS THREE STATES AND THE THIRD IS THE ONE THAT MATTERS.
 *
 * Owner instruction, 2026-09-02: the inbox should say whether a patient is medically cleared.
 * Absent means NOBODY HAS ASSESSED IT — it is not "not cleared". A boolean cannot hold that
 * difference, and on the same day this field was added the owner had just ordered the identical
 * defect fixed on the ED referral form's `specialling`, where an unticked checkbox meant both
 * "not required" and "not answered" and the reducer read the ambiguity as a decision.
 *
 * The control is tested WITH the display because a model field with no writer renders as a
 * legitimate-looking empty state and passes every gate.
 */
describe("medical clearance is stated in three states, never two", () => {
  // ⚠️ `rph-ed`, NOT the sibling suite's `peel-ed`. I wrote `peel-ed` first because that constant
  // is the one the neighbouring describe calls BUSY_ED — but it is busy in the OUTBOX, and its
  // psychiatry inbox is empty. `RF-009` is the seed's only referral asking for psychiatric review,
  // and it names `rph-ed` (`ward-movements.ts`). A department with no inbox row makes every
  // assertion below vacuous, which is what the length check guards — and it caught exactly that.
  const CLEARANCE_ED = "rph-ed";

  it("says 'Not assessed' before anyone answers, and never 'No'", () => {
    renderHub(CLEARANCE_ED);
    // The display row only — not the two writer buttons, whose ids share the same prefix.
    const rows = screen.queryAllByTestId(/^ward-ed-inbox-clearance-(?!yes-|no-)/);
    expect(rows.length, "no inbox clearance row rendered — this test asserts over nothing").toBeGreaterThan(0);

    expect(
      rows[0].textContent,
      "an unassessed referral reads as a clinical answer rather than as an absence, so psychiatry " +
        "would take 'nobody has looked' for 'we looked and they are not clear'",
    ).toContain("Not assessed");
  });

  it("records either answer, and distinguishes them", () => {
    renderHub(CLEARANCE_ED);
    const first = screen.getAllByTestId(/^ward-ed-inbox-clearance-yes-/)[0];
    const id = first.getAttribute("data-testid")!.replace("ward-ed-inbox-clearance-yes-", "");

    fireEvent.click(first);
    expect(
      screen.getByTestId(`ward-ed-inbox-clearance-${id}`).textContent,
      "a recorded clearance does not reach the screen, so the control writes nothing a reader can see",
    ).toContain("Yes");

    fireEvent.click(screen.getByTestId(`ward-ed-inbox-clearance-no-${id}`));
    expect(
      screen.getByTestId(`ward-ed-inbox-clearance-${id}`).textContent,
      "'not cleared' is indistinguishable from 'not assessed' on screen — the exact collapse this " +
        "field's three states exist to prevent",
    ).toContain("No");
  });
});

/**
 * ⚠️ THE ED REFERRAL BOARD'S SECOND CLOCK, AND WHY IT IS BLANK ON EVERY SEEDED ROW.
 *
 * The owner asked the board to show a wait time since referral. `Movement.referredAt` was added
 * for it on 2026-09-02 and `REFER_TO_UNITS` stamps it — proved directly in
 * `tests/ward-flow-reducer.test.ts` ("stamps the moment of referral, and the seed carries none
 * before it").
 *
 * ⚠️ NO SEEDED MOVEMENT HAS ONE, because nobody dispatched the event: the seed's referrals were
 * written already-referred. So the branch a user actually sees today is the ABSENT one, and the
 * only thing that can go wrong on screen is the board quietly substituting a different clock —
 * `openedAt` is right there, reads plausibly, and answers a different question.
 *
 * ⚠️ WHAT THIS DOES NOT COVER, said rather than implied: the PRESENT branch's rendering. Reaching
 * it from the DOM needs a harness dispatching `REFER_TO_UNITS`, which must pass the eligibility
 * gates for a real unit, and a harness that silently fails those gates would assert nothing while
 * looking like coverage. The value it renders is proved in the reducer test above; the formatting
 * call is the same `splitDuration` the department clock beside it already uses.
 */
describe("the ED referral board never invents a time since referral", () => {
  // ⚠️ `fsh-ed`, discovered from the seed rather than assumed: `WF-002` is the referred movement
  // whose `originEdId` is this department. `peel-ed` — the constant the sibling suites reach for —
  // has no referred row at all, and picking it made this test assert over nothing. The length
  // check below is what caught that, and it is the reason it is written before the loop.
  const REFERRED_ED = "fsh-ed";

  it("says the referral time is not recorded, rather than showing the department clock twice", () => {
    renderHub(REFERRED_ED);
    const rows = screen.queryAllByTestId(/^ward-ed-referred-/);
    expect(rows.length, "no referred row is rendered on this board, so this test asserts over nothing").toBeGreaterThan(
      0,
    );

    for (const row of rows) {
      expect(
        row.textContent,
        "a referral with no recorded moment shows a wait time anyway — which can only have come " +
          "from another clock, so the board answers a question nobody asked and reads as though " +
          "somebody had recorded it",
      ).toContain("referral time not recorded");
      expect(
        row.textContent,
        "the board claims a time since referral for a movement whose referral moment was never " + "recorded",
      ).not.toContain("since referral");
    }
  });
});
