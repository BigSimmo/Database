import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { MedicationInteractionCallout } from "@/components/clinical-dashboard/medication-considerations";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import { PATIENT_PROFILE_STORAGE_KEY } from "@/lib/patient-profile-storage";
import type { MedicationRecord } from "@/lib/medications";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("MedicationInteractionCallout tap targets", () => {
  it("keeps each counterparty navigation link at the production tap-height floor", () => {
    window.sessionStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, JSON.stringify({ medications: ["tramadol-ir"] }));
    const record = getMedicationRecord("sertraline") as MedicationRecord;

    render(
      <PatientProfileProvider>
        <MedicationInteractionCallout
          record={record}
          onOpenPatientDetails={() => {}}
          onOpenInteractionsSection={() => {}}
        />
      </PatientProfileProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /interaction with this patient/i }));

    expect(screen.getByRole("link", { name: /Tramadol IR/i })).toHaveClass("min-h-tap");
  });
});
