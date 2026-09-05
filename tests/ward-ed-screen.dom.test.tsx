import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

// Same reason as the sibling dom suites (ward-screen.dom.test.tsx,
// ward-flow-clock-consistency.dom.test.tsx): `ClinicalRail` renders next/link anchors and this
// suite never checks routing, so a plain <a> avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { COHORTS, URGENCY_LEVELS, type UrgencyLevel } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { formTitleForCode } from "@/lib/form-register";

/**
 * The two surfaces the fix-wave-1 reviewer named as untested: that the intake picker's chosen
 * code actually reaches the reducer, and that the examine control is now offered on a Form 3B —
 * one of the three cases the deleted "form must be 1A" gate refused outright.
 *
 * Both are driven through the real screen and the real provider. Nothing here reaches into the
 * reducer directly: the picker is changed and the form submitted exactly as a clinician would,
 * and the resulting state is read back through `useWardFlow` by the probe below rather than
 * asserted against a hand-built object.
 *
 * Extended for the clinical-safety fix below (five fields that used to reach the reducer
 * unanswered): `cohort`, `security`, `sex`, `legalStatus` and `urgency` are appended after the
 * three original fields, never inserted between them, so every existing assertion below that
 * matches a leading substring of this text (`toHaveTextContent` is a substring match) still
 * matches unchanged.
 */
function LastMovementProbe() {
  const { movements } = useWardFlow();
  const last = movements.at(-1);
  return (
    <p data-testid="probe">
      {last?.id ?? "none"}|{last?.legalForm?.code ?? "no-form"}|{last?.formedAt ?? "no-formedAt"}|
      {last?.cohort ?? "no-cohort"}|{last?.security ?? "no-security"}|{last?.sex ?? "no-sex"}|
      {last?.legalStatus ?? "no-legal-status"}|{last?.urgency ?? "no-urgency"}
    </p>
  );
}

/** The id `RAISE_REFERRAL` gives the first referral raised against a freshly seeded state. */
const FIRST_RAISED_ID = "WF-901";

function renderEd() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <LastMovementProbe />
    </WardFlowProvider>,
  );
}

/**
 * The five fields the raise-referral submit now refuses to fire without, and the concrete value
 * each is set to when this suite wants it answered. A data table rather than five separate
 * `fireEvent.change` calls precisely so `fillRequiredReferralFieldsExcept` below can skip exactly
 * one by name, leaving it at whatever `DEFAULT_DRAFT` (`ed-screen.tsx`) actually seeds it with —
 * never reset back to the placeholder through the UI, which would make these tests pass no matter
 * what that default held.
 */
const REQUIRED_REFERRAL_FIELDS = [
  { testId: "ward-ed-referral-cohort", value: "Adult" },
  { testId: "ward-ed-referral-security", value: "Open" },
  { testId: "ward-ed-referral-sex", value: "Female" },
  { testId: "ward-ed-referral-legal-status", value: "Voluntary" },
  { testId: "ward-ed-referral-urgency", value: "3" },
] as const;

/**
 * Answers the five fields the raise-referral submit now refuses to fire without — the
 * clinical-safety fix the `describe` block near the end of this file is about.
 */
function fillRequiredReferralFields() {
  for (const field of REQUIRED_REFERRAL_FIELDS) {
    fireEvent.change(screen.getByTestId(field.testId), { target: { value: field.value } });
  }
  // ⚠️ Answered separately because it is a radio pair, not a <select>. Owner ruling 1 made an
  // unticked checkbox load-bearing — a `false` nobody chose skips the reducer's one-to-one
  // capacity refusal — so "Not required" is now stated rather than assumed.
  fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
}

/**
 * Answers every required field EXCEPT `skipTestId`, which is never touched at all — so it stays
 * at whatever `DEFAULT_DRAFT` seeded it with, exactly as a clinician who genuinely never looked
 * at that one control would leave it. This is what makes the five isolated tests below a real
 * proof that each field's OWN default is unanswered, rather than a proof that a value this test
 * chose and then explicitly cleared is unanswered.
 */
function fillRequiredReferralFieldsExcept(skipTestId: string) {
  for (const field of REQUIRED_REFERRAL_FIELDS) {
    if (field.testId === skipTestId) continue;
    fireEvent.change(screen.getByTestId(field.testId), { target: { value: field.value } });
  }
  if (skipTestId !== "ward-ed-referral-specialling-not-required") {
    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
  }
}

/** Opens the intake form, answers the five required fields (see `fillRequiredReferralFields`),
 *  sets the legal-form picker to `code`, and submits. */
function raiseReferralWithForm(code: string) {
  fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
  fillRequiredReferralFields();
  fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: code } });
  fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
}

describe("emergency department intake picker", () => {
  it("offers every declared form, titled from the official register, and defaults to no form", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    const picker = screen.getByTestId("ward-ed-referral-legal-form") as HTMLSelectElement;

    // Defaults to no form: the clinician picks one, the software never picks one for them.
    expect(picker.value).toBe("");
    expect(picker.options[0]).toHaveTextContent("No form");

    // One option per declared code, in the declared order, plus the "No form" option.
    const offered = [...picker.options].slice(1).map((option) => option.value);
    expect(offered).toEqual(SELECTABLE_LEGAL_FORMS.map((form) => form.code));

    // Non-vacuity: there really are several, so an emptied list could not pass the check above.
    expect(offered.length).toBeGreaterThan(3);

    // The title shown is the register's, not one Ward Flow holds. Asserted against the literal
    // official string rather than against `formTitleForCode`'s own output, so a change to the
    // register's 3D entry has to be seen and acknowledged here rather than tracked silently.
    const option3D = [...picker.options].find((option) => option.value === "3D")!;
    expect(option3D).toHaveTextContent(
      "Form 3D (Order authorising reception and detention in an authorised hospital for further examination)",
    );
    expect(option3D.textContent).toBe(`Form 3D (${formTitleForCode("3D")})`);
  });

  // Fix round B (review finding I3): `COHORT_OPTIONS` used to be hand-listed as
  // `["Adult", "Older adult"]`, typed `Cohort[]` rather than derived from `COHORTS` — so widening
  // `Cohort` to include `"Youth"` could never make this picker fail to compile, and the ED cohort
  // picker silently offered no way to raise a Youth referral. This test pins the fix: the picker
  // is now driven off `COHORTS` directly, so it is proven against the real runtime list rather
  // than a second hand-written copy of it, and Youth is explicitly asserted present.
  it("offers every cohort in COHORTS, Youth included", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    const picker = screen.getByTestId("ward-ed-referral-cohort") as HTMLSelectElement;
    // Index 0 is now the "Choose a cohort" placeholder — nothing is chosen for the clinician —
    // so the real options start at index 1, the same convention the legal-form picker test above
    // already uses for its own leading placeholder.
    expect(picker.options[0]).toHaveTextContent("Choose a cohort");
    const offered = [...picker.options].slice(1).map((option) => option.value);
    expect(offered).toEqual(COHORTS);
    expect(offered).toContain("Youth");
  });

  it("dispatches the chosen code onto the referral it raises", () => {
    renderEd();
    // Before: the last movement is a fixture one, not the referral this test is about.
    expect(screen.getByTestId("probe")).not.toHaveTextContent(FIRST_RAISED_ID);

    raiseReferralWithForm("3D");

    // The chosen code reached the reducer and is on the created movement — and nothing else is:
    // no `formedAt` was stamped, and no title was copied onto the record.
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|3D|no-formedAt`);
    expect(screen.getByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).toBeInTheDocument();
  });

  it("raises a referral with no form when the legal-form picker is left alone", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    // The other five fields must still be answered — this test is about the legal-form picker
    // specifically being left alone, not about the clinical-safety fix covered further down.
    fillRequiredReferralFields();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|no-form|no-formedAt`);
  });

  /**
   * Fix wave 2, item 1 — closing the gap wave 1 disclosed. Restoring the deleted
   * `legalForm?.code === "1A" && examination === undefined` inference in `outstandingItem` left
   * all five earlier tests green, because none of them puts a patient on a 1A: that branch fires
   * for a Form 1A and nothing else, so nothing could see it come back.
   *
   * A Form 1A with no examination is exactly the state the deleted rule described, and it is the
   * state the picker can now produce for a **Voluntary** patient — the contradiction that made
   * the inference untenable. The assertions are in both directions: the wording that IS there,
   * and the wording that must NOT be, so deleting the record-based line without restoring the
   * inference fails too.
   */
  it("states the record, not 'Referred for examination', for a patient on a Form 1A", () => {
    renderEd();
    raiseReferralWithForm("1A");
    // Non-vacuity: the movement really is on a 1A with no examination, which is the only state
    // the deleted inference ever applied to.
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|1A|`);

    const outstanding = screen.getByTestId(`ward-ed-outstanding-${FIRST_RAISED_ID}`);
    expect(outstanding).toHaveAttribute("data-kind", "examination");
    expectSays(outstanding.textContent ?? "", "the examination-outcome absence line", ["no examination", "none"]);
    // The software may not say what a Form 1A means or what it referred this person for.
    // `fillRequiredReferralFields` answers legal status Voluntary above, so the deleted wording
    // would have been false here as well as unattributed.
    expect(outstanding).not.toHaveTextContent("Referred for examination");
  });

  it("offers the examine control on a Form 3B — the case the deleted gate refused", () => {
    renderEd();
    raiseReferralWithForm("3B");
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|3B|`);

    const toggle = screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`);
    // The old gate rendered this `aria-disabled="true"` with a title naming the refusal, and its
    // click handler was inert. Both halves are asserted, because either one surviving alone
    // would still deny the clinician the action.
    expect(toggle).not.toHaveAttribute("aria-disabled");
    expect(toggle).not.toHaveAttribute("title");

    fireEvent.click(toggle);
    expect(screen.getByTestId(`ward-ed-examine-form-${FIRST_RAISED_ID}`)).toBeInTheDocument();
  });

  it("records the examination from the screen without changing the form", () => {
    renderEd();
    raiseReferralWithForm("3B");
    fireEvent.click(screen.getByTestId(`ward-ed-examine-toggle-${FIRST_RAISED_ID}`));
    fireEvent.click(screen.getByRole("radio", { name: "Inpatient treatment order" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm examination outcome" }));

    // Still a 3B. The examination no longer replaces the clinician's chosen form.
    expect(screen.getByTestId("probe")).toHaveTextContent(`${FIRST_RAISED_ID}|3B|`);
    // And the outstanding item now reports the recorded outcome rather than the missing one.
    const outstanding = screen.getByTestId(`ward-ed-outstanding-${FIRST_RAISED_ID}`);
    expect(outstanding).toHaveAttribute("data-kind", "form");
    expect(outstanding).toHaveTextContent("examination recorded (inpatient order)");
  });
});

/**
 * Wave 1 referral corrections. All three urgency `<select>`s in the movement screens rendered a
 * bare "1", "2", "3" — no word anywhere on the control saying which end of the scale is urgent —
 * while every surface that DISPLAYS the same field spells it out through `urgencyTierLabel`.
 *
 * The consequence is not cosmetic. A clinician who reads the bigger number as "most urgent" files
 * the LEAST urgent referral for the sickest patient, and because urgency outranks everything else
 * in the queue that error sorts the patient to the bottom with no later screen contradicting it.
 *
 * Both tests read the option TEXT. The existing suites above read option `value`s, which were
 * correct throughout and are deliberately still the bare tier — which is exactly why nothing here
 * could catch this. Asserted against `urgencyTierLabel` itself rather than three remembered
 * strings, so the guard is "the pickers and the boards use one spelling" rather than "the picker
 * uses the spelling this test happens to remember".
 */
describe("emergency department urgency pickers", () => {
  it("labels every option on the raise-referral picker with its direction", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));

    // The test-id itself is part of the fix: this picker had none, so no test could address the
    // one urgency control a clinician uses at referral time.
    const picker = screen.getByTestId("ward-ed-referral-urgency") as HTMLSelectElement;

    // Index 0 is now "Choose an urgency tier" — nothing is chosen for the clinician — so the
    // three real tiers start at index 1, checked separately below.
    expect(picker.options[0]).toHaveTextContent("Choose an urgency tier");

    const optionText = [...picker.options].slice(1).map((option) => option.textContent);
    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    // The VALUE stays the bare tier: the model and every value-reading test are unchanged.
    const optionValues = [...picker.options].slice(1).map((option) => option.value);
    expect(optionValues).toEqual(URGENCY_LEVELS.map((level) => String(level)));

    // Non-vacuity: the labels really do carry a direction, so a future `urgencyTierLabel`
    // returning the bare tier again would fail here even though the first assertion still matched.
    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });

  it("labels every option on the urgency-change picker with its direction", () => {
    renderEd();

    // The movement set is discovered from the rendered screen rather than hand-picked, and a
    // silent zero is refused: an ED with no outbox patients would otherwise pass this vacuously.
    const toggles = screen.getAllByTestId(/^ward-change-urgency-toggle-/);
    expect(toggles.length).toBeGreaterThan(0);
    fireEvent.click(toggles[0]);

    const picker = screen.getByLabelText(/^Urgency tier for /) as HTMLSelectElement;
    const optionText = [...picker.options].map((option) => option.textContent);
    expect(optionText).toEqual(URGENCY_LEVELS.map((level) => urgencyTierLabel(level)));

    const optionValues = [...picker.options].map((option) => option.value);
    expect(optionValues).toEqual(URGENCY_LEVELS.map((level) => String(level)));

    expect(optionText).toContain("Tier 1 · most urgent");
    expect(optionText).toContain("Tier 3 · least urgent");
  });
});

/**
 * The urgency tier on EVERY emergency department card, spelled out, beside the stage — owner
 * ruling, 2026-08-31.
 *
 * ⚠️ **THE RULING IS "EVERY CARD", AND TIER 3 IS THE SUBSTANCE OF IT, NOT A DETAIL.** If the tier
 * showed only on tiers 1 and 2, its ABSENCE would become the signal for tier 3 — and an absence is
 * the one signal this project has repeatedly proved nobody reads. So these tests do not merely
 * check that a tier appears somewhere; they check that the number of tier labels EQUALS the number
 * of cards, which is what a "only when urgent" implementation fails.
 *
 * Each label is read back against the movement's own `urgency` in state, through the probe below,
 * rather than against a tier this file remembers — a fixture whose urgencies are re-authored must
 * not be able to make these pass while the screen shows the wrong tier.
 *
 * The expected TEXT is `urgencyTierLabel`'s own output, never a hand-written second spelling, for
 * the same reason the picker suites above use it: two spellings of one field is this project's most
 * expensive defect class.
 */
function UrgencyProbe() {
  const { movements } = useWardFlow();
  return (
    <ul data-testid="urgency-probe">
      {movements.map((movement) => (
        <li key={movement.id} data-testid={`urgency-probe-${movement.id}`} data-urgency={movement.urgency} />
      ))}
    </ul>
  );
}

/** `renderEd` plus the urgency probe. Deliberately a second helper rather than a change to
 *  `renderEd`, so the suites above render exactly the DOM they rendered before. */
function renderEdWithUrgencies() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="jhc-ed" />
      <UrgencyProbe />
    </WardFlowProvider>,
  );
}

/** The tier this movement actually carries in state, read from the probe. */
function urgencyInState(movementId: string): UrgencyLevel {
  const raw = screen.getByTestId(`urgency-probe-${movementId}`).getAttribute("data-urgency");
  const level = Number(raw);
  expect(URGENCY_LEVELS).toContain(level);
  return level as UrgencyLevel;
}

describe("emergency department cards carry the urgency tier", () => {
  it("spells the tier out on every patient card, tier 3 included", () => {
    renderEdWithUrgencies();

    // The card set is discovered from the rendered screen, never hand-listed, and a silent zero is
    // refused. `ward-ed-patient-` is also the tier label's near-neighbour prefix, so the movement id
    // is anchored to the end of the id here.
    const cards = screen.getAllByTestId(/^ward-ed-patient-WF-\d+$/);
    expect(cards.length).toBeGreaterThan(0);

    const ids = cards.map((card) => card.getAttribute("data-testid")!.replace("ward-ed-patient-", ""));

    // EVERY card, one label each: as many tier labels on the screen as there are cards. An
    // implementation that showed the tier only on the urgent ones would fail right here.
    const labels = screen.getAllByTestId(/^ward-ed-tier-WF-\d+$/);
    expect(labels).toHaveLength(cards.length);

    for (const id of ids) {
      expect(screen.getByTestId(`ward-ed-tier-${id}`)).toHaveTextContent(urgencyTierLabel(urgencyInState(id)));
    }

    // Non-vacuity, and the ruling's actual substance: a tier-3 patient is on this screen and is
    // labelled in full. Without this, a "tiers 1 and 2 only" screen could still satisfy the loop
    // above on a fixture that happened to hold no tier-3 patient.
    const tiersShown = ids.map((id) => urgencyInState(id));
    expect(tiersShown).toContain(3);
    const leastUrgentId = ids.find((id) => urgencyInState(id) === 3)!;
    expect(screen.getByTestId(`ward-ed-tier-${leastUrgentId}`)).toHaveTextContent("Tier 3 · least urgent");
  });

  it("spells the tier out on every outbox row too", () => {
    renderEdWithUrgencies();

    const rows = screen.getAllByTestId(/^ward-ed-outbox-row-WF-\d+$/);
    expect(rows.length).toBeGreaterThan(0);

    const ids = rows.map((row) => row.getAttribute("data-testid")!.replace("ward-ed-outbox-row-", ""));
    const labels = screen.getAllByTestId(/^ward-ed-outbox-tier-WF-\d+$/);
    expect(labels).toHaveLength(rows.length);

    for (const id of ids) {
      expect(screen.getByTestId(`ward-ed-outbox-tier-${id}`)).toHaveTextContent(urgencyTierLabel(urgencyInState(id)));
    }

    /*
     * ⚠️ **TODAY'S FIXTURE PUTS NO TIER-3 PATIENT IN THIS DEPARTMENT'S OUTBOX**, so the loop above
     * — true as it is — cannot see the ruling's actual case: the LEAST urgent patient still
     * carrying a label. A mutation hiding the tier on tier 3 survived this test until this block
     * was added, which is exactly the "passes for no reason" shape.
     *
     * So one is driven there, through the same controls a clinician uses, rather than by reaching
     * into the reducer or by re-authoring the fixture. The change is proven to have landed (the
     * probe reads 3 back out of state) before the row is read, so a silently refused change cannot
     * make this pass.
     */
    const subject = ids[0];
    fireEvent.click(screen.getByTestId(`ward-change-urgency-toggle-${subject}`));
    fireEvent.change(screen.getByLabelText(`Urgency tier for ${subject}`), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "reassessed" } });
    fireEvent.click(screen.getByText("Record urgency change"));

    expect(urgencyInState(subject)).toBe(3);
    expect(screen.getByTestId(`ward-ed-outbox-tier-${subject}`)).toHaveTextContent("Tier 3 · least urgent");

    // And still one label per row — the row did not lose its label by becoming least urgent.
    expect(screen.getAllByTestId(/^ward-ed-outbox-tier-WF-\d+$/)).toHaveLength(rows.length);
  });
});

/**
 * THE DEFECT THIS BLOCK EXISTS TO CATCH. `DEFAULT_DRAFT` in `ed-screen.tsx` used to seed
 * `cohort: "Adult"`, `security: "Open"`, `sex: "Female"`, `legalStatus: "Voluntary"` and
 * `urgency: 3` — five real answers nobody had chosen — so a clinician who opened "Raise a
 * referral" and pressed submit without touching a single `<select>` silently recorded all five
 * as though they were the patient's own facts. `sex` is simply wrong for anyone who is not
 * female, and `legalStatus` is a fact about a person's liberty.
 *
 * Every test below drives the real form through `fireEvent` and reads the outcome back through
 * `useWardFlow` via `LastMovementProbe`, never a rendered attribute alone — a button that merely
 * *looks* `aria-disabled` while its handler still fires would pass an attribute check and still
 * be this exact defect.
 */
describe("emergency department referral form refuses an unanswered submission", () => {
  it("does not create a referral when the form is submitted untouched", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    // The outcome, not the button's own attribute: no new movement was created, and this
    // department shows no card for the id a successful submission would have produced.
    expect(screen.getByTestId("probe")).not.toHaveTextContent(FIRST_RAISED_ID);
    expect(screen.queryByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).not.toBeInTheDocument();
  });

  /**
   * Five separate cases, each answering four of the five fields and leaving exactly one
   * unanswered — never one combined case with all five missing. A single combined test would
   * still go green with only one of the five checks actually wired, because the other four
   * missing answers would each independently block the button; only testing each field alone
   * proves every one of the five is its own gate.
   *
   * The untouched field is never reset through the UI — `fillRequiredReferralFieldsExcept`
   * simply never fires a `change` event on it, so it stays at whatever `DEFAULT_DRAFT` actually
   * seeds it with. A version of this test that filled every field and then cleared one back to
   * the placeholder would prove nothing about that field's real default — it would still pass if
   * `DEFAULT_DRAFT` regressed to the old fabricated value, because the explicit clear would erase
   * the evidence.
   */
  it.each(REQUIRED_REFERRAL_FIELDS.map((field) => field.testId))(
    "still refuses to submit when only %s is left unanswered",
    (leftUnanswered) => {
      renderEd();
      fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
      fillRequiredReferralFieldsExcept(leftUnanswered);

      fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

      expect(screen.getByTestId("probe")).not.toHaveTextContent(FIRST_RAISED_ID);
      expect(screen.queryByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).not.toBeInTheDocument();
    },
  );

  /**
   * The regression guard for the one thing this fix must NOT change: what the form does once
   * every field genuinely has an answer. Six fields are set to values deliberately different
   * from `fillRequiredReferralFields`'s own choices, so this test could not pass by accident on
   * leftover state from a previous case.
   */
  it("submits and records exactly the chosen values once every field is answered", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fireEvent.change(screen.getByTestId("ward-ed-referral-cohort"), { target: { value: "Older adult" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-security"), { target: { value: "Secure" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-sex"), { target: { value: "Male" } });
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-status"), {
      target: { value: "Involuntary inpatient" },
    });
    fireEvent.change(screen.getByTestId("ward-ed-referral-urgency"), { target: { value: "1" } });
    // Stated, not assumed — see "one-to-one nursing must be stated" below.
    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-required"));
    fireEvent.change(screen.getByTestId("ward-ed-referral-legal-form"), { target: { value: "3D" } });

    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));

    // Every answered field reached the reducer unchanged — none substituted, none dropped, and
    // no field's value bled into a different field.
    expect(screen.getByTestId("probe")).toHaveTextContent(
      `${FIRST_RAISED_ID}|3D|no-formedAt|Older adult|Secure|Male|Involuntary inpatient|1`,
    );
    expect(screen.getByTestId(`ward-ed-patient-${FIRST_RAISED_ID}`)).toBeInTheDocument();
  });
});

/**
 * The provenance reason for a legal-status change. `LEGAL_STATUS_CHANGE_REASONS[0]` —
 * `recorded_by_treating_team` — used to be pre-selected on a required field with no blank option,
 * so a clinician correcting a mistyped legal status who never touched the control filed the
 * correction as a fresh report FROM the treating team. A team that never made one.
 *
 * ⚠️ The harm-naming assertion is FIRST in each test deliberately. When an assertion fails the test
 * aborts, so anything below it never runs — a mutation reddening a later line would prove nothing
 * about the sentence that explains the defect.
 */
describe("the legal-status change reason starts unchosen", () => {
  function openFirstLegalStatusForm(): string {
    renderEd();
    const toggles = screen.getAllByTestId(/^ward-change-legal-status-toggle-/);
    expect(toggles.length, "no legal-status toggle rendered — this suite is asserting over nothing").toBeGreaterThan(0);
    const id = toggles[0].getAttribute("data-testid")!.replace("ward-change-legal-status-toggle-", "");
    fireEvent.click(toggles[0]);
    return id;
  }

  it("offers a blank option and selects it, so no reason is filed that nobody picked", () => {
    const id = openFirstLegalStatusForm();
    const select = screen
      .getByTestId(`ward-change-legal-status-${id}`)
      .querySelector(`#ward-change-legal-status-reason-${id}`) as HTMLSelectElement;

    expect(
      select.value,
      "the legal-status reason arrives pre-selected, so a clinician correcting a typo who never " +
        "touches this control files the correction as a fresh report from the treating team — a " +
        "report that team never made",
    ).toBe("");

    const options = [...select.options].map((option) => option.value);
    expect(options, "no blank option, so the clinician cannot decline to state a provenance").toContain("");
  });

  it("makes the submit unavailable, with the reason stated, until a provenance is chosen", () => {
    const id = openFirstLegalStatusForm();
    const form = screen.getByTestId(`ward-change-legal-status-${id}`);
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(
      submit.getAttribute("aria-disabled"),
      "the submit is live while no provenance is chosen, so Enter or a click files an unstated one",
    ).toBe("true");

    // Not native `disabled`: that removes the tab stop, and the stated reason would never be reached.
    expect(submit.hasAttribute("disabled"), "native disabled would hide the stated reason").toBe(false);
    expect(submit.getAttribute("title") ?? "").toContain("None is chosen for you");

    fireEvent.change(form.querySelector(`#ward-change-legal-status-reason-${id}`)!, {
      target: { value: "correcting_an_error" },
    });
    expect(submit.getAttribute("aria-disabled"), "still unavailable after a reason was chosen").toBeNull();
  });
});

/**
 * ⚠️ The worst of the six provenance defaults, and the reason the owner widened the fix from four
 * controls to six. `URGENCY_CHANGE_REASONS[0]` is `reassessed` — so a clinician correcting a
 * mistyped urgency who never touched the control recorded a CLINICAL REASSESSMENT THAT NEVER
 * HAPPENED. That invents a clinical event; the legal-status default only mis-attributed a clerical
 * one.
 */
describe("the urgency change reason starts unchosen", () => {
  it("selects no reason, so a typo correction is never filed as a reassessment nobody made", () => {
    renderEd();
    const toggles = screen.getAllByTestId(/^ward-change-urgency-toggle-/);
    expect(toggles.length, "no urgency toggle rendered — this test is asserting over nothing").toBeGreaterThan(0);
    const id = toggles[0].getAttribute("data-testid")!.replace("ward-change-urgency-toggle-", "");
    fireEvent.click(toggles[0]);

    const select = document.getElementById(`ward-change-urgency-reason-${id}`) as HTMLSelectElement;
    expect(
      select.value,
      "the urgency reason arrives pre-selected as 'reassessed', so a clinician correcting a mistyped " +
        "urgency who never touches this control records a clinical reassessment that never happened",
    ).toBe("");
    expect(
      [...select.options].map((o) => o.value),
      "no blank option to decline a reason",
    ).toContain("");
  });
});

/**
 * ⚠️ OWNER RULING 1 FALSIFIED THIS FIELD'S OWN JUSTIFYING COMMENT. An unticked checkbox cannot
 * distinguish "not required" from "not yet answered" — its unticked state is both. That was
 * harmless while nothing read it, and stopped being harmless the moment `movement.specialling`
 * became the condition on the reducer's one-to-one capacity refusal (`ward-flow-reducer.ts:966`):
 * a `false` nobody chose does not record "not required", it SKIPS THE CHECK, and a patient needing
 * one-to-one nursing can be pulled into a ward that cannot staff it.
 */
describe("one-to-one nursing must be stated, not assumed", () => {
  it("blocks the referral until one-to-one nursing is answered either way", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
    fillRequiredReferralFieldsExcept("ward-ed-referral-specialling-not-required");

    const submit = screen.getByTestId("ward-ed-referral-submit");
    expect(
      submit.getAttribute("aria-disabled"),
      "the referral can be raised with one-to-one nursing unanswered, so it is filed as 'not " +
        "required' — and the reducer only checks a ward's one-to-one capacity when the patient is " +
        "recorded as needing it, so the capacity refusal is skipped for a patient nobody assessed",
    ).toBe("true");

    // Neither radio is pre-chosen: the absence is the point, not a cleared value.
    expect(
      (screen.getByTestId("ward-ed-referral-specialling-required") as HTMLInputElement).checked,
      "'Required' arrives pre-chosen",
    ).toBe(false);
    expect(
      (screen.getByTestId("ward-ed-referral-specialling-not-required") as HTMLInputElement).checked,
      "'Not required' arrives pre-chosen, which is the old checkbox defect in a new shape",
    ).toBe(false);

    fireEvent.click(screen.getByTestId("ward-ed-referral-specialling-not-required"));
    expect(submit.getAttribute("aria-disabled"), "still blocked after the clinician answered").toBeNull();
  });
});

describe("the ED screen's statewide capacity table says which ready beds are not yet usable", () => {
  /*
   * 🔴 **OWNER RULING 2026-09-05, CARRIED TO THIS SCREEN 2026-09-06.** "Ready" counts beds the
   * application itself refuses to admit a patient into — `ward-flow-reducer.ts` rejects
   * `PULL_PATIENT` with *"every free bed at X is still being made ready"*. The ruling was explicitly
   * NOT to change the number: the cleaning count sits beside it.
   *
   * ⚠️ **THIS TABLE IS READ-ONLY AND THAT IS NOT A REASON TO OMIT THE COUNT.** Nothing on it can be
   * actioned, but a figure that overstates availability does its damage wherever it is believed,
   * not only where it is clicked. Before this, nothing in the repository asserted anything at all
   * about this table.
   *
   * The count comes from `bedsPendingPreparation`, the reducer's OWN helper — the same function
   * whose result gates the refusal — so this screen and that refusal cannot disagree.
   */
  const PREPARING_UNIT = "arm-adult-open";

  it("fixture precondition: exactly one ward has a bed discharged and still being made ready", () => {
    const preparing = bedReleases.filter((release) => release.state === "discharged" && release.preparing);
    expect(
      preparing.map((release) => release.unitId),
      "no seeded release is discharged-and-preparing, so both assertions below would be vacuous",
    ).toContain(PREPARING_UNIT);
  });

  it("shows the cleaning count beside that ward's Ready figure, and the figure itself is untouched", () => {
    renderEd();
    const cell = screen.getByTestId(`ward-ed-capacity-ready-${PREPARING_UNIT}`);
    const note = within(cell).getByTestId(`ward-ed-capacity-pending-${PREPARING_UNIT}`);

    expect(note).toHaveTextContent(/still being made ready/u);

    /*
     * The figure is read with the note stripped out, and compared against `unitCapacity` — the same
     * derivation the screen calls. Asserting the whole cell's text would conflate the ruling working
     * with the defect it forbids, which is exactly how the sibling guard on the ward screen came to
     * go red for the right behaviour.
     */
    const figure = (cell.textContent ?? "").replace(note.textContent ?? "", "").trim();
    const unit = allUnits().find((candidate) => candidate.id === PREPARING_UNIT)!;
    expect(figure, "the cleaning count was subtracted from Ready; the owner ruled the number does not move").toBe(
      String(unitCapacity(unit, bedReleases).available),
    );
  });

  it("renders no cleaning note for a ward with nothing being made ready", () => {
    /*
     * Both directions. Without this the guard above would pass on a screen that printed the note on
     * every row — which would claim every ward has a bed out of use.
     */
    const quiet = allUnits().find(
      (unit) => !bedReleases.some((r) => r.unitId === unit.id && r.state === "discharged" && r.preparing),
    )!;
    renderEd();
    expect(
      screen.queryByTestId(`ward-ed-capacity-pending-${quiet.id}`),
      `${quiet.id} has nothing being made ready and must not claim it does`,
    ).toBeNull();
  });
});
