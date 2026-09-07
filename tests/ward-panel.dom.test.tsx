// tests/ward-panel.dom.test.tsx
import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardPanel } from "@/components/ward-management/ward-panel";

describe("WardPanel", () => {
  it("renders its title as a heading and its count beside it", () => {
    render(
      <WardPanel title="Coming in" count="6 waiting">
        <p>rows</p>
      </WardPanel>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Coming in" })).toBeInTheDocument();
    expect(screen.getByText("6 waiting")).toBeInTheDocument();
  });

  it("labels the section by its own heading, so a screen reader can list the panels", () => {
    render(<WardPanel title="Needs a decision">x</WardPanel>);
    expect(screen.getByRole("region", { name: "Needs a decision" })).toBeInTheDocument();
  });

  it("takes a heading level, because a panel nested in a section must not skip a level", () => {
    render(
      <WardPanel title="In hospital now" headingLevel={3}>
        x
      </WardPanel>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "In hospital now" })).toBeInTheDocument();
  });

  it("omits the count element entirely when there is no count, rather than rendering an empty span", () => {
    const { container } = render(<WardPanel title="Go to">x</WardPanel>);
    expect(container.querySelector("[data-ward-panel-count]")).toBeNull();
  });
  /**
   * 🔴 **THE COUNT SLOT MOSTLY HOLDS SENTENCES, SO IT MUST NOT WEAR A CODE FACE.** Of the 32
   * `<WardPanel>` call sites in `ward-management/` that pass a `count`, **21 render English prose** —
   * "43 people", "23 wards", "8 of 43 shown", "not tracked here", "1 leg", "Not eligible". Only 10
   * are unconditionally a bare figure. `font-family: var(--font-mono)` was set on every one of them,
   * on every panel of every ward screen, which is what made the product read as inconsistent rather
   * than one page reading badly. Removed 2026-09-06 with Ward Lead's approval.
   *
   * ⚠️ **THE SECOND HALF OF THIS TEST IS THE MORE IMPORTANT HALF.**
   * `font-variant-numeric: tabular-nums` sat in the same rule and is NOT part of "the mono thing":
   * it makes digits equal-width so figures align down a column of stacked panels, and it does that
   * in the body face perfectly well. **Someone removing "the monospace" without seeing that takes the
   * alignment with it** — a regression wearing the same commit message as the fix. So this asserts
   * both directions: the code face must not come back, and the alignment must not leave with it.
   *
   * ⚠️ **THIS READS THE STYLESHEET, WHICH IS A REAL WEAKNESS, NAMED RATHER THAN HIDDEN.** jsdom does
   * not apply CSS-module styles, so `getComputedStyle` on a rendered panel reports nothing about
   * either declaration — there is no way to assert this from the DOM. Reading the file is the
   * honest available check. It cannot see a `font-family` re-imposed from somewhere else, so it is a
   * guard against the declaration returning to this slot, which is the realistic regression, and not
   * a guarantee about the rendered face.
   */
  it("never wears a code face on a slot that mostly holds sentences, and keeps the digit alignment that does belong there", () => {
    const css = readFileSync("src/components/ward-management/ward-panel.module.css", "utf8");
    const rule = /^\.panelCount\s*\{([^}]*)\}/mu.exec(css);
    expect(rule, "no .panelCount rule found — the assertions below would be vacuous").not.toBeNull();
    const body = (rule as RegExpExecArray)[1];

    expect(
      body,
      "a monospace face is back on the panel count. That slot renders English on 21 of the 32 " +
        "WardPanel call sites that pass one, so a code face there is prose in a code face on every " +
        "panel of every ward screen at once.",
    ).not.toMatch(/font-family/u);

    expect(
      body,
      "tabular-nums has gone from the panel count. It is not part of the monospace face and was not " +
        "what was wrong: it makes digits equal-width so figures line up down a column of stacked " +
        "panels, and it does that in the body face. Removing it turns the fix into a regression.",
    ).toMatch(/font-variant-numeric:\s*tabular-nums/u);
  });
});
