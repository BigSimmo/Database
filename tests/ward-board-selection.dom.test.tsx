import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * SELECTION — the reversal of 281bdf83f, and the parts of that commit's reasoning that survive it.
 *
 * The product owner overruled the no-selection decision and that is his call. What did NOT change
 * is the identity discipline underneath it: an `Admission` records the ward and NEVER a bed, so a
 * tile may stand for a PERSON and must never stand for a numbered place on a ward. These tests
 * pin both halves — that choosing a tile shows the right person's own record, and that nothing on
 * the board ever labels a tile with a bed number or otherwise turns the grid into a floor plan.
 *
 * They also pin the keyboard contract, which is not decoration: a control that opens a panel and
 * then strands the reader's focus is worse than one that never opened it.
 */
function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

const UNIT_ID = "rph-adult-secure";
/** Records blocked beds, so the out-of-service branch of the panel has a real subject here. */
const BLOCKED_UNIT_ID = "fsh-adult-secure";

function unitFor(unitId: string): Unit {
  const unit = wardSites.flatMap((site) => site.units).find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`No seeded unit ${unitId} — this test cannot check anything.`);
  return unit;
}

/** Exactly the two calls the component makes, so a scoping mistake in the component shows up as a
 *  disagreement with this rather than being reproduced by it. */
function occupantsFor(unitId: string): Admission[] {
  return admissionsForUnit(wardAdmissions, unitId).filter(bedIsOccupied);
}

function tileButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-bed-kind] button')];
}

function tileButtonOfKind(container: HTMLElement, kind: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`[data-bed-kind="${kind}"] button`);
  if (button === null) throw new Error(`No ${kind} tile rendered — this assertion would prove nothing.`);
  return button;
}

describe("ward board selection — nothing is chosen for the reader", () => {
  it("selects nobody on first render, and says so rather than showing an empty panel", () => {
    const { container } = renderWardBoard(UNIT_ID);

    // Non-vacuity: there are tiles to have failed to select.
    expect(tileButtons(container).length).toBeGreaterThan(0);

    expect(container.querySelector('[data-testid="ward-board-detail"]')).toBeNull();
    expect(tileButtons(container).filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(0);

    // The absence is STATED. A blank column reads as a panel that failed to load, and an
    // auto-selected occupant would read as the system having picked a person out of the ward.
    const hint = screen.getByTestId("ward-board-select-hint");
    expect(hint.textContent).toContain("nobody is chosen for you");
  });

  it("never numbers a tile or otherwise gives it a bed identity", () => {
    const { container } = renderWardBoard(UNIT_ID);

    for (const button of tileButtons(container)) {
      const text = button.textContent ?? "";
      // "Bed 7", "Bed  7", "bed 12" — the identity the model does not hold and this grid must
      // never invent. The day count is a number and stays legal; a number introduced by the word
      // "bed" is not.
      expect(text).not.toMatch(/\bbeds?\s*\.?\s*\d/i);
      expect(button.getAttribute("aria-label")).toBeNull();
    }
  });
});

describe("ward board selection — choosing a tile shows that tile's own occupant", () => {
  it("opens the slide-out on the person whose admission the tile stands for", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    const occupied = [...container.querySelectorAll<HTMLElement>('[data-bed-kind="occupied"]')];
    expect(occupied.length).toBeGreaterThan(2);

    // The third tile rather than the first, so a component that always rendered occupant zero
    // would not pass by coincidence.
    const slot = occupied[2]!;
    const button = slot.querySelector("button")!;
    // The tile's own key is the admission id — which is exactly what makes selection honest here,
    // and what lets this test know which person SHOULD appear.
    const admissionId = button.id.replace("ward-board-tile-", "");
    const admission = occupantsFor(UNIT_ID).find((candidate) => candidate.id === admissionId);
    expect(admission, `tile ${admissionId} does not correspond to any occupant of ${UNIT_ID}`).toBeDefined();

    await user.click(button);

    const detail = screen.getByTestId("ward-board-detail");
    expect(detail.getAttribute("data-detail-kind")).toBe("occupied");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    // Exactly one tile is pressed — selection is single, and a second pressed tile would mean two
    // readers of this board could disagree about what is open.
    expect(tileButtons(container).filter((tile) => tile.getAttribute("aria-pressed") === "true")).toHaveLength(1);

    // THE PERSON, checked against the seed rather than against the panel's own markup: the day
    // count in the slide-out is the one `daysInBed` gives for this exact admission.
    const days = daysInBed(admission!, WARD_ADMISSIONS_ANCHOR);
    expect(days).not.toBeNull();
    const shown = within(detail).getByTestId(`ward-board-selected-person-${admissionId}-days`);
    expect(shown.textContent).toBe(`${days} day${days === 1 ? "" : "s"}`);

    // And the sex and home region are this admission's, not some other occupant's.
    expect(detail.textContent).toContain(`${admission!.sex}, from ${admission!.homeRegion}`);
  });

  it("shows a pulled bed as a person with no stay, never as a zero-day one", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    const button = tileButtonOfKind(container, "waiting");
    await user.click(button);

    const detail = screen.getByTestId("ward-board-detail");
    expect(detail.getAttribute("data-detail-kind")).toBe("waiting");
    expect(detail.textContent).toContain("No stay yet — not arrived");
    expect(detail.textContent).toContain("already given this bed away");
    // The failure this guards: a bed given away reading as somebody who arrived today.
    expect(detail.textContent).not.toMatch(/\b0 days?\b/);
  });
});

describe("ward board selection — a bed with no occupant is a class, not a location", () => {
  it("says which bed is not recorded when an out-of-service tile is chosen", async () => {
    const user = userEvent.setup();
    const unit = unitFor(BLOCKED_UNIT_ID);
    expect(unit.blocked).toBeGreaterThan(0);

    const { container } = renderWardBoard(BLOCKED_UNIT_ID);
    await user.click(tileButtonOfKind(container, "blocked"));

    const detail = screen.getByTestId("ward-board-detail");
    expect(detail.getAttribute("data-detail-kind")).toBe("blocked");
    expect(within(detail).getByTestId("ward-board-detail-bed-class")).toBeTruthy();
    // The count it belongs to, and the honest limit on what selecting it means.
    expect(detail.textContent).toContain(`${unit.blocked}`);
    expect(detail.textContent).toContain("Which bed is not recorded");
    expect(detail.textContent).toContain("never a bed");
    // No person's record leaks into a tile that stands for nobody.
    expect(container.querySelector('[data-testid="ward-board-detail-person"]')).toBeNull();
  });

  it("describes an empty tile as one a coordinator can fill, with the ward's own constraint", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(BLOCKED_UNIT_ID);
    const emptyCount = container.querySelectorAll('[data-bed-kind="empty"]').length;
    expect(emptyCount).toBeGreaterThan(0);

    await user.click(tileButtonOfKind(container, "empty"));

    const detail = screen.getByTestId("ward-board-detail");
    expect(detail.getAttribute("data-detail-kind")).toBe("empty");
    expect(detail.textContent).toContain(`${emptyCount}`);
    expect(detail.textContent).toContain("fill right now");
    expect(detail.textContent).toContain("Which bed is not recorded");
  });
});

describe("ward board selection — the keyboard contract", () => {
  it("closes on Escape and hands focus back to the tile that opened it", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    const button = tileButtonOfKind(container, "occupied");
    await user.click(button);
    expect(screen.getByTestId("ward-board-detail")).toBeTruthy();

    // Fired at the panel, which is where a reader's focus is most likely to be when they give up
    // on it — and the handler is on the zones container, so it must reach there by bubbling.
    fireEvent.keyDown(screen.getByTestId("ward-board-detail"), { key: "Escape" });

    expect(container.querySelector('[data-testid="ward-board-detail"]')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("closes from the panel's own Close control, and hands focus back the same way", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    const button = tileButtonOfKind(container, "occupied");
    await user.click(button);
    await user.click(screen.getByTestId("ward-board-detail-close"));

    expect(container.querySelector('[data-testid="ward-board-detail"]')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("is reachable and operable by keyboard alone, and does not trap focus in the panel", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    const button = tileButtonOfKind(container, "occupied");
    button.focus();
    expect(document.activeElement).toBe(button);
    // A real button, so Enter and Space both activate it — nothing here relies on a click.
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("ward-board-detail")).toBeTruthy();

    // NOT a focus trap: tabbing on from the panel's Close control lands somewhere outside the
    // panel rather than being cycled back into it.
    const close = screen.getByTestId("ward-board-detail-close");
    close.focus();
    await user.tab();
    const detail = screen.getByTestId("ward-board-detail");
    expect(detail.contains(document.activeElement)).toBe(false);
  });

  it("deselects when the same tile is chosen again", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    const button = tileButtonOfKind(container, "occupied");
    await user.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await user.click(button);

    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[data-testid="ward-board-detail"]')).toBeNull();
    expect(screen.getByTestId("ward-board-select-hint")).toBeTruthy();
  });
});

describe("ward board selection — what it looks like on paper", () => {
  it("marks the selected tile in words as well as in weight", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);

    await user.click(tileButtonOfKind(container, "occupied"));

    // Words, because a printer drops fills and a weight is a channel a greyscale reader can miss.
    expect(within(screen.getByTestId("ward-board-beds")).getAllByText("Selected")).toHaveLength(1);
  });

  it("keeps every occupant on the printed list while one of them is selected", async () => {
    const user = userEvent.setup();
    const { container } = renderWardBoard(UNIT_ID);
    const expected = occupantsFor(UNIT_ID).length;
    expect(expected).toBeGreaterThan(0);

    await user.click(tileButtonOfKind(container, "occupied"));

    // The 281bdf83f deliverable: the sheet still carries all of them, not just whoever was clicked.
    const rows = [...screen.getByTestId("ward-board-people").querySelectorAll("li")];
    expect(rows).toHaveLength(expected);
    // And the selected one is findable on the sheet — in words, again, not by a fill.
    const marked = rows.filter((row) => (row.textContent ?? "").includes("Selected on screen"));
    expect(marked).toHaveLength(1);
  });

  /**
   * Read off the stylesheet rather than off a rendered element, because jsdom applies no CSS module
   * and a computed-style check here would assert nothing. The claim is narrow and structural: the
   * selection class changes the EDGE and the ink, and declares no background of any kind. A fill on
   * a printed sheet that has recorded no decision reads as a decision made.
   */
  it("carries selection as a weight and never as a fill", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/components/ward-management/board/board.module.css"),
      "utf8",
    );
    const match = css.match(/\.bedSelected\s*\{([^}]*)\}/);
    expect(match, "board.module.css declares no .bedSelected rule").not.toBeNull();
    const body = match![1]!;
    expect(body).toMatch(/border-width/);
    expect(body).not.toMatch(/background/);
  });

  /**
   * THE PRINT RESTORE, pinned. The global reset in `globals.css` carries
   * `header, nav, button { display: none !important }`; the tiles became buttons with selection, so
   * without a restore the printed board is an empty grid. That defect has now been fixed on four
   * other surfaces on this branch and must not be reintroduced here by a later edit to the print
   * block.
   */
  it("restores the tile buttons for print", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/components/ward-management/board/board.module.css"),
      "utf8",
    );
    const printBlock = css.slice(css.indexOf("@media print"));
    expect(printBlock).toContain("display: flex !important");
    // Specifically on the tile class — a restore attached to something else would leave the tiles
    // hidden while this assertion passed on the wrong rule.
    expect(printBlock).toMatch(/\.bed\s*\{[^}]*display:\s*flex\s*!important/);
    // And the full occupant list is brought back rather than left hidden with the screen furniture.
    expect(printBlock).toMatch(/\.people\s*\{[^}]*display:\s*block/);
    // The toggle goes as a whole GROUP, not just its two buttons. Found by printing the page: the
    // global reset removes a `<button>` but not the `<span>` labelling it, so the sheet carried
    // "GOING OUT SHOWS" with nothing at all underneath it — a label for a control the reader
    // cannot see, which reads as content that failed to render.
    expect(printBlock).toMatch(/\.triageToggle[^{]*\{[^}]*display:\s*none\s*!important/);
  });

  /**
   * THE DARK-THEME SHEET'S INK, pinned because it was invisible twice and each fix broke the other
   * way round.
   *
   * Printing with `.dark` set left the ward name white on white — every rule here that sets its own
   * `color` overrides the global reset's black, and `--text-heading` in dark is a near-white
   * (measured `rgb(251, 252, 253)`). The repair is a system colour, and a system colour resolves
   * against the element's own colour scheme, so it only works because the sheet declares itself
   * light. Without that one line the fix silently does nothing, which is exactly the shape of thing
   * a later edit removes as redundant.
   */
  it("prints its own ink on a light sheet whatever theme the screen was in", () => {
    const css = readFileSync(
      path.join(process.cwd(), "src/components/ward-management/board/board.module.css"),
      "utf8",
    );
    const printBlock = css.slice(css.indexOf("@media print"));
    // **Anchored to the start of a line and required to end in a semicolon, because the first
    // version of this assertion could not fail.** `/color-scheme:\s*light/` matched the prose in
    // the comment that explains the rule, so deleting the declaration itself left the test green —
    // proven by mutating it out and watching 15 of 15 still pass. A comment line here begins with
    // `*`, so a line-anchored declaration cannot be satisfied by one.
    expect(printBlock).toMatch(/^\s*color-scheme:\s*light;\s*$/m);
    expect(printBlock).toMatch(/^\s*\.unitName,[\s\S]{0,400}?^\s*color:\s*CanvasText;\s*$/m);
    // And the past-date badge carries its own light ground, so it stays readable on the printed
    // occupant list — which keeps a dark panel fill when the screen theme was dark.
    expect(printBlock).toMatch(/\.pastMark\s*\{[\s\S]*?background:\s*Canvas;/);
  });
});
