import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Therapy } from "@/components/therapy-compass/data/types";

const bindings = vi.hoisted(() => ({
  recQuery: "What therapy for anxiety in outpatient care?",
  setRecQuery: vi.fn(),
  recConstraints: ["outpatient"],
  inferredConstraintKeys: ["outpatient"],
  isConstraintActive: (key: string) => key === "outpatient",
  isConstraintInferred: (key: string) => key === "outpatient",
  toggleConstraint: vi.fn(),
  loading: false,
  goSearch: vi.fn(),
  open: vi.fn(),
  openSheet: vi.fn(),
  isInCompare: () => false,
  compareSlugs: [],
  addCompare: vi.fn(),
  removeCompare: vi.fn(),
  search: { query: "", tags: [] as string[] },
  recommendations: [] as Array<{ therapy: Therapy; score: number; reasons: string[] }>,
}));

vi.mock("@/components/therapy-compass/bindings", () => ({
  useTcBindings: () => bindings,
}));

vi.mock("@/components/account-data-provider", () => ({
  useAccountData: () => ({
    isAuthenticated: false,
    isSaved: () => false,
    setFavourite: vi.fn(),
  }),
}));

import { RecommendScreen } from "@/components/therapy-compass/screens/recommend-screen";

const therapy = {
  slug: "cognitive-behavioural-therapy",
  name: "Cognitive Behavioural Therapy (CBT)",
  aliases: ["CBT"],
  tags: ["Anxiety", "CBT"],
  category: "Behavioural",
  reviewStatus: "needs_review",
  briefInterventionAvailable: true,
  patientSheetAvailable: true,
  bestUsedFor: "Depression and anxiety disorders.",
  clinicalSummary: "A structured skills-based treatment for anxiety.",
  indications: "Anxiety disorders",
  contraindicationsOrCautions: "Adapt for trauma and mania risk.",
  targetSymptoms: "Avoidance, worry, panic.",
  setting: "Outpatient/community",
} as Therapy;

describe("Recommend screen", () => {
  it("uses a minimal header and mobile scenario trigger with sheet editor", () => {
    bindings.recommendations = [{ therapy, score: 40, reasons: ["Matches the described presentation"] }];
    render(<RecommendScreen />);

    expect(screen.getByRole("heading", { name: "Recommend" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommend a therapy" })).not.toBeInTheDocument();

    const trigger = screen.getByTestId("therapy-recommend-scenario-trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const panel = screen.getByTestId("therapy-recommend-scenario-panel");
    expect(within(panel).getByLabelText("Clinical situation")).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Setting" })).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Time" })).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Support" })).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Cautions" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Outpatient" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByText(/From the situation/)).toBeInTheDocument();
    expect(within(panel).getByTestId("therapy-recommend-scenario-done")).toBeInTheDocument();
  });

  it("keeps desktop inline fieldsets and moves actions to the results toolbar", () => {
    bindings.recommendations = [{ therapy, score: 40, reasons: ["Matches the described presentation"] }];
    render(<RecommendScreen />);

    expect(document.querySelector("[data-therapy-recommend-composer]")).not.toBeNull();

    expect(screen.getAllByRole("group", { name: "Setting" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("group", { name: "Time" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("group", { name: "Support" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("group", { name: "Cautions" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Copy shortlist" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refine in catalogue" })).toBeInTheDocument();
    expect(screen.getByText("1 ranked match")).toBeInTheDocument();
  });

  it("renders ranked matches with ResultCard evidence cells and a single featured primary", () => {
    const second = { ...therapy, slug: "act", name: "Acceptance and commitment therapy" } as Therapy;
    bindings.recommendations = [
      { therapy, score: 40, reasons: ["Matches the described presentation", "Fits outpatient"] },
      { therapy: second, score: 28, reasons: ["Matches the described presentation"] },
    ];
    render(<RecommendScreen />);

    const cards = document.querySelectorAll("[data-therapy-result-card]");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("data-therapy-result-featured");
    expect(within(cards[0] as HTMLElement).getByText("Best match")).toBeInTheDocument();
    const featuredOpen = cards[0]?.querySelector('[aria-label="Open record"]');
    expect(featuredOpen).toHaveClass("bg-[color:var(--command)]");
    expect(screen.getAllByText("WHY MATCHED").length).toBeGreaterThan(0);
    expect(screen.queryByText("Strong match")).not.toBeInTheDocument();
    expect(screen.queryByText("QUICK CONSTRAINTS")).not.toBeInTheDocument();
  });
});
