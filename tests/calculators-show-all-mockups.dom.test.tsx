import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CalculatorsShowAllDirectionsMockup } from "@/components/calculator-mockups";

const DIRECTIONS = ["baseline", "wordmark", "well", "pair"] as const;

describe("calculators Show all directions mockup", () => {
  it("renders the four phone homes with a recommended well", () => {
    render(<CalculatorsShowAllDirectionsMockup />);

    expect(screen.getByTestId("calculators-show-all-study")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "A Show all chip that sits still" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Icon-well capsule" })).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();

    for (const direction of DIRECTIONS) {
      const frame = screen.getByTestId(`calculators-show-all-frame-${direction}`);
      expect(frame).toHaveAttribute("data-view", "home");
      expect(within(frame).getAllByRole("heading", { name: "Calculators" }).length).toBeGreaterThan(0);
    }
  });

  it("opens the unfiltered directory from the recommended Show all chip and returns home", async () => {
    const user = userEvent.setup();
    render(<CalculatorsShowAllDirectionsMockup />);

    const frame = screen.getByTestId("calculators-show-all-frame-well");
    await user.click(within(frame).getByRole("button", { name: "Show all calculators" }));

    expect(frame).toHaveAttribute("data-view", "directory");
    expect(within(frame).getByRole("heading", { name: "All calculators" })).toBeInTheDocument();
    expect(within(frame).getByLabelText("All calculators")).toBeInTheDocument();

    await user.click(within(frame).getByRole("button", { name: "Back to calculators home" }));
    expect(frame).toHaveAttribute("data-view", "home");
    expect(within(frame).getByRole("heading", { name: "Calculators" })).toBeInTheDocument();
  });

  it("suppresses shared mockup chrome so frames are the only home on the page", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/mockups/mockups-layout-client.tsx"), "utf8");
    expect(source).toContain('pathname === "/mockups/calculators-show-all"');
    expect(source).toContain("!isCalculatorsShowAllMockup");
  });
});
