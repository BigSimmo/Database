import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TcProvider } from "@/components/therapy-compass/bindings";
import { BriefScreen } from "@/components/therapy-compass/screens/brief-screen";
import { CompareScreen } from "@/components/therapy-compass/screens/compare-screen";

const navigation = vi.hoisted(() => ({ pathname: "/therapy-compass/compare", search: "ids=alpha,beta" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const therapy = vi.hoisted(() => (slug: string, name: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  name,
  category: "Skills based",
  modality: "Individual",
  clinicalSummary: `${name} summary`,
  bestUsedFor: "Anxiety",
  indications: "Anxiety",
  contraindicationsOrCautions: "Review suitability before use.",
  deliverySteps: "1. Orient the patient\n2. Practise the skill",
  patientExplanation: "A practical therapy skill.",
  sourceNotes: null,
  targetSymptoms: "Anxiety",
  patientPopulation: "Adults",
  setting: "Outpatient",
  sessionLength: "50 minutes",
  timeRequired: "5 minutes",
  complexity: "Low",
  mechanism: "Skills practice",
  briefVersion: "Orient and practise.",
  fifteenMinuteVersion: "Orient, practise and review.",
  fullSessionVersion: null,
  homework: null,
  materials: null,
  commonPitfalls: null,
  alternatives: null,
  relatedTherapies: null,
  evidenceLevel: "Review source",
  evidenceNotes: null,
  limitations: null,
  references: null,
  reviewStatus: "reviewed",
  confidenceLevel: null,
  contentOrigin: null,
  patientSheetAvailable: true,
  briefInterventionAvailable: true,
  sourceCompleteness: null,
  indexCompleteness: null,
  reviewCompleteness: null,
  tags: ["Anxiety"],
  warnings: [],
  aliases: [],
  sources: [],
  patientSheetTemplates: [],
  clinicianScripts: [],
  reviewChecklist: null,
  ...overrides,
}));

const therapies = vi.hoisted(() => [therapy("alpha", "Alpha therapy"), therapy("beta", "Beta therapy")]);

vi.mock("@/components/therapy-compass/data/use-therapy-data", () => ({
  useTherapyData: () => ({
    data: {
      therapies,
      pathways: [],
      reference: { categories: [], tags: [], measures: [] },
    },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

function expectOwnedTabPanel(label: string) {
  const tablist = screen.getByRole("tablist", { name: label });
  const selectedTab = within(tablist).getByRole("tab", { selected: true });
  const panel = screen.getByRole("tabpanel");

  expect(selectedTab).toHaveAttribute("aria-controls", panel.id);
  expect(panel).toHaveAttribute("aria-labelledby", selectedTab.id);
}

afterEach(() => {
  navigation.pathname = "/therapy-compass/compare";
  navigation.search = "ids=alpha,beta";
  therapies.splice(0, therapies.length, therapy("alpha", "Alpha therapy"), therapy("beta", "Beta therapy"));
  vi.unstubAllGlobals();
});

describe("Therapy shared Tabs ownership", () => {
  it("owns the comparison table through an associated tabpanel", () => {
    render(
      <TcProvider>
        <CompareScreen />
      </TcProvider>,
    );

    expectOwnedTabPanel("Comparison fields");
    expect(screen.getByRole("table", { name: "Therapy comparison by clinical field" })).toBeInTheDocument();
  });

  it("treats shared missing values as equal in differences and clipboard text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    therapies.splice(
      0,
      therapies.length,
      therapy("alpha", "Alpha therapy", { bestUsedFor: null, targetSymptoms: null, timeRequired: "5 minutes" }),
      therapy("beta", "Beta therapy", { bestUsedFor: null, targetSymptoms: null, timeRequired: "10 minutes" }),
    );

    render(
      <TcProvider>
        <CompareScreen />
      </TcProvider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Differences" }));
    expect(screen.queryByRole("rowheader", { name: "Best fit" })).not.toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Time required" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy set" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain("Best fit: Not recorded  |  Not recorded");
  });

  it("owns the brief intervention content through an associated tabpanel", () => {
    navigation.pathname = "/therapy-compass/alpha/brief";
    navigation.search = "";

    render(
      <TcProvider>
        <BriefScreen />
      </TcProvider>,
    );

    expectOwnedTabPanel("Brief intervention duration");
    expect(screen.getByRole("heading", { name: "Alpha therapy" })).toBeInTheDocument();
  });
});
