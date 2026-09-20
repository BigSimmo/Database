/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CmeCustomisePage } from "@/components/cme/cme-customise-page";
import { cmeDashboardModuleLabels } from "@/lib/cme/module-order";
import { cmeModuleOrderStorageKey } from "@/lib/cme/module-order-keys";

afterEach(cleanup);

/** Design decision §12 — see `tests/cme-visual-contract.dom.test.tsx` for the full rationale. */
const CLINICAL_STATUS_CLASS = /\b(?:bg|text|border|ring)-(?:red|amber|green|orange|rose|emerald|yellow)-[0-9]/;

/** Design decision §13 — see `tests/cme-visual-contract.dom.test.tsx` for the full rationale. */
const TAP_TARGET_CLASS = /\b(?:min-h-(?:12|tap)|size-(?:12|tap))\b/;

function hasTapTarget(className: string): boolean {
  if (TAP_TARGET_CLASS.test(className)) return true;
  return /\bh-tap\b/.test(className) && /\bw-tap\b/.test(className);
}

function noClinicalStatusColour(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[class]")].filter((node) =>
    CLINICAL_STATUS_CLASS.test(node.className),
  );
}

describe("Customise", () => {
  beforeEach(() => {
    // The module-order store persists to localStorage, which jsdom keeps
    // alive across tests in this file. Reset it so every test starts from
    // the product default order, regardless of what an earlier test left.
    window.localStorage.removeItem(cmeModuleOrderStorageKey);
  });

  it("moves a module up and down the shown list from a pointer click", async () => {
    const user = userEvent.setup();
    render(<CmeCustomisePage />);
    const list = screen.getByTestId("cme-module-order");
    const firstBefore = within(list).getAllByRole("listitem")[0]?.textContent;
    expect(firstBefore).toContain(cmeDashboardModuleLabels.requirements);

    await user.click(screen.getByRole("button", { name: `Move ${cmeDashboardModuleLabels.requirements} down` }));

    const firstAfterDown = within(screen.getByTestId("cme-module-order")).getAllByRole("listitem")[0]?.textContent;
    expect(firstAfterDown).toContain(cmeDashboardModuleLabels["routines-due"]);

    await user.click(
      screen.getByRole("button", { name: `Move ${cmeDashboardModuleLabels.requirements} up` }),
    );

    const firstAfterUp = within(screen.getByTestId("cme-module-order")).getAllByRole("listitem")[0]?.textContent;
    expect(firstAfterUp).toContain(cmeDashboardModuleLabels.requirements);
  });

  it("reorders a module from the keyboard alone — reordering is never drag-only", async () => {
    const user = userEvent.setup();
    render(<CmeCustomisePage />);
    const list = screen.getByTestId("cme-module-order");
    const firstLabelBefore = within(list).getAllByRole("listitem")[0]?.textContent;
    expect(firstLabelBefore).toContain(cmeDashboardModuleLabels.requirements);

    const moveDown = screen.getByRole("button", { name: `Move ${cmeDashboardModuleLabels.requirements} down` });
    // Tab focus, not a click — this is the behaviour under test: the control
    // must be reachable and operable purely from the keyboard.
    moveDown.focus();
    expect(moveDown).toHaveFocus();
    await user.keyboard("{Enter}");

    const firstLabelAfter = within(screen.getByTestId("cme-module-order")).getAllByRole("listitem")[0]?.textContent;
    expect(firstLabelAfter).toContain(cmeDashboardModuleLabels["routines-due"]);
    expect(firstLabelAfter).not.toBe(firstLabelBefore);

    // The Space key must work too, not only Enter — both are how a native
    // button responds to the keyboard, and a control that only wired one
    // would still read as "keyboard operable" to a shallow check. Requirement
    // progress now sits second (routines due moved to first), so its own
    // "up" control — not the (now-disabled) first row's — is the one to press.
    const moveUp = screen.getByRole("button", { name: `Move ${cmeDashboardModuleLabels.requirements} up` });
    moveUp.focus();
    await user.keyboard(" ");
    const firstLabelAfterSpace = within(screen.getByTestId("cme-module-order")).getAllByRole("listitem")[0]
      ?.textContent;
    expect(firstLabelAfterSpace).toContain(cmeDashboardModuleLabels.requirements);
  });

  it("disables the top row's up control and the bottom row's down control, rather than letting them no-op silently", () => {
    render(<CmeCustomisePage />);
    const list = screen.getByTestId("cme-module-order");
    const items = within(list).getAllByRole("listitem");
    const firstUp = within(items[0]!).getByRole("button", { name: /move .* up/i });
    const lastDown = within(items[items.length - 1]!).getByRole("button", { name: /move .* down/i });
    expect(firstUp).toBeDisabled();
    expect(lastDown).toBeDisabled();
  });

  it("hides a shown module and shows it again", async () => {
    const user = userEvent.setup();
    render(<CmeCustomisePage />);

    await user.click(screen.getByRole("button", { name: `Hide ${cmeDashboardModuleLabels.requirements}` }));

    expect(
      within(screen.getByTestId("cme-module-order")).queryByText(cmeDashboardModuleLabels.requirements),
    ).toBeNull();
    const hidden = screen.getByTestId("cme-module-order-hidden");
    expect(within(hidden).getByText(cmeDashboardModuleLabels.requirements)).toBeInTheDocument();

    await user.click(within(hidden).getByRole("button", { name: `Show ${cmeDashboardModuleLabels.requirements}` }));

    expect(screen.queryByTestId("cme-module-order-hidden")).toBeNull();
    expect(
      within(screen.getByTestId("cme-module-order")).getByText(cmeDashboardModuleLabels.requirements),
    ).toBeInTheDocument();
  });

  it("gives every control — shown or hidden — an accessible name", () => {
    const { container } = render(<CmeCustomisePage />);
    const buttons = [...container.querySelectorAll<HTMLElement>("button")];
    expect(buttons.length).toBeGreaterThan(0);
    const unnamed = buttons.filter((button) => {
      const accessibleName = button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "";
      return accessibleName.length === 0;
    });
    expect(unnamed).toEqual([]);
  });

  it("paints no clinical status colour anywhere on the page", () => {
    const { container } = render(<CmeCustomisePage />);
    expect(noClinicalStatusColour(container).map((node) => node.className)).toEqual([]);
  });

  it("gives every interactive element a 48px tap target", () => {
    const { container } = render(<CmeCustomisePage />);
    const interactive = [...container.querySelectorAll<HTMLElement>("button, a[href], [role='button']")];
    expect(interactive.length).toBeGreaterThan(0);
    const short = interactive.filter((node) => !hasTapTarget(node.className));
    expect(short.map((node) => node.textContent?.trim() || node.getAttribute("aria-label"))).toEqual([]);
  });
});
