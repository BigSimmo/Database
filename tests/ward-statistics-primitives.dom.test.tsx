// tests/ward-statistics-primitives.dom.test.tsx
//
// `statistics-primitives.tsx` originally ported six components from the statistics prototype;
// five were removed 2026-09-05 because each duplicated a general-purpose primitive already
// shipping in `src/components/ward-management/` (see that file's own header comment for the full
// accounting — `StatPanel`/`WardPanel`, `KpiStrip`+`Kpi`/`WardFigureStrip`+`WardFigure`,
// `DistributionBar`/`WardBar`, `StatChip`/`WardChip`). This file now proves only what survived:
// `StatFootnote`, a headed, grouped list of invented figures that no existing primitive renders.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSays } from "./helpers/ward-caption";

import { StatFootnote } from "@/components/ward-management/statistics/statistics-primitives";

describe("StatFootnote", () => {
  it("renders every group's heading and every one of its items", () => {
    render(
      <StatFootnote
        groups={[
          { heading: "Invented figures", items: ["28 referrals is synthetic.", "19 acceptances is synthetic."] },
          { heading: "What this cannot yet show", items: ["Movements is not built."] },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Invented figures" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What this cannot yet show" })).toBeInTheDocument();
    expect(screen.getByText("28 referrals is synthetic.")).toBeInTheDocument();
    expect(screen.getByText("19 acceptances is synthetic.")).toBeInTheDocument();
    expect(screen.getByText("Movements is not built.")).toBeInTheDocument();
  });

  /**
   * ⚠️ THE PROPERTY IS "EACH GROUP KEEPS ITS OWN ITEMS", NOT "EVERY ITEM TEXT APPEARS SOMEWHERE
   * ON THE PAGE". A component that flattened every group into one shared list, or that dropped a
   * group's heading while still rendering its items under the previous one, would still pass an
   * assertion that merely checked each string was present. Reading each `<section>`'s own child
   * `<div>` list is what a cross-group mix-up cannot survive.
   */
  it("keeps each group's items under its own heading, not merged across groups", () => {
    render(
      <StatFootnote
        groups={[
          { heading: "Invented figures", items: ["28 referrals is synthetic."] },
          { heading: "What this cannot yet show", items: ["Movements is not built."] },
        ]}
      />,
    );
    const groupDivs = screen.getByRole("heading", { name: "Invented figures" }).closest("div");
    expectSays(groupDivs?.textContent, "the synthetic-figure caveat", ["28 referrals", "synthetic"]);
    expect(groupDivs?.textContent).not.toContain("Movements is not built.");
  });
});
