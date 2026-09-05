import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors the sibling network suites: the workspace renders next/link anchors and this file never
// checks routing, so a plain anchor avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardNetworkWorkspace } from "@/components/ward-management/ward-management-network";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ **THE CLUSTER HEADER MUST MEAN WHAT ITS CARDS MEAN — owner ruling, 2026-09-04.**
 *
 * It summed raw `unit.allocatable.value` across a service while every card beneath it showed
 * `unitCapacity(...).available` = `min(allocatable, empty)`, both labelled "ready". The header was
 * the sum of nothing on the screen.
 *
 * ⚠️ **AND A TEST COMPARING HEADER TO CARDS WOULD HAVE PASSED AGAINST THE UNFIXED CODE.** Measured
 * across every service in the seed before this was written: the raw and clamped sums are IDENTICAL
 * (9/9, 4/4, 8/8, 4/4, 2/2). Divergence needs `allocatable > empty`, and no seeded unit has that —
 * **a held bed puts allocatable BELOW empty, so it cannot cause this**, which is the mechanism I
 * first got backwards and reported wrongly.
 *
 * So this drives the state first with a real `CONFIRM_CAPACITY` event — the path the reducer's own
 * `PATIENT_ARRIVED` guard documents as reachable — and compares the header against a figure
 * computed independently from live state, never against a number written down here.
 */

const UNIT_ID = "rph-adult-secure";
const RAISED_TO = 99;

/** Raises a real `CONFIRM_CAPACITY`, and publishes both candidate sums for the unit's own service
 *  from the SAME live state the screen is rendering — so the expectation cannot drift from it. */
function Probe({ unitId, value }: { unitId: string; value: number }) {
  const { dispatch, units, bedReleases, now } = useWardFlow();
  const subject = units.find((unit) => unit.id === unitId);
  const service = subject ? siteByCode(subject.siteCode)?.service : undefined;
  const peers = units.filter((unit) => siteByCode(unit.siteCode)?.service === service);

  return (
    <>
      <span data-testid="probe-service">{service ?? ""}</span>
      <span data-testid="probe-clamped">
        {peers.reduce((sum, unit) => sum + unitCapacity(unit, bedReleases).available, 0)}
      </span>
      <span data-testid="probe-raw">{peers.reduce((sum, unit) => sum + unit.allocatable.value, 0)}</span>
      <button
        type="button"
        onClick={() => dispatch({ type: "CONFIRM_CAPACITY", role: "ward", now, unitId, actingUnitId: unitId, value })}
      >
        raise the confirmed capacity
      </button>
    </>
  );
}

/** The header figure for a service, read from the screen a coordinator sees. */
function headerFigureFor(service: string): number {
  const heading = screen.getByText(service.toUpperCase());
  const text = heading.parentElement?.textContent ?? "";
  const match = /(-?\d+)\s*ready/.exec(text);
  if (!match) throw new Error(`no "<n> ready" figure in the ${service} cluster header: ${text}`);
  return Number(match[1]);
}

function renderNetwork() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardNetworkWorkspace />
      <Probe unitId={UNIT_ID} value={RAISED_TO} />
    </WardFlowProvider>,
  );
  return screen.getByTestId("probe-service").textContent ?? "";
}

const figures = () => ({
  clamped: Number(screen.getByTestId("probe-clamped").textContent),
  raw: Number(screen.getByTestId("probe-raw").textContent),
});

describe("the network cluster header", () => {
  it("agrees with its cards before anything is confirmed — and cannot tell the two implementations apart yet", () => {
    /*
     * ⚠️ THIS TEST EXISTS TO RECORD THAT IT PROVES NOTHING ON ITS OWN, and to fail if that ever
     * changes silently. On the seeded fixture the raw and clamped sums are equal, so the header
     * matches under BOTH implementations. Stating it here stops a later reader mistaking the
     * agreement below for evidence.
     */
    const service = renderNetwork();
    const { clamped, raw } = figures();

    expect(clamped).toBe(raw);
    expect(headerFigureFor(service)).toBe(clamped);
  });

  it("sums what its cards show once a ward confirms more beds than it physically has empty", () => {
    const service = renderNetwork();

    fireEvent.click(screen.getByRole("button", { name: "raise the confirmed capacity" }));

    const { clamped, raw } = figures();

    // ⚠️ THE FLOOR THAT MAKES THE ASSERTION MEAN SOMETHING: the two candidate sums must now
    // disagree. If a future fixture or model change makes them agree again, this goes red rather
    // than quietly becoming a test that cannot fail.
    expect(raw).toBeGreaterThan(clamped);

    // And the header shows the one the cards show.
    expect(headerFigureFor(service)).toBe(clamped);
  });
});
