// tests/caring-contacts-plan-wizard.dom.test.tsx
//
// The activation wizard's shell and its first two stages (Phase 2B Task 7).
//
// This is where the stages themselves are proved. The browser suite
// (`tests/ui-caring-contacts-workspace.spec.ts`) cannot reach them: its isolated server seeds no
// referrals, so `/caring-contacts/plans/new` always renders the screen's own statement of what it
// needs, and a fabricated referral id in that spec would render the same screen while pretending
// to prove a stage. Here a referral can simply be supplied as a prop.
//
// What is pinned, and why each one:
//
//   * Ruling [112] — stage 1 separates what was READ from the referral from what the COORDINATOR
//     confirms, and labels each. The mockup blends them and sources a patient name and a mobile
//     number to "Imported referral record"; a `Referral` carries neither, so those rows cannot be
//     built and their absence is asserted rather than assumed.
//   * Ruling [113] — stage 2 states a pathway the referral already names as an existing decision
//     with its provenance, and says so again, differently, once the coordinator changes it.
//   * Ruling [110] — the draft survives a remount and is gone after Discard draft.
//   * Ruling 52 — stages 3 and 4 are unavailable controls with a stated reason, never dead ends.
import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PLAN_DRAFT_STORAGE_KEY,
  clearPlanDraft,
  readPlanDraft,
} from "@/components/caring-contacts/workspace/plan-wizard/plan-draft";
import { createPlanPatientDetail } from "@/components/caring-contacts/workspace/plan-wizard/patient-detail";
import { PlanWizard, type PlanWizardProps } from "@/components/caring-contacts/workspace/plan-wizard/plan-wizard";
import { planWizardStageImplementation } from "@/components/caring-contacts/workspace/plan-wizard/stages";
import { SENDING_PREFERENCE_OPTIONS } from "@/lib/caring-contacts/schedule";
import { DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS } from "@/lib/caring-contacts/synthetic-contacts";

import { stripSourceComments } from "./helpers/strip-source-comments";

const REFERRAL = "SYN-REFERRAL-001";
const PATIENT = "SYN-PATIENT-001";
const TEAM = "SYN-TEAM-001";
const NAMED_PATHWAY = "SYN-PATHWAY-001";
const OTHER_PATHWAY = "SYN-PATHWAY-002";

/**
 * The reserved fictional patient mobiles, read from the sealed domain rather than written out.
 *
 * A literal here would be a second copy of `synthetic-contacts.ts`'s list, so a test asserting the
 * screen names "the reserved numbers" could go on passing after the reserved numbers changed.
 */
const FICTIONAL_PATIENT_MOBILES = DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS;

function pathwayOption(id: string) {
  return {
    id,
    cadenceLabels: ["Day 1", "Week 1", "Month 1"],
    approvedBy: ["the clinical programme lead", "the lived-experience representative"],
    publishedAt: null,
  };
}

function renderWizard(overrides: Partial<PlanWizardProps> = {}) {
  const props: PlanWizardProps = {
    referralId: REFERRAL,
    patientId: PATIENT,
    teamId: TEAM,
    actorId: "demo-coordinator",
    actorRoleLabels: ["coordinator"],
    referralPathwayVersionId: NAMED_PATHWAY,
    pathwayOptions: [pathwayOption(NAMED_PATHWAY), pathwayOption(OTHER_PATHWAY)],
    // Both resolved on the server in production, for the reason round 1 finding M-2 established:
    // a screen must never re-derive a rule a module owns, and resolving here keeps the domain
    // modules out of the client bundle.
    sendingPreferenceOptions: SENDING_PREFERENCE_OPTIONS,
    fictionalPatientMobileNumbers: FICTIONAL_PATIENT_MOBILES,
    ...overrides,
  };
  return { ...render(<PlanWizard {...props} />), props };
}

/** Ticks both stage-1 confirmations and moves to stage 2. */
async function reachPathwayStage(user: ReturnType<typeof userEvent.setup>) {
  for (const box of screen.getAllByRole("checkbox")) await user.click(box);
  await user.click(screen.getByRole("button", { name: /Continue to pathway/ }));
  return screen.getByRole("region", { name: "Pathway" });
}

/** Ticks the confirmations, chooses a pathway, and moves to stage 3. */
async function reachPersonalisationStage(user: ReturnType<typeof userEvent.setup>) {
  await reachPathwayStage(user);
  await user.click(screen.getByRole("radio", { name: new RegExp(NAMED_PATHWAY) }));
  await user.click(screen.getByRole("button", { name: /Continue to personalisation/ }));
  return screen.getByRole("region", { name: "Personalisation" });
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  // The store holds module-level state that clearing storage by hand does not reach.
  clearPlanDraft();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearPlanDraft();
});

describe("the caring-contacts plan wizard — stage 1, agreement (Ruling [112])", () => {
  it("shows what the referral actually carries, separately from what the coordinator confirms", async () => {
    renderWizard();

    const read = screen.getByText("Read from the referral").closest("div");
    expect(read).not.toBeNull();
    expect(read!).toHaveTextContent(REFERRAL);
    expect(read!).toHaveTextContent(PATIENT);
    expect(read!).toHaveTextContent(TEAM);

    // The provenance is the point. A clinician's own tick presented as an imported record would be
    // lying about where a fact came from, on a screen whose whole purpose is assurance.
    const confirmed = screen.getByText("Confirmed by you").closest("div");
    expect(confirmed).not.toBeNull();
    expect(within(confirmed!).getAllByRole("checkbox")).toHaveLength(2);
    expect(confirmed!).toHaveTextContent(/not imported facts/i);
  });

  it("claims no patient name and no mobile number, because a referral holds neither", () => {
    const { container } = renderWizard();
    const text = container.textContent ?? "";

    // The mockup's `AgreementStage` renders `patient.fullName · patient.id` and a mobile-suitability
    // row, both sourced "Imported referral record". `Referral` in model.ts is five fields and none
    // of them is either, so no wording here may claim one was imported.
    expect(text).not.toMatch(/imported referral record/i);
    // The one place a mobile number is mentioned is a confirmation the coordinator makes, and it
    // says the number will be used, never that it was read from anywhere.
    expect(text).toMatch(/mobile number this plan will use is the patient’s own/i);
    expect(text).toMatch(/entered at personalisation/i);
  });

  it("never tells a clinician the confirmations are kept, on a screen whose own panel says they are not", async () => {
    // Round 1, finding M-6. The status line under the confirmations used to read "Both
    // confirmations are recorded for this sign-up", directly beneath a panel stating that nothing
    // in this domain records them. "Confirmed" is true; "recorded" is not, and the gap is with the
    // owner as a schema decision — a screen implying it is already handled is the one thing that
    // could make that decision look unnecessary.
    const user = userEvent.setup();
    const { container } = renderWizard();
    for (const box of screen.getAllByRole("checkbox")) await user.click(box);

    const text = container.textContent ?? "";
    // Pinned as a whole sentence, not a loose match — round 2, item 1. The replacement for M-6's
    // wording was itself untrue in the other direction ("Neither is stored anywhere", on a screen
    // whose own draft notice says the opposite), and a looser assertion would not have caught it.
    expect(text).toContain(
      "Both confirmations are ticked, so a pathway can be chosen. Neither is recorded on the plan; like everything else on this screen, they are kept on this computer until you finish or discard.",
    );
    expect(text, "the screen claims the confirmations are recorded").not.toMatch(/confirmations are recorded/i);
    // The understating direction is the more dangerous one on a shared ward computer: it gives a
    // clinician a reason NOT to press Discard draft while a patient's details sit in this tab.
    expect(text, "the screen denies keeping what it is in fact keeping").not.toMatch(/stored anywhere|kept anywhere/i);
  });

  it("shows roles in plain words, never as the domain's identifiers", async () => {
    // Round 1, finding M-2. `plan-start-state.tsx`'s REFERRAL_STATE_LABELS is this workspace's own
    // pattern; camelCase identifiers on a clinical screen are not.
    const user = userEvent.setup();
    const { container } = renderWizard();
    expect(container.textContent ?? "").toMatch(/coordinator/);
    expect(container.textContent ?? "", "an identifier reached the screen").not.toMatch(
      /clinicalProgrammeLead|livedExperienceRepresentative|teamLead/,
    );

    await reachPathwayStage(user);
    const pathwayText = container.textContent ?? "";
    expect(pathwayText).toMatch(/Approved by the clinical programme lead and the lived-experience representative/);
    expect(pathwayText, "an identifier reached the pathway chooser").not.toMatch(
      /clinicalProgrammeLead|livedExperienceRepresentative/,
    );
  });

  it("says plainly that the confirmations are not recorded anywhere", () => {
    renderWizard();
    // There is no field for either on a plan, so a screen that implied they were kept would be
    // making a claim the domain cannot honour. See the Task 7 report.
    expect(screen.getByText("Confirmed by you").closest("div")!).toHaveTextContent(/nothing in this domain records/i);
  });

  it("will not go to the pathway stage until both confirmations are ticked, and says why", async () => {
    const user = userEvent.setup();
    renderWizard();

    const forward = screen.getByRole("button", { name: /Continue to pathway/ });
    expect(forward, "the forward control was live with nothing confirmed").toBeDisabled();
    // A control awaiting validity is TRANSIENTLY inert, which is what native `disabled` is for —
    // and it is never combined with `aria-disabled`, which lint fails on as a pair.
    expect(forward).not.toHaveAttribute("aria-disabled");
    // `getByText`, not `getByRole("status")`: the draft notice owns a status region of its own, so
    // the role alone names two live regions on this screen.
    expect(screen.getByText(/cannot be chosen until both confirmations/i)).toBeInTheDocument();

    const [first, second] = screen.getAllByRole("checkbox");
    await user.click(first);
    expect(forward, "one confirmation was enough").toBeDisabled();

    await user.click(second);
    expect(forward).toBeEnabled();
  });
});

describe("the caring-contacts plan wizard — stage 2, pathway (Ruling [113])", () => {
  it("states the pathway the referral already names as an existing decision, with its provenance", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPathwayStage(user);

    const decision = screen.getByRole("group", { name: "Already decided when the referral was accepted" });
    expect(decision).toHaveTextContent(NAMED_PATHWAY);
    expect(decision, "the existing decision does not say where it came from").toHaveTextContent(
      /travels on the referral record/i,
    );
    expect(decision).toHaveTextContent(/changes what was decided when the referral was accepted/i);

    // The referral's own pathway is what the choice starts on, not an empty selection.
    expect(screen.getByRole("radio", { name: new RegExp(NAMED_PATHWAY) })).toBeChecked();
  });

  it("reads as changing an earlier decision once the coordinator picks something else", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPathwayStage(user);

    await user.click(screen.getByRole("radio", { name: new RegExp(OTHER_PATHWAY) }));

    const changed = screen.getByRole("group", { name: "You are changing an earlier decision" });
    expect(changed).toHaveTextContent(NAMED_PATHWAY);
    expect(changed).toHaveTextContent(/returns to what was decided when the referral was accepted/i);
  });

  it("is an ordinary first choice when the referral names no pathway", async () => {
    const user = userEvent.setup();
    renderWizard({ referralPathwayVersionId: null });
    await reachPathwayStage(user);

    // Nothing had been decided, so nothing is stated about a decision that was never made.
    expect(screen.queryByRole("group", { name: /decided when the referral was accepted/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /changing an earlier decision/i })).toBeNull();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("says so when the referral names a pathway that cannot be started on now", async () => {
    const user = userEvent.setup();
    // A referral accepted against a version that has since been retired, or one still in review:
    // the id is on the referral, and the version is not among the approved options.
    renderWizard({ pathwayOptions: [pathwayOption(OTHER_PATHWAY)] });
    await reachPathwayStage(user);

    const blocked = screen.getByRole("group", { name: "The pathway named on the referral cannot be used" });
    expect(blocked).toHaveTextContent(NAMED_PATHWAY);
    expect(blocked).toHaveTextContent(/retired/i);
  });

  it("states an empty chooser as a governance fact, not as a screen with nothing on it", async () => {
    const user = userEvent.setup();
    renderWizard({ pathwayOptions: [], referralPathwayVersionId: null });
    await reachPathwayStage(user);

    expect(screen.getByRole("group", { name: "No approved pathway yet" })).toHaveTextContent(
      /two different people have approved/i,
    );
  });
});

describe("the caring-contacts plan wizard — the draft (Ruling [110])", () => {
  it("keeps what has been entered so a reload does not lose it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWizard();
    await reachPathwayStage(user);
    await user.click(screen.getByRole("radio", { name: new RegExp(OTHER_PATHWAY) }));

    expect(readPlanDraft(REFERRAL)).toEqual({
      referralId: REFERRAL,
      stage: "pathway",
      assurances: { patientAgreed: true, mobileIsPatientControlled: true },
      pathwayVersionId: OTHER_PATHWAY,
      // Stage 3's fields are present and empty from the first render: nothing in this domain holds
      // a patient's name, mobile number or sending preference, so there is nothing to prefill.
      patientDetail: {
        patientName: "",
        patientMobileNumber: "",
        patientIdentifiers: "",
        culturalIdentity: "",
      },
      sendingPreference: null,
    });

    // A remount is what a page refresh looks like from this component's point of view.
    unmount();
    renderWizard();
    expect(await screen.findByRole("region", { name: "Pathway" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: new RegExp(OTHER_PATHWAY) })).toBeChecked();
  });

  it("removes everything when the draft is discarded, and says it did", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPathwayStage(user);
    expect(window.sessionStorage.getItem(PLAN_DRAFT_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /Discard draft/ }));

    expect(
      window.sessionStorage.getItem(PLAN_DRAFT_STORAGE_KEY),
      "the discarded draft was left on the machine",
    ).toBeNull();
    // Back to the first stage with nothing ticked: a discard that left the answers on screen would
    // put them back into storage on the next keystroke.
    expect(screen.getByRole("region", { name: "Agreement" })).toBeInTheDocument();
    for (const box of screen.getAllByRole("checkbox")) expect(box).not.toBeChecked();
    expect(screen.getByText(/The draft was discarded/)).toBeInTheDocument();
  });

  it("still lets a clinician work when the browser refuses to keep it, and says it is not being kept", async () => {
    // Round 1, finding I-1. Safari private browsing hands out a real `sessionStorage` whose
    // `setItem` throws, and the screen must keep working: a coordinator who cannot tick a box has
    // no way to sign a patient up at all. `Storage.prototype`, not the instance — jsdom's storage
    // is a Proxy that answers from the prototype, so an instance spy is never consulted.
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    const user = userEvent.setup();
    renderWizard();

    const [first] = screen.getAllByRole("checkbox");
    await user.click(first);

    expect(setItem, "the refusal was never actually exercised").toHaveBeenCalled();
    expect(first, "the screen did not change when the browser refused the write").toBeChecked();
    // And the notice tells the truth about it rather than promising a memory the browser refused.
    expect(screen.getByRole("group", { name: /Nothing is being kept on this computer/ })).toHaveTextContent(
      /finish this sign-up in one sitting/i,
    );
  });

  it("states in place what is being kept, and what would remove it", () => {
    renderWizard();
    // Spec §4.4: the system is doing something the clinician did not ask for, so the surface says
    // why and what changes it, in words, on the page — not in a tooltip.
    const notice = screen.getByRole("group", { name: /Kept on this computer until you close the tab/ });
    expect(notice).toHaveTextContent(/Why:/);
    expect(notice).toHaveTextContent(/What changes it:/);
    expect(notice).toHaveTextContent(/Closing this tab removes it/);
    expect(notice).toHaveTextContent(/Discard draft/);
  });
});

describe("the caring-contacts plan wizard — every activation surface is a production tap target", () => {
  /**
   * `min-h-tap` is `--spacing-tap`, 3rem, 48px — this repo's production floor, which exceeds even
   * the AAA-level 44px criterion. Never `min-h-11`: 44px reintroduces a known `ui-smoke` sub-pixel
   * flake, and generic checklist guidance that says otherwise loses to the repo (AGENTS.md,
   * "External skill precedence").
   *
   * WHAT THIS PROVES AND WHAT IT CANNOT. jsdom has no layout, so this reads the class rather than
   * the rendered box — the same technique `tests/caring-contacts-overlay-trigger.dom.test.tsx`
   * already uses. A real pixel measurement belongs in the browser suite, and cannot be written
   * today: that server seeds no referral, so no Playwright case can reach a stage. Named in the
   * Task 7 report as a coverage gap rather than passed off as measured.
   *
   * It reads the ELEMENT A TAP ACTIVATES, which is the whole of round 1 finding I-2: the pathway
   * rows had `min-h-tap` on a wrapping `<div>` while the only activation surface was a 20px radio
   * and a one-line label, so the row looked tappable and mostly was not.
   */
  function activationSurfaces(container: HTMLElement): HTMLElement[] {
    // Every control a finger can land on: the buttons, and the labels that carry a checkbox or a
    // radio. Not the inputs themselves — a 20px input inside a 48px label is correct.
    return [
      ...container.querySelectorAll<HTMLElement>("button"),
      ...[...container.querySelectorAll<HTMLElement>("label")].filter(
        (label) => label.querySelector("input") !== null || label.getAttribute("for") !== null,
      ),
    ];
  }

  it("puts the tap floor on stage 1's confirmations and its controls", () => {
    const { container } = renderWizard();
    const surfaces = activationSurfaces(container);
    expect(surfaces.length, "no activation surfaces were found — update this test").toBeGreaterThan(0);
    for (const surface of surfaces) {
      expect(surface.className, `${surface.textContent?.trim()} is not a production tap target`).toContain("min-h-tap");
      expect(surface.className, `${surface.textContent?.trim()} was narrowed to the 44px guidance`).not.toContain(
        "min-h-11",
      );
    }
  });

  it("puts the tap floor on the pathway rows a finger actually lands on", async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await reachPathwayStage(user);

    const radios = [...container.querySelectorAll<HTMLInputElement>("input[type='radio']")];
    expect(radios.length, "the pathway chooser rendered no options — update this test").toBeGreaterThan(0);
    for (const radio of radios) {
      const label = container.querySelector<HTMLElement>(`label[for="${radio.id}"]`);
      expect(label, `the radio ${radio.id} has no label to tap`).not.toBeNull();
      expect(label!.className, `${radio.id}'s row is not a production tap target`).toContain("min-h-tap");
      expect(label!.className).not.toContain("min-h-11");
      // And the label is what the tap activates, rather than a 48px wrapper around a 20px input.
      expect(label!.contains(radio), `${radio.id} is outside the surface that carries the tap floor`).toBe(true);
    }

    for (const surface of activationSurfaces(container)) {
      expect(surface.className, `${surface.textContent?.trim()} is not a production tap target`).toContain("min-h-tap");
    }
  });
});

describe("the caring-contacts plan wizard — the stages Tasks 8 and 9 build", () => {
  it("names every stage, and marks the unbuilt ones as unbuilt", () => {
    renderWizard();
    const stepper = screen.getByRole("navigation", { name: "Sign-up stages" });
    for (const label of ["Agreement", "Pathway", "Personalisation", "Review and activation"]) {
      expect(within(stepper).getByText(label)).toBeInTheDocument();
    }
    // One, not two: Task 8 built personalisation, and Task 9 builds review and activation.
    expect(within(stepper).getAllByText("not built yet")).toHaveLength(1);
  });

  it("offers review and activation as an unavailable control with a stated reason, never a dead end", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPersonalisationStage(user);

    const forward = screen.getByRole("button", { name: /^Review and activation/ });
    // Ruling 52 and docs/wiring-conventions.md: `aria-disabled` plus an inert handler, never the
    // native attribute, so the stated reason stays reachable by keyboard.
    expect(forward).toHaveAttribute("aria-disabled", "true");
    expect(forward).not.toHaveAttribute("disabled");
    expect(forward).toHaveAttribute("title", expect.stringContaining("coming soon"));
    const describedBy = forward.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent ?? "").toContain("is not built yet");

    // And the way back from stage 3 is a real control.
    await user.click(screen.getByRole("button", { name: /Back to pathway/ }));
    expect(screen.getByRole("region", { name: "Pathway" })).toBeInTheDocument();
  });

  it("keeps the stage table and the wizard's own bodies in step", () => {
    // The extension point Tasks 8 and 9 change. `stages.ts`'s `never` default catches a stage added
    // to the union and left unclassified; this catches the opposite mistake, which is the one those
    // tasks can actually make — flipping an entry to `built` and not writing the body.
    expect(planWizardStageImplementation("agreement")).toEqual({ kind: "built" });
    expect(planWizardStageImplementation("pathway")).toEqual({ kind: "built" });
    expect(planWizardStageImplementation("personalisation")).toEqual({ kind: "built" });
    expect(planWizardStageImplementation("review").kind).toBe("not-built");
  });

  it("will require the activation stage to clear the draft the moment Task 9 builds it", () => {
    // Round 1, finding M-1. The draft suite's "clears on successful activation" case calls
    // `clearPlanDraft()` directly, so it proves the seam works and nothing about whether Task 9
    // uses it. THIS is the case that arms itself: it does nothing while the review stage is
    // unbuilt, and becomes a real requirement the moment `stages.ts` says it is built.
    //
    // Comments are stripped first, for the reason `tests/route-reachability.test.ts` records:
    // documenting a rule is not obeying it, and a check that reads prose can be satisfied by a note
    // saying the call ought to be there.
    const wizardSource = stripSourceComments(
      readFileSync(
        path.join(process.cwd(), "src", "components", "caring-contacts", "workspace", "plan-wizard", "plan-wizard.tsx"),
        "utf8",
      ),
    );

    if (planWizardStageImplementation("review").kind === "not-built") {
      // Nothing to require yet, and this states that rather than passing silently: a review body
      // rendered while the table still calls the stage unbuilt would be its own defect.
      expect(wizardSource, "a review stage body appeared while the table still calls it unbuilt").not.toMatch(
        /case "review":\s*return \(/,
      );
      return;
    }

    // Task 9 has built it. The wizard now calls `clearPlanDraft()` once for the discard control, so
    // an activation that clears the draft is a SECOND call. A refactor that shares one call site
    // between the two would go red here — a false alarm a human reads, which is the safe direction
    // for a guard about a patient's details left on a ward machine.
    const clearCalls = [...wizardSource.matchAll(/clearPlanDraft\(\)/g)].length;
    expect(
      clearCalls,
      "the review stage is built but the wizard still clears the draft in only one place — a plan " +
        "activated without clearing leaves the patient's name and mobile number in this tab's storage",
    ).toBeGreaterThan(1);
  });

  it("renders the unbuilt stage's own panel rather than an empty column, if one is ever reached", async () => {
    // Not reachable through the controls today — the forward control from stage 2 is an unavailable
    // one. It is reachable from a stored draft naming that stage, which is what this sets up.
    window.sessionStorage.setItem(
      PLAN_DRAFT_STORAGE_KEY,
      JSON.stringify({
        referralId: REFERRAL,
        stage: "review",
        assurances: { patientAgreed: true, mobileIsPatientControlled: true },
        pathwayVersionId: NAMED_PATHWAY,
        patientDetail: {
          patientName: "Rowan Example",
          patientMobileNumber: FICTIONAL_PATIENT_MOBILES[1],
          patientIdentifiers: "",
          culturalIdentity: "",
        },
        sendingPreference: "morning",
      }),
    );
    renderWizard();

    expect(await screen.findByRole("group", { name: "Review and activation is not built yet" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Review and activation" });
    expect(within(region).getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});

describe("the caring-contacts plan wizard — stage 3, personalisation (Ruling [114])", () => {
  it("asks the clinician to TYPE the patient's name and mobile number, and ticks nothing", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    // The approved mockup renders four read-only rows with green ticks, sourced "Imported from the
    // synthetic referral". A `Referral` is five fields and holds neither a name nor a number
    // (Ruling [112]), so there is nothing to import and nothing to tick — presenting a clinician's
    // own typing as an imported governed value would be a lie about provenance on the screen that
    // decides where messages physically go.
    expect(within(stage).getByLabelText(/patient.s name/i)).toHaveValue("");
    expect(within(stage).getByLabelText(/mobile number/i)).toHaveValue("");
    expect(stage.textContent ?? "").not.toMatch(/imported from the synthetic referral/i);
    expect(stage.textContent ?? "").not.toMatch(/governed value present/i);
  });

  it("keeps what was typed in the draft, so a reload does not lose a patient's details", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWizard();
    await reachPersonalisationStage(user);

    await user.type(screen.getByLabelText(/patient.s name/i), "Rowan Example");
    await user.type(screen.getByLabelText(/mobile number/i), FICTIONAL_PATIENT_MOBILES[1]);

    const draft = readPlanDraft(REFERRAL);
    expect(draft?.patientDetail.patientName).toBe("Rowan Example");
    expect(draft?.patientDetail.patientMobileNumber).toBe(FICTIONAL_PATIENT_MOBILES[1]);

    // A remount is what a page refresh looks like from this component's point of view.
    unmount();
    renderWizard();
    expect(await screen.findByRole("region", { name: "Personalisation" })).toBeInTheDocument();
    expect(screen.getByLabelText(/patient.s name/i)).toHaveValue("Rowan Example");
    expect(screen.getByLabelText(/mobile number/i)).toHaveValue(FICTIONAL_PATIENT_MOBILES[1]);
  });

  it("says what is still missing, in words, tied to the control it is about", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    const name = within(stage).getByLabelText(/patient.s name/i);
    const mobile = within(stage).getByLabelText(/mobile number/i);
    for (const field of [name, mobile]) {
      const described = (field.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      expect(described, "a required field states nothing about what is missing").toMatch(/cannot be created without/i);
      expect(field).toHaveAttribute("aria-invalid", "true");
    }

    await user.type(name, "Rowan Example");
    expect(within(stage).getByLabelText(/patient.s name/i)).toHaveAttribute("aria-invalid", "false");
  });
});

describe("stage 3 — the mobile number is required and nothing here connects (Ruling [115])", () => {
  it("states, where the number is entered, that nothing is ever sent to it", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    // "A clinician who believes this field reaches a real handset is the single most dangerous
    // misunderstanding this interface can create." The statement is in the flow of the page, in the
    // shape spec §4.4 sets, beside the field it is about — never a `title` attribute.
    const group = within(stage).getByRole("group", { name: /is ever sent to any number/i });
    expect(group).toHaveTextContent(/Why:/);
    expect(group).toHaveTextContent(/What changes it:/);
    // The reserved fictional numbers come from `synthetic-contacts.ts`, not from a literal here.
    for (const reserved of FICTIONAL_PATIENT_MOBILES) {
      expect(group).toHaveTextContent(reserved);
    }
  });

  it("keeps the caution's live region on the page from the start, so it can be announced (I-2)", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);
    const mobile = within(stage).getByLabelText(/mobile number/i);

    // ROUND 1, I-2. The caution used to be an entire `<p role="status">` CREATED when the condition
    // became true. A live region inserted along with its content is unreliably announced — the
    // region has to be on the page already for a content change to be spoken. That made the one
    // string telling a clinician their number is not a reserved fictional one the single string on
    // this screen a screen-reader user might never hear, on the field that decides where a message
    // physically goes. A caution nobody hears is not a caution.
    const caution = within(stage).getByTestId("caring-contacts-patient-mobile-caution");
    expect(caution).toHaveAttribute("role", "status");
    expect(caution).toHaveTextContent("");

    await user.type(mobile, "+61 400 000 000");
    expect(caution).toHaveTextContent(/not one of the reserved fictional numbers/i);

    // And it is reachable from the input itself, not only as a region a reader has to find.
    expect(mobile.getAttribute("aria-describedby") ?? "").toContain(caution.id);
    expect(caution.id).not.toBe("");
  });

  it("says when the number typed is not one of the reserved fictional ones, and still accepts it", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);
    const mobile = within(stage).getByLabelText(/mobile number/i);

    await user.type(mobile, "+61 400 000 000");
    expect(stage.textContent ?? "").toMatch(/not one of the reserved fictional numbers/i);
    // A STATEMENT, not a refusal. This domain holds no format rule for a mobile number at all, so
    // refusing anything outside a two-item list would invent an authority that does not exist —
    // and `createPlanSchema` would still take the value.
    expect(mobile).toHaveAttribute("aria-invalid", "false");

    await user.clear(mobile);
    await user.type(mobile, FICTIONAL_PATIENT_MOBILES[0]);
    expect(stage.textContent ?? "").not.toMatch(/not one of the reserved fictional numbers/i);
  });
});

describe("stage 3 — cultural identity is NOT asked for (owner decision, round 1)", () => {
  it("offers no input for it", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    // The owner decided on 2026-08-25 to stop collecting it. Spec §2.5 records the status as
    // IMPORTED from the source record for aggregate reach reporting only; there is no source record
    // and no import, so what shipped was a clinician typing free text — and free text cannot carry
    // the small-cell suppression that reporting depends on, because either every rare spelling is a
    // cell of one or an unaudited normalisation step decides who counts, which is a governance
    // decision nobody has made.
    // Asserted against the FORM CONTROLS, not against `getByLabelText`. The statement explaining the
    // absence is a `role="group"` whose `aria-label` necessarily contains the words "cultural
    // identity", so a label query matches the explanation and would go red for the right screen.
    expect(within(stage).queryByRole("textbox", { name: /cultural/i })).toBeNull();
    expect(
      within(stage)
        .getAllByRole("textbox")
        .map((control) => control.getAttribute("id")),
      "stage 3 collects a field it should not, or has lost one it should",
    ).toEqual([
      "caring-contacts-patient-name",
      "caring-contacts-patient-mobile",
      "caring-contacts-patient-identifiers",
    ]);
  });

  it("says why it is absent, so the absence does not read as an oversight", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    const group = within(stage).getByRole("group", { name: /not asked for/i });
    expect(group).toHaveTextContent(/Why:/);
    expect(group).toHaveTextContent(/What changes it:/);
    // The reason names the missing import, which is the actual cause.
    expect(group).toHaveTextContent(/read from the hospital record/i);
  });

  it("makes no present-tense claim about a capability that does not exist (I-3)", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);
    const text = stage.textContent ?? "";

    // I-3, and it is the same class of defect one sentence apart: the screen correctly refused to
    // reproduce §2.5's false "imported from the source record", then reproduced §2.5's equally
    // unbuilt "It IS used for aggregate reporting on programme reach". No reporting exists.
    expect(text).not.toMatch(/is used for aggregate reporting/i);
    expect(text).not.toMatch(/imported from the (synthetic referral|source record)/i);
  });

  it("sends null for it, so the plan records nothing where nothing was asked", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    await user.type(within(stage).getByLabelText(/patient.s name/i), "Rowan Example");
    await user.type(within(stage).getByLabelText(/mobile number/i), FICTIONAL_PATIENT_MOBILES[1]);
    await user.click(within(stage).getByRole("radio", { name: /Morning/ }));

    expect(stage.textContent ?? "").toMatch(/nothing else is needed/i);
    // `z.string().min(1).nullable()` REFUSES "", so this is not a stylistic preference: a plan
    // carrying an empty string here could not be created at all.
    expect(createPlanPatientDetail(readPlanDraft(REFERRAL)!.patientDetail)?.culturalIdentity).toBeNull();
  });
});

describe("stage 3 — validation before advancing (Ruling [115], round 1 finding I-1)", () => {
  it("proves the forward control honours `ready` at all, on the one stage where it is reachable today", async () => {
    // ROUND 1, I-1, first half. `ForwardControl` returns an `UnavailableDestination` whenever the
    // NEXT stage is unbuilt and never reads `ready` on that path — so stage 3's `ready={complete}`
    // is dead code until Task 9 builds review, and nothing was proving the prop is honoured
    // anywhere. Stage 2 is where it IS reachable: its next stage is personalisation, which Task 8
    // built. So the mechanism is proved live here, and stage 3's own gate is armed below.
    const user = userEvent.setup();
    renderWizard({ referralPathwayVersionId: null });
    for (const box of screen.getAllByRole("checkbox")) await user.click(box);
    await user.click(screen.getByRole("button", { name: /Continue to pathway/ }));

    const forward = screen.getByRole("button", { name: /Continue to personalisation/ });
    expect(forward, "the forward control was live with no pathway chosen").toBeDisabled();
    // Native `disabled` and never `aria-disabled` here: this is TRANSIENT inertness awaiting
    // validity, which is exactly what the native attribute is for, and the two must never be paired.
    expect(forward).not.toHaveAttribute("aria-disabled");

    await user.click(screen.getByRole("radio", { name: new RegExp(NAMED_PATHWAY) }));
    expect(screen.getByRole("button", { name: /Continue to personalisation/ })).toBeEnabled();
  });

  it("will require an incomplete stage 3 to be unable to advance, the moment Task 9 builds review", async () => {
    // ROUND 1, I-1, second half — and it is Task 7's self-arming shape, for the same reason: today
    // there is nothing to assert, and the moment `stages.ts` flips `review` there is a hard
    // requirement. Without this, Task 9 can ship a Continue that ignores `ready` with every gate
    // green, and a plan could be submitted with no patient name and no mobile number.
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    if (planWizardStageImplementation("review").kind === "not-built") {
      // Nothing to require yet, and this states that rather than passing silently: an enabled
      // forward control here would mean a review body had appeared behind the table's back.
      const unavailable = within(stage).getByRole("button", { name: /^Review and activation/ });
      expect(unavailable).toHaveAttribute("aria-disabled", "true");
      expect(within(stage).queryByRole("button", { name: /^Continue to review/ })).toBeNull();
      return;
    }

    // Task 9 has built it. Nothing is typed, so the control must be inert — and inert by the native
    // attribute, because awaiting validity is transient inertness.
    const incomplete = within(stage).getByRole("button", { name: /^Continue to review/ });
    expect(
      incomplete,
      "stage 3 could advance with no patient name and no mobile number — Ruling [115] requires the " +
        "mobile number to be validated BEFORE the wizard advances",
    ).toBeDisabled();
    expect(incomplete).not.toHaveAttribute("aria-disabled");

    await user.type(within(stage).getByLabelText(/patient.s name/i), "Rowan Example");
    await user.type(within(stage).getByLabelText(/mobile number/i), FICTIONAL_PATIENT_MOBILES[1]);
    await user.click(within(stage).getByRole("radio", { name: /Morning/ }));
    expect(within(stage).getByRole("button", { name: /^Continue to review/ })).toBeEnabled();
  });
});

describe("stage 3 — the sending preference (kept from the mockup, minus its count)", () => {
  it("offers the three approved preferences with the time each actually sends at", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    const fieldset = within(stage).getByRole("group", { name: /when in the day/i });
    for (const option of SENDING_PREFERENCE_OPTIONS) {
      const radio = within(fieldset).getByRole("radio", { name: new RegExp(option.label) });
      expect(radio).not.toBeChecked();
      // The time is the schedule module's, resolved on the server and passed in — never a literal
      // written beside a radio button, which would go on saying 10:00 after the hour moved.
      expect(fieldset).toHaveTextContent(option.sendTime);
    }

    await user.click(within(fieldset).getByRole("radio", { name: /Early evening/ }));
    expect(readPlanDraft(REFERRAL)?.sendingPreference).toBe("earlyEvening");
  });

  it("states the invariant rather than a number of contacts (Rulings [94] and [98])", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    // The mockup's legend reads "One preference applies to all 10 contacts". The count is derived
    // and conditional — Week 1 is absorbed when the first contact is set to discharge + 7 — so the
    // property is stated and the number is not.
    expect(stage.textContent ?? "").toMatch(/applies to every contact in this plan/i);
    expect(stage.textContent ?? "").not.toMatch(/\b(10|ten|nine|9) contacts\b/i);
  });

  it("keeps every activation surface at the production tap floor", async () => {
    const user = userEvent.setup();
    renderWizard();
    const stage = await reachPersonalisationStage(user);

    // Round 1, finding I-2: `min-h-tap` must sit on the element a tap actually activates. A 48px
    // wrapper around a 20px radio is 48px of layout and 20px of activation surface, and the rest of
    // the row is dead space that looks tappable.
    for (const radio of within(stage).getAllByRole("radio")) {
      const label = radio.closest("label");
      expect(label, "a radio in stage 3 is not inside a label").not.toBeNull();
      expect(label!.className, `${label!.textContent?.trim()} is not a production tap target`).toContain("min-h-tap");
      expect(label!.className).not.toContain("min-h-11");
    }
    for (const control of within(stage).getAllByRole("button")) {
      expect(control.className, `${control.textContent?.trim()} is not a production tap target`).toContain("min-h-tap");
    }
  });
});
