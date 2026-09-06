// tests/ward-shell-mounted.dom.test.tsx
//
// Task 6 of docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, as re-scoped by
// the 2026-09-04 ruling: `WardGround` mounts once, in `src/app/mockups/ward-flow/layout.tsx`
// (the only ancestor of every route's `<main>` — `ClinicalRail` is a SIBLING of `<main>` at all
// ~26 call sites and could never reach it), and `WardShellHeader` mounts alongside it there too,
// as ordinary in-flow content, carrying no role switcher of its own.
//
// This file reproduces `layout.tsx`'s own composition — `WardGround` wrapping `WardShellHeader`
// and the route's real screen component — minus `DeveloperAreaGate`, which is an auth gate
// orthogonal to the structural property under test here. Real screen components +
// `WardFlowProvider`, no `DeveloperAreaGate`, is the same convention `tests/ward-landmarks.test.ts`
// already uses for "a real ward route".
//
// Named `.dom.test.tsx` (not the `.test.tsx` first drafted) because vitest.config.mts collects
// DOM-rendering suites only under that exact suffix — `tests/ward-shell-mounted.test.tsx` matches
// neither project's include glob and would never run at all. `tests/ward-shell.dom.test.tsx`
// already established this suffix for the sibling suite that also renders `ward-shell.tsx`'s
// components.
//
// ⚠️ No `toHaveClass` anywhere in this file. This repo's vitest resolves CSS-module imports
// through a proxy that fabricates a plausible scoped class name for ANY property, including ones
// absent from the stylesheet — `expect(el).toHaveClass(styles.anything)` would pass whether or
// not that class is real. Ancestry is proved with `Node.contains()` instead, which is a real DOM
// relationship no proxy can fake.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardGround, WardShellHeader } from "@/components/ward-management/ward-shell";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const pathnameState = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/ward/rph-adult-secure" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.pathname,
}));

/**
 * `/mockups/ward-flow/ward/rph-adult-secure` — one of the three route shapes `wardPlaceFor`
 * resolves a place for. `unitId="rph-adult-secure"` is the same fixture id
 * tests/ward-landmarks.test.ts and tests/ward-nav.test.ts already use, and `unitById` resolves
 * it to the real name "RPH Adult Secure" (ward-sites.ts) — never a literal typed here.
 */
function renderWardRoute() {
  pathnameState.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardGround>
        <WardShellHeader />
        <WardScreen unitId="rph-adult-secure" />
      </WardGround>
    </WardFlowProvider>,
  );
}

/** `/mockups/ward-flow` — the coordinator's own route, one of the seven with no place. */
function renderCoordinatorRoute() {
  pathnameState.pathname = "/mockups/ward-flow";
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardGround>
        <WardShellHeader />
        <CoordinatorScreen />
      </WardGround>
    </WardFlowProvider>,
  );
}

describe("Task 6 — the shell is actually reached on a real route, not merely importable", () => {
  it("anti-vacuity: the ward route fixture actually rendered its real screen content", () => {
    renderWardRoute();
    // If this fixture rendered nothing, every assertion below would pass vacuously — a missing
    // ancestor and a missing second heading look identical to an empty document.
    expect(screen.getByTestId("ward-unit-screen")).toBeInTheDocument();
    expect(document.querySelectorAll('main[id="main-content"]')).toHaveLength(1);
  });

  it("the ground-painting element is a real ancestor of the route's <main> — not a sibling that merely sits next to it", () => {
    const { container } = renderWardRoute();
    const ground = container.firstElementChild;
    expect(ground, "WardGround must render an outer element for the route to sit inside").not.toBeNull();
    const main = screen.getByRole("main");
    expect(ground?.contains(main), "the route's <main> must be a DOM descendant of the ground element").toBe(true);
  });

  it("the place label appears for a route that has one", () => {
    // `getByText` alone is not safe here: `WardScreen`'s own body legitimately repeats the unit
    // name ("RPH Adult Secure") several times over (the unit card, the statewide flow diagram),
    // so a plain text query would find several matches even with `WardShellHeader` returning
    // null. `data-testid="ward-shell-place"` names the ONE element `WardShellHeader` itself
    // renders, distinguishing "the shell's own label" from "this text occurs somewhere".
    renderWardRoute();
    expect(screen.getByTestId("ward-shell-place")).toHaveTextContent("RPH Adult Secure");
  });

  it("the place label is absent for a route that has none", () => {
    // The coordinator screen's own statewide-flow diagram also legitimately names
    // "RPH Adult Secure" as one of many units on the board, so this asserts the shell's OWN
    // element is absent, not that the string never occurs anywhere on the page.
    renderCoordinatorRoute();
    expect(screen.queryByTestId("ward-shell-header")).toBeNull();
    expect(screen.queryByTestId("ward-shell-place")).toBeNull();
  });

  it("exactly one role switcher renders on a real route — never zero, never two", () => {
    renderWardRoute();
    // "Present" is not enough: WardShellHeader carries no switcher of its own (ClinicalRail
    // already renders one), so a regression that re-added one would show up only as a count of
    // 2, never as an absence `getByRole` would also catch.
    expect(screen.getAllByRole("button", { name: /change view/i })).toHaveLength(1);
  });
});
