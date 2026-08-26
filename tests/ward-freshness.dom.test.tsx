import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatInstant } from "@/components/ward-management/ward-clock";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("freshness stamp", () => {
  it("names the time and the confirming role", () => {
    render(<WardFreshness confirmedAt={NOW_ANCHOR - 20} confirmedByRole="RPH Adult Secure" now={NOW_ANCHOR} />);
    expect(screen.getByText(/Confirmed/)).toHaveTextContent("RPH Adult Secure");
  });

  it("says 'Never confirmed' rather than showing a blank or a dash", () => {
    render(<WardFreshness now={NOW_ANCHOR} />);
    expect(screen.getByText("Never confirmed")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("falls back to the time it was computed when there is nothing to confirm", () => {
    render(<WardFreshness confirmedByRole={null} confirmedAt={null} now={NOW_ANCHOR} />);
    expect(screen.getByText(/^(Never confirmed|As at )/)).toBeTruthy();
  });

  it("renders 'As at' with the formatted now when the screen states its data is derived", () => {
    render(<WardFreshness now={NOW_ANCHOR} derived />);
    expect(screen.getByText(`As at ${formatInstant(NOW_ANCHOR)}`)).toBeTruthy();
  });
});
