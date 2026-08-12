import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MedicationConsiderations,
  medicationVerdictRingClass,
  verdictSummaryBadge,
} from "@/components/clinical-dashboard/medication-considerations";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import { PATIENT_PROFILE_STORAGE_KEY } from "@/lib/patient-profile-storage";
import type { MedicationRecord } from "@/lib/medications";

function seedProfile(profile: Record<string, unknown>) {
  window.sessionStorage.setItem(PATIENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function renderFor(slug: string) {
  const record = getMedicationRecord(slug) as MedicationRecord;
  return render(
    <PatientProfileProvider>
      <MedicationConsiderations record={record} />
    </PatientProfileProvider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("interactions block on the medication detail page", () => {
  it("prompts for a medication list when none is entered", () => {
    renderFor("sertraline");
    expect(screen.getByText(/Add the patient’s current medications/i)).toBeInTheDocument();
  });

  it("surfaces a matched interaction with its verbatim catalogue text", () => {
    seedProfile({ medications: ["tramadol-ir"] });
    renderFor("sertraline");

    expect(screen.getByText(/With Tramadol IR/i)).toBeInTheDocument();
    expect(screen.getByText(/Serotonin Syndrome/i)).toBeInTheDocument();
  });

  it("says 'no interaction found' — scoped to what was entered, not a global all-clear", () => {
    // Acamprosate: every interaction row resolved, and none names paracetamol.
    seedProfile({ medications: ["paracetamol"] });
    renderFor("acamprosate");

    const notice = screen.getByText(/No interaction found between this medication/i);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/medication entered/i);
  });

  it("states unresolved rows plainly instead of folding them into the all-clear", () => {
    // Bupropion carries a CYP2D6-substrate row with no enumerable counterparty.
    seedProfile({ medications: ["paracetamol"] });
    renderFor("bupropion-sr");

    expect(screen.getByText(/could not be matched automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/is not shown as clear/i)).toBeInTheDocument();
  });

  it("never claims an all-clear for a medication carrying unresolved rows", () => {
    seedProfile({ medications: ["paracetamol"] });
    const { container } = renderFor("bupropion-sr");

    // The success notice must not be the story here; the review notice is.
    expect(container.textContent).toMatch(/could not be matched automatically/i);
  });
});

describe("result-row verdict presentation", () => {
  const clean = {
    tone: "success" as const,
    incomplete: false,
    interactionCount: 0,
    considerationCount: 0,
    unresolvedRowCount: 0,
  };

  it("labels a clean verdict as a finding, not a guarantee", () => {
    expect(verdictSummaryBadge(clean)).toEqual({
      id: "patient-verdict",
      label: "No interaction found",
      tone: "success",
    });
  });

  it("labels an incomplete verdict for manual review rather than clear", () => {
    const badge = verdictSummaryBadge({ ...clean, tone: "neutral", incomplete: true, unresolvedRowCount: 2 });
    expect(badge?.label).toBe("Needs manual review");
    expect(badge?.tone).toBe("neutral");
  });

  it("counts interactions and physiology alerts separately in one label", () => {
    const badge = verdictSummaryBadge({
      ...clean,
      tone: "danger",
      interactionCount: 2,
      considerationCount: 1,
    });
    expect(badge?.label).toBe("2 interactions · 1 alert");
    expect(badge?.tone).toBe("danger");
  });

  it("keeps the desktop edge on ring-*, never mixing in a border on one surface", () => {
    for (const tone of ["danger", "warning", "success", "clinical", "info"] as const) {
      const ring = medicationVerdictRingClass(tone);
      expect(ring).toMatch(/ring-/);
      expect(ring).not.toMatch(/(^|\s)border-/);
    }
  });

  it("sets the phone card edge from unlayered CSS, which is what beats [data-selected]", () => {
    const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const selectedAt = css.indexOf('.medication-mobile-result[data-selected="true"]');
    const verdictAt = css.indexOf('.medication-mobile-result[data-verdict="danger"]');
    expect(selectedAt).toBeGreaterThan(-1);
    expect(verdictAt).toBeGreaterThan(-1);
    // Equal specificity, so source order decides. The verdict must come last or
    // the top hit renders its interaction warning with a neutral edge.
    expect(verdictAt).toBeGreaterThan(selectedAt);
  });

  it("leaves the neutral desktop row to the list divider rather than ringing it", () => {
    expect(medicationVerdictRingClass("neutral")).toBeNull();
  });
});
