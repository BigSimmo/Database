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
import {
  PlanWizard,
  type PlanWizardProps,
} from "@/components/caring-contacts/workspace/plan-wizard/plan-wizard";
import { planWizardStageImplementation } from "@/components/caring-contacts/workspace/plan-wizard/stages";

import { stripSourceComments } from "./helpers/strip-source-comments";

const REFERRAL = "SYN-REFERRAL-001";
const PATIENT = "SYN-PATIENT-001";
const TEAM = "SYN-TEAM-001";
const NAMED_PATHWAY = "SYN-PATHWAY-001";
const OTHER_PATHWAY = "SYN-PATHWAY-002";

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
    expect(within(stepper).getAllByText("not built yet")).toHaveLength(2);
  });

  it("offers personalisation as an unavailable control with a stated reason, never a dead end", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPathwayStage(user);

    const forward = screen.getByRole("button", { name: /^Personalisation/ });
    // Ruling 52 and docs/wiring-conventions.md: `aria-disabled` plus an inert handler, never the
    // native attribute, so the stated reason stays reachable by keyboard.
    expect(forward).toHaveAttribute("aria-disabled", "true");
    expect(forward).not.toHaveAttribute("disabled");
    expect(forward).toHaveAttribute("title", expect.stringContaining("coming soon"));
    const describedBy = forward.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent ?? "").toContain("is not built yet");

    // And the way back from stage 2 is a real control.
    await user.click(screen.getByRole("button", { name: /Back to agreement/ }));
    expect(screen.getByRole("region", { name: "Agreement" })).toBeInTheDocument();
  });

  it("keeps the stage table and the wizard's own bodies in step", () => {
    // The extension point Tasks 8 and 9 change. `stages.ts`'s `never` default catches a stage added
    // to the union and left unclassified; this catches the opposite mistake, which is the one those
    // tasks can actually make — flipping an entry to `built` and not writing the body.
    expect(planWizardStageImplementation("agreement")).toEqual({ kind: "built" });
    expect(planWizardStageImplementation("pathway")).toEqual({ kind: "built" });
    expect(planWizardStageImplementation("personalisation").kind).toBe("not-built");
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
        stage: "personalisation",
        assurances: { patientAgreed: true, mobileIsPatientControlled: true },
        pathwayVersionId: NAMED_PATHWAY,
      }),
    );
    renderWizard();

    expect(await screen.findByRole("group", { name: "Personalisation is not built yet" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Personalisation" });
    expect(within(region).getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});
