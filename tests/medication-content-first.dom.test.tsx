import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { MedicationRecordPage } from "@/components/clinical-dashboard/medication-record-page";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";
import { medicationIdentityBadges, type MedicationGovernance } from "@/lib/medication-badges";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import type { MedicationRecord } from "@/lib/medications";

type DetailState = {
  data: { record: MedicationRecord } | null;
  loading: boolean;
  error: string | null;
};

// Mutable holder so each test can drive the mocked detail hook.
const hook = vi.hoisted(() => ({ detail: null as unknown as DetailState }));
vi.mock("@/components/clinical-dashboard/use-medication-catalog", () => ({
  useMedicationDetail: () => hook.detail,
  useMedicationCatalog: () => ({ data: null, loading: false, error: null }),
}));

// Partial mock: keep every real export (the detail body renders normally) but wrap
// medicationIdentityBadges in a spy that still calls through, so we can assert the
// exact governance MedicationRecordPage hands down — robust against badge rendering,
// ordering, and BadgeCluster overflow.
vi.mock("@/lib/medication-badges", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/medication-badges")>();
  return { ...actual, medicationIdentityBadges: vi.fn(actual.medicationIdentityBadges) };
});
const badgesSpy = vi.mocked(medicationIdentityBadges);

const record = loadMedicationSnapshot()[0];
const liveRecord: MedicationRecord = { ...record, name: `${record.name} (live)` };

// The detail body renders PatientProfilePanel, which reads the sessionStorage-backed
// patient-profile context — provide the real provider so the tree renders faithfully.
function renderPage(ui: ReactElement) {
  return render(ui, { wrapper: PatientProfileProvider });
}

describe("MedicationRecordPage content-first fallback", () => {
  it("paints the fallback record immediately during loading instead of the skeleton", () => {
    hook.detail = { data: null, loading: true, error: null };
    renderPage(<MedicationRecordPage slug="example" fallbackRecord={record} />);
    expect(screen.getByRole("heading", { name: record.name })).toBeInTheDocument();
    expect(screen.queryByText(/Loading medication reference/i)).not.toBeInTheDocument();
  });

  it("swaps in the live record once the fetch resolves", () => {
    hook.detail = { data: { record: liveRecord }, loading: false, error: null };
    renderPage(<MedicationRecordPage slug="example" fallbackRecord={record} />);
    expect(screen.getByRole("heading", { name: liveRecord.name })).toBeInTheDocument();
  });

  it("shows the skeleton while loading when there is no fallback (owner-only slug)", () => {
    hook.detail = { data: null, loading: true, error: null };
    renderPage(<MedicationRecordPage slug="owner-only" />);
    expect(screen.getByText(/Loading medication reference/i)).toBeInTheDocument();
  });

  it("shows the error/not-found state when there is no fallback and the fetch fails", () => {
    hook.detail = { data: null, loading: false, error: "Could not load medication." };
    renderPage(<MedicationRecordPage slug="owner-only" />);
    expect(screen.getByText("Could not load medication.")).toBeInTheDocument();
  });

  it("keeps showing fallback content when the live fetch fails (graceful content-first)", () => {
    hook.detail = { data: null, loading: false, error: "boom" };
    renderPage(<MedicationRecordPage slug="example" fallbackRecord={record} />);
    expect(screen.getByRole("heading", { name: record.name })).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  const fallbackGovernance: MedicationGovernance = { sourceStatus: "current", validationStatus: "approved" };

  it("presents the SSR fallback governance to the record while the live fetch is loading", () => {
    hook.detail = { data: null, loading: true, error: null };
    badgesSpy.mockClear();
    renderPage(<MedicationRecordPage slug="example" fallbackRecord={record} fallbackGovernance={fallbackGovernance} />);
    // Loading with no error → the fixture-derived fallback governance is shown.
    expect(badgesSpy.mock.calls.at(-1)?.[1]).toEqual(fallbackGovernance);
  });

  it("drops the fallback governance (not authoritative) once the live fetch fails", () => {
    hook.detail = { data: null, loading: false, error: "boom" };
    badgesSpy.mockClear();
    renderPage(<MedicationRecordPage slug="example" fallbackRecord={record} fallbackGovernance={fallbackGovernance} />);
    // A failed fetch means the authoritative status is unknown, so governance must
    // NOT keep presenting the fixture value — this is the `error ? undefined : ...`
    // guard, and the test fails if that error check is dropped.
    expect(badgesSpy.mock.calls.at(-1)?.[1]).toBeUndefined();
    // ...while the record content itself still renders (graceful content-first).
    expect(screen.getByRole("heading", { name: record.name })).toBeInTheDocument();
  });
});
