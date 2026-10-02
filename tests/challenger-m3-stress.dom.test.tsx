/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CalculatorSheet } from "@/components/calculators/calculator-sheet";
import { calculators } from "@/components/calculators/calculator-fixtures";
import { hasOpenSheet, isTopmostSheet, popSheet, pushSheet, SHEET_INERT_MARKER } from "@/components/ui/sheet-focus";

const calc = calculators[0];

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
    document.documentElement.style.overflowY = "";
  }
});

afterEach(() => {
  cleanup();
  // Clear any dangling sheets
  while (hasOpenSheet()) {
    popSheet("calculator-sheet");
    popSheet("stacked-sheet");
    popSheet("topmost-sheet");
    popSheet("bottom-sheet");
  }
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
    document.documentElement.style.overflowY = "";
  }
});

describe("Empirical Challenger M3 Stress Harness", () => {
  describe("1. Escape keydown across started and unstarted states", () => {
    it("dismisses an UNSTARTED calculator on Escape", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={onClose} />);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("dismisses a STARTED calculator on Escape", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const startedAnswers = { [calc.items[0].id]: 1 };
      render(<CalculatorSheet calc={calc} answers={startedAnswers} onAnswersChange={() => {}} onClose={onClose} />);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("dismisses on Escape even when focus is on a child input/button inside the sheet", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={onClose} />);

      const closeButton = screen.getByRole("button", { name: /close/i });
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);

      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Stacked modal precedence and Escape handling", () => {
    it("suppresses Escape on CalculatorSheet when another sheet is stacked above it", async () => {
      const user = userEvent.setup();
      const onCloseCalc = vi.fn();
      render(<CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={onCloseCalc} />);

      const secondSheetRoot = document.createElement("div");
      document.body.append(secondSheetRoot);
      pushSheet("topmost-sheet", secondSheetRoot);

      expect(isTopmostSheet("topmost-sheet")).toBe(true);

      await user.keyboard("{Escape}");
      expect(onCloseCalc).not.toHaveBeenCalled();

      popSheet("topmost-sheet");
      secondSheetRoot.remove();

      // Now calculator sheet is topmost again
      await user.keyboard("{Escape}");
      expect(onCloseCalc).toHaveBeenCalledTimes(1);
    });

    it("handles 3-tier stacking correctly (Bottom -> CalculatorSheet -> Topmost)", async () => {
      const user = userEvent.setup();
      const bottomRoot = document.createElement("div");
      document.body.append(bottomRoot);
      pushSheet("bottom-sheet", bottomRoot);

      const onCloseCalc = vi.fn();
      render(
        <CalculatorSheet
          sheetId="calc-sheet-id"
          calc={calc}
          answers={{}}
          onAnswersChange={() => {}}
          onClose={onCloseCalc}
        />,
      );

      const topRoot = document.createElement("div");
      document.body.append(topRoot);
      pushSheet("topmost-sheet", topRoot);

      expect(isTopmostSheet("topmost-sheet")).toBe(true);
      expect(isTopmostSheet("calc-sheet-id")).toBe(false);
      expect(isTopmostSheet("bottom-sheet")).toBe(false);

      // Escape should not close calculator
      await user.keyboard("{Escape}");
      expect(onCloseCalc).not.toHaveBeenCalled();

      // Pop top sheet
      popSheet("topmost-sheet");
      topRoot.remove();

      expect(isTopmostSheet("calc-sheet-id")).toBe(true);
      expect(isTopmostSheet("bottom-sheet")).toBe(false);

      // Escape should now close calculator
      await user.keyboard("{Escape}");
      expect(onCloseCalc).toHaveBeenCalledTimes(1);

      popSheet("bottom-sheet");
      bottomRoot.remove();
    });
  });

  describe("3. Body scroll locking & inert background element synchronization", () => {
    it("manages body and root overflow locking through stacked push and pop operations", () => {
      const background = document.createElement("div");
      const bgButton = document.createElement("button");
      background.append(bgButton);
      document.body.append(background);

      expect(document.body.style.overflow).toBe("");
      expect(document.documentElement.style.overflowY).toBe("");
      expect(background).not.toHaveAttribute("inert");

      // Mount CalculatorSheet
      const { unmount } = render(
        <CalculatorSheet sheetId="calc-sheet" calc={calc} answers={{}} onAnswersChange={() => {}} onClose={() => {}} />,
      );

      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.overflowY).toBe("hidden");
      expect(background).toHaveAttribute("inert");
      expect(background).toHaveAttribute(SHEET_INERT_MARKER, "true");

      // Push second sheet
      const secondRoot = document.createElement("div");
      document.body.append(secondRoot);
      pushSheet("second-sheet", secondRoot);

      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.overflowY).toBe("hidden");

      // Pop second sheet
      popSheet("second-sheet");
      secondRoot.remove();

      // Scroll lock should still be active because CalculatorSheet is still mounted
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.overflowY).toBe("hidden");
      expect(background).toHaveAttribute("inert");

      // Unmount CalculatorSheet
      unmount();

      // Now scroll lock and inert markers must be completely cleared
      expect(document.body.style.overflow).toBe("");
      expect(document.documentElement.style.overflowY).toBe("");
      expect(background).not.toHaveAttribute("inert");
      expect(background).not.toHaveAttribute(SHEET_INERT_MARKER);

      background.remove();
    });
  });

  describe("4. Opener focus restoration and precedence guards", () => {
    it("restores focus to opener when CalculatorSheet unmounts cleanly", () => {
      const opener = document.createElement("button");
      opener.textContent = "Open Calc";
      document.body.append(opener);
      opener.focus();
      expect(document.activeElement).toBe(opener);

      const { unmount } = render(
        <CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={() => {}} />,
      );

      // On mount, focus moves inside dialog to close button
      const closeBtn = screen.getByRole("button", { name: /close/i });
      expect(document.activeElement).toBe(closeBtn);

      // Unmount
      unmount();

      // Focus should be restored to opener
      expect(document.activeElement).toBe(opener);
      opener.remove();
    });

    it("does NOT steal focus if another sheet takes precedence while closing", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();

      const { unmount } = render(
        <CalculatorSheet sheetId="calc-sheet" calc={calc} answers={{}} onAnswersChange={() => {}} onClose={() => {}} />,
      );

      // Higher-priority overlay opens
      const overlayRoot = document.createElement("div");
      const overlayInput = document.createElement("input");
      overlayRoot.append(overlayInput);
      document.body.append(overlayRoot);
      pushSheet("high-priority-overlay", overlayRoot);
      overlayInput.focus();
      expect(document.activeElement).toBe(overlayInput);

      // Now CalculatorSheet unmounts in background
      unmount();

      // Opener is NOT inside topmost overlay, so canRestoreFocusTo(opener) should be false!
      // Focus MUST remain on overlayInput, NOT stolen back to opener!
      expect(document.activeElement).toBe(overlayInput);

      popSheet("high-priority-overlay");
      overlayRoot.remove();
      opener.remove();
    });

    it("does not crash or throw if opener is detached from DOM before unmount", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();

      const { unmount } = render(
        <CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={() => {}} />,
      );

      // Opener is destroyed/detached while sheet is open
      opener.remove();

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe("5. Tab key trap within CalculatorSheet", () => {
    it("wraps focus from last element to first on Tab, and first to last on Shift+Tab", async () => {
      const user = userEvent.setup();
      const offsetSpy = vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockReturnValue(document.body);

      render(<CalculatorSheet calc={calc} answers={{}} onAnswersChange={() => {}} onClose={() => {}} />);

      const dialog = screen.getByRole("dialog");
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.tabIndex !== -1 && (el.offsetParent !== null || el === document.activeElement));

      expect(focusables.length).toBeGreaterThan(1);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      // Focus last element
      last.focus();
      expect(document.activeElement).toBe(last);

      // Press Tab -> wraps to first
      await user.tab();
      expect(document.activeElement).toBe(first);

      // Press Shift+Tab -> wraps to last
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(last);

      offsetSpy.mockRestore();
    });
  });

  describe("6. isOpen prop reactivity", () => {
    it("synchronizes pushSheet and popSheet when isOpen transitions from true to false and back", () => {
      const { rerender } = render(
        <CalculatorSheet
          sheetId="calc-sheet"
          calc={calc}
          answers={{}}
          onAnswersChange={() => {}}
          onClose={() => {}}
          isOpen={true}
        />,
      );

      expect(hasOpenSheet()).toBe(true);
      expect(isTopmostSheet("calc-sheet")).toBe(true);

      rerender(
        <CalculatorSheet
          sheetId="calc-sheet"
          calc={calc}
          answers={{}}
          onAnswersChange={() => {}}
          onClose={() => {}}
          isOpen={false}
        />,
      );

      expect(hasOpenSheet()).toBe(false);

      rerender(
        <CalculatorSheet
          sheetId="calc-sheet"
          calc={calc}
          answers={{}}
          onAnswersChange={() => {}}
          onClose={() => {}}
          isOpen={true}
        />,
      );

      expect(hasOpenSheet()).toBe(true);
      expect(isTopmostSheet("calc-sheet")).toBe(true);
    });
  });

  describe("7. Advanced Multi-Modal Stacking and Focus Isolation Stress", () => {
    it("restores focus to opener inside parent modal when CalculatorSheet is stacked inside another Sheet", () => {
      // 1. Create parent sheet
      const parentRoot = document.createElement("div");
      const parentOpenerBtn = document.createElement("button");
      parentOpenerBtn.textContent = "Open child calculator";
      parentRoot.append(parentOpenerBtn);
      document.body.append(parentRoot);

      pushSheet("parent-sheet", parentRoot);
      parentOpenerBtn.focus();
      expect(document.activeElement).toBe(parentOpenerBtn);

      // 2. Open CalculatorSheet from parent sheet
      const { unmount } = render(
        <CalculatorSheet
          sheetId="nested-calc-sheet"
          calc={calc}
          answers={{}}
          onAnswersChange={() => {}}
          onClose={() => {}}
        />,
      );

      expect(isTopmostSheet("nested-calc-sheet")).toBe(true);
      expect(isTopmostSheet("parent-sheet")).toBe(false);

      // 3. Close CalculatorSheet
      unmount();

      // 4. CalculatorSheet should have restored focus to parentOpenerBtn because parentRoot contains it
      expect(document.activeElement).toBe(parentOpenerBtn);

      popSheet("parent-sheet");
      parentRoot.remove();
    });

    it("survives 50 rapid mount/unmount cycles without leaking body scroll lock or inert markers", () => {
      const background = document.createElement("div");
      background.append(document.createElement("button"));
      document.body.append(background);

      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <CalculatorSheet
            sheetId={`rapid-calc-${i}`}
            calc={calc}
            answers={{}}
            onAnswersChange={() => {}}
            onClose={() => {}}
          />,
        );
        expect(hasOpenSheet()).toBe(true);
        expect(document.body.style.overflow).toBe("hidden");
        expect(background).toHaveAttribute("inert");
        unmount();
      }

      expect(hasOpenSheet()).toBe(false);
      expect(document.body.style.overflow).toBe("");
      expect(background).not.toHaveAttribute("inert");
      expect(document.querySelectorAll(`[${SHEET_INERT_MARKER}="true"]`).length).toBe(0);

      background.remove();
    });

    it("handles two stacked CalculatorSheets in proper LIFO order", async () => {
      const user = userEvent.setup();
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();

      const calc2 = calculators[1];

      const { unmount: unmount1 } = render(
        <CalculatorSheet sheetId="calc-1" calc={calc} answers={{}} onAnswersChange={() => {}} onClose={onClose1} />,
      );

      const { unmount: unmount2 } = render(
        <CalculatorSheet sheetId="calc-2" calc={calc2} answers={{}} onAnswersChange={() => {}} onClose={onClose2} />,
      );

      expect(isTopmostSheet("calc-2")).toBe(true);
      expect(isTopmostSheet("calc-1")).toBe(false);

      // Escape must trigger only topmost (calc-2)
      await user.keyboard("{Escape}");
      expect(onClose2).toHaveBeenCalledTimes(1);
      expect(onClose1).not.toHaveBeenCalled();

      // Calc-2 unmounts
      unmount2();

      // Now calc-1 is topmost
      expect(isTopmostSheet("calc-1")).toBe(true);
      expect(document.body.style.overflow).toBe("hidden");

      // Escape now triggers calc-1
      await user.keyboard("{Escape}");
      expect(onClose1).toHaveBeenCalledTimes(1);

      unmount1();

      expect(hasOpenSheet()).toBe(false);
      expect(document.body.style.overflow).toBe("");
    });
  });
});
