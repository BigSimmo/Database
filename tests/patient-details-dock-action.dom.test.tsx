import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PatientDetailsDockAction } from "@/components/clinical-dashboard/patient-details-dock-action";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { patientDetailsAddonSlotId } from "@/lib/mode-home-composer";
import { PATIENT_PROFILE_STORAGE_KEY } from "@/lib/patient-profile-storage";

/** Stand in for the phone dock's addon slot, which MasterSearchHeader renders. */
function mountSlot(): HTMLElement {
  const slot = document.createElement("div");
  slot.id = patientDetailsAddonSlotId;
  document.body.append(slot);
  return slot;
}

function setPhoneViewport(isPhone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: isPhone,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderAction() {
  return render(
    <PatientProfileProvider>
      <PatientDetailsDockAction />
    </PatientProfileProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  setPhoneViewport(true);
});

afterEach(() => {
  window.sessionStorage.clear();
  document.getElementById(patientDetailsAddonSlotId)?.remove();
  vi.unstubAllGlobals();
});

describe("PatientDetailsDockAction", () => {
  it("portals into the dock's addon slot rather than positioning itself", () => {
    const slot = mountSlot();
    renderAction();

    const action = screen.getByTestId("patient-details-dock-action");
    expect(slot.contains(action)).toBe(true);
  });

  it("renders nothing when the dock exposes no slot", () => {
    renderAction();
    expect(screen.queryByTestId("patient-details-dock-action")).not.toBeInTheDocument();
  });

  it("renders nothing above the phone breakpoint, where the panel is already inline", () => {
    setPhoneViewport(false);
    mountSlot();
    renderAction();

    expect(screen.queryByTestId("patient-details-dock-action")).not.toBeInTheDocument();
  });

  it("is a real button that opens the patient sheet", () => {
    mountSlot();
    renderAction();

    const action = screen.getByTestId("patient-details-dock-action");
    expect(action).toHaveAttribute("type", "button");
    expect(action).toHaveAttribute("aria-haspopup", "dialog");
    expect(action).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(action);

    expect(screen.getByRole("dialog", { name: "Patient details" })).toBeInTheDocument();
    expect(screen.getByTestId("patient-details-dock-action")).toHaveAttribute("aria-expanded", "true");
  });

  it("announces an empty profile without relying on the count badge", () => {
    mountSlot();
    renderAction();

    expect(screen.getByText("No patient details entered")).toBeInTheDocument();
  });

  it("counts every entered dimension, not just medications", () => {
    window.sessionStorage.setItem(
      PATIENT_PROFILE_STORAGE_KEY,
      JSON.stringify({ ageYears: 70, medications: ["sertraline", "aspirin"], allergies: ["penicillin"] }),
    );
    mountSlot();
    renderAction();

    // age + 2 medications + 1 allergy
    expect(screen.getByText("4 details entered")).toBeInTheDocument();
  });

  it("takes the accent treatment once a profile is loaded", () => {
    window.sessionStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, JSON.stringify({ medications: ["sertraline"] }));
    mountSlot();
    renderAction();

    expect(screen.getByTestId("patient-details-dock-action").className).toContain(
      "patient-details-fab__button--active",
    );
  });

  it("stays visually quiet while the profile is empty", () => {
    mountSlot();
    renderAction();

    expect(screen.getByTestId("patient-details-dock-action").className).not.toContain(
      "patient-details-fab__button--active",
    );
  });
});
