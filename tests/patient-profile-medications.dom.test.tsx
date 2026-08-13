import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { isProfileEmpty } from "@/lib/medication-patient-alerts";
import {
  PATIENT_PROFILE_MAX_MEDICATIONS,
  PATIENT_PROFILE_STORAGE_KEY,
  sanitizeMedicationSlugs,
  sanitizeProfile,
} from "@/lib/patient-profile-storage";

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

describe("current-medications picker", () => {
  it("adds a catalogue medication and persists its slug", () => {
    renderPanel();

    fireEvent.change(screen.getByTestId("patient-medication-search"), { target: { value: "sertral" } });
    fireEvent.click(screen.getByTestId("patient-medication-add-sertraline"));

    expect(storedProfile().medications).toEqual(["sertraline"]);
    expect(screen.getByTestId("patient-medication-sertraline")).toBeInTheDocument();
  });

  it("clears the search box after adding, so the next drug starts fresh", () => {
    renderPanel();
    const search = screen.getByTestId("patient-medication-search") as HTMLInputElement;

    fireEvent.change(search, { target: { value: "sertral" } });
    fireEvent.click(screen.getByTestId("patient-medication-add-sertraline"));

    expect(search.value).toBe("");
  });

  it("removes a medication when its chip is activated again", () => {
    renderPanel();

    fireEvent.change(screen.getByTestId("patient-medication-search"), { target: { value: "sertral" } });
    fireEvent.click(screen.getByTestId("patient-medication-add-sertraline"));
    fireEvent.click(screen.getByTestId("patient-medication-sertraline"));

    expect(storedProfile().medications).toEqual([]);
    expect(screen.queryByTestId("patient-medication-sertraline")).not.toBeInTheDocument();
  });

  it("gives the remove control a name that survives without the icon", () => {
    renderPanel();
    fireEvent.change(screen.getByTestId("patient-medication-search"), { target: { value: "sertral" } });
    fireEvent.click(screen.getByTestId("patient-medication-add-sertraline"));

    expect(screen.getByTestId("patient-medication-sertraline")).toHaveAttribute("aria-label", "Remove Sertraline");
  });

  it("offers nothing for a drug outside the catalogue, and says why", () => {
    renderPanel();

    fireEvent.change(screen.getByTestId("patient-medication-search"), { target: { value: "warfarinx" } });

    expect(screen.getByText(/Only medications in this catalogue can be interaction-checked/i)).toBeInTheDocument();
  });

  it("drops the medication list and the search term on Clear", () => {
    renderPanel();
    fireEvent.change(screen.getByTestId("patient-medication-search"), { target: { value: "sertral" } });
    fireEvent.click(screen.getByTestId("patient-medication-add-sertraline"));

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(storedProfile().medications).toEqual([]);
    expect((screen.getByTestId("patient-medication-search") as HTMLInputElement).value).toBe("");
  });

  it("never persists more than the medication cap", () => {
    const seeded = Array.from({ length: PATIENT_PROFILE_MAX_MEDICATIONS }, (_, index) => `drug-${index}`);
    window.sessionStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, JSON.stringify({ medications: seeded }));
    renderPanel();

    fireEvent.change(screen.getByTestId("patient-medication-search"), { target: { value: "sertral" } });
    fireEvent.click(screen.getByTestId("patient-medication-add-sertraline"));

    expect((storedProfile().medications as string[]).length).toBe(PATIENT_PROFILE_MAX_MEDICATIONS);
  });
});

describe("medication-list sanitisation", () => {
  it("keeps well-formed slugs, de-duplicated and sorted", () => {
    expect(sanitizeMedicationSlugs(["sertraline", "aspirin", "sertraline"])).toEqual(["aspirin", "sertraline"]);
  });

  it("rejects non-strings and malformed slugs rather than storing them", () => {
    expect(sanitizeMedicationSlugs([1, null, {}, "Not A Slug", "-leading", "has_underscore", ""])).toEqual([]);
  });

  it("normalises case rather than dropping an otherwise valid slug", () => {
    expect(sanitizeMedicationSlugs([" Sertraline "])).toEqual(["sertraline"]);
  });

  it("caps a corrupted list instead of evaluating it unbounded", () => {
    const many = Array.from({ length: 200 }, (_, index) => `drug-${index}`);
    expect(sanitizeMedicationSlugs(many).length).toBeLessThanOrEqual(PATIENT_PROFILE_MAX_MEDICATIONS);
  });

  it("returns an empty list for a non-array value", () => {
    expect(sanitizeMedicationSlugs("sertraline")).toEqual([]);
    expect(sanitizeProfile({ medications: "sertraline" }).medications).toEqual([]);
  });
});

describe("isProfileEmpty", () => {
  it("treats a medication list as a populated profile", () => {
    expect(isProfileEmpty({ medications: [] })).toBe(true);
    expect(isProfileEmpty({ medications: ["sertraline"] })).toBe(false);
  });
});
