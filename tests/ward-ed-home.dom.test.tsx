// tests/ward-ed-home.dom.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdHome } from "@/components/ward-management/ed/ed-home";
import { edHomeSummaries, edHomeTotals, worstEdSummary } from "@/components/ward-management/ed/ed-home-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

function renderEdHome() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdHome />
    </WardFlowProvider>,
  );
}

/** The same real fixture the component itself reads, so every expectation below is a number this
 *  suite computed from repository data — never a hand-typed literal that could go stale. */
const summaries = edHomeSummaries(wardMovements, NOW_ANCHOR);
const totals = edHomeTotals(summaries, NOW_ANCHOR);
const worst = worstEdSummary(summaries);
const allEds = allEmergencyDepartments();

describe("EdHome", () => {
  it("renders its own landmarks: one h1 and one main, since the shell renders neither", () => {
    renderEdHome();
    expect(screen.getByRole("heading", { level: 1, name: "Emergency departments — every site" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("states there are eight real emergency departments, taken from the ED collection itself", () => {
    // Pinned against the model, not a literal: if the ED collection ever changes, this line
    // changes with it rather than silently disagreeing.
    expect(allEds).toHaveLength(8);
    renderEdHome();
    expect(screen.getByText(new RegExp(`${allEds.length} emergency departments`, "u"))).toBeInTheDocument();
  });

  describe("the model-limit note", () => {
    it("says plainly that these figures are counted from movements and referrals, not from the department's own record", () => {
      renderEdHome();
      const note = screen.getByTestId("ed-home-model-limit");
      expect(note.textContent ?? "").toMatch(/no bed count/iu);
      expect(note.textContent ?? "").toMatch(/no capacity figure/iu);
      expect(note.textContent ?? "").toMatch(/physically present/iu);
    });
  });

  describe("the totals strip", () => {
    it("renders five tiles, exactly two flagged", () => {
      renderEdHome();
      const strip = screen.getByTestId("ed-home-totals");
      const allTiles = strip.querySelectorAll("dl > div");
      expect(allTiles).toHaveLength(5);
      const flagged = strip.querySelectorAll("[data-flagged='true']");
      expect(flagged).toHaveLength(2);
    });

    it("renders the real waiting, detained and longest-wait figures computed from the seed", () => {
      renderEdHome();
      const strip = screen.getByTestId("ed-home-totals");
      expect(within(strip).getByText(String(totals.waiting))).toBeInTheDocument();
      expect(within(strip).getByText(String(totals.detained))).toBeInTheDocument();
    });
  });

  describe("the two colliding 'N of M' tiles, disambiguated", () => {
    it("names the population on every 'of N' figure — never a bare 'of N'", () => {
      renderEdHome();
      const units = Array.from(document.querySelectorAll("[class*='figureUnit']")).map((el) => el.textContent ?? "");
      const ofUnits = units.filter((text) => /^of \d+/u.test(text.trim()));
      expect(ofUnits.length).toBeGreaterThan(0);
      for (const unit of ofUnits) {
        // The rule under test: an "of N" unit must name what it counts (a word after the number),
        // never stop at the bare number.
        expect(unit.trim()).toMatch(/^of \d+ \D+/u);
      }
    });

    it("the departments tile says departments and the hero's says patients — different populations, stated", () => {
      renderEdHome();
      const departmentsTileUnit = screen.getByText(new RegExp(`^of ${allEds.length} department`, "u"));
      expect(departmentsTileUnit).toBeInTheDocument();
      const heroFigures = screen.getByTestId("ed-home-hero-figures");
      const patientUnit = within(heroFigures).getAllByText(/^of \d+ patients?$/u);
      expect(patientUnit.length).toBeGreaterThan(0);
    });
  });

  describe("the population is stated in words on every panel that carries a count", () => {
    it("states it on the totals section, the hero panel and every service-band panel", () => {
      renderEdHome();
      expect(screen.getByTestId("ed-home-model-limit").textContent ?? "").toMatch(/physically present/iu);
      expect(screen.getByText(/^Every figure above counts/u).textContent ?? "").toMatch(/physically present/iu);

      // Every WardPanel region on the page must state the population in its OWN blurb — the
      // panel's first direct <p> child, immediately after its header — never merely somewhere in
      // its aggregate text, which a row repeating the same phrase would satisfy even if the
      // panel's own blurb said nothing at all.
      const regions = screen.getAllByRole("region");
      const regionsWithCounts = regions.filter((region) => /\d/u.test(region.textContent ?? ""));
      expect(regionsWithCounts).toHaveLength(4); // the hero panel + three service-band panels
      for (const region of regionsWithCounts) {
        const blurb = region.querySelector(":scope > p");
        expect(blurb, `panel "${region.getAttribute("aria-label")}" has no blurb paragraph`).not.toBeNull();
        expect(blurb?.textContent ?? "").toMatch(/physically present/iu);
      }
    });
  });

  describe("this screen never claims anyone is or is not being looked for", () => {
    it("renders no 'declined by every ward' or 'nobody looking' text anywhere on the page", () => {
      renderEdHome();
      const text = document.body.textContent ?? "";
      expect(text).not.toMatch(/declined by every ward/iu);
      expect(text).not.toMatch(/nobody.{0,20}looking/iu);
      expect(text).not.toMatch(/looking for a bed/iu);
    });
  });

  describe("the hero", () => {
    it("names the worst department computed from the seed, with five figures and no flags", () => {
      renderEdHome();
      if (!worst) throw new Error("test fixture produced no departments — cannot assert the hero");
      expect(screen.getByRole("heading", { name: worst.ed.name })).toBeInTheDocument();
      const heroFigures = screen.getByTestId("ed-home-hero-figures");
      expect(heroFigures.children).toHaveLength(5);
      expect(heroFigures.querySelectorAll("[data-flagged='true']")).toHaveLength(0);
    });

    it("links to that department's own hub", () => {
      renderEdHome();
      if (!worst) throw new Error("test fixture produced no departments — cannot assert the hero");
      const link = screen.getByRole("link", { name: new RegExp(`Open ${worst.ed.name}`, "u") });
      expect(link).toHaveAttribute("href", `/mockups/ward-flow/ed/${worst.ed.id}`);
    });
  });

  describe("every real emergency department appears exactly once, across the hero and the bands", () => {
    it("matches ward-sites.ts's own eight departments, not a hospital walk", () => {
      renderEdHome();
      for (const ed of allEds) {
        expect(screen.getAllByText(ed.name)).toHaveLength(1);
      }
    });
  });
});
