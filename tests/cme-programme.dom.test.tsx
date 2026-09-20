import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CmeProgrammePage } from "@/components/cme/cme-programme-page";
import { DEMO_CME_YEAR } from "@/lib/cme/demo-year";

describe("Programme", () => {
  it("shows every target as the owner's own confirmed number, with its provenance", () => {
    render(<CmeProgrammePage set={DEMO_CME_YEAR} />);
    const provenance = screen.getByTestId("cme-provenance");
    expect(provenance).toHaveTextContent("Confirmed by you on 19 September 2026");
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
