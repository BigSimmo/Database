import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { medicationTabForSectionType } from "@/components/clinical-dashboard/medication-nav-header";
import {
  MedicationConsiderations,
  MedicationInteractionCallout,
  verdictIcon,
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

  it("says so plainly when the catalogue has no interaction data at all", () => {
    // `dataAvailable: false` reports a synthetic unresolvedRowCount of 1 against
    // a totalRowCount of 0, so the ordinary "N of M rows" copy would read
    // "1 of this medication's 0 interaction rows". Different reason, different words.
    seedProfile({ medications: ["paracetamol"] });
    const record = { ...(getMedicationRecord("acamprosate") as MedicationRecord), slug: "not-in-the-index" };
    render(
      <PatientProfileProvider>
        <MedicationConsiderations record={record} />
      </PatientProfileProvider>,
    );

    expect(screen.getByText(/carries no interaction data for this medication/i)).toBeInTheDocument();
    expect(screen.queryByText(/of this medication.s 0 interaction/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not shown as clear/i)).toBeInTheDocument();
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
    expect(verdictSummaryBadge(clean)).toMatchObject({
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

describe("verdict icons", () => {
  it("gives every tone its own glyph, including the two the shared badge default leaves bare", () => {
    const icons = (["danger", "warning", "success", "neutral", "clinical", "info"] as const).map((tone) =>
      verdictIcon(tone),
    );
    expect(icons.every(Boolean)).toBe(true);
    // success and neutral are the ones that matter: "checked, nothing found" and
    // "could not check" must be distinguishable without reading the border colour.
    expect(verdictIcon("success")).not.toBe(verdictIcon("neutral"));
    expect(verdictIcon("success")).not.toBe(verdictIcon("danger"));
    expect(verdictIcon("neutral")).not.toBe(verdictIcon("warning"));
  });

  it("attaches an icon to the verdict badge in every branch", () => {
    const base = {
      tone: "success" as const,
      incomplete: false,
      interactionCount: 0,
      considerationCount: 0,
      unresolvedRowCount: 0,
    };
    expect(verdictSummaryBadge(base)?.icon).toBe(verdictIcon("success"));
    expect(verdictSummaryBadge({ ...base, tone: "neutral", incomplete: true })?.icon).toBe(verdictIcon("neutral"));
    expect(verdictSummaryBadge({ ...base, tone: "danger", interactionCount: 1 })?.icon).toBe(verdictIcon("danger"));
  });
});

describe("MedicationInteractionCallout", () => {
  function renderCallout(slug: string, onPatient = () => {}, onSection = () => {}) {
    const record = getMedicationRecord(slug) as MedicationRecord;
    return render(
      <PatientProfileProvider>
        <MedicationInteractionCallout
          record={record}
          onOpenPatientDetails={onPatient}
          onOpenInteractionsSection={onSection}
        />
      </PatientProfileProvider>,
    );
  }

  /** The disclosure trigger — the only thing visible before a tap. */
  function trigger() {
    return screen.getByRole("button", { name: /interactions? with this patient/i });
  }

  function expand() {
    fireEvent.click(trigger());
  }

  it("renders nothing when no interaction matched — it is not an empty-state surface", () => {
    seedProfile({ medications: ["paracetamol"] });
    renderCallout("acamprosate");
    expect(screen.queryByTestId("medication-interaction-callout")).not.toBeInTheDocument();
  });

  it("starts collapsed, so the record's own content is not pushed down", () => {
    seedProfile({ medications: ["tramadol-ir", "ibuprofen"] });
    renderCallout("sertraline");

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    // Present in the DOM (Disclosure hides rather than unmounts) but collapsed.
    const panel = screen.getByRole("region");
    expect(panel).toHaveAttribute("data-open", "false");
    expect(panel).toHaveClass("hidden");
  });

  it("keeps severity, count and the interacting drugs legible while collapsed", () => {
    seedProfile({ medications: ["tramadol-ir", "ibuprofen"] });
    renderCallout("sertraline");

    // Count + severity on the trigger; the drug names in the visible summary.
    expect(trigger()).toHaveAccessibleName(/2 interactions with this patient/i);
    expect(screen.getByText("CRITICAL", { selector: "button span" })).toBeVisible();
    expect(screen.getByText(/Tramadol IR · Ibuprofen/)).toBeVisible();
  });

  it("reveals the panel on tap", () => {
    seedProfile({ medications: ["tramadol-ir"] });
    renderCallout("sertraline");

    expand();

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Massive risk of Serotonin Syndrome/i)).toBeVisible();
  });

  it("names each interacting drug and links to its own record", () => {
    seedProfile({ medications: ["tramadol-ir", "ibuprofen"] });
    renderCallout("sertraline");
    expand();

    expect(screen.getByTestId("medication-interaction-callout")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Tramadol IR/ });
    expect(link).toHaveAttribute("href", "/medications/tramadol-ir");
    expect(screen.getByRole("link", { name: /Ibuprofen/ })).toHaveAttribute("href", "/medications/ibuprofen");
  });

  it("shows the verbatim catalogue wording, not a summary of it", () => {
    seedProfile({ medications: ["tramadol-ir"] });
    renderCallout("sertraline");
    expand();
    expect(screen.getByText(/Massive risk of Serotonin Syndrome/i)).toBeVisible();
  });

  it("lists the most severe first and counts the rest rather than hiding them", () => {
    // Four interacting drugs; the callout shows three and reports the remainder.
    seedProfile({ medications: ["tramadol-ir", "ibuprofen", "naproxen", "diclofenac"] });
    renderCallout("sertraline");
    expand();

    const shown = screen.getAllByTestId(/^medication-callout-(?!open-)/);
    expect(shown).toHaveLength(3);
    expect(screen.getByText(/\+1 more/)).toBeVisible();
  });

  it("opens the Key Interactions section and the patient sheet from the callout", () => {
    const onPatient = vi.fn();
    const onSection = vi.fn();
    seedProfile({ medications: ["tramadol-ir"] });
    renderCallout("sertraline", onPatient, onSection);
    expand();

    fireEvent.click(screen.getByTestId("medication-callout-open-section"));
    expect(onSection).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId("medication-callout-open-patient"));
    expect(onPatient).toHaveBeenCalledOnce();
  });
});

describe("interaction section targeting", () => {
  it("resolves the tab that actually holds Key Interactions", () => {
    // Hardcoding "more" would leave the callout's jump pointing at the old tab
    // the day a section moves.
    expect(medicationTabForSectionType("inter")).toBe("more");
    expect(medicationTabForSectionType("dose")).toBe("dosing");
    expect(medicationTabForSectionType("not-a-section")).toBeNull();
  });
});
