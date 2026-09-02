import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { PATIENT_PROFILE_STORAGE_KEY } from "@/lib/patient-profile-storage";

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
    expect(within(group).getByRole("radio", { name: "Not recorded" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "false");
    expect(storedProfile().hepatic ?? null).toBeNull();

    fireEvent.click(within(group).getByRole("radio", { name: "None" }));
    // "None" is written through as a real value, so the gate counts as assessed.
    expect(storedProfile().hepatic).toBe("none");
    expect(within(group).getByRole("radio", { name: "None" })).toHaveAttribute("aria-checked", "true");
    expect(within(group).getByRole("radio", { name: "Not recorded" })).toHaveAttribute("aria-checked", "false");

    fireEvent.click(within(group).getByRole("radio", { name: "Not recorded" }));
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
