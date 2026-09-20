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

/**
 * #EKB6XR, second finding — a backdrop click must not discard entered answers.
 *
 * The duplicate-close defect above is fixed, but measuring it in a real browser
 * turned up a worse one in the same modal. In the centred-dialog layout the
 * scroll body's bottom clip boundary IS the panel's bottom edge, with backdrop
 * immediately beyond it — 36px of it at 1440x900, 32px at 1024x800. A 48px
 * option chip left half-clipped at that edge therefore has its centre BELOW the
 * boundary. Measured at 1440x900: a chip showing 22 of its 48 pixels — plainly
 * visible, plainly a button — answered a click at its own centre by closing the
 * dialog. Reopening showed none of the three entered answers. Eight chips on
 * desktop and nine on tablet hit this across the scroll range, so it is not one
 * unlucky row. Phones are immune: the sheet is `items-end` and full-bleed, so
 * there is no backdrop below the panel to miss onto.
 *
 * The chips are already at the repo's 48px tap-target floor and must stay there
 * (AGENTS.md — shrinking to `min-h-11` reintroduces a known ui-smoke flake), and
 * free scrolling means any row can be left half-clipped, so the geometry cannot
 * be padded away. Guarding the consequence is what these cases pin.
 */
describe("CalculatorSheet does not discard entered answers", () => {
  // `started` is `invalid || calc.items.some(isAnswered)`, so one valid answer
  // is enough. Option index 0 is a real selection, not an absent one.
  const startedAnswers = { [calc.items[0].id]: 0 };

  function renderStartedSheet(onClose = vi.fn()) {
    render(<CalculatorSheet calc={calc} answers={startedAnswers} onAnswersChange={() => {}} onClose={onClose} />);
    return onClose;
  }

  it("ignores a backdrop click once an answer has been entered", async () => {
    const user = userEvent.setup();
    const onClose = renderStartedSheet();
    await user.click(screen.getByTestId("calculator-sheet-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves focus to the named close rather than leaving the click inert", async () => {
    const user = userEvent.setup();
    renderStartedSheet();
    await user.click(screen.getByTestId("calculator-sheet-backdrop"));
    // A click that does nothing at all reads as a broken control. Point the
    // clinician at the deliberate exit instead.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /close/i }));
  });

  it("still closes a started sheet from the header button", async () => {
    const user = userEvent.setup();
    const onClose = renderStartedSheet();
    await user.click(screen.getByRole("button", { name: /close/i }));
    // The guard covers the backdrop only — the two deliberate exits are unchanged,
    // otherwise a part-finished assessment could not be abandoned at all.
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
