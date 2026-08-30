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

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
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
import { edReferralsFor } from "@/components/ward-management/ward-referrals";
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
          suburb: "Armadale",
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
    suburb: "Armadale",
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
      suburb: "Armadale",
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

    expect(edReferralsFor(answered.referrals, departments[0].id, "psychiatric_review")).toEqual([]);
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
    expect(screen.getByTestId("ward-ed-inbox-empty")).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-ed-inbox-row-${probe.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-inbox").textContent).toContain("0 referrals");
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

  it("shows no elapsed time anywhere on either list, and says the fact is not recorded", () => {
    renderHub(BUSY_ED);

    for (const testId of ["ward-ed-inbox", "ward-ed-outbox"]) {
      const text = screen.getByTestId(testId).textContent ?? "";
      // The shapes `formatElapsed`/`splitDuration` produce anywhere else on this screen. A referral
      // records no arrival, so a clock started on these rows could never be stopped — and a wrong
      // length of stay looks plausible in a way a wrong clock does not.
      expect(text, `${testId} renders an elapsed figure`).not.toMatch(/\b\d+\s*h\s*\d*\s*m\b/);
      expect(text, `${testId} renders a "time since" figure`).not.toMatch(/\bago\b/i);
    }
    expect(screen.getByTestId("ward-ed-outbox").textContent).toContain("Not recorded");
  });
});

describe("the inbox's decline control", () => {
  /**
   * ⚠️ **THE CONTROL IS PRESENT AND UNAVAILABLE, AND WHICH OF THOSE IS WHICH MATTERS.**
   *
   * Every referral is declinable — the superseded `FD-3` guard said no action was ever rendered on
   * a medical notification and the owner reversed it. So its unavailability must never be a rule
   * about WHAT may be declined. It is `EVENT_ROLE.DECLINE_REFERRAL` being `["ward", "coordinator"]`
   * while this screen acts as `"ed"`: a wired control here would be silently refused by the
   * reducer, and dispatching as `"ward"` to make it work would record `decidedBy: "Ward manager"`
   * against a decision ED psychiatry made.
   *
   * Not rendered against a live row, because no producer can raise a `psychiatric_review` referral
   * today — the reason is asserted where it lives, so the claim cannot silently become vacuous the
   * day the inbox is empty for some other reason.
   */
  it("states a permission as the reason, never a rule about which referrals may be declined", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const reason = screen.getByText(/Declining is not yet recordable from this screen/);
    expect(reason.textContent).toContain("not a rule about which referrals may be declined");
    expect(reason.textContent).toContain("every referral may be");
  });

  it("renders the control, unavailable, on the row — never omits it", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const { id, count } = probeParts();
    expect(count, "the harness raised nothing, so there is no row to carry a control").toBe(SEEDED_REFERRALS + 1);

    const decline = screen.getByTestId(`ward-ed-inbox-decline-${id}`);
    expect(decline).toHaveAttribute("aria-disabled", "true");
    // `docs/wiring-conventions.md`: never the native attribute, which removes the tab stop the
    // reason is announced from — and never both, which is the shape `require-button-wiring` fails.
    expect(decline, "a native disabled removes the tab stop the stated reason is announced from").not.toHaveAttribute(
      "disabled",
    );
    expect(decline.getAttribute("aria-describedby")).toBe(
      screen.getByText(/Declining is not yet recordable from this screen/).id,
    );
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

  it("shows no elapsed figure on a row that has one to be wrong about", () => {
    renderHubWithHarness("jhc-ed");
    fireEvent.click(screen.getByTestId("harness-raise-review"));

    const inbox = screen.getByTestId("ward-ed-inbox");
    expect(within(inbox).getAllByRole("listitem").length).toBe(1);
    expect(inbox.textContent ?? "", "the inbox renders an elapsed figure").not.toMatch(/\b\d+\s*h\s*\d*\s*m\b/);
    expect(inbox.textContent).toContain("Not recorded");
  });
});
