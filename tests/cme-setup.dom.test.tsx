/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { CmeSetupPage } from "@/components/cme/cme-setup-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";

afterEach(cleanup);

/**
 * Design decision §12: no red, amber or green anywhere in this mode, in any
 * state — including a not-yet-confirmed setup step. `bg`/`text`/`border`/
 * `ring` are the properties a clinical-status hue would be painted with; the
 * mode's one sanctioned accent (`--clinical-accent`, `--tone-indigo`, …) is a
 * CSS custom property, not a Tailwind colour-scale utility, so it never
 * matches this pattern.
 */
const CLINICAL_STATUS_CLASS = /\b(?:bg|text|border|ring)-(?:red|amber|green|orange|rose|emerald|yellow)-[0-9]/;

/**
 * Design decision §13: 48px is the tap-target floor, expressed in this mode
 * as `min-h-tap`/`min-h-12` (a `Button`/`Link`-shaped control), `size-tap`
 * (an icon-only control or a switch), or the `h-tap`+`w-tap` pair. Never
 * `min-h-11` — see `docs/cme/design/cme-design-decisions.md` §13 and the
 * `tests/cme-visual-contract.dom.test.tsx` mode-wide check this mirrors.
 */
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

describe("Set up", () => {
  it("shows the targets step as not started when no requirement set is confirmed yet", () => {
    render(<CmeSetupPage set={null} />);
    const steps = screen.getByTestId("cme-setup-steps");
    const targetsRow = within(steps).getByText("Your CPD home and targets").closest("div");
    expect(targetsRow).not.toBeNull();
    expect(within(targetsRow as HTMLElement).getByText("Not started")).toBeInTheDocument();
  });

  it("flips the targets step to done once a requirement set is confirmed", () => {
    render(<CmeSetupPage set={DEMO_CME_YEAR} />);
    const steps = screen.getByTestId("cme-setup-steps");
    const targetsRow = within(steps).getByText("Your CPD home and targets").closest("div");
    expect(targetsRow).not.toBeNull();
    expect(within(targetsRow as HTMLElement).getByText("Done")).toBeInTheDocument();
  });

  it("keeps the automatic-capture switch reporting off, even after the owner taps it", async () => {
    const user = userEvent.setup();
    render(<CmeSetupPage set={DEMO_CME_YEAR} />);
    const capture = screen.getByRole("switch", { name: /turn on automatic capture/i });
    expect(capture).toHaveAttribute("aria-checked", "false");

    await user.click(capture);

    // Phase 3 (automatic capture) is not built yet — this switch must never
    // appear to turn on, no matter how many times it is tapped, because
    // nothing behind it is actually capturing anything.
    expect(capture).toHaveAttribute("aria-checked", "false");
  });

  it("says capture would record only document titles and dwell time, never typed search text", () => {
    render(<CmeSetupPage set={DEMO_CME_YEAR} />);
    const capture = screen.getByTestId("cme-setup-capture");
    expect(capture).toHaveTextContent(/document titles/i);
    expect(capture).toHaveTextContent(/how long they were open/i);
    // The owner's own privacy ruling: never what was typed into search. This
    // exact wording must not drift, because it is the one promise this
    // screen makes about what a future capture feature will not do.
    expect(capture).toHaveTextContent(/never what you typed in the search box/i);
  });

  it("marks the routines shortcut as optional, not a fifth required step", () => {
    render(<CmeSetupPage set={DEMO_CME_YEAR} />);
    const routinesLink = screen.getByRole("link", { name: /set up your routines/i });
    expect(within(routinesLink).getByText(/optional/i)).toBeInTheDocument();
  });

  it("paints no clinical status colour anywhere on the page", () => {
    const { container } = render(<CmeSetupPage set={DEMO_CME_YEAR} />);
    expect(noClinicalStatusColour(container).map((node) => node.className)).toEqual([]);
  });

  it("gives every interactive element a 48px tap target", () => {
    const { container } = render(<CmeSetupPage set={DEMO_CME_YEAR} />);
    const interactive = [...container.querySelectorAll<HTMLElement>("button, a[href], [role='switch']")];
    expect(interactive.length).toBeGreaterThan(0);
    const short = interactive.filter((node) => !hasTapTarget(node.className));
    expect(short.map((node) => node.textContent?.trim() || node.getAttribute("aria-label"))).toEqual([]);
  });
});
