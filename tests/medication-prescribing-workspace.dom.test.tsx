import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MedicationPrescribingWorkspace } from "@/components/clinical-dashboard/medication-prescribing-workspace";
import { PatientProfileProvider } from "@/components/clinical-dashboard/patient-profile-context";

// The prescribing results view filters a medication catalogue through a
// best/indication/safety/monitoring lens strip. The catalogue hook fetches
// `/api/medications` (and reads the auth session), so it is mocked with a fixed
// set of results chosen to land in different filter buckets; the filter strip is
// the unit under test. Only usePatientProfile needs a real provider (the profile
// stays empty here, so no per-patient alert badges are computed).

type Result = {
  id: string;
  name: string;
  indication: string;
  match: string;
  dose: string;
  ceiling: string;
  action: string;
  actionTone: "danger" | "warning" | "neutral";
  tone: "teal" | "blue" | "slate";
};

// Clozapine: danger + exact fit → best, indication, safety (not monitoring).
const clozapine: Result = {
  id: "clozapine",
  name: "Clozapine",
  indication: "Treatment-resistant schizophrenia",
  match: "Exact clinical fit",
  dose: "12.5 mg",
  ceiling: "900 mg",
  action: "Avoid abrupt cessation",
  actionTone: "danger",
  tone: "teal",
};
// Lithium: warning + monitor language → every filter.
const lithium: Result = {
  id: "lithium",
  name: "Lithium",
  indication: "Bipolar maintenance",
  match: "Exact clinical fit",
  dose: "400 mg",
  ceiling: "1.2 mmol",
  action: "Monitor serum levels",
  actionTone: "warning",
  tone: "blue",
};
// Sertraline: neutral + related match → best only.
const sertraline: Result = {
  id: "sertraline",
  name: "Sertraline",
  indication: "Depression",
  match: "Related match",
  dose: "50 mg",
  ceiling: "200 mg",
  action: "First-line option",
  actionTone: "neutral",
  tone: "slate",
};

const catalogInterpretation = vi.hoisted(() => ({
  current: undefined as
    | {
        correctedQuery?: string;
        corrections?: Array<{ from: string; to: string }>;
        appliedExpansions?: string[];
      }
    | undefined,
}));

// Cross-mode "also matches" strip is a separate AuthProvider-backed component;
// stub it so this test isolates the filter strip from that component's auth deps.
vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

vi.mock("@/components/clinical-dashboard/use-medication-catalog", () => ({
  useMedicationCatalog: () => ({
    data: {
      records: [],
      matches: [clozapine, lithium, sertraline].map((result) => ({
        medication: undefined,
        result,
        score: 1,
        reasons: [],
      })),
      interpretation: catalogInterpretation.current,
      total: 3,
      governance: {},
    },
    loading: false,
    error: null,
  }),
}));

function renderWorkspace(overrides: Partial<{ query: string; showHome: boolean }> = {}) {
  return render(
    <PatientProfileProvider>
      <MedicationPrescribingWorkspace
        query={overrides.query ?? "prescribing"}
        loading={false}
        realDataReady
        authUnavailable={false}
        apiUnavailable={false}
        setupWarning={null}
        onSuggestedSearch={vi.fn()}
        showHome={overrides.showHome}
      />
    </PatientProfileProvider>,
  );
}

// Each result name renders in both the desktop table and the mobile card list,
// so a visible row appears more than once; a filtered-out row appears zero times.
function rowVisible(name: string): boolean {
  return screen.queryAllByText(name).length > 0;
}

function filterButton(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label}`, "i") });
}

afterEach(() => {
  catalogInterpretation.current = undefined;
  vi.restoreAllMocks();
});

describe("MedicationPrescribingWorkspace — home vs submitted results", () => {
  it("keeps the medication home while a draft query is typed before submit", () => {
    renderWorkspace({ query: "l", showHome: true });
    expect(screen.getByTestId("medication-home")).toBeInTheDocument();
    expect(screen.queryByTestId("medication-result-clozapine-desktop")).not.toBeInTheDocument();
    expect(screen.queryByText(/Searching/i)).not.toBeInTheDocument();
  });

  it("shows medication results only after the parent marks the search submitted", () => {
    renderWorkspace({ query: "l", showHome: false });
    expect(screen.queryByTestId("medication-home")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("medication-result-clozapine-desktop").length).toBeGreaterThan(0);
  });
});

describe("MedicationPrescribingWorkspace — query interpretation", () => {
  it("shows the API corrected query as a compact accessible Did you mean note", () => {
    catalogInterpretation.current = {
      correctedQuery: "sertraline",
      corrections: [{ from: "sertaline", to: "sertraline" }],
      appliedExpansions: ["zoloft"],
    };

    renderWorkspace({ query: "sertaline" });

    const note = screen.getByRole("note", {
      name: "Did you mean sertraline? Related terms were also included: zoloft.",
    });
    expect(note).toHaveTextContent("Did you mean");
    expect(note).toHaveTextContent("sertraline");
  });

  it("shows applied expansions when the API did not correct the query", () => {
    catalogInterpretation.current = { appliedExpansions: ["olanzapine", "antipsychotic"] };

    renderWorkspace({ query: "zyprexa" });

    expect(
      screen.getByRole("note", {
        name: "Did you mean a related term? Search also included: olanzapine, antipsychotic.",
      }),
    ).toHaveTextContent("olanzapine, antipsychotic");
  });

  it("does not add interpretation chrome when the API returns none", () => {
    renderWorkspace();
    expect(screen.queryByTestId("medication-query-interpretation")).not.toBeInTheDocument();
  });
});

describe("MedicationPrescribingWorkspace — result filter strip", () => {
  it("labels each lens with the count of matching results", () => {
    renderWorkspace();
    // best = 3 (all), indication = 2 (exact-fit), safety = 2 (non-neutral), monitor = 1.
    expect(filterButton("Best").textContent).toContain("3");
    expect(filterButton("Indication").textContent).toContain("2");
    expect(filterButton("Safety").textContent).toContain("2");
    expect(filterButton("Monitor").textContent).toContain("1");
  });

  it("defaults to the Best lens with every result shown", () => {
    renderWorkspace();
    expect(filterButton("Best")).toHaveAttribute("aria-pressed", "true");
    expect(filterButton("Safety")).toHaveAttribute("aria-pressed", "false");
    expect(rowVisible("Clozapine")).toBe(true);
    expect(rowVisible("Lithium")).toBe(true);
    expect(rowVisible("Sertraline")).toBe(true);
  });

  it("narrows to indication-relevant results and drops related-only matches", () => {
    renderWorkspace();
    fireEvent.click(filterButton("Indication"));

    expect(filterButton("Indication")).toHaveAttribute("aria-pressed", "true");
    expect(filterButton("Best")).toHaveAttribute("aria-pressed", "false");
    expect(rowVisible("Clozapine")).toBe(true);
    expect(rowVisible("Lithium")).toBe(true);
    // Sertraline is a "Related match", so it leaves the Indication lens.
    expect(rowVisible("Sertraline")).toBe(false);
  });

  it("narrows the Monitor lens to results with monitoring signals only", () => {
    renderWorkspace();
    fireEvent.click(filterButton("Monitor"));

    expect(filterButton("Monitor")).toHaveAttribute("aria-pressed", "true");
    expect(rowVisible("Lithium")).toBe(true);
    expect(rowVisible("Clozapine")).toBe(false);
    expect(rowVisible("Sertraline")).toBe(false);
  });
});
