import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("freshness stamp", () => {
  it("names the time and the confirming role", () => {
    render(<WardFreshness confirmedAt={NOW_ANCHOR - 20} confirmedByRole="RPH Adult Secure" now={NOW_ANCHOR} />);
    // confirmedAt and now are deliberately different instants: this must render confirmedAt's
    // time, never now's, or a stale figure could silently claim to have just been confirmed.
    expect(screen.getByText(`Confirmed ${formatInstant(NOW_ANCHOR - 20)} · RPH Adult Secure`)).toBeTruthy();
  });

  it("says 'Never confirmed' rather than showing a blank or a dash", () => {
    render(<WardFreshness now={NOW_ANCHOR} />);
    expect(screen.getByText("Never confirmed")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("falls back to 'Never confirmed', not the derived 'As at' rendering, when nothing is confirmed and nothing is derived", () => {
    // Review Finding 7: this used to assert `/^(Never confirmed|As at )/` — an alternation
    // matching either of `WardFreshness`'s two non-role renderings, so it could never fail for
    // the one case it actually exercises (`derived` is not set here, so case 3, the floor,
    // applies — see the sibling test below for case 1, where `derived` IS set). The exact
    // mutation that survived: swapping the component's final fallback from "Never confirmed" to
    // `As at ${formatInstant(now)}` left this assertion green.
    render(<WardFreshness confirmedByRole={null} confirmedAt={null} now={NOW_ANCHOR} />);
    expect(screen.getByText("Never confirmed")).toBeTruthy();
  });

  it("renders 'As at' with the formatted now when the screen states its data is derived", () => {
    render(<WardFreshness now={NOW_ANCHOR} derived />);
    expect(screen.getByText(`As at ${formatInstant(NOW_ANCHOR)}`)).toBeTruthy();
  });
});
