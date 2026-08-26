import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Mirrors tests/ward-flow-clock-consistency.dom.test.tsx: WardModeWorkspace renders next/link
// anchors and this suite never checks routing itself, so a plain <a> avoids requiring an App
// Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Task 8 (spec item 6). The capacity board already showed bed counts and freshness but not the
 * three properties that actually gate whether a patient can go to a unit — sex mix, specialling
 * headroom, and Mental Health Act authorisation — even though all three already exist on `Unit`
 * and already gate placement in `ward-eligibility.ts`.
 *
 * SJGS Adult Secure (`sjgs-adult-secure`) is authorised: false — private and not MHA-authorised,
 * per SJGS Adult Open's sibling fixture comment in ward-sites.ts (both SJGS units share that
 * note). SCGH Adult Open (`scgh-adult-open`) is authorised: true. Both are chosen deliberately
 * for an ASYMMETRIC sex mix (Female != Male) rather than the first false/true units found —
 * SJGS Adult Open (4F/4M) and RPH Adult Secure (9F/9M) both have equal Female/Male counts, so a
 * Female<->Male swap mutation on the render line would be invisible against them. Both units
 * used here have distinct counts, so the "both counts" requirement actually has teeth.
 */
const SJGS_ADULT_SECURE = unitById("sjgs-adult-secure");
const SCGH_ADULT_OPEN = unitById("scgh-adult-open");

describe("ward capacity board", () => {
  it("fixture assumption: SJGS Adult Secure is unauthorised with an asymmetric sex mix, SCGH Adult Open is authorised with an asymmetric sex mix", () => {
    expect(SJGS_ADULT_SECURE?.authorised).toBe(false);
    expect(SJGS_ADULT_SECURE?.sexMix).toEqual({ Female: 4, Male: 3 });
    expect(SCGH_ADULT_OPEN?.authorised).toBe(true);
    expect(SCGH_ADULT_OPEN?.sexMix).toEqual({ Female: 10, Male: 9 });
  });

  it("shows sex mix, specialling capacity, and MHA authorisation per unit row — both directions", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="capacity" />
      </WardFlowProvider>,
    );

    const unauthorisedRow = screen.getByTestId("ward-capacity-row-sjgs-adult-secure");
    // Rendering the flag is not a legal claim — just the unit's existing state, in the
    // codebase's own established wording ("not MHA-authorised"), nothing added.
    expect(screen.getByTestId("ward-capacity-authorised-sjgs-adult-secure")).toHaveTextContent("not MHA-authorised");
    expect(screen.getByTestId("ward-capacity-sexmix-sjgs-adult-secure")).toHaveTextContent("Female 4 · Male 3");
    expect(screen.getByTestId("ward-capacity-specialling-sjgs-adult-secure")).toHaveTextContent("0");
    expect(unauthorisedRow).toBeInTheDocument();

    const authorisedRow = screen.getByTestId("ward-capacity-row-scgh-adult-open");
    // The authorised row must NOT carry the not-authorised wording anywhere in its own cell —
    // both directions, or this test would pass even if every row said "not MHA-authorised".
    const authorisedCell = screen.getByTestId("ward-capacity-authorised-scgh-adult-open");
    expect(authorisedCell).toHaveTextContent("MHA-authorised");
    expect(authorisedCell).not.toHaveTextContent("not MHA-authorised");
    expect(screen.getByTestId("ward-capacity-sexmix-scgh-adult-open")).toHaveTextContent("Female 10 · Male 9");
    expect(screen.getByTestId("ward-capacity-specialling-scgh-adult-open")).toHaveTextContent("3");
    expect(authorisedRow).toBeInTheDocument();
  });
});
