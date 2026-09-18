/**
 * #2M4PX1 — the mode-home Prompts rail clipped its chips at 820px.
 *
 * The obvious fix is forbidden. The rail is pinned to ONE line at every width
 * from 640px up: `tests/ui-overlap.spec.ts` measures a single chip row and a
 * 160px composer at 1280px and 1920px, and `tests/search-route-ownership.test.ts`
 * reads `flex-wrap: nowrap` and `overflow-x: auto` straight out of `globals.css`.
 * Letting the row wrap breaks both. So the chips past the right edge stay
 * reachable only by a horizontal gesture, which a tablet or trackpad reader has
 * no reason to expect, and the trailing fade mask is too quiet to say so.
 *
 * The affordance is an edge control that scrolls the rail, rendered only while
 * the rail actually overflows in that direction. These tests pin the three
 * things that make it safe: it appears only on a real overflow, it is a SIBLING
 * of the chip list rather than a member of it (`ui-overlap` counts that list's
 * children), and it carries a name.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";

const resizeCallbacks: Array<() => void> = [];

class TestResizeObserver {
  constructor(private readonly callback: () => void) {
    resizeCallbacks.push(() => this.callback());
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const prompts = ["depressed but racing thoughts", "returns every winter", "much better but not fully recovered"];

/** jsdom does no layout, so the rail's scroll geometry has to be declared. */
function setRailGeometry(
  rail: HTMLElement,
  geometry: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  for (const [property, value] of Object.entries(geometry)) {
    Object.defineProperty(rail, property, { configurable: true, writable: true, value });
  }
  act(() => {
    for (const fire of resizeCallbacks) fire();
  });
}

function rail() {
  return document.querySelector<HTMLElement>(".answer-suggestion-chips")!;
}

beforeEach(() => {
  resizeCallbacks.length = 0;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("one-line suggestion rail scroll affordance", () => {
  it("shows no control while every chip fits", () => {
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" layout="scroll" />);
    setRailGeometry(rail(), { scrollWidth: 400, clientWidth: 400, scrollLeft: 0 });

    expect(screen.queryByTestId("answer-suggestion-scroll-forward")).toBeNull();
    expect(screen.queryByTestId("answer-suggestion-scroll-back")).toBeNull();
  });

  it("offers a named forward control once the rail overflows", () => {
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" layout="scroll" />);
    setRailGeometry(rail(), { scrollWidth: 613, clientWidth: 400, scrollLeft: 0 });

    // The label names the rail, so the same control reads correctly on the eight
    // mode homes ("Prompts"), the header ("Examples") and the follow-up rows.
    expect(screen.getByRole("button", { name: "Show more prompts" })).toBeTruthy();
    // Nothing to go back to yet.
    expect(screen.queryByTestId("answer-suggestion-scroll-back")).toBeNull();
  });

  it("offers both ends once the rail has been scrolled", () => {
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" layout="scroll" />);
    setRailGeometry(rail(), { scrollWidth: 613, clientWidth: 400, scrollLeft: 100 });

    expect(screen.getByRole("button", { name: "Show previous prompts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show more prompts" })).toBeTruthy();
  });

  it("drops the forward control at the end of the rail", () => {
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" layout="scroll" />);
    setRailGeometry(rail(), { scrollWidth: 613, clientWidth: 400, scrollLeft: 213 });

    expect(screen.queryByTestId("answer-suggestion-scroll-forward")).toBeNull();
    expect(screen.getByTestId("answer-suggestion-scroll-back")).toBeTruthy();
  });

  it("scrolls the rail forward by less than a full page", async () => {
    const user = userEvent.setup();
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" layout="scroll" />);
    const track = rail();
    const scrollBy = vi.fn();
    Object.defineProperty(track, "scrollBy", { configurable: true, writable: true, value: scrollBy });
    setRailGeometry(track, { scrollWidth: 613, clientWidth: 400, scrollLeft: 0 });

    await user.click(screen.getByTestId("answer-suggestion-scroll-forward"));

    expect(scrollBy).toHaveBeenCalledTimes(1);
    const [{ left }] = scrollBy.mock.calls[0] as [{ left: number }];
    // A full page would step straight past the chip at the boundary — the one
    // the reader was part-way through reading.
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(400);
  });

  it("keeps the control out of the chip list ui-overlap counts", () => {
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" layout="scroll" />);
    setRailGeometry(rail(), { scrollWidth: 613, clientWidth: 400, scrollLeft: 100 });

    // `ui-overlap` asserts every child of `.answer-suggestion-chips` shares one
    // row top. A control inside that list would be a second row and a red gate,
    // and putting it there is the obvious mistake to make when returning here.
    expect(rail().children).toHaveLength(prompts.length);
    for (const direction of ["back", "forward"]) {
      const control = screen.getByTestId(`answer-suggestion-scroll-${direction}`);
      expect(rail().contains(control)).toBe(false);
    }
  });

  it("leaves the wrapping layout exactly as it was", () => {
    // The follow-up and empty-state rails wrap; they have no overflow to reveal,
    // and they must not grow a viewport wrapper either.
    render(<AnswerSuggestionChips suggestions={prompts} onPick={() => {}} label="Prompts" />);
    setRailGeometry(rail(), { scrollWidth: 613, clientWidth: 400, scrollLeft: 100 });

    expect(document.querySelector(".answer-suggestion-chips-viewport")).toBeNull();
    expect(screen.queryByTestId("answer-suggestion-scroll-forward")).toBeNull();
  });
});
