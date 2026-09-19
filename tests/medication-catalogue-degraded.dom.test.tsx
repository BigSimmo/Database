/**
 * #8GB18R (a) — `/api/medications` reported a seed-served catalogue and the medications
 * surface said nothing about it on the line a reader actually scans.
 *
 * The route has emitted `retainedSnapshot` since the 2026-09-16 outage, and the workspace
 * turned it into a collapsible "Retained copy" drawer — but the pinned count band above that
 * drawer stated a confident number with nothing to qualify it, and the drawer's own wording
 * shared not one word with the phrase every other surface uses. One fact was being told twice,
 * in two voices, in one of which it was not told at all.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MedicationPrescribingWorkspace } from "@/components/clinical-dashboard/medication-prescribing-workspace";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { catalogueDegradedNotice } from "@/lib/site-content/catalogue-seed-fallback";

const catalog = vi.hoisted(() => ({ retainedSnapshot: false }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

vi.mock("@/components/clinical-dashboard/use-medication-catalog", () => ({
  useMedicationCatalog: () => ({
    data: {
      records: [],
      matches: [
        {
          medication: undefined,
          result: {
            id: "clozapine",
            name: "Clozapine",
            indication: "Treatment-resistant schizophrenia",
            match: "Exact clinical fit",
            dose: "12.5 mg",
            ceiling: "900 mg",
            action: "Avoid abrupt cessation",
            actionTone: "danger",
            tone: "teal",
          },
          score: 1,
          reasons: [],
        },
      ],
      total: 1,
      governance: {},
      ...(catalog.retainedSnapshot ? { retainedSnapshot: true } : {}),
    },
    loading: false,
    error: null,
  }),
}));

function renderWorkspace() {
  return render(
    <PatientProfileProvider>
      <MedicationPrescribingWorkspace
        query="clozapine"
        loading={false}
        realDataReady
        authUnavailable={false}
        apiUnavailable={false}
        setupWarning={null}
        onSuggestedSearch={vi.fn()}
        showHome={false}
      />
    </PatientProfileProvider>,
  );
}

afterEach(() => {
  catalog.retainedSnapshot = false;
  cleanup();
});

describe("medication results say when the catalogue may be stale", () => {
  it("qualifies the count band, not only the drawer, when the snapshot was retained", () => {
    catalog.retainedSnapshot = true;
    renderWorkspace();

    // Two places, one phrase: the pinned count line and the retained-copy notice below it.
    expect(screen.getAllByText(new RegExp(catalogueDegradedNotice, "i")).length).toBeGreaterThanOrEqual(2);
  });

  it("says nothing when the published catalogue was read normally", () => {
    renderWorkspace();

    expect(screen.queryByText(new RegExp(catalogueDegradedNotice, "i"))).toBeNull();
    expect(screen.queryByText("Retained copy")).toBeNull();
  });

  it("still shows the results it has, because the records themselves are real", () => {
    catalog.retainedSnapshot = true;
    renderWorkspace();

    expect(screen.getAllByText("Clozapine").length).toBeGreaterThan(0);
  });
});
