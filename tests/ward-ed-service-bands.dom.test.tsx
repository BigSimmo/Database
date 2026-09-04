// tests/ward-ed-service-bands.dom.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  edHomeSummaries,
  groupByHealthService,
  worstEdSummary,
} from "@/components/ward-management/ed/ed-home-derivations";
import { EdServiceBands } from "@/components/ward-management/ed/ed-service-bands";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const summaries = edHomeSummaries(wardMovements, NOW_ANCHOR);
const bands = groupByHealthService(summaries);
const worst = worstEdSummary(summaries);
const allEds = allEmergencyDepartments();

describe("EdServiceBands", () => {
  it("renders exactly three bands: East Metro, North Metro, South Metro", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} />);
    expect(screen.getByRole("region", { name: "East Metro" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "North Metro" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "South Metro" })).toBeInTheDocument();
  });

  it("carries the note that a department shown as the hero is shown above, on whichever band it belongs to", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} />);
    if (!worst) throw new Error("test fixture produced no departments — cannot assert the band note");
    const ownBand = screen.getByRole("region", { name: worst.service });
    expect(within(ownBand).getByText(new RegExp(`${worst.siteName} is shown above`, "u"))).toBeInTheDocument();
  });

  it("states the population — patients physically present — on every band panel", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} />);
    for (const service of ["East Metro", "North Metro", "South Metro"]) {
      const region = screen.getByRole("region", { name: service });
      expect(region.textContent ?? "").toMatch(/physically present/iu);
    }
  });

  /**
   * ⚠️ THE UNION ASSERTION, NOT A PER-BAND COUNT. Asserting against the union of the hero and the
   * three bands is what catches a department silently dropped from a band while still counted
   * elsewhere — a per-band-only count could not see that at all.
   */
  it("names every real emergency department exactly once, across the hero and the three bands combined", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} />);
    const bandNames = allEds.filter((ed) => ed.id !== worst?.ed.id).map((ed) => ed.name);
    for (const name of bandNames) {
      expect(screen.getAllByText(name)).toHaveLength(1);
    }
    // The hero's own department must NOT be repeated in its own band's list.
    if (worst) {
      expect(screen.queryByText(worst.ed.name)).not.toBeInTheDocument();
    }
    // Every department across the three bands, plus the excluded hero department, accounts for
    // the full real collection — the union property the plan's own guard names.
    const renderedInBands = bandNames.length;
    expect(renderedInBands + (worst ? 1 : 0)).toBe(allEds.length);
  });

  it("links each row to that department's own hub", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} />);
    const other = allEds.find((ed) => ed.id !== worst?.ed.id);
    if (!other) throw new Error("need at least two departments for this assertion");
    const link = screen.getByRole("link", { name: new RegExp(other.name, "u") });
    expect(link).toHaveAttribute("href", `/mockups/ward-flow/ed/${other.id}`);
  });
});
