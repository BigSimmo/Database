import { render, screen, within } from "@testing-library/react";
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

const therapy = vi.hoisted(() => (slug: string, name: string) => ({
  slug,
  name,
  category: "Skills based",
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
}));

vi.mock("@/components/therapy-compass/data/use-therapy-data", () => ({
  useTherapyData: () => ({
    data: {
      therapies: [therapy("alpha", "Alpha therapy"), therapy("beta", "Beta therapy")],
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
