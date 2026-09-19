import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { clearPatientProfile, PATIENT_PROFILE_STORAGE_KEY } from "@/lib/patient-profile-storage";

function renderPanel() {
  return render(
    <PatientProfileProvider>
      <PatientProfilePanel />
    </PatientProfileProvider>,
  );
}

function storedProfile(): Record<string, unknown> {
  return JSON.parse(window.sessionStorage.getItem(PATIENT_PROFILE_STORAGE_KEY) ?? "{}");
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("PatientProfilePanel — physiological input validation", () => {
  it("uses equal hepatic segments and shared choice chips for allergy selections", () => {
    renderPanel();

    expect(screen.getByRole("radiogroup", { name: "Hepatic impairment" })).toHaveAttribute("data-layout", "equal");
    const allergy = screen.getByRole("button", { name: "Penicillin" });
    expect(allergy).toHaveAttribute("data-choice-chip", "true");
    expect(allergy).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(allergy);
    expect(screen.getByRole("button", { name: "Penicillin" })).toHaveAttribute("aria-pressed", "true");
  });

  it("separates a recorded hepatic 'None' from a status that was never entered", () => {
    renderPanel();
    const group = screen.getByRole("radiogroup", { name: "Hepatic impairment" });

    // Nothing entered yet: the control says so instead of showing "None", which
    // the engine reads as an answer that clears a hepatic gate.
    expect(within(group).getByRole("radio", { name: "Not set" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "false");
    expect(storedProfile().hepatic ?? null).toBeNull();

    fireEvent.click(within(group).getByRole("radio", { name: "None" }));
    // "None" is written through as a real value, so the gate counts as assessed.
    expect(storedProfile().hepatic).toBe("none");
    expect(within(group).getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "Not set" })).toHaveAttribute("aria-checked", "false");

    fireEvent.click(within(group).getByRole("radio", { name: "Not set" }));
    expect(storedProfile().hepatic).toBeNull();
  });

  it("flags an out-of-range eGFR with an accessible error and never stores it", () => {
    renderPanel();
    const egfr = screen.getByTestId("patient-egfr") as HTMLInputElement;

    fireEvent.change(egfr, { target: { value: "-5" } });

    expect(egfr).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("id", egfr.getAttribute("aria-describedby"));
    expect(error.textContent).toMatch(/0.*250/);
    // The physiologically impossible value is committed as null, never as -5.
    expect(storedProfile().egfr).toBeNull();
    // The typed text stays visible so the clinician can correct it in place.
    expect(egfr.value).toBe("-5");
  });

  it("accepts an in-range value with no error and stores it", () => {
    renderPanel();
    const egfr = screen.getByTestId("patient-egfr") as HTMLInputElement;

    fireEvent.change(egfr, { target: { value: "45" } });

    expect(egfr).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(storedProfile().egfr).toBe(45);
  });

  it("clears an out-of-range field (and its error) when the profile is cleared", () => {
    renderPanel();
    // A valid field makes the profile non-empty so the Clear button is enabled.
    fireEvent.change(screen.getByTestId("patient-age"), { target: { value: "50" } });
    const egfr = screen.getByTestId("patient-egfr") as HTMLInputElement;
    fireEvent.change(egfr, { target: { value: "-5" } });
    expect(egfr).toHaveAttribute("aria-invalid", "true");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    // Clear resets the invalid field too, even though its stored value was already null.
    expect((screen.getByTestId("patient-age") as HTMLInputElement).value).toBe("");
    const egfrAfter = screen.getByTestId("patient-egfr") as HTMLInputElement;
    expect(egfrAfter.value).toBe("");
    expect(egfrAfter).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("converts the stored serum creatinine when the unit is switched, preserving the value", () => {
    renderPanel();
    const scr = screen.getByTestId("patient-scr") as HTMLInputElement;

    // A normal µmol/L creatinine.
    fireEvent.change(scr, { target: { value: "90" } });
    expect(storedProfile().scr).toBe(90);
    expect(storedProfile().scrUnit).toBe("umol/L");

    // Switching to mg/dL must convert (90 / 88.4 ≈ 1.02), not leave 90 to be
    // reinterpreted as 90 mg/dL by the alert engine.
    fireEvent.click(screen.getByRole("radio", { name: "mg/dL" }));
    expect(storedProfile().scrUnit).toBe("mg/dL");
    expect(storedProfile().scr as number).toBeCloseTo(1.02, 2);
    const scrMgdl = screen.getByTestId("patient-scr") as HTMLInputElement;
    expect(scrMgdl.value).toBe("1.02");
    expect(scrMgdl).not.toHaveAttribute("aria-invalid");

    // Switching back restores ~90 µmol/L (round-trip within display rounding).
    fireEvent.click(screen.getByRole("radio", { name: "µmol/L" }));
    expect(storedProfile().scrUnit).toBe("umol/L");
    expect(storedProfile().scr).toBe(90);
  });

  it("applies unit-aware bounds to serum creatinine after switching to mg/dL", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: "mg/dL" }));
    const scr = screen.getByTestId("patient-scr") as HTMLInputElement;

    // 200 mg/dL ≈ 17680 µmol/L — valid as a µmol/L number but absurd as mg/dL.
    fireEvent.change(scr, { target: { value: "200" } });
    expect(scr).toHaveAttribute("aria-invalid", "true");
    expect(storedProfile().scr).toBeNull();

    // A realistic paediatric mg/dL value is accepted.
    fireEvent.change(scr, { target: { value: "0.3" } });
    expect(scr).not.toHaveAttribute("aria-invalid");
    expect(storedProfile().scr).toBe(0.3);
  });
});

function renderTwoPanels() {
  return render(
    <PatientProfileProvider>
      <div data-testid="patient-panel-a">
        <PatientProfilePanel />
      </div>
      <div data-testid="patient-panel-b">
        <PatientProfilePanel />
      </div>
    </PatientProfileProvider>,
  );
}

/**
 * Types one character at a time the way a browser does — appending at the caret
 * to whatever the box is already showing — and returns what was displayed after
 * each keystroke. Setting the whole value in a single `fireEvent.change` cannot
 * see #WFARS3 at all: the defect is text the field was still holding.
 */
function typeDigits(input: HTMLInputElement, characters: string): string[] {
  const displayed: string[] = [];
  for (const character of characters) {
    fireEvent.change(input, { target: { value: `${input.value}${character}` } });
    displayed.push(input.value);
  }
  return displayed;
}

describe("PatientProfilePanel — CrCl and QTc entry (#WFARS3)", () => {
  it("shows exactly the digits typed into CrCl, with nothing left in front of them", () => {
    renderPanel();
    const crcl = screen.getByTestId("patient-crcl") as HTMLInputElement;

    expect(typeDigits(crcl, "95")).toEqual(["9", "95"]);
    expect(storedProfile().crcl).toBe(95);
  });

  it("treats a partial QTc as unassessed rather than as a number under the floor", () => {
    renderPanel();
    const qtc = screen.getByTestId("patient-qtc") as HTMLInputElement;

    expect(typeDigits(qtc, "420")).toEqual(["4", "42", "420"]);
    expect(storedProfile().qtc).toBe(420);

    // Backspacing into a partial is not a QTc of 42 — it is no QTc at all, and
    // the field says so rather than leaving 420 in the profile.
    fireEvent.change(qtc, { target: { value: "42" } });
    expect(storedProfile().qtc).toBeNull();
    expect(qtc).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps an out-of-range CrCl visible for correction in place, and stores nothing", () => {
    renderPanel();
    const crcl = screen.getByTestId("patient-crcl") as HTMLInputElement;

    typeDigits(crcl, "420");

    expect(crcl.value).toBe("420");
    expect(storedProfile().crcl).toBeNull();
  });

  it("never leaves one panel showing a CrCl the profile does not hold", () => {
    renderTwoPanels();
    const panelA = within(screen.getByTestId("patient-panel-a"));
    const panelB = within(screen.getByTestId("patient-panel-b"));

    // A QTc-sized number typed into CrCl is refused: 420 mL/min is out of range.
    typeDigits(panelA.getByTestId("patient-crcl") as HTMLInputElement, "420");
    expect(storedProfile().crcl).toBeNull();

    // The real CrCl is then entered on the other mounted copy of the panel.
    typeDigits(panelB.getByTestId("patient-crcl") as HTMLInputElement, "95");
    expect(storedProfile().crcl).toBe(95);

    // The first panel must follow the profile. Showing 420 beside alerts that
    // are being computed from 95 is the dosing hazard this case exists for.
    const crclA = panelA.getByTestId("patient-crcl") as HTMLInputElement;
    expect(crclA.value).toBe("95");
    expect(crclA).not.toHaveAttribute("aria-invalid");
  });

  it("does not rewrite an in-progress creatinine entry under the caret", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("radio", { name: "mg/dL" }));
    const scr = screen.getByTestId("patient-scr") as HTMLInputElement;

    // A number input reports "" for the intermediate "1." — the value IDL only
    // yields a valid floating-point number — and "1.0" for the keystroke after
    // it. Re-deriving the text from the stored number turns that "1.0" back into
    // "1", so the next digit lands as 12 mg/dL: a creatinine an order of
    // magnitude out, entered by a clinician who typed 1.02, in range and so
    // stored without any complaint. This is the silent half of #WFARS3.
    fireEvent.change(scr, { target: { value: "1" } });
    fireEvent.change(scr, { target: { value: "" } });
    fireEvent.change(scr, { target: { value: "1.0" } });
    expect(scr.value).toBe("1.0");

    expect(typeDigits(scr, "2")).toEqual(["1.02"]);
    expect(storedProfile().scr).toBe(1.02);
  });

  it("does not renumber a leading zero while it is still being typed", () => {
    renderPanel();
    const crcl = screen.getByTestId("patient-crcl") as HTMLInputElement;

    expect(typeDigits(crcl, "095")).toEqual(["0", "09", "095"]);
    expect(storedProfile().crcl).toBe(95);
  });
});

/**
 * #DTAMMK — a refused entry is stored as `null`, and so is a cleared profile, so
 * the store alone can never tell a field "your entry was refused" apart from
 * "the whole profile was wiped". The panel's reset nonce used to be local state,
 * incremented only by that panel's own Clear button, so a clear performed
 * anywhere else — a second mounted copy of the panel, or sign-out — left every
 * other mount's refused draft on screen. The fix is a clear generation shared
 * through the profile store.
 */
describe("PatientProfilePanel — a clear performed elsewhere (#DTAMMK)", () => {
  it("drops a refused entry when another mounted panel clears the profile", () => {
    renderTwoPanels();
    const panelA = within(screen.getByTestId("patient-panel-a"));
    const panelB = within(screen.getByTestId("patient-panel-b"));

    // A real age on the other panel, so the profile is non-empty and Clear is enabled.
    typeDigits(panelB.getByTestId("patient-age") as HTMLInputElement, "70");
    // A QTc-sized number typed into CrCl is refused: nothing is stored, and the
    // text stays on screen for correction in place.
    typeDigits(panelA.getByTestId("patient-crcl") as HTMLInputElement, "420");
    expect(storedProfile().crcl).toBeNull();
    expect((panelA.getByTestId("patient-crcl") as HTMLInputElement).value).toBe("420");

    // The whole profile is then cleared from the other mounted panel.
    fireEvent.click(panelB.getByRole("button", { name: "Clear" }));

    // The refused draft must go with it. Left behind, the next entry lands after
    // it: typing 95 into a box still holding 420 reads 42095 mL/min.
    const crclA = panelA.getByTestId("patient-crcl") as HTMLInputElement;
    expect(crclA.value).toBe("");
    expect(crclA).not.toHaveAttribute("aria-invalid");
    expect(typeDigits(crclA, "95")).toEqual(["9", "95"]);
    expect(storedProfile().crcl).toBe(95);
  });

  it("drops a refused entry when the account transition clears the profile", () => {
    renderPanel();
    fireEvent.change(screen.getByTestId("patient-age"), { target: { value: "70" } });
    const crcl = screen.getByTestId("patient-crcl") as HTMLInputElement;
    typeDigits(crcl, "420");
    expect(storedProfile().crcl).toBeNull();

    // Sign-out / session expiry / user change, straight through the store.
    act(() => {
      clearPatientProfile();
    });

    expect((screen.getByTestId("patient-age") as HTMLInputElement).value).toBe("");
    const crclAfter = screen.getByTestId("patient-crcl") as HTMLInputElement;
    expect(crclAfter.value).toBe("");
    expect(crclAfter).not.toHaveAttribute("aria-invalid");
  });

  it("resets a focused field in place rather than remounting it out from under the caret", () => {
    renderTwoPanels();
    const panelA = within(screen.getByTestId("patient-panel-a"));
    const panelB = within(screen.getByTestId("patient-panel-b"));

    typeDigits(panelB.getByTestId("patient-age") as HTMLInputElement, "70");
    const crclA = panelA.getByTestId("patient-crcl") as HTMLInputElement;
    typeDigits(crclA, "420");
    crclA.focus();
    expect(document.activeElement).toBe(crclA);

    fireEvent.click(panelB.getByRole("button", { name: "Clear" }));

    // The reset clears the draft by adjusting the field's own state, not by
    // changing its React key: the same input element is still in the document
    // and still holds focus. A key-driven remount would destroy this node and
    // drop focus to the body mid-entry.
    expect(crclA.value).toBe("");
    expect(crclA.isConnected).toBe(true);
    expect(document.activeElement).toBe(crclA);
    expect(panelA.getByTestId("patient-crcl")).toBe(crclA);
  });
});
