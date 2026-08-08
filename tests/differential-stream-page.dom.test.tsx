import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DifferentialStreamPage } from "@/components/differentials/differential-stream-page";
import { differentialPresentationsCards } from "@/lib/differentials";

describe("DifferentialStreamPage presentations stream", () => {
  it("renders the presentations catalogue heading and entry cards", () => {
    render(<DifferentialStreamPage stream="presentations" />);

    expect(screen.getByText("Differentials: Presentations")).toBeInTheDocument();
    expect(screen.getByText("Presentation-focused differential content")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Clinical entries" })).toBeInTheDocument();

    const firstCard = differentialPresentationsCards[0];
    expect(firstCard).toBeTruthy();
    expect(screen.getByRole("link", { name: new RegExp(firstCard!.title) })).toHaveAttribute("href", firstCard!.href);
  });
});
