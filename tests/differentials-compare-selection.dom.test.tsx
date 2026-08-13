import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDifferentialRecord, getPresentationWorkflow } from "@/lib/differentials";

const catalogState = vi.hoisted(() => ({
  status: "loading" as "loading" | "ready" | "error" | "unauthorized" | "refetching",
  matches: {
    diagnoses: [] as Array<{
      record: NonNullable<ReturnType<typeof getDifferentialRecord>>;
      score: number;
      reasons: string[];
    }>,
    presentations: [] as Array<{
      workflow: NonNullable<ReturnType<typeof getPresentationWorkflow>>;
      score: number;
      reasons: string[];
    }>,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/clinical-dashboard/use-differential-catalog", () => ({
  useDifferentialSearch: () => ({
    status: catalogState.status,
    matches: catalogState.matches,
    demoMode: true,
    error: null,
  }),
}));

vi.mock("@/components/use-result-sort", () => ({
  useResultSort: () => ["relevance", vi.fn()] as const,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

import { DifferentialsHome } from "@/components/clinical-dashboard/differentials-home";

describe("DifferentialsHome compare selection URL handoff", () => {
  beforeEach(() => {
    catalogState.status = "loading";
    catalogState.matches = { diagnoses: [], presentations: [] };
    window.history.replaceState(
      null,
      "",
      "/differentials?q=Pain&run=1&ids=medical-gi-endocrine-painful-organic-cause,bpsd-as-unmet-need-delirium-pain-mimic",
    );
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("keeps bookmarked ids while the catalogue is loading, then hydrates them", async () => {
    const topNoise = getDifferentialRecord("anorexia-nervosa");
    const keptA = getDifferentialRecord("medical-gi-endocrine-painful-organic-cause");
    const keptB = getDifferentialRecord("bpsd-as-unmet-need-delirium-pain-mimic");
    expect(topNoise && keptA && keptB).toBeTruthy();

    const { rerender } = render(
      <DifferentialsHome query="Pain" loading={false} searchSubmitted onRunSearch={vi.fn()} />,
    );

    expect(screen.getByTestId("differentials-results-loading")).toBeVisible();
    expect(window.location.search).toContain("ids=medical-gi-endocrine-painful-organic-cause");
    expect(window.location.search).toContain("bpsd-as-unmet-need-delirium-pain-mimic");

    catalogState.status = "ready";
    catalogState.matches = {
      diagnoses: [
        { record: topNoise!, score: 20, reasons: ["title"] },
        { record: keptA!, score: 12, reasons: ["title"] },
        { record: keptB!, score: 11, reasons: ["title"] },
      ],
      presentations: [],
    };

    await act(async () => {
      rerender(<DifferentialsHome query="Pain" loading={false} searchSubmitted onRunSearch={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("differentials-search-results")).toBeVisible();
    });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("ids")?.split(",").sort()).toEqual(
        ["bpsd-as-unmet-need-delirium-pain-mimic", "medical-gi-endocrine-painful-organic-cause"].sort(),
      );
    });

    const selectedControls = screen.getAllByRole("checkbox", { name: /^Remove .+ from comparison$/ });
    expect(selectedControls.length).toBeGreaterThanOrEqual(2);
    for (const control of selectedControls) expect(control).toBeChecked();
  });

  it("shows a filter-specific empty state and restores all results", async () => {
    const diagnosis = getDifferentialRecord("anorexia-nervosa");
    expect(diagnosis).toBeTruthy();
    catalogState.status = "ready";
    catalogState.matches = {
      diagnoses: [{ record: diagnosis!, score: 20, reasons: ["title"] }],
      presentations: [],
    };

    render(<DifferentialsHome query="Anorexia" loading={false} searchSubmitted onRunSearch={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Anorexia nervosa").length).toBeGreaterThan(0);
    });

    await act(async () => {
      screen.getByRole("radio", { name: "Presentations (0)" }).click();
    });

    expect(screen.getByTestId("differentials-filter-empty-results")).toBeVisible();
    expect(screen.getByRole("heading", { name: "No presentations in this result set" })).toBeVisible();
    expect(screen.queryByText(/No catalogue matches/)).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "Show all results" }).click();
    });

    expect(screen.queryByTestId("differentials-filter-empty-results")).not.toBeInTheDocument();
    expect(screen.getAllByText("Anorexia nervosa").length).toBeGreaterThan(0);
  });

  it("keeps the submitted query when opening a presentation comparison", async () => {
    const presentation = getPresentationWorkflow("acute-confusion-encephalopathy");
    expect(presentation).toBeTruthy();
    catalogState.status = "ready";
    catalogState.matches = {
      diagnoses: [],
      presentations: [{ workflow: presentation!, score: 20, reasons: ["title"] }],
    };

    render(<DifferentialsHome query="acute confusion" loading={false} searchSubmitted onRunSearch={vi.fn()} />);

    await waitFor(() => {
      const presentationLinks = screen.getAllByRole("link", { name: /Acute confusion/i });
      expect(presentationLinks.length).toBeGreaterThan(0);
      for (const link of presentationLinks) {
        expect(link).toHaveAttribute(
          "href",
          "/differentials/presentations/acute-confusion-encephalopathy?q=acute+confusion",
        );
      }
    });
  });
});
