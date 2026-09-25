/** @vitest-environment jsdom */

// #M3XZV0 (calculators half): closing a calculator drops `?calculator=` from the
// URL. That navigation re-renders (in the real app, remounts) the results list, so
// the tile that opened the sheet is destroyed and the sheet's own restore targets a
// detached node, leaving focus on <body>. The page now restores focus to the
// calculator's tile, found by `data-calculator-open`, in an effect that runs once
// the URL change has committed.

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

import { CalculatorsSearchPage } from "@/components/calculators/search-page";

function tile(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-calculator-open="${id}"]`);
  if (!element) throw new Error(`no tile for ${id}`);
  return element;
}

async function flushFrames() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  navigation.push.mockReset();
  Element.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("calculator sheet returns focus to its tile (#M3XZV0)", () => {
  it("marks every tile with the calculator it opens", () => {
    render(<CalculatorsSearchPage />);

    expect(tile("phq9").tagName).toBe("BUTTON");
    expect(tile("gad7")).toHaveAccessibleName(/GAD-7/);
  });

  it("restores focus to the tile after the URL change commits, even when the list remounted", async () => {
    const user = userEvent.setup();
    const first = render(<CalculatorsSearchPage />);
    await user.click(tile("phq9"));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining("calculator=phq9"));

    // The route commit for `?calculator=phq9` mounts a fresh page instance.
    first.unmount();
    const opened = render(<CalculatorsSearchPage initialCalculatorId="phq9" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(navigation.push).toHaveBeenLastCalledWith(expect.not.stringContaining("calculator="));

    // ...and the commit that drops the param mounts another one: the opener is gone.
    opened.unmount();
    render(<CalculatorsSearchPage />);
    await flushFrames();

    expect(document.activeElement).toBe(tile("phq9"));
  });

  it("waits for the URL change to commit before restoring", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CalculatorsSearchPage initialCalculatorId="gad7" />);

    await user.click(screen.getByRole("button", { name: /close/i }));
    // Still on `?calculator=gad7` until the router commits; nothing to restore to yet.
    expect(document.activeElement).not.toBe(tile("gad7"));

    rerender(<CalculatorsSearchPage />);
    await flushFrames();
    expect(document.activeElement).toBe(tile("gad7"));
  });

  it("does not steal focus the reader already moved elsewhere", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CalculatorsSearchPage initialCalculatorId="gad7" />);
    await user.click(screen.getByRole("button", { name: /close/i }));

    tile("phq9").focus();
    rerender(<CalculatorsSearchPage />);
    await flushFrames();
    expect(document.activeElement).toBe(tile("phq9"));
  });
});
