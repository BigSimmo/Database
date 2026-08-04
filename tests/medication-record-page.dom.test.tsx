import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MedicationRecordPage } from "@/components/clinical-dashboard/medication-record-page";
import type { MedicationRecord } from "@/lib/medications";

// Controllable data-hook mock so each test drives one content-first state.
const { useMedicationDetail } = vi.hoisted(() => ({ useMedicationDetail: vi.fn() }));
vi.mock("@/components/clinical-dashboard/use-medication-catalog", () => ({ useMedicationDetail }));
// The two heavy sidebar panels carry their own data concerns; stub them so these
// tests isolate the page's content-first + governance-reconciliation logic.
vi.mock("@/components/clinical-dashboard/patient-profile-panel", () => ({ PatientProfilePanel: () => null }));
vi.mock("@/components/clinical-dashboard/medication-considerations", () => ({ MedicationConsiderations: () => null }));

function mockDetail(state: { data: unknown; loading: boolean; error: string | null }) {
  useMedicationDetail.mockReturnValue(state);
}

// Minimal record with no `src` "...checked" text, so the "Reviewed" identity
// badge depends purely on governance — which lets us assert the governance-drop
// invariant cleanly (isReviewed() otherwise falls back to source-review text).
const fallbackDrug: MedicationRecord = {
  slug: "test-med",
  name: "Fallback Drug",
  class: "Test class",
  subclass: "",
  category: "",
  accent: "#0f766e",
  tag: "",
  schedule: "",
  stats: [],
  sections: [],
  quick: [],
};
const liveDrug: MedicationRecord = { ...fallbackDrug, name: "Live Drug" };

describe("MedicationRecordPage content-first states", () => {
  it("renders the SSR fallback record immediately during loading, not the skeleton", () => {
    mockDetail({ data: null, loading: true, error: null });
    render(<MedicationRecordPage slug="test-med" fallbackRecord={fallbackDrug} />);
    expect(screen.getByRole("heading", { name: "Fallback Drug" })).toBeInTheDocument();
    expect(screen.queryByText(/Loading medication reference/i)).not.toBeInTheDocument();
  });

  it("shows the skeleton when loading with no fallback record", () => {
    mockDetail({ data: null, loading: true, error: null });
    render(<MedicationRecordPage slug="owner-only" />);
    expect(screen.getByText(/Loading medication reference/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fallback Drug" })).not.toBeInTheDocument();
  });

  it("live swap-in prefers the live record over the SSR fallback", () => {
    mockDetail({ data: { record: liveDrug, governance: null }, loading: false, error: null });
    render(<MedicationRecordPage slug="test-med" fallbackRecord={fallbackDrug} />);
    expect(screen.getByRole("heading", { name: "Live Drug" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fallback Drug" })).not.toBeInTheDocument();
  });

  it("renders the error panel when nothing renderable exists", () => {
    mockDetail({ data: null, loading: false, error: "Network unavailable" });
    render(<MedicationRecordPage slug="test-med" />);
    expect(screen.getByText("Network unavailable")).toBeInTheDocument();
  });

  it("drops fixture governance on error so a fixture 'Reviewed' badge does not persist as authoritative", () => {
    mockDetail({ data: null, loading: false, error: "boom" });
    render(
      <MedicationRecordPage
        slug="test-med"
        fallbackRecord={fallbackDrug}
        fallbackGovernance={{ validationStatus: "approved" }}
      />,
    );
    // Content-first still paints the record...
    expect(screen.getByRole("heading", { name: "Fallback Drug" })).toBeInTheDocument();
    // ...but the fixture's approved-governance "Reviewed" badge must not survive
    // the error, because the authoritative status is now unknown.
    expect(screen.queryByText("Reviewed")).not.toBeInTheDocument();
  });

  it("keeps the SSR fallback governance badge while the fetch is still in flight", () => {
    mockDetail({ data: null, loading: true, error: null });
    render(
      <MedicationRecordPage
        slug="test-med"
        fallbackRecord={fallbackDrug}
        fallbackGovernance={{ validationStatus: "approved" }}
      />,
    );
    // Contrast to the error case: while loading (no error) the SSR-provided
    // governance is trusted, so the "Reviewed" badge shows.
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
  });
});
