import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MedicationRecordPage } from "@/components/clinical-dashboard/medication-record-page";
import type { MedicationRecord } from "@/lib/medications";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

// Controllable data-hook mock so each test drives one content-first state.
const { useMedicationDetail } = vi.hoisted(() => ({ useMedicationDetail: vi.fn() }));
vi.mock("@/components/clinical-dashboard/use-medication-catalog", () => ({ useMedicationDetail }));
// The two patient panels carry their own data concerns; stub them to a findable
// marker so these tests can assert *where* they render without pulling in the
// profile store.
vi.mock("@/components/clinical-dashboard/patient-profile-panel", () => ({
  PatientProfilePanel: () => <p>patient-profile-panel</p>,
}));
vi.mock("@/components/clinical-dashboard/medication-considerations", () => ({
  MedicationConsiderations: () => <p>medication-considerations</p>,
}));

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

  it("moves the patient panels out of the body and behind the header control", async () => {
    // Both cards left the page body; the feature did not leave with them. The
    // entry point is the header's patients control, and the panels render inside
    // the sheet it opens.
    const user = userEvent.setup();
    mockDetail({ data: { record: liveDrug, governance: null }, loading: false, error: null });
    render(<MedicationRecordPage slug="test-med" fallbackRecord={fallbackDrug} />);

    expect(screen.queryByText("patient-profile-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("medication-considerations")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Patient details" }));
    const sheet = screen.getByTestId("medication-patient-sheet");
    expect(within(sheet).getByText("patient-profile-panel")).toBeInTheDocument();
    expect(within(sheet).getByText("medication-considerations")).toBeInTheDocument();
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
