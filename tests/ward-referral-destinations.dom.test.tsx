import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors and this suite
// never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  communityTeamOptions,
  destinationOptions,
  suburbOptions,
  type DestinationOption,
} from "@/components/ward-management/referrals/referral-destination-options";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { CONTESTED_SUBURBS, lookupCatchment } from "@/components/ward-management/ward-catchment";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  COHORTS,
  HOME_REGIONS,
  PARALLEL_REFERRAL_CAP,
  REFERRAL_DESTINATION_KINDS,
  SEXES,
  URGENCY_LEVELS,
  type Referral,
  type Unit,
  type WardReferralDestination,
  SUBURB_UNKNOWN_REASONS,
} from "@/components/ward-management/ward-model";
import { referrals as seededReferrals } from "@/components/ward-management/ward-movements";
import { WARD_NAV } from "@/components/ward-management/ward-nav";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * THE REFERRAL DESTINATION PICKER — what a referring clinician is shown at the moment of choosing.
 *
 * Spec Part 7, "What the referrer IS shown" (`docs/ward-flow-referral-destination-spec.md`), and
 * FD-21: several destinations chosen in ONE act, up to `PARALLEL_REFERRAL_CAP`.
 *
 * Every test here pins a property the owner named in words, not an implementation detail:
 *
 *   - an option the catchment table cannot place is GREYED, never removed and never disabled;
 *   - a ward with no free bed is still offered;
 *   - a decline removes nothing from the list;
 *   - two of the same kind cannot be raised, and a double selection is never silently collapsed;
 *   - there is no free-text input anywhere on this screen;
 *   - a contested catchment is said, and never chosen for the clinician.
 *
 * NON-VACUITY runs through the file: every list assertion first pins that the list is non-empty
 * and carries the count the fixture implies, so a picker built over an empty array — the way this
 * whole family of tests passes while showing the clinician nothing — cannot read as green.
 */

const WARD_NEED: WardReferralDestination = {
  kind: "psychiatric_ward",
  sex: SEXES[0],
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
};

/** A suburb the source table places with exactly one team, chosen FROM the table rather than
 *  written down here: a hand-picked spelling rots the day the table is re-extracted. */
function reviewedSuburb(): string {
  const found = suburbOptions().find((suburb) => lookupCatchment(suburb).state === "reviewed");
  expect(found, "no suburb in the source table resolves to a reviewed catchment").toBeDefined();
  return found as string;
}

/** One of the five cross-document contradictions, read from the data that records them. */
function contestedSuburb(): string {
  expect(CONTESTED_SUBURBS.length, "no contested suburbs are recorded").toBeGreaterThan(0);
  return CONTESTED_SUBURBS[0].suburb;
}

function optionsFor(overrides: Partial<Parameters<typeof destinationOptions>[0]> = {}): DestinationOption[] {
  return destinationOptions({
    suburb: null,
    ward: WARD_NEED,
    ageBand: COHORTS[0],
    units: allUnits(),
    referrals: seededReferrals,
    now: NOW_ANCHOR,
    ...overrides,
  });
}

function optionFor(kind: (typeof REFERRAL_DESTINATION_KINDS)[number], overrides = {}): DestinationOption {
  const found = optionsFor(overrides).find((option) => option.kind === kind);
  expect(found, `no option was built for ${kind}`).toBeDefined();
  return found as DestinationOption;
}

/**
 * The destinations that can still travel on ONE referral.
 *
 * Deliberately NOT `REFERRAL_DESTINATION_KINDS` any more: `{ward, community}` is refused at
 * intake on the owner’s ruling, so a test that ticks every kind would be asserting that the
 * form sends a combination it must refuse. Written out rather than derived, so that adding a
 * fourth kind makes somebody decide whether it may travel with the others.
 */
const SENDABLE_TOGETHER = ["emergency_department", "community_team"] as const;

describe("Referral destinations — the option list itself", () => {
  it("offers exactly one option per destination kind, and never more than the parallel cap", () => {
    const options = optionsFor();

    // Non-vacuity first: an empty list would satisfy every "no option does X" assertion below.
    expect(options.length, "the picker offered no destinations at all").toBeGreaterThan(0);
    expect(options).toHaveLength(REFERRAL_DESTINATION_KINDS.length);
    // The count the fixture implies, written out rather than derived, so a kind quietly dropped
    // from the model is a decision somebody takes here rather than a number that moves on its own.
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.kind).sort()).toEqual([...REFERRAL_DESTINATION_KINDS].sort());

    // THE CAP, enforced where it can actually be enforced. One option per kind means the screen
    // cannot offer more than there are kinds; this is what makes that safe rather than lucky.
    expect(REFERRAL_DESTINATION_KINDS.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
  });

  it("orders by catchment, then by name", () => {
    expect(optionsFor({ suburb: reviewedSuburb() }).map((option) => option.label)).toEqual([
      "Community team",
      "Emergency department",
      "Psychiatric ward",
    ]);
  });

  it("carries no rank, score, weight or percentage on any option", () => {
    for (const option of optionsFor({ suburb: reviewedSuburb() })) {
      expect(Object.keys(option)).not.toContain("score");
      expect(Object.keys(option)).not.toContain("rank");
      expect(Object.keys(option)).not.toContain("weight");
      for (const sentence of [option.catchment.sentence, ...option.figures, ...option.reasons]) {
        expect(sentence, `${option.kind} shows a percentage: ${sentence}`).not.toMatch(/%/);
        expect(sentence, `${option.kind} shows a rank or score: ${sentence}`).not.toMatch(/\b(score|rank|rating)\b/i);
      }
    }
  });
});

describe("Referral destinations — catchment, said rather than guessed", () => {
  it("names the team the source table places this suburb with, and suggests that option", () => {
    const suburb = reviewedSuburb();
    const option = optionFor("community_team", { suburb });

    expect(option.catchment.placedBySourceTable).toBe(true);
    expect(option.catchment.outsideTheTable).toBe(false);
    expect(option.catchment.sentence).toContain(suburb);
    expect(option.suggested).toBe(true);
    expect(option.reasons.join(" ")).toMatch(/serves this patient's suburb/i);
  });

  it("says a contested catchment is contested, carries both readings, and suggests nothing", () => {
    const option = optionFor("community_team", { suburb: contestedSuburb() });

    expect(option.catchment.placedBySourceTable).toBe(false);
    expect(option.catchment.outsideTheTable).toBe(true);
    // Both readings, each attributed — spec Part 5. A sentence naming one team would be the
    // silent routing that Part 5 refuses.
    const readings = CONTESTED_SUBURBS[0].answers;
    expect(readings.length, "the contested fixture carries fewer than two readings").toBeGreaterThan(1);
    for (const reading of readings) {
      expect(option.catchment.sentence).toContain(reading.clinics.join(" or "));
    }
    // NOT auto-selected: a contested suburb does not route.
    expect(option.suggested).toBe(false);
  });

  it("says so when the suburb is not in the source table, and does not suggest a team", () => {
    const option = optionFor("community_team", { suburb: "Nowhere In The Table" });

    expect(option.catchment.placedBySourceTable).toBe(false);
    expect(option.catchment.outsideTheTable).toBe(true);
    expect(option.suggested).toBe(false);
  });

  it("claims no catchment at all when no suburb has been chosen", () => {
    const option = optionFor("community_team", { suburb: null });

    expect(option.catchment.placedBySourceTable).toBe(false);
    // Nothing is known, so nothing is outside anything: an unanswered question is not a deviation.
    expect(option.catchment.outsideTheTable).toBe(false);
    expect(option.suggested).toBe(false);
  });

  it("says plainly that a ward and an emergency department have no catchment in these sources", () => {
    const suburb = reviewedSuburb();
    for (const kind of ["psychiatric_ward", "emergency_department"] as const) {
      const option = optionFor(kind, { suburb });
      expect(option.catchment.placedBySourceTable).toBe(false);
      expect(option.catchment.outsideTheTable).toBe(false);
      expect(option.catchment.sentence).toMatch(/approved-hospital column is not seeded/i);
    }
  });
});

describe("Referral destinations — nothing is removed from the list", () => {
  it("still offers a psychiatric ward when no unit in the network has a free bed", () => {
    const noBeds: Unit[] = allUnits().map((unit) => ({
      ...unit,
      empty: { ...unit.empty, value: 0 },
      allocatable: { ...unit.allocatable, value: 0 },
    }));
    expect(noBeds.length, "the network fixture holds no units at all").toBeGreaterThan(0);

    const option = optionFor("psychiatric_ward", { units: noBeds });

    expect(option.figures.join(" ")).toContain(`0 of ${noBeds.length}`);
    // Offered anyway — the owner's rule. A ward with no bed today is still the right place to ask.
    expect(option.reasons.join(" ")).toMatch(/still offered/i);
  });

  it("still offers a psychiatric ward when a ward has already declined a referral", () => {
    const declined: Referral[] = [
      {
        id: "RF-declined-probe",
        destinations: [
          { destination: WARD_NEED, state: "declined", decidedAt: NOW_ANCHOR, declineReason: "no_suitable_bed" },
        ],
        ageBand: COHORTS[0],
        homeRegion: HOME_REGIONS[0],
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        raisedAt: NOW_ANCHOR - 60,
        urgency: URGENCY_LEVELS[0],
        originSiteCode: wardSites[0].code,
        transportNeeded: false,
      },
    ];

    const options = destinationOptions({
      suburb: null,
      ward: WARD_NEED,
      ageBand: COHORTS[0],
      units: allUnits(),
      referrals: declined,
      now: NOW_ANCHOR,
    });

    expect(options.map((option) => option.kind)).toContain("psychiatric_ward");
    expect(options).toHaveLength(REFERRAL_DESTINATION_KINDS.length);
  });
});

/** The newest referral's destination kinds, as the REDUCER holds them. */
function NewestDestinations() {
  const { referrals } = useWardFlow();
  const newest = referrals[referrals.length - 1];
  return (
    <>
      <span data-testid="referral-count">{referrals.length}</span>
      <span data-testid="newest-patient-id">{newest ? (newest.patientId ?? "none") : "no referral"}</span>
      <span data-testid="newest-destinations">
        {newest ? newest.destinations.map((addressing) => addressing.destination.kind).join(",") : "none"}
      </span>
    </>
  );
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
      <NewestDestinations />
    </WardFlowProvider>,
  );
}

function selectAnswer(field: string, value: string) {
  fireEvent.change(screen.getByTestId(`ward-referral-intake-${field}`), { target: { value } });
}

function chooseNeed(field: string, answer: "yes" | "no") {
  fireEvent.click(screen.getByTestId(`ward-referral-intake-${field}-${answer}`));
}

/** Answers every question except the destinations, which each test chooses for itself. */
function answerEverythingButTheDestination() {
  selectAnswer("ageBand", COHORTS[0]);
  selectAnswer("sex", SEXES[0]);
  selectAnswer("homeRegion", HOME_REGIONS[0]);
  // 2026-08-30: the suburb became a required answer when `Referral` gained a place to put it.
  // A real name from the catchment table, because the reducer resolves it rather than
  // measuring its length.
  selectAnswer("suburb", "Armadale");
  selectAnswer("source", "community");
  selectAnswer("urgency", String(URGENCY_LEVELS[0]));
  selectAnswer("originSiteCode", wardSites[0].code);
  chooseNeed("secureBedNeeded", "no");
  chooseNeed("involuntaryBedNeeded", "no");
  chooseNeed("transportNeeded", "no");
}

function destinationCheckbox(kind: string): HTMLInputElement {
  return screen.getByTestId(`ward-referral-intake-destination-${kind}`) as HTMLInputElement;
}

describe("Referral destinations — on the screen", () => {
  it("renders one checkbox per kind, none of them chosen on a blank form", () => {
    renderForm();

    const group = screen.getByTestId("ward-referral-intake-destinations");
    const boxes = within(group).getAllByRole("checkbox");
    expect(boxes.length, "the destination picker rendered no options").toBeGreaterThan(0);
    expect(boxes).toHaveLength(REFERRAL_DESTINATION_KINDS.length);
    for (const box of boxes) expect(box).not.toBeChecked();
  });

  it("chooses nothing for the clinician even when the catchment is contested", () => {
    renderForm();
    selectAnswer("suburb", contestedSuburb());

    const group = screen.getByTestId("ward-referral-intake-destinations");
    for (const box of within(group).getAllByRole("checkbox")) expect(box).not.toBeChecked();
  });

  it("keeps Send unavailable, naming the destination, until one is chosen", () => {
    renderForm();
    answerEverythingButTheDestination();

    expect(screen.getByTestId("ward-referral-intake-unavailable")).toHaveTextContent("Destination");
    expect(screen.getByTestId("ward-referral-intake-submit")).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(destinationCheckbox("psychiatric_ward"));

    expect(screen.queryByTestId("ward-referral-intake-unavailable")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-submit")).not.toHaveAttribute("aria-disabled");
  });

  it("sends every destination chosen in one act, one per kind, with no rejection", () => {
    renderForm();
    answerEverythingButTheDestination();

    const before = Number(screen.getByTestId("referral-count").textContent);
    /*
     * 2026-09-03: this ticked ALL THREE kinds until the intake refusal for `{ward, community}`
     * landed, and it is now the two that can still be sent together.
     *
     * ⚠️ **THIS TEST WENT RED A THIRD TIME, AND THE RED WAS AGAIN CORRECT** — the pair it was
     * ticking is the one shape the board treats as legacy-only, and the form could create it.
     * The tempting repair was to keep all three and assert the refusal here instead, which
     * would have quietly turned the one test that proves MULTIPLE destinations send together
     * into a test that proves nothing sends at all. The refusal has its own test below.
     */
    for (const kind of SENDABLE_TOGETHER) fireEvent.click(destinationCheckbox(kind));
    /*
     * 2026-08-30: choosing the emergency department now raises a question of its own — WHICH
     * department — and Send waits on it exactly as it waits on the ten unconditional ones.
     *
     * ⚠️ **THIS TEST WENT RED WHEN THAT LANDED, AND THE RED WAS CORRECT**: it ticked all three
     * kinds and sent without naming a department, and Send stayed unavailable, so no referral was
     * created and the count assertion below said so ("expected 8 to be 9"). Answered here rather
     * than worked around; a cast, or a placeholder `edId`, would have kept this green while the
     * form sent a department nobody chose — and `RECEIVE_REFERRAL` does not validate `edId`, so
     * nothing downstream would have caught it either.
     */
    fireEvent.change(screen.getByTestId("ward-referral-intake-edId"), {
      target: { value: allEmergencyDepartments()[0].id },
    });
    /*
     * 2026-08-31: and it happened a SECOND time, for the community team, which is why the paragraph
     * above is worth having rather than being folded away as history. Choosing the community
     * destination now raises WHICH team, on the owner's ruling that association comes from the team
     * named on the referral rather than from the patient's home region.
     *
     * ⚠️ **THIS TEST WENT RED AGAIN, AND THE RED WAS AGAIN CORRECT.** The tempting repair was to
     * seed the team from the catchment lookup for this suburb, since the form already displays it.
     * That is precisely the defect the ruling removed: the table SUGGESTS a clinic and answers
     * `contested` or `unreviewed` often enough that a suggestion promoted to an answer is a guess
     * in the record. The question is answered here, as a clinician answers it.
     */
    fireEvent.change(screen.getByTestId("ward-referral-intake-teamName"), {
      target: { value: communityTeamOptions()[0] },
    });
    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    // FOUND BY MUTATION. Without this line, a screen that sent a malformed list — four
    // destinations, or the same kind twice — reddened the assertions below with a MISLEADING
    // message: the reducer refuses such an event, no referral is created, and "newest" then reads
    // the SEED's last referral, so the failure said "expected 1 to be 3" and pointed at a record
    // this test never created. Pinning the count first says the true thing instead: nothing was
    // raised at all.
    expect(Number(screen.getByTestId("referral-count").textContent), "no referral was created").toBe(before + 1);

    const sent = (screen.getByTestId("newest-destinations").textContent ?? "").split(",");
    expect(sent).toHaveLength(SENDABLE_TOGETHER.length);
    expect(sent.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
    // Refused rather than de-duplicated by the reducer, so the screen must never be able to
    // produce a repeat in the first place: one checkbox per kind is what makes that structural.
    expect(new Set(sent).size).toBe(sent.length);
    expect(screen.getByTestId("ward-referral-intake-confirmation")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-intake-rejection")).not.toBeInTheDocument();
  });

  /*
   * The owner's ruling, recorded in `ward-referral-visibility.ts` beside the visibility table
   * that reasons about what the product can still CREATE once this refusal exists. Until it
   * did, the form could raise the one combination downstream logic treats as legacy-only.
   */
  it("⚠️ refuses a psychiatric bed and a community team on ONE referral, and says why", () => {
    renderForm();
    answerEverythingButTheDestination();

    const before = Number(screen.getByTestId("referral-count").textContent);
    fireEvent.click(destinationCheckbox("psychiatric_ward"));
    fireEvent.click(destinationCheckbox("community_team"));
    fireEvent.change(screen.getByTestId("ward-referral-intake-teamName"), {
      target: { value: communityTeamOptions()[0] },
    });

    // Stated, not merely inert. A dead Send with no reason reads as a broken form, and the
    // repository's wiring conventions require the reason to be reachable by a screen reader
    // rather than implied by a greyed control.
    const note = screen.getByTestId("ward-referral-intake-refused-combination");
    expect(note).toBeInTheDocument();
    const submit = screen.getByTestId("ward-referral-intake-submit");
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit.getAttribute("aria-describedby")).toBe(note.getAttribute("id"));

    fireEvent.click(submit);
    expect(
      Number(screen.getByTestId("referral-count").textContent),
      "the form raised the combination it refuses — the note appeared and the referral went anyway",
    ).toBe(before);
  });

  it("still allows an emergency department and a community team together — the pair the ruling KEEPS", () => {
    renderForm();
    answerEverythingButTheDestination();

    fireEvent.click(destinationCheckbox("emergency_department"));
    fireEvent.click(destinationCheckbox("community_team"));
    fireEvent.change(screen.getByTestId("ward-referral-intake-edId"), {
      target: { value: allEmergencyDepartments()[0].id },
    });
    fireEvent.change(screen.getByTestId("ward-referral-intake-teamName"), {
      target: { value: communityTeamOptions()[0] },
    });

    // The false direction. A refusal written as `length > 1`, or as any pair containing a
    // community team, would pass the test above and break this one — which is the whole
    // reason both exist.
    expect(
      screen.queryByTestId("ward-referral-intake-refused-combination"),
      "the refusal caught {ED, community}, which the same ruling deliberately keeps",
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-submit")).not.toHaveAttribute("aria-disabled");
  });

  /*
   * ⚠️ FOUND BY ADVERSARIAL REVIEW, AND IT IS THE TEST THAT CLOSES THE FAMILY.
   *
   * `kinds.includes("psychiatric_ward") && kinds.length > 1` passes every other test in this
   * file — it refuses {ward, community}, allows {ED, community}, and allows {ward} alone — and
   * is still wrong: it refuses a bed request that ALSO asks an emergency department to see the
   * patient, which is the ordinary parallel referral `PARALLEL_REFERRAL_CAP` exists to permit.
   * The clinician would have been told to send two referrals for a legitimate pair.
   *
   * No test here ever ticked those two together: the send tests are ward alone, ED+community,
   * ward+community, and community alone. The ward+ED pairing appeared only in a catchment
   * assertion, which never reaches the gate. Every over-broad formulation that survives the
   * other three fails this one.
   */
  it("⚠️ still allows a bed AND an emergency department — the pair an over-broad refusal breaks", () => {
    renderForm();
    answerEverythingButTheDestination();

    const before = Number(screen.getByTestId("referral-count").textContent);
    fireEvent.click(destinationCheckbox("psychiatric_ward"));
    fireEvent.click(destinationCheckbox("emergency_department"));
    fireEvent.change(screen.getByTestId("ward-referral-intake-edId"), {
      target: { value: allEmergencyDepartments()[0].id },
    });

    expect(
      screen.queryByTestId("ward-referral-intake-refused-combination"),
      "the refusal caught a bed plus an emergency department, which is an ordinary parallel referral",
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));
    expect(Number(screen.getByTestId("referral-count").textContent), "the pair was refused rather than sent").toBe(
      before + 1,
    );
  });

  it("greys an option the catchment table cannot place, and still lets a clinician choose it", () => {
    renderForm();
    selectAnswer("suburb", contestedSuburb());

    const option = screen.getByTestId("ward-referral-intake-destination-option-community_team");
    expect(option).toHaveAttribute("data-outside-catchment", "true");

    const box = destinationCheckbox("community_team");
    // Never removed, never disabled — neither the native attribute nor the aria one.
    expect(box).not.toBeDisabled();
    expect(box).not.toHaveAttribute("aria-disabled");

    fireEvent.click(box);
    expect(box).toBeChecked();
  });

  it("has no free-text input anywhere on the screen", () => {
    const { container } = renderForm();

    expect(container.querySelectorAll("textarea")).toHaveLength(0);
    expect(container.querySelectorAll("[contenteditable]")).toHaveLength(0);

    const inputs = [...container.querySelectorAll("input")];
    expect(inputs.length, "the form rendered no inputs at all").toBeGreaterThan(0);
    for (const input of inputs) {
      expect(["radio", "checkbox"], `a ${input.type} input can be typed into`).toContain(input.type);
    }
  });

  it("gives the suburb picker every suburb the source table names, and no free text", () => {
    renderForm();

    const suburb = screen.getByTestId("ward-referral-intake-suburb") as HTMLSelectElement;
    expect(suburbOptions().length, "the suburb list is empty").toBeGreaterThan(0);
    // One leading "choose one" prompt, every suburb the table names, and every honest answer for a
    // patient who has no suburb to give. The last group is counted from `SUBURB_UNKNOWN_REASONS`
    // rather than added as "+1", so the day "no fixed abode" becomes a second answer this stays
    // true without anybody remembering to come back.
    expect(suburb.options).toHaveLength(suburbOptions().length + SUBURB_UNKNOWN_REASONS.length + 1);
    for (const reason of SUBURB_UNKNOWN_REASONS) {
      expect(
        [...suburb.options].some((option) => option.value === reason),
        `the picker offers no way to say "${reason}", so a patient of no fixed abode cannot be referred ` +
          "and the way past this control is to choose a suburb that is not theirs",
      ).toBe(true);
    }
  });
});

/**
 * ⚠️ THE PATIENT LINK'S READ HALF — proved because a pointer nothing reads is the same defect as a
 * field nothing writes, arriving from the other side.
 *
 * The Refer button on `person-screen.tsx` carries `?patientId=` to this form. If this form does not
 * read it, the button appends a parameter nobody consumes, the referral records no person, and
 * NOTHING FAILS — the screen still says the referral is recorded against them, which would then be
 * false. Owner ruling 2026-09-02.
 */
describe("the referral intake carries the person through, or records none", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("records the patient the Refer button named", async () => {
    // ⚠️ THIS USED TO HAND-WRITE THE QUERY STRING BELOW — "?patientId=PT-001" — WHICH IS THE
    // EXACT DEFECT AN ADVERSARIAL REVIEW FOUND. Renaming ONLY the producer's key at
    // `person-screen.tsx:119` (`patientId` -> `patient`) left every one of 75 tests across this
    // file, `ward-person-screen.dom.test.tsx` and `ward-referral-model.test.ts` green, because a
    // hand-typed literal here just re-asserts what the reader below already expects — it never
    // touches what the Refer link actually emits. Producer and reader agreed with each other
    // about a string neither of them was required to produce.
    //
    // So this test now renders the real person screen and reads the Refer link's actual `href`,
    // then feeds THAT into the intake instead of retyping it. If the producer's query key ever
    // changes, the href below changes with it and the pushState call — and the assertion at the
    // bottom of this test — go with it. Two hardcoded copies of "patientId" would have looked like
    // a second, independent check and would not have been: it is the same single fact typed twice.
    const personRender = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId="PT-001" />
      </WardFlowProvider>,
    );
    const referHref = personRender.getByTestId("ward-person-refer").getAttribute("href");
    expect(referHref, "the Refer link rendered with no href at all").toBeTruthy();
    personRender.unmount();

    window.history.pushState({}, "", referHref as string);
    renderForm();
    answerEverythingButTheDestination();
    fireEvent.click(destinationCheckbox("community_team"));
    selectAnswer("teamName", "Inner City Clinic");
    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    await waitFor(() => {
      expect(
        screen.getByTestId("newest-patient-id").textContent,
        "the form dropped the person between the link and the record — the button appends a " +
          "parameter nobody reads, and the person screen's promise that the referral is recorded " +
          "against them becomes false with nothing failing",
      ).toBe("PT-001");
    });
  });

  it("⚠️ records NO person when the form was opened directly, rather than inventing one", async () => {
    renderForm();
    answerEverythingButTheDestination();
    fireEvent.click(destinationCheckbox("community_team"));
    selectAnswer("teamName", "Inner City Clinic");
    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    await waitFor(() => {
      expect(
        screen.getByTestId("newest-patient-id").textContent,
        "a referral raised with nobody on file was given a patient anyway — an invented link points " +
          "at a real person who was never referred, which is worse than an absent one",
      ).toBe("none");
    });
  });
});

/**
 * ⚠️ THE FRONT-DOOR RULING: a `patientId` that names nobody is refused BEFORE the form appears,
 * never only at Send. The reducer's own `RECEIVE_REFERRAL` refusal (`ward-flow-reducer.ts`,
 * `tests/ward-referral-model.test.ts`) is unchanged and stays reachable by anything that dispatches
 * the event directly — this describe block is the screen's own, independent refusal, proved at the
 * DOM the same way the two tests above prove the read half of the same link.
 *
 * THREE STATES, and only the third changes here: no `?patientId=` at all is a real case (a referral
 * raised by opening this form directly, tested above and again below); a `?patientId=` naming a
 * real person is unchanged; a `?patientId=` naming nobody is what this task turns into a refusal.
 * Collapsing the first into the third — refusing an ABSENT id too — would close the front door this
 * form exists to keep open, which is why the second and third tests below sit beside the first.
 */
describe("the referral intake refuses at load for a patientId naming nobody, not only at Send", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("⚠️ shows the refusal and the route to the person search, never the form, for a patientId naming nobody", () => {
    window.history.pushState({}, "", "/mockups/ward-flow/referrals/new?patientId=PT-999");
    renderForm();

    expect(screen.getByTestId("ward-referral-intake-unknown-patient")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-intake-form")).not.toBeInTheDocument();

    // The route is read off `WARD_NAV` here too, not retyped, for the same reason
    // `referral-intake.tsx`'s own `PATIENT_SEARCH_HREF` is: a hand-typed copy of the path could
    // agree with a stale route and never notice the day it moved.
    const expectedSearchHref = WARD_NAV.find((item) => item.id === "search")?.href;
    expect(expectedSearchHref, "the person search disappeared from WARD_NAV").toBeTruthy();
    expect(screen.getByTestId("ward-referral-intake-unknown-patient-search")).toHaveAttribute(
      "href",
      expectedSearchHref,
    );
  });

  it("still loads the form when the patientId names a real person", () => {
    window.history.pushState({}, "", "/mockups/ward-flow/referrals/new?patientId=PT-001");
    renderForm();

    expect(screen.getByTestId("ward-referral-intake-form")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-intake-unknown-patient")).not.toBeInTheDocument();
  });

  it("still loads the form, with nobody attached, when there is no patientId at all — the real front-door case", () => {
    renderForm();

    expect(screen.getByTestId("ward-referral-intake-form")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-intake-unknown-patient")).not.toBeInTheDocument();
  });
});
