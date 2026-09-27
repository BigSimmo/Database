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

function setLocation(href: string) {
  window.history.pushState({}, "", href);
}

/** What the router does when a push commits: the address bar moves to its href. */
function commitLastPush() {
  const href = navigation.push.mock.lastCall?.[0];
  if (typeof href !== "string") throw new Error("no router.push to commit");
  setLocation(href);
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
    setLocation("/calculators/search?q=PHQ-9&run=1");
    const first = render(<CalculatorsSearchPage initialQuery="PHQ-9" />);
    await user.click(tile("phq9"));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining("calculator=phq9"));

    // The route commit for `?calculator=phq9` mounts a fresh page instance.
    commitLastPush();
    first.unmount();
    const opened = render(<CalculatorsSearchPage initialQuery="PHQ-9" initialCalculatorId="phq9" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(navigation.push).toHaveBeenLastCalledWith(expect.not.stringContaining("calculator="));

    // ...and the commit that drops the param mounts another one: the opener is gone.
    commitLastPush();
    opened.unmount();
    render(<CalculatorsSearchPage initialQuery="PHQ-9" />);
    await flushFrames();

    expect(document.activeElement).toBe(tile("phq9"));
  });

  it("waits for the URL change to commit before restoring", async () => {
    const user = userEvent.setup();
    setLocation("/calculators/search?calculator=gad7");
    const { rerender } = render(<CalculatorsSearchPage initialQuery="GAD-7" initialCalculatorId="gad7" />);

    await user.click(screen.getByRole("button", { name: /close/i }));
    // Still on `?calculator=gad7` until the router commits; nothing to restore to yet.
    expect(document.activeElement).not.toBe(tile("gad7"));

    commitLastPush();
    rerender(<CalculatorsSearchPage initialQuery="GAD-7" />);
    await flushFrames();
    expect(document.activeElement).toBe(tile("gad7"));
  });

  it("does not steal focus the reader already moved elsewhere", async () => {
    const user = userEvent.setup();
    setLocation("/calculators/search?calculator=gad7");
    const { rerender } = render(<CalculatorsSearchPage initialQuery="GAD-7" initialCalculatorId="gad7" />);
    await user.click(screen.getByRole("button", { name: /close/i }));

    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    elsewhere.focus();
    commitLastPush();
    rerender(<CalculatorsSearchPage initialQuery="GAD-7" />);
    await flushFrames();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it("forgets the restore when the reader leaves for another route before it lands", async () => {
    const user = userEvent.setup();
    setLocation("/calculators/search?calculator=phq9");
    const opened = render(<CalculatorsSearchPage initialQuery="PHQ-9" initialCalculatorId="phq9" />);
    await user.keyboard("{Escape}");

    // The reader follows a link elsewhere before the close lands...
    setLocation("/documents");
    opened.unmount();
    await flushFrames();

    // ...and comes back to the very same results URL within the TTL.
    setLocation("/calculators/search?q=PHQ-9&run=1");
    render(<CalculatorsSearchPage initialQuery="PHQ-9" />);
    await flushFrames();

    expect(document.activeElement).not.toBe(tile("phq9"));
  });

  it("does not restore on a page the close did not navigate to", async () => {
    const user = userEvent.setup();
    setLocation("/calculators/search?calculator=phq9");
    const opened = render(<CalculatorsSearchPage initialQuery="PHQ-9" initialCalculatorId="phq9" />);
    await user.keyboard("{Escape}");
    opened.unmount();

    // A different results URL mounts within the TTL (e.g. a new search).
    setLocation("/calculators/search?q=anxiety&run=1");
    render(<CalculatorsSearchPage initialQuery="PHQ-9" />);
    await flushFrames();

    expect(document.activeElement).not.toBe(tile("phq9"));
  });
});
