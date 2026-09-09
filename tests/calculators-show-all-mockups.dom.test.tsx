import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CalculatorsShowAllDirectionsMockup } from "@/components/calculator-mockups";

const STYLES = ["recommended", "soft", "quiet"] as const;

describe("calculators Show all button mockups", () => {
  it("renders three phone homes that differ only by the Show all chip", () => {
    render(<CalculatorsShowAllDirectionsMockup />);

    expect(screen.getByTestId("calculators-show-all-study")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Calculators Show all button styles" })).toBeInTheDocument();

    for (const style of STYLES) {
      const frame = screen.getByTestId(`calculators-show-all-frame-${style}`);
      expect(within(frame).getByRole("heading", { name: "Calculators" })).toBeInTheDocument();
      const showAll = within(frame).getByRole("button", { name: "Show all calculators" });
      expect(showAll).toHaveTextContent("Show all");
      expect(showAll).toHaveClass("min-h-tap");
    }
  });

  it("presses the Show all chip without changing the rest of the home", async () => {
    const user = userEvent.setup();
    render(<CalculatorsShowAllDirectionsMockup />);

    const frame = screen.getByTestId("calculators-show-all-frame-recommended");
    const showAll = within(frame).getByRole("button", { name: "Show all calculators" });
    expect(showAll).toHaveAttribute("aria-pressed", "false");

    await user.click(showAll);
    expect(showAll).toHaveAttribute("aria-pressed", "true");
    expect(within(frame).getByRole("heading", { name: "Calculators" })).toBeInTheDocument();
    expect(within(frame).getByLabelText("Calculator shortcuts")).toBeInTheDocument();
  });

  it("suppresses shared mockup chrome so the three phones are the page", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/mockups/mockups-layout-client.tsx"), "utf8");
    expect(source).toContain('pathname === "/mockups/calculators-show-all"');
    expect(source).toContain("!isCalculatorsShowAllMockup");
  });
});
