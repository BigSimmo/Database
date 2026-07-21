import { fireEvent, render, screen } from "@testing-library/react";
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

  it("applies unit-aware bounds to serum creatinine after switching to mg/dL", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "mg/dL" }));
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
