import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DsmCompareChrome } from "@/components/dsm/dsm-compare-chrome";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe("DsmCompareChrome", () => {
  it("shows compact slot rail and inline starters when fewer than two diagnoses are selected", () => {
    render(
      <DsmCompareChrome
        selectedIds={[null, null, null]}
        items={[]}
        starters={[
          {
            id: "mdd-gad",
            label: "MDD vs GAD",
            href: "/dsm/compare?ids=major-depressive-disorder,generalized-anxiety-disorder",
          },
        ]}
      />,
    );

    expect(screen.getAllByTestId("compare-slot-tile-compact")).toHaveLength(3);
    expect(screen.getByTestId("dsm-compare-starters")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MDD vs GAD" })).toBeInTheDocument();
    expect(screen.queryByTestId("dsm-compare-picker")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Choose at least two diagnoses/i })).not.toBeInTheDocument();
  });
});
