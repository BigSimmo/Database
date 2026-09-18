/**
 * #EKB6XR — the calculator modal's close path was intercepted.
 *
 * The sheet has three ways out (header button, backdrop click, Escape), and two
 * of its elements answered to the accessible name "Close": the header button,
 * and a full-viewport `<button aria-label="Close calculator" tabIndex={-1}>`
 * backdrop. That backdrop is `absolute inset-0`, so it also spans BEHIND the
 * panel — which of the two a "Close" lookup or a stray click reached was decided
 * by DOM order, with neither layer carrying a z-index.
 *
 * No test exercised the close path at all before this file.
 *
 * Out of scope and deliberately not done here: migrating the sheet to
 * `OverlayPortal`. It is not portalled, so it still inherits any transformed or
 * clipping ancestor the search page grows. That is the larger correct fix.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalculatorSheet } from "@/components/calculators/calculator-sheet";
import { calculators } from "@/components/calculators/calculator-fixtures";

const calc = calculators[0];

beforeEach(() => {
  // jsdom has no Element.scrollTo; the sheet resets its scroll on calc change.
  Element.prototype.scrollTo = vi.fn();
});

function renderSheet(onClose = vi.fn()) {
  render(<CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={onClose} />);
  return onClose;
}

describe("CalculatorSheet close paths", () => {
  it("exposes exactly one control named Close", () => {
    renderSheet();
    expect(screen.getAllByRole("button", { name: /close/i })).toHaveLength(1);
  });

  it("keeps the backdrop out of the accessibility tree entirely", () => {
    renderSheet();
    const backdrop = screen.getByTestId("calculator-sheet-backdrop");
    expect(backdrop.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop.tagName).toBe("DIV");
  });

  it("closes from the header button", async () => {
    const user = userEvent.setup();
    const onClose = renderSheet();
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes from a backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = renderSheet();
    await user.click(screen.getByTestId("calculator-sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stacks the panel above the backdrop on named ladder rungs", () => {
    // Paint order was the only thing holding these apart. `--z-overlay` is 80
    // and `--z-modal` is 100; `eslint-rules/require-z-index-ladder.mjs` admits
    // no rung between them that either layer could drift onto.
    renderSheet();
    const backdrop = screen.getByTestId("calculator-sheet-backdrop");
    const panel = screen.getByRole("dialog").querySelector("div.relative");
    expect(backdrop.className).toContain("z-[80]");
    expect(panel?.className).toContain("z-[100]");
  });

  it("does not offer the backdrop to the dialog's tab trap", async () => {
    const user = userEvent.setup();
    renderSheet();
    // The trap cycles the panel's own focusables; a focusable backdrop inside
    // the loop is how a "close" landed on the wrong element.
    await user.tab();
    expect(document.activeElement).not.toBe(screen.getByTestId("calculator-sheet-backdrop"));
  });
});
