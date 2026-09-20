import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmeProgrammePage } from "@/components/cme/cme-programme-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";

/**
 * "2026-01-08" -> "8 January 2026". Mirrors the plain-English calendar
 * formatting `CmeProgrammePage` applies to `confirmedOn` — not hardcoded to
 * one literal date, so this test keeps holding even if the demo fixture's
 * confirmed-on date changes again (as it already has once, deliberately, so
 * demo mode never shows a date-and-source pair that reads as a real
 * regulatory citation).
 */
function formatCalendarDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}

describe("Programme", () => {
  it("shows every target as the owner's own confirmed number, with its provenance", () => {
    render(<CmeProgrammePage set={DEMO_CME_YEAR} />);
    const provenance = screen.getByTestId("cme-provenance");
    expect(provenance).toHaveTextContent(`Confirmed by you on ${formatCalendarDate(DEMO_CME_YEAR.confirmedOn)}`);
    expect(provenance).toHaveTextContent(DEMO_CME_YEAR.confirmedSource);
  });

  it("puts the four practice domains in the national baseline, not the college overlay", () => {
    render(<CmeProgrammePage set={DEMO_CME_YEAR} />);
    const baseline = screen.getByTestId("cme-national-baseline");
    expect(within(baseline).getByText(/Practice domains/)).toBeInTheDocument();
    const overlay = screen.getByTestId("cme-college-extras");
    expect(within(overlay).queryByText(/Practice domains/)).toBeNull();
  });

  it("says plainly that the app never looks a requirement up", () => {
    render(<CmeProgrammePage set={DEMO_CME_YEAR} />);
    expect(screen.getByTestId("cme-no-lookup")).toHaveTextContent(/never looks|never changes/i);
  });

  it("offers a re-confirm control rather than silently ageing", () => {
    render(<CmeProgrammePage set={DEMO_CME_YEAR} />);
    expect(screen.getByRole("button", { name: /re-confirm/i })).toBeInTheDocument();
  });
});
