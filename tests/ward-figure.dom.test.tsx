// tests/ward-figure.dom.test.tsx
import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";

describe("WardFigure", () => {
  it("renders the label, the value and the unit", () => {
    render(<WardFigure label="Going out, awaiting a bed" value="9" />);
    expect(screen.getByText("Going out, awaiting a bed")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  /**
   * ⚠️ THIS ASSERTION USED TO BE `toHaveClass(/figureValue/u)` AND IT COULD NOT FAIL FOR THE
   * REASON IT CLAIMED. This repo's vitest resolves CSS-module imports through a proxy that
   * fabricates a plausible scoped name for ANY property, so two mutations survived it: deleting
   * `.figureValue` from the stylesheet entirely, and renaming the component's reference to
   * `styles.figureValueTypo`. Both still produced a class name containing "figureValue".
   *
   * It proved the component referenced *a* class whose name contained a substring. Not that the
   * class existed, and not that it carried `font-variant-numeric: tabular-nums` — the property
   * the test is named after and the only thing that makes a column of digits line up.
   *
   * jsdom cannot resolve a CSS module, so the honest place to check this is the stylesheet.
   */
  it("sets tabular figures on the value, so a row of tiles lines up", () => {
    const css = readFileSync("src/components/ward-management/ward-figure.module.css", "utf8");
    // Comment-stripped -- see tests/ward-guard-comment-blindness.test.ts. Both checks below are
    // presence checks, proved by mutation: renaming the real `.figureValue` rule away and leaving a
    // decoy comment quoting its original selector and `font-variant-numeric` declaration left this
    // whole test green against the unstripped CSS.
    const valueRule = /\.figureValue\s*\{([^}]*)\}/u.exec(blankCssComments(css))?.[1];
    expect(valueRule, ".figureValue is not declared in ward-figure.module.css").toBeTruthy();
    expect(valueRule).toMatch(/font-variant-numeric:\s*tabular-nums/u);
  });

  it("renders the value as text, whatever class it carries", () => {
    render(<WardFigure label="Free beds" value="12" />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  /**
   * The amber flag means "look here". Three amber tiles mean nothing, and the failure is
   * invisible — the screen simply stops directing the eye, which is the whole job of the strip.
   */
  it("refuses a strip where more than two tiles are flagged", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" flagged />
          <WardFigure label="b" value="2" flagged />
          <WardFigure label="c" value="3" flagged />
        </WardFigureStrip>,
      ),
    ).toThrow(/at most two/u);
  });

  it("allows exactly two", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" flagged />
          <WardFigure label="b" value="2" flagged />
          <WardFigure label="c" value="3" />
        </WardFigureStrip>,
      ),
    ).not.toThrow();
  });

  /**
   * ⚠️ ADDED BEYOND THE PLAN. A counter that is silently broken — say it never matches the
   * `flagged` prop at all — would report zero flagged tiles no matter what it is given, and a
   * suite that only exercised "no tiles" and "two tiles flagged" as its two states could not
   * tell that apart from a working counter, because both would simply "not throw". The test
   * above ("allows exactly two") already forces the counter to find exactly two out of three
   * real children rather than reading array length, but this test makes the zero-flagged case
   * explicit and distinct from an empty render: three real tiles, all unflagged, must also not
   * throw, so the suite now exercises three genuinely different counts (0, 2, 3 flagged out of
   * three real tiles) rather than only the pass/fail boundary.
   */
  it("does not throw when a strip of real tiles carries no flagged ones, distinct from an empty render", () => {
    expect(() =>
      render(
        <WardFigureStrip>
          <WardFigure label="a" value="1" />
          <WardFigure label="b" value="2" />
          <WardFigure label="c" value="3" />
        </WardFigureStrip>,
      ),
    ).not.toThrow();
  });
});
