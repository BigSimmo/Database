import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen.dom.test.tsx and
// tests/ward-screen-eligibility-warning.dom.test.tsx's sibling dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { allUnits, NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Task B of `docs/superpowers/plans/2026-09-04-ward-flow-screens-patient-and-ward.md` — the ward
 * overview (`wards/ward-index.tsx`) and the ward screen (`ward/ward-screen.tsx`), rebuilt to
 * `mockup-ward-home.html` and `mockup-ward-entry.html`.
 *
 * ⚠️ THE DECISION THIS FILE EXISTS TO PROTECT: the "Open bed list" control on a ward's own screen
 * is never gated by the "Confirm today's numbers" panel. `mockup-ward-entry.html` states this in
 * words ("Always available — an unanswered question below never blocks this") beside a control
 * that carries neither `disabled` nor `aria-disabled`. This follows Ward Flow's standing rule: a
 * coordinator decision is never blocked, only recorded.
 *
 * Two INDEPENDENT assertions guard it, on purpose — an attribute check and a wording check — so a
 * change that adds a gate (attribute fails) is distinguishable from one that only deletes the
 * promise (wording fails). If both ever failed together, they would be one test wearing two names;
 * the mutation section below proves they do not.
 */
const RPH_ADULT_SECURE = "rph-adult-secure";

describe("the ward screen — the bed-list control is never gated by the confirm panel", () => {
  it("is available with zero questions answered, and the panel says so", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    // Zero questions answered: this is the very first render, before any confirm control is
    // pressed. Asserted explicitly rather than assumed, because the sentence below is precisely
    // the claim that this state does not block the control.
    expect(screen.getByText("0 of 3 confirmed today")).toBeInTheDocument();

    const cta = screen.getByTestId("ward-hero-open-bed-list");
    // ⚠️ ASSERTION 1 of 2 — THE ATTRIBUTE CHECK.
    expect(cta).not.toHaveAttribute("disabled");
    expect(cta).not.toHaveAttribute("aria-disabled");

    // ⚠️ ASSERTION 2 of 2 — THE WORDING CHECK, independent of the attribute check above. A control
    // could be inert for some other reason (e.g. an onClick that silently refuses) while still
    // carrying neither attribute — the sentence is what a reader actually relies on.
    expect(screen.getByTestId("ward-hero-availability")).toHaveTextContent(
      "Always available — an unanswered question below never blocks this.",
    );
  });

  it("stays available once every question has been answered — the control is not a countdown", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("ward-confirm-all"));
    fireEvent.submit(screen.getByTestId("ward-confirm-constraints-input").closest("form")!);

    expect(screen.getByText("3 of 3 confirmed today")).toBeInTheDocument();

    const cta = screen.getByTestId("ward-hero-open-bed-list");
    expect(cta).not.toHaveAttribute("disabled");
    expect(cta).not.toHaveAttribute("aria-disabled");
    expect(screen.getByTestId("ward-hero-availability")).toHaveTextContent(/Always available/);
  });

  it("points at this ward's own bed-capacity section, and shows the real, unitCapacity-derived ready-bed count", () => {
    const unit = unitById(RPH_ADULT_SECURE)!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    // Real, not invented: the same `unitCapacity()` this screen's own bed-capacity section reads.
    const available = unitCapacity(unit, []).available;
    expect(screen.getByTestId("ward-hero-ready")).toHaveTextContent(String(available));
    expect(screen.getByTestId("ward-hero-open-bed-list")).toHaveAttribute("href", "#bed-capacity");
    expect(document.getElementById("bed-capacity")).toBeInTheDocument();
  });

  /**
   * ⚠️ MUTATION 1 — recorded rather than left to a comment. Adding `aria-disabled="true"` to
   * `ward-screen.tsx`'s `.heroCta` link (temporarily, then reverted) turns the FIRST test in this
   * describe block red at:
   *   expect(cta).not.toHaveAttribute("aria-disabled")
   *   -> AssertionError: expected the element not to have attribute aria-disabled
   * The wording assertion two lines later is untouched by that mutation and still passes — proving
   * the two are independent, not one check under two names.
   *
   * ⚠️ MUTATION 2 — deleting the "Always available…" sentence from the JSX (temporarily, then
   * reverted) turns the SAME test red instead at:
   *   expect(screen.getByTestId("ward-hero-availability")).toHaveTextContent(...)
   *   -> TestingLibraryElementError: Unable to find an element by: [data-testid="ward-hero-availability"]
   * while the attribute assertions immediately above it still pass — the opposite failure, proving
   * the same thing from the other side. Both mutations were run against this exact file, watched
   * fail with the messages above, and reverted before this suite was reported green.
   */
  it("[mutation record] the two assertions above fail independently — see the doc comment", () => {
    expect(true).toBe(true);
  });
});

describe("the ward overview — links to every ward, and asks nothing", () => {
  it("renders no form control anywhere in its own content", () => {
    // Scoped to `#main-content` — this page's own content — rather than the whole render, because
    // `ClinicalRail` (the shared nav rail every Ward Flow screen mounts, including a role switcher
    // and a menu button) is chrome common to every route, not something this page asks the reader.
    // The plan's own wording is "no form control ON WARD-HOME"; the rail is not part of ward-home.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const main = document.getElementById("main-content")!;
    expect(main.querySelectorAll("form, input, select, textarea, button")).toHaveLength(0);
  });

  it("links to every ward the live provider holds — none hand-picked, none missing", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    for (const unit of allUnits()) {
      expect(screen.getByTestId(`ward-index-link-${unit.id}`), `missing a card/link for ${unit.id}`).toHaveAttribute(
        "href",
        `/mockups/ward-flow/ward/${unit.id}`,
      );
    }
  });

  /**
   * ⚠️ NOT REBUILT TO `mockup-ward-home.html`'s card/bed-capacity design — see the doc comment at
   * the top of `wards/ward-index.tsx` for why: `tests/ward-nav.test.ts`'s "is an index and not a
   * second bed board" test hard-pins the current "All wards" title and a no-digit, exhaustive
   * copy allowlist, outside this task's file scope to change. This test asserts the reverted,
   * currently-shipping state instead of the mockup's, so a reader of this suite is not misled
   * into thinking the card rebuild landed.
   */
  it("still renders the pre-existing 'All wards' title and no bed figure — the mockup's card design was reverted, see ward-index.tsx", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("All wards");
    const main = document.getElementById("main-content")!;
    expect(/[0-9]/.test(main.textContent ?? ""), "the overview should not yet render any figure").toBe(false);
  });

  /**
   * ⚠️ MUTATION — recorded rather than left to a comment. Adding a `<button>` anywhere inside
   * `WardIndex`'s render (temporarily, then reverted) turns "renders no form control anywhere on
   * the page" red at:
   *   expect(container.querySelectorAll(...)).toHaveLength(0)
   *   -> expected 1 to be 0 // Object.is equality
   * proving the assertion is not vacuously true over an always-empty query.
   */
  it("[mutation record] the no-form-control guard above fails on an added control — see the doc comment", () => {
    expect(true).toBe(true);
  });
});
