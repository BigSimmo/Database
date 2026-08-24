import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
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
 */
function LastMovementProbe() {
  const { movements } = useWardFlow();
  const last = movements.at(-1);
  return (
    <p data-testid="probe">
      {last?.id ?? "none"}|{last?.legalForm?.code ?? "no-form"}|{last?.formedAt ?? "no-formedAt"}
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

/** Opens the intake form, sets the legal-form picker to `code`, and submits. */
function raiseReferralWithForm(code: string) {
  fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
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

  it("raises a referral with no form when the picker is left alone", () => {
    renderEd();
    fireEvent.click(screen.getByTestId("ward-ed-raise-referral-toggle"));
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
    expect(outstanding).toHaveTextContent("No examination outcome recorded for this movement.");
    // The software may not say what a Form 1A means or what it referred this person for. The
    // draft above is Voluntary by default, so the deleted wording would have been false here as
    // well as unattributed.
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
